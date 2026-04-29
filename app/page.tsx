"use client"

import { useMemo, useState } from "react"

type FinanceType = "personal" | "realEstate" | "both"
type Sector = "civil" | "private" | "military" | "retired"
type Rank = "soldier" | "corporal" | "agent" | "sergeant" | "chief"
type RealEstateType = "supported" | "normal"
type Product = "ready" | "selfBuild" | "land" | "mortgage"
type Support = "none" | "monthly" | "package"

const ranks: Record<Rank, number> = {
  soldier: 44 * 12,
  corporal: 46 * 12,
  agent: 48 * 12,
  sergeant: 50 * 12,
  chief: 52 * 12,
}

function money(n: number) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseHijri(value: string) {
  const p = value.replaceAll("/", "-").split("-").map(Number)
  return { y: p[0] || 0, m: p[1] || 1, d: p[2] || 1 }
}

function todayHijri() {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date())

  return {
    y: Number(parts.find(p => p.type === "year")?.value || 1446),
    m: Number(parts.find(p => p.type === "month")?.value || 1),
    d: Number(parts.find(p => p.type === "day")?.value || 1),
  }
}

function ageMonthsHijri(birth: string) {
  const b = parseHijri(birth)
  const t = todayHijri()
  let months = (t.y - b.y) * 12 + (t.m - b.m)
  if (t.d < b.d) months -= 1
  return months
}

function maxAgeMonths(sector: Sector, rank: Rank) {
  if (sector === "retired") return 70 * 12
  if (sector === "military") return ranks[rank]
  return 60 * 12
}

function totalRate(rate: number, months: number) {
  return (rate / 100 / 12) * months
}

function calcFromInstallment(installment: number, rate: number, months: number, feeRate: number, feeCap: number) {
  const totalInstallments = installment * months
  const r = totalRate(rate, months)
  const finance = totalInstallments / (1 + r)
  const profit = finance * r
  const total = finance + profit
  const fee = Math.min(finance * feeRate, feeCap)

  return {
    installment,
    finance,
    profit,
    total,
    fee,
    net: finance - fee,
  }
}

function zero(reason: string) {
  return {
    accepted: false,
    reason,
    personal: null as any,
    realEstate: null as any,
  }
}

function calculate(input: any) {
  const ageM = ageMonthsHijri(input.birthHijri)
  const maxAge = maxAgeMonths(input.sector, input.rank)
  const remaining = Math.max(0, maxAge - ageM)

  if (!input.birthHijri) return zero("يرجى إدخال تاريخ الميلاد الهجري")
  if (input.rate > 20) return zero("النسبة أعلى من الحد المسموح 20%")
  if (remaining <= 0) return zero("تم الرفض بسبب أن العمر لا يطابق سياسات التمويل")

  const minSalaryPersonal: any = { civil: 3000, private: 7000, military: 4000, retired: 2000 }
  const minSalaryReal: any = { civil: 5000, private: 7000, military: 5000, retired: 5000 }

  if (input.financeType === "personal" && input.salary < minSalaryPersonal[input.sector]) {
    return zero("تم الرفض بسبب أن الراتب أقل من الحد الأدنى للسياسات التمويلية")
  }

  if (input.financeType !== "personal" && input.salary < minSalaryReal[input.sector]) {
    return zero("تم الرفض بسبب أن الراتب أقل من الحد الأدنى للسياسات التمويلية")
  }

  let personal = null as any

  if (input.financeType === "personal" || input.financeType === "both") {
    const months = Math.min(input.personalMonths, 60, remaining)

    if (input.personalMonths > Math.min(60, remaining)) {
      return zero("عدد الأشهر المدخلة يتجاوز المسموح")
    }

    if (months < 6) return zero("المدة أقل من الحد الأدنى 6 أشهر")

    const ratio = input.sector === "retired" ? 0.25 : 0.3333
    const threshold = input.sector === "retired" ? 0.20 : 0.1167

    let installment = input.salary * ratio

    if (input.deductions > input.salary * threshold) {
      installment = input.salary * 0.45 - input.deductions
    }

    if (installment <= 0) {
      return zero("تم الرفض بسبب تجاوز الاستقطاعات سياسات التمويل")
    }

    personal = calcFromInstallment(installment, input.rate, months, 0.005, 2500)

    if (personal.finance < 5000) {
      return zero("التمويل أقل من الحد الأدنى المسموح 5000")
    }

    personal.months = months
  }

  let realEstate = null as any

  if (input.financeType === "realEstate" || input.financeType === "both") {
    if (input.product === "mortgage" && input.realEstateType === "supported") {
      return zero("الرهن العقاري متاح للاعتيادي فقط")
    }

    const maxMonths = Math.min(360, remaining)

    if (input.realMonths > maxMonths) {
      return zero("عدد الأشهر المدخلة يتجاوز المسموح")
    }

    if (input.realMonths < 24) {
      return zero("المدة أقل من الحد الأدنى 24 شهر")
    }

    let ratio = 0.55

    if (input.realEstateType === "supported" && input.support === "monthly") ratio = 0.65
    else ratio = input.salary >= 15000 ? 0.65 : 0.55

    const maxInstallment = input.salary * ratio
    const firstAvailable = maxInstallment - input.deductions - (personal?.installment || 0)
    const secondAvailable = maxInstallment - input.deductions

    if (firstAvailable < 500) return zero("القسط أقل من الحد الأدنى")

    let totalInstallments = 0
    let firstMonths = 0
    let secondMonths = 0
    let firstInstallment = firstAvailable
    let secondInstallment = 0

    if (input.flex && input.financeType === "both") {
      firstMonths = Math.min(personal?.months || 0, 60, input.realMonths)
      secondMonths = input.realMonths - firstMonths
      firstInstallment = input.flexInstallment

      if (firstInstallment < 500) return zero("القسط أقل من الحد الأدنى المسموح")
      if (firstInstallment > firstAvailable) return zero("القسط المرن أعلى من المتاح")

      secondInstallment = secondMonths > 0 ? secondAvailable : 0

      totalInstallments = (firstInstallment * firstMonths) + (secondInstallment * secondMonths)
    } else {
      firstMonths = input.realMonths
      firstInstallment = firstAvailable
      totalInstallments = firstInstallment * input.realMonths
    }

    const r = totalRate(input.rate, input.realMonths)
    let finance = totalInstallments / (1 + r)

    if (finance > 2500000) finance = 2500000

    const min = input.product === "land" || input.product === "selfBuild" ? 100000 : 200000

    if (finance < min) {
      return zero(
        min === 100000
          ? "التمويل أقل من الحد الأدنى المسموح به 100,000 للبناء الذاتي / تمويل شراء أرض"
          : "التمويل أقل من الحد الأدنى المسموح 200,000 لمنتجات شراء وحدة جاهزة / تمويل رهن عقاري"
      )
    }

    const profit = finance * r
    const total = finance + profit
    const fee = Math.min(finance * 0.01, 5000)

    let requiredDown = 0
    if (input.product === "ready") requiredDown = input.realEstateType === "supported" ? finance * 0.05 : finance * 0.10
    if (input.product === "land") requiredDown = finance * 0.30

    let supportPackage = 0

    if (input.realEstateType === "supported" && input.support === "package") {
      if (!input.bank.includes("الأهلي")) return zero("البنك المحدد لا يوفر هذا الخيار")
      supportPackage = input.salary < 10000 ? 150000 : 100000
    }

    const clientDown = Math.max(0, requiredDown - supportPackage)
    const checkAmount = finance + supportPackage + clientDown

    realEstate = {
      installment: firstInstallment,
      secondInstallment,
      firstMonths,
      secondMonths,
      finance,
      profit,
      total,
      fee,
      net: finance - fee,
      clientDown,
      supportPackage,
      checkAmount,
      propertyValue: finance + requiredDown,
      months: input.realMonths,
    }
  }

  return {
    accepted: true,
    reason: "",
    age: Math.floor(ageM / 12),
    personal,
    realEstate,
  }
}

export default function Home() {
  const [financeType, setFinanceType] = useState<FinanceType>("personal")
  const [sector, setSector] = useState<Sector>("civil")
  const [rank, setRank] = useState<Rank>("agent")
  const [birthHijri, setBirthHijri] = useState("1400-01-01")
  const [salary, setSalary] = useState(10000)
  const [deductions, setDeductions] = useState(0)
  const [rate, setRate] = useState(3)
  const [personalMonths, setPersonalMonths] = useState(60)
  const [realMonths, setRealMonths] = useState(240)

  const [realEstateType, setRealEstateType] = useState<RealEstateType>("normal")
  const [product, setProduct] = useState<Product>("ready")
  const [support, setSupport] = useState<Support>("none")
  const [bank, setBank] = useState("البنك الأهلي السعودي")

  const [flex, setFlex] = useState(false)
  const [flexInstallment, setFlexInstallment] = useState(500)

  const result = useMemo(() => calculate({
    financeType,
    sector,
    rank,
    birthHijri,
    salary,
    deductions,
    rate,
    personalMonths,
    realMonths,
    realEstateType,
    product,
    support,
    bank,
    flex,
    flexInstallment,
  }), [financeType, sector, rank, birthHijri, salary, deductions, rate, personalMonths, realMonths, realEstateType, product, support, bank, flex, flexInstallment])

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "#eef5ff", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 560, margin: "auto" }}>
        <div style={{ background: "linear-gradient(135deg,#0d47a1,#1976d2)", color: "white", borderRadius: 24, padding: 24, marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 32 }}>احتساب</h1>
          <p>منصة احتساب التمويل الشخصي والعقاري</p>
        </div>

        <Card title="المدخلات">
          <Select label="نوع التمويل" value={financeType} set={setFinanceType} options={[
            ["personal", "تمويل شخصي"],
            ["realEstate", "تمويل عقاري"],
            ["both", "شخصي + عقاري"],
          ]} />

          <Select label="القطاع" value={sector} set={setSector} options={[
            ["civil", "حكومي مدني"],
            ["private", "قطاع خاص"],
            ["military", "عسكري"],
            ["retired", "متقاعد"],
          ]} />

          {sector === "military" && (
            <Select label="الرتبة" value={rank} set={setRank} options={[
              ["soldier", "جندي / جندي أول"],
              ["corporal", "عريف"],
              ["agent", "وكيل رقيب"],
              ["sergeant", "رقيب / رقيب أول"],
              ["chief", "رئيس رقباء"],
            ]} />
          )}

          <Input label="تاريخ الميلاد الهجري" value={birthHijri} set={setBirthHijri} />
          <Input label="صافي الراتب" value={salary} set={setSalary} type="number" />
          <Input label="الاستقطاعات" value={deductions} set={setDeductions} type="number" />
          <Input label="النسبة السنوية" value={rate} set={setRate} type="number" />

          {(financeType === "personal" || financeType === "both") && (
            <Input label="مدة التمويل الشخصي" value={personalMonths} set={setPersonalMonths} type="number" />
          )}

          {(financeType === "realEstate" || financeType === "both") && (
            <>
              <Input label="مدة التمويل العقاري" value={realMonths} set={setRealMonths} type="number" />
              <Select label="نوع العقاري" value={realEstateType} set={setRealEstateType} options={[
                ["supported", "مدعوم"],
                ["normal", "اعتيادي"],
              ]} />
              <Select label="منتج العقاري" value={product} set={setProduct} options={[
                ["ready", "شراء وحدة جاهزة"],
                ["selfBuild", "بناء ذاتي"],
                ["land", "شراء أرض"],
                ["mortgage", "رهن عقاري"],
              ]} />
              <Select label="نوع الدعم" value={support} set={setSupport} options={[
                ["none", "بدون"],
                ["monthly", "دعم شهري"],
                ["package", "باقة الدفعة المقدمة"],
              ]} />
              <Input label="البنك" value={bank} set={setBank} />
            </>
          )}

          {financeType === "both" && (
            <>
              <label style={{ display: "block", marginTop: 12 }}>
                <input type="checkbox" checked={flex} onChange={e => setFlex(e.target.checked)} /> تفعيل القسط المرن
              </label>
              {flex && <Input label="قسط الفترة الأولى للمرن" value={flexInstallment} set={setFlexInstallment} type="number" />}
            </>
          )}
        </Card>

        <Card title="النتائج">
          {!result.accepted && <div style={{ color: "#991b1b", background: "#fee2e2", padding: 12, borderRadius: 12 }}>{result.reason}</div>}

          {result.accepted && (
            <>
              <Row k="العمر" v={`${result.age} سنة`} />

              {result.personal && (
                <>
                  <h3>التمويل الشخصي</h3>
                  <Row k="القسط" v={`${money(result.personal.installment)} ر.س`} />
                  <Row k="مبلغ التمويل" v={`${money(result.personal.finance)} ر.س`} />
                  <Row k="الربح" v={`${money(result.personal.profit)} ر.س`} />
                  <Row k="الإجمالي" v={`${money(result.personal.total)} ر.س`} />
                  <Row k="الرسوم" v={`${money(result.personal.fee)} ر.س`} />
                  <Row k="الصافي" v={`${money(result.personal.net)} ر.س`} />
                </>
              )}

              {result.realEstate && (
                <>
                  <h3>التمويل العقاري</h3>
                  <Row k="قسط الفترة الأولى" v={`${money(result.realEstate.installment)} ر.س`} />
                  {result.realEstate.secondMonths > 0 && <Row k="قسط الفترة الثانية" v={`${money(result.realEstate.secondInstallment)} ر.س`} />}
                  <Row k="مبلغ التمويل" v={`${money(result.realEstate.finance)} ر.س`} />
                  <Row k="الربح" v={`${money(result.realEstate.profit)} ر.س`} />
                  <Row k="الإجمالي مع الفوائد" v={`${money(result.realEstate.total)} ر.س`} />
                  <Row k="الرسوم" v={`${money(result.realEstate.fee)} ر.س`} />
                  <Row k="الصافي" v={`${money(result.realEstate.net)} ر.س`} />
                  <Row k="مبلغ الدفعة المقدمة من العميل" v={`${money(result.realEstate.clientDown)} ر.س`} />
                  <Row k="باقة الدفعة المقدمة" v={`${money(result.realEstate.supportPackage)} ر.س`} />
                  <Row k="قيمة العقار" v={`${money(result.realEstate.propertyValue)} ر.س`} />
                  <Row k="مبلغ الشيك" v={`${money(result.realEstate.checkAmount)} ر.س`} />
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </main>
  )
}

function Card({ title, children }: any) {
  return <section style={{ background: "white", borderRadius: 24, padding: 20, marginBottom: 16, boxShadow: "0 10px 30px rgba(13,71,161,.08)" }}><h2 style={{ color: "#0d47a1" }}>{title}</h2>{children}</section>
}

function Input({ label, value, set, type = "text" }: any) {
  return <label style={{ display: "block", marginTop: 12 }}>{label}<input type={type} value={value} onChange={e => set(type === "number" ? Number(e.target.value) : e.target.value)} style={inputStyle} /></label>
}

function Select({ label, value, set, options }: any) {
  return <label style={{ display: "block", marginTop: 12 }}>{label}<select value={value} onChange={e => set(e.target.value)} style={inputStyle}>{options.map((o: any) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>
}

function Row({ k, v }: any) {
  return <div style={{ display: "flex", justifyContent: "space-between", background: "#f4f8ff", padding: 12, borderRadius: 12, marginBottom: 8 }}><span>{k}</span><b style={{ color: "#0d47a1" }}>{v}</b></div>
}

const inputStyle = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  marginTop: 6,
  fontSize: 16,
}
