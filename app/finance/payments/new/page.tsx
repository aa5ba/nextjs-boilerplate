"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

export default function NewPaymentPage() {
  const [search, setSearch] = useState("");
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  const [paymentType, setPaymentType] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");

  useEffect(() => {
    loadContractFromUrl();
  }, []);

  async function loadContractFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const contractId = params.get("contract");

    if (!contractId) return;

    const { data } = await supabase
      .from("finance_contracts")
      .select("*, finance_customers(full_name, national_id, phone)")
      .eq("id", contractId)
      .single();

    if (data) {
      setSelectedContract(data);
    }
  }

  async function searchContracts() {
    if (!search.trim()) {
      alert("اكتب الاسم أو رقم الهوية");
      return;
    }

    const { data } = await supabase
      .from("finance_contracts")
      .select("*, finance_customers(full_name, national_id, phone)")
      .or(
        `finance_customers.full_name.ilike.%${search}%,finance_customers.national_id.ilike.%${search}%`
      )
      .eq("contract_status", "نشط");

    setContracts(data || []);
  }

  async function savePayment() {
    if (!selectedContract || !paymentType || !amount || !method) {
      alert("أكمل بيانات السداد");
      return;
    }

    const paid = Number(amount || 0);
    const oldPaid = Number(selectedContract.paid_amount || 0);
    const debt = Number(selectedContract.debt_amount || 0);

    const newPaid = oldPaid + paid;
    const newRemaining = Math.max(debt - newPaid, 0);
    const newStatus = newRemaining <= 0 ? "تم السداد" : "نشط";

    const { data: paymentData, error: paymentError } = await supabase
      .from("finance_payments")
      .insert([
        {
          contract_id: selectedContract.id,
          payment_amount: paid,
          payment_type: paymentType,
          notes: method,
          created_by: "المدير",
        },
      ])
      .select()
      .single();

    if (paymentError) {
      alert("تعذر تسجيل السداد");
      return;
    }

    const { error: contractError } = await supabase
      .from("finance_contracts")
      .update({
        paid_amount: newPaid,
        remaining_amount: newRemaining,
        contract_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedContract.id);

    if (contractError) {
      alert("تم تسجيل السداد، لكن تعذر تحديث العقد");
      return;
    }

    await supabase.from("finance_activity_logs").insert([
      {
        activity_type: "سداد",
        description: `تم تسجيل سداد للعميل ${
          selectedContract.finance_customers?.full_name || ""
        } بمبلغ ${paid} ر.س`,
        customer_id: selectedContract.customer_id,
        contract_id: selectedContract.id,
        payment_id: paymentData.id,
        customer_name: selectedContract.finance_customers?.full_name || "",
        employee_name: "المدير",
        status: newStatus,
      },
    ]);

    alert("تم تسجيل السداد بنجاح");
    window.location.href = `/finance/contracts/${selectedContract.id}`;
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>إجراء سداد</h1>
        </div>

        <section style={card}>
          <div style={searchRow}>
            <input
              style={input}
              placeholder="بحث بالاسم أو رقم الهوية"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button style={searchButton} onClick={searchContracts}>
              بحث
            </button>
          </div>

          {contracts.map((contract) => (
            <button
              key={contract.id}
              style={contractButton}
              onClick={() => setSelectedContract(contract)}
            >
              عقد رقم {contract.contract_number} -{" "}
              {contract.finance_customers?.full_name}
            </button>
          ))}
        </section>

        {selectedContract && (
          <section style={card}>
            <h2 style={sectionTitle}>
              عقد رقم {selectedContract.contract_number}
            </h2>

            <Row
              label="العميل"
              value={selectedContract.finance_customers?.full_name}
            />
            <Row
              label="مبلغ الدين"
              value={`${selectedContract.debt_amount} ر.س`}
            />
            <Row
              label="المسدد"
              value={`${selectedContract.paid_amount} ر.س`}
            />
            <Row
              label="المتبقي"
              value={`${selectedContract.remaining_amount} ر.س`}
            />

            <select
              style={input}
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
            >
              <option value="">نوع السداد</option>
              <option value="كلي">كلي</option>
              <option value="جزئي">جزئي</option>
            </select>

            <input
              style={input}
              inputMode="numeric"
              placeholder="المبلغ المدفوع"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <select
              style={input}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="">طريقة الدفع</option>
              <option value="نقدًا">نقدًا</option>
              <option value="تحويل">تحويل</option>
              <option value="شبكة">شبكة</option>
              <option value="شيك">شيك</option>
              <option value="تسوية">تسوية</option>
            </select>

            <button style={primaryButton} onClick={savePayment}>
              حفظ السداد
            </button>
          </section>
        )}

        <button
          style={backButton}
          onClick={() => (window.location.href = "/finance/payments")}
        >
          الرجوع للسداد
        </button>
      </div>
    </main>
  );
}

function Row({ label, value }: any) {
  return (
    <div style={row}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
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
  maxWidth: 1100,
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
  marginBottom: 16,
};

const searchRow = {
  display: "grid",
  gridTemplateColumns: "1fr 140px",
  gap: 12,
};

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
};

const searchButton = {
  padding: 14,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  height: 50,
};

const contractButton = {
  width: "100%",
  padding: 14,
  background: "#f8fbff",
  border: "1px solid #d9e3f5",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
  marginTop: 10,
  textAlign: "right" as const,
};

const sectionTitle = {
  marginTop: 0,
  color: "#0d47a1",
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #eef2f7",
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
};
