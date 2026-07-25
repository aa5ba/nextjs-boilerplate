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
  full_name?: unknown;
  username?: unknown;
};

type UpdateBranchManagerResult = {
  manager_id: string;
  is_active: boolean;
};

type BranchManagerRow = {
  id: string;
  branch_id: string;
  full_name: string | null;
  username: string | null;
  role: string | null;
  is_active: boolean | null;
};

type BranchManagerProfileResult = {
  manager_id: string;
  full_name: string;
  username: string;
  is_active: boolean;
};

const MANAGER_USERNAME_PATTERN =
  /^[a-z0-9_]{3,30}$/;

const BRANCH_MANAGER_ROLES =
  new Set([
    "مدير فرع",
    "مدير رئيسي",
  ]);

function cleanText(value: unknown) {
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

function normalizeManagerUsername(value: unknown): string {
  return normalizeDigits(cleanText(value))
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
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
      action !== "reset_password" &&
      action !== "update_profile"
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

    if (action === "update_profile") {
      const fullName =
        cleanText(body.full_name);

      const username =
        normalizeManagerUsername(
          body.username
        );

      if (
        fullName.length < 2 ||
        fullName.length > 100
      ) {
        return createErrorResponse(
          "الاسم الكامل يجب أن يكون من حرفين إلى 100 حرف",
          400
        );
      }

      if (
        !MANAGER_USERNAME_PATTERN.test(
          username
        )
      ) {
        return createErrorResponse(
          "اسم المستخدم يجب أن يكون من 3 إلى 30 خانة، ويقبل الحروف الإنجليزية والأرقام و _ فقط",
          400
        );
      }

      const { data: manager, error: managerError } =
        await supabaseAdmin
          .from("finance_branch_users")
          .select(
            "id, branch_id, full_name, username, role, is_active, finance_branches!inner(is_deleted)"
          )
          .eq("id", managerId)
          .eq(
            "finance_branches.is_deleted",
            false
          )
          .maybeSingle<BranchManagerRow>();

      if (managerError) {
        console.error(
          "Branch manager profile lookup failed:",
          managerError
        );

        return createErrorResponse(
          "تعذر التحقق من مدير الفرع",
          500
        );
      }

      if (!manager) {
        return createErrorResponse(
          "مدير الفرع غير موجود",
          404
        );
      }

      if (
        !manager.role ||
        !BRANCH_MANAGER_ROLES.has(
          manager.role
        )
      ) {
        return createErrorResponse(
          "الحساب المحدد ليس مدير فرع",
          400
        );
      }

      const { data: duplicateUser, error: duplicateError } =
        await supabaseAdmin
          .from("finance_branch_users")
          .select("id")
          .eq("username", username)
          .neq("id", managerId)
          .maybeSingle<{ id: string }>();

      if (duplicateError) {
        console.error(
          "Branch manager username duplicate check failed:",
          duplicateError
        );

        return createErrorResponse(
          "تعذر التحقق من اسم المستخدم",
          500
        );
      }

      if (duplicateUser) {
        return createErrorResponse(
          "اسم المستخدم مستخدم مسبقًا",
          409
        );
      }

      const { data: updatedManager, error: updateError } =
        await supabaseAdmin
          .from("finance_branch_users")
          .update({
            full_name: fullName,
            username,
          })
          .eq("id", managerId)
          .eq(
            "branch_id",
            manager.branch_id
          )
          .select(
            "id, full_name, username, is_active"
          )
          .maybeSingle<{
            id: string;
            full_name: string | null;
            username: string | null;
            is_active: boolean | null;
          }>();

      if (updateError) {
        console.error(
          "Branch manager profile update failed:",
          updateError
        );

        if (
          updateError.code === "23505" ||
          updateError.message.includes(
            "finance_branch_users_username_key"
          )
        ) {
          return createErrorResponse(
            "اسم المستخدم مستخدم مسبقًا",
            409
          );
        }

        return createErrorResponse(
          "تعذر تعديل بيانات مدير الفرع",
          500
        );
      }

      if (!updatedManager) {
        return createErrorResponse(
          "مدير الفرع غير موجود",
          404
        );
      }

      const { error: logError } =
        await supabaseAdmin
          .from("admin_support_logs")
          .insert({
            user_id: auth.user.id,
            user_name:
              auth.user.fullName,
            action:
              "تعديل بيانات مدير فرع",
            target_type:
              "branch_manager",
            target_id:
              managerId,
            details:
              `${manager.full_name || "-"} - ${manager.username || "-"} -> ${fullName} - ${username}`,
          });

      if (logError) {
        console.error(
          "Branch manager profile update log insert failed:",
          logError
        );
      }

      const profileResult: BranchManagerProfileResult = {
        manager_id:
          updatedManager.id,
        full_name:
          updatedManager.full_name ||
          fullName,
        username:
          updatedManager.username ||
          username,
        is_active:
          updatedManager.is_active ===
          true,
      };

      return NextResponse.json(
        {
          ok: true,
          message:
            "تم تعديل بيانات مدير الفرع بنجاح",
          data: profileResult,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
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
