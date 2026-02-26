// src/lib/maps.ts

export function googleMapsRouteUrl(points: Array<{ lat: number; lng: number }>) {
  // Google Maps Directions:
  // origin = 1º ponto
  // destination = último ponto
  // waypoints = pontos do meio
  if (!points || points.length < 2) return "https://www.google.com/maps";

  const origin = `${points[0].lat},${points[0].lng}`;
  const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;

  const middle = points.slice(1, -1);
  const waypoints = middle.map((p) => `${p.lat},${p.lng}`).join("|");

  const base = "https://www.google.com/maps/dir/?api=1";
  const url =
    `${base}&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : "") +
    `&travelmode=driving`;

  return url;
}