"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
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

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

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

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function updateScreen() {
      const width = window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (width < 980) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
    }

    updateScreen();
    window.addEventListener("resize", updateScreen);

    return () => window.removeEventListener("resize", updateScreen);
  }, []);

  useEffect(() => {
    loadEmployeeName();
    loadData();
  }, [branch, contractId]);

  function loadEmployeeName() {
    if (typeof window === "undefined") return;

    const newName = localStorage.getItem("finance_user_name");

    if (newName) {
      setEmployeeName(newName);
      return;
    }

    const oldUser = localStorage.getItem("finance_user");

    if (oldUser) {
      try {
        const parsed = JSON.parse(oldUser);
        setEmployeeName(parsed?.full_name || parsed?.username || "الموظف");
      } catch {
        setEmployeeName("الموظف");
      }
    }
  }

  function logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finance_user");
      localStorage.removeItem("finance_user_name");
      localStorage.removeItem("finance_branch_user");
    }

    router.push(`/finance/${branch}/login`);
  }

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
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getContainerStyle(isCompact)}>
          <header style={getHeroStyle(isMobile)}>
            <div style={heroCircleOne} />
            <div style={heroCircleTwo} />
            <div style={heroCircleThree} />
            <div style={heroDots} />

            <div style={getHeroContentStyle(screen)}>
              <div style={getHeroUserCardStyle(screen)}>
                <div style={getEmployeeTopRowStyle(screen)}>
                  <div style={employeeIcon}>
                    <UserIcon />
                  </div>

                  <div style={getEmployeeNameStyle(isMobile)}>
                    {employeeName}
                  </div>

                  {!isMobile && <div style={employeeDividerSmall} />}

                  <button style={logoutInlineButton} onClick={logout}>
                    <LogoutIcon />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>

                <button
                  style={getMainWorkstationButtonStyle(isMobile)}
                  onClick={() => router.push(`/finance/${branch}`)}
                >
                  <HomeIcon />
                  <span>محطة العمل الرئيسية</span>
                </button>
              </div>

              <div style={getHeroTitleBoxStyle(screen)}>
                <h1 style={getTitleStyle(screen)}>تعديل العقد</h1>
              </div>

              <div style={getHeroActionBoxStyle(screen)} />
            </div>
          </header>

          <div style={loadingBox}>جاري تحميل العقد...</div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <header style={getHeroStyle(isMobile)}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div style={getHeroContentStyle(screen)}>
            <div style={getHeroUserCardStyle(screen)}>
              <div style={getEmployeeTopRowStyle(screen)}>
                <div style={employeeIcon}>
                  <UserIcon />
                </div>

                <div style={getEmployeeNameStyle(isMobile)}>
                  {employeeName}
                </div>

                {!isMobile && <div style={employeeDividerSmall} />}

                <button style={logoutInlineButton} onClick={logout}>
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                style={getMainWorkstationButtonStyle(isMobile)}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>تعديل العقد</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
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

        <div style={backWrapper}>
          <button style={backButton} onClick={() => router.back()}>
            ← رجوع
          </button>
        </div>
      </div>
    </main>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4.8 20.2c.8-3.5 3.6-5.4 7.2-5.4s6.4 1.9 7.2 5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 7V5.8c0-1 .8-1.8 1.8-1.8h6.1c1 0 1.8.8 1.8 1.8v12.4c0 1-.8 1.8-1.8 1.8h-6.1c-1 0-1.8-.8-1.8-1.8V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.8 12h9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.8 8.8 4.6 12l3.2 3.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.8 11.2 12 4.5l8.2 6.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 10.4v9.1h11.6v-9.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10 19.5v-5.2h4v5.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getPageStyle(isMobile: boolean): CSSProperties {
  return {
    minHeight: "100vh",
    backgroundColor: "#f6f9ff",
    backgroundImage: `
      radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%),
      radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%),
      radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%),
      linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)),
      url('/backgrounds/v13-finance-bg-1.png')
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: isMobile ? "scroll" : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily: "var(--font-almarai), sans-serif",
  };
}

function getContainerStyle(isCompact: boolean): CSSProperties {
  return {
    width: "100%",
    maxWidth: isCompact ? 980 : 1180,
    margin: "auto",
  };
}

function getHeroStyle(isMobile: boolean): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile ? "auto" : 160,
    borderRadius: isMobile ? 20 : 24,
    padding: isMobile ? "18px 14px" : "22px 26px",
    marginBottom: 14,
    overflow: "hidden",
    border: "none",
    outline: "none",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    boxShadow: "none",
    isolation: "isolate",
  };
}

function getHeroContentStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "center",
      gap: 16,
      direction: "rtl",
    };
  }

  if (screen === "tablet") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "grid",
      gridTemplateColumns: "1fr",
      alignItems: "center",
      justifyItems: "center",
      gap: 18,
      direction: "rtl",
    };
  }

  return {
    position: "relative",
    zIndex: 3,
    minHeight: 116,
    display: "grid",
    gridTemplateColumns: "minmax(250px, 315px) 1fr minmax(220px, 315px)",
    alignItems: "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      width: "100%",
      display: "grid",
      gap: 12,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  if (screen === "tablet") {
    return {
      width: "100%",
      maxWidth: 520,
      display: "grid",
      gap: 14,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  return {
    width: "100%",
    maxWidth: 315,
    display: "grid",
    gap: 24,
    direction: "ltr",
    justifySelf: "start",
  };
}

function getEmployeeTopRowStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      minHeight: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 10,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  if (screen === "tablet") {
    return {
      height: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  return {
    height: 42,
    display: "flex",
    alignItems: "center",
    gap: 14,
    direction: "ltr",
    color: "#ffffff",
  };
}

function getEmployeeNameStyle(isMobile: boolean): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
    textShadow: "0 4px 10px rgba(15,23,42,0.18)",
  };
}

function getMainWorkstationButtonStyle(isMobile: boolean): CSSProperties {
  return {
    width: isMobile ? "100%" : 220,
    maxWidth: isMobile ? 280 : 220,
    height: 44,
    border: "none",
    background: "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "var(--font-almarai), sans-serif",
    boxShadow: "0 8px 18px rgba(22,163,74,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getHeroTitleBoxStyle(screen: ScreenType): CSSProperties {
  return {
    position: "relative",
    zIndex: 4,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents: "none",
    order: screen === "desktop" ? 0 : 1,
  };
}

function getTitleStyle(screen: ScreenType): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize: screen === "mobile" ? 26 : screen === "tablet" ? 28 : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow: "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      display: "none",
      width: "100%",
      order: 3,
    };
  }

  if (screen === "tablet") {
    return {
      display: "none",
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 12,
    direction: "rtl",
  };
}

const employeeIcon: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1.5px solid rgba(255,255,255,0.34)",
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.96)",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background: "rgba(255,255,255,0.30)",
  flex: "0 0 auto",
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.90)",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 9,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
  padding: 0,
  whiteSpace: "nowrap",
  direction: "rtl",
};

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 210,
  height: 210,
  right: -78,
  top: -85,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.075)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleTwo: CSSProperties = {
  position: "absolute",
  width: 245,
  height: 245,
  right: 145,
  bottom: -178,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.045)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleThree: CSSProperties = {
  position: "absolute",
  width: 150,
  height: 150,
  left: 380,
  top: -96,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.035)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroDots: CSSProperties = {
  position: "absolute",
  top: 28,
  right: 34,
  width: 84,
  height: 58,
  opacity: 0.24,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.40) 2px, transparent 2px)",
  backgroundSize: "14px 14px",
  zIndex: 2,
};

const card: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const sectionTitle: CSSProperties = {
  marginTop: 0,
  color: "#0d47a1",
  fontSize: 22,
  fontWeight: 900,
};

const input: CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
  boxSizing: "border-box",
  background: "white",
  fontFamily: "var(--font-almarai), sans-serif",
};

const textarea: CSSProperties = {
  width: "100%",
  minHeight: 100,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
  boxSizing: "border-box",
  background: "white",
  fontFamily: "var(--font-almarai), sans-serif",
  resize: "vertical",
};

const saveButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const loadingBox: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  textAlign: "center",
  color: "#0d47a1",
  fontWeight: "bold",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "11px 18px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily: "var(--font-almarai), sans-serif",
};
