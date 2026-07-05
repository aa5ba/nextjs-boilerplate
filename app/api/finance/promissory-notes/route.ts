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

const NOTE_MODES = new Set(["independent", "contract"]);
const DUE_MODES = new Set(["on_demand", "fixed_date"]);
const BENEFICIARY_TYPES = new Set([
  "organization",
  "investor",
  "other",
]);
const BIRTH_DATE_TYPES = new Set(["hijri", "gregorian"]);

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

type PromissoryNoteRpcRow = {
  note_id: string;
  note_number: number | string;
  debtor_customer_id: string;
  beneficiary_customer_id: string | null;
  guarantor_customer_id: string | null;
  final_amount: number | string;
  final_due_date: string | null;
  final_due_mode: string;
};

type PartyInput = {
  fullName: string;
  nationalId: string;
  phone: string;
  birthDateType: string;
  birthHijri: string;
  birthGregorian: string;
  nationality: string;
  address: string;
  workName: string;
  identitySource: string;
  notes: string;
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

function text(value: unknown, maxLength = 5_000): string {
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
  return normalizeDigits(text(value, 100)).replace(/[^0-9]/g, "");
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

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function amountToArabicWords(value: number): string {
  const safeValue = Math.abs(value);
  const riyals = Math.floor(safeValue);
  const halalas = Math.round((safeValue - riyals) * 100);

  const riyalWords =
    riyals === 0 ? "صفر" : integerToArabicWords(riyals);

  let result = `${riyalWords} ريال سعودي`;

  if (halalas > 0) {
    result += ` و${integerToArabicWords(halalas)} هللة`;
  }

  return `${result} فقط لا غير`;
}

function integerToArabicWords(value: number): string {
  const integer = Math.floor(Math.abs(value));

  if (integer === 0) {
    return "صفر";
  }

  const groups = [
    {
      value: 1_000_000_000,
      singular: "مليار",
      dual: "ملياران",
      plural: "مليارات",
    },
    {
      value: 1_000_000,
      singular: "مليون",
      dual: "مليونان",
      plural: "ملايين",
    },
    {
      value: 1_000,
      singular: "ألف",
      dual: "ألفان",
      plural: "آلاف",
    },
  ];

  let remaining = integer;
  const parts: string[] = [];

  for (const group of groups) {
    const count = Math.floor(remaining / group.value);

    if (count > 0) {
      parts.push(
        renderArabicScale(
          count,
          group.singular,
          group.dual,
          group.plural
        )
      );

      remaining %= group.value;
    }
  }

  if (remaining > 0) {
    parts.push(numberBelowThousandToArabic(remaining));
  }

  return parts.filter(Boolean).join(" و");
}

function renderArabicScale(
  count: number,
  singular: string,
  dual: string,
  plural: string
): string {
  if (count === 1) {
    return singular;
  }

  if (count === 2) {
    return dual;
  }

  if (count >= 3 && count <= 10) {
    return `${numberBelowThousandToArabic(count)} ${plural}`;
  }

  return `${numberBelowThousandToArabic(count)} ${singular}`;
}

function numberBelowThousandToArabic(value: number): string {
  const number = Math.floor(value);

  if (number === 0) {
    return "";
  }

  const units = [
    "",
    "واحد",
    "اثنان",
    "ثلاثة",
    "أربعة",
    "خمسة",
    "ستة",
    "سبعة",
    "ثمانية",
    "تسعة",
  ];

  const teens: Record<number, string> = {
    10: "عشرة",
    11: "أحد عشر",
    12: "اثنا عشر",
    13: "ثلاثة عشر",
    14: "أربعة عشر",
    15: "خمسة عشر",
    16: "ستة عشر",
    17: "سبعة عشر",
    18: "ثمانية عشر",
    19: "تسعة عشر",
  };

  const tens = [
    "",
    "",
    "عشرون",
    "ثلاثون",
    "أربعون",
    "خمسون",
    "ستون",
    "سبعون",
    "ثمانون",
    "تسعون",
  ];

  const hundreds = [
    "",
    "مائة",
    "مائتان",
    "ثلاثمائة",
    "أربعمائة",
    "خمسمائة",
    "ستمائة",
    "سبعمائة",
    "ثمانمائة",
    "تسعمائة",
  ];

  const parts: string[] = [];
  const hundred = Math.floor(number / 100);
  const remainder = number % 100;

  if (hundred > 0) {
    parts.push(hundreds[hundred]);
  }

  if (remainder > 0) {
    if (remainder < 10) {
      parts.push(units[remainder]);
    } else if (remainder < 20) {
      parts.push(teens[remainder]);
    } else {
      const ten = Math.floor(remainder / 10);
      const unit = remainder % 10;

      if (unit > 0) {
        parts.push(`${units[unit]} و${tens[ten]}`);
      } else {
        parts.push(tens[ten]);
      }
    }
  }

  return parts.join(" و");
}

function versionNumber(value: unknown): number | null {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
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

function nullableDate(value: string): string | null {
  return value && validIsoDate(value) ? value : null;
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
      "Cache-Control": "no-store, no-cache, must-revalidate",
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
  const response = errorResponse(message, 401, "INVALID_SESSION");

  response.cookies.set(
    FINANCE_BRANCH_SESSION_COOKIE_NAME,
    "",
    financeBranchSessionDeleteCookieOptions
  );

  return response;
}

function parseParty(
  body: Record<string, unknown>,
  prefix: "debtor" | "beneficiary" | "guarantor"
): PartyInput {
  const key = (suffix: string) => `${prefix}${suffix}`;

  return {
    fullName: text(body[key("FullName")], 200),
    nationalId: identifier(body[key("NationalId")]),
    phone: identifier(body[key("Phone")]),
    birthDateType: text(body[key("BirthDateType")], 20),
    birthHijri: hijriDate(body[key("BirthHijri")]),
    birthGregorian: text(body[key("BirthGregorian")], 20),
    nationality: text(body[key("Nationality")], 100),
    address: text(body[key("Address")], 500),
    workName: text(body[key("WorkName")], 200),
    identitySource: text(body[key("IdentitySource")], 200),
    notes: text(body[key("Notes")], 5_000),
  };
}

function validateParty(
  party: PartyInput,
  label: string
): string | null {
  if (party.fullName.length < 2) {
    return `اسم ${label} مطلوب`;
  }

  if (!NATIONAL_ID_PATTERN.test(party.nationalId)) {
    return `رقم هوية ${label} يجب أن يكون 10 أرقام`;
  }

  if (!PHONE_PATTERN.test(party.phone)) {
    return `رقم جوال ${label} يجب أن يكون 10 أرقام ويبدأ بـ 05`;
  }

  if (!BIRTH_DATE_TYPES.has(party.birthDateType)) {
    return `نوع تاريخ ميلاد ${label} غير صحيح`;
  }

  if (
    party.birthDateType === "hijri" &&
    !HIJRI_DATE_PATTERN.test(party.birthHijri)
  ) {
    return `تاريخ ميلاد ${label} الهجري غير صحيح`;
  }

  if (
    party.birthDateType === "gregorian" &&
    !validIsoDate(party.birthGregorian)
  ) {
    return `تاريخ ميلاد ${label} الميلادي غير صحيح`;
  }

  return null;
}

function firstRpcRow(data: unknown): PromissoryNoteRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!isPlainObject(row)) {
    return null;
  }

  const noteId = text(row.note_id, 100);
  const debtorCustomerId = text(row.debtor_customer_id, 100);
  const beneficiaryCustomerId = text(
    row.beneficiary_customer_id,
    100
  );
  const guarantorCustomerId = text(row.guarantor_customer_id, 100);
  const finalDueDate = text(row.final_due_date, 20);
  const finalDueMode = text(row.final_due_mode, 30);

  if (
    !UUID_PATTERN.test(noteId) ||
    !UUID_PATTERN.test(debtorCustomerId) ||
    (beneficiaryCustomerId &&
      !UUID_PATTERN.test(beneficiaryCustomerId)) ||
    (guarantorCustomerId && !UUID_PATTERN.test(guarantorCustomerId)) ||
    !DUE_MODES.has(finalDueMode)
  ) {
    return null;
  }

  if (finalDueDate && !validIsoDate(finalDueDate)) {
    return null;
  }

  const noteNumber = row.note_number;
  const finalAmount = row.final_amount;

  if (
    (typeof noteNumber !== "number" &&
      typeof noteNumber !== "string") ||
    (typeof finalAmount !== "number" &&
      typeof finalAmount !== "string")
  ) {
    return null;
  }

  return {
    note_id: noteId,
    note_number: noteNumber,
    debtor_customer_id: debtorCustomerId,
    beneficiary_customer_id: beneficiaryCustomerId || null,
    guarantor_customer_id: guarantorCustomerId || null,
    final_amount: finalAmount,
    final_due_date: finalDueDate || null,
    final_due_mode: finalDueMode,
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
  const normalized = message.trim();

  if (
    normalized.includes("الموظف غير موجود") ||
    normalized.includes("الفرع غير موجود أو غير نشط")
  ) {
    return {
      message: "انتهت جلسة الموظف أو لم تعد صالحة",
      status: 401,
      code: "INVALID_SESSION",
    };
  }

  if (
    normalized.includes("ليس لديك صلاحية إنشاء سند") ||
    normalized.includes("ليس لديك صلاحية ربط السند") ||
    normalized.includes("ليس لديك صلاحية إضافة أو تعديل الكفيل")
  ) {
    return {
      message: normalized,
      status: 403,
      code: "PERMISSION_DENIED",
    };
  }

  if (
    normalized.includes("يوجد سند نشط مرتبط بهذا العقد بالفعل") ||
    databaseCode === "23505"
  ) {
    return {
      message: "يوجد سند نشط مرتبط بهذا العقد بالفعل",
      status: 409,
      code: "ACTIVE_NOTE_EXISTS",
    };
  }

  if (
    normalized.includes("العقد غير موجود في هذا الفرع أو مؤرشف")
  ) {
    return {
      message: normalized,
      status: 404,
      code: "CONTRACT_NOT_FOUND",
    };
  }

  const expectedValidationMessages = [
    "نوع السند غير صحيح",
    "يجب اختيار عقد للسند المرتبط",
    "مبلغ السداد في العقد يجب أن يكون أكبر من صفر",
    "تعذر تحديد تاريخ أول دفعة للعقد",
    "العقد غير مرتبط بملف عميل",
    "اسم العميل غير محفوظ في العقد أو ملف العميل",
    "رقم هوية العميل في العقد غير صحيح",
    "رقم جوال العميل في العقد غير صحيح",
    "نوع تاريخ ميلاد العميل في العقد غير صحيح",
    "تاريخ ميلاد العميل الهجري غير محفوظ في العقد أو ملف العميل",
    "تاريخ ميلاد العميل الميلادي غير محفوظ في ملف العميل",
    "نوع المستفيد المحفوظ في العقد غير صحيح",
    "اسم المستفيد غير محفوظ في العقد أو بيانات الفرع",
    "اسم الكفيل غير محفوظ في العقد أو ملف الكفيل",
    "رقم هوية الكفيل في العقد غير صحيح",
    "لا يمكن أن يكون العميل كفيلًا لنفسه",
    "رقم جوال الكفيل في العقد غير صحيح",
    "نوع تاريخ ميلاد الكفيل في العقد غير صحيح",
    "تاريخ ميلاد الكفيل الهجري غير محفوظ في العقد أو ملف الكفيل",
    "تاريخ ميلاد الكفيل الميلادي غير محفوظ في ملف الكفيل",
    "السند المستقل لا يجب أن يكون مرتبطًا بعقد",
    "مبلغ السند يجب أن يكون أكبر من صفر",
    "نوع استحقاق السند غير صحيح",
    "تاريخ استحقاق السند مطلوب",
    "اسم المدين مطلوب",
    "رقم هوية المدين يجب أن يكون 10 أرقام",
    "رقم جوال المدين يجب أن يكون 10 أرقام ويبدأ بـ 05",
    "نوع تاريخ ميلاد المدين غير صحيح",
    "تاريخ ميلاد المدين الهجري مطلوب",
    "تاريخ ميلاد المدين الميلادي مطلوب",
    "نوع المستفيد غير صحيح",
    "اسم المؤسسة غير محفوظ في بيانات الفرع",
    "يجب اختيار المستثمر المستفيد",
    "المستثمر غير موجود أو غير نشط في هذا الفرع",
    "اسم المستفيد مطلوب",
    "رقم هوية المستفيد يجب أن يكون 10 أرقام",
    "رقم جوال المستفيد يجب أن يكون 10 أرقام ويبدأ بـ 05",
    "نوع تاريخ ميلاد المستفيد غير صحيح",
    "تاريخ ميلاد المستفيد الهجري مطلوب",
    "تاريخ ميلاد المستفيد الميلادي مطلوب",
    "اسم الكفيل مطلوب",
    "رقم هوية الكفيل يجب أن يكون 10 أرقام",
    "رقم جوال الكفيل يجب أن يكون 10 أرقام ويبدأ بـ 05",
    "نوع تاريخ ميلاد الكفيل غير صحيح",
    "تاريخ ميلاد الكفيل الهجري مطلوب",
    "تاريخ ميلاد الكفيل الميلادي مطلوب",
  ];

  if (
    expectedValidationMessages.some((expected) =>
      normalized.includes(expected)
    )
  ) {
    return {
      message: normalized,
      status: 400,
      code: "INVALID_INPUT",
    };
  }

  return {
    message: "تعذر إنشاء السند حاليًا",
    status: 500,
    code: "CREATE_NOTE_FAILED",
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

    const contentType = request.headers.get("content-type") ?? "";

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

    const { data: userData, error: userError } = await supabaseAdmin
      .from("finance_branch_users")
      .select(
        "id, branch_id, full_name, username, is_active, session_version, self_disabled, disabled_at"
      )
      .eq("id", session.userId)
      .eq("branch_id", session.branchId)
      .maybeSingle();

    if (userError) {
      console.error("Promissory note user check failed:", userError);

      return errorResponse(
        "تعذر التحقق من جلسة الموظف",
        500,
        "SESSION_CHECK_FAILED"
      );
    }

    const user = userData as BranchUserRow | null;
    const databaseSessionVersion = versionNumber(user?.session_version);

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

    const { data: branchData, error: branchError } = await supabaseAdmin
      .from("finance_branches")
      .select("id, branch_slug, is_active, is_deleted")
      .eq("id", session.branchId)
      .maybeSingle();

    if (branchError) {
      console.error("Promissory note branch check failed:", branchError);

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
      return sessionError("الفرع غير نشط أو تغيرت بيانات الجلسة");
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

    const noteMode = text(parsedBody.noteMode, 30);
    const contractId = text(parsedBody.contractId, 100);
    const amount = positiveNumber(parsedBody.amount);
    const city = text(parsedBody.city, 100);
    const issueDate = text(parsedBody.issueDate, 20);
    const notes = text(parsedBody.notes, 5_000);
    const dueMode = text(parsedBody.dueMode, 30);
    const dueDate = text(parsedBody.dueDate, 20);
    const beneficiaryType = text(parsedBody.beneficiaryType, 30);
    const beneficiaryInvestorId = text(
      parsedBody.beneficiaryInvestorId,
      100
    );
    const hasGuarantor = booleanValue(parsedBody.hasGuarantor);

    if (!NOTE_MODES.has(noteMode)) {
      return errorResponse(
        "نوع السند غير صحيح",
        400,
        "INVALID_NOTE_MODE"
      );
    }

    if (!validIsoDate(issueDate)) {
      return errorResponse(
        "تاريخ تحرير السند غير صحيح",
        400,
        "INVALID_ISSUE_DATE"
      );
    }

    const {
      data: hasCreatePermission,
      error: createPermissionError,
    } = await supabaseAdmin.rpc("finance_user_has_permission", {
      p_branch_id: session.branchId,
      p_user_id: session.userId,
      p_permission_key: "promissory_note_create",
    });

    if (createPermissionError) {
      console.error(
        "Promissory note create permission check failed:",
        createPermissionError
      );

      return errorResponse(
        "تعذر التحقق من صلاحية إنشاء السند",
        500,
        "PERMISSION_CHECK_FAILED"
      );
    }

    if (hasCreatePermission !== true) {
      return errorResponse(
        "ليس لديك صلاحية إنشاء سند لأمر",
        403,
        "PERMISSION_DENIED"
      );
    }

    const debtor = parseParty(parsedBody, "debtor");
    const beneficiary = parseParty(parsedBody, "beneficiary");
    const guarantor = parseParty(parsedBody, "guarantor");

    if (noteMode === "contract") {
      if (!UUID_PATTERN.test(contractId)) {
        return errorResponse(
          "يجب اختيار عقد صحيح للسند المرتبط",
          400,
          "INVALID_CONTRACT"
        );
      }

      const {
        data: hasLinkPermission,
        error: linkPermissionError,
      } = await supabaseAdmin.rpc("finance_user_has_permission", {
        p_branch_id: session.branchId,
        p_user_id: session.userId,
        p_permission_key: "promissory_note_link_contract",
      });

      if (linkPermissionError) {
        console.error(
          "Promissory note link permission check failed:",
          linkPermissionError
        );

        return errorResponse(
          "تعذر التحقق من صلاحية ربط السند بالعقد",
          500,
          "PERMISSION_CHECK_FAILED"
        );
      }

      if (hasLinkPermission !== true) {
        return errorResponse(
          "ليس لديك صلاحية ربط السند بعقد",
          403,
          "PERMISSION_DENIED"
        );
      }
    } else {
      if (contractId) {
        return errorResponse(
          "السند المستقل لا يجب أن يكون مرتبطًا بعقد",
          400,
          "INVALID_CONTRACT"
        );
      }

      if (amount === null) {
        return errorResponse(
          "أدخل مبلغ سند صحيحًا",
          400,
          "INVALID_AMOUNT"
        );
      }

      if (!DUE_MODES.has(dueMode)) {
        return errorResponse(
          "نوع استحقاق السند غير صحيح",
          400,
          "INVALID_DUE_MODE"
        );
      }

      if (dueMode === "fixed_date" && !validIsoDate(dueDate)) {
        return errorResponse(
          "تاريخ استحقاق السند غير صحيح",
          400,
          "INVALID_DUE_DATE"
        );
      }

      if (!BENEFICIARY_TYPES.has(beneficiaryType)) {
        return errorResponse(
          "نوع المستفيد غير صحيح",
          400,
          "INVALID_BENEFICIARY_TYPE"
        );
      }

      const debtorError = validateParty(debtor, "المدين");

      if (debtorError) {
        return errorResponse(
          debtorError,
          400,
          "INVALID_DEBTOR"
        );
      }

      if (
        beneficiaryType === "investor" &&
        !UUID_PATTERN.test(beneficiaryInvestorId)
      ) {
        return errorResponse(
          "يجب اختيار المستثمر المستفيد",
          400,
          "INVALID_BENEFICIARY_INVESTOR"
        );
      }

      if (beneficiaryType === "other") {
        const beneficiaryError = validateParty(
          beneficiary,
          "المستفيد"
        );

        if (beneficiaryError) {
          return errorResponse(
            beneficiaryError,
            400,
            "INVALID_BENEFICIARY"
          );
        }
      }

      if (hasGuarantor) {
        const {
          data: hasGuarantorPermission,
          error: guarantorPermissionError,
        } = await supabaseAdmin.rpc("finance_user_has_permission", {
          p_branch_id: session.branchId,
          p_user_id: session.userId,
          p_permission_key: "promissory_note_manage_guarantor",
        });

        if (guarantorPermissionError) {
          console.error(
            "Promissory note guarantor permission check failed:",
            guarantorPermissionError
          );

          return errorResponse(
            "تعذر التحقق من صلاحية إدارة الكفيل",
            500,
            "PERMISSION_CHECK_FAILED"
          );
        }

        if (hasGuarantorPermission !== true) {
          return errorResponse(
            "ليس لديك صلاحية إضافة أو تعديل الكفيل",
            403,
            "PERMISSION_DENIED"
          );
        }

        const guarantorError = validateParty(guarantor, "الكفيل");

        if (guarantorError) {
          return errorResponse(
            guarantorError,
            400,
            "INVALID_GUARANTOR"
          );
        }

        if (guarantor.nationalId === debtor.nationalId) {
          return errorResponse(
            "لا يمكن أن يكون المدين كفيلًا لنفسه",
            400,
            "GUARANTOR_SAME_AS_DEBTOR"
          );
        }
      }
    }

    const employeeName =
      text(user.full_name, 200) ||
      text(user.username, 100) ||
      "الموظف";

    const isContractMode = noteMode === "contract";
    const isOtherBeneficiary =
      !isContractMode && beneficiaryType === "other";
    const hasIndependentGuarantor = !isContractMode && hasGuarantor;

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      "create_promissory_note_secure_atomic",
      {
        p_branch_id: session.branchId,
        p_employee_id: session.userId,
        p_employee_name: employeeName,

        p_note_mode: noteMode,
        p_contract_id: isContractMode ? contractId : null,

        p_amount: isContractMode ? null : amount,
        p_amount_words:
          !isContractMode && amount !== null
            ? amountToArabicWords(amount)
            : null,
        p_city: city || null,
        p_note_issue_date: issueDate,
        p_notes: notes || null,

        p_due_mode: isContractMode ? null : dueMode,
        p_due_date:
          !isContractMode && dueMode === "fixed_date"
            ? nullableDate(dueDate)
            : null,

        p_beneficiary_type: isContractMode ? null : beneficiaryType,
        p_beneficiary_investor_id:
          !isContractMode && beneficiaryType === "investor"
            ? beneficiaryInvestorId
            : null,
        p_beneficiary_full_name: isOtherBeneficiary
          ? beneficiary.fullName
          : null,
        p_beneficiary_national_id: isOtherBeneficiary
          ? beneficiary.nationalId
          : null,
        p_beneficiary_phone: isOtherBeneficiary
          ? beneficiary.phone
          : null,
        p_beneficiary_birth_date_type: isOtherBeneficiary
          ? beneficiary.birthDateType
          : null,
        p_beneficiary_birth_hijri:
          isOtherBeneficiary && beneficiary.birthDateType === "hijri"
            ? beneficiary.birthHijri
            : null,
        p_beneficiary_birth_gregorian:
          isOtherBeneficiary && beneficiary.birthDateType === "gregorian"
            ? nullableDate(beneficiary.birthGregorian)
            : null,
        p_beneficiary_nationality: isOtherBeneficiary
          ? beneficiary.nationality || null
          : null,
        p_beneficiary_address: isOtherBeneficiary
          ? beneficiary.address || null
          : null,
        p_beneficiary_work_name: isOtherBeneficiary
          ? beneficiary.workName || null
          : null,
        p_beneficiary_identity_source: isOtherBeneficiary
          ? beneficiary.identitySource || null
          : null,
        p_beneficiary_notes: isOtherBeneficiary
          ? beneficiary.notes || null
          : null,

        p_debtor_full_name: isContractMode ? null : debtor.fullName,
        p_debtor_national_id: isContractMode
          ? null
          : debtor.nationalId,
        p_debtor_phone: isContractMode ? null : debtor.phone,
        p_debtor_birth_date_type: isContractMode
          ? null
          : debtor.birthDateType,
        p_debtor_birth_hijri:
          !isContractMode && debtor.birthDateType === "hijri"
            ? debtor.birthHijri
            : null,
        p_debtor_birth_gregorian:
          !isContractMode && debtor.birthDateType === "gregorian"
            ? nullableDate(debtor.birthGregorian)
            : null,
        p_debtor_nationality: isContractMode
          ? null
          : debtor.nationality || null,
        p_debtor_address: isContractMode
          ? null
          : debtor.address || null,
        p_debtor_work_name: isContractMode
          ? null
          : debtor.workName || null,
        p_debtor_identity_source: isContractMode
          ? null
          : debtor.identitySource || null,
        p_debtor_notes: isContractMode
          ? null
          : debtor.notes || null,

        p_has_guarantor: hasIndependentGuarantor,
        p_guarantor_full_name: hasIndependentGuarantor
          ? guarantor.fullName
          : null,
        p_guarantor_national_id: hasIndependentGuarantor
          ? guarantor.nationalId
          : null,
        p_guarantor_phone: hasIndependentGuarantor
          ? guarantor.phone
          : null,
        p_guarantor_birth_date_type: hasIndependentGuarantor
          ? guarantor.birthDateType
          : null,
        p_guarantor_birth_hijri:
          hasIndependentGuarantor &&
          guarantor.birthDateType === "hijri"
            ? guarantor.birthHijri
            : null,
        p_guarantor_birth_gregorian:
          hasIndependentGuarantor &&
          guarantor.birthDateType === "gregorian"
            ? nullableDate(guarantor.birthGregorian)
            : null,
        p_guarantor_nationality: hasIndependentGuarantor
          ? guarantor.nationality || null
          : null,
        p_guarantor_address: hasIndependentGuarantor
          ? guarantor.address || null
          : null,
        p_guarantor_work_name: hasIndependentGuarantor
          ? guarantor.workName || null
          : null,
        p_guarantor_identity_source: hasIndependentGuarantor
          ? guarantor.identitySource || null
          : null,
        p_guarantor_notes: hasIndependentGuarantor
          ? guarantor.notes || null
          : null,
      }
    );

    if (rpcError) {
      console.error("Create promissory note RPC failed:", {
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details,
        hint: rpcError.hint,
        branchId: session.branchId,
        employeeId: session.userId,
        noteMode,
        contractId: isContractMode ? contractId : null,
      });

      const mapped = mappedRpcError(rpcError.message, rpcError.code);

      if (mapped.code === "INVALID_SESSION") {
        return sessionError(mapped.message);
      }

      return errorResponse(mapped.message, mapped.status, mapped.code);
    }

    const result = firstRpcRow(rpcData);

    if (!result) {
      console.error(
        "Create promissory note RPC returned invalid data:",
        rpcData
      );

      return errorResponse(
        "تم تنفيذ العملية لكن تعذر قراءة نتيجة السند بأمان",
        500,
        "INVALID_RPC_RESULT"
      );
    }

    return jsonResponse(
      {
        ok: true,
        noteId: result.note_id,
        noteNumber: result.note_number,
        debtorCustomerId: result.debtor_customer_id,
        beneficiaryCustomerId: result.beneficiary_customer_id,
        guarantorCustomerId: result.guarantor_customer_id,
        amount: result.final_amount,
        dueDate: result.final_due_date,
        dueMode: result.final_due_mode,
      },
      201
    );
  } catch (error) {
    console.error("Promissory note route unexpected error:", error);

    return errorResponse(
      "حدث خطأ غير متوقع أثناء إنشاء السند",
      500,
      "UNEXPECTED_ERROR"
    );
  }
}
