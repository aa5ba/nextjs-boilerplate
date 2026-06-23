import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME,
  adminSupportImpersonationCookieOptions,
  verifyAdminSupportImpersonationToken,
} from "@/lib/adminSupportSession";

const FINANCE_SUPPORT_PERMISSIONS = [
  "workflow",
  "customers",
  "contracts",
  "payments",
  "inventory",
  "expenses",
  "permissions",
  "settings",
  "print",
  "archive",
];

type SupportUserRow = {
  id: string;
  full_name: string;
  username: string;
  role: string;
  is_active: boolean;
};

type BranchRow = {
  id: string;
  branch_name: string;
  branch_slug: string;
  organization_name: string;
  is_active: boolean;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clearImpersonationCookie(response: NextResponse) {
  response.cookies.set(
    ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME,
    "",
    {
      ...adminSupportImpersonationCookieOptions,
      maxAge: 0,
      expires: new Date(0),
    }
  );

  return response;
}

function createErrorResponse(
  message: string,
  status: number,
  shouldClearImpersonationCookie = false
) {
  const response = NextResponse.json(
    {
      ok: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  if (shouldClearImpersonationCookie) {
    return clearImpersonationCookie(response);
  }

  return response;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const requestedBranchSlug = cleanText(
      url.searchParams.get("branch")
    ).toLowerCase();

    if (!requestedBranchSlug) {
      return createErrorResponse(
        "رابط الفرع مطلوب",
        400
      );
    }

    if (!/^[a-z0-9_-]+$/.test(requestedBranchSlug)) {
      return createErrorResponse(
        "رابط الفرع غير صحيح",
        400
      );
    }

    const cookieStore = await cookies();

    const token = cookieStore.get(
      ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME
    )?.value;

    const session =
      verifyAdminSupportImpersonationToken(token);

    if (!session) {
      return createErrorResponse(
        "لا توجد جلسة دخول دعم صالحة",
        401,
        true
      );
    }

    if (session.branchSlug !== requestedBranchSlug) {
      return createErrorResponse(
        "جلسة الدعم لا تخص هذا الفرع",
        403
      );
    }

    const [
      branchResult,
      supportUserResult,
      permissionResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("finance_branches")
        .select(
          `
            id,
            branch_name,
            branch_slug,
            organization_name,
            is_active
          `
        )
        .eq("id", session.branchId)
        .eq("branch_slug", requestedBranchSlug)
        .maybeSingle(),

      supabaseAdmin
        .from("admin_support_users")
        .select(
          `
            id,
            full_name,
            username,
            role,
            is_active
          `
        )
        .eq("id", session.supportUserId)
        .maybeSingle(),

      supabaseAdmin
        .from("admin_support_user_permissions")
        .select("permission_key")
        .eq("user_id", session.supportUserId),
    ]);

    if (branchResult.error) {
      console.error(
        "Support session branch lookup failed:",
        branchResult.error
      );

      return createErrorResponse(
        "تعذر التحقق من بيانات الفرع",
        500
      );
    }

    if (supportUserResult.error) {
      console.error(
        "Support session user lookup failed:",
        supportUserResult.error
      );

      return createErrorResponse(
        "تعذر التحقق من مستخدم الدعم",
        500
      );
    }

    if (permissionResult.error) {
      console.error(
        "Support session permission lookup failed:",
        permissionResult.error
      );

      return createErrorResponse(
        "تعذر التحقق من صلاحيات مستخدم الدعم",
        500
      );
    }

    const branch =
      branchResult.data as BranchRow | null;

    const supportUser =
      supportUserResult.data as SupportUserRow | null;

    if (!branch || !branch.is_active) {
      return createErrorResponse(
        "الفرع غير موجود أو غير نشط",
        403,
        true
      );
    }

    if (!supportUser || !supportUser.is_active) {
      return createErrorResponse(
        "مستخدم الدعم غير موجود أو غير نشط",
        403,
        true
      );
    }

    const supportPermissions = Array.isArray(
      permissionResult.data
    )
      ? permissionResult.data
          .map((item) =>
            typeof item.permission_key === "string"
              ? item.permission_key
              : ""
          )
          .filter(Boolean)
      : [];

    const canImpersonate =
      supportUser.role === "super_admin" ||
      supportPermissions.includes(
        "impersonate_branch"
      );

    if (!canImpersonate) {
      return createErrorResponse(
        "تم سحب صلاحية الدخول إلى الفروع",
        403,
        true
      );
    }

    if (
      session.branchId !== branch.id ||
      session.branchSlug !== branch.branch_slug
    ) {
      return createErrorResponse(
        "بيانات جلسة الدعم لا تطابق الفرع",
        403,
        true
      );
    }

    return NextResponse.json(
      {
        ok: true,
        session_type: "admin_support",
        user: {
          id: `support:${supportUser.id}`,
          branch_id: branch.id,
          branch_slug: branch.branch_slug,
          branch_name: branch.branch_name,
          organization_name:
            branch.organization_name,
          full_name: supportUser.full_name,
          username: supportUser.username,
          role: "support_impersonation",
          roles: ["support_impersonation"],
          permissions:
            FINANCE_SUPPORT_PERMISSIONS,
          logged_at: new Date(
            session.issuedAt * 1000
          ).toISOString(),
          support_user_id: supportUser.id,
          support_role: supportUser.role,
          is_support_session: true,
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
      "Finance support session route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء التحقق من جلسة الدعم",
      500
    );
  }
}

export async function DELETE() {
  try {
    const response = NextResponse.json(
      {
        ok: true,
        message: "تم إنهاء دخول الفرع والعودة إلى لوحة الدعم",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    return clearImpersonationCookie(response);
  } catch (error) {
    console.error(
      "Finance support impersonation logout error:",
      error
    );

    const response = NextResponse.json(
      {
        ok: false,
        message: "تعذر إنهاء جلسة دخول الفرع",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    return clearImpersonationCookie(response);
  }
}
