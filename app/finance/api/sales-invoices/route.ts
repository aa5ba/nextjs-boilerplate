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
  INVOICE_OPERATION_TYPES,
  mapSalesInvoiceRpcError,
  PAYMENT_METHODS,
  parsePositiveNumber,
  readJsonBody,
  UUID_PATTERN,
} from "./_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const branch = cleanText(url.searchParams.get("branch")).toLowerCase();

    if (!branch) {
      return createErrorResponse("تعذر تحديد الفرع", 400, "BRANCH_REQUIRED");
    }

    const session = await requireFinanceBranchSession({
      requestedBranchSlug: branch,
      requiredPermission: "sales_invoice_view",
    });

    const pageValue = Number(cleanDigits(url.searchParams.get("page")) || "1");
    const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
    const status = cleanText(url.searchParams.get("status"));
    const rawSearch = cleanText(url.searchParams.get("search")).slice(0, 80);
    const search = rawSearch
      .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    const offset = (page - 1) * PAGE_SIZE;

    let query = supabaseAdmin
      .from("finance_sales_invoices")
      .select(
        "id,branch_id,invoice_number,invoice_date,organization_name,customer_name,customer_national_id,customer_phone,product_name,investor_name,quantity,total_amount,payment_method,operation_type,sale_unit_cost,sale_total_cost,status,created_by_name,created_at,cancelled_at,cancelled_by_name,cancellation_reason",
        { count: "exact" }
      )
      .eq("branch_id", session.branchId)
      .order("invoice_date", { ascending: false })
      .order("invoice_number", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (status === "active" || status === "cancelled") {
      query = query.eq("status", status);
    }

    const operationType = cleanText(url.searchParams.get("operationType"));
    if (INVOICE_OPERATION_TYPES.includes(operationType as (typeof INVOICE_OPERATION_TYPES)[number])) {
      query = query.eq("operation_type", operationType);
    }

    if (search) {
      const digits = cleanDigits(search);
      const filters = [
        `customer_name.ilike.%${search}%`,
        `product_name.ilike.%${search}%`,
        `investor_name.ilike.%${search}%`,
      ];

      if (digits) {
        filters.push(
          `customer_national_id.ilike.%${digits}%`,
          `customer_phone.ilike.%${digits}%`
        );

        const invoiceNumber = Number(digits);
        if (Number.isSafeInteger(invoiceNumber) && invoiceNumber > 0) {
          filters.push(`invoice_number.eq.${invoiceNumber}`);
        }
      }

      query = query.or(filters.join(","));
    }

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);

    return createResponse({
      ok: true,
      invoices: data ?? [],
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
      },
    });
  } catch (error) {
    if (isFinanceBranchSessionError(error)) {
      return createErrorResponse(error.message, error.status, error.code);
    }

    console.error("Sales invoices list error:", error);
    return createErrorResponse(
      "تعذر تحميل فواتير الشراء والبيع",
      500,
      "SALES_INVOICES_LOAD_FAILED"
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);

    if (!body) {
      return createErrorResponse("بيانات الفاتورة غير صحيحة", 400, "INVALID_BODY");
    }

    const branch = cleanText(body.branch).toLowerCase();
    const operationType = cleanText(body.operationType).toLowerCase();

    if (!branch) {
      return createErrorResponse("تعذر تحديد الفرع", 400, "BRANCH_REQUIRED");
    }

    if (!INVOICE_OPERATION_TYPES.includes(operationType as (typeof INVOICE_OPERATION_TYPES)[number])) {
      return createErrorResponse("نوع العملية يجب أن يكون شراء أو بيع", 400, "INVALID_OPERATION_TYPE");
    }

    const session = await requireFinanceBranchSession({
      requestedBranchSlug: branch,
      requiredPermission:
        operationType === "purchase"
          ? "purchase_invoice_create"
          : "sales_invoice_create",
    });

    const requestId = cleanText(body.requestId);
    const invoiceDate = cleanText(body.invoiceDate);
    const customerName = cleanText(body.customerName);
    const customerNationalId = cleanDigits(body.customerNationalId);
    const customerPhone = cleanDigits(body.customerPhone);
    const inventoryId = cleanText(body.inventoryId);
    const quantity = parsePositiveNumber(body.quantity, 6);
    const totalAmount = parsePositiveNumber(body.totalAmount, 2);
    const paymentMethod = cleanText(body.paymentMethod);

    if (!UUID_PATTERN.test(requestId)) {
      return createErrorResponse(
        "معرف محاولة الحفظ غير صحيح",
        400,
        "INVALID_REQUEST_ID"
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
      return createErrorResponse("تاريخ الفاتورة غير صحيح", 400, "INVALID_INVOICE_DATE");
    }

    if (!customerName || customerName.length > 150) {
      return createErrorResponse("اسم العميل غير صحيح", 400, "INVALID_CUSTOMER_NAME");
    }

    if (!/^\d{10}$/.test(customerNationalId)) {
      return createErrorResponse(
        "رقم الهوية يجب أن يتكون من 10 أرقام",
        400,
        "INVALID_CUSTOMER_NATIONAL_ID"
      );
    }

    if (!/^05\d{8}$/.test(customerPhone)) {
      return createErrorResponse(
        "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام",
        400,
        "INVALID_CUSTOMER_PHONE"
      );
    }

    if (!UUID_PATTERN.test(inventoryId)) {
      return createErrorResponse("اختر سلعة صحيحة من المخزون", 400, "INVALID_INVENTORY_ID");
    }

    if (!quantity) {
      return createErrorResponse("أدخل كمية صحيحة", 400, "INVALID_QUANTITY");
    }

    if (!totalAmount) {
      return createErrorResponse("أدخل قيمة إجمالية صحيحة", 400, "INVALID_TOTAL_AMOUNT");
    }

    if (!PAYMENT_METHODS.includes(paymentMethod as (typeof PAYMENT_METHODS)[number])) {
      return createErrorResponse("وسيلة الدفع غير صحيحة", 400, "INVALID_PAYMENT_METHOD");
    }

    const { data, error } = await supabaseAdmin.rpc("create_purchase_sale_invoice_atomic", {
      p_branch_id: session.branchId,
      p_actor_user_id: session.userId,
      p_request_id: requestId,
      p_operation_type: operationType,
      p_invoice_date: invoiceDate,
      p_customer_name: customerName,
      p_customer_national_id: customerNationalId,
      p_customer_phone: customerPhone,
      p_inventory_id: inventoryId,
      p_quantity: quantity,
      p_total_amount: totalAmount,
      p_payment_method: paymentMethod,
    });

    if (error) {
      const mapped = mapSalesInvoiceRpcError(error.message || "");
      return createErrorResponse(mapped.message, mapped.status, mapped.code);
    }

    const result = Array.isArray(data) ? data[0] ?? null : data ?? null;

    return createResponse({
      ok: true,
      message: result?.was_created === false
        ? "تم استرجاع نتيجة محاولة الحفظ السابقة"
        : `تم إنشاء فاتورة ${operationType === "purchase" ? "الشراء" : "البيع"} بنجاح`,
      result,
    });
  } catch (error) {
    if (isFinanceBranchSessionError(error)) {
      return createErrorResponse(error.message, error.status, error.code);
    }

    console.error("Sales invoice create error:", error);
    return createErrorResponse(
      "تعذر إنشاء الفاتورة",
      500,
      "SALES_INVOICE_CREATE_FAILED"
    );
  }
}
