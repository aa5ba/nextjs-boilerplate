import { NextResponse } from "next/server";

import { normalizeNumber } from "@/lib/numberUtils";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PAYMENT_METHODS = [
  "شبكة",
  "تحويل",
  "نقدًا",
  "تابي",
  "تمارا",
  "إمكان",
] as const;

export const INVOICE_OPERATION_TYPES = ["sale", "purchase"] as const;

export type InvoiceOperationType = (typeof INVOICE_OPERATION_TYPES)[number];

export type SalesInvoiceRouteContext = {
  params: Promise<{ id: string }>;
};

export function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function cleanDigits(value: unknown) {
  return normalizeNumber(cleanText(value)).replace(/\D/g, "");
}

export function parsePositiveNumber(
  value: unknown,
  decimalPlaces: number
): number | null {
  const normalized = normalizeNumber(
    typeof value === "number" ? String(value) : cleanText(value)
  ).trim();

  const pattern = new RegExp(`^\\d+(?:\\.\\d{1,${decimalPlaces}})?$`);

  if (!pattern.test(normalized)) return null;

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  const multiplier = 10 ** decimalPlaces;

  return Math.round(parsed * multiplier) / multiplier;
}

export async function readJsonBody(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }

    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
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
  return createResponse({ ok: false, message, code }, status);
}

export function mapSalesInvoiceRpcError(message: string) {
  const mappings: Array<{
    token: string;
    code: string;
    message: string;
    status: number;
  }> = [
    {
      token: "INVALID_SESSION",
      code: "INVALID_SESSION",
      message: "انتهت جلسة تسجيل الدخول أو أنها غير صالحة",
      status: 401,
    },
    {
      token: "MISSING_PERMISSION",
      code: "MISSING_PERMISSION",
      message: "لا تملك الصلاحية المطلوبة",
      status: 403,
    },
    {
      token: "REQUEST_ID_PAYLOAD_MISMATCH",
      code: "REQUEST_ID_PAYLOAD_MISMATCH",
      message: "تعذر إعادة المحاولة لأن معرف الحفظ استُخدم ببيانات مختلفة",
      status: 409,
    },
    {
      token: "CANCELLATION_REQUEST_PAYLOAD_MISMATCH",
      code: "CANCELLATION_REQUEST_PAYLOAD_MISMATCH",
      message: "تعذر إعادة محاولة الإلغاء لأن معرف العملية استُخدم ببيانات مختلفة",
      status: 409,
    },
    {
      token: "SALES_INVOICE_ALREADY_CANCELLED",
      code: "SALES_INVOICE_ALREADY_CANCELLED",
      message: "الفاتورة ملغاة مسبقًا",
      status: 409,
    },
    {
      token: "SALES_INVOICE_NOT_FOUND",
      code: "SALES_INVOICE_NOT_FOUND",
      message: "الفاتورة غير موجودة في هذا الفرع",
      status: 404,
    },
    {
      token: "INVALID_OPERATION_TYPE",
      code: "INVALID_OPERATION_TYPE",
      message: "نوع العملية يجب أن يكون شراء أو بيع",
      status: 400,
    },
    {
      token: "INVENTORY_NOT_FOUND",
      code: "INVENTORY_NOT_FOUND",
      message: "رصيد المخزون غير موجود أو لا يتبع هذا الفرع",
      status: 404,
    },
    {
      token: "INSUFFICIENT_GOODS_QUANTITY",
      code: "INSUFFICIENT_GOODS_QUANTITY",
      message: "الكمية المطلوبة غير متوفرة في المخزون",
      status: 409,
    },
    {
      token: "INSUFFICIENT_GOODS_BALANCE",
      code: "INSUFFICIENT_GOODS_BALANCE",
      message: "رصيد محفظة البضائع لا يكفي لتكلفة الكمية المباعة",
      status: 409,
    },
    {
      token: "INSUFFICIENT_CASH_BALANCE",
      code: "INSUFFICIENT_CASH_BALANCE",
      message: "رصيد المحفظة النقدية للمستثمر لا يكفي لإتمام الشراء",
      status: 409,
    },
    {
      token: "PURCHASE_CANCELLATION_BLOCKED_BY_LATER_MOVEMENT",
      code: "PURCHASE_CANCELLATION_BLOCKED_BY_LATER_MOVEMENT",
      message: "لا يمكن إلغاء فاتورة الشراء لوجود حركة مخزون لاحقة على السلعة نفسها",
      status: 409,
    },
    {
      token: "GOODS_COST_NOT_INITIALIZED",
      code: "GOODS_COST_NOT_INITIALIZED",
      message: "تكلفة هذا المخزون غير محددة",
      status: 409,
    },
    {
      token: "INVALID_CUSTOMER_NAME",
      code: "INVALID_CUSTOMER_NAME",
      message: "اسم العميل غير صحيح",
      status: 400,
    },
    {
      token: "INVALID_CUSTOMER_NATIONAL_ID",
      code: "INVALID_CUSTOMER_NATIONAL_ID",
      message: "رقم الهوية يجب أن يتكون من 10 أرقام",
      status: 400,
    },
    {
      token: "INVALID_CUSTOMER_PHONE",
      code: "INVALID_CUSTOMER_PHONE",
      message: "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام",
      status: 400,
    },
    {
      token: "INVALID_QUANTITY",
      code: "INVALID_QUANTITY",
      message: "أدخل كمية صحيحة",
      status: 400,
    },
    {
      token: "INVALID_TOTAL_AMOUNT",
      code: "INVALID_TOTAL_AMOUNT",
      message: "أدخل قيمة إجمالية صحيحة",
      status: 400,
    },
    {
      token: "INVALID_PAYMENT_METHOD",
      code: "INVALID_PAYMENT_METHOD",
      message: "وسيلة الدفع غير صحيحة",
      status: 400,
    },
    {
      token: "CANCELLATION_REASON_REQUIRED",
      code: "CANCELLATION_REASON_REQUIRED",
      message: "سبب الإلغاء مطلوب",
      status: 400,
    },
  ];

  return (
    mappings.find((mapping) => message.includes(mapping.token)) ?? {
      code: "SALES_INVOICE_OPERATION_FAILED",
      message: "تعذر تنفيذ عملية الفاتورة",
      status: 500,
    }
  );
}
