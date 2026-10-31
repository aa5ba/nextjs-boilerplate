import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  cleanDigits,
  cleanText,
  createErrorResponse,
  createResponse,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANAGER_ROLES = new Set([
  "main_admin",
  "branch_manager",
  "مدير رئيسي",
  "مدير فرع",
  "مدير",
]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const branch = cleanText(url.searchParams.get("branch")).toLowerCase();
    const nationalId = cleanDigits(url.searchParams.get("nationalId"));

    if (!branch) {
      return createErrorResponse("تعذر تحديد الفرع", 400, "BRANCH_REQUIRED");
    }

    if (!/^\d{10}$/.test(nationalId)) {
      return createErrorResponse(
        "رقم الهوية يجب أن يتكون من 10 أرقام",
        400,
        "INVALID_CUSTOMER_NATIONAL_ID"
      );
    }

    const session = await requireFinanceBranchSession({
      requestedBranchSlug: branch,
    });

    const canCreate =
      MANAGER_ROLES.has(session.user.role) ||
      session.user.permissions.includes("sales_invoice_create") ||
      session.user.permissions.includes("purchase_invoice_create");

    if (!canCreate) {
      return createErrorResponse(
        "لا تملك صلاحية إنشاء فاتورة",
        403,
        "MISSING_PERMISSION"
      );
    }

    const { data: customer, error } = await supabaseAdmin
      .from("finance_customers")
      .select("id,full_name,phone,is_archived")
      .eq("branch_id", session.branchId)
      .eq("national_id", nationalId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!customer) {
      return createResponse({ ok: true, found: false });
    }

    if (customer.is_archived) {
      return createErrorResponse(
        "العميل موجود في الأرشيف؛ أعد تنشيط ملفه قبل إنشاء الفاتورة",
        409,
        "SALES_INVOICE_CUSTOMER_ARCHIVED"
      );
    }

    return createResponse({
      ok: true,
      found: true,
      customer: {
        id: customer.id,
        fullName: cleanText(customer.full_name),
        phone: cleanDigits(customer.phone),
      },
    });
  } catch (error) {
    if (isFinanceBranchSessionError(error)) {
      return createErrorResponse(error.message, error.status, error.code);
    }

    console.error("Sales invoice customer lookup error:", error);
    return createErrorResponse(
      "تعذر التحقق من بيانات العميل",
      500,
      "SALES_INVOICE_CUSTOMER_LOOKUP_FAILED"
    );
  }
}
