import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import {
  ADMIN_SUPPORT_COOKIE_NAME,
  ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME,
  adminSupportCookieDeleteOptions,
  adminSupportImpersonationCookieDeleteOptions,
  adminSupportImpersonationCookieOptions,
  createAdminSupportImpersonationToken,
} from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BRANCH_SLUG_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

const MAX_REQUEST_CONTENT_LENGTH_BYTES =
  4096;

type ImpersonateBranchBody = {
  branch_id?: unknown;
};

type BranchRow = {
  id: unknown;
  branch_name: unknown;
  branch_slug: unknown;
  organization_name: unknown;
  is_active: unknown;
};

type NormalizedBranch = {
  id: string;
  branchName: string;
  branchSlug: string;
  organizationName: string;
  isActive: boolean;
};

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control":
      "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    Vary: "Cookie, Origin",
  };
}

function cleanText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function isValidUuid(
  value: string
): boolean {
  return UUID_PATTERN.test(value);
}

function normalizeBranchSlug(
  value: unknown
): string | null {
  const branchSlug =
    cleanText(value).toLowerCase();

  if (
    branchSlug.length < 1 ||
    branchSlug.length > 64 ||
    !BRANCH_SLUG_PATTERN.test(
      branchSlug
    )
  ) {
    return null;
  }

  return branchSlug;
}

function normalizeLimitedText(
  value: unknown,
  minimumLength: number,
  maximumLength: number
): string | null {
  const text = cleanText(value);

  if (
    text.length < minimumLength ||
    text.length > maximumLength
  ) {
    return null;
  }

  return text;
}

function normalizeBranch(
  value: BranchRow | null
): NormalizedBranch | null {
  if (!value) {
    return null;
  }

  const id =
    cleanText(value.id);

  const branchName =
    normalizeLimitedText(
      value.branch_name,
      1,
      150
    );

  const branchSlug =
    normalizeBranchSlug(
      value.branch_slug
    );

  const organizationName =
    normalizeLimitedText(
      value.organization_name,
      1,
      200
    );

  if (
    !isValidUuid(id) ||
    !branchName ||
    !branchSlug ||
    !organizationName ||
    typeof value.is_active !==
      "boolean"
  ) {
    return null;
  }

  return {
    id,
    branchName,
    branchSlug,
    organizationName,
    isActive:
      value.is_active,
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

function clearAdminSupportCookie(
  response: NextResponse
): void {
  response.cookies.set(
    ADMIN_SUPPORT_COOKIE_NAME,
    "",
    adminSupportCookieDeleteOptions
  );
}

function clearImpersonationCookie(
  response: NextResponse
): void {
  response.cookies.set(
    ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME,
    "",
    adminSupportImpersonationCookieDeleteOptions
  );
}

function createErrorResponse(
  message: string,
  status: number,
  options?: {
    clearAdminCookie?: boolean;
    clearImpersonationCookie?: boolean;
  }
): NextResponse {
  const response =
    NextResponse.json(
      {
        ok: false,
        message,
      },
      {
        status,
        headers:
          noStoreHeaders(),
      }
    );

  if (
    options?.clearAdminCookie
  ) {
    clearAdminSupportCookie(
      response
    );
  }

  if (
    options?.clearImpersonationCookie
  ) {
    clearImpersonationCookie(
      response
    );
  }

  return response;
}

function hasJsonContentType(
  request: NextRequest
): boolean {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ?? "";

  return (
    contentType ===
      "application/json" ||
    contentType.startsWith(
      "application/json;"
    )
  );
}

function hasAcceptableContentLength(
  request: NextRequest
): boolean {
  const rawContentLength =
    request.headers.get(
      "content-length"
    );

  if (!rawContentLength) {
    return true;
  }

  const contentLength =
    Number(rawContentLength);

  return (
    Number.isSafeInteger(
      contentLength
    ) &&
    contentLength >= 0 &&
    contentLength <=
      MAX_REQUEST_CONTENT_LENGTH_BYTES
  );
}

function isSameOriginRequest(
  request: NextRequest
): boolean {
  const originHeader =
    request.headers.get("origin");

  /*
   * متصفحات الويب ترسل Origin مع طلبات
   * POST. عدم وجوده قد يحدث مع بعض الأدوات
   * أو الطلبات الداخلية، لذلك نستخدم
   * Sec-Fetch-Site كحماية إضافية.
   */
  if (originHeader) {
    try {
      const origin =
        new URL(originHeader);

      return (
        origin.origin ===
        request.nextUrl.origin
      );
    } catch {
      return false;
    }
  }

  const fetchSite =
    request.headers
      .get("sec-fetch-site")
      ?.toLowerCase();

  return (
    !fetchSite ||
    fetchSite === "same-origin" ||
    fetchSite === "same-site" ||
    fetchSite === "none"
  );
}

async function readRequestBody(
  request: NextRequest
): Promise<
  | {
      ok: true;
      body: ImpersonateBranchBody;
    }
  | {
      ok: false;
      message: string;
      status: number;
    }
> {
  if (
    !hasJsonContentType(request)
  ) {
    return {
      ok: false,
      message:
        "نوع بيانات الطلب غير مدعوم",
      status: 415,
    };
  }

  if (
    !hasAcceptableContentLength(
      request
    )
  ) {
    return {
      ok: false,
      message:
        "حجم بيانات الطلب أكبر من الحد المسموح",
      status: 413,
    };
  }

  let parsedBody: unknown;

  try {
    parsedBody =
      await request.json();
  } catch {
    return {
      ok: false,
      message:
        "بيانات الطلب غير صحيحة",
      status: 400,
    };
  }

  if (
    !isPlainObject(parsedBody)
  ) {
    return {
      ok: false,
      message:
        "بيانات الطلب غير صحيحة",
      status: 400,
    };
  }

  return {
    ok: true,
    body:
      parsedBody as ImpersonateBranchBody,
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    if (
      !isSameOriginRequest(
        request
      )
    ) {
      return createErrorResponse(
        "تم رفض مصدر الطلب",
        403,
        {
          clearImpersonationCookie:
            true,
        }
      );
    }

    const auth =
      await verifyAdminSupportRequest(
        "impersonate_branch"
      );

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        {
          clearAdminCookie:
            auth.clearCookie ===
            true,

          clearImpersonationCookie:
            auth.clearCookie ===
            true,
        }
      );
    }

    const bodyResult =
      await readRequestBody(
        request
      );

    if (!bodyResult.ok) {
      return createErrorResponse(
        bodyResult.message,
        bodyResult.status
      );
    }

    const branchId =
      cleanText(
        bodyResult.body.branch_id
      );

    if (
      !isValidUuid(branchId)
    ) {
      return createErrorResponse(
        "معرّف الفرع غير صحيح",
        400
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin
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
      logSupabaseError(
        "Admin support impersonation branch lookup failed:",
        error
      );

      return createErrorResponse(
        "تعذر التحقق من بيانات الفرع",
        500
      );
    }

    if (!data) {
      return createErrorResponse(
        "الفرع غير موجود",
        404,
        {
          clearImpersonationCookie:
            true,
        }
      );
    }

    const branch =
      normalizeBranch(
        data as BranchRow
      );

    if (!branch) {
      console.error(
        "Invalid finance branch database row during impersonation:",
        {
          requestedBranchId:
            branchId,
        }
      );

      return createErrorResponse(
        "بيانات الفرع غير صالحة",
        500,
        {
          clearImpersonationCookie:
            true,
        }
      );
    }

    if (!branch.isActive) {
      return createErrorResponse(
        "لا يمكن الدخول إلى فرع معطل",
        403,
        {
          clearImpersonationCookie:
            true,
        }
      );
    }

    /*
     * ننشئ الرمز قبل إدخال السجل حتى لا
     * نسجل عملية لم ينجح إصدار رمزها.
     */
    const token =
      createAdminSupportImpersonationToken({
        supportSessionId:
          auth.user.session.sessionId,

        supportUserId:
          auth.user.id,

        supportUsername:
          auth.user.username,

        supportFullName:
          auth.user.fullName,

        supportSessionVersion:
          auth.user.sessionVersion,

        branchId:
          branch.id,

        branchSlug:
          branch.branchSlug,

        branchName:
          branch.branchName,
      });

    const {
      error: logError,
    } = await supabaseAdmin
      .from("admin_support_logs")
      .insert({
        user_id:
          auth.user.id,

        user_name:
          auth.user.fullName,

        action:
          "دخول فرع",

        target_type:
          "branch",

        target_id:
          branch.id,

        details: JSON.stringify({
          branch_name:
            branch.branchName,

          branch_slug:
            branch.branchSlug,

          support_session_id:
            auth.user.session
              .sessionId,

          support_session_version:
            auth.user
              .sessionVersion,
        }),
      });

    if (logError) {
      logSupabaseError(
        "Admin support impersonation log failed:",
        logError
      );

      return createErrorResponse(
        "تعذر تسجيل عملية الدخول إلى الفرع",
        500,
        {
          clearImpersonationCookie:
            true,
        }
      );
    }

    const redirectUrl =
      `/finance/${encodeURIComponent(
        branch.branchSlug
      )}`;

    const response =
      NextResponse.json(
        {
          ok: true,

          message:
            "تم السماح بالدخول إلى الفرع",

          redirect_url:
            redirectUrl,

          branch: {
            id:
              branch.id,

            branch_name:
              branch.branchName,

            branch_slug:
              branch.branchSlug,

            organization_name:
              branch.organizationName,
          },
        },
        {
          status: 200,
          headers:
            noStoreHeaders(),
        }
      );

    /*
     * set بالقيمة الجديدة يستبدل أي جلسة
     * انتحال سابقة تحمل الاسم والمسار نفسيهما.
     */
    response.cookies.set(
      ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME,
      token,
      adminSupportImpersonationCookieOptions
    );

    return response;
  } catch (error) {
    console.error(
      "Admin support impersonation route error:",
      error instanceof Error
        ? {
            name:
              error.name,
            message:
              error.message,
          }
        : {
            name:
              "UnknownError",
          }
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء الدخول إلى الفرع",
      500,
      {
        clearImpersonationCookie:
          true,
      }
    );
  }
}
