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
  type RouteContext,
  UUID_PATTERN,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CashTransactionRow = {
  id: string;
  direction: string | null;
  amount: number | string | null;
  transaction_type: string | null;
  note: string | null;
  actor_user_name: string | null;
  created_at: string | null;
};

type InventoryMovementRow = {
  id: string;
  movement_type: string | null;
  quantity: number | string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  finance_products:
    | {
        product_name?: string | null;
      }
    | {
        product_name?: string | null;
      }[]
    | null;
};

type ContractRow = {
  id: string;
  contract_number: number | string | null;
  customer_name: string | null;
  contract_type: string | null;
  debt_amount: number | string | null;
  created_by: string | null;
  created_at: string | null;
};

type RecentOperation = {
  sourceType: "cash" | "goods" | "contract";
  operationType: string;
  title: string;
  description: string;
  amount: number | null;
  quantity: number | null;
  actorName: string | null;
  createdAt: string | null;
  referenceId: string;
};

function getProductName(
  relation: InventoryMovementRow["finance_products"]
) {
  const product = Array.isArray(relation)
    ? relation[0] ?? null
    : relation;

  return product?.product_name || "منتج";
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

    const [
      cashResult,
      goodsResult,
      contractsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from(
          "finance_investor_wallet_transactions"
        )
        .select(
          "id,direction,amount,transaction_type,note,actor_user_name,created_at"
        )
        .eq("branch_id", session.branchId)
        .eq("investor_id", investorId)
        .eq("wallet_type", "cash")
        .order("created_at", {
          ascending: false,
        })
        .limit(10),
      supabaseAdmin
        .from(
          "finance_inventory_movements"
        )
        .select(
          `
            id,
            movement_type,
            quantity,
            notes,
            created_by,
            created_at,
            finance_products(product_name)
          `
        )
        .eq("branch_id", session.branchId)
        .eq("investor_id", investorId)
        .order("created_at", {
          ascending: false,
        })
        .limit(10),
      supabaseAdmin
        .from("finance_contracts")
        .select(
          "id,contract_number,customer_name,contract_type,debt_amount,created_by,created_at"
        )
        .eq("branch_id", session.branchId)
        .eq("investor_id", investorId)
        .or(
          "is_archived.is.null,is_archived.eq.false"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(10),
    ]);

    if (
      cashResult.error ||
      goodsResult.error ||
      contractsResult.error
    ) {
      return createErrorResponse(
        "تعذر تحميل آخر العمليات",
        500,
        "RECENT_OPERATIONS_FAILED"
      );
    }

    const cashOperations: RecentOperation[] =
      ((cashResult.data ||
        []) as CashTransactionRow[]).map(
        (item) => ({
          sourceType: "cash",
          operationType:
            item.transaction_type || "-",
          title:
            item.transaction_type ===
            "cash_withdrawal"
              ? "سحب رصيد نقدي"
              : "إضافة رصيد نقدي",
          description:
            item.note || "حركة محفظة نقدية",
          amount: Number(
            item.amount || 0
          ),
          quantity: null,
          actorName:
            item.actor_user_name,
          createdAt:
            item.created_at,
          referenceId: item.id,
        })
      );

    const goodsOperations: RecentOperation[] =
      ((goodsResult.data ||
        []) as InventoryMovementRow[]).map(
        (item) => ({
          sourceType: "goods",
          operationType:
            item.movement_type || "-",
          title: `حركة سلع - ${getProductName(
            item.finance_products
          )}`,
          description:
            item.notes || "حركة مخزون",
          amount: null,
          quantity: Number(
            item.quantity || 0
          ),
          actorName:
            item.created_by,
          createdAt:
            item.created_at,
          referenceId: item.id,
        })
      );

    const contractOperations: RecentOperation[] =
      ((contractsResult.data ||
        []) as ContractRow[]).map(
        (item) => ({
          sourceType: "contract",
          operationType: "contract_created",
          title: `عقد رقم ${item.contract_number || "-"}`,
          description:
            `${item.contract_type || "عقد"} - ${
              item.customer_name || "-"
            }`,
          amount: Number(
            item.debt_amount || 0
          ),
          quantity: null,
          actorName:
            item.created_by,
          createdAt:
            item.created_at,
          referenceId: item.id,
        })
      );

    const operations = [
      ...cashOperations,
      ...goodsOperations,
      ...contractOperations,
    ]
      .sort(
        (a, b) =>
          new Date(
            b.createdAt || 0
          ).getTime() -
          new Date(
            a.createdAt || 0
          ).getTime()
      )
      .slice(0, 10);

    return createResponse({
      ok: true,
      operations,
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
      "Investor recent operations error:",
      error
    );

    return createErrorResponse(
      "تعذر تحميل آخر العمليات",
      500,
      "RECENT_OPERATIONS_FAILED"
    );
  }
}
