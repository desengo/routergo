import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");

  async function signIn() {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setMsg(error.message);
  }

  async function signUp() {
    setMsg("");
    const { error } = await supabase.auth.signUp({ email, password: pass });
    if (error) setMsg(error.message);
    else setMsg("Conta criada.");
  }

  return (
    <div className="wrap">
      <h1>RouterGo</h1>
      <p className="muted">Login</p>

      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="senha" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />

      <div className="row">
        <button onClick={signIn}>Entrar</button>
        <button className="ghost" onClick={signUp}>Criar conta</button>
      </div>

      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
