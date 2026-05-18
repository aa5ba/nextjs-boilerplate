"use client";

import { normalizeNumber, toNumber } from "@/lib/numberUtils";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function EditContractPage() {
  const params = useParams();

  const branch = params.branch as string;
  const contractId = params.id as string;

  const [financeType, setFinanceType] = useState("");
  const [investorName, setInvestorName] = useState("");
  const [productName, setProductName] = useState("");
  const [productQuantity, setProductQuantity] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [guarantorName, setGuarantorName] = useState("");
  const [legalCity, setLegalCity] = useState("");
  const [judicialAmount, setJudicialAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [contractStatus, setContractStatus] = useState("");

  useEffect(() => {
    loadContract();
  }, []);

  async function loadContract() {
    const { data } = await supabase
      .from("finance_contracts")
      .select("*")
      .eq("id", contractId)
      .single();

    if (!data) return;

    setFinanceType(data.finance_type || "");
    setInvestorName(data.investor_name || "");
    setProductName(data.product_name || "");
    setProductQuantity(String(data.product_quantity || ""));
    setDebtAmount(String(data.debt_amount || ""));
    setPaymentAmount(String(data.payment_amount || ""));
    setInstallmentAmount(String(data.installment_amount || ""));
    setPaymentType(data.payment_type || "");
    setPaymentDueDate(data.payment_due_date || "");
    setGuarantorName(data.guarantor_name || "");
    setLegalCity(data.legal_city || "");
    setJudicialAmount(String(data.judicial_amount || ""));
    setNotes(data.notes || "");
    setContractStatus(data.contract_status || "نشط");
  }

  async function updateContract() {
    const { error } = await supabase
      .from("finance_contracts")
      .update({
        finance_type: financeType,
        investor_name: investorName,
        product_name: productName,
        product_quantity: toNumber(productQuantity),
        debt_amount: toNumber(debtAmount),
        payment_amount: toNumber(paymentAmount),
        installment_amount: toNumber(installmentAmount),
        payment_type: paymentType,
        payment_due_date: paymentDueDate,
        guarantor_name: guarantorName,
        legal_city: legalCity,
        judicial_amount: toNumber(judicialAmount),
        notes,
        contract_status: contractStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId);

    if (error) {
      alert("تعذر تعديل العقد");
      return;
    }

    await supabase.from("finance_activity_logs").insert([
      {
        activity_type: "تعديل عقد",
        description: "تم تعديل بيانات العقد",
        contract_id: contractId,
        employee_name: "المدير",
        status: contractStatus,
      },
    ]);

    alert("تم تعديل العقد بنجاح");
    window.location.href = `/finance/${branch}/contracts/${contractId}`;
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>تعديل العقد</h1>
        </div>

        <section style={card}>
          <input
            style={input}
            placeholder="نوع التمويل"
            value={financeType}
            onChange={(e) => setFinanceType(e.target.value)}
          />

          <input
            style={input}
            placeholder="المستثمر"
            value={investorName}
            onChange={(e) => setInvestorName(e.target.value)}
          />

          <input
            style={input}
            placeholder="اسم المنتج"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />

          <input
            style={input}
            inputMode="numeric"
            placeholder="كمية المنتجات"
            value={productQuantity}
            onChange={(e) => setProductQuantity(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            inputMode="numeric"
            placeholder="مبلغ الدين"
            value={debtAmount}
            onChange={(e) => setDebtAmount(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            inputMode="numeric"
            placeholder="مبلغ السداد"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            inputMode="numeric"
            placeholder="القسط"
            value={installmentAmount}
            onChange={(e) =>
              setInstallmentAmount(normalizeNumber(e.target.value))
            }
          />

          <select
            style={input}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
          >
            <option value="">نوع السداد</option>
            <option value="موعد محدد">موعد محدد</option>
            <option value="شهري مجدول">شهري مجدول</option>
          </select>

          <input
            style={input}
            placeholder="موعد السداد"
            value={paymentDueDate}
            onChange={(e) => setPaymentDueDate(e.target.value)}
          />

          <input
            style={input}
            placeholder="الكفيل"
            value={guarantorName}
            onChange={(e) => setGuarantorName(e.target.value)}
          />

          <input
            style={input}
            placeholder="مدينة التقاضي"
            value={legalCity}
            onChange={(e) => setLegalCity(e.target.value)}
          />

          <input
            style={input}
            inputMode="numeric"
            placeholder="المبلغ القضائي"
            value={judicialAmount}
            onChange={(e) => setJudicialAmount(normalizeNumber(e.target.value))}
          />

          <select
            style={input}
            value={contractStatus}
            onChange={(e) => setContractStatus(e.target.value)}
          >
            <option value="نشط">نشط</option>
            <option value="متأخر">متأخر</option>
            <option value="تم السداد">تم السداد</option>
            <option value="ملغي">ملغي</option>
          </select>

          <textarea
            style={textarea}
            placeholder="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button style={primaryButton} onClick={updateContract}>
            حفظ التعديل
          </button>
        </section>

        <button
          style={backButton}
          onClick={() =>
            (window.location.href = `/finance/${branch}/contracts/${contractId}`)
          }
        >
          الرجوع للعقد
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

const textarea = {
  width: "100%",
  minHeight: 100,
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
