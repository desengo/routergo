import React, { useEffect, useState } from "react";
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

async function ensureProfileAndGetRole(userId: string): Promise<Role> {
  // tenta ler o profile
  const p = await supabase.from("profiles").select("id,role").eq("id", userId).maybeSingle();

  // se deu erro real (exceto "não achou"), dispara
  if (p.error) throw p.error;

  // se não existe, cria como driver (padrão)
  if (!p.data) {
    const ins = await supabase.from("profiles").insert({ id: userId, role: "driver" });
    if (ins.error) throw ins.error;
    return "driver";
  }

  // se existe mas role vazio/nulo, assume driver por segurança
  const role = (p.data as Profile).role;
  return role === "admin" ? "admin" : "driver";
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);

  // role do usuário logado
  const [role, setRole] = useState<Role | null>(null);
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // sempre que logar/deslogar, resolve role
  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      setRoleReady(false);
      setRole(null);

      try {
        const userId = session?.user?.id;
        if (!userId) {
          setRoleReady(true);
          return;
        }

        const r = await ensureProfileAndGetRole(userId);
        if (!cancelled) setRole(r);
      } catch {
        // fallback seguro: se falhar, trata como driver
        if (!cancelled) setRole("driver");
      } finally {
        if (!cancelled) setRoleReady(true);
      }
    }

    loadRole();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (!ready) return null;
  if (!session) return <Login />;

  // espera resolver role antes de renderizar rotas
  if (!roleReady || !role) return null;

  // ✅ DRIVER: só acessa /driver e /route-mapbox
  if (role === "driver") {
    return (
      <RRoutes>
        <Route path="/driver" element={<DriverApp />} />
        <Route path="/route-mapbox" element={<RouteMapbox />} />
        <Route path="*" element={<Navigate to="/driver" replace />} />
      </RRoutes>
    );
  }

  // ✅ ADMIN: acessa o Dashboard + mapa
  return (
    <RRoutes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/route-mapbox" element={<RouteMapbox />} />
      <Route path="/driver" element={<DriverApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </RRoutes>
  );
}