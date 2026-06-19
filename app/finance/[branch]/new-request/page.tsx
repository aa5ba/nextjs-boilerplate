"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

type ScreenType = "mobile" | "tablet" | "desktop";

type FinanceUser = {
  id?: string;
  branch_id?: string;
  branch_slug?: string;
  full_name?: string;
  username?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
};

type Investor = {
  id: string;
  investor_name: string;
  national_id?: string | null;
  is_active?: boolean | null;
};

type Product = {
  id: string;
  product_name: string;
  is_active?: boolean | null;
};

type CreatedRequest = {
  contract_id?: string | null;
  note_id?: string | null;
  contract_number?: string | null;
};

type SupabaseRpcError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const MAX_CONTRACT_CREATE_ATTEMPTS = 5;

export default function NewRequestPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "");
  const today = new Date().toLocaleDateString("en-CA");

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [authorized, setAuthorized] = useState(false);
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [branchId, setBranchId] = useState<string | null>(null);

  const [investors, setInvestors] = useState<Investor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");
  const [workName, setWorkName] = useState("");
  const [address, setAddress] = useState("");

  const [financeType, setFinanceType] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [productId, setProductId] = useState("");
  const [productQuantity, setProductQuantity] = useState("");
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [printPartyType, setPrintPartyType] = useState<
    "organization" | "investor"
  >("organization");

  const [debtAmount, setDebtAmount] = useState("");
  const [hasDeferredPayments, setHasDeferredPayments] = useState(false);
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [deferredPaymentsCount, setDeferredPaymentsCount] = useState("");

  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [draftPaymentDueDate, setDraftPaymentDueDate] = useState("");
  const [contractIssueDate, setContractIssueDate] = useState(today);

  const [hasGuarantor, setHasGuarantor] = useState(false);
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorNationalId, setGuarantorNationalId] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [guarantorBirthHijri, setGuarantorBirthHijri] = useState("");

  const [legalCity, setLegalCity] = useState("");
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

    return () => {
      window.removeEventListener("resize", updateScreen);
    };
  }, []);

  useEffect(() => {
    if (!branch) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function initPage() {
      const validSession = await validateSession();

      if (!validSession || cancelled) {
        return;
      }

      await loadLists();

      if (!cancelled) {
        setAuthorized(true);
      }
    }

    void initPage();

    return () => {
      cancelled = true;
    };
  }, [branch]);

  useEffect(() => {
    void loadAvailableStock();
  }, [branchId, investorId, productId]);

  function clearFinanceSession() {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem("finance_user");
    localStorage.removeItem("finance_branch_user");
    localStorage.removeItem("finance_user_id");
    localStorage.removeItem("finance_user_name");
    localStorage.removeItem("finance_username");
    localStorage.removeItem("finance_role");
    localStorage.removeItem("finance_branch_id");
    localStorage.removeItem("finance_branch_slug");
    localStorage.removeItem("finance_branch_name");
    localStorage.removeItem("finance_organization_name");
  }

  function redirectToLogin() {
    clearFinanceSession();
    setAuthorized(false);
    router.replace("/login");
  }

  function getLocalUser(): FinanceUser | null {
    if (typeof window === "undefined") {
      return null;
    }

    const savedUser =
      localStorage.getItem("finance_user") ||
      localStorage.getItem("finance_branch_user");

    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as FinanceUser;

        if (parsed?.branch_id && parsed?.branch_slug) {
          return parsed;
        }
      } catch {
        // تتم قراءة المفاتيح القديمة أدناه.
      }
    }

    const savedBranchId = localStorage.getItem("finance_branch_id");
    const savedBranchSlug = localStorage.getItem("finance_branch_slug");

    if (!savedBranchId || !savedBranchSlug) {
      return null;
    }

    return {
      id: localStorage.getItem("finance_user_id") || undefined,
      branch_id: savedBranchId,
      branch_slug: savedBranchSlug,
      full_name: localStorage.getItem("finance_user_name") || "الموظف",
      username: localStorage.getItem("finance_username") || "",
      role: localStorage.getItem("finance_role") || "",
      permissions: [],
    };
  }

  async function validateSession() {
    const localUser = getLocalUser();

    if (!localUser?.branch_id || !localUser.branch_slug) {
      redirectToLogin();
      return false;
    }

    if (localUser.branch_slug !== branch) {
      router.replace(`/finance/${localUser.branch_slug}`);
      return false;
    }

    setEmployeeName(
      localUser.full_name || localUser.username || "الموظف"
    );

    const { data: branchData, error: branchError } = await supabase
      .from("finance_branches")
      .select("id, branch_slug, is_active")
      .eq("branch_slug", branch)
      .maybeSingle();

    if (
      branchError ||
      !branchData ||
      !branchData.is_active ||
      String(branchData.id) !== String(localUser.branch_id)
    ) {
      redirectToLogin();
      return false;
    }

    if (localUser.id) {
      const { data: userData, error: userError } = await supabase
        .from("finance_branch_users")
        .select("id, branch_id, full_name, username, is_active")
        .eq("id", localUser.id)
        .eq("branch_id", branchData.id)
        .maybeSingle();

      if (userError || !userData || !userData.is_active) {
        redirectToLogin();
        return false;
      }

      setEmployeeName(
        userData.full_name ||
          userData.username ||
          localUser.full_name ||
          "الموظف"
      );
    }

    return true;
  }

  async function loadLists() {
    const currentBranchId = await getBranchId(branch);

    if (!currentBranchId) {
      alert("تعذر تحديد الفرع");
      redirectToLogin();
      return;
    }

    const safeBranchId = String(currentBranchId);
    setBranchId(safeBranchId);

    const [investorsResult, productsResult] = await Promise.all([
      supabase
        .from("finance_investors")
        .select("id, investor_name, national_id, is_active")
        .eq("branch_id", safeBranchId)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),

      supabase
        .from("finance_products")
        .select("id, product_name, is_active")
        .eq("branch_id", safeBranchId)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);

    if (investorsResult.error) {
      alert(
        "تعذر تحميل المستثمرين: " +
          investorsResult.error.message
      );
    }

    if (productsResult.error) {
      alert(
        "تعذر تحميل المنتجات: " +
          productsResult.error.message
      );
    }

    setInvestors((investorsResult.data || []) as Investor[]);
    setProducts((productsResult.data || []) as Product[]);
  }

  async function loadAvailableStock() {
    if (!branchId || !investorId || !productId) {
      setAvailableStock(null);
      return;
    }

    const safeBranchId = branchId;

    const { data, error } = await supabase
      .from("finance_inventory")
      .select("quantity")
      .eq("branch_id", safeBranchId)
      .eq("investor_id", investorId)
      .eq("product_id", productId)
      .maybeSingle();

    if (error) {
      console.error("Inventory loading error:", error);
      setAvailableStock(null);
      return;
    }

    setAvailableStock(data ? Number(data.quantity || 0) : 0);
  }

  function resetDeferredPaymentsFields() {
    setInstallmentAmount("");
    setDeferredPaymentsCount("");
  }

  function resetGuarantorFields() {
    setGuarantorName("");
    setGuarantorNationalId("");
    setGuarantorPhone("");
    setGuarantorBirthHijri("");
  }

  function validateRequest() {
    const qty = toNumber(productQuantity);
    const debt = toNumber(debtAmount);
    const deferredPayment = toNumber(installmentAmount);
    const deferredCount = toNumber(deferredPaymentsCount);

    if (!branchId) return "تعذر تحديد الفرع";
    if (!fullName.trim()) return "يرجى إدخال اسم العميل";
    if (!nationalId) return "يرجى إدخال رقم الهوية";
    if (!birthDay) return "يرجى إدخال يوم الميلاد";
    if (!birthMonth) return "يرجى إدخال شهر الميلاد";
    if (!birthYear) return "يرجى إدخال سنة الميلاد";
    if (!phone) return "يرجى إدخال رقم الجوال";
    if (!financeType.trim()) return "يرجى إدخال نوع التمويل";

    if (!investorId) {
      return "يرجى اختيار المستثمر المرتبط بالمخزون";
    }

    if (!productId) return "يرجى اختيار المنتج";
    if (!productQuantity) return "يرجى إدخال الكمية";
    if (qty <= 0) return "يرجى إدخال كمية صحيحة";

    if (!debtAmount) {
      return "يرجى إدخال مبلغ الاستحقاق / مبلغ السند";
    }

    if (debt <= 0) {
      return "يرجى إدخال مبلغ استحقاق صحيح";
    }

    if (hasDeferredPayments) {
      if (!installmentAmount) {
        return "يرجى إدخال قيمة الدفعة الآجلة";
      }

      if (deferredPayment <= 0) {
        return "يرجى إدخال قيمة دفعة آجلة صحيحة";
      }

      if (!deferredPaymentsCount) {
        return "يرجى إدخال عدد الدفعات الآجلة";
      }

      if (deferredCount <= 0) {
        return "يرجى إدخال عدد دفعات آجلة صحيح";
      }
    }

    if (!paymentDueDate) {
      return "يرجى اختيار تاريخ الاستحقاق ثم الضغط على زر تم";
    }

    if (!contractIssueDate) {
      return "يرجى اختيار تاريخ تحرير العقد";
    }

    if (!legalCity.trim()) {
      return "يرجى إدخال مدينة التقاضي";
    }

    if (hasGuarantor) {
      if (!guarantorName.trim()) {
        return "يرجى إدخال اسم الكفيل";
      }

      if (!guarantorNationalId) {
        return "يرجى إدخال رقم هوية الكفيل";
      }

      if (!guarantorPhone) {
        return "يرجى إدخال رقم جوال الكفيل";
      }

      if (!guarantorBirthHijri.trim()) {
        return "يرجى إدخال تاريخ ميلاد الكفيل";
      }
    }

    return "";
  }

  function isDuplicateContractNumberError(
    error: SupabaseRpcError | null | undefined
  ) {
    const combinedMessage = [
      error?.message,
      error?.details,
      error?.hint,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      error?.code === "23505" ||
      combinedMessage.includes(
        "finance_contracts_branch_contract_number_key"
      ) ||
      combinedMessage.includes("duplicate key value") ||
      combinedMessage.includes("unique constraint")
    );
  }

  function wait(milliseconds: number) {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  async function createAtomicRequestWithRetry(
    rpcPayload: Record<string, unknown>
  ): Promise<CreatedRequest> {
    let lastError: SupabaseRpcError | null = null;

    for (
      let attempt = 1;
      attempt <= MAX_CONTRACT_CREATE_ATTEMPTS;
      attempt += 1
    ) {
      const { data, error } = await supabase.rpc(
        "create_new_request_atomic",
        rpcPayload
      );

      if (!error) {
        const rows = Array.isArray(data) ? data : [];
        return (rows[0] || {}) as CreatedRequest;
      }

      lastError = error as SupabaseRpcError;

      if (!isDuplicateContractNumberError(lastError)) {
        throw new Error(
          lastError.message || "تعذر إنشاء الطلب"
        );
      }

      if (attempt < MAX_CONTRACT_CREATE_ATTEMPTS) {
        await wait(250 * attempt);
      }
    }

    console.error(
      "Contract number duplicate after retries:",
      lastError
    );

    throw new Error(
      "تعذر إنشاء رقم عقد جديد بسبب تعارض مؤقت في تسلسل أرقام العقود. حاول مرة أخرى."
    );
  }

  async function createRequest() {
    if (saving) return;

    const validationMessage = validateRequest();

    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    const safeBranchId: string = branchId;

    const selectedInvestor = investors.find(
      (item) => item.id === investorId
    );

    const selectedProduct = products.find(
      (item) => item.id === productId
    );

    if (!selectedInvestor) {
      alert("تعذر تحديد المستثمر");
      return;
    }

    if (!selectedProduct) {
      alert("تعذر تحديد المنتج");
      return;
    }

    const cleanNationalId = normalizeNumber(nationalId);
    const cleanPhone = normalizeNumber(phone);

    const cleanGuarantorNationalId = normalizeNumber(
      guarantorNationalId
    );

    const cleanGuarantorPhone = normalizeNumber(
      guarantorPhone
    );

    const qty = toNumber(productQuantity);
    const debt = toNumber(debtAmount);

    const deferredPayment = hasDeferredPayments
      ? toNumber(installmentAmount)
      : 0;

    const deferredCount = hasDeferredPayments
      ? toNumber(deferredPaymentsCount)
      : 0;

    if (cleanNationalId.length !== 10) {
      alert("رقم الهوية يجب أن يكون 10 أرقام");
      return;
    }

    if (!/^05\d{8}$/.test(cleanPhone)) {
      alert("رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05");
      return;
    }

    if (
      hasGuarantor &&
      cleanGuarantorNationalId.length !== 10
    ) {
      alert("رقم هوية الكفيل يجب أن يكون 10 أرقام");
      return;
    }

    if (
      hasGuarantor &&
      !/^05\d{8}$/.test(cleanGuarantorPhone)
    ) {
      alert(
        "رقم جوال الكفيل يجب أن يكون 10 أرقام ويبدأ بـ 05"
      );
      return;
    }

    try {
      setSaving(true);

      const { data: stockData, error: stockError } =
        await supabase
          .from("finance_inventory")
          .select("quantity")
          .eq("branch_id", safeBranchId)
          .eq("investor_id", investorId)
          .eq("product_id", productId)
          .maybeSingle();

      if (stockError) {
        throw new Error(
          "تعذر التحقق من المخزون: " +
            stockError.message
        );
      }

      const beforeQty = Number(stockData?.quantity || 0);

      if (beforeQty < qty) {
        const confirmContinue = window.confirm(
          `الكمية المطلوبة (${qty}) أكبر من المتوفر في المخزون (${beforeQty}). هل تريد الاستمرار والسماح بوصول المخزون إلى السالب؟`
        );

        if (!confirmContinue) {
          return;
        }
      }

      const { data: branchData, error: branchError } =
        await supabase
          .from("finance_branches")
          .select("organization_name, commercial_record")
          .eq("id", safeBranchId)
          .single();

      if (branchError) {
        throw new Error(
          "تعذر جلب بيانات الفرع: " +
            branchError.message
        );
      }

      const printPartyName =
        printPartyType === "organization"
          ? branchData?.organization_name || ""
          : selectedInvestor.investor_name;

      const printPartyIdentifier =
        printPartyType === "organization"
          ? branchData?.commercial_record || ""
          : selectedInvestor.national_id || "";

      const birthHijri = `${birthDay}/${birthMonth}/${birthYear}`;

      const rpcPayload = {
        p_branch_id: safeBranchId,

        p_full_name: fullName.trim(),
        p_national_id: cleanNationalId,
        p_birth_hijri: birthHijri,
        p_phone: cleanPhone,
        p_work_name: workName.trim(),
        p_address: address.trim(),

        p_finance_type: financeType.trim(),

        p_investor_id: selectedInvestor.id,
        p_investor_name: selectedInvestor.investor_name,

        p_product_id: selectedProduct.id,
        p_product_name: selectedProduct.product_name,
        p_product_quantity: qty,

        p_print_party_type: printPartyType,
        p_print_party_name: printPartyName,
        p_print_party_identifier:
          printPartyIdentifier || "",

        p_debt_amount: debt,
        p_payment_amount: debt,

        p_has_deferred_payments: hasDeferredPayments,
        p_installment_amount: deferredPayment,
        p_deferred_payments_count: deferredCount,

        p_payment_type: "تاريخ استحقاق",
        p_payment_due_date: paymentDueDate,

        p_contract_issue_date_gregorian:
          contractIssueDate,
        p_contract_issue_date_hijri: "",

        p_legal_city: legalCity.trim(),
        p_notes: notes.trim(),

        p_has_guarantor: hasGuarantor,
        p_guarantor_name: hasGuarantor
          ? guarantorName.trim()
          : "",
        p_guarantor_national_id: hasGuarantor
          ? cleanGuarantorNationalId
          : "",
        p_guarantor_phone: hasGuarantor
          ? cleanGuarantorPhone
          : "",
        p_guarantor_birth_hijri: hasGuarantor
          ? guarantorBirthHijri.trim()
          : "",
      };

      const created =
        await createAtomicRequestWithRetry(rpcPayload);

      if (!created.contract_id || !created.note_id) {
        throw new Error(
          "تم إنشاء الطلب لكن لم يتم إرجاع بيانات العقد والسند للطباعة"
        );
      }

      alert("تم إنشاء الطلب وخصم المخزون بنجاح");

      router.push(
        `/finance/${branch}/new-request/print/${created.contract_id}/${created.note_id}`
      );
    } catch (error: unknown) {
      console.error("Create request error:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء إنشاء الطلب";

      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    redirectToLogin();
  }

  if (!authorized) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getContainerStyle(isCompact)}>
          <section style={getHeroStyle(isMobile)}>
            <div style={heroCircleOne} />
            <div style={heroCircleTwo} />
            <div style={heroCircleThree} />
            <div style={heroDots} />

            <div style={loadingHeroContent}>
              جاري التحقق من تسجيل الدخول...
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <section style={getHeroStyle(isMobile)}>
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

                {!isMobile && (
                  <div style={employeeDividerSmall} />
                )}

                <button
                  type="button"
                  style={logoutInlineButton}
                  onClick={logout}
                >
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                type="button"
                style={getMainWorkstationButtonStyle(isMobile)}
                onClick={() =>
                  router.push(`/finance/${branch}`)
                }
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>
                طلب جديد
              </h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)}>
              <div style={dateBox}>
                <span style={dateLabelStyle}>
                  تاريخ اليوم
                </span>

                <strong style={dateText}>
                  {today}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات العميل</h2>

          <Field label="اسم العميل">
            <input
              style={input}
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
            />
          </Field>

          <Field label="رقم الهوية">
            <input
              style={input}
              inputMode="numeric"
              maxLength={10}
              value={nationalId}
              onChange={(event) =>
                setNationalId(
                  normalizeNumber(event.target.value)
                )
              }
            />
          </Field>

          <div style={dateFieldTitle}>
            تاريخ الميلاد بالهجري
          </div>

          <div style={getDateGridStyle(isMobile)}>
            <Field label="اليوم">
              <input
                style={input}
                inputMode="numeric"
                maxLength={2}
                value={birthDay}
                onChange={(event) =>
                  setBirthDay(
                    normalizeNumber(event.target.value)
                  )
                }
              />
            </Field>

            <Field label="الشهر">
              <input
                style={input}
                inputMode="numeric"
                maxLength={2}
                value={birthMonth}
                onChange={(event) =>
                  setBirthMonth(
                    normalizeNumber(event.target.value)
                  )
                }
              />
            </Field>

            <Field label="السنة">
              <input
                style={input}
                inputMode="numeric"
                maxLength={4}
                value={birthYear}
                onChange={(event) =>
                  setBirthYear(
                    normalizeNumber(event.target.value)
                  )
                }
              />
            </Field>
          </div>

          <div style={twoColumns}>
            <Field label="رقم الجوال">
              <input
                style={input}
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(event) =>
                  setPhone(
                    normalizeNumber(event.target.value)
                  )
                }
              />
            </Field>

            <Field label="العمل - اختياري">
              <input
                style={input}
                value={workName}
                onChange={(event) =>
                  setWorkName(event.target.value)
                }
              />
            </Field>
          </div>

          <Field label="العنوان - اختياري">
            <input
              style={input}
              value={address}
              onChange={(event) =>
                setAddress(event.target.value)
              }
            />
          </Field>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>الطرف الأول</h2>

          <Field label="المستثمر المرتبط بالمخزون">
            <select
              style={input}
              value={investorId}
              onChange={(event) =>
                setInvestorId(event.target.value)
              }
            >
              <option value="">اختر المستثمر</option>

              {investors.map((investor) => (
                <option
                  key={investor.id}
                  value={investor.id}
                >
                  {investor.investor_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="اختر المنتج">
            <select
              style={input}
              value={productId}
              onChange={(event) =>
                setProductId(event.target.value)
              }
            >
              <option value="">اختر المنتج</option>

              {products.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {product.product_name}
                </option>
              ))}
            </select>
          </Field>

          {availableStock !== null && (
            <div
              style={
                availableStock < 0
                  ? stockDanger
                  : stockInfo
              }
            >
              المتوفر في المخزون: {availableStock}
            </div>
          )}

          <Field label="الكمية">
            <input
              style={input}
              inputMode="numeric"
              value={productQuantity}
              onChange={(event) =>
                setProductQuantity(
                  normalizeNumber(event.target.value)
                )
              }
            />
          </Field>

          <Field label="الطرف الأول المسجّل في العقد والسند">
            <select
              style={input}
              value={printPartyType}
              onChange={(event) =>
                setPrintPartyType(
                  event.target.value as
                    | "organization"
                    | "investor"
                )
              }
            >
              <option value="organization">
                المستثمر الرئيسي - المؤسسة
              </option>

              <option value="investor">
                المستثمر
              </option>
            </select>
          </Field>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            بيانات العقد والسند
          </h2>

          <Field label="نوع التمويل">
            <input
              style={input}
              value={financeType}
              onChange={(event) =>
                setFinanceType(event.target.value)
              }
            />
          </Field>

          <Field label="مبلغ الاستحقاق / مبلغ السند">
            <input
              style={input}
              inputMode="numeric"
              value={debtAmount}
              onChange={(event) =>
                setDebtAmount(
                  normalizeNumber(event.target.value)
                )
              }
            />
          </Field>

          <Field label="هل يوجد دفعات آجلة؟">
            <select
              style={input}
              value={
                hasDeferredPayments ? "yes" : "no"
              }
              onChange={(event) => {
                const value =
                  event.target.value === "yes";

                setHasDeferredPayments(value);

                if (!value) {
                  resetDeferredPaymentsFields();
                }
              }}
            >
              <option value="no">بدون دفعات</option>
              <option value="yes">يوجد دفعات</option>
            </select>
          </Field>

          {hasDeferredPayments && (
            <>
              <Field label="قيمة الدفعة الآجلة">
                <input
                  style={input}
                  inputMode="numeric"
                  value={installmentAmount}
                  onChange={(event) =>
                    setInstallmentAmount(
                      normalizeNumber(
                        event.target.value
                      )
                    )
                  }
                />
              </Field>

              <Field label="عدد الدفعات الآجلة">
                <input
                  style={input}
                  inputMode="numeric"
                  value={deferredPaymentsCount}
                  onChange={(event) =>
                    setDeferredPaymentsCount(
                      normalizeNumber(
                        event.target.value
                      )
                    )
                  }
                />
              </Field>
            </>
          )}

          <Field label="تاريخ الاستحقاق بالميلادي">
            <div style={getDateConfirmRowStyle(isMobile)}>
              <input
                style={{
                  ...input,
                  marginBottom: 0,
                }}
                type="date"
                value={draftPaymentDueDate}
                onChange={(event) =>
                  setDraftPaymentDueDate(
                    event.target.value
                  )
                }
              />

              <button
                type="button"
                style={doneButton}
                onClick={() => {
                  if (!draftPaymentDueDate) {
                    alert(
                      "اختر تاريخ الاستحقاق أولاً"
                    );
                    return;
                  }

                  setPaymentDueDate(
                    draftPaymentDueDate
                  );
                }}
              >
                تم
              </button>
            </div>

            {paymentDueDate && (
              <div style={confirmedDate}>
                التاريخ المعتمد: {paymentDueDate}
              </div>
            )}
          </Field>

          <Field label="مدينة التقاضي">
            <input
              style={input}
              value={legalCity}
              onChange={(event) =>
                setLegalCity(event.target.value)
              }
            />
          </Field>

          <Field label="هل يوجد كفيل؟">
            <select
              style={input}
              value={hasGuarantor ? "yes" : "no"}
              onChange={(event) => {
                const value =
                  event.target.value === "yes";

                setHasGuarantor(value);

                if (!value) {
                  resetGuarantorFields();
                }
              }}
            >
              <option value="no">بدون كفيل</option>
              <option value="yes">يوجد كفيل</option>
            </select>
          </Field>

          {hasGuarantor && (
            <>
              <Field label="اسم الكفيل">
                <input
                  style={input}
                  value={guarantorName}
                  onChange={(event) =>
                    setGuarantorName(
                      event.target.value
                    )
                  }
                />
              </Field>

              <Field label="رقم هوية الكفيل">
                <input
                  style={input}
                  inputMode="numeric"
                  maxLength={10}
                  value={guarantorNationalId}
                  onChange={(event) =>
                    setGuarantorNationalId(
                      normalizeNumber(
                        event.target.value
                      )
                    )
                  }
                />
              </Field>

              <Field label="رقم جوال الكفيل">
                <input
                  style={input}
                  inputMode="numeric"
                  maxLength={10}
                  value={guarantorPhone}
                  onChange={(event) =>
                    setGuarantorPhone(
                      normalizeNumber(
                        event.target.value
                      )
                    )
                  }
                />
              </Field>

              <Field label="تاريخ ميلاد الكفيل">
                <input
                  style={input}
                  value={guarantorBirthHijri}
                  onChange={(event) =>
                    setGuarantorBirthHijri(
                      event.target.value
                    )
                  }
                />
              </Field>
            </>
          )}

          <Field label="ملاحظات">
            <textarea
              style={textarea}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
            />
          </Field>

          <Field label="تاريخ تحرير العقد">
            <input
              style={input}
              type="date"
              value={contractIssueDate}
              onChange={(event) =>
                setContractIssueDate(
                  event.target.value
                )
              }
            />
          </Field>

          <button
            type="button"
            style={{
              ...primaryButton,
              opacity: saving ? 0.7 : 1,
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
            onClick={createRequest}
            disabled={saving}
          >
            {saving
              ? "جاري إنشاء الطلب..."
              : "إنشاء الطلب وطباعة العقد"}
          </button>
        </section>

        <div style={backWrapper}>
          <button
            type="button"
            style={backButton}
            onClick={() => router.back()}
          >
            ← الرجوع
          </button>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={fieldBox}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function UserIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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

function getPageStyle(
  isMobile: boolean
): CSSProperties {
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
    backgroundAttachment: isMobile
      ? "scroll"
      : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getContainerStyle(
  isCompact: boolean
): CSSProperties {
  return {
    width: "100%",
    maxWidth: isCompact ? 980 : 1040,
    margin: "auto",
  };
}

function getHeroStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile ? "auto" : 160,
    borderRadius: isMobile ? 20 : 24,
    padding: isMobile
      ? "18px 14px"
      : "22px 26px",
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

function getHeroContentStyle(
  screen: ScreenType
): CSSProperties {
  if (screen === "mobile") {
    return {
      position: "relative",
      zIndex: 3,
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
    gridTemplateColumns:
      "minmax(250px,315px) 1fr minmax(220px,315px)",
    alignItems: "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(
  screen: ScreenType
): CSSProperties {
  if (screen === "mobile") {
    return {
      width: "100%",
      display: "grid",
      gap: 12,
      direction: "rtl",
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

function getEmployeeTopRowStyle(
  screen: ScreenType
): CSSProperties {
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

  return {
    height: 42,
    display: "flex",
    alignItems: "center",
    justifyContent:
      screen === "tablet" ? "center" : "flex-start",
    gap: 14,
    direction: screen === "tablet" ? "rtl" : "ltr",
    color: "#ffffff",
    width: "100%",
  };
}

function getEmployeeNameStyle(
  isMobile: boolean
): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
    textShadow:
      "0 4px 10px rgba(15,23,42,0.18)",
  };
}

function getMainWorkstationButtonStyle(
  isMobile: boolean
): CSSProperties {
  return {
    width: isMobile ? "100%" : 220,
    maxWidth: isMobile ? 280 : 220,
    height: 44,
    border: "none",
    background:
      "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily:
      "var(--font-almarai), sans-serif",
    boxShadow:
      "0 8px 18px rgba(22,163,74,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getHeroTitleBoxStyle(
  screen: ScreenType
): CSSProperties {
  return {
    position: "relative",
    zIndex: 4,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    direction: "rtl",
    order: screen === "desktop" ? 0 : 1,
  };
}

function getTitleStyle(
  screen: ScreenType
): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize:
      screen === "mobile"
        ? 27
        : screen === "tablet"
          ? 30
          : 34,
    lineHeight: 1.45,
    fontWeight: 700,
    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",
    fontFamily:
      "var(--font-noto-naskh-arabic), 'Noto Naskh Arabic', 'Amiri', serif",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
  if (
    screen === "mobile" ||
    screen === "tablet"
  ) {
    return {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    direction: "rtl",
  };
}

function getDateGridStyle(
  isMobile: boolean
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isMobile
      ? "1fr"
      : "repeat(3,1fr)",
    gap: 10,
  };
}

function getDateConfirmRowStyle(
  isMobile: boolean
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isMobile
      ? "1fr"
      : "1fr auto",
    gap: 10,
    alignItems: "center",
  };
}

const loadingHeroContent: CSSProperties = {
  position: "relative",
  zIndex: 3,
  minHeight: 116,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#ffffff",
  fontSize: 24,
  fontWeight: 900,
  textAlign: "center",
};

const employeeIcon: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border:
    "1.5px solid rgba(255,255,255,0.34)",
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
  fontFamily:
    "var(--font-almarai), sans-serif",
  padding: 0,
  whiteSpace: "nowrap",
  direction: "rtl",
};

const dateBox: CSSProperties = {
  minWidth: 130,
  display: "grid",
  gap: 5,
  textAlign: "center",
  color: "#ffffff",
};

const dateLabelStyle: CSSProperties = {
  color: "rgba(255,255,255,0.75)",
  fontSize: 13,
  fontWeight: 800,
};

const dateText: CSSProperties = {
  color: "#ffffff",
  fontSize: 17,
  fontWeight: 900,
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
  background: "rgba(255,255,255,0.97)",
  border: "1px solid #dbe5f3",
  borderRadius: 20,
  padding: 20,
  marginBottom: 14,
  boxShadow:
    "0 10px 26px rgba(15,23,42,0.05)",
};

const sectionTitle: CSSProperties = {
  margin: "0 0 18px",
  color: "#0d47a1",
  fontSize: 22,
  fontWeight: 900,
};

const fieldBox: CSSProperties = {
  marginBottom: 14,
};

const fieldLabel: CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#0d47a1",
  fontWeight: 900,
  fontSize: 15,
};

const input: CSSProperties = {
  width: "100%",
  minHeight: 50,
  padding: "0 14px",
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const textarea: CSSProperties = {
  ...input,
  minHeight: 110,
  padding: 14,
  resize: "vertical",
  lineHeight: 1.8,
};

const dateFieldTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  marginBottom: 8,
  color: "#374151",
};

const twoColumns: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
};

const doneButton: CSSProperties = {
  height: 50,
  padding: "0 20px",
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  boxShadow:
    "0 5px 14px rgba(22,163,74,0.18)",
};

const confirmedDate: CSSProperties = {
  marginTop: 9,
  color: "#166534",
  fontWeight: 900,
  fontSize: 14,
};

const stockInfo: CSSProperties = {
  background: "#f0fdf4",
  color: "#166534",
  border: "1px solid #bbf7d0",
  padding: 12,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 900,
  marginBottom: 12,
};

const stockDanger: CSSProperties = {
  background: "#fef2f2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  padding: 12,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 900,
  marginBottom: 12,
};

const primaryButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background:
    "linear-gradient(135deg,#0d47a1,#2563eb)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
  boxShadow:
    "0 8px 20px rgba(37,99,235,0.18)",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
  marginBottom: 8,
};

const backButton: CSSProperties = {
  padding: "11px 18px",
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};
