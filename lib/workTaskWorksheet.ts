import { toEnglishDigits } from "@/lib/numberUtils"

const BIGINT_ZERO = BigInt(0)
const BIGINT_TWO = BigInt(2)
const BIGINT_TEN = BigInt(10)
const BIGINT_HUNDRED = BigInt(100)
const PERCENTAGE_DIVISOR = BigInt(1_000_000)

export type WorksheetCommissionType = "unset" | "none" | "fixed" | "percentage"

export type WorksheetOpportunityInput = {
  id: string
  provider_name: string
  expected_amount: string | number | null
  commission_type: WorksheetCommissionType
  commission_value: string | number | null
}

export type WorksheetCommitmentInput = {
  id: string
  entity_name: string
  settlement_amount: string | number | null
  status: string
}

export type WorksheetCostInput = {
  id: string
  cost_name: string
  amount: string | number | null
}

export type WorksheetCalculation = {
  expectedAmount: string | null
  settlementAmount: string
  settlementIncomplete: boolean
  otherCostsAmount: string
  costsIncomplete: boolean
  commissionAmount: string | null
  commissionIncomplete: boolean
  netAmount: string | null
  isComplete: boolean
  missing: string[]
  selectedCommitmentCount: number
  excludedPaidCommitmentIds: string[]
}

function decimalToScaledInteger(value: unknown, scale: number): bigint | null {
  if (value === null || value === undefined || value === "") return null
  const normalized = toEnglishDigits(String(value))
    .trim()
    .replace(/,/g, "")
    .replace(/٫/g, ".")
  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/)
  if (!match) return null
  const fraction = (match[2] || "").slice(0, scale).padEnd(scale, "0")
  return BigInt(match[1]) * BIGINT_TEN ** BigInt(scale) + BigInt(fraction || "0")
}

function centsToDecimal(value: bigint): string {
  const negative = value < BIGINT_ZERO
  const absolute = negative ? -value : value
  const whole = absolute / BIGINT_HUNDRED
  const fraction = String(absolute % BIGINT_HUNDRED).padStart(2, "0")
  return `${negative ? "-" : ""}${whole}.${fraction}`
}

function moneyToCents(value: unknown): bigint | null {
  return decimalToScaledInteger(value, 2)
}

function percentageToScaled(value: unknown): bigint | null {
  return decimalToScaledInteger(value, 4)
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / BIGINT_TWO) / denominator
}

export function calculateWorkTaskOpportunity(
  opportunity: WorksheetOpportunityInput,
  commitments: WorksheetCommitmentInput[],
  selectedCommitmentIds: string[],
  costs: WorksheetCostInput[]
): WorksheetCalculation {
  const selectedIdSet = new Set(selectedCommitmentIds)
  const selectedCommitments = commitments.filter(item => selectedIdSet.has(item.id))
  const activeSelected = selectedCommitments.filter(item => item.status !== "paid")
  const excludedPaidCommitmentIds = selectedCommitments
    .filter(item => item.status === "paid")
    .map(item => item.id)

  let settlementCents = BIGINT_ZERO
  let settlementIncomplete = false
  const missing: string[] = []

  for (const commitment of activeSelected) {
    const cents = moneyToCents(commitment.settlement_amount)
    if (cents === null) {
      settlementIncomplete = true
      missing.push(`مبلغ السداد المطلوب لالتزام ${commitment.entity_name}`)
    } else {
      settlementCents += cents
    }
  }

  let otherCostsCents = BIGINT_ZERO
  let costsIncomplete = false
  for (const cost of costs) {
    const cents = moneyToCents(cost.amount)
    if (cents === null) {
      costsIncomplete = true
      missing.push(`قيمة التكلفة: ${cost.cost_name}`)
    } else {
      otherCostsCents += cents
    }
  }

  const expectedCents = moneyToCents(opportunity.expected_amount)
  if (expectedCents === null) missing.unshift("مبلغ التمويل المتوقع")

  let commissionCents: bigint | null = null
  let commissionIncomplete = false
  if (opportunity.commission_type === "none") {
    commissionCents = BIGINT_ZERO
  } else if (opportunity.commission_type === "fixed") {
    commissionCents = moneyToCents(opportunity.commission_value)
    if (commissionCents === null) {
      commissionIncomplete = true
      missing.push("مبلغ عمولة المكتب")
    }
  } else if (opportunity.commission_type === "percentage") {
    const percentage = percentageToScaled(opportunity.commission_value)
    if (percentage === null) {
      commissionIncomplete = true
      missing.push("نسبة عمولة المكتب")
    } else if (expectedCents === null) {
      commissionIncomplete = true
      missing.push("مبلغ التمويل لحساب العمولة النسبية")
    } else {
      commissionCents = roundDivide(expectedCents * percentage, PERCENTAGE_DIVISOR)
    }
  } else {
    commissionIncomplete = true
    missing.push("تحديد عمولة المكتب أو اختيار لا توجد عمولة")
  }

  const isComplete =
    expectedCents !== null &&
    !settlementIncomplete &&
    !costsIncomplete &&
    !commissionIncomplete &&
    commissionCents !== null

  const netCents = isComplete
    ? expectedCents - settlementCents - otherCostsCents - (commissionCents ?? BIGINT_ZERO)
    : null

  return {
    expectedAmount: expectedCents === null ? null : centsToDecimal(expectedCents),
    settlementAmount: centsToDecimal(settlementCents),
    settlementIncomplete,
    otherCostsAmount: centsToDecimal(otherCostsCents),
    costsIncomplete,
    commissionAmount: commissionCents === null ? null : centsToDecimal(commissionCents),
    commissionIncomplete,
    netAmount: netCents === null ? null : centsToDecimal(netCents),
    isComplete,
    missing: Array.from(new Set(missing)),
    selectedCommitmentCount: selectedCommitments.length,
    excludedPaidCommitmentIds,
  }
}

export function calculateSettlementSourceRemaining(
  plannedAmount: unknown,
  paidAmount: unknown
): { complete: boolean; remainingAmount: string | null } {
  const plannedCents = moneyToCents(plannedAmount)
  const paidCents = moneyToCents(paidAmount)
  if (plannedCents === null || paidCents === null) {
    return { complete: false, remainingAmount: null }
  }
  return {
    complete: true,
    remainingAmount: centsToDecimal(plannedCents - paidCents),
  }
}
