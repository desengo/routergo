import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type DriverStatus = "offline" | "available" | "busy";

type ProfileRow = {
  id: string;
  role: "admin" | "driver" | string | null;
  display_name: string | null;
  vehicle_plate: string | null;
  driver_status: DriverStatus | null;
  queue_position: number | null;
  company_owner_id: string | null;
  created_at?: string | null;
};

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function cleanText(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function statusLabel(s: DriverStatus | null | undefined) {
  if (s === "available") return "🟢 Disponível";
  if (s === "busy") return "🔵 Em rota";
  return "⚫ Offline";
}

export default function DriversAdmin() {
  const [drivers, setDrivers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPlate, setEditPlate] = useState("");

  const totalOnline = useMemo(
    () => drivers.filter((d) => d.driver_status === "available" || d.driver_status === "busy").length,
    [drivers]
  );

  const orderedDrivers = useMemo(() => {
    const list = [...drivers];
    // Ordena: disponíveis por fila primeiro, depois busy, depois offline
    const weight = (d: ProfileRow) => {
      if (d.driver_status === "available") return 0;
      if (d.driver_status === "busy") return 1;
      return 2;
    };
    list.sort((a, b) => {
      const wa = weight(a);
      const wb = weight(b);
      if (wa !== wb) return wa - wb;

      const qa = a.queue_position ?? 999999;
      const qb = b.queue_position ?? 999999;
      if (qa !== qb) return qa - qb;

      return (a.display_name || "").localeCompare(b.display_name || "");
    });
    return list;
  }, [drivers]);

  async function loadDrivers() {
    setLoading(true);
    try {
      const adminId = await getUserId();
      if (!adminId) return;

      // puxa somente drivers vinculados a este admin
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,role,display_name,vehicle_plate,driver_status,queue_position,company_owner_id,created_at"
        )
        .eq("company_owner_id", adminId)
        .order("queue_position", { ascending: true, nullsFirst: false });

      if (error) throw error;

      const onlyDrivers = (data || []).filter((p: any) => (p.role || "driver") !== "admin");
      setDrivers(onlyDrivers as ProfileRow[]);
    } catch (e: any) {
      alert("Erro ao carregar entregadores: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDrivers();
  }, []);

  function openEdit(p: ProfileRow) {
    setEditing(p);
    setEditName(p.display_name || "");
    setEditPlate(p.vehicle_plate || "");
  }

  function closeEdit() {
    setEditing(null);
    setEditName("");
    setEditPlate("");
  }

  async function saveEdit() {
    if (!editing) return;

    setLoading(true);
    try {
      const adminId = await getUserId();
      if (!adminId) return;

      const payload = {
        display_name: cleanText(editName) || null,
        vehicle_plate: cleanText(editPlate) || null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", editing.id)
        .eq("company_owner_id", adminId);

      if (error) throw error;

      closeEdit();
      await loadDrivers();
    } catch (e: any) {
      alert("Erro ao salvar: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function removeFromQueue(p: ProfileRow) {
    setLoading(true);
    try {
      const adminId = await getUserId();
      if (!adminId) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          driver_status: "offline",
          queue_position: null,
        })
        .eq("id", p.id)
        .eq("company_owner_id", adminId);

      if (error) throw error;

      await loadDrivers();
    } catch (e: any) {
      alert("Erro ao remover da fila: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function unlinkDriver(p: ProfileRow) {
    const ok = window.confirm(
      `Desvincular "${p.display_name || p.id}" da sua empresa?\n\nEle não aparecerá mais no seu painel.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const adminId = await getUserId();
      if (!adminId) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          company_owner_id: null,
          driver_status: "offline",
          queue_position: null,
        })
        .eq("id", p.id)
        .eq("company_owner_id", adminId);

      if (error) throw error;

      await loadDrivers();
    } catch (e: any) {
      alert("Erro ao desvincular: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <h2>Entregadores</h2>
        <button className="ghost" onClick={() => (window.location.href = "/")}>
          Voltar
        </button>
      </div>

      <div className="card">
        <div className="row space">
          <b>Resumo</b>
          <button className="ghost" onClick={loadDrivers} disabled={loading}>
            {loading ? "..." : "Atualizar"}
          </button>
        </div>

        <div className="muted" style={{ marginTop: 8 }}>
          Entregadores vinculados: <b>{drivers.length}</b> · Online: <b>{totalOnline}</b>
          <br />
          * Online = disponível ou em rota.
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row space">
          <b>Lista</b>
          <span className="muted">Ordenado por fila/status</span>
        </div>

        <div className="list" style={{ marginTop: 10 }}>
          {orderedDrivers.map((d) => (
            <div key={d.id} className="item col">
              <div className="row space">
                <b>{d.display_name || "Sem nome"}</b>
                <span className="muted">{statusLabel(d.driver_status)}</span>
              </div>

              <div className="muted" style={{ marginTop: 6 }}>
                Placa: <b>{d.vehicle_plate || "—"}</b>
                <br />
                Fila: <b>{d.queue_position ?? "—"}</b>
              </div>

              <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button className="ghost" onClick={() => openEdit(d)} disabled={loading}>
                  Editar nome/placa
                </button>

                <button
                  className="ghost"
                  onClick={() => removeFromQueue(d)}
                  disabled={loading || d.driver_status !== "available"}
                >
                  Remover da fila
                </button>

                <button className="ghost" onClick={() => unlinkDriver(d)} disabled={loading}>
                  Desvincular
                </button>
              </div>

              {d.driver_status !== "available" && (
                <div className="muted" style={{ marginTop: 10 }}>
                  * “Remover da fila” só fica ativo quando o entregador está <b>disponível</b>.
                </div>
              )}
            </div>
          ))}

          {orderedDrivers.length === 0 && (
            <p className="muted">
              Nenhum entregador vinculado ainda.
              <br />
              * Para aparecer aqui, o profile do entregador precisa ter <b>company_owner_id</b> =
              seu user_id (admin).
            </p>
          )}
        </div>
      </div>

      {/* Editor simples (sem mudar CSS) */}
      {editing && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row space">
            <b>Editar entregador</b>
            <button className="ghost" onClick={closeEdit} disabled={loading}>
              Fechar
            </button>
          </div>

          <label>Nome</label>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} />

          <label>Placa</label>
          <input value={editPlate} onChange={(e) => setEditPlate(e.target.value)} />

          <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button className="primary" onClick={saveEdit} disabled={loading}>
              Salvar
            </button>
            <button className="ghost" onClick={closeEdit} disabled={loading}>
              Cancelar
            </button>
          </div>

          <p className="muted" style={{ marginTop: 10 }}>
            * Isso não altera a tela do entregador — só atualiza dados do profile.
          </p>
        </div>
      )}
    </div>
  );
}