import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

// ✅ fix ícone do marker no Vite/Netlify
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Delivery = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  priority: "normal" | "urgente";
};

function googleMapsDirectionsUrl(points: Array<{ lat: number; lng: number }>) {
  // Google aceita até vários waypoints, mas em geral ok para MVP.
  // Estrutura: origin, destination e waypoints separados.
  if (points.length < 2) return "";

  const origin = `${points[0].lat},${points[0].lng}`;
  const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
  const waypoints =
    points.length > 2
      ? points
          .slice(1, -1)
          .map((p) => `${p.lat},${p.lng}`)
          .join("|")
      : "";

  const base = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(
    origin
  )}&destination=${encodeURIComponent(destination)}`;

  return waypoints ? `${base}&waypoints=${encodeURIComponent(waypoints)}` : base;
}

export default function Routes() {
  const [loading, setLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  async function getUser() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  }

  async function loadDeliveries() {
    setLoading(true);
    const user = await getUser();
    if (!user) {
      setLoading(false);
      alert("Faça login novamente.");
      return;
    }

    const { data, error } = await supabase
      .from("deliveries")
      .select("id,client_name,order_id,address_text,lat,lng,priority")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      alert("Erro ao buscar entregas: " + error.message);
      return;
    }

    setDeliveries((data || []) as any);
  }

  useEffect(() => {
    loadDeliveries();
  }, []);

  const withCoords = useMemo(() => {
    return deliveries.filter((d) => Number.isFinite(d.lat as any) && Number.isFinite(d.lng as any));
  }, [deliveries]);

  const selectedStops = useMemo(() => {
    // mantém ordem por prioridade primeiro, depois pela lista (MVP)
    const chosen = withCoords.filter((d) => selectedIds[d.id]);
    chosen.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "urgente" ? -1 : 1));
    return chosen;
  }, [withCoords, selectedIds]);

  const points = useMemo(() => {
    return selectedStops.map((d) => ({ lat: d.lat as number, lng: d.lng as number }));
  }, [selectedStops]);

  const center = useMemo(() => {
    if (points.length > 0) return points[0];
    // fallback SP
    return { lat: -23.55, lng: -46.63 };
  }, [points]);

  const gmapsUrl = useMemo(() => googleMapsDirectionsUrl(points), [points]);

  function toggle(id: string) {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>
        <button className="ghost" onClick={loadDeliveries}>
          {loading ? "..." : "Atualizar"}
        </button>
      </div>

      <p className="muted">
        Selecione as entregas com coordenadas para aparecer no mapa. Depois clique em <b>Abrir no Google Maps</b> para navegar.
      </p>

      <div style={{ height: 360, borderRadius: 16, overflow: "hidden", marginTop: 10 }}>
        <MapContainer center={[center.lat, center.lng]} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* linha ligando pontos (visual) */}
          {points.length >= 2 && <Polyline positions={points.map((p) => [p.lat, p.lng]) as any} />}

          {/* pins */}
          {selectedStops.map((d, idx) => (
            <Marker key={d.id} position={[d.lat as number, d.lng as number]}>
              <Popup>
                <b>
                  {idx + 1}. {d.client_name} — {d.order_id}
                </b>
                <div style={{ marginTop: 6 }}>{d.address_text}</div>
                <div style={{ marginTop: 6, opacity: 0.7 }}>
                  {d.lat}, {d.lng}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
        <button
          disabled={selectedStops.length < 2}
          onClick={() => {
            if (!gmapsUrl) return;
            window.open(gmapsUrl, "_blank");
          }}
        >
          Abrir no Google Maps
        </button>

        <span className="muted">
          Selecionadas: <b>{selectedStops.length}</b> / {withCoords.length} com coordenadas
        </span>
      </div>

      <h4 style={{ marginTop: 16 }}>Entregas com coordenadas</h4>

      <div className="list">
        {withCoords.map((d) => (
          <div key={d.id} className="item row space" style={{ alignItems: "center" }}>
            <div className="col" style={{ gap: 4 }}>
              <b>
                {d.priority === "urgente" ? "🚨 " : ""}{d.client_name} — {d.order_id}
              </b>
              <div className="muted" style={{ fontSize: 13 }}>{d.address_text}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {d.lat}, {d.lng}
              </div>
            </div>

            <button className={selectedIds[d.id] ? "" : "ghost"} onClick={() => toggle(d.id)}>
              {selectedIds[d.id] ? "Selecionado" : "Selecionar"}
            </button>
          </div>
        ))}

        {withCoords.length === 0 && (
          <p className="muted">
            Nenhuma entrega com coordenadas ainda. Use “Definir coordenadas” nas entregas para habilitar o mapa.
          </p>
        )}
      </div>
    </div>
  );
}