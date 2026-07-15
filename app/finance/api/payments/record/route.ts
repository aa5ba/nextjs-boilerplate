import { NextResponse } from "next/server";

import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  branch?: unknown;
  contractId?: unknown;
  paymentAmount?: unknown;
  paymentType?: unknown;
  paymentMethod?: unknown;
  allowOverpayment?: unknown;
};

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function createResponse(
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
    },
  });
}

function createErrorResponse(
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

async function readRequestBody(
  request: Request
): Promise<RequestBody | null> {
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

    return parsed as RequestBody;
  } catch {
    return null;
  }
}

function normalizePaymentAmount(
  value: unknown
): number | null {
  const amount =
    typeof value === "number" ||
    typeof value === "string"
      ? Number(value)
      : NaN;

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return amount;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await readRequestBody(
        request
      );

    if (!body) {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400,
        "INVALID_BODY"
      );
    }

    const branch =
      cleanText(
        body.branch
      ).toLowerCase();

    const contractId =
      cleanText(
        body.contractId
      );

    const paymentAmount =
      normalizePaymentAmount(
        body.paymentAmount
      );

    const paymentType =
      cleanText(
        body.paymentType
      );

    const paymentMethod =
      cleanText(
        body.paymentMethod
      );

    if (
      body.allowOverpayment !== undefined &&
      typeof body.allowOverpayment !==
        "boolean"
    ) {
      return createErrorResponse(
        "قيمة تجاوز المتبقي غير صحيحة",
        400,
        "INVALID_ALLOW_OVERPAYMENT"
      );
    }

    const allowOverpayment =
      body.allowOverpayment ?? false;

    if (!branch) {
      return createErrorResponse(
        "تعذر تحديد الفرع",
        400,
        "BRANCH_REQUIRED"
      );
    }

    if (!contractId) {
      return createErrorResponse(
        "معرف العقد مطلوب",
        400,
        "CONTRACT_REQUIRED"
      );
    }

    if (paymentAmount === null) {
      return createErrorResponse(
        "مبلغ السداد غير صحيح",
        400,
        "INVALID_PAYMENT_AMOUNT"
      );
    }

    if (!paymentType) {
      return createErrorResponse(
        "نوع السداد مطلوب",
        400,
        "PAYMENT_TYPE_REQUIRED"
      );
    }

    if (!paymentMethod) {
      return createErrorResponse(
        "طريقة الدفع مطلوبة",
        400,
        "PAYMENT_METHOD_REQUIRED"
      );
    }

    const session =
      await requireFinanceBranchSession({
        requestedBranchSlug:
          branch,
        requiredPermission:
          "payments_create",
      });

    const employeeName =
      cleanText(
        session.user.fullName
      ) ||
      cleanText(
        session.user.username
      ) ||
      "الموظف";

    const {
      data: contract,
      error: contractError,
    } = await supabaseAdmin
      .from("finance_contracts")
      .select("id,is_archived")
      .eq("id", contractId)
      .eq(
        "branch_id",
        session.branchId
      )
      .maybeSingle();

    if (contractError) {
      throw new Error(
        contractError.message
      );
    }

    if (!contract) {
      return createErrorResponse(
        "العقد غير موجود أو لا يتبع هذا الفرع",
        404,
        "CONTRACT_NOT_FOUND"
      );
    }

    if (contract.is_archived === true) {
      return createErrorResponse(
        "لا يمكن تسجيل سداد على عقد مؤرشف",
        409,
        "CONTRACT_ARCHIVED"
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "record_payment_atomic_v2",
        {
          p_branch_id:
            session.branchId,

          p_contract_id:
            contractId,

          p_payment_amount:
            paymentAmount,

          p_payment_type:
            paymentType,

          p_payment_method:
            paymentMethod,

          p_employee_name:
            employeeName,

          p_allow_overpayment:
            allowOverpayment,
        }
      );

    if (error) {
      const message =
        error.message ||
        "تعذر تسجيل السداد";

      return createErrorResponse(
        message,
        400,
        message.includes(
          "PAYMENT_EXCEEDS_REMAINING"
        )
          ? "PAYMENT_EXCEEDS_REMAINING"
          : "RECORD_PAYMENT_FAILED"
      );
    }

    const payment =
      Array.isArray(data)
        ? data[0] ?? null
        : data ?? null;

    const paymentId =
      payment &&
      typeof payment === "object" &&
      "payment_id" in payment
        ? payment.payment_id
        : null;

    return createResponse({
      ok: true,
      payment,
      payment_id:
        paymentId,
    });
  } catch (error) {
    if (
      isFinanceBranchSessionError(
        error
      )
    ) {
      return createErrorResponse(
        error.message,
        error.status,
        error.code
      );
    }

    console.error(
      "Record payment error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء تسجيل السداد",
      500,
      "RECORD_PAYMENT_FAILED"
    );
  }
}
