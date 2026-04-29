"use client"

import { useEffect, useState } from "react"

type FinanceType = "personal" | "real" | "both"
type Sector = "civil" | "semi" | "private" | "military" | "retired"
type Rank = "soldier" | "corporal" | "agent" | "sergeant" | "chief"
type RealEstateType = "normal" | "supported"
type Product = "ready" | "selfBuild" | "land" | "mortgage"
type SupportType = "none" | "monthly" | "package"

function format(n: number) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatCheck(n: number) {
  const v = Math.round(Number(n || 0) * 100) / 100
  if (v % 1 === 0) return v.toLocaleString("en-US", { maximumFractionDigits: 0 })
  return format(v)
}

function todayHijri() {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date())

  return {
    y: Number(parts.find(p => p.type === "year")?.value),
    m: Number(parts.find(p => p.type === "month")?.value),
    d: Number(parts.find(p => p.type === "day")?.value),
  }
}

export default function Home() {
  const [financeType, setFinanceType] = useState<FinanceType>("personal")
  const [sector, setSector] = useState<Sector>("civil")
  const [rank, setRank] = useState<Rank>("agent")

  const [birthY, setBirthY] = useState("")
  const [birthM, setBirthM] = useState("")
  const [birthD, setBirthD] = useState("")

  const [salary, setSalary] = useState(0)
  const [deductions, setDeductions] = useState(0)
  const [rate, setRate] = useState(0)

  const [personalMonths, setPersonalMonths] = useState(0)
  const [realMonths, setRealMonths] = useState(0)
  const [allowedPersonalMonths, setAllowedPersonalMonths] = useState(0)
  const [allowedRealMonths, setAllowedRealMonths] = useState(0)

  const [realEstateType, setRealEstateType] = useState<RealEstateType>("normal")
  const [product, setProduct] = useState<Product>("ready")
  const [supportType, setSupportType] = useState<SupportType>("none")
  const [bank, setBank] = useState("")

  const [flex, setFlex] = useState(false)
  const [flexInstallment, setFlexInstallment] = useState(500)

  const [result, setResult] = useState<any>(null)

  function maxAgeMonths() {
    if (sector === "retired") return 70 * 12
    if (sector === "military") {
      if (rank === "soldier") return 44 * 12
      if (rank === "corporal") return 46 * 12
      if (rank === "agent") return 48 * 12
      if (rank === "sergeant") return 50 * 12
      if (rank === "chief") return 52 * 12
    }
    return 60 * 12
  }

  function minAgeMonths() {
    return sector === "military" ? 21 * 12 : 18 * 12
  }

  function calcAgeMonths() {
    if (!birthY || !birthM || !birthD) return 0
    const t = todayHijri()
    let months = (t.y - Number(birthY)) * 12 + (t.m - Number(birthM))
    if (t.d < Number(birthD)) months--
    return months
  }

  function updateAllowedMonths() {
    if (!birthY || !birthM || !birthD) return

    const ageMonths = calcAgeMonths()
    const remaining = Math.max(0, maxAgeMonths() - ageMonths)

    const personalAllowed = Math.min(60, remaining)
    const realAllowed = Math.min(360, remaining)

    setAllowedPersonalMonths(personalAllowed)
    setAllowedRealMonths(realAllowed)

    setPersonalMonths(personalAllowed)
    setRealMonths(realAllowed)
  }

  useEffect(() => {
    updateAllowedMonths()
  }, [birthY, birthM, birthD, sector, rank])

  function minSalaryPersonal() {
    if (sector === "private") return 7000
    if (sector === "military") return 4000
    if (sector === "retired") return 2000
    return 3000
  }

  function minSalaryReal() {
    if (sector === "private") return 7000
    return 5000
  }

  function calcFinance(installment: number, months: number, feeRate: number, feeCap: number) {
    const totalInstallments = installment * months
    const monthlyRate = rate / 100 / 12
    const totalRate = monthlyRate * months

    const finance = totalInstallments / (1 + totalRate)
    const profit = finance * totalRate
    const total = finance + profit
    const fee = Math.min(finance * feeRate, feeCap)
    const net = finance - fee

    return { installment, months, finance, profit, total, fee, net }
  }

  function realEstateRatio() {
    if (realEstateType === "supported" && supportType === "monthly") return 0.65
    return salary >= 15000 ? 0.65 : 0.55
  }

  function requiredDownPayment(finance: number) {
    if (product === "ready") return realEstateType === "supported" ? finance * 0.05 : finance * 0.10
    if (product === "land") return finance * 0.30
    return 0
  }

  function minRealEstateFinance() {
    if (product === "land" || product === "selfBuild") return 100000
    return 200000
  }

  function supportPackageAmount() {
    if (realEstateType !== "supported") return 0
    if (supportType !== "package") return 0
    if (!bank.includes("الأهلي")) return -1
    return salary < 10000 ? 150000 : 100000
  }

  function calculate() {
    if (!birthY || !birthM || !birthD) {
      setResult({ accepted: false, reason: "يرجى إدخال تاريخ الميلاد الهجري" })
      return
    }

    const ageMonths = calcAgeMonths()
    const ageYears = Math.floor(ageMonths / 12)

    if (ageMonths < minAgeMonths()) {
      setResult({ accepted: false, reason: "تم الرفض بسبب أن العمر لا يطابق سياسات التمويل" })
      return
    }

    if (ageMonths >= maxAgeMonths()) {
      setResult({ accepted: false, reason: "تم الرفض بسبب أن العمر لا يطابق سياسات التمويل" })
      return
    }

    if (rate > 20) {
      setResult({ accepted: false, reason: "النسبة أعلى من الحد المسموح 20%" })
      return
    }

    if ((financeType === "personal" || financeType === "both") && salary < minSalaryPersonal()) {
      setResult({ accepted: false, reason: "تم الرفض بسبب أن الراتب أقل من الحد الأدنى للسياسات التمويلية" })
      return
    }

    if ((financeType === "real" || financeType === "both") && salary < minSalaryReal()) {
      setResult({ accepted: false, reason: "تم الرفض بسبب أن الراتب أقل من الحد الأدنى للسياسات التمويلية" })
      return
    }

    let personalResult: any = null
    let realResult: any = null
    let personalInstallment = 0

    if (financeType === "personal" || financeType === "both") {
      if (personalMonths > allowedPersonalMonths) {
        alert("عدد الأشهر المدخلة يتجاوز المسموح")
        setPersonalMonths(allowedPersonalMonths)
        return
      }

      if (personalMonths < 6) {
        setResult({ accepted: false, reason: "المدة أقل من الحد الأدنى 6 أشهر" })
        return
      }

      const personalRatio = sector === "retired" ? 0.25 : 0.3333
      const deductionThreshold = sector === "retired" ? 0.20 : 0.1167

      personalInstallment = salary * personalRatio

      if (deductions > salary * deductionThreshold) {
        personalInstallment = salary * 0.45 - deductions
      }

      if (personalInstallment <= 0) {
        setResult({ accepted: false, reason: "تم الرفض بسبب تجاوز الاستقطاعات سياسات التمويل" })
        return
      }

      personalResult = calcFinance(personalInstallment, personalMonths, 0.005, 2500)

      if (personalResult.finance < 5000) {
        setResult({ accepted: false, reason: "التمويل أقل من الحد الأدنى المسموح 5000" })
        return
      }
    }

    if (financeType === "real" || financeType === "both") {
      if (product === "mortgage" && realEstateType === "supported") {
        setResult({ accepted: false, reason: "الرهن العقاري متاح للاعتيادي فقط" })
        return
      }

      if (realMonths > allowedRealMonths) {
        alert("عدد الأشهر المدخلة يتجاوز المسموح")
        setRealMonths(allowedRealMonths)
        return
      }

      if (realMonths < 24) {
        setResult({ accepted: false, reason: "المدة أقل من الحد الأدنى 24 شهر" })
        return
      }

      const ratio = realEstateRatio()
      const maxInstallment = salary * ratio

      const firstAvailable = maxInstallment - deductions - personalInstallment
      const secondAvailable = maxInstallment - deductions

      if (firstAvailable < 500) {
        setResult({ accepted: false, reason: "القسط أقل من الحد الأدنى" })
        return
      }

      let firstInstallment = firstAvailable
      let secondInstallment = 0
      let firstMonths = realMonths
      let secondMonths = 0
      let totalInstallments = 0

      if (flex && financeType === "both") {
        firstMonths = Math.min(personalMonths, 60, realMonths)
        secondMonths = realMonths - firstMonths
        firstInstallment = flexInstallment

        if (firstInstallment < 500) {
          setResult({ accepted: false, reason: "القسط أقل من الحد الأدنى المسموح" })
          return
        }

        if (firstInstallment > firstAvailable) {
          setResult({ accepted: false, reason: "القسط المرن أعلى من المتاح" })
          return
        }

        secondInstallment = secondMonths > 0 ? secondAvailable : 0
        totalInstallments = firstInstallment * firstMonths + secondInstallment * secondMonths
      } else {
        totalInstallments = firstAvailable * realMonths
      }

      const monthlyRate = rate / 100 / 12
      const totalRate = monthlyRate * realMonths
      let finance = totalInstallments / (1 + totalRate)

      if (finance > 2500000) finance = 2500000

      if (finance < minRealEstateFinance()) {
        setResult({
          accepted: false,
          reason:
            minRealEstateFinance() === 100000
              ? "التمويل أقل من الحد الأدنى المسموح به 100,000 للبناء الذاتي / تمويل شراء أرض"
              : "التمويل أقل من الحد الأدنى المسموح 200,000 لمنتجات شراء وحدة جاهزة / تمويل رهن عقاري",
        })
        return
      }

      const profit = finance * totalRate
      const total = finance + profit
      const fee = Math.min(finance * 0.01, 5000)
      const net = finance - fee

      const requiredDown = requiredDownPayment(finance)
      const support = supportPackageAmount()

      if (support === -1) {
        setResult({ accepted: false, reason: "البنك المحدد لا يوفر هذا الخيار" })
        return
      }

      const clientDown = Math.max(0, requiredDown - support)
      const propertyValue = finance + requiredDown
      const checkAmount = finance + support + clientDown

      realResult = {
        ratio,
        firstInstallment,
        secondInstallment,
        firstMonths,
        secondMonths,
        months: realMonths,
        finance,
        profit,
        total,
        fee,
        net,
        requiredDown,
        clientDown,
        support,
        propertyValue,
        checkAmount,
      }
    }

    setResult({
      accepted: true,
      ageYears,
      personal: personalResult,
      real: realResult,
    })
  }

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "#eef5ff", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 560, margin: "auto" }}>
        <div style={{ background: "linear-gradient(135deg,#0d47a1,#1976d2)", color: "white", padding: 24, borderRadius: 24 }}>
          <h1>احتساب</h1>
          <p>منصة احتساب التمويل</p>
        </div>

        <section style={card}>
          <label>نوع التمويل</label>
          <select style={input} value={financeType} onChange={e => setFinanceType(e.target.value as FinanceType)}>
            <option value="personal">تمويل شخصي</option>
            <option value="real">تمويل عقاري</option>
            <option value="both">شخصي + عقاري</option>
          </select>

          <label>قطاع العمل</label>
          <select style={input} value={sector} onChange={e => setSector(e.target.value as Sector)}>
            <option value="civil">حكومي مدني</option>
            <option value="semi">شبه حكومي</option>
            <option value="private">قطاع خاص</option>
            <option value="military">عسكري</option>
            <option value="retired">متقاعد</option>
          </select>

          {sector === "military" && (
            <>
              <label>الرتبة العسكرية</label>
              <select style={input} value={rank} onChange={e => setRank(e.target.value as Rank)}>
                <option value="soldier">جندي / جندي أول</option>
                <option value="corporal">عريف</option>
                <option value="agent">وكيل رقيب</option>
                <option value="sergeant">رقيب / رقيب أول</option>
                <option value="chief">رئيس رقباء</option>
              </select>
            </>
          )}

          <label>تاريخ الميلاد الهجري</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input style={input} placeholder="السنة" value={birthY} onChange={e => setBirthY(e.target.value)} />
            <input style={input} placeholder="الشهر" value={birthM} onChange={e => setBirthM(e.target.value)} />
            <input style={input} placeholder="اليوم" value={birthD} onChange={e => setBirthD(e.target.value)} />
          </div>

          <label>الراتب</label>
          <input style={input} type="number" value={salary} onChange={e => setSalary(Number(e.target.value))} />

          <label>الاستقطاعات</label>
          <input style={input} type="number" value={deductions} onChange={e => setDeductions(Number(e.target.value))} />

          <label>النسبة السنوية</label>
          <input style={input} type="number" value={rate} onChange={e => setRate(Number(e.target.value))} />

          {(financeType === "personal" || financeType === "both") && (
            <>
              <label>عدد الأقساط الشخصية - الحد {allowedPersonalMonths}</label>
              <input style={input} type="number" value={personalMonths} onChange={e => setPersonalMonths(Number(e.target.value))} />
            </>
          )}

          {(financeType === "real" || financeType === "both") && (
            <>
              <label>عدد الأقساط العقارية - الحد {allowedRealMonths}</label>
              <input style={input} type="number" value={realMonths} onChange={e => setRealMonths(Number(e.target.value))} />

              <label>نوع العقاري</label>
              <select style={input} value={realEstateType} onChange={e => setRealEstateType(e.target.value as RealEstateType)}>
                <option value="normal">اعتيادي</option>
                <option value="supported">مدعوم</option>
              </select>

              <label>منتج العقاري</label>
              <select style={input} value={product} onChange={e => setProduct(e.target.value as Product)}>
                <option value="ready">شراء وحدة جاهزة</option>
                <option value="selfBuild">بناء ذاتي</option>
                <option value="land">شراء أرض</option>
                <option value="mortgage">رهن عقاري</option>
              </select>

              <label>نوع الدعم</label>
              <select style={input} value={supportType} onChange={e => setSupportType(e.target.value as SupportType)}>
                <option value="none">بدون</option>
                <option value="monthly">دعم شهري</option>
                <option value="package">باقة الدفعة المقدمة</option>
              </select>

              <label>البنك</label>
              <input style={input} value={bank} onChange={e => setBank(e.target.value)} />
            </>
          )}

          {financeType === "both" && (
            <>
              <label style={{ display: "block", marginTop: 12 }}>
                <input type="checkbox" checked={flex} onChange={e => setFlex(e.target.checked)} /> تفعيل القسط المرن
              </label>

              {flex && (
                <>
                  <label>قسط الفترة الأولى للمرن</label>
                  <input style={input} type="number" value={flexInstallment} onChange={e => setFlexInstallment(Number(e.target.value))} />
                </>
              )}
            </>
          )}

          <button onClick={calculate} style={button}>احسب</button>
        </section>

        {result && (
          <section style={card}>
            <h2>النتائج</h2>

            {!result.accepted && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 12 }}>
                {result.reason}
              </div>
            )}

            {result.accepted && (
              <>
                <Row k="العمر" v={`${result.ageYears} سنة`} />

                {result.personal && (
                  <>
                    <h3>التمويل الشخصي</h3>
                    <Row k="عدد الأقساط" v={`${result.personal.months} شهر`} />
                    <Row k="القسط" v={`${format(result.personal.installment)} ر.س`} />
                    <Row k="مبلغ التمويل" v={`${format(result.personal.finance)} ر.س`} />
                    <Row k="الربح" v={`${format(result.personal.profit)} ر.س`} />
                    <Row k="الإجمالي" v={`${format(result.personal.total)} ر.س`} />
                    <Row k="الرسوم" v={`${format(result.personal.fee)} ر.س`} />
                    <Row k="الصافي" v={`${format(result.personal.net)} ر.س`} />
                  </>
                )}

                {result.real && (
                  <>
                    <h3>التمويل العقاري</h3>
                    <Row k="عدد الأقساط" v={`${result.real.months} شهر`} />
                    <Row k="نسبة القسط العقاري" v={`${Math.round(result.real.ratio * 100)}%`} />
                    <Row k="قسط الفترة الأولى" v={`${format(result.real.firstInstallment)} ر.س`} />
                    {result.real.secondMonths > 0 && <Row k="قسط الفترة الثانية" v={`${format(result.real.secondInstallment)} ر.س`} />}
                    <Row k="مبلغ التمويل" v={`${format(result.real.finance)} ر.س`} />
                    <Row k="الربح" v={`${format(result.real.profit)} ر.س`} />
                    <Row k="الإجمالي" v={`${format(result.real.total)} ر.س`} />
                    <Row k="الرسوم" v={`${format(result.real.fee)} ر.س`} />
                    <Row k="الصافي" v={`${format(result.real.net)} ر.س`} />
                    <Row k="مبلغ الدفعة المقدمة من العميل" v={`${format(result.real.clientDown)} ر.س`} />
                    <Row k="باقة الدفعة المقدمة" v={`${format(result.real.support)} ر.س`} />
                    <Row k="قيمة العقار" v={`${format(result.real.propertyValue)} ر.س`} />
                    <Row k="مبلغ الشيك" v={`${formatCheck(result.real.checkAmount)} ر.س`} />
                  </>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

function Row({ k, v }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, background: "#f4f8ff", padding: 12, borderRadius: 12, marginBottom: 8 }}>
      <span>{k}</span>
      <b style={{ color: "#0d47a1", textAlign: "left" }}>{v}</b>
    </div>
  )
}

const card = {
  background: "white",
  padding: 20,
  borderRadius: 24,
  marginTop: 16,
  boxShadow: "0 10px 30px rgba(13,71,161,.08)",
}

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  marginTop: 6,
  marginBottom: 12,
  fontSize: 16,
  boxSizing: "border-box" as const,
}

const button = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 18,
  marginTop: 10,
}
