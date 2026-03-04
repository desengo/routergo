import React, { useEffect, useState } from "react";
import { Routes as RRoutes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RouteMapbox from "./pages/RouteMapbox";
import DriverApp from "./pages/DriverApp";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!mounted) return;
        setSession(data.session);
      } catch (e: any) {
        if (!mounted) return;
        setBootError(e?.message || String(e));
        setSession(null);
      } finally {
        if (!mounted) return;
        setReady(true);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ✅ Nunca mais retorna null (pra não ficar “tela vazia”)
  if (!ready) {
    return (
      <div className="wrap">
        <div className="card" style={{ marginTop: 60 }}>
          <b>Carregando…</b>
          <div className="muted" style={{ marginTop: 8 }}>
            Inicializando sessão…
          </div>
        </div>
      </div>
    );
  }

  // ✅ Se deu erro no boot, mostra o erro (em vez de ficar vazio)
  if (bootError) {
    return (
      <div className="wrap">
        <div className="card" style={{ marginTop: 60 }}>
          <b>Erro ao iniciar</b>
          <div className="muted" style={{ marginTop: 8 }}>
            {bootError}
          </div>

          <div className="muted" style={{ marginTop: 8 }}>
            Dica: confira VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Netlify.
          </div>
        </div>
      </div>
    );
  }

  if (!session) return <Login />;

  return (
    <RRoutes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/route-mapbox" element={<RouteMapbox />} />
      <Route path="/driver" element={<DriverApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </RRoutes>
  );
}