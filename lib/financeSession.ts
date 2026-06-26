export type FinanceSessionUser = {
  id: string;
  full_name: string;
  username: string;
  role: string;
  branch_id: string;
  branch_slug: string;
  branch_name: string;
  organization_name: string;
  permissions: string[];
  investor_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
};

export type FinanceSessionValidationResult = {
  valid: boolean;
  expired: boolean;
  user: FinanceSessionUser | null;
  reason:
    | ""
    | "NO_SESSION"
    | "INVALID_SESSION"
    | "INACTIVE_USER"
    | "SESSION_EXPIRED"
    | "BRANCH_MISMATCH";
};

export type FinanceRouterLike = {
  replace: (href: string) => void;
  push?: (href: string) => void;
  prefetch?: (href: string) => void;
};

export const FINANCE_SESSION_DURATION_MS =
  3 * 60 * 60 * 1000;

export const FINANCE_ACTIVITY_UPDATE_INTERVAL_MS =
  60 * 1000;

export const FINANCE_SESSION_KEYS = [
  "finance_user",
  "finance_branch_user",
  "finance_user_id",
  "finance_user_name",
  "finance_username",
  "finance_role",
  "finance_branch_id",
  "finance_branch_slug",
  "finance_branch_name",
  "finance_organization_name",
  "finance_permissions",
  "finance_investor_id",
  "finance_is_active",
  "finance_last_login_at",
  "finance_session_expires_at",
  "finance_last_activity_at",
  "finance_return_to",
] as const;

function isBrowser() {
  return typeof window !== "undefined";
}

function cleanString(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function readLocalStorageValue(key: string) {
  if (!isBrowser()) {
    return "";
  }

  return localStorage.getItem(key) || "";
}

function parsePermissions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter(
        (permission): permission is string =>
          typeof permission === "string"
      )
      .map((permission) => permission.trim())
      .filter(Boolean);
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (permission): permission is string =>
          typeof permission === "string"
      )
      .map((permission) => permission.trim())
      .filter(Boolean);
  } catch {
    return value
      .split(",")
      .map((permission) => permission.trim())
      .filter(Boolean);
  }
}

function normalizeBoolean(
  value: unknown,
  fallback = true
) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function normalizeNullableString(value: unknown) {
  const normalized = cleanString(value);

  return normalized || null;
}

function readRawFinanceSession(): Record<string, unknown> | null {
  if (!isBrowser()) {
    return null;
  }

  const rawSession =
    localStorage.getItem("finance_branch_user") ||
    localStorage.getItem("finance_user");

  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readFinanceSession():
  | FinanceSessionUser
  | null {
  if (!isBrowser()) {
    return null;
  }

  const stored = readRawFinanceSession();

  if (!stored) {
    return null;
  }

  const id =
    cleanString(stored.id) ||
    cleanString(stored.user_id) ||
    cleanString(
      readLocalStorageValue("finance_user_id")
    );

  const branchId =
    cleanString(stored.branch_id) ||
    cleanString(
      readLocalStorageValue("finance_branch_id")
    );

  const branchSlug =
    cleanString(stored.branch_slug) ||
    cleanString(
      readLocalStorageValue("finance_branch_slug")
    );

  const fullName =
    cleanString(stored.full_name) ||
    cleanString(stored.name) ||
    cleanString(
      readLocalStorageValue("finance_user_name")
    );

  const username =
    cleanString(stored.username) ||
    cleanString(
      readLocalStorageValue("finance_username")
    );

  const role =
    cleanString(stored.role) ||
    cleanString(
      readLocalStorageValue("finance_role")
    );

  const branchName =
    cleanString(stored.branch_name) ||
    cleanString(
      readLocalStorageValue("finance_branch_name")
    );

  const organizationName =
    cleanString(stored.organization_name) ||
    cleanString(
      readLocalStorageValue(
        "finance_organization_name"
      )
    );

  const permissions =
    parsePermissions(stored.permissions).length > 0
      ? parsePermissions(stored.permissions)
      : parsePermissions(
          readLocalStorageValue(
            "finance_permissions"
          )
        );

  const investorId =
    normalizeNullableString(stored.investor_id) ||
    normalizeNullableString(
      readLocalStorageValue(
        "finance_investor_id"
      )
    );

  const storedActive =
    stored.is_active !== undefined
      ? stored.is_active
      : readLocalStorageValue(
          "finance_is_active"
        );

  const isActive = normalizeBoolean(
    storedActive,
    true
  );

  const lastLoginAt =
    normalizeNullableString(
      stored.last_login_at
    ) ||
    normalizeNullableString(
      readLocalStorageValue(
        "finance_last_login_at"
      )
    );

  if (!id) {
    return null;
  }

  return {
    id,
    full_name: fullName,
    username,
    role,
    branch_id: branchId,
    branch_slug: branchSlug,
    branch_name: branchName,
    organization_name: organizationName,
    permissions,
    investor_id: investorId,
    is_active: isActive,
    last_login_at: lastLoginAt,
  };
}

export function saveFinanceSession(
  user: FinanceSessionUser,
  options?: {
    preserveReturnPath?: boolean;
    expiresAt?: number;
  }
) {
  if (!isBrowser()) {
    return;
  }

  const normalizedUser: FinanceSessionUser = {
    id: cleanString(user.id),
    full_name: cleanString(user.full_name),
    username: cleanString(user.username),
    role: cleanString(user.role),
    branch_id: cleanString(user.branch_id),
    branch_slug: cleanString(user.branch_slug),
    branch_name: cleanString(user.branch_name),
    organization_name: cleanString(
      user.organization_name
    ),
    permissions: parsePermissions(
      user.permissions
    ),
    investor_id:
      normalizeNullableString(
        user.investor_id
      ),
    is_active:
      user.is_active !== false,
    last_login_at:
      normalizeNullableString(
        user.last_login_at
      ),
  };

  const existingReturnPath =
    options?.preserveReturnPath
      ? localStorage.getItem(
          "finance_return_to"
        )
      : null;

  const serializedUser =
    JSON.stringify(normalizedUser);

  const now = Date.now();

  const expiresAt =
    options?.expiresAt &&
    Number.isFinite(options.expiresAt)
      ? options.expiresAt
      : now +
        FINANCE_SESSION_DURATION_MS;

  localStorage.setItem(
    "finance_user",
    serializedUser
  );

  localStorage.setItem(
    "finance_branch_user",
    serializedUser
  );

  localStorage.setItem(
    "finance_user_id",
    normalizedUser.id
  );

  localStorage.setItem(
    "finance_user_name",
    normalizedUser.full_name
  );

  localStorage.setItem(
    "finance_username",
    normalizedUser.username
  );

  localStorage.setItem(
    "finance_role",
    normalizedUser.role
  );

  localStorage.setItem(
    "finance_branch_id",
    normalizedUser.branch_id
  );

  localStorage.setItem(
    "finance_branch_slug",
    normalizedUser.branch_slug
  );

  localStorage.setItem(
    "finance_branch_name",
    normalizedUser.branch_name
  );

  localStorage.setItem(
    "finance_organization_name",
    normalizedUser.organization_name
  );

  localStorage.setItem(
    "finance_permissions",
    JSON.stringify(
      normalizedUser.permissions
    )
  );

  localStorage.setItem(
    "finance_investor_id",
    normalizedUser.investor_id || ""
  );

  localStorage.setItem(
    "finance_is_active",
    normalizedUser.is_active
      ? "true"
      : "false"
  );

  localStorage.setItem(
    "finance_last_login_at",
    normalizedUser.last_login_at || ""
  );

  localStorage.setItem(
    "finance_last_activity_at",
    String(now)
  );

  localStorage.setItem(
    "finance_session_expires_at",
    String(expiresAt)
  );

  if (
    options?.preserveReturnPath &&
    existingReturnPath
  ) {
    localStorage.setItem(
      "finance_return_to",
      existingReturnPath
    );
  }
}

export function clearFinanceSession(
  options?: {
    preserveReturnPath?: boolean;
  }
) {
  if (!isBrowser()) {
    return;
  }

  FINANCE_SESSION_KEYS.forEach((key) => {
    if (
      options?.preserveReturnPath &&
      key === "finance_return_to"
    ) {
      return;
    }

    localStorage.removeItem(key);
  });
}

export function getFinanceSessionExpiresAt() {
  if (!isBrowser()) {
    return 0;
  }

  const value = Number(
    localStorage.getItem(
      "finance_session_expires_at"
    ) || "0"
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

export function getFinanceLastActivityAt() {
  if (!isBrowser()) {
    return 0;
  }

  const value = Number(
    localStorage.getItem(
      "finance_last_activity_at"
    ) || "0"
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

export function isFinanceSessionExpired() {
  const expiresAt =
    getFinanceSessionExpiresAt();

  if (!expiresAt) {
    return true;
  }

  return Date.now() >= expiresAt;
}

export function renewFinanceSession(
  force = false
) {
  if (!isBrowser()) {
    return false;
  }

  const session =
    readFinanceSession();

  if (
    !session ||
    !session.id ||
    session.is_active === false
  ) {
    return false;
  }

  const currentExpiresAt =
    getFinanceSessionExpiresAt();

  if (
    currentExpiresAt > 0 &&
    Date.now() >= currentExpiresAt
  ) {
    return false;
  }

  const now = Date.now();

  const lastActivityAt =
    getFinanceLastActivityAt();

  if (
    !force &&
    lastActivityAt > 0 &&
    now - lastActivityAt <
      FINANCE_ACTIVITY_UPDATE_INTERVAL_MS
  ) {
    return true;
  }

  localStorage.setItem(
    "finance_last_activity_at",
    String(now)
  );

  localStorage.setItem(
    "finance_session_expires_at",
    String(
      now +
        FINANCE_SESSION_DURATION_MS
    )
  );

  return true;
}

export function validateFinanceSession(
  expectedBranchSlug?: string
): FinanceSessionValidationResult {
  const user =
    readFinanceSession();

  if (!user) {
    return {
      valid: false,
      expired: false,
      user: null,
      reason: "NO_SESSION",
    };
  }

  if (!user.id) {
    return {
      valid: false,
      expired: false,
      user,
      reason: "INVALID_SESSION",
    };
  }

  if (user.is_active === false) {
    return {
      valid: false,
      expired: false,
      user,
      reason: "INACTIVE_USER",
    };
  }

  const expiresAt =
    getFinanceSessionExpiresAt();

  if (
    !expiresAt ||
    Date.now() >= expiresAt
  ) {
    return {
      valid: false,
      expired: true,
      user,
      reason: "SESSION_EXPIRED",
    };
  }

  const normalizedExpectedBranch =
    cleanString(expectedBranchSlug);

  if (
    normalizedExpectedBranch &&
    user.branch_slug &&
    user.branch_slug !==
      normalizedExpectedBranch
  ) {
    return {
      valid: false,
      expired: false,
      user,
      reason: "BRANCH_MISMATCH",
    };
  }

  return {
    valid: true,
    expired: false,
    user,
    reason: "",
  };
}

export function normalizeFinanceReturnPath(
  value?: string | null
) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

export function isSafeFinanceReturnPath(
  value: string,
  branchSlug?: string
) {
  const normalizedPath =
    normalizeFinanceReturnPath(value);

  if (
    !normalizedPath ||
    !normalizedPath.startsWith("/") ||
    normalizedPath.startsWith("//") ||
    normalizedPath.includes("://") ||
    normalizedPath.includes("\\")
  ) {
    return false;
  }

  const normalizedBranchSlug =
    cleanString(branchSlug);

  if (!normalizedBranchSlug) {
    return normalizedPath.startsWith(
      "/finance/"
    );
  }

  const branchBasePath =
    `/finance/${normalizedBranchSlug}`;

  return (
    normalizedPath ===
      branchBasePath ||
    normalizedPath.startsWith(
      `${branchBasePath}/`
    ) ||
    normalizedPath.startsWith(
      `${branchBasePath}?`
    )
  );
}

export function getCurrentFinanceReturnPath() {
  if (!isBrowser()) {
    return "";
  }

  const returnPath =
    `${window.location.pathname}${window.location.search}`;

  return returnPath;
}

export function saveFinanceReturnPath(
  path?: string,
  branchSlug?: string
) {
  if (!isBrowser()) {
    return "";
  }

  const returnPath =
    normalizeFinanceReturnPath(
      path ||
        getCurrentFinanceReturnPath()
    );

  if (
    !isSafeFinanceReturnPath(
      returnPath,
      branchSlug
    )
  ) {
    return "";
  }

  localStorage.setItem(
    "finance_return_to",
    returnPath
  );

  return returnPath;
}

export function getSavedFinanceReturnPath(
  branchSlug?: string
) {
  if (!isBrowser()) {
    return "";
  }

  const returnPath =
    normalizeFinanceReturnPath(
      localStorage.getItem(
        "finance_return_to"
      )
    );

  if (
    !isSafeFinanceReturnPath(
      returnPath,
      branchSlug
    )
  ) {
    return "";
  }

  return returnPath;
}

export function removeFinanceReturnPath() {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(
    "finance_return_to"
  );
}

export function redirectToFinanceLogin(
  router: FinanceRouterLike,
  options?: {
    branchSlug?: string;
    returnPath?: string;
    preserveReturnPath?: boolean;
  }
) {
  const preserveReturnPath =
    options?.preserveReturnPath !== false;

  let returnPath = "";

  if (preserveReturnPath) {
    returnPath =
      saveFinanceReturnPath(
        options?.returnPath,
        options?.branchSlug
      );
  }

  clearFinanceSession({
    preserveReturnPath,
  });

  if (returnPath) {
    router.replace(
      `/login?returnTo=${encodeURIComponent(
        returnPath
      )}`
    );

    return;
  }

  router.replace("/login");
}

export function logoutFinanceUser(
  router: FinanceRouterLike
) {
  clearFinanceSession();
  router.replace("/login");
}

export function getFinanceEmployeeName(
  user?: FinanceSessionUser | null
) {
  if (!isBrowser()) {
    return (
      user?.full_name ||
      user?.username ||
      "الموظف"
    );
  }

  return (
    cleanString(
      localStorage.getItem(
        "finance_user_name"
      )
    ) ||
    cleanString(user?.full_name) ||
    cleanString(user?.username) ||
    "الموظف"
  );
}

export function getFinancePermissions(
  user?: FinanceSessionUser | null
) {
  if (
    user?.permissions &&
    user.permissions.length > 0
  ) {
    return parsePermissions(
      user.permissions
    );
  }

  if (!isBrowser()) {
    return [];
  }

  return parsePermissions(
    localStorage.getItem(
      "finance_permissions"
    )
  );
}

export function getFinanceRole(
  user?: FinanceSessionUser | null
) {
  if (!isBrowser()) {
    return cleanString(user?.role);
  }

  return (
    cleanString(user?.role) ||
    cleanString(
      localStorage.getItem(
        "finance_role"
      )
    )
  );
}

export function installFinanceActivityTracker(
  options?: {
    onExpired?: () => void;
  }
) {
  if (!isBrowser()) {
    return () => {};
  }

  let lastHandledAt = 0;

  const handleActivity = () => {
    const now = Date.now();

    if (
      now - lastHandledAt <
      FINANCE_ACTIVITY_UPDATE_INTERVAL_MS
    ) {
      return;
    }

    lastHandledAt = now;

    if (isFinanceSessionExpired()) {
      options?.onExpired?.();
      return;
    }

    renewFinanceSession();
  };

  const handleVisibilityChange = () => {
    if (
      document.visibilityState ===
      "visible"
    ) {
      handleActivity();
    }
  };

  const events: Array<
    keyof WindowEventMap
  > = [
    "click",
    "keydown",
    "touchstart",
    "scroll",
    "mousemove",
  ];

  events.forEach((eventName) => {
    window.addEventListener(
      eventName,
      handleActivity,
      {
        passive: true,
      }
    );
  });

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  const expirationCheckInterval =
    window.setInterval(() => {
      if (
        isFinanceSessionExpired()
      ) {
        options?.onExpired?.();
      }
    }, 60 * 1000);

  return () => {
    events.forEach((eventName) => {
      window.removeEventListener(
        eventName,
        handleActivity
      );
    });

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.clearInterval(
      expirationCheckInterval
    );
  };
}
