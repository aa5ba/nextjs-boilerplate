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

  const today = new Date().toLocaleDateString("en-CA");

  const [branchId, setBranchId] = useState<string | null>(null);

  const [investors, setInvestors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");
  const [workName, setWorkName] = useState("");

  const [financeType, setFinanceType] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [productId, setProductId] = useState("");
  const [productQuantity, setProductQuantity] = useState("");
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [printPartyType, setPrintPartyType] = useState("organization");

  const [debtAmount, setDebtAmount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [draftPaymentDueDate, setDraftPaymentDueDate] = useState("");
  const [contractIssueDate, setContractIssueDate] = useState(today);

  const [hasGuarantor, setHasGuarantor] = useState(false);
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorNationalId, setGuarantorNationalId] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [guarantorWorkName, setGuarantorWorkName] = useState("");

  const [legalCity, setLegalCity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLists();
  }, [branch]);

  useEffect(() => {
    loadAvailableStock();
  }, [branchId, investorId, productId]);

  async function loadLists() {
    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    if (!currentBranchId) return;

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

  function validateRequest() {
    if (!branchId) return "تعذر تحديد الفرع";
    if (!fullName) return "يرجى إدخال اسم العميل";
    if (!nationalId) return "يرجى إدخال رقم الهوية";
    if (!birthDay) return "يرجى إدخال يوم الميلاد";
    if (!birthMonth) return "يرجى إدخال شهر الميلاد";
    if (!birthYear) return "يرجى إدخال سنة الميلاد";
    if (!phone) return "يرجى إدخال رقم الجوال";
    if (!financeType) return "يرجى إدخال نوع التمويل";
    if (!investorId) return "يرجى اختيار المستثمر المرتبط بالمخزون";
    if (!productId) return "يرجى اختيار المنتج";
    if (!productQuantity) return "يرجى إدخال الكمية";
    if (!debtAmount) return "يرجى إدخال مبلغ الاستحقاق / مبلغ السند";
    if (!paymentType) return "يرجى اختيار نوع السداد";
    if (!paymentDueDate) return "يرجى اختيار موعد السداد ثم الضغط على زر تم";
    if (!contractIssueDate) return "يرجى اختيار تاريخ تحرير العقد";
    if (!legalCity) return "يرجى إدخال مدينة التقاضي";

    if (hasGuarantor) {
      if (!guarantorName) return "يرجى إدخال اسم الكفيل";
      if (!guarantorNationalId) return "يرجى إدخال رقم هوية الكفيل";
      if (!guarantorPhone) return "يرجى إدخال رقم جوال الكفيل";
      if (!guarantorWorkName) return "يرجى إدخال عمل الكفيل";
    }

    return "";
  }

  async function createRequest() {
    if (saving) return;

    const validationMessage = validateRequest();

    if (validationMessage) {
      alert(validationMessage);
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
    const cleanGuarantorNationalId = normalizeNumber(guarantorNationalId);
    const cleanGuarantorPhone = normalizeNumber(guarantorPhone);
    const qty = toNumber(productQuantity);

    if (cleanNationalId.length !== 10) {
      alert("رقم الهوية يجب أن يكون 10 أرقام");
      return;
    }

    if (!/^05\d{8}$/.test(cleanPhone)) {
      alert("رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05");
      return;
    }

    if (hasGuarantor && cleanGuarantorNationalId.length !== 10) {
      alert("رقم هوية الكفيل يجب أن يكون 10 أرقام");
      return;
    }

    if (hasGuarantor && !/^05\d{8}$/.test(cleanGuarantorPhone)) {
      alert("رقم جوال الكفيل يجب أن يكون 10 أرقام ويبدأ بـ 05");
      return;
    }

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

      if (stockError) throw new Error(stockError.message);

      const beforeQty = Number(stockData?.quantity || 0);

      if (beforeQty < qty) {
        const confirmContinue = window.confirm(
          "الكمية في الطلب أكثر من المتاحة في المخزون، هل تريد الاستمرار؟"
        );

        if (!confirmContinue) return;
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

      const birthHijri = `${birthDay}/${birthMonth}/${birthYear}`;
      const debt = toNumber(debtAmount);

      const { data: requestData, error: rpcError } = await supabase.rpc(
        "create_new_request_atomic",
        {
          p_branch_id: branchId,

          p_full_name: fullName,
          p_national_id: cleanNationalId,
          p_birth_hijri: birthHijri,
          p_phone: cleanPhone,
          p_work_name: workName,

          p_finance_type: financeType,

          p_investor_id: selectedInvestor.id,
          p_investor_name: selectedInvestor.investor_name,

          p_product_id: selectedProduct.id,
          p_product_name: selectedProduct.product_name,
          p_product_quantity: qty,

          p_print_party_type: printPartyType,
          p_print_party_name: printPartyName,
          p_print_party_identifier: printPartyIdentifier || "",

          p_debt_amount: debt,
          p_payment_amount: debt,
          p_installment_amount: toNumber(installmentAmount),
          p_payment_type: paymentType,
          p_payment_due_date: paymentDueDate || null,

          p_contract_issue_date_gregorian: contractIssueDate,
          p_contract_issue_date_hijri: "",

          p_legal_city: legalCity,
          p_notes: notes,

          p_has_guarantor: hasGuarantor,
          p_guarantor_name: hasGuarantor ? guarantorName : "",
          p_guarantor_national_id: hasGuarantor ? cleanGuarantorNationalId : "",
          p_guarantor_phone: hasGuarantor ? cleanGuarantorPhone : "",
          p_guarantor_work_name: hasGuarantor ? guarantorWorkName : "",
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      const created = requestData?.[0];

      if (!created?.contract_id || !created?.note_id) {
        throw new Error("تم إنشاء الطلب لكن لم يتم إرجاع بيانات الطباعة");
      }

      alert("تم إنشاء الطلب وخصم المخزون بنجاح");

      window.location.href = `/finance/${branch}/new-request/print/${created.contract_id}/${created.note_id}`;
    } catch (error: any) {
      alert(error.message || "حدث خطأ أثناء إنشاء الطلب");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>طلب جديد</h1>
        </div>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات العميل</h2>

          <Field label="اسم العميل">
            <input style={input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>

          <Field label="رقم الهوية">
            <input style={input} inputMode="numeric" maxLength={10} value={nationalId} onChange={(e) => setNationalId(normalizeNumber(e.target.value))} />
          </Field>

          <div style={dateLabel}>تاريخ الميلاد بالهجري</div>

          <div style={dateGrid}>
            <Field label="اليوم">
              <input style={input} inputMode="numeric" value={birthDay} onChange={(e) => setBirthDay(normalizeNumber(e.target.value))} />
            </Field>

            <Field label="الشهر">
              <input style={input} inputMode="numeric" value={birthMonth} onChange={(e) => setBirthMonth(normalizeNumber(e.target.value))} />
            </Field>

            <Field label="السنة">
              <input style={input} inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(normalizeNumber(e.target.value))} />
            </Field>
          </div>

          <div style={twoColumns}>
            <Field label="رقم الجوال">
              <input style={input} inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(normalizeNumber(e.target.value))} />
            </Field>

            <Field label="العمل - اختياري">
              <input style={input} value={workName} onChange={(e) => setWorkName(e.target.value)} />
            </Field>
          </div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>الطرف الأول</h2>

          <Field label="المستثمر المرتبط بالمخزون">
            <select style={input} value={investorId} onChange={(e) => setInvestorId(e.target.value)}>
              <option value="">اختر المستثمر</option>
              {investors.map((investor) => (
                <option key={investor.id} value={investor.id}>
                  {investor.investor_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="اختر المنتج">
            <select style={input} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">اختر المنتج</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.product_name}
                </option>
              ))}
            </select>
          </Field>

          {availableStock !== null && (
            <div style={availableStock < 0 ? stockDanger : stockInfo}>
              المتوفر في المخزون: {availableStock}
            </div>
          )}

          <Field label="الكمية">
            <input style={input} inputMode="numeric" value={productQuantity} onChange={(e) => setProductQuantity(normalizeNumber(e.target.value))} />
          </Field>

          <Field label="الطرف الأول المسجّل في العقد والسند">
            <select style={input} value={printPartyType} onChange={(e) => setPrintPartyType(e.target.value)}>
              <option value="organization">المستثمر الرئيسي - المؤسسة</option>
              <option value="investor">المستثمر</option>
            </select>
          </Field>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات العقد والسند</h2>

          <Field label="نوع التمويل">
            <input style={input} value={financeType} onChange={(e) => setFinanceType(e.target.value)} />
          </Field>

          <Field label="مبلغ الاستحقاق / مبلغ السند">
            <input style={input} inputMode="numeric" value={debtAmount} onChange={(e) => setDebtAmount(normalizeNumber(e.target.value))} />
          </Field>

          <Field label="القسط">
            <input style={input} inputMode="numeric" value={installmentAmount} onChange={(e) => setInstallmentAmount(normalizeNumber(e.target.value))} />
          </Field>

          <Field label="نوع السداد">
            <select style={input} value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              <option value="">اختر نوع السداد</option>
              <option value="موعد محدد">موعد محدد</option>
              <option value="شهري مجدول">شهري مجدول</option>
            </select>
          </Field>

          <Field label="موعد السداد بالميلادي">
            <div style={dateConfirmRow}>
              <input style={{ ...input, marginBottom: 0 }} type="date" value={draftPaymentDueDate} onChange={(e) => setDraftPaymentDueDate(e.target.value)} />

              <button type="button" style={doneButton} onClick={() => setPaymentDueDate(draftPaymentDueDate)}>
                تم
              </button>
            </div>

            {paymentDueDate && <div style={confirmedDate}>التاريخ المعتمد: {paymentDueDate}</div>}
          </Field>

          <Field label="مدينة التقاضي">
            <input style={input} value={legalCity} onChange={(e) => setLegalCity(e.target.value)} />
          </Field>

          <Field label="هل يوجد كفيل؟">
            <select
              style={input}
              value={hasGuarantor ? "yes" : "no"}
              onChange={(e) => setHasGuarantor(e.target.value === "yes")}
            >
              <option value="no">بدون كفيل</option>
              <option value="yes">يوجد كفيل</option>
            </select>
          </Field>

          {hasGuarantor && (
            <>
              <Field label="اسم الكفيل">
                <input style={input} value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} />
              </Field>

              <Field label="رقم هوية الكفيل">
                <input style={input} inputMode="numeric" maxLength={10} value={guarantorNationalId} onChange={(e) => setGuarantorNationalId(normalizeNumber(e.target.value))} />
              </Field>

              <Field label="رقم جوال الكفيل">
                <input style={input} inputMode="numeric" maxLength={10} value={guarantorPhone} onChange={(e) => setGuarantorPhone(normalizeNumber(e.target.value))} />
              </Field>

              <Field label="عمل الكفيل">
                <input style={input} value={guarantorWorkName} onChange={(e) => setGuarantorWorkName(e.target.value)} />
              </Field>
            </>
          )}

          <Field label="ملاحظات">
            <textarea style={textarea} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <Field label="تاريخ تحرير العقد">
            <input style={input} type="date" value={contractIssueDate} onChange={(e) => setContractIssueDate(e.target.value)} />
          </Field>

          <button style={primaryButton} onClick={createRequest} disabled={saving}>
            {saving ? "جاري إنشاء الطلب..." : "إنشاء الطلب وطباعة العقد"}
          </button>
        </section>

        <button style={backButton} onClick={() => (window.location.href = `/finance/${branch}`)}>
          الرجوع لمحطة العمل الرئيسية
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: any) {
  return (
    <div style={fieldBox}>
      <label style={fieldLabel}>{label}</label>
      {children}
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

const fieldBox = {
  marginBottom: 14,
};

const fieldLabel = {
  display: "block",
  marginBottom: 8,
  color: "#0d47a1",
  fontWeight: "bold",
  fontSize: 15,
};

const input = {
  width: "100%",
  height: 50,
  padding: "0 14px",
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box" as const,
  background: "white",
};

const textarea = {
  width: "100%",
  minHeight: 100,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box" as const,
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

const twoColumns = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
};

const dateConfirmRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  alignItems: "center",
};

const doneButton = {
  height: 50,
  padding: "0 18px",
  background: "#166534",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
};

const confirmedDate = {
  marginTop: 8,
  color: "#166534",
  fontWeight: "bold",
  fontSize: 14,
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
