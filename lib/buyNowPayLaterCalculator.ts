export const BNPL_FEE_CONFIG = {
  tamara: {
    label: "تمارا",
    commissionParts: [
      {
        key: "commission",
        label: "العمولة",
        rateBasisPoints: 699,
      },
    ],
    fixedFeeHalalas: 150,
    vatRateBasisPoints: 1500,
  },
  emkan: {
    label: "إمكان",
    commissionParts: [
      {
        key: "commission",
        label: "العمولة",
        rateBasisPoints: 699,
      },
    ],
    fixedFeeHalalas: 150,
    vatRateBasisPoints: 1500,
  },
  tabby: {
    label: "تابي",
    commissionParts: [
      {
        key: "refundable-commission",
        label: "العمولة القابلة للاسترداد",
        rateBasisPoints: 499,
      },
      {
        key: "non-refundable-commission",
        label: "العمولة غير القابلة للاسترداد",
        rateBasisPoints: 200,
      },
    ],
    fixedFeeHalalas: 150,
    vatRateBasisPoints: 1500,
  },
} as const

export type BnplProvider = keyof typeof BNPL_FEE_CONFIG

type BnplCommissionPart = {
  key: string
  label: string
  rateBasisPoints: number
  amountHalalas: number
}

export type BnplCalculation = {
  provider: BnplProvider
  invoiceAmountHalalas: number
  commissionParts: BnplCommissionPart[]
  commissionTotalHalalas: number
  fixedFeeHalalas: number
  feesBeforeTaxHalalas: number
  vatHalalas: number
  totalDeductionHalalas: number
  netAmountHalalas: number
}

const MONEY_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
})
const MAX_RATE_BASIS_POINTS = 1500
const MAX_SAFE_INVOICE_HALALAS = Math.floor(
  Number.MAX_SAFE_INTEGER / MAX_RATE_BASIS_POINTS
)

function toEnglishDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
}

function roundBasisPoints(amountHalalas: number, basisPoints: number) {
  return Math.round((amountHalalas * basisPoints) / 10000)
}

export function normalizeBnplAmountInput(value: string) {
  const normalized = toEnglishDigits(value)
    .replace(/٫/g, ".")
    .replace(/,/g, "")
    .replace(/[^0-9.]/g, "")

  const decimalIndex = normalized.indexOf(".")

  if (decimalIndex === -1) {
    return normalized
  }

  const integerPart = normalized.slice(0, decimalIndex)
  const decimalPart = normalized
    .slice(decimalIndex + 1)
    .replace(/\./g, "")
    .slice(0, 2)

  return `${integerPart}.${decimalPart}`
}

export function parseInvoiceAmountToHalalas(value: string) {
  const normalized = normalizeBnplAmountInput(value)

  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) {
    return null
  }

  const [integerPart, decimalPart = ""] = normalized.split(".")
  const integerValue = Number(integerPart)

  if (!Number.isSafeInteger(integerValue)) {
    return null
  }

  const halalas =
    integerValue * 100 + Number(decimalPart.padEnd(2, "0").slice(0, 2))

  return Number.isSafeInteger(halalas) &&
    halalas > 0 &&
    halalas <= MAX_SAFE_INVOICE_HALALAS
    ? halalas
    : null
}

export function calculateBnplFees(
  invoiceAmount: string,
  provider: BnplProvider
): BnplCalculation | null {
  const invoiceAmountHalalas = parseInvoiceAmountToHalalas(invoiceAmount)

  if (invoiceAmountHalalas === null) {
    return null
  }

  const config = BNPL_FEE_CONFIG[provider]
  const commissionParts = config.commissionParts.map(part => ({
    ...part,
    amountHalalas: roundBasisPoints(
      invoiceAmountHalalas,
      part.rateBasisPoints
    ),
  }))
  const commissionTotalHalalas = commissionParts.reduce(
    (total, part) => total + part.amountHalalas,
    0
  )
  const feesBeforeTaxHalalas =
    commissionTotalHalalas + config.fixedFeeHalalas
  const vatHalalas = roundBasisPoints(
    feesBeforeTaxHalalas,
    config.vatRateBasisPoints
  )
  const totalDeductionHalalas = feesBeforeTaxHalalas + vatHalalas

  return {
    provider,
    invoiceAmountHalalas,
    commissionParts,
    commissionTotalHalalas,
    fixedFeeHalalas: config.fixedFeeHalalas,
    feesBeforeTaxHalalas,
    vatHalalas,
    totalDeductionHalalas,
    netAmountHalalas: invoiceAmountHalalas - totalDeductionHalalas,
  }
}

export function formatHalalas(amountHalalas: number) {
  return MONEY_FORMATTER.format(amountHalalas / 100)
}

export function formatBasisPoints(basisPoints: number) {
  return `${(basisPoints / 100).toFixed(2)}%`
}
