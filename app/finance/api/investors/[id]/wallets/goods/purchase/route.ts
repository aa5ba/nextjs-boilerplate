import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  cleanText,
  createErrorResponse,
  createResponse,
  getActorName,
  getInvestorForSession,
  mapWalletRpcError,
  parsePositiveAmount,
  readJsonBody,
  type RouteContext,
  UUID_PATTERN,
} from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idempotencyKey() {
  return crypto.randomUUID();
}

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
          "purchase_investor_goods",
      });

    const productId = cleanText(
      body.productId
    );
    const quantity =
      parsePositiveAmount(body.quantity);
    const unitCost =
      parsePositiveAmount(
        body.investorUnitCost
      );
    const note = cleanText(body.note);

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

    if (!unitCost) {
      return createErrorResponse(
        "أدخل تكلفة وحدة صحيحة",
        400,
        "INVALID_UNIT_COST"
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
        "purchase_investor_goods_secure_atomic",
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
          p_investor_unit_cost:
            unitCost,
          p_note:
            note || null,
          p_idempotency_key:
            idempotencyKey(),
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
        "تم شراء وإضافة السلع للمستثمر",
      result: Array.isArray(data)
        ? data[0] ?? null
        : data ?? null,
      actorName: getActorName(session),
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
      "Investor goods purchase error:",
      error
    );

    return createErrorResponse(
      "تعذر تنفيذ عملية شراء السلع",
      500,
      "GOODS_PURCHASE_FAILED"
    );
  }
}
