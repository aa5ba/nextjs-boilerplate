"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";

type ScreenType = "mobile" | "tablet" | "desktop";

export default function EditContractPage() {
  const params = useParams();
  const router = useRouter();

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

  const [screen, setScreen] = useState<ScreenType>("desktop");

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (width < 1024) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    if (saving) return;

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
        throw new Error(error.message);
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
      router.push(`/finance/${branch}/contracts/${contractId}`);
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
    if (!branchId) {
      throw new Error("تعذر تحديد الفرع");
    }

    const isSameStock =
      oldInvestorId === newInvestorId && oldProductId === newProductId;

    const { data: newStock, error: newStockError } = await supabase
      .from("finance_inventory")
      .select("*")
      .eq("branch_id", branchId)
      .eq("investor_id", newInvestorId)
      .eq("product_id", newProductId)
      .maybeSingle();

    if (newStockError) {
      throw new Error(newStockError.message);
    }

    if (!newStock) {
      throw new Error("لا يوجد مخزون للمستثمر والمنتج الجديد");
    }

    const currentNewStockQty = Number(newStock.quantity || 0);

    if (isSameStock) {
      const difference = newQty - oldQty;

      if (difference === 0) return;

      if (difference > 0 && currentNewStockQty < difference) {
        throw new Error("الكمية الجديدة أكبر من المخزون المتاح");
      }

      const afterQty =
        difference > 0
          ? currentNewStockQty - difference
          : currentNewStockQty + Math.abs(difference);

      const { error: updateError } = await supabase
        .from("finance_inventory")
        .update({
          quantity: afterQty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", newStock.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const movementType = difference > 0 ? "خصم" : "إرجاع";
      const movementQty = Math.abs(difference);

      await supabase.from("finance_inventory_movements").insert([
        {
          branch_id: branchId,
          investor_id: newInvestorId,
          product_id: newProductId,
          contract_id: contractId,
          customer_id: customerId,
          movement_type: movementType,
          quantity: movementQty,
          before_quantity: currentNewStockQty,
          after_quantity: afterQty,
          notes: `${movementType} فرق الكمية بسبب تعديل عقد العميل ${customerName}`,
          created_by: "المدير",
        },
      ]);

      return;
    }

    if (currentNewStockQty < newQty) {
      throw new Error("الكمية الجديدة أكبر من المخزون المتاح");
    }

    let oldStock: any = null;

    if (oldInvestorId && oldProductId && oldQty > 0) {
      const { data: oldStockData, error: oldStockError } = await supabase
        .from("finance_inventory")
        .select("*")
        .eq("branch_id", branchId)
        .eq("investor_id", oldInvestorId)
        .eq("product_id", oldProductId)
        .maybeSingle();

      if (oldStockError) {
        throw new Error(oldStockError.message);
      }

      oldStock = oldStockData;
    }

    if (oldInvestorId && oldProductId && oldQty > 0 && oldStock) {
      const beforeOld = Number(oldStock.quantity || 0);
      const afterOld = beforeOld + oldQty;

      const { error: returnError } = await supabase
        .from("finance_inventory")
        .update({
          quantity: afterOld,
          updated_at: new Date().toISOString(),
        })
        .eq("id", oldStock.id);

      if (returnError) {
        throw new Error(returnError.message);
      }

      await supabase.from("finance_inventory_movements").insert([
        {
          branch_id: branchId,
          investor_id: oldInvestorId,
          product_id: oldProductId,
          contract_id: contractId,
          customer_id: customerId,
          movement_type: "إرجاع",
          quantity: oldQty,
          before_quantity: beforeOld,
          after_quantity: afterOld,
          notes: `إرجاع كمية بسبب تعديل عقد العميل ${customerName}`,
          created_by: "المدير",
        },
      ]);
    }

    const afterNew = currentNewStockQty - newQty;

    const { error: deductError } = await supabase
      .from("finance_inventory")
      .update({
        quantity: afterNew,
        updated_at: new Date().toISOString(),
      })
      .eq("id", newStock.id);

    if (deductError) {
      throw new Error(deductError.message);
    }

    await supabase.from("finance_inventory_movements").insert([
      {
        branch_id: branchId,
        investor_id: newInvestorId,
        product_id: newProductId,
        contract_id: contractId,
        customer_id: customerId,
        movement_type: "خصم",
        quantity: newQty,
        before_quantity: currentNewStockQty,
        after_quantity: afterNew,
        notes: `خصم كمية جديدة بسبب تعديل عقد العميل ${customerName}`,
        created_by: "المدير",
      },
    ]);
  }

  if (loading) {
    return (
      <main dir="rtl" style={getPageStyle(isCompact)}>
        <div style={getContainerStyle(isCompact)}>
          <header style={getHeroStyle(isCompact)}>
            <div style={heroCircleOne} />
            <div style={heroCircleTwo} />
            <div style={heroCircleThree} />
            <div style={heroDots} />

            <div style={getHeroContentStyle(isCompact)}>
              <div>
                <h1 style={getHeroTitleStyle(isMobile)}>تعديل العقد</h1>
              </div>

              <div style={getHeroActionsStyle(isCompact)}>
                <button style={backButton} onClick={() => router.back()}>
                  رجوع
                </button>

                <button
                  style={mainWorkstationButton}
                  onClick={() => router.push(`/finance/${branch}`)}
                >
                  محطة العمل الرئيسية
                </button>
              </div>
            </div>
          </header>

          <div style={loadingBox}>جاري تحميل العقد...</div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={getPageStyle(isCompact)}>
      <div style={getContainerStyle(isCompact)}>
        <header style={getHeroStyle(isCompact)}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div style={getHeroContentStyle(isCompact)}>
            <div>
              <h1 style={getHeroTitleStyle(isMobile)}>تعديل العقد</h1>
            </div>

            <div style={getHeroActionsStyle(isCompact)}>
              <button style={backButton} onClick={() => router.back()}>
                رجوع
              </button>

              <button
                style={mainWorkstationButton}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                محطة العمل الرئيسية
              </button>
            </div>
          </div>
        </header>

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
      </div>
    </main>
  );
}

function getPageStyle(isCompact: boolean) {
  return {
    minHeight: "100vh",
    padding: isCompact ? 14 : 22,
    fontFamily: "var(--font-almarai), sans-serif",
    backgroundImage:
      "radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 34%), radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.14), transparent 30%), linear-gradient(180deg, rgba(248, 250, 252, 0.94), rgba(226, 232, 240, 0.94)), url('/backgrounds/v13-finance-bg-1.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
  };
}

function getContainerStyle(isCompact: boolean) {
  return {
    width: "100%",
    maxWidth: 980,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column" as const,
    gap: isCompact ? 14 : 18,
  };
}

function getHeroStyle(isCompact: boolean) {
  return {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: isCompact ? 22 : 28,
    padding: isCompact ? 18 : 26,
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e3a8a 48%, #0891b2 100%)",
    boxShadow: "0 22px 55px rgba(15, 23, 42, 0.28)",
    border: "1px solid rgba(255, 255, 255, 0.16)",
  };
}

function getHeroContentStyle(isCompact: boolean) {
  return {
    position: "relative" as const,
    zIndex: 2,
    display: "flex",
    flexDirection: isCompact ? ("column" as const) : ("row" as const),
    justifyContent: "space-between",
    alignItems: isCompact ? "stretch" : "center",
    gap: 16,
  };
}

function getHeroTitleStyle(isMobile: boolean) {
  return {
    margin: 0,
    fontSize: isMobile ? 24 : 32,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  };
}

function getHeroActionsStyle(isCompact: boolean) {
  return {
    display: "flex",
    flexDirection: isCompact ? ("column" as const) : ("row" as const),
    gap: 10,
    alignItems: "stretch",
  };
}

const heroCircleOne = {
  position: "absolute" as const,
  width: 180,
  height: 180,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.08)",
  top: -70,
  right: -55,
};

const heroCircleTwo = {
  position: "absolute" as const,
  width: 150,
  height: 150,
  borderRadius: "50%",
  background: "rgba(14, 165, 233, 0.18)",
  bottom: -70,
  left: 90,
};

const heroCircleThree = {
  position: "absolute" as const,
  width: 90,
  height: 90,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.07)",
  top: 30,
  left: 25,
};

const heroDots = {
  position: "absolute" as const,
  inset: 0,
  opacity: 0.18,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.72) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

const backButton = {
  border: "none",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#ffffff",
  background: "linear-gradient(135deg, #64748b, #334155)",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(51, 65, 85, 0.28)",
};

const mainWorkstationButton = {
  border: "none",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#ffffff",
  background: "linear-gradient(135deg, #16a34a, #15803d)",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(22, 163, 74, 0.28)",
};

const card = {
  background: "rgba(255, 255, 255, 0.94)",
  border: "1px solid rgba(226, 232, 240, 0.95)",
  borderRadius: 22,
  padding: 20,
  marginBottom: 0,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
  backdropFilter: "blur(10px)",
};

const sectionTitle = {
  margin: "0 0 16px",
  color: "#0f172a",
  fontSize: 21,
  fontWeight: 900,
};

const input = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #dbe3ef",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 16,
  marginBottom: 12,
};

const textarea = {
  width: "100%",
  minHeight: 100,
  boxSizing: "border-box" as const,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #dbe3ef",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 16,
  marginBottom: 12,
  resize: "vertical" as const,
};

const saveButton = {
  width: "100%",
  padding: 16,
  background: "linear-gradient(135deg, #2563eb, #0891b2)",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 12px 26px rgba(37, 99, 235, 0.22)",
};

const loadingBox = {
  background: "rgba(255, 255, 255, 0.94)",
  border: "1px solid rgba(226, 232, 240, 0.95)",
  borderRadius: 18,
  padding: 24,
  textAlign: "center" as const,
  color: "#1e3a8a",
  fontWeight: 900,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
};
