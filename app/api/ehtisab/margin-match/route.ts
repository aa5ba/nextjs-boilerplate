import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BODY_BYTES = 4_096;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WORK_CATEGORIES = [
  "civil",
  "military",
  "retired",
  "semi_government",
  "private",
] as const;

type MarginMatchBody = {
  financeType?: unknown;
  providerId?: unknown;
  workCategory?: unknown;
  salary?: unknown;
  termMonths?: unknown;
};

type MarginMatchRow = {
  matched_margin: number | string | null;
  source: string | null;
  rule_id: string | null;
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
  code = "REQUEST_FAILED"
) {
  return NextResponse.json(
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
): number | null {
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

function toPositiveInteger(
  value: unknown
): number | null {
  const parsed =
    toFiniteNumber(value);

  if (
    parsed === null ||
    !Number.isSafeInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function mapRpcErrorCode(
  rawMessage: string
) {
  const knownCodes = [
    "PROVIDER_ID_REQUIRED",
    "INVALID_FINANCE_TYPE",
    "INVALID_WORK_CATEGORY",
    "INVALID_SALARY",
    "INVALID_TERM_MONTHS",
    "PROVIDER_NOT_FOUND",
    "PROVIDER_FINANCE_TYPE_NOT_SUPPORTED",
    "MARGIN_RULE_MATCH_CONFLICT",
  ];

  return (
    knownCodes.find((code) =>
      rawMessage.includes(code)
    ) ?? "MARGIN_MATCH_FAILED"
  );
}

export async function POST(
  request: Request
) {
  try {
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
        "UNSUPPORTED_CONTENT_TYPE"
      );
    }

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
        "REQUEST_TOO_LARGE"
      );
    }

    let body: MarginMatchBody;

    try {
      const parsed: unknown =
        JSON.parse(rawBody);

      if (!isPlainObject(parsed)) {
        return createErrorResponse(
          "بيانات الطلب غير صحيحة",
          400,
          "INVALID_BODY"
        );
      }

      body =
        parsed as MarginMatchBody;
    } catch {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400,
        "INVALID_BODY"
      );
    }

    const financeType =
      cleanText(
        body.financeType
      );

    if (financeType !== "personal") {
      return createErrorResponse(
        "نوع التمويل غير صحيح",
        400,
        "INVALID_FINANCE_TYPE"
      );
    }

    const providerId =
      cleanText(
        body.providerId
      );

    if (!UUID_PATTERN.test(providerId)) {
      return createErrorResponse(
        "جهة التمويل غير صحيحة",
        400,
        "INVALID_PROVIDER_ID"
      );
    }

    const workCategory =
      cleanText(
        body.workCategory
      );

    if (
      !(
        WORK_CATEGORIES as readonly string[]
      ).includes(workCategory)
    ) {
      return createErrorResponse(
        "جهة العمل غير صحيحة",
        400,
        "INVALID_WORK_CATEGORY"
      );
    }

    const salary =
      toFiniteNumber(body.salary);

    if (salary === null || salary <= 0) {
      return createErrorResponse(
        "الراتب غير صحيح",
        400,
        "INVALID_SALARY"
      );
    }

    const termMonths =
      toPositiveInteger(
        body.termMonths
      );

    if (!termMonths) {
      return createErrorResponse(
        "مدة التمويل غير صحيحة",
        400,
        "INVALID_TERM_MONTHS"
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "match_ehtisab_margin",
        {
          p_finance_type:
            financeType,
          p_provider_id:
            providerId,
          p_work_category:
            workCategory,
          p_salary: salary,
          p_term_months:
            termMonths,
        }
      );

    if (error) {
      const fullErrorText = [
        error.code,
        error.message,
        error.details,
        error.hint,
      ]
        .filter(
          (
            value
          ): value is string =>
            typeof value ===
              "string" &&
            value.length > 0
        )
        .join(" ");

      const code =
        mapRpcErrorCode(
          fullErrorText
        );

      console.error(
        "match_ehtisab_margin failed:",
        {
          code:
            error.code,
          message:
            error.message,
        }
      );

      return createErrorResponse(
        code ===
          "MARGIN_RULE_MATCH_CONFLICT"
          ? "توجد أكثر من قاعدة مطابقة لهذا الطلب"
          : "تعذر مطابقة هامش الربح",
        code ===
          "MARGIN_RULE_MATCH_CONFLICT"
          ? 409
          : 400,
        code
      );
    }

    const rawResult =
      Array.isArray(data)
        ? data[0]
        : data;

    const result =
      rawResult &&
      typeof rawResult === "object"
        ? (rawResult as MarginMatchRow)
        : null;

    const matchedMargin =
      toFiniteNumber(
        result?.matched_margin
      );

    if (
      matchedMargin === null ||
      !result?.source
    ) {
      console.error(
        "match_ehtisab_margin returned invalid data:",
        data
      );

      return createErrorResponse(
        "تعذر قراءة نتيجة المطابقة",
        500,
        "INVALID_MARGIN_MATCH_RESULT"
      );
    }

    return NextResponse.json(
      {
        ok: true,
        matchedMargin,
        source:
          result.source,
        ruleId:
          result.rule_id,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Ehtisab margin match route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء مطابقة هامش الربح",
      500
    );
  }
}
