export function getBranchUser() {
  if (typeof window === "undefined") {
    return null;
  }

  return {
    id: localStorage.getItem("finance_user_id"),
    branchId: localStorage.getItem("finance_branch_id"),
    role: localStorage.getItem("finance_role"),
    fullName: localStorage.getItem("finance_user_name"),
    branchSlug: localStorage.getItem("finance_branch_slug"),
  };
}
