import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  FINANCE_BRANCH_SESSION_COOKIE_NAME,
  createFinanceBranchSessionToken,
  financeBranchSessionCookieOptions,
} from "@/lib/financeBranchSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type LoginRequestBody = {
  username?: unknown;
  password?: unknown;
};

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String(
        "٠١٢٣٤٥٦٧٨٩".indexOf(digit)
      )
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)
      )
    );
}

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

function createJsonResponse(
  body: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function createErrorResponse(
  message: string,
  status: number
) {
  return createJsonResponse(
    {
      ok: false,
      message,
    },
    status
  );
}

export async function POST(
  request: Request
) {
  try {
    let body: LoginRequestBody;

    try {
      const parsedBody: unknown =
        await request.json();

      if (
        !parsedBody ||
        typeof parsedBody !== "object" ||
        Array.isArray(parsedBody)
      ) {
        return createErrorResponse(
          "اسم المستخدم أو كلمة المرور غير صحيحة",
          400
        );
      }

      body =
        parsedBody as LoginRequestBody;
    } catch (error) {
      console.error(
        "Finance branch login invalid JSON:",
        error
      );

      return createErrorResponse(
        "اسم المستخدم أو كلمة المرور غير صحيحة",
        400
      );
    }

    const username =
  normalizeDigits(
    cleanText(body.username)
  )
    .replace(
      /[^A-Za-z0-9_]/g,
      ""
    )
    .slice(0, 30)
    .toLowerCase();

const password =
  normalizeDigits(
    cleanText(body.password)
  )
    .replace(
      /[^A-Za-z0-9]/g,
      ""
    )
    .slice(0, 10);

const usernameRegex =
  /^[a-z0-9_]{3,30}$/;

const passwordRegex =
  /^[A-Za-z0-9]{4,10}$/;

    if (
      !usernameRegex.test(username) ||
      !passwordRegex.test(password)
    ) {
      return createErrorResponse(
        "اسم المستخدم أو كلمة المرور غير صحيحة",
        400
      );
    }

    let rpcData: unknown;

    try {
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
          {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          }
        );

        return createErrorResponse(
          "حدث خطأ أثناء التحقق من بيانات الدخول",
          500
        );
      }

      rpcData = data;
    } catch (error) {
      console.error(
        "Finance branch login RPC exception:",
        error
      );

      return createErrorResponse(
        "تعذر الاتصال بخدمة تسجيل الدخول",
        500
      );
    }

    const result =
      getLoginResult(rpcData);

    if (!result) {
      return createErrorResponse(
        "اسم المستخدم أو كلمة المرور غير صحيحة",
        401
      );
    }

    const userId =
      cleanText(result.id);

    const branchId =
      cleanText(result.branch_id);

    const branchSlug =
      cleanText(
        result.branch_slug
      ).toLowerCase();

    if (
      !userId ||
      !branchId ||
      !branchSlug
    ) {
      console.error(
        "Finance branch login incomplete user data:",
        {
          hasUserId: Boolean(userId),
          hasBranchId: Boolean(branchId),
          hasBranchSlug:
            Boolean(branchSlug),
        }
      );

      return createErrorResponse(
        "بيانات حساب الموظف غير مكتملة",
        403
      );
    }

    if (
      !/^[a-z0-9_-]+$/.test(
        branchSlug
      )
    ) {
      console.error(
        "Finance branch login invalid branch slug:",
        branchSlug
      );

      return createErrorResponse(
        "مسار الفرع غير صالح",
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

    let token: string;

    try {
      token =
        createFinanceBranchSessionToken({
          userId,
          branchId,
          branchSlug,
          sessionVersion,
        });
    } catch (error) {
      console.error(
        "Finance branch session token creation failed:",
        error
      );

      return createErrorResponse(
        "تعذر إنشاء جلسة تسجيل الدخول",
        500
      );
    }

    if (!token) {
      console.error(
        "Finance branch session token is empty"
      );

      return createErrorResponse(
        "تعذر إنشاء جلسة تسجيل الدخول",
        500
      );
    }

    const response =
      createJsonResponse(
        {
          ok: true,
          user: result,
        },
        200
      );

    try {
      response.cookies.set(
        FINANCE_BRANCH_SESSION_COOKIE_NAME,
        token,
        financeBranchSessionCookieOptions
      );
    } catch (error) {
      console.error(
        "Finance branch session cookie failed:",
        error
      );

      return createErrorResponse(
        "تعذر حفظ جلسة تسجيل الدخول",
        500
      );
    }

    return response;
  } catch (error) {
    console.error(
      "Finance branch login route unexpected error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى",
      500
    );
  }
}

export async function DELETE() {
  try {
    const response =
      createJsonResponse(
        {
          ok: true,
        },
        200
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
  } catch (error) {
    console.error(
      "Finance branch logout route error:",
      error
    );

    return createErrorResponse(
      "تعذر إنهاء جلسة تسجيل الدخول",
      500
    );
  }
}
