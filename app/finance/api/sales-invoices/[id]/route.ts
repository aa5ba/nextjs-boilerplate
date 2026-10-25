import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  cleanText,
  createErrorResponse,
  createResponse,
  mapSalesInvoiceRpcError,
  readJsonBody,
  type SalesInvoiceRouteContext,
  UUID_PATTERN,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICE_SELECT =
  "id,branch_id,customer_id,invoice_number,invoice_date,organization_name,customer_name,customer_national_id,customer_phone,inventory_id,product_id,product_name,investor_id,investor_name,quantity,total_amount,payment_method,operation_type,sale_unit_cost,sale_total_cost,status,created_by_user_id,created_by_name,created_at,updated_at,inventory_quantity_after_sale,goods_balance_after_sale,cash_balance_after_operation,cancellation_reason,cancelled_at,cancelled_by_user_id,cancelled_by_name,inventory_quantity_after_cancellation,goods_balance_after_cancellation,cash_balance_after_cancellation";

export async function GET(
  request: Request,
  context: SalesInvoiceRouteContext
) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const branch = cleanText(url.searchParams.get("branch")).toLowerCase();
    const mode = cleanText(url.searchParams.get("mode"));

    if (!UUID_PATTERN.test(id)) {
      return createErrorResponse("معرف الفاتورة غير صحيح", 400, "INVALID_INVOICE_ID");
    }

    if (!branch) {
      return createErrorResponse("تعذر تحديد الفرع", 400, "BRANCH_REQUIRED");
    }

    const session = await requireFinanceBranchSession({
      requestedBranchSlug: branch,
      requiredPermission: mode === "print" ? "sales_invoice_print" : "sales_invoice_view",
    });

    const { data, error } = await supabaseAdmin
      .from("finance_sales_invoices")
      .select(INVOICE_SELECT)
      .eq("id", id)
      .eq("branch_id", session.branchId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      return createErrorResponse(
        "الفاتورة غير موجودة في هذا الفرع",
        404,
        "SALES_INVOICE_NOT_FOUND"
      );
    }

    return createResponse({ ok: true, invoice: data });
  } catch (error) {
    if (isFinanceBranchSessionError(error)) {
      return createErrorResponse(error.message, error.status, error.code);
    }

    console.error("Sales invoice detail error:", error);
    return createErrorResponse(
      "تعذر تحميل الفاتورة",
      500,
      "SALES_INVOICE_LOAD_FAILED"
    );
  }
}

export async function PATCH(
  request: Request,
  context: SalesInvoiceRouteContext
) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody(request);

    if (!UUID_PATTERN.test(id)) {
      return createErrorResponse("معرف الفاتورة غير صحيح", 400, "INVALID_INVOICE_ID");
    }

    if (!body) {
      return createErrorResponse("بيانات الإلغاء غير صحيحة", 400, "INVALID_BODY");
    }

    const branch = cleanText(body.branch).toLowerCase();
    const cancellationRequestId = cleanText(body.cancellationRequestId);
    const reason = cleanText(body.reason);

    if (!branch) {
      return createErrorResponse("تعذر تحديد الفرع", 400, "BRANCH_REQUIRED");
    }

    const session = await requireFinanceBranchSession({
      requestedBranchSlug: branch,
      requiredPermission: "sales_invoice_cancel",
    });

    if (!UUID_PATTERN.test(cancellationRequestId)) {
      return createErrorResponse(
        "معرف محاولة الإلغاء غير صحيح",
        400,
        "INVALID_CANCELLATION_REQUEST_ID"
      );
    }

    if (!reason || reason.length > 500) {
      return createErrorResponse("سبب الإلغاء مطلوب", 400, "CANCELLATION_REASON_REQUIRED");
    }

    const { data, error } = await supabaseAdmin.rpc("cancel_purchase_sale_invoice_atomic", {
      p_branch_id: session.branchId,
      p_actor_user_id: session.userId,
      p_invoice_id: id,
      p_cancellation_request_id: cancellationRequestId,
      p_reason: reason,
    });

    if (error) {
      const mapped = mapSalesInvoiceRpcError(error.message || "");
      return createErrorResponse(mapped.message, mapped.status, mapped.code);
    }

    const result = Array.isArray(data) ? data[0] ?? null : data ?? null;

    return createResponse({
      ok: true,
      message: result?.was_cancelled === false
        ? "تم استرجاع نتيجة الإلغاء السابقة"
        : "تم إلغاء الفاتورة وعكس حركاتها بنجاح",
      result,
    });
  } catch (error) {
    if (isFinanceBranchSessionError(error)) {
      return createErrorResponse(error.message, error.status, error.code);
    }

    console.error("Sales invoice cancellation error:", error);
    return createErrorResponse(
      "تعذر إلغاء الفاتورة",
      500,
      "SALES_INVOICE_CANCEL_FAILED"
    );
  }
}
