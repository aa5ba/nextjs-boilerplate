"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

function money(n: any) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function AdminPage() {
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from("calculations")
        .select("*")
        .order("created_at", { ascending: false })

      setItems(data || [])
    }

    loadData()
  }, [])

  return (
    <main dir="rtl" style={page}>
      <h1>لوحة إدارة احتساب</h1>

      <div style={stats}>
        <div style={statCard}>عدد العمليات: {items.length}</div>
        <div style={statCard}>
          إجمالي الرواتب: {money(items.reduce((s, i) => s + Number(i.salary || 0), 0))} ر.س
        </div>
      </div>

      {items.map((item) => {
        const result = item.result_data?.result || item.result_data
        const personal = result?.personal
        const realEstate = result?.realEstate

        return (
          <div key={item.id} style={card}>
            <h3>عملية تمويل</h3>
            <p><b>نوع التمويل:</b> {item.finance_type}</p>
            <p><b>القطاع:</b> {item.sector}</p>
            <p><b>الراتب:</b> {money(item.salary)} ر.س</p>
            <p><b>البنك:</b> {item.bank || "غير محدد"}</p>
            <p><b>التاريخ:</b> {new Date(item.created_at).toLocaleString("ar-SA")}</p>

            {personal && (
              <div style={box}>
                <b>التمويل الشخصي</b>
                <p>القسط: {money(personal.installment)} ر.س</p>
                <p>مبلغ التمويل: {money(personal.financeAmount)} ر.س</p>
                <p>الربح: {money(personal.profit)} ر.س</p>
                <p>الإجمالي: {money(personal.total)} ر.س</p>
              </div>
            )}

            {realEstate && (
              <div style={box}>
                <b>التمويل العقاري</b>
                <p>القسط الأول: {money(realEstate.firstInstallment)} ر.س</p>
                <p>مبلغ التمويل: {money(realEstate.financeAmount)} ر.س</p>
                <p>الربح: {money(realEstate.profit)} ر.س</p>
                <p>الإجمالي: {money(realEstate.total)} ر.س</p>
              </div>
            )}
          </div>
        )
      })}
    </main>
  )
}

const page = {
  padding: 20,
  fontFamily: "system-ui",
  background: "#eef5ff",
  minHeight: "100vh",
}

const stats = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginBottom: 20,
}

const statCard = {
  background: "white",
  padding: 16,
  borderRadius: 16,
  boxShadow: "0 8px 20px rgba(0,0,0,.06)",
  fontWeight: 700,
}

const card = {
  background: "white",
  padding: 18,
  borderRadius: 18,
  marginBottom: 14,
  boxShadow: "0 8px 20px rgba(0,0,0,.06)",
}

const box = {
  background: "#f4f8ff",
  padding: 12,
  borderRadius: 12,
  marginTop: 10,
}
