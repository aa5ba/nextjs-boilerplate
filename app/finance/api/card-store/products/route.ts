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

type ProductRow = {
  id: string | null;
  product_name: string | null;
};

function cleanText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
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

export async function GET(
  request: NextRequest
) {
  try {
    await requireFinanceBranchSession({
      requiredPermission:
        "card_store",
    });

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

    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "finance_card_store_products"
      )
      .select(
        `
          id,
          product_name
        `
      )
      .eq("is_active", true)
      .eq("is_deleted", false)
      .order("sort_order", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Card store products query failed:",
        {
          message: error.message,
          code: error.code,
        }
      );

      return createErrorResponse(
        "تعذر تحميل منتجات متجر البطاقات",
        500,
        "CARD_STORE_PRODUCTS_QUERY_FAILED"
      );
    }

    const items =
      ((data ?? []) as ProductRow[])
        .map((product) => {
          const id = cleanText(
            product.id
          );

          const name =
            cleanText(
              product.product_name
            );

          if (!id || !name) {
            return null;
          }

          return {
            id,
            name,
          };
        })
        .filter(
          (
            product
          ): product is {
            id: string;
            name: string;
          } => product !== null
        );

    return createResponse({
      ok: true,
      items,
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
      "Card store products GET error:",
      error
    );

    return createErrorResponse(
      "تعذر تحميل منتجات متجر البطاقات",
      500,
      "CARD_STORE_PRODUCTS_FAILED"
    );
  }
}
