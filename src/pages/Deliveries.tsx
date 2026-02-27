import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Tipos
type DeliveryRow = {
  id: string;
  client_name: string;
  order_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;

  // se você tiver no banco:
  cep?: string | null;
  number?: string | null;
  created_at?: string;
};

type ViaCepResp = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function buscarCep(cep: string): Promise<ViaCepResp> {
  const clean = onlyDigits(cep);
  if (clean.length !== 8) throw new Error("CEP inválido.");
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  const json = (await res.json()) as ViaCepResp;
  if (json.erro) throw new Error("CEP não encontrado.");
  return json;
}

// Geocoding via Mapbox (ou o que você já usa no seu geo.ts).
// Mantive aqui para não depender de outros arquivos.
async function geocodeMapbox(address: string) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
  if (!token) throw new Error("VITE_MAPBOX_TOKEN não configurado.");
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(address)}.json?limit=1&country=br&language=pt&access_token=${token}`;

  const res = await fetch(url);
  const data = await res.json();

  const feature = data?.features?.[0];
  if (!feature?.center?.length) return null;

  const [lng, lat] = feature.center;
  return { lat: Number(lat), lng: Number(lng) };
}

export default function Deliveries() {
  const [clientName, setClientName] = useState("");
  const [orderId, setOrderId] = useState("");
  const [cep, setCep] = useState("");
  const [number, setNumber] = useState("");

  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ Controle: por padrão NÃO mostra lat/lng
  const SHOW_COORDS = false;

  async function loadDeliveries() {
    setLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from("deliveries")
        .select("id,client_name,order_id,address_text,lat,lng,cep,number,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeliveries((data || []) as DeliveryRow[]);
    } catch (e: any) {
      alert("Erro ao buscar entregas: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeliveries();
  }, []);

  async function salvarEntrega() {
    try {
      setLoading(true);

      const userId = await getUserId();
      if (!userId) throw new Error("Você precisa estar logado.");

      const cleanCep = onlyDigits(cep);
      if (cleanCep.length !== 8) throw new Error("Digite um CEP válido (8 números).");

      // ViaCEP (autocomplete)
      const dadosCep = await buscarCep(cleanCep);

      const rua = dadosCep.logradouro || "";
      const bairro = dadosCep.bairro || "";
      const cidade = dadosCep.localidade || "";
      const uf = dadosCep.uf || "";

      // Monta endereço. Número é opcional (você quis assim)
      const numeroTxt = number?.trim() ? number.trim() : "s/n";
      const enderecoCompleto = `${rua}, ${numeroTxt} - ${bairro}, ${cidade} - ${uf}, Brasil`.replace(
        /\s+/g,
        " "
      );

      // Geocode (Mapbox)
      const coords = await geocodeMapbox(enderecoCompleto);

      // Se não encontrou coords, salva mesmo (sem lat/lng)
      const payload: any = {
        user_id: userId,
        client_name: clientName.trim() || "Cliente",
        order_id: orderId.trim() || "",
        address_text: enderecoCompleto,
        cep: cleanCep,
        number: number?.trim() || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      };

      const { error } = await supabase.from("deliveries").insert(payload);
      if (error) throw error;

      setClientName("");
      setOrderId("");
      setCep("");
      setNumber("");

      await loadDeliveries();
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function excluirEntrega(id: string) {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) throw new Error("Você precisa estar logado.");

      const { error } = await supabase.from("deliveries").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;

      await loadDeliveries();
    } catch (e: any) {
      alert("Erro ao excluir: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="topbar">
        <h3>Entregas</h3>
        <button className="ghost" onClick={loadDeliveries}>
          {loading ? "..." : "Atualizar"}
        </button>
      </div>

      <label>Cliente</label>
      <input value={clientName} onChange={(e) => setClientName(e.target.value)} />

      <label>Pedido</label>
      <input value={orderId} onChange={(e) => setOrderId(e.target.value)} />

      <label>CEP</label>
      <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="ex: 04821450" />

      <label>Número (opcional)</label>
      <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="ex: 42" />

      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={salvarEntrega} disabled={loading}>
          Salvar entrega
        </button>
      </div>

      <p className="muted" style={{ marginTop: 10 }}>
        * Busca ViaCEP + coordenadas Mapbox automaticamente
      </p>

      <div className="list" style={{ marginTop: 12 }}>
        {deliveries.map((d) => (
          <div key={d.id} className="item col">
            <div className="row space">
              <b>
                {d.client_name} — {d.order_id || "—"}
              </b>
              <button className="ghost" onClick={() => excluirEntrega(d.id)} disabled={loading}>
                Excluir
              </button>
            </div>

            <div style={{ marginTop: 6 }}>{d.address_text}</div>

            {/* ✅ AQUI: lat/lng oculto por padrão */}
            {SHOW_COORDS && (
              <div className="muted" style={{ marginTop: 6 }}>
                lat/lng: {d.lat ?? "—"} , {d.lng ?? "—"}
              </div>
            )}
          </div>
        ))}

        {deliveries.length === 0 && <p className="muted">Nenhuma entrega ainda.</p>}
      </div>
    </div>
  );
}