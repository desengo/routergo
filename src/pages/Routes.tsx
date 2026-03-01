import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateRoutesMVP, Stop as MVPStop } from "../lib/routing";

type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
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

export default function Routes() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [maxStops, setMaxStops] = useState(5);
  const [radiusKm, setRadiusKm] = useState(1.2);

  async function loadAll() {
    setLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) return;

      const d = await supabase
        .from("deliveries")
        .select("id,client_name,order_id,address_text,lat,lng")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (d.error) throw d.error;
      setDeliveries((d.data || []) as any);

      const r = await supabase
        .from("routes")
        .select("id,name,delivery_ids,stops,total_est_km,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (r.error) throw r.error;
      setRoutes((r.data || []) as any);
    } catch (e: any) {
      alert("Erro ao buscar dados: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // ✅ ao abrir a aba: só carrega, NÃO gera
    loadAll();
  }, []);

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
    // ✅ RouteMapbox lê sessionStorage
    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
    window.location.href = "/route-mapbox";
  }

  async function gerarRotas() {
    try {
      setLoading(true);

      const userId = await getUserId();
      if (!userId) throw new Error("Você precisa estar logado.");

      if (usableStops.length < 2) {
        throw new Error("Precisa de pelo menos 2 entregas com coordenadas para gerar rota.");
      }

      const generated = generateRoutesMVP(usableStops, {
        maxStops,
        radiusKm,
      });

      if (!generated.length) throw new Error("Não consegui gerar rotas com esses parâmetros.");

      // ✅ pega quantas rotas já existem pra continuar a numeração
      const { count, error: countErr } = await supabase
        .from("routes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (countErr) throw countErr;

      const startIndex = (count || 0) + 1;

      const rows = generated.map((r, idx) => {
        const stops: Stop[] = r.stops.map((s, i) => ({
          delivery_id: s.delivery_id,
          lat: s.lat,
          lng: s.lng,
          label: `${i + 1}. ${s.label || "Parada"}`,
        }));

        const delivery_ids = r.stops.map((s) => s.delivery_id).filter(Boolean) as string[];

        return {
          user_id: userId,
          name: `Rota ${startIndex + idx}`,
          delivery_ids,
          stops,
          total_est_km: Number.isFinite(r.totalKm) ? r.totalKm : null,
        };
      });

      const ins = await supabase.from("routes").insert(rows);
      if (ins.error) throw ins.error;

      await loadAll();
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>
        <button className="ghost" onClick={loadAll}>
          {loading ? "..." : "Atualizar"}
        </button>
      </div>

      <label>Máx paradas por rota</label>
      <input
        type="number"
        value={maxStops}
        min={2}
        max={25}
        onChange={(e) => setMaxStops(Number(e.target.value || 5))}
      />

      <label>Raio de agrupamento (km)</label>
      <input
        type="number"
        value={radiusKm}
        min={0.2}
        step={0.1}
        onChange={(e) => setRadiusKm(Number(e.target.value || 1.2))}
      />

      <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
        <button onClick={gerarRotas} disabled={loading}>
          Gerar rotas
        </button>
      </div>

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