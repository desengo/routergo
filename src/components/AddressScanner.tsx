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

const GEMINI_API_KEY = "COLE_SUA_CHAVE_AQUI";

export default function AddressScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState<ParsedAddress | null>(null);

  async function openCamera() {
    try {
      setError("");
      setLastSaved(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.error(err);
      setError("Não foi possível abrir a câmera.");
    }
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  function capturePhotoBase64(): { base64: string; dataUrl: string } | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return null;

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) return null;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const base64 = dataUrl.split(",")[1];

    setPreview(dataUrl);

    return { base64, dataUrl };
  }

  async function scanAndSave() {
    try {
      setLoading(true);
      setError("");
      setLastSaved(null);

      if (!GEMINI_API_KEY || GEMINI_API_KEY === "gen-lang-client-0401246465") {
        throw new Error("Preencha a chave do Gemini no código.");
      }

      const image = capturePhotoBase64();

      if (!image) {
        throw new Error("Não foi possível capturar a foto.");
      }

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
Leia esta imagem de etiqueta/endereço e devolva APENAS um JSON válido com estes campos:
recipient, street, number, complement, neighborhood, city, state, zipCode, rawText

Regras:
- Responda somente JSON puro
- Se não encontrar um campo, use ""
- state deve vir como sigla, por exemplo SP
- rawText deve conter o texto principal lido da imagem
- Não invente informações
                    `.trim(),
                  },
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: image.base64,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data);
        throw new Error(data?.error?.message || "Erro ao chamar Gemini.");
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!text) {
        console.error(data);
        throw new Error("Gemini não retornou conteúdo.");
      }

      let parsed: ParsedAddress;

      try {
        parsed = JSON.parse(text);
      } catch {
        console.error("Resposta recebida:", text);
        throw new Error("A resposta do Gemini não veio em JSON válido.");
      }

      const address: ParsedAddress = {
        recipient: parsed.recipient || "",
        street: parsed.street || "",
        number: parsed.number || "",
        complement: parsed.complement || "",
        neighborhood: parsed.neighborhood || "",
        city: parsed.city || "",
        state: parsed.state || "",
        zipCode: parsed.zipCode || "",
        rawText: parsed.rawText || "",
      };

      const hasMinimumAddress =
        address.street.trim() &&
        address.city.trim() &&
        address.state.trim();

      if (!hasMinimumAddress) {
        throw new Error("A IA não identificou um endereço suficiente para salvar.");
      }

      const { error: saveError } = await supabase.from("deliveries").insert({
        recipient: address.recipient,
        street: address.street,
        number: address.number,
        complement: address.complement,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        zip_code: address.zipCode,
        raw_text: address.rawText,
        source: "camera_ai",
      });

      if (saveError) {
        throw new Error(saveError.message);
      }

      setLastSaved(address);
      closeCamera();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao ler e salvar imagem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <h2>Scanner de Endereço</h2>

      {!cameraOpen && (
        <button style={styles.button} onClick={openCamera} disabled={loading}>
          Abrir câmera
        </button>
      )}

      {cameraOpen && (
        <div style={styles.block}>
          <video ref={videoRef} autoPlay playsInline style={styles.video} />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div style={styles.row}>
            <button style={styles.button} onClick={scanAndSave} disabled={loading}>
              {loading ? "Lendo e salvando..." : "Capturar, ler e salvar"}
            </button>

            <button
              style={styles.buttonSecondary}
              onClick={closeCamera}
              disabled={loading}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div style={styles.block}>
          <p>Prévia:</p>
          <img src={preview} alt="Prévia" style={styles.image} />
        </div>
      )}

      {lastSaved && (
        <div style={styles.successBox}>
          <strong>Entrega salva com sucesso.</strong>
          <div style={{ marginTop: 8 }}>{lastSaved.recipient}</div>
          <div>
            {lastSaved.street} {lastSaved.number}
          </div>
          <div>
            {lastSaved.neighborhood} - {lastSaved.city}/{lastSaved.state}
          </div>
          <div>{lastSaved.zipCode}</div>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    padding: 16,
    border: "1px solid #ddd",
    borderRadius: 12,
  },
  block: {
    marginTop: 16,
  },
  row: {
    display: "flex",
    gap: 8,
    marginTop: 12,
  },
  video: {
    width: "100%",
    borderRadius: 12,
    background: "#000",
  },
  image: {
    width: "100%",
    borderRadius: 12,
  },
  button: {
    marginTop: 12,
    padding: "10px 14px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
  },
  buttonSecondary: {
    marginTop: 12,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
  },
  successBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    background: "#f4f8f4",
    border: "1px solid #cfe3cf",
  },
  error: {
    color: "red",
    marginTop: 12,
  },
};
