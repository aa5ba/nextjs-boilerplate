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
  parseTransactionType,
  type RouteContext,
  UUID_PATTERN,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 25;

type TransactionRow = {
  id: string;
  operation_id: string | null;
  wallet_type: string | null;
  direction: string | null;
  transaction_type: string | null;
  amount: number | string | null;
  balance_before: number | string | null;
  balance_after: number | string | null;
  note: string | null;
  product_id: string | null;
  contract_id: string | null;
  payment_id: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
};

function parseWalletType(
  value: string | null
) {
  const walletType = cleanText(value);

  return walletType === "cash" ||
    walletType === "goods" ||
    walletType === "contracts"
    ? walletType
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
    const walletType = parseWalletType(
      url.searchParams.get(
        "wallet_type"
      )
    );
    const type = parseTransactionType(
      url.searchParams.get("type")
    );
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
          operation_id,
          wallet_type,
          direction,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          note,
          product_id,
          contract_id,
          payment_id,
          created_at,
          metadata
        `,
        { count: "exact" }
      )
      .eq("branch_id", session.branchId)
      .eq("investor_id", investorId)
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(from, to);

    if (walletType) {
      query = query.eq(
        "wallet_type",
        walletType
      );
    }

    if (type) {
      query = query.eq(
        "transaction_type",
        type
      );
    }

    const { data, error, count } =
      await query;

    if (error) {
      return createErrorResponse(
        "تعذر تحميل كشف المحافظ",
        500,
        "WALLETS_STATEMENT_FAILED"
      );
    }

    return createResponse({
      ok: true,
      investor,
      page,
      pageSize: ITEMS_PER_PAGE,
      total: count || 0,
      transactions: ((data || []) as TransactionRow[]).map(
        (row) => ({
          id: row.id,
          operationId: row.operation_id,
          walletType: row.wallet_type,
          direction: row.direction,
          transactionType:
            row.transaction_type,
          amount: Number(row.amount || 0),
          balanceBefore: Number(
            row.balance_before || 0
          ),
          balanceAfter: Number(
            row.balance_after || 0
          ),
          note: row.note,
          productId: row.product_id,
          contractId: row.contract_id,
          paymentId: row.payment_id,
          createdAt: row.created_at,
          metadata: row.metadata ?? {},
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
      "Investor wallets statement error:",
      error
    );

    return createErrorResponse(
      "تعذر تحميل كشف المحافظ",
      500,
      "WALLETS_STATEMENT_FAILED"
    );
  }
}
