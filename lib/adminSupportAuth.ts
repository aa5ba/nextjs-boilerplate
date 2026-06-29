import "server-only";

import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ADMIN_SUPPORT_COOKIE_NAME,
  type AdminSupportSession,
  verifyAdminSupportSessionToken,
} from "@/lib/adminSupportSession";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const USERNAME_PATTERN =
  /^[\p{L}\p{N}._-]{2,50}$/u;

const ROLE_PATTERN =
  /^[a-z][a-z0-9_]{1,63}$/;

const PERMISSION_KEY_PATTERN =
  /^[a-z][a-z0-9_]{1,99}$/;

const SUPER_ADMIN_ROLE =
  "super_admin";

type SupportUserRow = {
  id: unknown;
  full_name: unknown;
  username: unknown;
  role: unknown;
  is_active: unknown;
  session_version: unknown;
};

type PermissionRow = {
  permission_key: unknown;
};

type NormalizedSupportUser = {
  id: string;
  fullName: string;
  username: string;
  role: string;
  isActive: boolean;
  sessionVersion: number;
};

export type VerifiedAdminSupportUser = {
  id: string;
  fullName: string;
  username: string;
  role: string;
  permissions: string[];
  sessionVersion: number;
  session: AdminSupportSession;
};

export type AdminSupportAuthResult =
  | {
      ok: true;
      user: VerifiedAdminSupportUser;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      message: string;
      clearCookie?: boolean;
    };

function cleanText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isValidUuid(
  value: string
): boolean {
  return UUID_PATTERN.test(value);
}

function normalizeSessionVersion(
  value: unknown
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function normalizeUsername(
  value: unknown
): string | null {
  const username =
    cleanText(value);

  if (
    !USERNAME_PATTERN.test(
      username
    )
  ) {
    return null;
  }

  return username;
}

function normalizeRole(
  value: unknown
): string | null {
  const role =
    cleanText(value).toLowerCase();

  if (
    !ROLE_PATTERN.test(role)
  ) {
    return null;
  }

  return role;
}

function normalizeFullName(
  value: unknown,
  fallback: string
): string {
  const fullName =
    cleanText(value);

  if (
    fullName.length < 2 ||
    fullName.length > 150
  ) {
    return fallback;
  }

  return fullName;
}

function normalizePermissionKey(
  value: unknown
): string | null {
  const permission =
    cleanText(value).toLowerCase();

  if (
    !PERMISSION_KEY_PATTERN.test(
      permission
    )
  ) {
    return null;
  }

  return permission;
}

function normalizePermissions(
  rows: PermissionRow[]
): string[] {
  const permissions =
    new Set<string>();

  for (const row of rows) {
    const permission =
      normalizePermissionKey(
        row.permission_key
      );

    if (permission) {
      permissions.add(permission);
    }
  }

  return Array.from(
    permissions
  ).sort((first, second) =>
    first.localeCompare(second)
  );
}

function normalizeSupportUser(
  value: SupportUserRow | null
): NormalizedSupportUser | null {
  if (!value) {
    return null;
  }

  const id =
    cleanText(value.id);

  const username =
    normalizeUsername(
      value.username
    );

  const role =
    normalizeRole(value.role);

  const sessionVersion =
    normalizeSessionVersion(
      value.session_version
    );

  if (
    !isValidUuid(id) ||
    !username ||
    !role ||
    typeof value.is_active !==
      "boolean" ||
    sessionVersion === null
  ) {
    return null;
  }

  return {
    id,
    username,
    role,
    isActive:
      value.is_active,
    sessionVersion,
    fullName:
      normalizeFullName(
        value.full_name,
        username
      ),
  };
}

function logSupabaseError(
  context: string,
  error: {
    code?: string;
    message?: string;
  }
): void {
  console.error(context, {
    code:
      typeof error.code ===
      "string"
        ? error.code
        : "UNKNOWN",

    message:
      typeof error.message ===
      "string"
        ? error.message
        : "Unknown database error",
  });
}

function normalizeRequiredPermission(
  value: string | undefined
): string | null {
  if (value === undefined) {
    return "";
  }

  return normalizePermissionKey(
    value
  );
}

function userHasPermission(
  role: string,
  permissions: readonly string[],
  permission: string
): boolean {
  return (
    role === SUPER_ADMIN_ROLE ||
    permissions.includes(permission)
  );
}

export async function verifyAdminSupportRequest(
  requiredPermission?: string
): Promise<AdminSupportAuthResult> {
  try {
    const normalizedRequiredPermission =
      normalizeRequiredPermission(
        requiredPermission
      );

    /*
     * تمرير مفتاح صلاحية غير صالح يعتبر
     * خطأ برمجيًا في المسار نفسه، وليس نقص
     * صلاحية لدى المستخدم.
     */
    if (
      requiredPermission !==
        undefined &&
      normalizedRequiredPermission ===
        null
    ) {
      console.error(
        "Invalid required admin support permission:",
        {
          permission:
            typeof requiredPermission ===
            "string"
              ? requiredPermission.slice(
                  0,
                  120
                )
              : "INVALID_TYPE",
        }
      );

      return {
        ok: false,
        status: 500,
        message:
          "تعذر التحقق من صلاحية العملية",
      };
    }

    const cookieStore =
      await cookies();

    const token =
      cookieStore.get(
        ADMIN_SUPPORT_COOKIE_NAME
      )?.value;

    const session =
      verifyAdminSupportSessionToken(
        token
      );

    if (!session) {
      return {
        ok: false,
        status: 401,
        message:
          "انتهت جلسة الدخول",
        clearCookie: true,
      };
    }

    const {
      data: userData,
      error: userError,
    } = await supabaseAdmin
      .from("admin_support_users")
      .select(
        `
          id,
          full_name,
          username,
          role,
          is_active,
          session_version
        `
      )
      .eq(
        "id",
        session.userId
      )
      .maybeSingle();

    if (userError) {
      logSupabaseError(
        "Admin support user verification failed:",
        userError
      );

      return {
        ok: false,
        status: 500,
        message:
          "تعذر التحقق من حساب الدعم",
      };
    }

    if (!userData) {
      return {
        ok: false,
        status: 401,
        message:
          "الحساب غير موجود أو غير مفعل",
        clearCookie: true,
      };
    }

    const user =
      normalizeSupportUser(
        userData as SupportUserRow
      );

    /*
     * وجود سجل ببيانات غير سليمة يدل على
     * مشكلة في قاعدة البيانات، لذلك لا
     * نتعامل معه كحساب عادي.
     */
    if (!user) {
      console.error(
        "Invalid admin support user database row:",
        {
          sessionUserId:
            session.userId,
        }
      );

      return {
        ok: false,
        status: 500,
        message:
          "بيانات حساب الدعم غير صالحة",
      };
    }

    /*
     * حماية إضافية حتى لو أعادت قاعدة
     * البيانات سجلًا غير متوقع.
     */
    if (
      user.id !== session.userId
    ) {
      console.error(
        "Admin support session user mismatch:",
        {
          sessionUserId:
            session.userId,
          databaseUserId:
            user.id,
        }
      );

      return {
        ok: false,
        status: 401,
        message:
          "جلسة الدخول غير صالحة",
        clearCookie: true,
      };
    }

    if (!user.isActive) {
      return {
        ok: false,
        status: 401,
        message:
          "الحساب غير موجود أو غير مفعل",
        clearCookie: true,
      };
    }

    if (
      user.sessionVersion !==
      session.sessionVersion
    ) {
      return {
        ok: false,
        status: 401,
        message:
          "تم تحديث بيانات الحساب، سجّل الدخول مرة أخرى",
        clearCookie: true,
      };
    }

    const {
      data: permissionData,
      error: permissionError,
    } = await supabaseAdmin
      .from(
        "admin_support_user_permissions"
      )
      .select("permission_key")
      .eq("user_id", user.id);

    if (permissionError) {
      logSupabaseError(
        "Admin support permission verification failed:",
        permissionError
      );

      return {
        ok: false,
        status: 500,
        message:
          "تعذر التحقق من صلاحيات المستخدم",
      };
    }

    const permissionRows =
      (permissionData ??
        []) as PermissionRow[];

    const permissions =
      normalizePermissions(
        permissionRows
      );

    if (
      normalizedRequiredPermission &&
      !userHasPermission(
        user.role,
        permissions,
        normalizedRequiredPermission
      )
    ) {
      return {
        ok: false,
        status: 403,
        message:
          "لا تملك الصلاحية لتنفيذ هذه العملية",
      };
    }

    return {
      ok: true,

      user: {
        id: user.id,
        fullName:
          user.fullName,
        username:
          user.username,
        role:
          user.role,
        permissions,
        sessionVersion:
          user.sessionVersion,
        session,
      },
    };
  } catch (error) {
    console.error(
      "Admin support request verification error:",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : {
            name: "UnknownError",
          }
    );

    return {
      ok: false,
      status: 500,
      message:
        "حدث خطأ أثناء التحقق من الجلسة",
    };
  }
}

export function adminSupportHasPermission(
  user: VerifiedAdminSupportUser,
  permission: string
): boolean {
  const cleanPermission =
    normalizePermissionKey(
      permission
    );

  if (!cleanPermission) {
    return false;
  }

  return userHasPermission(
    user.role,
    user.permissions,
    cleanPermission
  );
}
