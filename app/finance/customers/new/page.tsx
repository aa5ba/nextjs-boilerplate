"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NewFinanceCustomerPage() {
  const [groups, setGroups] = useState<any[]>([]);

  const [groupId, setGroupId] = useState("");
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [birthHijri, setBirthHijri] = useState("");
  const [phone, setPhone] = useState("");
  const [work, setWork] = useState("");
  const [salary, setSalary] = useState("");
  const [bank, setBank] = useState("");
  const [broker, setBroker] = useState("");

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    const { data } = await supabase
      .from("finance_customer_groups")
      .select("*")
      .order("created_at", { ascending: false });

    setGroups(data || []);
  }

  async function createCustomer() {
    if (!groupId || !fullName || !nationalId || !birthHijri || !phone) {
      alert("أكمل البيانات المطلوبة");
      return;
    }

    const { data: customerData, error } = await supabase
      .from("finance_customers")
      .insert([
        {
          group_id: groupId,
          full_name: fullName,
          national_id: nationalId,
          birth_hijri: birthHijri,
          phone,
          work,
          salary: salary || null,
          bank,
          broker,
        },
      ])
      .select()
      .single();

    if (error) {
      alert("تعذر إنشاء العميل");
      return;
    }

    await supabase.from("finance_activity_logs").insert([
      {
        activity_type: "إنشاء عميل",
        description: `تم إنشاء عميل جديد باسم ${fullName}`,
        customer_id: customerData.id,
        customer_name: fullName,
        employee_name: "المدير",
        status: "جديد",
      },
    ]);

    alert("تم إنشاء العميل بنجاح");

    setGroupId("");
    setFullName("");
    setNationalId("");
    setBirthHijri("");
    setPhone("");
    setWork("");
    setSalary("");
    setBank("");
    setBroker("");
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>إنشاء عميل جديد</h1>
        </div>

        <section style={card}>
          <select
            style={input}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">اختر مجموعة العملاء</option>

            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          <input style={input} placeholder="الاسم كاملاً" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <input style={input} placeholder="رقم الهوية" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          <input style={input} placeholder="تاريخ الميلاد بالهجري" value={birthHijri} onChange={(e) => setBirthHijri(e.target.value)} />
          <input style={input} placeholder="رقم الجوال" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input style={input} placeholder="العمل ( اختياري )" value={work} onChange={(e) => setWork(e.target.value)} />
          <input style={input} placeholder="الراتب ( اختياري )" value={salary} onChange={(e) => setSalary(e.target.value)} />
          <input style={input} placeholder="البنك ( اختياري )" value={bank} onChange={(e) => setBank(e.target.value)} />
          <input style={input} placeholder="الوسيط ( اختياري )" value={broker} onChange={(e) => setBroker(e.target.value)} />

          <button style={primaryButton} onClick={createCustomer}>
            إنشاء العميل
          </button>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = "/finance/customers")}
        >
          الرجوع للعملاء
        </button>
      </div>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container = {
  width: "100%",
  maxWidth: 900,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
};

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
};

const primaryButton = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginTop: 18,
};
