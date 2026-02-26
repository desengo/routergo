import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  created_at?: string;
};

type RouteStop = { lat: number; lng: number; label: string; delivery_id?: string };

type RoutePreview = {
  name: string;
  stops: RouteStop[];
  totalKm: number;
};

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.sin(dLng / 2) ** 2;
  const c = s1 + Math.cos(lat1) * Math.cos(lat2) * s2;
  return 2 * R * Math.asin(Math.sqrt(c));
}

function orderNearestNeighbor(points: RouteStop[]) {
  if (points.length <= 2) return points;

  const remaining = [...points];
  const ordered: RouteStop[] = [];

  let current = remaining.shift()!;
  ordered.push(current);

  while (remaining.length) {
    let bestIdx = 0;
    let bestD = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(
        { lat: current.lat, lng: current.lng },
        { lat: remaining[i].lat, lng: remaining[i].lng }
      );
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }

    current = remaining.splice(bestIdx, 1)[0];
    ordered.push(current);
  }

  return ordered;
}

function totalDistanceKm(stops: RouteStop[]) {
  let sum = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    sum += haversineKm(
      { lat: stops[i].lat, lng: stops[i].lng },
      { lat: stops[i + 1].lat, lng: stops[i + 1].lng }
    );
  }
  return sum;
}

// agrupa por raio: pega 1, junta vizinhos próximos até encher
function clusterByRadius(stops: RouteStop[], radiusKm: number, maxStops: number) {
  const remaining = [...stops];
  const groups: RouteStop[][] = [];

  while (remaining.length) {
    const seed = remaining.shift()!;
    const group: RouteStop[] = [seed];

    for (let i = 0; i < remaining.length && group.length < maxStops; ) {
      const d = haversineKm(
        { lat: seed.lat, lng: seed.lng },
        { lat: remaining[i].lat, lng: remaining[i].lng }
      );

      if (d <= radiusKm) group.push(remaining.splice(i, 1)[0]);
      else i++;
    }

    groups.push(group);
  }

  return groups;
}

function googleMapsRouteUrl(stops: RouteStop[]) {
  // Google Maps: origin + destination + waypoints
  // https://www.google.com/maps/dir/?api=1&origin=lat,lng&destination=lat,lng&waypoints=lat,lng|lat,lng
  if (stops.length < 2) return "#";

  const origin = `${stops[0].lat},${stops[0].lng}`;
  const destination = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;

  const waypoints = stops
    .slice(1, -1)
    .map((s) => `${s.lat},${s.lng}`)
    .join("|");

  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
  });

  if (waypoints) params.set("waypoints", waypoints);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function Routes() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [maxStops, setMaxStops] = useState<number>(5);
  const [radiusKm, setRadiusKm] = useState<number>(1.2);

  const [preview, setPreview] = useState<RoutePreview[]>([]);

  async function getUser() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  }

  async function loadDeliveries() {
    setLoading(true);

    const user = await getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const d = await supabase
      .from("deliveries")
      .select("id,client_name,order_id,address_text,lat,lng,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (d.error) alert("Erro ao buscar entregas: " + d.error.message);

    setDeliveries((d.data || []) as any);
  }

  useEffect(() => {
    loadDeliveries();
  }, []);

  const deliveriesWithCoords = useMemo(() => {
    return deliveries
      .map((d) => ({
        ...d,
        lat: toNum(d.lat),
        lng: toNum(d.lng),
      }))
      .filter((d) => d.lat != null && d.lng != null) as Array<
      DeliveryRow & { lat: number; lng: number }
    >;
  }, [deliveries]);

  async function gerarRotasPreview() {
    const base: RouteStop[] = deliveriesWithCoords.map((d) => ({
      lat: d.lat,
      lng: d.lng,
      label: `${d.client_name} — ${d.address_text}`,
      delivery_id: d.id,
    }));

    if (base.length < 2) {
      alert("Precisa de pelo menos 2 entregas com coordenadas para gerar rota.");
      return;
    }

    const groups = clusterByRadius(base, Number(radiusKm) || 1.2, Math.max(2, Number(maxStops) || 5));

    const routes: RoutePreview[] = groups.map((g, idx) => {
      const ordered = orderNearestNeighbor(g);
      const totalKm = totalDistanceKm(ordered);
      return { name: `Rota ${idx + 1}`, stops: ordered, totalKm };
    });

    setPreview(routes);
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>
        <div className="row" style={{ gap: 10 }}>
          <button className="ghost" onClick={gerarRotasPreview} disabled={loading}>
            {loading ? "..." : "Gerar rotas"}
          </button>
          <button className="ghost" onClick={loadDeliveries}>
            {loading ? "..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div>
          <label className="muted">Máx paradas por rota</label>
          <input value={maxStops} onChange={(e) => setMaxStops(Number(e.target.value))} type="number" min={2} />
        </div>
        <div>
          <label className="muted">Raio de agrupamento (km)</label>
          <input value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} type="number" step="0.1" min={0.1} />
        </div>
      </div>

      <div className="list" style={{ marginTop: 14 }}>
        {preview.map((r, idx) => (
          <div key={idx} className="item col">
            <div className="row space">
              <b>
                {r.name} ~{r.totalKm} km
              </b>
            </div>

            <ol style={{ marginTop: 10 }}>
              {r.stops.map((s, i) => (
                <li key={i}>{i + 1}. {s.label}</li>
              ))}
            </ol>

            <div className="row" style={{ marginTop: 10 }}>
              <a href={googleMapsRouteUrl(r.stops)} target="_blank" rel="noreferrer">
                Abrir no Google Maps
              </a>
            </div>
          </div>
        ))}

        {preview.length === 0 && <p className="muted">Clique em “Gerar rotas”.</p>}
      </div>
    </div>
  );
}
