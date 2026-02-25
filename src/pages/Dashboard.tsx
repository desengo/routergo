for (let i = 0; i < plans.length; i++) {
  const p = plans[i];

  const ins = await supabase.from("routes").insert({
    name: `Rota ${i + 1}`,
    delivery_ids: p.delivery_ids,
    total_est_km: p.total_est_km
  });

  if (ins.error) {
    alert(
      "ERRO AO SALVAR ROTA:\n" +
        ins.error.message +
        (ins.error.details ? "\n" + ins.error.details : "")
    );
    return;
  }
}