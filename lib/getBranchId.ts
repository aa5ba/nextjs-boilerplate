import { supabase } from "@/lib/supabaseClient";

export async function getBranchId(branchSlug: string) {
  const { data } = await supabase
    .from("finance_branches")
    .select("id")
    .eq("branch_slug", branchSlug)
    .single();

  return data?.id || null;
}
