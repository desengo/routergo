import React, { useState } from "react";
import { supabase } from "../lib/supabase";

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

// Validação simples (tamanho). Se quiser, eu coloco validação completa do dígito do CNPJ.
function isValidCnpj(cnpj: string) {
  const d = onlyDigits(cnpj);
  return d.length === 14;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ novos campos do cadastro da empresa
  const [responsibleName, setResponsibleName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");

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
    try {
      setLoading(true);

      const emailClean = email.trim();
      const responsibleClean = responsibleName.trim();
      const companyClean = companyName.trim();
      const cnpjClean = onlyDigits(cnpj);

      if (!emailClean) throw new Error("Digite um email.");
      if (!password || password.length < 6) throw new Error("Senha precisa ter pelo menos 6 caracteres.");
      if (!responsibleClean) throw new Error("Digite o nome do responsável.");
      if (!companyClean) throw new Error("Digite o nome da empresa.");
      if (!isValidCnpj(cnpjClean)) throw new Error("CNPJ inválido. Digite 14 números.");

      // 1) cria conta no Auth
      const { data, error } = await supabase.auth.signUp({
        email: emailClean,
        password,
      });
      if (error) throw error;

      // se o Supabase estiver com confirmação por email ligada,
      // pode não existir sessão ainda. Mas o user id normalmente vem em data.user.
      const userId = data.user?.id;
      if (!userId) {
        alert("Conta criada. Verifique seu email para confirmar e depois faça login.");
        return;
      }

      // 2) cria/atualiza profile como admin (se você já usa profiles)
      // Se sua tabela profiles não tiver essas colunas, me avise que eu ajusto.
      await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            role: "admin",
            display_name: responsibleClean,
            driver_status: "offline",
          },
          { onConflict: "id" }
        );

      // 3) salva dados da empresa na tabela companies
      const { error: cErr } = await supabase.from("companies").insert({
        user_id: userId,
        responsible_name: responsibleClean,
        company_name: companyClean,
        cnpj: cnpjClean,
        email: emailClean,
      });

      if (cErr) {
        // se falhar por CNPJ duplicado, já dá uma mensagem boa
        const msg = (cErr as any)?.message || "Erro ao salvar empresa.";
        throw new Error(msg);
      }

      // limpa campos
      setResponsibleName("");
      setCompanyName("");
      setCnpj("");

      alert("Empresa cadastrada com sucesso! ✅");
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setLoading(false);
    }
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

          {/* ✅ Campos adicionais para cadastro de empresa (admin) */}
          <div className="hr" />

          <div className="muted" style={{ marginTop: 6 }}>
            Cadastro de empresa (Admin)
          </div>

          <label>Nome do responsável</label>
          <input
            value={responsibleName}
            onChange={(e) => setResponsibleName(e.target.value)}
            placeholder="Ex: João Silva"
          />

          <label>Nome da empresa</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Ex: XPTO Delivery"
          />

          <label>CNPJ</label>
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="Somente números"
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
              Criar conta (Empresa)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}