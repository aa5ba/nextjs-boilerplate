import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BODY_BYTES = 8_192;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FINANCE_TYPES = [
  "personal",
] as const;

const WORK_CATEGORIES = [
  "civil",
  "military",
  "retired",
  "semi_government",
  "private",
] as const;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type MarginRuleBody = {
  providerId?: unknown;
  financeType?: unknown;
  workCategory?: unknown;
  salaryFrom?: unknown;
  salaryTo?: unknown;
  termMonthsFrom?: unknown;
  termMonthsTo?: unknown;
  marginRate?: unknown;
  isActive?: unknown;
};

type MarginRuleResult = {
  rule_id: string;
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

function createErrorResponse(
  message: string,
  status: number,
  clearCookie = false,
  code = "REQUEST_FAILED"
) {
  const response = NextResponse.json(
    {
      ok: false,
      code,
      message,
    },
    {
      status,
      headers: noStoreHeaders(),
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
        sameSite: "strict",
        path: "/",
        maxAge: 0,
        priority: "high",
      }
    );
  }

  return response;
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

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function toFiniteNumber(
  value: unknown
) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : NaN;

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function toPositiveIntegerOrNull(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" &&
      value.trim() === "")
  ) {
    return null;
  }

  const parsed =
    toFiniteNumber(value);

  if (
    parsed === null ||
    !Number.isSafeInteger(parsed) ||
    parsed <= 0
  ) {
    return NaN;
  }

  return parsed;
}

async function parseBody(
  request: Request
): Promise<MarginRuleBody | NextResponse> {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ?? "";

  if (
    !contentType.startsWith(
      "application/json"
    )
  ) {
    return createErrorResponse(
      "نوع بيانات الطلب غير مدعوم",
      415,
      false,
      "UNSUPPORTED_CONTENT_TYPE"
    );
  }

  try {
    const rawBody =
      await request.text();

    if (
      Buffer.byteLength(
        rawBody,
        "utf8"
      ) > MAX_REQUEST_BODY_BYTES
    ) {
      return createErrorResponse(
        "حجم الطلب أكبر من الحد المسموح",
        413,
        false,
        "REQUEST_TOO_LARGE"
      );
    }

    const parsed: unknown =
      JSON.parse(rawBody);

    if (!isPlainObject(parsed)) {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400,
        false,
        "INVALID_BODY"
      );
    }

    return parsed as MarginRuleBody;
  } catch {
    return createErrorResponse(
      "بيانات الطلب غير صحيحة",
      400,
      false,
      "INVALID_BODY"
    );
  }
}

function mapRuleError(
  rawMessage: string
) {
  if (
    rawMessage.includes(
      "MARGIN_RULE_OVERLAP"
    )
  ) {
    return {
      message:
        "توجد قاعدة هامش متداخلة مع نفس النطاق",
      status: 409,
      code: "MARGIN_RULE_OVERLAP",
    };
  }

  if (
    rawMessage.includes(
      "RULE_NOT_FOUND"
    )
  ) {
    return {
      message:
        "قاعدة الهامش غير موجودة",
      status: 404,
      code: "RULE_NOT_FOUND",
    };
  }

  if (
    rawMessage.includes(
      "PROVIDER_FINANCE_TYPE_NOT_SUPPORTED"
    )
  ) {
    return {
      message:
        "جهة التمويل لا تدعم نوع التمويل المحدد",
      status: 400,
      code: "PROVIDER_FINANCE_TYPE_NOT_SUPPORTED",
    };
  }

  if (
    rawMessage.includes(
      "PROVIDER_NOT_FOUND"
    )
  ) {
    return {
      message:
        "جهة التمويل غير موجودة",
      status: 404,
      code: "PROVIDER_NOT_FOUND",
    };
  }

  return {
    message:
      "تعذر تنفيذ العملية",
    status: 500,
    code: "MARGIN_RULE_OPERATION_FAILED",
  };
}

function validateRuleBody(
  body: MarginRuleBody
) {
  const providerId =
    cleanText(body.providerId);

  if (!UUID_PATTERN.test(providerId)) {
    return {
      ok: false as const,
      response: createErrorResponse(
        "جهة التمويل غير صحيحة",
        400,
        false,
        "INVALID_PROVIDER_ID"
      ),
    };
  }

  const financeType =
    cleanText(body.financeType);

  if (
    !(
      FINANCE_TYPES as readonly string[]
    ).includes(financeType)
  ) {
    return {
      ok: false as const,
      response: createErrorResponse(
        "نوع التمويل غير صحيح",
        400,
        false,
        "INVALID_FINANCE_TYPE"
      ),
    };
  }

  const workCategory =
    cleanText(body.workCategory);

  if (
    !(
      WORK_CATEGORIES as readonly string[]
    ).includes(workCategory)
  ) {
    return {
      ok: false as const,
      response: createErrorResponse(
        "جهة العمل غير صحيحة",
        400,
        false,
        "INVALID_WORK_CATEGORY"
      ),
    };
  }

  const salaryFrom =
    toFiniteNumber(
      body.salaryFrom
    );

  const salaryTo =
    toFiniteNumber(
      body.salaryTo
    );

  if (
    salaryFrom === null ||
    salaryTo === null ||
    salaryFrom <= 0 ||
    salaryTo <= 0 ||
    salaryFrom > salaryTo
  ) {
    return {
      ok: false as const,
      response: createErrorResponse(
        "نطاق الراتب غير صحيح",
        400,
        false,
        "INVALID_SALARY_RANGE"
      ),
    };
  }

  const termMonthsFrom =
    toPositiveIntegerOrNull(
      body.termMonthsFrom
    );

  const termMonthsTo =
    toPositiveIntegerOrNull(
      body.termMonthsTo
    );

  if (
    Number.isNaN(
      termMonthsFrom
    ) ||
    Number.isNaN(termMonthsTo) ||
    (termMonthsFrom === null) !==
      (termMonthsTo === null) ||
    (typeof termMonthsFrom ===
      "number" &&
      typeof termMonthsTo ===
        "number" &&
      termMonthsFrom > termMonthsTo)
  ) {
    return {
      ok: false as const,
      response: createErrorResponse(
        "نطاق مدة التمويل غير صحيح",
        400,
        false,
        "INVALID_TERM_RANGE"
      ),
    };
  }

  const marginRate =
    toFiniteNumber(
      body.marginRate
    );

  if (
    marginRate === null ||
    marginRate <= 0 ||
    marginRate > 100
  ) {
    return {
      ok: false as const,
      response: createErrorResponse(
        "هامش الربح غير صحيح",
        400,
        false,
        "INVALID_MARGIN_RATE"
      ),
    };
  }

  return {
    ok: true as const,
    value: {
      providerId,
      financeType,
      workCategory,
      salaryFrom,
      salaryTo,
      termMonthsFrom:
        termMonthsFrom as number | null,
      termMonthsTo:
        termMonthsTo as number | null,
      marginRate,
      isActive:
        typeof body.isActive ===
        "boolean"
          ? body.isActive
          : true,
    },
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth =
      await verifyAdminSupportRequest(
        "manage_ehtisab_settings"
      );

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        auth.clearCookie === true
      );
    }

    const { id } =
      await context.params;

    if (!UUID_PATTERN.test(id)) {
      return createErrorResponse(
        "معرّف قاعدة الهامش غير صحيح",
        400,
        false,
        "INVALID_RULE_ID"
      );
    }

    const parsedBody =
      await parseBody(request);

    if (
      parsedBody instanceof
      NextResponse
    ) {
      return parsedBody;
    }

    const validation =
      validateRuleBody(
        parsedBody
      );

    if (!validation.ok) {
      return validation.response;
    }

    const rule =
      validation.value;

    const { data, error } =
      await supabaseAdmin.rpc(
        "update_ehtisab_margin_rule_atomic",
        {
          p_rule_id: id,
          p_provider_id:
            rule.providerId,
          p_finance_type:
            rule.financeType,
          p_work_category:
            rule.workCategory,
          p_salary_from:
            rule.salaryFrom,
          p_salary_to:
            rule.salaryTo,
          p_term_months_from:
            rule.termMonthsFrom,
          p_term_months_to:
            rule.termMonthsTo,
          p_margin_rate:
            rule.marginRate,
          p_is_active:
            rule.isActive,
          p_actor_user_id:
            auth.user.id,
          p_actor_user_name:
            auth.user.fullName,
        }
      );

    if (error) {
      const mapped =
        mapRuleError(
          `${error.code || ""} ${
            error.message || ""
          } ${error.details || ""}`
        );

      console.error(
        "update_ehtisab_margin_rule_atomic failed:",
        {
          code:
            error.code,
          message:
            error.message,
        }
      );

      return createErrorResponse(
        mapped.message,
        mapped.status,
        false,
        mapped.code
      );
    }

    const rawResult =
      Array.isArray(data)
        ? data[0]
        : data;

    const result =
      rawResult &&
      typeof rawResult === "object"
        ? (rawResult as MarginRuleResult)
        : null;

    if (!result?.rule_id) {
      return createErrorResponse(
        "تم الحفظ لكن تعذر قراءة النتيجة",
        500,
        false,
        "INVALID_RULE_RESULT"
      );
    }

    return NextResponse.json(
      {
        ok: true,
        ruleId: result.rule_id,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support Ehtisab margin rule PATCH error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء تعديل قاعدة الهامش",
      500
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const auth =
      await verifyAdminSupportRequest(
        "manage_ehtisab_settings"
      );

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        auth.clearCookie === true
      );
    }

    const { id } =
      await context.params;

    if (!UUID_PATTERN.test(id)) {
      return createErrorResponse(
        "معرّف قاعدة الهامش غير صحيح",
        400,
        false,
        "INVALID_RULE_ID"
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "soft_delete_ehtisab_margin_rule_atomic",
        {
          p_rule_id: id,
          p_actor_user_id:
            auth.user.id,
          p_actor_user_name:
            auth.user.fullName,
        }
      );

    if (error) {
      const mapped =
        mapRuleError(
          `${error.code || ""} ${
            error.message || ""
          } ${error.details || ""}`
        );

      console.error(
        "soft_delete_ehtisab_margin_rule_atomic failed:",
        {
          code:
            error.code,
          message:
            error.message,
        }
      );

      return createErrorResponse(
        mapped.message,
        mapped.status,
        false,
        mapped.code
      );
    }

    const rawResult =
      Array.isArray(data)
        ? data[0]
        : data;

    const result =
      rawResult &&
      typeof rawResult === "object"
        ? (rawResult as MarginRuleResult)
        : null;

    if (!result?.rule_id) {
      return createErrorResponse(
        "تم الحذف لكن تعذر قراءة النتيجة",
        500,
        false,
        "INVALID_RULE_RESULT"
      );
    }

    return NextResponse.json(
      {
        ok: true,
        ruleId: result.rule_id,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support Ehtisab margin rule DELETE error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء حذف قاعدة الهامش",
      500
    );
  }
}
