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
    } finally {
      setLoading(false);
    }
  }

  async function signupAdmin() {
    if (!canSignupAdmin) return;

    setLoading(true);
    try {
      const signupEmail = cleanText(adminEmail);

      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: adminPass,
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error("Falha ao criar usuário.");

      const payload: any = {
        id: userId,
        role: "admin",
        display_name: cleanText(adminName),
        company_name: cleanText(companyName),
        company_cnpj: onlyDigits(cnpj),
      };

      const up = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (up.error) {
        const upd = await supabase.from("profiles").update(payload).eq("id", userId);
        if (upd.error) throw upd.error;
      }

      alert("Conta de empresa criada. Agora faça login.");
      setScreen("login");
      setEmail(signupEmail);
      setPassword("");
      setAdminName("");
      setCompanyName("");
      setCnpj("");
      setAdminEmail("");
      setAdminPass("");
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      {screen === "login" && (
        <div className="card">
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <img
              src="https://i.ibb.co/DPYsRh9r/file-00000000a9c871f589252b63d66b7839-removebg-preview.png"
              alt="RouterGo"
              style={{ width: 36, height: 36 }}
            />
            <div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>RouterGo</div>
              <div className="muted">Gestão inteligente </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />

            <label>Senha</label>
            <input
              value={password}
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doLogin();
              }}
            />

            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                className="primary"
                onClick={(e) => {
                  e.preventDefault();
                  doLogin();
                }}
                disabled={loading || !canLogin}
              >
                {loading ? "..." : "Entrar"}
              </button>

              <button
                type="button"
                className="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  setScreen("signup_admin");
                }}
                disabled={loading}
              >
                Criar conta
              </button>
            </div>
          </div>

          <a
            href="https://files.manuscdn.com/user_upload_by_module/session_file/310519663347824821/cdFmRxAVsRzSmoPr.apk"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              marginTop: 22,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                borderRadius: 16,
                padding: 16,
                background:
                  "linear-gradient(135deg, rgba(24,255,109,0.12) 0%, rgba(5,12,8,0.06) 100%)",
                border: "1px solid rgba(24,255,109,0.28)",
                boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
                transition: "transform 0.15s ease",
              }}
            >
              <div className="row" style={{ gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: "#18ff6d",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    flexShrink: 0,
                  }}
                >
                 <img
              src="https://i.ibb.co/DPYsRh9r/file-00000000a9c871f589252b63d66b7839-removebg-preview.png"
              alt="RouterGo"
              style={{ width: 36, height: 36 }}
            />
                  <div/>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>App Entregago</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    Baixe o aplicativo do entregador
                  </div>
                </div>

                <div
                  style={{
                    background: "#18ff6d",
                    color: "#050c08",
                    fontWeight: 800,
                    fontSize: 12,
                    padding: "8px 10px",
                    borderRadius: 10,
                    whiteSpace: "nowrap",
                  }}
                >
                  Baixar APK
                </div>
              </div>

              <div
                className="muted"
                style={{ marginTop: 12, fontSize: 12, lineHeight: 1.4 }}
              >
                Instale no celular do entregador para acessar rotas, disponibilidade e
                entregas.
              </div>
            </div>
          </a>
        </div>
      )}

      {screen === "signup_admin" && (
        <div className="card">
          <div className="row space">
            <b>Cadastro da Empresa</b>
            <button
              type="button"
              className="ghost"
              onClick={(e) => {
                e.preventDefault();
                setScreen("login");
              }}
              disabled={loading}
            >
              ← Voltar
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Nome do responsável</label>
            <input value={adminName} onChange={(e) => setAdminName(e.target.value)} />

            <label>Nome da empresa</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />

            <label>CNPJ</label>
            <input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="Somente números"
            />

            <label>Email</label>
            <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />

            <label>Senha</label>
            <input
              value={adminPass}
              type="password"
              onChange={(e) => setAdminPass(e.target.value)}
            />

            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                className="primary"
                onClick={(e) => {
                  e.preventDefault();
                  signupAdmin();
                }}
                disabled={loading || !canSignupAdmin}
              >
                {loading ? "..." : "Criar conta"}
              </button>

              <button
                type="button"
                className="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  setScreen("login");
                }}
                disabled={loading}
              >
                Cancelar
              </button>
            </div>

            <p className="muted" style={{ marginTop: 10 }}>
              * Depois de criar, volte e faça login.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
