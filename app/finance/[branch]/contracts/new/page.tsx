"use client";

import { normalizeNumber, toNumber } from "@/lib/numberUtils";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";

type ScreenType = "mobile" | "tablet" | "desktop";

export default function NewFinanceContractPage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

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
  }, [branch]);

  useEffect(() => {
    loadAvailableStock();
  }, [branchId, investorId, productId]);

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

      const beforeQty = Number(stockData?.quantity || 0);

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

      if (!contractId) {
        throw new Error("تم إنشاء العقد لكن لم يتم إرجاع رقم العقد");
      }

      alert("تم إنشاء العقد وخصم المخزون بنجاح");
      router.push(`/finance/${branch}/contracts/${contractId}`);
    } catch (error: any) {
      alert(error.message || "حدث خطأ أثناء إنشاء العقد");
    } finally {
      setSaving(false);
    }
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
              <h1 style={getTitleStyle(screen)}>إنشاء عقد جديد</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

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

        <div style={backWrapper}>
          <button style={backButton} onClick={() => router.push(`/finance/${branch}/contracts`)}>
            الرجوع للعقود
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
  fontFamily: "var(--font-almarai), sans-serif",
};

const stockInfo: CSSProperties = {
  background: "#f0fdf4",
  color: "#166534",
  border: "1px solid #bbf7d0",
  padding: 12,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  marginBottom: 12,
};

const stockDanger: CSSProperties = {
  background: "#fef2f2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  padding: 12,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  marginBottom: 12,
};

const primaryButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
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
