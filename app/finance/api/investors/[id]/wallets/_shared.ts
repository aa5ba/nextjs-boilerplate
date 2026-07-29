import { NextResponse } from "next/server";

import type { RequiredFinanceBranchSession } from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export type InvestorRow = {
  id: string;
  branch_id: string;
  investor_name: string | null;
  national_id: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

export function cleanText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export function normalizeDigits(
  value: string
): string {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String(
        "٠١٢٣٤٥٦٧٨٩".indexOf(
          digit
        )
      )
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".indexOf(
          digit
        )
      )
    );
}

export function createResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function createErrorResponse(
  message: string,
  status: number,
  code = "REQUEST_FAILED"
) {
  return createResponse(
    {
      ok: false,
      message,
      code,
    },
    status
  );
}

export async function readJsonBody(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown =
      await request.json();

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parsePositiveAmount(
  value: unknown
): number | null {
  const normalized =
    typeof value === "number"
      ? String(value)
      : normalizeDigits(
          cleanText(value)
        );

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(
      normalized
    )
  ) {
    return null;
  }

  const amount = Number(normalized);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

export function parsePage(
  value: string | null
): number {
  const page = Number(
    normalizeDigits(value || "")
  );

  return Number.isSafeInteger(page) &&
    page > 0
    ? page
    : 1;
}

export function parseDateFilter(
  value: string | null
): string | null {
  const date = normalizeDigits(
    cleanText(value)
  );

  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : null;
}

export function parseTransactionType(
  value: string | null
): string | null {
  const type = cleanText(value);

  if (
    type === "cash_deposit" ||
    type === "cash_withdrawal" ||
    type === "goods_opening_balance" ||
    type === "goods_purchase" ||
    type === "manual_goods_decrease" ||
    type === "goods_to_contract" ||
    type === "goods_return_from_contract" ||
    type === "contract_created" ||
    type === "contract_amount_adjustment" ||
    type === "contract_investor_transfer" ||
    type === "contract_payment_received" ||
    type === "payment_reversed"
  ) {
    return type;
  }

  return null;
}

export function getActorName(
  session: RequiredFinanceBranchSession
) {
  return (
    cleanText(session.user.fullName) ||
    cleanText(session.user.username) ||
    "الموظف"
  );
}

export async function getInvestorForSession(
  session: RequiredFinanceBranchSession,
  investorId: string
): Promise<InvestorRow | null> {
  const { data, error } =
    await supabaseAdmin
      .from("finance_investors")
      .select(
        `
          id,
          branch_id,
          investor_name,
          national_id,
          phone,
          notes,
          is_active,
          created_at
        `
      )
      .eq("id", investorId)
      .eq("branch_id", session.branchId)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as InvestorRow | null) ?? null;
}

export function mapWalletRpcError(
  message: string
) {
  if (
    message.includes("INVALID_SESSION")
  ) {
    return {
      code: "INVALID_SESSION",
      message:
        "انتهت جلسة تسجيل الدخول أو أنها غير صالحة",
      status: 401,
    };
  }

  if (
    message.includes("MISSING_PERMISSION")
  ) {
    return {
      code: "MISSING_PERMISSION",
      message:
        "لا تملك الصلاحية المطلوبة",
      status: 403,
    };
  }

  if (
    message.includes("INVESTOR_NOT_FOUND")
  ) {
    return {
      code: "INVESTOR_NOT_FOUND",
      message:
        "المستثمر غير موجود أو لا يتبع هذا الفرع",
      status: 404,
    };
  }

  if (
    message.includes("INVESTOR_INACTIVE")
  ) {
    return {
      code: "INVESTOR_INACTIVE",
      message: "المستثمر غير نشط",
      status: 409,
    };
  }

  if (
    message.includes("INVALID_AMOUNT")
  ) {
    return {
      code: "INVALID_AMOUNT",
      message: "أدخل مبلغًا صحيحًا",
      status: 400,
    };
  }

  if (
    message.includes(
      "INSUFFICIENT_CASH_BALANCE"
    )
  ) {
    return {
      code: "INSUFFICIENT_CASH_BALANCE",
      message:
        "الرصيد النقدي غير كافٍ",
      status: 409,
    };
  }

  if (
    message.includes("PRODUCT_NOT_FOUND")
  ) {
    return {
      code: "PRODUCT_NOT_FOUND",
      message:
        "المنتج غير موجود أو لا يتبع هذا الفرع",
      status: 404,
    };
  }

  if (
    message.includes(
      "GOODS_COST_NOT_INITIALIZED"
    )
  ) {
    return {
      code: "GOODS_COST_NOT_INITIALIZED",
      message:
        "يجب تحديد تكلفة السلع الافتتاحية أولًا",
      status: 409,
    };
  }

  if (
    message.includes(
      "GOODS_COST_ALREADY_INITIALIZED"
    )
  ) {
    return {
      code: "GOODS_COST_ALREADY_INITIALIZED",
      message:
        "تم تحديد تكلفة هذه السلع مسبقًا",
      status: 409,
    };
  }

  if (
    message.includes("INVALID_UNIT_COST")
  ) {
    return {
      code: "INVALID_UNIT_COST",
      message:
        "أدخل تكلفة وحدة صحيحة",
      status: 400,
    };
  }

  if (
    message.includes("INVALID_QUANTITY")
  ) {
    return {
      code: "INVALID_QUANTITY",
      message: "أدخل كمية صحيحة",
      status: 400,
    };
  }

  if (
    message.includes(
      "INSUFFICIENT_GOODS_QUANTITY"
    ) ||
    message.includes(
      "INSUFFICIENT_GOODS_BALANCE"
    )
  ) {
    return {
      code: "INSUFFICIENT_GOODS_BALANCE",
      message:
        "رصيد السلع أو الكمية غير كافٍ",
      status: 409,
    };
  }

  if (
    message.includes("REASON_REQUIRED")
  ) {
    return {
      code: "REASON_REQUIRED",
      message:
        "سبب التعديل مطلوب",
      status: 400,
    };
  }

  return {
    code: "WALLET_OPERATION_FAILED",
    message:
      "تعذر تنفيذ عملية المحفظة",
    status: 500,
  };
}
