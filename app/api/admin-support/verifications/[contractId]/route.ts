import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BODY_BYTES = 4_096;

const ALLOWED_POSITIONS = [
  "نشط",
  "متأخر",
  "متعثر",
] as const;

type VerificationPosition =
  (typeof ALLOWED_POSITIONS)[number];

type RouteContext = {
  params: Promise<{
    contractId: string;
  }>;
};

type UpdateVerificationBody = {
  action?: unknown;
  position?: unknown;
  reason?: unknown;
  notes?: unknown;
};

type SetOverrideResult = {
  override_id: string;
  contract_id: string;
  override_position: string;
  is_active: boolean;
  updated_at: string;
};

type ClearOverrideResult = {
  override_id: string;
  contract_id: string;
  previous_position: string;
  is_active: boolean;
  deactivated_at: string;
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
  clearCookie = false
) {
  const response = NextResponse.json(
    {
      ok: false,
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
          process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
        priority: "high",
      }
    );
  }

  return response;
}

function cleanText(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isValidUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isVerificationPosition(
  value: string
): value is VerificationPosition {
  return (
    ALLOWED_POSITIONS as readonly string[]
  ).includes(value);
}

function isSameOriginRequest(
  request: Request
) {
  const origin =
    request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    const requestUrl =
      new URL(request.url);

    const originUrl =
      new URL(origin);

    return (
      requestUrl.protocol ===
        originUrl.protocol &&
      requestUrl.host ===
        originUrl.host
    );
  } catch {
    return false;
  }
}

function mapSetOverrideError(
  rawMessage: string
) {
  if (
    rawMessage.includes(
      "CONTRACT_REQUIRED"
    )
  ) {
    return {
      message: "معرّف العقد مطلوب",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "CONTRACT_NOT_FOUND"
    )
  ) {
    return {
      message: "العقد غير موجود",
      status: 404,
    };
  }

  if (
    rawMessage.includes(
      "INVALID_OVERRIDE_POSITION"
    )
  ) {
    return {
      message: "نتيجة التحقق غير صحيحة",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "OVERRIDE_REASON_REQUIRED"
    )
  ) {
    return {
      message:
        "اكتب سبب التعديل، ويجب ألا يقل عن 3 أحرف",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "OVERRIDE_REASON_TOO_LONG"
    )
  ) {
    return {
      message:
        "سبب التعديل طويل جدًا",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "OVERRIDE_NOTES_TOO_LONG"
    )
  ) {
    return {
      message:
        "الملاحظات طويلة جدًا",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "OVERRIDE_ALREADY_ACTIVE"
    )
  ) {
    return {
      message:
        "هذه النتيجة مطبقة بالفعل على العقد",
      status: 409,
    };
  }

  return {
    message:
      "تعذر تحديث نتيجة التحقق",
    status: 500,
  };
}

function mapClearOverrideError(
  rawMessage: string
) {
  if (
    rawMessage.includes(
      "CONTRACT_NOT_FOUND"
    )
  ) {
    return {
      message: "العقد غير موجود",
      status: 404,
    };
  }

  if (
    rawMessage.includes(
      "OVERRIDE_NOT_FOUND"
    )
  ) {
    return {
      message:
        "لا يوجد تدخل دعم فعال على هذا العقد",
      status: 404,
    };
  }

  if (
    rawMessage.includes(
      "OVERRIDE_ALREADY_INACTIVE"
    )
  ) {
    return {
      message:
        "العقد يعمل بالحسبة التلقائية بالفعل",
      status: 409,
    };
  }

  if (
    rawMessage.includes(
      "DEACTIVATION_REASON_REQUIRED"
    )
  ) {
    return {
      message:
        "اكتب سبب العودة للوضع التلقائي",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "DEACTIVATION_REASON_TOO_LONG"
    )
  ) {
    return {
      message:
        "سبب الإلغاء طويل جدًا",
      status: 400,
    };
  }

  return {
    message:
      "تعذر إلغاء تدخل الدعم",
    status: 500,
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth =
      await verifyAdminSupportRequest(
        "manage_verification_results"
      );

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        auth.clearCookie === true
      );
    }

    if (!isSameOriginRequest(request)) {
      return createErrorResponse(
        "الطلب غير مسموح",
        403
      );
    }

    const { contractId } =
      await context.params;

    const cleanContractId =
      cleanText(contractId);

    if (
      !cleanContractId ||
      !isValidUuid(cleanContractId)
    ) {
      return createErrorResponse(
        "معرّف العقد غير صحيح",
        400
      );
    }

    const contentType =
      request.headers
        .get("content-type")
        ?.toLowerCase() || "";

    if (
      !contentType.startsWith(
        "application/json"
      )
    ) {
      return createErrorResponse(
        "نوع محتوى الطلب غير مدعوم",
        415
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
        "حجم الطلب أكبر من المسموح",
        413
      );
    }

    let body: UpdateVerificationBody;

    try {
      body =
        JSON.parse(
          rawBody
        ) as UpdateVerificationBody;
    } catch {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400
      );
    }

    const action =
      cleanText(body.action);

    const reason =
      cleanText(body.reason);

    const notes =
      cleanText(body.notes);

    if (
      action !== "set_override" &&
      action !== "clear_override"
    ) {
      return createErrorResponse(
        "نوع العملية غير صحيح",
        400
      );
    }

    if (
      reason.length < 3 ||
      reason.length > 500
    ) {
      return createErrorResponse(
        "السبب يجب أن يكون من 3 إلى 500 حرف",
        400
      );
    }

    if (notes.length > 1000) {
      return createErrorResponse(
        "الملاحظات يجب ألا تتجاوز 1000 حرف",
        400
      );
    }

    if (action === "set_override") {
      const position =
        cleanText(body.position);

      if (
        !isVerificationPosition(
          position
        )
      ) {
        return createErrorResponse(
          "اختر نتيجة صحيحة: نشط أو متأخر أو متعثر",
          400
        );
      }

      const { data, error } =
        await supabaseAdmin.rpc(
          "set_verification_override_atomic",
          {
            p_contract_id:
              cleanContractId,
            p_override_position:
              position,
            p_reason:
              reason,
            p_notes:
              notes || null,
            p_support_user_id:
              auth.user.id,
            p_support_user_name:
              auth.user.fullName,
          }
        );

      if (error) {
        console.error(
          "set_verification_override_atomic failed:",
          error
        );

        const mappedError =
          mapSetOverrideError(
            `${error.code || ""} ${
              error.message || ""
            }`
          );

        return createErrorResponse(
          mappedError.message,
          mappedError.status
        );
      }

      const rawResult =
        Array.isArray(data)
          ? data[0]
          : data;

      const result =
        rawResult &&
        typeof rawResult === "object"
          ? (rawResult as SetOverrideResult)
          : null;

      if (
        !result?.override_id ||
        !result.contract_id ||
        !isVerificationPosition(
          result.override_position
        ) ||
        result.is_active !== true
      ) {
        console.error(
          "set_verification_override_atomic returned invalid data:",
          data
        );

        return createErrorResponse(
          "تم تنفيذ العملية لكن تعذر قراءة نتيجتها",
          500
        );
      }

      return NextResponse.json(
        {
          ok: true,
          message:
            `تم تعيين نتيجة التحقق إلى ${result.override_position}`,
          data: {
            contract_id:
              result.contract_id,
            position:
              result.override_position,
            is_active:
              result.is_active,
            updated_at:
              result.updated_at,
          },
        },
        {
          status: 200,
          headers:
            noStoreHeaders(),
        }
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "clear_verification_override_atomic",
        {
          p_contract_id:
            cleanContractId,
          p_reason:
            reason,
          p_support_user_id:
            auth.user.id,
          p_support_user_name:
            auth.user.fullName,
        }
      );

    if (error) {
      console.error(
        "clear_verification_override_atomic failed:",
        error
      );

      const mappedError =
        mapClearOverrideError(
          `${error.code || ""} ${
            error.message || ""
          }`
        );

      return createErrorResponse(
        mappedError.message,
        mappedError.status
      );
    }

    const rawResult =
      Array.isArray(data)
        ? data[0]
        : data;

    const result =
      rawResult &&
      typeof rawResult === "object"
        ? (rawResult as ClearOverrideResult)
        : null;

    if (
      !result?.override_id ||
      !result.contract_id ||
      result.is_active !== false
    ) {
      console.error(
        "clear_verification_override_atomic returned invalid data:",
        data
      );

      return createErrorResponse(
        "تم تنفيذ العملية لكن تعذر قراءة نتيجتها",
        500
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          "تم إلغاء تدخل الدعم والعودة للحسبة التلقائية",
        data: {
          contract_id:
            result.contract_id,
          previous_position:
            result.previous_position,
          is_active:
            result.is_active,
          deactivated_at:
            result.deactivated_at,
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
      "Admin support verification update route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء تحديث نتيجة التحقق",
      500
    );
  }
}
