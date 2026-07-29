import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  cleanText,
  createErrorResponse,
  createResponse,
  getInvestorForSession,
  parsePage,
  type RouteContext,
  UUID_PATTERN,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 25;

type ProductRelation =
  | {
      product_name?: string | null;
      product_category?: string | null;
      is_active?: boolean | null;
    }
  | {
      product_name?: string | null;
      product_category?: string | null;
      is_active?: boolean | null;
    }[]
  | null;

type InventoryRow = {
  id: string;
  product_id: string | null;
  quantity: number | string | null;
  average_unit_cost: number | string | null;
  total_cost_value: number | string | null;
  cost_initialized_at: string | null;
  updated_at: string | null;
  finance_products?: ProductRelation;
};

function getProduct(
  relation: ProductRelation
) {
  return Array.isArray(relation)
    ? relation[0] ?? null
    : relation;
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { id: investorId } =
      await context.params;

    if (
      !UUID_PATTERN.test(
        investorId
      )
    ) {
      return createErrorResponse(
        "معرف المستثمر غير صحيح",
        400,
        "INVALID_INVESTOR_ID"
      );
    }

    const url = new URL(
      request.url
    );

    const branch =
      cleanText(
        url.searchParams.get(
          "branch"
        )
      ).toLowerCase();

    if (!branch) {
      return createErrorResponse(
        "تعذر تحديد الفرع",
        400,
        "BRANCH_REQUIRED"
      );
    }

    const session =
      await requireFinanceBranchSession({
        requestedBranchSlug:
          branch,
        requiredPermission:
          "view_investor_wallets",
      });

    const investor =
      await getInvestorForSession(
        session,
        investorId
      );

    if (!investor) {
      return createErrorResponse(
        "المستثمر غير موجود أو لا يتبع هذا الفرع",
        404,
        "INVESTOR_NOT_FOUND"
      );
    }

    const page = parsePage(
      url.searchParams.get("page")
    );
    const from =
      (page - 1) * ITEMS_PER_PAGE;
    const to =
      from + ITEMS_PER_PAGE - 1;

    const { data, error, count } =
      await supabaseAdmin
        .from("finance_inventory")
        .select(
          `
            id,
            product_id,
            quantity,
            average_unit_cost,
            total_cost_value,
            cost_initialized_at,
            updated_at,
            finance_products(
              product_name,
              product_category,
              is_active
            )
          `,
          {
            count: "exact",
          }
        )
        .eq("branch_id", session.branchId)
        .eq("investor_id", investorId)
        .order("updated_at", {
          ascending: false,
        })
        .range(from, to);

    if (error) {
      return createErrorResponse(
        "تعذر تحميل محفظة السلع",
        500,
        "GOODS_WALLET_FAILED"
      );
    }

    return createResponse({
      ok: true,
      investor,
      page,
      pageSize: ITEMS_PER_PAGE,
      total: count || 0,
      items:
        ((data || []) as InventoryRow[]).map(
          (item) => {
            const product = getProduct(
              item.finance_products ?? null
            );

            return {
              id: item.id,
              productId:
                item.product_id,
              productName:
                product?.product_name ??
                "-",
              productCategory:
                product?.product_category ??
                "-",
              productActive:
                product?.is_active !==
                false,
              quantity:
                Number(
                  item.quantity || 0
                ),
              averageUnitCost:
                item.average_unit_cost ===
                  null ||
                item.average_unit_cost ===
                  undefined
                  ? null
                  : Number(
                      item.average_unit_cost
                    ),
              totalCostValue:
                Number(
                  item.total_cost_value ||
                    0
                ),
              costInitialized:
                Boolean(
                  item.cost_initialized_at
                ),
              costInitializedAt:
                item.cost_initialized_at,
              updatedAt:
                item.updated_at,
            };
          }
        ),
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
      "Investor goods wallet error:",
      error
    );

    return createErrorResponse(
      "تعذر تحميل محفظة السلع",
      500,
      "GOODS_WALLET_FAILED"
    );
  }
}
