import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const emailOk = useMemo(() => email.includes("@") && email.includes("."), [email]);

  async function entrar() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    setLoading(false);
    if (error) alert(error.message);
  }

  async function criarConta() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
    });
    setLoading(false);
    if (error) alert(error.message);
    else alert("Conta criada! Agora é só entrar.");
  }

  return (
    <div className="wrap" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      {/* “Glow” no fundo */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(900px 500px at 20% 10%, rgba(0,255,140,.18), transparent 60%)," +
            "radial-gradient(700px 420px at 90% 30%, rgba(0,180,120,.14), transparent 60%)," +
            "radial-gradient(900px 700px at 50% 110%, rgba(0,120,80,.20), transparent 60%)",
          pointerEvents: "none",
          filter: "blur(0px)",
        }}
      />

      <div
        className="card"
        style={{
          width: "min(920px, 92vw)",
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 18,
          padding: 18,
        }}
      >
        {/* Lado esquerdo: apresentação */}
        <div
          style={{
            borderRadius: 18,
            padding: 18,
            border: "1px solid rgba(0,255,140,.18)",
            background:
              "linear-gradient(180deg, rgba(0,255,140,.10), rgba(0,0,0,.00))",
            boxShadow: "0 0 0 1px rgba(0,0,0,.2) inset",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                background: "rgba(0,255,140,.12)",
                border: "1px solid rgba(0,255,140,.25)",
                boxShadow: "0 0 22px rgba(0,255,140,.18)",
                fontSize: 20,
              }}
            >
              🚚
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>RouterGo</div>
              <div className="muted" style={{ marginTop: 2 }}>
                Rotas inteligentes + mapa (Mapbox)
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, lineHeight: 1.45 }}>
            <div style={{ fontSize: 15, opacity: 0.95 }}>
              Organize entregas, gere rotas e visualize no mapa com linha azul, estilo Uber.
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <Feature icon="📦" title="Entregas" text="Cadastre e liste entregas rapidamente." />
              <Feature icon="🧭" title="Rotas" text="Gere rotas com paradas e abra no mapa." />
              <Feature icon="🗺️" title="Mapa" text="Veja rota desenhada com marcadores e trilha." />
            </div>
          </div>

          <div
            className="muted"
            style={{
              marginTop: 12,
              fontSize: 12,
              opacity: 0.85,
              borderTop: "1px solid rgba(0,255,140,.12)",
              paddingTop: 12,
            }}
          >
            Dica: para melhores coordenadas, use CEP + número.
          </div>
        </div>

        {/* Lado direito: formulário */}
        <div
          style={{
            borderRadius: 18,
            padding: 18,
            border: "1px solid rgba(255,255,255,.08)",
            background: "rgba(0,0,0,.18)",
            boxShadow: "0 10px 30px rgba(0,0,0,.25)",
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Entrar</div>
            <div className="muted" style={{ marginTop: 4 }}>
              Acesse sua conta para ver entregas e rotas.
            </div>
          </div>

          <label className="muted">email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            inputMode="email"
            autoComplete="email"
            style={{ marginTop: 6 }}
          />

          <label className="muted" style={{ marginTop: 12 }}>
            senha
          </label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="********"
            autoComplete="current-password"
            style={{ marginTop: 6 }}
          />

          <div className="row" style={{ gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={entrar} disabled={loading || !emailOk || !senha}>
              {loading ? "..." : "Entrar"}
            </button>
            <button className="ghost" onClick={criarConta} disabled={loading || !emailOk || !senha}>
              Criar conta
            </button>
          </div>

          <div
            className="muted"
            style={{
              marginTop: 12,
              fontSize: 12,
              opacity: 0.85,
            }}
          >
            Ao criar conta, use um email válido. (Confirmação de email pode estar desativada no Supabase.)
          </div>
        </div>
      </div>

      {/* Responsivo simples sem mexer no CSS global */}
      <style>{`
        @media (max-width: 860px) {
          .wrap > .card {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "34px 1fr",
        gap: 10,
        padding: 10,
        borderRadius: 14,
        border: "1px solid rgba(0,255,140,.10)",
        background: "rgba(0,0,0,.10)",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          background: "rgba(0,255,140,.12)",
          border: "1px solid rgba(0,255,140,.18)",
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 750, fontSize: 14 }}>{title}</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {text}
        </div>
      </div>
    </div>
  );
}