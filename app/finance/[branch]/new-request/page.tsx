"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";

export default function NewRequestPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [investors, setInvestors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");

  const [financeType, setFinanceType] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [productId, setProductId] = useState("");
  const [productQuantity, setProductQuantity] = useState("");
  const [printPartyType, setPrintPartyType] = useState("organization");

  const [debtAmount, setDebtAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [legalCity, setLegalCity] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadLists();
  }, [branch]);

  async function loadLists() {
    const branchId = await getBranchId(branch);
    if (!branchId) return;

    const { data: investorsData } = await supabase
      .from("finance_investors")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    const { data: productsData } = await supabase
      .from("finance_products")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setInvestors(investorsData || []);
    setProducts(productsData || []);
  }

  async function createRequest() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    if (!fullName || !nationalId || !birthDay || !birthMonth || !birthYear || !phone) {
      alert("أكمل بيانات العميل");
      return;
    }

    if (!financeType || !debtAmount || !paymentAmount) {
      alert("أكمل بيانات العقد");
      return;
    }

    if (!investorId || !productId || !productQuantity) {
      alert("اختر المستثمر والمنتج والكمية");
      return;
    }

    const selectedInvestor = investors.find((item) => item.id === investorId);
    const selectedProduct = products.find((item) => item.id === productId);

    if (!selectedInvestor || !selectedProduct) {
      alert("تعذر تحديد المستثمر أو المنتج");
      return;
    }

    const cleanNationalId = normalizeNumber(nationalId);
    const cleanPhone = normalizeNumber(phone);
    const qty = toNumber(productQuantity);

    if (cleanNationalId.length !== 10) {
      alert("رقم الهوية يجب أن يكون 10 أرقام");
      return;
    }

    if (!/^05\d{8}$/.test(cleanPhone)) {
      alert("رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05");
      return;
    }

    if (qty <= 0) {
      alert("أدخل كمية صحيحة");
      return;
    }

    const { data: stockData } = await supabase
      .from("finance_inventory")
      .select("*")
      .eq("branch_id", branchId)
      .eq("investor_id", investorId)
      .eq("product_id", productId)
      .single();

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

    const birthHijri = `${birthDay}/${birthMonth}/${birthYear}`;
    const debt = toNumber(debtAmount);
    const totalPayment = toNumber(paymentAmount);

    const { data: customerData, error: customerError } = await supabase
      .from("finance_customers")
      .insert([
        {
          branch_id: branchId,
          full_name: fullName,
          national_id: cleanNationalId,
          birth_hijri: birthHijri,
          phone: cleanPhone,
        },
      ])
      .select()
      .single();

    if (customerError) {
      alert("تعذر إنشاء العميل");
      return;
    }

    const { data: contractData, error: contractError } = await supabase
      .from("finance_contracts")
      .insert([
        {
          branch_id: branchId,
          customer_id: customerData.id,
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

          debt_amount: debt,
          payment_amount: totalPayment,
          installment_amount: toNumber(installmentAmount),
          payment_type: paymentType,
          payment_due_date: paymentDueDate,
          legal_city: legalCity,
          notes,
          contract_status: "نشط",
          paid_amount: 0,
          remaining_amount: totalPayment,
          created_by: "المدير",
        },
      ])
      .select()
      .single();

    if (contractError) {
      alert("تم إنشاء العميل، لكن تعذر إنشاء العقد");
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
        customer_id: customerData.id,
        movement_type: "خصم",
        quantity: qty,
        before_quantity: beforeQty,
        after_quantity: afterQty,
        notes: `خصم بسبب إنشاء عقد للعميل ${fullName}`,
        created_by: "المدير",
      },
    ]);

    const { data: noteData, error: noteError } = await supabase
      .from("finance_promissory_notes")
      .insert([
        {
          branch_id: branchId,
          contract_id: contractData.id,
          customer_id: customerData.id,
          debtor_name: fullName,
          debtor_national_id: cleanNationalId,
          debtor_phone: cleanPhone,
          amount: debt,
          due_date: paymentDueDate,
          city: legalCity,
          notes,
          status: "نشط",
          created_by: "المدير",
        },
      ])
      .select()
      .single();

    if (noteError) {
      alert("تم إنشاء العميل والعقد، لكن تعذر إنشاء السند");
      return;
    }

    await supabase.from("finance_activity_logs").insert([
      {
        branch_id: branchId,
        activity_type: "طلب جديد",
        description: `تم إنشاء طلب جديد للعميل ${fullName} وخصم ${qty} من ${selectedProduct.product_name}`,
        customer_id: customerData.id,
        contract_id: contractData.id,
        payment_id: null,
        customer_name: fullName,
        employee_name: "المدير",
        status: "نشط",
      },
    ]);

    alert("تم إنشاء الطلب وخصم المخزون بنجاح");

    window.location.href = `/finance/${branch}/new-request/print/${contractData.id}/${noteData.id}`;
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>طلب جديد</h1>
        </div>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات العميل</h2>

          <input style={input} placeholder="اسم العميل" value={fullName} onChange={(e) => setFullName(e.target.value)} />

          <input style={input} inputMode="numeric" maxLength={10} placeholder="رقم الهوية" value={nationalId} onChange={(e) => setNationalId(normalizeNumber(e.target.value))} />

          <div style={dateLabel}>تاريخ الميلاد بالهجري</div>

          <div style={dateGrid}>
            <input style={input} inputMode="numeric" placeholder="اليوم" value={birthDay} onChange={(e) => setBirthDay(normalizeNumber(e.target.value))} />
            <input style={input} inputMode="numeric" placeholder="الشهر" value={birthMonth} onChange={(e) => setBirthMonth(normalizeNumber(e.target.value))} />
            <input style={input} inputMode="numeric" placeholder="السنة" value={birthYear} onChange={(e) => setBirthYear(normalizeNumber(e.target.value))} />
          </div>

          <input style={input} inputMode="numeric" maxLength={10} placeholder="رقم الجوال" value={phone} onChange={(e) => setPhone(normalizeNumber(e.target.value))} />
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>المخزون والطرف الأول</h2>

          <select style={input} value={investorId} onChange={(e) => setInvestorId(e.target.value)}>
            <option value="">المستثمر المرتبط بالمخزون</option>
            {investors.map((investor) => (
              <option key={investor.id} value={investor.id}>
                {investor.investor_name}
              </option>
            ))}
          </select>

          <select style={input} value={productId} onChange={(e) => setProductId(e.target.value)}>
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
            placeholder="الكمية"
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
          <h2 style={sectionTitle}>بيانات العقد والسند</h2>

          <input style={input} placeholder="نوع التمويل" value={financeType} onChange={(e) => setFinanceType(e.target.value)} />

          <input style={input} inputMode="numeric" placeholder="مبلغ الدين / مبلغ السند" value={debtAmount} onChange={(e) => setDebtAmount(normalizeNumber(e.target.value))} />

          <input style={input} inputMode="numeric" placeholder="مبلغ السداد" value={paymentAmount} onChange={(e) => setPaymentAmount(normalizeNumber(e.target.value))} />

          <input style={input} inputMode="numeric" placeholder="القسط" value={installmentAmount} onChange={(e) => setInstallmentAmount(normalizeNumber(e.target.value))} />

          <select style={input} value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
            <option value="">نوع السداد</option>
            <option value="موعد محدد">موعد محدد</option>
            <option value="شهري مجدول">شهري مجدول</option>
          </select>

          <input style={input} type="date" placeholder="موعد السداد بالميلادي" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} />

          <input style={input} placeholder="مدينة التقاضي" value={legalCity} onChange={(e) => setLegalCity(e.target.value)} />

          <textarea style={textarea} placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <button style={primaryButton} onClick={createRequest}>
            إنشاء الطلب وطباعة العقد
          </button>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}`)}
        >
          الرجوع لمحطة العمل الرئيسية
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

const dateLabel = {
  fontSize: 15,
  fontWeight: "bold",
  marginBottom: 8,
  color: "#374151",
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
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
};
