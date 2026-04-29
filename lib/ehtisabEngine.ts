export type FinanceType = "personal" | "realEstate"

export function calculateAge(birthDate: string) {
  const today = new Date()
  const birth = new Date(birthDate)

  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return age
}

export function maxFinanceMonths(age: number, financeType: FinanceType) {
  const maxAge = 60
  const remainingMonths = Math.max(0, (maxAge - age) * 12)

  if (financeType === "personal") {
    return Math.min(60, remainingMonths)
  }

  if (financeType === "realEstate") {
    return Math.min(360, remainingMonths)
  }

  return 0
}

export function calculateFinance({
  financeType,
  salary,
  deductions,
  annualRate,
  months,
  isRetired,
  supportedType,
}: {
  financeType: FinanceType
  salary: number
  deductions: number
  annualRate: number
  months: number
  isRetired: boolean
  supportedType?: "none" | "monthly_support" | "down_payment_package"
}) {
  const availableSalary = Math.max(0, salary - deductions)

  let installmentRatio = 0

  if (financeType === "personal") {
    installmentRatio = isRetired ? 0.25 : 0.33
  }

  if (financeType === "realEstate") {
    if (supportedType === "monthly_support") {
      installmentRatio = 0.65
    } else {
      installmentRatio = salary >= 15000 ? 0.65 : 0.55
    }
  }

  const installment = availableSalary * installmentRatio

  const totalInstallments = installment * months

  const monthlyRate = annualRate / 12 / 100
  const totalRate = monthlyRate * months

  const financeAmount = totalInstallments / (1 + totalRate)

  const profit = financeAmount * totalRate

  const total = financeAmount + profit

  const adminFee =
    financeType === "personal"
      ? Math.min(financeAmount * 0.005, 2500)
      : Math.min(financeAmount * 0.01, 5000)

  const netAmount = financeAmount - adminFee

  return {
    financeType,
    installment,
    financeAmount,
    profit,
    adminFee,
    netAmount,
    total,
    months,
  }
}
