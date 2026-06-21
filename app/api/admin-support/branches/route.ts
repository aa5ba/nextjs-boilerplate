import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

type CreateBranchBody = {
  branch_name?: unknown;
  branch_slug?: unknown;
  organization_name?: unknown;
  city?: unknown;
  commercial_record?: unknown;
  phone?: unknown;
  notes?: unknown;
  manager_full_name?: unknown;
  manager_username?: unknown;
  manager_password?: unknown;
};

type CreateBranchResult = {
  branch_id: string;
  manager_id: string;
  investor_id: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function mapCreateBranchError(message: string) {
  if (message.includes("BRANCH_NAME_REQUIRED")) {
    return "اكتب اسم الفرع";
  }

  if (message.includes("BRANCH_SLUG_REQUIRED")) {
    return "اكتب رابط الفرع";
  }

  if (message.includes("INVALID_BRANCH_SLUG")) {
    return "رابط الفرع يقبل الحروف الإنجليزية والأرقام و _ أو - فقط";
  }

  if (message.includes("ORGANIZATION_NAME_REQUIRED")) {
    return "اكتب اسم المنظمة";
  }

  if (message.includes("MANAGER_NAME_REQUIRED")) {
    return "اكتب اسم مدير الفرع";
  }

  if (message.includes("INVALID_MANAGER_USERNAME")) {
    return "اسم مستخدم مدير الفرع يجب أن يكون من 3 إلى 30 حرفًا، ويقبل العربي أو الإنجليزي أو الأرقام أو _ فقط";
  }

  if (message.includes("MANAGER_PASSWORD_MUST_BE_4_DIGITS")) {
    return "كلمة مرور مدير الفرع يجب أن تكون 4 أرقام فقط";
  }

  if (
    message.includes("BRANCH_SLUG_ALREADY_EXISTS") ||
    message.includes("BRANCH_NAME_ALREADY_EXISTS")
  ) {
    return "الفرع موجود مسبقًا";
  }

  if (message.includes("MANAGER_USERNAME_ALREADY_EXISTS")) {
    return "اسم مستخدم مدير الفرع مستخدم مسبقًا";
  }

  if (
    message.includes("duplicate key") ||
    message.includes("23505")
  ) {
    return "يوجد سجل آخر يستخدم البيانات نفسها";
  }

  return "تعذر إنشاء الفرع";
}

export async function POST(request: Request) {
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

    let body: CreateBranchBody;

    try {
      body = (await request.json()) as CreateBranchBody;
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

    const managerFullName = cleanText(
      body.manager_full_name
    );

    const managerUsername = cleanText(
      body.manager_username
    );

    const managerPassword = cleanText(
      body.manager_password
    );

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

    if (!managerFullName) {
      return createErrorResponse(
        "اكتب اسم مدير الفرع",
        400
      );
    }

    if (
      managerUsername.length < 3 ||
      managerUsername.length > 30 ||
      !/^[A-Za-z0-9_\u0600-\u06FF]+$/.test(
        managerUsername
      )
    ) {
      return createErrorResponse(
        "اسم مستخدم مدير الفرع يجب أن يكون من 3 إلى 30 حرفًا، ويقبل العربي أو الإنجليزي أو الأرقام أو _ فقط",
        400
      );
    }

    if (!/^\d{4}$/.test(managerPassword)) {
      return createErrorResponse(
        "كلمة مرور مدير الفرع يجب أن تكون 4 أرقام فقط",
        400
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "create_admin_branch_atomic",
      {
        p_branch_name: branchName,
        p_branch_slug: branchSlug,
        p_organization_name: organizationName,
        p_city: city || null,
        p_commercial_record:
          commercialRecord || null,
        p_phone: phone || null,
        p_notes: notes || null,
        p_manager_full_name: managerFullName,
        p_manager_username: managerUsername,
        p_manager_password: managerPassword,
        p_actor_user_id: auth.user.id,
        p_actor_user_name: auth.user.fullName,
      }
    );

    if (error) {
      console.error(
        "create_admin_branch_atomic failed:",
        error
      );

      return createErrorResponse(
        mapCreateBranchError(
          `${error.code || ""} ${error.message || ""}`
        ),
        error.code === "P0001" ? 400 : 500
      );
    }

    const rawResult = Array.isArray(data)
      ? data[0]
      : data;

    const result =
      rawResult &&
      typeof rawResult === "object"
        ? (rawResult as CreateBranchResult)
        : null;

    if (
      !result?.branch_id ||
      !result.manager_id ||
      !result.investor_id
    ) {
      console.error(
        "create_admin_branch_atomic returned invalid data:",
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
          "تم إنشاء الفرع ومدير الفرع والمستثمر الرئيسي بنجاح",
        data: {
          branch_id: result.branch_id,
          manager_id: result.manager_id,
          investor_id: result.investor_id,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Admin support branch creation route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء إنشاء الفرع",
      500
    );
  }
}
