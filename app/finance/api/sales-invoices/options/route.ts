import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  cleanText,
  createErrorResponse,
  createResponse,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InventoryOptionRow = {
  id: string;
  investor_id: string;
  product_id: string;
  quantity: number | string | null;
  average_unit_cost: number | string | null;
  total_cost_value: number | string | null;
  finance_products: { product_name?: string | null } | Array<{ product_name?: string | null }> | null;
  finance_investors: { investor_name?: string | null } | Array<{ investor_name?: string | null }> | null;
};

const MANAGER_ROLES = new Set([
  "main_admin",
  "branch_manager",
  "مدير رئيسي",
  "مدير فرع",
  "مدير",
]);

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const branch = cleanText(url.searchParams.get("branch")).toLowerCase();

    if (!branch) {
      return createErrorResponse("تعذر تحديد الفرع", 400, "BRANCH_REQUIRED");
    }

    const session = await requireFinanceBranchSession({
      requestedBranchSlug: branch,
    });

    const canCreate =
      MANAGER_ROLES.has(session.user.role) ||
      session.user.permissions.includes("sales_invoice_create") ||
      session.user.permissions.includes("purchase_invoice_create");

    if (!canCreate) {
      return createErrorResponse("لا تملك صلاحية إنشاء فاتورة", 403, "MISSING_PERMISSION");
    }

    const { data: inventoryRows, error: inventoryError } = await supabaseAdmin
      .from("finance_inventory")
      .select(
        "id,investor_id,product_id,quantity,average_unit_cost,total_cost_value,finance_products!inner(product_name,is_active),finance_investors!inner(investor_name,is_active,is_archived)"
      )
      .eq("branch_id", session.branchId)
      .eq("finance_products.is_active", true)
      .eq("finance_investors.is_active", true)
      .eq("finance_investors.is_archived", false)
      .order("created_at", { ascending: true });

    if (inventoryError) throw new Error(inventoryError.message);

    const rows = (inventoryRows ?? []) as unknown as InventoryOptionRow[];
    const investorIds = Array.from(new Set(rows.map((row) => row.investor_id)));
    const goodsWalletBalances = new Map<string, number>();
    const cashWalletBalances = new Map<string, number>();

    if (investorIds.length > 0) {
      const { data: wallets, error: walletsError } = await supabaseAdmin
        .from("finance_investor_wallets")
        .select("investor_id,wallet_type,balance_amount")
        .eq("branch_id", session.branchId)
        .in("wallet_type", ["goods", "cash"])
        .in("investor_id", investorIds);

      if (walletsError) throw new Error(walletsError.message);

      for (const wallet of wallets ?? []) {
        const balances = wallet.wallet_type === "cash" ? cashWalletBalances : goodsWalletBalances;
        balances.set(String(wallet.investor_id), Number(wallet.balance_amount || 0));
      }
    }

    const options = rows.map((row) => {
      const product = firstRelation(row.finance_products);
      const investor = firstRelation(row.finance_investors);

      return {
        inventoryId: row.id,
        productId: row.product_id,
        productName: product?.product_name || "سلعة بدون اسم",
        investorId: row.investor_id,
        investorName: investor?.investor_name || "مستثمر بدون اسم",
        availableQuantity: Number(row.quantity || 0),
        averageUnitCost: Number(row.average_unit_cost || 0),
        totalCostValue: Number(row.total_cost_value || 0),
        goodsWalletBalance: goodsWalletBalances.get(row.investor_id) ?? 0,
        cashWalletBalance: cashWalletBalances.get(row.investor_id) ?? 0,
      };
    });

    return createResponse({
      ok: true,
      organizationName: session.branch.organizationName || session.branch.name || "احتساب",
      options,
    });
  } catch (error) {
    if (isFinanceBranchSessionError(error)) {
      return createErrorResponse(error.message, error.status, error.code);
    }

    console.error("Sales invoice options error:", error);
    return createErrorResponse(
      "تعذر تحميل السلع المتاحة",
      500,
      "SALES_INVOICE_OPTIONS_FAILED"
    );
  }
}
