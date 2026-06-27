import { supabase } from "@/lib/supabaseClient";

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

  /*
   * الحقول التالية اختيارية للمحافظة على توافق
   * الصفحات القديمة وصفحة تسجيل الدخول الحالية.
   */
  manageable_permissions?: string[];
  phone?: string | null;
  theme_key?: string;
  session_version?: number;
  permissions_version?: number;
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
    | "BRANCH_MISMATCH"
    | "SESSION_REVOKED";
};

export type FinanceRemoteSessionCheckResult = {
  valid: boolean;
  updated: boolean;
  revoked: boolean;
  user: FinanceSessionUser | null;
  reason:
    | ""
    | "NO_SESSION"
    | "INVALID_SESSION"
    | "INACTIVE_USER"
    | "SESSION_EXPIRED"
    | "BRANCH_MISMATCH"
    | "SESSION_REVOKED"
    | "NETWORK_ERROR";
};

export type FinanceRouterLike = {
  replace: (href: string) => void;
  push?: (href: string) => void;
  prefetch?: (href: string) => void;
};

type FinanceSessionStateRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  role: string | null;
  branch_id: string;
  branch_slug: string | null;
  branch_name: string | null;
  organization_name: string | null;
  permissions: string[] | null;
  manageable_permissions: string[] | null;
  investor_id: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
  phone: string | null;
  theme_key: string | null;
  session_version: number | string | null;
  permissions_version: number | string | null;
};

export const FINANCE_SESSION_DURATION_MS =
  3 * 60 * 60 * 1000;

export const FINANCE_ACTIVITY_UPDATE_INTERVAL_MS =
  60 * 1000;

/*
 * الفحص البعيد كل دقيقة.
 * يمكن رفع المدة لاحقًا إذا أردت تقليل عدد الطلبات.
 */
export const FINANCE_REMOTE_SESSION_CHECK_INTERVAL_MS =
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
  "finance_manageable_permissions",
  "finance_investor_id",
  "finance_is_active",
  "finance_last_login_at",
  "finance_phone",
  "finance_theme_key",
  "finance_session_version",
  "finance_permissions_version",
  "finance_session_expires_at",
  "finance_last_activity_at",
  "finance_last_remote_check_at",
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
    return Array.from(
      new Set(
        value
          .filter(
            (
              permission
            ): permission is string =>
              typeof permission === "string"
          )
          .map((permission) =>
            permission.trim()
          )
          .filter(Boolean)
      )
    );
  }

  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return Array.from(
      new Set(
        parsed
          .filter(
            (
              permission
            ): permission is string =>
              typeof permission === "string"
          )
          .map((permission) =>
            permission.trim()
          )
          .filter(Boolean)
      )
    );
  } catch {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((permission) =>
            permission.trim()
          )
          .filter(Boolean)
      )
    );
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
    const normalized =
      value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function normalizeNullableString(
  value: unknown
) {
  const normalized = cleanString(value);

  return normalized || null;
}

function normalizeNonNegativeInteger(
  value: unknown,
  fallback = 0
) {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return fallback;
  }

  return Math.floor(parsed);
}

function readNumericStorageValue(
  key: string
) {
  if (!isBrowser()) {
    return 0;
  }

  return normalizeNonNegativeInteger(
    localStorage.getItem(key),
    0
  );
}

function readRawFinanceSession():
  | Record<string, unknown>
  | null {
  if (!isBrowser()) {
    return null;
  }

  const rawSession =
    localStorage.getItem(
      "finance_branch_user"
    ) ||
    localStorage.getItem(
      "finance_user"
    );

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

    return parsed as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function normalizeFinanceSessionUser(
  user: FinanceSessionUser
): FinanceSessionUser {
  return {
    id: cleanString(user.id),
    full_name: cleanString(
      user.full_name
    ),
    username: cleanString(
      user.username
    ),
    role: cleanString(user.role),
    branch_id: cleanString(
      user.branch_id
    ),
    branch_slug: cleanString(
      user.branch_slug
    ),
    branch_name: cleanString(
      user.branch_name
    ),
    organization_name: cleanString(
      user.organization_name
    ),
    permissions: parsePermissions(
      user.permissions
    ),
    manageable_permissions:
      parsePermissions(
        user.manageable_permissions
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
    phone:
      normalizeNullableString(
        user.phone
      ),
    theme_key:
      cleanString(user.theme_key) ||
      "professional",
    session_version:
      normalizeNonNegativeInteger(
        user.session_version,
        0
      ),
    permissions_version:
      normalizeNonNegativeInteger(
        user.permissions_version,
        0
      ),
  };
}

function writeFinanceUserStorage(
  user: FinanceSessionUser
) {
  if (!isBrowser()) {
    return;
  }

  const normalizedUser =
    normalizeFinanceSessionUser(user);

  const serializedUser =
    JSON.stringify(normalizedUser);

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
    "finance_manageable_permissions",
    JSON.stringify(
      normalizedUser
        .manageable_permissions || []
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
    "finance_phone",
    normalizedUser.phone || ""
  );

  localStorage.setItem(
    "finance_theme_key",
    normalizedUser.theme_key ||
      "professional"
  );

  localStorage.setItem(
    "finance_session_version",
    String(
      normalizeNonNegativeInteger(
        normalizedUser.session_version,
        0
      )
    )
  );

  localStorage.setItem(
    "finance_permissions_version",
    String(
      normalizeNonNegativeInteger(
        normalizedUser
          .permissions_version,
        0
      )
    )
  );
}

function financeUsersAreDifferent(
  currentUser: FinanceSessionUser,
  nextUser: FinanceSessionUser
) {
  return (
    JSON.stringify(
      normalizeFinanceSessionUser(
        currentUser
      )
    ) !==
    JSON.stringify(
      normalizeFinanceSessionUser(
        nextUser
      )
    )
  );
}

export function readFinanceSession():
  | FinanceSessionUser
  | null {
  if (!isBrowser()) {
    return null;
  }

  const stored =
    readRawFinanceSession();

  if (!stored) {
    return null;
  }

  const id =
    cleanString(stored.id) ||
    cleanString(stored.user_id) ||
    cleanString(
      readLocalStorageValue(
        "finance_user_id"
      )
    );

  const branchId =
    cleanString(stored.branch_id) ||
    cleanString(
      readLocalStorageValue(
        "finance_branch_id"
      )
    );

  const branchSlug =
    cleanString(stored.branch_slug) ||
    cleanString(
      readLocalStorageValue(
        "finance_branch_slug"
      )
    );

  const fullName =
    cleanString(stored.full_name) ||
    cleanString(stored.name) ||
    cleanString(
      readLocalStorageValue(
        "finance_user_name"
      )
    );

  const username =
    cleanString(stored.username) ||
    cleanString(
      readLocalStorageValue(
        "finance_username"
      )
    );

  const role =
    cleanString(stored.role) ||
    cleanString(
      readLocalStorageValue(
        "finance_role"
      )
    );

  const branchName =
    cleanString(stored.branch_name) ||
    cleanString(
      readLocalStorageValue(
        "finance_branch_name"
      )
    );

  const organizationName =
    cleanString(
      stored.organization_name
    ) ||
    cleanString(
      readLocalStorageValue(
        "finance_organization_name"
      )
    );

  const storedPermissions =
    parsePermissions(
      stored.permissions
    );

  const permissions =
    storedPermissions.length > 0
      ? storedPermissions
      : parsePermissions(
          readLocalStorageValue(
            "finance_permissions"
          )
        );

  const storedManageablePermissions =
    parsePermissions(
      stored.manageable_permissions
    );

  const manageablePermissions =
    storedManageablePermissions.length >
    0
      ? storedManageablePermissions
      : parsePermissions(
          readLocalStorageValue(
            "finance_manageable_permissions"
          )
        );

  const investorId =
    normalizeNullableString(
      stored.investor_id
    ) ||
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

  const isActive =
    normalizeBoolean(
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

  const phone =
    normalizeNullableString(
      stored.phone
    ) ||
    normalizeNullableString(
      readLocalStorageValue(
        "finance_phone"
      )
    );

  const themeKey =
    cleanString(stored.theme_key) ||
    cleanString(
      readLocalStorageValue(
        "finance_theme_key"
      )
    ) ||
    "professional";

  const sessionVersion =
    normalizeNonNegativeInteger(
      stored.session_version,
      readNumericStorageValue(
        "finance_session_version"
      )
    );

  const permissionsVersion =
    normalizeNonNegativeInteger(
      stored.permissions_version,
      readNumericStorageValue(
        "finance_permissions_version"
      )
    );

  if (!id) {
    return null;
  }

  return normalizeFinanceSessionUser({
    id,
    full_name: fullName,
    username,
    role,
    branch_id: branchId,
    branch_slug: branchSlug,
    branch_name: branchName,
    organization_name:
      organizationName,
    permissions,
    manageable_permissions:
      manageablePermissions,
    investor_id: investorId,
    is_active: isActive,
    last_login_at: lastLoginAt,
    phone,
    theme_key: themeKey,
    session_version:
      sessionVersion,
    permissions_version:
      permissionsVersion,
  });
}

export function saveFinanceSession(
  user: FinanceSessionUser,
  options?: {
    preserveReturnPath?: boolean;
    expiresAt?: number;
    preserveActivityTime?: boolean;
  }
) {
  if (!isBrowser()) {
    return;
  }

  const existingReturnPath =
    options?.preserveReturnPath
      ? localStorage.getItem(
          "finance_return_to"
        )
      : null;

  const existingActivityAt =
    options?.preserveActivityTime
      ? getFinanceLastActivityAt()
      : 0;

  writeFinanceUserStorage(user);

  const now = Date.now();

  const expiresAt =
    options?.expiresAt &&
    Number.isFinite(options.expiresAt)
      ? options.expiresAt
      : now +
        FINANCE_SESSION_DURATION_MS;

  localStorage.setItem(
    "finance_last_activity_at",
    String(
      existingActivityAt > 0
        ? existingActivityAt
        : now
    )
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

export function updateStoredFinanceSessionUser(
  user: FinanceSessionUser
) {
  if (!isBrowser()) {
    return;
  }

  writeFinanceUserStorage(user);
}

export function clearFinanceSession(
  options?: {
    preserveReturnPath?: boolean;
  }
) {
  if (!isBrowser()) {
    return;
  }

  FINANCE_SESSION_KEYS.forEach(
    (key) => {
      if (
        options?.preserveReturnPath &&
        key === "finance_return_to"
      ) {
        return;
      }

      localStorage.removeItem(key);
    }
  );
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

export function getFinanceLastRemoteCheckAt() {
  if (!isBrowser()) {
    return 0;
  }

  const value = Number(
    localStorage.getItem(
      "finance_last_remote_check_at"
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

  if (
    !user.id ||
    !user.branch_id
  ) {
    return {
      valid: false,
      expired: false,
      user,
      reason: "INVALID_SESSION",
    };
  }

  if (
    user.is_active === false
  ) {
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
    cleanString(
      expectedBranchSlug
    );

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

function mapSessionStateRowToUser(
  row: FinanceSessionStateRow
): FinanceSessionUser {
  return normalizeFinanceSessionUser({
    id: row.id,
    full_name:
      cleanString(row.full_name),
    username:
      cleanString(row.username),
    role: cleanString(row.role),
    branch_id:
      cleanString(row.branch_id),
    branch_slug:
      cleanString(row.branch_slug),
    branch_name:
      cleanString(row.branch_name),
    organization_name:
      cleanString(
        row.organization_name
      ),
    permissions:
      parsePermissions(
        row.permissions
      ),
    manageable_permissions:
      parsePermissions(
        row.manageable_permissions
      ),
    investor_id:
      normalizeNullableString(
        row.investor_id
      ),
    is_active:
      row.is_active !== false,
    last_login_at:
      normalizeNullableString(
        row.last_login_at
      ),
    phone:
      normalizeNullableString(
        row.phone
      ),
    theme_key:
      cleanString(row.theme_key) ||
      "professional",
    session_version:
      normalizeNonNegativeInteger(
        row.session_version,
        1
      ),
    permissions_version:
      normalizeNonNegativeInteger(
        row.permissions_version,
        1
      ),
  });
}

export async function refreshFinanceSessionState(
  expectedBranchSlug?: string
): Promise<FinanceRemoteSessionCheckResult> {
  const localValidation =
    validateFinanceSession(
      expectedBranchSlug
    );

  if (!localValidation.valid) {
    return {
      valid: false,
      updated: false,
      revoked:
        localValidation.reason ===
          "INACTIVE_USER" ||
        localValidation.reason ===
          "SESSION_REVOKED",
      user: localValidation.user,
      reason: localValidation.reason,
    };
  }

  const localUser =
    localValidation.user;

  if (
    !localUser ||
    !localUser.id ||
    !localUser.branch_id
  ) {
    return {
      valid: false,
      updated: false,
      revoked: false,
      user: localUser,
      reason: "INVALID_SESSION",
    };
  }

  try {
    const { data, error } =
      await supabase.rpc(
        "validate_finance_session_state",
        {
          p_user_id: localUser.id,
          p_branch_id:
            localUser.branch_id,
        }
      );

    if (error) {
      console.error(
        "Finance session state check failed:",
        error
      );

      return {
        valid: true,
        updated: false,
        revoked: false,
        user: localUser,
        reason: "NETWORK_ERROR",
      };
    }

    const rows = Array.isArray(data)
      ? (data as FinanceSessionStateRow[])
      : [];

    const row = rows[0];

    if (!row) {
      return {
        valid: false,
        updated: false,
        revoked: true,
        user: localUser,
        reason: "SESSION_REVOKED",
      };
    }

    const remoteUser =
      mapSessionStateRowToUser(row);

    if (
      remoteUser.is_active === false
    ) {
      return {
        valid: false,
        updated: false,
        revoked: true,
        user: remoteUser,
        reason: "INACTIVE_USER",
      };
    }

    const expectedBranch =
      cleanString(
        expectedBranchSlug
      );

    if (
      expectedBranch &&
      remoteUser.branch_slug &&
      remoteUser.branch_slug !==
        expectedBranch
    ) {
      return {
        valid: false,
        updated: false,
        revoked: true,
        user: remoteUser,
        reason: "BRANCH_MISMATCH",
      };
    }

    const localSessionVersion =
      normalizeNonNegativeInteger(
        localUser.session_version,
        0
      );

    const remoteSessionVersion =
      normalizeNonNegativeInteger(
        remoteUser.session_version,
        1
      );

    /*
     * القيمة صفر تعني أن الجلسة قديمة ولم تكن
     * تحتوي الإصدار، ولذلك نعتمد إصدار الخادم
     * أول مرة بدل طرد المستخدم.
     */
    if (
      localSessionVersion > 0 &&
      localSessionVersion !==
        remoteSessionVersion
    ) {
      return {
        valid: false,
        updated: false,
        revoked: true,
        user: remoteUser,
        reason: "SESSION_REVOKED",
      };
    }

    const localPermissionsVersion =
      normalizeNonNegativeInteger(
        localUser.permissions_version,
        0
      );

    const remotePermissionsVersion =
      normalizeNonNegativeInteger(
        remoteUser.permissions_version,
        1
      );

    const needsUpdate =
      localSessionVersion === 0 ||
      localPermissionsVersion === 0 ||
      localPermissionsVersion !==
        remotePermissionsVersion ||
      financeUsersAreDifferent(
        localUser,
        remoteUser
      );

    if (needsUpdate) {
      updateStoredFinanceSessionUser(
        remoteUser
      );
    }

    if (isBrowser()) {
      localStorage.setItem(
        "finance_last_remote_check_at",
        String(Date.now())
      );
    }

    return {
      valid: true,
      updated: needsUpdate,
      revoked: false,
      user: remoteUser,
      reason: "",
    };
  } catch (error) {
    console.error(
      "Unexpected finance session check error:",
      error
    );

    return {
      valid: true,
      updated: false,
      revoked: false,
      user: localUser,
      reason: "NETWORK_ERROR",
    };
  }
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
    return decodeURIComponent(
      trimmed
    );
  } catch {
    return trimmed;
  }
}

export function isSafeFinanceReturnPath(
  value: string,
  branchSlug?: string
) {
  const normalizedPath =
    normalizeFinanceReturnPath(
      value
    );

  if (
    !normalizedPath ||
    !normalizedPath.startsWith(
      "/"
    ) ||
    normalizedPath.startsWith(
      "//"
    ) ||
    normalizedPath.includes(
      "://"
    ) ||
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

  return `${window.location.pathname}${window.location.search}`;
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
    options?.preserveReturnPath !==
    false;

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

export function getFinanceManageablePermissions(
  user?: FinanceSessionUser | null
) {
  if (
    user?.manageable_permissions &&
    user.manageable_permissions
      .length > 0
  ) {
    return parsePermissions(
      user.manageable_permissions
    );
  }

  if (!isBrowser()) {
    return [];
  }

  return parsePermissions(
    localStorage.getItem(
      "finance_manageable_permissions"
    )
  );
}

export function getFinanceRole(
  user?: FinanceSessionUser | null
) {
  if (!isBrowser()) {
    return cleanString(
      user?.role
    );
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

export function getFinanceThemeKey(
  user?: FinanceSessionUser | null
) {
  if (!isBrowser()) {
    return (
      cleanString(
        user?.theme_key
      ) || "professional"
    );
  }

  return (
    cleanString(
      user?.theme_key
    ) ||
    cleanString(
      localStorage.getItem(
        "finance_theme_key"
      )
    ) ||
    "professional"
  );
}

export function installFinanceActivityTracker(
  options?: {
    expectedBranchSlug?: string;
    onExpired?: () => void;
    onInvalidated?: (
      reason:
        | "INACTIVE_USER"
        | "SESSION_REVOKED"
        | "BRANCH_MISMATCH"
    ) => void;
    onSessionUpdated?: (
      user: FinanceSessionUser
    ) => void;
  }
) {
  if (!isBrowser()) {
    return () => {};
  }

  let lastHandledAt = 0;
  let remoteCheckRunning = false;
  let disposed = false;

  const handleInvalidSession = (
    reason:
      | "INACTIVE_USER"
      | "SESSION_REVOKED"
      | "BRANCH_MISMATCH"
  ) => {
    if (disposed) {
      return;
    }

    options?.onInvalidated?.(
      reason
    );
  };

  const runRemoteCheck =
    async (force = false) => {
      if (
        disposed ||
        remoteCheckRunning
      ) {
        return;
      }

      const now = Date.now();

      const lastRemoteCheckAt =
        getFinanceLastRemoteCheckAt();

      if (
        !force &&
        lastRemoteCheckAt > 0 &&
        now - lastRemoteCheckAt <
          FINANCE_REMOTE_SESSION_CHECK_INTERVAL_MS
      ) {
        return;
      }

      remoteCheckRunning = true;

      try {
        const result =
          await refreshFinanceSessionState(
            options?.expectedBranchSlug
          );

        if (disposed) {
          return;
        }

        if (
          !result.valid &&
          result.reason ===
            "SESSION_EXPIRED"
        ) {
          options?.onExpired?.();
          return;
        }

        if (
          !result.valid &&
          (
            result.reason ===
              "INACTIVE_USER" ||
            result.reason ===
              "SESSION_REVOKED" ||
            result.reason ===
              "BRANCH_MISMATCH"
          )
        ) {
          handleInvalidSession(
            result.reason
          );
          return;
        }

        if (
          result.updated &&
          result.user
        ) {
          options?.onSessionUpdated?.(
            result.user
          );
        }
      } finally {
        remoteCheckRunning = false;
      }
    };

  const handleActivity = () => {
    const now = Date.now();

    if (
      now - lastHandledAt <
      FINANCE_ACTIVITY_UPDATE_INTERVAL_MS
    ) {
      return;
    }

    lastHandledAt = now;

    if (
      isFinanceSessionExpired()
    ) {
      options?.onExpired?.();
      return;
    }

    renewFinanceSession();
    void runRemoteCheck();
  };

  const handleVisibilityChange =
    () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        handleActivity();
        void runRemoteCheck(true);
      }
    };

  const handleStorageChange = (
    event: StorageEvent
  ) => {
    if (
      event.key ===
        "finance_session_version" ||
      event.key ===
        "finance_is_active" ||
      event.key ===
        "finance_branch_user" ||
      event.key ===
        "finance_user"
    ) {
      void runRemoteCheck(true);
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

  events.forEach(
    (eventName) => {
      window.addEventListener(
        eventName,
        handleActivity,
        {
          passive: true,
        }
      );
    }
  );

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  window.addEventListener(
    "storage",
    handleStorageChange
  );

  const expirationCheckInterval =
    window.setInterval(() => {
      if (
        isFinanceSessionExpired()
      ) {
        options?.onExpired?.();
        return;
      }

      void runRemoteCheck(true);
    }, FINANCE_REMOTE_SESSION_CHECK_INTERVAL_MS);

  /*
   * فحص مباشر عند تثبيت المتتبع.
   */
  void runRemoteCheck(true);

  return () => {
    disposed = true;

    events.forEach(
      (eventName) => {
        window.removeEventListener(
          eventName,
          handleActivity
        );
      }
    );

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.removeEventListener(
      "storage",
      handleStorageChange
    );

    window.clearInterval(
      expirationCheckInterval
    );
  };
}
