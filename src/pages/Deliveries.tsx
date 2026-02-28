import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  priority?: string | null;
};

type RouteStop = { lat: number; lng: number; label: string };

type RouteRow = {
  id: string;
  name: string | null;
  delivery_ids: string[] | null;
  total_est_km: number | null;
  created_at?: string;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sLat1 = (a.lat * Math.PI) / 180;
  const sLat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(sLat1) * Math.cos(sLat2);

  return 2 * R * Math.asin(Math.sqrt(x));
}

function orderNearestNeighbor(points: Array<{ id: string; lat: number; lng: number }>) {
  if (points.length <= 2) return points;

  const remaining = [...points];
  const ordered: typeof remaining = [];

  // começa pelo primeiro (pode melhorar depois, mas ok pro MVP)
  let current = remaining.shift()!;
  ordered.push(current);

  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    current = remaining.splice(bestIdx, 1)[0];
    ordered.push(current);
  }

  return ordered;
}

function estimateRouteKm(ordered: Array<{ lat: number; lng: number }>) {
  if (ordered.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < ordered.length - 1; i++) {
    sum += haversineKm(ordered[i], ordered[i + 1]);
  }
  return sum;
}

export default function Routes() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [maxStops, setMaxStops] = useState<number>(5);
  const [radiusKm, setRadiusKm] = useState<number>(1.2);

  async function getUserId() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  async function loadAll() {
    setLoading(true);

    const userId = await getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    const d = await supabase
      .from("deliveries")
      .select("id,client_name,order_id,address_text,lat,lng,priority")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const r = await supabase
      .from("routes")
      .select("id,name,delivery_ids,total_est_km,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (d.error) alert("Erro ao buscar entregas: " + d.error.message);
    if (r.error) alert("Erro ao buscar rotas: " + r.error.message);

    setDeliveries((d.data || []) as any);
    setRoutes((r.data || []) as any);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const byId = useMemo(() => new Map(deliveries.map((d) => [d.id, d] as const)), [deliveries]);

  function buildStopsFromRoute(route: RouteRow): RouteStop[] {
    const ids = Array.isArray(route.delivery_ids) ? route.delivery_ids : [];
    const list = ids.map((id) => byId.get(id)).filter(Boolean) as DeliveryRow[];

    return list
      .filter((d) => d.lat != null && d.lng != null)
      .map((d, idx) => ({
        lat: d.lat as number,
        lng: d.lng as number,
        label: `${idx + 1}. ${d.client_name} — ${d.order_id}`,
      }));
  }

  function openMapbox(stops: RouteStop[]) {
    const payload = encodeURIComponent(JSON.stringify(stops));
    window.location.href = `/route-mapbox?stops=${payload}`;
  }

  async function generateRoutes() {
    const userId = await getUserId();
    if (!userId) return;

    // pega entregas com coordenadas
    const points = deliveries
      .filter((d) => Number.isFinite(d.lat as any) && Number.isFinite(d.lng as any))
      .map((d) => ({
        id: d.id,
        lat: d.lat as number,
        lng: d.lng as number,
      }));

    if (points.length < 2) {
      alert("Precisa de pelo menos 2 entregas com coordenadas para gerar rota.");
      return;
    }

    setLoading(true);

    // agrupamento simples por raio: vai criando grupos a partir de um ponto base
    const remaining = [...points];
    const groups: Array<Array<{ id: string; lat: number; lng: number }>> = [];

    while (remaining.length) {
      const seed = remaining.shift()!;
      const group = [seed];

      // puxa os próximos mais perto do seed até bater maxStops ou acabar
      // (bem MVP, mas funciona)
      while (group.length < maxStops && remaining.length) {
        // acha o melhor candidato mais perto de qualquer ponto do grupo (min dist)
        let bestIdx = -1;
        let bestDist = Infinity;

        for (let i = 0; i < remaining.length; i++) {
          // distância mínima para o grupo
          let minToGroup = Infinity;
          for (const g of group) {
            const d = haversineKm(g, remaining[i]);
            if (d < minToGroup) minToGroup = d;
          }

          if (minToGroup < bestDist) {
            bestDist = minToGroup;
            bestIdx = i;
          }
        }

        if (bestIdx === -1) break;

        // se estiver dentro do raio (ou se raio for muito pequeno e não agrupar nada, cria rota solo)
        if (bestDist <= radiusKm) {
          group.push(remaining.splice(bestIdx, 1)[0]);
        } else {
          break;
        }
      }

      groups.push(group);
    }

    // ordena cada grupo por proximidade (NN) e salva no banco com nome único
    const inserts = groups
      .filter((g) => g.length >= 2) // só salva rotas com 2+ paradas
      .map((g, idx) => {
        const ordered = orderNearestNeighbor(g);
        const km = estimateRouteKm(ordered);

        return {
          user_id: userId,
          name: `Rota ${idx + 1}`, // ✅ NOME ÚNICO
          delivery_ids: ordered.map((p) => p.id),
          total_est_km: Number(km.toFixed(2)),
        };
      });

    if (inserts.length === 0) {
      setLoading(false);
      alert("Não consegui montar rotas com 2+ paradas dentro do raio. Aumente o raio.");
      return;
    }

    const res = await supabase.from("routes").insert(inserts);

    setLoading(false);

    if (res.error) {
      alert("Erro ao salvar rotas: " + res.error.message);
      return;
    }

    await loadAll();
    alert(`Rotas geradas: ${inserts.length}`);
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>

        <div className="row" style={{ gap: 10 }}>
          <button className="ghost" onClick={generateRoutes} disabled={loading}>
            {loading ? "..." : "Gerar rotas"}
          </button>

          <button className="ghost" onClick={loadAll} disabled={loading}>
            {loading ? "..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div>
          <div className="label">Máx paradas por rota</div>
          <input
            value={maxStops}
            onChange={(e) => setMaxStops(Number(e.target.value || 0))}
            type="number"
            min={2}
          />
        </div>

        <div>
          <div className="label">Raio de agrupamento (km)</div>
          <input
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value || 0))}
            type="number"
            step="0.1"
            min={0.1}
          />
        </div>
      </div>

      <div className="list" style={{ marginTop: 16 }}>
        {routes.map((r, idx) => {
          const stops = buildStopsFromRoute(r);
          const canOpen = stops.length >= 2;

          // ✅ Fallback correto: se name vier null, usa índice na lista
          const title = (r.name && r.name.trim()) ? r.name : `Rota ${idx + 1}`;

          return (
            <div key={r.id} className="item col">
              <div className="row space">
                <b>{title}</b>
                <span className="muted">~{r.total_est_km ?? "?"} km</span>
              </div>

              <ol style={{ marginTop: 8 }}>
                {stops.map((s, sIdx) => (
                  <li key={sIdx}>
                    {s.label}
                    {/* se quiser esconder lat/lng aqui, é só apagar este bloco */}
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.lat}, {s.lng}
                    </div>
                  </li>
                ))}
              </ol>

              <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button className="ghost" disabled={!canOpen} onClick={() => openMapbox(stops)}>
                  Ver Rota
                </button>

                {!canOpen && (
                  <span className="muted">Precisa de 2+ paradas com coordenadas.</span>
                )}
              </div>
            </div>
          );
        })}

        {routes.length === 0 && <p className="muted">Nenhuma rota ainda.</p>}
      </div>
    </div>
  );
}