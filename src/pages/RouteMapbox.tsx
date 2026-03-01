import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useNavigate } from "react-router-dom";

type Stop = { lat: number; lng: number; label?: string; delivery_id?: string };

export default function RouteMapbox() {
  const nav = useNavigate();
  const mapDivRef = useRef<HTMLDivElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);

  const token = (import.meta as any).env.VITE_MAPBOX_TOKEN as string | undefined;

  const stops: Stop[] = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("routergo_stops");
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr
        .map((s: any) => ({
          lat: Number(s.lat),
          lng: Number(s.lng),
          label: typeof s.label === "string" ? s.label : undefined,
          delivery_id: typeof s.delivery_id === "string" ? s.delivery_id : undefined,
        }))
        .filter((s: any) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setError("VITE_MAPBOX_TOKEN não configurado.");
      return;
    }
    mapboxgl.accessToken = token;

    if (!mapDivRef.current) return;

    const center = stops.length ? [stops[0].lng, stops[0].lat] : [-46.6333, -23.5505];

    const map = new mapboxgl.Map({
      container: mapDivRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: center as any,
      zoom: stops.length ? 13 : 10,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", async () => {
      stops.forEach((s, idx) => {
        const el = document.createElement("div");
        el.style.width = "34px";
        el.style.height = "34px";
        el.style.borderRadius = "999px";
        el.style.display = "grid";
        el.style.placeItems = "center";
        el.style.background = "#18ff6d";
        el.style.boxShadow = "0 0 18px rgba(24,255,109,.6)";
        el.style.color = "#07140c";
        el.style.fontWeight = "900";
        el.textContent = String(idx + 1);

        new mapboxgl.Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setText(s.label || `Parada ${idx + 1}`))
          .addTo(map);
      });

      if (stops.length < 2) {
        setError("Precisa de pelo menos 2 paradas (lat/lng) para desenhar a rota.");
        return;
      }

      try {
        const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
        const url =
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
          `?geometries=geojson&overview=full&steps=false&access_token=${token}`;

        const res = await fetch(url);
        const json = await res.json();

        if (!json?.routes?.[0]?.geometry) {
          setError("Não consegui calcular a rota no Mapbox.");
          return;
        }

        const route = json.routes[0];
        setDistanceKm(route.distance ? route.distance / 1000 : null);
        setDurationMin(route.duration ? route.duration / 60 : null);

        const geo = { type: "Feature", properties: {}, geometry: route.geometry };

        map.addSource("route", { type: "geojson", data: geo as any });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-width": 6, "line-color": "#2f7bff", "line-opacity": 0.9 },
        });

        const bounds = new mapboxgl.LngLatBounds();
        stops.forEach((s) => bounds.extend([s.lng, s.lat]));
        map.fitBounds(bounds, { padding: 60, duration: 600 });

        setError(null);
      } catch {
        setError("Erro ao calcular rota.");
      }
    });

    return () => map.remove();
  }, [token, stops]);

  return (
    <div className="wrap">
      <div className="topbar">
        <h2>Rota no Mapa</h2>
        <button className="ghost" onClick={() => nav("/")}>
          Voltar
        </button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        {error ? (
          <>
            <b>{error}</b>
            <div className="muted" style={{ marginTop: 6 }}>
              Paradas: {stops.length}
            </div>
          </>
        ) : (
          <>
            <b>Rota desenhada ✅</b>
            <div className="muted" style={{ marginTop: 6 }}>
              Distância ~ {distanceKm ? distanceKm.toFixed(1) : "?"} km · Duração ~{" "}
              {durationMin ? Math.round(durationMin) : "?"} min · Paradas: {stops.length}
            </div>
          </>
        )}
      </div>

      <div
        ref={mapDivRef}
        style={{
          height: "65vh",
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid rgba(24,255,109,.25)",
        }}
      />
    </div>
  );
}