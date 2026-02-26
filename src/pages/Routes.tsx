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

type RouteStop = {
  lat: number;
  lng: number;
  label?: string;
};

type RouteRow = {
  id: string;
  name: string | null;
  delivery_ids: string[] | null;
  total_est_km: number | null;
  created_at: string;
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
      .select("id,name,delivery_ids,total_est_km,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (d.error) alert("Erro ao buscar entregas: " + d.error.message);
    if (r.error) alert("Erro ao buscar rotas: " + r.error.message);

    setDeliveries(d.data || []);
    setRoutes(r.data || []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const deliveriesById = useMemo(() => {
    return new Map(deliveries.map((d) => [d.id, d]));
  }, [deliveries]);

  function openMapbox(stops: RouteStop[]) {
    const payload = encodeURIComponent(JSON.stringify(stops));
    window.location.href = `/route-mapbox?stops=${payload}`;
  }

  function buildStops(route: RouteRow): RouteStop[] {
    if (!route.delivery_ids) return [];

    return route.delivery_ids
      .map((id) => deliveriesById.get(id))
      .filter((d): d is DeliveryRow => !!d && d.lat !== null && d.lng !== null)
      .map((d, index) => ({
        lat: d.lat as number,
        lng: d.lng as number,
        label: `${index + 1}. ${d.client_name} — ${d.order_id}`,
      }));
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
        {routes.map((route) => {
          const stops = buildStops(route);
          const canOpen = stops.length >= 2;

          return (
            <div key={route.id} className="item col">
              <div className="row space">
                <b>{route.name || "Rota"}</b>
                <span className="muted">
                  ~{route.total_est_km ?? "?"} km
                </span>
              </div>

              <ol style={{ marginTop: 8 }}>
                {stops.map((s, idx) => (
                  <li key={idx}>
                    {s.label}
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.lat}, {s.lng}
                    </div>
                  </li>
                ))}
              </ol>

              <div style={{ marginTop: 10 }}>
                <button
                  className="ghost"
                  disabled={!canOpen}
                  onClick={() => openMapbox(stops)}
                >
                  Ver no Mapbox
                </button>

                {!canOpen && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    Precisa de pelo menos 2 entregas com coordenadas.
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {routes.length === 0 && (
          <p className="muted">Nenhuma rota criada ainda.</p>
        )}
      </div>
    </div>
  );
}