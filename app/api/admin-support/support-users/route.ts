import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "support",
  "viewer",
  "super_admin",
] as const;

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

type SupportRole = (typeof ALLOWED_ROLES)[number];

type CreateSupportUserBody = {
  full_name?: unknown;
  username?: unknown;
  password?: unknown;
  role?: unknown;
  permissions?: unknown;
};

type CreateSupportUserResult = {
  created_user_id: string;
  created_username: string;
  created_role: string;
};

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
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

function isSupportRole(
  value: string
): value is SupportRole {
  return (
    ALLOWED_ROLES as readonly string[]
  ).includes(value);
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

function mapCreateUserError(
  rawMessage: string
) {
  if (
    rawMessage.includes(
      "FULL_NAME_REQUIRED"
    )
  ) {
    return {
      message: "اكتب اسم المستخدم الكامل",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "FULL_NAME_TOO_LONG"
    )
  ) {
    return {
      message:
        "اسم المستخدم الكامل طويل جدًا",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "INVALID_USERNAME"
    )
  ) {
    return {
      message:
        "اسم المستخدم يجب أن يكون من 3 إلى 30 حرفًا، ويقبل العربي أو الإنجليزي أو الأرقام أو _ فقط",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "INVALID_PASSWORD_LENGTH"
    )
  ) {
    return {
      message:
        "كلمة المرور يجب أن تكون من 4 إلى 100 حرف",
      status: 400,
    };
  }

  if (
    rawMessage.includes(
      "INVALID_SUPPORT_ROLE"
    )
  ) {
    return {
      message: "دور المستخدم غير صحيح",
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
      "USERNAME_ALREADY_EXISTS"
    )
  ) {
    return {
      message:
        "اسم المستخدم مستخدم مسبقًا",
      status: 409,
    };
  }

  if (
    rawMessage.includes("duplicate key") ||
    rawMessage.includes("23505")
  ) {
    return {
      message:
        "اسم المستخدم مستخدم مسبقًا",
      status: 409,
    };
  }

  return {
    message:
      "تعذر إنشاء مستخدم الدعم",
    status: 500,
  };
}

export async function POST(
  request: Request
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

    let body: CreateSupportUserBody;

    try {
      body =
        (await request.json()) as CreateSupportUserBody;
    } catch {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400
      );
    }

    const fullName = cleanText(
      body.full_name
    );

    const username = cleanText(
      body.username
    );

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const role = cleanText(
      body.role
    ).toLowerCase();

    const permissions =
      normalizePermissions(
        body.permissions
      );

    if (!fullName) {
      return createErrorResponse(
        "اكتب الاسم",
        400
      );
    }

    if (fullName.length > 100) {
      return createErrorResponse(
        "الاسم طويل جدًا",
        400
      );
    }

    if (
      username.length < 3 ||
      username.length > 30 ||
      !/^[A-Za-z0-9_\u0600-\u06FF]+$/.test(
        username
      )
    ) {
      return createErrorResponse(
        "اسم المستخدم يجب أن يكون من 3 إلى 30 حرفًا، ويقبل العربي أو الإنجليزي أو الأرقام أو _ فقط",
        400
      );
    }

    if (
      password.length < 4 ||
      password.length > 100
    ) {
      return createErrorResponse(
        "كلمة المرور يجب أن تكون من 4 إلى 100 حرف",
        400
      );
    }

    if (!isSupportRole(role)) {
      return createErrorResponse(
        "دور المستخدم غير صحيح",
        400
      );
    }

    if (!permissions) {
      return createErrorResponse(
        "قائمة الصلاحيات غير صحيحة",
        400
      );
    }

    if (
      role === "super_admin" &&
      auth.user.role !== "super_admin"
    ) {
      return createErrorResponse(
        "إنشاء مدير نظام متاح لمدير النظام فقط",
        403
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "create_admin_support_user_atomic",
        {
          p_full_name: fullName,
          p_username: username,
          p_password: password,
          p_role: role,
          p_permissions: permissions,
          p_actor_user_id:
            auth.user.id,
          p_actor_user_name:
            auth.user.fullName,
        }
      );

    if (error) {
      console.error(
        "create_admin_support_user_atomic failed:",
        error
      );

      const mappedError =
        mapCreateUserError(
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
        ? (rawResult as CreateSupportUserResult)
        : null;

    if (
      !result?.created_user_id ||
      !result.created_username ||
      !result.created_role
    ) {
      console.error(
        "create_admin_support_user_atomic returned invalid data:",
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
          "تم إنشاء مستخدم الدعم بنجاح",
        data: {
          id: result.created_user_id,
          username:
            result.created_username,
          role: result.created_role,
        },
      },
      {
        status: 201,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support user creation route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء إنشاء مستخدم الدعم",
      500
    );
  }
}
