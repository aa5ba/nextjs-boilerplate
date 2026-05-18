"use client";

import { normalizeNumber, toNumber } from "@/lib/numberUtils";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function NewFinanceContractPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [financeType, setFinanceType] = useState("");
  const [investorName, setInvestorName] = useState("");
  const [productName, setProductName] = useState("");
  const [productQuantity, setProductQuantity] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [contractDateHijri, setContractDateHijri] = useState("");
  const [contractDateGregorian, setContractDateGregorian] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [guarantorName, setGuarantorName] = useState("");
  const [legalCity, setLegalCity] = useState("");
  const [judicialAmount, setJudicialAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadCustomers();
  }, [branch]);

  async function loadCustomers() {
    const currentBranchId = await getBranchId(branch);

    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setCustomers([]);
      return;
    }

    const { data } = await supabase
      .from("finance_customers")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    setCustomers(data || []);
  }

  async function createContract() {
    if (
      !branchId ||
      !customerId ||
      !financeType ||
      !debtAmount ||
      !paymentAmount ||
      !contractDateHijri ||
      !contractDateGregorian
    ) {
      alert("أكمل البيانات المطلوبة");
      return;
    }

    const selectedCustomer = customers.find((c) => c.id === customerId);

    const { data: contractData, error } = await supabase
      .from("finance_contracts")
      .insert([
        {
          branch_id: branchId,
          customer_id: customerId,
          finance_type: financeType,
          investor_name: investorName,
          product_name: productName,
          product_quantity: toNumber(productQuantity),
          debt_amount: toNumber(debtAmount),
          payment_amount: toNumber(paymentAmount),
          installment_amount: toNumber(installmentAmount),
          payment_type: paymentType,
          contract_date_hijri: contractDateHijri,
          contract_date_gregorian: contractDateGregorian,
          payment_due_date: paymentDueDate,
          guarantor_name: guarantorName,
          legal_city: legalCity,
          judicial_amount: toNumber(judicialAmount),
          notes,
          contract_status: "نشط",
          paid_amount: 0,
          remaining_amount: toNumber(debtAmount),
          created_by: "المدير",
        },
      ])
      .select()
      .single();

    if (error) {
      alert("تعذر إنشاء العقد");
      return;
    }

    await supabase.from("finance_activity_logs").insert([
      {
        branch_id: branchId,
        activity_type: "إنشاء عقد",
        description: `تم إنشاء عقد جديد للعميل ${
          selectedCustomer?.full_name || ""
        }`,
        customer_id: customerId,
        contract_id: contractData.id,
        customer_name: selectedCustomer?.full_name || "",
        employee_name: "المدير",
        status: "نشط",
      },
    ]);

    alert("تم إنشاء العقد بنجاح");
    window.location.href = `/finance/${branch}/contracts/${contractData.id}`;
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>إنشاء عقد جديد</h1>
        </div>

        <section style={card}>
          <select
            style={input}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">اختر العميل</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name} - {customer.national_id}
              </option>
            ))}
          </select>

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
            placeholder="تاريخ إنشاء العقد بالهجري مثال: 1446/12/15"
            value={contractDateHijri}
            onChange={(e) => setContractDateHijri(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            type="date"
            placeholder="تاريخ إنشاء العقد بالميلادي"
            value={contractDateGregorian}
            onChange={(e) => setContractDateGregorian(e.target.value)}
          />

          <input
            style={input}
            type="date"
            placeholder="موعد السداد بالميلادي"
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

          <textarea
            style={textarea}
            placeholder="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button style={primaryButton} onClick={createContract}>
            إنشاء العقد
          </button>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}/contracts`)}
        >
          الرجوع للعقود
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
