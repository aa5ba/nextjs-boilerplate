import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateSupportUserBody = {
  is_active?: unknown;
};

type UpdateSupportUserResult = {
  user_id: string;
  is_active: boolean;
};

type TargetSupportUser = {
  id: string;
  role: string;
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

function mapSupportUserStatusError(rawMessage: string) {
  if (rawMessage.includes("TARGET_USER_ID_REQUIRED")) {
    return {
      message: "معرّف مستخدم الدعم غير موجود",
      status: 400,
    };
  }

  if (rawMessage.includes("ACTIVE_STATUS_REQUIRED")) {
    return {
      message: "حالة مستخدم الدعم غير صحيحة",
      status: 400,
    };
  }

  if (rawMessage.includes("SUPPORT_USER_NOT_FOUND")) {
    return {
      message: "مستخدم الدعم غير موجود",
      status: 404,
    };
  }

  if (rawMessage.includes("CANNOT_DISABLE_SELF")) {
    return {
      message: "لا يمكنك تعطيل حسابك الحالي",
      status: 400,
    };
  }

  if (rawMessage.includes("CANNOT_DISABLE_LAST_SUPER_ADMIN")) {
    return {
      message: "لا يمكن تعطيل آخر مدير نظام نشط",
      status: 400,
    };
  }

  return {
    message: "تعذر تحديث حالة مستخدم الدعم",
    status: 500,
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await verifyAdminSupportRequest(
      "manage_support_users"
    );

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        auth.clearCookie === true
      );
    }

    const { id } = await context.params;
    const targetUserId = cleanText(id);

    if (!targetUserId || !isValidUuid(targetUserId)) {
      return createErrorResponse(
        "معرّف مستخدم الدعم غير صحيح",
        400
      );
    }

    let body: UpdateSupportUserBody;

    try {
      body = (await request.json()) as UpdateSupportUserBody;
    } catch {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400
      );
    }

    if (typeof body.is_active !== "boolean") {
      return createErrorResponse(
        "حالة مستخدم الدعم غير صحيحة",
        400
      );
    }

    const { data: targetData, error: targetError } =
      await supabaseAdmin
        .from("admin_support_users")
        .select("id, role, is_active")
        .eq("id", targetUserId)
        .maybeSingle();

    if (targetError) {
      console.error(
        "Admin support target user lookup failed:",
        targetError
      );

      return createErrorResponse(
        "تعذر التحقق من مستخدم الدعم المستهدف",
        500
      );
    }

    const targetUser = targetData as TargetSupportUser | null;

    if (!targetUser) {
      return createErrorResponse(
        "مستخدم الدعم غير موجود",
        404
      );
    }

    if (
      targetUser.role === "super_admin" &&
      auth.user.role !== "super_admin"
    ) {
      return createErrorResponse(
        "لا يمكن تعديل حالة مدير النظام إلا بواسطة مدير نظام آخر",
        403
      );
    }

    if (
      targetUser.id === auth.user.id &&
      body.is_active === false
    ) {
      return createErrorResponse(
        "لا يمكنك تعطيل حسابك الحالي",
        400
      );
    }

    if (targetUser.is_active === body.is_active) {
      return NextResponse.json(
        {
          ok: true,
          message: targetUser.is_active
            ? "مستخدم الدعم مفعّل بالفعل"
            : "مستخدم الدعم معطّل بالفعل",
          data: {
            user_id: targetUser.id,
            is_active: targetUser.is_active,
          },
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
      "update_admin_support_user_status_atomic",
      {
        p_target_user_id: targetUserId,
        p_is_active: body.is_active,
        p_actor_user_id: auth.user.id,
        p_actor_user_name: auth.user.fullName,
      }
    );

    if (error) {
      console.error(
        "update_admin_support_user_status_atomic failed:",
        error
      );

      const mappedError = mapSupportUserStatusError(
        `${error.code || ""} ${error.message || ""}`
      );

      return createErrorResponse(
        mappedError.message,
        mappedError.status
      );
    }

    const rawResult = Array.isArray(data) ? data[0] : data;

    const result =
      rawResult && typeof rawResult === "object"
        ? (rawResult as UpdateSupportUserResult)
        : null;

    if (
      !result?.user_id ||
      typeof result.is_active !== "boolean"
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
        message: result.is_active
          ? "تم تفعيل مستخدم الدعم بنجاح"
          : "تم تعطيل مستخدم الدعم بنجاح",
        data: {
          user_id: result.user_id,
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
      "Admin support user status route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء تحديث مستخدم الدعم",
      500
    );
  }
}
