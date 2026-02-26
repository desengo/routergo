import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="wrap">
      <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
        <h2 style={{ marginBottom: 6 }}>RouterGo</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Login
        </p>

        <label className="muted">email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />

        <label className="muted" style={{ marginTop: 12 }}>
          senha
        </label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="********"
        />

        <div className="row" style={{ gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={entrar} disabled={loading || !email || !senha}>
            {loading ? "..." : "Entrar"}
          </button>
          <button className="ghost" onClick={criarConta} disabled={loading || !email || !senha}>
            Criar conta
          </button>
        </div>
      </div>
    </div>
  );
}