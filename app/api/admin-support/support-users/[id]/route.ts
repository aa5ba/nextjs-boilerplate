import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PERMISSIONS = [
  "manage_branches",
  "manage_support_users",
  "system_settings",
  "impersonate_branch",
  "view_logs",
  "backup_restore",
  "manage_verification_results",
  "manage_ehtisab_settings",
] as const;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateSupportUserBody = {
  action?: unknown;
  is_active?: unknown;
  permissions?: unknown;
};

type UpdateSupportUserStatusResult = {
  user_id: string;
  is_active: boolean;
};

type UpdateSupportUserPermissionsResult = {
  user_id: string;
  permissions: string[];
  new_session_version: number;
};

type TargetSupportUser = {
  id: string;
  full_name: string | null;
  username: string;
  role: string;
  is_active: boolean;
  session_version: number;
};

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
  };
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
      headers: noStoreHeaders(),
    }
  );

  if (clearCookie) {
    response.cookies.set(
      ADMIN_SUPPORT_COOKIE_NAME,
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
        priority: "high",
      }
    );
  }

  return response;
}

function normalizePermissions(
  value: unknown
): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const cleanedPermissions = value.map(
    (permission) =>
      typeof permission === "string"
        ? permission.trim()
        : ""
  );

  if (
    cleanedPermissions.some(
      (permission) =>
        !permission ||
        !(
          ALLOWED_PERMISSIONS as readonly string[]
        ).includes(permission)
    )
  ) {
    return null;
  }

  return Array.from(
    new Set(cleanedPermissions)
  );
}

function mapSupportUserStatusError(
  rawMessage: string
) {
  if (
    rawMessage.includes(
      "TARGET_USER_ID_REQUIRED"
    )
  ) {
    return {
      message:
        "معرّف مستخدم الدعم غير موجود",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "ACTIVE_STATUS_REQUIRED"
    )
  ) {
    return {
      message:
        "حالة مستخدم الدعم غير صحيحة",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "SUPPORT_USER_NOT_FOUND"
    )
  ) {
    return {
      message: "مستخدم الدعم غير موجود",
      status: 404,
    };
  }

  if (
    rawMessage.includes(
      "CANNOT_DISABLE_SELF"
    )
  ) {
    return {
      message:
        "لا يمكنك تعطيل حسابك الحالي",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "CANNOT_DISABLE_LAST_SUPER_ADMIN"
    )
  ) {
    return {
      message:
        "لا يمكن تعطيل آخر مدير نظام نشط",
      status: 400,
    };
  }

  return {
    message:
      "تعذر تحديث حالة مستخدم الدعم",
    status: 500,
  };
}

function mapPermissionsError(
  rawMessage: string
) {
  if (
    rawMessage.includes(
      "TARGET_USER_ID_REQUIRED"
    )
  ) {
    return {
      message:
        "معرّف مستخدم الدعم غير موجود",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "ACTOR_USER_ID_REQUIRED"
    )
  ) {
    return {
      message:
        "تعذر تحديد منفذ العملية",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "INVALID_PERMISSION"
    )
  ) {
    return {
      message:
        "توجد صلاحية غير معتمدة",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "SUPPORT_USER_NOT_FOUND"
    )
  ) {
    return {
      message: "مستخدم الدعم غير موجود",
      status: 404,
    };
  }

  return {
    message:
      "تعذر تحديث صلاحيات مستخدم الدعم",
    status: 500,
  };
}

async function getTargetSupportUser(
  targetUserId: string
): Promise<
  | {
      ok: true;
      user: TargetSupportUser;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const { data, error } =
    await supabaseAdmin
      .from("admin_support_users")
      .select(
        `
        id,
        full_name,
        username,
        role,
        is_active,
        session_version
      `
      )
      .eq("id", targetUserId)
      .maybeSingle();

  if (error) {
    console.error(
      "Admin support target user lookup failed:",
      error
    );

    return {
      ok: false,
      response: createErrorResponse(
        "تعذر التحقق من مستخدم الدعم المستهدف",
        500
      ),
    };
  }

  const user =
    data as TargetSupportUser | null;

  if (!user) {
    return {
      ok: false,
      response: createErrorResponse(
        "مستخدم الدعم غير موجود",
        404
      ),
    };
  }

  return {
    ok: true,
    user,
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth =
      await verifyAdminSupportRequest(
        "manage_support_users"
      );

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        auth.clearCookie === true
      );
    }

    const { id } =
      await context.params;

    const targetUserId =
      cleanText(id);

    if (
      !targetUserId ||
      !isValidUuid(targetUserId)
    ) {
      return createErrorResponse(
        "معرّف مستخدم الدعم غير صحيح",
        400
      );
    }

    let body: UpdateSupportUserBody;

    try {
      body =
        (await request.json()) as UpdateSupportUserBody;
    } catch {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400
      );
    }

    const action =
      cleanText(body.action);

    /*
     * دعم الطلبات القديمة التي ترسل
     * is_active فقط دون action.
     */
    const resolvedAction =
      action ||
      (typeof body.is_active === "boolean"
        ? "set_active"
        : "");

    if (
      resolvedAction !== "set_active" &&
      resolvedAction !==
        "update_permissions"
    ) {
      return createErrorResponse(
        "نوع العملية غير صحيح",
        400
      );
    }

    const targetResult =
      await getTargetSupportUser(
        targetUserId
      );

    if (!targetResult.ok) {
      return targetResult.response;
    }

    const targetUser =
      targetResult.user;

    if (
      targetUser.role ===
        "super_admin" &&
      auth.user.role !==
        "super_admin"
    ) {
      return createErrorResponse(
        "لا يمكن تعديل مدير النظام إلا بواسطة مدير نظام آخر",
        403
      );
    }

    if (
      resolvedAction ===
      "set_active"
    ) {
      if (
        typeof body.is_active !==
        "boolean"
      ) {
        return createErrorResponse(
          "حالة مستخدم الدعم غير صحيحة",
          400
        );
      }

      if (
        targetUser.id ===
          auth.user.id &&
        body.is_active === false
      ) {
        return createErrorResponse(
          "لا يمكنك تعطيل حسابك الحالي",
          400
        );
      }

      if (
        targetUser.is_active ===
        body.is_active
      ) {
        return NextResponse.json(
          {
            ok: true,
            message:
              targetUser.is_active
                ? "مستخدم الدعم مفعّل بالفعل"
                : "مستخدم الدعم معطّل بالفعل",
            data: {
              user_id:
                targetUser.id,
              is_active:
                targetUser.is_active,
            },
          },
          {
            status: 200,
            headers:
              noStoreHeaders(),
          }
        );
      }

      const { data, error } =
        await supabaseAdmin.rpc(
          "update_admin_support_user_status_atomic",
          {
            p_target_user_id:
              targetUserId,
            p_is_active:
              body.is_active,
            p_actor_user_id:
              auth.user.id,
            p_actor_user_name:
              auth.user.fullName,
          }
        );

      if (error) {
        console.error(
          "update_admin_support_user_status_atomic failed:",
          error
        );

        const mappedError =
          mapSupportUserStatusError(
            `${error.code || ""} ${
              error.message || ""
            }`
          );

        return createErrorResponse(
          mappedError.message,
          mappedError.status
        );
      }

      const rawResult =
        Array.isArray(data)
          ? data[0]
          : data;

      const result =
        rawResult &&
        typeof rawResult === "object"
          ? (rawResult as UpdateSupportUserStatusResult)
          : null;

      if (
        !result?.user_id ||
        typeof result.is_active !==
          "boolean"
      ) {
        console.error(
          "update_admin_support_user_status_atomic returned invalid data:",
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
            result.is_active
              ? "تم تفعيل مستخدم الدعم بنجاح"
              : "تم تعطيل مستخدم الدعم بنجاح",
          data: {
            user_id:
              result.user_id,
            is_active:
              result.is_active,
          },
        },
        {
          status: 200,
          headers:
            noStoreHeaders(),
        }
      );
    }

    /*
     * مدير النظام يملك جميع الصلاحيات
     * تلقائيًا، فلا معنى لتعديل قائمته.
     */
    if (
      targetUser.role ===
      "super_admin"
    ) {
      return createErrorResponse(
        "مدير النظام يملك جميع الصلاحيات تلقائيًا",
        400
      );
    }

    /*
     * منع تعديل المستخدم لصلاحيات حسابه
     * حتى لا يغلق الباب على نفسه.
     */
    if (
      targetUser.id ===
      auth.user.id
    ) {
      return createErrorResponse(
        "لا يمكنك تعديل صلاحيات حسابك الحالي",
        400
      );
    }

    const permissions =
      normalizePermissions(
        body.permissions
      );

    if (!permissions) {
      return createErrorResponse(
        "قائمة الصلاحيات غير صحيحة",
        400
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "update_admin_support_user_permissions_atomic",
        {
          p_target_user_id:
            targetUserId,
          p_permissions:
            permissions,
          p_actor_user_id:
            auth.user.id,
          p_actor_user_name:
            auth.user.fullName,
        }
      );

    if (error) {
      console.error(
        "update_admin_support_user_permissions_atomic failed:",
        error
      );

      const mappedError =
        mapPermissionsError(
          `${error.code || ""} ${
            error.message || ""
          }`
        );

      return createErrorResponse(
        mappedError.message,
        mappedError.status
      );
    }

    const rawResult =
      Array.isArray(data)
        ? data[0]
        : data;

    const result =
      rawResult &&
      typeof rawResult === "object"
        ? (rawResult as UpdateSupportUserPermissionsResult)
        : null;

    if (
      !result?.user_id ||
      !Array.isArray(
        result.permissions
      ) ||
      typeof
        result.new_session_version !==
        "number"
    ) {
      console.error(
        "update_admin_support_user_permissions_atomic returned invalid data:",
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
          "تم تحديث صلاحيات مستخدم الدعم بنجاح",
        data: {
          user_id:
            result.user_id,
          permissions:
            result.permissions,
          session_version:
            result.new_session_version,
        },
      },
      {
        status: 200,
        headers:
          noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support user update route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء تحديث مستخدم الدعم",
      500
    );
  }
}
