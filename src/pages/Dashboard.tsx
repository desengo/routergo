import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Deliveries from "./Deliveries";
import Routes from "./Routes";
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
  role?: string | null; // "admin" | "driver" (se você usar)
  display_name?: string | null;
  vehicle_plate?: string | null;
  driver_status?: string | null; // "offline" | "available" | "busy"
  queue_position?: number | null;
  company_owner_id?: string | null; // admin/dono
  created_at?: string;
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

function normalizePlate(v: string) {
  return (v || "").toUpperCase().replace(/\s+/g, "").trim();
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

  // drivers admin view
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [drivers, setDrivers] = useState<ProfileRow[]>([]);
  const [driversMsg, setDriversMsg] = useState<string | null>(null);

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
      const r = await supabase.from("routes").select("id,status").eq("user_id", userId);
      if (r.error) throw r.error;

      const routes = (r.data || []) as RouteRow[];
      const newCount = routes.filter((x) => x.status === "new").length;
      const inProgCount = routes.filter((x) => x.status === "in_progress").length;
      const doneCount = routes.filter((x) => x.status === "done").length;

      // Entregadores vinculados a ESTE admin
      // online = available/busy
      const p = await supabase
        .from("profiles")
        .select("id,driver_status,company_owner_id")
        .eq("company_owner_id", userId);

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

  async function loadDrivers() {
    setLoadingDrivers(true);
    setDriversMsg(null);

    try {
      const userId = await getUserId();
      if (!userId) return;

      // Mostra:
      // 1) drivers já vinculados ao admin
      // 2) drivers ainda sem vínculo (company_owner_id null) — pra você conseguir “adotar”
      // OBS: se você tiver muitos usuários no futuro, a gente filtra melhor.
      const { data, error } = await supabase
        .from("profiles")
        .select("id,role,display_name,vehicle_plate,driver_status,queue_position,company_owner_id,created_at")
        .or(`company_owner_id.eq.${userId},company_owner_id.is.null`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Se você usa role, dá pra priorizar drivers; senão, mostra todos que aparecem no filtro.
      setDrivers((data || []) as ProfileRow[]);
    } catch (e: any) {
      console.error(e);
      setDriversMsg(e?.message || String(e));
    } finally {
      setLoadingDrivers(false);
    }
  }

  async function linkDriverToMe(driverId: string) {
    const userId = await getUserId();
    if (!userId) return;

    const { error } = await supabase
      .from("profiles")
      .update({ company_owner_id: userId })
      .eq("id", driverId);

    if (error) {
      alert("Erro ao vincular: " + error.message);
      return;
    }
    await loadDrivers();
    await loadStats();
  }

  async function unlinkDriver(driverId: string) {
    const userId = await getUserId();
    if (!userId) return;

    const { error } = await supabase
      .from("profiles")
      .update({ company_owner_id: null, driver_status: "offline", queue_position: null })
      .eq("id", driverId)
      .eq("company_owner_id", userId);

    if (error) {
      alert("Erro ao desvincular: " + error.message);
      return;
    }
    await loadDrivers();
    await loadStats();
  }

  async function saveDriverEdits(driverId: string, patch: Partial<ProfileRow>) {
    const userId = await getUserId();
    if (!userId) return;

    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", driverId)
      .eq("company_owner_id", userId);

    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }
    await loadDrivers();
  }

  useEffect(() => {
    // carrega stats ao abrir e sempre que voltar pro home
    if (view === "home") loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (view === "drivers") loadDrivers();
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

  if (view === "drivers") {
    const meId = (async () => await getUserId())(); // só pra evitar warning mental; não usamos no render.
    void meId;

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

        <div className="card">
          <div className="row space">
            <h3 style={{ margin: 0 }}>Entregadores</h3>
            <button className="ghost" onClick={loadDrivers} disabled={loadingDrivers}>
              {loadingDrivers ? "..." : "Atualizar"}
            </button>
          </div>

          <p className="muted" style={{ marginTop: 10 }}>
            Aqui você <b>vincula</b> entregadores à sua empresa e edita <b>Nome</b> e <b>Placa</b>.
            <br />
            O app do entregador continua igual — isso é só o painel admin.
          </p>

          <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="primary" onClick={goDriver}>
              Abrir app do Entregador (teste)
            </button>
          </div>

          {driversMsg && (
            <div style={{ marginTop: 12 }}>
              <b>{driversMsg}</b>
            </div>
          )}
        </div>

        <div className="list" style={{ marginTop: 12 }}>
          {drivers.map((d) => (
            <DriverCard
              key={d.id}
              d={d}
              onLink={linkDriverToMe}
              onUnlink={unlinkDriver}
              onSave={saveDriverEdits}
            />
          ))}

          {drivers.length === 0 && (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                Nenhum entregador encontrado ainda.
                <br />
                Dica: crie uma conta pelo cadastro normal e depois vincule aqui.
              </p>
            </div>
          )}
        </div>
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
            <span className="muted">Cadastro / vínculo / placa</span>
          </div>

          <p className="muted" style={{ marginTop: 8 }}>
            Vincule entregadores à sua empresa e edite nome/placa.
          </p>

          <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="primary" onClick={() => setView("drivers")}>
              Gerenciar Entregadores
            </button>

            <button className="ghost" onClick={goDriver}>
              Abrir app do Entregador
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

/** Card do entregador (admin) */
function DriverCard({
  d,
  onLink,
  onUnlink,
  onSave,
}: {
  d: ProfileRow;
  onLink: (id: string) => Promise<void>;
  onUnlink: (id: string) => Promise<void>;
  onSave: (id: string, patch: Partial<ProfileRow>) => Promise<void>;
}) {
  const [name, setName] = useState(d.display_name || "");
  const [plate, setPlate] = useState(d.vehicle_plate || "");
  const [saving, setSaving] = useState(false);

  const isLinked = !!d.company_owner_id;
  const status = (d.driver_status || "offline").toLowerCase();

  async function save() {
    setSaving(true);
    try {
      await onSave(d.id, {
        display_name: name.trim() || null,
        vehicle_plate: normalizePlate(plate) || null,
      });
    } finally {
      setSaving(false);
    }
  }

  async function setOffline() {
    setSaving(true);
    try {
      await onSave(d.id, {
        driver_status: "offline",
        queue_position: null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="item col">
      <div className="row space">
        <b>👤 {d.display_name || "Entregador"}</b>
        <span className="muted">
          {isLinked ? "Vinculado" : "Sem vínculo"} · Status: {status}
        </span>
      </div>

      <div style={{ marginTop: 10 }}>
        <label>Nome do entregador</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />

        <label>Placa do veículo</label>
        <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC1D23" />
      </div>

      <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        {isLinked ? (
          <>
            <button className="primary" onClick={save} disabled={saving}>
              {saving ? "..." : "Salvar"}
            </button>

            <button className="ghost" onClick={setOffline} disabled={saving}>
              Colocar offline
            </button>

            <button className="ghost" onClick={() => onUnlink(d.id)} disabled={saving}>
              Desvincular
            </button>
          </>
        ) : (
          <>
            <button className="primary" onClick={() => onLink(d.id)} disabled={saving}>
              Vincular à minha empresa
            </button>
          </>
        )}
      </div>

      <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
        ID: {d.id}
      </div>
    </div>
  );
}