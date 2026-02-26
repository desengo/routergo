import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

type Stop = { lat: number; lng: number; label?: string };

function getStopsFromQuery(): Stop[] {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("stops");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s: any) => ({
        lat: Number(s.lat),
        lng: Number(s.lng),
        label: typeof s.label === "string" ? s.label : undefined,
      }))
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  } catch {
    return [];
  }
}

export default function RouteMapbox() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [status, setStatus] = useState<string>("Carregando mapa...");
  const [details, setDetails] = useState<string>("");

  const stops = useMemo(() => getStopsFromQuery(), []);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

    if (!token) {
      setStatus("Erro: VITE_MAPBOX_TOKEN não configurado.");
      setDetails("Configure no Netlify: VITE_MAPBOX_TOKEN = pk...");
      return;
    }

    if (!containerRef.current) return;

    if (stops.length < 2) {
      setStatus("Erro: precisa de pelo menos 2 paradas.");
      setDetails("A rota deve ter 2+ entregas com lat/lng.");
      return;
    }

    // Mapbox token
    mapboxgl.accessToken = token;

    // Inicializa mapa
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [stops[0].lng, stops[0].lat],
      zoom: 12,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Marcadores numerados
    const markers: mapboxgl.Marker[] = [];
    stops.forEach((s, idx) => {
      const el = document.createElement("div");
      el.className = "mbx-marker";
      el.textContent = String(idx + 1);

      const popupHtml = `
        <div>
          <b>Parada ${idx + 1}</b><br/>
          ${(s.label || "").replaceAll("<", "&lt;")}
          <div style="opacity:.7;font-size:12px;margin-top:6px">${s.lat}, ${s.lng}</div>
        </div>
      `;

      const m = new mapboxgl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setHTML(popupHtml))
        .addTo(map);

      markers.push(m);
    });

    async function drawRoute() {
      setStatus("Calculando rota (Directions)...");
      setDetails("");

      // Mapbox Directions aceita até 25 pontos
      const sliced = stops.slice(0, 25);
      const coords = sliced.map((s) => `${s.lng},${s.lat}`).join(";");

      const r = await fetch(`/.netlify/functions/mapbox-directions?coords=${encodeURIComponent(coords)}&profile=driving`);
      const j = await r.json();

      if (!r.ok) {
        setStatus("Erro ao calcular rota.");
        setDetails(j?.message || j?.error || JSON.stringify(j));
        return;
      }

      const geom = j?.routes?.[0]?.geometry;
      if (!geom || geom.type !== "LineString" || !Array.isArray(geom.coordinates)) {
        setStatus("Rota não retornou geometria.");
        setDetails(JSON.stringify(j));
        return;
      }

      // Remove camadas se existirem
      if (map.getLayer("route-line")) map.removeLayer("route-line");
      if (map.getLayer("route-casing")) map.removeLayer("route-casing");
      if (map.getSource("route")) map.removeSource("route");

      // Source
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: geom,
        },
      });

      // Contorno (baixo)
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#0b1a39",
          "line-width": 9,
          "line-opacity": 0.95,
        },
      });

      // Linha azul (cima)
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#2f7bff",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });

      // Fit bounds pela geometria da rota
      const bounds = new mapboxgl.LngLatBounds();
      for (const c of geom.coordinates) bounds.extend([c[0], c[1]]);
      map.fitBounds(bounds, { padding: 60, duration: 700 });

      const distKm = Math.round(((j?.routes?.[0]?.distance || 0) / 1000) * 10) / 10;
      const durMin = Math.round(((j?.routes?.[0]?.duration || 0) / 60) * 1) / 1;

      setStatus("Rota desenhada ✅");
      setDetails(`Distância ~ ${distKm} km • Duração ~ ${durMin} min`);
    }

    map.on("load", () => {
      drawRoute().catch((e: any) => {
        setStatus("Erro ao desenhar rota.");
        setDetails(e?.message || String(e));
      });
    });

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [stops]);

  return (
    <div className="wrap">
      <div className="topbar">
        <h2>Rota no Mapa</h2>
        <button className="ghost" onClick={() => window.history.back()}>
          Voltar
        </button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <b>{status}</b>
        {details ? <div className="muted" style={{ marginTop: 6 }}>{details}</div> : null}
        <div className="muted" style={{ marginTop: 6 }}>
          Paradas: {stops.length} (Mapbox aceita até 25)
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div ref={containerRef} style={{ height: "72vh", width: "100%" }} />
      </div>
    </div>
  );
}