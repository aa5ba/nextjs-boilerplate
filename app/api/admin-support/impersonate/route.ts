import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import {
  ADMIN_SUPPORT_COOKIE_NAME,
  ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME,
  adminSupportImpersonationCookieOptions,
  createAdminSupportImpersonationToken,
} from "@/lib/adminSupportSession";

type ImpersonateBranchBody = {
  branch_id?: unknown;
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

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function createErrorResponse(
  message: string,
  status: number,
  clearCookie = false
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

  if (clearCookie) {
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
  }

  return response;
}

export async function POST(request: Request) {
  try {
    const auth = await verifyAdminSupportRequest(
      "impersonate_branch"
    );

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        auth.clearCookie === true
      );
    }

    let body: ImpersonateBranchBody;

    try {
      body =
        (await request.json()) as ImpersonateBranchBody;
    } catch {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400
      );
    }

    const branchId = cleanText(body.branch_id);

    if (!branchId || !isValidUuid(branchId)) {
      return createErrorResponse(
        "معرّف الفرع غير صحيح",
        400
      );
    }

    const { data, error } = await supabaseAdmin
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
      .eq("id", branchId)
      .maybeSingle();

    if (error) {
      console.error(
        "Admin support impersonation branch lookup failed:",
        error
      );

      return createErrorResponse(
        "تعذر التحقق من بيانات الفرع",
        500
      );
    }

    const branch = data as BranchRow | null;

    if (!branch) {
      return createErrorResponse(
        "الفرع غير موجود",
        404
      );
    }

    if (!branch.is_active) {
      return createErrorResponse(
        "لا يمكن الدخول إلى فرع معطل",
        403
      );
    }

    if (
      !branch.branch_slug ||
      !/^[a-z0-9_-]+$/.test(branch.branch_slug)
    ) {
      return createErrorResponse(
        "رابط الفرع غير صالح",
        500
      );
    }

    const token =
      createAdminSupportImpersonationToken({
        supportUserId: auth.user.id,
        supportUsername: auth.user.username,
        supportFullName: auth.user.fullName,
        branchId: branch.id,
        branchSlug: branch.branch_slug,
        branchName: branch.branch_name,
      });

    const { error: logError } = await supabaseAdmin
      .from("admin_support_logs")
      .insert({
        user_id: auth.user.id,
        user_name: auth.user.fullName,
        action: "دخول فرع",
        target_type: "branch",
        target_id: branch.id,
        details: `${branch.branch_name} - ${branch.branch_slug}`,
      });

    if (logError) {
      console.error(
        "Admin support impersonation log failed:",
        logError
      );

      return createErrorResponse(
        "تعذر تسجيل عملية الدخول إلى الفرع",
        500
      );
    }

    const redirectUrl =
      `/finance/${encodeURIComponent(
        branch.branch_slug
      )}`;

    const response = NextResponse.json(
      {
        ok: true,
        message: "تم السماح بالدخول إلى الفرع",
        redirect_url: redirectUrl,
        branch: {
          id: branch.id,
          branch_name: branch.branch_name,
          branch_slug: branch.branch_slug,
          organization_name:
            branch.organization_name,
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
      ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME,
      token,
      adminSupportImpersonationCookieOptions
    );

    return response;
  } catch (error) {
    console.error(
      "Admin support impersonation route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء الدخول إلى الفرع",
      500
    );
  }
}
