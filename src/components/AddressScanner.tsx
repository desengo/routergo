import React, { useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type ParsedAddress = {
  recipient: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  rawText: string;
};

type ParsedResponse = {
  orders: ParsedAddress[];
};

const GEMINI_API_KEY = "SUA_CHAVE_GEMINI";

export default function AddressScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;
      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      setError("Não foi possível abrir a câmera.");
    }
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  function capturePhotoBase64() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const base64 = dataUrl.split(",")[1];

    setPreview(dataUrl);

    return base64;
  }

  async function scanAndSave() {
    try {
      setLoading(true);
      setError("");
      setSavedCount(0);

      const base64Image = capturePhotoBase64();
      if (!base64Image) throw new Error("Erro ao capturar imagem.");

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body: JSON.stringify({
            generationConfig: {
              responseMimeType: "application/json",
            },
            contents: [
              {
                parts: [
                  {
                    text: `
Analise esta imagem.

A imagem pode conter:

- etiqueta de entrega
- lista de pedidos
- print de WhatsApp
- várias etiquetas na mesma foto

Extraia TODOS os endereços encontrados.

Retorne SOMENTE JSON no formato:

{
 "orders":[
  {
   "recipient":"",
   "street":"",
   "number":"",
   "complement":"",
   "neighborhood":"",
   "city":"",
   "state":"",
   "zipCode":"",
   "rawText":""
  }
 ]
}

Regras:

- Cada pedido vira um item em orders
- Separe rua e número corretamente
- Apartamento ou bloco vai em complement
- Bairro em neighborhood
- state deve ser sigla (SP RJ MG)
- zipCode apenas números
- Não invente dados
- Não escreva texto fora do JSON
`,
                  },
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error("IA não retornou resposta.");

      let parsed: ParsedResponse;

      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("JSON inválido retornado pela IA.");
      }

      if (!parsed.orders || !Array.isArray(parsed.orders))
        throw new Error("Nenhum pedido encontrado.");

      let saved = 0;

      for (const order of parsed.orders) {
        if (!order.street || !order.city || !order.state) continue;

        const { error } = await supabase.from("deliveries").insert({
          recipient: order.recipient || "",
          street: order.street || "",
          number: order.number || "",
          complement: order.complement || "",
          neighborhood: order.neighborhood || "",
          city: order.city || "",
          state: order.state || "",
          zip_code: order.zipCode || "",
          raw_text: order.rawText || "",
          source: "camera_ai",
        });

        if (!error) saved++;
      }

      setSavedCount(saved);
      closeCamera();
    } catch (err: any) {
      setError(err.message || "Erro ao processar imagem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h2>Scanner Inteligente de Pedidos</h2>

      {!cameraOpen && (
        <button onClick={openCamera}>
          Abrir câmera
        </button>
      )}

      {cameraOpen && (
        <div>
          <video ref={videoRef} autoPlay playsInline style={{ width: "100%" }} />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div style={{ marginTop: 10 }}>
            <button onClick={scanAndSave} disabled={loading}>
              {loading ? "Processando..." : "Capturar e importar pedidos"}
            </button>

            <button onClick={closeCamera}>Fechar</button>
          </div>
        </div>
      )}

      {preview && (
        <div>
          <p>Prévia</p>
          <img src={preview} style={{ width: "100%" }} />
        </div>
      )}

      {savedCount > 0 && (
        <div style={{ marginTop: 10 }}>
          ✅ {savedCount} entregas criadas automaticamente
        </div>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}