import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Deliveries from "./Deliveries";
import Routes from "./Routes";
import {
  getCompanySettings,
  updateCompanySettings,
  DemandMode,
} from "../lib/companySettings";

type Tab = "deliveries" | "routes";

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("deliveries");

  // 🔹 NOVOS ESTADOS
  const [demandMode, setDemandMode] = useState<DemandMode>("media");
  const [radiusKm, setRadiusKm] = useState<number>(1.2);

  // 🔹 Carrega configurações ao abrir
  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await getCompanySettings();
        setDemandMode(settings.demand_mode);
        setRadiusKm(settings.delivery_radius_km);
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      }
    }
    loadSettings();
  }, []);

  async function saveSettings(mode: DemandMode, radius: number) {
    try {
      await updateCompanySettings({
        demand_mode: mode,
        delivery_radius_km: radius,
      });
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
    }
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <img
            src="https://i.ibb.co/DPYsRh9r/file-00000000a9c871f589252b63d66b7839-removebg-preview.png"
            alt="RouterGo"
            className="brandLogo"
          />
          <h2 className="brandTitle">RouterGo</h2>
        </div>

        <button className="ghost" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>

      {/* 🔹 NOVO BLOCO: CONFIGURAÇÃO DE DEMANDA */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row space">
          <b>Modo de Demanda</b>
          <span className="muted">
            {demandMode === "alta" && "🔴 Alta"}
            {demandMode === "media" && "🟡 Média"}
            {demandMode === "baixa" && "🟢 Baixa"}
            {demandMode === "manual" && "⚙ Manual"}
          </span>
        </div>

        <div
          className="row"
          style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}
        >
          {(["alta", "media", "baixa", "manual"] as DemandMode[]).map(
            (mode) => (
              <button
                key={mode}
                className={demandMode === mode ? "primary" : "ghost"}
                onClick={() => {
                  setDemandMode(mode);
                  saveSettings(mode, radiusKm);
                }}
              >
                {mode === "alta" && "🔴 Alta"}
                {mode === "media" && "🟡 Média"}
                {mode === "baixa" && "🟢 Baixa"}
                {mode === "manual" && "⚙ Manual"}
              </button>
            )
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Raio de atuação (km)</label>
          <input
            type="number"
            min={0.5}
            max={5}
            step={0.1}
            value={radiusKm}
            onChange={(e) => {
              const value = Number(e.target.value);
              setRadiusKm(value);
              saveSettings(demandMode, value);
            }}
          />
        </div>
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
