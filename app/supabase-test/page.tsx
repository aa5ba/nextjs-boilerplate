"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function SupabaseTestPage() {
  const [status, setStatus] = useState("جاري اختبار الاتصال...")

  useEffect(() => {
    async function testConnection() {
      const { error } = await supabase
        .from("rate_rules")
        .select("id")
        .limit(1)

      if (error) {
        setStatus("فشل الاتصال: " + error.message)
      } else {
        setStatus("تم الاتصال بقاعدة البيانات بنجاح ✅")
      }
    }

    testConnection()
  }, [])

  return (
    <main dir="rtl" style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>اختبار اتصال Supabase</h1>
      <p>{status}</p>
    </main>
  )
}
