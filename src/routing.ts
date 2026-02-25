import { haversineKm } from "./geo";

export type DeliveryLite = {
  id: string;
  priority: "normal" | "urgente";
  lat: number | null;
  lng: number | null;
  client_name: string;
  address_text: string;
};

export function generateRoutesMVP(params: {
  deliveries: DeliveryLite[];
  maxStopsPerRoute: number;
  clusterRadiusKm: number;
  startPoint?: { lat: number; lng: number };
}) {
  const { deliveries, maxStopsPerRoute, clusterRadiusKm, startPoint } = params;

  const candidates = deliveries
    .filter((d) => typeof d.lat === "number" && typeof d.lng === "number")
    .slice()
    .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "urgente" ? -1 : 1));

  const unused = new Set(candidates.map((d) => d.id));
  const byId = new Map(candidates.map((d) => [d.id, d] as const));
  const routes: Array<{ delivery_ids: string[]; total_est_km: number }> = [];

  while (unused.size > 0) {
    const seedId = candidates.find((d) => unused.has(d.id))?.id;
    if (!seedId) break;
    const seed = byId.get(seedId)!;
    unused.delete(seedId);

    const cluster: DeliveryLite[] = [seed];

    for (const d of candidates) {
      if (cluster.length >= maxStopsPerRoute) break;
      if (!unused.has(d.id)) continue;

      const dist = haversineKm(
        { lat: seed.lat!, lng: seed.lng! },
        { lat: d.lat!, lng: d.lng! }
      );
      if (dist <= clusterRadiusKm) {
        cluster.push(d);
        unused.delete(d.id);
      }
    }

    const ordered = orderNearestNeighbor(cluster, startPoint);
    routes.push({ delivery_ids: ordered.map((x) => x.id), total_est_km: estimateKm(ordered, startPoint) });
  }

  return routes;
}

function orderNearestNeighbor(items: DeliveryLite[], startPoint?: { lat: number; lng: number }) {
  const remaining = items.slice();
  const ordered: DeliveryLite[] = [];
  let cur = startPoint
    ? { lat: startPoint.lat, lng: startPoint.lng }
    : { lat: remaining[0].lat!, lng: remaining[0].lng! };

  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = remaining[i];
      const dist = haversineKm(cur, { lat: d.lat!, lng: d.lng! });
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next);
    cur = { lat: next.lat!, lng: next.lng! };
  }
  return ordered;
}

function estimateKm(items: DeliveryLite[], startPoint?: { lat: number; lng: number }) {
  let total = 0;
  let prev = startPoint
    ? { lat: startPoint.lat, lng: startPoint.lng }
    : { lat: items[0]?.lat ?? 0, lng: items[0]?.lng ?? 0 };

  for (const d of items) {
    total += haversineKm(prev, { lat: d.lat!, lng: d.lng! });
    prev = { lat: d.lat!, lng: d.lng! };
  }
  return Math.round(total * 10) / 10;
}