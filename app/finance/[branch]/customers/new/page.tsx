"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

export default function NewFinanceCustomerPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [groups, setGroups] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);

  const [groupId, setGroupId] = useState("");
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");
  const [work, setWork] = useState("");
  const [salary, setSalary] = useState("");
  const [bank, setBank] = useState("");
  const [broker, setBroker] = useState("");

  useEffect(() => {
    loadGroups();
  }, [branch]);

  async function loadGroups() {
    const currentBranchId = await getBranchId(branch);

    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setGroups([]);
      return;
    }

    const { data } = await supabase
      .from("finance_customer_groups")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    setGroups(data || []);
  }

  async function createCustomer() {
    if (
      !branchId ||
      !groupId ||
      !fullName ||
      !nationalId ||
      !birthDay ||
      !birthMonth ||
      !birthYear ||
      !phone
    ) {
      alert("أكمل البيانات المطلوبة");
      return;
    }

    const cleanNationalId = normalizeNumber(nationalId);
    const cleanPhone = normalizeNumber(phone);

    if (cleanNationalId.length !== 10) {
      alert("رقم الهوية يجب أن يكون 10 أرقام");
      return;
    }

    if (cleanPhone.length !== 10) {
      alert("رقم الجوال يجب أن يكون 10 أرقام");
      return;
    }

    const birthHijri = `${birthDay}/${birthMonth}/${birthYear}`;

    const { data: customerData, error } = await supabase
      .from("finance_customers")
      .insert([
        {
          branch_id: branchId,
          group_id: groupId,
          full_name: fullName,
          national_id: cleanNationalId,
          birth_hijri: birthHijri,
          phone: cleanPhone,
          work,
          salary: salary ? toNumber(salary) : null,
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
        branch_id: branchId,
        activity_type: "إنشاء عميل",
        description: `تم إنشاء عميل جديد باسم ${fullName}`,
        customer_id: customerData.id,
        customer_name: fullName,
        employee_name: "المدير",
        status: "جديد",
      },
    ]);

    alert("تم إنشاء العميل بنجاح");

    window.location.href = `/finance/${branch}/customers/${customerData.id}`;
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

          <input
            style={input}
            placeholder="الاسم كاملاً"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <input
            style={input}
            inputMode="numeric"
            maxLength={10}
            placeholder="رقم الهوية"
            value={nationalId}
            onChange={(e) => setNationalId(normalizeNumber(e.target.value))}
          />

          <div style={dateGrid}>
            <input
              style={input}
              inputMode="numeric"
              placeholder="اليوم هجري"
              value={birthDay}
              onChange={(e) => setBirthDay(normalizeNumber(e.target.value))}
            />

            <input
              style={input}
              inputMode="numeric"
              placeholder="الشهر هجري"
              value={birthMonth}
              onChange={(e) => setBirthMonth(normalizeNumber(e.target.value))}
            />

            <input
              style={input}
              inputMode="numeric"
              placeholder="السنة هجري"
              value={birthYear}
              onChange={(e) => setBirthYear(normalizeNumber(e.target.value))}
            />
          </div>

          <input
            style={input}
            inputMode="numeric"
            maxLength={10}
            placeholder="رقم الجوال"
            value={phone}
            onChange={(e) => setPhone(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            placeholder="العمل ( اختياري )"
            value={work}
            onChange={(e) => setWork(e.target.value)}
          />

          <input
            style={input}
            inputMode="numeric"
            placeholder="الراتب ( اختياري )"
            value={salary}
            onChange={(e) => setSalary(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            placeholder="البنك ( اختياري )"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
          />

          <input
            style={input}
            placeholder="الوسيط ( اختياري )"
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
          />

          <button style={primaryButton} onClick={createCustomer}>
            إنشاء العميل
          </button>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}/customers`)}
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

const dateGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
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
