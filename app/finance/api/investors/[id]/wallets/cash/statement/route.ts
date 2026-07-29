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
  parseDateFilter,
  parsePage,
  parseTransactionType,
  type RouteContext,
  UUID_PATTERN,
} from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 25;

type TransactionRow = {
  id: string;
  direction: string | null;
  amount: number | string | null;
  balance_before: number | string | null;
  balance_after: number | string | null;
  transaction_type: string | null;
  note: string | null;
  actor_user_name: string | null;
  created_at: string | null;
};

type SummaryRow = {
  cash_balance?: unknown;
  cash_total_deposits?: unknown;
  cash_total_withdrawals?: unknown;
  cash_transactions_count?: unknown;
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
          "view_investor_wallet_statements",
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
    const fromDate =
      parseDateFilter(
        url.searchParams.get("from")
      );
    const toDate =
      parseDateFilter(
        url.searchParams.get("to")
      );
    const transactionType =
      parseTransactionType(
        url.searchParams.get("type")
      );
    const search =
      cleanText(
        url.searchParams.get("search")
      ).slice(0, 80);

    const from =
      (page - 1) * ITEMS_PER_PAGE;
    const to =
      from + ITEMS_PER_PAGE - 1;

    let query = supabaseAdmin
      .from(
        "finance_investor_wallet_transactions"
      )
      .select(
        `
          id,
          direction,
          amount,
          balance_before,
          balance_after,
          transaction_type,
          note,
          actor_user_name,
          created_at
        `,
        {
          count: "exact",
        }
      )
      .eq("branch_id", session.branchId)
      .eq("investor_id", investorId)
      .eq("wallet_type", "cash")
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(from, to);

    if (fromDate) {
      query = query.gte(
        "created_at",
        `${fromDate}T00:00:00`
      );
    }

    if (toDate) {
      query = query.lte(
        "created_at",
        `${toDate}T23:59:59`
      );
    }

    if (transactionType) {
      query = query.eq(
        "transaction_type",
        transactionType
      );
    }

    if (search) {
      query = query.or(
        [
          `note.ilike.%${search}%`,
          `actor_user_name.ilike.%${search}%`,
        ].join(",")
      );
    }

    const [
      transactionsResult,
      summaryResult,
    ] = await Promise.all([
      query,
      supabaseAdmin.rpc(
        "get_investor_wallets_summary_secure",
        {
          p_branch_id:
            session.branchId,
          p_investor_id:
            investorId,
          p_actor_user_id:
            session.userId,
        }
      ),
    ]);

    if (transactionsResult.error) {
      return createErrorResponse(
        "تعذر تحميل كشف المحفظة",
        500,
        "CASH_STATEMENT_FAILED"
      );
    }

    if (summaryResult.error) {
      const mapped =
        mapWalletRpcError(
          summaryResult.error
            .message || ""
        );

      return createErrorResponse(
        mapped.message,
        mapped.status,
        mapped.code
      );
    }

    const summary = firstRow(
      summaryResult.data
    );

    return createResponse({
      ok: true,
      investor,
      page,
      pageSize: ITEMS_PER_PAGE,
      total:
        transactionsResult.count || 0,
      summary: {
        balance:
          Number(
            summary?.cash_balance ?? 0
          ),
        totalDeposits:
          Number(
            summary?.cash_total_deposits ??
              0
          ),
        totalWithdrawals:
          Number(
            summary?.cash_total_withdrawals ??
              0
          ),
        transactionsCount:
          Number(
            summary?.cash_transactions_count ??
              0
          ),
      },
      transactions:
        ((transactionsResult.data ||
          []) as TransactionRow[]).map(
          (transaction) => ({
            id: transaction.id,
            direction:
              transaction.direction,
            amount:
              Number(
                transaction.amount || 0
              ),
            balanceBefore:
              Number(
                transaction.balance_before ||
                  0
              ),
            balanceAfter:
              Number(
                transaction.balance_after ||
                  0
              ),
            transactionType:
              transaction.transaction_type,
            note: transaction.note,
            actorName:
              transaction.actor_user_name,
            createdAt:
              transaction.created_at,
          })
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
      "Investor cash statement error:",
      error
    );

    return createErrorResponse(
      "تعذر تحميل كشف المحفظة",
      500,
      "CASH_STATEMENT_FAILED"
    );
  }
}
