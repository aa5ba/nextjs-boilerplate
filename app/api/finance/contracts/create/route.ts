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

type ContractRpcRow = {
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

function parsedNumber(value: unknown): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeDigits(value)
    .replace(/[٬,\s]/g, "")
    .replace(/٫/g, ".");

  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = parsedNumber(value);

  return parsed !== null && parsed > 0
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

  const parsed = parsedNumber(value);

  return parsed !== null && parsed >= 0
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

function firstRpcRow(data: unknown): ContractRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!isPlainObject(row)) {
    return null;
  }

  const contractId = text(row.contract_id, 100);
  const customerId = text(row.customer_id, 100);
  const rawNoteId = row.note_id;
  const noteId =
    rawNoteId === null || rawNoteId === undefined
      ? null
      : text(rawNoteId, 100);

  if (
    !UUID_PATTERN.test(contractId) ||
    !UUID_PATTERN.test(customerId) ||
    (noteId !== null && !UUID_PATTERN.test(noteId))
  ) {
    return null;
  }

  const contractNumber = row.contract_number;
  const noteNumber = row.note_number;

  if (
    !(
      typeof contractNumber === "number" ||
      typeof contractNumber === "string"
    ) ||
    !(
      noteNumber === null ||
      noteNumber === undefined ||
      typeof noteNumber === "number" ||
      typeof noteNumber === "string"
    )
  ) {
    return null;
  }

  return {
    contract_id: contractId,
    note_id: noteId,
    customer_id: customerId,
    contract_number: contractNumber,
    note_number:
      noteNumber === undefined ? null : noteNumber,
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

  if (upper.includes("CONTRACTS_CREATE_PERMISSION_DENIED")) {
    return {
      message: "لا تملك صلاحية إنشاء العقود",
      status: 403,
      code: "CONTRACT_PERMISSION_DENIED",
    };
  }

  if (
    upper.includes("PROMISSORY_NOTE_CREATE_PERMISSION_DENIED") ||
    upper.includes("PROMISSORY_NOTE_LINK_PERMISSION_DENIED")
  ) {
    return {
      message: "لا تملك صلاحية إنشاء سند مرتبط بالعقد",
      status: 403,
      code: "NOTE_PERMISSION_DENIED",
    };
  }

  if (
    upper.includes("INVALID_EMPLOYEE_SESSION") ||
    upper.includes("BRANCH_NOT_FOUND_OR_INACTIVE")
  ) {
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

  if (
    databaseCode === "23505" &&
    upper.includes(
      "FINANCE_PROMISSORY_NOTES_ONE_ACTIVE_PER_CONTRACT_KEY"
    )
  ) {
    return {
      message: "يوجد سند نشط مرتبط بهذا العقد مسبقًا",
      status: 409,
      code: "ACTIVE_NOTE_ALREADY_EXISTS",
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
    upper.includes("DUE_DATE_BEFORE_CONTRACT_DATE") ||
    upper.includes("INSTALLMENT_SCHEDULE_ALREADY_EXISTS")
  ) {
    return {
      message: "تحقق من البيانات المدخلة ثم أعد المحاولة",
      status: 400,
      code: "INVALID_INPUT",
    };
  }

  return {
    message: "تعذر إنشاء العقد حاليًا",
    status: 500,
    code: "CREATE_CONTRACT_FAILED",
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
      console.error("Create contract user check failed:", userError);

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
      console.error(
        "Create contract branch check failed:",
        branchError
      );

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
      data: canCreateContract,
      error: contractPermissionError,
    } = await supabaseAdmin.rpc(
      "finance_user_has_permission",
      {
        p_branch_id: session.branchId,
        p_user_id: session.userId,
        p_permission_key: "contracts_create",
      }
    );

    if (contractPermissionError) {
      console.error(
        "Create contract permission check failed:",
        contractPermissionError
      );

      return errorResponse(
        "تعذر التحقق من صلاحية إنشاء العقود",
        500,
        "PERMISSION_CHECK_FAILED"
      );
    }

    if (canCreateContract !== true) {
      return errorResponse(
        "لا تملك صلاحية إنشاء العقود",
        403,
        "CONTRACT_PERMISSION_DENIED"
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

    const customerFullName = text(
      parsedBody.customerFullName,
      200
    );
    const customerNationalId = identifier(
      parsedBody.customerNationalId
    );
    const customerBirthHijri = hijriDate(
      parsedBody.customerBirthHijri
    );
    const customerPhone = identifier(
      parsedBody.customerPhone
    );
    const customerWorkName = text(
      parsedBody.customerWorkName,
      200
    );
    const customerAddress = text(
      parsedBody.customerAddress,
      500
    );

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
    const guarantorFullName = text(
      parsedBody.guarantorFullName,
      200
    );
    const guarantorNationalId = identifier(
      parsedBody.guarantorNationalId
    );
    const guarantorBirthHijri = hijriDate(
      parsedBody.guarantorBirthHijri
    );
    const guarantorPhone = identifier(
      parsedBody.guarantorPhone
    );
    const guarantorWorkName = text(
      parsedBody.guarantorWorkName,
      200
    );
    const guarantorAddress = text(
      parsedBody.guarantorAddress,
      500
    );

    const createPromissoryNote = booleanValue(
      parsedBody.createPromissoryNote
    );
    const allowNegativeInventory = booleanValue(
      parsedBody.allowNegativeInventory
    );

    if (
      customerFullName.length < 2 ||
      !NATIONAL_ID_PATTERN.test(customerNationalId) ||
      !PHONE_PATTERN.test(customerPhone) ||
      !HIJRI_DATE_PATTERN.test(customerBirthHijri) ||
      !CONTRACT_TYPES.has(contractType) ||
      !UUID_PATTERN.test(investorId) ||
      !UUID_PATTERN.test(productId) ||
      productQuantity === null ||
      !PRINT_PARTY_TYPES.has(printPartyType) ||
      debtAmount === null ||
      paymentAmount === null ||
      !validIsoDate(firstDueDate) ||
      !validIsoDate(contractIssueDate) ||
      firstDueDate < contractIssueDate ||
      !legalCity ||
      judicialAmount === null
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
        guarantorFullName.length < 2 ||
        !NATIONAL_ID_PATTERN.test(guarantorNationalId) ||
        guarantorNationalId === customerNationalId ||
        !PHONE_PATTERN.test(guarantorPhone) ||
        !HIJRI_DATE_PATTERN.test(guarantorBirthHijri)
      )
    ) {
      return errorResponse(
        "تحقق من بيانات الكفيل، ولا يمكن أن يكون العميل كفيلًا لنفسه",
        400,
        "INVALID_GUARANTOR"
      );
    }

    if (createPromissoryNote) {
      const [createPermissionResult, linkPermissionResult] =
        await Promise.all([
          supabaseAdmin.rpc(
            "finance_user_has_permission",
            {
              p_branch_id: session.branchId,
              p_user_id: session.userId,
              p_permission_key: "promissory_note_create",
            }
          ),
          supabaseAdmin.rpc(
            "finance_user_has_permission",
            {
              p_branch_id: session.branchId,
              p_user_id: session.userId,
              p_permission_key:
                "promissory_note_link_contract",
            }
          ),
        ]);

      if (
        createPermissionResult.error ||
        linkPermissionResult.error
      ) {
        console.error(
          "Create contract note permission check failed:",
          {
            createError: createPermissionResult.error,
            linkError: linkPermissionResult.error,
          }
        );

        return errorResponse(
          "تعذر التحقق من صلاحية إنشاء السند",
          500,
          "NOTE_PERMISSION_CHECK_FAILED"
        );
      }

      if (
        createPermissionResult.data !== true ||
        linkPermissionResult.data !== true
      ) {
        return errorResponse(
          "لا تملك صلاحية إنشاء سند مرتبط بالعقد",
          403,
          "NOTE_PERMISSION_DENIED"
        );
      }
    }

    const { data: rpcData, error: rpcError } =
      await supabaseAdmin.rpc(
        "create_finance_contract_secure_atomic",
        {
          p_branch_id: session.branchId,
          p_employee_id: session.userId,

          p_customer_full_name: customerFullName,
          p_customer_national_id: customerNationalId,
          p_customer_birth_hijri: customerBirthHijri,
          p_customer_phone: customerPhone,
          p_customer_work_name: customerWorkName || null,
          p_customer_address: customerAddress || null,

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

          p_legal_city: legalCity,
          p_judicial_amount: judicialAmount,
          p_notes: notes || null,

          p_has_guarantor: hasGuarantor,
          p_guarantor_full_name: hasGuarantor
            ? guarantorFullName
            : null,
          p_guarantor_national_id: hasGuarantor
            ? guarantorNationalId
            : null,
          p_guarantor_birth_hijri: hasGuarantor
            ? guarantorBirthHijri
            : null,
          p_guarantor_phone: hasGuarantor
            ? guarantorPhone
            : null,
          p_guarantor_work_name: hasGuarantor
            ? guarantorWorkName || null
            : null,
          p_guarantor_address: hasGuarantor
            ? guarantorAddress || null
            : null,

          p_create_promissory_note: createPromissoryNote,
          p_allow_negative_inventory:
            allowNegativeInventory,
        }
      );

    if (rpcError) {
      console.error("Create contract RPC failed:", {
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
        "Create contract RPC returned invalid data:",
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
      "Create contract route unexpected error:",
      error
    );

    return errorResponse(
      "حدث خطأ غير متوقع أثناء إنشاء العقد",
      500,
      "UNEXPECTED_ERROR"
    );
  }
}
