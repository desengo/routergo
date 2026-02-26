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