import React, { useEffect, useMemo, useState } from "react";
import { Routes as RRoutes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RouteMapbox from "./pages/RouteMapbox";
import DriverApp from "./pages/DriverApp";

type Role = "admin" | "driver";

type Profile = {
  id: string;
  role: Role | null;
};

async function getProfileRole(userId: string): Promise<Role> {
  // Se não achar profile, por segurança assume admin (ou você pode assumir driver)
  const { data, error } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  const role = (data?.role as Role | null) ?? null;

  // fallback: se não tiver role definido, assume admin (ajuste se preferir)
  return role ?? "admin";
}

function FullscreenCenter({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 520, margin: "60px auto" }}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);

  const [role, setRole] = useState<Role | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const [roleErr, setRoleErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // quando troca sessão, recarrega role
      setRole(null);
      setRoleReady(false);
      setRoleErr(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadRole() {
      try {
        setRoleErr(null);
        setRoleReady(false);

        if (!session?.user?.id) {
          setRole(null);
          setRoleReady(true);
          return;
        }

        const r = await getProfileRole(session.user.id);
        setRole(r);
      } catch (e: any) {
        setRoleErr(e?.message || String(e));
        // fallback seguro
        setRole("admin");
      } finally {
        setRoleReady(true);
      }
    }

    if (session) loadRole();
    else {
      setRole(null);
      setRoleReady(true);
    }
  }, [session]);

  if (!ready) return null;

  if (!session) return <Login />;

  if (!roleReady) {
    return (
      <FullscreenCenter>
        <b>Carregando perfil...</b>
        <div className="muted" style={{ marginTop: 8 }}>
          Aguarde um instante.
        </div>
      </FullscreenCenter>
    );
  }

  // Helpers
  const isAdmin = role === "admin";
  const isDriver = role === "driver";

  // Rotas default por tipo de usuário
  const defaultPath = useMemo(() => {
    if (isDriver) return "/driver";
    return "/";
  }, [isDriver]);

  if (roleErr) {
    // não bloqueia, mas informa (você pode remover se quiser)
    console.warn("Erro ao carregar role:", roleErr);
  }

  return (
    <RRoutes>
      {/* ✅ Admin: dashboard */}
      <Route
        path="/"
        element={isAdmin ? <Dashboard /> : <Navigate to={defaultPath} replace />}
      />

      {/* ✅ Admin e Driver podem ver o mapa (você pode restringir se quiser) */}
      <Route path="/route-mapbox" element={<RouteMapbox />} />

      {/* ✅ App do entregador */}
      <Route
        path="/driver"
        element={
          isAdmin || isDriver ? <DriverApp /> : <Navigate to={defaultPath} replace />
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={defaultPath} replace />} />
    </RRoutes>
  );
}