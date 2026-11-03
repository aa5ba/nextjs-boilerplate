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
};

type CancelContractResult = {
  contract_id?: unknown;
  new_contract_status?: unknown;
  cancelled_payments_count?: unknown;
  returned_inventory_quantity?: unknown;
  returned_inventory_cost?: unknown;
  reversed_cash_amount?: unknown;
  removed_contracts_wallet_amount?: unknown;
  cancelled_at?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function createResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
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
    const parsed: unknown = await request.json();

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

function getCancelContractError(message: string) {
  if (message.includes("CONTRACT_NOT_FOUND")) {
    return {
      code: "CONTRACT_NOT_FOUND",
      message: "العقد غير موجود أو لا يتبع هذا الفرع",
      status: 404,
    };
  }

  if (message.includes("CONTRACT_ALREADY_CANCELLED")) {
    return {
      code: "CONTRACT_ALREADY_CANCELLED",
      message: "تم إلغاء هذا العقد مسبقًا",
      status: 409,
    };
  }

  if (message.includes("CONTRACT_ARCHIVED")) {
    return {
      code: "CONTRACT_NOT_FOUND",
      message: "العقد غير موجود أو لا يتبع هذا الفرع",
      status: 404,
    };
  }

  if (message.includes("CONTRACT_CANCEL_PERMISSION_DENIED")) {
    return {
      code: "CONTRACT_CANCEL_PERMISSION_DENIED",
      message: "لا تملك صلاحية إلغاء العقد",
      status: 403,
    };
  }

  if (message.includes("INVALID_EMPLOYEE_SESSION")) {
    return {
      code: "INVALID_SESSION",
      message: "انتهت جلسة الموظف أو لم تعد صالحة",
      status: 401,
    };
  }

  if (message.includes("INSUFFICIENT_CASH_BALANCE")) {
    return {
      code: "INSUFFICIENT_CASH_BALANCE",
      message:
        "لا يكفي رصيد المحفظة النقدية لعكس دفعات العقد؛ لم يتم إلغاء أي جزء من العملية",
      status: 409,
    };
  }

  if (
    message.includes("CONTRACT_INVENTORY_HISTORY_MISMATCH") ||
    message.includes("CONTRACT_INVENTORY_HISTORY_INVALID")
  ) {
    return {
      code: "CONTRACT_INVENTORY_HISTORY_INVALID",
      message:
        "تعذر إثبات كمية المخزون أو تكلفته التاريخية لهذا العقد؛ لم يتم إلغاء أي جزء من العملية",
      status: 409,
    };
  }

  if (message.includes("INVENTORY_NOT_FOUND")) {
    return {
      code: "INVENTORY_NOT_FOUND",
      message:
        "تعذر العثور على المخزون الأصلي للعقد؛ لم يتم إلغاء أي جزء من العملية",
      status: 409,
    };
  }

  return {
    code: "CANCEL_CONTRACT_FAILED",
    message: "تعذر إلغاء العقد",
    status: 500,
  };
}

export async function POST(request: Request) {
  try {
    const body = await readRequestBody(request);

    if (!body) {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400,
        "INVALID_BODY"
      );
    }

    const branch = cleanText(body.branch).toLowerCase();
    const contractId = cleanText(body.contractId);

    if (!branch) {
      return createErrorResponse(
        "تعذر تحديد الفرع",
        400,
        "BRANCH_REQUIRED"
      );
    }

    if (!UUID_PATTERN.test(contractId)) {
      return createErrorResponse(
        "معرف العقد غير صحيح",
        400,
        "INVALID_CONTRACT_ID"
      );
    }

    const session = await requireFinanceBranchSession({
      requestedBranchSlug: branch,
      requiredPermission: "contracts_close",
    });

    const employeeName =
      cleanText(session.user.fullName) ||
      cleanText(session.user.username) ||
      "الموظف";

    const { data, error } = await supabaseAdmin.rpc(
      "cancel_finance_contract_atomic",
      {
        p_branch_id: session.branchId,
        p_contract_id: contractId,
        p_employee_id: session.userId,
        p_employee_name: employeeName,
      }
    );

    if (error) {
      const mapped = getCancelContractError(error.message || "");

      return createErrorResponse(
        mapped.message,
        mapped.status,
        mapped.code
      );
    }

    const result = (Array.isArray(data)
      ? data[0] ?? null
      : data ?? null) as CancelContractResult | null;

    if (!result?.contract_id) {
      return createErrorResponse(
        "تم تنفيذ العملية لكن تعذر قراءة نتيجتها بأمان",
        500,
        "INVALID_RPC_RESULT"
      );
    }

    return createResponse({
      ok: true,
      contract_id: result.contract_id,
      new_contract_status: result.new_contract_status,
      cancelled_payments_count: result.cancelled_payments_count,
      returned_inventory_quantity:
        result.returned_inventory_quantity,
      returned_inventory_cost: result.returned_inventory_cost,
      reversed_cash_amount: result.reversed_cash_amount,
      removed_contracts_wallet_amount:
        result.removed_contracts_wallet_amount,
      cancelled_at: result.cancelled_at,
    });
  } catch (error) {
    if (isFinanceBranchSessionError(error)) {
      return createErrorResponse(
        error.message,
        error.status,
        error.code
      );
    }

    console.error("Cancel contract error:", error);

    return createErrorResponse(
      "تعذر إلغاء العقد",
      500,
      "CANCEL_CONTRACT_FAILED"
    );
  }
}
