import { NextResponse } from "next/server";

import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  action?: unknown;
  branch?: unknown;

  userId?: unknown;
  fullName?: unknown;
  username?: unknown;
  password?: unknown;
  role?: unknown;
  permissions?: unknown;
  investorId?: unknown;

  investorName?: unknown;
  nationalId?: unknown;
  phone?: unknown;
  notes?: unknown;
};

const USER_ROLES = new Set([
  "مدير",
  "موظف",
  "مستثمر",
]);

const INVESTOR_PERMISSIONS = [
  "workflow",
  "investor_data",
  "investor_contracts",
];

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
    .replace(/[٠-٩]/g, (digit) =>
      String(
        "٠١٢٣٤٥٦٧٨٩".indexOf(
          digit
        )
      )
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".indexOf(
          digit
        )
      )
    );
}

function normalizeUsername(
  value: unknown
): string {
  return normalizeDigits(
    cleanText(value)
  )
    .replace(
      /[^A-Za-z0-9_]/g,
      ""
    )
    .slice(0, 30)
    .toLowerCase();
}

function normalizePassword(
  value: unknown
): string {
  return normalizeDigits(
    cleanText(value)
  )
    .replace(
      /[^A-Za-z0-9]/g,
      ""
    )
    .slice(0, 10);
}

function normalizeNumericValue(
  value: unknown,
  maxLength: number
): string {
  return normalizeDigits(
    cleanText(value)
  )
    .replace(/\D/g, "")
    .slice(0, maxLength);
}

function normalizePermissions(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (
            permission
          ): permission is string =>
            typeof permission ===
            "string"
        )
        .map((permission) =>
          permission.trim()
        )
        .filter(Boolean)
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

function getDatabaseErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
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

async function requirePermissionsSession(
  branchSlug: string
) {
  return requireFinanceBranchSession({
    requestedBranchSlug:
      branchSlug,
    requiredPermission:
      "permissions",
  });
}

export async function GET(
  request: Request
) {
  try {
    const url = new URL(
      request.url
    );

    const branchSlug =
      cleanText(
        url.searchParams.get(
          "branch"
        )
      ).toLowerCase();

    if (!branchSlug) {
      return createErrorResponse(
        "تعذر تحديد الفرع",
        400,
        "BRANCH_REQUIRED"
      );
    }

    const session =
      await requirePermissionsSession(
        branchSlug
      );

    const [
      usersResult,
      investorsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from(
          "finance_branch_users"
        )
        .select(
          `
            id,
            branch_id,
            full_name,
            username,
            role,
            permissions,
            investor_id,
            is_active,
            created_at,
            updated_at,
            last_login_at
          `
        )
        .eq(
          "branch_id",
          session.branchId
        )
        .order(
          "created_at",
          {
            ascending: false,
            nullsFirst: false,
          }
        )
        .order(
          "full_name",
          {
            ascending: true,
          }
        ),

      supabaseAdmin
        .from(
          "finance_investors"
        )
        .select(
          `
            id,
            branch_id,
            investor_name,
            national_id,
            phone,
            notes,
            is_active,
            is_primary,
            created_at
          `
        )
        .eq(
          "branch_id",
          session.branchId
        )
        .order(
          "created_at",
          {
            ascending: false,
            nullsFirst: false,
          }
        )
        .order(
          "investor_name",
          {
            ascending: true,
          }
        ),
    ]);

    if (usersResult.error) {
      console.error(
        "Permissions users list failed:",
        usersResult.error
      );

      return createErrorResponse(
        "تعذر تحميل المستخدمين",
        500,
        "USERS_LOAD_FAILED"
      );
    }

    if (
      investorsResult.error
    ) {
      console.error(
        "Permissions investors list failed:",
        investorsResult.error
      );

      return createErrorResponse(
        "تعذر تحميل المستثمرين",
        500,
        "INVESTORS_LOAD_FAILED"
      );
    }

    return createResponse({
      ok: true,
      users:
        usersResult.data ?? [],
      investors:
        investorsResult.data ??
        [],
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
      "Permissions GET error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء تحميل بيانات الإدارة",
      500
    );
  }
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

    const action =
      cleanText(body.action);

    const branchSlug =
      cleanText(
        body.branch
      ).toLowerCase();

    if (!branchSlug) {
      return createErrorResponse(
        "تعذر تحديد الفرع",
        400,
        "BRANCH_REQUIRED"
      );
    }

    const session =
      await requirePermissionsSession(
        branchSlug
      );

    if (
      action ===
      "create-user"
    ) {
      const fullName =
        cleanText(
          body.fullName
        );

      const username =
        normalizeUsername(
          body.username
        );

      const password =
        normalizePassword(
          body.password
        );

      const role =
        cleanText(body.role);

      const permissions =
        normalizePermissions(
          body.permissions
        );

      const investorId =
        cleanText(
          body.investorId
        ) || null;

      if (
        fullName.length < 2 ||
        fullName.length > 100
      ) {
        return createErrorResponse(
          "الاسم يجب أن يكون من حرفين إلى 100 حرف",
          400,
          "INVALID_FULL_NAME"
        );
      }

      if (
        !/^[a-z0-9_]{3,30}$/.test(
          username
        )
      ) {
        return createErrorResponse(
          "اسم المستخدم يجب أن يكون من 3 إلى 30 خانة ويقبل الأحرف الإنجليزية والأرقام والشرطة السفلية فقط",
          400,
          "INVALID_USERNAME"
        );
      }

      if (
        !/^[A-Za-z0-9]{4,10}$/.test(
          password
        )
      ) {
        return createErrorResponse(
          "كلمة المرور يجب أن تكون من 4 إلى 10 أحرف أو أرقام",
          400,
          "INVALID_PASSWORD"
        );
      }

      if (
        !USER_ROLES.has(role)
      ) {
        return createErrorResponse(
          "نوع المستخدم غير صحيح",
          400,
          "INVALID_ROLE"
        );
      }

      if (
        role === "مستثمر" &&
        !investorId
      ) {
        return createErrorResponse(
          "اختر المستثمر المرتبط بالحساب",
          400,
          "INVESTOR_REQUIRED"
        );
      }

      const {
        data,
        error,
      } = await supabaseAdmin.rpc(
        "create_finance_user_server_atomic",
        {
          p_branch_id:
            session.branchId,
          p_actor_user_id:
            session.userId,
          p_full_name:
            fullName,
          p_username:
            username,
          p_password:
            password,
          p_role:
            role,
          p_permissions:
            role ===
            "مستثمر"
              ? INVESTOR_PERMISSIONS
              : permissions,
          p_investor_id:
            role ===
            "مستثمر"
              ? investorId
              : null,
        }
      );

      if (error) {
        console.error(
          "Create finance user failed:",
          error
        );

        return createErrorResponse(
          error.message ||
            "تعذر إنشاء المستخدم",
          400,
          "CREATE_USER_FAILED"
        );
      }

      return createResponse({
        ok: true,
        user:
          Array.isArray(data)
            ? data[0] ?? null
            : data,
        message:
          "تم إنشاء المستخدم بنجاح",
      });
    }

    if (
      action ===
      "create-investor"
    ) {
      const investorName =
        cleanText(
          body.investorName
        );

      const nationalId =
        normalizeNumericValue(
          body.nationalId,
          10
        );

      const phone =
        normalizeNumericValue(
          body.phone,
          10
        );

      const notes =
        cleanText(body.notes);

      if (
        investorName.length < 2 ||
        investorName.length >
          150
      ) {
        return createErrorResponse(
          "اسم المستثمر يجب أن يكون من حرفين إلى 150 حرفًا",
          400,
          "INVALID_INVESTOR_NAME"
        );
      }

      if (
        nationalId &&
        !/^\d{10}$/.test(
          nationalId
        )
      ) {
        return createErrorResponse(
          "رقم الهوية يجب أن يتكون من 10 أرقام",
          400,
          "INVALID_NATIONAL_ID"
        );
      }

      if (
        phone &&
        !/^05\d{8}$/.test(
          phone
        )
      ) {
        return createErrorResponse(
          "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام",
          400,
          "INVALID_PHONE"
        );
      }

      const {
        data,
        error,
      } = await supabaseAdmin.rpc(
        "create_finance_investor_server_atomic",
        {
          p_branch_id:
            session.branchId,
          p_actor_user_id:
            session.userId,
          p_investor_name:
            investorName,
          p_national_id:
            nationalId || null,
          p_phone:
            phone || null,
          p_notes:
            notes || null,
        }
      );

      if (error) {
        console.error(
          "Create finance investor failed:",
          error
        );

        return createErrorResponse(
          error.message ||
            "تعذر إنشاء المستثمر",
          400,
          "CREATE_INVESTOR_FAILED"
        );
      }

      return createResponse({
        ok: true,
        investor:
          Array.isArray(data)
            ? data[0] ?? null
            : data,
        message:
          "تم إنشاء المستثمر بنجاح",
      });
    }

    return createErrorResponse(
      "نوع العملية غير معروف",
      400,
      "UNKNOWN_ACTION"
    );
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
      "Permissions POST error:",
      error
    );

    return createErrorResponse(
      getDatabaseErrorMessage(
        error,
        "حدث خطأ أثناء تنفيذ العملية"
      ),
      500
    );
  }
}

export async function PATCH(
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

    const action =
      cleanText(body.action);

    const branchSlug =
      cleanText(
        body.branch
      ).toLowerCase();

    const userId =
      cleanText(body.userId);

    if (
      !branchSlug ||
      !userId
    ) {
      return createErrorResponse(
        "بيانات العملية غير مكتملة",
        400,
        "MISSING_DATA"
      );
    }

    const session =
      await requirePermissionsSession(
        branchSlug
      );

    if (
      action ===
      "toggle-user"
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin.rpc(
        "toggle_finance_user_server_atomic",
        {
          p_branch_id:
            session.branchId,
          p_actor_user_id:
            session.userId,
          p_user_id:
            userId,
        }
      );

      if (error) {
        console.error(
          "Toggle finance user failed:",
          error
        );

        return createErrorResponse(
          error.message ||
            "تعذر تعديل حالة المستخدم",
          400,
          "TOGGLE_USER_FAILED"
        );
      }

      return createResponse({
        ok: true,
        result:
          Array.isArray(data)
            ? data[0] ?? null
            : data,
        message:
          "تم تعديل حالة المستخدم بنجاح",
      });
    }

    if (
      action ===
      "update-user"
    ) {
      const fullName =
        cleanText(
          body.fullName
        );

      const username =
        normalizeUsername(
          body.username
        );

      const password =
        normalizePassword(
          body.password
        );

      const role =
        cleanText(body.role);

      const permissions =
        normalizePermissions(
          body.permissions
        );

      const investorId =
        cleanText(
          body.investorId
        ) || null;

      if (
        fullName.length < 2 ||
        fullName.length > 100
      ) {
        return createErrorResponse(
          "الاسم يجب أن يكون من حرفين إلى 100 حرف",
          400
        );
      }

      if (
        !/^[a-z0-9_]{3,30}$/.test(
          username
        )
      ) {
        return createErrorResponse(
          "اسم المستخدم يجب أن يكون من 3 إلى 30 خانة ويقبل الأحرف الإنجليزية والأرقام والشرطة السفلية فقط",
          400
        );
      }

      if (
        password &&
        !/^[A-Za-z0-9]{4,10}$/.test(
          password
        )
      ) {
        return createErrorResponse(
          "كلمة المرور الجديدة يجب أن تكون من 4 إلى 10 أحرف أو أرقام",
          400
        );
      }

      if (
        !USER_ROLES.has(role)
      ) {
        return createErrorResponse(
          "نوع المستخدم غير صحيح",
          400
        );
      }

      const {
        data,
        error,
      } = await supabaseAdmin.rpc(
        "update_finance_user_server_atomic",
        {
          p_branch_id:
            session.branchId,
          p_actor_user_id:
            session.userId,
          p_user_id:
            userId,
          p_full_name:
            fullName,
          p_username:
            username,
          p_role:
            role,
          p_permissions:
            role ===
            "مستثمر"
              ? INVESTOR_PERMISSIONS
              : permissions,
          p_investor_id:
            role ===
            "مستثمر"
              ? investorId
              : null,
          p_new_password:
            password || null,
        }
      );

      if (error) {
        console.error(
          "Update finance user failed:",
          error
        );

        return createErrorResponse(
          error.message ||
            "تعذر تعديل المستخدم",
          400,
          "UPDATE_USER_FAILED"
        );
      }

      return createResponse({
        ok: true,
        user:
          Array.isArray(data)
            ? data[0] ?? null
            : data,
        message:
          "تم تعديل المستخدم بنجاح",
      });
    }

    return createErrorResponse(
      "نوع العملية غير معروف",
      400,
      "UNKNOWN_ACTION"
    );
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
      "Permissions PATCH error:",
      error
    );

    return createErrorResponse(
      getDatabaseErrorMessage(
        error,
        "حدث خطأ أثناء تعديل المستخدم"
      ),
      500
    );
  }
}

export async function DELETE(
  request: Request
) {
  try {
    const url = new URL(
      request.url
    );

    const branchSlug =
      cleanText(
        url.searchParams.get(
          "branch"
        )
      ).toLowerCase();

    const userId =
      cleanText(
        url.searchParams.get(
          "userId"
        )
      );

    if (
      !branchSlug ||
      !userId
    ) {
      return createErrorResponse(
        "بيانات الحذف غير مكتملة",
        400,
        "MISSING_DATA"
      );
    }

    const session =
      await requirePermissionsSession(
        branchSlug
      );

    const {
      data,
      error,
    } = await supabaseAdmin.rpc(
      "delete_finance_user_server_atomic",
      {
        p_branch_id:
          session.branchId,
        p_actor_user_id:
          session.userId,
        p_user_id:
          userId,
      }
    );

    if (error) {
      console.error(
        "Delete finance user failed:",
        error
      );

      return createErrorResponse(
        error.message ||
          "تعذر حذف المستخدم",
        400,
        "DELETE_USER_FAILED"
      );
    }

    return createResponse({
      ok: true,
      result:
        Array.isArray(data)
          ? data[0] ?? null
          : data,
      message:
        "تم حذف المستخدم بنجاح",
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
      "Permissions DELETE error:",
      error
    );

    return createErrorResponse(
      getDatabaseErrorMessage(
        error,
        "حدث خطأ أثناء حذف المستخدم"
      ),
      500
    );
  }
}
