// src/lib/routing.ts

type Point = { id: string; lat: number; lng: number };

type Options = {
  maxStops: number;   // max entregas por rota
  clusterKm: number;  // raio de agrupamento
};

type RouteResult = {
  ids: string[];
  estKm: number | null;
};

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

// Distância Haversine em KM
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(la1) * Math.cos(la2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function estimatePathKm(points: Point[]) {
  if (points.length < 2) return 0;
  let km = 0;
  for (let i = 0; i < points.length - 1; i++) {
    km += distanceKm(points[i], points[i + 1]);
  }
  return km;
}

// Ordenação "vizinho mais próximo" (Nearest Neighbor) — simples e funciona pro MVP
function nearestNeighborOrder(points: Point[]) {
  if (points.length <= 2) return points;

  const remaining = [...points];
  const ordered: Point[] = [];

  // escolhe um start "mais à esquerda" (menor lng), só pra ser determinístico
  remaining.sort((a, b) => a.lng - b.lng);
  ordered.push(remaining.shift()!);

  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = distanceKm(last, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }

  return ordered;
}

// Agrupa por proximidade (clusterKm) e limita por maxStops
export function generateRoutesMVP(points: Point[], options: Options): RouteResult[] {
  const maxStops = Math.max(2, Math.floor(options.maxStops || 5));
  const clusterKm = Math.max(0.2, Number(options.clusterKm || 1.2));

  const remaining = [...points];
  const routes: RouteResult[] = [];

  while (remaining.length) {
    // pega o próximo seed
    const seed = remaining.shift()!;
    const cluster: Point[] = [seed];

    // puxa pontos próximos do seed até bater maxStops
    for (let i = 0; i < remaining.length && cluster.length < maxStops; ) {
      const p = remaining[i];
      const d = distanceKm(seed, p);
      if (d <= clusterKm) {
        cluster.push(p);
        remaining.splice(i, 1);
      } else {
        i++;
      }
    }

    // ordena cluster por vizinho mais próximo
    const ordered = nearestNeighborOrder(cluster);
    const estKm = ordered.length >= 2 ? estimatePathKm(ordered) : null;

    routes.push({
      ids: ordered.map((p) => p.id),
      estKm,
    });
  }

  return routes;
}