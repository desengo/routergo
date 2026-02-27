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
      {/* Glow verde */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(900px 500px at 20% 10%, rgba(0,255,140,.18), transparent 60%)," +
            "radial-gradient(700px 420px at 90% 30%, rgba(0,180,120,.14), transparent 60%)," +
            "radial-gradient(900px 700px at 50% 110%, rgba(0,120,80,.20), transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="card"
        style={{
          width: "min(880px, 92vw)",
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 18,
          padding: 18,
        }}
      >
        {/* Apresentação */}
        <div
          style={{
            borderRadius: 18,
            padding: 20,
            border: "1px solid rgba(0,255,140,.18)",
            background:
              "linear-gradient(180deg, rgba(0,255,140,.08), rgba(0,0,0,.00))",
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 0.5 }}>
            RouterGo
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 16,
              opacity: 0.95,
              lineHeight: 1.5,
            }}
          >
            Plataforma inteligente para organizar entregas,
            gerar rotas otimizadas e acompanhar operações
            com precisão.
          </div>

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gap: 12,
            }}
          >
            <Feature title="Gestão de Entregas" text="Cadastre e organize seus pedidos rapidamente." />
            <Feature title="Rotas Inteligentes" text="Agrupamento automático de paradas." />
            <Feature title="Visualização em Mapa" text="Acompanhe trajetos de forma clara e estratégica." />
          </div>
        </div>

        {/* Login */}
        <div
          style={{
            borderRadius: 18,
            padding: 20,
            background: "rgba(0,0,0,.25)",
            border: "1px solid rgba(255,255,255,.08)",
            boxShadow: "0 10px 30px rgba(0,0,0,.35)",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800 }}>Entrar</div>
          <div className="muted" style={{ marginTop: 4 }}>
            Acesse sua conta
          </div>

          <label className="muted" style={{ marginTop: 14 }}>
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={{ marginTop: 6 }}
          />

          <label className="muted" style={{ marginTop: 14 }}>
            Senha
          </label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="********"
            style={{ marginTop: 6 }}
          />

          <div className="row" style={{ gap: 12, marginTop: 18 }}>
            <button onClick={entrar} disabled={loading || !emailOk || !senha}>
              {loading ? "..." : "Entrar"}
            </button>
            <button className="ghost" onClick={criarConta} disabled={loading || !emailOk || !senha}>
              Criar conta
            </button>
          </div>
        </div>
      </div>

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

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(0,255,140,.12)",
        background: "rgba(0,0,0,.15)",
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
        {text}
      </div>
    </div>
  );
}