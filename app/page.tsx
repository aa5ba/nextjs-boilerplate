'use client'

import { useState } from "react"
import { calculateFinance } from "../lib/ehtisabEngine"

export default function Home() {
  const [salary, setSalary] = useState(8000)
  const [deductions, setDeductions] = useState(1500)
  const [rate, setRate] = useState(3.7)
  const [months, setMonths] = useState(42)
  const [result, setResult] = useState<any>(null)

  function calculate() {
    const finance = calculateFinance({
      salary,
      deductions,
      annualRate: rate,
      months
    })
    setResult(finance)
  }

  const box = {
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #d9e3f5",
    fontSize: "16px",
    boxSizing: "border-box" as const
  }

  return (
    <main dir="rtl" style={{
      minHeight: "100vh",
      background: "#eef5ff",
      padding: "16px",
      fontFamily: "system-ui"
    }}>
      <div style={{
        maxWidth: "520px",
        margin: "0 auto"
      }}>
        <div style={{
          background: "linear-gradient(135deg,#0d47a1,#1976d2)",
          color: "white",
          borderRadius: "24px",
          padding: "28px 22px",
          marginBottom: "18px"
        }}>
          <h1 style={{margin: 0, fontSize: "32px"}}>احتساب</h1>
          <p style={{margin: "8px 0 0", fontSize: "16px"}}>برنامج احتساب التمويل</p>
        </div>

        <section style={{
          background: "white",
          borderRadius: "24px",
          padding: "20px",
          boxShadow: "0 10px 30px rgba(13,71,161,.08)",
          marginBottom: "18px"
        }}>
          <h2 style={{color: "#0d47a1", marginTop: 0}}>المدخلات</h2>

          <label>صافي الراتب</label>
          <input type="number" value={salary} onChange={(e)=>setSalary(Number(e.target.value))} style={box} />

          <div style={{height: 12}} />

          <label>الاستقطاعات الشهرية</label>
          <input type="number" value={deductions} onChange={(e)=>setDeductions(Number(e.target.value))} style={box} />

          <div style={{height: 12}} />

          <label>النسبة السنوية</label>
          <input type="number" value={rate} onChange={(e)=>setRate(Number(e.target.value))} style={box} />

          <div style={{height: 12}} />

          <label>مدة التمويل بالشهور</label>
          <input type="number" value={months} onChange={(e)=>setMonths(Number(e.target.value))} style={box} />

          <button onClick={calculate} style={{
            width: "100%",
            marginTop: "18px",
            padding: "16px",
            border: "none",
            borderRadius: "14px",
            background: "#0d47a1",
            color: "white",
            fontSize: "18px",
            fontWeight: "bold"
          }}>
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
            <h2 style={{color: "#0d47a1", marginTop: 0}}>النتائج</h2>

            <Result label="مبلغ التمويل" value={result.financeAmount} />
            <Result label="القسط الشهري" value={result.installment} />
            <Result label="الأرباح" value={result.profit} />
            <Result label="الرسوم الإدارية" value={result.adminFee} />
            <Result label="صافي التمويل" value={result.netAmount} />
            <Result label="الإجمالي للسداد" value={result.total} />
          </section>
        )}
      </div>
    </main>
  )
}

function Result({label, value}: {label:string, value:number}) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#f4f8ff",
      border: "1px solid #dce8fb",
      padding: "14px",
      borderRadius: "14px",
      marginBottom: "10px"
    }}>
      <span>{label}</span>
      <strong style={{color:"#0d47a1"}}>
        {Number(value).toLocaleString("en-US", {maximumFractionDigits: 2})} ر.س
      </strong>
    </div>
  )
}
