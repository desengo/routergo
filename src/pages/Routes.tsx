import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateRoutesMVP, Stop as MVPStop } from "../lib/routing";

type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  created_at?: string;
};

type Stop = { lat: number; lng: number; label?: string; delivery_id?: string };

type RouteRow = {
  id: string;
  name: string | null;
  delivery_ids: string[] | null;
  stops: Stop[] | null;
  total_est_km: number | null;
  created_at?: string;
};

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export default function Routes() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  // parâmetros do MVP (pode manter hidden se quiser)
  const [maxStops] = useState(5);
  const [radiusKm] = useState(1.2);

  // ✅ evita rodar auto-geração em loop (StrictMode chama useEffect 2x no dev)
  const didAutoRef = useRef(false);

  const usableStops: MVPStop[] = useMemo(() => {
    return deliveries
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => ({
        delivery_id: d.id,
        lat: d.lat as number,
        lng: d.lng as number,
        label: `${d.client_name} — ${d.order_id || ""}`.trim(),
      }));
  }, [deliveries]);

  function openMapbox(stops: Stop[]) {
    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
    window.location.href = "/route-mapbox";
  }

  function buildUnroutedDeliveries(allDeliveries: DeliveryRow[], allRoutes: RouteRow[]) {
    const routedIds = uniq(
      (allRoutes || [])
        .flatMap((r) => (Array.isArray(r.delivery_ids) ? r.delivery_ids : []))
        .filter(Boolean)
    );

    const routedSet = new Set(routedIds);

    // ✅ só entra no gerador o que ainda não está em nenhuma rota
    return allDeliveries.filter((d) => !routedSet.has(d.id));
  }

  async function loadAll(andAutoGenerate = false) {
    setLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) return;

      const d = await supabase
        .from("deliveries")
        .select("id,client_name,order_id,address_text,lat,lng,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (d.error) throw d.error;

      const r = await supabase
        .from("routes")
        .select("id,name,delivery_ids,stops,total_est_km,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (r.error) throw r.error;

      const dData = (d.data || []) as DeliveryRow[];
      const rData = (r.data || []) as RouteRow[];

      setDeliveries(dData);
      setRoutes(rData);

      // ✅ auto-gera apenas 1x por entrada na tela e só se tiver entregas novas
      if (andAutoGenerate && !didAutoRef.current) {
        didAutoRef.current = true;
        await autoGenerateIfNeeded(userId, dData, rData);
        // recarrega para mostrar as novas rotas
        const rr = await supabase
          .from("routes")
          .select("id,name,delivery_ids,stops,total_est_km,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (!rr.error) setRoutes((rr.data || []) as any);
      }
    } catch (e: any) {
      alert("Erro ao buscar dados: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function autoGenerateIfNeeded(userId: string, dData: DeliveryRow[], rData: RouteRow[]) {
    // pega entregas ainda não roteadas
    const unrouted = buildUnroutedDeliveries(dData, rData);

    // só conta as que têm coordenadas
    const unroutedStops: MVPStop[] = unrouted
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => ({
        delivery_id: d.id,
        lat: d.lat as number,
        lng: d.lng as number,
        label: `${d.client_name} — ${d.order_id || ""}`.trim(),
      }));

    // se não tem pelo menos 2 pontos novos, não gera nada
    if (unroutedStops.length < 2) return;

    const generated = generateRoutesMVP(unroutedStops, { maxStops, radiusKm });
    if (!generated.length) return;

    // numeração sequencial baseada no total já existente no banco
    const { count, error: countErr } = await supabase
      .from("routes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countErr) throw countErr;

    const startIndex = (count || 0) + 1;

    const rows = generated.map((gr, idx) => {
      const stops: Stop[] = gr.stops.map((s, i) => ({
        delivery_id: s.delivery_id,
        lat: s.lat,
        lng: s.lng,
        label: `${i + 1}. ${s.label || "Parada"}`,
      }));

      const delivery_ids = gr.stops.map((s) => s.delivery_id).filter(Boolean) as string[];

      return {
        user_id: userId,
        name: `Rota ${startIndex + idx}`,
        delivery_ids,
        stops,
        total_est_km: Number.isFinite(gr.totalKm) ? gr.totalKm : null,
      };
    });

    const ins = await supabase.from("routes").insert(rows);
    if (ins.error) throw ins.error;
  }

  useEffect(() => {
    // ✅ ao entrar na aba, carrega e auto-gera somente se precisar
    loadAll(true);
  }, []);

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>
        <button className="ghost" onClick={() => loadAll(false)}>
          {loading ? "..." : "Atualizar"}
        </button>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        * Rotas são geradas automaticamente quando existem entregas novas (ainda não roteadas).
      </p>

      <div className="list" style={{ marginTop: 12 }}>
        {routes.map((r) => {
          const stops = Array.isArray(r.stops) ? r.stops : [];
          const canOpen = stops.length >= 2;

          return (
            <div key={r.id} className="item col">
              <div className="row space">
                <b>{r.name || "Rota"}</b>
                <span className="muted">~{r.total_est_km ?? "?"} km</span>
              </div>

              <ol style={{ marginTop: 8 }}>
                {stops.map((s, idx) => (
                  <li key={idx}>{s.label || `Parada ${idx + 1}`}</li>
                ))}
              </ol>

              <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button className="ghost" disabled={!canOpen} onClick={() => openMapbox(stops)}>
                  Ver rota
                </button>

                {!canOpen && (
                  <span className="muted">Precisa de pelo menos 2 paradas com coordenadas.</span>
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