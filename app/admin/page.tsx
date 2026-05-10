"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function AdminPage() {
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase
        .from("calculations")
        .select("*")
        .order("created_at", { ascending: false })

      if (!error && data) setItems(data)
    }

    loadData()
  }, [])

  return (
    <main dir="rtl" style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>لوحة إدارة احتساب</h1>
      <p>عدد العمليات: {items.length}</p>

      {items.map((item) => (
        <div key={item.id} style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginBottom: 12
        }}>
          <b>نوع التمويل:</b> {item.finance_type}<br />
          <b>الراتب:</b> {item.salary}<br />
          <b>البنك:</b> {item.bank || "غير محدد"}<br />
          <b>القطاع:</b> {item.sector}<br />
          <b>التاريخ:</b> {item.created_at}
        </div>
      ))}
    </main>
  )
}
