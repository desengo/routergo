import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function entrar() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) alert(error.message);
  }

  async function criarConta() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password: senha });
    setLoading(false);
    if (error) alert(error.message);
    else alert("Conta criada! (se confirmação de email estiver desligada, já entra direto)");
  }

  return (
    <div className="wrap">
      <div className="card">
        <h2>Delivery Routes</h2>

        <label className="muted">email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="muted" style={{ marginTop: 10 }}>
          senha
        </label>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />

        <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button className="ghost" onClick={entrar} disabled={loading}>
            {loading ? "..." : "Entrar"}
          </button>
          <button onClick={criarConta} disabled={loading}>
            {loading ? "..." : "Criar conta"}
          </button>
        </div>
      </div>
    </div>
  );
}