import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  cep: string | null;
  number: string | null;
  address_text: string;
  lat: number | null;
  lng: number | null;
  created_at?: string;
};

type ViaCep = {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
};

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function normCep(v: string) {
  return (v || "").replace(/\D/g, "").slice(0, 8);
}

async function buscarCep(cep: string): Promise<ViaCep> {
  const clean = normCep(cep);
  const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  const j = await r.json();
  if (j?.erro) throw new Error("CEP não encontrado.");
  return j as ViaCep;
}

async function geocodeMapbox(addressText: string) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  if (!token) throw new Error("VITE_MAPBOX_TOKEN não configurado.");

  const q = encodeURIComponent(addressText);
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json` +
    `?language=pt&limit=1&country=BR&access_token=${encodeURIComponent(token)}`;

  const r = await fetch(url);
  const j = await r.json();

  const feat = j?.features?.[0];
  const center = feat?.center;
  if (!center || center.length < 2) throw new Error("Não encontrei coordenadas para esse endereço.");

  return { lng: Number(center[0]), lat: Number(center[1]) };
}

export default function Deliveries() {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [clientName, setClientName] = useState("");
  const [orderId, setOrderId] = useState("");
  const [cep, setCep] = useState("");
  const [number, setNumber] = useState(""); // pode ficar vazio

  const cepOk = useMemo(() => normCep(cep).length === 8, [cep]);

  async function load() {
    const uid = await getUserId();
    if (!uid) return;

    setLoading(true);
    const q = await supabase
      .from("deliveries")
      .select("id,client_name,order_id,cep,number,address_text,lat,lng,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setLoading(false);

    if (q.error) alert("Erro ao buscar entregas: " + q.error.message);
    setRows((q.data || []) as any);
  }

  useEffect(() => {
    load();
  }, []);

  async function salvar() {
    const uid = await getUserId();
    if (!uid) return;

    if (!clientName.trim()) return alert("Digite o cliente.");
    if (!orderId.trim()) return alert("Digite o pedido.");
    if (!cepOk) return alert("Digite um CEP válido (8 dígitos).");

    setLoading(true);

    try {
      // 1) ViaCEP
      const dados = await buscarCep(cep);

      if (!dados.logradouro) {
        // CEP genérico
        throw new Error("Esse CEP não possui logradouro. Tente outro CEP ou digite endereço manualmente.");
      }

      // 2) Montar endereço (número é opcional)
      const num = number.trim();
      const enderecoComNumero =
        `${dados.logradouro}, ${num || "s/n"} - ${dados.bairro}, ${dados.localidade} - ${dados.uf}, Brasil`;

      // 3) Geocode (tenta com número; se falhar, tenta sem número)
      let coords: { lat: number; lng: number } | null = null;

      try {
        coords = await geocodeMapbox(enderecoComNumero);
      } catch {
        const enderecoSemNumero =
          `${dados.logradouro} - ${dados.bairro}, ${dados.localidade} - ${dados.uf}, Brasil`;
        coords = await geocodeMapbox(enderecoSemNumero);
      }

      // 4) Salvar
      const ins = await supabase.from("deliveries").insert({
        user_id: uid,
        client_name: clientName.trim(),
        order_id: orderId.trim(),
        cep: normCep(cep),
        number: num || null,
        address_text: enderecoComNumero,
        lat: coords.lat,
        lng: coords.lng,
      });

      if (ins.error) throw ins.error;

      setClientName("");
      setOrderId("");
      setCep("");
      setNumber("");

      await load();
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar entrega.");
    } finally {
      setLoading(false);
    }
  }

  async function excluir(id: string) {
    const uid = await getUserId();
    if (!uid) return;
    if (!confirm("Excluir entrega?")) return;

    setLoading(true);
    const del = await supabase.from("deliveries").delete().eq("id", id).eq("user_id", uid);
    setLoading(false);

    if (del.error) alert("Erro ao excluir: " + del.error.message);
    await load();
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Entregas</h3>
        <button className="ghost" onClick={load}>
          {loading ? "..." : "Atualizar"}
        </button>
      </div>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div>
          <label className="muted">Cliente</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div>
          <label className="muted">Pedido</label>
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} />
        </div>
        <div>
          <label className="muted">CEP</label>
          <input value={cep} onChange={(e) => setCep(normCep(e.target.value))} placeholder="ex: 04821450" />
        </div>
        <div>
          <label className="muted">Número (opcional)</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="ex: 42" />
        </div>
      </div>

      <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={salvar} disabled={loading}>
          {loading ? "..." : "Salvar entrega"}
        </button>
        <span className="muted">
          * Busca ViaCEP + coordenadas Mapbox automaticamente
        </span>
      </div>

      <div className="list" style={{ marginTop: 14 }}>
        {rows.map((d) => (
          <div key={d.id} className="item col">
            <div className="row space">
              <b>
                {d.client_name} — {d.order_id}
              </b>
              <button className="ghost" onClick={() => excluir(d.id)} disabled={loading}>
                Excluir
              </button>
            </div>

            <div style={{ marginTop: 8 }}>{d.address_text}</div>

            <div className="muted" style={{ marginTop: 6 }}>
              lat/lng: {d.lat ?? "—"} , {d.lng ?? "—"}
            </div>
          </div>
        ))}

        {rows.length === 0 && <p className="muted">Nenhuma entrega ainda.</p>}
      </div>
    </div>
  );
}