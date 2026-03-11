import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function AddressScanner() {
  const [loading, setLoading] = useState(false);

  async function handleImage(file: File) {
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "https://api.ocr.space/parse/image",
        {
          method: "POST",
          headers: {
            apikey: "helloworld"
          },
          body: formData
        }
      );

      const data = await response.json();

      const text = data?.ParsedResults?.[0]?.ParsedText || "";

      const addresses = extractAddresses(text);

      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      for (const address of addresses) {
        await supabase.from("deliveries").insert({
          address: address,
          user_id: userId,
          status: "new"
        });
      }

      alert(addresses.length + " entregas criadas automaticamente.");

    } catch (err) {
      console.error(err);
      alert("Erro ao ler imagem.");
    }

    setLoading(false);
  }

  function extractAddresses(text: string) {
    const lines = text.split("\n");

    const addresses: string[] = [];

    for (const line of lines) {
      if (line.match(/\d+/) && line.length > 10) {
        addresses.push(line.trim());
      }
    }

    return addresses;
  }

  return (
    <div>
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
    </div>
  );
}