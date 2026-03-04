import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type RouteRow = {
  id: string;
  name: string | null;
  status: "new" | "accepted" | "in_progress" | "done";
  assigned_driver_id: string | null;
  stops: { lat: number; lng: number; label?: string }[] | null;
  total_est_km: number | null;
};

type Profile = {
  id: string;
  display_name: string | null;
  vehicle_plate: string | null;
  driver_status: "offline" | "available" | "busy";
  queue_position: number;
};

async function getMe() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function getLastQueuePosition() {
  const { data, error } = await supabase
    .from("profiles")
    .select("queue_position")
    .order("queue_position", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.queue_position ?? 0;
}

export default function DriverApp() {

  const [profile, setProfile] = useState<Profile | null>(null);

  const [status, setStatus] = useState<
    "offline" | "available" | "busy"
  >("offline");

  const [routeOffer, setRouteOffer] = useState<RouteRow | null>(null);

  const [offerTime, setOfferTime] = useState(20);

  const [activeRoute, setActiveRoute] = useState<RouteRow | null>(null);

  const [routeCode, setRouteCode] = useState("");

  const [loading, setLoading] = useState(false);

  async function loadProfile() {

    const me = await getMe();
    if (!me) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", me.id)
      .single();

    if (error) throw error;

    setProfile(data);

    setStatus(data.driver_status ?? "offline");
  }

  useEffect(() => {

    loadProfile();

  }, []);

  async function goAvailable() {

    setLoading(true);

    try {

      const me = await getMe();
      if (!me) return;

      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("driver_status", "available");

      if ((count || 0) >= 7) {

        alert("Limite de 7 entregadores disponíveis atingido.");

        return;
      }

      const last = await getLastQueuePosition();

      const { error } = await supabase
        .from("profiles")
        .update({
          driver_status: "available",
          queue_position: last + 1
        })
        .eq("id", me.id);

      if (error) throw error;

      setStatus("available");

      await loadProfile();

    } finally {

      setLoading(false);

    }
  }

  async function goOffline() {

    setLoading(true);

    try {

      const me = await getMe();
      if (!me) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          driver_status: "offline"
        })
        .eq("id", me.id);

      if (error) throw error;

      setStatus("offline");

      setRouteOffer(null);

      setActiveRoute(null);

    } finally {

      setLoading(false);

    }
  }

  async function checkRouteOffer() {

    const me = await getMe();
    if (!me) return;

    const { data, error } = await supabase
      .from("routes")
      .select("*")
      .eq("assigned_driver_id", me.id)
      .eq("status", "new")
      .maybeSingle();

    if (error) return;

    if (data) {

      setRouteOffer(data);

      setOfferTime(20);

    }
  }

  useEffect(() => {

    if (status !== "available") return;

    const i = setInterval(checkRouteOffer, 5000);

    return () => clearInterval(i);

  }, [status]);

  useEffect(() => {

    if (!routeOffer) return;

    const t = setInterval(() => {

      setOfferTime((s) => {

        if (s <= 1) {

          rejectRoute();

          return 20;

        }

        return s - 1;

      });

    }, 1000);

    return () => clearInterval(t);

  }, [routeOffer]);

  async function acceptRoute() {

    if (!routeOffer) return;

    const me = await getMe();
    if (!me) return;

    await supabase
      .from("routes")
      .update({
        status: "accepted"
      })
      .eq("id", routeOffer.id);

    await supabase
      .from("profiles")
      .update({
        driver_status: "busy"
      })
      .eq("id", me.id);

    setActiveRoute(routeOffer);

    setRouteOffer(null);

    setStatus("busy");
  }

  async function rejectRoute() {

    if (!routeOffer) return;

    await supabase
      .from("routes")
      .update({
        assigned_driver_id: null
      })
      .eq("id", routeOffer.id);

    setRouteOffer(null);
  }

  function confirmCode() {

    if (!activeRoute) return;

    const expected = (activeRoute.name || "").replace("Rota ", "");

    if (routeCode === expected) {

      openMap();

    } else {

      alert("Código incorreto");

    }
  }

  function openMap() {

    if (!activeRoute) return;

    const stops = (activeRoute.stops || []).map((s) => ({

      lat: Number(s.lat),

      lng: Number(s.lng),

      label: s.label

    }));

    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));

    window.location.href = "/route-mapbox";
  }

  async function finishRoute() {

    if (!activeRoute) return;

    const me = await getMe();
    if (!me) return;

    const last = await getLastQueuePosition();

    await supabase
      .from("routes")
      .update({
        status: "done",
        finished_at: new Date().toISOString()
      })
      .eq("id", activeRoute.id);

    await supabase
      .from("profiles")
      .update({
        driver_status: "available",
        queue_position: last + 1
      })
      .eq("id", me.id);

    setActiveRoute(null);

    setStatus("available");
  }

  if (!profile) {

    return <div className="wrap">Carregando...</div>;

  }

  return (

    <div className="wrap">

      <div className="topbar">

        <h2>Entregador</h2>

        <button

          className="ghost"

          onClick={() => supabase.auth.signOut()}

        >

          Sair

        </button>

      </div>

      <div className="card">

        <div className="row space">

          <b>Nome</b>

          <span>{profile.display_name}</span>

        </div>

        <div className="row space">

          <b>Placa</b>

          <span>{profile.vehicle_plate}</span>

        </div>

        <div className="row space">

          <b>Status</b>

          <span>{status}</span>

        </div>

      </div>

      {status === "offline" && (

        <div className="card" style={{ marginTop: 12 }}>

          <button

            className="primary"

            onClick={goAvailable}

            disabled={loading}

          >

            Ficar disponível

          </button>

        </div>

      )}

      {status === "available" && (

        <div className="card" style={{ marginTop: 12 }}>

          <button

            className="ghost"

            onClick={goOffline}

            disabled={loading}

          >

            Ficar offline

          </button>

        </div>

      )}

      {routeOffer && (

        <div className="card" style={{ marginTop: 12 }}>

          <h3>Nova rota disponível</h3>

          <p>{routeOffer.name}</p>

          <p>{routeOffer.total_est_km ?? "?"} km</p>

          <p>Tempo para aceitar: {offerTime}s</p>

          <div className="row">

            <button

              className="primary"

              onClick={acceptRoute}

            >

              Aceitar

            </button>

            <button

              className="ghost"

              onClick={rejectRoute}

            >

              Recusar

            </button>

          </div>

        </div>

      )}

      {activeRoute && (

        <div className="card" style={{ marginTop: 12 }}>

          <h3>{activeRoute.name}</h3>

          <label>Código da rota</label>

          <input

            value={routeCode}

            onChange={(e) => setRouteCode(e.target.value)}

          />

          <button

            className="primary"

            onClick={confirmCode}

          >

            Iniciar rota

          </button>

          <button

            className="ghost"

            onClick={finishRoute}

          >

            Concluir rota

          </button>

        </div>

      )}

    </div>

  );
}