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
  const j = (await r.json()) as ViaCepResp;
  if ((j as any).erro) return null;
  return j;
}

async function geocode(q: string) {
  const resp = await fetch(`/.netlify/functions/geocode?q=${encodeURIComponent(q)}`);
  const j = await resp.json();

  if (!j?.found) return null;

  const lat = Number(j.lat);
  const lng = Number(j.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng, display: j.display_name as string | undefined };
}

export default function Deliveries() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [clientName, setClientName] = useState("");
  const [orderId, setOrderId] = useState("");

  // CEP e número
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");

  // Endereço vindo do ViaCEP (read-only)
  const [rua, setRua] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");

  // Endereço livre (fallback)
  const [addressText, setAddressText] = useState("");

  const [priority, setPriority] = useState<"normal" | "urgente">("normal");

  // Lat/Lng opcional (ajuste manual)
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  async function getUserOrAlert() {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      alert("Erro ao carregar sessão: " + error.message);
      return null;
    }
    if (!session?.user) {
      alert("Sessão inválida. Saia e faça login novamente.");
      return null;
    }
    return session.user;
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
      .select("id,client_name,order_id,address_text,priority,lat,lng")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) alert("Erro ao buscar entregas: " + error.message);
    else setItems((data || []) as any);
  }

  useEffect(() => {
    load();
  }, []);

  // ✅ Auto-busca ViaCEP quando completar 8 dígitos
  useEffect(() => {
    const c = onlyDigits(cep);
    if (c.length !== 8) return;

    (async () => {
      const vc = await fetchViaCep(c);
      if (!vc?.logradouro || !vc.localidade || !vc.uf) {
        // limpa se não achou
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

  function buildAddressFromCep() {
    // monta endereço "forte"
    const parts: string[] = [];
    if (rua) parts.push(rua);
    if (numero.trim()) parts[parts.length - 1] = `${parts[parts.length - 1]}, ${numero.trim()}`;
    if (bairro) parts.push(`- ${bairro}`);
    if (cidade && uf) parts.push(`, ${cidade} - ${uf}`);
    parts.push(", Brasil");

    let base = parts.join(" ").replace(/\s+/g, " ").trim();
    if (complemento.trim()) base = `${base} (${complemento.trim()})`;
    return base;
  }

  async function add() {
    if (!clientName.trim() || !orderId.trim()) {
      return alert("Preencha Cliente e Pedido/ID.");
    }

    const user = await getUserOrAlert();
    if (!user) return;

    let latNum = lat ? Number(lat) : null;
    let lngNum = lng ? Number(lng) : null;

    // 1) Decide qual endereço usar
    // Preferência: CEP (ViaCEP) -> fallback: endereço livre
    let finalAddress = "";

    const c = onlyDigits(cep);
    const hasCepAddress = c.length === 8 && rua && cidade && uf;

    if (hasCepAddress) {
      // ✅ endereço vindo do CEP
      finalAddress = buildAddressFromCep();
    } else {
      // fallback: texto livre
      if (!addressText.trim()) {
        return alert("Informe CEP válido (8 dígitos) OU preencha o Endereço (texto).");
      }
      finalAddress = addressText.trim();
      if (!/brasil/i.test(finalAddress)) finalAddress = `${finalAddress}, Brasil`;
    }

    // 2) Geocode automático se não tiver lat/lng manual
    if ((latNum == null || lngNum == null) && finalAddress) {
      const geo = await geocode(finalAddress);

      if (!geo) {
        // Se veio do CEP mas sem número, ainda pode falhar dependendo do logradouro.
        // Então damos instrução clara.
        if (hasCepAddress && !numero.trim()) {
          return alert(
            "Achei o endereço pelo CEP, mas não consegui localizar no mapa.\n\n" +
              "Dica: informe o NÚMERO para ficar preciso."
          );
        }

        return alert(
          "Não encontrei coordenadas.\n\n" +
            "Endereço usado:\n" +
            finalAddress +
            "\n\nDica: use CEP + NÚMERO."
        );
      }

      latNum = geo.lat;
      lngNum = geo.lng;
    }

    const { error } = await supabase.from("deliveries").insert({
      user_id: user.id,
      client_name: clientName.trim(),
      order_id: orderId.trim(),
      address_text: finalAddress,
      priority,
      lat: latNum,
      lng: lngNum
    });

    if (error) return alert("Erro ao salvar entrega: " + error.message);

    // limpar
    setClientName("");
    setOrderId("");
    setCep("");
    setNumero("");
    setComplemento("");
    setRua("");
    setBairro("");
    setCidade("");
    setUf("");
    setAddressText("");
    setPriority("normal");
    setLat("");
    setLng("");

    alert("Entrega salva ✅");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir entrega?")) return;

    const user = await getUserOrAlert();
    if (!user) return;

    const { error } = await supabase
      .from("deliveries")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) alert("Erro ao excluir: " + error.message);
    else load();
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
        <input
          value={cep}
          onChange={(e) => setCep(e.target.value)}
          placeholder="04821-450"
        />

        <label>Número (recomendado)</label>
        <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="42" />

        <label>Complemento</label>
        <input value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="apto, bloco..." />

        <label>Rua (via CEP)</label>
        <input value={rua} readOnly placeholder="(preenche automático pelo CEP)" />

        <label>Bairro (via CEP)</label>
        <input value={bairro} readOnly placeholder="(preenche automático pelo CEP)" />

        <label>Cidade/UF (via CEP)</label>
        <input value={cidade && uf ? `${cidade} - ${uf}` : ""} readOnly placeholder="(preenche automático pelo CEP)" />

        <label>Endereço (texto livre – se não usar CEP)</label>
        <textarea
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
          placeholder="Rua X, 123 - Bairro, Cidade - UF"
        />

        <label>Prioridade</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
          <option value="normal">normal</option>
          <option value="urgente">urgente</option>
        </select>

        <label>Latitude (opcional)</label>
        <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-23.55" />

        <label>Longitude (opcional)</label>
        <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-46.63" />
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={add}>Salvar entrega</button>
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        {items.map((d) => (
          <div key={d.id} className="item col">
            <div className="row space">
              <b>{d.priority === "urgente" ? "🚨 " : ""}{d.client_name} — {d.order_id}</b>
              <button className="ghost" onClick={() => remove(d.id)}>Excluir</button>
            </div>
            <div className="muted">{d.address_text}</div>
            <div className="muted">lat/lng: {d.lat ?? "—"} , {d.lng ?? "—"}</div>
          </div>
        ))}
        {items.length === 0 && <p className="muted">Nenhuma entrega ainda.</p>}
      </div>
    </div>
  );
}