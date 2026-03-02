import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (error) alert(error.message);
  }

  async function signUp() {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (error) alert(error.message);
    else alert("Conta criada! Verifique seu email se o Supabase exigir confirmação.");
  }

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 520, margin: "40px auto" }}>
        <div className="loginHeader">
          <img src="/logo.png" alt="RouterGo" className="loginLogo" />
          <div>
            <h2 style={{ margin: 0 }}>RouterGo</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              Gestão de entregas e rotas
            </div>
          </div>
        </div>

        <form onSubmit={signIn} style={{ marginTop: 18 }}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />

          <label>Senha</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />

          <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "..." : "Entrar"}
            </button>

            <button type="button" className="ghost" onClick={signUp} disabled={loading}>
              Criar conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}