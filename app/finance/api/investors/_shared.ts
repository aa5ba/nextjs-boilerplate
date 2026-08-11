import { NextResponse } from "next/server";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cleanText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export function normalizeDigits(
  value: unknown
): string {
  return cleanText(value)
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
    )
    .replace(/\D/g, "");
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
      "X-Content-Type-Options":
        "nosniff",
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

export function investorDuplicateMessage(
  investor: {
    national_id?: string | null;
    phone?: string | null;
  },
  nationalId: string,
  phone: string
) {
  if (
    nationalId &&
    investor.national_id ===
      nationalId
  ) {
    return "يوجد مستثمر آخر بنفس رقم الهوية داخل هذا الفرع";
  }

  if (
    phone &&
    investor.phone === phone
  ) {
    return "يوجد مستثمر آخر بنفس رقم الجوال داخل هذا الفرع";
  }

  return "يوجد مستثمر آخر بنفس البيانات داخل هذا الفرع";
}
