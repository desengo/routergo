import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
};

type RouteStop = { lat: number; lng: number; label?: string };

type RouteRow = {
  id: string;
  name: string | null;
  status: string | null;
  delivery_ids?: string[] | null;
  stops?: RouteStop[] | null;
  total_est_km: number | null;
  created_at?: string;
  finished_at?: string | null;
};

export default function Routes() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function getUserId() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  async function loadAll() {
    setLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) return;

      const d = await supabase
        .from("deliveries")
        .select("id,client_name,order_id,address_text,lat,lng")
        .eq("user_id", userId);

      const r = await supabase
        .from("routes")
        .select("id,name,status,delivery_ids,stops,total_est_km,created_at,finished_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (d.error) throw d.error;
      if (r.error) throw r.error;

      setDeliveries((d.data || []) as any);
      setRoutes((r.data || []) as any);
    } catch (e: any) {
      alert("Erro ao buscar rotas: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const byId = useMemo(
    () => new Map(deliveries.map((d) => [d.id, d] as const)),
    [deliveries]
  );

  function openMapbox(stops: Array<{ lat: number; lng: number; label: string }>) {
    // ✅ RouteMapbox LÊ routergo_stops do sessionStorage
    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
    window.location.href = "/route-mapbox";
  }

  function buildStopsFromRoute(route: RouteRow) {
    // 1) Se já tem stops salvos no banco
    if (Array.isArray(route.stops) && route.stops.length) {
      return route.stops
        .map((s, idx) => ({
          lat: Number(s.lat),
          lng: Number(s.lng),
          label: s.label || `Parada ${idx + 1}`,
        }))
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    }

    // 2) Senão, monta pelos delivery_ids
    const ids = Array.isArray(route.delivery_ids) ? route.delivery_ids : [];
    const list = ids.map((id) => byId.get(id)).filter(Boolean) as DeliveryRow[];

    return list
      .filter((d) => d.lat != null && d.lng != null)
      .map((d, idx) => ({
        lat: d.lat as number,
        lng: d.lng as number,
        label: `${idx + 1}. ${d.client_name} — ${d.order_id || ""}`.trim(),
      }));
  }

  async function concluirRota(routeId: string) {
    try {
      setLoading(true);

      // ✅ sem paid_at, sem profiles, sem rpc
      const { error } = await supabase
        .from("routes")
        .update({
          status: "done",
          finished_at: new Date().toISOString(),
        })
        .eq("id", routeId);

      if (error) throw error;

      await loadAll();
    } catch (e: any) {
      alert("Erro ao concluir rota: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  // ✅ separa por status
  const rotasNovas = routes.filter((r) => (r.status || "ready") === "ready");
  const rotasAndamento = routes.filter((r) =>
    ["assigned", "picked_up", "in_progress"].includes(r.status || "")
  );
  const rotasConcluidas = routes.filter((r) => (r.status || "") === "done");

  function Section({
    title,
    subtitle,
    list,
    showConcluir,
  }: {
    title: string;
    subtitle?: string;
    list: RouteRow[];
    showConcluir: boolean;
  }) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="topbar">
          <div>
            <h3 style={{ margin: 0 }}>{title}</h3>
            {subtitle && (
              <div className="muted" style={{ marginTop: 6 }}>
                {subtitle}
              </div>
            )}
          </div>

          <button className="ghost" onClick={loadAll}>
            {loading ? "..." : "Atualizar"}
          </button>
        </div>

        <div className="list" style={{ marginTop: 12 }}>
          {list.map((r) => {
            const stops = buildStopsFromRoute(r);
            const canOpen = stops.length >= 2;

            return (
              <div key={r.id} className="item col">
                <div className="row space">
                  <b>{r.name || "Rota"}</b>
                  <span className="muted">
                    ~{r.total_est_km != null ? r.total_est_km.toFixed(2) : "0"} km
                  </span>
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

                  {showConcluir && (
                    <button className="primary" disabled={loading} onClick={() => concluirRota(r.id)}>
                      Concluir
                    </button>
                  )}

                  {!canOpen && (
                    <span className="muted">Precisa de pelo menos 2 paradas com coordenadas.</span>
                  )}
                </div>
              </div>
            );
          })}

          {list.length === 0 && <p className="muted">Nenhuma rota aqui.</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Section
        title="Rotas novas"
        subtitle="Criadas e aguardando andamento."
        list={rotasNovas}
        showConcluir={true}
      />

      <Section
        title="Em andamento"
        subtitle="Rotas já iniciadas."
        list={rotasAndamento}
        showConcluir={true}
      />

      <Section
        title="Rotas concluídas"
        subtitle="Finalizadas e arquivadas."
        list={rotasConcluidas}
        showConcluir={false}
      />
    </div>
  );
}