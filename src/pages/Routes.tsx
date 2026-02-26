import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { clusterByRadius, orderNearestNeighbor, totalDistanceKm, type Stop } from "../lib/routing";

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
  stops: Array<{ lat: number; lng: number; label: string }> | null;
  total_est_km: number | null;
  created_at?: string;
};

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export default function RoutesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [maxStops, setMaxStops] = useState<number>(5);
  const [radiusKm, setRadiusKm] = useState<number>(1.2);

  async function loadAll() {
    const uid = await getUserId();
    if (!uid) return;

    setLoading(true);

    const d = await supabase
      .from("deliveries")
      .select("id,client_name,order_id,address_text,lat,lng")
      .eq("user_id", uid);

    const r = await supabase
      .from("routes")
      .select("id,name,stops,total_est_km,created_at")
      .eq("user_id", uid)
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

  const usableStops: Stop[] = useMemo(() => {
    return deliveries
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => ({
        lat: d.lat as number,
        lng: d.lng as number,
        label: `${d.client_name} — ${d.address_text}`,
      }));
  }, [deliveries]);

  function openMapbox(stops: Array<{ lat: number; lng: number; label: string }>) {
    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
    window.location.href = "/route-mapbox";
  }

  async function gerarRotas() {
    const uid = await getUserId();
    if (!uid) return;

    if (usableStops.length < 2) {
      alert("Precisa de pelo menos 2 entregas com coordenadas para gerar rota.");
      return;
    }

    const groups = clusterByRadius(
      usableStops,
      Math.max(0.1, Number(radiusKm) || 1.2),
      Math.max(2, Number(maxStops) || 5)
    );

    setLoading(true);

    // (opcional) apaga rotas antigas antes de gerar novamente:
    // await supabase.from("routes").delete().eq("user_id", uid);

    for (let i = 0; i < groups.length; i++) {
      const ordered = orderNearestNeighbor(groups[i]);
      const km = totalDistanceKm(ordered);

      const ins = await supabase.from("routes").insert({
        user_id: uid,
        name: `Rota ${i + 1}`,
        stops: ordered,
        total_est_km: km,
      });

      if (ins.error) {
        setLoading(false);
        alert("Erro ao salvar rota: " + ins.error.message);
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
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button onClick={gerarRotas} disabled={loading}>
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
          <input type="number" min={2} value={maxStops} onChange={(e) => setMaxStops(Number(e.target.value))} />
        </div>
        <div>
          <label className="muted">Raio de agrupamento (km)</label>
          <input type="number" step="0.1" min={0.1} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} />
        </div>
      </div>

      <div className="muted" style={{ marginTop: 10 }}>
        Entregas com coordenadas disponíveis: <b>{usableStops.length}</b>
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
                  <li key={idx}>{idx + 1}. {s.label}</li>
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

        {routes.length === 0 && <p className="muted">Nenhuma rota ainda. Gere uma rota.</p>}
      </div>
    </div>
  );
}