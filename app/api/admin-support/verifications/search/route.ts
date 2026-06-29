import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BODY_BYTES = 2_048;

type SearchRequestBody = {
  search_value?: unknown;
};

type VerificationSearchRow = {
  contract_id: string;
  contract_number: number | string | null;
  branch_id: string;
  branch_name: string | null;
  branch_slug: string | null;
  customer_id: string;
  customer_name: string | null;
  national_id: string | null;
  customer_phone: string | null;
  debt_amount: number | string | null;
  paid_amount: number | string | null;
  remaining_amount: number | string | null;
  payment_due_date: string | null;
  contract_date: string | null;
  contract_state: string | null;
  automatic_position: string | null;
  effective_position: string | null;
  has_support_override: boolean | null;
  override_position: string | null;
  override_reason: string | null;
  override_notes: string | null;
  override_updated_at: string | null;
  default_declared_at: string | null;
  default_expires_at: string | null;
  default_reason: string | null;
  default_notes: string | null;
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
    response.cookies.set(ADMIN_SUPPORT_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
      priority: "high",
    });
  }

  return response;
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    )
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    );
}

function cleanSearchValue(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return normalizeDigits(value)
    .replace(/\D/g, "")
    .slice(0, 30);
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);

    return (
      requestUrl.protocol === originUrl.protocol &&
      requestUrl.host === originUrl.host
    );
  } catch {
    return false;
  }
}

function toFiniteNumber(value: unknown) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;

  return Number.isFinite(numberValue) ? numberValue : 0;
}

export async function POST(request: Request) {
  try {
    const auth = await verifyAdminSupportRequest(
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
      return createErrorResponse("الطلب غير مسموح", 403);
    }

    const contentType =
      request.headers.get("content-type")?.toLowerCase() || "";

    if (!contentType.startsWith("application/json")) {
      return createErrorResponse(
        "نوع محتوى الطلب غير مدعوم",
        415
      );
    }

    const rawBody = await request.text();

    if (
      Buffer.byteLength(rawBody, "utf8") >
      MAX_REQUEST_BODY_BYTES
    ) {
      return createErrorResponse(
        "حجم الطلب أكبر من المسموح",
        413
      );
    }

    let body: SearchRequestBody;

    try {
      body = JSON.parse(rawBody) as SearchRequestBody;
    } catch {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400
      );
    }

    const searchValue = cleanSearchValue(body.search_value);

    if (!searchValue) {
      return createErrorResponse(
        "اكتب رقم الهوية أو رقم العقد",
        400
      );
    }

    if (searchValue.length > 30) {
      return createErrorResponse(
        "قيمة البحث طويلة جدًا",
        400
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "search_verification_contracts_for_support",
      {
        p_search_value: searchValue,
      }
    );

    if (error) {
      console.error(
        "search_verification_contracts_for_support failed:",
        error
      );

      return createErrorResponse(
        "تعذر البحث في نتائج التحقق",
        500
      );
    }

    const rows = Array.isArray(data)
      ? (data as VerificationSearchRow[])
      : [];

    const normalizedRows = rows.map((row) => ({
      contract_id: row.contract_id,
      contract_number:
        row.contract_number === null
          ? null
          : String(row.contract_number),
      branch_id: row.branch_id,
      branch_name: row.branch_name || "-",
      branch_slug: row.branch_slug || "",
      customer_id: row.customer_id,
      customer_name: row.customer_name || "العميل",
      national_id: row.national_id || "",
      customer_phone: row.customer_phone || "",
      debt_amount: toFiniteNumber(row.debt_amount),
      paid_amount: toFiniteNumber(row.paid_amount),
      remaining_amount: toFiniteNumber(row.remaining_amount),
      payment_due_date: row.payment_due_date,
      contract_date: row.contract_date,
      contract_state: row.contract_state || "ساري",
      automatic_position: row.automatic_position || "نشط",
      effective_position: row.effective_position || "نشط",
      has_support_override:
        row.has_support_override === true,
      override_position: row.override_position,
      override_reason: row.override_reason,
      override_notes: row.override_notes,
      override_updated_at: row.override_updated_at,
      default_declared_at: row.default_declared_at,
      default_expires_at: row.default_expires_at,
      default_reason: row.default_reason,
      default_notes: row.default_notes,
    }));

    const { error: logError } = await supabaseAdmin
      .from("admin_support_logs")
      .insert({
        user_id: auth.user.id,
        user_name: auth.user.fullName,
        action: "بحث في نتائج التحقق",
        target_type: "verification_search",
        target_id: searchValue,
        details: `تم البحث برقم الهوية أو العقد، وعدد النتائج: ${normalizedRows.length}`,
      });

    if (logError) {
      console.error(
        "Verification search log insert failed:",
        logError
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: normalizedRows,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support verification search route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء البحث في نتائج التحقق",
      500
    );
  }
}
