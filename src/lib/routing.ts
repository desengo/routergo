export type Stop = {
  delivery_id?: string;
  lat: number;
  lng: number;
  label?: string;
};

function haversineKm(a: Stop, b: Stop) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.asin(Math.sqrt(x));
}

// ordena por vizinho mais próximo (MVP)
function orderNearestNeighbor(stops: Stop[]) {
  if (stops.length <= 2) return stops;

  const remaining = [...stops];
  const ordered: Stop[] = [remaining.shift()!];

  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(last, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  return ordered;
}

// agrupa por “raio” em clusters e limita por maxStops
export function generateRoutesMVP(
  stops: Stop[],
  opts: { maxStops: number; radiusKm: number }
) {
  const maxStops = Math.max(2, Math.floor(opts.maxStops || 5));
  const radiusKm = Math.max(0.2, Number(opts.radiusKm || 1.2));

  const left = [...stops];
  const routes: Array<{ stops: Stop[]; totalKm: number }> = [];

  while (left.length) {
    // seed
    const seed = left.shift()!;
    const cluster: Stop[] = [seed];

    // junta próximos do seed
    for (let i = left.length - 1; i >= 0; i--) {
      if (cluster.length >= maxStops) break;
      const d = haversineKm(seed, left[i]);
      if (d <= radiusKm) cluster.push(left.splice(i, 1)[0]);
    }

    // ordena
    const ordered = orderNearestNeighbor(cluster);

    // estima km
    let total = 0;
    for (let i = 0; i < ordered.length - 1; i++) {
      total += haversineKm(ordered[i], ordered[i + 1]);
    }

    routes.push({ stops: ordered, totalKm: total });
  }

  return routes;
}