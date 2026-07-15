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

function getArchiveError(
  message: string
) {
  if (
    message.includes(
      "CUSTOMER_ALREADY_ARCHIVED"
    )
  ) {
    return {
      code: "CUSTOMER_ALREADY_ARCHIVED",
      message:
        "العميل مؤرشف مسبقًا",
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

  if (
    message.includes(
      "BRANCH_REQUIRED"
    )
  ) {
    return {
      code: "BRANCH_REQUIRED",
      message: "تعذر تحديد الفرع",
      status: 400,
    };
  }

  if (
    message.includes(
      "CUSTOMER_REQUIRED"
    )
  ) {
    return {
      code: "CUSTOMER_REQUIRED",
      message: "تعذر تحديد العميل",
      status: 400,
    };
  }

  if (
    message.includes(
      "CUSTOMER_ARCHIVE_FAILED"
    ) ||
    message.includes(
      "CUSTOMER_DELETE_FAILED"
    )
  ) {
    return {
      code: "CUSTOMER_ARCHIVE_FAILED",
      message:
        "تعذر حذف العميل والعقود والسندات المرتبطة",
      status: 500,
    };
  }

  return {
    code: "CUSTOMER_ARCHIVE_FAILED",
    message:
      "حدث خطأ أثناء حذف العميل",
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
        "العميل مؤرشف مسبقًا",
        409,
        "CUSTOMER_ALREADY_ARCHIVED"
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
        "delete_customer_atomic",
        {
          p_branch_id:
            session.branchId,
          p_customer_id:
            customerId,
          p_employee_name:
            employeeName,
        }
      );

    if (error) {
      const mapped =
        getArchiveError(
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
        "تم حذف العميل والعقود والسندات المرتبطة بنجاح",
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
      "Archive customer error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء حذف العميل",
      500,
      "CUSTOMER_ARCHIVE_FAILED"
    );
  }
}
