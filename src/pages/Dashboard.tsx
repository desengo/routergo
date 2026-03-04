import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Deliveries from "./Deliveries";
import Routes from "./Routes";
import { useNavigate } from "react-router-dom";
import {
  getCompanySettings,
  updateCompanySettings,
  DemandMode,
} from "../lib/companySettings";

type Tab = "deliveries" | "routes";

type ProfileRow = {
  id: string;
  driver_status?: "offline" | "available" | "busy";
};

function intervalLabel(mode: DemandMode) {
  // você decidiu 15 / 30 / 60
  if (mode === "alta") return "15s";
  if (mode === "media") return "30s";
  if (mode === "baixa") return "60s";
  return "Desligado";
}

function modeLabel(mode: DemandMode) {
  if (mode === "alta") return "🔴 Alta";
  if (mode === "media") return "🟡 Média";
  if (mode === "baixa") return "🟢 Baixa";
  return "⚙ Manual";
}

export default function Dashboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("deliveries");

  // settings (demanda/raio)
  const [demandMode, setDemandMode] = useState<DemandMode>("media");
  const [radiusKm, setRadiusKm] = useState<number>(1.2);
  const [savingSettings, setSavingSettings] = useState(false);

  // operação
  const [opLoading, setOpLoading] = useState(false);
  const [driversOnline, setDriversOnline] = useState<number>(0);

  // auxilia: counts rápidos vindos dos próprios componentes (melhor UX)
  // (aqui é só “visão admin”; não interfere na lógica)
  const [deliveriesCount, setDeliveriesCount] = useState<number | null>(null);
  const [routesCount, setRoutesCount] = useState<{
    new: number;
    in_progress: number;
    done: number;
    total: number;
  } | null>(null);

  // carrega settings uma vez
  useEffect(() => {
    (async () => {
      try {
        const s = await getCompanySettings();
        setDemandMode(s.demand_mode);
        setRadiusKm(Number(s.delivery_radius_km || 1.2));
      } catch {
        // mantém default
      }
    })();
  }, []);

  async function saveSettings(nextMode: DemandMode, nextRadius: number) {
    setSavingSettings(true);
    try {
      await updateCompanySettings({
        demand_mode: nextMode,
        delivery_radius_km: nextRadius,
      });
      setDemandMode(nextMode);
      setRadiusKm(nextRadius);
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar configurações.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function loadOperation() {
    setOpLoading(true);
    try {
      // drivers online (available + busy)
      const { data, error } = await supabase
        .from("profiles")
        .select("id,driver_status");

      if (error) throw error;

      const list = (data || []) as ProfileRow[];
      const online = list.filter((p) => p.driver_status && p.driver_status !== "offline").length;
      setDriversOnline(online);

      // counts rápidos de entregas/rotas (para cards)
      const { data: me } = await supabase.auth.getSession();
      const userId = me.session?.user?.id;
      if (!userId) return;

      const [dRes, rRes] = await Promise.all([
        supabase
          .from("deliveries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),

        supabase
          .from("routes")
          .select("status", { count: "exact" })
          .eq("user_id", userId),
      ]);

      if (dRes.error) throw dRes.error;
      if (rRes.error) throw rRes.error;

      setDeliveriesCount(dRes.count ?? null);

      const rows = (rRes.data || []) as Array<{ status: "new" | "in_progress" | "done" }>;
      const n = rows.filter((x) => x.status === "new").length;
      const p = rows.filter((x) => x.status === "in_progress").length;
      const d = rows.filter((x) => x.status === "done").length;

      setRoutesCount({
        new: n,
        in_progress: p,
        done: d,
        total: rows.length,
      });
    } catch (e: any) {
      // sem travar a UI
      console.error(e);
    } finally {
      setOpLoading(false);
    }
  }

  useEffect(() => {
    loadOperation();
    // atualização leve a cada 20s só para dashboard
    const t = window.setInterval(loadOperation, 20_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoStatusText = useMemo(() => {
    if (demandMode === "manual") return "Automático: DESLIGADO (manual)";
    return `Automático: LIGADO · Varredura ${intervalLabel(demandMode)} · Raio ${radiusKm} km`;
  }, [demandMode, radiusKm]);

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

      {/* ✅ CENTRAL ADMIN (tudo em uma tela, em cards) */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row space">
          <b>Painel Admin</b>
          <button className="ghost" onClick={loadOperation} disabled={opLoading}>
            {opLoading ? "..." : "Atualizar"}
          </button>
        </div>

        <div className="muted" style={{ marginTop: 8 }}>
          {autoStatusText}
          <br />
          Entregadores online: <b>{driversOnline}</b> · Entregas:{" "}
          <b>{deliveriesCount == null ? "?" : deliveriesCount}</b> · Rotas:{" "}
          <b>{routesCount ? routesCount.total : "?"}</b>
        </div>

        <div className="list" style={{ marginTop: 12 }}>
          {/* Atalhos principais */}
          <div className="item col">
            <div className="row space">
              <b>📦 Entregas</b>
              <span className="muted">
                Total: {deliveriesCount == null ? "?" : deliveriesCount}
              </span>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button className="primary" onClick={() => setTab("deliveries")}>
                Abrir Entregas
              </button>
            </div>
          </div>

          <div className="item col">
            <div className="row space">
              <b>🚚 Rotas</b>
              <span className="muted">
                {routesCount
                  ? `Novas: ${routesCount.new} · Andamento: ${routesCount.in_progress} · Concluídas: ${routesCount.done}`
                  : "Carregando..."}
              </span>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button className="primary" onClick={() => setTab("routes")}>
                Abrir Rotas
              </button>
            </div>
          </div>

          <div className="item col">
            <div className="row space">
              <b>⚙️ Demanda e Raio</b>
              <span className="muted">
                {modeLabel(demandMode)} · Varredura {intervalLabel(demandMode)}
              </span>
            </div>

            <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {(["alta", "media", "baixa", "manual"] as DemandMode[]).map((m) => (
                <button
                  key={m}
                  className={demandMode === m ? "primary" : "ghost"}
                  disabled={savingSettings}
                  onClick={() => saveSettings(m, radiusKm)}
                >
                  {modeLabel(m)}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Raio de atuação (km)</label>
              <input
                type="number"
                min={0.2}
                max={10}
                step={0.1}
                value={radiusKm}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setRadiusKm(v);
                }}
                onBlur={() => saveSettings(demandMode, radiusKm)}
                disabled={savingSettings}
              />
              <div className="muted" style={{ marginTop: 6 }}>
                * Ao sair do campo, salva automaticamente.
              </div>
            </div>
          </div>

          <div className="item col">
            <div className="row space">
              <b>👨‍✈️ Entregadores</b>
              <span className="muted">Acesso ao app do entregador (teste/operacional)</span>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button className="ghost" onClick={() => nav("/driver")}>
                Abrir tela do Entregador
              </button>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              * Você pediu para não alterar a tela do entregador — aqui é só um atalho.
            </div>
          </div>

          <div className="item col">
            <div className="row space">
              <b>🗺️ Mapa</b>
              <span className="muted">Visualização da rota (RouteMapbox)</span>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button className="ghost" onClick={() => nav("/route-mapbox")}>
                Abrir Mapa
              </button>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              * O mapa usa o sessionStorage (paradas). Ele pode abrir vazio se não houver rota ativa.
            </div>
          </div>
        </div>
      </div>

      {/* ✅ mantém suas abas atuais (não muda o visual do app) */}
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