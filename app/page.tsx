"use client"

import { useEffect, useState } from "react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import {
  calculateEhtisab,
  calculateHijriAgeMonths,
  getMaxAgeMonths,
  type FinanceType,
  type Sector,
  type Rank,
  type RealEstateType,
  type Product,
  type SupportType,
  type EhtisabResult,
} from "@/lib/ehtisabEngine"

function money(n: number) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function Home() {

  const [financeType, setFinanceType] = useState<FinanceType>("personal")
  const [sector, setSector] = useState<Sector>("civil")
  const [rank, setRank] = useState<Rank>("agent")

  const [birthY, setBirthY] = useState("")
  const [birthM, setBirthM] = useState("")
  const [birthD, setBirthD] = useState("")
async function shareResultPDF() {
  const element = document.getElementById("ehtisab-report")
  if (!element) return

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
  })

  const imgData = canvas.toDataURL("image/png")
  const pdf = new jsPDF("p", "mm", "a4")

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = (canvas.height * pageWidth) / canvas.width

  pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight)
  pdf.save("ehtisab-result.pdf")
}
  const [salary, setSalary] = useState(0)
  const [deductions, setDeductions] = useState(0)

  const [personalAnnualRate, setPersonalAnnualRate] = useState(0)
  const [realEstateAnnualRate, setRealEstateAnnualRate] = useState(0)

  const [personalMonths, setPersonalMonths] = useState(0)
  const [realEstateMonths, setRealEstateMonths] = useState(0)

  const [allowedPersonalMonths, setAllowedPersonalMonths] = useState(0)
  const [allowedRealEstateMonths, setAllowedRealEstateMonths] = useState(0)

  const [realEstateType, setRealEstateType] = useState<RealEstateType>("normal")
  const [product, setProduct] = useState<Product>("ready")
  const [supportType, setSupportType] = useState<SupportType>("none")
  const [bank, setBank] = useState("")

  const [flexEnabled, setFlexEnabled] = useState(false)
  const [flexFirstInstallment, setFlexFirstInstallment] = useState(500)

  const [result, setResult] = useState<EhtisabResult | null>(null)

  useEffect(() => {

    if (!birthY || !birthM || !birthD) return

    const ageMonths = calculateHijriAgeMonths(
      Number(birthY),
      Number(birthM),
      Number(birthD)
    )

    const remaining = Math.max(0, getMaxAgeMonths(sector, rank) - ageMonths)

    const personalAllowed = Math.min(60, remaining)
    const realAllowed = Math.min(360, remaining)

    setAllowedPersonalMonths(personalAllowed)
    setAllowedRealEstateMonths(realAllowed)

    setPersonalMonths(personalAllowed)
    setRealEstateMonths(realAllowed)

  }, [birthY, birthM, birthD, sector, rank])
  
useEffect(() => {
  if (realEstateType !== "supported") {
    setSupportType("none")
  }
}, [realEstateType])

  function handleCalculate() {

    const res = calculateEhtisab({
      financeType,
      sector,
      rank,
      birthHijriYear: Number(birthY),
      birthHijriMonth: Number(birthM),
      birthHijriDay: Number(birthD),
      salary,
      deductions,
      personalAnnualRate,
      realEstateAnnualRate,
      personalMonths,
      realEstateMonths,
      realEstateType,
      product,
      supportType,
      bank,
      flexEnabled,
      flexFirstInstallment,
    })

    setResult(res)
  }

  function changePersonalMonths(value: number) {

    if (value > allowedPersonalMonths) {
      alert("عدد الأشهر المدخلة يتجاوز المسموح")
      setPersonalMonths(allowedPersonalMonths)
      return
    }

    setPersonalMonths(value)
  }

  function changeRealMonths(value: number) {

    if (value > allowedRealEstateMonths) {
      alert("عدد الأشهر المدخلة يتجاوز المسموح")
      setRealEstateMonths(allowedRealEstateMonths)
      return
    }

    setRealEstateMonths(value)
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>

        <div style={header}>
          <h1 style={{ margin: 0 }}>احتساب</h1>
          <p style={{ margin: "8px 0 0" }}>منصة إحتساب التمويل المطوره وفق مبادئ التمويل المسؤول حسب تعليمات البنك المركزي </p>
        </div>

        <section style={card}>

          <Field label="نوع التمويل">
            <select style={input} value={financeType} onChange={e => setFinanceType(e.target.value as FinanceType)}>
              <option value="personal">تمويل شخصي</option>
              <option value="real">تمويل عقاري</option>
              <option value="both">شخصي + عقاري ( مع القسط المرن )</option>
            </select>
          </Field>

          <Field label="قطاع العمل">
            <select style={input} value={sector} onChange={e => setSector(e.target.value as Sector)}>
              <option value="civil">حكومي مدني</option>
              <option value="private">قطاع خاص</option>
              <option value="military">عسكري</option>
              <option value="retired">متقاعد</option>
            </select>
          </Field>

          {sector === "military" && (
            <Field label="الرتبة العسكرية">
              <select style={input} value={rank} onChange={e => setRank(e.target.value as Rank)}>
                <option value="soldier">جندي / جندي أول</option>
                <option value="corporal">عريف</option>
                <option value="agent">وكيل رقيب</option>
                <option value="sergeant">رقيب / رقيب أول</option>
                <option value="chief">رئيس رقباء</option>
              </select>
            </Field>
          )}

          <Field label="تاريخ الميلاد بالهجري">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <input style={input} placeholder="السنة" value={birthY} onChange={e => setBirthY(e.target.value)} />
              <input style={input} placeholder="الشهر" value={birthM} onChange={e => setBirthM(e.target.value)} />
              <input style={input} placeholder="اليوم" value={birthD} onChange={e => setBirthD(e.target.value)} />
            </div>
          </Field>

          <Field label="صافي الراتب">
            <input style={input} type="number" value={salary} onChange={e => setSalary(Number(e.target.value))} />
          </Field>

          <Field label="الإستقطاعات الشهرية في سمه">
            <input style={input} type="number" value={deductions} onChange={e => setDeductions(Number(e.target.value))} />
          </Field>

          {(financeType === "personal" || financeType === "both") && (
            <Field label="هامش الربح السنوي للتمويل الشخصي">
              <input style={input} type="number" value={personalAnnualRate} onChange={e => setPersonalAnnualRate(Number(e.target.value))} />
            </Field>
          )}

          {(financeType === "real" || financeType === "both") && (
            <Field label="هامش الربح السنوي للتمويل العقاري">
              <input style={input} type="number" value={realEstateAnnualRate} onChange={e => setRealEstateAnnualRate(Number(e.target.value))} />
            </Field>
          )}

          {(financeType === "personal" || financeType === "both") && (
            <Field label={`عدد الأقساط المتاحه للتمويل الشخصي - ${allowedPersonalMonths}`}>
              <input style={input} type="number" value={personalMonths} onChange={e => changePersonalMonths(Number(e.target.value))} />
            </Field>
          )}

          {(financeType === "real" || financeType === "both") && (
            <>
              <Field label={`عدد الأقساط المتاحه للتمويل العقاري - ${allowedRealEstateMonths}`}>
                <input style={input} type="number" value={realEstateMonths} onChange={e => changeRealMonths(Number(e.target.value))} />
              </Field>

              <Field label="نوع العقاري">
                <select style={input} value={realEstateType} onChange={e => setRealEstateType(e.target.value as RealEstateType)}>
                  <option value="normal">اعتيادي</option>
                  <option value="supported">مدعوم</option>
                </select>
              </Field>

              <Field label="منتج العقاري">
                <select style={input} value={product} onChange={e => setProduct(e.target.value as Product)}>
                  <option value="ready">شراء وحدة جاهزة</option>
                  <option value="selfBuild">بناء ذاتي</option>
                  <option value="land">شراء أرض</option>
                  <option value="mortgage">رهن عقاري</option>
                </select>
              </Field>

              
{realEstateType === "supported" && (
  <Field label="نوع الدعم">
    <select style={input} value={supportType} onChange={e => setSupportType(e.target.value as SupportType)}>
      <option value="none">بدون</option>
      <option value="monthly">دعم شهري</option>
      <option value="package">باقة الدفعة المقدمة</option>
    </select>
  </Field>
)}



              <Field label="البنك (اختياري)">
                <select style={input} value={bank} onChange={e => setBank(e.target.value)}>
                  <option value="">بدون تحديد</option>
                  <option value="البنك الأهلي السعودي">البنك الأهلي السعودي</option>
                  <option value="مصرف الراجحي">مصرف الراجحي</option>
                  <option value="بنك الرياض">بنك الرياض</option>
                  <option value="مصرف الإنماء">مصرف الإنماء</option>
                  <option value="بنك البلاد">بنك البلاد</option>
                  <option value="البنك السعودي الفرنسي">البنك السعودي الفرنسي</option>
                  <option value="ساب">ساب</option>
                </select>
              </Field>
            </>
          )}

          <button style={button} onClick={handleCalculate}>احسب</button>

        </section>

        {result && (
          <section id="ehtisab-report" style={card}>

            <h2 style={{ color: "#0d47a1", marginTop: 0 }}>النتائج</h2>

            {!result.accepted && (
              <div style={error}>{result.reason}</div>
            )}

            {result.accepted && (
              <>
                <Row title="العمر" value={`${result.ageYears} سنة`} />

                {result.personal && (
                  <>
                    <h3>التمويل الشخصي</h3>
                    <Row title="عدد الأقساط" value={`${result.personal.months} شهر`} />
                    <Row title="القسط" value={`${money(result.personal.installment)} ر.س`} />
                    <Row title="مبلغ التمويل" value={`${money(result.personal.financeAmount)} ر.س`} />
                    <Row title="الربح" value={`${money(result.personal.profit)} ر.س`} />
                    <Row title="الإجمالي" value={`${money(result.personal.total)} ر.س`} />
                    <Row title="الرسوم" value={`${money(result.personal.fee)} ر.س`} />
                    <Row title="الصافي" value={`${money(result.personal.net)} ر.س`} />
                  </>
                )}

                {result.realEstate && (
                  <>
                    <h3>التمويل العقاري</h3>
                    <Row title="عدد الأقساط" value={`${result.realEstate.months} شهر`} />
                    <Row title="نسبة القسط العقاري" value={`${Math.round(result.realEstate.ratio * 100)}%`} />
                    <Row title="قسط الفترة الأولى" value={`${money(result.realEstate.firstInstallment)} ر.س`} />

                    {result.realEstate.secondMonths > 0 && (
                      <Row title="قسط الفترة الثانية" value={`${money(result.realEstate.secondInstallment)} ر.س`} />
                    )}

                    <Row title="مبلغ التمويل" value={`${money(result.realEstate.financeAmount)} ر.س`} />
                    <Row title="الربح" value={`${money(result.realEstate.profit)} ر.س`} />
                    <Row title="الإجمالي" value={`${money(result.realEstate.total)} ر.س`} />
                    <Row title="الرسوم" value={`${money(result.realEstate.fee)} ر.س`} />
                    <Row title="الصافي" value={`${money(result.realEstate.net)} ر.س`} />
                    <Row title="مبلغ الدفعة المقدمة من العميل" value={`${money(result.realEstate.clientDownPayment)} ر.س`} />
                    <Row title="باقة الدفعة المقدمة" value={`${money(result.realEstate.supportPackage)} ر.س`} />
                    <Row title="قيمة العقار" value={`${money(result.realEstate.propertyValue)} ر.س`} />
                    <Row title="مبلغ الشيك" value={`${money(result.realEstate.checkAmount)} ر.س`} />
                  </>
                )}
              </>
         )}

{result.accepted && (
  <button
    onClick={shareResultPDF}
    style={{
      width: "100%",
      padding: "14px",
      background: "#2563eb",
      color: "white",
      border: "none",
      borderRadius: "12px",
      fontSize: "18px",
      marginTop: "20px"
    }}
  >
    مشاركة النتيجة
  </button>
)}


          </section>
        )}

      </div>
    </main>
  )
}

function Field({ label, children }: any) {
  return (
    <label style={{ display: "block", marginTop: 14 }}>
      <span style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  )
}

function Row({ title, value }: any) {
  return (
    <div style={row}>
      <span>{title}</span>
      <b style={{ color: "#0d47a1", textAlign: "left" }}>{value}</b>
    </div>
  )
}

const page = { minHeight: "100vh", background: "#eef5ff", padding: 16, fontFamily: "system-ui" }
const container = { maxWidth: 620, margin: "auto" }
const header = { background: "linear-gradient(135deg,#0d47a1,#1976d2)", color: "white", padding: 24, borderRadius: 24, marginBottom: 16 }
const card = { background: "white", padding: 20, borderRadius: 24, marginTop: 16, boxShadow: "0 10px 30px rgba(13,71,161,.08)" }
const input = { width: "100%", padding: 14, borderRadius: 14, border: "1px solid #d9e3f5", fontSize: 16 }
const button = { width: "100%", padding: 16, background: "#0d47a1", color: "white", border: "none", borderRadius: 14, fontSize: 18, marginTop: 18 }
const row = { display: "flex", justifyContent: "space-between", gap: 12, background: "#f4f8ff", padding: 12, borderRadius: 12, marginBottom: 8 }
const error = { background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 12 }
