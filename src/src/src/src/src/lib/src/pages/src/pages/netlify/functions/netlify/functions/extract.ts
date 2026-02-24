import type { Handler } from "@netlify/functions";
import { json, bad } from "./_shared";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return bad(405, "Use POST");
    const body = JSON.parse(event.body || "{}");
    if (!body.imageBase64) return bad(400, "Missing imageBase64");

    const ocr_text = `CLIENTE: Padaria Central
PEDIDO: 99231
ENDERECO: Rua Augusta, 1200 - Consolacao - Sao Paulo - SP
TELEFONE: (11) 99999-0000
OBS: entregar na recepcao`;

    return json(200, {
      extracted: {
        client_name: "Padaria Central",
        order_id: "99231",
        address_text: "Rua Augusta, 1200 - Consolacao - Sao Paulo - SP",
        phone: "(11) 99999-0000",
        notes: "entregar na recepcao",
        priority: "normal"
      },
      ocr_text,
      geocode: { lat: -23.55052, lng: -46.633308, confidence: 0.3 }
    });
  } catch (e: any) {
    return bad(500, e?.message || "Server error");
  }
};
