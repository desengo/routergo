import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { generateRoutesMVP, type Stop } from "../lib/routing";

type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
};

type RouteRow = {
  id: string;
  name: string | null;
  stops: Stop[]; // JSON no banco
  total_est_km: number | null;
  created_at?: string;
};

export default function Routes() {
  const nav = useNavigate();

  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [maxStops, setMaxStops] = useState(5);
  const [radiusKm, setRadiusKm] = useState(1.2);

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
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const r = await supabase
      .from("routes")
      .select("id,name,stops,total_est_km,created_at")
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

  const validStops = useMemo(() => {
    return deliveries
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => ({
        delivery_id: d.id,
        lat: d.lat as number,
        lng: d.lng as number,
        label: `${d.client_name} — ${d.address_text}`,
      }));
  }, [deliveries]);

  function openMapbox(stops: Stop[]) {
    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
    nav("/route-mapbox");
  }

  async function onGenerate() {
    const user = await getUser();
    if (!user) return;

    if (validStops.length < 2) {
      alert("Precisa de pelo menos 2 entregas com coordenadas para gerar rota.");
      return;
    }

    setLoading(true);

    // 1) gera rotas no front (MVP)
    const generated = generateRoutesMVP(validStops, { maxStops, radiusKm });

    // 2) salva no Supabase (routes)
    // opcional: limpar rotas antigas do usuário antes de inserir
    // await supabase.from("routes").delete().eq("user_id", user.id);

    const rowsToInsert = generated.map((g, idx) => ({
      user_id: user.id,
      name: `Rota ${idx + 1}`,
      stops: g.stops,
      total_est_km: g.totalKm,
    }));

    const ins = await supabase.from("routes").insert(rowsToInsert);

    setLoading(false);

    if (ins.error) {
      alert("Erro ao salvar rotas: " + ins.error.message);
      return;
    }

    await loadAll();
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>
        <div className="row" style={{ gap: 10 }}>
          <button className="primary" onClick={onGenerate} disabled={loading}>
            Gerar rotas
          </button>
          <button className="ghost" onClick={loadAll}>
            {loading ? "..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="grid2">
        <div>
          <label>Máx paradas por rota</label>
          <input
            value={maxStops}
            onChange={(e) => setMaxStops(Number(e.target.value || 1))}
            type="number"
            min={2}
          />
        </div>

        <div>
          <label>Raio de agrupamento (km)</label>
          <input
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value || 0.5))}
            type="number"
            step="0.1"
            min={0.2}
          />
        </div>
      </div>

      <div className="list">
        {routes.map((r) => {
          const stops = Array.isArray(r.stops) ? r.stops : [];
          const canOpen = stops.length >= 2;

          return (
            <div key={r.id} className="item col">
              <div className="row space">
                <b>{r.name || "Rota"}</b>
                <span className="muted">~{r.total_est_km?.toFixed?.(2) ?? r.total_est_km ?? "?"} km</span>
              </div>

              <ol style={{ marginTop: 8 }}>
                {stops.map((s, idx) => (
                  <li key={idx}>
                    {idx + 1}. {s.label || "Parada"}
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

                {!canOpen && <span className="muted">Precisa de 2+ paradas com coordenadas.</span>}
              </div>
            </div>
          );
        })}

        {routes.length === 0 && <p className="muted">Nenhuma rota ainda.</p>}
      </div>
    </div>
  );
}
