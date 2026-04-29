'use client'

import { useState } from "react"
import { calculateAge, maxFinanceMonths, calculateFinance } from "../lib/ehtisabEngine"

export default function Home() {
  const [birthDate, setBirthDate] = useState("")
  const [isRetired, setIsRetired] = useState(false)
  const [salary, setSalary] = useState(8000)
  const [deductions, setDeductions] = useState(1500)
  const [rate, setRate] = useState(3.7)
  const [months, setMonths] = useState(60)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  function format(value: number) {
    return Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  function calculate() {
    setError("")

    if (!birthDate) {
      setError("يرجى إدخال تاريخ الميلاد")
      return
    }

    const age = calculateAge(birthDate)
    const maxMonths = maxFinanceMonths(age)

    if (maxMonths <= 0) {
      setError("العمر لا يطابق سياسات التمويل")
      setResult(null)
      return
    }

    if (months > maxMonths) {
      setError("عدد الأشهر المدخلة يتجاوز المسموح")
      setResult(null)
      return
    }

    const finance = calculateFinance({
      salary,
      deductions,
      annualRate: rate,
      months,
      isRetired
    })

    setResult({
      ...finance,
      age,
      maxMonths,
      months
    })
  }

  const inputStyle = {
    width: "100%",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #d9e3f5",
    fontSize: "16px",
    boxSizing: "border-box" as const,
    marginTop: "6px"
  }

  return (
    <main dir="rtl" style={{
      minHeight: "100vh",
      background: "#eef5ff",
      padding: "16px",
      fontFamily: "system-ui"
    }}>
      <div style={{ maxWidth: "520px", margin: "0 auto" }}>
        
        <div style={{
          background: "linear-gradient(135deg,#0d47a1,#1976d2)",
          color: "white",
          borderRadius: "24px",
          padding: "28px 22px",
          marginBottom: "18px"
        }}>
          <h1 style={{ margin: 0, fontSize: "32px" }}>احتساب</h1>
          <p style={{ margin: "8px 0 0", fontSize: "16px" }}>
            برنامج احتساب التمويل
          </p>
        </div>

        <section style={{
          background: "white",
          borderRadius: "24px",
          padding: "20px",
          boxShadow: "0 10px 30px rgba(13,71,161,.08)",
          marginBottom: "18px"
        }}>
          <h2 style={{ color: "#0d47a1", marginTop: 0 }}>المدخلات</h2>

          <label>نوع العميل</label>
          <select
            value={isRetired ? "retired" : "employee"}
            onChange={(e) => setIsRetired(e.target.value === "retired")}
            style={inputStyle}
          >
            <option value="employee">موظف</option>
            <option value="retired">متقاعد</option>
          </select>

          <div style={{ height: 12 }} />

          <label>تاريخ الميلاد</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => {
              setBirthDate(e.target.value)
              const age = calculateAge(e.target.value)
              setMonths(maxFinanceMonths(age))
            }}
            style={inputStyle}
          />

          <div style={{ height: 12 }} />

          <label>صافي الراتب</label>
          <input
            type="number"
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value))}
            style={inputStyle}
          />

          <div style={{ height: 12 }} />

          <label>الاستقطاعات الشهرية</label>
          <input
            type="number"
            value={deductions}
            onChange={(e) => setDeductions(Number(e.target.value))}
            style={inputStyle}
          />

          <div style={{ height: 12 }} />

          <label>النسبة السنوية</label>
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            style={inputStyle}
          />

          <div style={{ height: 12 }} />

          <label>مدة التمويل بالشهور</label>
          <input
            type="number"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            style={inputStyle}
          />
          <p style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
            المدة تظهر تلقائيًا حسب العمر ويمكن تقليلها فقط.
          </p>

          {error && (
            <div style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "12px",
              borderRadius: "12px",
              marginTop: "12px",
              fontWeight: "bold"
            }}>
              {error}
            </div>
          )}

          <button
            onClick={calculate}
            style={{
              width: "100%",
              padding: "16px",
              marginTop: "18px",
              background: "#0d47a1",
              color: "white",
              border: "none",
              borderRadius: "14px",
              fontSize: "18px",
              fontWeight: "bold"
            }}
          >
            احسب النتيجة
          </button>
        </section>

        {result && (
          <section style={{
            background: "white",
            borderRadius: "24px",
            padding: "20px",
            boxShadow: "0 10px 30px rgba(13,71,161,.08)"
          }}>
            <h2 style={{ color: "#0d47a1", marginTop: 0 }}>النتائج</h2>

            <Result label="العمر" value={`${result.age} سنة`} />
            <Result label="المدة المعتمدة" value={`${result.months} شهر`} />
            <Result label="القسط الشهري" value={`${format(result.installment)} ر.س`} />
            <Result label="مبلغ التمويل" value={`${format(result.financeAmount)} ر.س`} />
            <Result label="إجمالي الربح" value={`${format(result.profit)} ر.س`} />
            <Result label="الإجمالي للسداد" value={`${format(result.total)} ر.س`} />
            <Result label="الرسوم الإدارية" value={`${format(result.adminFee)} ر.س`} />
            <Result label="صافي التمويل" value={`${format(result.netAmount)} ر.س`} />
          </section>
        )}
      </div>
    </main>
  )
}

function Result({ label, value }: { label: string, value: string }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#f4f8ff",
      border: "1px solid #dce8fb",
      padding: "14px",
      borderRadius: "14px",
      marginBottom: "10px",
      gap: "12px"
    }}>
      <span>{label}</span>
      <strong style={{ color: "#0d47a1", textAlign: "left" }}>
        {value}
      </strong>
    </div>
  )
}
