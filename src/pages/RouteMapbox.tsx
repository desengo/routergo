import React, { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    mapboxgl: any;
  }
}

type Stop = { lat: number; lng: number; label: string };

function parseStops(): Stop[] {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("stops") || "[]";
  try {
    const arr = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(arr)) return [];
    return arr
      .map((p: any) => ({
        lat: Number(p.lat),
        lng: Number(p.lng),
        label: String(p.label || ""),
      }))
      .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  } catch {
    return [];
  }
}

export default function RouteMapbox() {
  const stops = useMemo(() => parseStops(), []);
  const token = (import.meta as any).env.VITE_MAPBOX_TOKEN as string | undefined;

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token) {
      setErr("VITE_MAPBOX_TOKEN não configurado no Netlify.");
      return;
    }
    if (!window.mapboxgl) {
      setErr("Mapbox GL JS não carregou. Confira o index.html (CDN).");
      return;
    }
    if (!mapDivRef.current) return;

    window.mapboxgl.accessToken = token;

    const center = stops.length ? [stops[0].lng, stops[0].lat] : [-46.6333, -23.5505];

    const map = new window.mapboxgl.Map({
      container: mapDivRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom: stops.length ? 12 : 11,
    });

    map.addControl(new window.mapboxgl.NavigationControl());

    map.on("load", async () => {
      // Pins numerados
      stops.forEach((s, i) => {
        const el = document.createElement("div");
        el.style.width = "28px";
        el.style.height = "28px";
        el.style.borderRadius = "14px";
        el.style.background = "#111";
        el.style.border = "2px solid #fff";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.color = "#fff";
        el.style.fontWeight = "700";
        el.innerText = String(i + 1);

        new window.mapboxgl.Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .setPopup(new window.mapboxgl.Popup({ offset: 25 }).setHTML(`<b>${i + 1}. ${s.label}</b>`))
          .addTo(map);
      });

      // Rota por ruas (Directions)
      if (stops.length >= 2) {
        try {
          const coordsStr = stops.map((s) => `${s.lng},${s.lat}`).join(";");
          const r = await fetch(`/.netlify/functions/mapbox-directions?coords=${encodeURIComponent(coordsStr)}`);
          const j = await r.json();

          const geom = j?.routes?.[0]?.geometry;
          if (geom?.type === "LineString") {
            if (map.getSource("route")) {
              // @ts-ignore
              map.getSource("route").setData({ type: "Feature", geometry: geom, properties: {} });
            } else {
              map.addSource("route", {
                type: "geojson",
                data: { type: "Feature", geometry: geom, properties: {} },
              });

              map.addLayer({
                id: "route-line",
                type: "line",
                source: "route",
                paint: {
                  "line-width": 5,
                },
              });
            }
          }
        } catch (e: any) {
          setErr("Falha ao desenhar rota (Directions).");
        }
      }
    });

    return () => map.remove();
  }, [token, stops]);

  return (
    <div className="wrap">
      <div className="topbar">
        <h2>Rota (Mapbox)</h2>
        <a className="ghost" href="/" style={{ textDecoration: "none" }}>
          Voltar
        </a>
      </div>

      {err && (
        <div className="card">
          <b>Erro:</b> {err}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div ref={mapDivRef} style={{ width: "100%", height: 420 }} />
      </div>
    </div>
  );
}