import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RouteMapbox from "./pages/RouteMapbox";

type Page = "dashboard" | "route-mapbox";

function getPage(): Page {
  const path = window.location.pathname;
  if (path === "/route-mapbox") return "route-mapbox";
  return "dashboard";
}

export default function App() {
  const [page, setPage] = useState<Page>(getPage());
  const [sessionChecked, setSessionChecked] = useState(false);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    const onPop = () => setPage(getPage());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLogged(!!data.session);
      setSessionChecked(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLogged(!!session);
      setSessionChecked(true);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!sessionChecked) return null;

  // Página do mapa pode ser aberta sem login (mas você pode exigir login se quiser)
  if (page === "route-mapbox") return <RouteMapbox />;

  if (!logged) return <Login />;

  return <Dashboard />;
}