export function googleMapsRouteUrl(stops: Array<{ lat: number; lng: number }>, origin?: {lat:number; lng:number}) {
  if (!stops.length) return "";
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);
  const originStr = origin ? `${origin.lat},${origin.lng}` : undefined;
  const destinationStr = `${destination.lat},${destination.lng}`;
  const waypointsStr = waypoints.map(p => `${p.lat},${p.lng}`).join("|");

  return (
    `https://www.google.com/maps/dir/?api=1` +
    (originStr ? `&origin=${encodeURIComponent(originStr)}` : "") +
    `&destination=${encodeURIComponent(destinationStr)}` +
    (waypointsStr ? `&waypoints=${encodeURIComponent(waypointsStr)}` : "") +
    `&travelmode=driving`
  );
}
