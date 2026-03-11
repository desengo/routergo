import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Deliveries from "./Deliveries";
import Routes from "./Routes";
import AddressScanner from "../components/AddressScanner";
import {
  getCompanySettings,
  updateCompanySettings,
  DemandMode,
} from "../lib/companySettings";

type View = "home" | "deliveries" | "routes" | "drivers";

type RouteRow = {
  id: string;
  status: "new" | "in_progress" | "done" | string;
};

type ProfileRow = {
  id: string;
  role?: string | null;
  display_name?: string | null;
  vehicle_plate?: string | null;
  driver_status?: string | null;
  queue_position?: number | null;
  company_owner_id?: string | null;
  created_at?: string;
};

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function intervalLabel(mode: DemandMode) {
  if (mode === "alta") return "15s";
  if (mode === "media") return "30s";
  if (mode === "baixa") return "60s";
  return "—";
}

function normalizePlate(v: string) {
  return (v || "").toUpperCase().replace(/\s+/g, "").trim();
}

export default function Dashboard() {
  const [view, setView] = useState<View>("home");

  const [demandMode, setDemandMode] = useState<DemandMode>("media");
  const [radiusKm, setRadiusKm] = useState<number>(1.2);
  const [saving, setSaving] = useState(false);

  const [loadingStats, setLoadingStats] = useState(false);
  const [deliveriesCount, setDeliveriesCount] = useState(0);
  const [routesCount, setRoutesCount] = useState(0);
  const [routesNewCount, setRoutesNewCount] = useState(0);
  const [routesInProgressCount, setRoutesInProgressCount] = useState(0);
  const [routesDoneCount, setRoutesDoneCount] = useState(0);
  const [driversOnlineCount, setDriversOnlineCount] = useState(0);

  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [drivers, setDrivers] = useState<ProfileRow[]>([]);
  const [driversMsg, setDriversMsg] = useState<string | null>(null);

  const scanLabel = useMemo(() => intervalLabel(demandMode), [demandMode]);

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

      const d = await supabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      const r = await supabase.from("routes").select("id,status").eq("user_id", userId);

      const routes = (r.data || []) as RouteRow[];
      const newCount = routes.filter((x) => x.status === "new").length;
      const inProgCount = routes.filter((x) => x.status === "in_progress").length;
      const doneCount = routes.filter((x) => x.status === "done").length;

      const p = await supabase
        .from("profiles")
        .select("id,driver_status,company_owner_id")
        .eq("company_owner_id", userId);

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
    if (view === "home") loadStats();
  }, [view]);

  // ----------- VIEW ENTREGAS COM SCANNER INSERIDO -----------

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

        <AddressScanner />

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

      <div className="list" style={{ marginTop: 12 }}>
        <div className="item col">
          <div className="row space">
            <b>📦 Entregas</b>
            <span className="muted">Total: {deliveriesCount}</span>
          </div>

          <p className="muted" style={{ marginTop: 8 }}>
            Cadastrar entregas (ViaCEP + coordenadas) para gerar rotas.
          </p>

          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            <button className="primary" onClick={() => setView("deliveries")}>
              Abrir Entregas
            </button>
          </div>
        </div>

        <div className="item col">
          <div className="row space">
            <b>🚚 Rotas</b>
          </div>

          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            <button className="primary" onClick={() => setView("routes")}>
              Abrir Rotas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}