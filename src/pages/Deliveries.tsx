import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Stop = { lat: number; lng: number; label?: string };
type RouteRow = {
  id: string;
  user_id: string;
  name: string | null;
  status: string;
  stops: Stop[] | null;
  total_est_km: number | null;
  assigned_driver_id: string | null;
  assigned_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at?: string;
};

async function getMe() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export default function DriverApp() {
  const [meId, setMeId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const [myRoute, setMyRoute] = useState<RouteRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // carrega profile + rota atribuída
  async function load() {
    setLoading(true);
    setMsg(null);

    const me = await getMe();
    if (!me) {
      setLoading(false);
      return;
    }
    setMeId(me.id);

    const p = await supabase.from("profiles").select("*").eq("id", me.id).maybeSingle();
    if (p.error) {
      setLoading(false);
      setMsg("Erro profile: " + p.error.message);
      return;
    }
    setProfile(p.data);

    // minha rota atual (assigned/picked_up/in_progress)
    const r = await supabase
      .from("routes")
      .select("id,user_id,name,status,stops,total_est_km,assigned_driver_id,assigned_at,started_at,finished_at,created_at")
      .eq("assigned_driver_id", me.id)
      .in("status", ["assigned", "picked_up", "in_progress"])
      .order("assigned_at", { ascending: false })
      .limit(1);

    if (r.error) {
      setLoading(false);
      setMsg("Erro rota: " + r.error.message);
      return;
    }

    setMyRoute((r.data?.[0] as any) || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const role = profile?.role || "admin";
  const companyId = profile?.company_id || null;

  const canWork = useMemo(() => role === "driver" && !!companyId, [role, companyId]);

  async function claimNext() {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.rpc("claim_next_route");
    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }
    if (!data) {
      setMsg("Nenhuma rota disponível agora.");
      await load();
      return;
    }

    setMsg("Rota atribuída ✅");
    await load();
  }

  async function pickup() {
    if (!myRoute) return;
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.rpc("pickup_my_route", { p_route_id: myRoute.id });
    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Pedido retirado ✅");
    await load();
  }

  async function start() {
    if (!myRoute) return;
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.rpc("start_my_route", { p_route_id: myRoute.id });
    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    // abre mapa usando ROUTE_ID (sem sessionStorage)
    window.location.href = `/route-mapbox?routeId=${encodeURIComponent(myRoute.id)}`;
  }

  async function finish() {
    if (!myRoute) return;
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.rpc("finish_my_route", { p_route_id: myRoute.id });
    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Rota concluída ✅ Você está livre.");
    await load();
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <h2>Entregador</h2>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>

      <div className="card">
        <div className="row space">
          <b>Status</b>
          <button className="ghost" onClick={load}>
            {loading ? "..." : "Atualizar"}
          </button>
        </div>

        <div className="muted" style={{ marginTop: 8 }}>
          Sua conta: <b>{role}</b>
          <br />
          {role === "driver" ? (
            <>
              Empresa vinculada: <b>{companyId ? "ok" : "não"}</b>
            </>
          ) : (
            <>
              (Você está como admin. Para entregador, role deve ser <b>driver</b>.)
            </>
          )}
        </div>

        {msg && (
          <div style={{ marginTop: 10 }}>
            <b>{msg}</b>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row space">
          <b>Minha rota</b>
          {!myRoute && (
            <button className="primary" onClick={claimNext} disabled={loading || !canWork}>
              Pegar próxima rota
            </button>
          )}
        </div>

        {!canWork && (
          <p className="muted" style={{ marginTop: 10 }}>
            Para funcionar: seu profile precisa ter <b>role = 'driver'</b> e <b>company_id</b> apontando para a empresa.
          </p>
        )}

        {myRoute ? (
          <div style={{ marginTop: 10 }}>
            <div className="row space">
              <div>
                <div style={{ fontWeight: 800 }}>{myRoute.name || "Rota"}</div>
                <div className="muted">Status: {myRoute.status}</div>
              </div>
              <div className="muted">~{myRoute.total_est_km ?? "?"} km</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <b>Paradas:</b> {Array.isArray(myRoute.stops) ? myRoute.stops.length : 0}
            </div>

            <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button className="ghost" disabled={loading || myRoute.status !== "assigned"} onClick={pickup}>
                Retirar pedido
              </button>

              <button className="primary" disabled={loading || !["assigned", "picked_up"].includes(myRoute.status)} onClick={start}>
                Iniciar rota
              </button>

              <button className="ghost" disabled={loading || myRoute.status !== "in_progress"} onClick={finish}>
                Concluir rota
              </button>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 10 }}>
            Você está livre. Clique em <b>Pegar próxima rota</b>.
          </p>
        )}
      </div>
    </div>
  );
}