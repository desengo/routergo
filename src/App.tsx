import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RouteMapbox from "./pages/RouteMapbox";
import DriverApp from "./pages/DriverApp";
import DriversAdmin from "./pages/DriversAdmin";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      const s = data.session;

      setSession(s);

      if (s?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", s.user.id)
          .single();

        setRole(profile?.role ?? null);
      }

      setReady(true);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);

      if (s?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", s.user.id)
          .single();

        setRole(profile?.role ?? null);
      } else {
        setRole(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <Routes>
      {!session && (
        <>
          <Route path="*" element={<Login />} />
        </>
      )}

      {session && role === "driver" && (
        <>
          <Route path="/" element={<DriverApp />} />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      )}

      {session && role !== "driver" && (
        <>
          <Route path="/" element={<Dashboard />} />
          <Route path="/drivers" element={<DriversAdmin />} />
          <Route path="/route-mapbox" element={<RouteMapbox />} />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      )}
    </Routes>
  );
}