"use client";

import { normalizeNumber, toNumber } from "@/lib/numberUtils";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

type ScreenType = "mobile" | "tablet" | "desktop";

type CreationMode =
  | "contract_only"
  | "contract_and_note";

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
  id?: string | null;
  branch_id?: string | null;
  branch_slug?: string | null;
  full_name?: string | null;
  username?: string | null;
  name?: string | null;
  role?: string | null;
  roles?: unknown;
  permissions?: unknown;
  investor_id?: string | null;
  is_active?: boolean | null;
};

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type CompleteCreationResult = {
  contract_id?: string | null;
  note_id?: string | null;
  contract_number?: number | string | null;
  note_number?: number | string | null;
};

type DropdownRect = {
  top: number;
  left: number;
  width: number;
};

const MANAGER_ROLES = [
  "main_admin",
  "branch_manager",
  "مدير رئيسي",
  "مدير فرع",
  "مدير",
];

const NOTE_PERMISSION_KEYS = [
  "promissory_note_create",
  "promissory_notes_create",
  "create_promissory_note",
  "notes_create",
];

const FINANCE_SESSION_KEYS = [
  "finance_user",
  "finance_branch_user",
  "finance_user_id",
  "finance_user_name",
  "finance_username",
  "finance_role",
  "finance_branch_id",
  "finance_branch_slug",
  "finance_branch_name",
  "finance_organization_name",
  "finance_permissions",
  "finance_investor_id",
  "finance_is_active",
  "finance_last_login_at",
] as const;

export default function NewFinanceContractPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch || "").trim();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [authChecked, setAuthChecked] =
    useState(false);

  const [referenceDataLoading, setReferenceDataLoading] =
    useState(true);

  const [referenceDataError, setReferenceDataError] =
    useState("");

  const [employeeId, setEmployeeId] =
    useState("");

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [employeeRole, setEmployeeRole] =
    useState("");

  const [
    employeePermissions,
    setEmployeePermissions,
  ] = useState<string[]>([]);

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [organizationName, setOrganizationName] =
    useState("");

  const [
    organizationIdentifier,
    setOrganizationIdentifier,
  ] = useState("");

  const [investors, setInvestors] =
    useState<InvestorRecord[]>([]);

  const [products, setProducts] =
    useState<ProductRecord[]>([]);

  const [customerId, setCustomerId] =
    useState<string | null>(null);

  const [
    customerNationalId,
    setCustomerNationalId,
  ] = useState("");

  const [
    customerFullName,
    setCustomerFullName,
  ] = useState("");

  const [
    customerBirthHijri,
    setCustomerBirthHijri,
  ] = useState("");

  const [customerPhone, setCustomerPhone] =
    useState("");

  const [
    customerWorkName,
    setCustomerWorkName,
  ] = useState("");

  const [
    customerAddress,
    setCustomerAddress,
  ] = useState("");

  const [
    customerLookupLoading,
    setCustomerLookupLoading,
  ] = useState(false);

  const [
    customerWasFound,
    setCustomerWasFound,
  ] = useState(false);

  const [hasGuarantor, setHasGuarantor] =
    useState(false);

  const [guarantorId, setGuarantorId] =
    useState<string | null>(null);

  const [
    guarantorNationalId,
    setGuarantorNationalId,
  ] = useState("");

  const [
    guarantorFullName,
    setGuarantorFullName,
  ] = useState("");

  const [
    guarantorBirthHijri,
    setGuarantorBirthHijri,
  ] = useState("");

  const [
    guarantorPhone,
    setGuarantorPhone,
  ] = useState("");

  const [
    guarantorWorkName,
    setGuarantorWorkName,
  ] = useState("");

  const [
    guarantorAddress,
    setGuarantorAddress,
  ] = useState("");

  const [
    guarantorLookupLoading,
    setGuarantorLookupLoading,
  ] = useState(false);

  const [
    guarantorWasFound,
    setGuarantorWasFound,
  ] = useState(false);

  const [financeType, setFinanceType] =
    useState("");

  const [investorId, setInvestorId] =
    useState("");

  const [productId, setProductId] =
    useState("");

  const [
    productQuantity,
    setProductQuantity,
  ] = useState("");

  const [
    availableStock,
    setAvailableStock,
  ] = useState<number | null>(null);

  const [
    printPartyType,
    setPrintPartyType,
  ] = useState<"organization" | "investor">(
    "organization"
  );

  const [debtAmount, setDebtAmount] =
    useState("");

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState("");

  const [paymentType, setPaymentType] =
    useState("موعد محدد");

  const [
    paymentDueDate,
    setPaymentDueDate,
  ] = useState("");

  const [
    contractIssueDate,
    setContractIssueDate,
  ] = useState(getTodayDate());

  const [legalCity, setLegalCity] =
    useState("");

  const [
    judicialAmount,
    setJudicialAmount,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [
    creationMode,
    setCreationMode,
  ] = useState<CreationMode>("contract_only");

  const [saving, setSaving] =
    useState(false);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const canCreatePromissoryNote =
    useMemo(() => {
      if (
        MANAGER_ROLES.includes(
          employeeRole
        )
      ) {
        return true;
      }

      return employeePermissions.some(
        (permission) =>
          NOTE_PERMISSION_KEYS.includes(
            permission
          )
      );
    }, [
      employeePermissions,
      employeeRole,
    ]);

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
      if (typeof window === "undefined") {
        return;
      }

      setReferenceDataError("");
      setReferenceDataLoading(true);

      const parsedSession =
        readFinanceSession();

      if (!parsedSession) {
        clearFinanceSession();
        router.replace("/login");
        return;
      }

      if (parsedSession.is_active === false) {
        clearFinanceSession();
        router.replace("/login");
        return;
      }

      const storedEmployeeId =
        String(
          parsedSession.id ||
            localStorage.getItem(
              "finance_user_id"
            ) ||
            ""
        ).trim();

      const storedBranchId =
        String(
          parsedSession.branch_id ||
            localStorage.getItem(
              "finance_branch_id"
            ) ||
            ""
        ).trim();

      const storedBranchSlug =
        String(
          parsedSession.branch_slug ||
            localStorage.getItem(
              "finance_branch_slug"
            ) ||
            ""
        ).trim();

      if (
        storedBranchSlug &&
        storedBranchSlug !== branch
      ) {
        router.replace(
          `/finance/${storedBranchSlug}`
        );
        return;
      }

      if (!storedEmployeeId) {
        clearFinanceSession();
        router.replace("/login");
        return;
      }

      const localEmployeeName =
        localStorage.getItem(
          "finance_user_name"
        ) ||
        parsedSession.full_name ||
        parsedSession.username ||
        parsedSession.name ||
        "الموظف";

      const localRole =
        String(
          parsedSession.role ||
            localStorage.getItem(
              "finance_role"
            ) ||
            ""
        ).trim();

      const localPermissions =
        getStoredPermissions(
          parsedSession.permissions
        );

      const localOrganizationName =
        localStorage.getItem(
          "finance_organization_name"
        ) || "";

      setEmployeeId(storedEmployeeId);
      setEmployeeName(localEmployeeName);
      setEmployeeRole(localRole);
      setEmployeePermissions(
        localPermissions
      );

      setOrganizationName(
        localOrganizationName
      );

      if (storedBranchId) {
        setBranchId(storedBranchId);

        localStorage.setItem(
          "finance_branch_id",
          storedBranchId
        );

        localStorage.setItem(
          "finance_branch_slug",
          branch
        );
      }

      setAuthChecked(true);

      let resolvedBranchId =
        storedBranchId;

      if (!resolvedBranchId) {
        try {
          const fetchedBranchId =
            await getBranchId(branch);

          if (cancelled) {
            return;
          }

          if (!fetchedBranchId) {
            setReferenceDataError(
              "تعذر تحديد الفرع"
            );

            setReferenceDataLoading(
              false
            );

            return;
          }

          resolvedBranchId =
            String(fetchedBranchId);

          setBranchId(resolvedBranchId);

          localStorage.setItem(
            "finance_branch_id",
            resolvedBranchId
          );

          localStorage.setItem(
            "finance_branch_slug",
            branch
          );
        } catch (error: unknown) {
          if (cancelled) {
            return;
          }

          setReferenceDataError(
            getErrorMessage(
              error,
              "تعذر تحديد الفرع"
            )
          );

          setReferenceDataLoading(
            false
          );

          return;
        }
      }

      try {
        const [
          branchResult,
          investorsResult,
          productsResult,
        ] = await Promise.all([
          supabase
            .from("finance_branches")
            .select(
              "id, branch_slug, organization_name, commercial_record, is_active"
            )
            .eq("id", resolvedBranchId)
            .eq("branch_slug", branch)
            .maybeSingle(),

          supabase
            .from("finance_investors")
            .select(
              "id, investor_name, national_id"
            )
            .eq(
              "branch_id",
              resolvedBranchId
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
              resolvedBranchId
            )
            .eq("is_active", true)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (cancelled) {
          return;
        }

        const errors: string[] = [];

        if (branchResult.error) {
          console.error(
            "Branch loading error:",
            branchResult.error
          );

          errors.push(
            "تعذر تحميل بيانات المؤسسة"
          );
        } else if (branchResult.data) {
          if (
            branchResult.data.is_active ===
            false
          ) {
            errors.push(
              "الفرع غير نشط حاليًا"
            );
          }

          const fetchedOrganizationName =
            branchResult.data
              .organization_name || "";

          const fetchedIdentifier =
            branchResult.data
              .commercial_record || "";

          setOrganizationName(
            fetchedOrganizationName ||
              localOrganizationName
          );

          setOrganizationIdentifier(
            fetchedIdentifier
          );

          if (fetchedOrganizationName) {
            localStorage.setItem(
              "finance_organization_name",
              fetchedOrganizationName
            );
          }
        }

        if (investorsResult.error) {
          console.error(
            "Investors loading error:",
            investorsResult.error
          );

          errors.push(
            "تعذر تحميل المستثمرين"
          );

          setInvestors([]);
        } else {
          setInvestors(
            (investorsResult.data ||
              []) as InvestorRecord[]
          );
        }

        if (productsResult.error) {
          console.error(
            "Products loading error:",
            productsResult.error
          );

          errors.push(
            "تعذر تحميل المنتجات"
          );

          setProducts([]);
        } else {
          setProducts(
            (productsResult.data ||
              []) as ProductRecord[]
          );
        }

        if (errors.length > 0) {
          setReferenceDataError(
            errors.join("، ")
          );
        }
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        console.error(
          "New contract reference data error:",
          error
        );

        setReferenceDataError(
          getErrorMessage(
            error,
            "تعذر تحميل بيانات إنشاء العقد"
          )
        );
      } finally {
        if (!cancelled) {
          setReferenceDataLoading(
            false
          );
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
          customerNationalId.length !==
            10
        ) {
          return;
        }

        try {
          setCustomerLookupLoading(
            true
          );

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

          if (cancelled) {
            return;
          }

          if (error) {
            throw new Error(
              error.message
            );
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
        } catch (error) {
          console.error(
            "Customer lookup error:",
            error
          );

          if (!cancelled) {
            setCustomerId(null);
            setCustomerWasFound(false);
          }
        } finally {
          if (!cancelled) {
            setCustomerLookupLoading(
              false
            );
          }
        }
      },
      400
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
          guarantorNationalId.length !==
            10
        ) {
          return;
        }

        try {
          setGuarantorLookupLoading(
            true
          );

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

          if (cancelled) {
            return;
          }

          if (error) {
            throw new Error(
              error.message
            );
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
        } catch (error) {
          console.error(
            "Guarantor lookup error:",
            error
          );

          if (!cancelled) {
            setGuarantorId(null);
            setGuarantorWasFound(false);
          }
        } finally {
          if (!cancelled) {
            setGuarantorLookupLoading(
              false
            );
          }
        }
      },
      400
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

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "Inventory lookup error:",
          error
        );

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

  useEffect(() => {
    if (
      creationMode ===
        "contract_and_note" &&
      !canCreatePromissoryNote
    ) {
      setCreationMode(
        "contract_only"
      );
    }
  }, [
    canCreatePromissoryNote,
    creationMode,
  ]);

  function readFinanceSession():
    | BranchSession
    | null {
    if (
      typeof window === "undefined"
    ) {
      return null;
    }

    const rawSession =
      localStorage.getItem(
        "finance_branch_user"
      ) ||
      localStorage.getItem(
        "finance_user"
      );

    if (!rawSession) {
      return null;
    }

    try {
      const parsed =
        JSON.parse(
          rawSession
        ) as BranchSession;

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  function getStoredPermissions(
    sessionPermissions: unknown
  ): string[] {
    const directPermissions =
      normalizeStringArray(
        sessionPermissions
      );

    if (
      directPermissions.length > 0
    ) {
      return directPermissions;
    }

    if (
      typeof window === "undefined"
    ) {
      return [];
    }

    const storedPermissions =
      localStorage.getItem(
        "finance_permissions"
      );

    if (!storedPermissions) {
      return [];
    }

    try {
      return normalizeStringArray(
        JSON.parse(
          storedPermissions
        )
      );
    } catch {
      return [];
    }
  }

  function normalizeStringArray(
    value: unknown
  ): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item): item is string =>
        typeof item === "string" &&
        item.trim().length > 0
    );
  }

  function clearFinanceSession() {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    FINANCE_SESSION_KEYS.forEach(
      (key) => {
        localStorage.removeItem(key);
      }
    );
  }

  function logout() {
    clearFinanceSession();
    router.replace("/login");
  }

  function retryReferenceData() {
    window.location.reload();
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
      normalizeDigits(value).slice(
        0,
        10
      );

    if (
      normalized !==
      customerNationalId
    ) {
      setCustomerId(null);
      setCustomerWasFound(false);

      if (
        normalized.length < 10
      ) {
        clearCustomerFields();
      }
    }

    setCustomerNationalId(
      normalized
    );
  }

  function handleGuarantorNationalIdChange(
    value: string
  ) {
    const normalized =
      normalizeDigits(value).slice(
        0,
        10
      );

    if (
      normalized !==
      guarantorNationalId
    ) {
      setGuarantorId(null);
      setGuarantorWasFound(false);

      if (
        normalized.length < 10
      ) {
        clearGuarantorDataFields();
      }
    }

    setGuarantorNationalId(
      normalized
    );
  }

  function clearCustomerFields() {
    setCustomerFullName("");
    setCustomerBirthHijri("");
    setCustomerPhone("");
    setCustomerWorkName("");
    setCustomerAddress("");
  }

  function clearGuarantorDataFields() {
    setGuarantorFullName("");
    setGuarantorBirthHijri("");
    setGuarantorPhone("");
    setGuarantorWorkName("");
    setGuarantorAddress("");
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

      clearGuarantorDataFields();

      setGuarantorWasFound(false);
    }
  }

  function validateForm() {
    if (!branchId) {
      return "بيانات الفرع ما زالت قيد التحميل";
    }

    if (!employeeId) {
      return "تعذر تحديد الموظف المسجل";
    }

    if (
      referenceDataLoading
    ) {
      return "انتظر حتى يكتمل تحميل المستثمرين والمنتجات";
    }

    if (
      referenceDataError &&
      (
        investors.length === 0 ||
        products.length === 0
      )
    ) {
      return "تعذر تحميل المستثمرين أو المنتجات";
    }

    if (
      customerNationalId.length !==
      10
    ) {
      return "رقم هوية العميل يجب أن يكون 10 أرقام";
    }

    if (
      !customerFullName.trim()
    ) {
      return "أدخل اسم العميل";
    }

    if (
      !customerBirthHijri.trim()
    ) {
      return "أدخل تاريخ ميلاد العميل بالهجري";
    }

    if (
      !/^05\d{8}$/.test(
        customerPhone
      )
    ) {
      return "رقم جوال العميل يجب أن يكون 10 أرقام ويبدأ بـ 05";
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

    if (
      toNumber(debtAmount) <= 0
    ) {
      return "أدخل مبلغ الدين";
    }

    if (
      toNumber(paymentAmount) <=
      0
    ) {
      return "أدخل مبلغ السداد";
    }

    if (!paymentType) {
      return "اختر نوع السداد";
    }

    if (!contractIssueDate) {
      return "اختر تاريخ تحرير العقد";
    }

    if (
      paymentType ===
        "موعد محدد" &&
      !paymentDueDate
    ) {
      return "اختر موعد السداد";
    }

    if (
      creationMode ===
        "contract_and_note" &&
      !canCreatePromissoryNote
    ) {
      return "لا تملك صلاحية إنشاء سند";
    }

    if (
      creationMode ===
        "contract_and_note" &&
      !paymentDueDate
    ) {
      return "اختر تاريخ استحقاق السند";
    }

    if (
      creationMode ===
        "contract_and_note" &&
      !legalCity.trim()
    ) {
      return "أدخل مدينة التقاضي";
    }

    if (hasGuarantor) {
      if (
        guarantorNationalId.length !==
        10
      ) {
        return "رقم هوية الكفيل يجب أن يكون 10 أرقام";
      }

      if (
        guarantorNationalId ===
        customerNationalId
      ) {
        return "لا يمكن أن يكون العميل كفيلًا لنفسه";
      }

      if (
        !guarantorFullName.trim()
      ) {
        return "أدخل اسم الكفيل";
      }

      if (
        !guarantorBirthHijri.trim()
      ) {
        return "أدخل تاريخ ميلاد الكفيل بالهجري";
      }

      if (
        !/^05\d{8}$/.test(
          guarantorPhone
        )
      ) {
        return "رقم جوال الكفيل يجب أن يكون 10 أرقام ويبدأ بـ 05";
      }
    }

    return null;
  }

  async function createContract() {
    if (saving) {
      return;
    }

    const validationMessage =
      validateForm();

    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    if (!branchId || !employeeId) {
      return;
    }

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
      alert(
        "تعذر تحديد المستثمر"
      );

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
          `الكمية المطلوبة (${quantity}) أكبر من المتوفر في المخزون (${availableStock}). هل تريد الاستمرار والسماح بوصول المخزون إلى السالب؟`
        );

      if (!shouldContinue) {
        return;
      }
    }

    const printPartyName =
      printPartyType ===
      "organization"
        ? organizationName
        : selectedInvestor.investor_name;

    const printPartyIdentifier =
      printPartyType ===
      "organization"
        ? organizationIdentifier
        : selectedInvestor.national_id ||
          "";

    try {
      setSaving(true);

      const {
        data,
        error,
      } = await supabase.rpc(
        "create_finance_contract_complete_atomic",
        {
          p_branch_id: branchId,
          p_employee_id: employeeId,
          p_employee_name: employeeName,

          p_customer_full_name:
            customerFullName.trim(),

          p_customer_national_id:
            customerNationalId,

          p_customer_birth_hijri:
            customerBirthHijri.trim(),

          p_customer_phone:
            customerPhone,

          p_customer_work_name:
            customerWorkName.trim(),

          p_customer_address:
            customerAddress.trim(),

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

          p_payment_type:
            paymentType,

          p_payment_due_date:
            paymentDueDate || "",

          p_contract_issue_date:
            contractIssueDate,

          p_legal_city:
            legalCity.trim(),

          p_judicial_amount:
            toNumber(judicialAmount),

          p_notes:
            notes.trim(),

          p_has_guarantor:
            hasGuarantor,

          p_guarantor_full_name:
            hasGuarantor
              ? guarantorFullName.trim()
              : "",

          p_guarantor_national_id:
            hasGuarantor
              ? guarantorNationalId
              : "",

          p_guarantor_birth_hijri:
            hasGuarantor
              ? guarantorBirthHijri.trim()
              : "",

          p_guarantor_phone:
            hasGuarantor
              ? guarantorPhone
              : "",

          p_guarantor_work_name:
            hasGuarantor
              ? guarantorWorkName.trim()
              : "",

          p_guarantor_address:
            hasGuarantor
              ? guarantorAddress.trim()
              : "",

          p_create_promissory_note:
            creationMode ===
            "contract_and_note",
        }
      );

      if (error) {
        throw new Error(
          getRpcErrorMessage(
            error.message
          )
        );
      }

      const result =
        extractCreationResult(data);

      if (!result.contract_id) {
        throw new Error(
          "تم تنفيذ العملية لكن لم يتم إرجاع معرف العقد"
        );
      }

      if (
        creationMode ===
          "contract_and_note" &&
        !result.note_id
      ) {
        throw new Error(
          "لم يتم إرجاع معرف السند"
        );
      }

      if (
        creationMode ===
          "contract_and_note" &&
        result.note_id
      ) {
        alert(
          `تم إنشاء العقد رقم ${result.contract_number || ""} والسند رقم ${result.note_number || ""} بنجاح`
        );

        router.push(
          `/finance/${branch}/new-request/print/${result.contract_id}/${result.note_id}`
        );

        return;
      }

      alert(
        `تم إنشاء العقد رقم ${result.contract_number || ""} بنجاح`
      );

      router.push(
        `/finance/${branch}/contracts/${result.contract_id}`
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

  const investorOptions:
    SelectOption[] =
    investors.map((investor) => ({
      value: investor.id,
      label: investor.investor_name,
    }));

  const productOptions:
    SelectOption[] =
    products.map((product) => ({
      value: product.id,
      label: product.product_name,
    }));

  if (!authChecked) {
    return null;
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
                  <span>
                    تسجيل الخروج
                  </span>
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

        {referenceDataError && (
          <section
            style={inlineErrorCard}
          >
            <span>
              {referenceDataError}
            </span>

            <button
              type="button"
              style={
                inlineRetryButton
              }
              onClick={
                retryReferenceData
              }
            >
              إعادة المحاولة
            </button>
          </section>
        )}

        <section style={card}>
          <h2 style={sectionTitle}>
            بيانات العميل (الطرف الثاني)
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
                style={
                  lookupInputWrapper
                }
              >
                <input
                  style={fieldInput}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={10}
                  placeholder="أدخل رقم الهوية"
                  value={
                    customerNationalId
                  }
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
                value={
                  customerFullName
                }
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
                value={
                  customerBirthHijri
                }
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
                    ).slice(0, 10)
                  )
                }
                placeholder="05xxxxxxxx"
                inputMode="tel"
                maxLength={10}
              />
            </Field>

            <Field label="العمل">
              <input
                style={fieldInput}
                value={
                  customerWorkName
                }
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
                value={
                  customerAddress
                }
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
          <div
            style={
              sectionTitleRow
            }
          >
            <h2
              style={{
                ...sectionTitle,
                marginBottom: 0,
              }}
            >
              المخزون والطرف الأول
            </h2>

            {referenceDataLoading && (
              <span
                style={
                  localLoadingBadge
                }
              >
                جاري تحميل المستثمرين
                والمنتجات...
              </span>
            )}
          </div>

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
                placeholder={
                  referenceDataLoading
                    ? "جاري تحميل المستثمرين..."
                    : investors.length ===
                        0
                      ? "لا يوجد مستثمرون"
                      : "اختر المستثمر"
                }
                options={
                  investorOptions
                }
                onChange={(value) => {
                  setInvestorId(value);
                  setProductId("");
                  setAvailableStock(null);
                }}
              />
            </Field>

            <Field
              label="اختر المنتج"
              required
            >
              <CustomSelect
                value={productId}
                placeholder={
                  referenceDataLoading
                    ? "جاري تحميل المنتجات..."
                    : products.length === 0
                      ? "لا توجد منتجات"
                      : "اختر المنتج"
                }
                options={
                  productOptions
                }
                onChange={
                  setProductId
                }
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
                value={
                  productQuantity
                }
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
                  availableStock !==
                    null &&
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
              label="الطرف الأول المسجّل في العقد والسند"
              fullWidth
            >
              <CustomSelect
                value={
                  printPartyType
                }
                placeholder="اختر الطرف الأول"
                options={[
                  {
                    value:
                      "organization",
                    label:
                      "المستثمر الرئيسي - المؤسسة",
                  },
                  {
                    value:
                      "investor",
                    label:
                      "المستثمر",
                  },
                ]}
                onChange={(value) =>
                  setPrintPartyType(
                    value as
                      | "organization"
                      | "investor"
                  )
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
              label="مبلغ الدين (القيمه المسلّمه للعميل )"
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
              label="مبلغ السداد (المطلوب سداده )"
              required
            >
              <input
                style={fieldInput}
                inputMode="decimal"
                placeholder="0.00"
                value={
                  paymentAmount
                }
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
              label="نوع السداد"
              required
            >
              <CustomSelect
                value={paymentType}
                placeholder="اختر نوع السداد"
                options={[
                  {
                    value:
                      "موعد محدد",
                    label:
                      "موعد محدد",
                  },
                  {
                    value:
                      "شهري مجدول",
                    label:
                      "شهري مجدول",
                  },
                ]}
                onChange={
                  setPaymentType
                }
              />
            </Field>

            <Field
              label="تاريخ تحرير العقد"
              required
            >
              <ProfessionalDatePicker
                value={
                  contractIssueDate
                }
                onChange={
                  setContractIssueDate
                }
                placeholder="اختر تاريخ تحرير العقد"
              />
            </Field>

            <Field
              label="موعد السداد / استحقاق السند"
              required={
                paymentType ===
                  "موعد محدد" ||
                creationMode ===
                  "contract_and_note"
              }
              fullWidth
            >
              <ProfessionalDatePicker
                value={
                  paymentDueDate
                }
                onChange={
                  setPaymentDueDate
                }
                placeholder="اختر موعد السداد"
              />
            </Field>

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

            <Field
              label="المبلغ القضائي"
              hint="لن يظهر في الطباعة إذا كان صفرًا"
            >
              <input
                style={fieldInput}
                inputMode="decimal"
                placeholder="0.00"
                value={
                  judicialAmount
                }
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
            label="اختيار الكفيل"
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
                  label:
                    "بدون كفيل",
                },
                {
                  value: "yes",
                  label:
                    "يوجد كفيل",
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
                    maxLength={10}
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
                      style={lookupStatus}
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
                  value={
                    guarantorPhone
                  }
                  onChange={(event) =>
                    setGuarantorPhone(
                      normalizeDigits(
                        event.target.value
                      ).slice(0, 10)
                    )
                  }
                  placeholder="05xxxxxxxx"
                  inputMode="tel"
                  maxLength={10}
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
                value={
                  guarantorId || ""
                }
                readOnly
              />
            </div>
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            طريقة الإنشاء
          </h2>

          <div style={creationModeGrid}>
            <button
              type="button"
              style={{
                ...creationModeButton,
                ...(creationMode ===
                "contract_only"
                  ? creationModeButtonActive
                  : {}),
              }}
              onClick={() =>
                setCreationMode(
                  "contract_only"
                )
              }
            >
              <strong>
                إنشاء العقد فقط
              </strong>

              <span>
                إنشاء العقد ثم الانتقال
                إلى تفاصيله
              </span>
            </button>

            <button
              type="button"
              disabled={
                !canCreatePromissoryNote
              }
              style={{
                ...creationModeButton,
                ...(creationMode ===
                "contract_and_note"
                  ? creationModeButtonActive
                  : {}),
                ...(!canCreatePromissoryNote
                  ? creationModeButtonDisabled
                  : {}),
              }}
              onClick={() => {
                if (
                  canCreatePromissoryNote
                ) {
                  setCreationMode(
                    "contract_and_note"
                  );
                }
              }}
            >
              <strong>
                إنشاء العقد مع سند
                تلقائيًا
              </strong>

              <span>
                إنشاء العقد والسند معًا ثم
                فتح صفحة الطباعة
              </span>

              {!canCreatePromissoryNote && (
                <small
                  style={
                    permissionText
                  }
                >
                  لا تملك صلاحية إنشاء سند
                </small>
              )}
            </button>
          </div>
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
              opacity:
                saving ||
                referenceDataLoading
                  ? 0.68
                  : 1,
              cursor:
                saving ||
                referenceDataLoading
                  ? "not-allowed"
                  : "pointer",
            }}
            onClick={createContract}
            disabled={
              saving ||
              referenceDataLoading
            }
          >
            {saving
              ? "جاري تنفيذ العملية..."
              : referenceDataLoading
                ? "جاري تجهيز بيانات العقد..."
                : creationMode ===
                    "contract_and_note"
                  ? "إنشاء العقد والسند"
                  : "إنشاء العقد"}
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

  const [menuRect, setMenuRect] =
    useState<DropdownRect | null>(
      null
    );

  const wrapperRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const selectedOption =
    options.find(
      (option) =>
        option.value === value
    );

  function updateMenuPosition() {
    if (!wrapperRef.current) {
      return;
    }

    const rect =
      wrapperRef.current.getBoundingClientRect();

    setMenuRect({
      top: rect.bottom + 7,
      left: rect.left,
      width: rect.width,
    });
  }

  function closeMenu() {
    setOpen(false);
    setMenuRect(null);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    updateMenuPosition();

    function handleOutsidePointer(
      event: PointerEvent
    ) {
      const target =
        event.target as Node;

      if (
        wrapperRef.current &&
        wrapperRef.current.contains(
          target
        )
      ) {
        return;
      }

      const portalMenu =
        document.getElementById(
          "finance-custom-select-menu"
        );

      if (
        portalMenu &&
        portalMenu.contains(target)
      ) {
        return;
      }

      closeMenu();
    }

    function handlePositionChange() {
      updateMenuPosition();
    }

    document.addEventListener(
      "pointerdown",
      handleOutsidePointer
    );

    window.addEventListener(
      "resize",
      handlePositionChange
    );

    window.addEventListener(
      "scroll",
      handlePositionChange,
      true
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsidePointer
      );

      window.removeEventListener(
        "resize",
        handlePositionChange
      );

      window.removeEventListener(
        "scroll",
        handlePositionChange,
        true
      );
    };
  }, [open]);

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
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            updateMenuPosition();
            setOpen(true);
          }
        }}
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

      {open &&
        menuRect &&
        typeof document !==
          "undefined" &&
        createPortal(
          <div
            id="finance-custom-select-menu"
            style={{
              ...selectOptionsMenu,
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
            }}
          >
            {options.length === 0 ? (
              <div style={emptyOption}>
                لا توجد خيارات متاحة
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={
                    option.disabled
                  }
                  style={{
                    ...selectOptionButton,
                    ...(option.value ===
                    value
                      ? selectedOptionButton
                      : {}),
                    ...(option.disabled
                      ? disabledOptionButton
                      : {}),
                  }}
                  onPointerDown={(
                    event
                  ) => {
                    event.preventDefault();
                    event.stopPropagation();

                    if (
                      option.disabled
                    ) {
                      return;
                    }

                    onChange(option.value);
                    closeMenu();
                  }}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

function ProfessionalDatePicker({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const initialDate =
    parseDateValue(value) ||
    new Date();

  const [open, setOpen] =
    useState(false);

  const [
    visibleYear,
    setVisibleYear,
  ] = useState(
    initialDate.getFullYear()
  );

  const [
    visibleMonth,
    setVisibleMonth,
  ] = useState(
    initialDate.getMonth()
  );

  useEffect(() => {
    const selectedDate =
      parseDateValue(value);

    if (selectedDate) {
      setVisibleYear(
        selectedDate.getFullYear()
      );

      setVisibleMonth(
        selectedDate.getMonth()
      );
    }
  }, [value]);

  const days =
    getCalendarDays(
      visibleYear,
      visibleMonth
    );

  function selectDate(
    year: number,
    month: number,
    day: number
  ) {
    const date =
      new Date(year, month, day);

    onChange(
      formatLocalDate(date)
    );

    setOpen(false);
  }

  function goToPreviousMonth() {
    if (visibleMonth === 0) {
      setVisibleMonth(11);

      setVisibleYear(
        (current) =>
          current - 1
      );
    } else {
      setVisibleMonth(
        (current) =>
          current - 1
      );
    }
  }

  function goToNextMonth() {
    if (visibleMonth === 11) {
      setVisibleMonth(0);

      setVisibleYear(
        (current) =>
          current + 1
      );
    } else {
      setVisibleMonth(
        (current) =>
          current + 1
      );
    }
  }

  return (
    <>
      <button
        type="button"
        style={datePickerButton}
        onClick={() =>
          setOpen(true)
        }
      >
        <span
          style={
            value
              ? datePickerValue
              : datePickerPlaceholder
          }
        >
          {value
            ? formatDisplayDate(value)
            : placeholder}
        </span>

        <CalendarIcon />
      </button>

      {open &&
        typeof document !==
          "undefined" &&
        createPortal(
          <div
            style={calendarOverlay}
            onPointerDown={() =>
              setOpen(false)
            }
          >
            <div
              style={calendarModal}
              onPointerDown={(event) =>
                event.stopPropagation()
              }
            >
              <div
                style={calendarHeader}
              >
                <button
                  type="button"
                  style={
                    calendarNavigationButton
                  }
                  onClick={
                    goToPreviousMonth
                  }
                >
                  ‹
                </button>

                <strong
                  style={
                    calendarMonthTitle
                  }
                >
                  {
                    ARABIC_MONTHS[
                      visibleMonth
                    ]
                  }{" "}
                  {visibleYear}
                </strong>

                <button
                  type="button"
                  style={
                    calendarNavigationButton
                  }
                  onClick={
                    goToNextMonth
                  }
                >
                  ›
                </button>
              </div>

              <div
                style={
                  calendarWeekGrid
                }
              >
                {ARABIC_WEEK_DAYS.map(
                  (day) => (
                    <div
                      key={day}
                      style={
                        calendarWeekDay
                      }
                    >
                      {day}
                    </div>
                  )
                )}
              </div>

              <div
                style={
                  calendarDaysGrid
                }
              >
                {days.map(
                  (item, index) => {
                    if (!item) {
                      return (
                        <div
                          key={`empty-${index}`}
                        />
                      );
                    }

                    const currentValue =
                      `${visibleYear}-${String(
                        visibleMonth + 1
                      ).padStart(
                        2,
                        "0"
                      )}-${String(
                        item
                      ).padStart(
                        2,
                        "0"
                      )}`;

                    const isSelected =
                      currentValue ===
                      value;

                    const isToday =
                      currentValue ===
                      getTodayDate();

                    return (
                      <button
                        key={
                          currentValue
                        }
                        type="button"
                        style={{
                          ...calendarDayButton,
                          ...(isToday
                            ? calendarTodayButton
                            : {}),
                          ...(isSelected
                            ? calendarSelectedButton
                            : {}),
                        }}
                        onClick={() =>
                          selectDate(
                            visibleYear,
                            visibleMonth,
                            item
                          )
                        }
                      >
                        {item}
                      </button>
                    );
                  }
                )}
              </div>

              <div
                style={calendarFooter}
              >
                <button
                  type="button"
                  style={
                    calendarTodayAction
                  }
                  onClick={() => {
                    const today =
                      new Date();

                    setVisibleYear(
                      today.getFullYear()
                    );

                    setVisibleMonth(
                      today.getMonth()
                    );

                    onChange(
                      formatLocalDate(
                        today
                      )
                    );

                    setOpen(false);
                  }}
                >
                  اختيار اليوم
                </button>

                <button
                  type="button"
                  style={
                    calendarCancelAction
                  }
                  onClick={() =>
                    setOpen(false)
                  }
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const ARABIC_WEEK_DAYS = [
  "ح",
  "ن",
  "ث",
  "ر",
  "خ",
  "ج",
  "س",
];

function getCalendarDays(
  year: number,
  month: number
) {
  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();

  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  const values:
    Array<number | null> = [];

  for (
    let index = 0;
    index < firstDay;
    index += 1
  ) {
    values.push(null);
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day += 1
  ) {
    values.push(day);
  }

  while (
    values.length % 7 !== 0
  ) {
    values.push(null);
  }

  return values;
}

function getTodayDate() {
  return formatLocalDate(
    new Date()
  );
}

function formatLocalDate(
  date: Date
) {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateValue(
  value: string
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value
    );

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]) - 1;

  const day =
    Number(match[3]);

  const date =
    new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDisplayDate(
  value: string
) {
  const date =
    parseDateValue(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "ar-SA-u-ca-gregory",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  ).format(date);
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

  if (
    limited.length <= 4
  ) {
    return limited;
  }

  if (
    limited.length <= 6
  ) {
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

function extractCreationResult(
  data: unknown
): CompleteCreationResult {
  if (Array.isArray(data)) {
    return (
      (data[0] as CompleteCreationResult) ||
      {}
    );
  }

  if (
    data &&
    typeof data === "object"
  ) {
    return data as CompleteCreationResult;
  }

  return {};
}

function getRpcErrorMessage(
  message: string
) {
  const mappings:
    Array<[string, string]> = [
    [
      "BRANCH_REQUIRED",
      "تعذر تحديد الفرع",
    ],
    [
      "EMPLOYEE_REQUIRED",
      "تعذر تحديد الموظف",
    ],
    [
      "INVALID_EMPLOYEE_SESSION",
      "جلسة الموظف غير صالحة",
    ],
    [
      "PROMISSORY_NOTE_PERMISSION_DENIED",
      "لا تملك صلاحية إنشاء سند",
    ],
    [
      "INVESTOR_NOT_FOUND",
      "المستثمر غير موجود في الفرع",
    ],
    [
      "PRODUCT_NOT_FOUND",
      "المنتج غير موجود في الفرع",
    ],
    [
      "INVALID_PRODUCT_QUANTITY",
      "كمية المنتج غير صحيحة",
    ],
    [
      "INVALID_DEBT_AMOUNT",
      "مبلغ الدين غير صحيح",
    ],
    [
      "INVALID_PAYMENT_AMOUNT",
      "مبلغ السداد غير صحيح",
    ],
    [
      "CONTRACT_ISSUE_DATE_REQUIRED",
      "تاريخ تحرير العقد مطلوب",
    ],
    [
      "NOTE_DUE_DATE_REQUIRED",
      "تاريخ استحقاق السند مطلوب",
    ],
    [
      "LEGAL_CITY_REQUIRED",
      "مدينة التقاضي مطلوبة عند إنشاء السند",
    ],
    [
      "INVALID_CUSTOMER_NATIONAL_ID",
      "رقم هوية العميل غير صحيح",
    ],
    [
      "CUSTOMER_NAME_REQUIRED",
      "اسم العميل مطلوب",
    ],
    [
      "CUSTOMER_BIRTH_REQUIRED",
      "تاريخ ميلاد العميل مطلوب",
    ],
    [
      "CUSTOMER_PHONE_REQUIRED",
      "رقم جوال العميل مطلوب",
    ],
    [
      "INVALID_GUARANTOR_NATIONAL_ID",
      "رقم هوية الكفيل غير صحيح",
    ],
    [
      "GUARANTOR_SAME_AS_CUSTOMER",
      "لا يمكن أن يكون العميل كفيلًا لنفسه",
    ],
    [
      "GUARANTOR_NAME_REQUIRED",
      "اسم الكفيل مطلوب",
    ],
    [
      "GUARANTOR_BIRTH_REQUIRED",
      "تاريخ ميلاد الكفيل مطلوب",
    ],
    [
      "GUARANTOR_PHONE_REQUIRED",
      "رقم جوال الكفيل مطلوب",
    ],
  ];

  for (
    const [
      code,
      translated,
    ] of mappings
  ) {
    if (
      message.includes(code)
    ) {
      return translated;
    }
  }

  return message;
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error instanceof Error
  ) {
    return (
      error.message || fallback
    );
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

function CalendarIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="M7 3v4M17 3v4M3 10h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
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
    padding: isMobile
      ? 10
      : 18,
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
    gap:
      screen === "mobile"
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
    fontSize: isMobile
      ? 15
      : 17,
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

const inlineErrorCard: CSSProperties = {
  marginBottom: 14,
  padding: "12px 14px",
  borderRadius: 14,
  border:
    "1px solid #fecaca",
  background: "#fff7f7",
  color: "#991b1b",
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: 12,
  flexWrap: "wrap",
  fontSize: 13,
  fontWeight: 900,
};

const inlineRetryButton: CSSProperties = {
  minHeight: 38,
  border: "none",
  borderRadius: 10,
  padding: "8px 14px",
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  fontWeight: 900,
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

const sectionTitleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 20,
};

const localLoadingBadge: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  border:
    "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 900,
};

const sectionTitle: CSSProperties = {
  margin: "0 0 20px 0",
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
  justifyContent:
    "space-between",
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
  position: "fixed",
  maxHeight: 280,
  overflowY: "auto",
  padding: 7,
  borderRadius: 14,
  border:
    "1px solid #cbd8eb",
  background: "#ffffff",
  boxShadow:
    "0 18px 42px rgba(15,23,42,0.22)",
  zIndex: 100000,
  boxSizing: "border-box",
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

const disabledOptionButton: CSSProperties = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const emptyOption: CSSProperties = {
  padding: 14,
  color: "#64748b",
  textAlign: "center",
  fontSize: 14,
  fontWeight: 800,
};

const datePickerButton: CSSProperties = {
  ...fieldInput,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: 12,
  textAlign: "right",
  direction: "rtl",
  color: "#2563eb",
};

const datePickerValue: CSSProperties = {
  color: "#0f172a",
  fontWeight: 800,
};

const datePickerPlaceholder: CSSProperties = {
  color: "#64748b",
  fontWeight: 700,
};

const calendarOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 200000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background:
    "rgba(15,23,42,0.45)",
  backdropFilter: "blur(5px)",
};

const calendarModal: CSSProperties = {
  width: "100%",
  maxWidth: 430,
  padding: 20,
  borderRadius: 22,
  background: "#ffffff",
  border:
    "1px solid #dbeafe",
  boxShadow:
    "0 30px 80px rgba(15,23,42,0.28)",
  direction: "rtl",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const calendarHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "48px 1fr 48px",
  alignItems: "center",
  gap: 10,
  marginBottom: 18,
};

const calendarNavigationButton: CSSProperties = {
  width: 48,
  height: 48,
  border: "none",
  borderRadius: 14,
  background: "#eff6ff",
  color: "#1d4ed8",
  cursor: "pointer",
  fontSize: 30,
  fontWeight: 900,
};

const calendarMonthTitle: CSSProperties = {
  textAlign: "center",
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const calendarWeekGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(7, 1fr)",
  gap: 6,
  marginBottom: 8,
};

const calendarWeekDay: CSSProperties = {
  textAlign: "center",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
  padding: "6px 0",
};

const calendarDaysGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(7, 1fr)",
  gap: 6,
};

const calendarDayButton: CSSProperties = {
  aspectRatio: "1 / 1",
  minHeight: 42,
  border: "none",
  borderRadius: 12,
  background: "#f8fafc",
  color: "#1e293b",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 800,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const calendarTodayButton: CSSProperties = {
  border:
    "1.5px solid #22c55e",
  color: "#15803d",
};

const calendarSelectedButton: CSSProperties = {
  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
  border: "none",
  boxShadow:
    "0 6px 14px rgba(37,99,235,0.24)",
};

const calendarFooter: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr",
  gap: 10,
  marginTop: 18,
};

const calendarTodayAction: CSSProperties = {
  minHeight: 46,
  border: "none",
  borderRadius: 13,
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const calendarCancelAction: CSSProperties = {
  minHeight: 46,
  border:
    "1px solid #cbd5e1",
  borderRadius: 13,
  background: "#ffffff",
  color: "#475569",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
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

const creationModeGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(260px,1fr))",
  gap: 14,
};

const creationModeButton: CSSProperties = {
  minHeight: 116,
  padding: 18,
  borderRadius: 17,
  border:
    "1.5px solid #cbd8eb",
  background:
    "linear-gradient(180deg,#ffffff,#f8fbff)",
  color: "#1e3a5f",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  gap: 8,
  textAlign: "right",
  fontSize: 14,
  fontWeight: 700,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const creationModeButtonActive: CSSProperties = {
  borderColor: "#2563eb",
  background:
    "linear-gradient(135deg,#eff6ff,#e0f2fe)",
  boxShadow:
    "0 0 0 4px rgba(37,99,235,0.10)",
  color: "#0d47a1",
};

const creationModeButtonDisabled: CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};

const permissionText: CSSProperties = {
  color: "#b91c1c",
  fontWeight: 900,
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
