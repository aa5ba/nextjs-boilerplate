import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  FINANCE_BRANCH_SESSION_COOKIE_NAME,
  financeBranchSessionDeleteCookieOptions,
  verifyFinanceBranchSessionToken,
} from "@/lib/financeBranchSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NATIONAL_ID_PATTERN = /^[0-9]{10}$/;
const PHONE_PATTERN = /^05[0-9]{8}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HIJRI_DATE_PATTERN =
  /^[0-9]{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|30)$/;

const CONTRACT_TYPES = new Set([
  "عقد بيع",
  "عقد تقسيط",
  "عقد بيع حر",
]);

const PRINT_PARTY_TYPES = new Set([
  "organization",
  "investor",
]);

type BranchUserRow = {
  id: string;
  branch_id: string;
  full_name: string | null;
  username: string | null;
  is_active: boolean | null;
  session_version: number | string | null;
  self_disabled: boolean | null;
  disabled_at: string | null;
};

type BranchRow = {
  id: string;
  branch_slug: string | null;
  is_active: boolean | null;
  is_deleted: boolean | null;
};

type NewRequestRpcRow = {
  contract_id: string;
  note_id: string | null;
  customer_id: string;
  contract_number: number | string;
  note_number: number | string | null;
};

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function text(
  value: unknown,
  maxLength = 5_000
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    )
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    );
}

function identifier(value: unknown): string {
  return normalizeDigits(text(value, 100)).replace(
    /[^0-9]/g,
    ""
  );
}

function hijriDate(value: unknown): string {
  return normalizeDigits(text(value, 20))
    .replace(/[.\-]/g, "/")
    .replace(/\s/g, "");
}

function positiveNumber(value: unknown): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  ) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeDigits(value)
    .replace(/[٬,\s]/g, "")
    .replace(/٫/g, ".");

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function nonNegativeNumber(value: unknown): number | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  ) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeDigits(value)
    .replace(/[٬,\s]/g, "")
    .replace(/٫/g, ".");

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = positiveNumber(value);

  return parsed !== null && Number.isSafeInteger(parsed)
    ? parsed
    : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function versionNumber(value: unknown): number | null {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : null;
}

function validIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number
): NextResponse {
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

function errorResponse(
  message: string,
  status: number,
  code: string
): NextResponse {
  return jsonResponse(
    {
      ok: false,
      message,
      code,
    },
    status
  );
}

function sessionError(message: string): NextResponse {
  const response = errorResponse(
    message,
    401,
    "INVALID_SESSION"
  );

  response.cookies.set(
    FINANCE_BRANCH_SESSION_COOKIE_NAME,
    "",
    financeBranchSessionDeleteCookieOptions
  );

  return response;
}

function firstRpcRow(data: unknown): NewRequestRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!isPlainObject(row)) {
    return null;
  }

  const contractId = text(row.contract_id, 100);
  const rawNoteId = row.note_id;
  const noteId =
    rawNoteId === null || rawNoteId === undefined
      ? null
      : text(rawNoteId, 100);
  const customerId = text(row.customer_id, 100);

  if (
    !UUID_PATTERN.test(contractId) ||
    (noteId !== null && !UUID_PATTERN.test(noteId)) ||
    !UUID_PATTERN.test(customerId)
  ) {
    return null;
  }

  return {
    contract_id: contractId,
    note_id: noteId,
    customer_id: customerId,
    contract_number:
      typeof row.contract_number === "number" ||
      typeof row.contract_number === "string"
        ? row.contract_number
        : "",
    note_number:
      row.note_number === null || row.note_number === undefined
        ? null
        : typeof row.note_number === "number" ||
            typeof row.note_number === "string"
          ? row.note_number
          : "",
  };
}

function mappedRpcError(
  message: string,
  databaseCode?: string
): {
  message: string;
  status: number;
  code: string;
} {
  const upper = message.toUpperCase();

  if (upper.includes("NEW_REQUEST_PERMISSION_DENIED")) {
    return {
      message: "لا تملك صلاحية إنشاء طلب جديد",
      status: 403,
      code: "PERMISSION_DENIED",
    };
  }

  if (upper.includes("INVALID_EMPLOYEE_SESSION")) {
    return {
      message: "انتهت جلسة الموظف أو لم تعد صالحة",
      status: 401,
      code: "INVALID_SESSION",
    };
  }

  if (
    upper.includes(
      "NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED"
    )
  ) {
    return {
      message:
        "الكمية المطلوبة أكبر من المخزون. أكد السماح بوصول المخزون إلى السالب",
      status: 409,
      code: "NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED",
    };
  }

  if (upper.includes("GUARANTOR_SAME_AS_CUSTOMER")) {
    return {
      message: "لا يمكن أن يكون العميل كفيلًا لنفسه",
      status: 400,
      code: "GUARANTOR_SAME_AS_CUSTOMER",
    };
  }

  if (upper.includes("GUARANTOR_SAME_AS_BUYER")) {
    return {
      message:
        "لا يمكن أن تكون هوية الكفيل مطابقة لهوية المشتري",
      status: 400,
      code: "GUARANTOR_SAME_AS_BUYER",
    };
  }

  if (upper.includes("GUARANTOR_NAME_REQUIRED")) {
    return {
      message: "أدخل اسم الكفيل",
      status: 400,
      code: "GUARANTOR_NAME_REQUIRED",
    };
  }

  if (
    upper.includes(
      "INVALID_GUARANTOR_NATIONAL_ID"
    )
  ) {
    return {
      message:
        "رقم هوية الكفيل يجب أن يتكون من 10 أرقام",
      status: 400,
      code: "INVALID_GUARANTOR_NATIONAL_ID",
    };
  }

  if (upper.includes("INVALID_GUARANTOR_PHONE")) {
    return {
      message: "رقم جوال الكفيل غير صحيح",
      status: 400,
      code: "INVALID_GUARANTOR_PHONE",
    };
  }

  if (upper.includes("INVESTOR_NOT_FOUND")) {
    return {
      message: "المستثمر غير موجود أو غير نشط في هذا الفرع",
      status: 400,
      code: "INVALID_INVESTOR",
    };
  }

  if (upper.includes("PRODUCT_NOT_FOUND")) {
    return {
      message: "المنتج غير موجود أو غير نشط في هذا الفرع",
      status: 400,
      code: "INVALID_PRODUCT",
    };
  }

  if (upper.includes("INVALID_JUDICIAL_AMOUNT")) {
    return {
      message: "مبلغ التقاضي غير صحيح",
      status: 400,
      code: "INVALID_JUDICIAL_AMOUNT",
    };
  }

  if (databaseCode === "23505") {
    return {
      message: "حدث تعارض مع سجل موجود، أعد المحاولة",
      status: 409,
      code: "DUPLICATE_RECORD",
    };
  }

  if (
    upper.includes("INVALID_") ||
    upper.includes("_REQUIRED") ||
    upper.includes("INSTALLMENTS_EXCEED_PAYMENT_AMOUNT") ||
    upper.includes("DUE_DATE_BEFORE_CONTRACT_DATE")
  ) {
    return {
      message: "تحقق من البيانات المدخلة ثم أعد المحاولة",
      status: 400,
      code: "INVALID_INPUT",
    };
  }

  return {
    message: "تعذر إنشاء الطلب الجديد حاليًا",
    status: 500,
    code: "CREATE_REQUEST_FAILED",
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    if (!sameOrigin(request)) {
      return errorResponse(
        "تعذر التحقق من مصدر الطلب",
        403,
        "INVALID_ORIGIN"
      );
    }

    const contentType =
      request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().startsWith("application/json")) {
      return errorResponse(
        "نوع بيانات الطلب غير مدعوم",
        415,
        "UNSUPPORTED_CONTENT_TYPE"
      );
    }

    const declaredLength = Number(
      request.headers.get("content-length") ?? "0"
    );

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_BODY_BYTES
    ) {
      return errorResponse(
        "حجم بيانات الطلب أكبر من الحد المسموح",
        413,
        "REQUEST_TOO_LARGE"
      );
    }

    const token = request.cookies.get(
      FINANCE_BRANCH_SESSION_COOKIE_NAME
    )?.value;

    const session = verifyFinanceBranchSessionToken(token);

    if (!session) {
      return sessionError(
        "انتهت جلسة تسجيل الدخول، سجل الدخول مرة أخرى"
      );
    }

    const { data: userData, error: userError } =
      await supabaseAdmin
        .from("finance_branch_users")
        .select(
          "id, branch_id, full_name, username, is_active, session_version, self_disabled, disabled_at"
        )
        .eq("id", session.userId)
        .eq("branch_id", session.branchId)
        .maybeSingle();

    if (userError) {
      console.error("New request user check failed:", userError);

      return errorResponse(
        "تعذر التحقق من جلسة الموظف",
        500,
        "SESSION_CHECK_FAILED"
      );
    }

    const user = userData as BranchUserRow | null;
    const databaseSessionVersion = versionNumber(
      user?.session_version
    );

    if (
      !user ||
      user.id !== session.userId ||
      user.branch_id !== session.branchId ||
      user.is_active !== true ||
      user.self_disabled === true ||
      user.disabled_at !== null ||
      databaseSessionVersion === null ||
      databaseSessionVersion !== session.sessionVersion
    ) {
      return sessionError(
        "حساب الموظف معطل أو لم تعد الجلسة صالحة"
      );
    }

    const { data: branchData, error: branchError } =
      await supabaseAdmin
        .from("finance_branches")
        .select("id, branch_slug, is_active, is_deleted")
        .eq("id", session.branchId)
        .maybeSingle();

    if (branchError) {
      console.error("New request branch check failed:", branchError);

      return errorResponse(
        "تعذر التحقق من بيانات الفرع",
        500,
        "BRANCH_CHECK_FAILED"
      );
    }

    const branch = branchData as BranchRow | null;

    if (
      !branch ||
      branch.id !== session.branchId ||
      text(branch.branch_slug, 64).toLowerCase() !==
        session.branchSlug ||
      branch.is_active === false ||
      branch.is_deleted === true
    ) {
      return sessionError(
        "الفرع غير نشط أو تغيرت بيانات الجلسة"
      );
    }

    const {
      data: hasPermission,
      error: permissionError,
    } = await supabaseAdmin.rpc(
      "finance_user_has_permission",
      {
        p_branch_id: session.branchId,
        p_user_id: session.userId,
        p_permission_key: "new_request_create",
      }
    );

    if (permissionError) {
      console.error(
        "New request permission check failed:",
        permissionError
      );

      return errorResponse(
        "تعذر التحقق من صلاحية إنشاء الطلب",
        500,
        "PERMISSION_CHECK_FAILED"
      );
    }

    if (hasPermission !== true) {
      return errorResponse(
        "لا تملك صلاحية إنشاء طلب جديد",
        403,
        "PERMISSION_DENIED"
      );
    }

    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return errorResponse(
        "حجم بيانات الطلب أكبر من الحد المسموح",
        413,
        "REQUEST_TOO_LARGE"
      );
    }

    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(rawBody) as unknown;
    } catch {
      return errorResponse(
        "بيانات الطلب غير صالحة",
        400,
        "INVALID_JSON"
      );
    }

    if (!isPlainObject(parsedBody)) {
      return errorResponse(
        "بيانات الطلب غير صالحة",
        400,
        "INVALID_BODY"
      );
    }

    const fullName = text(parsedBody.fullName, 200);
    const nationalId = identifier(parsedBody.nationalId);
    const birthHijri = hijriDate(parsedBody.birthHijri);
    const phone = identifier(parsedBody.phone);
    const workName = text(parsedBody.workName, 200);
    const address = text(parsedBody.address, 500);

    const contractType = text(parsedBody.contractType, 30);
    const investorId = text(parsedBody.investorId, 100);
    const productId = text(parsedBody.productId, 100);
    const productQuantity = positiveNumber(
      parsedBody.productQuantity
    );
    const printPartyType = text(
      parsedBody.printPartyType,
      30
    );

    const debtAmount = positiveNumber(parsedBody.debtAmount);
    const paymentAmount = positiveNumber(
      parsedBody.paymentAmount
    );

    const firstDueDate = text(parsedBody.firstDueDate, 20);
    const contractIssueDate = text(
      parsedBody.contractIssueDate,
      20
    );
    const contractIssueDateHijri = hijriDate(
      parsedBody.contractIssueDateHijri
    );

    const legalCity = text(parsedBody.legalCity, 100);
    const judicialAmount = nonNegativeNumber(
      parsedBody.judicialAmount
    );
    const notes = text(parsedBody.notes, 5_000);

    const hasGuarantor = booleanValue(
      parsedBody.hasGuarantor
    );
    const hasJudicialAmount = booleanValue(
      parsedBody.hasJudicialAmount
    );
    const guarantorName = text(
      parsedBody.guarantorName,
      200
    );
    const guarantorNationalId = identifier(
      parsedBody.guarantorNationalId
    );
    const guarantorPhone = identifier(
      parsedBody.guarantorPhone
    );
    const guarantorBirthHijri = hijriDate(
      parsedBody.guarantorBirthHijri
    );

    const allowNegativeInventory = booleanValue(
      parsedBody.allowNegativeInventory
    );

    if (contractType === "عقد بيع حر") {
      const freeSale = isPlainObject(parsedBody.freeSale)
        ? parsedBody.freeSale
        : {};

      const buyerName = text(freeSale.buyerName, 200);
      const buyerNationalId = identifier(
        freeSale.buyerNationalId
      );
      const buyerPhone = identifier(freeSale.buyerPhone);
      const dueAmount = nonNegativeNumber(
        freeSale.dueAmount
      );
      const contractDate = text(freeSale.contractDate, 20);
      const dueDate = text(freeSale.dueDate, 20);
      const paymentMethod = text(
        freeSale.paymentMethod,
        40
      );
      const freeSaleJudicialAmount = hasJudicialAmount
        ? judicialAmount
        : 0;

      if (
        buyerName.length < 2 ||
        !NATIONAL_ID_PATTERN.test(buyerNationalId) ||
        (buyerPhone && !PHONE_PATTERN.test(buyerPhone)) ||
        dueAmount === null ||
        freeSaleJudicialAmount === null ||
        (contractDate && !validIsoDate(contractDate)) ||
        (dueDate && !validIsoDate(dueDate)) ||
        (contractDate && dueDate && dueDate < contractDate) ||
        (
          paymentMethod &&
          ![
            "على دفعة واحدة",
            "على دفعات",
          ].includes(paymentMethod)
        )
      ) {
        return errorResponse(
          "تحقق من بيانات عقد البيع الحر",
          400,
          "INVALID_FREE_SALE_INPUT"
        );
      }

      if (
        hasJudicialAmount &&
        (
          freeSaleJudicialAmount === null ||
          freeSaleJudicialAmount <= 0
        )
      ) {
        return errorResponse(
          "أدخل المبلغ القضائي",
          400,
          "INVALID_JUDICIAL_AMOUNT"
        );
      }

      if (hasGuarantor) {
        if (guarantorName.length < 2) {
          return errorResponse(
            "أدخل اسم الكفيل",
            400,
            "GUARANTOR_NAME_REQUIRED"
          );
        }

        if (
          !NATIONAL_ID_PATTERN.test(guarantorNationalId)
        ) {
          return errorResponse(
            "رقم هوية الكفيل يجب أن يتكون من 10 أرقام",
            400,
            "INVALID_GUARANTOR_NATIONAL_ID"
          );
        }

        if (guarantorNationalId === buyerNationalId) {
          return errorResponse(
            "لا يمكن أن تكون هوية الكفيل مطابقة لهوية المشتري",
            400,
            "GUARANTOR_SAME_AS_BUYER"
          );
        }

        if (
          guarantorPhone &&
          !PHONE_PATTERN.test(guarantorPhone)
        ) {
          return errorResponse(
            "رقم جوال الكفيل غير صحيح",
            400,
            "INVALID_GUARANTOR_PHONE"
          );
        }
      }

      const { data: rpcData, error: rpcError } =
        await supabaseAdmin.rpc(
          "create_free_sale_contract_atomic",
          {
            p_branch_id: session.branchId,
            p_employee_id: session.userId,
            p_buyer_name: buyerName,
            p_buyer_national_id: buyerNationalId,
            p_buyer_phone: buyerPhone || null,
            p_sale_day: text(freeSale.saleDay, 100) || null,
            p_contract_date: contractDate || null,
            p_city: text(freeSale.city, 100) || null,
            p_seller_name:
              text(freeSale.sellerName, 200) || null,
            p_seller_national_id:
              identifier(freeSale.sellerNationalId) || null,
            p_item_description:
              text(freeSale.itemDescription, 5_000) || null,
            p_due_amount: dueAmount,
            p_payment_method: paymentMethod || null,
            p_due_date: dueDate || null,
            p_seller_signature_name:
              text(freeSale.sellerSignatureName, 200) || null,
            p_buyer_signature_name:
              text(freeSale.buyerSignatureName, 200) || null,
            p_judicial_amount: freeSaleJudicialAmount,
            p_has_guarantor: hasGuarantor,
            p_guarantor_name: hasGuarantor
              ? guarantorName
              : null,
            p_guarantor_national_id: hasGuarantor
              ? guarantorNationalId
              : null,
            p_guarantor_phone: hasGuarantor
              ? guarantorPhone || null
              : null,
          }
        );

      if (rpcError) {
        console.error("Create free sale request RPC failed:", {
          message: rpcError.message,
          code: rpcError.code,
          details: rpcError.details,
          hint: rpcError.hint,
          branchId: session.branchId,
          employeeId: session.userId,
        });

        const mapped = mappedRpcError(
          rpcError.message,
          rpcError.code
        );

        if (mapped.code === "INVALID_SESSION") {
          return sessionError(mapped.message);
        }

        return errorResponse(
          mapped.message,
          mapped.status,
          mapped.code
        );
      }

      const result = firstRpcRow(rpcData);

      if (!result) {
        console.error(
          "Create free sale request RPC returned invalid data:",
          rpcData
        );

        return errorResponse(
          "تم تنفيذ العملية لكن تعذر قراءة النتيجة بأمان",
          500,
          "INVALID_RPC_RESULT"
        );
      }

      return jsonResponse(
        {
          ok: true,
          contractId: result.contract_id,
          noteId: result.note_id,
          customerId: result.customer_id,
          contractNumber: result.contract_number,
          noteNumber: result.note_number,
        },
        201
      );
    }

    if (
      fullName.length < 2 ||
      !NATIONAL_ID_PATTERN.test(nationalId) ||
      !PHONE_PATTERN.test(phone) ||
      (birthHijri && !HIJRI_DATE_PATTERN.test(birthHijri)) ||
      !CONTRACT_TYPES.has(contractType) ||
      !UUID_PATTERN.test(investorId) ||
      !UUID_PATTERN.test(productId) ||
      productQuantity === null ||
      !PRINT_PARTY_TYPES.has(printPartyType) ||
      debtAmount === null ||
      paymentAmount === null ||
      judicialAmount === null ||
      !validIsoDate(firstDueDate) ||
      !validIsoDate(contractIssueDate)
    ) {
      return errorResponse(
        "تحقق من بيانات العميل والعقد والمبالغ والتواريخ",
        400,
        "INVALID_INPUT"
      );
    }

    if (
      contractIssueDateHijri &&
      !HIJRI_DATE_PATTERN.test(contractIssueDateHijri)
    ) {
      return errorResponse(
        "تاريخ إصدار العقد الهجري غير صحيح",
        400,
        "INVALID_CONTRACT_ISSUE_HIJRI_DATE"
      );
    }

    let installmentAmount: number | null = null;
    let installmentsCount = 1;

    if (contractType === "عقد تقسيط") {
      installmentAmount = positiveNumber(
        parsedBody.installmentAmount
      );

      const parsedCount = positiveInteger(
        parsedBody.installmentsCount
      );

      if (
        installmentAmount === null ||
        parsedCount === null ||
        parsedCount > 600 ||
        (parsedCount > 1 &&
          installmentAmount * (parsedCount - 1) >=
            paymentAmount)
      ) {
        return errorResponse(
          "قيمة الدفعة أو عدد الدفعات لا يتوافق مع مبلغ السداد",
          400,
          "INVALID_INSTALLMENT_PLAN"
        );
      }

      installmentsCount = parsedCount;
    }

    if (
      hasGuarantor &&
      (
        guarantorName.length < 2 ||
        !NATIONAL_ID_PATTERN.test(guarantorNationalId) ||
        guarantorNationalId === nationalId ||
        !PHONE_PATTERN.test(guarantorPhone) ||
        (
          guarantorBirthHijri &&
          !HIJRI_DATE_PATTERN.test(guarantorBirthHijri)
        )
      )
    ) {
      return errorResponse(
        "تحقق من بيانات الكفيل، ولا يمكن أن يكون العميل كفيلًا لنفسه",
        400,
        "INVALID_GUARANTOR"
      );
    }

    const employeeName =
      text(user.full_name, 200) ||
      text(user.username, 100) ||
      "الموظف";

    const { data: rpcData, error: rpcError } =
      await supabaseAdmin.rpc(
        "create_new_request_secure_optional_city_atomic",
        {
          p_branch_id: session.branchId,
          p_employee_id: session.userId,
          p_employee_name: employeeName,

          p_full_name: fullName,
          p_national_id: nationalId,
          p_birth_hijri: birthHijri || null,
          p_phone: phone,
          p_work_name: workName || null,
          p_address: address || null,

          p_contract_type: contractType,
          p_investor_id: investorId,
          p_product_id: productId,
          p_product_quantity: productQuantity,
          p_print_party_type: printPartyType,

          p_debt_amount: debtAmount,
          p_payment_amount: paymentAmount,
          p_installment_amount: installmentAmount,
          p_installments_count: installmentsCount,

          p_first_due_date: firstDueDate,
          p_contract_issue_date: contractIssueDate,
          p_contract_issue_date_hijri:
            contractIssueDateHijri || null,

          p_legal_city: legalCity || null,
          p_judicial_amount: judicialAmount,
          p_notes: notes || null,

          p_has_guarantor: hasGuarantor,
          p_guarantor_name: hasGuarantor
            ? guarantorName
            : null,
          p_guarantor_national_id: hasGuarantor
            ? guarantorNationalId
            : null,
          p_guarantor_phone: hasGuarantor
            ? guarantorPhone
            : null,
          p_guarantor_birth_hijri: hasGuarantor
            ? guarantorBirthHijri || null
            : null,

          p_allow_negative_inventory:
            allowNegativeInventory,
        }
      );

    if (rpcError) {
      console.error("Create new request RPC failed:", {
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details,
        hint: rpcError.hint,
        branchId: session.branchId,
        employeeId: session.userId,
      });

      const mapped = mappedRpcError(
        rpcError.message,
        rpcError.code
      );

      if (mapped.code === "INVALID_SESSION") {
        return sessionError(mapped.message);
      }

      return errorResponse(
        mapped.message,
        mapped.status,
        mapped.code
      );
    }

    const result = firstRpcRow(rpcData);

    if (!result) {
      console.error(
        "Create new request RPC returned invalid data:",
        rpcData
      );

      return errorResponse(
        "تم تنفيذ العملية لكن تعذر قراءة النتيجة بأمان",
        500,
        "INVALID_RPC_RESULT"
      );
    }

    return jsonResponse(
      {
        ok: true,
        contractId: result.contract_id,
        noteId: result.note_id,
        customerId: result.customer_id,
        contractNumber: result.contract_number,
        noteNumber: result.note_number,
      },
      201
    );
  } catch (error) {
    console.error(
      "Create new request route unexpected error:",
      error
    );

    return errorResponse(
      "حدث خطأ غير متوقع أثناء إنشاء الطلب الجديد",
      500,
      "UNEXPECTED_ERROR"
    );
  }
}
