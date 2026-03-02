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
    else alert("Conta criada com sucesso!");
  }

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 520, margin: "60px auto" }}>
        <div className="loginHeader">
          <img
            src="https://i.ibb.co/DPYsRh9r/file-00000000a9c871f589252b63d66b7839-removebg-preview.png"
            alt="RouterGo"
            className="loginLogo"
          />
          <div>
            <h2 style={{ margin: 0 }}>RouterGo</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              Gestão inteligente de entregas
            </div>
          </div>
        </div>

        <form onSubmit={signIn} style={{ marginTop: 20 }}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />

          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "..." : "Entrar"}
            </button>

            <button
              type="button"
              className="ghost"
              onClick={signUp}
              disabled={loading}
            >
              Criar conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}