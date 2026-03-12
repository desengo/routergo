import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Conexão Supabase
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

// Função para validar endereço mínimo
function validateAddress(addr: { street?: string; city?: string; state?: string }) {
  return addr.street && addr.city && addr.state;
}

// Endpoint raiz
app.get("/", (_req, res) => {
  res.send("Anote Backend rodando");
});

// Criar pedido
app.post("/orders", async (req, res) => {
  try {
    const {
      company_id,
      module,
      recipient = "",
      street = "",
      number = "",
      complement = "",
      neighborhood = "",
      city = "",
      state = "",
      zipCode = "",
      rawText = "",
      sendToRouterGo = false
    } = req.body;

    // Valida endereço mínimo
    if (!validateAddress({ street, city, state })) {
      return res.status(400).json({ error: "Endereço insuficiente" });
    }

    // Salva pedido no Supabase
    const { data, error } = await supabase.from("orders").insert([{
      company_id,
      module,
      recipient,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      zip_code: zipCode,
      raw_text: rawText,
      created_at: new Date()
    }]);
    if (error) throw error;

    // Integração opcional com RouterGo
    if (sendToRouterGo && process.env.ROUTERGO_API_KEY && process.env.ROUTERGO_URL) {
      await fetch(process.env.ROUTERGO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ROUTERGO_API_KEY
        },
        body: JSON.stringify({ recipient, street, number, complement, neighborhood, city, state, zipCode, rawText })
      });
    }

    res.json({ success: true, order: data[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Listar pedidos
app.get("/orders", async (req, res) => {
  try {
    const { company_id, module } = req.query;
    let query = supabase.from("orders").select("*");
    if (company_id) query = query.eq("company_id", company_id);
    if (module) query = query.eq("module", module);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ orders: data });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Rodar backend
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Anote Backend rodando na porta ${PORT}`));