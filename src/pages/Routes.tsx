import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Routes() {
  const [message, setMessage] = useState("");

  async function generateRoute() {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("status", "pending");

    if (error) {
      setMessage("Erro ao buscar entregas.");
      return;
    }

    if (!data || data.length === 0) {
      setMessage("Nenhuma entrega pendente.");
      return;
    }

    setMessage(`Encontradas ${data.length} entregas para gerar rota.`);
  }

  return (
    <div className="wrap">
      <h2>Rotas</h2>

      <button onClick={generateRoute}>
        Gerar rota automática
      </button>

      {message && (
        <div className="card" style={{ marginTop: 20 }}>
          {message}
        </div>
      )}
    </div>
  );
}