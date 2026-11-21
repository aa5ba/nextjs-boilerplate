import { createHash } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import {
  calculateWorkTaskOpportunity,
  type WorksheetCommissionType,
} from "@/lib/workTaskWorksheet"
import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
  type RequiredFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TASK_STATUSES = new Set([
  "new",
  "under_review",
  "waiting_customer",
  "waiting_financier",
  "completed",
  "stopped",
])

const COMMITMENT_ENTITY_TYPES = new Set([
  "bank",
  "finance_company",
  "telecom",
  "government",
  "person",
  "other",
])

const COMMITMENT_STATUSES = new Set([
  "regular",
  "defaulted",
  "pending_verification",
  "paid",
])

const OPPORTUNITY_STATUSES = new Set([
  "preliminary",
  "pending_response",
  "approved",
  "rejected",
])

const COMMISSION_TYPES = new Set([
  "unset",
  "none",
  "fixed",
  "percentage",
])

const SETTLEMENT_PROVIDER_TYPES = new Set([
  "office",
  "customer",
  "other",
])

type JsonRecord = Record<string, unknown>

type DatabaseError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

function cleanText(value: unknown, maxLength = 4000) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : ""
}

function optionalText(value: unknown, maxLength = 4000) {
  const valueText = cleanText(value, maxLength)
  return valueText || null
}

function normalizeBranchSlug(value: unknown) {
  return cleanText(value, 64).toLowerCase()
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

function parsePage(value: unknown) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

function parseNullableMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const normalized = cleanText(value, 40)
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/,/g, "")
    .replace(/٫/g, ".")
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return Number.NaN
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN
}

function parseNullablePercentage(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const normalized = cleanText(value, 40)
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/,/g, "")
    .replace(/٫/g, ".")
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) return Number.NaN
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : Number.NaN
}

function parseNullableDateTime(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = new Date(cleanText(value, 80))
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function normalizeDigits(value: unknown, maxLength: number) {
  return cleanText(value, maxLength * 2)
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/\D/g, "")
    .slice(0, maxLength)
}

function normalizeHijriDate(value: unknown) {
  const normalized = cleanText(value, 20)
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/[.\-]/g, "/")
    .replace(/\s+/g, "")
    .replace(/\/{2,}/g, "/")
  const parts = normalized.split("/")
  if (parts.length !== 3 || parts.some(part => !/^\d+$/.test(part))) return ""

  const [first, second, third] = parts
  const year = first.length === 4 ? Number(first) : third.length === 4 ? Number(third) : 0
  const month = Number(second)
  const day = first.length === 4 ? Number(third) : Number(first)
  if (year < 1300 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 30) {
    return ""
  }
  return `${String(year).padStart(4, "0")}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`
}

function safeSearchValue(value: unknown) {
  return cleanText(value, 120)
    .replace(/[(),.%*"'\\:{}\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function fingerprint(payload: JsonRecord) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

function createResponse(body: JsonRecord, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

function createError(message: string, status: number, code: string) {
  return createResponse({ ok: false, message, code }, status)
}

function logDatabaseError(label: string, error: DatabaseError) {
  console.error(label, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  })
}

function databaseErrorResponse(error: DatabaseError) {
  const message = error.message || ""

  if (message.includes("WORK_TASK_REQUEST_REUSED")) {
    return createError(
      "استُخدم معرف الطلب نفسه مع بيانات مختلفة",
      409,
      "WORK_TASK_REQUEST_REUSED"
    )
  }
  if (message.includes("WORK_TASK_GROUP_SCOPE_MISMATCH")) {
    return createError("المجموعة غير موجودة في هذا الفرع", 409, "GROUP_SCOPE_MISMATCH")
  }
  if (message.includes("WORK_TASK_CUSTOMER_SCOPE_MISMATCH")) {
    return createError(
      "العميل غير موجود أو مؤرشف في هذا الفرع",
      409,
      "CUSTOMER_SCOPE_MISMATCH"
    )
  }
  if (message.includes("WORK_TASK_CUSTOMER_ALREADY_EXISTS")) {
    return createError(
      "يوجد عميل بهذه الهوية في الفرع؛ اختره من قائمة العملاء الموجودين",
      409,
      "WORK_TASK_CUSTOMER_ALREADY_EXISTS"
    )
  }
  if (message.includes("WORK_TASK_CUSTOMER_ARCHIVED")) {
    return createError(
      "يوجد ملف عميل مؤرشف بهذه الهوية؛ لا يمكن إنشاء ملف مكرر من المهمة",
      409,
      "WORK_TASK_CUSTOMER_ARCHIVED"
    )
  }
  if (message.includes("CUSTOMERS_CREATE_PERMISSION_DENIED")) {
    return createError(
      "لا تملك صلاحية إنشاء عميل جديد",
      403,
      "CUSTOMERS_CREATE_PERMISSION_DENIED"
    )
  }
  if (message.includes("INVALID_CUSTOMER_NAME")) {
    return createError("اسم العميل يجب ألا يقل عن حرفين", 400, "INVALID_CUSTOMER_NAME")
  }
  if (message.includes("INVALID_CUSTOMER_NATIONAL_ID")) {
    return createError("رقم الهوية يجب أن يتكون من 10 أرقام", 400, "INVALID_CUSTOMER_NATIONAL_ID")
  }
  if (message.includes("INVALID_CUSTOMER_PHONE")) {
    return createError(
      "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام",
      400,
      "INVALID_CUSTOMER_PHONE"
    )
  }
  if (message.includes("INVALID_CUSTOMER_HIJRI_BIRTH_DATE")) {
    return createError("تاريخ الميلاد الهجري غير صحيح", 400, "INVALID_CUSTOMER_HIJRI_BIRTH_DATE")
  }
  if (message.includes("WORK_TASK_ASSIGNEE_SCOPE_MISMATCH")) {
    return createError("الموظف المسؤول غير متاح في هذا الفرع", 409, "ASSIGNEE_SCOPE_MISMATCH")
  }
  if (message.includes("WORK_TASK_NOT_FOUND")) {
    return createError("المهمة غير موجودة", 404, "WORK_TASK_NOT_FOUND")
  }
  if (message.includes("WORK_TASK_OPPORTUNITY_NOT_FOUND")) {
    return createError("فرصة التمويل غير موجودة", 404, "WORK_TASK_OPPORTUNITY_NOT_FOUND")
  }
  if (message.includes("WORK_TASK_OPPORTUNITY_SCOPE_MISMATCH")) {
    return createError(
      "فرصة التمويل لا تخص هذه المهمة أو الفرع",
      409,
      "WORK_TASK_OPPORTUNITY_SCOPE_MISMATCH"
    )
  }
  if (message.includes("WORK_TASK_COMMITMENT_SCOPE_MISMATCH")) {
    return createError(
      "أحد الالتزامات المحددة لا يخص هذه المهمة أو الفرع",
      409,
      "WORK_TASK_COMMITMENT_SCOPE_MISMATCH"
    )
  }
  if (message.includes("WORK_TASK_INVALID_COMMISSION")) {
    return createError("بيانات عمولة المكتب غير صحيحة", 400, "WORK_TASK_INVALID_COMMISSION")
  }
  if (message.includes("WORK_TASK_INVALID_COMMITMENT_SELECTION")) {
    return createError("اختيارات الالتزامات غير صحيحة", 400, "WORK_TASK_INVALID_COMMITMENT_SELECTION")
  }
  if (error.code === "23505") {
    return createError("يوجد سجل مطابق بالفعل", 409, "WORK_TASK_DUPLICATE")
  }
  return createError("تعذر حفظ بيانات مهام العمل", 500, "WORK_TASK_DATABASE_ERROR")
}

function sessionErrorResponse(error: unknown) {
  if (isFinanceBranchSessionError(error)) {
    return createError(error.message, error.status, error.code)
  }
  return null
}

async function readBody(request: NextRequest): Promise<JsonRecord | null> {
  try {
    const body = await request.json()
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as JsonRecord)
      : null
  } catch {
    return null
  }
}

async function getSession(request: NextRequest, body?: JsonRecord | null) {
  const requestedBranchSlug = normalizeBranchSlug(
    body?.branch ?? request.nextUrl.searchParams.get("branch")
  )
  if (!requestedBranchSlug) {
    throw new Error("WORK_TASK_BRANCH_REQUIRED")
  }
  return requireFinanceBranchSession({ requestedBranchSlug })
}

async function loadActiveUsers(branchId: string) {
  const { data, error } = await supabaseAdmin
    .from("finance_branch_users")
    .select("id,full_name,role")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .is("disabled_at", null)
    .eq("self_disabled", false)
    .order("full_name", { ascending: true })

  if (error) throw error
  return data || []
}

function getRiyadhDayBounds() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const year = Number(value.year)
  const month = Number(value.month)
  const day = Number(value.day)
  const start = new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

async function loadDashboard(session: RequiredFinanceBranchSession) {
  const [groupsResult, alertsResult] = await Promise.all([
    supabaseAdmin
      .from("finance_work_task_groups")
      .select(
        "id,group_name,created_at,updated_at,tasks:finance_work_tasks(count)"
      )
      .eq("branch_id", session.branchId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false }),
    supabaseAdmin.rpc("get_finance_work_task_alerts", {
      p_branch_id: session.branchId,
      p_actor_user_id: session.userId,
      p_limit: 200,
    }),
  ])

  if (groupsResult.error) throw groupsResult.error
  if (alertsResult.error) throw alertsResult.error

  return {
    groups: groupsResult.data || [],
    alerts: alertsResult.data || [],
  }
}

async function loadCustomers(session: RequiredFinanceBranchSession, query: string) {
  const safeQuery = safeSearchValue(query)
  if (safeQuery.length < 2) return []

  const { data, error } = await supabaseAdmin
    .from("finance_customers")
    .select("id,full_name,national_id,phone")
    .eq("branch_id", session.branchId)
    .eq("is_archived", false)
    .or(
      `full_name.ilike.%${safeQuery}%,national_id.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`
    )
    .order("full_name", { ascending: true })
    .limit(20)

  if (error) throw error
  return data || []
}

async function loadGroup(
  session: RequiredFinanceBranchSession,
  params: URLSearchParams
) {
  const groupId = params.get("groupId")
  if (!isUuid(groupId)) throw new Error("WORK_TASK_INVALID_GROUP")

  const page = parsePage(params.get("page"))
  const pageSize = 25
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const query = safeSearchValue(params.get("q"))
  const status = cleanText(params.get("status"), 40)
  const assignedUserId = params.get("assignedUserId")
  const due = cleanText(params.get("due"), 40)

  const [{ data: group, error: groupError }, users] = await Promise.all([
    supabaseAdmin
      .from("finance_work_task_groups")
      .select("id,group_name,created_at,updated_at")
      .eq("id", groupId)
      .eq("branch_id", session.branchId)
      .eq("is_archived", false)
      .maybeSingle(),
    loadActiveUsers(session.branchId),
  ])

  if (groupError) throw groupError
  if (!group) throw new Error("WORK_TASK_GROUP_NOT_FOUND")

  let customerIds: string[] = []
  if (query.length >= 2) {
    const { data: customers, error } = await supabaseAdmin
      .from("finance_customers")
      .select("id")
      .eq("branch_id", session.branchId)
      .eq("is_archived", false)
      .or(
        `full_name.ilike.%${query}%,national_id.ilike.%${query}%,phone.ilike.%${query}%`
      )
      .limit(200)
    if (error) throw error
    customerIds = (customers || []).map(customer => String(customer.id))
  }

  let taskQuery = supabaseAdmin
    .from("finance_work_tasks")
    .select(
      `
        id,task_name,status,last_action,next_step,next_follow_up_at,created_at,updated_at,
        customer:finance_customers!finance_work_tasks_customer_id_fkey(id,full_name,national_id,phone),
        assignee:finance_branch_users!finance_work_tasks_assigned_user_id_fkey(id,full_name)
      `,
      { count: "exact" }
    )
    .eq("branch_id", session.branchId)
    .eq("group_id", groupId)

  if (query.length >= 2) {
    const filters = [`task_name.ilike.%${query}%`]
    if (customerIds.length > 0) filters.push(`customer_id.in.(${customerIds.join(",")})`)
    taskQuery = taskQuery.or(filters.join(","))
  }
  if (TASK_STATUSES.has(status)) taskQuery = taskQuery.eq("status", status)
  if (isUuid(assignedUserId)) taskQuery = taskQuery.eq("assigned_user_id", assignedUserId)

  const { start, end } = getRiyadhDayBounds()
  if (due === "today") taskQuery = taskQuery.gte("next_follow_up_at", start).lt("next_follow_up_at", end)
  if (due === "overdue") taskQuery = taskQuery.lt("next_follow_up_at", start)
  if (due === "none") taskQuery = taskQuery.is("next_follow_up_at", null)
  if (due === "upcoming") taskQuery = taskQuery.gte("next_follow_up_at", end)

  const { data: tasks, error: tasksError, count } = await taskQuery
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to)

  if (tasksError) throw tasksError

  return {
    group,
    users,
    tasks: tasks || [],
    pagination: {
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
    },
  }
}

async function loadTask(session: RequiredFinanceBranchSession, taskId: string) {
  if (!isUuid(taskId)) throw new Error("WORK_TASK_INVALID_TASK")

  const { data: task, error: taskError } = await supabaseAdmin
    .from("finance_work_tasks")
    .select(
      `
        id,branch_id,group_id,customer_id,task_name,status,assigned_user_id,general_notes,
        approved_salary,additional_income,employer_name,last_action,next_step,next_follow_up_at,
        completion_note,created_at,updated_at,
        group:finance_work_task_groups!finance_work_tasks_group_id_fkey(id,group_name),
        customer:finance_customers!finance_work_tasks_customer_id_fkey(id,full_name,national_id,phone),
        assignee:finance_branch_users!finance_work_tasks_assigned_user_id_fkey(id,full_name)
      `
    )
    .eq("id", taskId)
    .eq("branch_id", session.branchId)
    .maybeSingle()

  if (taskError) throw taskError
  if (!task) throw new Error("WORK_TASK_NOT_FOUND")

  const [
    commitmentsResult,
    opportunitiesResult,
    followupsResult,
    worksheetResult,
    opportunityCommitmentsResult,
    costsResult,
    checklistResult,
    settlementSourcesResult,
    users,
  ] = await Promise.all([
    supabaseAdmin
      .from("finance_work_task_commitments")
      .select("*")
      .eq("branch_id", session.branchId)
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("finance_work_task_opportunities")
      .select("*")
      .eq("branch_id", session.branchId)
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("finance_work_task_followups")
      .select("id,action_text,next_step,next_follow_up_at,created_by_user_id,created_by_name,created_at")
      .eq("branch_id", session.branchId)
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("finance_work_task_worksheets")
      .select("task_id,selected_opportunity_id")
      .eq("branch_id", session.branchId)
      .eq("task_id", taskId)
      .maybeSingle(),
    supabaseAdmin
      .from("finance_work_task_opportunity_commitments")
      .select("id,opportunity_id,commitment_id")
      .eq("branch_id", session.branchId)
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("finance_work_task_opportunity_costs")
      .select("id,opportunity_id,cost_name,amount,created_at,updated_at")
      .eq("branch_id", session.branchId)
      .eq("task_id", taskId)
      .eq("is_archived", false)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("finance_work_task_checklist_items")
      .select("id,item_name,is_completed,completed_at,completed_by_name,created_at,updated_at")
      .eq("branch_id", session.branchId)
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("finance_work_task_settlement_sources")
      .select(
        "id,opportunity_id,commitment_id,provider_type,provider_name,planned_amount,paid_amount,notes,created_at,updated_at"
      )
      .eq("branch_id", session.branchId)
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
    loadActiveUsers(session.branchId),
  ])

  if (commitmentsResult.error) throw commitmentsResult.error
  if (opportunitiesResult.error) throw opportunitiesResult.error
  if (followupsResult.error) throw followupsResult.error
  if (worksheetResult.error) throw worksheetResult.error
  if (opportunityCommitmentsResult.error) throw opportunityCommitmentsResult.error
  if (costsResult.error) throw costsResult.error
  if (checklistResult.error) throw checklistResult.error
  if (settlementSourcesResult.error) throw settlementSourcesResult.error

  const customerId = String(task.customer_id)
  const { data: otherTasks, error: otherTasksError } = await supabaseAdmin
    .from("finance_work_tasks")
    .select(
      "id,task_name,status,group:finance_work_task_groups!finance_work_tasks_group_id_fkey(id,group_name)"
    )
    .eq("branch_id", session.branchId)
    .eq("customer_id", customerId)
    .neq("id", taskId)
    .order("updated_at", { ascending: false })
    .limit(20)

  if (otherTasksError) throw otherTasksError

  const commitments = commitmentsResult.data || []
  const opportunities = opportunitiesResult.data || []
  const opportunityCommitments = opportunityCommitmentsResult.data || []
  const costs = costsResult.data || []
  const currentCommitments = commitments.filter(item => item.status !== "paid")
  const summary = {
    remainingAmount: currentCommitments.reduce(
      (sum, item) => sum + (item.remaining_amount === null ? 0 : Number(item.remaining_amount)),
      0
    ),
    monthlyInstallment: currentCommitments.reduce(
      (sum, item) => sum + (item.monthly_installment === null ? 0 : Number(item.monthly_installment)),
      0
    ),
    remainingIncomplete: currentCommitments.some(item => item.remaining_amount === null),
    installmentIncomplete: currentCommitments.some(item => item.monthly_installment === null),
    paidCount: commitments.length - currentCommitments.length,
  }

  const calculations = opportunities.map(opportunity => {
    const selectedCommitmentIds = opportunityCommitments
      .filter(link => link.opportunity_id === opportunity.id)
      .map(link => String(link.commitment_id))
    return {
      opportunityId: opportunity.id,
      calculation: calculateWorkTaskOpportunity(
        {
          id: String(opportunity.id),
          provider_name: String(opportunity.provider_name),
          expected_amount: opportunity.expected_amount,
          commission_type: String(opportunity.commission_type || "unset") as WorksheetCommissionType,
          commission_value: opportunity.commission_value,
        },
        commitments.map(commitment => ({
          id: String(commitment.id),
          entity_name: String(commitment.entity_name),
          settlement_amount: commitment.settlement_amount,
          status: String(commitment.status),
        })),
        selectedCommitmentIds,
        costs
          .filter(cost => cost.opportunity_id === opportunity.id)
          .map(cost => ({
            id: String(cost.id),
            cost_name: String(cost.cost_name),
            amount: cost.amount,
          }))
      ),
    }
  })

  return {
    task,
    commitments,
    opportunities,
    followups: followupsResult.data || [],
    otherTasks: otherTasks || [],
    users,
    summary,
    worksheet: {
      selectedOpportunityId: worksheetResult.data?.selected_opportunity_id || null,
      opportunityCommitmentLinks: opportunityCommitments,
      costs,
      checklistItems: checklistResult.data || [],
      settlementSources: settlementSourcesResult.data || [],
      calculations,
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    const view = cleanText(request.nextUrl.searchParams.get("view"), 30) || "dashboard"

    if (view === "dashboard") {
      return createResponse({ ok: true, data: await loadDashboard(session) })
    }
    if (view === "customers") {
      return createResponse({
        ok: true,
        data: { customers: await loadCustomers(session, request.nextUrl.searchParams.get("q") || "") },
      })
    }
    if (view === "group") {
      return createResponse({ ok: true, data: await loadGroup(session, request.nextUrl.searchParams) })
    }
    if (view === "task") {
      return createResponse({
        ok: true,
        data: await loadTask(session, request.nextUrl.searchParams.get("taskId") || ""),
      })
    }

    return createError("نوع العرض غير صحيح", 400, "WORK_TASK_INVALID_VIEW")
  } catch (error) {
    const sessionResponse = sessionErrorResponse(error)
    if (sessionResponse) return sessionResponse
    const message = error instanceof Error ? error.message : ""
    if (message === "WORK_TASK_BRANCH_REQUIRED") return createError("مسار الفرع مطلوب", 400, message)
    if (message.includes("NOT_FOUND")) return createError("السجل المطلوب غير موجود", 404, message)
    logDatabaseError("Work tasks GET failed:", error as DatabaseError)
    return createError("تعذر تحميل بيانات مهام العمل", 500, "WORK_TASK_LOAD_FAILED")
  }
}

async function findIdempotentRecord(
  table: string,
  branchId: string,
  requestId: string,
  requestFingerprint: string
) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id,request_fingerprint")
    .eq("branch_id", branchId)
    .eq("creation_request_id", requestId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  if (data.request_fingerprint !== requestFingerprint) {
    throw new Error("WORK_TASK_REQUEST_REUSED")
  }
  return data
}

async function createGroup(session: RequiredFinanceBranchSession, body: JsonRecord) {
  const groupName = cleanText(body.groupName, 100)
  const requestId = body.requestId
  if (groupName.length < 2 || !isUuid(requestId)) {
    return createError("اكتب اسم مجموعة صحيحًا", 400, "WORK_TASK_INVALID_GROUP")
  }

  const requestFingerprint = fingerprint({ groupName })
  const existing = await findIdempotentRecord(
    "finance_work_task_groups",
    session.branchId,
    requestId,
    requestFingerprint
  )
  if (existing) return createResponse({ ok: true, id: existing.id, wasCreated: false })

  const { data, error } = await supabaseAdmin
    .from("finance_work_task_groups")
    .insert({
      branch_id: session.branchId,
      group_name: groupName,
      creation_request_id: requestId,
      request_fingerprint: requestFingerprint,
      created_by_user_id: session.userId,
      created_by_name: session.user.fullName,
      updated_by_user_id: session.userId,
      updated_by_name: session.user.fullName,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      const raced = await findIdempotentRecord(
        "finance_work_task_groups",
        session.branchId,
        requestId,
        requestFingerprint
      )
      if (raced) return createResponse({ ok: true, id: raced.id, wasCreated: false })
    }
    return databaseErrorResponse(error)
  }
  return createResponse({ ok: true, id: data.id, wasCreated: true }, 201)
}

async function renameGroup(session: RequiredFinanceBranchSession, body: JsonRecord) {
  const groupId = body.groupId
  const groupName = cleanText(body.groupName, 100)
  if (!isUuid(groupId) || groupName.length < 2) {
    return createError("بيانات المجموعة غير صحيحة", 400, "WORK_TASK_INVALID_GROUP")
  }

  const { data, error } = await supabaseAdmin
    .from("finance_work_task_groups")
    .update({
      group_name: groupName,
      updated_by_user_id: session.userId,
      updated_by_name: session.user.fullName,
    })
    .eq("id", groupId)
    .eq("branch_id", session.branchId)
    .eq("is_archived", false)
    .select("id")
    .maybeSingle()

  if (error) return databaseErrorResponse(error)
  if (!data) return createError("المجموعة غير موجودة", 404, "WORK_TASK_GROUP_NOT_FOUND")
  return createResponse({ ok: true, id: data.id })
}

async function createTask(session: RequiredFinanceBranchSession, body: JsonRecord) {
  const groupId = body.groupId
  const customerMode = cleanText(body.customerMode, 20) || "existing"
  const customerId = customerMode === "existing" ? body.customerId : null
  const customerFullName = cleanText(body.customerFullName, 160).replace(/\s+/g, " ")
  const customerNationalId = normalizeDigits(body.customerNationalId, 10)
  const customerPhone = normalizeDigits(body.customerPhone, 10)
  const customerBirthInput = cleanText(body.customerBirthHijri, 20)
  const customerBirthHijri = normalizeHijriDate(body.customerBirthHijri)
  const assignedUserId = body.assignedUserId
  const taskName = cleanText(body.taskName, 160)
  const requestId = body.requestId
  if (
    !isUuid(groupId) ||
    !["existing", "new"].includes(customerMode) ||
    (customerMode === "existing" && !isUuid(customerId)) ||
    (customerMode === "new" && (
      customerFullName.length < 2 ||
      !/^\d{10}$/.test(customerNationalId) ||
      !/^05\d{8}$/.test(customerPhone) ||
      (customerBirthInput !== "" && !customerBirthHijri)
    )) ||
    !isUuid(assignedUserId) ||
    !isUuid(requestId) ||
    taskName.length < 2
  ) {
    return createError("أكمل بيانات المهمة المطلوبة", 400, "WORK_TASK_INVALID_TASK")
  }

  const payload = {
    groupId,
    customerMode,
    customerId,
    customerFullName: customerMode === "new" ? customerFullName : null,
    customerNationalId: customerMode === "new" ? customerNationalId : null,
    customerPhone: customerMode === "new" ? customerPhone : null,
    customerBirthHijri: customerMode === "new" ? customerBirthHijri || null : null,
    assignedUserId,
    taskName,
  }
  const requestFingerprint = fingerprint(payload)
  const { data, error } = await supabaseAdmin.rpc(
    "create_finance_work_task_with_customer_atomic",
    {
      p_branch_id: session.branchId,
      p_group_id: groupId,
      p_customer_id: customerId,
      p_create_customer: customerMode === "new",
      p_customer_full_name: customerMode === "new" ? customerFullName : null,
      p_customer_national_id: customerMode === "new" ? customerNationalId : null,
      p_customer_birth_hijri: customerMode === "new" ? customerBirthHijri || null : null,
      p_customer_phone: customerMode === "new" ? customerPhone : null,
      p_assigned_user_id: assignedUserId,
      p_task_name: taskName,
      p_request_id: requestId,
      p_request_fingerprint: requestFingerprint,
      p_actor_user_id: session.userId,
      p_actor_name: session.user.fullName,
    }
  )

  if (error) return databaseErrorResponse(error)

  const result = Array.isArray(data) ? data[0] : data
  if (!result || !isUuid(result.task_id) || !isUuid(result.customer_id)) {
    return createError("تعذر قراءة نتيجة إنشاء المهمة", 500, "WORK_TASK_INVALID_RPC_RESULT")
  }

  return createResponse(
    {
      ok: true,
      id: result.task_id,
      customerId: result.customer_id,
      customerWasCreated: result.customer_was_created === true,
      wasCreated: result.task_was_created === true,
    },
    result.task_was_created === true ? 201 : 200
  )
}

async function updateTask(session: RequiredFinanceBranchSession, body: JsonRecord) {
  const taskId = body.taskId
  const taskName = cleanText(body.taskName, 160)
  const status = cleanText(body.status, 40)
  const assignedUserId = body.assignedUserId
  const approvedSalary = parseNullableMoney(body.approvedSalary)
  const additionalIncome = parseNullableMoney(body.additionalIncome)
  const nextFollowUpAt = parseNullableDateTime(body.nextFollowUpAt)

  if (
    !isUuid(taskId) ||
    !isUuid(assignedUserId) ||
    taskName.length < 2 ||
    !TASK_STATUSES.has(status) ||
    Number.isNaN(approvedSalary) ||
    Number.isNaN(additionalIncome) ||
    nextFollowUpAt === undefined
  ) {
    return createError("بيانات المهمة غير صحيحة", 400, "WORK_TASK_INVALID_TASK")
  }

  const { data, error } = await supabaseAdmin
    .from("finance_work_tasks")
    .update({
      task_name: taskName,
      status,
      assigned_user_id: assignedUserId,
      general_notes: optionalText(body.generalNotes),
      approved_salary: approvedSalary,
      additional_income: additionalIncome,
      employer_name: optionalText(body.employerName, 200),
      next_step: optionalText(body.nextStep, 1000),
      next_follow_up_at: nextFollowUpAt,
      completion_note: optionalText(body.completionNote, 2000),
      updated_by_user_id: session.userId,
      updated_by_name: session.user.fullName,
    })
    .eq("id", taskId)
    .eq("branch_id", session.branchId)
    .select("id")
    .maybeSingle()

  if (error) return databaseErrorResponse(error)
  if (!data) return createError("المهمة غير موجودة", 404, "WORK_TASK_NOT_FOUND")
  return createResponse({ ok: true, id: data.id })
}

async function saveCommitment(session: RequiredFinanceBranchSession, body: JsonRecord) {
  const taskId = body.taskId
  const commitmentId = body.commitmentId
  const requestId = body.requestId
  const entityType = cleanText(body.entityType, 40)
  const entityName = cleanText(body.entityName, 160)
  const commitmentType = cleanText(body.commitmentType, 160)
  const status = cleanText(body.status, 40)
  const remainingAmount = parseNullableMoney(body.remainingAmount)
  const monthlyInstallment = parseNullableMoney(body.monthlyInstallment)
  const defaultAmount = parseNullableMoney(body.defaultAmount)
  const settlementAmount = parseNullableMoney(body.settlementAmount)

  if (
    !isUuid(taskId) ||
    !COMMITMENT_ENTITY_TYPES.has(entityType) ||
    !COMMITMENT_STATUSES.has(status) ||
    entityName.length < 2 ||
    commitmentType.length < 2 ||
    [remainingAmount, monthlyInstallment, defaultAmount, settlementAmount].some(Number.isNaN)
  ) {
    return createError("بيانات الالتزام غير صحيحة", 400, "WORK_TASK_INVALID_COMMITMENT")
  }

  const values = {
    entity_type: entityType,
    entity_name: entityName,
    commitment_type: commitmentType,
    remaining_amount: remainingAmount,
    monthly_installment: monthlyInstallment,
    default_amount: defaultAmount,
    settlement_amount: settlementAmount,
    status,
    notes: optionalText(body.notes, 2000),
    updated_by_user_id: session.userId,
    updated_by_name: session.user.fullName,
  }

  if (isUuid(commitmentId)) {
    const { data, error } = await supabaseAdmin
      .from("finance_work_task_commitments")
      .update(values)
      .eq("id", commitmentId)
      .eq("task_id", taskId)
      .eq("branch_id", session.branchId)
      .select("id")
      .maybeSingle()
    if (error) return databaseErrorResponse(error)
    if (!data) return createError("الالتزام غير موجود", 404, "WORK_TASK_COMMITMENT_NOT_FOUND")
    return createResponse({ ok: true, id: data.id })
  }

  if (!isUuid(requestId)) {
    return createError("معرف الطلب غير صحيح", 400, "WORK_TASK_INVALID_REQUEST")
  }
  const requestFingerprint = fingerprint({ taskId, ...values })
  const existing = await findIdempotentRecord(
    "finance_work_task_commitments",
    session.branchId,
    requestId,
    requestFingerprint
  )
  if (existing) return createResponse({ ok: true, id: existing.id, wasCreated: false })

  const { data, error } = await supabaseAdmin
    .from("finance_work_task_commitments")
    .insert({
      ...values,
      branch_id: session.branchId,
      task_id: taskId,
      creation_request_id: requestId,
      request_fingerprint: requestFingerprint,
      created_by_user_id: session.userId,
      created_by_name: session.user.fullName,
    })
    .select("id")
    .single()
  if (error) return databaseErrorResponse(error)
  return createResponse({ ok: true, id: data.id, wasCreated: true }, 201)
}

async function saveOpportunity(session: RequiredFinanceBranchSession, body: JsonRecord) {
  const taskId = body.taskId
  const opportunityId = body.opportunityId
  const requestId = body.requestId
  const providerName = cleanText(body.providerName, 160)
  const status = cleanText(body.status, 40)
  const expectedAmount = parseNullableMoney(body.expectedAmount)

  if (
    !isUuid(taskId) ||
    providerName.length < 2 ||
    !OPPORTUNITY_STATUSES.has(status) ||
    Number.isNaN(expectedAmount)
  ) {
    return createError("بيانات فرصة التمويل غير صحيحة", 400, "WORK_TASK_INVALID_OPPORTUNITY")
  }

  const values = {
    provider_name: providerName,
    expected_amount: expectedAmount,
    status,
    notes: optionalText(body.notes, 2000),
    updated_by_user_id: session.userId,
    updated_by_name: session.user.fullName,
  }

  if (isUuid(opportunityId)) {
    const { data, error } = await supabaseAdmin
      .from("finance_work_task_opportunities")
      .update(values)
      .eq("id", opportunityId)
      .eq("task_id", taskId)
      .eq("branch_id", session.branchId)
      .select("id")
      .maybeSingle()
    if (error) return databaseErrorResponse(error)
    if (!data) return createError("فرصة التمويل غير موجودة", 404, "WORK_TASK_OPPORTUNITY_NOT_FOUND")
    return createResponse({ ok: true, id: data.id })
  }

  if (!isUuid(requestId)) {
    return createError("معرف الطلب غير صحيح", 400, "WORK_TASK_INVALID_REQUEST")
  }
  const requestFingerprint = fingerprint({ taskId, ...values })
  const existing = await findIdempotentRecord(
    "finance_work_task_opportunities",
    session.branchId,
    requestId,
    requestFingerprint
  )
  if (existing) return createResponse({ ok: true, id: existing.id, wasCreated: false })

  const { data, error } = await supabaseAdmin
    .from("finance_work_task_opportunities")
    .insert({
      ...values,
      branch_id: session.branchId,
      task_id: taskId,
      creation_request_id: requestId,
      request_fingerprint: requestFingerprint,
      created_by_user_id: session.userId,
      created_by_name: session.user.fullName,
    })
    .select("id")
    .single()
  if (error) return databaseErrorResponse(error)
  return createResponse({ ok: true, id: data.id, wasCreated: true }, 201)
}

async function selectWorksheetOpportunity(
  session: RequiredFinanceBranchSession,
  body: JsonRecord
) {
  const taskId = body.taskId
  const opportunityId = body.opportunityId === "" ? null : body.opportunityId
  if (!isUuid(taskId) || (opportunityId !== null && !isUuid(opportunityId))) {
    return createError("اختيار فرصة التمويل غير صحيح", 400, "WORK_TASK_INVALID_OPPORTUNITY")
  }

  const { data, error } = await supabaseAdmin.rpc(
    "set_finance_work_task_selected_opportunity_atomic",
    {
      p_branch_id: session.branchId,
      p_task_id: taskId,
      p_opportunity_id: opportunityId,
      p_actor_user_id: session.userId,
      p_actor_name: session.user.fullName,
    }
  )
  if (error) return databaseErrorResponse(error)
  return createResponse({ ok: true, result: data })
}

async function saveOpportunityPlan(
  session: RequiredFinanceBranchSession,
  body: JsonRecord
) {
  const taskId = body.taskId
  const opportunityId = body.opportunityId
  const commissionType = cleanText(body.commissionType, 30)
  const commitmentIds = Array.isArray(body.commitmentIds)
    ? body.commitmentIds
    : []
  const parsedCommissionValue = commissionType === "percentage"
    ? parseNullablePercentage(body.commissionValue)
    : parseNullableMoney(body.commissionValue)
  const commissionValue = commissionType === "none" || commissionType === "unset"
    ? null
    : parsedCommissionValue

  if (
    !isUuid(taskId) ||
    !isUuid(opportunityId) ||
    !COMMISSION_TYPES.has(commissionType) ||
    commitmentIds.some(id => !isUuid(id)) ||
    Number.isNaN(commissionValue) ||
    ((commissionType === "fixed" || commissionType === "percentage") && commissionValue === null)
  ) {
    return createError("بيانات حسبة الفرصة غير صحيحة", 400, "WORK_TASK_INVALID_OPPORTUNITY_PLAN")
  }

  const { data, error } = await supabaseAdmin.rpc(
    "save_finance_work_task_opportunity_plan_atomic",
    {
      p_branch_id: session.branchId,
      p_task_id: taskId,
      p_opportunity_id: opportunityId,
      p_actor_user_id: session.userId,
      p_actor_name: session.user.fullName,
      p_commission_type: commissionType,
      p_commission_value: commissionValue,
      p_commitment_ids: commitmentIds,
    }
  )
  if (error) return databaseErrorResponse(error)
  return createResponse({ ok: true, result: data })
}

async function saveWorksheetCost(
  session: RequiredFinanceBranchSession,
  body: JsonRecord
) {
  const taskId = body.taskId
  const opportunityId = body.opportunityId
  const costId = body.costId
  const requestId = body.requestId
  const costName = cleanText(body.costName, 160)
  const amount = parseNullableMoney(body.amount)

  if (
    !isUuid(taskId) ||
    !isUuid(opportunityId) ||
    costName.length < 2 ||
    Number.isNaN(amount)
  ) {
    return createError("بيانات التكلفة غير صحيحة", 400, "WORK_TASK_INVALID_COST")
  }

  const values = {
    cost_name: costName,
    amount,
    updated_by_user_id: session.userId,
    updated_by_name: session.user.fullName,
  }

  if (isUuid(costId)) {
    const { data, error } = await supabaseAdmin
      .from("finance_work_task_opportunity_costs")
      .update(values)
      .eq("id", costId)
      .eq("branch_id", session.branchId)
      .eq("task_id", taskId)
      .eq("opportunity_id", opportunityId)
      .eq("is_archived", false)
      .select("id")
      .maybeSingle()
    if (error) return databaseErrorResponse(error)
    if (!data) return createError("التكلفة غير موجودة", 404, "WORK_TASK_COST_NOT_FOUND")
    return createResponse({ ok: true, id: data.id })
  }

  if (!isUuid(requestId)) {
    return createError("معرف الطلب غير صحيح", 400, "WORK_TASK_INVALID_REQUEST")
  }
  const requestFingerprint = fingerprint({ taskId, opportunityId, ...values })
  const existing = await findIdempotentRecord(
    "finance_work_task_opportunity_costs",
    session.branchId,
    requestId,
    requestFingerprint
  )
  if (existing) return createResponse({ ok: true, id: existing.id, wasCreated: false })

  const { data, error } = await supabaseAdmin
    .from("finance_work_task_opportunity_costs")
    .insert({
      ...values,
      branch_id: session.branchId,
      task_id: taskId,
      opportunity_id: opportunityId,
      creation_request_id: requestId,
      request_fingerprint: requestFingerprint,
      created_by_user_id: session.userId,
      created_by_name: session.user.fullName,
    })
    .select("id")
    .single()
  if (error) {
    if (error.code === "23505") {
      const raced = await findIdempotentRecord(
        "finance_work_task_opportunity_costs",
        session.branchId,
        requestId,
        requestFingerprint
      )
      if (raced) return createResponse({ ok: true, id: raced.id, wasCreated: false })
    }
    return databaseErrorResponse(error)
  }
  return createResponse({ ok: true, id: data.id, wasCreated: true }, 201)
}

async function archiveWorksheetCost(
  session: RequiredFinanceBranchSession,
  body: JsonRecord
) {
  const taskId = body.taskId
  const opportunityId = body.opportunityId
  const costId = body.costId
  if (!isUuid(taskId) || !isUuid(opportunityId) || !isUuid(costId)) {
    return createError("بيانات التكلفة غير صحيحة", 400, "WORK_TASK_INVALID_COST")
  }
  const { data, error } = await supabaseAdmin
    .from("finance_work_task_opportunity_costs")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      updated_by_user_id: session.userId,
      updated_by_name: session.user.fullName,
    })
    .eq("id", costId)
    .eq("branch_id", session.branchId)
    .eq("task_id", taskId)
    .eq("opportunity_id", opportunityId)
    .eq("is_archived", false)
    .select("id")
    .maybeSingle()
  if (error) return databaseErrorResponse(error)
  if (!data) return createError("التكلفة غير موجودة", 404, "WORK_TASK_COST_NOT_FOUND")
  return createResponse({ ok: true, id: data.id })
}

async function saveChecklistItem(
  session: RequiredFinanceBranchSession,
  body: JsonRecord
) {
  const taskId = body.taskId
  const itemId = body.itemId
  const requestId = body.requestId
  const itemName = cleanText(body.itemName, 240)
  const isCompleted = body.isCompleted === true
  if (!isUuid(taskId) || itemName.length < 2) {
    return createError("بيانات البند غير صحيحة", 400, "WORK_TASK_INVALID_CHECKLIST_ITEM")
  }

  const values = {
    item_name: itemName,
    is_completed: isCompleted,
    completed_at: isCompleted ? new Date().toISOString() : null,
    completed_by_user_id: isCompleted ? session.userId : null,
    completed_by_name: isCompleted ? session.user.fullName : null,
    updated_by_user_id: session.userId,
    updated_by_name: session.user.fullName,
  }

  if (isUuid(itemId)) {
    const { data, error } = await supabaseAdmin
      .from("finance_work_task_checklist_items")
      .update(values)
      .eq("id", itemId)
      .eq("branch_id", session.branchId)
      .eq("task_id", taskId)
      .select("id")
      .maybeSingle()
    if (error) return databaseErrorResponse(error)
    if (!data) return createError("البند غير موجود", 404, "WORK_TASK_CHECKLIST_NOT_FOUND")
    return createResponse({ ok: true, id: data.id })
  }

  if (!isUuid(requestId)) {
    return createError("معرف الطلب غير صحيح", 400, "WORK_TASK_INVALID_REQUEST")
  }
  const requestFingerprint = fingerprint({ taskId, itemName, isCompleted })
  const existing = await findIdempotentRecord(
    "finance_work_task_checklist_items",
    session.branchId,
    requestId,
    requestFingerprint
  )
  if (existing) return createResponse({ ok: true, id: existing.id, wasCreated: false })

  const { data, error } = await supabaseAdmin
    .from("finance_work_task_checklist_items")
    .insert({
      ...values,
      branch_id: session.branchId,
      task_id: taskId,
      creation_request_id: requestId,
      request_fingerprint: requestFingerprint,
      created_by_user_id: session.userId,
      created_by_name: session.user.fullName,
    })
    .select("id")
    .single()
  if (error) {
    if (error.code === "23505") {
      const raced = await findIdempotentRecord(
        "finance_work_task_checklist_items",
        session.branchId,
        requestId,
        requestFingerprint
      )
      if (raced) return createResponse({ ok: true, id: raced.id, wasCreated: false })
    }
    return databaseErrorResponse(error)
  }
  return createResponse({ ok: true, id: data.id, wasCreated: true }, 201)
}

async function saveSettlementSource(
  session: RequiredFinanceBranchSession,
  body: JsonRecord
) {
  const taskId = body.taskId
  const opportunityId = body.opportunityId
  const sourceId = body.sourceId
  const requestId = body.requestId
  const commitmentId = body.commitmentId === "" ? null : body.commitmentId
  const providerType = cleanText(body.providerType, 30)
  const providerName = providerType === "other"
    ? optionalText(body.providerName, 160)
    : null
  const plannedAmount = parseNullableMoney(body.plannedAmount)
  const paidAmount = parseNullableMoney(body.paidAmount)

  if (
    !isUuid(taskId) ||
    !isUuid(opportunityId) ||
    (commitmentId !== null && !isUuid(commitmentId)) ||
    !SETTLEMENT_PROVIDER_TYPES.has(providerType) ||
    (providerType === "other" && (!providerName || providerName.length < 2)) ||
    Number.isNaN(plannedAmount) ||
    Number.isNaN(paidAmount) ||
    (plannedAmount !== null && paidAmount !== null && paidAmount > plannedAmount)
  ) {
    return createError("بيانات توفير مبلغ السداد غير صحيحة", 400, "WORK_TASK_INVALID_SETTLEMENT_SOURCE")
  }

  const values = {
    opportunity_id: opportunityId,
    commitment_id: commitmentId,
    provider_type: providerType,
    provider_name: providerName,
    planned_amount: plannedAmount,
    paid_amount: paidAmount,
    notes: optionalText(body.notes, 2000),
    updated_by_user_id: session.userId,
    updated_by_name: session.user.fullName,
  }

  if (isUuid(sourceId)) {
    const { data, error } = await supabaseAdmin
      .from("finance_work_task_settlement_sources")
      .update(values)
      .eq("id", sourceId)
      .eq("branch_id", session.branchId)
      .eq("task_id", taskId)
      .select("id")
      .maybeSingle()
    if (error) return databaseErrorResponse(error)
    if (!data) return createError("سجل توفير السداد غير موجود", 404, "WORK_TASK_SOURCE_NOT_FOUND")
    return createResponse({ ok: true, id: data.id })
  }

  if (!isUuid(requestId)) {
    return createError("معرف الطلب غير صحيح", 400, "WORK_TASK_INVALID_REQUEST")
  }
  const requestFingerprint = fingerprint({ taskId, ...values })
  const existing = await findIdempotentRecord(
    "finance_work_task_settlement_sources",
    session.branchId,
    requestId,
    requestFingerprint
  )
  if (existing) return createResponse({ ok: true, id: existing.id, wasCreated: false })

  const { data, error } = await supabaseAdmin
    .from("finance_work_task_settlement_sources")
    .insert({
      ...values,
      branch_id: session.branchId,
      task_id: taskId,
      creation_request_id: requestId,
      request_fingerprint: requestFingerprint,
      created_by_user_id: session.userId,
      created_by_name: session.user.fullName,
    })
    .select("id")
    .single()
  if (error) {
    if (error.code === "23505") {
      const raced = await findIdempotentRecord(
        "finance_work_task_settlement_sources",
        session.branchId,
        requestId,
        requestFingerprint
      )
      if (raced) return createResponse({ ok: true, id: raced.id, wasCreated: false })
    }
    return databaseErrorResponse(error)
  }
  return createResponse({ ok: true, id: data.id, wasCreated: true }, 201)
}

async function addFollowup(session: RequiredFinanceBranchSession, body: JsonRecord) {
  const taskId = body.taskId
  const requestId = body.requestId
  const actionText = cleanText(body.actionText, 2000)
  const nextStep = optionalText(body.nextStep, 1000)
  const nextFollowUpAt = parseNullableDateTime(body.nextFollowUpAt)
  if (
    !isUuid(taskId) ||
    !isUuid(requestId) ||
    actionText.length < 2 ||
    nextFollowUpAt === undefined
  ) {
    return createError("أدخل تفاصيل متابعة صحيحة", 400, "WORK_TASK_INVALID_FOLLOWUP")
  }

  const requestFingerprint = fingerprint({ taskId, actionText, nextStep, nextFollowUpAt })
  const { data, error } = await supabaseAdmin.rpc(
    "add_finance_work_task_followup_atomic",
    {
      p_branch_id: session.branchId,
      p_task_id: taskId,
      p_actor_user_id: session.userId,
      p_actor_name: session.user.fullName,
      p_action_text: actionText,
      p_next_step: nextStep,
      p_next_follow_up_at: nextFollowUpAt,
      p_request_id: requestId,
      p_request_fingerprint: requestFingerprint,
    }
  )
  if (error) return databaseErrorResponse(error)
  return createResponse({ ok: true, result: data })
}

export async function POST(request: NextRequest) {
  const body = await readBody(request)
  if (!body) return createError("بيانات الطلب غير صحيحة", 400, "INVALID_JSON")

  try {
    const session = await getSession(request, body)
    const action = cleanText(body.action, 40)

    if (action === "create_group") return createGroup(session, body)
    if (action === "rename_group") return renameGroup(session, body)
    if (action === "create_task") return createTask(session, body)
    if (action === "update_task") return updateTask(session, body)
    if (action === "save_commitment") return saveCommitment(session, body)
    if (action === "save_opportunity") return saveOpportunity(session, body)
    if (action === "select_worksheet_opportunity") {
      return selectWorksheetOpportunity(session, body)
    }
    if (action === "save_opportunity_plan") return saveOpportunityPlan(session, body)
    if (action === "save_worksheet_cost") return saveWorksheetCost(session, body)
    if (action === "archive_worksheet_cost") return archiveWorksheetCost(session, body)
    if (action === "save_checklist_item") return saveChecklistItem(session, body)
    if (action === "save_settlement_source") return saveSettlementSource(session, body)
    if (action === "add_followup") return addFollowup(session, body)

    return createError("نوع العملية غير صحيح", 400, "WORK_TASK_INVALID_ACTION")
  } catch (error) {
    const sessionResponse = sessionErrorResponse(error)
    if (sessionResponse) return sessionResponse
    const message = error instanceof Error ? error.message : ""
    if (message === "WORK_TASK_BRANCH_REQUIRED") return createError("مسار الفرع مطلوب", 400, message)
    if (message === "WORK_TASK_REQUEST_REUSED") {
      return createError("استُخدم معرف الطلب نفسه مع بيانات مختلفة", 409, message)
    }
    logDatabaseError("Work tasks POST failed:", error as DatabaseError)
    return createError("تعذر تنفيذ العملية", 500, "WORK_TASK_ACTION_FAILED")
  }
}
