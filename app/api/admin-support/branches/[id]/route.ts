import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateBranchBody = {
  branch_name?: unknown;
  branch_slug?: unknown;
  organization_name?: unknown;
  city?: unknown;
  commercial_record?: unknown;
  phone?: unknown;
  notes?: unknown;
  is_active?: unknown;
};

type DeleteBranchBody = {
  confirm_branch_name?: unknown;
};

type UpdateBranchResult = {
  branch_id: string;
  is_active: boolean;
};

type DeleteBranchResult = {
  deleted_branch_id: string;
  deleted_branch_name: string;
};

type MappedError = {
  message: string;
  status: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control":
      "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    Vary: "Cookie",
  };
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

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFKC").trim()
    : "";
}

function cleanNumericText(
  value: unknown,
  maxLength: number
): string {
  return normalizeDigits(cleanText(value))
    .replace(/\D/g, "")
    .slice(0, maxLength);
}

function normalizePhone(value: unknown): string {
  const normalized = normalizeDigits(cleanText(value));

  const hasLeadingPlus = normalized.startsWith("+");

  const digits = normalized
    .replace(/\D/g, "")
    .slice(0, hasLeadingPlus ? 19 : 20);

  return hasLeadingPlus ? `+${digits}` : digits;
}

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function createErrorResponse(
  message: string,
  status: number,
  clearCookie = false
): NextResponse {
  const response = NextResponse.json(
    {
      ok: false,
      message,
    },
    {
      status,
      headers: noStoreHeaders(),
    }
  );

  if (clearCookie) {
    response.cookies.set(
      ADMIN_SUPPORT_COOKIE_NAME,
      "",
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        priority: "high",
      }
    );
  }

  return response;
}

async function readJsonBody(
  request: Request
): Promise<Record<string, unknown> | null> {
  const contentType =
    request.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.startsWith("application/json")) {
    return null;
  }

  try {
    const parsed: unknown = await request.json();

    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getSupabaseErrorText(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}): string {
  return [
    error.code,
    error.message,
    error.details,
    error.hint,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.length > 0
    )
    .join(" ");
}

function mapUpdateBranchError(
  message: string
): MappedError {
  if (message.includes("BRANCH_ID_REQUIRED")) {
    return {
      message: "معرّف الفرع غير موجود",
      status: 400,
    };
  }

  if (message.includes("BRANCH_NOT_FOUND")) {
    return {
      message: "الفرع غير موجود",
      status: 404,
    };
  }

  if (message.includes("BRANCH_NAME_REQUIRED")) {
    return {
      message: "اكتب اسم الفرع بصورة صحيحة",
      status: 400,
    };
  }

  if (message.includes("BRANCH_SLUG_REQUIRED")) {
    return {
      message: "اكتب رابط الفرع",
      status: 400,
    };
  }

  if (message.includes("INVALID_BRANCH_SLUG")) {
    return {
      message:
        "رابط الفرع يجب أن يبدأ وينتهي بحرف إنجليزي صغير أو رقم، ويقبل في الوسط _ أو -",
      status: 400,
    };
  }

  if (message.includes("ORGANIZATION_NAME_REQUIRED")) {
    return {
      message: "اكتب اسم المنظمة بصورة صحيحة",
      status: 400,
    };
  }

  if (message.includes("CITY_TOO_LONG")) {
    return {
      message: "اسم المدينة طويل جدًا",
      status: 400,
    };
  }

  if (message.includes("COMMERCIAL_RECORD_TOO_LONG")) {
    return {
      message: "رقم السجل التجاري طويل جدًا",
      status: 400,
    };
  }

  if (message.includes("PHONE_TOO_LONG")) {
    return {
      message: "رقم الجوال طويل جدًا",
      status: 400,
    };
  }

  if (message.includes("NOTES_TOO_LONG")) {
    return {
      message: "الملاحظات طويلة جدًا",
      status: 400,
    };
  }

  if (message.includes("BRANCH_SLUG_ALREADY_EXISTS")) {
    return {
      message: "رابط الفرع مستخدم مسبقًا",
      status: 409,
    };
  }

  if (message.includes("BRANCH_NAME_ALREADY_EXISTS")) {
    return {
      message: "اسم الفرع موجود مسبقًا",
      status: 409,
    };
  }

  if (
    message.includes("duplicate key") ||
    message.includes("23505")
  ) {
    return {
      message: "يوجد فرع آخر يستخدم البيانات نفسها",
      status: 409,
    };
  }

  if (message.includes("23514")) {
    return {
      message: "إحدى القيم لا تتوافق مع إعدادات النظام",
      status: 400,
    };
  }

  if (message.includes("23503")) {
    return {
      message: "تعذر ربط بيانات الفرع بالسجلات المطلوبة",
      status: 400,
    };
  }

  return {
    message: "تعذر تحديث بيانات الفرع",
    status: 500,
  };
}

function extractCount(
  message: string,
  errorCode: string
): number | null {
  const match = message.match(
    new RegExp(`${errorCode}:(\\d+)`)
  );

  if (!match) {
    return null;
  }

  const count = Number(match[1]);

  return Number.isFinite(count) ? count : null;
}

function mapDeleteBranchError(
  message: string
): MappedError {
  if (message.includes("BRANCH_ID_REQUIRED")) {
    return {
      message: "معرّف الفرع غير موجود",
      status: 400,
    };
  }

  if (message.includes("BRANCH_NOT_FOUND")) {
    return {
      message: "الفرع غير موجود أو تم حذفه مسبقًا",
      status: 404,
    };
  }

  if (
    message.includes(
      "BRANCH_DELETE_CONFIRMATION_REQUIRED"
    )
  ) {
    return {
      message: "اكتب اسم الفرع لتأكيد الحذف النهائي",
      status: 400,
    };
  }

  if (
    message.includes(
      "BRANCH_DELETE_CONFIRMATION_MISMATCH"
    )
  ) {
    return {
      message:
        "اسم الفرع المكتوب لا يطابق اسم الفرع المراد حذفه",
      status: 400,
    };
  }

  const protectedTables: Array<{
    code: string;
    label: string;
  }> = [
    {
      code: "BRANCH_HAS_CUSTOMERS",
      label: "عملاء",
    },
    {
      code: "BRANCH_HAS_CONTRACTS",
      label: "عقود",
    },
    {
      code: "BRANCH_HAS_PAYMENTS",
      label: "دفعات",
    },
    {
      code: "BRANCH_HAS_PROMISSORY_NOTES",
      label: "سندات لأمر",
    },
    {
      code: "BRANCH_HAS_PROMISSORY_NOTE_LOGS",
      label: "سجلات تعديلات السندات",
    },
    {
      code: "BRANCH_HAS_INSTALLMENTS",
      label: "أقساط",
    },
    {
      code: "BRANCH_HAS_CUSTOMER_GROUPS",
      label: "مجموعات عملاء",
    },
    {
      code: "BRANCH_HAS_BLOCKLIST_RECORDS",
      label: "سجلات حظر عملاء",
    },
    {
      code: "BRANCH_HAS_EXPENSE_INVOICES",
      label: "فواتير مصروفات",
    },
    {
      code: "BRANCH_HAS_PRODUCTS",
      label: "منتجات",
    },
    {
      code: "BRANCH_HAS_INVENTORY",
      label: "مخزون",
    },
    {
      code: "BRANCH_HAS_INVENTORY_MOVEMENTS",
      label: "حركات مخزون",
    },
    {
      code: "BRANCH_HAS_NOTES",
      label: "ملاحظات",
    },
  ];

  for (const item of protectedTables) {
    if (message.includes(item.code)) {
      const count = extractCount(message, item.code);

      return {
        message:
          count !== null
            ? `لا يمكن حذف الفرع لوجود ${item.label} مرتبطة به وعددها ${count}`
            : `لا يمكن حذف الفرع لوجود ${item.label} مرتبطة به`,
        status: 409,
      };
    }
  }

  if (message.includes("BRANCH_DELETE_FAILED")) {
    return {
      message: "تعذر حذف الفرع",
      status: 500,
    };
  }

  if (
    message.includes("foreign key constraint") ||
    message.includes("23503")
  ) {
    return {
      message:
        "لا يمكن حذف الفرع لوجود بيانات مرتبطة به لم تُحذف بعد",
      status: 409,
    };
  }

  return {
    message: "تعذر حذف الفرع",
    status: 500,
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const auth = await verifyAdminSupportRequest(
      "manage_branches"
    );

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        auth.clearCookie === true
      );
    }

    const { id } = await context.params;
    const branchId = cleanText(id);

    if (!branchId || !isValidUuid(branchId)) {
      return createErrorResponse(
        "معرّف الفرع غير صحيح",
        400
      );
    }

    const rawBody = await readJsonBody(request);

    if (!rawBody) {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400
      );
    }

    const body = rawBody as UpdateBranchBody;

    const branchName = cleanText(body.branch_name);

    const branchSlug = cleanText(
      body.branch_slug
    ).toLowerCase();

    const organizationName = cleanText(
      body.organization_name
    );

    const city = cleanText(body.city);

    const commercialRecord = cleanNumericText(
      body.commercial_record,
      30
    );

    const phone = normalizePhone(body.phone);

    const notes = cleanText(body.notes);

    if (
      branchName.length < 2 ||
      branchName.length > 100
    ) {
      return createErrorResponse(
        "اسم الفرع يجب أن يكون من حرفين إلى 100 حرف",
        400
      );
    }

    if (
      !/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/.test(
        branchSlug
      )
    ) {
      return createErrorResponse(
        "رابط الفرع يجب أن يبدأ وينتهي بحرف إنجليزي صغير أو رقم، ويقبل في الوسط _ أو -",
        400
      );
    }

    if (
      organizationName.length < 2 ||
      organizationName.length > 150
    ) {
      return createErrorResponse(
        "اسم المنظمة يجب أن يكون من حرفين إلى 150 حرف",
        400
      );
    }

    if (city.length > 100) {
      return createErrorResponse(
        "اسم المدينة طويل جدًا",
        400
      );
    }

    if (commercialRecord.length > 30) {
      return createErrorResponse(
        "رقم السجل التجاري طويل جدًا",
        400
      );
    }

    if (phone.length > 20) {
      return createErrorResponse(
        "رقم الجوال طويل جدًا",
        400
      );
    }

    if (notes.length > 1000) {
      return createErrorResponse(
        "الملاحظات طويلة جدًا",
        400
      );
    }

    if (typeof body.is_active !== "boolean") {
      return createErrorResponse(
        "حالة الفرع غير صحيحة",
        400
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "update_admin_branch_atomic",
      {
        p_branch_id: branchId,
        p_branch_name: branchName,
        p_branch_slug: branchSlug,
        p_organization_name: organizationName,
        p_city: city || null,
        p_commercial_record:
          commercialRecord || null,
        p_phone: phone || null,
        p_notes: notes || null,
        p_is_active: body.is_active,
        p_actor_user_id: auth.user.id,
        p_actor_user_name: auth.user.fullName,
      }
    );

    if (error) {
      const errorText = getSupabaseErrorText(error);

      console.error(
        "update_admin_branch_atomic failed:",
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      );

      const mappedError =
        mapUpdateBranchError(errorText);

      return createErrorResponse(
        mappedError.message,
        mappedError.status
      );
    }

    const rawResult = Array.isArray(data)
      ? data[0]
      : data;

    const result =
      isPlainObject(rawResult)
        ? (rawResult as UpdateBranchResult)
        : null;

    if (
      !result ||
      !isValidUuid(result.branch_id) ||
      typeof result.is_active !== "boolean"
    ) {
      console.error(
        "update_admin_branch_atomic returned invalid data:",
        data
      );

      return createErrorResponse(
        "تم تنفيذ العملية لكن تعذر قراءة نتيجتها",
        500
      );
    }

    const statusMessage = result.is_active
      ? "تم تفعيل الفرع بنجاح"
      : "تم تعطيل الفرع بنجاح";

    return NextResponse.json(
      {
        ok: true,
        message: statusMessage,
        data: {
          branch_id: result.branch_id,
          is_active: result.is_active,
        },
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support branch update route error:",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء تحديث الفرع",
      500
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const auth = await verifyAdminSupportRequest(
      "manage_branches"
    );

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        auth.clearCookie === true
      );
    }

    const { id } = await context.params;
    const branchId = cleanText(id);

    if (!branchId || !isValidUuid(branchId)) {
      return createErrorResponse(
        "معرّف الفرع غير صحيح",
        400
      );
    }

    const rawBody = await readJsonBody(request);

    if (!rawBody) {
      return createErrorResponse(
        "بيانات طلب الحذف غير صحيحة",
        400
      );
    }

    const body = rawBody as DeleteBranchBody;

    const confirmBranchName = cleanText(
      body.confirm_branch_name
    );

    if (!confirmBranchName) {
      return createErrorResponse(
        "اكتب اسم الفرع لتأكيد الحذف النهائي",
        400
      );
    }

    if (confirmBranchName.length > 100) {
      return createErrorResponse(
        "اسم الفرع المكتوب طويل جدًا",
        400
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "delete_admin_test_branch_atomic",
      {
        p_branch_id: branchId,
        p_confirm_branch_name: confirmBranchName,
        p_actor_user_id: auth.user.id,
        p_actor_user_name: auth.user.fullName,
      }
    );

    if (error) {
      const errorText = getSupabaseErrorText(error);

      console.error(
        "delete_admin_test_branch_atomic failed:",
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      );

      const mappedError =
        mapDeleteBranchError(errorText);

      return createErrorResponse(
        mappedError.message,
        mappedError.status
      );
    }

    const rawResult = Array.isArray(data)
      ? data[0]
      : data;

    const result =
      isPlainObject(rawResult)
        ? (rawResult as DeleteBranchResult)
        : null;

    if (
      !result ||
      !isValidUuid(result.deleted_branch_id) ||
      !cleanText(result.deleted_branch_name)
    ) {
      console.error(
        "delete_admin_test_branch_atomic returned invalid data:",
        data
      );

      return createErrorResponse(
        "تم تنفيذ الحذف لكن تعذر قراءة نتيجته",
        500
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: `تم حذف فرع ${result.deleted_branch_name} نهائيًا`,
        data: {
          deleted_branch_id:
            result.deleted_branch_id,
          deleted_branch_name:
            result.deleted_branch_name,
        },
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support branch delete route error:",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء حذف الفرع",
      500
    );
  }
}
