import React, { useEffect, useState } from "react";
import { Routes as RRoutes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import DriverLogin from "./pages/DriverLogin";
import Dashboard from "./pages/Dashboard";
import DriverApp from "./pages/DriverApp";
import RouteMapbox from "./pages/RouteMapbox";

type Role = "admin" | "driver" | null;

async function getSessionAndRole(): Promise<{ session: any; role: Role }> {
  const { data: sessionData, error: sErr } = await supabase.auth.getSession();
  if (sErr) throw sErr;

  const session = sessionData.session;
  if (!session?.user?.id) return { session: null, role: null };

  const userId = session.user.id;

  const p = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (p.error) {
    console.error("Erro ao buscar perfil:", p.error);
    return { session, role: null };
  }

  if (!p.data) {
    return { session, role: null };
  }

  const raw = (p.data.role || "").toLowerCase();
  const role: Role =
    raw === "admin" ? "admin" : raw === "driver" ? "driver" : null;

  return { session, role };
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);
  const [ready, setReady] = useState(false);

  async function sync() {
    try {
      const r = await getSessionAndRole();
      setSession(r.session);
      setRole(r.role);
    } catch (e) {
      console.error("Erro no sync:", e);
      setSession(null);
      setRole(null);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    sync();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setReady(false);
      sync();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="wrap">
        <div className="card">
          <b>Carregando...</b>
          <div className="muted" style={{ marginTop: 8 }}>
            validando sessão e perfil
          </div>
        </div>
      </div>
    );
  }

  return (
    <RRoutes>
      {/* LOGIN ADMIN / EMPRESA */}
      <Route
        path="/"
        element={
          session ? (
            role === "admin" ? (
              <Navigate to="/admin" replace />
            ) : role === "driver" ? (
              <Navigate to="/driver" replace />
            ) : (
              <Login />
            )
          ) : (
            <Login />
          )
        }
      />

      {/* LOGIN ENTREGADOR */}
      <Route
        path="/driver-login"
        element={
          session ? (
            role === "driver" ? (
              <Navigate to="/driver" replace />
            ) : role === "admin" ? (
              <Navigate to="/admin" replace />
            ) : (
              <DriverLogin />
            )
          ) : (
            <DriverLogin />
          )
        }
      />

      {/* ADMIN */}
      <Route
        path="/admin"
        element={
          session ? (
            role === "admin" ? (
              <Dashboard />
            ) : role === "driver" ? (
              <Navigate to="/driver" replace />
            ) : (
              <Navigate to="/" replace />
            )
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* DRIVER */}
      <Route
        path="/driver"
        element={
          session ? (
            role === "driver" ? (
              <DriverApp />
            ) : role === "admin" ? (
              <Navigate to="/admin" replace />
            ) : (
              <Navigate to="/driver-login" replace />
            )
          ) : (
            <Navigate to="/driver-login" replace />
          )
        }
      />

      {/* MAPA */}
      <Route
        path="/route-mapbox"
        element={
          session ? (
            <RouteMapbox />
          ) : (
            <Navigate to="/driver-login" replace />
          )
        }
      />

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </RRoutes>
  );
}