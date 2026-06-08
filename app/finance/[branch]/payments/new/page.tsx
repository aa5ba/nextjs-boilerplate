"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

export default function NewPaymentPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  const [paymentType, setPaymentType] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    initializePage();
  }, [branch]);

  async function initializePage() {
    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setContracts([]);
      setSelectedContract(null);
      return;
    }

    await loadContractFromUrl(currentBranchId);
  }

  async function loadContractFromUrl(currentBranchId: string) {
    const urlParams = new URLSearchParams(window.location.search);
    const contractId = urlParams.get("contract");

    if (!contractId) return;

    const { data } = await supabase
      .from("finance_contracts")
      .select("*")
      .eq("id", contractId)
      .eq("branch_id", currentBranchId)
      .single();

    if (data) {
      setSelectedContract(data);
    }
  }

  async function searchContracts() {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    const rawSearch = search.trim();
    const normalizedSearch = normalizeNumber(rawSearch);

    if (!rawSearch) {
      alert("اكتب الاسم أو رقم الهوية أو رقم العقد");
      return;
    }

    setSearching(true);
    setSelectedContract(null);

    const { data, error } = await supabase
      .from("finance_contracts")
      .select("*")
      .eq("branch_id", branchId)
      .in("contract_status", ["نشط", "متأخر"])
      .or(
  `customer_name.ilike.%${rawSearch}%,customer_national_id.ilike.%${normalizedSearch}%,customer_phone.ilike.%${normalizedSearch}%`
)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setContracts([]);
      setSearching(false);
      return;
    }

    setContracts(data || []);
    setSearching(false);
  }

  async function savePayment() {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    if (!selectedContract || !paymentType || !amount || !method) {
      alert("أكمل بيانات السداد");
      return;
    }

    const paid = toNumber(amount);
    const oldPaid = Number(selectedContract.paid_amount || 0);
    const debt = Number(
      selectedContract.debt_amount ||
        selectedContract.payment_amount ||
        selectedContract.remaining_amount ||
        0
    );

    if (paid <= 0) {
      alert("أدخل مبلغ سداد صحيح");
      return;
    }

    const currentRemaining = Number(
      selectedContract.remaining_amount || debt - oldPaid || 0
    );

    if (paid > currentRemaining) {
      const confirmed = confirm(
        "مبلغ السداد أكبر من المتبقي. هل تريد المتابعة؟"
      );

      if (!confirmed) return;
    }

    try {
      setSaving(true);

      const newPaid = oldPaid + paid;
      const newRemaining = Math.max(debt - newPaid, 0);
      const newStatus = newRemaining <= 0 ? "تم السداد" : "نشط";

      const { data: paymentData, error: paymentError } = await supabase
        .from("finance_payments")
        .insert([
          {
            branch_id: branchId,
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
        alert(paymentError.message || "تعذر تسجيل السداد");
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
        .eq("id", selectedContract.id)
        .eq("branch_id", branchId);

      if (contractError) {
        alert("تم تسجيل السداد، لكن تعذر تحديث العقد");
        return;
      }

      await supabase.from("finance_activity_logs").insert([
        {
          branch_id: branchId,
          activity_type: "سداد",
          description: `تم تسجيل سداد للعميل ${
            selectedContract.customer_name || ""
          } بمبلغ ${paid} ر.س`,
          customer_id: selectedContract.customer_id,
          contract_id: selectedContract.id,
          payment_id: paymentData.id,
          customer_name: selectedContract.customer_name || "",
          employee_name: "المدير",
          status: newStatus,
        },
      ]);

      alert("تم تسجيل السداد بنجاح");
      window.location.href = `/finance/${branch}/contracts/${selectedContract.id}`;
    } finally {
      setSaving(false);
    }
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
              placeholder="بحث بالاسم أو رقم الهوية أو رقم العقد"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchContracts();
              }}
            />

            <button style={searchButton} onClick={searchContracts}>
              {searching ? "..." : "بحث"}
            </button>
          </div>

          {contracts.length === 0 && search.trim() && !searching && (
            <div style={emptyBox}>لا توجد عقود مطابقة</div>
          )}

          {contracts.map((contract) => (
            <button
              key={contract.id}
              style={contractButton}
              onClick={() => {
                setSelectedContract(contract);
                setAmount("");
                setPaymentType("");
                setMethod("");
              }}
            >
              عقد رقم {contract.contract_number || "-"} -{" "}
              {contract.customer_name || "-"} - المتبقي{" "}
              {contract.remaining_amount || 0} ر.س
            </button>
          ))}
        </section>

        {selectedContract && (
          <section style={card}>
            <h2 style={sectionTitle}>
              عقد رقم {selectedContract.contract_number || "-"}
            </h2>

            <Row label="العميل" value={selectedContract.customer_name} />
            <Row
              label="رقم الهوية"
              value={selectedContract.customer_national_id}
            />
            <Row
              label="مبلغ الدين"
              value={`${selectedContract.debt_amount || 0} ر.س`}
            />
            <Row
              label="المسدد"
              value={`${selectedContract.paid_amount || 0} ر.س`}
            />
            <Row
              label="المتبقي"
              value={`${selectedContract.remaining_amount || 0} ر.س`}
            />

            <select
              style={input}
              value={paymentType}
              onChange={(e) => {
                const value = e.target.value;
                setPaymentType(value);

                if (value === "كلي") {
                  setAmount(String(selectedContract.remaining_amount || ""));
                }
              }}
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
              onChange={(e) => setAmount(normalizeNumber(e.target.value))}
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

            <button style={primaryButton} onClick={savePayment} disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ السداد"}
            </button>
          </section>
        )}

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}/payments`)}
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
  boxSizing: "border-box" as const,
};

const searchButton = {
  padding: 14,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  height: 50,
  cursor: "pointer",
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

const emptyBox = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center" as const,
  color: "#6b7280",
  marginTop: 12,
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
  cursor: "pointer",
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#16a34a",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(22,163,74,0.25)",
};
