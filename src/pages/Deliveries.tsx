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

    return data;
  }

  async function geocodeEndereco(enderecoCompleto: string) {
    const res = await fetch(
      `/.netlify/functions/geocode?q=${encodeURIComponent(enderecoCompleto)}`
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error("Não encontrei coordenadas.");
    }

    return data;
  }

  async function salvarEntrega() {
    try {
      const dadosCep = await buscarCep(cep);

      const enderecoCompleto = `${dadosCep.logradouro}, ${numero} - ${dadosCep.bairro}, ${dadosCep.localidade} - ${dadosCep.uf}, ${onlyDigits(cep)}`;

      const coords = await geocodeEndereco(enderecoCompleto);

      const { error } = await supabase.from("deliveries").insert({
        cliente,
        pedido_id,
        endereco: enderecoCompleto,
        prioridade,
        lat: coords.lat,
        lng: coords.lng,
      });

      if (error) throw error;

      alert("Entrega salva com sucesso!");

      // limpar campos
      setCliente("");
      setPedidoId("");
      setCep("");
      setNumero("");
      setPrioridade("normal");
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="card">
      <h3>Entregas</h3>

      <label>Cliente</label>
      <input
        value={cliente}
        onChange={(e) => setCliente(e.target.value)}
      />

      <label>Pedido/ID</label>
      <input
        value={pedido_id}
        onChange={(e) => setPedidoId(e.target.value)}
      />

      <label>CEP</label>
      <input
        value={cep}
        onChange={(e) => setCep(e.target.value)}
        placeholder="00000-000"
      />

      <label>Número</label>
      <input
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        placeholder="123"
      />

      <label>Prioridade</label>
      <select
        value={prioridade}
        onChange={(e) => setPrioridade(e.target.value)}
      >
        <option value="normal">normal</option>
        <option value="alta">alta</option>
      </select>

      <button onClick={salvarEntrega}>
        Salvar entrega
      </button>
    </div>
  );
}