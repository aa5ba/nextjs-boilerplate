import {
  type NextRequest,
  NextResponse,
} from "next/server";

import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LISTING_TYPES = new Set([
  "offered",
  "wanted",
]);

const CITY_CODES = new Set([
  "riyadh",
  "makkah",
  "madinah",
  "qassim",
  "eastern_region",
  "asir",
  "tabuk",
  "hail",
  "northern_borders",
  "jazan",
  "najran",
  "al_baha",
  "al_jouf",
]);

const ALLOWED_BODY_KEYS = new Set([
  "listing_type",
  "product_id",
  "city_code",
  "quantity",
  "total_price",
  "contact_phone",
  "card_expiry_month",
  "card_expiry_year",
]);

const FORBIDDEN_BODY_KEYS = new Set([
  "id",
  "listing_id",
  "listingId",
  "branch_id",
  "branchId",
  "user_id",
  "userId",
  "actor_id",
  "actorId",
  "actor_type",
  "actorType",
  "role",
  "permissions",
  "created_by_user_id",
  "created_by_branch_id",
  "product_name_snapshot",
  "unit_price",
  "card_expiry_month_snapshot",
  "card_expiry_year_snapshot",
  "published_at",
  "expires_at",
  "created_at",
  "updated_at",
  "is_active",
  "is_deleted",
  "status",
  "deal_id",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type JsonBody =
  Record<string, unknown>;

type SupabaseErrorShape = {
  message?: string;
  code?: string;
};

type RpcErrorInfo = {
  status: number;
  code: string;
  message: string;
};

type RpcResult = {
  out_listing_id?: unknown;
  out_deleted_listing_id?: unknown;
};

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
      "X-Content-Type-Options": "nosniff",
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

function isPlainObject(
  value: unknown
): value is JsonBody {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasForbiddenKey(
  keys: Iterable<string>
): boolean {
  for (const key of keys) {
    if (FORBIDDEN_BODY_KEYS.has(key)) {
      return true;
    }
  }

  return false;
}

function hasUnsupportedKey(
  keys: Iterable<string>
): boolean {
  for (const key of keys) {
    if (!ALLOWED_BODY_KEYS.has(key)) {
      return true;
    }
  }

  return false;
}

function hasRequiredKeys(
  body: JsonBody
): boolean {
  for (const key of ALLOWED_BODY_KEYS) {
    if (!(key in body)) {
      return false;
    }
  }

  return true;
}

function hasScientificNumericLiteral(
  rawBody: string,
  key: "quantity" | "total_price"
): boolean {
  const pattern = new RegExp(
    `"${key}"\\s*:\\s*[-+]?\\d+(?:\\.\\d+)?[eE][-+]?\\d+`
  );

  return pattern.test(rawBody);
}

async function readRequestBody(
  request: Request
): Promise<JsonBody | null> {
  try {
    const rawBody =
      await request.text();

    if (
      hasScientificNumericLiteral(
        rawBody,
        "quantity"
      ) ||
      hasScientificNumericLiteral(
        rawBody,
        "total_price"
      )
    ) {
      return null;
    }

    const parsed: unknown =
      JSON.parse(rawBody);

    return isPlainObject(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function hasNonEmptyBody(
  request: Request
): Promise<boolean> {
  try {
    const rawBody =
      await request.text();

    return rawBody.trim().length > 0;
  } catch {
    return true;
  }
}

function parseListingType(
  value: unknown
): string | null {
  const listingType =
    cleanText(value);

  return LISTING_TYPES.has(
    listingType
  )
    ? listingType
    : null;
}

function parseCityCode(
  value: unknown
): string | null {
  const cityCode =
    cleanText(value);

  return CITY_CODES.has(cityCode)
    ? cityCode
    : null;
}

function parsePositiveInteger(
  value: unknown
): number | null {
  if (
    typeof value === "number"
  ) {
    if (
      Number.isSafeInteger(value) &&
      value > 0
    ) {
      return value;
    }

    return null;
  }

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    normalizeDigits(
      value.trim()
    );

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isSafeInteger(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

function parseCardExpiryPart(
  value: unknown,
  min: number,
  max: number
): number | null {
  const parsed =
    parsePositiveInteger(value);

  if (
    parsed === null ||
    parsed < min ||
    parsed > max
  ) {
    return null;
  }

  return parsed;
}

function parsePhone(
  value: unknown
): string | null {
  const phone =
    normalizeDigits(
      cleanText(value)
    );

  return /^05[0-9]{8}$/.test(phone)
    ? phone
    : null;
}

function getSingleResult(
  data: unknown
): RpcResult | null {
  if (Array.isArray(data)) {
    if (data.length !== 1) {
      return null;
    }

    const [result] = data;

    return isPlainObject(result)
      ? (result as RpcResult)
      : null;
  }

  return isPlainObject(data)
    ? (data as RpcResult)
    : null;
}

function extractRpcErrorCode(
  error: SupabaseErrorShape
): string {
  const message =
    error.message ?? "";

  const knownCodes = [
    "LISTING_ACCESS_DENIED",
    "LISTING_NOT_FOUND",
    "LISTING_EXPIRED",
    "LISTING_DELETE_FAILED",
    "INVALID_LISTING_TYPE",
    "INVALID_CITY",
    "INVALID_QUANTITY",
    "INVALID_TOTAL_PRICE",
    "INVALID_CARD_EXPIRY",
    "INVALID_CONTACT_PHONE",
    "INVALID_PRODUCT",
    "PRODUCT_DELETED",
    "PRODUCT_INACTIVE",
  ];

  return (
    knownCodes.find((code) =>
      message.includes(code)
    ) ?? "UNKNOWN_ERROR"
  );
}

function mapRpcError(
  error: SupabaseErrorShape
): RpcErrorInfo {
  const code =
    extractRpcErrorCode(error);

  switch (code) {
    case "LISTING_ACCESS_DENIED":
      return {
        status: 403,
        code,
        message:
          "لا تملك صلاحية تعديل هذا العرض",
      };

    case "LISTING_NOT_FOUND":
      return {
        status: 404,
        code,
        message: "العرض غير موجود",
      };

    case "LISTING_EXPIRED":
      return {
        status: 409,
        code,
        message:
          "انتهت صلاحية العرض ولا يمكن تعديله",
      };

    case "INVALID_LISTING_TYPE":
      return {
        status: 400,
        code,
        message:
          "نوع العرض غير صحيح",
      };

    case "INVALID_CITY":
      return {
        status: 400,
        code,
        message:
          "المدينة غير صحيحة",
      };

    case "INVALID_QUANTITY":
      return {
        status: 400,
        code,
        message:
          "الكمية غير صحيحة",
      };

    case "INVALID_TOTAL_PRICE":
      return {
        status: 400,
        code,
        message:
          "السعر الإجمالي غير صحيح",
      };

    case "INVALID_CARD_EXPIRY":
      return {
        status: 400,
        code,
        message:
          "تاريخ انتهاء البطاقة غير صحيح",
      };

    case "INVALID_CONTACT_PHONE":
      return {
        status: 400,
        code,
        message:
          "رقم التواصل غير صحيح",
      };

    case "INVALID_PRODUCT":
    case "PRODUCT_DELETED":
    case "PRODUCT_INACTIVE":
      return {
        status: 400,
        code,
        message:
          "المنتج غير متاح",
      };

    default:
      return {
        status: 500,
        code: "CARD_STORE_UPDATE_FAILED",
        message:
          "تعذر تعديل العرض",
      };
  }
}

function mapDeleteRpcError(
  error: SupabaseErrorShape
): RpcErrorInfo {
  const code =
    extractRpcErrorCode(error);

  switch (code) {
    case "LISTING_ACCESS_DENIED":
      return {
        status: 403,
        code,
        message:
          "لا تملك صلاحية حذف هذا العرض",
      };

    case "LISTING_NOT_FOUND":
      return {
        status: 404,
        code,
        message: "العرض غير موجود",
      };

    case "LISTING_DELETE_FAILED":
      return {
        status: 409,
        code,
        message:
          "لا يمكن حذف العرض في حالته الحالية",
      };

    default:
      return {
        status: 500,
        code: "CARD_STORE_DELETE_FAILED",
        message:
          "تعذر حذف العرض",
      };
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session =
      await requireFinanceBranchSession({
        requiredPermission:
          "card_store",
      });

    const routeParams =
      await params;

    const listingId =
      cleanText(routeParams.id);

    if (
      !listingId ||
      !UUID_PATTERN.test(listingId)
    ) {
      return createErrorResponse(
        "معرف العرض غير صحيح",
        400,
        "INVALID_LISTING_ID"
      );
    }

    if (
      Array.from(
        request.nextUrl.searchParams.keys()
      ).length > 0
    ) {
      return createErrorResponse(
        "معاملات الطلب غير صحيحة",
        400,
        "INVALID_QUERY"
      );
    }

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

    const bodyKeys =
      Object.keys(body);

    if (hasForbiddenKey(bodyKeys)) {
      return createErrorResponse(
        "لا يمكن تمرير بيانات الهوية أو حقول داخلية من العميل",
        400,
        "FORBIDDEN_CLIENT_FIELD"
      );
    }

    if (
      hasUnsupportedKey(bodyKeys) ||
      !hasRequiredKeys(body)
    ) {
      return createErrorResponse(
        "حقول الطلب غير صحيحة",
        400,
        "UNSUPPORTED_FIELD"
      );
    }

    const listingType =
      parseListingType(
        body.listing_type
      );

    if (!listingType) {
      return createErrorResponse(
        "نوع العرض غير صحيح",
        400,
        "INVALID_LISTING_TYPE"
      );
    }

    const productId =
      cleanText(
        body.product_id
      );

    if (
      !productId ||
      !UUID_PATTERN.test(
        productId
      )
    ) {
      return createErrorResponse(
        "معرف المنتج غير صحيح",
        400,
        "INVALID_PRODUCT"
      );
    }

    const cityCode =
      parseCityCode(
        body.city_code
      );

    if (!cityCode) {
      return createErrorResponse(
        "المدينة غير صحيحة",
        400,
        "INVALID_CITY"
      );
    }

    const quantity =
      parsePositiveInteger(
        body.quantity
      );

    if (quantity === null) {
      return createErrorResponse(
        "الكمية غير صحيحة",
        400,
        "INVALID_QUANTITY"
      );
    }

    const totalPrice =
      parsePositiveInteger(
        body.total_price
      );

    if (totalPrice === null) {
      return createErrorResponse(
        "السعر الإجمالي غير صحيح",
        400,
        "INVALID_TOTAL_PRICE"
      );
    }

    const contactPhone =
      parsePhone(
        body.contact_phone
      );

    if (!contactPhone) {
      return createErrorResponse(
        "رقم التواصل غير صحيح",
        400,
        "INVALID_CONTACT_PHONE"
      );
    }

    const cardExpiryMonth =
      parseCardExpiryPart(
        body.card_expiry_month,
        1,
        12
      );
    const cardExpiryYear =
      parseCardExpiryPart(
        body.card_expiry_year,
        2000,
        9999
      );

    if (
      cardExpiryMonth === null ||
      cardExpiryYear === null
    ) {
      return createErrorResponse(
        "تاريخ انتهاء البطاقة غير صحيح",
        400,
        "INVALID_CARD_EXPIRY"
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin.rpc(
      "update_card_store_listing_for_branch_atomic",
      {
        p_actor_user_id:
          session.userId,
        p_actor_branch_id:
          session.branchId,
        p_listing_id:
          listingId,
        p_listing_type:
          listingType,
        p_product_id:
          productId,
        p_city_code:
          cityCode,
        p_quantity:
          quantity,
        p_total_price:
          totalPrice,
        p_contact_phone:
          contactPhone,
        p_card_expiry_month:
          cardExpiryMonth,
        p_card_expiry_year:
          cardExpiryYear,
      }
    );

    if (error) {
      const mappedError =
        mapRpcError(error);

      console.error(
        "Card store update listing RPC failed:",
        {
          code: error.code,
          rpcCode:
            mappedError.code,
        }
      );

      return createErrorResponse(
        mappedError.message,
        mappedError.status,
        mappedError.code
      );
    }

    const result =
      getSingleResult(data);

    if (
      !result ||
      typeof result.out_listing_id !==
        "string"
    ) {
      console.error(
        "Card store update listing unexpected RPC result"
      );

      return createErrorResponse(
        "تعذر تعديل العرض",
        500,
        "INVALID_RPC_RESULT"
      );
    }

    return createResponse({
      ok: true,
      item: {
        id: result.out_listing_id,
      },
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
      "Card store listings PATCH error:",
      error
    );

    return createErrorResponse(
      "تعذر تعديل العرض",
      500,
      "CARD_STORE_UPDATE_FAILED"
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session =
      await requireFinanceBranchSession({
        requiredPermission:
          "card_store",
      });

    const routeParams =
      await params;

    const listingId =
      cleanText(routeParams.id);

    if (
      !listingId ||
      !UUID_PATTERN.test(listingId)
    ) {
      return createErrorResponse(
        "معرف العرض غير صحيح",
        400,
        "INVALID_LISTING_ID"
      );
    }

    if (
      Array.from(
        request.nextUrl.searchParams.keys()
      ).length > 0
    ) {
      return createErrorResponse(
        "معاملات الطلب غير صحيحة",
        400,
        "INVALID_QUERY"
      );
    }

    if (
      await hasNonEmptyBody(request)
    ) {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400,
        "INVALID_BODY"
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin.rpc(
      "delete_card_store_listing_for_branch_atomic",
      {
        p_actor_user_id:
          session.userId,
        p_actor_branch_id:
          session.branchId,
        p_listing_id:
          listingId,
      }
    );

    if (error) {
      const mappedError =
        mapDeleteRpcError(error);

      console.error(
        "Card store delete listing RPC failed:",
        {
          code: error.code,
          rpcCode:
            mappedError.code,
        }
      );

      return createErrorResponse(
        mappedError.message,
        mappedError.status,
        mappedError.code
      );
    }

    const result =
      getSingleResult(data);

    if (
      !result ||
      typeof result.out_deleted_listing_id !==
        "string"
    ) {
      console.error(
        "Card store delete listing unexpected RPC result"
      );

      return createErrorResponse(
        "تعذر حذف العرض",
        500,
        "INVALID_RPC_RESULT"
      );
    }

    return createResponse({
      ok: true,
      item: {
        id: result.out_deleted_listing_id,
      },
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
      "Card store listings DELETE error:",
      error
    );

    return createErrorResponse(
      "تعذر حذف العرض",
      500,
      "CARD_STORE_DELETE_FAILED"
    );
  }
}
