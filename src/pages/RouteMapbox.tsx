import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

type Stop = { lat: number; lng: number; label?: string };

function token() {
  return import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
}

export default function RouteMapbox() {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [msg, setMsg] = useState("Carregando…");
  const [km, setKm] = useState<number | null>(null);
  const [min, setMin] = useState<number | null>(null);

  const stops: Stop[] = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("routergo_stops");
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((s: any) => ({
          lat: Number(s.lat),
          lng: Number(s.lng),
          label: s.label ? String(s.label) : undefined,
        }))
        .filter((s: Stop) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const t = token();
    if (!t) {
      setMsg("ERRO: VITE_MAPBOX_TOKEN não configurado no Netlify.");
      return;
    }
    (mapboxgl as any).accessToken = t;

    if (!mapEl.current) return;

    if (!stops || stops.length < 2) {
      setMsg("Precisa de pelo menos 2 paradas (lat/lng) para desenhar a rota.");
      // ainda mostra mapa centralizado em SP
      const map = new mapboxgl.Map({
        container: mapEl.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-46.6333, -23.5505],
        zoom: 11,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;
      return () => map.remove();
    }

    const first = stops[0];

    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [first.lng, first.lat],
      zoom: 13,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    // marcadores verdes numerados
    stops.forEach((s, idx) => {
      const el = document.createElement("div");
      el.className = "mk";
      el.innerText = String(idx + 1);

      new mapboxgl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(s.label || `Parada ${idx + 1}`))
        .addTo(map);
    });

    async function draw() {
      try {
        setMsg(`Calculando rota… Paradas: ${stops.length} (Mapbox aceita até 25)`);

        const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
        const url =
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
          `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(t)}`;

        const res = await fetch(url);
        const data = await res.json();

        const route = data?.routes?.[0];
        if (!route?.geometry) throw new Error(data?.message || "Sem rota retornada.");

        const geometry = route.geometry; // LineString GeoJSON

        // métricas
        const distKm = route.distance ? route.distance / 1000 : null;
        const durMin = route.duration ? route.duration / 60 : null;
        setKm(distKm ? Math.round(distKm * 10) / 10 : null);
        setMin(durMin ? Math.round(durMin) : null);

        setMsg("Rota desenhada ✅");

        map.on("load", () => {
          // source
          if (!map.getSource("route")) {
            map.addSource("route", {
              type: "geojson",
              data: { type: "Feature", properties: {}, geometry },
            });
          } else {
            (map.getSource("route") as any).setData({
              type: "Feature",
              properties: {},
              geometry,
            });
          }

          // layer linha azul
          if (!map.getLayer("route-line")) {
            map.addLayer({
              id: "route-line",
              type: "line",
              source: "route",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-width": 6,
                "line-color": "#3b82f6"
              },
            });
          }

          // fit bounds
          const bounds = new mapboxgl.LngLatBounds();
          stops.forEach((s) => bounds.extend([s.lng, s.lat]));
          map.fitBounds(bounds, { padding: 70, maxZoom: 16 });
        });
      } catch (e: any) {
        setMsg(`Erro ao calcular rota: ${e?.message || "desconhecido"}`);
      }
    }

    draw();

    return () => map.remove();
  }, [stops]);

  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="title">Rota no Mapa</h1>
        <button className="btn ghost" onClick={() => history.back()}>
          Voltar
        </button>
      </div>

      <div className="card">
        <b>{msg}</b>
        <div className="muted" style={{ marginTop: 6 }}>
          {km != null && min != null ? (
            <>Distância ~ {km} km · Duração ~ {min} min · Paradas: {stops.length}</>
          ) : (
            <>Paradas: {stops.length}</>
          )}
        </div>
      </div>

      <div className="mapBox" ref={mapEl} />
    </div>
  );
}