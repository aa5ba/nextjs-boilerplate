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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ProviderBody = {
  action?: unknown;
  providerName?: unknown;
  displayOrder?: unknown;
  defaultMarginRate?: unknown;
  financeTypes?: unknown;
  isActive?: unknown;
};

type ProviderUpdateResult = {
  provider_id: string;
  is_active?: boolean;
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

function toInteger(
  value: unknown
) {
  const parsed =
    toFiniteNumber(value);

  if (
    parsed === null ||
    !Number.isSafeInteger(parsed)
  ) {
    return null;
  }

  return parsed;
}

function normalizeFinanceTypes(
  value: unknown
): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const cleaned = value.map(
    (item) => cleanText(item)
  );

  if (
    cleaned.length === 0 ||
    cleaned.some(
      (item) =>
        !(
          FINANCE_TYPES as readonly string[]
        ).includes(item)
    )
  ) {
    return null;
  }

  return Array.from(
    new Set(cleaned)
  );
}

async function parseBody(
  request: Request
): Promise<ProviderBody | NextResponse> {
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

    return parsed as ProviderBody;
  } catch {
    return createErrorResponse(
      "بيانات الطلب غير صحيحة",
      400,
      false,
      "INVALID_BODY"
    );
  }
}

function mapProviderError(
  rawMessage: string
) {
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

  if (
    rawMessage.includes(
      "PROVIDER_NAME_REQUIRED"
    )
  ) {
    return {
      message:
        "اسم جهة التمويل مطلوب",
      status: 400,
      code: "PROVIDER_NAME_REQUIRED",
    };
  }

  if (
    rawMessage.includes(
      "INVALID_DEFAULT_MARGIN_RATE"
    )
  ) {
    return {
      message:
        "هامش الربح الافتراضي غير صحيح",
      status: 400,
      code: "INVALID_DEFAULT_MARGIN_RATE",
    };
  }

  if (
    rawMessage.includes(
      "INVALID_FINANCE_TYPE"
    ) ||
    rawMessage.includes(
      "FINANCE_TYPE_REQUIRED"
    )
  ) {
    return {
      message:
        "نوع التمويل غير صحيح",
      status: 400,
      code: "INVALID_FINANCE_TYPE",
    };
  }

  if (
    rawMessage.includes(
      "duplicate key"
    ) ||
    rawMessage.includes("23505")
  ) {
    return {
      message:
        "جهة التمويل موجودة مسبقًا",
      status: 409,
      code: "PROVIDER_ALREADY_EXISTS",
    };
  }

  return {
    message:
      "تعذر تنفيذ العملية",
    status: 500,
    code: "PROVIDER_OPERATION_FAILED",
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
        "معرّف جهة التمويل غير صحيح",
        400,
        false,
        "INVALID_PROVIDER_ID"
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

    const action =
      cleanText(
        parsedBody.action
      );

    if (
      action === "set_active" ||
      typeof parsedBody.isActive ===
        "boolean"
    ) {
      if (
        typeof parsedBody.isActive !==
        "boolean"
      ) {
        return createErrorResponse(
          "حالة جهة التمويل غير صحيحة",
          400,
          false,
          "INVALID_PROVIDER_STATUS"
        );
      }

      const { data, error } =
        await supabaseAdmin.rpc(
          "set_ehtisab_finance_provider_active_atomic",
          {
            p_provider_id: id,
            p_is_active:
              parsedBody.isActive,
            p_actor_user_id:
              auth.user.id,
            p_actor_user_name:
              auth.user.fullName,
          }
        );

      if (error) {
        const mapped =
          mapProviderError(
            `${error.code || ""} ${
              error.message || ""
            } ${error.details || ""}`
          );

        console.error(
          "set_ehtisab_finance_provider_active_atomic failed:",
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
        typeof rawResult ===
          "object"
          ? (rawResult as ProviderUpdateResult)
          : null;

      if (!result?.provider_id) {
        return createErrorResponse(
          "تم التنفيذ لكن تعذر قراءة النتيجة",
          500,
          false,
          "INVALID_PROVIDER_RESULT"
        );
      }

      return NextResponse.json(
        {
          ok: true,
          providerId:
            result.provider_id,
          isActive:
            result.is_active,
        },
        {
          status: 200,
          headers:
            noStoreHeaders(),
        }
      );
    }

    const providerName =
      cleanText(
        parsedBody.providerName
      );

    if (
      providerName.length < 2 ||
      providerName.length > 150
    ) {
      return createErrorResponse(
        "اسم جهة التمويل يجب أن يكون من حرفين إلى 150 حرف",
        400,
        false,
        "PROVIDER_NAME_REQUIRED"
      );
    }

    const displayOrder =
      toInteger(
        parsedBody.displayOrder
      ) ?? 0;

    const defaultMarginRate =
      toFiniteNumber(
        parsedBody.defaultMarginRate
      );

    if (
      defaultMarginRate === null ||
      defaultMarginRate <= 0 ||
      defaultMarginRate > 100
    ) {
      return createErrorResponse(
        "هامش الربح الافتراضي غير صحيح",
        400,
        false,
        "INVALID_DEFAULT_MARGIN_RATE"
      );
    }

    const financeTypes =
      normalizeFinanceTypes(
        parsedBody.financeTypes
      );

    if (!financeTypes) {
      return createErrorResponse(
        "نوع التمويل غير صحيح",
        400,
        false,
        "INVALID_FINANCE_TYPE"
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "update_ehtisab_finance_provider_atomic",
        {
          p_provider_id: id,
          p_provider_name:
            providerName,
          p_display_order:
            displayOrder,
          p_default_margin_rate:
            defaultMarginRate,
          p_finance_types:
            financeTypes,
          p_actor_user_id:
            auth.user.id,
          p_actor_user_name:
            auth.user.fullName,
        }
      );

    if (error) {
      const mapped =
        mapProviderError(
          `${error.code || ""} ${
            error.message || ""
          } ${error.details || ""}`
        );

      console.error(
        "update_ehtisab_finance_provider_atomic failed:",
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
        ? (rawResult as ProviderUpdateResult)
        : null;

    if (!result?.provider_id) {
      return createErrorResponse(
        "تم الحفظ لكن تعذر قراءة النتيجة",
        500,
        false,
        "INVALID_PROVIDER_RESULT"
      );
    }

    return NextResponse.json(
      {
        ok: true,
        providerId:
          result.provider_id,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support Ehtisab provider PATCH error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء تعديل جهة التمويل",
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
        "معرّف جهة التمويل غير صحيح",
        400,
        false,
        "INVALID_PROVIDER_ID"
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "soft_delete_ehtisab_finance_provider_atomic",
        {
          p_provider_id: id,
          p_actor_user_id:
            auth.user.id,
          p_actor_user_name:
            auth.user.fullName,
        }
      );

    if (error) {
      const mapped =
        mapProviderError(
          `${error.code || ""} ${
            error.message || ""
          } ${error.details || ""}`
        );

      console.error(
        "soft_delete_ehtisab_finance_provider_atomic failed:",
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
        ? (rawResult as ProviderUpdateResult)
        : null;

    if (!result?.provider_id) {
      return createErrorResponse(
        "تم الحذف لكن تعذر قراءة النتيجة",
        500,
        false,
        "INVALID_PROVIDER_RESULT"
      );
    }

    return NextResponse.json(
      {
        ok: true,
        providerId:
          result.provider_id,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support Ehtisab provider DELETE error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء حذف جهة التمويل",
      500
    );
  }
}
