import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  FINANCE_BRANCH_SESSION_COOKIE_NAME,
  verifyFinanceBranchSessionToken,
} from "@/lib/financeBranchSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerificationRpcRow = {
  customer_name: string | null;
  national_id: string | null;
  contract_amount: number | string | null;
  contract_date: string | null;
  contract_state: string | null;
  contract_position: string | null;
};

type VerificationRequestBody = {
  nationalId?: unknown;
};

type ContractState =
  | "ساري"
  | "مغلق";

type ContractPosition =
  | "نشط"
  | "متأخر"
  | "متعثر";

function normalizeDigits(
  value: string
) {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String(
        "٠١٢٣٤٥٦٧٨٩".indexOf(digit)
      )
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)
      )
    );
}

function cleanText(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeNationalId(
  value: unknown
) {
  return normalizeDigits(
    cleanText(value)
  )
    .replace(/\D/g, "")
    .slice(0, 10);
}

function normalizeAmount(
  value: unknown
) {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return parsed;
}

function normalizeContractState(
  value: unknown
): ContractState {
  return value === "مغلق"
    ? "مغلق"
    : "ساري";
}

function normalizeContractPosition(
  value: unknown
): ContractPosition {
  if (value === "متعثر") {
    return "متعثر";
  }

  if (value === "متأخر") {
    return "متأخر";
  }

  return "نشط";
}

function isVerificationRow(
  value: unknown
): value is VerificationRpcRow {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );
}

function createJsonResponse(
  body: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

function createErrorResponse(
  message: string,
  status: number
) {
  return createJsonResponse(
    {
      ok: false,
      message,
    },
    status
  );
}

export async function POST(
  request: Request
) {
  try {
    const cookieStore =
      await cookies();

    const sessionToken =
      cookieStore.get(
        FINANCE_BRANCH_SESSION_COOKIE_NAME
      )?.value;

    const session =
      verifyFinanceBranchSessionToken(
        sessionToken
      );

    if (!session) {
      return createErrorResponse(
        "انتهت جلسة تسجيل الدخول، سجل الدخول مرة أخرى",
        401
      );
    }

    let body: VerificationRequestBody;

    try {
      const parsedBody: unknown =
        await request.json();

      if (
        !parsedBody ||
        typeof parsedBody !== "object" ||
        Array.isArray(parsedBody)
      ) {
        return createErrorResponse(
          "رقم الهوية غير صحيح",
          400
        );
      }

      body =
        parsedBody as VerificationRequestBody;
    } catch {
      return createErrorResponse(
        "رقم الهوية غير صحيح",
        400
      );
    }

    const nationalId =
      normalizeNationalId(
        body.nationalId
      );

    if (
      !/^\d{10}$/.test(
        nationalId
      )
    ) {
      return createErrorResponse(
        "رقم الهوية يجب أن يتكون من 10 أرقام",
        400
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "verify_customer_across_branches",
        {
          p_requesting_branch_id:
            session.branchId,

          p_national_id:
            nationalId,
        }
      );

    if (error) {
      console.error(
        "Customer verification RPC failed:",
        {
          message:
            error.message,
          code:
            error.code,
          details:
            error.details,
          hint:
            error.hint,
        }
      );

      return createErrorResponse(
        "تعذر إتمام التحقق، حاول مرة أخرى",
        500
      );
    }

    const rows =
      Array.isArray(data)
        ? data.filter(
            isVerificationRow
          )
        : [];

    if (rows.length === 0) {
      return createJsonResponse(
        {
          ok: true,
          found: false,
          customer: null,
          contracts: [],
        },
        200
      );
    }

    const firstRow =
      rows[0];

    const customerName =
      cleanText(
        firstRow.customer_name
      );

    const returnedNationalId =
      normalizeNationalId(
        firstRow.national_id
      ) || nationalId;

    const contracts =
      rows.map((row) => ({
        amount:
          normalizeAmount(
            row.contract_amount
          ),

        date:
          cleanText(
            row.contract_date
          ),

        state:
          normalizeContractState(
            row.contract_state
          ),

        position:
          normalizeContractPosition(
            row.contract_position
          ),
      }));

    return createJsonResponse(
      {
        ok: true,
        found: true,

        customer: {
          fullName:
            customerName,
          nationalId:
            returnedNationalId,
        },

        contracts,
      },
      200
    );
  } catch (error) {
    console.error(
      "Customer verification route unexpected error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء التحقق، حاول مرة أخرى",
      500
    );
  }
}
