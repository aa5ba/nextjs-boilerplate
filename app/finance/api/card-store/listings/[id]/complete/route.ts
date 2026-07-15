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

type RpcResult = {
  out_deal_id?: unknown;
  out_source_listing_id?: unknown;
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

function createResponse(
  body: JsonBody,
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
    "INVALID_BRANCH",
    "DEAL_ALREADY_COMPLETED",
    "LISTING_DELETE_FAILED",
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
          "لا تملك صلاحية إتمام هذه الصفقة",
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
          "انتهت صلاحية العرض",
      };

    case "DEAL_ALREADY_COMPLETED":
      return {
        status: 409,
        code,
        message:
          "تم إتمام هذه الصفقة مسبقًا",
      };

    case "INVALID_BRANCH":
    case "LISTING_DELETE_FAILED":
      return {
        status: 409,
        code,
        message:
          "لا يمكن إتمام الصفقة في حالة العرض الحالية",
      };

    default:
      return {
        status: 500,
        code: "CARD_STORE_COMPLETE_FAILED",
        message:
          "تعذر إتمام الصفقة",
      };
  }
}

export async function POST(
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
      "complete_card_store_deal_for_branch_atomic",
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
        mapRpcError(error);

      console.error(
        "Card store complete deal RPC failed:",
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
      typeof result.out_deal_id !==
        "string" ||
      typeof result.out_source_listing_id !==
        "string"
    ) {
      console.error(
        "Card store complete deal unexpected RPC result"
      );

      return createErrorResponse(
        "تعذر إتمام الصفقة",
        500,
        "INVALID_RPC_RESULT"
      );
    }

    return createResponse({
      ok: true,
      item: {
        deal_id: result.out_deal_id,
        listing_id:
          result.out_source_listing_id,
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
      "Card store complete deal error:",
      error
    );

    return createErrorResponse(
      "تعذر إتمام الصفقة",
      500,
      "CARD_STORE_COMPLETE_FAILED"
    );
  }
}
