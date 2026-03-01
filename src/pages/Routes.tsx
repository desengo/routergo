// src/pages/Routes.tsx
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

type RouteStop = { lat: number; lng: number; label?: string; delivery_id?: string };

type RouteRow = {
  id: string;
  name: string | null;
  status: string | null; // "ready" | "assigned" | "picked_up" | "in_progress" | "done"
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
      .select("id,client_name,order_id,address_text,lat,lng")
      .eq("user_id", user.id);

    const r = await supabase
      .from("routes")
      .select("id,name,status,delivery_ids,stops,total_est_km,created_at,finished_at")
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

  const byId = useMemo(() => new Map(deliveries.map((d) => [d.id, d] as const)), [deliveries]);

  function openMapbox(stops: Array<{ lat: number; lng: number; label: string }>) {
    // ✅ RouteMapbox.tsx já lê do sessionStorage("routergo_stops")
    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
    window.location.href = "/route-mapbox";
  }

  function buildStopsFromRoute(route: RouteRow) {
    // 1) se tiver stops salvos na route, usa eles
    if (Array.isArray(route.stops) && route.stops.length) {
      return route.stops
        .map((s, idx) => ({
          lat: Number(s.lat),
          lng: Number(s.lng),
          label: (s.label && String(s.label)) || `Parada ${idx + 1}`,
        }))
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    }

    // 2) senão, monta via delivery_ids + deliveries
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

      const { error } = await supabase
        .from("routes")
        .update({
          status: "done",
          finished_at: new Date().toISOString(),
        })
        .eq("id", routeId);

      if (error) throw error;

      await loadAll(); // ✅ some do card atual e aparece em Concluídas
    } catch (e: any) {
      alert("Erro ao concluir rota: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  const novas = useMemo(
    () => routes.filter((r) => (r.status || "ready") === "ready"),
    [routes]
  );

  const andamento = useMemo(
    () =>
      routes.filter((r) =>
        ["assigned", "picked_up", "in_progress"].includes(r.status || "")
      ),
    [routes]
  );

  const concluidas = useMemo(
    () => routes.filter((r) => (r.status || "") === "done"),
    [routes]
  );

  function Section({
    title,
    subtitle,
    list,
    showConcluir,
  }: {
    title: string;
    subtitle: string;
    list: RouteRow[];
    showConcluir: boolean;
  }) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="topbar">
          <h3>{title}</h3>
          <button className="ghost" onClick={loadAll}>
            {loading ? "..." : "Atualizar"}
          </button>
        </div>

        <p className="muted" style={{ marginTop: 6 }}>
          {subtitle}
        </p>

        <div className="list" style={{ marginTop: 12 }}>
          {list.map((r) => {
            const stops = buildStopsFromRoute(r);
            const canOpen = stops.length >= 2;

            return (
              <div key={r.id} className="item col">
                <div className="row space">
                  <b>{r.name || "Rota"}</b>
                  <span className="muted">~{r.total_est_km ?? "?"} km</span>
                </div>

                <ol style={{ marginTop: 8 }}>
                  {stops.map((s, idx) => (
                    <li key={idx}>{s.label}</li>
                  ))}
                </ol>

                <div
                  className="row"
                  style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}
                >
                  <button
                    className="ghost"
                    disabled={!canOpen}
                    onClick={() => openMapbox(stops)}
                  >
                    Ver rota
                  </button>

                  {showConcluir && (
                    <button
                      className="primary"
                      disabled={loading}
                      onClick={() => concluirRota(r.id)}
                    >
                      Concluir
                    </button>
                  )}

                  {!canOpen && (
                    <span className="muted">
                      Precisa de pelo menos 2 paradas com coordenadas.
                    </span>
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
        list={novas}
        showConcluir={true}
      />

      <Section
        title="Em andamento"
        subtitle="Rotas atribuídas/retiradas/em rota."
        list={andamento}
        showConcluir={true}
      />

      <Section
        title="Concluídas"
        subtitle="Rotas finalizadas."
        list={concluidas}
        showConcluir={false}
      />
    </div>
  );
}