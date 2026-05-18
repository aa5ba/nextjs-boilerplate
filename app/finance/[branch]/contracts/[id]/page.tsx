"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function FinanceContractDetailsPage() {
  const params = useParams();

  const branch = params.branch as string;
  const contractId = params.id as string;

  const [contract, setContract] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [branch, contractId]);

  async function loadData() {
    const currentBranchId = await getBranchId(branch);

    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setContract(null);
      setPayments([]);
      return;
    }

    const { data: contractData } = await supabase
      .from("finance_contracts")
      .select("*, finance_customers(full_name, national_id, phone)")
      .eq("id", contractId)
      .eq("branch_id", currentBranchId)
      .single();

    const { data: paymentsData } = await supabase
      .from("finance_payments")
      .select("*")
      .eq("contract_id", contractId)
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    setContract(contractData);
    setPayments(paymentsData || []);
  }

  async function cancelPayment(payment: any) {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    if (payment.is_cancelled) {
      alert("تم إلغاء هذه الدفعة مسبقًا");
      return;
    }

    const confirmed = confirm("هل أنت متأكد من إلغاء الدفعة؟");
    if (!confirmed) return;

    const currentPaid = Number(contract?.paid_amount || 0);
    const debt = Number(contract?.debt_amount || 0);
    const paymentAmount = Number(payment.payment_amount || 0);

    const newPaid = Math.max(currentPaid - paymentAmount, 0);
    const newRemaining = Math.max(debt - newPaid, 0);
    const newStatus = newRemaining <= 0 ? "تم السداد" : "نشط";

    const { error: paymentError } = await supabase
      .from("finance_payments")
      .update({
        is_cancelled: true,
        cancelled_at: new Date().toISOString(),
        cancelled_by: "المدير",
      })
      .eq("id", payment.id)
      .eq("branch_id", branchId);

    if (paymentError) {
      alert("تعذر إلغاء الدفعة");
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
      .eq("id", contractId)
      .eq("branch_id", branchId);

    if (contractError) {
      alert("تم إلغاء الدفعة، لكن تعذر تحديث العقد");
      return;
    }

    await supabase.from("finance_activity_logs").insert([
      {
        branch_id: branchId,
        activity_type: "إلغاء دفعة",
        description: `تم إلغاء دفعة للعميل ${
          contract?.finance_customers?.full_name || ""
        } بمبلغ ${paymentAmount} ر.س`,
        customer_id: contract?.customer_id,
        contract_id: contractId,
        payment_id: payment.id,
        customer_name: contract?.finance_customers?.full_name || "",
        employee_name: "المدير",
        status: newStatus,
      },
    ]);

    await loadData();
    alert("تم إلغاء الدفعة");
  }

  async function closeContract() {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    if (!contract) return;

    const confirmed = confirm("هل أنت متأكد من إغلاق العقد؟");
    if (!confirmed) return;

    const { error } = await supabase
      .from("finance_contracts")
      .update({
        contract_status: "تم السداد",
        remaining_amount: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .eq("branch_id", branchId);

    if (error) {
      alert("تعذر إغلاق العقد");
      return;
    }

    await supabase.from("finance_activity_logs").insert([
      {
        branch_id: branchId,
        activity_type: "إغلاق عقد",
        description: `تم إغلاق عقد العميل ${
          contract?.finance_customers?.full_name || ""
        }`,
        customer_id: contract?.customer_id,
        contract_id: contractId,
        customer_name: contract?.finance_customers?.full_name || "",
        employee_name: "المدير",
        status: "تم السداد",
      },
    ]);

    await loadData();
    alert("تم إغلاق العقد");
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>
            عقد رقم {contract?.contract_number || "-"}
          </h1>
        </div>

        <section style={card}>
          <Row label="العميل" value={contract?.finance_customers?.full_name} />
          <Row
            label="رقم الهوية"
            value={contract?.finance_customers?.national_id}
          />
          <Row label="رقم الجوال" value={contract?.finance_customers?.phone} />
          <Row label="نوع التمويل" value={contract?.finance_type} />
          <Row label="المستثمر" value={contract?.investor_name || "-"} />
          <Row label="المنتج" value={contract?.product_name || "-"} />
          <Row label="كمية المنتجات" value={contract?.product_quantity} />
          <Row label="مبلغ الدين" value={`${contract?.debt_amount || 0} ر.س`} />
          <Row
            label="مبلغ السداد"
            value={`${contract?.payment_amount || 0} ر.س`}
          />
          <Row
            label="القسط"
            value={`${contract?.installment_amount || 0} ر.س`}
          />
          <Row label="نوع السداد" value={contract?.payment_type || "-"} />
          <Row label="موعد السداد" value={contract?.payment_due_date || "-"} />
          <Row label="المسدد" value={`${contract?.paid_amount || 0} ر.س`} />
          <Row
            label="المتبقي"
            value={`${contract?.remaining_amount || 0} ر.س`}
          />
          <Row label="الحالة" value={contract?.contract_status || "-"} />
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>سجل الدفعات</h2>

          {payments.length === 0 ? (
            <div style={emptyBox}>لا توجد دفعات مسجلة</div>
          ) : (
            payments.map((payment) => (
              <div
                key={payment.id}
                style={{
                  ...paymentRow,
                  opacity: payment.is_cancelled ? 0.6 : 1,
                }}
              >
                <span>💰 {payment.payment_amount} ر.س</span>

                <span>
                  {payment.is_cancelled
                    ? "❌ ملغية"
                    : `💳 ${payment.payment_type || "-"}`}
                </span>

                <span>
                  📅{" "}
                  {payment.created_at
                    ? new Date(payment.created_at).toLocaleDateString("en-GB")
                    : "-"}
                </span>

                <button
                  style={cancelButton}
                  onClick={() => cancelPayment(payment)}
                  disabled={payment.is_cancelled}
                >
                  ⛔ إلغاء
                </button>
              </div>
            ))
          )}
        </section>

        <section style={actionsSection}>
          <button
            style={actionButton}
            onClick={() =>
              (window.location.href = `/finance/${branch}/payments/new?contract=${contractId}`)
            }
          >
            <span style={buttonContent}>
              <span style={buttonIcon}>💳</span>
              تسجيل سداد
            </span>
          </button>

          <button
            style={actionButton}
            onClick={() =>
              (window.location.href = `/finance/${branch}/contracts/edit/${contractId}`)
            }
          >
            <span style={buttonContent}>
              <span style={buttonIcon}>✏️</span>
              تعديل العقد
            </span>
          </button>

          <button
            style={actionButton}
            onClick={() =>
              (window.location.href = `/finance/${branch}/contracts/print/${contractId}`)
            }
          >
            <span style={buttonContent}>
              <span style={buttonIcon}>🖨️</span>
              طباعة العقد
            </span>
          </button>

          <button style={actionButton} onClick={closeContract}>
            <span style={buttonContent}>
              <span style={buttonIcon}>🔒</span>
              إغلاق العقد
            </span>
          </button>
        </section>

        <button
          style={backButton}
          onClick={() =>
            (window.location.href = `/finance/${branch}/contracts/active`)
          }
        >
          الرجوع للعقود القائمة
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

const row = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
};

const sectionTitle = {
  marginTop: 0,
  fontSize: 22,
  color: "#0d47a1",
};

const emptyBox = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center" as const,
  color: "#6b7280",
};

const paymentRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 140px",
  gap: 12,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const cancelButton = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: "bold",
};

const actionsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const actionButton = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  color: "#0d47a1",
};

const buttonContent = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const buttonIcon = {
  fontSize: 20,
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
