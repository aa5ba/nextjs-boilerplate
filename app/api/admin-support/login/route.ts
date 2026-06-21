import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ADMIN_SUPPORT_COOKIE_NAME,
  adminSupportCookieOptions,
  createAdminSupportSessionToken,
} from "@/lib/adminSupportSession";

type LoginRequestBody = {
  username?: unknown;
  password?: unknown;
};

type SupportLoginResult = {
  id?: string | null;
  user_id?: string | null;
  full_name?: string | null;
  username?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  permissions?: unknown;
};

function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (permission): permission is string =>
      typeof permission === "string" &&
      permission.trim().length > 0
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequestBody;

    const username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password.trim()
        : "";

    if (!username || !password) {
      return NextResponse.json(
        {
          ok: false,
          message: "اكتب اسم المستخدم وكلمة المرور",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (
      username.length < 3 ||
      username.length > 50 ||
      password.length < 4 ||
      password.length > 100
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "بيانات الدخول غير صحيحة",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "verify_admin_support_login",
      {
        p_username: username,
        p_password: password,
      }
    );

    if (error) {
      console.error(
        "verify_admin_support_login failed:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          message: "تعذر التحقق من بيانات الدخول",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const rawResult = Array.isArray(data)
      ? data[0]
      : data;

    const result =
      rawResult &&
      typeof rawResult === "object"
        ? (rawResult as SupportLoginResult)
        : null;

    const userId =
      result?.id || result?.user_id || "";

    const fullName =
      result?.full_name?.trim() || "";

    const verifiedUsername =
      result?.username?.trim() || username;

    const role =
      result?.role?.trim() || "";

    const permissions = normalizePermissions(
      result?.permissions
    );

    const isActive =
      result?.is_active !== false;

    if (
      !result ||
      !userId ||
      !verifiedUsername ||
      !role ||
      !isActive
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "اسم المستخدم أو كلمة المرور غير صحيحة",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const sessionToken =
      createAdminSupportSessionToken({
        userId,
        username: verifiedUsername,
        fullName:
          fullName || verifiedUsername,
        role,
        permissions,
      });

    const response = NextResponse.json(
      {
        ok: true,
        user: {
          id: userId,
          username: verifiedUsername,
          full_name:
            fullName || verifiedUsername,
          role,
          permissions,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    response.cookies.set(
      ADMIN_SUPPORT_COOKIE_NAME,
      sessionToken,
      adminSupportCookieOptions
    );

    return response;
  } catch (error) {
    console.error(
      "Admin support login route error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message: "حدث خطأ غير متوقع",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
