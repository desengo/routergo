import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import RoutesPage from "./Routes";

type Tab = "routes";

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("routes");

  return (
    <div className="wrap">
      <div className="topbar">
        <h2>RouterGo</h2>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>

      <div className="tabs">
        <button className={tab === "routes" ? "on" : ""} onClick={() => setTab("routes")}>
          🚚 Rotas
        </button>
      </div>

      {tab === "routes" && <RoutesPage />}
    </div>
  );
}