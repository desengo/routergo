import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateRoutesMVP } from "../lib/routing";
import { autoGenerateRoutesIfNeeded } from "../lib/autoDispatch";

type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  created_at?: string;
};

type RouteStop = {
  lat: number;
  lng: number;
  label?: string;
  delivery_id?: string;
};

type RouteRow = {
  id: string;
  name: string | null;
  status: "new" | "in_progress" | "done";
  delivery_ids?: string[];
  stops?: RouteStop[] | null;
  total_est_km: number | null;
  concluded_at?: string | null;
  concluded_by?: string | null;
  created_at?: string;
};

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function nowIso() {
  return new Date().toISOString();
}

function isOlderThan24h(iso?: string | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t >= 24 * 60 * 60 * 1000;
}

function cleanText(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function stopText(d: DeliveryRow) {
  const name = cleanText(d.client_name || "Cliente");
  const order = cleanText(d.order_id || "");
  const addr = cleanText(d.address_text || "");
  const left = order ? `${name} — ${order}` : name;
  return addr ? `${left} · ${addr}` : left;
}

function parseRouteNumber(name?: string | null) {
  if (!name) return null;
  const m = name.match(/rota\s*(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export default function Routes() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [maxStops, setMaxStops] = useState(5);
  const [radiusKm, setRadiusKm] = useState(1.2);

  const byId = useMemo(
    () => new Map(deliveries.map((d) => [d.id, d] as const)),
    [deliveries]
  );

  async function loadAll() {
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
        .select("id,name,status,delivery_ids,stops,total_est_km,concluded_at,concluded_by,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (r.error) throw r.error;

      setDeliveries((d.data || []) as any);
      setRoutes((r.data || []) as any);
    } catch (e: any) {
      alert("Erro ao buscar: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function autoConcludeOldRoutes(list: RouteRow[]) {
    const userId = await getUserId();
    if (!userId) return;

    const toAuto = list.filter((r) => r.status !== "done" && isOlderThan24h(r.created_at));
    if (!toAuto.length) return;

    const ids = toAuto.map((r) => r.id);

    const { error } = await supabase
      .from("routes")
      .update({ status: "done", concluded_by: "auto", concluded_at: nowIso() })
      .in("id", ids)
      .eq("user_id", userId);

    if (error) return;

    await loadAll();
  }

  // 🔥 AQUI ESTÁ A INTEGRAÇÃO AUTOMÁTICA
  useEffect(() => {
    async function init() {
      await autoGenerateRoutesIfNeeded();
      await loadAll();
    }
    init();
  }, []);

  useEffect(() => {
    if (!routes.length) return;
    autoConcludeOldRoutes(routes);
  }, [routes.length]);

  const usedDeliveryIds = useMemo(() => {
    const set = new Set<string>();
    routes.forEach((r) => (r.delivery_ids || []).forEach((id) => set.add(id)));
    return set;
  }, [routes]);

  function openMapbox(stops: Array<{ lat: number; lng: number; label: string }>) {
    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
    window.location.href = "/route-mapbox";
  }

  function buildStopsFromRoute(route: RouteRow) {
    if (Array.isArray(route.stops) && route.stops.length) {
      return route.stops
        .map((s, idx) => {
          const lat = Number(s.lat);
          const lng = Number(s.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

          const d = s.delivery_id ? byId.get(s.delivery_id) : undefined;
          const labelFromDelivery = d ? `${idx + 1}. ${stopText(d)}` : null;

          return {
            lat,
            lng,
            label: labelFromDelivery || s.label || `Parada ${idx + 1}`,
          };
        })
        .filter(Boolean) as Array<{ lat: number; lng: number; label: string }>;
    }

    const ids = Array.isArray(route.delivery_ids) ? route.delivery_ids : [];
    const list = ids.map((id) => byId.get(id)).filter(Boolean) as DeliveryRow[];

    return list
      .filter((d) => d.lat != null && d.lng != null)
      .map((d, idx) => ({
        lat: d.lat as number,
        lng: d.lng as number,
        label: `${idx + 1}. ${stopText(d)}`,
      }));
  }

  // O RESTO DO ARQUIVO CONTINUA IGUAL AO SEU
  // (marcarEmAndamento, concluirRota, excluirRota, gerarRotas, UI etc.)

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>
        <button className="ghost" onClick={loadAll}>
          {loading ? "..." : "Atualizar"}
        </button>
      </div>

      {/* TODO o resto da renderização permanece exatamente igual */}
    </div>
  );
}