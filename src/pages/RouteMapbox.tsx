import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Stop = { lat: number; lng: number; label?: string; delivery_id?: string };

type StopStateStatus = "pending" | "delivered" | "failed";

type StopState = {
  status: StopStateStatus;
  delivered_at?: string | null;
  failed_at?: string | null;
  fail_reason?: "Morador não saiu" | "Morador não pagou" | "Outro" | null;
  financial_pending?: boolean | null;
};

type RouteRow = {
  id: string;
  name: string | null;
  status: "new" | "accepted" | "in_progress" | "done";
  stops: Stop[] | null;
  stops_state: StopState[] | null; // ✅ NOVO (jsonb)
  total_est_km: number | null;
  assigned_driver_id: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

async function getMe() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
}

function safeParseStopsFromSession(): Stop[] {
  try {
    const raw = sessionStorage.getItem("routergo_stops");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((s: any) => ({
        lat: Number(s.lat),
        lng: Number(s.lng),
        label: typeof s.label === "string" ? s.label : undefined,
        delivery_id: typeof s.delivery_id === "string" ? s.delivery_id : undefined,
      }))
      .filter((s: any) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  } catch {
    return [];
  }
}

function normalizeStopState(count: number, incoming?: StopState[] | null): StopState[] {
  const base = Array.isArray(incoming) ? [...incoming] : [];
  while (base.length < count) base.push({ status: "pending" });
  if (base.length > count) base.length = count;

  // garante schema mínimo
  return base.map((s) => ({
    status: (s?.status as StopStateStatus) || "pending",
    delivered_at: s?.delivered_at ?? null,
    failed_at: s?.failed_at ?? null,
    fail_reason: (s?.fail_reason as any) ?? null,
    financial_pending: s?.financial_pending ?? null,
  }));
}

function firstPendingIndex(states: StopState[]) {
  return states.findIndex((s) => s.status === "pending");
}

function isDone(states: StopState[]) {
  return states.every((s) => s.status !== "pending");
}

export default function RouteMapbox() {
  const nav = useNavigate();
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);

  const [route, setRoute] = useState<RouteRow | null>(null);

  // paradas para desenhar e listar
  const stops: Stop[] = useMemo(() => safeParseStopsFromSession(), []);

  // estados de cada parada (ordem obrigatória)
  const [states, setStates] = useState<StopState[]>(() => normalizeStopState(stops.length, null));

  const token = (import.meta as any).env.VITE_MAPBOX_TOKEN as string | undefined;

  const currentIdx = useMemo(() => {
    const idx = firstPendingIndex(states);
    return idx >= 0 ? idx : states.length; // se acabou, fica "além"
  }, [states]);

  const progressText = useMemo(() => {
    const doneCount = states.filter((s) => s.status !== "pending").length;
    return `${doneCount}/${states.length}`;
  }, [states]);

  async function loadMyActiveRouteAndSyncState() {
    setLoading(true);
    try {
      const me = await getMe();
      if (!me) {
        setError("Você precisa estar logado.");
        return;
      }

      // pega rota atribuída a mim, mais recente
      const r = await supabase
        .from("routes")
        .select("id,name,status,stops,stops_state,total_est_km,assigned_driver_id")
        .eq("assigned_driver_id", me.id)
        .in("status", ["accepted", "in_progress", "new"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (r.error) throw r.error;

      const rr = (r.data?.[0] as any) as RouteRow | undefined;
      if (!rr) {
        setRoute(null);
        // ainda dá pra mostrar mapa, mas sem persistência
        setStates(normalizeStopState(stops.length, null));
        setError(null);
        return;
      }

      setRoute(rr);

      const nextStates = normalizeStopState(stops.length, rr.stops_state);

      // se estava vazio ou desajustado, grava no banco
      const needsWrite =
        !Array.isArray(rr.stops_state) ||
        rr.stops_state.length !== stops.length ||
        JSON.stringify(rr.stops_state) !== JSON.stringify(nextStates);

      if (needsWrite) {
        const up = await supabase
          .from("routes")
          .update({ stops_state: nextStates })
          .eq("id", rr.id);

        // se falhar, não trava UX
        if (!up.error) {
          // ok
        }
      }

      setStates(nextStates);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function setRouteInProgressIfNeeded() {
    if (!route) return;
    if (route.status === "in_progress") return;

    try {
      await supabase.from("routes").update({ status: "in_progress" }).eq("id", route.id);
      setRoute((r) => (r ? { ...r, status: "in_progress" } : r));
    } catch {
      // silêncio
    }
  }

  async function saveStates(next: StopState[]) {
    setStates(next);

    if (!route?.id) return;
    // persiste stops_state na rota
    const { error } = await supabase.from("routes").update({ stops_state: next }).eq("id", route.id);
    if (error) {
      // não bloqueia o fluxo, mas avisa
      setError("Não consegui salvar o progresso. Verifique conexão/permissões.");
    }
  }

  async function markDelivered() {
    if (currentIdx >= states.length) return;
    setLoading(true);
    try {
      await setRouteInProgressIfNeeded();

      const next = [...states];
      next[currentIdx] = {
        status: "delivered",
        delivered_at: nowIso(),
        failed_at: null,
        fail_reason: null,
        financial_pending: null,
      };
      await saveStates(next);
    } finally {
      setLoading(false);
    }
  }

  async function markFailed(reason: "Morador não saiu" | "Morador não pagou" | "Outro") {
    if (currentIdx >= states.length) return;
    setLoading(true);
    try {
      await setRouteInProgressIfNeeded();

      const next = [...states];
      next[currentIdx] = {
        status: "failed",
        delivered_at: null,
        failed_at: nowIso(),
        fail_reason: reason,
        financial_pending: reason === "Morador não pagou" ? true : false,
      };
      await saveStates(next);
    } finally {
      setLoading(false);
    }
  }

  async function finishRoute() {
    if (!route?.id) return;
    setLoading(true);
    try {
      const me = await getMe();
      if (!me) return;

      // conclui rota
      const u1 = await supabase
        .from("routes")
        .update({ status: "done", finished_at: nowIso() })
        .eq("id", route.id);

      if (u1.error) throw u1.error;

      // volta para fila (available)
      const u2 = await supabase
        .from("profiles")
        .update({ driver_status: "available" })
        .eq("id", me.id);

      // se profiles não existir/permissão, não quebra a conclusão da rota
      if (u2.error) {
        // silêncio
      }

      // limpa session para não reabrir rota antiga
      sessionStorage.removeItem("routergo_stops");

      nav("/driver");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // carregar rota ativa + sincronizar estado
  useEffect(() => {
    loadMyActiveRouteAndSyncState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // inicializa mapa + desenha rota
  useEffect(() => {
    if (!token) {
      setError("VITE_MAPBOX_TOKEN não configurado.");
      return;
    }
    mapboxgl.accessToken = token;

    if (!mapDivRef.current) return;

    const center = stops.length ? [stops[0].lng, stops[0].lat] : [-46.6333, -23.5505];

    const map = new mapboxgl.Map({
      container: mapDivRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: center as any,
      zoom: stops.length ? 13 : 10,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", async () => {
      // markers numerados
      stops.forEach((s, idx) => {
        const el = document.createElement("div");
        el.style.width = "34px";
        el.style.height = "34px";
        el.style.borderRadius = "999px";
        el.style.display = "grid";
        el.style.placeItems = "center";
        el.style.background = "#18ff6d";
        el.style.boxShadow = "0 0 18px rgba(24,255,109,.6)";
        el.style.color = "#07140c";
        el.style.fontWeight = "900";
        el.textContent = String(idx + 1);

        new mapboxgl.Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setText(s.label || `Parada ${idx + 1}`))
          .addTo(map);
      });

      if (stops.length < 2) {
        setError("Precisa de pelo menos 2 paradas (lat/lng) para desenhar a rota.");
        return;
      }

      try {
        const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
        const url =
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
          `?geometries=geojson&overview=full&steps=false&access_token=${token}`;

        const res = await fetch(url);
        const json = await res.json();

        if (!json?.routes?.[0]?.geometry) {
          setError("Não consegui calcular a rota no Mapbox.");
          return;
        }

        const route0 = json.routes[0];
        setDistanceKm(route0.distance ? route0.distance / 1000 : null);
        setDurationMin(route0.duration ? route0.duration / 60 : null);

        const geo = { type: "Feature", properties: {}, geometry: route0.geometry };

        if (!map.getSource("route")) {
          map.addSource("route", { type: "geojson", data: geo as any });
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-width": 6, "line-color": "#2f7bff", "line-opacity": 0.9 },
          });
        }

        const bounds = new mapboxgl.LngLatBounds();
        stops.forEach((s) => bounds.extend([s.lng, s.lat]));
        map.fitBounds(bounds, { padding: 60, duration: 600 });

        setError(null);
      } catch {
        setError("Erro ao calcular rota.");
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, stops]);

  const canFinish = useMemo(() => states.length > 0 && isDone(states), [states]);

  function statusChip(idx: number) {
    const s = states[idx];
    if (!s) return <span className="chip">⏳ Pendente</span>;
    if (s.status === "delivered") return <span className="chip green">✅ Entregue</span>;
    if (s.status === "failed") return <span className="chip yellow">❌ Falha</span>;
    return <span className="chip">⏳ Pendente</span>;
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <h2>{route?.name || "Rota no Mapa"}</h2>
        <button className="ghost" onClick={() => nav("/driver")}>
          Voltar
        </button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        {error ? (
          <>
            <b>{error}</b>
            <div className="muted" style={{ marginTop: 6 }}>
              Paradas: {stops.length} · Progresso: {progressText}
            </div>
          </>
        ) : (
          <>
            <b>Execução da rota ✅</b>
            <div className="muted" style={{ marginTop: 6 }}>
              Distância ~ {distanceKm ? distanceKm.toFixed(1) : "?"} km · Duração ~{" "}
              {durationMin ? Math.round(durationMin) : "?"} min · Paradas: {stops.length} · Progresso:{" "}
              {progressText}
            </div>
          </>
        )}
        <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button className="ghost" onClick={loadMyActiveRouteAndSyncState} disabled={loading}>
            {loading ? "..." : "Sincronizar"}
          </button>

          {canFinish && (
            <button className="primary" onClick={finishRoute} disabled={loading}>
              Concluir rota
            </button>
          )}
        </div>
      </div>

      {/* ✅ Lista de paradas + ações (ordem obrigatória) */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row space">
          <b>Paradas (ordem obrigatória)</b>
          <span className="muted">
            Atual:{" "}
            <b>
              {currentIdx < stops.length ? `${currentIdx + 1}/${stops.length}` : "finalizada"}
            </b>
          </span>
        </div>

        <div className="list" style={{ marginTop: 10 }}>
          {stops.map((s, idx) => {
            const locked = idx !== currentIdx && states[idx]?.status === "pending";
            const isCurrent = idx === currentIdx;

            return (
              <div
                key={idx}
                className="item col"
                style={
                  isCurrent
                    ? { border: "1px solid rgba(47,123,255,0.40)", boxShadow: "0 0 22px rgba(47,123,255,0.22)" }
                    : locked
                    ? { opacity: 0.65 }
                    : undefined
                }
              >
                <div className="row space" style={{ alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900 }}>
                      {idx + 1}. {s.label || `Parada ${idx + 1}`}
                    </div>
                    {locked && <div className="muted" style={{ marginTop: 6 }}>🔒 Bloqueado (ordem)</div>}
                    {states[idx]?.status === "failed" && (
                      <div className="muted" style={{ marginTop: 6 }}>
                        Motivo: <b>{states[idx]?.fail_reason || "—"}</b>
                        {states[idx]?.financial_pending ? " · 💰 Pendência" : ""}
                      </div>
                    )}
                  </div>

                  {statusChip(idx)}
                </div>

                {/* Ações só na parada atual e pendente */}
                {isCurrent && states[idx]?.status === "pending" && (
                  <>
                    <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                      <button className="primary" onClick={markDelivered} disabled={loading}>
                        Marcar entregue ✅
                      </button>

                      <button
                        className="ghost"
                        onClick={() => markFailed("Morador não saiu")}
                        disabled={loading}
                      >
                        Falha: Morador não saiu
                      </button>

                      <button
                        className="ghost"
                        onClick={() => markFailed("Morador não pagou")}
                        disabled={loading}
                      >
                        Falha: Morador não pagou
                      </button>

                      <button className="ghost" onClick={() => markFailed("Outro")} disabled={loading}>
                        Falha: Outro
                      </button>
                    </div>

                    <div className="muted" style={{ marginTop: 10 }}>
                      * Sem campo de texto para falha (motivos rápidos).
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {stops.length === 0 && <p className="muted">Nenhuma parada carregada.</p>}
        </div>
      </div>

      {/* ✅ Mapa (mantém seu visual atual) */}
      <div
        ref={mapDivRef}
        style={{
          height: "65vh",
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid rgba(24,255,109,.25)",
        }}
      />
    </div>
  );
}