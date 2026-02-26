import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltando VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY nas env vars.");
}

/**
 * Em alguns Android/Chrome, o Supabase pode travar usando navigator.locks
 * ao acessar o storage do token. Usar sessionStorage reduz esse problema.
 * (Sessão permanece enquanto a aba estiver aberta.)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
    storage: window.sessionStorage
  }
});