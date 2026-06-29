import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import {
  ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME,
  adminSupportImpersonationCookieDeleteOptions,
  verifyAdminSupportImpersonationToken,
} from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BRANCH_SLUG_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FINANCE_SUPPORT_PERMISSIONS = Object.freeze([
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
]);

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

function clearImpersonationCookie(
  response: NextResponse
): NextResponse {
  response.cookies.set(
    ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME,
    "",
    adminSupportImpersonationCookieDeleteOptions
  );

  return response;
}

function createErrorResponse(
  message: string,
  status: number,
  shouldClearImpersonationCookie = false
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
    shouldClearImpersonationCookie
  ) {
    clearImpersonationCookie(
      response
    );
  }

  return response;
}

function isSameOriginRequest(
  request: NextRequest
): boolean {
  const originHeader =
    request.headers.get("origin");

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
      ?.trim()
      .toLowerCase();

  return (
    !fetchSite ||
    fetchSite === "same-origin" ||
    fetchSite === "same-site" ||
    fetchSite === "none"
  );
}

function getRequestedBranchSlug(
  request: NextRequest
): string | null {
  return normalizeBranchSlug(
    request.nextUrl.searchParams.get(
      "branch"
    )
  );
}

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const requestedBranchSlug =
      getRequestedBranchSlug(
        request
      );

    if (!requestedBranchSlug) {
      return createErrorResponse(
        "رابط الفرع غير صحيح",
        400
      );
    }

    const impersonationToken =
      request.cookies.get(
        ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME
      )?.value;

    const impersonationSession =
      verifyAdminSupportImpersonationToken(
        impersonationToken
      );

    if (!impersonationSession) {
      return createErrorResponse(
        "لا توجد جلسة دخول دعم صالحة",
        401,
        true
      );
    }

    if (
      impersonationSession.branchSlug !==
      requestedBranchSlug
    ) {
      return createErrorResponse(
        "جلسة الدعم لا تخص هذا الفرع",
        403,
        true
      );
    }

    /*
     * التحقق المركزي يعيد قراءة مستخدم الدعم
     * وصلاحياته وsession_version من قاعدة
     * البيانات، ولا يثق ببيانات Cookie.
     */
    const auth =
      await verifyAdminSupportRequest(
        "impersonate_branch"
      );

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        true
      );
    }

    /*
     * يجب أن تكون جلسة الانتحال مرتبطة
     * بجلسة الدعم الأصلية نفسها، وليس فقط
     * بالمستخدم نفسه.
     */
    if (
      impersonationSession.supportSessionId !==
      auth.user.session.sessionId
    ) {
      return createErrorResponse(
        "جلسة دخول الفرع لا تطابق جلسة الدعم الحالية",
        401,
        true
      );
    }

    if (
      impersonationSession.supportUserId !==
      auth.user.id
    ) {
      return createErrorResponse(
        "جلسة دخول الفرع لا تطابق مستخدم الدعم الحالي",
        401,
        true
      );
    }

    if (
      impersonationSession.supportSessionVersion !==
        auth.user.sessionVersion ||
      impersonationSession.supportSessionVersion !==
        auth.user.session.sessionVersion
    ) {
      return createErrorResponse(
        "تم تحديث جلسة مستخدم الدعم، سجّل الدخول مرة أخرى",
        401,
        true
      );
    }

    /*
     * هذه القيم ليست مصدر صلاحية، لكن
     * مقارنتها تمنع استمرار رمز قديم بعد
     * تغيير اسم المستخدم أو بيانات الحساب.
     */
    if (
      impersonationSession.supportUsername !==
        auth.user.username ||
      impersonationSession.supportFullName !==
        auth.user.fullName
    ) {
      return createErrorResponse(
        "تم تحديث بيانات مستخدم الدعم، أعد دخول الفرع",
        401,
        true
      );
    }

    const {
      data: branchData,
      error: branchError,
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
      .eq(
        "id",
        impersonationSession.branchId
      )
      .eq(
        "branch_slug",
        requestedBranchSlug
      )
      .maybeSingle();

    if (branchError) {
      logSupabaseError(
        "Support session branch lookup failed:",
        branchError
      );

      return createErrorResponse(
        "تعذر التحقق من بيانات الفرع",
        500
      );
    }

    if (!branchData) {
      return createErrorResponse(
        "الفرع غير موجود",
        403,
        true
      );
    }

    const branch =
      normalizeBranch(
        branchData as BranchRow
      );

    if (!branch) {
      console.error(
        "Invalid finance branch row during support session verification:",
        {
          branchId:
            impersonationSession.branchId,
        }
      );

      return createErrorResponse(
        "بيانات الفرع غير صالحة",
        500,
        true
      );
    }

    if (!branch.isActive) {
      return createErrorResponse(
        "الفرع غير نشط",
        403,
        true
      );
    }

    if (
      impersonationSession.branchId !==
        branch.id ||
      impersonationSession.branchSlug !==
        branch.branchSlug ||
      requestedBranchSlug !==
        branch.branchSlug
    ) {
      return createErrorResponse(
        "بيانات جلسة الدعم لا تطابق الفرع",
        403,
        true
      );
    }

    /*
     * تغيير اسم الفرع لا يمنح صلاحية أو
     * يغير هوية الفرع، لكنه يتطلب تجديد
     * جلسة الانتحال حتى تظهر البيانات
     * الحالية بصورة صحيحة.
     */
    if (
      impersonationSession.branchName !==
      branch.branchName
    ) {
      return createErrorResponse(
        "تم تحديث بيانات الفرع، أعد الدخول إليه من لوحة الدعم",
        401,
        true
      );
    }

    return NextResponse.json(
      {
        ok: true,

        session_type:
          "admin_support",

        user: {
          id:
            `support:${auth.user.id}`,

          branch_id:
            branch.id,

          branch_slug:
            branch.branchSlug,

          branch_name:
            branch.branchName,

          organization_name:
            branch.organizationName,

          full_name:
            auth.user.fullName,

          username:
            auth.user.username,

          role:
            "support_impersonation",

          roles: [
            "support_impersonation",
          ],

          permissions: [
            ...FINANCE_SUPPORT_PERMISSIONS,
          ],

          logged_at:
            new Date(
              impersonationSession
                .issuedAt * 1000
            ).toISOString(),

          session_expires_at:
            new Date(
              impersonationSession
                .expiresAt * 1000
            ).toISOString(),

          support_user_id:
            auth.user.id,

          support_role:
            auth.user.role,

          support_session_id:
            auth.user.session
              .sessionId,

          impersonation_id:
            impersonationSession
              .impersonationId,

          is_support_session:
            true,
        },
      },
      {
        status: 200,
        headers:
          noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Finance support session route error:",
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
      "حدث خطأ غير متوقع أثناء التحقق من جلسة الدعم",
      500
    );
  }
}

export async function DELETE(
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
        true
      );
    }

    const response =
      NextResponse.json(
        {
          ok: true,
          message:
            "تم إنهاء دخول الفرع والعودة إلى لوحة الدعم",
        },
        {
          status: 200,
          headers:
            noStoreHeaders(),
        }
      );

    return clearImpersonationCookie(
      response
    );
  } catch (error) {
    console.error(
      "Finance support impersonation logout error:",
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

    const response =
      NextResponse.json(
        {
          ok: false,
          message:
            "تعذر إنهاء جلسة دخول الفرع",
        },
        {
          status: 500,
          headers:
            noStoreHeaders(),
        }
      );

    return clearImpersonationCookie(
      response
    );
  }
}
