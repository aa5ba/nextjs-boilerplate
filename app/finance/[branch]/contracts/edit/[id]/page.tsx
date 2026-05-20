"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";

export default function EditContractPage() {
  const params = useParams();
  const branch = params.branch as string;
  const contractId = params.id as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [contract, setContract] = useState<any>(null);

  const [investors, setInvestors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [branch, contractId]);

  async function loadData() {
    setLoading(true);

    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setLoading(false);
      return;
    }

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

    const { data: contractData } = await supabase
      .from("finance_contracts")
      .select("*, finance_customers(full_name)")
      .eq("id", contractId)
      .eq("branch_id", currentBranchId)
      .single();

    setInvestors(investorsData || []);
    setProducts(productsData || []);
    setContract(contractData);

    if (contractData) {
      setInvestorId(contractData.investor_id || "");
      setProductId(contractData.product_id || "");
      setProductQuantity(String(contractData.product_quantity || ""));
      setPrintPartyType(contractData.print_party_type || "organization");

      setDebtAmount(String(contractData.debt_amount || ""));
      setPaymentAmount(String(contractData.payment_amount || ""));
      setInstallmentAmount(String(contractData.installment_amount || ""));
      setPaymentType(contractData.payment_type || "");
      setPaymentDueDate(contractData.payment_due_date || "");
      setLegalCity(contractData.legal_city || "");
      setNotes(contractData.notes || "");
    }

    setLoading(false);
  }

  async function saveContract() {
    if (!branchId || !contract) {
      alert("تعذر تحميل العقد");
      return;
    }

    if (!investorId || !productId || !productQuantity) {
      alert("اختر المستثمر والمنتج والكمية");
      return;
    }

    if (!debtAmount || !paymentAmount) {
      alert("أكمل مبالغ العقد");
      return;
    }

    const selectedInvestor = investors.find((x) => x.id === investorId);
    const selectedProduct = products.find((x) => x.id === productId);

    if (!selectedInvestor || !selectedProduct) {
      alert("تعذر تحديد المستثمر أو المنتج");
      return;
    }

    const newQty = toNumber(productQuantity);
    const oldQty = Number(contract.product_quantity || 0);

    if (newQty <= 0) {
      alert("أدخل كمية صحيحة");
      return;
    }

    try {
  setSaving(true);

  const organizationSettings = await getOrganizationSettings();

  const printPartyName =
    printPartyType === "organization"
      ? organizationSettings.name
      : selectedInvestor.investor_name;

  const printPartyIdentifier =
    printPartyType === "organization"
      ? organizationSettings.commercialRecord
      : selectedInvestor.national_id;

  const investorChanged = contract.investor_id !== investorId;
  const productChanged = contract.product_id !== productId;
  const quantityChanged = oldQty !== newQty;

  if (investorChanged || productChanged || quantityChanged) {
    await adjustInventory({
      oldInvestorId: contract.investor_id,
      oldProductId: contract.product_id,
      oldQty,
      newInvestorId: investorId,
      newProductId: productId,
      newQty,
      customerId: contract.customer_id,
      customerName: contract.finance_customers?.full_name || "",
    });
  }

  const debt = toNumber(debtAmount);
  const payment = toNumber(paymentAmount);
  const paid = Number(contract.paid_amount || 0);
  const remaining = Math.max(payment - paid, 0);

  const { error } = await supabase
    .from("finance_contracts")
    .update({
      investor_id: selectedInvestor.id,
      investor_name: selectedInvestor.investor_name,
      product_id: selectedProduct.id,
      product_name: selectedProduct.product_name,
      product_quantity: newQty,

      print_party_type: printPartyType,
      print_party_name: printPartyName,
      print_party_identifier: printPartyIdentifier || null,

      first_party_type: printPartyType,
      first_party_name: printPartyName,
      first_party_identifier: printPartyIdentifier || null,

      debt_amount: debt,
      payment_amount: payment,
      installment_amount: toNumber(installmentAmount),
      payment_type: paymentType,
      payment_due_date: paymentDueDate,
      legal_city: legalCity,
      notes,
      remaining_amount: remaining,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId)
    .eq("branch_id", branchId);

  if (error) {
    alert(error.message);
    return;
  }

  await supabase.from("finance_activity_logs").insert([
    {
      branch_id: branchId,
      activity_type: "تعديل عقد",
      description: `تم تعديل عقد العميل ${
        contract.finance_customers?.full_name || ""
      }`,
      customer_id: contract.customer_id,
      contract_id: contractId,
      customer_name: contract.finance_customers?.full_name || "",
      employee_name: "المدير",
      status: contract.contract_status || "نشط",
    },
  ]);

  alert("تم حفظ تعديل العقد بنجاح");
  window.location.href = `/finance/${branch}/contracts/${contractId}`;
} catch (error: any) {
  alert(error.message || "حدث خطأ أثناء تعديل العقد");
} finally {
  setSaving(false);
}
  }

  async function adjustInventory({
    oldInvestorId,
    oldProductId,
    oldQty,
    newInvestorId,
    newProductId,
    newQty,
    customerId,
    customerName,
  }: any) {
    if (!branchId) return;

    if (oldInvestorId && oldProductId && oldQty > 0) {
      const { data: oldStock } = await supabase
        .from("finance_inventory")
        .select("*")
        .eq("branch_id", branchId)
        .eq("investor_id", oldInvestorId)
        .eq("product_id", oldProductId)
        .maybeSingle();

      if (oldStock) {
        const before = Number(oldStock.quantity || 0);
        const after = before + oldQty;

        await supabase
          .from("finance_inventory")
          .update({
            quantity: after,
            updated_at: new Date().toISOString(),
          })
          .eq("id", oldStock.id);

        await supabase.from("finance_inventory_movements").insert([
          {
            branch_id: branchId,
            investor_id: oldInvestorId,
            product_id: oldProductId,
            contract_id: contractId,
            customer_id: customerId,
            movement_type: "إرجاع",
            quantity: oldQty,
            before_quantity: before,
            after_quantity: after,
            notes: `إرجاع كمية بسبب تعديل عقد العميل ${customerName}`,
            created_by: "المدير",
          },
        ]);
      }
    }

    const { data: newStock } = await supabase
      .from("finance_inventory")
      .select("*")
      .eq("branch_id", branchId)
      .eq("investor_id", newInvestorId)
      .eq("product_id", newProductId)
      .maybeSingle();

    if (!newStock) {
      throw new Error("لا يوجد مخزون للمستثمر والمنتج الجديد");
    }

    const beforeNew = Number(newStock.quantity || 0);

    if (beforeNew < newQty) {
      throw new Error("الكمية الجديدة أكبر من المخزون المتاح");
    }

    const afterNew = beforeNew - newQty;

    await supabase
      .from("finance_inventory")
      .update({
        quantity: afterNew,
        updated_at: new Date().toISOString(),
      })
      .eq("id", newStock.id);

    await supabase.from("finance_inventory_movements").insert([
      {
        branch_id: branchId,
        investor_id: newInvestorId,
        product_id: newProductId,
        contract_id: contractId,
        customer_id: customerId,
        movement_type: "خصم",
        quantity: newQty,
        before_quantity: beforeNew,
        after_quantity: afterNew,
        notes: `خصم كمية جديدة بسبب تعديل عقد العميل ${customerName}`,
        created_by: "المدير",
      },
    ]);
  }

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل العقد...</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>✏️ تعديل العقد</h1>
        </div>

        <section style={card}>
          <h2 style={sectionTitle}>المخزون والطرف الأول</h2>

          <select
            style={input}
            value={investorId}
            onChange={(e) => setInvestorId(e.target.value)}
          >
            <option value="">اختر المستثمر</option>
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
            placeholder="الكمية"
            value={productQuantity}
            onChange={(e) =>
              setProductQuantity(normalizeNumber(e.target.value))
            }
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
            type="date"
            value={paymentDueDate}
            onChange={(e) => setPaymentDueDate(e.target.value)}
          />

          <input
            style={input}
            placeholder="مدينة التقاضي"
            value={legalCity}
            onChange={(e) => setLegalCity(e.target.value)}
          />

          <textarea
            style={textarea}
            placeholder="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button style={saveButton} onClick={saveContract} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
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

const saveButton = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
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

const loadingBox = {
  textAlign: "center" as const,
  paddingTop: 80,
  fontSize: 18,
};
