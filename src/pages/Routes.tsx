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
  delivery_ids?: string[];
  stops?: RouteStop[];
  total_est_km: number | null;
  created_at?: string;
};

export default function RoutesPage() {
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
      .select("id,name,delivery_ids,stops,total_est_km,created_at")
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

  function buildStopsFromRoute(route: RouteRow) {
    // 1) se já existe route.stops (JSON)
    if (Array.isArray(route.stops) && route.stops.length) {
      return route.stops
        .map((s, idx) => ({
          lat: Number(s.lat),
          lng: Number(s.lng),
          label: s.label || `Parada ${idx + 1}`,
        }))
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    }

    // 2) senão usa delivery_ids
    const ids = Array.isArray(route.delivery_ids) ? route.delivery_ids : [];
    const list = ids.map((id) => byId.get(id)).filter(Boolean) as DeliveryRow[];

    return list
      .filter((d) => d.lat != null && d.lng != null)
      .map((d, idx) => ({
        lat: d.lat as number,
        lng: d.lng as number,
        label: `${idx + 1}. ${d.client_name} — ${d.address_text}`,
      }));
  }

  function openMapbox(stops: Array<{ lat: number; lng: number; label: string }>) {
    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
    window.location.href = "/route-mapbox";
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>
        <button className="ghost" onClick={loadAll}>
          {loading ? "..." : "Atualizar"}
        </button>
      </div>

      <div className="list">
        {routes.map((r) => {
          const stops = buildStopsFromRoute(r);
          const canOpen = stops.length >= 2;

          return (
            <div key={r.id} className="item col">
              <div className="row space">
                <b>{r.name || "Rota"}</b>
                <span className="muted">~{r.total_est_km ?? "?"} km</span>
              </div>

              <ol style={{ marginTop: 10 }}>
                {stops.map((s, idx) => (
                  <li key={idx}>
                    {s.label}
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.lat}, {s.lng}
                    </div>
                  </li>
                ))}
              </ol>

              <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button className="ghost" disabled={!canOpen} onClick={() => openMapbox(stops)}>
                  Ver no Mapbox
                </button>

                {!canOpen && <span className="muted">Precisa de pelo menos 2 paradas com coordenadas.</span>}
              </div>
            </div>
          );
        })}

        {routes.length === 0 && <p className="muted">Nenhuma rota ainda.</p>}
      </div>
    </div>
  );
}