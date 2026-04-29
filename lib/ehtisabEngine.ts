export type FinanceType = "personal" | "realEstate" | "both"
export type CustomerType = "employee" | "retired"
export type RealEstateType = "supported" | "normal"
export type RealEstateProduct = "ready" | "selfBuild" | "land" | "mortgage"
export type SupportType = "none" | "monthly" | "downPaymentPackage"

export function calculateAge(birthDate: string) {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function money(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

function zero(reason: string) {
  return {
    accepted: false,
    reason,
    installment: 0,
    financeAmount: 0,
    profit: 0,
    total: 0,
    adminFee: 0,
    netAmount: 0,
    checkAmount: 0,
    downPayment: 0,
    supportPackage: 0,
    propertyValue: 0,
    months: 0,
  }
}

export function maxMonths(age: number, financeType: FinanceType, customerType: CustomerType) {
  const maxAge = customerType === "retired" ? 70 : 60
  const ageMonthsLeft = Math.max(0, (maxAge - age) * 12)

  if (financeType === "personal") return Math.min(60, ageMonthsLeft)
  if (financeType === "realEstate") return Math.min(360, ageMonthsLeft)
  return Math.min(360, ageMonthsLeft)
}

export function calculateByInstallment({
  installment,
  annualRate,
  months,
  adminRate,
  adminCap,
}: {
  installment: number
  annualRate: number
  months: number
  adminRate: number
  adminCap: number
}) {
  const totalInstallments = installment * months
  const monthlyRate = annualRate / 12 / 100
  const totalRate = monthlyRate * months

  const financeAmount = totalInstallments / (1 + totalRate)
  const profit = financeAmount * totalRate
  const total = financeAmount + profit
  const adminFee = Math.min(financeAmount * adminRate, adminCap)
  const netAmount = financeAmount - adminFee

  return {
    installment: money(installment),
    financeAmount: money(financeAmount),
    profit: money(profit),
    total: money(total),
    adminFee: money(adminFee),
    netAmount: money(netAmount),
  }
}

export function calculateEhtisab(input: {
  financeType: FinanceType
  customerType: CustomerType
  birthDate: string
  salary: number
  deductions: number
  annualRate: number
  months: number

  realEstateType?: RealEstateType
  realEstateProduct?: RealEstateProduct
  supportType?: SupportType
  bank?: string
}) {
  const age = calculateAge(input.birthDate)
  const allowedMonths = maxMonths(age, input.financeType, input.customerType)

  if (!input.birthDate) return zero("يرجى إدخال تاريخ الميلاد")
  if (allowedMonths <= 0) return zero("تم الرفض بسبب أن العمر لا يطابق سياسات التمويل.")
  if (input.months > allowedMonths) return zero("عدد الأشهر المدخلة يتجاوز المسموح.")
  if (input.annualRate > 20) return zero("النسبة أعلى من الحد المسموح 20%.")

  const availableSalary = Math.max(0, input.salary - input.deductions)

  if (input.financeType === "personal") {
    const ratio = input.customerType === "retired" ? 0.25 : 0.3333
    const installment = availableSalary * ratio

    if (input.months < 6) return zero("المدة أقل من الحد الأدنى 6 أشهر.")

    const result = calculateByInstallment({
      installment,
      annualRate: input.annualRate,
      months: input.months,
      adminRate: 0.005,
      adminCap: 2500,
    })

    if (result.financeAmount < 5000) {
      return zero("التمويل أقل من الحد الأدنى المسموح 5000")
    }

    return {
      accepted: true,
      reason: "",
      ...result,
      checkAmount: 0,
      downPayment: 0,
      supportPackage: 0,
      propertyValue: 0,
      months: input.months,
      age,
      allowedMonths,
    }
  }

  const supportType = input.supportType ?? "none"
  const realEstateType = input.realEstateType ?? "normal"
  const product = input.realEstateProduct ?? "ready"

  if (product === "mortgage" && realEstateType === "supported") {
    return zero("الرهن العقاري متاح للاعتيادي فقط.")
  }

  if (input.months < 24) return zero("المدة أقل من الحد الأدنى 24 شهر.")

  let ratio = 0.55

  if (realEstateType === "supported" && supportType === "monthly") ratio = 0.65
  else ratio = input.salary >= 15000 ? 0.65 : 0.55

  const installment = availableSalary * ratio

  if (installment < 500) return zero("القسط أقل من الحد الأدنى.")

  const result = calculateByInstallment({
    installment,
    annualRate: input.annualRate,
    months: input.months,
    adminRate: 0.01,
    adminCap: 5000,
  })

  if (result.financeAmount > 2500000) {
    result.financeAmount = 2500000
  }

  if ((product === "selfBuild" || product === "land") && result.financeAmount < 100000) {
    return zero("التمويل أقل من الحد الأدنى المسموح به 100,000 للبناء الذاتي / تمويل شراء أرض")
  }

  if ((product === "ready" || product === "mortgage") && result.financeAmount < 200000) {
    return zero("التمويل أقل من الحد الأدنى المسموح 200,000 لمنتجات شراء وحدة جاهزة / تمويل رهن عقاري")
  }

  let requiredDownPayment = 0
  if (product === "ready") requiredDownPayment = realEstateType === "supported" ? result.financeAmount * 0.05 : result.financeAmount * 0.10
  if (product === "land") requiredDownPayment = result.financeAmount * 0.30

  let supportPackage = 0
  if (realEstateType === "supported" && supportType === "downPaymentPackage") {
    if (!input.bank?.includes("الأهلي")) {
      return zero("البنك المحدد لا يوفر هذا الخيار.")
    }
    supportPackage = input.salary < 10000 ? 150000 : 100000
  }

  const downPayment = Math.max(0, requiredDownPayment - supportPackage)
  const propertyValue = result.financeAmount + requiredDownPayment
  const checkAmount = result.financeAmount + supportPackage + downPayment

  return {
    accepted: true,
    reason: "",
    ...result,
    downPayment: money(downPayment),
    supportPackage: money(supportPackage),
    propertyValue: money(propertyValue),
    checkAmount: money(checkAmount),
    months: input.months,
    age,
    allowedMonths,
  }
}
