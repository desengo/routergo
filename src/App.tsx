// src/App.tsx
import React, { useEffect, useState } from "react";
import { Routes as RRoutes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
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

  // tenta buscar role do profile
  const p = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();

  // se der erro de RLS, tabela, etc, não trava o app – só deixa role null
  if (p.error) return { session, role: null };

  // se não existe profile, cria um default driver (para não quebrar)
  if (!p.data) {
    const ins = await supabase.from("profiles").insert({
      id: userId,
      role: "driver",
      driver_status: "offline",
      queue_position: null,
    });

    // se insert falhar (ex.: trigger já cria), tenta ler de novo
    if (!ins.error) {
      return { session, role: "driver" };
    }

    const p2 = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (!p2.error && p2.data?.role) {
      const r = (p2.data.role === "admin" ? "admin" : "driver") as Role;
      return { session, role: r };
    }

    return { session, role: null };
  }

  const raw = (p.data.role || "").toLowerCase();
  const role: Role = raw === "admin" ? "admin" : raw === "driver" ? "driver" : null;

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
      // se der erro, não deixa tela verde
      setSession(null);
      setRole(null);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    sync();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      // em qualquer mudança de auth, recarrega sessão+role
      setReady(false);
      await sync();
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // sem login → sempre Login
  if (!session) return <Login />;

  return (
    <RRoutes>
      {/* Home: manda para o app correto */}
      <Route
        path="/"
        element={<Navigate to={role === "admin" ? "/admin" : "/driver"} replace />}
      />

      {/* ADMIN */}
      <Route
        path="/admin"
        element={role === "admin" ? <Dashboard /> : <Navigate to="/driver" replace />}
      />

      {/* DRIVER */}
      <Route
        path="/driver"
        element={role === "driver" ? <DriverApp /> : <Navigate to="/admin" replace />}
      />

      {/* MAPA: pode abrir de admin ou driver */}
      <Route path="/route-mapbox" element={<RouteMapbox />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </RRoutes>
  );
}