import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminSupportRequest } from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_REQUEST_BODY_BYTES = 16_384;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BRANCH_SLUG_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

const MANAGER_USERNAME_PATTERN =
  /^[a-z0-9_]{3,30}$/;

const MANAGER_PASSWORD_PATTERN =
  /^[\p{L}\p{N}]{4,8}$/u;

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
  manager_phone?: unknown;
};

type CreateBranchResult = {
  branch_id: string;
  manager_id: string;
  investor_id: string;
};

type MappedCreateBranchError = {
  message: string;
  status: number;
};

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control":
      "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    Vary: "Cookie",
  };
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

function cleanText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.normalize("NFKC").trim()
    : "";
}

function cleanNumericText(
  value: unknown,
  maxLength: number
): string {
  return normalizeDigits(
    cleanText(value)
  )
    .replace(/\D/g, "")
    .slice(0, maxLength);
}

function normalizePhone(
  value: unknown
): string {
  const normalized =
    normalizeDigits(
      cleanText(value)
    );

  const hasLeadingPlus =
    normalized.startsWith("+");

  const digits = normalized
    .replace(/\D/g, "")
    .slice(
      0,
      hasLeadingPlus ? 19 : 20
    );

  return hasLeadingPlus
    ? `+${digits}`
    : digits;
}

function normalizeManagerUsername(
  value: unknown
): string {
  return normalizeDigits(
    cleanText(value)
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9_]/g,
      ""
    )
    .slice(0, 30);
}

function normalizeBranchSlug(
  value: unknown
): string {
  return normalizeDigits(
    cleanText(value)
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9_-]/g,
      ""
    )
    .slice(0, 64);
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(value);

  return (
    prototype ===
      Object.prototype ||
    prototype === null
  );
}

function isValidUuid(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    UUID_PATTERN.test(value)
  );
}

function createErrorResponse(
  message: string,
  status: number,
  clearCookie = false
): NextResponse {
  const response =
    NextResponse.json(
      {
        ok: false,
        message,
      },
      {
        status,
        headers:
          noStoreHeaders(),
      }
    );

  if (clearCookie) {
    response.cookies.set(
      ADMIN_SUPPORT_COOKIE_NAME,
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        priority: "high",
      }
    );
  }

  return response;
}

function mapCreateBranchError(
  errorText: string
): MappedCreateBranchError {
  if (
    errorText.includes(
      "BRANCH_NAME_REQUIRED"
    )
  ) {
    return {
      message:
        "اكتب اسم الفرع",
      status: 400,
    };
  }

  if (
    errorText.includes(
      "BRANCH_SLUG_REQUIRED"
    )
  ) {
    return {
      message:
        "اكتب رابط الفرع",
      status: 400,
    };
  }

  if (
    errorText.includes(
      "INVALID_BRANCH_SLUG"
    )
  ) {
    return {
      message:
        "رابط الفرع يجب أن يبدأ وينتهي بحرف إنجليزي صغير أو رقم، ويقبل في الوسط _ أو -",
      status: 400,
    };
  }

  if (
    errorText.includes(
      "ORGANIZATION_NAME_REQUIRED"
    )
  ) {
    return {
      message:
        "اكتب اسم المنظمة",
      status: 400,
    };
  }

  if (
    errorText.includes(
      "MANAGER_NAME_REQUIRED"
    )
  ) {
    return {
      message:
        "اكتب اسم مدير الفرع",
      status: 400,
    };
  }

  if (
    errorText.includes(
      "INVALID_MANAGER_USERNAME"
    )
  ) {
    return {
      message:
        "اسم مستخدم مدير الفرع يجب أن يكون من 3 إلى 30 خانة، ويقبل الحروف الإنجليزية والأرقام و _ فقط",
      status: 400,
    };
  }

  if (
    errorText.includes(
      "MANAGER_PASSWORD_MUST_BE_4_DIGITS"
    ) ||
    errorText.includes(
      "PASSWORD_MUST_BE_4_TO_8_DIGITS"
    ) ||
    errorText.includes(
      "PASSWORD_MUST_BE_4_TO_8_NO_SPACES"
    ) ||
    errorText.includes(
      "MANAGER_PASSWORD_MUST_BE_4_TO_8_ALPHANUMERIC"
    ) ||
    errorText.includes(
      "PASSWORD_MUST_BE_4_TO_8_ALPHANUMERIC"
    )
  ) {
    return {
      message:
        "كلمة مرور مدير الفرع يجب أن تكون من 4 إلى 8 أحرف أو أرقام، بدون مسافات أو رموز",
      status: 400,
    };
  }

  if (
    errorText.includes(
      "MANAGER_PASSWORD_HASH_CREATION_FAILED"
    )
  ) {
    return {
      message:
        "تعذر تأمين كلمة مرور مدير الفرع، ولم يتم إنشاء الفرع",
      status: 500,
    };
  }

  if (
    errorText.includes(
      "BRANCH_SLUG_ALREADY_EXISTS"
    )
  ) {
    return {
      message:
        "رابط الفرع مستخدم مسبقًا",
      status: 409,
    };
  }

  if (
    errorText.includes(
      "BRANCH_NAME_ALREADY_EXISTS"
    )
  ) {
    return {
      message:
        "اسم الفرع موجود مسبقًا",
      status: 409,
    };
  }

  if (
    errorText.includes(
      "MANAGER_USERNAME_ALREADY_EXISTS"
    )
  ) {
    return {
      message:
        "اسم مستخدم مدير الفرع مستخدم مسبقًا",
      status: 409,
    };
  }

  if (
    errorText.includes(
      "finance_branches_branch_slug_key"
    )
  ) {
    return {
      message:
        "رابط الفرع مستخدم مسبقًا",
      status: 409,
    };
  }

  if (
    errorText.includes(
      "finance_branch_users_username_key"
    )
  ) {
    return {
      message:
        "اسم مستخدم مدير الفرع مستخدم مسبقًا",
      status: 409,
    };
  }

  if (
    errorText.includes(
      "duplicate key"
    ) ||
    errorText.includes("23505")
  ) {
    return {
      message:
        "توجد بيانات مستخدمة مسبقًا",
      status: 409,
    };
  }

  if (
    errorText.includes("23514")
  ) {
    return {
      message:
        "إحدى القيم لا تتوافق مع إعدادات النظام",
      status: 400,
    };
  }

  if (
    errorText.includes("23503")
  ) {
    return {
      message:
        "تعذر ربط بيانات الفرع بالسجلات المطلوبة",
      status: 400,
    };
  }

  return {
    message:
      "تعذر إنشاء الفرع",
    status: 500,
  };
}

export async function POST(
  request: Request
): Promise<NextResponse> {
  try {
    const auth =
      await verifyAdminSupportRequest(
        "manage_branches"
      );

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        auth.clearCookie === true
      );
    }

    const contentType =
      request.headers
        .get("content-type")
        ?.toLowerCase() ?? "";

    if (
      !contentType.startsWith(
        "application/json"
      )
    ) {
      return createErrorResponse(
        "نوع بيانات الطلب غير مدعوم",
        415
      );
    }

    const contentLengthHeader =
      request.headers.get(
        "content-length"
      );

    if (contentLengthHeader) {
      const contentLength =
        Number(
          contentLengthHeader
        );

      if (
        Number.isFinite(
          contentLength
        ) &&
        contentLength >
          MAX_REQUEST_BODY_BYTES
      ) {
        return createErrorResponse(
          "حجم الطلب أكبر من الحد المسموح",
          413
        );
      }
    }

    let body: CreateBranchBody;

    try {
      const rawBody =
        await request.text();

      if (
        Buffer.byteLength(
          rawBody,
          "utf8"
        ) >
        MAX_REQUEST_BODY_BYTES
      ) {
        return createErrorResponse(
          "حجم الطلب أكبر من الحد المسموح",
          413
        );
      }

      const parsedBody: unknown =
        JSON.parse(rawBody);

      if (
        !isPlainObject(
          parsedBody
        )
      ) {
        return createErrorResponse(
          "بيانات الطلب غير صحيحة",
          400
        );
      }

      body =
        parsedBody as CreateBranchBody;
    } catch {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400
      );
    }

    const branchName =
      cleanText(
        body.branch_name
      );

    const branchSlug =
      normalizeBranchSlug(
        body.branch_slug
      );

    const organizationName =
      cleanText(
        body.organization_name
      );

    const city =
      cleanText(
        body.city
      );

    const commercialRecord =
      cleanNumericText(
        body.commercial_record,
        30
      );

    const phone =
      normalizePhone(
        body.phone
      );

    const notes =
      cleanText(
        body.notes
      );

    const managerFullName =
      cleanText(
        body.manager_full_name
      );

    const managerUsername =
      normalizeManagerUsername(
        body.manager_username
      );

    const managerPassword =
      normalizeDigits(
        cleanText(
          body.manager_password
        )
      );

    const managerPhone =
      cleanNumericText(
        body.manager_phone,
        10
      );

    if (
      branchName.length < 2 ||
      branchName.length > 100
    ) {
      return createErrorResponse(
        "اسم الفرع يجب أن يكون من حرفين إلى 100 حرف",
        400
      );
    }

    if (
      !BRANCH_SLUG_PATTERN.test(
        branchSlug
      )
    ) {
      return createErrorResponse(
        "رابط الفرع يجب أن يبدأ وينتهي بحرف إنجليزي صغير أو رقم، ويقبل في الوسط _ أو -",
        400
      );
    }

    if (
      organizationName.length < 2 ||
      organizationName.length >
        150
    ) {
      return createErrorResponse(
        "اسم المنظمة يجب أن يكون من حرفين إلى 150 حرف",
        400
      );
    }

    if (
      city.length > 100
    ) {
      return createErrorResponse(
        "اسم المدينة طويل جدًا",
        400
      );
    }

    if (
      commercialRecord.length >
      30
    ) {
      return createErrorResponse(
        "رقم السجل التجاري طويل جدًا",
        400
      );
    }

    if (
      phone.length > 20
    ) {
      return createErrorResponse(
        "رقم الجوال طويل جدًا",
        400
      );
    }

    if (
      notes.length > 1000
    ) {
      return createErrorResponse(
        "الملاحظات طويلة جدًا",
        400
      );
    }

    if (
      managerFullName.length < 2 ||
      managerFullName.length >
        100
    ) {
      return createErrorResponse(
        "اسم مدير الفرع يجب أن يكون من حرفين إلى 100 حرف",
        400
      );
    }

    if (
      !MANAGER_USERNAME_PATTERN.test(
        managerUsername
      )
    ) {
      return createErrorResponse(
        "اسم مستخدم مدير الفرع يجب أن يكون من 3 إلى 30 خانة، ويقبل الحروف الإنجليزية والأرقام و _ فقط",
        400
      );
    }

    if (
      !MANAGER_PASSWORD_PATTERN.test(
        managerPassword
      )
    ) {
      return createErrorResponse(
        "كلمة مرور مدير الفرع يجب أن تكون من 4 إلى 8 أحرف أو أرقام، بدون مسافات أو رموز",
        400
      );
    }

    if (!managerPhone) {
      return createErrorResponse(
        "رقم جوال مدير الفرع مطلوب",
        400
      );
    }

    if (
      !/^05\d{8}$/.test(
        managerPhone
      )
    ) {
      return createErrorResponse(
        "رقم جوال مدير الفرع يجب أن يبدأ بـ 05 ويتكون من 10 أرقام",
        400
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin.rpc(
      "create_admin_branch_atomic",
      {
        p_branch_name:
          branchName,

        p_branch_slug:
          branchSlug,

        p_organization_name:
          organizationName,

        p_city:
          city || null,

        p_commercial_record:
          commercialRecord ||
          null,

        p_phone:
          phone || null,

        p_notes:
          notes || null,

        p_manager_full_name:
          managerFullName,

        p_manager_username:
          managerUsername,

        p_manager_password:
          managerPassword,

        p_actor_user_id:
          auth.user.id,

        p_actor_user_name:
          auth.user.fullName,
      }
    );

    if (error) {
      const fullErrorText = [
        error.code,
        error.message,
        error.details,
        error.hint,
      ]
        .filter(
          (
            value
          ): value is string =>
            typeof value ===
              "string" &&
            value.length > 0
        )
        .join(" ");

      console.error(
        "create_admin_branch_atomic failed:",
        {
          code:
            error.code,

          message:
            error.message,

          details:
            error.details,

          hint:
            error.hint,
        }
      );

      const mappedError =
        mapCreateBranchError(
          fullErrorText
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
      isPlainObject(
        rawResult
      )
        ? (rawResult as CreateBranchResult)
        : null;

    if (
      !isValidUuid(
        result?.branch_id
      ) ||
      !isValidUuid(
        result?.manager_id
      ) ||
      !isValidUuid(
        result?.investor_id
      )
    ) {
      console.error(
        "create_admin_branch_atomic returned invalid data:",
        {
          hasBranchId:
            Boolean(
              result?.branch_id
            ),

          hasManagerId:
            Boolean(
              result?.manager_id
            ),

          hasInvestorId:
            Boolean(
              result?.investor_id
            ),
        }
      );

      return createErrorResponse(
        "تم تنفيذ العملية لكن تعذر قراءة نتيجتها",
        500
      );
    }

    const { error: phoneError } =
      await supabaseAdmin
        .from(
          "finance_branch_users"
        )
        .update({
          phone: managerPhone,
        })
        .eq("id", result.manager_id)
        .eq(
          "branch_id",
          result.branch_id
        );

    if (phoneError) {
      console.error(
        "Manager phone update failed:",
        {
          code:
            phoneError.code,
          message:
            phoneError.message,
          details:
            phoneError.details,
          hint:
            phoneError.hint,
        }
      );

      return createErrorResponse(
        "تعذر حفظ رقم جوال مدير الفرع",
        500
      );
    }

    return NextResponse.json(
      {
        ok: true,

        message:
          "تم إنشاء الفرع ومدير الفرع والمستثمر الرئيسي بنجاح",

        data: {
          branch_id:
            result.branch_id,

          manager_id:
            result.manager_id,

          investor_id:
            result.investor_id,
        },
      },
      {
        status: 201,
        headers:
          noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support branch creation route error:",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,
          }
        : {
            name:
              "UnknownError",
          }
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء إنشاء الفرع",
      500
    );
  }
}
