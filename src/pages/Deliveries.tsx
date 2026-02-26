import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  priority: "normal" | "urgente";
  lat: number | null;
  lng: number | null;
  created_at?: string;
};

type ViaCepResp = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

function onlyDigits(s: string) {
  return (s || "").replace(/\D+/g, "");
}

async function fetchViaCep(cep: string): Promise<ViaCepResp | null> {
  const c = onlyDigits(cep);
  if (c.length !== 8) return null;
  const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
  if (!r.ok) return null;
  const j = await r.json();
  if (j.erro) return null;
  return j as ViaCepResp;
}

async function geocode(q: string) {
  const resp = await fetch(`/.netlify/functions/geocode?q=${encodeURIComponent(q)}`);
  const j = await resp.json();
  if (!j?.found) return null;

  const lat = Number(j.lat);
  const lng = Number(j.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

// fallback: coordenada aproximada do CEP (zero custo)
async function geoByCepBrasilApi(cep: string) {
  const c = onlyDigits(cep);
  if (c.length !== 8) return null;

  const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${c}`);
  if (!r.ok) return null;

  const j: any = await r.json();
  const lat = Number(j?.location?.coordinates?.latitude);
  const lng = Number(j?.location?.coordinates?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

function googleMapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function Deliveries() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [clientName, setClientName] = useState("");
  const [orderId, setOrderId] = useState("");

  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");

  const [rua, setRua] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");

  const [priority, setPriority] = useState<"normal" | "urgente">("normal");

  async function getUserOrAlert() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      alert("Erro ao carregar sessão: " + error.message);
      return null;
    }
    const user = data.session?.user ?? null;
    if (!user) {
      alert("Sessão inválida. Saia e faça login novamente.");
      return null;
    }
    return user;
  }

  async function load() {
    setLoading(true);
    const user = await getUserOrAlert();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("deliveries")
      .select("id,client_name,order_id,address_text,priority,lat,lng,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) alert("Erro ao buscar entregas: " + error.message);
    setItems((data || []) as any);
  }

  useEffect(() => {
    load();
  }, []);

  // Auto ViaCEP
  useEffect(() => {
    const c = onlyDigits(cep);
    if (c.length !== 8) return;

    (async () => {
      const vc = await fetchViaCep(c);
      if (!vc?.logradouro || !vc.localidade || !vc.uf) {
        setRua("");
        setBairro("");
        setCidade("");
        setUf("");
        return;
      }
      setRua(vc.logradouro || "");
      setBairro(vc.bairro || "");
      setCidade(vc.localidade || "");
      setUf(vc.uf || "");
    })();
  }, [cep]);

  const addressFromCep = useMemo(() => {
    const c = onlyDigits(cep);
    if (c.length !== 8 || !rua || !cidade || !uf) return "";
    const n = numero.trim();
    const base = `${rua}${n ? `, ${n}` : ""}${bairro ? ` - ${bairro}` : ""}, ${cidade} - ${uf}, Brasil`;
    return base.replace(/\s+/g, " ").trim();
  }, [cep, rua, numero, bairro, cidade, uf]);

  async function add() {
    const user = await getUserOrAlert();
    if (!user) return;

    if (!clientName.trim() || !orderId.trim()) {
      return alert("Preencha Cliente e Pedido/ID.");
    }

    if (!addressFromCep) {
      return alert("Informe um CEP válido (8 dígitos).");
    }

    // 1) tenta geocode endereço completo
    let coords = await geocode(addressFromCep);

    // 2) fallback: tenta rua sem número
    if (!coords) {
      const noNumber = `${rua}${bairro ? ` - ${bairro}` : ""}, ${cidade} - ${uf}, Brasil`.replace(/\s+/g, " ").trim();
      coords = await geocode(noNumber);
    }

    // 3) fallback: centro do CEP
    if (!coords) {
      coords = await geoByCepBrasilApi(cep);
    }

    // 4) salva SEM travar (mesmo se coords null)
    const { error } = await supabase.from("deliveries").insert({
      user_id: user.id,
      client_name: clientName.trim(),
      order_id: orderId.trim(),
      address_text: addressFromCep,
      priority,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });

    if (error) return alert("Erro ao salvar entrega: " + error.message);

    setClientName("");
    setOrderId("");
    setCep("");
    setNumero("");
    setRua("");
    setBairro("");
    setCidade("");
    setUf("");
    setPriority("normal");

    alert("Entrega salva ✅");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir entrega?")) return;

    const user = await getUserOrAlert();
    if (!user) return;

    const { error } = await supabase.from("deliveries").delete().eq("id", id).eq("user_id", user.id);
    if (error) alert("Erro ao excluir: " + error.message);
    else load();
  }

  async function setManualCoords(id: string) {
    const latStr = prompt("Digite a latitude (ex: -23.550520):");
    const lngStr = prompt("Digite a longitude (ex: -46.633308):");
    if (!latStr || !lngStr) return;

    const lat = Number(latStr.replace(",", "."));
    const lng = Number(lngStr.replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return alert("Lat/Lng inválidos.");

    const user = await getUserOrAlert();
    if (!user) return;

    const { error } = await supabase
      .from("deliveries")
      .update({ lat, lng })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return alert("Erro ao salvar coordenadas: " + error.message);
    load();
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Entregas</h3>
        <button className="ghost" onClick={load}>{loading ? "..." : "Atualizar"}</button>
      </div>

      <div className="grid">
        <label>Cliente</label>
        <input value={clientName} onChange={(e) => setClientName(e.target.value)} />

        <label>Pedido/ID</label>
        <input value={orderId} onChange={(e) => setOrderId(e.target.value)} />

        <label>CEP</label>
        <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="04821-450" />

        <label>Número (opcional)</label>
        <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="69" />

        <label>Endereço (via CEP)</label>
        <input value={addressFromCep} readOnly placeholder="Digite um CEP válido" />

        <label>Prioridade</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
          <option value="normal">normal</option>
          <option value="urgente">urgente</option>
        </select>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={add}>Salvar entrega</button>
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        {items.map((d) => {
          const hasCoords = Number.isFinite(d.lat as any) && Number.isFinite(d.lng as any);
          return (
            <div key={d.id} className="item col">
              <div className="row space">
                <b>
                  {d.priority === "urgente" ? "🚨 " : ""}{d.client_name} — {d.order_id}
                </b>
                <button className="ghost" onClick={() => remove(d.id)}>Excluir</button>
              </div>

              <div className="muted">{d.address_text}</div>
              <div className="muted">lat/lng: {d.lat ?? "—"} , {d.lng ?? "—"}</div>

              <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <a className="ghost" href={googleMapsSearchUrl(d.address_text)} target="_blank" rel="noreferrer">
                  Abrir no Google Maps
                </a>

                {!hasCoords && (
                  <button className="ghost" onClick={() => setManualCoords(d.id)}>
                    Definir coordenadas
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {items.length === 0 && <p className="muted">Nenhuma entrega ainda.</p>}
      </div>
    </div>
  );
}