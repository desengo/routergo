import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import Deliveries from "./Deliveries";
import Routes from "./Routes";
import logo from "../assets/logo.png";

type Tab = "deliveries" | "routes";

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("deliveries");

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <img src={logo} alt="RouterGo" className="brandLogo" />
          <h2 className="brandTitle">RouterGo</h2>
        </div>

        <button className="ghost" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>

      <div className="tabs">
        <button
          className={tab === "deliveries" ? "on" : ""}
          onClick={() => setTab("deliveries")}
        >
          📦 Entregas
        </button>

        <button
          className={tab === "routes" ? "on" : ""}
          onClick={() => setTab("routes")}
        >
          🚚 Rotas
        </button>
      </div>

      {tab === "deliveries" && <Deliveries />}
      {tab === "routes" && <Routes />}
    </div>
  );
}