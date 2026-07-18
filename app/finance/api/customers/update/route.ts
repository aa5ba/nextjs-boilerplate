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
  customerId?: unknown;
  fullName?: unknown;
  nationalId?: unknown;
  birthHijri?: unknown;
  phone?: unknown;
  workName?: unknown;
  address?: unknown;
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

function normalizeDigits(
  value: string
): string {
  return value
    .replace(
      /[٠-٩]/g,
      (digit) =>
        String(
          "٠١٢٣٤٥٦٧٨٩".indexOf(
            digit
          )
        )
    )
    .replace(
      /[۰-۹]/g,
      (digit) =>
        String(
          "۰۱۲۳۴۵۶۷۸۹".indexOf(
            digit
          )
        )
    );
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
    message.includes("23505") ||
    message
      .toLowerCase()
      .includes("duplicate")
  ) {
    return {
      code: "CUSTOMER_DUPLICATE_NATIONAL_ID",
      message:
        "رقم الهوية مستخدم لعميل آخر داخل الفرع",
      status: 409,
    };
  }

  if (
    message.includes(
      "CUSTOMER_NOT_FOUND"
    )
  ) {
    return {
      code: "CUSTOMER_NOT_FOUND",
      message:
        "العميل غير موجود أو لا يتبع هذا الفرع",
      status: 404,
    };
  }

  return {
    code: "CUSTOMER_UPDATE_FAILED",
    message:
      "تعذر حفظ بيانات العميل",
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

    const customerId =
      cleanText(
        body.customerId
      );

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
          "customers_edit",
      });

    if (!session.userId) {
      return createErrorResponse(
        "انتهت جلسة تسجيل الدخول أو أنها غير صالحة",
        401,
        "INVALID_SESSION"
      );
    }

    if (
      !UUID_PATTERN.test(
        customerId
      )
    ) {
      return createErrorResponse(
        "معرف العميل غير صحيح",
        400,
        "INVALID_CUSTOMER_ID"
      );
    }

    const cleanFullName =
      cleanText(
        body.fullName
      );

    const cleanNationalId =
      normalizeDigits(
        cleanText(
          body.nationalId
        )
      )
        .replace(/\D/g, "")
        .trim();

    const cleanPhone =
      normalizeDigits(
        cleanText(body.phone)
      )
        .replace(/\D/g, "")
        .trim();

    const cleanBirthHijri =
      normalizeDigits(
        cleanText(
          body.birthHijri
        )
      ).trim();

    const cleanWorkName =
      cleanText(
        body.workName
      );

    const cleanAddress =
      cleanText(
        body.address
      );

    if (!cleanFullName) {
      return createErrorResponse(
        "يرجى إدخال اسم العميل",
        400,
        "CUSTOMER_NAME_REQUIRED"
      );
    }

    if (
      !/^\d{10}$/.test(
        cleanNationalId
      )
    ) {
      return createErrorResponse(
        "رقم الهوية يجب أن يكون 10 أرقام",
        400,
        "INVALID_NATIONAL_ID"
      );
    }

    if (
      !/^05\d{8}$/.test(
        cleanPhone
      )
    ) {
      return createErrorResponse(
        "رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05",
        400,
        "INVALID_PHONE"
      );
    }

    const {
      data: customer,
      error: customerError,
    } = await supabaseAdmin
      .from("finance_customers")
      .select("id,is_archived")
      .eq("id", customerId)
      .eq(
        "branch_id",
        session.branchId
      )
      .maybeSingle();

    if (customerError) {
      throw new Error(
        customerError.message
      );
    }

    if (!customer) {
      return createErrorResponse(
        "العميل غير موجود أو لا يتبع هذا الفرع",
        404,
        "CUSTOMER_NOT_FOUND"
      );
    }

    if (customer.is_archived === true) {
      return createErrorResponse(
        "العميل مؤرشف ولا يمكن تعديله من هذا المسار",
        409,
        "CUSTOMER_ARCHIVED"
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

    const { error } =
      await supabaseAdmin.rpc(
        "update_customer_atomic",
        {
          p_branch_id:
            session.branchId,
          p_customer_id:
            customerId,
          p_full_name:
            cleanFullName,
          p_national_id:
            cleanNationalId,
          p_birth_hijri:
            cleanBirthHijri ||
            null,
          p_phone: cleanPhone,
          p_work_name:
            cleanWorkName ||
            null,
          p_address:
            cleanAddress ||
            null,
          p_employee_name:
            employeeName,
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

    return createResponse({
      ok: true,
      message:
        "تم حفظ بيانات العميل بنجاح",
      customer_id: customerId,
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
      "Update customer error:",
      error
    );

    return createErrorResponse(
      "تعذر حفظ بيانات العميل",
      500,
      "CUSTOMER_UPDATE_FAILED"
    );
  }
}
