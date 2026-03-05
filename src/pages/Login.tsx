import React, { useState } from "react";
import { supabase } from "../lib/supabase";

type SignUpRole = "admin" | "driver";

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

function cleanText(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function random11Digits() {
  // 11 dígitos (não começa com 0 pra ficar mais “real”)
  const first = String(Math.floor(Math.random() * 9) + 1);
  let rest = "";
  for (let i = 0; i < 10; i++) rest += String(Math.floor(Math.random() * 10));
  return first + rest;
}

async function generateUniqueCompanyCode(): Promise<string> {
  // tenta algumas vezes garantir unicidade
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = random11Digits();

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_code", code)
      .maybeSingle();

    if (error) {
      // se der erro de schema/policy, melhor explodir com msg clara
      throw error;
    }

    // se não achou ninguém, é único
    if (!data) return code;
  }

  // fallback (muito improvável)
  return random11Digits();
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 🔹 NOVO: tipo de cadastro
  const [role, setRole] = useState<SignUpRole>("admin");

  // 🔹 NOVO: campos do entregador
  const [companyCode, setCompanyCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");

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

    try {
      const emailClean = email.trim();
      if (!emailClean) throw new Error("Digite um email válido.");
      if (!password || password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");

      // validações específicas do entregador
      const code = onlyDigits(companyCode);
      if (role === "driver") {
        if (code.length !== 11) throw new Error("Digite o código da empresa com 11 dígitos.");
        if (!cleanText(displayName)) throw new Error("Digite o nome do entregador.");
        if (!cleanText(vehiclePlate)) throw new Error("Digite a placa do veículo.");
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailClean,
        password,
      });

      if (error) throw error;

      const user = data.user;
      if (!user?.id) {
        // Em alguns projetos com confirmação de e-mail, o user pode vir nulo.
        // Mesmo assim a conta pode ter sido criada.
        alert("Conta criada. Se seu projeto exige confirmação por e-mail, confirme e depois faça login.");
        return;
      }

      // 🔹 Descobre vínculo se for driver
      let ownerId: string | null = null;

      if (role === "driver") {
        const { data: owner, error: ownerErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin")
          .eq("company_code", code)
          .single();

        if (ownerErr) {
          throw new Error("Código da empresa inválido (admin não encontrado).");
        }

        ownerId = owner.id;
      }

      // 🔹 Gera company_code se for admin
      let myCompanyCode: string | null = null;
      if (role === "admin") {
        myCompanyCode = await generateUniqueCompanyCode();
      }

      // 🔹 Cria/atualiza profile (UPSERT)
      const profilePayload: any = {
        id: user.id,
        role: role,
        display_name: role === "driver" ? cleanText(displayName) : null,
        vehicle_plate: role === "driver" ? cleanText(vehiclePlate) : null,
        company_owner_id: role === "driver" ? ownerId : null,
        company_code: role === "admin" ? myCompanyCode : null,
        driver_status: role === "driver" ? "offline" : null,
        queue_position: role === "driver" ? null : null,
      };

      const up = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" });

      if (up.error) throw up.error;

      // limpa campos
      setPassword("");
      setCompanyCode("");
      setDisplayName("");
      setVehiclePlate("");

      if (role === "admin") {
        alert(
          `Empresa criada com sucesso!\n\nSeu código da empresa (11 dígitos): ${myCompanyCode}\n\nGuarde esse código para cadastrar entregadores.`
        );
      } else {
        alert("Entregador criado com sucesso! Agora é só entrar com email e senha.");
      }
    } catch (err: any) {
      alert(err?.message || String(err));
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

          <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "..." : "Entrar"}
            </button>

            <button type="button" className="ghost" onClick={signUp} disabled={loading}>
              Criar conta
            </button>
          </div>

          {/* 🔹 NOVO: modo de cadastro (fica na mesma tela, sem mudar fluxo de login) */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="row space">
              <b>Tipo de cadastro</b>
              <span className="muted">{role === "admin" ? "Empresa (Admin)" : "Entregador"}</span>
            </div>

            <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className={role === "admin" ? "primary" : "ghost"}
                disabled={loading}
                onClick={() => setRole("admin")}
              >
                🏢 Empresa
              </button>
              <button
                type="button"
                className={role === "driver" ? "primary" : "ghost"}
                disabled={loading}
                onClick={() => setRole("driver")}
              >
                🛵 Entregador
              </button>
            </div>

            {role === "admin" && (
              <div className="muted" style={{ marginTop: 10 }}>
                * Ao criar empresa, o sistema gera um <b>código de 11 dígitos</b> para cadastrar entregadores.
              </div>
            )}

            {role === "driver" && (
              <>
                <label>Código da empresa (11 dígitos)</label>
                <input
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  placeholder="ex: 12345678901"
                />

                <label>Nome do entregador</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="ex: João Silva"
                />

                <label>Placa do veículo</label>
                <input
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="ex: ABC1D23"
                />

                <div className="muted" style={{ marginTop: 10 }}>
                  * O entregador será vinculado automaticamente à empresa do código informado.
                </div>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}