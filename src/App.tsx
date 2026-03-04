import React, { useEffect, useState } from "react";
import { Routes as RRoutes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RouteMapbox from "./pages/RouteMapbox";
import DriverApp from "./pages/DriverApp";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      setSession(session);

      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        setRole(profile?.role ?? null);
      }

      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);

      if (s?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", s.user.id)
          .single();

        setRole(profile?.role ?? null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  if (!session) return <Login />;

  // Driver abre direto o app do entregador
  if (role === "driver") {
    return <DriverApp />;
  }

  // Admin usa rotas normais
  return (
    <RRoutes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/route-mapbox" element={<RouteMapbox />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </RRoutes>
  );
}