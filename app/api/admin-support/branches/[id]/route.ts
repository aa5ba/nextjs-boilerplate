import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

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

type UpdateBranchResult = {
  branch_id: string;
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

function mapUpdateBranchError(message: string) {
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
      message: "اكتب اسم الفرع",
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
        "رابط الفرع يقبل الحروف الإنجليزية والأرقام و _ أو - فقط",
      status: 400,
    };
  }

  if (message.includes("ORGANIZATION_NAME_REQUIRED")) {
    return {
      message: "اكتب اسم المنظمة",
      status: 400,
    };
  }

  if (
    message.includes("BRANCH_SLUG_ALREADY_EXISTS") ||
    message.includes("BRANCH_NAME_ALREADY_EXISTS")
  ) {
    return {
      message: "الفرع موجود مسبقًا",
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

  return {
    message: "تعذر تحديث بيانات الفرع",
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
    const branchId = cleanText(id);

    if (!branchId || !isValidUuid(branchId)) {
      return createErrorResponse(
        "معرّف الفرع غير صحيح",
        400
      );
    }

    let body: UpdateBranchBody;

    try {
      body = (await request.json()) as UpdateBranchBody;
    } catch {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400
      );
    }

    const branchName = cleanText(body.branch_name);

    const branchSlug = cleanText(
      body.branch_slug
    ).toLowerCase();

    const organizationName = cleanText(
      body.organization_name
    );

    const city = cleanText(body.city);

    const commercialRecord = cleanText(
      body.commercial_record
    );

    const phone = cleanText(body.phone);
    const notes = cleanText(body.notes);

    if (!branchName) {
      return createErrorResponse(
        "اكتب اسم الفرع",
        400
      );
    }

    if (!branchSlug) {
      return createErrorResponse(
        "اكتب رابط الفرع",
        400
      );
    }

    if (!/^[a-z0-9_-]+$/.test(branchSlug)) {
      return createErrorResponse(
        "رابط الفرع يقبل الحروف الإنجليزية والأرقام و _ أو - فقط",
        400
      );
    }

    if (!organizationName) {
      return createErrorResponse(
        "اكتب اسم المنظمة",
        400
      );
    }

    if (
      typeof body.is_active !== "boolean"
    ) {
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
      console.error(
        "update_admin_branch_atomic failed:",
        error
      );

      const mappedError = mapUpdateBranchError(
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
      rawResult &&
      typeof rawResult === "object"
        ? (rawResult as UpdateBranchResult)
        : null;

    if (
      !result?.branch_id ||
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

    return NextResponse.json(
      {
        ok: true,
        message: "تم تحديث الفرع بنجاح",
        data: {
          branch_id: result.branch_id,
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
      "Admin support branch update route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء تحديث الفرع",
      500
    );
  }
}
