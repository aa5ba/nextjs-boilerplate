import { supabase } from "@/lib/supabaseClient";

export async function getOrganizationName() {
  const { data, error } = await supabase
    .from("finance_settings")
    .select("setting_value")
    .eq("setting_key", "organization_name")
    .single();

  if (error || !data) {
    return "احتساب";
  }

  return data.setting_value || "احتساب";
}
