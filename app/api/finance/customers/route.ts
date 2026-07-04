import { NextRequest, NextResponse } from "next/server";

import {
  FINANCE_BRANCH_SESSION_COOKIE_NAME,
  financeBranchSessionDeleteCookieOptions,
  verifyFinanceBranchSessionToken,
} from "@/lib/financeBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BODY_BYTES = 32_768;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BRANCH_SLUG_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

type SessionUserRow = {
  id: string;
  branch_id: string;
  full_name: string | null;
  username: string | null;
  role: string | null;
  permissions: unknown;
  is_active: boolean | null;
  session_version: number | string | null;
  disabled_at: string | null;
  self_disabled: boolean | null;
};

type SessionBranchRow = {
  id: string;
  branch_slug: string | null;
  is_active: boolean | null;
  is_deleted: boolean | null;
};

type CustomerLookupRow = {
  id: string;
  group_id: string | null;
  full_name: string | null;
  national_id: string | null;
  birth_hijri: string | null;
  phone: string | null;
  work_name: string | null;
  work: string | null;
  salary: number | string | null;
  bank: string | null;
  broker: string | null;
};

type CustomerRpcRow = {
  customer_id: string;
  was_created: boolean;
  customer_name: string | null;
};

type CustomerRequestBody = {
  branchSlug?: unknown;
  fullName?: unknown;
  nationalId?: unknown;
  birthHijri?: unknown;
  phone?: unknown;
  groupId?: unknown;
  workName?: unknown;
  salary?: unknown;
  bank?: unknown;
  broker?: unknown;
};

type AuthenticatedFinanceContext = {
  branchId: string;
  branchSlug: string;
  employeeId: string;
  employeeName: string;
};

function createJsonResponse(
  body: Record<string, unknown>,
  status: number
): NextResponse {
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

function createErrorResponse(
  message: string,
  status: number,
  code?: string
): NextResponse {
  return createJsonResponse(
    {
      ok: false,
      message,
      ...(code ? { code } : {}),
    },
    status
  );
}

function createInvalidSessionResponse(
  message = "انتهت جلسة تسجيل الدخول، سجّل الدخول مرة أخرى"
): NextResponse {
  const response = createErrorResponse(
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

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function normalizeNationalId(value: unknown): string {
  return normalizeDigits(cleanText(value))
    .replace(/\D/g, "")
    .slice(0, 10);
}

function normalizePhone(value: unknown): string {
  return normalizeDigits(cleanText(value))
    .replace(/\D/g, "")
    .slice(0, 10);
}

function normalizeBranchSlug(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function normalizeHijriDate(value: unknown): string {
  return normalizeDigits(cleanText(value))
    .replace(/[.\-]/g, "/")
    .replace(/\s+/g, "")
    .replace(/\/{2,}/g, "/")
    .slice(0, 10);
}

function normalizeOptionalUuid(value: unknown): string | null {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  return UUID_PATTERN.test(cleaned) ? cleaned : "";
}

function normalizeOptionalMoney(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    cleanText(value) === ""
  ) {
    return null;
  }

  const normalized = normalizeDigits(String(value))
    .replace(/,/g, "")
    .trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return Number.NaN;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }

  return Math.round(parsed * 100) / 100;
}

function normalizeVersion(value: unknown): number | null {
  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function getFirstRpcRow<T>(data: unknown): T | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!isPlainObject(row)) {
    return null;
  }

  return row as T;
}

function hasSafeRequestSource(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    fetchSite === "cross-site" ||
    fetchSite === "same-site"
  ) {
    return false;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function hasAcceptableBodySize(request: NextRequest): boolean {
  const rawLength = request.headers.get("content-length");

  if (!rawLength) {
    return true;
  }

  const parsedLength = Number(rawLength);

  return (
    Number.isFinite(parsedLength) &&
    parsedLength >= 0 &&
    parsedLength <= MAX_REQUEST_BODY_BYTES
  );
}

function isValidHijriDateShape(value: string): boolean {
  const parts = value.split("/");

  if (parts.length !== 3) {
    return false;
  }

  const [first, second, third] = parts;

  if (
    !/^\d+$/.test(first) ||
    !/^\d+$/.test(second) ||
    !/^\d+$/.test(third)
  ) {
    return false;
  }

  let year: number;
  let month: number;
  let day: number;

  if (first.length === 4) {
    year = Number(first);
    month = Number(second);
    day = Number(third);
  } else if (third.length === 4) {
    day = Number(first);
    month = Number(second);
    year = Number(third);
  } else {
    return false;
  }

  return (
    year >= 1300 &&
    year <= 1600 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 30
  );
}

function mapDatabaseError(
  message: string,
  code: string | null | undefined
): NextResponse {
  const normalizedMessage = message.toUpperCase();

  if (
    normalizedMessage.includes("CUSTOMERS_CREATE_PERMISSION_DENIED")
  ) {
    return createErrorResponse(
      "لا تملك صلاحية إنشاء أو تحديث العملاء",
      403,
      "PERMISSION_DENIED"
    );
  }

  if (
    normalizedMessage.includes("INVALID_EMPLOYEE_SESSION") ||
    normalizedMessage.includes("EMPLOYEE_REQUIRED")
  ) {
    return createInvalidSessionResponse();
  }

  if (
    normalizedMessage.includes("BRANCH_NOT_FOUND_OR_INACTIVE") ||
    normalizedMessage.includes("BRANCH_REQUIRED")
  ) {
    return createErrorResponse(
      "الفرع غير موجود أو غير نشط",
      403,
      "INVALID_BRANCH"
    );
  }

  if (normalizedMessage.includes("CUSTOMER_GROUP_NOT_FOUND")) {
    return createErrorResponse(
      "مجموعة العملاء المختارة غير موجودة في هذا الفرع",
      400,
      "INVALID_CUSTOMER_GROUP"
    );
  }

  if (
    normalizedMessage.includes("INVALID_CUSTOMER_NATIONAL_ID")
  ) {
    return createErrorResponse(
      "رقم الهوية يجب أن يتكون من 10 أرقام",
      400,
      "INVALID_NATIONAL_ID"
    );
  }

  if (normalizedMessage.includes("INVALID_CUSTOMER_PHONE")) {
    return createErrorResponse(
      "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام",
      400,
      "INVALID_PHONE"
    );
  }

  if (
    normalizedMessage.includes("INVALID_CUSTOMER_HIJRI_BIRTH_DATE")
  ) {
    return createErrorResponse(
      "تاريخ الميلاد الهجري غير صحيح",
      400,
      "INVALID_HIJRI_DATE"
    );
  }

  if (
    normalizedMessage.includes("CUSTOMER_NAME_REQUIRED") ||
    normalizedMessage.includes("INVALID_CUSTOMER_NAME")
  ) {
    return createErrorResponse(
      "اسم العميل غير صحيح",
      400,
      "INVALID_CUSTOMER_NAME"
    );
  }

  if (normalizedMessage.includes("INVALID_CUSTOMER_SALARY")) {
    return createErrorResponse(
      "الراتب يجب أن يكون أكبر من صفر",
      400,
      "INVALID_SALARY"
    );
  }

  if (code === "23503") {
    return createErrorResponse(
      "تعذر الحفظ بسبب ارتباط غير صحيح ببيانات الفرع",
      400,
      "INVALID_RELATION"
    );
  }

  if (code === "23505") {
    return createErrorResponse(
      "تعذر حفظ العميل بسبب تعارض في البيانات",
      409,
      "CUSTOMER_CONFLICT"
    );
  }

  return createErrorResponse(
    "حدث خطأ أثناء حفظ بيانات العميل",
    500,
    "CUSTOMER_SAVE_FAILED"
  );
}

async function authenticateFinanceRequest(
  request: NextRequest
): Promise<AuthenticatedFinanceContext | NextResponse> {
  const token = request.cookies.get(
    FINANCE_BRANCH_SESSION_COOKIE_NAME
  )?.value;

  let session;

  try {
    session = verifyFinanceBranchSessionToken(token);
  } catch (error) {
    console.error(
      "Finance customers session verification failed:",
      error
    );

    return createInvalidSessionResponse();
  }

  if (!session) {
    return createInvalidSessionResponse();
  }

  const [{ data: userData, error: userError }, { data: branchData, error: branchError }] =
    await Promise.all([
      supabaseAdmin
        .from("finance_branch_users")
        .select(
          "id, branch_id, full_name, username, role, permissions, is_active, session_version, disabled_at, self_disabled"
        )
        .eq("id", session.userId)
        .eq("branch_id", session.branchId)
        .maybeSingle<SessionUserRow>(),

      supabaseAdmin
        .from("finance_branches")
        .select("id, branch_slug, is_active, is_deleted")
        .eq("id", session.branchId)
        .maybeSingle<SessionBranchRow>(),
    ]);

  if (userError || branchError) {
    console.error("Finance customers session database check failed:", {
      userError,
      branchError,
    });

    return createErrorResponse(
      "تعذر التحقق من جلسة الموظف",
      500,
      "SESSION_CHECK_FAILED"
    );
  }

  if (!userData || !branchData) {
    return createInvalidSessionResponse();
  }

  const currentSessionVersion = normalizeVersion(
    userData.session_version
  );

  const currentBranchSlug = normalizeBranchSlug(
    branchData.branch_slug
  );

  if (
    userData.is_active !== true ||
    userData.disabled_at !== null ||
    userData.self_disabled === true ||
    branchData.is_active === false ||
    branchData.is_deleted === true ||
    currentSessionVersion === null ||
    currentSessionVersion !== session.sessionVersion ||
    currentBranchSlug !== session.branchSlug ||
    !BRANCH_SLUG_PATTERN.test(currentBranchSlug)
  ) {
    return createInvalidSessionResponse();
  }

  const { data: hasPermission, error: permissionError } =
    await supabaseAdmin.rpc("finance_user_has_permission", {
      p_branch_id: session.branchId,
      p_user_id: session.userId,
      p_permission_key: "customers_create",
    });

  if (permissionError) {
    console.error(
      "Finance customers permission check failed:",
      permissionError
    );

    return createErrorResponse(
      "تعذر التحقق من صلاحية إنشاء العملاء",
      500,
      "PERMISSION_CHECK_FAILED"
    );
  }

  if (hasPermission !== true) {
    return createErrorResponse(
      "لا تملك صلاحية إنشاء أو تحديث العملاء",
      403,
      "PERMISSION_DENIED"
    );
  }

  const employeeName =
    cleanText(userData.full_name) ||
    cleanText(userData.username) ||
    "الموظف";

  return {
    branchId: session.branchId,
    branchSlug: currentBranchSlug,
    employeeId: session.userId,
    employeeName,
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const auth = await authenticateFinanceRequest(request);

    if (auth instanceof NextResponse) {
      return auth;
    }

    const requestedBranchSlug = normalizeBranchSlug(
      request.nextUrl.searchParams.get("branchSlug")
    );

    if (
      requestedBranchSlug &&
      requestedBranchSlug !== auth.branchSlug
    ) {
      return createErrorResponse(
        "مسار الفرع لا يطابق جلسة الموظف",
        403,
        "BRANCH_MISMATCH"
      );
    }

    const nationalId = normalizeNationalId(
      request.nextUrl.searchParams.get("nationalId")
    );

    if (!/^\d{10}$/.test(nationalId)) {
      return createErrorResponse(
        "رقم الهوية يجب أن يتكون من 10 أرقام",
        400,
        "INVALID_NATIONAL_ID"
      );
    }

    const { data, error } = await supabaseAdmin
      .from("finance_customers")
      .select(
        "id, group_id, full_name, national_id, birth_hijri, phone, work_name, work, salary, bank, broker"
      )
      .eq("branch_id", auth.branchId)
      .eq("national_id", nationalId)
      .maybeSingle<CustomerLookupRow>();

    if (error) {
      console.error("Finance customer lookup failed:", error);

      return createErrorResponse(
        "تعذر البحث عن بيانات العميل",
        500,
        "CUSTOMER_LOOKUP_FAILED"
      );
    }

    if (!data) {
      return createJsonResponse(
        {
          ok: true,
          found: false,
          customer: null,
        },
        200
      );
    }

    return createJsonResponse(
      {
        ok: true,
        found: true,
        customer: {
          id: data.id,
          groupId: data.group_id,
          fullName: cleanText(data.full_name),
          nationalId: normalizeNationalId(data.national_id),
          birthHijri: normalizeHijriDate(data.birth_hijri),
          phone: normalizePhone(data.phone),
          workName:
            cleanText(data.work_name) || cleanText(data.work),
          salary:
            data.salary === null ? null : Number(data.salary),
          bank: cleanText(data.bank),
          broker: cleanText(data.broker),
        },
      },
      200
    );
  } catch (error) {
    console.error(
      "Finance customers GET unexpected error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء البحث عن العميل",
      500,
      "UNEXPECTED_ERROR"
    );
  }
}

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    if (!hasSafeRequestSource(request)) {
      return createErrorResponse(
        "تم رفض الطلب لأنه صادر من مصدر غير مسموح",
        403,
        "INVALID_REQUEST_SOURCE"
      );
    }

    if (!hasAcceptableBodySize(request)) {
      return createErrorResponse(
        "حجم بيانات الطلب أكبر من الحد المسموح",
        413,
        "REQUEST_TOO_LARGE"
      );
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().startsWith("application/json")) {
      return createErrorResponse(
        "صيغة بيانات الطلب غير مدعومة",
        415,
        "UNSUPPORTED_CONTENT_TYPE"
      );
    }

    const auth = await authenticateFinanceRequest(request);

    if (auth instanceof NextResponse) {
      return auth;
    }

    let parsedBody: unknown;

    try {
      parsedBody = await request.json();
    } catch (error) {
      console.error("Finance customer invalid JSON:", error);

      return createErrorResponse(
        "بيانات الطلب غير صالحة",
        400,
        "INVALID_JSON"
      );
    }

    if (!isPlainObject(parsedBody)) {
      return createErrorResponse(
        "بيانات الطلب غير صالحة",
        400,
        "INVALID_BODY"
      );
    }

    const body = parsedBody as CustomerRequestBody;

    const requestedBranchSlug = normalizeBranchSlug(body.branchSlug);

    if (
      requestedBranchSlug &&
      requestedBranchSlug !== auth.branchSlug
    ) {
      return createErrorResponse(
        "مسار الفرع لا يطابق جلسة الموظف",
        403,
        "BRANCH_MISMATCH"
      );
    }

    const fullName = cleanText(body.fullName).slice(0, 160);
    const nationalId = normalizeNationalId(body.nationalId);
    const birthHijri = normalizeHijriDate(body.birthHijri);
    const phone = normalizePhone(body.phone);
    const groupId = normalizeOptionalUuid(body.groupId);
    const workName = cleanText(body.workName).slice(0, 160);
    const salary = normalizeOptionalMoney(body.salary);
    const bank = cleanText(body.bank).slice(0, 160);
    const broker = cleanText(body.broker).slice(0, 160);

    if (fullName.length < 2) {
      return createErrorResponse(
        "اسم العميل يجب ألا يقل عن حرفين",
        400,
        "INVALID_CUSTOMER_NAME"
      );
    }

    if (!/^\d{10}$/.test(nationalId)) {
      return createErrorResponse(
        "رقم الهوية يجب أن يتكون من 10 أرقام",
        400,
        "INVALID_NATIONAL_ID"
      );
    }

    if (!/^05\d{8}$/.test(phone)) {
      return createErrorResponse(
        "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام",
        400,
        "INVALID_PHONE"
      );
    }

    if (!isValidHijriDateShape(birthHijri)) {
      return createErrorResponse(
        "تاريخ الميلاد الهجري غير صحيح",
        400,
        "INVALID_HIJRI_DATE"
      );
    }

    if (groupId === "") {
      return createErrorResponse(
        "معرف مجموعة العملاء غير صحيح",
        400,
        "INVALID_CUSTOMER_GROUP"
      );
    }

    if (
      salary !== null &&
      (!Number.isFinite(salary) || salary <= 0)
    ) {
      return createErrorResponse(
        "الراتب يجب أن يكون رقمًا أكبر من صفر",
        400,
        "INVALID_SALARY"
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "create_finance_customer_secure_atomic",
      {
        p_branch_id: auth.branchId,
        p_employee_id: auth.employeeId,
        p_employee_name: auth.employeeName,
        p_full_name: fullName,
        p_national_id: nationalId,
        p_birth_hijri: birthHijri,
        p_phone: phone,
        p_group_id: groupId,
        p_work_name: workName || null,
        p_salary: salary,
        p_bank: bank || null,
        p_broker: broker || null,
      }
    );

    if (error) {
      console.error("Finance customer secure RPC failed:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      return mapDatabaseError(error.message, error.code);
    }

    const result = getFirstRpcRow<CustomerRpcRow>(data);

    if (
      !result ||
      !UUID_PATTERN.test(cleanText(result.customer_id))
    ) {
      console.error("Finance customer secure RPC returned invalid data:", data);

      return createErrorResponse(
        "تمت معالجة الطلب لكن تعذر قراءة نتيجة الحفظ",
        500,
        "INVALID_RPC_RESULT"
      );
    }

    return createJsonResponse(
      {
        ok: true,
        customer: {
          id: result.customer_id,
          name: cleanText(result.customer_name) || fullName,
          wasCreated: result.was_created === true,
        },
        message:
          result.was_created === true
            ? "تم إنشاء العميل بنجاح"
            : "تم تحديث بيانات العميل بنجاح",
      },
      result.was_created === true ? 201 : 200
    );
  } catch (error) {
    console.error(
      "Finance customers POST unexpected error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء حفظ العميل",
      500,
      "UNEXPECTED_ERROR"
    );
  }
}
