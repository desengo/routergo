// src/pages/Login.tsx
import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Screen = "login" | "choose" | "signup_admin" | "signup_driver";

function cleanText(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function onlyDigits(s: string) {
  return (s || "").replace(/\D+/g, "");
}

export default function Login() {
  const [screen, setScreen] = useState<Screen>("login");
  const [loading, setLoading] = useState(false);

  // -----------------------
  // LOGIN
  // -----------------------
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // -----------------------
  // SIGNUP ADMIN (empresa)
  // -----------------------
  const [adminName, setAdminName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");

  // -----------------------
  // SIGNUP DRIVER (entregador)
  // -----------------------
  const [companyCode, setCompanyCode] = useState(""); // 11 dígitos
  const [driverName, setDriverName] = useState("");
  const [driverPlate, setDriverPlate] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPass, setDriverPass] = useState("");

  // feedback (pra não ficar “mudo”)
  const [hint, setHint] = useState<string | null>(null);

  const canLogin = useMemo(() => {
    return cleanText(email).includes("@") && cleanText(password).length >= 6;
  }, [email, password]);

  async function doLogin() {
    setHint(null);
    if (!canLogin) {
      setHint("Informe um email válido e uma senha com pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanText(email),
        password,
      });
      if (error) throw error;
      // App.tsx cuida do resto via session
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function resetSignupForms() {
    setAdminName("");
    setCompanyName("");
    setCnpj("");
    setAdminEmail("");
    setAdminPass("");

    setCompanyCode("");
    setDriverName("");
    setDriverPlate("");
    setDriverEmail("");
    setDriverPass("");

    setHint(null);
  }

  function backToLogin() {
    resetSignupForms();
    setScreen("login");
  }

  // -----------------------
  // SIGNUP: ADMIN
  // -----------------------
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

  function whyAdminInvalid(): string | null {
    if (cleanText(adminName).length < 2) return "Preencha o nome do responsável.";
    if (cleanText(companyName).length < 2) return "Preencha o nome da empresa.";
    if (onlyDigits(cnpj).length < 14) return "CNPJ deve ter 14 dígitos (somente números).";
    if (!cleanText(adminEmail).includes("@")) return "Email inválido.";
    if (cleanText(adminPass).length < 6) return "Senha deve ter no mínimo 6 caracteres.";
    return null;
  }

  async function signupAdmin() {
    setHint(null);

    const msg = whyAdminInvalid();
    if (msg) {
      setHint(msg);
      return;
    }

    setLoading(true);
    try {
      const e = cleanText(adminEmail);
      const p = adminPass;

      // 1) cria usuário auth
      const { data, error } = await supabase.auth.signUp({
        email: e,
        password: p,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error("Falha ao criar usuário.");

      // 2) profile como admin
      // ⚠️ Se você ainda NÃO tem colunas company_name/company_cnpj no profiles,
      // remova essas duas linhas para não falhar.
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
      backToLogin();
      setEmail(e);
      setPassword("");
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // -----------------------
  // SIGNUP: DRIVER
  // -----------------------
  const canSignupDriver = useMemo(() => {
    const e = cleanText(driverEmail);
    const p = cleanText(driverPass);
    return (
      onlyDigits(companyCode).length === 11 &&
      cleanText(driverName).length >= 2 &&
      cleanText(driverPlate).length >= 6 &&
      e.includes("@") &&
      p.length >= 6
    );
  }, [companyCode, driverName, driverPlate, driverEmail, driverPass]);

  function whyDriverInvalid(): string | null {
    if (onlyDigits(companyCode).length !== 11) return "Código da empresa deve ter 11 dígitos.";
    if (cleanText(driverName).length < 2) return "Preencha o nome do entregador.";
    if (cleanText(driverPlate).length < 6) return "Placa inválida (ex: ABC1D23).";
    if (!cleanText(driverEmail).includes("@")) return "Email inválido.";
    if (cleanText(driverPass).length < 6) return "Senha deve ter no mínimo 6 caracteres.";
    return null;
  }

  async function signupDriver() {
    setHint(null);

    const msg = whyDriverInvalid();
    if (msg) {
      setHint(msg);
      return;
    }

    setLoading(true);
    try {
      const code = onlyDigits(companyCode);

      // TODO: validar código e buscar adminId
      // Exemplo:
      // const { data: cc, error: ccErr } = await supabase
      //   .from("company_codes")
      //   .select("owner_id")
      //   .eq("code", code)
      //   .single();
      // if (ccErr) throw new Error("Código da empresa inválido.");
      // const adminId = cc.owner_id;

      const adminId = null as any;
      if (!adminId) {
        throw new Error(
          `Validação do código (${code}) ainda não foi configurada.`
        );
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanText(driverEmail),
        password: driverPass,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error("Falha ao criar usuário.");

      const payload: any = {
        id: userId,
        role: "driver",
        display_name: cleanText(driverName),
        vehicle_plate: cleanText(driverPlate).toUpperCase(),
        company_owner_id: adminId,
        driver_status: "offline",
        queue_position: null,
      };

      const up = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (up.error) {
        const upd = await supabase.from("profiles").update(payload).eq("id", userId);
        if (upd.error) throw upd.error;
      }

      alert("Conta de entregador criada. Agora faça login.");
      backToLogin();
      setEmail(cleanText(driverEmail));
      setPassword("");
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // -----------------------
  // UI
  // -----------------------
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
              <div className="muted">Gestão inteligente de entregas</div>
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
            />

            {hint && (
              <div className="muted" style={{ marginTop: 10 }}>
                <b>{hint}</b>
              </div>
            )}

            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                className="primary"
                onClick={doLogin}
                disabled={loading}
              >
                {loading ? "..." : "Entrar"}
              </button>

              <button
                type="button"
                className="ghost"
                onClick={() => {
                  resetSignupForms();
                  setScreen("choose");
                }}
                disabled={loading}
              >
                Criar conta
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "choose" && (
        <div className="card">
          <div className="row space">
            <b>Criar conta</b>
            <button type="button" className="ghost" onClick={backToLogin} disabled={loading}>
              ← Voltar
            </button>
          </div>

          <p className="muted" style={{ marginTop: 10 }}>Escolha o tipo de acesso.</p>

          <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setHint(null);
                setScreen("signup_admin");
              }}
              disabled={loading}
            >
              Sou Empresa
            </button>

            <button
              type="button"
              className="ghost"
              onClick={() => {
                setHint(null);
                setScreen("signup_driver");
              }}
              disabled={loading}
            >
              Sou Entregador
            </button>
          </div>
        </div>
      )}

      {screen === "signup_admin" && (
        <div className="card">
          <div className="row space">
            <b>Cadastro da Empresa</b>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setHint(null);
                setScreen("choose");
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

            {hint && (
              <div className="muted" style={{ marginTop: 10 }}>
                <b>{hint}</b>
              </div>
            )}

            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                className="primary"
                onClick={signupAdmin}
                disabled={loading}
              >
                {loading ? "..." : "Criar conta"}
              </button>

              <button type="button" className="ghost" onClick={backToLogin} disabled={loading}>
                Cancelar
              </button>
            </div>

            <p className="muted" style={{ marginTop: 10 }}>
              * Depois de criar, volte e faça login.
            </p>
          </div>
        </div>
      )}

      {screen === "signup_driver" && (
        <div className="card">
          <div className="row space">
            <b>Cadastro do Entregador</b>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setHint(null);
                setScreen("choose");
              }}
              disabled={loading}
            >
              ← Voltar
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Código da empresa (11 dígitos)</label>
            <input
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
              placeholder="Ex: 12345678901"
            />

            <label>Nome</label>
            <input value={driverName} onChange={(e) => setDriverName(e.target.value)} />

            <label>Placa</label>
            <input
              value={driverPlate}
              onChange={(e) => setDriverPlate(e.target.value.toUpperCase())}
              placeholder="ABC1D23"
            />

            <label>Email</label>
            <input value={driverEmail} onChange={(e) => setDriverEmail(e.target.value)} />

            <label>Senha</label>
            <input
              value={driverPass}
              type="password"
              onChange={(e) => setDriverPass(e.target.value)}
            />

            {hint && (
              <div className="muted" style={{ marginTop: 10 }}>
                <b>{hint}</b>
              </div>
            )}

            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                className="primary"
                onClick={signupDriver}
                disabled={loading}
              >
                {loading ? "..." : "Criar conta"}
              </button>

              <button type="button" className="ghost" onClick={backToLogin} disabled={loading}>
                Cancelar
              </button>
            </div>

            <p className="muted" style={{ marginTop: 10 }}>
              * Precisa do código da empresa para vincular ao admin corretamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}