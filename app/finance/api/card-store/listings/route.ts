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

const PAGE_SIZE = 15;
const MAX_PAGE = 100_000;
const MAX_OFFSET =
  (MAX_PAGE - 1) * PAGE_SIZE;

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

const MANAGER_ROLES = new Set([
  "main_admin",
  "branch_manager",
  "مدير رئيسي",
  "مدير فرع",
  "مدير",
]);

const ALLOWED_QUERY_KEYS = new Set([
  "listing_type",
  "city_code",
  "page",
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

const FORBIDDEN_CLIENT_KEYS = new Set([
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
]);

const FORBIDDEN_POST_KEYS = new Set([
  ...FORBIDDEN_CLIENT_KEYS,
  "unit_price",
  "product_name_snapshot",
  "published_at",
  "expires_at",
  "card_expiry_month_snapshot",
  "card_expiry_year_snapshot",
  "created_by_user_id",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonBody =
  Record<string, unknown>;

type ListingRow = {
  id: string;
  listing_type: string;
  branch_id: string;
  created_by_user_id: string;
  product_id: string;
  product_name_snapshot: string;
  city_code: string;
  quantity: number;
  total_price: number | string;
  unit_price: number | string;
  contact_phone: string;
  published_at: string;
  expires_at: string;
  card_expiry_month: number | null;
  card_expiry_year: number | null;
};

type BranchRow = {
  id: string;
  branch_name: string | null;
  organization_name: string | null;
};

type RpcResult = {
  out_listing_id?: unknown;
  out_published_at?: unknown;
  out_expires_at?: unknown;
  out_unit_price?: unknown;
};

type SupabaseErrorShape = {
  message?: string;
  code?: string;
};

type RpcErrorInfo = {
  status: number;
  code: string;
  message: string;
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

async function readRequestBody(
  request: Request
): Promise<JsonBody | null> {
  try {
    const parsed: unknown =
      await request.json();

    return isPlainObject(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function hasForbiddenKey(
  keys: Iterable<string>,
  forbiddenKeys: Set<string>
): boolean {
  for (const key of keys) {
    if (forbiddenKeys.has(key)) {
      return true;
    }
  }

  return false;
}

function hasUnsupportedKey(
  keys: Iterable<string>,
  allowedKeys: Set<string>
): boolean {
  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      return true;
    }
  }

  return false;
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

function parsePage(
  value: string | null
): number | null {
  if (value === null) {
    return 1;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const page = Number(value);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > MAX_PAGE
  ) {
    return null;
  }

  const offset =
    (page - 1) * PAGE_SIZE;

  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > MAX_OFFSET
  ) {
    return null;
  }

  return page;
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

function normalizeNullableCardExpiryPart(
  value: number | null,
  min: number,
  max: number
): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
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

function normalizeBranchName(
  branch: BranchRow | undefined
): string | null {
  const branchName =
    cleanText(branch?.branch_name);

  if (branchName) {
    return branchName;
  }

  const organizationName =
    cleanText(
      branch?.organization_name
    );

  return organizationName || null;
}

function isManagerRole(
  role: string
): boolean {
  return MANAGER_ROLES.has(role);
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
    "USER_ALREADY_HAS_ACTIVE_LISTING",
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
          "لا تملك صلاحية تنفيذ هذه العملية",
      };

    case "USER_ALREADY_HAS_ACTIVE_LISTING":
      return {
        status: 409,
        code,
        message:
          "لديك عرض فعال حاليًا في متجر البطاقات",
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
        code: "CARD_STORE_OPERATION_FAILED",
        message:
          "تعذر إتمام العملية",
      };
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    const session =
      await requireFinanceBranchSession({
        requiredPermission:
          "card_store",
      });

    if (
      !session.userId ||
      !session.branchId
    ) {
      return createErrorResponse(
        "تعذر التحقق من جلسة المستخدم",
        401,
        "INVALID_SESSION"
      );
    }

    const searchParams =
      request.nextUrl.searchParams;

    const queryKeys = Array.from(
      searchParams.keys()
    );

    if (
      hasForbiddenKey(
        queryKeys,
        FORBIDDEN_CLIENT_KEYS
      ) ||
      hasUnsupportedKey(
        queryKeys,
        ALLOWED_QUERY_KEYS
      )
    ) {
      return createErrorResponse(
        "معاملات الطلب غير صحيحة",
        400,
        "INVALID_QUERY"
      );
    }

    const listingType =
      parseListingType(
        searchParams.get(
          "listing_type"
        )
      );

    if (!listingType) {
      return createErrorResponse(
        "نوع العرض غير صحيح",
        400,
        "INVALID_LISTING_TYPE"
      );
    }

    const rawCityCode =
      searchParams.get(
        "city_code"
      );

    const cityCode =
      rawCityCode === null
        ? null
        : parseCityCode(
            rawCityCode
          );

    if (
      rawCityCode !== null &&
      !cityCode
    ) {
      return createErrorResponse(
        "المدينة غير صحيحة",
        400,
        "INVALID_CITY"
      );
    }

    const page =
      parsePage(
        searchParams.get("page")
      );

    if (page === null) {
      return createErrorResponse(
        "رقم الصفحة غير صحيح",
        400,
        "INVALID_PAGE"
      );
    }

    const offset =
      (page - 1) * PAGE_SIZE;

    const nowIso =
      new Date().toISOString();

    let query =
      supabaseAdmin
        .from(
          "finance_card_store_listings"
        )
        .select(
          `
            id,
            listing_type,
            branch_id,
            created_by_user_id,
            product_id,
            product_name_snapshot,
            city_code,
            quantity,
            total_price,
            unit_price,
            contact_phone,
            published_at,
            expires_at,
            card_expiry_month,
            card_expiry_year
          `,
          {
            count: "exact",
          }
        )
        .eq(
          "listing_type",
          listingType
        )
        .gt(
          "expires_at",
          nowIso
        );

    if (cityCode) {
      query = query.eq(
        "city_code",
        cityCode
      );
    }

    const {
      data,
      error,
      count,
    } = await query
      .order("published_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(
        offset,
        offset + PAGE_SIZE - 1
      );

    if (error) {
      console.error(
        "Card store listings query failed:",
        {
          message: error.message,
          code: error.code,
        }
      );

      return createErrorResponse(
        "تعذر تحميل عروض متجر البطاقات",
        500,
        "CARD_STORE_LISTINGS_QUERY_FAILED"
      );
    }

    const rows =
      (data ?? []) as ListingRow[];

    const branchIds =
      Array.from(
        new Set(
          rows
            .map((row) => row.branch_id)
            .filter(Boolean)
        )
      );

    const branchMap = new Map<
      string,
      BranchRow
    >();

    if (branchIds.length > 0) {
      const {
        data: branches,
        error: branchesError,
      } = await supabaseAdmin
        .from("finance_branches")
        .select(
          `
            id,
            branch_name,
            organization_name
          `
        )
        .in("id", branchIds);

      if (branchesError) {
        console.error(
          "Card store branch names query failed:",
          {
            message:
              branchesError.message,
            code: branchesError.code,
          }
        );

        return createErrorResponse(
          "تعذر تحميل بيانات الفروع",
          500,
          "CARD_STORE_BRANCHES_QUERY_FAILED"
        );
      }

      for (const branch of
        (branches ?? []) as BranchRow[]) {
        branchMap.set(
          branch.id,
          branch
        );
      }
    }

    const isCurrentUserManager =
      isManagerRole(session.user.role);

    const items = rows.map((row) => ({
      id: row.id,
      listing_type: row.listing_type,
      product_id: row.product_id,
      product_name_snapshot:
        row.product_name_snapshot,
      city_code: row.city_code,
      quantity: row.quantity,
      total_price: row.total_price,
      unit_price: row.unit_price,
      contact_phone: row.contact_phone,
      published_at: row.published_at,
      expires_at: row.expires_at,
      card_expiry_month:
        normalizeNullableCardExpiryPart(
          row.card_expiry_month,
          1,
          12
        ),
      card_expiry_year:
        normalizeNullableCardExpiryPart(
          row.card_expiry_year,
          2000,
          9999
        ),
      branch_name:
        normalizeBranchName(
          branchMap.get(
            row.branch_id
          )
        ),
      can_edit:
        row.branch_id ===
          session.branchId &&
        (row.created_by_user_id ===
          session.userId ||
          isCurrentUserManager),
      can_delete:
        row.branch_id ===
          session.branchId &&
        (row.created_by_user_id ===
          session.userId ||
          isCurrentUserManager),
      can_complete:
        row.branch_id ===
          session.branchId &&
        (row.created_by_user_id ===
          session.userId ||
          isCurrentUserManager),
    }));

    const total =
      count ?? 0;

    const totalPages =
      total > 0
        ? Math.ceil(
            total / PAGE_SIZE
          )
        : 0;

    return createResponse({
      ok: true,
      items,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext:
          page < totalPages,
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
      "Card store listings GET error:",
      error
    );

    return createErrorResponse(
      "تعذر إتمام العملية",
      500,
      "CARD_STORE_LISTINGS_FAILED"
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const session =
      await requireFinanceBranchSession({
        requiredPermission:
          "card_store",
      });

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

    if (
      hasForbiddenKey(
        bodyKeys,
        FORBIDDEN_POST_KEYS
      )
    ) {
      return createErrorResponse(
        "لا يمكن تمرير بيانات الهوية أو حقول داخلية من العميل",
        400,
        "FORBIDDEN_CLIENT_FIELD"
      );
    }

    if (
      hasUnsupportedKey(
        bodyKeys,
        ALLOWED_BODY_KEYS
      )
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
      "create_card_store_listing_for_branch_atomic",
      {
        p_actor_user_id:
          session.userId,
        p_actor_branch_id:
          session.branchId,
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
        "Card store create listing RPC failed:",
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
        "string" ||
      typeof result.out_published_at !==
        "string" ||
      typeof result.out_expires_at !==
        "string"
    ) {
      console.error(
        "Card store create listing unexpected RPC result"
      );

      return createErrorResponse(
        "تعذر إتمام العملية",
        500,
        "INVALID_RPC_RESULT"
      );
    }

    return createResponse(
      {
        ok: true,
        item: {
          id: result.out_listing_id,
          published_at:
            result.out_published_at,
          expires_at:
            result.out_expires_at,
          unit_price:
            result.out_unit_price ??
            null,
        },
      },
      201
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
      "Card store listings POST error:",
      error
    );

    return createErrorResponse(
      "تعذر إتمام العملية",
      500,
      "CARD_STORE_CREATE_FAILED"
    );
  }
}
