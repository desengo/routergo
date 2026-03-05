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
      // App.tsx já cuida do resto pelo session.
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

  async function signupAdmin() {
    if (!canSignupAdmin) return;
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

      // 2) cria/atualiza profile como admin
      // ✅ SOLUÇÃO: NÃO enviar colunas que não existem no profiles (company_name/company_cnpj)
      // Você ainda coleta esses campos na UI, mas por enquanto não grava no profiles.
      const payload: any = {
        id: userId,
        role: "admin",
        display_name: cleanText(adminName),
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

  async function signupDriver() {
    if (!canSignupDriver) return;
    setLoading(true);
    try {
      // ✅ Aqui você precisa decidir como validar o código de empresa (11 dígitos)
      // Recomendado:
      // - Tabela: company_codes { code text pk, owner_id uuid }
      // - Buscar owner_id pelo code e gravar company_owner_id no profile do driver.
      //
      // POR ENQUANTO: placeholder (vai acusar erro até você implementar company_codes).
      const code = onlyDigits(companyCode);

      // TODO: buscar adminId a partir do code
      // const { data: cc, error: ccErr } = await supabase
      //   .from("company_codes")
      //   .select("owner_id")
      //   .eq("code", code)
      //   .single();
      // if (ccErr) throw new Error("Código da empresa inválido.");
      // const adminId = cc.owner_id;

      const adminId = null; // <- substitua quando criar a tabela/validação
      if (!adminId) {
        throw new Error(
          "Validação do código da empresa ainda não foi configurada. Crie a tabela company_codes (code -> owner_id) e ligue aqui."
        );
      }

      // 1) cria usuário auth
      const { data, error } = await supabase.auth.signUp({
        email: cleanText(driverEmail),
        password: driverPass,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error("Falha ao criar usuário.");

      // 2) cria/atualiza profile como driver + vincula ao admin
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
      {/* CARD ÚNICO: LOGIN */}
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

            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button className="primary" onClick={doLogin} disabled={loading || !canLogin}>
                {loading ? "..." : "Entrar"}
              </button>

              <button
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

      {/* CARD: ESCOLHER TIPO DE CONTA */}
      {screen === "choose" && (
        <div className="card">
          <div className="row space">
            <b>Criar conta</b>
            <button className="ghost" onClick={backToLogin} disabled={loading}>
              ← Voltar
            </button>
          </div>

          <p className="muted" style={{ marginTop: 10 }}>
            Escolha o tipo de acesso.
          </p>

          <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="primary" onClick={() => setScreen("signup_admin")} disabled={loading}>
              Sou Empresa
            </button>
            <button className="ghost" onClick={() => setScreen("signup_driver")} disabled={loading}>
              Sou Entregador
            </button>
          </div>
        </div>
      )}

      {/* CARD: SIGNUP ADMIN */}
      {screen === "signup_admin" && (
        <div className="card">
          <div className="row space">
            <b>Cadastro da Empresa</b>
            <button className="ghost" onClick={() => setScreen("choose")} disabled={loading}>
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
                className="primary"
                onClick={signupAdmin}
                disabled={loading || !canSignupAdmin}
              >
                {loading ? "..." : "Criar conta"}
              </button>
              <button className="ghost" onClick={backToLogin} disabled={loading}>
                Cancelar
              </button>
            </div>

            <p className="muted" style={{ marginTop: 10 }}>
              * Depois de criar, volte e faça login.
            </p>
          </div>
        </div>
      )}

      {/* CARD: SIGNUP DRIVER */}
      {screen === "signup_driver" && (
        <div className="card">
          <div className="row space">
            <b>Cadastro do Entregador</b>
            <button className="ghost" onClick={() => setScreen("choose")} disabled={loading}>
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

            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button
                className="primary"
                onClick={signupDriver}
                disabled={loading || !canSignupDriver}
              >
                {loading ? "..." : "Criar conta"}
              </button>
              <button className="ghost" onClick={backToLogin} disabled={loading}>
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