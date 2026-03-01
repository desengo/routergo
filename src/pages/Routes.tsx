import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateRoutesMVP } from "../lib/routing";

type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  created_at?: string;
};

type RouteStop = { lat: number; lng: number; label?: string; delivery_id?: string };

type RouteRow = {
  id: string;
  name: string | null;
  status: "new" | "in_progress" | "done";
  delivery_ids?: string[];
  stops?: RouteStop[] | null;
  total_est_km: number | null;
  concluded_at?: string | null;
  concluded_by?: string | null; // "manual" | "auto"
  created_at?: string;
};

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function parseRouteNumber(name?: string | null) {
  if (!name) return null;
  const m = name.match(/rota\s*(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function nowIso() {
  return new Date().toISOString();
}

function isOlderThan24h(iso?: string | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t >= 24 * 60 * 60 * 1000;
}

function cleanText(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

// ✅ monta um texto completo pro stop (cliente + pedido + endereço)
function stopText(d: DeliveryRow) {
  const name = cleanText(d.client_name || "Cliente");
  const order = cleanText(d.order_id || "");
  const addr = cleanText(d.address_text || "");

  // exemplo: "José — 886 · Rua Daniel Ribeiro Calado, 235 - ..."
  const left = order ? `${name} — ${order}` : name;
  return addr ? `${left} · ${addr}` : left;
}

export default function Routes() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [maxStops, setMaxStops] = useState(5);
  const [radiusKm, setRadiusKm] = useState(1.2);

  async function loadAll() {
    setLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) return;

      const d = await supabase
        .from("deliveries")
        // ✅ garante que address_text vem
        .select("id,client_name,order_id,address_text,lat,lng,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (d.error) throw d.error;

      const r = await supabase
        .from("routes")
        .select("id,name,status,delivery_ids,stops,total_est_km,concluded_at,concluded_by,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (r.error) throw r.error;

      setDeliveries((d.data || []) as any);
      setRoutes((r.data || []) as any);
    } catch (e: any) {
      alert("Erro ao buscar: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  // Auto-concluir rotas com +24h que ainda não foram concluídas
  async function autoConcludeOldRoutes(list: RouteRow[]) {
    const userId = await getUserId();
    if (!userId) return;

    const toAuto = list.filter((r) => r.status !== "done" && isOlderThan24h(r.created_at));
    if (!toAuto.length) return;

    const ids = toAuto.map((r) => r.id);
    const { error } = await supabase
      .from("routes")
      .update({ status: "done", concluded_by: "auto", concluded_at: nowIso() })
      .in("id", ids)
      .eq("user_id", userId);

    if (error) {
      console.warn("autoConclude error:", error.message);
      return;
    }

    await loadAll();
  }

  useEffect(() => {
    (async () => {
      await loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!routes.length) return;
    autoConcludeOldRoutes(routes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes.length]);

  const byId = useMemo(() => new Map(deliveries.map((d) => [d.id, d] as const)), [deliveries]);

  const usedDeliveryIds = useMemo(() => {
    const set = new Set<string>();
    routes.forEach((r) => (r.delivery_ids || []).forEach((id) => set.add(id)));
    return set;
  }, [routes]);

  function openMapbox(stops: Array<{ lat: number; lng: number; label: string }>) {
    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
    window.location.href = "/route-mapbox";
  }

  function buildStopsFromRoute(route: RouteRow) {
    // ✅ preferir stops salvos
    if (Array.isArray(route.stops) && route.stops.length) {
      return route.stops
        .map((s, idx) => ({
          lat: Number(s.lat),
          lng: Number(s.lng),
          label: s.label || `Parada ${idx + 1}`,
        }))
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    }

    // fallback: monta pelos delivery_ids com address_text
    const ids = Array.isArray(route.delivery_ids) ? route.delivery_ids : [];
    const list = ids.map((id) => byId.get(id)).filter(Boolean) as DeliveryRow[];

    return list
      .filter((d) => d.lat != null && d.lng != null)
      .map((d, idx) => ({
        lat: d.lat as number,
        lng: d.lng as number,
        // ✅ inclui endereço no label
        label: `${idx + 1}. ${stopText(d)}`,
      }));
  }

  async function concluirRota(routeId: string) {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await supabase
        .from("routes")
        .update({ status: "done", concluded_by: "manual", concluded_at: nowIso() })
        .eq("id", routeId)
        .eq("user_id", userId);

      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      alert("Erro ao concluir rota: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function marcarEmAndamento(routeId: string) {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await supabase
        .from("routes")
        .update({ status: "in_progress" })
        .eq("id", routeId)
        .eq("user_id", userId);

      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      alert("Erro ao mover para andamento: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function excluirRota(routeId: string) {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await supabase
        .from("routes")
        .delete()
        .eq("id", routeId)
        .eq("user_id", userId);

      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      alert("Erro ao excluir rota: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function gerarRotas() {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) throw new Error("Você precisa estar logado.");

      const available = deliveries.filter(
        (d) => d.lat != null && d.lng != null && !usedDeliveryIds.has(d.id)
      );

      if (available.length < 2) {
        alert("Precisa de pelo menos 2 entregas com coordenadas (ainda não roteadas).");
        return;
      }

      // ✅ stops agora já carregam label com endereço
      const stops = available.map((d) => ({
        delivery_id: d.id,
        lat: d.lat as number,
        lng: d.lng as number,
        label: stopText(d),
      }));

      const groups = generateRoutesMVP(stops, { maxStops, radiusKm });

      const maxExisting = routes
        .map((r) => parseRouteNumber(r.name))
        .filter((n): n is number => typeof n === "number")
        .reduce((a, b) => Math.max(a, b), 0);

      let next = maxExisting + 1;

      const inserts = groups.map((g) => {
        const delivery_ids = g.stops.map((s) => s.delivery_id!).filter(Boolean);

        return {
          user_id: userId,
          name: `Rota ${next++}`,
          status: "new",
          delivery_ids,
          // ✅ salva stops com label completo (com endereço)
          stops: g.stops.map((s, idx) => ({
            delivery_id: s.delivery_id,
            lat: s.lat,
            lng: s.lng,
            label: `${idx + 1}. ${s.label || `Parada ${idx + 1}`}`,
          })),
          total_est_km: Number(g.totalKm.toFixed(3)),
        };
      });

      const { error } = await supabase.from("routes").insert(inserts);
      if (error) throw error;

      await loadAll();
    } catch (e: any) {
      alert("Erro ao gerar rotas: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  const rotasNovas = routes.filter((r) => r.status === "new");
  const rotasAndamento = routes.filter((r) => r.status === "in_progress");
  const rotasConcluidas = routes.filter((r) => r.status === "done");

  function RouteCard({ r }: { r: RouteRow }) {
    const stops = buildStopsFromRoute(r);
    const canOpen = stops.length >= 2;
    const isAuto = r.concluded_by === "auto";

    return (
      <div
        className="item col"
        style={
          r.status === "done"
            ? {
                border: isAuto
                  ? "1px solid rgba(255,210,0,.35)"
                  : "1px solid rgba(24,255,109,.25)",
                background: isAuto ? "rgba(255,210,0,.06)" : undefined,
              }
            : undefined
        }
      >
        <div className="row space">
          <b>{r.name || "Rota"}</b>
          <span className="muted">~{r.total_est_km ?? "?"} km</span>
        </div>

        {r.status === "done" && (
          <div className="muted" style={{ marginTop: 6 }}>
            {isAuto ? "Concluída automaticamente (24h)" : "Concluída manualmente"}
          </div>
        )}

        <ol style={{ marginTop: 8 }}>
          {stops.map((s, idx) => (
            <li key={idx}>{s.label}</li>
          ))}
        </ol>

        <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button className="ghost" disabled={!canOpen} onClick={() => openMapbox(stops)}>
            Ver rota
          </button>

          {r.status !== "done" && (
            <>
              <button className="ghost" disabled={loading} onClick={() => marcarEmAndamento(r.id)}>
                Em andamento
              </button>

              <button className="primary" disabled={loading} onClick={() => concluirRota(r.id)}>
                Concluir
              </button>
            </>
          )}

          <button className="ghost" disabled={loading} onClick={() => excluirRota(r.id)}>
            Excluir
          </button>

          {!canOpen && (
            <span className="muted">Precisa de pelo menos 2 paradas com coordenadas.</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Rotas</h3>
        <button className="ghost" onClick={loadAll}>
          {loading ? "..." : "Atualizar"}
        </button>
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label>Máx paradas por rota</label>
          <input
            value={maxStops}
            onChange={(e) => setMaxStops(Number(e.target.value || 5))}
            type="number"
            min={2}
          />
        </div>

        <div style={{ flex: 1, minWidth: 140 }}>
          <label>Raio de agrupamento (km)</label>
          <input
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value || 1.2))}
            type="number"
            step="0.1"
            min={0.2}
          />
        </div>

        <div style={{ alignSelf: "end" }}>
          <button className="primary" onClick={gerarRotas} disabled={loading}>
            Gerar rotas
          </button>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 10 }}>
        * Rotas novas vão para Concluídas automaticamente após 24h (marcadas como “auto”).
      </p>

      {/* ROTAS NOVAS */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row space">
          <b>Rotas novas</b>
          <span className="muted">Criadas e aguardando andamento.</span>
        </div>
        <div className="list" style={{ marginTop: 10 }}>
          {rotasNovas.map((r) => (
            <RouteCard key={r.id} r={r} />
          ))}
          {rotasNovas.length === 0 && <p className="muted">Nenhuma rota aqui.</p>}
        </div>
      </div>

      {/* EM ANDAMENTO */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row space">
          <b>Em andamento</b>
          <span className="muted">Rotas ativas.</span>
        </div>
        <div className="list" style={{ marginTop: 10 }}>
          {rotasAndamento.map((r) => (
            <RouteCard key={r.id} r={r} />
          ))}
          {rotasAndamento.length === 0 && <p className="muted">Nenhuma rota aqui.</p>}
        </div>
      </div>

      {/* CONCLUÍDAS */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row space">
          <b>Concluídas</b>
          <span className="muted">Manual (verde) · Automática (amarelo).</span>
        </div>
        <div className="list" style={{ marginTop: 10 }}>
          {rotasConcluidas.map((r) => (
            <RouteCard key={r.id} r={r} />
          ))}
          {rotasConcluidas.length === 0 && <p className="muted">Nenhuma rota aqui.</p>}
        </div>
      </div>
    </div>
  );
}