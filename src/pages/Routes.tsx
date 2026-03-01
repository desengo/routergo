// src/pages/Routes.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
};

type RouteStop = { lat: number; lng: number; label?: string; delivery_id?: string };

type RouteStatus = "ready" | "assigned" | "picked_up" | "in_progress" | "done" | string;

type RouteRow = {
  id: string;
  name: string | null;
  delivery_ids?: string[];
  stops?: RouteStop[];
  total_est_km: number | null;
  created_at?: string;

  // opcionais (podem não existir no seu schema ainda)
  status?: RouteStatus | null;
  paid_at?: string | null;
  finished_at?: string | null;
};

export default function Routes() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function getUser() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  }

  async function loadAll() {
    setLoading(true);

    const user = await getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // ---- Deliveries (base) ----
    const d = await supabase
      .from("deliveries")
      .select("id,client_name,order_id,address_text,lat,lng")
      .eq("user_id", user.id);

    if (d.error) {
      setLoading(false);
      alert("Erro ao buscar entregas: " + d.error.message);
      return;
    }

    setDeliveries((d.data || []) as any);

    // ---- Routes (tenta com colunas extras: status/paid_at/finished_at) ----
    const selectWithExtras =
      "id,name,delivery_ids,stops,total_est_km,created_at,status,paid_at,finished_at";

    const selectBase = "id,name,delivery_ids,stops,total_est_km,created_at";

    let r = await supabase
      .from("routes")
      .select(selectWithExtras)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // fallback se sua tabela ainda não tem status/paid_at/finished_at
    if (r.error && /column .* does not exist/i.test(r.error.message)) {
      r = await supabase
        .from("routes")
        .select(selectBase)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
    }

    setLoading(false);

    if (r.error) {
      alert("Erro ao buscar rotas: " + r.error.message);
      return;
    }

    // normaliza status default
    const normalized = (r.data || []).map((row: any) => ({
      ...row,
      status: row.status ?? "ready",
      paid_at: row.paid_at ?? null,
      finished_at: row.finished_at ?? null,
    }));

    setRoutes(normalized as RouteRow[]);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const byId = useMemo(() => new Map(deliveries.map((d) => [d.id, d] as const)), [deliveries]);

  function openMapbox(stops: Array<{ lat: number; lng: number; label: string }>) {
    sessionStorage.setItem("routergo_stops", JSON.stringify(stops));
    window.location.href = `/route-mapbox`;
  }

  function buildStopsFromRoute(route: RouteRow) {
    // se rota já tem stops salvos
    if (Array.isArray(route.stops) && route.stops.length) {
      return route.stops
        .map((s, idx) => ({
          lat: Number(s.lat),
          lng: Number(s.lng),
          label: s.label || `Parada ${idx + 1}`,
        }))
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    }

    // senão monta pelos delivery_ids
    const ids = Array.isArray(route.delivery_ids) ? route.delivery_ids : [];
    const list = ids.map((id) => byId.get(id)).filter(Boolean) as DeliveryRow[];

    return list
      .filter((d) => d.lat != null && d.lng != null)
      .map((d, idx) => ({
        lat: d.lat as number,
        lng: d.lng as number,
        label: `${idx + 1}. ${d.client_name} — ${d.order_id}`,
      }));
  }

  function isPaid(r: RouteRow) {
    return !!r.paid_at;
  }

  async function payRoute(routeId: string) {
    try {
      setLoading(true);

      // tenta marcar paid_at = agora (precisa existir a coluna)
      const { error } = await supabase
        .from("routes")
        .update({ paid_at: new Date().toISOString() } as any)
        .eq("id", routeId);

      if (error) {
        // se não existir paid_at, avisa o que falta
        if (/column .*paid_at.* does not exist/i.test(error.message)) {
          alert(
            "Sua tabela 'routes' não tem a coluna 'paid_at'.\n" +
              "Crie uma coluna paid_at (timestamp) para registrar pagamento."
          );
          return;
        }
        throw error;
      }

      await loadAll();
    } catch (e: any) {
      alert("Erro ao pagar rota: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  // ---- separação por status ----
  const groups = useMemo(() => {
    const novas: RouteRow[] = [];
    const andamento: RouteRow[] = [];
    const concluidas: RouteRow[] = [];

    for (const r of routes) {
      const s = (r.status || "ready").toLowerCase();

      if (s === "done") concluidas.push(r);
      else if (s === "in_progress" || s === "picked_up" || s === "assigned") andamento.push(r);
      else novas.push(r);
    }

    return { novas, andamento, concluidas };
  }, [routes]);

  function Section({
    title,
    subtitle,
    items,
  }: {
    title: string;
    subtitle?: string;
    items: RouteRow[];
  }) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row space">
          <div>
            <h3 style={{ margin: 0 }}>{title}</h3>
            {subtitle && <div className="muted" style={{ marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button className="ghost" onClick={loadAll}>
            {loading ? "..." : "Atualizar"}
          </button>
        </div>

        <div className="list" style={{ marginTop: 12 }}>
          {items.map((r) => {
            const stops = buildStopsFromRoute(r);
            const canOpen = stops.length >= 2;

            const notFinished = (r.status || "ready").toLowerCase() !== "done";
            const showPay = notFinished && !isPaid(r);

            return (
              <div key={r.id} className="item col">
                <div className="row space">
                  <b>{r.name || "Rota"}</b>
                  <span className="muted">~{r.total_est_km ?? "?"} km</span>
                </div>

                <ol style={{ marginTop: 8 }}>
                  {stops.map((s, idx) => (
                    <li key={idx}>{s.label}</li>
                  ))}
                </ol>

                <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button className="ghost" disabled={!canOpen} onClick={() => openMapbox(stops)}>
                    Ver rota
                  </button>

                  {showPay && (
                    <button className="primary" disabled={loading} onClick={() => payRoute(r.id)}>
                      Concluir
                    </button>
                  )}

                  {!showPay && isPaid(r) && (
                    <span className="muted">Pago ✅</span>
                  )}

                  {!canOpen && (
                    <span className="muted">Precisa de pelo menos 2 paradas com coordenadas.</span>
                  )}
                </div>
              </div>
            );
          })}

          {items.length === 0 && <p className="muted">Nada aqui ainda.</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Section
        title="Rotas novas"
        subtitle="Criadas e aguardando andamento."
        items={groups.novas}
      />

      <Section
        title="Rotas em andamento"
        subtitle="Já iniciadas/atribuídas, ainda não finalizadas."
        items={groups.andamento}
      />

      <Section
        title="Rotas concluídas"
        subtitle="Finalizadas."
        items={groups.concluidas}
      />
    </div>
  );
}