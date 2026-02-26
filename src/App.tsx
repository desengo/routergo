import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RouteMapbox from "./pages/RouteMapbox";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  // Não logado -> login
  if (!session) return <Login />;

  // Logado -> rotas do app
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/route-mapbox" element={<RouteMapbox />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}