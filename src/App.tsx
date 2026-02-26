import React from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import RouteMapbox from "./pages/RouteMapbox";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/route-mapbox" element={<RouteMapbox />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

function Home() {
  const nav = useNavigate();

  function demo() {
    // exemplo com 2 pontos (SP) — substitua depois pelos seus
    const stops = [
      { lat: -23.7315663, lng: -46.6821161, label: "1. Ponto A" },
      { lat: -23.7322, lng: -46.6812, label: "2. Ponto B" },
    ];
    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
    nav("/route-mapbox");
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="title">RouterGo</h1>
        <Link className="btn ghost" to="/route-mapbox">
          Abrir mapa
        </Link>
      </div>

      <div className="card">
        <h2>Mapbox (MVP)</h2>
        <p className="muted">
          Este projeto mínimo desenha a linha azul da rota usando Directions API e
          marca as paradas.
        </p>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={demo}>Testar rota demo</button>
          <button
            className="btn ghost"
            onClick={() => {
              const stops = [
                { lat: -23.55, lng: -46.63, label: "1. Exemplo" },
                { lat: -23.56, lng: -46.64, label: "2. Exemplo" },
              ];
              sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
              nav("/route-mapbox");
            }}
          >
            Testar outra
          </button>
        </div>

        <p className="hint">
          Dica: as paradas são lidas do <b>sessionStorage</b> na chave{" "}
          <code>routergo_stops</code>.
        </p>
      </div>
    </div>
  );
}