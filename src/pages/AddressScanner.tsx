import React, { useRef, useState } from "react";

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
  confidence: number;
};

type Props = {
  onConfirm?: (address: ParsedAddress) => void;
};

export default function AddressScanner({ onConfirm }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [address, setAddress] = useState<ParsedAddress | null>(null);

  async function openCamera() {
    try {
      setError("");

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
      setError("Não foi possível acessar a câmera.");
    }
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  function capturePhoto() {
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

    const imageBase64 = canvas.toDataURL("image/jpeg", 0.9);
    setPreview(imageBase64);

    return imageBase64;
  }

  async function scanAddress() {
    try {
      setLoading(true);
      setError("");
      setAddress(null);

      const imageBase64 = capturePhoto();

      if (!imageBase64) {
        setError("Não foi possível capturar a foto.");
        return;
      }

      const response = await fetch("/api/scan-address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao processar imagem.");
      }

      setAddress(data.address);
      closeCamera();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao ler endereço.");
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: keyof ParsedAddress, value: string | number) {
    setAddress((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: value,
      };
    });
  }

  function handleConfirm() {
    if (!address) return;

    if (onConfirm) {
      onConfirm(address);
    } else {
      console.log("Endereço confirmado:", address);
      alert("Endereço confirmado.");
    }

    setAddress(null);
    setPreview("");
  }

  return (
    <div style={styles.container}>
      <h2>Scanner de Endereço</h2>

      {!cameraOpen && !address && (
        <button onClick={openCamera} style={styles.button}>
          Abrir câmera
        </button>
      )}

      {cameraOpen && (
        <div style={styles.section}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={styles.video}
          />

          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div style={styles.row}>
            <button onClick={scanAddress} style={styles.button} disabled={loading}>
              {loading ? "Lendo..." : "Capturar e ler"}
            </button>

            <button onClick={closeCamera} style={styles.buttonSecondary} disabled={loading}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {preview && !address && (
        <div style={styles.section}>
          <p>Prévia:</p>
          <img src={preview} alt="Preview" style={styles.image} />
        </div>
      )}

      {address && (
        <div style={styles.section}>
          <h3>Endereço encontrado</h3>

          <input
            style={styles.input}
            placeholder="Destinatário"
            value={address.recipient}
            onChange={(e) => updateField("recipient", e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Rua"
            value={address.street}
            onChange={(e) => updateField("street", e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Número"
            value={address.number}
            onChange={(e) => updateField("number", e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Complemento"
            value={address.complement}
            onChange={(e) => updateField("complement", e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Bairro"
            value={address.neighborhood}
            onChange={(e) => updateField("neighborhood", e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Cidade"
            value={address.city}
            onChange={(e) => updateField("city", e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Estado"
            value={address.state}
            onChange={(e) => updateField("state", e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="CEP"
            value={address.zipCode}
            onChange={(e) => updateField("zipCode", e.target.value)}
          />

          <div style={{ marginTop: 8 }}>
            <strong>Confiança:</strong> {address.confidence}
          </div>

          <div style={{ marginTop: 8 }}>
            <strong>Texto lido:</strong>
            <pre style={styles.pre}>{address.rawText}</pre>
          </div>

          <div style={styles.row}>
            <button onClick={handleConfirm} style={styles.button}>
              Confirmar
            </button>

            <button
              onClick={() => {
                setAddress(null);
                setPreview("");
                openCamera();
              }}
              style={styles.buttonSecondary}
            >
              Escanear novamente
            </button>
          </div>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 16,
    maxWidth: 520,
  },
  section: {
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
  input: {
    width: "100%",
    padding: 10,
    marginTop: 8,
    borderRadius: 8,
    border: "1px solid #ccc",
  },
  button: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
  },
  buttonSecondary: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
  },
  pre: {
    whiteSpace: "pre-wrap",
    background: "#f6f6f6",
    padding: 10,
    borderRadius: 8,
  },
  error: {
    color: "red",
    marginTop: 12,
  },
};
