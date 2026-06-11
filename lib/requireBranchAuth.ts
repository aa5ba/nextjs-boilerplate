import { getBranchUser } from "./getBranchUser";

export function requireBranchAuth() {
  const user = getBranchUser();

  if (!user?.id) {
    window.location.href = "/login";
    return null;
  }

  return user;
}
