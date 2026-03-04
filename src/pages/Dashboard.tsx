import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Deliveries from "./Deliveries";
import Routes from "./Routes";
import {
  getCompanySettings,
  updateCompanySettings,
  DemandMode,
} from "../lib/companySettings";

type View = "home" | "deliveries" | "routes";

type RouteRow = {
  id: string;
  status: "new" | "in_progress" | "done" | string;
};

type ProfileRow = {
  id: string;
  driver_status?: string | null;
};

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function intervalLabel(mode: DemandMode) {
  // alinhado com o que você definiu: 15/30/60 e manual não roda
  if (mode === "alta") return "15s";
  if (mode === "media") return "30s";
  if (mode === "baixa") return "60s";
  return "—";
}

export default function Dashboard() {
  const [view, setView] = useState<View>("home");

  // settings
  const [demandMode, setDemandMode] = useState<DemandMode>("media");
  const [radiusKm, setRadiusKm] = useState<number>(1.2);
  const [saving, setSaving] = useState(false);

  // stats
  const [loadingStats, setLoadingStats] = useState(false);
  const [deliveriesCount, setDeliveriesCount] = useState(0);
  const [routesCount, setRoutesCount] = useState(0);
  const [routesNewCount, setRoutesNewCount] = useState(0);
  const [routesInProgressCount, setRoutesInProgressCount] = useState(0);
  const [routesDoneCount, setRoutesDoneCount] = useState(0);
  const [driversOnlineCount, setDriversOnlineCount] = useState(0);

  const scanLabel = useMemo(() => intervalLabel(demandMode), [demandMode]);

  // load settings once
  useEffect(() => {
    async function loadSettings() {
      try {
        const s = await getCompanySettings();
        setDemandMode(s.demand_mode);
        setRadiusKm(Number(s.delivery_radius_km || 1.2));
      } catch (e) {
        console.error("Erro ao carregar companySettings:", e);
      }
    }
    loadSettings();
  }, []);

  async function saveSettings(nextMode: DemandMode, nextRadius: number) {
    setSaving(true);
    try {
      await updateCompanySettings({
        demand_mode: nextMode,
        delivery_radius_km: nextRadius,
      });
    } catch (e) {
      console.error("Erro ao salvar companySettings:", e);
      alert("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  async function loadStats() {
    setLoadingStats(true);
    try {
      const userId = await getUserId();
      if (!userId) return;

      // Entregas do admin
      const d = await supabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (d.error) throw d.error;

      // Rotas do admin (pega status pra contar)
      const r = await supabase
        .from("routes")
        .select("id,status")
        .eq("user_id", userId);

      if (r.error) throw r.error;

      const routes = (r.data || []) as RouteRow[];
      const newCount = routes.filter((x) => x.status === "new").length;
      const inProgCount = routes.filter((x) => x.status === "in_progress").length;
      const doneCount = routes.filter((x) => x.status === "done").length;

      // Entregadores online (profiles)
      // Como você definiu limite de online e fila, aqui contamos "available" e "busy" como online
      const p = await supabase
        .from("profiles")
        .select("id,driver_status");

      if (p.error) throw p.error;

      const profiles = (p.data || []) as ProfileRow[];
      const online = profiles.filter((x) => {
        const s = (x.driver_status || "").toLowerCase();
        return s === "available" || s === "busy";
      }).length;

      setDeliveriesCount(d.count || 0);
      setRoutesCount(routes.length);
      setRoutesNewCount(newCount);
      setRoutesInProgressCount(inProgCount);
      setRoutesDoneCount(doneCount);
      setDriversOnlineCount(online);
    } catch (e: any) {
      console.error(e);
      alert("Erro ao buscar métricas: " + (e?.message || String(e)));
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    // carrega stats ao abrir e sempre que voltar pro home
    if (view === "home") loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function goDriver() {
    window.location.href = "/driver";
  }

  function goMap() {
    window.location.href = "/route-mapbox";
  }

  // ------------------ RENDER ------------------

  // Se abriu uma área, mostra só ela + botão voltar (sem duplicar a home)
  if (view === "deliveries") {
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

          <div className="row" style={{ gap: 10 }}>
            <button className="ghost" onClick={() => setView("home")}>
              ← Voltar ao Painel
            </button>

            <button className="ghost" onClick={() => supabase.auth.signOut()}>
              Sair
            </button>
          </div>
        </div>

        <Deliveries />
      </div>
    );
  }

  if (view === "routes") {
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

          <div className="row" style={{ gap: 10 }}>
            <button className="ghost" onClick={() => setView("home")}>
              ← Voltar ao Painel
            </button>

            <button className="ghost" onClick={() => supabase.auth.signOut()}>
              Sair
            </button>
          </div>
        </div>

        <Routes />
      </div>
    );
  }

  // HOME / ADMIN
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

      <div className="card">
        <div className="row space">
          <h3 style={{ margin: 0 }}>Painel Admin</h3>
          <button className="ghost" onClick={loadStats} disabled={loadingStats}>
            {loadingStats ? "..." : "Atualizar"}
          </button>
        </div>

        <p className="muted" style={{ marginTop: 10 }}>
          Automático: <b>{demandMode === "manual" ? "DESLIGADO" : "LIGADO"}</b> · Varredura{" "}
          <b>{scanLabel}</b> · Raio <b>{Number(radiusKm || 1.2).toFixed(1)} km</b>
          <br />
          Entregadores online: <b>{driversOnlineCount}</b> · Entregas:{" "}
          <b>{deliveriesCount}</b> · Rotas: <b>{routesCount}</b>
        </p>
      </div>

      {/* Cards principais */}
      <div className="list" style={{ marginTop: 12 }}>
        <div className="item col">
          <div className="row space">
            <b>📦 Entregas</b>
            <span className="muted">Total: {deliveriesCount}</span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Cadastrar entregas (ViaCEP + coordenadas) para gerar rotas.
          </p>
          <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="primary" onClick={() => setView("deliveries")}>
              Abrir Entregas
            </button>
          </div>
        </div>

        <div className="item col">
          <div className="row space">
            <b>🚚 Rotas</b>
            <span className="muted">
              Novas: {routesNewCount} · Andamento: {routesInProgressCount} · Concluídas:{" "}
              {routesDoneCount}
            </span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Gerar rotas, ver paradas, abrir no mapa e concluir.
          </p>
          <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="primary" onClick={() => setView("routes")}>
              Abrir Rotas
            </button>
          </div>
        </div>

        <div className="item col">
          <div className="row space">
            <b>⚙️ Demanda e Raio</b>
            <span className="muted">
              {demandMode === "alta" && "🔴 Alta"}
              {demandMode === "media" && "🟡 Média"}
              {demandMode === "baixa" && "🟢 Baixa"}
              {demandMode === "manual" && "⚙ Manual"} · Varredura {scanLabel}
            </span>
          </div>

          <p className="muted" style={{ marginTop: 8 }}>
            Ajusta o comportamento do automático (manual desliga varredura).
          </p>

          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {(["alta", "media", "baixa", "manual"] as DemandMode[]).map((mode) => (
              <button
                key={mode}
                className={demandMode === mode ? "primary" : "ghost"}
                disabled={saving}
                onClick={async () => {
                  setDemandMode(mode);
                  await saveSettings(mode, radiusKm);
                }}
              >
                {mode === "alta" && "🔴 Alta"}
                {mode === "media" && "🟡 Média"}
                {mode === "baixa" && "🟢 Baixa"}
                {mode === "manual" && "⚙ Manual"}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Raio de atuação (km)</label>
            <input
              type="number"
              min={0.5}
              max={10}
              step={0.1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              onBlur={() => saveSettings(demandMode, Number(radiusKm || 1.2))}
              disabled={saving}
            />
            <div className="muted" style={{ marginTop: 6 }}>
              * Ao sair do campo, salva automaticamente.
            </div>
          </div>
        </div>

        <div className="item col">
          <div className="row space">
            <b>👨‍✈️ Entregadores</b>
            <span className="muted">App do entregador</span>
          </div>

          <p className="muted" style={{ marginTop: 8 }}>
            Acesso direto para testes/operacional. (Não altera a tela do entregador.)
          </p>

          <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="primary" onClick={goDriver}>
              Abrir tela do Entregador
            </button>
          </div>
        </div>

        <div className="item col">
          <div className="row space">
            <b>🗺️ Mapa</b>
            <span className="muted">RouteMapbox</span>
          </div>

          <p className="muted" style={{ marginTop: 8 }}>
            Visualização de rota (usa sessionStorage com as paradas).
          </p>

          <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="ghost" onClick={goMap}>
              Abrir Mapa
            </button>
          </div>

          <div className="muted" style={{ marginTop: 8 }}>
            * Pode abrir vazio se não houver paradas salvas.
          </div>
        </div>
      </div>
    </div>
  );
}