import "server-only";

import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  FINANCE_BRANCH_SESSION_COOKIE_NAME,
  verifyFinanceBranchSessionToken,
} from "@/lib/financeBranchSession";

type FinanceBranchUserRow = {
  id: string;
  branch_id: string;
  full_name: string;
  username: string;
  role: string;
  permissions: string[] | null;
  manageable_permissions: string[] | null;
  investor_id: string | null;
  is_active: boolean;
  session_version: number | string;
  permissions_version: number | string;
  disabled_at: string | null;
  self_disabled: boolean;
  phone: string | null;
  theme_key: string | null;
};

type FinanceBranchRow = {
  id: string;
  branch_slug: string;
  branch_name: string;
  organization_name: string | null;
  is_active: boolean;
};

export type RequiredFinanceBranchSession = {
  sessionId: string;
  userId: string;
  branchId: string;
  branchSlug: string;
  sessionVersion: number;
  expiresAt: number;

  user: {
    id: string;
    fullName: string;
    username: string;
    role: string;
    permissions: string[];
    manageablePermissions: string[];
    investorId: string | null;
    permissionsVersion: number;
    phone: string | null;
    themeKey: string;
  };

  branch: {
    id: string;
    slug: string;
    name: string;
    organizationName: string;
  };
};

type RequireFinanceBranchSessionOptions = {
  requestedBranchSlug?: string | null;
  requiredPermission?: string | null;
};

export class FinanceBranchSessionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    status = 401,
    code = "UNAUTHORIZED"
  ) {
    super(message);

    this.name =
      "FinanceBranchSessionError";

    this.status = status;
    this.code = code;
  }
}

const MANAGER_ROLES = new Set([
  "main_admin",
  "branch_manager",
  "مدير رئيسي",
  "مدير",
]);

function cleanText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeBranchSlug(
  value: unknown
): string {
  return cleanText(value).toLowerCase();
}

function normalizeVersion(
  value: unknown
): number {
  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return parsed;
}

function normalizePermissions(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (
            permission
          ): permission is string =>
            typeof permission ===
            "string"
        )
        .map((permission) =>
          permission.trim()
        )
        .filter(Boolean)
    )
  );
}

function hasPermission(
  role: string,
  permissions: string[],
  requiredPermission:
    | string
    | null
    | undefined
): boolean {
  if (!requiredPermission) {
    return true;
  }

  if (MANAGER_ROLES.has(role)) {
    return true;
  }

  return permissions.includes(
    requiredPermission
  );
}

export function isFinanceBranchSessionError(
  error: unknown
): error is FinanceBranchSessionError {
  return (
    error instanceof
    FinanceBranchSessionError
  );
}

export async function requireFinanceBranchSession(
  options: RequireFinanceBranchSessionOptions = {}
): Promise<RequiredFinanceBranchSession> {
  const cookieStore =
    await cookies();

  const token =
    cookieStore.get(
      FINANCE_BRANCH_SESSION_COOKIE_NAME
    )?.value;

  const signedSession =
    verifyFinanceBranchSessionToken(
      token
    );

  if (!signedSession) {
    throw new FinanceBranchSessionError(
      "انتهت جلسة تسجيل الدخول أو أنها غير صالحة",
      401,
      "INVALID_SESSION"
    );
  }

  const requestedBranchSlug =
    normalizeBranchSlug(
      options.requestedBranchSlug
    );

  if (
    requestedBranchSlug &&
    requestedBranchSlug !==
      signedSession.branchSlug
  ) {
    throw new FinanceBranchSessionError(
      "لا تملك صلاحية الوصول إلى هذا الفرع",
      403,
      "BRANCH_MISMATCH"
    );
  }

  const {
    data: userData,
    error: userError,
  } = await supabaseAdmin
    .from("finance_branch_users")
    .select(
      `
        id,
        branch_id,
        full_name,
        username,
        role,
        permissions,
        manageable_permissions,
        investor_id,
        is_active,
        session_version,
        permissions_version,
        disabled_at,
        self_disabled,
        phone,
        theme_key
      `
    )
    .eq("id", signedSession.userId)
    .eq(
      "branch_id",
      signedSession.branchId
    )
    .maybeSingle();

  if (userError) {
    console.error(
      "Finance session user lookup failed:",
      {
        message: userError.message,
        code: userError.code,
        details: userError.details,
        hint: userError.hint,
      }
    );

    throw new FinanceBranchSessionError(
      "تعذر التحقق من جلسة المستخدم",
      500,
      "SESSION_USER_LOOKUP_FAILED"
    );
  }

  const user =
    userData as
      | FinanceBranchUserRow
      | null;

  if (!user) {
    throw new FinanceBranchSessionError(
      "حساب المستخدم غير موجود",
      401,
      "USER_NOT_FOUND"
    );
  }

  if (
    user.is_active !== true ||
    user.self_disabled === true ||
    Boolean(user.disabled_at)
  ) {
    throw new FinanceBranchSessionError(
      "هذا الحساب معطل",
      403,
      "USER_DISABLED"
    );
  }

  const databaseSessionVersion =
    normalizeVersion(
      user.session_version
    );

  if (
    databaseSessionVersion !==
    signedSession.sessionVersion
  ) {
    throw new FinanceBranchSessionError(
      "تم إنهاء هذه الجلسة، سجل الدخول من جديد",
      401,
      "SESSION_REVOKED"
    );
  }

  const {
    data: branchData,
    error: branchError,
  } = await supabaseAdmin
    .from("finance_branches")
    .select(
      `
        id,
        branch_slug,
        branch_name,
        organization_name,
        is_active
      `
    )
    .eq("id", signedSession.branchId)
    .maybeSingle();

  if (branchError) {
    console.error(
      "Finance session branch lookup failed:",
      {
        message:
          branchError.message,
        code: branchError.code,
        details:
          branchError.details,
        hint: branchError.hint,
      }
    );

    throw new FinanceBranchSessionError(
      "تعذر التحقق من بيانات الفرع",
      500,
      "SESSION_BRANCH_LOOKUP_FAILED"
    );
  }

  const branch =
    branchData as
      | FinanceBranchRow
      | null;

  if (!branch) {
    throw new FinanceBranchSessionError(
      "الفرع غير موجود",
      403,
      "BRANCH_NOT_FOUND"
    );
  }

  if (branch.is_active !== true) {
    throw new FinanceBranchSessionError(
      "هذا الفرع معطل",
      403,
      "BRANCH_DISABLED"
    );
  }

  const databaseBranchSlug =
    normalizeBranchSlug(
      branch.branch_slug
    );

  if (
    !databaseBranchSlug ||
    databaseBranchSlug !==
      signedSession.branchSlug
  ) {
    throw new FinanceBranchSessionError(
      "بيانات الفرع لا تطابق جلسة الدخول",
      401,
      "SESSION_BRANCH_CHANGED"
    );
  }

  if (
    requestedBranchSlug &&
    databaseBranchSlug !==
      requestedBranchSlug
  ) {
    throw new FinanceBranchSessionError(
      "لا تملك صلاحية الوصول إلى هذا الفرع",
      403,
      "REQUESTED_BRANCH_MISMATCH"
    );
  }

  const role =
    cleanText(user.role);

  const permissions =
    normalizePermissions(
      user.permissions
    );

  const requiredPermission =
    cleanText(
      options.requiredPermission
    );

  if (
    !hasPermission(
      role,
      permissions,
      requiredPermission
    )
  ) {
    throw new FinanceBranchSessionError(
      "لا تملك الصلاحية المطلوبة",
      403,
      "MISSING_PERMISSION"
    );
  }

  return {
    sessionId:
      signedSession.sessionId,

    userId:
      signedSession.userId,

    branchId:
      signedSession.branchId,

    branchSlug:
      signedSession.branchSlug,

    sessionVersion:
      signedSession.sessionVersion,

    expiresAt:
      signedSession.expiresAt,

    user: {
      id: user.id,

      fullName:
        cleanText(
          user.full_name
        ) || "الموظف",

      username:
        cleanText(user.username),

      role,

      permissions,

      manageablePermissions:
        normalizePermissions(
          user.manageable_permissions
        ),

      investorId:
        user.investor_id
          ? cleanText(
              user.investor_id
            )
          : null,

      permissionsVersion:
        normalizeVersion(
          user.permissions_version
        ),

      phone:
        user.phone
          ? cleanText(user.phone)
          : null,

      themeKey:
        cleanText(
          user.theme_key
        ) || "professional",
    },

    branch: {
      id: branch.id,

      slug:
        databaseBranchSlug,

      name:
        cleanText(
          branch.branch_name
        ),

      organizationName:
        cleanText(
          branch.organization_name
        ),
    },
  };
}
