import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [address, setAddress] = useState("");

  async function load() {
    const { data } = await supabase
      .from("deliveries")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setDeliveries(data);
  }

  async function addDelivery() {
    if (!address) return;

    await supabase.from("deliveries").insert({
      address_text: address
    });

    setAddress("");
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="wrap">
      <h2>Entregas</h2>

      <input
        placeholder="Endereço"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      <button onClick={addDelivery}>Adicionar</button>

      <div style={{ marginTop: 20 }}>
        {deliveries.map((d) => (
          <div key={d.id} className="card">
            {d.address_text}
          </div>
        ))}
      </div>
    </div>
  );
}