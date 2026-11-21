import { toEnglishDigits } from "@/lib/numberUtils"

export const TASK_STATUS_OPTIONS = [
  ["new", "جديد"],
  ["under_review", "تحت الدراسة"],
  ["waiting_customer", "بانتظار العميل"],
  ["waiting_financier", "بانتظار جهة التمويل"],
  ["completed", "مكتملة"],
  ["stopped", "متوقفة"],
] as const

export const TASK_STATUS_LABELS = Object.fromEntries(TASK_STATUS_OPTIONS)

export const COMMITMENT_ENTITY_OPTIONS = [
  ["bank", "بنك"],
  ["finance_company", "شركة تمويل"],
  ["telecom", "شركة اتصالات"],
  ["government", "جهة حكومية"],
  ["person", "شخص"],
  ["other", "جهة أخرى"],
] as const

export const COMMITMENT_ENTITY_LABELS = Object.fromEntries(
  COMMITMENT_ENTITY_OPTIONS
)

export const COMMITMENT_STATUS_OPTIONS = [
  ["regular", "منتظم"],
  ["defaulted", "متعثر"],
  ["pending_verification", "بانتظار التحقق"],
  ["paid", "تم سداده"],
] as const

export const COMMITMENT_STATUS_LABELS = Object.fromEntries(
  COMMITMENT_STATUS_OPTIONS
)

export const OPPORTUNITY_STATUS_OPTIONS = [
  ["preliminary", "مبدئي"],
  ["pending_response", "بانتظار الرد"],
  ["approved", "تمت الموافقة"],
  ["rejected", "مرفوض"],
] as const

export const OPPORTUNITY_STATUS_LABELS = Object.fromEntries(
  OPPORTUNITY_STATUS_OPTIONS
)

const MONEY_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const DATE_FORMATTER = new Intl.DateTimeFormat("en-SA-u-nu-latn", {
  timeZone: "Asia/Riyadh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export function formatMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return "غير محدد"
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `${MONEY_FORMATTER.format(parsed)} ر.س` : "غير محدد"
}

export function formatDateTime(value: unknown) {
  if (!value) return "غير محدد"
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? "غير محدد" : DATE_FORMATTER.format(parsed)
}

export function normalizeNumericInput(value: string, maxFractionDigits = 2) {
  const normalized = toEnglishDigits(value)
    .replace(/٫/g, ".")
    .replace(/,/g, "")
    .replace(/[^0-9.]/g, "")
    .replace(/(\..*)\./g, "$1")
  const [whole, fraction] = normalized.split(".")
  return fraction === undefined
    ? whole
    : `${whole}.${fraction.slice(0, Math.max(0, maxFractionDigits))}`
}

export function relationOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null
}

export async function workTasksRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  })
  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | null
  if (!response.ok) {
    const error = new Error(payload?.message || "تعذر تنفيذ العملية")
    Object.assign(error, { status: response.status })
    throw error
  }
  return payload as T
}

export function getRequestError(error: unknown) {
  return error instanceof Error ? error.message : "حدث خطأ غير متوقع"
}
