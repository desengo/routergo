import React, { useEffect, useState } from "react";
import { Routes as RRoutes, Route, Navigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RouteMapbox from "./pages/RouteMapbox";
import DriverApp from "./pages/DriverApp";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  // Sem sessão: login
  if (!session) return <Login />;

  // ✅ Se estiver logado e abrir em /driver (ou /route-mapbox) por engano,
  // empurra pro Dashboard ("/") pra você sempre enxergar o painel.
  if (location.pathname !== "/" && location.pathname !== "/route-mapbox" && location.pathname !== "/driver") {
    return <Navigate to="/" replace />;
  }

  return (
    <RRoutes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/route-mapbox" element={<RouteMapbox />} />
      <Route path="/driver" element={<DriverApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </RRoutes>
  );
}