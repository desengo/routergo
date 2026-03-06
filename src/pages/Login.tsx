// src/pages/Login.tsx
import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Screen = "login" | "signup_admin";

function cleanText(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function onlyDigits(s: string) {
  return (s || "").replace(/\D+/g, "");
}

export default function Login() {
  const [screen, setScreen] = useState<Screen>("login");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [adminName, setAdminName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");

  const canLogin = useMemo(() => {
    return cleanText(email).includes("@") && cleanText(password).length >= 6;
  }, [email, password]);

  async function doLogin() {
    if (!canLogin) return;

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanText(email),
        password,
      });

      if (error) throw error;
    } catch (e: any) {
      alert(e?.message || String(e));
    }

    setLoading(false);
  }

  const canSignupAdmin = useMemo(() => {
    const e = cleanText(adminEmail);
    const p = cleanText(adminPass);

    return (
      cleanText(adminName).length >= 2 &&
      cleanText(companyName).length >= 2 &&
      onlyDigits(cnpj).length >= 14 &&
      e.includes("@") &&
      p.length >= 6
    );
  }, [adminName, companyName, cnpj, adminEmail, adminPass]);

  async function signupAdmin() {
    if (!canSignupAdmin) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanText(adminEmail),
        password: adminPass,
      });

      if (error) throw error;

      const userId = data.user?.id;

      const payload: any = {
        id: userId,
        role: "admin",
        display_name: cleanText(adminName),
        company_name: cleanText(companyName),
        company_cnpj: onlyDigits(cnpj),
      };

      await supabase.from("profiles").upsert(payload);

      alert("Conta criada. Faça login.");
      setScreen("login");

      setEmail(adminEmail);
      setPassword("");
    } catch (e: any) {
      alert(e?.message || String(e));
    }

    setLoading(false);
  }

  return (
    <div className="wrap">
      {screen === "login" && (
        <div className="card">

          <div style={{textAlign:"center",marginBottom:20}}>
            <h1>RouterGo</h1>
            <div className="muted">Gestão inteligente de entregas</div>
          </div>

          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="row" style={{gap:10,marginTop:16}}>
            <button
              className="primary"
              onClick={doLogin}
              disabled={!canLogin || loading}
            >
              Entrar
            </button>

            <button
              className="ghost"
              onClick={() => setScreen("signup_admin")}
            >
              Criar conta
            </button>
          </div>

          {/* CARD APP ENTREGADOR */}
          <div
            style={{
              marginTop:30,
              padding:16,
              borderRadius:10,
              background:"#f3f4f6",
              textAlign:"center"
            }}
          >
            <div style={{fontWeight:"bold"}}>
              📦 App Entregador
            </div>

            <div style={{fontSize:13,marginTop:4,marginBottom:10}}>
              Baixe o aplicativo para acessar suas rotas
            </div>

            <a
              href="/app-release.apk"
              style={{
                background:"#22c55e",
                color:"#fff",
                padding:"8px 14px",
                borderRadius:6,
                textDecoration:"none",
                fontSize:14
              }}
            >
              Baixar APK
            </a>
          </div>

        </div>
      )}

      {screen === "signup_admin" && (
        <div className="card">

          <h2>Cadastro da Empresa</h2>

          <label>Nome do responsável</label>
          <input
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
          />

          <label>Nome da empresa</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />

          <label>CNPJ</label>
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
          />

          <label>Email</label>
          <input
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
          />

          <label>Senha</label>
          <input
            type="password"
            value={adminPass}
            onChange={(e) => setAdminPass(e.target.value)}
          />

          <div className="row" style={{gap:10,marginTop:16}}>
            <button
              className="primary"
              onClick={signupAdmin}
              disabled={!canSignupAdmin || loading}
            >
              Criar conta
            </button>

            <button
              className="ghost"
              onClick={() => setScreen("login")}
            >
              Voltar
            </button>
          </div>

        </div>
      )}
    </div>
  );
}