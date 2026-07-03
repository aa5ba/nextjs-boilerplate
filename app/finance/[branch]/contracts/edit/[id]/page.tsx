"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import {
  normalizeNumber,
  toNumber,
} from "@/lib/numberUtils";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";

type ScreenType = "mobile" | "tablet" | "desktop";

type FinanceSession = {
  id?: string | null;
  user_id?: string | null;
  full_name?: string | null;
  username?: string | null;
  role?: string | null;
  roles?: unknown;
  branch_id?: string | null;
  branch_slug?: string | null;
  branch_name?: string | null;
  organization_name?: string | null;
  permissions?: unknown;
  investor_id?: string | null;
  is_active?: boolean | null;
  last_login_at?: string | null;
};

type CustomerRelation = {
  full_name?: string | null;
};

type ContractData = {
  id: string;
  branch_id?: string | null;
  customer_id?: string | null;
  contract_status?: string | null;

  investor_id?: string | null;
  investor_name?: string | null;

  product_id?: string | null;
  product_name?: string | null;

  product_quantity?: number | string | null;

  print_party_type?: string | null;
  print_party_name?: string | null;
  print_party_identifier?: string | null;

  debt_amount?: number | string | null;
  payment_amount?: number | string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;
  installment_amount?: number | string | null;

  payment_type?: string | null;
  payment_due_date?: string | null;
  legal_city?: string | null;
  notes?: string | null;

  customer?:
    | CustomerRelation
    | CustomerRelation[]
    | null;
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

type UpdateContractResult = {
  contract_id: string;
  investor_id: string;
  product_id: string;
  product_quantity: number | string;
  new_remaining_amount: number | string;
};

type InventorySnapshot = {
  quantity: number;
  exists: boolean;
};

type DialogTone =
  | "info"
  | "warning"
  | "error"
  | "success";

type DialogAction =
  | "continue-save"
  | "open-contract"
  | null;

type DialogDetail = {
  label: string;
  value: string;
  highlight?: boolean;
};

type DialogState = {
  tone: DialogTone;
  title: string;
  message: string;
  details?: DialogDetail[];
  confirmText?: string;
  cancelText?: string;
  action?: DialogAction;
};

const SESSION_KEYS = [
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

const MANAGER_ROLES = [
  "main_admin",
  "branch_manager",
  "مدير فرع",
  "مدير رئيسي",
  "مدير",
];

export default function EditContractPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "").trim();
  const contractId = String(params.id ?? "").trim();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [authChecked, setAuthChecked] =
    useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<
    string[]
  >([]);

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [contract, setContract] =
    useState<ContractData | null>(null);

  const [investors, setInvestors] = useState<
    Investor[]
  >([]);

  const [products, setProducts] = useState<
    Product[]
  >([]);

  const [investorId, setInvestorId] = useState("");
  const [productId, setProductId] = useState("");
  const [productQuantity, setProductQuantity] =
    useState("");

  const [printPartyType, setPrintPartyType] =
    useState("organization");

  const [organizationName, setOrganizationName] =
    useState("");

  const [organizationCommercialRecord, setOrganizationCommercialRecord] =
    useState("");

  const [inventoryQuantity, setInventoryQuantity] =
    useState<number | null>(null);

  const [inventoryExists, setInventoryExists] =
    useState(false);

  const [inventoryLoading, setInventoryLoading] =
    useState(false);

  const [inventoryError, setInventoryError] =
    useState("");

  const [dialog, setDialog] =
    useState<DialogState | null>(null);

  const [debtAmount, setDebtAmount] = useState("");
  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [installmentAmount, setInstallmentAmount] =
    useState("");

  const [paymentType, setPaymentType] = useState("");
  const [paymentDueDate, setPaymentDueDate] =
    useState("");

  const [legalCity, setLegalCity] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

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
      window.removeEventListener(
        "resize",
        updateScreen
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedInventory() {
      if (!branchId || !investorId || !productId) {
        setInventoryQuantity(null);
        setInventoryExists(false);
        setInventoryError("");
        setInventoryLoading(false);
        return;
      }

      setInventoryLoading(true);
      setInventoryError("");

      try {
        const snapshot = await fetchInventorySnapshot(
          branchId,
          investorId,
          productId
        );

        if (cancelled) {
          return;
        }

        setInventoryQuantity(snapshot.quantity);
        setInventoryExists(snapshot.exists);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Selected inventory loading error:",
          error
        );

        setInventoryQuantity(null);
        setInventoryExists(false);
        setInventoryError(
          "تعذر تحميل كمية المخزون الحالية"
        );
      } finally {
        if (!cancelled) {
          setInventoryLoading(false);
        }
      }
    }

    void loadSelectedInventory();

    return () => {
      cancelled = true;
    };
  }, [branchId, investorId, productId]);

  useEffect(() => {
    if (!dialog || typeof window === "undefined") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || saving) {
        return;
      }

      setDialog(null);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dialog, saving]);

  useEffect(() => {
    let cancelled = false;

    async function initializePage() {
      setAuthChecked(false);
      setLoading(true);
      setPageError("");
      setContract(null);
      setInvestors([]);
      setProducts([]);
      setBranchId(null);
      setInventoryQuantity(null);
      setInventoryExists(false);
      setInventoryError("");
      setDialog(null);

      if (!branch || !contractId) {
        redirectToLogin();
        return;
      }

      const session = readStoredSession();

      if (!isValidSession(session)) {
        redirectToLogin();
        return;
      }

      const sessionBranchSlug = String(
        session?.branch_slug ?? ""
      ).trim();

      if (sessionBranchSlug !== branch) {
        router.replace(
          `/finance/${encodeURIComponent(
            sessionBranchSlug
          )}`
        );

        return;
      }

      applySession(session);

      if (!canEditContract(session)) {
        setPageError(
          "ليس لديك صلاحية تعديل العقود"
        );

        setAuthChecked(true);
        setLoading(false);
        return;
      }

      try {
        const currentBranchId =
          await getBranchId(branch);

        if (cancelled) {
          return;
        }

        if (!currentBranchId) {
          setPageError("تعذر تحديد بيانات الفرع");
          setAuthChecked(true);
          setLoading(false);
          return;
        }

        const sessionBranchId = String(
          session?.branch_id ?? ""
        ).trim();

        if (
          sessionBranchId !==
          String(currentBranchId)
        ) {
          router.replace(
            `/finance/${encodeURIComponent(
              sessionBranchSlug
            )}`
          );

          return;
        }

        setBranchId(String(currentBranchId));
        setAuthChecked(true);

        await loadData(
          String(currentBranchId),
          () => cancelled
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Edit contract initialization error:",
          error
        );

        setPageError(
          "حدث خطأ أثناء تحميل بيانات تعديل العقد"
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [branch, contractId]);

  function clearSession() {
    if (typeof window === "undefined") {
      return;
    }

    SESSION_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });
  }

  function redirectToLogin() {
    clearSession();
    router.replace("/login");
  }

  function readStoredSession(): FinanceSession | null {
    if (typeof window === "undefined") {
      return null;
    }

    const rawSession =
      localStorage.getItem("finance_user") ||
      localStorage.getItem(
        "finance_branch_user"
      );

    if (!rawSession) {
      return null;
    }

    try {
      const parsed = JSON.parse(
        rawSession
      ) as FinanceSession;

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return null;
      }

      return {
        ...parsed,

        id:
          parsed.id ||
          parsed.user_id ||
          localStorage.getItem(
            "finance_user_id"
          ),

        full_name:
          parsed.full_name ||
          localStorage.getItem(
            "finance_user_name"
          ) ||
          null,

        username:
          parsed.username ||
          localStorage.getItem(
            "finance_username"
          ) ||
          null,

        role:
          parsed.role ||
          localStorage.getItem(
            "finance_role"
          ) ||
          null,

        branch_id:
          parsed.branch_id ||
          localStorage.getItem(
            "finance_branch_id"
          ) ||
          null,

        branch_slug:
          parsed.branch_slug ||
          localStorage.getItem(
            "finance_branch_slug"
          ) ||
          null,

        branch_name:
          parsed.branch_name ||
          localStorage.getItem(
            "finance_branch_name"
          ) ||
          null,

        organization_name:
          parsed.organization_name ||
          localStorage.getItem(
            "finance_organization_name"
          ) ||
          null,

        investor_id:
          parsed.investor_id ||
          localStorage.getItem(
            "finance_investor_id"
          ) ||
          null,

        last_login_at:
          parsed.last_login_at ||
          localStorage.getItem(
            "finance_last_login_at"
          ) ||
          null,
      };
    } catch {
      return null;
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

  function isValidSession(
    session: FinanceSession | null
  ) {
    if (!session) {
      return false;
    }

    const userId = String(
      session.id || session.user_id || ""
    ).trim();

    const sessionBranchId = String(
      session.branch_id || ""
    ).trim();

    const sessionBranchSlug = String(
      session.branch_slug || ""
    ).trim();

    if (
      !userId ||
      !sessionBranchId ||
      !sessionBranchSlug
    ) {
      return false;
    }

    if (session.is_active === false) {
      return false;
    }

    const savedIsActive =
      typeof window !== "undefined"
        ? localStorage.getItem(
            "finance_is_active"
          )
        : null;

    if (savedIsActive === "false") {
      return false;
    }

    return true;
  }

  function getSessionRoles(
    session: FinanceSession | null
  ) {
    if (!session) {
      return [];
    }

    const sessionRoles = normalizeStringArray(
      session.roles
    );

    if (
      typeof session.role === "string" &&
      session.role.trim() &&
      !sessionRoles.includes(session.role.trim())
    ) {
      sessionRoles.push(session.role.trim());
    }

    return sessionRoles;
  }

  function getSessionPermissions(
    session: FinanceSession | null
  ) {
    if (!session) {
      return [];
    }

    let sessionPermissions = normalizeStringArray(
      session.permissions
    );

    if (
      sessionPermissions.length === 0 &&
      typeof window !== "undefined"
    ) {
      const rawPermissions =
        localStorage.getItem(
          "finance_permissions"
        );

      if (rawPermissions) {
        try {
          sessionPermissions =
            normalizeStringArray(
              JSON.parse(rawPermissions)
            );
        } catch {
          sessionPermissions = [];
        }
      }
    }

    return sessionPermissions;
  }

  function canEditContract(
    session: FinanceSession | null
  ) {
    const sessionRoles = getSessionRoles(session);
    const sessionPermissions =
      getSessionPermissions(session);

    const isManager = sessionRoles.some((role) =>
      MANAGER_ROLES.includes(role)
    );

    if (isManager) {
      return true;
    }

    return [
      "contracts_edit",
      "contracts_update",
      "edit_contract",
      "contracts",
    ].some((permission) =>
      sessionPermissions.includes(permission)
    );
  }

  function applySession(
    session: FinanceSession | null
  ) {
    if (!session) {
      setEmployeeId("");
      setEmployeeName("الموظف");
      setRoles([]);
      setPermissions([]);
      return;
    }

    const resolvedEmployeeId = String(
      session.id || session.user_id || ""
    ).trim();

    const directName =
      typeof window !== "undefined"
        ? localStorage.getItem(
            "finance_user_name"
          )
        : null;

    const resolvedEmployeeName =
      directName ||
      session.full_name ||
      session.username ||
      "الموظف";

    const resolvedOrganizationName = String(
      session.organization_name ||
        (typeof window !== "undefined"
          ? localStorage.getItem(
              "finance_organization_name"
            )
          : "") ||
        ""
    ).trim();

    setEmployeeId(resolvedEmployeeId);
    setEmployeeName(resolvedEmployeeName);
    setOrganizationName(resolvedOrganizationName);
    setRoles(getSessionRoles(session));
    setPermissions(
      getSessionPermissions(session)
    );
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  function getCustomer(
    currentContract: ContractData | null
  ) {
    const relation =
      currentContract?.customer;

    if (Array.isArray(relation)) {
      return relation[0] || null;
    }

    return relation || null;
  }

  function getCustomerName(
    currentContract: ContractData | null
  ) {
    return (
      getCustomer(currentContract)?.full_name ||
      ""
    );
  }

  function showDialog(
    nextDialog: DialogState
  ) {
    setDialog(nextDialog);
  }

  function showError(
    title: string,
    message: string
  ) {
    showDialog({
      tone: "error",
      title,
      message,
      confirmText: "حسنًا",
      action: null,
    });
  }

  async function fetchInventorySnapshot(
    currentBranchId: string,
    currentInvestorId: string,
    currentProductId: string
  ): Promise<InventorySnapshot> {
    const { data, error } = await supabase
      .from("finance_inventory")
      .select("id, quantity")
      .eq("branch_id", currentBranchId)
      .eq("investor_id", currentInvestorId)
      .eq("product_id", currentProductId)
      .order("updated_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return {
      quantity: Number(data?.quantity || 0),
      exists: Boolean(data?.id),
    };
  }

  function calculateInventoryImpact(
    selectedInventoryQuantity: number,
    requestedQuantity: number
  ) {
    const oldQuantity = Number(
      contract?.product_quantity || 0
    );

    const sameInventory = Boolean(
      contract?.investor_id === investorId &&
        contract?.product_id === productId
    );

    const quantityDifference = sameInventory
      ? requestedQuantity - oldQuantity
      : requestedQuantity;

    const requiredFromInventory = Math.max(
      quantityDifference,
      0
    );

    const returnedToInventory = sameInventory
      ? Math.max(-quantityDifference, 0)
      : 0;

    const projectedQuantity = sameInventory
      ? selectedInventoryQuantity - quantityDifference
      : selectedInventoryQuantity - requestedQuantity;

    return {
      sameInventory,
      oldQuantity,
      requiredFromInventory,
      returnedToInventory,
      projectedQuantity,
      selectedQuantityExceedsAvailable:
        requestedQuantity > selectedInventoryQuantity,
      shortage: Math.max(-projectedQuantity, 0),
    };
  }

  async function loadData(
    currentBranchId: string,
    isCancelled: () => boolean = () => false
  ) {
    setLoading(true);
    setPageError("");

    try {
      const [
        investorsResult,
        productsResult,
        contractResult,
        branchResult,
        organizationSettings,
      ] = await Promise.all([
        supabase
          .from("finance_investors")
          .select(
            "id, investor_name, national_id, is_active"
          )
          .eq("branch_id", currentBranchId)
          .eq("is_active", true)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("finance_products")
          .select(
            "id, product_name, is_active"
          )
          .eq("branch_id", currentBranchId)
          .eq("is_active", true)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("finance_contracts")
          .select(
            `
              id,
              branch_id,
              customer_id,
              contract_status,
              investor_id,
              investor_name,
              product_id,
              product_name,
              product_quantity,
              print_party_type,
              print_party_name,
              print_party_identifier,
              debt_amount,
              payment_amount,
              paid_amount,
              remaining_amount,
              installment_amount,
              payment_type,
              payment_due_date,
              legal_city,
              notes,
              customer:finance_customers!finance_contracts_customer_id_fkey(
                full_name
              )
            `
          )
          .eq("id", contractId)
          .eq("branch_id", currentBranchId)
          .maybeSingle(),

        supabase
          .from("finance_branches")
          .select("organization_name")
          .eq("id", currentBranchId)
          .maybeSingle(),

        getOrganizationSettings().catch((error) => {
          console.warn(
            "Organization settings loading warning:",
            error
          );

          return null;
        }),
      ]);

      if (isCancelled()) {
        return;
      }

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

      if (contractResult.error) {
        throw new Error(
          contractResult.error.message
        );
      }

      if (!contractResult.data) {
        setPageError(
          "العقد غير موجود أو لا يتبع هذا الفرع"
        );

        return;
      }

      const loadedContract =
        contractResult.data as ContractData;

      if (branchResult.error) {
        console.warn(
          "Branch organization name loading warning:",
          branchResult.error
        );
      }

      const storedOrganizationName =
        typeof window !== "undefined"
          ? localStorage.getItem(
              "finance_organization_name"
            ) || ""
          : "";

      const resolvedOrganizationName = String(
        branchResult.data?.organization_name ||
          organizationSettings?.name ||
          storedOrganizationName ||
          (loadedContract.print_party_type ===
          "organization"
            ? loadedContract.print_party_name
            : "") ||
          ""
      ).trim();

      setOrganizationName(resolvedOrganizationName);
      setOrganizationCommercialRecord(
        String(
          organizationSettings?.commercialRecord ||
            ""
        ).trim()
      );

      setInvestors(
        (investorsResult.data || []) as Investor[]
      );

      setProducts(
        (productsResult.data || []) as Product[]
      );

      setContract(loadedContract);

      setInvestorId(
        loadedContract.investor_id || ""
      );

      setProductId(
        loadedContract.product_id || ""
      );

      setProductQuantity(
        String(
          loadedContract.product_quantity ?? ""
        )
      );

      setPrintPartyType(
        loadedContract.print_party_type ||
          "organization"
      );

      setDebtAmount(
        String(loadedContract.debt_amount ?? "")
      );

      setPaymentAmount(
        String(
          loadedContract.payment_amount ?? ""
        )
      );

      setInstallmentAmount(
        String(
          loadedContract.installment_amount ?? ""
        )
      );

      setPaymentType(
        loadedContract.payment_type || ""
      );

      setPaymentDueDate(
        loadedContract.payment_due_date || ""
      );

      setLegalCity(
        loadedContract.legal_city || ""
      );

      setNotes(loadedContract.notes || "");
    } catch (error) {
      if (isCancelled()) {
        return;
      }

      console.error(
        "Edit contract loading error:",
        error
      );

      setPageError(
        error instanceof Error
          ? error.message
          : "تعذر تحميل بيانات العقد"
      );

      setContract(null);
      setInvestors([]);
      setProducts([]);
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  function getRpcErrorMessage(message: string) {
    if (message.includes("USER_NOT_FOUND")) {
      return "المستخدم غير موجود أو غير نشط";
    }

    if (
      message.includes("USER_BRANCH_MISMATCH")
    ) {
      return "المستخدم لا يتبع هذا الفرع";
    }

    if (
      message.includes("PERMISSION_DENIED")
    ) {
      return "ليس لديك صلاحية تعديل العقود";
    }

    if (
      message.includes("CONTRACT_NOT_FOUND")
    ) {
      return "العقد غير موجود أو لا يتبع هذا الفرع";
    }

    if (
      message.includes("INVESTOR_NOT_FOUND")
    ) {
      return "المستثمر غير موجود أو غير نشط";
    }

    if (
      message.includes("PRODUCT_NOT_FOUND")
    ) {
      return "المنتج غير موجود أو غير نشط";
    }

    if (
      message.includes("INVENTORY_NOT_FOUND")
    ) {
      return "لا يوجد مخزون للمستثمر والمنتج المحدد";
    }

    if (
      message.includes("INSUFFICIENT_INVENTORY")
    ) {
      return "لم تُحدّث دالة تعديل العقد بعد للسماح بتجاوز المخزون";
    }

    if (
      message.includes("INVALID_QUANTITY")
    ) {
      return "أدخل كمية صحيحة";
    }

    if (
      message.includes("INVALID_AMOUNTS")
    ) {
      return "تأكد من صحة مبالغ العقد";
    }

    if (
      message.includes("PAYMENT_LESS_THAN_PAID")
    ) {
      return "مبلغ السداد الجديد أقل من المبلغ المسدد فعليًا";
    }

    return (
      message ||
      "حدث خطأ أثناء تعديل العقد"
    );
  }

  async function saveContract(
    skipInventoryWarning = false
  ) {
    if (saving) {
      return;
    }

    if (
      !branchId ||
      !contract ||
      !employeeId
    ) {
      showError(
        "تعذر إكمال التعديل",
        "تعذر تحديد العقد أو المستخدم أو الفرع"
      );
      return;
    }

    if (!investorId) {
      showError(
        "بيانات غير مكتملة",
        "اختر المستثمر"
      );
      return;
    }

    if (!productId) {
      showError(
        "بيانات غير مكتملة",
        "اختر المنتج"
      );
      return;
    }

    if (!productQuantity) {
      showError(
        "بيانات غير مكتملة",
        "أدخل كمية المنتجات"
      );
      return;
    }

    if (!debtAmount) {
      showError(
        "بيانات غير مكتملة",
        "أدخل مبلغ الدين"
      );
      return;
    }

    if (!paymentAmount) {
      showError(
        "بيانات غير مكتملة",
        "أدخل مبلغ السداد"
      );
      return;
    }

    if (!paymentType) {
      showError(
        "بيانات غير مكتملة",
        "اختر نوع السداد"
      );
      return;
    }

    if (!paymentDueDate) {
      showError(
        "بيانات غير مكتملة",
        "حدد تاريخ الاستحقاق"
      );
      return;
    }

    if (!legalCity.trim()) {
      showError(
        "بيانات غير مكتملة",
        "أدخل مدينة التقاضي"
      );
      return;
    }

    const selectedInvestor = investors.find(
      (investor) => investor.id === investorId
    );

    const selectedProduct = products.find(
      (product) => product.id === productId
    );

    if (!selectedInvestor) {
      showError(
        "تعذر تحديد المستثمر",
        "أعد اختيار المستثمر ثم حاول مرة أخرى"
      );
      return;
    }

    if (!selectedProduct) {
      showError(
        "تعذر تحديد المنتج",
        "أعد اختيار المنتج ثم حاول مرة أخرى"
      );
      return;
    }

    const newQuantity = toNumber(
      productQuantity
    );

    const debt = toNumber(debtAmount);
    const payment = toNumber(paymentAmount);

    const installment = installmentAmount
      ? toNumber(installmentAmount)
      : 0;

    const alreadyPaid = Number(
      contract.paid_amount ?? 0
    );

    if (
      !Number.isFinite(newQuantity) ||
      newQuantity <= 0
    ) {
      showError(
        "كمية غير صحيحة",
        "أدخل كمية منتجات أكبر من صفر"
      );
      return;
    }

    if (
      !Number.isFinite(debt) ||
      debt <= 0
    ) {
      showError(
        "مبلغ غير صحيح",
        "أدخل مبلغ دين صحيحًا"
      );
      return;
    }

    if (
      !Number.isFinite(payment) ||
      payment <= 0
    ) {
      showError(
        "مبلغ غير صحيح",
        "أدخل مبلغ سداد صحيحًا"
      );
      return;
    }

    if (payment < alreadyPaid) {
      showError(
        "تعذر تعديل مبلغ السداد",
        "مبلغ السداد الجديد لا يمكن أن يكون أقل من المبلغ المسدد فعليًا"
      );
      return;
    }

    if (
      installment < 0 ||
      !Number.isFinite(installment)
    ) {
      showError(
        "قيمة قسط غير صحيحة",
        "أدخل قيمة قسط صحيحة"
      );
      return;
    }

    if (!skipInventoryWarning) {
      try {
        const snapshot = await fetchInventorySnapshot(
          branchId,
          investorId,
          productId
        );

        setInventoryQuantity(snapshot.quantity);
        setInventoryExists(snapshot.exists);
        setInventoryError("");

        const impact = calculateInventoryImpact(
          snapshot.quantity,
          newQuantity
        );

        if (
          impact.selectedQuantityExceedsAvailable ||
          impact.projectedQuantity < 0
        ) {
          const createsNegativeInventory =
            impact.projectedQuantity < 0;

          showDialog({
            tone: "warning",
            title: "الكمية المحددة أكبر من المتوفر",
            message: createsNegativeInventory
              ? `يمكن متابعة تعديل العقد، وسيصبح رصيد المخزون بالسالب بمقدار ${formatQuantity(
                  impact.shortage
                )} وحدة وفق النظام المعتمد.`
              : "الكمية المسجلة في العقد أكبر من المتوفر الحالي، لكن فرق التعديل الفعلي لا يؤدي إلى رصيد سالب. يمكن متابعة الحفظ.",
            details: [
              {
                label: "المتوفر حاليًا",
                value: `${formatQuantity(
                  snapshot.quantity
                )} وحدة`,
              },
              {
                label: "الكمية المحددة للعقد",
                value: `${formatQuantity(
                  newQuantity
                )} وحدة`,
              },
              {
                label: impact.sameInventory
                  ? "المطلوب بسبب فرق التعديل"
                  : "المطلوب من المخزون الجديد",
                value: `${formatQuantity(
                  impact.requiredFromInventory
                )} وحدة`,
              },
              {
                label: "الرصيد بعد التعديل",
                value: `${formatQuantity(
                  impact.projectedQuantity
                )} وحدة`,
                highlight: createsNegativeInventory,
              },
            ],
            confirmText: "متابعة التعديل",
            cancelText: "مراجعة الكمية",
            action: "continue-save",
          });

          return;
        }
      } catch (error) {
        console.error(
          "Inventory verification error:",
          error
        );

        showError(
          "تعذر التحقق من المخزون",
          "لم نتمكن من قراءة الرصيد الحالي. أعد المحاولة قبل حفظ التعديل"
        );
        return;
      }
    }

    try {
      setDialog(null);
      setSaving(true);

      let resolvedOrganizationName =
        organizationName.trim();

      let resolvedCommercialRecord =
        organizationCommercialRecord.trim();

      if (
        printPartyType === "organization" &&
        !resolvedOrganizationName
      ) {
        const organizationSettings =
          await getOrganizationSettings();

        resolvedOrganizationName = String(
          organizationSettings.name || ""
        ).trim();

        resolvedCommercialRecord = String(
          organizationSettings.commercialRecord ||
            ""
        ).trim();

        setOrganizationName(
          resolvedOrganizationName
        );

        setOrganizationCommercialRecord(
          resolvedCommercialRecord
        );
      }

      const printPartyName =
        printPartyType === "organization"
          ? resolvedOrganizationName
          : selectedInvestor.investor_name;

      const printPartyIdentifier =
        printPartyType === "organization"
          ? resolvedCommercialRecord
          : selectedInvestor.national_id;

      if (!printPartyName?.trim()) {
        showError(
          "تعذر تحديد الطرف الأول",
          "لم يتم العثور على اسم المؤسسة المعتمد لهذا الفرع"
        );
        return;
      }

      const { data, error } = await supabase.rpc(
        "update_finance_contract_atomic",
        {
          p_branch_id: branchId,
          p_contract_id: contractId,

          p_employee_id: employeeId,
          p_employee_name:
            employeeName || "الموظف",

          p_investor_id: investorId,
          p_investor_name:
            selectedInvestor.investor_name,

          p_product_id: productId,
          p_product_name:
            selectedProduct.product_name,

          p_product_quantity: newQuantity,

          p_print_party_type: printPartyType,
          p_print_party_name: printPartyName,
          p_print_party_identifier:
            printPartyIdentifier || null,

          p_debt_amount: debt,
          p_payment_amount: payment,
          p_installment_amount: installment,

          p_payment_type: paymentType,
          p_payment_due_date: paymentDueDate,

          p_legal_city: legalCity.trim(),
          p_notes: notes.trim() || null,
        }
      );

      if (error) {
        throw new Error(
          getRpcErrorMessage(error.message)
        );
      }

      const rawResult = Array.isArray(data)
        ? data[0]
        : data;

      const result =
        rawResult as UpdateContractResult | null;

      if (!result?.contract_id) {
        throw new Error(
          "لم يتم استلام نتيجة تعديل العقد"
        );
      }

      showDialog({
        tone: "success",
        title: "تم حفظ التعديل",
        message:
          "تم تحديث بيانات العقد والمخزون بنجاح.",
        confirmText: "العودة إلى تفاصيل العقد",
        action: "open-contract",
      });
    } catch (error) {
      console.error(
        "Save contract error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء تعديل العقد";

      showError(
        "تعذر حفظ التعديل",
        getRpcErrorMessage(message)
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDialogConfirm() {
    const action = dialog?.action || null;

    if (action === "continue-save") {
      setDialog(null);
      void saveContract(true);
      return;
    }

    if (action === "open-contract") {
      setDialog(null);
      router.push(
        `/finance/${branch}/contracts/${contractId}`
      );
      return;
    }

    setDialog(null);
  }

  function renderHero() {
    return (
      <header style={getHeroStyle(isMobile)}>
        <div style={heroCircleOne} />
        <div style={heroCircleTwo} />
        <div style={heroCircleThree} />
        <div style={heroDots} />

        <div style={getHeroContentStyle(screen)}>
          <div style={getHeroUserCardStyle(screen)}>
            <div
              style={getEmployeeTopRowStyle(screen)}
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
                  style={employeeDividerSmall}
                />
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
            style={getHeroTitleBoxStyle(screen)}
          >
            <h1 style={getTitleStyle(screen)}>
              تعديل العقد
            </h1>
          </div>

          <div
            style={getHeroActionBoxStyle(screen)}
          />
        </div>
      </header>
    );
  }

  const enteredProductQuantity = toNumber(
    productQuantity
  );

  const hasValidEnteredQuantity =
    Number.isFinite(enteredProductQuantity) &&
    enteredProductQuantity > 0;

  const currentInventoryImpact =
    inventoryQuantity !== null &&
    hasValidEnteredQuantity
      ? calculateInventoryImpact(
          inventoryQuantity,
          enteredProductQuantity
        )
      : null;

  const organizationOptionLabel =
    organizationName.trim() ||
    "اسم المؤسسة غير محدد";

  if (!authChecked) {
    return null;
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(isMobile)}
      >
        <div
          style={getContainerStyle(isCompact)}
        >
          {renderHero()}

          <div style={loadingBox}>
            جاري تحميل العقد...
          </div>
        </div>
      </main>
    );
  }

  if (pageError || !contract) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(isMobile)}
      >
        <div
          style={getContainerStyle(isCompact)}
        >
          {renderHero()}

          <div style={errorBox}>
            {pageError ||
              "لم يتم العثور على العقد"}
          </div>

          <div style={backWrapper}>
            <button
              type="button"
              style={backButton}
              onClick={() => router.back()}
            >
              ← رجوع
            </button>
          </div>
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
        style={getContainerStyle(isCompact)}
      >
        {renderHero()}

        <section style={card}>
          <h2 style={sectionTitle}>
            المخزون والطرف الأول
          </h2>

          <label style={fieldLabel}>
            المستثمر المرتبط بالمخزون
          </label>

          <select
            style={input}
            value={investorId}
            disabled={saving}
            onChange={(event) =>
              setInvestorId(event.target.value)
            }
          >
            <option value="">
              اختر المستثمر
            </option>

            {investors.map((investor) => (
              <option
                key={investor.id}
                value={investor.id}
              >
                {investor.investor_name}
              </option>
            ))}
          </select>

          <label style={fieldLabel}>
            المنتج
          </label>

          <select
            style={input}
            value={productId}
            disabled={saving}
            onChange={(event) =>
              setProductId(event.target.value)
            }
          >
            <option value="">
              اختر المنتج
            </option>

            {products.map((product) => (
              <option
                key={product.id}
                value={product.id}
              >
                {product.product_name}
              </option>
            ))}
          </select>

          <label style={fieldLabel}>
            كمية المنتجات
          </label>

          <input
            style={input}
            inputMode="numeric"
            placeholder="الكمية"
            value={productQuantity}
            disabled={saving}
            onChange={(event) =>
              setProductQuantity(
                normalizeNumber(
                  event.target.value
                )
              )
            }
          />

          {investorId && productId && (
            <div
              style={{
                ...inventorySummary,
                ...(currentInventoryImpact &&
                (currentInventoryImpact.selectedQuantityExceedsAvailable ||
                  currentInventoryImpact.projectedQuantity < 0)
                  ? inventorySummaryWarning
                  : {}),
              }}
            >
              {inventoryLoading ? (
                <div style={inventorySummaryMessage}>
                  جاري قراءة كمية المخزون...
                </div>
              ) : inventoryError ? (
                <div style={inventorySummaryError}>
                  {inventoryError}
                </div>
              ) : inventoryQuantity !== null ? (
                <>
                  <div style={inventorySummaryHeader}>
                    <span style={inventorySummaryTitle}>
                      كمية المخزون الحالية
                    </span>

                    {!inventoryExists && (
                      <span style={inventoryNewBadge}>
                        لا يوجد سجل سابق
                      </span>
                    )}
                  </div>

                  <div style={inventoryStatsGrid}>
                    <div style={inventoryStatBox}>
                      <span style={inventoryStatLabel}>
                        المتوفر الآن
                      </span>

                      <strong style={inventoryStatValue}>
                        {formatQuantity(
                          inventoryQuantity
                        )}
                      </strong>
                    </div>

                    <div style={inventoryStatBox}>
                      <span style={inventoryStatLabel}>
                        {currentInventoryImpact?.sameInventory
                          ? "المطلوب بسبب التعديل"
                          : "المطلوب من المخزون"}
                      </span>

                      <strong style={inventoryStatValue}>
                        {formatQuantity(
                          currentInventoryImpact
                            ?.requiredFromInventory || 0
                        )}
                      </strong>
                    </div>

                    <div style={inventoryStatBox}>
                      <span style={inventoryStatLabel}>
                        الرصيد بعد التعديل
                      </span>

                      <strong
                        style={{
                          ...inventoryStatValue,
                          ...(currentInventoryImpact &&
                          currentInventoryImpact.projectedQuantity < 0
                            ? inventoryNegativeValue
                            : {}),
                        }}
                      >
                        {currentInventoryImpact
                          ? formatQuantity(
                              currentInventoryImpact.projectedQuantity
                            )
                          : "-"}
                      </strong>
                    </div>
                  </div>

                  {currentInventoryImpact &&
                    (currentInventoryImpact.selectedQuantityExceedsAvailable ||
                      currentInventoryImpact.projectedQuantity < 0) && (
                      <div style={inventoryInlineWarning}>
                        {currentInventoryImpact.projectedQuantity < 0 ? (
                          <>
                            الكمية تتجاوز المتوفر، وسيصبح الرصيد بالسالب بمقدار {" "}
                            <strong>
                              {formatQuantity(
                                currentInventoryImpact.shortage
                              )}
                            </strong>{" "}
                            وحدة. سيُسمح بالحفظ بعد التنبيه.
                          </>
                        ) : (
                          <>
                            الكمية المحددة أكبر من المتوفر الحالي، لكن المطلوب فعليًا بسبب التعديل هو {" "}
                            <strong>
                              {formatQuantity(
                                currentInventoryImpact.requiredFromInventory
                              )}
                            </strong>{" "}
                            وحدة، ولن يصبح الرصيد بالسالب.
                          </>
                        )}
                      </div>
                    )}
                </>
              ) : (
                <div style={inventorySummaryMessage}>
                  اختر المستثمر والمنتج لعرض المخزون
                </div>
              )}
            </div>
          )}

          <label style={fieldLabel}>
            الطرف الأول في الطباعة
          </label>

          <select
            style={input}
            value={printPartyType}
            disabled={saving}
            onChange={(event) =>
              setPrintPartyType(
                event.target.value
              )
            }
          >
            <option value="organization">
              {organizationOptionLabel}
            </option>

            <option value="investor">
              المستثمر
            </option>
          </select>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            بيانات العقد
          </h2>

          <label style={fieldLabel}>
            مبلغ الدين
          </label>

          <input
            style={input}
            inputMode="numeric"
            placeholder="مبلغ الدين"
            value={debtAmount}
            disabled={saving}
            onChange={(event) =>
              setDebtAmount(
                normalizeNumber(
                  event.target.value
                )
              )
            }
          />

          <label style={fieldLabel}>
            مبلغ السداد
          </label>

          <input
            style={input}
            inputMode="numeric"
            placeholder="مبلغ السداد"
            value={paymentAmount}
            disabled={saving}
            onChange={(event) =>
              setPaymentAmount(
                normalizeNumber(
                  event.target.value
                )
              )
            }
          />

          <label style={fieldLabel}>
            قيمة القسط
          </label>

          <input
            style={input}
            inputMode="numeric"
            placeholder="القسط"
            value={installmentAmount}
            disabled={saving}
            onChange={(event) =>
              setInstallmentAmount(
                normalizeNumber(
                  event.target.value
                )
              )
            }
          />

          <label style={fieldLabel}>
            نوع السداد
          </label>

          <select
            style={input}
            value={paymentType}
            disabled={saving}
            onChange={(event) =>
              setPaymentType(
                event.target.value
              )
            }
          >
            <option value="">
              اختر نوع السداد
            </option>

            <option value="موعد محدد">
              موعد محدد
            </option>

            <option value="شهري مجدول">
              شهري مجدول
            </option>
          </select>

          <label style={fieldLabel}>
            تاريخ الاستحقاق
          </label>

          <input
            style={input}
            type="date"
            value={paymentDueDate}
            disabled={saving}
            onChange={(event) =>
              setPaymentDueDate(
                event.target.value
              )
            }
          />

          <label style={fieldLabel}>
            مدينة التقاضي
          </label>

          <input
            style={input}
            placeholder="مدينة التقاضي"
            value={legalCity}
            disabled={saving}
            onChange={(event) =>
              setLegalCity(event.target.value)
            }
          />

          <label style={fieldLabel}>
            الملاحظات
          </label>

          <textarea
            style={textarea}
            placeholder="ملاحظات"
            value={notes}
            disabled={saving}
            onChange={(event) =>
              setNotes(event.target.value)
            }
          />

          <button
            type="button"
            style={{
              ...saveButton,
              opacity: saving ? 0.7 : 1,
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
            onClick={() =>
              void saveContract()
            }
            disabled={saving}
          >
            {saving
              ? "جاري الحفظ..."
              : "حفظ التعديلات"}
          </button>
        </section>

        <div style={backWrapper}>
          <button
            type="button"
            style={backButton}
            onClick={() => router.back()}
          >
            ← رجوع
          </button>
        </div>
      </div>

      {dialog && (
        <ProjectDialog
          dialog={dialog}
          busy={saving}
          onConfirm={handleDialogConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
    </main>
  );
}

function ProjectDialog({
  dialog,
  busy,
  onConfirm,
  onCancel,
}: {
  dialog: DialogState;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const toneStyles = getDialogToneStyles(
    dialog.tone
  );

  const canCancel = Boolean(
    dialog.cancelText
  );

  return (
    <div
      style={dialogOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          canCancel &&
          !busy
        ) {
          onCancel();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        style={dialogCard}
      >
        <div
          style={{
            ...dialogIcon,
            background: toneStyles.iconBackground,
            color: toneStyles.iconColor,
          }}
        >
          {dialog.tone === "success"
            ? "✓"
            : dialog.tone === "warning"
              ? "!"
              : dialog.tone === "error"
                ? "×"
                : "i"}
        </div>

        <div style={dialogBody}>
          <h2
            id="project-dialog-title"
            style={dialogTitle}
          >
            {dialog.title}
          </h2>

          <p style={dialogMessage}>
            {dialog.message}
          </p>

          {dialog.details &&
            dialog.details.length > 0 && (
              <div style={dialogDetailsGrid}>
                {dialog.details.map((detail) => (
                  <div
                    key={detail.label}
                    style={{
                      ...dialogDetailItem,
                      ...(detail.highlight
                        ? dialogDetailHighlight
                        : {}),
                    }}
                  >
                    <span style={dialogDetailLabel}>
                      {detail.label}
                    </span>

                    <strong style={dialogDetailValue}>
                      {detail.value}
                    </strong>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div style={dialogActions}>
          {dialog.cancelText && (
            <button
              type="button"
              style={dialogCancelButton}
              onClick={onCancel}
              disabled={busy}
            >
              {dialog.cancelText}
            </button>
          )}

          <button
            type="button"
            style={{
              ...dialogConfirmButton,
              background: toneStyles.buttonBackground,
            }}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy
              ? "جاري التنفيذ..."
              : dialog.confirmText || "حسنًا"}
          </button>
        </div>
      </section>
    </div>
  );
}

function getDialogToneStyles(
  tone: DialogTone
) {
  if (tone === "success") {
    return {
      iconBackground: "#dcfce7",
      iconColor: "#15803d",
      buttonBackground:
        "linear-gradient(135deg,#22c55e,#15803d)",
    };
  }

  if (tone === "warning") {
    return {
      iconBackground: "#ffedd5",
      iconColor: "#c2410c",
      buttonBackground:
        "linear-gradient(135deg,#f97316,#c2410c)",
    };
  }

  if (tone === "error") {
    return {
      iconBackground: "#fee2e2",
      iconColor: "#b91c1c",
      buttonBackground:
        "linear-gradient(135deg,#ef4444,#b91c1c)",
    };
  }

  return {
    iconBackground: "#dbeafe",
    iconColor: "#1d4ed8",
    buttonBackground:
      "linear-gradient(135deg,#2563eb,#1d4ed8)",
  };
}

function formatQuantity(
  value: number
) {
  return Number(value || 0).toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 3,
    }
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
    maxWidth: isCompact ? 980 : 1180,
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
    pointerEvents: "none",
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
        ? 26
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
  if (
    screen === "mobile" ||
    screen === "tablet"
  ) {
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
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const sectionTitle: CSSProperties = {
  marginTop: 0,
  color: "#0d47a1",
  fontSize: 22,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const fieldLabel: CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
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
  fontFamily:
    "var(--font-almarai), sans-serif",
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
  fontFamily:
    "var(--font-almarai), sans-serif",
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
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const inventorySummary: CSSProperties = {
  margin: "2px 0 16px",
  padding: 16,
  border: "1px solid #bfdbfe",
  borderRadius: 16,
  background:
    "linear-gradient(135deg,#f8fbff,#eff6ff)",
  boxShadow:
    "0 8px 18px rgba(37,99,235,0.06)",
};

const inventorySummaryWarning: CSSProperties = {
  border: "1px solid #fdba74",
  background:
    "linear-gradient(135deg,#fffaf5,#fff7ed)",
};

const inventorySummaryHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
};

const inventorySummaryTitle: CSSProperties = {
  color: "#0d47a1",
  fontSize: 15,
  fontWeight: 900,
};

const inventoryNewBadge: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#e2e8f0",
  color: "#475569",
  fontSize: 11,
  fontWeight: 900,
};

const inventoryStatsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: 10,
};

const inventoryStatBox: CSSProperties = {
  minHeight: 76,
  padding: 12,
  border: "1px solid rgba(148,163,184,0.24)",
  borderRadius: 13,
  background: "rgba(255,255,255,0.84)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 7,
};

const inventoryStatLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const inventoryStatValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 21,
  fontWeight: 900,
};

const inventoryNegativeValue: CSSProperties = {
  color: "#b91c1c",
};

const inventoryInlineWarning: CSSProperties = {
  marginTop: 12,
  padding: "11px 12px",
  borderRadius: 12,
  background: "#ffedd5",
  color: "#9a3412",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.8,
};

const inventorySummaryMessage: CSSProperties = {
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
  textAlign: "center",
};

const inventorySummaryError: CSSProperties = {
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 900,
  textAlign: "center",
};

const dialogOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  padding: 16,
  background: "rgba(15,23,42,0.58)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dialogCard: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  padding: 22,
  border: "1px solid rgba(255,255,255,0.88)",
  borderRadius: 22,
  background:
    "linear-gradient(180deg,#ffffff,#f8fafc)",
  boxShadow:
    "0 28px 70px rgba(15,23,42,0.28)",
  fontFamily:
    "var(--font-almarai), sans-serif",
  direction: "rtl",
};

const dialogIcon: CSSProperties = {
  width: 54,
  height: 54,
  margin: "0 auto 14px",
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 29,
  fontWeight: 900,
};

const dialogBody: CSSProperties = {
  textAlign: "center",
};

const dialogTitle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 21,
  lineHeight: 1.5,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const dialogMessage: CSSProperties = {
  margin: "9px 0 0",
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.9,
  fontWeight: 700,
};

const dialogDetailsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",
  gap: 9,
  marginTop: 17,
};

const dialogDetailItem: CSSProperties = {
  padding: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 13,
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  textAlign: "right",
};

const dialogDetailHighlight: CSSProperties = {
  border: "1px solid #fed7aa",
  background: "#fff7ed",
};

const dialogDetailLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
};

const dialogDetailValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 900,
};

const dialogActions: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: 10,
  marginTop: 20,
};

const dialogConfirmButton: CSSProperties = {
  minHeight: 46,
  padding: "11px 16px",
  border: "none",
  borderRadius: 13,
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  boxShadow:
    "0 8px 18px rgba(15,23,42,0.12)",
};

const dialogCancelButton: CSSProperties = {
  minHeight: 46,
  padding: "11px 16px",
  border: "1px solid #cbd5e1",
  borderRadius: 13,
  background: "#ffffff",
  color: "#334155",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const loadingBox: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  textAlign: "center",
  color: "#0d47a1",
  fontWeight: 900,
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const errorBox: CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 18,
  padding: 20,
  textAlign: "center",
  color: "#9a3412",
  fontWeight: 900,
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
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
