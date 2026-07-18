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

type CloseContractResult = {
  contract_id?: unknown;
  new_paid_amount?: unknown;
  new_remaining_amount?: unknown;
  new_contract_status?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(
  value: unknown
): string {
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

function getCloseError(
  message: string
) {
  if (
    message.includes(
      "CONTRACT_NOT_FOUND"
    )
  ) {
    return {
      code: "CONTRACT_NOT_FOUND",
      message:
        "العقد غير موجود أو لا يتبع هذا الفرع",
      status: 404,
    };
  }

  if (
    message.includes(
      "CONTRACT_ALREADY_PAID"
    )
  ) {
    return {
      code: "CONTRACT_ALREADY_PAID",
      message:
        "العقد مسدد بالكامل مسبقًا",
      status: 409,
    };
  }

  return {
    code: "CLOSE_CONTRACT_FAILED",
    message: "تعذر إغلاق العقد",
    status: 500,
  };
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

    if (!branch) {
      return createErrorResponse(
        "تعذر تحديد الفرع",
        400,
        "BRANCH_REQUIRED"
      );
    }

    const session =
      await requireFinanceBranchSession({
        requestedBranchSlug:
          branch,
        requiredPermission:
          "contracts_close",
      });

    const contractId =
      cleanText(
        body.contractId
      );

    if (
      !UUID_PATTERN.test(
        contractId
      )
    ) {
      return createErrorResponse(
        "معرف العقد غير صحيح",
        400,
        "INVALID_CONTRACT_ID"
      );
    }

    const {
      data: contract,
      error: contractError,
    } = await supabaseAdmin
      .from("finance_contracts")
      .select(
        "id,branch_id,is_archived,archived_at,contract_status,remaining_amount"
      )
      .eq("id", contractId)
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

    if (
      contract.branch_id !==
      session.branchId
    ) {
      return createErrorResponse(
        "لا تملك صلاحية الوصول إلى هذا العقد",
        403,
        "CONTRACT_BRANCH_MISMATCH"
      );
    }

    if (
      contract.is_archived === true ||
      Boolean(contract.archived_at)
    ) {
      return createErrorResponse(
        "العقد غير موجود أو لا يتبع هذا الفرع",
        404,
        "CONTRACT_NOT_FOUND"
      );
    }

    if (
      Number(
        contract.remaining_amount ||
          0
      ) <= 0 ||
      cleanText(
        contract.contract_status
      ) === "تم السداد"
    ) {
      return createErrorResponse(
        "العقد مسدد بالكامل مسبقًا",
        409,
        "CONTRACT_ALREADY_PAID"
      );
    }

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
        "close_contract_atomic",
        {
          p_branch_id:
            session.branchId,
          p_contract_id:
            contractId,
          p_employee_name:
            employeeName,
        }
      );

    if (error) {
      const mapped =
        getCloseError(
          error.message ||
            ""
        );

      return createErrorResponse(
        mapped.message,
        mapped.status,
        mapped.code
      );
    }

    const result =
      (Array.isArray(data)
        ? data[0] ?? null
        : data ?? null) as
        | CloseContractResult
        | null;

    return createResponse({
      ok: true,
      contract_id:
        result?.contract_id ??
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
      "Close contract error:",
      error
    );

    return createErrorResponse(
      "تعذر إغلاق العقد",
      500,
      "CLOSE_CONTRACT_FAILED"
    );
  }
}
