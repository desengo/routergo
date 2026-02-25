import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Deliveries() {
  const [cliente, setCliente] = useState("");
  const [pedido_id, setPedidoId] = useState("");
  const [prioridade, setPrioridade] = useState("normal");

  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");

  function onlyDigits(s: string) {
    return (s || "").replace(/\D/g, "");
  }

  async function buscarCep(cepInput: string) {
    const cepLimpo = onlyDigits(cepInput).slice(0, 8);

    if (cepLimpo.length !== 8) {
      throw new Error("CEP inválido. Digite 8 números.");
    }

    const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await res.json();

    if (data?.erro) {
      throw new Error("CEP não encontrado.");
    }

    return data; // {logradouro, bairro, localidade, uf, ...}
  }

  async function geocodeEndereco(enderecoCompleto: string) {
    const res = await fetch(
      `/.netlify/functions/geocode?q=${encodeURIComponent(enderecoCompleto)}`
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error("Não encontrei coordenadas.");
    }

    return data; // {lat, lng}
  }

  async function salvarEntrega() {
    try {
      if (!cliente.trim()) throw new Error("Digite o nome do cliente.");
      if (!pedido_id.trim()) throw new Error("Digite o Pedido/ID.");
      if (!cep.trim()) throw new Error("Digite o CEP.");
      if (!numero.trim()) throw new Error("Digite o número do endereço.");

      const dadosCep = await buscarCep(cep);

      if (!dadosCep.logradouro) {
        throw new Error(
          "CEP sem logradouro (CEP geral). Tente um CEP mais específico."
        );
      }

      // formato mais certeiro pro Nominatim
      const enderecoCompleto = `${dadosCep.logradouro}, ${numero}, ${dadosCep.localidade}, ${dadosCep.uf}, Brasil`;

      const coords = await geocodeEndereco(enderecoCompleto);

      // ✅ Nomes corretos da sua tabela no Supabase
      const { error } = await supabase.from("deliveries").insert({
        client_name: cliente.trim(),
        order_id: pedido_id.trim(),
        address_text: enderecoCompleto,
        priority: prioridade,
        lat: coords.lat,
        lng: coords.lng,
      });

      if (error) throw error;

      alert("Entrega salva com sucesso!");

      setCliente("");
      setPedidoId("");
      setCep("");
      setNumero("");
      setPrioridade("normal");
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar entrega.");
    }
  }

  return (
    <div className="card">
      <h3>Entregas</h3>

      <label>Cliente</label>
      <input value={cliente} onChange={(e) => setCliente(e.target.value)} />

      <label>Pedido/ID</label>
      <input value={pedido_id} onChange={(e) => setPedidoId(e.target.value)} />

      <label>CEP</label>
      <input
        value={cep}
        onChange={(e) => setCep(e.target.value)}
        placeholder="00000-000"
        inputMode="numeric"
      />

      <label>Número</label>
      <input
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        placeholder="123"
        inputMode="numeric"
      />

      <label>Prioridade</label>
      <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
        <option value="normal">normal</option>
        <option value="alta">alta</option>
      </select>

      <button onClick={salvarEntrega}>Salvar entrega</button>
    </div>
  );
}