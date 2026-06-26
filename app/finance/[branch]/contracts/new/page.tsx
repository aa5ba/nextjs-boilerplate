"use client";

import { normalizeNumber, toNumber } from "@/lib/numberUtils";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  ReactNode,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";

type ScreenType = "mobile" | "tablet" | "desktop";

type CustomerRecord = {
  id: string;
  full_name: string | null;
  national_id: string | null;
  birth_hijri: string | null;
  phone: string | null;
  work_name: string | null;
  address: string | null;
};

type InvestorRecord = {
  id: string;
  investor_name: string;
  national_id: string | null;
};

type ProductRecord = {
  id: string;
  product_name: string;
};

type BranchSession = {
  id?: string;
  branch_id?: string;
  branch_slug?: string;
  full_name?: string;
  username?: string;
  name?: string;
  role?: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type RpcScalarResult =
  | string
  | {
      contract_id?: string | null;
      id?: string | null;
    }
  | Array<{
      contract_id?: string | null;
      id?: string | null;
    }>
  | null;

export default function NewFinanceContractPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch || "");

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [authChecked, setAuthChecked] =
    useState(false);

  const [pageLoading, setPageLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [investors, setInvestors] =
    useState<InvestorRecord[]>([]);

  const [products, setProducts] =
    useState<ProductRecord[]>([]);

  const [customerId, setCustomerId] =
    useState<string | null>(null);

  const [customerNationalId, setCustomerNationalId] =
    useState("");

  const [customerFullName, setCustomerFullName] =
    useState("");

  const [customerBirthHijri, setCustomerBirthHijri] =
    useState("");

  const [customerPhone, setCustomerPhone] =
    useState("");

  const [customerWorkName, setCustomerWorkName] =
    useState("");

  const [customerAddress, setCustomerAddress] =
    useState("");

  const [customerLookupLoading, setCustomerLookupLoading] =
    useState(false);

  const [customerWasFound, setCustomerWasFound] =
    useState(false);

  const [hasGuarantor, setHasGuarantor] =
    useState(false);

  const [guarantorId, setGuarantorId] =
    useState<string | null>(null);

  const [guarantorNationalId, setGuarantorNationalId] =
    useState("");

  const [guarantorFullName, setGuarantorFullName] =
    useState("");

  const [guarantorBirthHijri, setGuarantorBirthHijri] =
    useState("");

  const [guarantorPhone, setGuarantorPhone] =
    useState("");

  const [guarantorWorkName, setGuarantorWorkName] =
    useState("");

  const [guarantorAddress, setGuarantorAddress] =
    useState("");

  const [
    guarantorLookupLoading,
    setGuarantorLookupLoading,
  ] = useState(false);

  const [guarantorWasFound, setGuarantorWasFound] =
    useState(false);

  const [financeType, setFinanceType] =
    useState("");

  const [investorId, setInvestorId] =
    useState("");

  const [productId, setProductId] =
    useState("");

  const [productQuantity, setProductQuantity] =
    useState("");

  const [availableStock, setAvailableStock] =
    useState<number | null>(null);

  const [printPartyType, setPrintPartyType] =
    useState("organization");

  const [debtAmount, setDebtAmount] =
    useState("");

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [installmentAmount, setInstallmentAmount] =
    useState("");

  const [paymentType, setPaymentType] =
    useState("");

  const [contractDateHijri, setContractDateHijri] =
    useState("");

  const [
    contractDateGregorian,
    setContractDateGregorian,
  ] = useState("");

  const [paymentDueDate, setPaymentDueDate] =
    useState("");

  const [legalCity, setLegalCity] =
    useState("");

  const [judicialAmount, setJudicialAmount] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

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

    window.addEventListener(
      "resize",
      updateScreen
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateScreen
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializePage() {
      try {
        setPageLoading(true);
        setLoadError("");

        if (typeof window === "undefined") {
          return;
        }

        const rawSession =
          localStorage.getItem(
            "finance_branch_user"
          );

        if (!rawSession) {
          router.replace("/login");
          return;
        }

        let parsedSession: BranchSession;

        try {
          parsedSession =
            JSON.parse(rawSession) as BranchSession;
        } catch {
          clearFinanceSession();
          router.replace("/login");
          return;
        }

        const currentBranchId =
          await getBranchId(branch);

        if (cancelled) return;

        if (!currentBranchId) {
          clearFinanceSession();
          router.replace("/login");
          return;
        }

        if (
          parsedSession.branch_id &&
          parsedSession.branch_id !== currentBranchId
        ) {
          clearFinanceSession();
          router.replace("/login");
          return;
        }

        if (
          parsedSession.branch_slug &&
          parsedSession.branch_slug !== branch
        ) {
          clearFinanceSession();
          router.replace("/login");
          return;
        }

        const storedName =
          localStorage.getItem(
            "finance_user_name"
          );

        setEmployeeName(
          storedName ||
            parsedSession.full_name ||
            parsedSession.username ||
            parsedSession.name ||
            "الموظف"
        );

        setBranchId(currentBranchId);

        const [
          investorsResult,
          productsResult,
        ] = await Promise.all([
          supabase
            .from("finance_investors")
            .select(
              "id, investor_name, national_id"
            )
            .eq(
              "branch_id",
              currentBranchId
            )
            .eq("is_active", true)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("finance_products")
            .select(
              "id, product_name"
            )
            .eq(
              "branch_id",
              currentBranchId
            )
            .eq("is_active", true)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (cancelled) return;

        if (investorsResult.error) {
          throw new Error(
            investorsResult.error.message
          );
        }

        if (productsResult.error) {
          throw new Error(
            productsResult.error.message
          );
        }

        setInvestors(
          (investorsResult.data ||
            []) as InvestorRecord[]
        );

        setProducts(
          (productsResult.data ||
            []) as ProductRecord[]
        );

        setAuthChecked(true);
      } catch (error: unknown) {
        if (cancelled) return;

        setLoadError(
          getErrorMessage(
            error,
            "تعذر تحميل صفحة إنشاء العقد"
          )
        );

        setAuthChecked(true);
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [branch, router]);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(
      async () => {
        if (
          !branchId ||
          customerNationalId.length !== 10
        ) {
          return;
        }

        try {
          setCustomerLookupLoading(true);

          const {
            data,
            error,
          } = await supabase
            .from("finance_customers")
            .select(
              "id, full_name, national_id, birth_hijri, phone, work_name, address"
            )
            .eq("branch_id", branchId)
            .eq(
              "national_id",
              customerNationalId
            )
            .maybeSingle();

          if (cancelled) return;

          if (error) {
            throw new Error(error.message);
          }

          if (data) {
            applyCustomerData(
              data as CustomerRecord
            );

            setCustomerWasFound(true);
          } else {
            setCustomerId(null);
            setCustomerWasFound(false);
          }
        } catch {
          if (!cancelled) {
            setCustomerId(null);
            setCustomerWasFound(false);
          }
        } finally {
          if (!cancelled) {
            setCustomerLookupLoading(false);
          }
        }
      },
      450
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    branchId,
    customerNationalId,
  ]);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(
      async () => {
        if (
          !hasGuarantor ||
          !branchId ||
          guarantorNationalId.length !== 10
        ) {
          return;
        }

        try {
          setGuarantorLookupLoading(true);

          const {
            data,
            error,
          } = await supabase
            .from("finance_customers")
            .select(
              "id, full_name, national_id, birth_hijri, phone, work_name, address"
            )
            .eq("branch_id", branchId)
            .eq(
              "national_id",
              guarantorNationalId
            )
            .maybeSingle();

          if (cancelled) return;

          if (error) {
            throw new Error(error.message);
          }

          if (data) {
            applyGuarantorData(
              data as CustomerRecord
            );

            setGuarantorWasFound(true);
          } else {
            setGuarantorId(null);
            setGuarantorWasFound(false);
          }
        } catch {
          if (!cancelled) {
            setGuarantorId(null);
            setGuarantorWasFound(false);
          }
        } finally {
          if (!cancelled) {
            setGuarantorLookupLoading(false);
          }
        }
      },
      450
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    branchId,
    guarantorNationalId,
    hasGuarantor,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailableStock() {
      if (
        !branchId ||
        !investorId ||
        !productId
      ) {
        setAvailableStock(null);
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("finance_inventory")
        .select("quantity")
        .eq("branch_id", branchId)
        .eq("investor_id", investorId)
        .eq("product_id", productId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setAvailableStock(0);
        return;
      }

      setAvailableStock(
        data
          ? Number(data.quantity || 0)
          : 0
      );
    }

    void loadAvailableStock();

    return () => {
      cancelled = true;
    };
  }, [
    branchId,
    investorId,
    productId,
  ]);

  function clearFinanceSession() {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem("finance_user");
    localStorage.removeItem(
      "finance_user_name"
    );
    localStorage.removeItem(
      "finance_branch_user"
    );
    localStorage.removeItem(
      "finance_role"
    );
  }

  function logout() {
    clearFinanceSession();
    router.replace("/login");
  }

  function applyCustomerData(
    customer: CustomerRecord
  ) {
    setCustomerId(customer.id);
    setCustomerFullName(
      customer.full_name || ""
    );
    setCustomerBirthHijri(
      customer.birth_hijri || ""
    );
    setCustomerPhone(
      customer.phone || ""
    );
    setCustomerWorkName(
      customer.work_name || ""
    );
    setCustomerAddress(
      customer.address || ""
    );
  }

  function applyGuarantorData(
    customer: CustomerRecord
  ) {
    setGuarantorId(customer.id);
    setGuarantorFullName(
      customer.full_name || ""
    );
    setGuarantorBirthHijri(
      customer.birth_hijri || ""
    );
    setGuarantorPhone(
      customer.phone || ""
    );
    setGuarantorWorkName(
      customer.work_name || ""
    );
    setGuarantorAddress(
      customer.address || ""
    );
  }

  function handleCustomerNationalIdChange(
    value: string
  ) {
    const normalized =
      normalizeDigits(value).slice(0, 10);

    if (
      normalized !== customerNationalId
    ) {
      setCustomerId(null);
      setCustomerWasFound(false);

      if (normalized.length < 10) {
        setCustomerFullName("");
        setCustomerBirthHijri("");
        setCustomerPhone("");
        setCustomerWorkName("");
        setCustomerAddress("");
      }
    }

    setCustomerNationalId(normalized);
  }

  function handleGuarantorNationalIdChange(
    value: string
  ) {
    const normalized =
      normalizeDigits(value).slice(0, 10);

    if (
      normalized !== guarantorNationalId
    ) {
      setGuarantorId(null);
      setGuarantorWasFound(false);

      if (normalized.length < 10) {
        setGuarantorFullName("");
        setGuarantorBirthHijri("");
        setGuarantorPhone("");
        setGuarantorWorkName("");
        setGuarantorAddress("");
      }
    }

    setGuarantorNationalId(normalized);
  }

  function handleHasGuarantorChange(
    value: string
  ) {
    const nextValue =
      value === "yes";

    setHasGuarantor(nextValue);

    if (!nextValue) {
      setGuarantorId(null);
      setGuarantorNationalId("");
      setGuarantorFullName("");
      setGuarantorBirthHijri("");
      setGuarantorPhone("");
      setGuarantorWorkName("");
      setGuarantorAddress("");
      setGuarantorWasFound(false);
    }
  }

  function validateForm() {
    if (!branchId) {
      return "تعذر تحديد الفرع";
    }

    if (
      customerNationalId.length !== 10
    ) {
      return "أدخل هوية العميل بشكل صحيح";
    }

    if (!customerFullName.trim()) {
      return "أدخل اسم العميل";
    }

    if (!customerBirthHijri.trim()) {
      return "أدخل تاريخ ميلاد العميل بالهجري";
    }

    if (!customerPhone.trim()) {
      return "أدخل رقم جوال العميل";
    }

    if (!investorId) {
      return "اختر المستثمر المرتبط بالمخزون";
    }

    if (!productId) {
      return "اختر المنتج";
    }

    const quantity =
      toNumber(productQuantity);

    if (quantity <= 0) {
      return "أدخل كمية صحيحة";
    }

    if (toNumber(debtAmount) <= 0) {
      return "أدخل مبلغ الدين";
    }

    if (toNumber(paymentAmount) <= 0) {
      return "أدخل مبلغ السداد";
    }

    if (!paymentType) {
      return "اختر نوع السداد";
    }

    if (!contractDateHijri.trim()) {
      return "أدخل تاريخ إنشاء العقد بالهجري";
    }

    if (!contractDateGregorian) {
      return "اختر تاريخ إنشاء العقد بالميلادي";
    }

    if (
      paymentType === "موعد محدد" &&
      !paymentDueDate
    ) {
      return "اختر موعد السداد";
    }

    if (hasGuarantor) {
      if (
        guarantorNationalId.length !== 10
      ) {
        return "أدخل هوية الكفيل بشكل صحيح";
      }

      if (
        guarantorNationalId ===
        customerNationalId
      ) {
        return "لا يمكن أن يكون العميل كفيلًا لنفسه";
      }

      if (!guarantorFullName.trim()) {
        return "أدخل اسم الكفيل";
      }

      if (!guarantorBirthHijri.trim()) {
        return "أدخل تاريخ ميلاد الكفيل بالهجري";
      }

      if (!guarantorPhone.trim()) {
        return "أدخل رقم جوال الكفيل";
      }
    }

    return null;
  }

  async function createContract() {
    if (saving) return;

    const validationMessage =
      validateForm();

    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    if (!branchId) return;

    const selectedInvestor =
      investors.find(
        (investor) =>
          investor.id === investorId
      );

    const selectedProduct =
      products.find(
        (product) =>
          product.id === productId
      );

    if (!selectedInvestor) {
      alert("تعذر تحديد المستثمر");
      return;
    }

    if (!selectedProduct) {
      alert("تعذر تحديد المنتج");
      return;
    }

    const quantity =
      toNumber(productQuantity);

    if (
      availableStock !== null &&
      quantity > availableStock
    ) {
      const shouldContinue =
        window.confirm(
          `الكمية المطلوبة (${quantity}) أكبر من المتوفر في المخزون (${availableStock}). هل تريد الاستمرار؟`
        );

      if (!shouldContinue) {
        return;
      }
    }

    try {
      setSaving(true);

      const organizationSettings =
        await getOrganizationSettings();

      const printPartyName =
        printPartyType === "organization"
          ? organizationSettings.name
          : selectedInvestor.investor_name;

      const printPartyIdentifier =
        printPartyType === "organization"
          ? organizationSettings.commercialRecord
          : selectedInvestor.national_id;

      const {
        data,
        error,
      } = await supabase.rpc(
        "create_contract_with_customers_atomic",
        {
          p_branch_id: branchId,

          p_customer_national_id:
            customerNationalId,

          p_customer_full_name:
            customerFullName.trim(),

          p_customer_birth_hijri:
            customerBirthHijri.trim(),

          p_customer_phone:
            customerPhone.trim(),

          p_customer_work_name:
            customerWorkName.trim(),

          p_customer_address:
            customerAddress.trim(),

          p_has_guarantor: hasGuarantor,

          p_guarantor_national_id:
            hasGuarantor
              ? guarantorNationalId
              : "",

          p_guarantor_full_name:
            hasGuarantor
              ? guarantorFullName.trim()
              : "",

          p_guarantor_birth_hijri:
            hasGuarantor
              ? guarantorBirthHijri.trim()
              : "",

          p_guarantor_phone:
            hasGuarantor
              ? guarantorPhone.trim()
              : "",

          p_guarantor_work_name:
            hasGuarantor
              ? guarantorWorkName.trim()
              : "",

          p_guarantor_address:
            hasGuarantor
              ? guarantorAddress.trim()
              : "",

          p_finance_type:
            financeType.trim(),

          p_investor_id:
            selectedInvestor.id,

          p_investor_name:
            selectedInvestor.investor_name,

          p_product_id:
            selectedProduct.id,

          p_product_name:
            selectedProduct.product_name,

          p_product_quantity:
            quantity,

          p_print_party_type:
            printPartyType,

          p_print_party_name:
            printPartyName || "",

          p_print_party_identifier:
            printPartyIdentifier || "",

          p_debt_amount:
            toNumber(debtAmount),

          p_payment_amount:
            toNumber(paymentAmount),

          p_installment_amount:
            toNumber(installmentAmount),

          p_payment_type:
            paymentType,

          p_contract_date_hijri:
            contractDateHijri.trim(),

          p_contract_date_gregorian:
            contractDateGregorian,

          p_payment_due_date:
            paymentDueDate || null,

          p_legal_city:
            legalCity.trim(),

          p_judicial_amount:
            toNumber(judicialAmount),

          p_notes:
            notes.trim(),
        }
      );

      if (error) {
        throw new Error(
          getRpcErrorMessage(
            error.message
          )
        );
      }

      const contractId =
        extractContractId(
          data as RpcScalarResult
        );

      if (!contractId) {
        throw new Error(
          "تم تنفيذ العملية لكن لم يتم إرجاع معرف العقد"
        );
      }

      router.push(
        `/finance/${branch}/contracts/${contractId}/print`
      );
    } catch (error: unknown) {
      alert(
        getErrorMessage(
          error,
          "حدث خطأ أثناء إنشاء العقد"
        )
      );
    } finally {
      setSaving(false);
    }
  }

  const investorOptions: SelectOption[] =
    investors.map((investor) => ({
      value: investor.id,
      label: investor.investor_name,
    }));

  const productOptions: SelectOption[] =
    products.map((product) => ({
      value: product.id,
      label: product.product_name,
    }));

  if (!authChecked || pageLoading) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(isMobile)}
      >
        <div style={loadingCard}>
          جاري تحميل صفحة إنشاء العقد...
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(isMobile)}
      >
        <div style={errorCard}>
          <strong>{loadError}</strong>

          <button
            style={secondaryButton}
            onClick={() =>
              router.back()
            }
          >
            ← رجوع
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={getPageStyle(isMobile)}
    >
      <div
        style={getContainerStyle(
          isCompact
        )}
      >
        <header
          style={getHeroStyle(isMobile)}
        >
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div
            style={getHeroContentStyle(
              screen
            )}
          >
            <div
              style={getHeroUserCardStyle(
                screen
              )}
            >
              <div
                style={getEmployeeTopRowStyle(
                  screen
                )}
              >
                <div style={employeeIcon}>
                  <UserIcon />
                </div>

                <div
                  style={getEmployeeNameStyle(
                    isMobile
                  )}
                >
                  {employeeName}
                </div>

                {!isMobile && (
                  <div
                    style={
                      employeeDividerSmall
                    }
                  />
                )}

                <button
                  type="button"
                  style={
                    logoutInlineButton
                  }
                  onClick={logout}
                >
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                type="button"
                style={getMainWorkstationButtonStyle(
                  isMobile
                )}
                onClick={() =>
                  router.push(
                    `/finance/${branch}`
                  )
                }
              >
                <HomeIcon />
                <span>
                  محطة العمل الرئيسية
                </span>
              </button>
            </div>

            <div
              style={getHeroTitleBoxStyle(
                screen
              )}
            >
              <h1
                style={getTitleStyle(
                  screen
                )}
              >
                إنشاء عقد جديد
              </h1>
            </div>

            <div
              style={getHeroActionBoxStyle(
                screen
              )}
            />
          </div>
        </header>

        <section style={card}>
          <h2 style={sectionTitle}>
            بيانات العميل
          </h2>

          <div
            style={getFieldsGridStyle(
              screen
            )}
          >
            <Field
              label="هوية العميل"
              required
              fullWidth
            >
              <div
                style={lookupInputWrapper}
              >
                <input
                  style={fieldInput}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="أدخل رقم الهوية"
                  value={customerNationalId}
                  onChange={(event) =>
                    handleCustomerNationalIdChange(
                      event.target.value
                    )
                  }
                />

                {customerLookupLoading && (
                  <span
                    style={lookupStatus}
                  >
                    جاري التحقق...
                  </span>
                )}

                {!customerLookupLoading &&
                  customerWasFound && (
                    <span
                      style={
                        foundStatusBadge
                      }
                    >
                      تم تحميل البيانات
                    </span>
                  )}
              </div>
            </Field>

            <Field
              label="اسم العميل"
              required
            >
              <input
                style={fieldInput}
                value={customerFullName}
                onChange={(event) =>
                  setCustomerFullName(
                    event.target.value
                  )
                }
                placeholder="الاسم الكامل"
              />
            </Field>

            <Field
              label="تاريخ الميلاد الهجري"
              required
            >
              <input
                style={fieldInput}
                value={customerBirthHijri}
                onChange={(event) =>
                  setCustomerBirthHijri(
                    normalizeHijriDate(
                      event.target.value
                    )
                  )
                }
                placeholder="مثال: 1446/12/15"
                inputMode="numeric"
              />
            </Field>

            <Field
              label="رقم الجوال"
              required
            >
              <input
                style={fieldInput}
                value={customerPhone}
                onChange={(event) =>
                  setCustomerPhone(
                    normalizeDigits(
                      event.target.value
                    ).slice(0, 15)
                  )
                }
                placeholder="05xxxxxxxx"
                inputMode="tel"
              />
            </Field>

            <Field label="العمل">
              <input
                style={fieldInput}
                value={customerWorkName}
                onChange={(event) =>
                  setCustomerWorkName(
                    event.target.value
                  )
                }
                placeholder="اسم جهة العمل"
              />
            </Field>

            <Field
              label="العنوان"
              fullWidth
            >
              <input
                style={fieldInput}
                value={customerAddress}
                onChange={(event) =>
                  setCustomerAddress(
                    event.target.value
                  )
                }
                placeholder="عنوان العميل"
              />
            </Field>
          </div>

          <input
            type="hidden"
            value={customerId || ""}
            readOnly
          />
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            المخزون والطرف الأول
          </h2>

          <div
            style={getFieldsGridStyle(
              screen
            )}
          >
            <Field
              label="المستثمر المرتبط بالمخزون"
              required
            >
              <CustomSelect
                value={investorId}
                placeholder="اختر المستثمر"
                options={investorOptions}
                onChange={(value) => {
                  setInvestorId(value);
                  setProductId("");
                  setAvailableStock(null);
                }}
              />
            </Field>

            <Field
              label="المنتج"
              required
            >
              <CustomSelect
                value={productId}
                placeholder="اختر المنتج"
                options={productOptions}
                onChange={setProductId}
              />
            </Field>

            <Field
              label="كمية المنتجات"
              required
            >
              <input
                style={fieldInput}
                inputMode="decimal"
                placeholder="أدخل الكمية"
                value={productQuantity}
                onChange={(event) =>
                  setProductQuantity(
                    normalizeNumber(
                      event.target.value
                    )
                  )
                }
              />
            </Field>

            <Field label="الكمية المتوفرة">
              <div
                style={
                  availableStock !== null &&
                  toNumber(
                    productQuantity
                  ) > availableStock
                    ? stockDanger
                    : stockInfo
                }
              >
                {availableStock === null
                  ? "اختر المستثمر والمنتج"
                  : availableStock}
              </div>
            </Field>

            <Field
              label="الطرف الأول في الطباعة"
              fullWidth
            >
              <CustomSelect
                value={printPartyType}
                placeholder="اختر الطرف الأول"
                options={[
                  {
                    value: "organization",
                    label: "المنظمة",
                  },
                  {
                    value: "investor",
                    label: "المستثمر",
                  },
                ]}
                onChange={
                  setPrintPartyType
                }
              />
            </Field>
          </div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            بيانات العقد
          </h2>

          <div
            style={getFieldsGridStyle(
              screen
            )}
          >
            <Field
              label="نوع التمويل"
              hint="اختياري"
              fullWidth
            >
              <input
                style={fieldInput}
                placeholder="مثال: تمويل منتج"
                value={financeType}
                onChange={(event) =>
                  setFinanceType(
                    event.target.value
                  )
                }
              />
            </Field>

            <Field
              label="مبلغ الدين"
              required
            >
              <input
                style={fieldInput}
                inputMode="decimal"
                placeholder="0.00"
                value={debtAmount}
                onChange={(event) =>
                  setDebtAmount(
                    normalizeNumber(
                      event.target.value
                    )
                  )
                }
              />
            </Field>

            <Field
              label="مبلغ السداد"
              required
            >
              <input
                style={fieldInput}
                inputMode="decimal"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(event) =>
                  setPaymentAmount(
                    normalizeNumber(
                      event.target.value
                    )
                  )
                }
              />
            </Field>

            <Field
              label="قيمة القسط"
            >
              <input
                style={fieldInput}
                inputMode="decimal"
                placeholder="0.00"
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

            <Field
              label="نوع السداد"
              required
            >
              <CustomSelect
                value={paymentType}
                placeholder="اختر نوع السداد"
                options={[
                  {
                    value: "موعد محدد",
                    label: "موعد محدد",
                  },
                  {
                    value: "شهري مجدول",
                    label: "شهري مجدول",
                  },
                ]}
                onChange={(value) => {
                  setPaymentType(value);

                  if (
                    value !== "موعد محدد"
                  ) {
                    setPaymentDueDate("");
                  }
                }}
              />
            </Field>

            <Field
              label="تاريخ إنشاء العقد بالهجري"
              required
            >
              <input
                style={fieldInput}
                placeholder="مثال: 1446/12/15"
                value={contractDateHijri}
                onChange={(event) =>
                  setContractDateHijri(
                    normalizeHijriDate(
                      event.target.value
                    )
                  )
                }
                inputMode="numeric"
              />
            </Field>

            <Field
              label="تاريخ إنشاء العقد بالميلادي"
              required
            >
              <input
                style={dateInput}
                type="date"
                value={contractDateGregorian}
                onChange={(event) =>
                  setContractDateGregorian(
                    event.target.value
                  )
                }
              />
            </Field>

            {paymentType ===
              "موعد محدد" && (
              <Field
                label="موعد السداد"
                required
                fullWidth
              >
                <input
                  style={dateInput}
                  type="date"
                  value={paymentDueDate}
                  onChange={(event) =>
                    setPaymentDueDate(
                      event.target.value
                    )
                  }
                />
              </Field>
            )}

            <Field label="مدينة التقاضي">
              <input
                style={fieldInput}
                placeholder="اسم المدينة"
                value={legalCity}
                onChange={(event) =>
                  setLegalCity(
                    event.target.value
                  )
                }
              />
            </Field>

            <Field label="المبلغ القضائي">
              <input
                style={fieldInput}
                inputMode="decimal"
                placeholder="0.00"
                value={judicialAmount}
                onChange={(event) =>
                  setJudicialAmount(
                    normalizeNumber(
                      event.target.value
                    )
                  )
                }
              />
            </Field>
          </div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            بيانات الكفيل
          </h2>

          <Field
            label="هل يوجد كفيل؟"
            fullWidth
          >
            <CustomSelect
              value={
                hasGuarantor
                  ? "yes"
                  : "no"
              }
              placeholder="اختر"
              options={[
                {
                  value: "no",
                  label: "بدون كفيل",
                },
                {
                  value: "yes",
                  label: "يوجد كفيل",
                },
              ]}
              onChange={
                handleHasGuarantorChange
              }
            />
          </Field>

          {hasGuarantor && (
            <div
              style={{
                ...getFieldsGridStyle(
                  screen
                ),
                marginTop: 18,
              }}
            >
              <Field
                label="هوية الكفيل"
                required
                fullWidth
              >
                <div
                  style={
                    lookupInputWrapper
                  }
                >
                  <input
                    style={fieldInput}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="أدخل رقم هوية الكفيل"
                    value={
                      guarantorNationalId
                    }
                    onChange={(event) =>
                      handleGuarantorNationalIdChange(
                        event.target.value
                      )
                    }
                  />

                  {guarantorLookupLoading && (
                    <span
                      style={
                        lookupStatus
                      }
                    >
                      جاري التحقق...
                    </span>
                  )}

                  {!guarantorLookupLoading &&
                    guarantorWasFound && (
                      <span
                        style={
                          foundStatusBadge
                        }
                      >
                        تم تحميل البيانات
                      </span>
                    )}
                </div>
              </Field>

              <Field
                label="اسم الكفيل"
                required
              >
                <input
                  style={fieldInput}
                  value={
                    guarantorFullName
                  }
                  onChange={(event) =>
                    setGuarantorFullName(
                      event.target.value
                    )
                  }
                  placeholder="الاسم الكامل"
                />
              </Field>

              <Field
                label="تاريخ الميلاد الهجري"
                required
              >
                <input
                  style={fieldInput}
                  value={
                    guarantorBirthHijri
                  }
                  onChange={(event) =>
                    setGuarantorBirthHijri(
                      normalizeHijriDate(
                        event.target.value
                      )
                    )
                  }
                  placeholder="مثال: 1446/12/15"
                  inputMode="numeric"
                />
              </Field>

              <Field
                label="رقم الجوال"
                required
              >
                <input
                  style={fieldInput}
                  value={guarantorPhone}
                  onChange={(event) =>
                    setGuarantorPhone(
                      normalizeDigits(
                        event.target.value
                      ).slice(0, 15)
                    )
                  }
                  placeholder="05xxxxxxxx"
                  inputMode="tel"
                />
              </Field>

              <Field label="العمل">
                <input
                  style={fieldInput}
                  value={
                    guarantorWorkName
                  }
                  onChange={(event) =>
                    setGuarantorWorkName(
                      event.target.value
                    )
                  }
                  placeholder="اسم جهة العمل"
                />
              </Field>

              <Field
                label="العنوان"
                fullWidth
              >
                <input
                  style={fieldInput}
                  value={
                    guarantorAddress
                  }
                  onChange={(event) =>
                    setGuarantorAddress(
                      event.target.value
                    )
                  }
                  placeholder="عنوان الكفيل"
                />
              </Field>

              <input
                type="hidden"
                value={guarantorId || ""}
                readOnly
              />
            </div>
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            الملاحظات
          </h2>

          <Field
            label="ملاحظات العقد"
            fullWidth
          >
            <textarea
              style={textarea}
              placeholder="أدخل أي ملاحظات إضافية"
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
            />
          </Field>

          <button
            type="button"
            style={{
              ...primaryButton,
              opacity: saving ? 0.68 : 1,
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
            onClick={createContract}
            disabled={saving}
          >
            {saving
              ? "جاري إنشاء العقد..."
              : "إنشاء العقد والانتقال للطباعة"}
          </button>
        </section>

        <div style={backWrapper}>
          <button
            type="button"
            style={backButton}
            onClick={() =>
              router.back()
            }
          >
            ← رجوع
          </button>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  required = false,
  fullWidth = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      style={{
        ...fieldWrapper,
        gridColumn: fullWidth
          ? "1 / -1"
          : undefined,
      }}
    >
      <span style={fieldLabel}>
        <span>{label}</span>

        {required && (
          <span style={requiredMark}>
            *
          </span>
        )}

        {hint && (
          <span style={fieldHint}>
            {hint}
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

function CustomSelect({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string;
  placeholder: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] =
    useState(false);

  const wrapperRef =
    useRef<HTMLDivElement | null>(null);

  const selectedOption =
    options.find(
      (option) =>
        option.value === value
    );

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={selectWrapper}
    >
      <button
        type="button"
        style={{
          ...selectButton,
          ...(open
            ? selectButtonOpen
            : {}),
        }}
        onClick={() =>
          setOpen((current) => !current)
        }
        aria-expanded={open}
      >
        <span
          style={
            selectedOption
              ? selectValue
              : selectPlaceholder
          }
        >
          {selectedOption?.label ||
            placeholder}
        </span>

        <span
          style={{
            ...selectArrow,
            transform: open
              ? "rotate(180deg)"
              : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          style={selectOptionsMenu}
        >
          {options.length === 0 ? (
            <div
              style={emptyOption}
            >
              لا توجد خيارات متاحة
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                style={{
                  ...selectOptionButton,
                  ...(option.value ===
                  value
                    ? selectedOptionButton
                    : {}),
                }}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function normalizeDigits(
  value: string
) {
  const arabicDigits =
    "٠١٢٣٤٥٦٧٨٩";

  const persianDigits =
    "۰۱۲۳۴۵۶۷۸۹";

  return value
    .replace(
      /[٠-٩]/g,
      (digit) =>
        String(
          arabicDigits.indexOf(
            digit
          )
        )
    )
    .replace(
      /[۰-۹]/g,
      (digit) =>
        String(
          persianDigits.indexOf(
            digit
          )
        )
    )
    .replace(/\D/g, "");
}

function normalizeHijriDate(
  value: string
) {
  const digits =
    normalizeDigits(value);

  const limited =
    digits.slice(0, 8);

  if (limited.length <= 4) {
    return limited;
  }

  if (limited.length <= 6) {
    return `${limited.slice(
      0,
      4
    )}/${limited.slice(4)}`;
  }

  return `${limited.slice(
    0,
    4
  )}/${limited.slice(
    4,
    6
  )}/${limited.slice(6)}`;
}

function extractContractId(
  data: RpcScalarResult
) {
  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    const first = data[0];

    return (
      first?.contract_id ||
      first?.id ||
      null
    );
  }

  if (
    data &&
    typeof data === "object"
  ) {
    return (
      data.contract_id ||
      data.id ||
      null
    );
  }

  return null;
}

function getRpcErrorMessage(
  message: string
) {
  if (
    message.includes(
      "CUSTOMER_NATIONAL_ID_REQUIRED"
    )
  ) {
    return "رقم هوية العميل مطلوب";
  }

  if (
    message.includes(
      "CUSTOMER_NAME_REQUIRED"
    )
  ) {
    return "اسم العميل مطلوب";
  }

  if (
    message.includes(
      "CUSTOMER_PHONE_REQUIRED"
    )
  ) {
    return "رقم جوال العميل مطلوب";
  }

  if (
    message.includes(
      "GUARANTOR_NATIONAL_ID_REQUIRED"
    )
  ) {
    return "رقم هوية الكفيل مطلوب";
  }

  if (
    message.includes(
      "GUARANTOR_NAME_REQUIRED"
    )
  ) {
    return "اسم الكفيل مطلوب";
  }

  if (
    message.includes(
      "GUARANTOR_PHONE_REQUIRED"
    )
  ) {
    return "رقم جوال الكفيل مطلوب";
  }

  if (
    message.includes(
      "GUARANTOR_SAME_AS_CUSTOMER"
    )
  ) {
    return "لا يمكن أن يكون العميل كفيلًا لنفسه";
  }

  if (
    message.includes(
      "INSUFFICIENT_INVENTORY"
    )
  ) {
    return "الكمية المطلوبة غير متوفرة في المخزون";
  }

  if (
    message.includes(
      "CONTRACT_CREATION_FAILED"
    )
  ) {
    return "تعذر إنشاء العقد";
  }

  return message;
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (
    typeof error === "string"
  ) {
    return error || fallback;
  }

  return fallback;
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
    maxWidth: isCompact
      ? 980
      : 1180,
    margin: "auto",
  };
}

function getHeroStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile
      ? "auto"
      : 160,
    borderRadius: isMobile
      ? 20
      : 24,
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
      "minmax(250px, 315px) 1fr minmax(220px, 315px)",
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
  return {
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    justifyContent:
      screen === "desktop"
        ? "flex-start"
        : "center",
    flexWrap:
      screen === "mobile"
        ? "wrap"
        : "nowrap",
    gap: screen === "mobile"
      ? 10
      : 14,
    direction:
      screen === "desktop"
        ? "ltr"
        : "rtl",
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
    width: isMobile
      ? "100%"
      : 220,
    maxWidth: isMobile
      ? 280
      : 220,
    minHeight: 44,
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
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents: "none",
    order:
      screen === "desktop"
        ? 0
        : 1,
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
        ? 25
        : screen === "tablet"
          ? 28
          : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
  return {
    display:
      screen === "desktop"
        ? "flex"
        : "none",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-end",
  };
}

function getFieldsGridStyle(
  screen: ScreenType
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns:
      screen === "mobile"
        ? "1fr"
        : "repeat(2, minmax(0, 1fr))",
    gap:
      screen === "mobile"
        ? 14
        : 18,
    alignItems: "start",
  };
}

const employeeIcon: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border:
    "1.5px solid rgba(255,255,255,0.34)",
  background:
    "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color:
    "rgba(255,255,255,0.96)",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background:
    "rgba(255,255,255,0.30)",
  flex: "0 0 auto",
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color:
    "rgba(255,255,255,0.90)",
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

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 210,
  height: 210,
  right: -78,
  top: -85,
  borderRadius: "50%",
  background:
    "rgba(255,255,255,0.075)",
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
  background:
    "rgba(255,255,255,0.045)",
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
  background:
    "rgba(255,255,255,0.035)",
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
  background:
    "rgba(255,255,255,0.97)",
  border:
    "1px solid rgba(191,210,237,0.88)",
  borderRadius: 20,
  padding: 20,
  marginBottom: 16,
  boxShadow:
    "0 12px 30px rgba(15,23,42,0.055)",
  overflow: "visible",
};

const sectionTitle: CSSProperties = {
  margin:
    "0 0 20px 0",
  color: "#0d47a1",
  fontSize: 21,
  lineHeight: 1.4,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const fieldWrapper: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const fieldLabel: CSSProperties = {
  minHeight: 22,
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 6,
  color: "#1e3a5f",
  fontSize: 14,
  fontWeight: 900,
};

const requiredMark: CSSProperties = {
  color: "#dc2626",
  fontSize: 16,
  fontWeight: 900,
};

const fieldHint: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const fieldInput: CSSProperties = {
  width: "100%",
  minHeight: 56,
  padding: "13px 15px",
  borderRadius: 14,
  border:
    "1.5px solid #cbd8eb",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 16,
  lineHeight: 1.4,
  outline: "none",
  boxSizing: "border-box",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const dateInput: CSSProperties = {
  ...fieldInput,
  minHeight: 60,
  padding:
    "14px 16px",
  fontSize: 17,
  cursor: "pointer",
  colorScheme: "light",
};

const textarea: CSSProperties = {
  ...fieldInput,
  minHeight: 125,
  resize: "vertical",
};

const lookupInputWrapper: CSSProperties = {
  position: "relative",
  width: "100%",
};

const lookupStatus: CSSProperties = {
  position: "absolute",
  left: 14,
  top: "50%",
  transform:
    "translateY(-50%)",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  pointerEvents: "none",
};

const foundStatusBadge: CSSProperties = {
  position: "absolute",
  left: 10,
  top: "50%",
  transform:
    "translateY(-50%)",
  padding: "6px 9px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  border:
    "1px solid #bbf7d0",
  fontSize: 11,
  fontWeight: 900,
  pointerEvents: "none",
};

const selectWrapper: CSSProperties = {
  position: "relative",
  width: "100%",
  zIndex: 20,
};

const selectButton: CSSProperties = {
  width: "100%",
  minHeight: 56,
  padding: "12px 15px",
  borderRadius: 14,
  border:
    "1.5px solid #cbd8eb",
  background:
    "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)",
  color: "#0f172a",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  textAlign: "right",
  direction: "rtl",
  fontFamily:
    "var(--font-almarai), sans-serif",
  boxShadow:
    "0 2px 5px rgba(15,23,42,0.025)",
};

const selectButtonOpen: CSSProperties = {
  borderColor: "#3b82f6",
  boxShadow:
    "0 0 0 4px rgba(59,130,246,0.11)",
};

const selectValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const selectPlaceholder: CSSProperties = {
  color: "#64748b",
  fontSize: 15,
  fontWeight: 700,
};

const selectArrow: CSSProperties = {
  color: "#2563eb",
  fontSize: 11,
  transition:
    "transform 0.18s ease",
  flex: "0 0 auto",
};

const selectOptionsMenu: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 7px)",
  right: 0,
  left: 0,
  maxHeight: 280,
  overflowY: "auto",
  padding: 7,
  borderRadius: 14,
  border:
    "1px solid #cbd8eb",
  background: "#ffffff",
  boxShadow:
    "0 18px 42px rgba(15,23,42,0.17)",
  zIndex: 9999,
};

const selectOptionButton: CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: "none",
  borderRadius: 10,
  padding: "10px 12px",
  background: "transparent",
  color: "#1e293b",
  textAlign: "right",
  direction: "rtl",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 800,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const selectedOptionButton: CSSProperties = {
  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
};

const emptyOption: CSSProperties = {
  padding: 14,
  color: "#64748b",
  textAlign: "center",
  fontSize: 14,
  fontWeight: 800,
};

const stockInfo: CSSProperties = {
  width: "100%",
  minHeight: 56,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  padding: "13px 15px",
  background: "#f0fdf4",
  color: "#166534",
  border:
    "1.5px solid #bbf7d0",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: 900,
};

const stockDanger: CSSProperties = {
  ...stockInfo,
  background: "#fef2f2",
  color: "#991b1b",
  border:
    "1.5px solid #fecaca",
};

const primaryButton: CSSProperties = {
  width: "100%",
  minHeight: 56,
  marginTop: 18,
  padding: "15px 18px",
  background:
    "linear-gradient(135deg,#0d47a1,#1565c0 55%,#0284c7)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: 900,
  boxShadow:
    "0 10px 24px rgba(13,71,161,0.20)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const secondaryButton: CSSProperties = {
  marginTop: 18,
  padding: "11px 18px",
  border: "none",
  borderRadius: 12,
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
  marginBottom: 12,
};

const backButton: CSSProperties = {
  padding: "11px 20px",
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

const loadingCard: CSSProperties = {
  maxWidth: 620,
  margin: "80px auto",
  padding: 28,
  borderRadius: 18,
  background: "#ffffff",
  border:
    "1px solid #d9e3f5",
  color: "#0d47a1",
  fontSize: 17,
  fontWeight: 900,
  textAlign: "center",
  boxShadow:
    "0 12px 30px rgba(15,23,42,0.06)",
};

const errorCard: CSSProperties = {
  ...loadingCard,
  color: "#991b1b",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};
