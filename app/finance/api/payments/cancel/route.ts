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
  paymentId?: unknown;
};

type CancelPaymentResult = {
  payment_id?: unknown;
  new_paid_amount?: unknown;
  new_remaining_amount?: unknown;
  new_contract_status?: unknown;
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

function normalizeCancelErrorCode(
  message: string
) {
  if (
    message.includes(
      "PAYMENT_ALREADY_CANCELLED"
    )
  ) {
    return "PAYMENT_ALREADY_CANCELLED";
  }

  if (
    message.includes(
      "PAYMENT_NOT_FOUND"
    )
  ) {
    return "PAYMENT_NOT_FOUND";
  }

  if (
    message.includes(
      "CONTRACT_NOT_FOUND"
    )
  ) {
    return "CONTRACT_NOT_FOUND";
  }

  return "CANCEL_PAYMENT_FAILED";
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

    const paymentId =
      cleanText(
        body.paymentId
      );

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

    if (!paymentId) {
      return createErrorResponse(
        "معرف عملية السداد مطلوب",
        400,
        "PAYMENT_REQUIRED"
      );
    }

    const session =
      await requireFinanceBranchSession({
        requestedBranchSlug:
          branch,
        requiredPermission:
          "payments_cancel",
      });

    const employeeName =
      cleanText(
        session.user.fullName
      ) ||
      cleanText(
        session.user.username
      ) ||
      "الموظف";

    const { data, error } =
      await supabaseAdmin.rpc(
        "cancel_payment_atomic_v2",
        {
          p_branch_id:
            session.branchId,

          p_contract_id:
            contractId,

          p_payment_id:
            paymentId,

          p_employee_name:
            employeeName,
        }
      );

    if (error) {
      const message =
        error.message ||
        "تعذر إلغاء عملية السداد";

      return createErrorResponse(
        message,
        400,
        normalizeCancelErrorCode(
          message
        )
      );
    }

    const result =
      (Array.isArray(data)
        ? data[0] ?? null
        : data ?? null) as
        | CancelPaymentResult
        | null;

    return createResponse({
      ok: true,
      payment_id:
        result?.payment_id ??
        null,
      new_paid_amount:
        result?.new_paid_amount ??
        null,
      new_remaining_amount:
        result?.new_remaining_amount ??
        null,
      new_contract_status:
        result?.new_contract_status ??
        null,
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
      "Cancel payment error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء إلغاء عملية السداد",
      500,
      "CANCEL_PAYMENT_FAILED"
    );
  }
}
