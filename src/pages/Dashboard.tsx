import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import Deliveries from "./Deliveries";
import Routes from "./Routes";

type Tab = "deliveries" | "routes";

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("deliveries");

  return (
    <div className="wrap">
      <div className="topbar">
        <h2>RouterGo</h2>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>

      <div className="tabs">
        <button className={tab === "deliveries" ? "on" : ""} onClick={() => setTab("deliveries")}>
          📦 Entregas
        </button>
        <button className={tab === "routes" ? "on" : ""} onClick={() => setTab("routes")}>
          🚚 Rotas
        </button>
      </div>

      {tab === "deliveries" && <Deliveries />}
      {tab === "routes" && <Routes />}
    </div>
  );
}