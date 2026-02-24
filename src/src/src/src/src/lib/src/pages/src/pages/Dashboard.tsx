import React from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  return (
    <div className="wrap">
      <div className="topbar">
        <h2>Dashboard</h2>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
      <div className="card">
        <p>RouterGo v1 no ar ✅</p>
        <p className="muted">Próximo: white-label (multi-empresa) + entregas + rotas.</p>
      </div>
    </div>
  );
}
