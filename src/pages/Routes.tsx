import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { googleMapsRouteUrl } from "../lib/maps";
import { generateRoutesMVP } from "../lib/routing";

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
  delivery_ids: string[] | null;
  total_est_km: number | null;
  created_at: string;
};

type Stop = { lat: number; lng: number; label: string };

export default function Routes() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  // controles de geração
  const [maxStops, setMaxStops] = useState(5);
  const [clusterKm, setClusterKm] = useState(1.2);

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
      .select("id,name,delivery_ids,total_est_km,created_at")
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

  function buildStopsFromRoute(route: RouteRow): Stop[] {
    const ids = Array.isArray(route.delivery_ids) ? route.delivery_ids : [];
    const list = ids.map((id) => byId.get(id)).filter(Boolean) as DeliveryRow[];

    // só entra stop com coordenadas
    const stops = list
      .filter((d) => d.lat != null && d.lng != null)
      .map((d, idx) => ({
        lat: d.lat as number,
        lng: d.lng as number,
        label: `${idx + 1}. ${d.client_name} — ${d.address_text}`,
      }));

    return stops;
  }

  function openMapbox(stops: Stop[]) {
    const payload = encodeURIComponent(JSON.stringify(stops));
    window.location.href = `/route-mapbox?stops=${payload}`;
  }

  async function gerarRotas() {
    const user = await getUser();
    if (!user) return;

    // só usar entregas com coordenadas
    const pts = deliveries.filter((d) => d.lat != null && d.lng != null);

    if (pts.length < 2) {
      alert("Precisa de pelo menos 2 entregas com coordenadas para gerar rota.");
      return;
    }

    setLoading(true);

    try {
      // gera rotas (MVP)
      const result = generateRoutesMVP(
        pts.map((p) => ({
          id: p.id,
          lat: p.lat as number,
          lng: p.lng as number,
        })),
        { maxStops, clusterKm }
      );

      // salvar no supabase
      // cada rota vira uma linha
      for (let i = 0; i < result.length; i++) {
        const ids = result[i].ids;
        const km = result[i].estKm ?? null;

        const { error } = await supabase.from("routes").insert({
          user_id: user.id,
          name: `Rota ${i + 1}`,
          delivery_ids: ids,
          total_est_km: km,
        });

        if (error) throw error;
      }

      await loadAll();
      alert("Rotas geradas e salvas ✅");
    } catch (e: any) {
      alert("Erro ao gerar/salvar rotas: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>
        <div className="row" style={{ gap: 10 }}>
          <button className="ghost" onClick={gerarRotas} disabled={loading}>
            {loading ? "..." : "Gerar rotas"}
          </button>
          <button className="ghost" onClick={loadAll} disabled={loading}>
            {loading ? "..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 10 }}>
        <div>
          <label className="muted">Máx paradas por rota</label>
          <input value={maxStops} onChange={(e) => setMaxStops(Number(e.target.value || 1))} />
        </div>
        <div>
          <label className="muted">Raio de agrupamento (km)</label>
          <input value={clusterKm} onChange={(e) => setClusterKm(Number(e.target.value || 1))} />
        </div>
      </div>

      <div className="list" style={{ marginTop: 14 }}>
        {routes.map((r, idx) => {
          const stops = buildStopsFromRoute(r);
          const canOpen = stops.length >= 2;

          const googleUrl = canOpen
            ? googleMapsRouteUrl(stops.map((s) => ({ lat: s.lat, lng: s.lng })))
            : "";

          return (
            <div key={r.id} className="item col">
              <div className="row space">
                <b>{r.name || `Rota ${idx + 1}`}</b>
                <span className="muted">~{r.total_est_km ?? 0} km</span>
              </div>

              <ol style={{ marginTop: 10 }}>
                {stops.map((s, i) => (
                  <li key={i}>{s.label}</li>
                ))}
              </ol>

              <div className="row" style={{ gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <a className="ghost" href={googleUrl} target="_blank" rel="noreferrer" aria-disabled={!canOpen}>
                  Abrir no Google Maps
                </a>

                <button className="ghost" disabled={!canOpen} onClick={() => openMapbox(stops)}>
                  Ver no Mapbox
                </button>

                {!canOpen && (
                  <span className="muted" style={{ fontSize: 12 }}>
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