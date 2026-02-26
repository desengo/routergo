import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  created_at?: string;
};

type RouteStop = { lat: number; lng: number; label: string; delivery_id?: string };

type RouteRow = {
  id: string;
  user_id: string;
  name: string | null;
  stops: RouteStop[] | null;
  total_est_km: number | null;
  created_at?: string;
};

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.sin(dLng / 2) ** 2;
  const c = s1 + Math.cos(lat1) * Math.cos(lat2) * s2;
  return 2 * R * Math.asin(Math.sqrt(c));
}

function orderNearestNeighbor(points: RouteStop[]) {
  if (points.length <= 2) return points;

  const remaining = [...points];
  const ordered: RouteStop[] = [];

  // começa pelo 1º
  let current = remaining.shift()!;
  ordered.push(current);

  while (remaining.length) {
    let bestIdx = 0;
    let bestD = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(
        { lat: current.lat, lng: current.lng },
        { lat: remaining[i].lat, lng: remaining[i].lng }
      );
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }

    current = remaining.splice(bestIdx, 1)[0];
    ordered.push(current);
  }

  return ordered;
}

function totalDistanceKm(stops: RouteStop[]) {
  let sum = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    sum += haversineKm(
      { lat: stops[i].lat, lng: stops[i].lng },
      { lat: stops[i + 1].lat, lng: stops[i + 1].lng }
    );
  }
  return sum;
}

// Agrupamento simples por raio: pega um ponto, puxa vizinhos próximos até encher a rota
function clusterByRadius(stops: RouteStop[], radiusKm: number, maxStops: number) {
  const remaining = [...stops];
  const groups: RouteStop[][] = [];

  while (remaining.length) {
    const seed = remaining.shift()!;
    const group: RouteStop[] = [seed];

    // tenta adicionar os mais próximos do seed
    for (let i = 0; i < remaining.length && group.length < maxStops; ) {
      const d = haversineKm(
        { lat: seed.lat, lng: seed.lng },
        { lat: remaining[i].lat, lng: remaining[i].lng }
      );

      if (d <= radiusKm) {
        group.push(remaining.splice(i, 1)[0]);
      } else {
        i++;
      }
    }

    groups.push(group);
  }

  return groups;
}

export default function Routes() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [maxStops, setMaxStops] = useState<number>(5);
  const [radiusKm, setRadiusKm] = useState<number>(1.2);

  async function getUser() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  }

  async function loadAll() {
    setLoading(true);

    const user = await getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const d = await supabase
      .from("deliveries")
      .select("id,client_name,order_id,address_text,lat,lng,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const r = await supabase
      .from("routes")
      .select("id,user_id,name,stops,total_est_km,created_at")
      .eq("user_id", user.id)
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

  const deliveriesWithCoords = useMemo(() => {
    return deliveries
      .map((d) => ({
        ...d,
        lat: toNum(d.lat),
        lng: toNum(d.lng),
      }))
      .filter((d) => d.lat != null && d.lng != null) as Array<
      DeliveryRow & { lat: number; lng: number }
    >;
  }, [deliveries]);

  function openMapbox(stops: Array<{ lat: number; lng: number; label: string }>) {
    const payload = encodeURIComponent(JSON.stringify(stops));
    window.location.href = `/route-mapbox?stops=${payload}`;
  }

  async function gerarRotas() {
    const user = await getUser();
    if (!user) return;

    const base = deliveriesWithCoords.map((d) => ({
      lat: d.lat,
      lng: d.lng,
      label: `${d.client_name} — ${d.address_text}`,
      delivery_id: d.id,
    }));

    if (base.length < 2) {
      alert("Precisa de pelo menos 2 entregas com coordenadas para gerar rota.");
      return;
    }

    const groups = clusterByRadius(base, Number(radiusKm) || 1.2, Math.max(2, Number(maxStops) || 5));

    setLoading(true);

    // opcional: limpar rotas antigas
    // await supabase.from("routes").delete().eq("user_id", user.id);

    for (let i = 0; i < groups.length; i++) {
      const ordered = orderNearestNeighbor(groups[i]);
      const km = totalDistanceKm(ordered);

      const { error } = await supabase.from("routes").insert({
        user_id: user.id,
        name: `Rota ${i + 1}`,
        stops: ordered,
        total_est_km: km,
      });

      if (error) {
        setLoading(false);
        alert("Erro ao salvar rota: " + error.message);
        return;
      }
    }

    setLoading(false);
    await loadAll();
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>
        <div className="row" style={{ gap: 10 }}>
          <button className="ghost" onClick={gerarRotas} disabled={loading}>
            {loading ? "..." : "Gerar rotas"}
          </button>
          <button className="ghost" onClick={loadAll}>
            {loading ? "..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div>
          <label className="muted">Máx paradas por rota</label>
          <input
            value={maxStops}
            onChange={(e) => setMaxStops(Number(e.target.value))}
            type="number"
            min={2}
          />
        </div>
        <div>
          <label className="muted">Raio de agrupamento (km)</label>
          <input
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            type="number"
            step="0.1"
            min={0.1}
          />
        </div>
      </div>

      <div className="list" style={{ marginTop: 14 }}>
        {routes.map((r) => {
          const stops = Array.isArray(r.stops) ? r.stops : [];
          const canOpen = stops.length >= 2;

          return (
            <div key={r.id} className="item col">
              <div className="row space">
                <b>{r.name || "Rota"}</b>
                <span className="muted">~{(r.total_est_km ?? 0).toFixed(2)} km</span>
              </div>

              <ol style={{ marginTop: 10 }}>
                {stops.map((s, idx) => (
                  <li key={idx}>
                    {idx + 1}. {s.label}
                  </li>
                ))}
              </ol>

              <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button className="ghost" disabled={!canOpen} onClick={() => openMapbox(stops)}>
                  Ver no Mapbox
                </button>

                {!canOpen && (
                  <span className="muted">
                    Precisa de pelo menos 2 paradas com coordenadas.
                  </span>
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