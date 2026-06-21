import "server-only";

import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ADMIN_SUPPORT_COOKIE_NAME,
  type AdminSupportSession,
  verifyAdminSupportSessionToken,
} from "@/lib/adminSupportSession";

type SupportUserRow = {
  id: string;
  full_name: string | null;
  username: string;
  role: string;
  is_active: boolean;
};

type PermissionRow = {
  permission_key: string;
};

export type VerifiedAdminSupportUser = {
  id: string;
  fullName: string;
  username: string;
  role: string;
  permissions: string[];
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

export async function verifyAdminSupportRequest(
  requiredPermission?: string
): Promise<AdminSupportAuthResult> {
  try {
    const cookieStore = await cookies();

    const token = cookieStore.get(
      ADMIN_SUPPORT_COOKIE_NAME
    )?.value;

    const session =
      verifyAdminSupportSessionToken(token);

    if (!session) {
      return {
        ok: false,
        status: 401,
        message: "انتهت جلسة الدخول",
        clearCookie: true,
      };
    }

    const { data: userData, error: userError } =
      await supabaseAdmin
        .from("admin_support_users")
        .select(
          "id, full_name, username, role, is_active"
        )
        .eq("id", session.userId)
        .maybeSingle();

    if (userError) {
      console.error(
        "Admin support user verification failed:",
        userError
      );

      return {
        ok: false,
        status: 500,
        message: "تعذر التحقق من حساب الدعم",
      };
    }

    const user = userData as SupportUserRow | null;

    if (!user || !user.is_active) {
      return {
        ok: false,
        status: 401,
        message: "الحساب غير موجود أو غير مفعل",
        clearCookie: true,
      };
    }

    const {
      data: permissionData,
      error: permissionError,
    } = await supabaseAdmin
      .from("admin_support_user_permissions")
      .select("permission_key")
      .eq("user_id", user.id);

    if (permissionError) {
      console.error(
        "Admin support permission verification failed:",
        permissionError
      );

      return {
        ok: false,
        status: 500,
        message: "تعذر التحقق من صلاحيات المستخدم",
      };
    }

    const permissions = (
      (permissionData || []) as PermissionRow[]
    )
      .map((item) => item.permission_key)
      .filter(
        (permission): permission is string =>
          typeof permission === "string" &&
          permission.trim().length > 0
      );

    const hasPermission =
      !requiredPermission ||
      user.role === "super_admin" ||
      permissions.includes(requiredPermission);

    if (!hasPermission) {
      return {
        ok: false,
        status: 403,
        message: "لا تملك الصلاحية لتنفيذ هذه العملية",
      };
    }

    return {
      ok: true,
      user: {
        id: user.id,
        fullName:
          user.full_name?.trim() || user.username,
        username: user.username,
        role: user.role,
        permissions,
        session,
      },
    };
  } catch (error) {
    console.error(
      "Admin support request verification error:",
      error
    );

    return {
      ok: false,
      status: 500,
      message: "حدث خطأ أثناء التحقق من الجلسة",
    };
  }
}

export function adminSupportHasPermission(
  user: VerifiedAdminSupportUser,
  permission: string
) {
  return (
    user.role === "super_admin" ||
    user.permissions.includes(permission)
  );
}
