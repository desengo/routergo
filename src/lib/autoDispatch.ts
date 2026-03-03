import { supabase } from "./supabase";
import { generateRoutesMVP } from "./routing";
import { getCompanySettings } from "./companySettings";

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function parseRouteNumber(name?: string | null) {
  if (!name) return null;
  const m = name.match(/rota\s*(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export async function autoGenerateRoutesIfNeeded() {
  const userId = await getUserId();
  if (!userId) return;

  const settings = await getCompanySettings();

  if (settings.demand_mode === "manual") {
    return;
  }

  const radiusKm = settings.delivery_radius_km;

  let target = 5;
  let max = 7;

  if (settings.demand_mode === "alta") {
    target = 6;
    max = 7;
  }

  if (settings.demand_mode === "media") {
    target = 5;
    max = 7;
  }

  if (settings.demand_mode === "baixa") {
    target = 4;
    max = 6;
  }

  const [dRes, rRes] = await Promise.all([
    supabase
      .from("deliveries")
      .select("id,client_name,order_id,address_text,lat,lng,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),

    supabase
      .from("routes")
      .select("id,name,delivery_ids,status")
      .eq("user_id", userId),
  ]);

  if (dRes.error || rRes.error) return;

  const deliveries = dRes.data || [];
  const routes = rRes.data || [];

  const used = new Set<string>();
  routes.forEach((r: any) =>
    (r.delivery_ids || []).forEach((id: string) => used.add(id))
  );

  const available = deliveries.filter(
    (d: any) => d.lat != null && d.lng != null && !used.has(d.id)
  );

  if (available.length < 2) return;

  const stops = available.map((d: any) => ({
    delivery_id: d.id,
    lat: d.lat,
    lng: d.lng,
    label: `${d.client_name || "Cliente"} — ${d.order_id || ""} · ${
      d.address_text || ""
    }`,
  }));

  const groups = generateRoutesMVP(stops, {
    radiusKm,
    minStops: 2,
    targetStops: target,
    maxStops: max,
  });

  if (!groups.length) return;

  const maxExisting =
    routes
      .map((r: any) => parseRouteNumber(r.name))
      .filter((n: any): n is number => typeof n === "number")
      .reduce((a: number, b: number) => Math.max(a, b), 0) || 0;

  let next = maxExisting + 1;

  const inserts = groups.map((g) => {
    const delivery_ids = g.stops.map((s) => s.delivery_id!).filter(Boolean);

    return {
      user_id: userId,
      name: `Rota ${next++}`,
      status: "new",
      delivery_ids,
      stops: g.stops.map((s, idx) => ({
        delivery_id: s.delivery_id,
        lat: s.lat,
        lng: s.lng,
        label: `${idx + 1}. ${s.label || `Parada ${idx + 1}`}`,
      })),
      total_est_km: Number(g.totalKm.toFixed(3)),
    };
  });

  await supabase.from("routes").insert(inserts);
}
