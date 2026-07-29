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
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SummaryRow = {
  cash_balance?: unknown;
  cash_total_deposits?: unknown;
  cash_total_withdrawals?: unknown;
  cash_transactions_count?: unknown;
  cash_last_transaction_at?: unknown;
  goods_products_count?: unknown;
  goods_total_quantity?: unknown;
  goods_total_value?: unknown;
  goods_uninitialized_count?: unknown;
  goods_last_movement_at?: unknown;
  contracts_count?: unknown;
  contracts_balance?: unknown;
  contracts_total_debt?: unknown;
  contracts_total_paid?: unknown;
  contracts_total_remaining?: unknown;
  contracts_last_created_at?: unknown;
  contracts_last_transaction_at?: unknown;
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

    const {
      data,
      error,
    } = await supabaseAdmin.rpc(
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
        cash: {
          balance:
            Number(
              row?.cash_balance ?? 0
            ),
          totalDeposits:
            Number(
              row?.cash_total_deposits ??
                0
            ),
          totalWithdrawals:
            Number(
              row?.cash_total_withdrawals ??
                0
            ),
          transactionsCount:
            Number(
              row?.cash_transactions_count ??
                0
            ),
          lastTransactionAt:
            row?.cash_last_transaction_at ??
            null,
        },
        goods: {
          productsCount:
            Number(
              row?.goods_products_count ??
                0
            ),
          totalQuantity:
            Number(
              row?.goods_total_quantity ??
                0
            ),
          totalValue:
            Number(
              row?.goods_total_value ??
                0
            ),
          uninitializedCount:
            Number(
              row?.goods_uninitialized_count ??
                0
            ),
          lastMovementAt:
            row?.goods_last_movement_at ??
            null,
        },
        contracts: {
          count:
            Number(
              row?.contracts_count ?? 0
            ),
          balance:
            Number(
              row?.contracts_balance ??
                0
            ),
          totalDebt:
            Number(
              row?.contracts_total_debt ??
                0
            ),
          totalPaid:
            Number(
              row?.contracts_total_paid ??
                0
            ),
          totalRemaining:
            Number(
              row?.contracts_total_remaining ??
                0
            ),
          lastCreatedAt:
            row?.contracts_last_created_at ??
            null,
          lastTransactionAt:
            row?.contracts_last_transaction_at ??
            null,
        },
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
      "Investor wallets summary error:",
      error
    );

    return createErrorResponse(
      "تعذر تحميل ملخص المحافظ",
      500,
      "WALLETS_SUMMARY_FAILED"
    );
  }
}
