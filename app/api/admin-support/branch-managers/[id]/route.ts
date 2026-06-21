import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateBranchManagerBody = {
  action?: unknown;
  is_active?: unknown;
  new_password?: unknown;
};

type UpdateBranchManagerResult = {
  manager_id: string;
  is_active: boolean;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function createErrorResponse(
  message: string,
  status: number,
  clearCookie = false
) {
  const response = NextResponse.json(
    {
      ok: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  if (clearCookie) {
    response.cookies.set(ADMIN_SUPPORT_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}

function mapManagerError(message: string) {
  if (message.includes("MANAGER_ID_REQUIRED")) {
    return {
      message: "معرّف مدير الفرع غير موجود",
      status: 400,
    };
  }

  if (message.includes("MANAGER_NOT_FOUND")) {
    return {
      message: "مدير الفرع غير موجود",
      status: 404,
    };
  }

  if (message.includes("USER_IS_NOT_BRANCH_MANAGER")) {
    return {
      message: "الحساب المحدد ليس مدير فرع",
      status: 400,
    };
  }

  if (message.includes("ACTIVE_STATUS_REQUIRED")) {
    return {
      message: "حالة مدير الفرع غير صحيحة",
      status: 400,
    };
  }

  if (message.includes("PASSWORD_MUST_BE_4_DIGITS")) {
    return {
      message: "كلمة المرور يجب أن تكون 4 أرقام فقط",
      status: 400,
    };
  }

  if (message.includes("INVALID_MANAGER_ACTION")) {
    return {
      message: "نوع العملية غير صحيح",
      status: 400,
    };
  }

  return {
    message: "تعذر تحديث مدير الفرع",
    status: 500,
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
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
    const managerId = cleanText(id);

    if (!managerId || !isValidUuid(managerId)) {
      return createErrorResponse(
        "معرّف مدير الفرع غير صحيح",
        400
      );
    }

    let body: UpdateBranchManagerBody;

    try {
      body = (await request.json()) as UpdateBranchManagerBody;
    } catch {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400
      );
    }

    const action = cleanText(body.action).toLowerCase();

    if (
      action !== "set_active" &&
      action !== "reset_password"
    ) {
      return createErrorResponse(
        "نوع العملية غير صحيح",
        400
      );
    }

    let isActive: boolean | null = null;
    let newPassword: string | null = null;

    if (action === "set_active") {
      if (typeof body.is_active !== "boolean") {
        return createErrorResponse(
          "حالة مدير الفرع غير صحيحة",
          400
        );
      }

      isActive = body.is_active;
    }

    if (action === "reset_password") {
      const cleanPassword = cleanText(body.new_password);

      if (!/^\d{4}$/.test(cleanPassword)) {
        return createErrorResponse(
          "كلمة المرور يجب أن تكون 4 أرقام فقط",
          400
        );
      }

      newPassword = cleanPassword;
    }

    const { data, error } = await supabaseAdmin.rpc(
      "update_admin_branch_manager_atomic",
      {
        p_manager_id: managerId,
        p_action: action,
        p_is_active: isActive,
        p_new_password: newPassword,
        p_actor_user_id: auth.user.id,
        p_actor_user_name: auth.user.fullName,
      }
    );

    if (error) {
      console.error(
        "update_admin_branch_manager_atomic failed:",
        error
      );

      const mappedError = mapManagerError(
        `${error.code || ""} ${error.message || ""}`
      );

      return createErrorResponse(
        mappedError.message,
        mappedError.status
      );
    }

    const rawResult = Array.isArray(data)
      ? data[0]
      : data;

    const result =
      rawResult && typeof rawResult === "object"
        ? (rawResult as UpdateBranchManagerResult)
        : null;

    if (
      !result?.manager_id ||
      typeof result.is_active !== "boolean"
    ) {
      console.error(
        "update_admin_branch_manager_atomic returned invalid data:",
        data
      );

      return createErrorResponse(
        "تم تنفيذ العملية لكن تعذر قراءة نتيجتها",
        500
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          action === "reset_password"
            ? "تم تحديث كلمة المرور بنجاح"
            : result.is_active
              ? "تم تفعيل مدير الفرع بنجاح"
              : "تم تعطيل مدير الفرع بنجاح",
        data: {
          manager_id: result.manager_id,
          is_active: result.is_active,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Admin support branch manager route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء تحديث مدير الفرع",
      500
    );
  }
}
