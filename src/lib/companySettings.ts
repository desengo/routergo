import { supabase } from "./supabase";

export type DemandMode = "alta" | "media" | "baixa" | "manual";

export type CompanySettings = {
  demand_mode: DemandMode;
  delivery_radius_km: number;
};

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const userId = await getUserId();
  if (!userId) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("company_settings")
    .select("demand_mode, delivery_radius_km")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    // Se não existir, cria padrão
    const defaults = {
      user_id: userId,
      demand_mode: "media",
      delivery_radius_km: 1.2,
    };

    await supabase.from("company_settings").insert(defaults);

    return {
      demand_mode: "media",
      delivery_radius_km: 1.2,
    };
  }

  return data as CompanySettings;
}

export async function updateCompanySettings(settings: CompanySettings) {
  const userId = await getUserId();
  if (!userId) throw new Error("Usuário não autenticado.");

  const { error } = await supabase
    .from("company_settings")
    .update({
      demand_mode: settings.demand_mode,
      delivery_radius_km: settings.delivery_radius_km,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw error;
}
