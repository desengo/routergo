import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateRoutesMVP } from "../lib/routing";
import { googleMapsRouteUrl } from "../lib/maps";

type DeliveryRow = {
  id: string;
  client_name: string;
  address_text: string;
  priority: "normal" | "urgente";
  lat: number | null;
  lng: number | null;
};

type RouteRow = {
  id: string;
  name: string | null;
  delivery_ids: string[];
  total_est_km: number | null;
};

export default function Routes() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [maxStops, setMaxStops] = useState(5);
  const [radiusKm, setRadiusKm] = useState(1.2);

  async function loadAll() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const d = await supabase
      .from("deliveries")
      .select("id,client_name,address_text,priority,lat,lng")
      .eq("user_id", user.id);

    const r = await supabase
      .from("routes")
      .select("id,name,delivery_ids,total_est_km")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (d.error) alert("Erro ao buscar entregas: " + d.error.message);
    if (r.error) alert("Erro ao buscar rotas: " + r.error.message);

    setDeliveries((d.data || []) as any);
    setRoutes((r.data || []) as any);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const byId = useMemo(
    () => new Map(deliveries.map((d) => [d.id, d] as const)),
    [deliveries]
  );

  async function build() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const plans = generateRoutesMVP({
      deliveries: deliveries as any,
      maxStopsPerRoute: maxStops,
      clusterRadiusKm: radiusKm
    });

    const del = await supabase.from("routes").delete().eq("user_id", user.id);
    if (del.error) return alert("Erro ao limpar rotas: " + del.error.message);

    for (let i = 0; i < plans.length; i++) {
      const p = plans[i];

      const ins = await supabase.from("routes").insert({
        user_id: user.id,
        name: `Rota ${i + 1}`,
        delivery_ids: p.delivery_ids,
        total_est_km: p.total_est_km
      });

      if (ins.error) {
        return alert("Erro ao salvar rota: " + ins.error.message);
      }
    }

    await loadAll();
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>
        <div className="row">
          <button onClick={build}>Gerar rotas</button>
          <button className="ghost" onClick={loadAll}>
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid">
        <label>Máx paradas por rota</label>
        <input
          value={String(maxStops)}
          onChange={(e) => setMaxStops(Number(e.target.value || 5))}
        />

        <label>Raio de agrupamento (km)</label>
        <input
          value={String(radiusKm)}
          onChange={(e) => setRadiusKm(Number(e.target.value || 1.2))}
        />
      </div>

      <div className="list">
        {routes.map((r) => {
          const stops = r.delivery_ids
            .map((id) => byId.get(id))
            .filter(Boolean) as DeliveryRow[];

          const coords = stops
            .filter((s) => s.lat != null && s.lng != null)
            .map((s) => ({ lat: s.lat!, lng: s.lng! }));

          const url = coords.length ? googleMapsRouteUrl(coords) : "";

          return (
            <div key={r.id} className="item col">
              <div className="row space">
                <b>{r.name}</b>
                <span className="muted">~{r.total_est_km ?? "?"} km</span>
              </div>

              <ol>
                {stops.map((s) => (
                  <li key={s.id}>
                    {s.client_name} — {s.address_text}
                  </li>
                ))}
              </ol>

              {url && (
                <a className="link" href={url} target="_blank">
                  Abrir no Google Maps
                </a>
              )}
            </div>
          );
        })}

        {routes.length === 0 && (
          <p className="muted">Nenhuma rota gerada ainda.</p>
        )}
      </div>
    </div>
  );
}