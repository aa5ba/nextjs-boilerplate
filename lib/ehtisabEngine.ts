export type FinanceType = "personal" | "real" | "both"
export type Sector =
  | "civil"
  | "private"
  | "semi_government"
  | "military"
  | "retired"
export type Rank = "soldier" | "corporal" | "agent" | "sergeant" | "chief"
export type RealEstateType = "normal" | "supported"
export type Product = "ready" | "selfBuild" | "land" | "mortgage"
export type SupportType = "none" | "monthly" | "package"

export type EhtisabInput = {
  financeType: FinanceType
  sector: Sector
  rank?: Rank

  birthHijriYear: number
  birthHijriMonth: number
  birthHijriDay: number

  salary: number
  deductions: number

  personalAnnualRate: number
  realEstateAnnualRate: number

  personalMonths: number
  realEstateMonths: number

  realEstateType?: RealEstateType
  product?: Product
  supportType?: SupportType
  bank?: string

  flexEnabled?: boolean
  flexFirstInstallment?: number
}

export type RejectResult = {
  accepted: false
  reason: string
}

export type FinanceBlock = {
  months: number
  installment: number
  financeAmount: number
  profit: number
  total: number
  fee: number
  net: number
}

export type RealEstateBlock = FinanceBlock & {
  ratio: number
  firstMonths: number
  secondMonths: number
  firstInstallment: number
  secondInstallment: number
  requiredDownPayment: number
  clientDownPayment: number
  supportPackage: number
  propertyValue: number
  checkAmount: number
}

export type AcceptResult = {
  accepted: true
  ageYears: number
  ageMonths: number
  allowedPersonalMonths: number
  allowedRealEstateMonths: number
  firstInstallmentDate: string
  personal?: FinanceBlock
  realEstate?: RealEstateBlock
}

export type EhtisabResult = RejectResult | AcceptResult

const MILITARY_MAX_AGE_MONTHS: Record<Rank, number> = {
  soldier: 44 * 12,
  corporal: 46 * 12,
  agent: 48 * 12,
  sergeant: 50 * 12,
  chief: 52 * 12,
}

function reject(reason: string): RejectResult {
  return { accepted: false, reason }
}

function isPrivateSalarySector(sector: Sector) {
  return sector === "private" || sector === "semi_government"
}

export function todayHijri() {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date())

  return {
    year: Number(parts.find((p) => p.type === "year")?.value || 0),
    month: Number(parts.find((p) => p.type === "month")?.value || 0),
    day: Number(parts.find((p) => p.type === "day")?.value || 0),
  }
}

export function calculateHijriAgeMonths(year: number, month: number, day: number) {
  const today = todayHijri()

  let months = (today.year - year) * 12 + (today.month - month)

  if (today.day < day) {
    months -= 1
  }

  return months
}

export function getMaxAgeMonths(sector: Sector, rank: Rank = "agent") {
  if (sector === "retired") return 75 * 12
  if (sector === "military") return MILITARY_MAX_AGE_MONTHS[rank]
  return 60 * 12
}

export function getMinAgeMonths(sector: Sector) {
  return sector === "military" ? 21 * 12 : 18 * 12
}

export function getPersonalMinSalary(sector: Sector) {
  if (isPrivateSalarySector(sector)) return 7000
  if (sector === "military") return 4000
  if (sector === "retired") return 2000
  return 3000
}

export function getRealEstateMinSalary(sector: Sector) {
  if (isPrivateSalarySector(sector)) return 7000
  return 5000
}

export function getFirstInstallmentDate(sector: Sector) {
  const today = new Date()
  const day = today.getDate()

  if (sector !== "retired") {
    if (day < 22) return new Date(today.getFullYear(), today.getMonth(), 27)
    return new Date(today.getFullYear(), today.getMonth() + 1, 27)
  }

  if (day < 22) return new Date(today.getFullYear(), today.getMonth() + 1, 1)
  return new Date(today.getFullYear(), today.getMonth() + 2, 1)
}

export function formatGregorianDate(date: Date) {
  return date.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export function getTotalRate(annualRate: number, months: number) {
  return (annualRate / 100 / 12) * months
}

export function calculateFromTotalInstallments(
  totalInstallments: number,
  annualRate: number,
  months: number,
  feeRate: number,
  feeCap: number
) {
  const totalRate = getTotalRate(annualRate, months)
  const financeAmount = totalInstallments / (1 + totalRate)
  const profit = financeAmount * totalRate
  const total = financeAmount + profit
  const fee = Math.min(financeAmount * feeRate, feeCap)
  const net = financeAmount - fee

  return {
    financeAmount,
    profit,
    total,
    fee,
    net,
  }
}

export function calculateFromInstallment(
  installment: number,
  annualRate: number,
  months: number,
  feeRate: number,
  feeCap: number
): FinanceBlock {
  return {
    months,
    installment,
    ...calculateFromTotalInstallments(
      installment * months,
      annualRate,
      months,
      feeRate,
      feeCap
    ),
  }
}

export function getRealEstateRatio(
  realEstateType: RealEstateType,
  supportType: SupportType,
  salary: number
) {
  if (realEstateType === "supported" && supportType === "monthly") return 0.65
  if (realEstateType === "supported" && supportType === "package") {
    return salary >= 15000 ? 0.65 : 0.55
  }

  return salary >= 15000 ? 0.65 : 0.55
}

export function getMinRealEstateFinance(product: Product) {
  if (product === "selfBuild" || product === "land") return 100000
  return 200000
}

export function getRequiredDownPayment(
  product: Product,
  realEstateType: RealEstateType,
  financeAmount: number
) {
  if (product === "ready") {
    return realEstateType === "supported"
      ? financeAmount * 0.05
      : financeAmount * 0.10
  }

  if (product === "land") {
    return financeAmount * 0.30
  }

  return 0
}

export function getSupportPackage(
  realEstateType: RealEstateType,
  supportType: SupportType,
  bank: string,
  salary: number
) {
  if (supportType !== "package") {
    return { ok: true, amount: 0, reason: "" }
  }

  if (realEstateType !== "supported") {
    return {
      ok: false,
      amount: 0,
      reason: "باقة الدفعة المقدمة متاحة للتمويل العقاري المدعوم فقط",
    }
  }

  if (!bank.includes("الأهلي")) {
    return {
      ok: false,
      amount: 0,
      reason: "البنك المحدد لا يوفر هذا الخيار",
    }
  }

  return {
    ok: true,
    amount: salary < 10000 ? 150000 : 100000,
    reason: "",
  }
}

export function calculateEhtisab(input: EhtisabInput): EhtisabResult {
  const rank = input.rank || "agent"
  const realEstateType = input.realEstateType || "normal"
  const product = input.product || "ready"
  const supportType = input.supportType || "none"
  const bank = input.bank || ""

  if (!input.birthHijriYear || !input.birthHijriMonth || !input.birthHijriDay) {
    return reject("يرجى إدخال تاريخ الميلاد الهجري")
  }

  if (input.personalAnnualRate > 20 || input.realEstateAnnualRate > 20) {
    return reject("النسبة أعلى من الحد المسموح 20%")
  }

  if (input.personalAnnualRate < 0 || input.realEstateAnnualRate < 0) {
    return reject("النسبة السنوية غير صحيحة")
  }

  const ageMonths = calculateHijriAgeMonths(
    input.birthHijriYear,
    input.birthHijriMonth,
    input.birthHijriDay
  )

  const ageYears = Math.floor(ageMonths / 12)
  const maxAgeMonths = getMaxAgeMonths(input.sector, rank)
  const minAgeMonths = getMinAgeMonths(input.sector)
  const remainingMonths = Math.max(0, maxAgeMonths - ageMonths)

  const allowedPersonalMonths = Math.min(60, remainingMonths)
  const allowedRealEstateMonths = Math.min(360, remainingMonths)

  if (ageMonths < minAgeMonths || remainingMonths <= 0) {
    return reject("تم الرفض بسبب أن العمر لا يطابق سياسات التمويل")
  }

  if (
    (input.financeType === "personal" || input.financeType === "both") &&
    input.salary < getPersonalMinSalary(input.sector)
  ) {
    return reject("تم الرفض بسبب أن الراتب أقل من الحد الأدنى للسياسات التمويلية")
  }

  if (
    (input.financeType === "real" || input.financeType === "both") &&
    input.salary < getRealEstateMinSalary(input.sector)
  ) {
    return reject("تم الرفض بسبب أن الراتب أقل من الحد الأدنى للسياسات التمويلية")
  }

  let personal: FinanceBlock | undefined
  let personalInstallment = 0

  if (input.financeType === "personal" || input.financeType === "both") {
    if (input.personalMonths > allowedPersonalMonths) {
      return reject("عدد الأشهر المدخلة يتجاوز المسموح")
    }

    if (input.personalMonths < 6) {
      return reject("المدة أقل من الحد الأدنى 6 أشهر")
    }

    const ratio = input.sector === "retired" ? 0.25 : 0.3333
    const deductionThreshold = input.sector === "retired" ? 0.20 : 0.1167

    personalInstallment = input.salary * ratio

    if (input.deductions > input.salary * deductionThreshold) {
      personalInstallment = input.salary * 0.45 - input.deductions
    }

    if (personalInstallment <= 0) {
      return reject("تم الرفض بسبب تجاوز الاستقطاعات سياسات التمويل")
    }

    personal = calculateFromInstallment(
      personalInstallment,
      input.personalAnnualRate,
      input.personalMonths,
      0.005,
      2500
    )

    if (personal.financeAmount < 5000) {
      return reject("التمويل أقل من الحد الأدنى المسموح 5000")
    }
  }

  let realEstate: RealEstateBlock | undefined

  if (input.financeType === "real" || input.financeType === "both") {
    if (product === "mortgage" && realEstateType === "supported") {
      return reject("الرهن العقاري متاح للاعتيادي فقط")
    }

    if (input.realEstateMonths > allowedRealEstateMonths) {
      return reject("عدد الأشهر المدخلة يتجاوز المسموح")
    }

    if (input.realEstateMonths < 24) {
      return reject("المدة أقل من الحد الأدنى 24 شهر")
    }

    const ratio = getRealEstateRatio(realEstateType, supportType, input.salary)
    const maxRealEstateInstallment = input.salary * ratio

    const firstAvailable =
      maxRealEstateInstallment -
      input.deductions -
      (input.financeType === "both" ? personalInstallment : 0)

    const secondAvailable =
      maxRealEstateInstallment -
      input.deductions

    if (firstAvailable < 500) {
      return reject("القسط أقل من الحد الأدنى")
    }

    let firstMonths = input.realEstateMonths
    let secondMonths = 0
    let firstInstallment = firstAvailable
    let secondInstallment = 0
    let totalInstallments = 0

    if (input.financeType === "both") {
      firstMonths = Math.min(input.personalMonths, 60, input.realEstateMonths)
      secondMonths = input.realEstateMonths - firstMonths

      if (input.flexEnabled) {
        firstInstallment = input.flexFirstInstallment || 0

        if (firstInstallment < 500) {
          return reject("القسط أقل من الحد الأدنى المسموح")
        }

        if (firstInstallment > firstAvailable) {
          return reject("القسط المرن أعلى من المتاح")
        }
      }

      secondInstallment = secondMonths > 0 ? secondAvailable : 0

      totalInstallments =
        firstInstallment * firstMonths +
        secondInstallment * secondMonths
    } else {
      totalInstallments = firstAvailable * input.realEstateMonths
    }

    const calculated = calculateFromTotalInstallments(
      totalInstallments,
      input.realEstateAnnualRate,
      input.realEstateMonths,
      0.01,
      5000
    )

    let financeAmount = calculated.financeAmount

    if (financeAmount > 2500000) {
      financeAmount = 2500000
    }

    const minimumFinance = getMinRealEstateFinance(product)

    if (financeAmount < minimumFinance) {
      return reject(
        minimumFinance === 100000
          ? "التمويل أقل من الحد الأدنى المسموح به 100,000 للبناء الذاتي / تمويل شراء أرض"
          : "التمويل أقل من الحد الأدنى المسموح 200,000 لمنتجات شراء وحدة جاهزة / تمويل رهن عقاري"
      )
    }

    const totalRate = getTotalRate(input.realEstateAnnualRate, input.realEstateMonths)
    const profit = financeAmount * totalRate
    const total = financeAmount + profit
    const fee = Math.min(financeAmount * 0.01, 5000)
    const net = financeAmount - fee

    const supportPackage = getSupportPackage(
      realEstateType,
      supportType,
      bank,
      input.salary
    )

    if (!supportPackage.ok) {
      return reject(supportPackage.reason)
    }

    const requiredDownPayment = getRequiredDownPayment(
      product,
      realEstateType,
      financeAmount
    )

    const clientDownPayment = Math.max(0, requiredDownPayment - supportPackage.amount)
    const propertyValue = financeAmount + requiredDownPayment
    const checkAmount = financeAmount + supportPackage.amount + clientDownPayment

    realEstate = {
      ratio,
      months: input.realEstateMonths,
      installment: firstInstallment,
      firstMonths,
      secondMonths,
      firstInstallment,
      secondInstallment,
      financeAmount,
      profit,
      total,
      fee,
      net,
      requiredDownPayment,
      clientDownPayment,
      supportPackage: supportPackage.amount,
      propertyValue,
      checkAmount,
    }
  }

  return {
    accepted: true,
    ageYears,
    ageMonths,
    allowedPersonalMonths,
    allowedRealEstateMonths,
    firstInstallmentDate: formatGregorianDate(
      getFirstInstallmentDate(input.sector)
    ),
    personal,
    realEstate,
  }
}
