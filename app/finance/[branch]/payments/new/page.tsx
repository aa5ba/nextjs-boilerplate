"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

export default function NewPaymentPage() {
  const params = useParams();
  const router = useRouter();
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
  const [loadingContract, setLoadingContract] = useState(false);

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

    setLoadingContract(true);

    const { data, error } = await supabase
      .from("finance_contracts")
      .select("*")
      .eq("id", contractId)
      .eq("branch_id", currentBranchId)
      .single();

    if (error) {
      alert("تعذر تحميل العقد المحدد: " + error.message);
      setLoadingContract(false);
      return;
    }

    if (data) {
      setSelectedContract(data);
      setContracts([data]);
    }

    setLoadingContract(false);
  }

  async function searchContracts() {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    const rawSearch = search.trim();
    const normalizedSearch = normalizeNumber(rawSearch);

    if (!rawSearch) {
      alert("اكتب الاسم أو رقم الهوية أو رقم الجوال أو رقم العقد");
      return;
    }

    setSearching(true);
    setSelectedContract(null);

    const { data, error } = await supabase
      .from("finance_contracts")
      .select("*")
      .eq("branch_id", branchId)
      .or(
        [
          `contract_number.ilike.%${rawSearch}%`,
          `customer_name.ilike.%${rawSearch}%`,
          `customer_national_id.ilike.%${normalizedSearch}%`,
          `customer_phone.ilike.%${normalizedSearch}%`,
        ].join(",")
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setContracts([]);
      setSearching(false);
      return;
    }

    const filteredContracts = (data || []).filter((contract) => {
      const status = String(contract.contract_status || "").trim();
      const remaining = Number(contract.remaining_amount || 0);

      return (
        remaining > 0 &&
        status !== "مغلق" &&
        status !== "closed" &&
        status !== "تم السداد"
      );
    });

    setContracts(filteredContracts);
    setSearching(false);
  }

  function getEmployeeName() {
    if (typeof window === "undefined") return "المدير";

    const newName = localStorage.getItem("finance_user_name");
    if (newName) return newName;

    const oldUser = localStorage.getItem("finance_user");

    if (oldUser) {
      try {
        const parsed = JSON.parse(oldUser);
        return parsed?.full_name || parsed?.username || "المدير";
      } catch {
        return "المدير";
      }
    }

    return "المدير";
  }

  function isDateDue(date?: string | null) {
    if (!date) return false;

    const dueDate = new Date(date);
    const today = new Date();

    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return dueDate <= today;
  }

  function getStatusAfterPayment(remainingAmount: number, dueDate?: string | null) {
    if (remainingAmount <= 0) return "تم السداد";

    if (isDateDue(dueDate)) return "متأخر";

    return "نشط";
  }

  async function refreshSelectedContract(contractId: string) {
    if (!branchId) return;

    const { data } = await supabase
      .from("finance_contracts")
      .select("*")
      .eq("id", contractId)
      .eq("branch_id", branchId)
      .single();

    if (data) {
      setSelectedContract(data);
      setContracts((prev) =>
        prev.map((contract) => (contract.id === data.id ? data : contract))
      );
    }
  }

  async function savePayment() {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    if (!selectedContract) {
      alert("اختر العقد أولاً");
      return;
    }

    if (!paymentType || !amount || !method) {
      alert("أكمل بيانات السداد");
      return;
    }

    const paid = toNumber(amount);
    const oldPaid = Number(selectedContract.paid_amount || 0);
    const oldRemaining = Number(selectedContract.remaining_amount || 0);
    const debt = Number(
      selectedContract.debt_amount ||
        selectedContract.payment_amount ||
        oldPaid + oldRemaining ||
        0
    );

    if (paid <= 0) {
      alert("أدخل مبلغ سداد صحيح");
      return;
    }

    const currentRemaining = oldRemaining || Math.max(debt - oldPaid, 0);

    if (currentRemaining <= 0) {
      alert("هذا العقد لا يوجد عليه مبلغ متبقٍ للسداد");
      return;
    }

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
      const newStatus = getStatusAfterPayment(
        newRemaining,
        selectedContract.payment_due_date
      );

      const { data: paymentData, error: paymentError } = await supabase
        .from("finance_payments")
        .insert([
          {
            branch_id: branchId,
            contract_id: selectedContract.id,
            payment_amount: paid,
            payment_type: paymentType,
            notes: method,
            created_by: getEmployeeName(),
          },
        ])
        .select()
        .single();

      if (paymentError) {
        alert(paymentError.message || "تعذر تسجيل السداد");
        setSaving(false);
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
        alert("تم تسجيل السداد، لكن تعذر تحديث العقد: " + contractError.message);
        setSaving(false);
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
          employee_name: getEmployeeName(),
          status: newStatus,
        },
      ]);

      alert("تم تسجيل السداد بنجاح");

      await refreshSelectedContract(selectedContract.id);

      router.push(`/finance/${branch}/contracts/${selectedContract.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <header style={header}>
          <div style={headerActions}>
            <button style={backButton} onClick={() => router.back()}>
              ← الرجوع
            </button>

            <button
              style={homeButton}
              onClick={() => router.push(`/finance/${branch}`)}
            >
              محطة العمل الرئيسية
            </button>
          </div>

          <h1 style={headerTitle}>إجراء سداد</h1>
        </header>

        <section style={card}>
          <div style={searchRow}>
            <input
              style={input}
              placeholder="بحث بالاسم أو رقم الهوية أو رقم الجوال أو رقم العقد"
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

          {loadingContract && (
            <div style={emptyBox}>جاري تحميل العقد المحدد...</div>
          )}

          {contracts.length === 0 && search.trim() && !searching && (
            <div style={emptyBox}>لا توجد عقود مطابقة قابلة للسداد</div>
          )}

          <div style={contractsList}>
            {contracts.map((contract) => (
              <button
                key={contract.id}
                style={
                  selectedContract?.id === contract.id
                    ? selectedContractButton
                    : contractButton
                }
                onClick={() => {
                  setSelectedContract(contract);
                  setAmount("");
                  setPaymentType("");
                  setMethod("");
                }}
              >
                <strong>عقد رقم {contract.contract_number || "-"}</strong>
                <span>{contract.customer_name || "-"}</span>
                <small>
                  المتبقي {formatMoney(contract.remaining_amount)} ر.س
                </small>
              </button>
            ))}
          </div>
        </section>

        {selectedContract && (
          <section style={card}>
            <div style={selectedHeader}>
              <h2 style={sectionTitle}>
                عقد رقم {selectedContract.contract_number || "-"}
              </h2>

              <span style={remainingPill}>
                المتبقي {formatMoney(selectedContract.remaining_amount)} ر.س
              </span>
            </div>

            <div style={detailsGrid}>
              <Row label="العميل" value={selectedContract.customer_name} />
              <Row
                label="رقم الهوية"
                value={selectedContract.customer_national_id}
              />
              <Row
                label="مبلغ الدين"
                value={`${formatMoney(selectedContract.debt_amount)} ر.س`}
              />
              <Row
                label="المسدد"
                value={`${formatMoney(selectedContract.paid_amount)} ر.س`}
              />
              <Row
                label="المتبقي"
                value={`${formatMoney(selectedContract.remaining_amount)} ر.س`}
              />
            </div>

            <div style={formGrid}>
              <div>
                <label style={label}>نوع السداد</label>
                <select
                  style={input}
                  value={paymentType}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPaymentType(value);

                    if (value === "كلي") {
                      setAmount(String(selectedContract.remaining_amount || ""));
                    }

                    if (value === "جزئي") {
                      setAmount("");
                    }
                  }}
                >
                  <option value="">اختر نوع السداد</option>
                  <option value="كلي">كلي</option>
                  <option value="جزئي">جزئي</option>
                </select>
              </div>

              <div>
                <label style={label}>المبلغ المدفوع</label>
                <input
                  style={input}
                  inputMode="numeric"
                  placeholder="المبلغ المدفوع"
                  value={amount}
                  onChange={(e) => setAmount(normalizeNumber(e.target.value))}
                />
              </div>

              <div>
                <label style={label}>طريقة الدفع</label>
                <select
                  style={input}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="">اختر طريقة الدفع</option>
                  <option value="نقدًا">نقدًا</option>
                  <option value="تحويل">تحويل</option>
                  <option value="شبكة">شبكة</option>
                  <option value="شيك">شيك</option>
                  <option value="تسوية">تسوية</option>
                </select>
              </div>
            </div>

            <button style={primaryButton} onClick={savePayment} disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ السداد"}
            </button>
          </section>
        )}

        <div style={bottomActions}>
          <button style={backButton} onClick={() => router.back()}>
            ← الرجوع
          </button>

          <button
            style={homeButton}
            onClick={() => router.push(`/finance/${branch}`)}
          >
            محطة العمل الرئيسية
          </button>
        </div>
      </div>

      <GlobalResponsiveStyles />
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

function formatMoney(value: any) {
  const number = Number(value || 0);
  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      @media (max-width: 720px) {
        .payment-search-row {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#f4f7fb",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
  color: "#0f172a",
};

const container: CSSProperties = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
};

const header: CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  padding: 24,
  borderRadius: 24,
  marginBottom: 18,
  boxShadow: "0 14px 30px rgba(15,23,42,.16)",
};

const headerActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "space-between",
  marginBottom: 18,
};

const headerTitle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.4,
};

const backButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,.20)",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,.20)",
};

const homeButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,.20)",
  background: "linear-gradient(135deg,#16a34a,#15803d)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(21,128,61,.25)",
};

const card: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 18,
  marginBottom: 16,
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const searchRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 130px",
  gap: 12,
};

const input: CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  fontSize: 16,
  marginBottom: 12,
  boxSizing: "border-box",
  background: "#f8fafc",
  fontFamily: "inherit",
};

const searchButton: CSSProperties = {
  padding: 14,
  background: "#1e3a8a",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  height: 50,
  cursor: "pointer",
  fontWeight: 900,
};

const contractsList: CSSProperties = {
  display: "grid",
  gap: 10,
};

const contractButton: CSSProperties = {
  width: "100%",
  padding: 14,
  background: "#f8fbff",
  border: "1px solid #d9e3f5",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
  textAlign: "right",
  display: "grid",
  gap: 5,
};

const selectedContractButton: CSSProperties = {
  ...contractButton,
  border: "1px solid #2563eb",
  background: "#eff6ff",
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center",
  color: "#6b7280",
  marginTop: 12,
};

const selectedHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 14,
};

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  color: "#0f172a",
};

const remainingPill: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "8px 12px",
  fontWeight: 900,
};

const detailsGrid: CSSProperties = {
  display: "grid",
  gap: 0,
  marginBottom: 14,
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #eef2f7",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
};

const label: CSSProperties = {
  display: "block",
  fontWeight: 900,
  color: "#334155",
  marginBottom: 7,
};

const primaryButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "linear-gradient(135deg,#2563eb,#1e3a8a)",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  cursor: "pointer",
  fontWeight: 900,
};

const bottomActions: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 18,
};
