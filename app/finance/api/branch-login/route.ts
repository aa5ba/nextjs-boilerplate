import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  FINANCE_BRANCH_SESSION_COOKIE_NAME,
  createFinanceBranchSessionToken,
  financeBranchSessionCookieOptions,
} from "@/lib/financeBranchSession";

type FinanceLoginRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  role: string | null;
  branch_id: string;
  branch_slug: string | null;
  branch_name: string | null;
  organization_name: string | null;
  permissions: unknown;
  manageable_permissions?: unknown;
  investor_id: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
  phone?: string | null;
  theme_key?: string | null;
  session_version?: number | string | null;
  permissions_version?: number | string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeVersion(value: unknown) {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return Math.floor(parsed);
}

function getLoginResult(
  data: unknown
): FinanceLoginRow | null {
  const result = Array.isArray(data)
    ? data[0]
    : data;

  if (
    !result ||
    typeof result !== "object" ||
    Array.isArray(result)
  ) {
    return null;
  }

  return result as FinanceLoginRow;
}

function createErrorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
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
}

export async function POST(
  request: Request
) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return createErrorResponse(
        "اسم المستخدم أو كلمة المرور غير صحيحة",
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return createErrorResponse(
        "اسم المستخدم أو كلمة المرور غير صحيحة",
        400
      );
    }

    const payload = body as {
      username?: unknown;
      password?: unknown;
    };

    const username = cleanText(
      payload.username
    );

    const password = cleanText(
      payload.password
    )
      .replace(/\D/g, "")
      .slice(0, 8);

    const usernameRegex =
      /^[\u0600-\u06FFa-zA-Z0-9_.-]{2,35}$/;

    const passwordRegex =
      /^\d{4,8}$/;

    if (
      !usernameRegex.test(username) ||
      !passwordRegex.test(password)
    ) {
      return createErrorResponse(
        "اسم المستخدم أو كلمة المرور غير صحيحة",
        400
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "verify_finance_branch_login",
        {
          p_username: username,
          p_password: password,
        }
      );

    if (error) {
      console.error(
        "Finance branch login RPC failed:",
        error
      );

      return createErrorResponse(
        "حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى",
        500
      );
    }

    const result =
      getLoginResult(data);

    if (!result) {
      return createErrorResponse(
        "اسم المستخدم أو كلمة المرور غير صحيحة",
        401
      );
    }

    const userId = cleanText(
      result.id
    );

    const branchId = cleanText(
      result.branch_id
    );

    const branchSlug = cleanText(
      result.branch_slug
    ).toLowerCase();

    if (
      !userId ||
      !branchId ||
      !branchSlug ||
      !/^[a-z0-9_-]+$/.test(
        branchSlug
      )
    ) {
      return createErrorResponse(
        "بيانات حساب الموظف غير مكتملة",
        403
      );
    }

    if (
      result.is_active === false
    ) {
      return createErrorResponse(
        "هذا الحساب معطل",
        403
      );
    }

    const sessionVersion =
      normalizeVersion(
        result.session_version
      );

    const token =
      createFinanceBranchSessionToken({
        userId,
        branchId,
        branchSlug,
        sessionVersion,
      });

    const response =
      NextResponse.json(
        {
          ok: true,
          user: result,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );

    response.cookies.set(
      FINANCE_BRANCH_SESSION_COOKIE_NAME,
      token,
      financeBranchSessionCookieOptions
    );

    return response;
  } catch (error) {
    console.error(
      "Finance branch login route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى",
      500
    );
  }
}

export async function DELETE() {
  const response =
    NextResponse.json(
      {
        ok: true,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

  response.cookies.set(
    FINANCE_BRANCH_SESSION_COOKIE_NAME,
    "",
    {
      ...financeBranchSessionCookieOptions,
      maxAge: 0,
      expires: new Date(0),
    }
  );

  return response;
}
