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
  mapWalletRpcError,
  type RouteContext,
  UUID_PATTERN,
} from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SummaryRow = {
  goods_products_count?: unknown;
  goods_total_quantity?: unknown;
  goods_total_value?: unknown;
  goods_uninitialized_count?: unknown;
  goods_last_movement_at?: unknown;
};

function firstRow(
  data: unknown
): SummaryRow | null {
  if (Array.isArray(data)) {
    return (
      (data[0] as SummaryRow | undefined) ??
      null
    );
  }

  return data &&
    typeof data === "object"
    ? (data as SummaryRow)
    : null;
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { id: investorId } =
      await context.params;

    if (!UUID_PATTERN.test(investorId)) {
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
        requestedBranchSlug: branch,
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

    const { data, error } =
      await supabaseAdmin.rpc(
        "get_investor_wallets_summary_secure",
        {
          p_branch_id:
            session.branchId,
          p_investor_id:
            investorId,
          p_actor_user_id:
            session.userId,
        }
      );

    if (error) {
      const mapped =
        mapWalletRpcError(
          error.message || ""
        );

      return createErrorResponse(
        mapped.message,
        mapped.status,
        mapped.code
      );
    }

    const row = firstRow(data);

    return createResponse({
      ok: true,
      investor,
      summary: {
        productsCount: Number(
          row?.goods_products_count ?? 0
        ),
        totalQuantity: Number(
          row?.goods_total_quantity ?? 0
        ),
        totalValue: Number(
          row?.goods_total_value ?? 0
        ),
        uninitializedCount: Number(
          row?.goods_uninitialized_count ??
            0
        ),
        lastMovementAt:
          row?.goods_last_movement_at ??
          null,
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
      "Investor goods summary error:",
      error
    );

    return createErrorResponse(
      "تعذر تحميل ملخص محفظة السلع",
      500,
      "GOODS_SUMMARY_FAILED"
    );
  }
}
