import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ADMIN_SUPPORT_COOKIE_NAME,
  verifyAdminSupportSessionToken,
} from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupportUserRow = {
  id: string;
  full_name: string | null;
  username: string;
  role: string;
  is_active: boolean;
  session_version: number;
};

type PermissionRow = {
  permission_key: string;
};

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
  };
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SUPPORT_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    priority: "high",
  });

  return response;
}

function unauthenticatedResponse(
  message: string,
  clearCookie = false
) {
  const response = NextResponse.json(
    {
      ok: false,
      authenticated: false,
      message,
    },
    {
      status: 401,
      headers: noStoreHeaders(),
    }
  );

  return clearCookie
    ? clearSessionCookie(response)
    : response;
}

function normalizeSessionVersion(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (permission): permission is string =>
            typeof permission === "string"
        )
        .map((permission) => permission.trim())
        .filter(
          (permission) =>
            permission.length > 0 &&
            permission.length <= 100
        )
    )
  );
}

export async function GET() {
  try {
    const cookieStore = await cookies();

    const token = cookieStore.get(
      ADMIN_SUPPORT_COOKIE_NAME
    )?.value;

    const session = verifyAdminSupportSessionToken(token);

    if (!session) {
      return unauthenticatedResponse(
        "انتهت جلسة الدخول",
        true
      );
    }

    const { data: userData, error: userError } =
      await supabaseAdmin
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
        .eq("id", session.userId)
        .maybeSingle();

    if (userError) {
      console.error(
        "Admin support session user lookup failed:",
        userError
      );

      return NextResponse.json(
        {
          ok: false,
          authenticated: false,
          message: "تعذر التحقق من جلسة المستخدم",
        },
        {
          status: 500,
          headers: noStoreHeaders(),
        }
      );
    }

    const user = userData as SupportUserRow | null;

    if (!user || !user.is_active) {
      return unauthenticatedResponse(
        "الحساب غير موجود أو غير مفعل",
        true
      );
    }

    const databaseSessionVersion = normalizeSessionVersion(
      user.session_version
    );

    if (
      databaseSessionVersion === null ||
      databaseSessionVersion !== session.sessionVersion
    ) {
      return unauthenticatedResponse(
        "تم تحديث بيانات الحساب، سجّل الدخول مرة أخرى",
        true
      );
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
        "Admin support permissions lookup failed:",
        permissionError
      );

      return NextResponse.json(
        {
          ok: false,
          authenticated: false,
          message: "تعذر تحميل صلاحيات المستخدم",
        },
        {
          status: 500,
          headers: noStoreHeaders(),
        }
      );
    }

    const permissions = normalizePermissions(
      ((permissionData || []) as PermissionRow[]).map(
        (item) => item.permission_key
      )
    );

    return NextResponse.json(
      {
        ok: true,
        authenticated: true,
        user: {
          id: user.id,
          full_name:
            user.full_name?.trim() || user.username,
          username: user.username,
          role: user.role,
          permissions,
          session_version: databaseSessionVersion,
        },
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support session route error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        message: "حدث خطأ أثناء التحقق من الجلسة",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }
}
