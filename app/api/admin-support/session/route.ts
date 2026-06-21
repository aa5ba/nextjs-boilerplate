import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ADMIN_SUPPORT_COOKIE_NAME,
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

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(
      ADMIN_SUPPORT_COOKIE_NAME
    )?.value;

    const session =
      verifyAdminSupportSessionToken(token);

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          authenticated: false,
          message: "انتهت جلسة الدخول",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
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
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const user = userData as
      | SupportUserRow
      | null;

    if (!user || !user.is_active) {
      const response = NextResponse.json(
        {
          ok: false,
          authenticated: false,
          message: "الحساب غير موجود أو غير مفعل",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );

      response.cookies.set(
        ADMIN_SUPPORT_COOKIE_NAME,
        "",
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV ===
            "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        }
      );

      return response;
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
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
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

    return NextResponse.json(
      {
        ok: true,
        authenticated: true,
        user: {
          id: user.id,
          full_name:
            user.full_name?.trim() ||
            user.username,
          username: user.username,
          role: user.role,
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
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
