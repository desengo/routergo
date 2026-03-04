import React, { useEffect, useState } from "react";
import { Routes as RRoutes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RouteMapbox from "./pages/RouteMapbox";
import DriverApp from "./pages/DriverApp";
import DriversAdmin from "./pages/DriversAdmin";

type Role = "admin" | "driver";

type Profile = {
  id: string;
  role: Role | null;
};

async function ensureProfileAndGetRole(userId: string): Promise<Role> {
  const p = await supabase.from("profiles").select("id,role").eq("id", userId).maybeSingle();
  if (p.error) throw p.error;

  if (!p.data) {
    const ins = await supabase.from("profiles").insert({ id: userId, role: "driver" });
    if (ins.error) throw ins.error;
    return "driver";
  }

  const role = (p.data as Profile).role;
  return role === "admin" ? "admin" : "driver";
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);

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

  useEffect(() => {
    async function loadRole() {
      setRoleReady(false);

      const userId = session?.user?.id;
      if (!userId) {
        setRoleReady(true);
        return;
      }

      try {
        const r = await ensureProfileAndGetRole(userId);
        setRole(r);
      } catch {
        setRole("driver");
      }

      setRoleReady(true);
    }

    loadRole();
  }, [session?.user?.id]);

  if (!ready) return null;
  if (!session) return <Login />;
  if (!roleReady || !role) return null;

  return (
    <RRoutes>
      {/* ADMIN */}
      {role === "admin" && (
        <>
          <Route path="/" element={<Dashboard />} />
          <Route path="/route-mapbox" element={<RouteMapbox />} />
          <Route path="/admin/drivers" element={<DriversAdmin />} />

          {/* admin pode abrir /driver pra teste, se você quiser permitir */}
          <Route path="/driver" element={<DriverApp />} />
        </>
      )}

      {/* DRIVER */}
      {role === "driver" && (
        <>
          <Route path="/driver" element={<DriverApp />} />
          <Route path="/route-mapbox" element={<RouteMapbox />} />

          {/* bloqueia acesso do driver ao admin */}
          <Route path="/" element={<Navigate to="/driver" replace />} />
          <Route path="/admin/drivers" element={<Navigate to="/driver" replace />} />
        </>
      )}

      <Route path="*" element={<Navigate to="/" replace />} />
    </RRoutes>
  );
}