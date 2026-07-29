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
  parsePositiveAmount,
  readJsonBody,
  type RouteContext,
  UUID_PATTERN,
} from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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

    const body =
      await readJsonBody(request);

    if (!body) {
      return createErrorResponse(
        "بيانات العملية غير صحيحة",
        400,
        "INVALID_BODY"
      );
    }

    const branch = cleanText(
      body.branch
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
          "adjust_investor_goods_quantity",
      });

    const productId = cleanText(
      body.productId
    );
    const quantity =
      parsePositiveAmount(body.quantity);
    const reason = cleanText(
      body.reason
    );

    if (!UUID_PATTERN.test(productId)) {
      return createErrorResponse(
        "معرف المنتج غير صحيح",
        400,
        "INVALID_PRODUCT_ID"
      );
    }

    if (!quantity) {
      return createErrorResponse(
        "أدخل كمية صحيحة",
        400,
        "INVALID_QUANTITY"
      );
    }

    if (!reason) {
      return createErrorResponse(
        "سبب التعديل مطلوب",
        400,
        "REASON_REQUIRED"
      );
    }

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
        "decrease_investor_goods_secure_atomic",
        {
          p_branch_id:
            session.branchId,
          p_actor_user_id:
            session.userId,
          p_investor_id:
            investorId,
          p_product_id:
            productId,
          p_quantity:
            quantity,
          p_reason:
            reason,
          p_idempotency_key:
            crypto.randomUUID(),
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

    return createResponse({
      ok: true,
      message:
        "تم تخفيض كمية السلع",
      result: Array.isArray(data)
        ? data[0] ?? null
        : data ?? null,
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
      "Investor goods decrease error:",
      error
    );

    return createErrorResponse(
      "تعذر تنفيذ تخفيض السلع",
      500,
      "GOODS_DECREASE_FAILED"
    );
  }
}
