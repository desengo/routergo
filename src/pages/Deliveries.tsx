import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  priority: "normal" | "urgente";
  lat: number | null;
  lng: number | null;
};

export default function Deliveries() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [clientName, setClientName] = useState("");
  const [orderId, setOrderId] = useState("");
  const [addressText, setAddressText] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgente">("normal");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  async function load() {
    setLoading(true);

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("deliveries")
      .select("id,client_name,order_id,address_text,priority,lat,lng")
      .eq("user_id", user.id) // ✅ GARANTIA user_id
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) alert("Erro ao buscar entregas: " + error.message);
    else setItems((data || []) as any);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!clientName.trim() || !orderId.trim() || !addressText.trim()) {
      return alert("Preencha Cliente, Pedido e Endereço.");
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { error } = await supabase.from("deliveries").insert({
      user_id: user.id, // ✅ GARANTIA user_id
      client_name: clientName.trim(),
      order_id: orderId.trim(),
      address_text: addressText.trim(),
      priority,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null
    });

    if (error) return alert("Erro ao salvar entrega: " + error.message);

    setClientName("");
    setOrderId("");
    setAddressText("");
    setPriority("normal");
    setLat("");
    setLng("");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir entrega?")) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { error } = await supabase
      .from("deliveries")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id); // ✅ GARANTIA user_id

    if (error) alert("Erro ao excluir entrega: " + error.message);
    else load();
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Entregas</h3>
        <button className="ghost" onClick={load}>
          {loading ? "..." : "Atualizar"}
        </button>
      </div>

      <div className="grid">
        <label>Cliente</label>
        <input value={clientName} onChange={(e) => setClientName(e.target.value)} />

        <label>Pedido/ID</label>
        <input value={orderId} onChange={(e) => setOrderId(e.target.value)} />

        <label>Endereço</label>
        <textarea value={addressText} onChange={(e) => setAddressText(e.target.value)} />

        <label>Prioridade</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
          <option value="normal">normal</option>
          <option value="urgente">urgente</option>
        </select>

        <label>Latitude</label>
        <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-23.55" />

        <label>Longitude</label>
        <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-46.63" />
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={add}>Salvar entrega</button>
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        {items.map((d) => (
          <div key={d.id} className="item col">
            <div className="row space">
              <b>
                {d.priority === "urgente" ? "🚨 " : ""}
                {d.client_name} — {d.order_id}
              </b>
              <button className="ghost" onClick={() => remove(d.id)}>
                Excluir
              </button>
            </div>
            <div className="muted">{d.address_text}</div>
            <div className="muted">
              lat/lng: {d.lat ?? "—"} , {d.lng ?? "—"}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="muted">Nenhuma entrega ainda.</p>}
      </div>
    </div>
  );
}