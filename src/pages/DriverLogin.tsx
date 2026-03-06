import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function DriverLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      alert("Preencha email e senha.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error("Usuário não encontrado.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      if (profile.role !== "driver") {
        await supabase.auth.signOut();
        throw new Error("Este acesso é exclusivo para entregadores.");
      }

      window.location.href = "/driver";
    } catch (e: any) {
      alert(e?.message || "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className="card">
        <h2>Login do Entregador</h2>

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="primary" onClick={handleLogin} disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            className="ghost"
            onClick={() => (window.location.href = "/")}
            disabled={loading}
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}