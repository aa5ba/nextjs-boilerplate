import { supabase } from "@/lib/supabaseClient";

export async function getOrganizationSettings() {
  try {
    const { data, error } = await supabase
      .from("finance_settings")
      .select("setting_key, setting_value");

    if (error || !data) {
      return {
        name: "احتساب",
        phone: "",
        city: "",
        commercialRecord: "",
      };
    }

    const getValue = (key: string) =>
      data.find((item) => item.setting_key === key)?.setting_value || "";

    return {
      name: getValue("organization_name") || "احتساب",
      phone: getValue("organization_phone"),
      city: getValue("organization_city"),
      commercialRecord: getValue("organization_commercial_record"),
    };
  } catch {
    return {
      name: "احتساب",
      phone: "",
      city: "",
      commercialRecord: "",
    };
  }
}
