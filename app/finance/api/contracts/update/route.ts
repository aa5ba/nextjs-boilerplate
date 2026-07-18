import { NextResponse } from "next/server";

import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  normalizeNumber,
  toNumber,
} from "@/lib/numberUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  branch?: unknown;
  contractId?: unknown;
  investorId?: unknown;
  investorName?: unknown;
  productId?: unknown;
  productName?: unknown;
  productQuantity?: unknown;
  printPartyType?: unknown;
  printPartyName?: unknown;
  printPartyIdentifier?: unknown;
  debtAmount?: unknown;
  paymentAmount?: unknown;
  installmentAmount?: unknown;
  paymentType?: unknown;
  paymentDueDate?: unknown;
  legalCity?: unknown;
  notes?: unknown;
};

type UpdateContractResult = {
  contract_id?: unknown;
  investor_id?: unknown;
  product_id?: unknown;
  product_quantity?: unknown;
  new_remaining_amount?: unknown;
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

function normalizeOptionalText(
  value: unknown
): string | null {
  const text = cleanText(value);

  return text || null;
}

function normalizeAmount(
  value: unknown
): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return toNumber(value);
  }

  return NaN;
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

function getUpdateError(
  message: string
) {
  if (
    message.includes(
      "PERMISSION_DENIED"
    )
  ) {
    return {
      code: "PERMISSION_DENIED",
      message:
        "ليس لديك صلاحية تعديل العقود",
      status: 403,
    };
  }

  if (
    message.includes(
      "USER_NOT_FOUND"
    )
  ) {
    return {
      code: "USER_NOT_FOUND",
      message:
        "المستخدم غير موجود أو غير نشط",
      status: 401,
    };
  }

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
      "INVESTOR_NOT_FOUND"
    )
  ) {
    return {
      code: "INVESTOR_NOT_FOUND",
      message:
        "المستثمر غير موجود أو غير نشط",
      status: 400,
    };
  }

  if (
    message.includes(
      "PRODUCT_NOT_FOUND"
    )
  ) {
    return {
      code: "PRODUCT_NOT_FOUND",
      message:
        "المنتج غير موجود أو غير نشط",
      status: 400,
    };
  }

  if (
    message.includes(
      "PAYMENT_LESS_THAN_PAID"
    )
  ) {
    return {
      code: "PAYMENT_LESS_THAN_PAID",
      message:
        "مبلغ السداد الجديد أقل من المبلغ المسدد فعليًا",
      status: 409,
    };
  }

  if (
    message.includes(
      "INVALID_QUANTITY"
    ) ||
    message.includes(
      "INVALID_AMOUNTS"
    )
  ) {
    return {
      code: message.includes(
        "INVALID_QUANTITY"
      )
        ? "INVALID_QUANTITY"
        : "INVALID_AMOUNTS",
      message: message.includes(
        "INVALID_QUANTITY"
      )
        ? "أدخل كمية صحيحة"
        : "تأكد من صحة مبالغ العقد",
      status: 400,
    };
  }

  return {
    code: "UPDATE_CONTRACT_FAILED",
    message:
      "حدث خطأ أثناء تعديل العقد",
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
          "contracts_edit",
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

    const investorId =
      cleanText(
        body.investorId
      );

    const productId =
      cleanText(
        body.productId
      );

    if (
      !UUID_PATTERN.test(
        investorId
      )
    ) {
      return createErrorResponse(
        "المستثمر غير موجود أو غير نشط",
        400,
        "INVESTOR_NOT_FOUND"
      );
    }

    if (
      !UUID_PATTERN.test(
        productId
      )
    ) {
      return createErrorResponse(
        "المنتج غير موجود أو غير نشط",
        400,
        "PRODUCT_NOT_FOUND"
      );
    }

    const investorName =
      cleanText(
        body.investorName
      );

    const productName =
      cleanText(
        body.productName
      );

    const productQuantity =
      normalizeAmount(
        body.productQuantity
      );

    const debtAmount =
      normalizeAmount(
        body.debtAmount
      );

    const paymentAmount =
      normalizeAmount(
        body.paymentAmount
      );

    const installmentAmount =
      body.installmentAmount ===
        undefined ||
      body.installmentAmount ===
        null ||
      (typeof body.installmentAmount ===
        "string" &&
        cleanText(
          body.installmentAmount
        ) === "")
        ? 0
        : normalizeAmount(
            body.installmentAmount
          );

    const printPartyType =
      cleanText(
        body.printPartyType
      );

    const printPartyName =
      cleanText(
        body.printPartyName
      );

    const printPartyIdentifier =
      normalizeOptionalText(
        body.printPartyIdentifier
      );

    const paymentType =
      cleanText(
        body.paymentType
      );

    const paymentDueDate =
      normalizeNumber(
        cleanText(
          body.paymentDueDate
        )
      );

    const legalCity =
      cleanText(
        body.legalCity
      );

    const notes =
      normalizeOptionalText(
        body.notes
      );

    if (!investorName) {
      return createErrorResponse(
        "المستثمر غير موجود أو غير نشط",
        400,
        "INVESTOR_NOT_FOUND"
      );
    }

    if (!productName) {
      return createErrorResponse(
        "المنتج غير موجود أو غير نشط",
        400,
        "PRODUCT_NOT_FOUND"
      );
    }

    if (
      !Number.isFinite(
        productQuantity
      ) ||
      productQuantity <= 0
    ) {
      return createErrorResponse(
        "أدخل كمية صحيحة",
        400,
        "INVALID_QUANTITY"
      );
    }

    if (
      !Number.isFinite(debtAmount) ||
      debtAmount <= 0 ||
      !Number.isFinite(
        paymentAmount
      ) ||
      paymentAmount <= 0 ||
      !Number.isFinite(
        installmentAmount
      ) ||
      installmentAmount < 0
    ) {
      return createErrorResponse(
        "تأكد من صحة مبالغ العقد",
        400,
        "INVALID_AMOUNTS"
      );
    }

    if (!printPartyType) {
      return createErrorResponse(
        "تعذر تحديد الطرف الأول",
        400,
        "PRINT_PARTY_TYPE_REQUIRED"
      );
    }

    if (!printPartyName) {
      return createErrorResponse(
        "لم يتم العثور على اسم المؤسسة المعتمد لهذا الفرع",
        400,
        "PRINT_PARTY_NAME_REQUIRED"
      );
    }

    if (!paymentType) {
      return createErrorResponse(
        "اختر نوع السداد",
        400,
        "PAYMENT_TYPE_REQUIRED"
      );
    }

    if (!paymentDueDate) {
      return createErrorResponse(
        "حدد تاريخ الاستحقاق",
        400,
        "PAYMENT_DUE_DATE_REQUIRED"
      );
    }

    if (!legalCity) {
      return createErrorResponse(
        "أدخل مدينة التقاضي",
        400,
        "LEGAL_CITY_REQUIRED"
      );
    }

    const {
      data: contract,
      error: contractError,
    } = await supabaseAdmin
      .from("finance_contracts")
      .select(
        "id,branch_id,is_archived,archived_at,paid_amount,contract_status"
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
      paymentAmount <
      Number(contract.paid_amount ?? 0)
    ) {
      return createErrorResponse(
        "مبلغ السداد الجديد أقل من المبلغ المسدد فعليًا",
        409,
        "PAYMENT_LESS_THAN_PAID"
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
        "update_finance_contract_atomic",
        {
          p_branch_id:
            session.branchId,
          p_contract_id:
            contractId,
          p_employee_id:
            session.userId,
          p_employee_name:
            employeeName,
          p_investor_id:
            investorId,
          p_investor_name:
            investorName,
          p_product_id:
            productId,
          p_product_name:
            productName,
          p_product_quantity:
            productQuantity,
          p_print_party_type:
            printPartyType,
          p_print_party_name:
            printPartyName,
          p_print_party_identifier:
            printPartyIdentifier,
          p_debt_amount:
            debtAmount,
          p_payment_amount:
            paymentAmount,
          p_installment_amount:
            installmentAmount,
          p_payment_type:
            paymentType,
          p_payment_due_date:
            paymentDueDate,
          p_legal_city:
            legalCity,
          p_notes: notes,
        }
      );

    if (error) {
      const mapped =
        getUpdateError(
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
        | UpdateContractResult
        | null;

    return createResponse({
      ok: true,
      contract_id:
        result?.contract_id ??
        null,
      investor_id:
        result?.investor_id ??
        null,
      product_id:
        result?.product_id ??
        null,
      product_quantity:
        result?.product_quantity ??
        null,
      new_remaining_amount:
        result?.new_remaining_amount ??
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
      "Update contract error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء تعديل العقد",
      500,
      "UPDATE_CONTRACT_FAILED"
    );
  }
}
