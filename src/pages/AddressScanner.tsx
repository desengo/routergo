import React, { useState } from "react";
import Tesseract from "tesseract.js";
import { supabase } from "../lib/supabase";

export default function AddressScanner() {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");

  async function handleImage(file: File) {
    setLoading(true);

    try {
      const result = await Tesseract.recognize(file, "por");
      const extractedText = result.data.text;

      setText(extractedText);

      const addresses = extractAddresses(extractedText);

      for (const address of addresses) {
        await createDelivery(address);
      }

      alert(`${addresses.length} entregas criadas automaticamente.`);
    } catch (e) {
      console.error(e);
      alert("Erro ao ler imagem.");
    }

    setLoading(false);
  }

  function extractAddresses(text: string) {
    const lines = text.split("\n");

    const addresses: string[] = [];

    for (const line of lines) {
      if (line.match(/\d{1,5}/) && line.length > 10) {
        addresses.push(line.trim());
      }
    }

    return addresses;
  }

  async function createDelivery(address: string) {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id;

    if (!userId) return;

    await supabase.from("deliveries").insert({
      address: address,
      user_id: userId,
      status: "pending",
    });
  }

  return (
    <div className="card">
      <h3>📷 Importar Endereços por Imagem</h3>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleImage(e.target.files[0]);
          }
        }}
      />

      {loading && <p>Lendo imagem...</p>}

      {text && (
        <div style={{ marginTop: 10 }}>
          <b>Texto detectado:</b>
          <pre>{text}</pre>
        </div>
      )}
    </div>
  );
}