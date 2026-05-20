"use client";

import { normalizeNumber, toNumber } from "@/lib/numberUtils";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";

export default function NewFinanceContractPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [financeType, setFinanceType] = useState("");

  const [investorId, setInvestorId] = useState("");
  const [productId, setProductId] = useState("");
  const [productQuantity, setProductQuantity] = useState("");
  const [printPartyType, setPrintPartyType] = useState("organization");

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

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [branch]);

  async function loadData() {
    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setCustomers([]);
      setInvestors([]);
      setProducts([]);
      return;
    }

    const { data: customersData } = await supabase
      .from("finance_customers")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    const { data: investorsData } = await supabase
      .from("finance_investors")
      .select("*")
      .eq("branch_id", currentBranchId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    const { data: productsData } = await supabase
      .from("finance_products")
      .select("*")
      .eq("branch_id", currentBranchId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setCustomers(customersData || []);
    setInvestors(investorsData || []);
    setProducts(productsData || []);
  }

  async function createContract() {
    if (
      !branchId ||
      !customerId ||
      !financeType ||
      !investorId ||
      !productId ||
      !productQuantity ||
      !debtAmount ||
      !paymentAmount ||
      !contractDateHijri ||
      !contractDateGregorian
    ) {
      alert("أكمل البيانات المطلوبة");
      return;
    }

    const selectedCustomer = customers.find((c) => c.id === customerId);
    const selectedInvestor = investors.find((i) => i.id === investorId);
    const selectedProduct = products.find((p) => p.id === productId);

    if (!selectedCustomer || !selectedInvestor || !selectedProduct) {
      alert("تعذر تحديد العميل أو المستثمر أو المنتج");
      return;
    }

    const qty = toNumber(productQuantity);

    if (qty <= 0) {
      alert("أدخل كمية صحيحة");
      return;
    }

    try {
      setSaving(true);

      const { data: stockData } = await supabase
        .from("finance_inventory")
        .select("*")
        .eq("branch_id", branchId)
        .eq("investor_id", investorId)
        .eq("product_id", productId)
        .maybeSingle();

      if (!stockData) {
        alert("لا يوجد مخزون لهذا المستثمر والمنتج");
        return;
      }

      const beforeQty = Number(stockData.quantity || 0);

      if (beforeQty < qty) {
        alert("الكمية المطلوبة أكبر من المخزون المتاح");
        return;
      }

      const afterQty = beforeQty - qty;

      const organizationSettings = await getOrganizationSettings();

      const printPartyName =
        printPartyType === "organization"
          ? organizationSettings.name
          : selectedInvestor.investor_name;

      const printPartyIdentifier =
        printPartyType === "organization"
          ? organizationSettings.commercialRecord
          : selectedInvestor.national_id;

      const payment = toNumber(paymentAmount);

      const { data: contractData, error } = await supabase
        .from("finance_contracts")
        .insert([
          {
            branch_id: branchId,
            customer_id: customerId,
            finance_type: financeType,

            investor_id: selectedInvestor.id,
            investor_name: selectedInvestor.investor_name,
            product_id: selectedProduct.id,
            product_name: selectedProduct.product_name,
            product_quantity: qty,

            print_party_type: printPartyType,
            print_party_name: printPartyName,
            print_party_identifier: printPartyIdentifier || null,

            first_party_type: printPartyType,
            first_party_name: printPartyName,
            first_party_identifier: printPartyIdentifier || null,

            debt_amount: toNumber(debtAmount),
            payment_amount: payment,
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
            remaining_amount: payment,
            created_by: "المدير",
          },
        ])
        .select()
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      await supabase
        .from("finance_inventory")
        .update({
          quantity: afterQty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", stockData.id);

      await supabase.from("finance_inventory_movements").insert([
        {
          branch_id: branchId,
          investor_id: selectedInvestor.id,
          product_id: selectedProduct.id,
          contract_id: contractData.id,
          customer_id: customerId,
          movement_type: "خصم",
          quantity: qty,
          before_quantity: beforeQty,
          after_quantity: afterQty,
          notes: `خصم بسبب إنشاء عقد للعميل ${selectedCustomer.full_name}`,
          created_by: "المدير",
        },
      ]);

      await supabase.from("finance_activity_logs").insert([
        {
          branch_id: branchId,
          activity_type: "إنشاء عقد",
          description: `تم إنشاء عقد جديد للعميل ${selectedCustomer.full_name}`,
          customer_id: customerId,
          contract_id: contractData.id,
          customer_name: selectedCustomer.full_name || "",
          employee_name: "المدير",
          status: "نشط",
        },
      ]);

      alert("تم إنشاء العقد وخصم المخزون بنجاح");
      window.location.href = `/finance/${branch}/contracts/${contractData.id}`;
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>إنشاء عقد جديد</h1>
        </div>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات العميل</h2>

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
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>المخزون والطرف الأول</h2>

          <select
            style={input}
            value={investorId}
            onChange={(e) => setInvestorId(e.target.value)}
          >
            <option value="">المستثمر المرتبط بالمخزون</option>
            {investors.map((investor) => (
              <option key={investor.id} value={investor.id}>
                {investor.investor_name}
              </option>
            ))}
          </select>

          <select
            style={input}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">اختر المنتج</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.product_name}
              </option>
            ))}
          </select>

          <input
            style={input}
            inputMode="numeric"
            placeholder="كمية المنتجات"
            value={productQuantity}
            onChange={(e) => setProductQuantity(normalizeNumber(e.target.value))}
          />

          <select
            style={input}
            value={printPartyType}
            onChange={(e) => setPrintPartyType(e.target.value)}
          >
            <option value="organization">الطرف الأول في الطباعة: المنظمة</option>
            <option value="investor">الطرف الأول في الطباعة: المستثمر</option>
          </select>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات العقد</h2>

          <input
            style={input}
            placeholder="نوع التمويل"
            value={financeType}
            onChange={(e) => setFinanceType(e.target.value)}
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
            value={contractDateGregorian}
            onChange={(e) => setContractDateGregorian(e.target.value)}
          />

          <input
            style={input}
            type="date"
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

          <button
            style={primaryButton}
            onClick={createContract}
            disabled={saving}
          >
            {saving ? "جاري الإنشاء..." : "إنشاء العقد"}
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
  marginBottom: 16,
};

const sectionTitle = {
  marginTop: 0,
  color: "#0d47a1",
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

const textarea = {
  width: "100%",
  minHeight: 100,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
  boxSizing: "border-box" as const,
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
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
};
