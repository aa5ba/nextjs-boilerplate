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
  const [availableStock, setAvailableStock] = useState<number | null>(null);
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

  useEffect(() => {
    loadAvailableStock();
  }, [branchId, investorId, productId]);

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

  async function loadAvailableStock() {
    if (!branchId || !investorId || !productId) {
      setAvailableStock(null);
      return;
    }

    const { data } = await supabase
      .from("finance_inventory")
      .select("quantity")
      .eq("branch_id", branchId)
      .eq("investor_id", investorId)
      .eq("product_id", productId)
      .maybeSingle();

    setAvailableStock(data ? Number(data.quantity || 0) : 0);
  }

  async function createContract() {
    if (saving) return;

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

      const { data: stockData, error: stockError } = await supabase
        .from("finance_inventory")
        .select("quantity")
        .eq("branch_id", branchId)
        .eq("investor_id", investorId)
        .eq("product_id", productId)
        .maybeSingle();

      if (stockError) {
        throw new Error(stockError.message);
      }

      if (!stockData) {
        alert("لا يوجد مخزون لهذا المستثمر والمنتج");
        return;
      }

      const beforeQty = Number(stockData.quantity || 0);

      if (beforeQty < qty) {
        const confirmContinue = window.confirm(
          "الكمية في الطلب أكثر من المتاحة في المخزون، هل تريد الاستمرار؟"
        );

        if (!confirmContinue) {
          return;
        }
      }

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

      const { data: contractId, error: rpcError } = await supabase.rpc(
        "create_finance_contract_atomic",
        {
          p_branch_id: branchId,
          p_customer_id: customerId,
          p_finance_type: financeType,

          p_investor_id: selectedInvestor.id,
          p_investor_name: selectedInvestor.investor_name,

          p_product_id: selectedProduct.id,
          p_product_name: selectedProduct.product_name,
          p_product_quantity: qty,

          p_print_party_type: printPartyType,
          p_print_party_name: printPartyName,
          p_print_party_identifier: printPartyIdentifier || "",

          p_debt_amount: toNumber(debtAmount),
          p_payment_amount: payment,
          p_installment_amount: toNumber(installmentAmount),

          p_payment_type: paymentType,

          p_contract_date_hijri: contractDateHijri,
          p_contract_date_gregorian: contractDateGregorian,

          p_payment_due_date: paymentDueDate || null,

          p_guarantor_name: guarantorName,
          p_legal_city: legalCity,
          p_judicial_amount: toNumber(judicialAmount),

          p_notes: notes,
          p_customer_name: selectedCustomer.full_name || "",
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      alert("تم إنشاء العقد وخصم المخزون بنجاح");
      window.location.href = `/finance/${branch}/contracts/${contractId}`;
    } catch (error: any) {
      alert(error.message || "حدث خطأ أثناء إنشاء العقد");
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

          {availableStock !== null && (
            <div style={availableStock < 0 ? stockDanger : stockInfo}>
              المتوفر في المخزون: {availableStock}
            </div>
          )}

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

const stockInfo = {
  background: "#f0fdf4",
  color: "#166534",
  border: "1px solid #bbf7d0",
  padding: 12,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  marginBottom: 12,
};

const stockDanger = {
  background: "#fef2f2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  padding: 12,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
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
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
};
