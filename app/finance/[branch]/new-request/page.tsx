"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  useParams,
  usePathname,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import {
  normalizeNumber,
  toNumber,
} from "@/lib/numberUtils";

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type FinanceUser = {
  id?: string | null;
  user_id?: string | null;
  branch_id?: string | null;
  branch_slug?: string | null;
  full_name?: string | null;
  username?: string | null;
  role?: string | null;
  roles?: unknown;
  permissions?: unknown;
  investor_id?: string | null;
  is_active?: boolean | null;
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
  unit_price?: number | string | null;
  is_active?: boolean | null;
};

type NewRequestApiResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  contractId?: string | null;
  noteId?: string | null;
  customerId?: string | null;
  contractNumber?: string | number | null;
  noteNumber?: string | number | null;
};

type CustomerLookupStatus =
  | "idle"
  | "searching"
  | "found"
  | "not_found"
  | "error";

type CustomerLookupApiResponse = {
  ok?: boolean;
  found?: boolean;
  message?: string;
  code?: string;
  customer?: {
    id?: string | null;
    fullName?: string | null;
    nationalId?: string | null;
    birthHijri?: string | null;
    phone?: string | null;
    workName?: string | null;
    address?: string | null;
  } | null;
};

type DropdownRect = {
  top: number;
  left: number;
  width: number;
};

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type ContractType =
  | ""
  | "عقد بيع"
  | "عقد تقسيط";

const SESSION_DURATION_MS =
  60 * 60 * 1000;

const ACTIVITY_REFRESH_INTERVAL_MS =
  60 * 1000;

const CUSTOMER_LOOKUP_DEBOUNCE_MS =
  300;

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
  "finance_session_expires_at",
  "finance_last_activity_at",
  "finance_return_to",
] as const;

export default function NewRequestPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const branch = String(
    params.branch ?? ""
  ).trim();

  const today = getTodayDate();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [pageReady, setPageReady] =
    useState(false);

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [listsLoading, setListsLoading] =
    useState(true);

  const [listsError, setListsError] =
    useState("");

  const [investors, setInvestors] =
    useState<Investor[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [fullName, setFullName] =
    useState("");

  const [nationalId, setNationalId] =
    useState("");

  const [
    customerLookupStatus,
    setCustomerLookupStatus,
  ] = useState<CustomerLookupStatus>(
    "idle"
  );

  const [
    customerLookupMessage,
    setCustomerLookupMessage,
  ] = useState("");

  const customerLookupRequestRef =
    useRef(0);

  const [birthDay, setBirthDay] =
    useState("");

  const [birthMonth, setBirthMonth] =
    useState("");

  const [birthYear, setBirthYear] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [workName, setWorkName] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [contractType, setContractType] =
    useState<ContractType>("");

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
    stockLoading,
    setStockLoading,
  ] = useState(false);

  const [
    printPartyType,
    setPrintPartyType,
  ] = useState<
    "organization" | "investor"
  >("organization");

  const [debtAmount, setDebtAmount] =
    useState("");

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState("");

  const [
    installmentAmount,
    setInstallmentAmount,
  ] = useState("");

  const [
    deferredPaymentsCount,
    setDeferredPaymentsCount,
  ] = useState("");

  const [
    paymentDueDate,
    setPaymentDueDate,
  ] = useState("");

  const [
    contractIssueDate,
    setContractIssueDate,
  ] = useState(today);

  const [
    hasGuarantor,
    setHasGuarantor,
  ] = useState(false);

  const [
    guarantorName,
    setGuarantorName,
  ] = useState("");

  const [
    guarantorNationalId,
    setGuarantorNationalId,
  ] = useState("");

  const [
    guarantorPhone,
    setGuarantorPhone,
  ] = useState("");

  const [
    guarantorBirthDay,
    setGuarantorBirthDay,
  ] = useState("");

  const [
    guarantorBirthMonth,
    setGuarantorBirthMonth,
  ] = useState("");

  const [
    guarantorBirthYear,
    setGuarantorBirthYear,
  ] = useState("");

  const [legalCity, setLegalCity] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const isMobile =
    screen === "mobile";

  const isTablet =
    screen === "tablet";

  const isCompact =
    isMobile || isTablet;

  const isInstallmentContract =
    contractType === "عقد تقسيط";

  const investorOptions:
    SelectOption[] =
    investors.map(
      (investor) => ({
        value: investor.id,
        label:
          investor.investor_name,
      })
    );

  const productOptions:
    SelectOption[] =
    products.map((product) => ({
      value: product.id,
      label: product.product_name,
    }));

  const clearCustomerDetails =
    useCallback(() => {
      setFullName("");
      setBirthDay("");
      setBirthMonth("");
      setBirthYear("");
      setPhone("");
      setWorkName("");
      setAddress("");
    }, []);

  useEffect(() => {
    const selectedProduct =
      products.find(
        (product) =>
          product.id === productId
      );

    const quantity =
      toNumber(productQuantity);

    const unitPrice =
      Number(
        selectedProduct?.unit_price ??
          0
      );

    if (
      !selectedProduct ||
      quantity <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice <= 0
    ) {
      return;
    }

    const calculatedAmount =
      Math.round(
        quantity *
          unitPrice *
          100
      ) / 100;

    setDebtAmount(
      String(calculatedAmount)
    );
  }, [
    productId,
    productQuantity,
    products,
  ]);

  useEffect(() => {
    const cleanNationalId =
      normalizeNumber(nationalId).slice(
        0,
        10
      );

    if (
      !contractType ||
      cleanNationalId.length !== 10
    ) {
      setCustomerLookupStatus(
        "idle"
      );
      setCustomerLookupMessage("");
      return;
    }

    const requestId =
      customerLookupRequestRef.current +
      1;

    customerLookupRequestRef.current =
      requestId;

    const controller =
      new AbortController();

    const timer = window.setTimeout(
      async () => {
        setCustomerLookupStatus(
          "searching"
        );
        setCustomerLookupMessage(
          "جاري البحث عن العميل داخل الفرع..."
        );

        try {
          const response = await fetch(
            `/api/finance/customers?branchSlug=${encodeURIComponent(
              branch
            )}&nationalId=${encodeURIComponent(
              cleanNationalId
            )}`,
            {
              method: "GET",
              credentials:
                "same-origin",
              cache: "no-store",
              signal:
                controller.signal,
            }
          );

          let result:
            CustomerLookupApiResponse =
            {};

          try {
            result =
              (await response.json()) as
                CustomerLookupApiResponse;
          } catch {
            result = {};
          }

          if (
            controller.signal.aborted ||
            requestId !==
              customerLookupRequestRef.current
          ) {
            return;
          }

          if (
            response.status === 401 ||
            result.code ===
              "INVALID_SESSION"
          ) {
            redirectToLogin(true);
            return;
          }

          if (
            !response.ok ||
            result.ok !== true
          ) {
            throw new Error(
              result.message ||
                "تعذر البحث عن بيانات العميل"
            );
          }

          if (
            result.found !== true ||
            !result.customer
          ) {
            clearCustomerDetails();
            setCustomerLookupStatus(
              "not_found"
            );
            setCustomerLookupMessage(
              "رقم الهوية غير مسجل في هذا الفرع. أكمل بيانات العميل الجديد."
            );
            return;
          }

          const birthParts =
            parseHijriDateParts(
              String(
                result.customer
                  .birthHijri || ""
              )
            );

          setFullName(
            String(
              result.customer.fullName ||
                ""
            ).trim()
          );

          setPhone(
            normalizeNumber(
              String(
                result.customer.phone ||
                  ""
              )
            ).slice(0, 10)
          );

          setWorkName(
            String(
              result.customer.workName ||
                ""
            ).trim()
          );

          setAddress(
            String(
              result.customer.address ||
                ""
            ).trim()
          );

          setBirthYear(
            birthParts?.year || ""
          );
          setBirthMonth(
            birthParts?.month || ""
          );
          setBirthDay(
            birthParts?.day || ""
          );

          setCustomerLookupStatus(
            "found"
          );
          setCustomerLookupMessage("");
        } catch (error) {
          if (
            controller.signal.aborted ||
            (
              error instanceof
                DOMException &&
              error.name ===
                "AbortError"
            )
          ) {
            return;
          }

          console.error(
            "Customer lookup error:",
            error
          );

          if (
            requestId !==
            customerLookupRequestRef.current
          ) {
            return;
          }

          setCustomerLookupStatus(
            "error"
          );
          setCustomerLookupMessage(
            getErrorMessage(
              error,
              "تعذر البحث عن بيانات العميل"
            )
          );
        }
      },
      CUSTOMER_LOOKUP_DEBOUNCE_MS
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    branch,
    clearCustomerDetails,
    contractType,
    nationalId,
  ]);

  useEffect(() => {
    function updateScreen() {
      const width =
        window.innerWidth;

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

  const loadLists = useCallback(
    async (
      currentBranchId: string,
      isCancelled: () => boolean =
        () => false
    ) => {
      if (!currentBranchId) {
        return;
      }

      setListsLoading(true);
      setListsError("");

      try {
        const [
          investorsResult,
          productsResult,
        ] = await Promise.all([
          supabase
            .from(
              "finance_investors"
            )
            .select(
              "id, investor_name, national_id, is_active"
            )
            .eq(
              "branch_id",
              currentBranchId
            )
            .eq(
              "is_active",
              true
            )
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from(
              "finance_products"
            )
            .select(
              "id, product_name, unit_price, is_active"
            )
            .eq(
              "branch_id",
              currentBranchId
            )
            .eq(
              "is_active",
              true
            )
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (isCancelled()) {
          return;
        }

        const errors: string[] =
          [];

        if (
          investorsResult.error
        ) {
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
              []) as Investor[]
          );
        }

        if (
          productsResult.error
        ) {
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
              []) as Product[]
          );
        }

        if (errors.length > 0) {
          setListsError(
            errors.join("، ")
          );
        }
      } catch (error: unknown) {
        if (isCancelled()) {
          return;
        }

        console.error(
          "Lists loading error:",
          error
        );

        setListsError(
          getErrorMessage(
            error,
            "تعذر تحميل المستثمرين والمنتجات"
          )
        );
      } finally {
        if (!isCancelled()) {
          setListsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function initializePage() {
      if (
        typeof window ===
        "undefined"
      ) {
        return;
      }

      if (!branch) {
        redirectToLogin(true);
        return;
      }

      const localUser =
        getLocalUser();

      if (
        !isValidSession(localUser)
      ) {
        redirectToLogin(true);
        return;
      }

      const storedBranchSlug =
        String(
          localUser?.branch_slug ||
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

      const currentEmployeeName =
        localUser?.full_name ||
        localUser?.username ||
        localStorage.getItem(
          "finance_user_name"
        ) ||
        "الموظف";

      setEmployeeName(
        currentEmployeeName
      );

      renewFinanceSession();
      setPageReady(true);

      const storedBranchId =
        String(
          localUser?.branch_id ||
            localStorage.getItem(
              "finance_branch_id"
            ) ||
            ""
        ).trim();

      let resolvedBranchId =
        storedBranchId;

      if (!resolvedBranchId) {
        try {
          const fetchedBranchId =
            await getBranchId(
              branch
            );

          if (cancelled) {
            return;
          }

          if (!fetchedBranchId) {
            setListsError(
              "تعذر تحديد الفرع"
            );

            setListsLoading(false);
            return;
          }

          resolvedBranchId =
            String(fetchedBranchId);

          localStorage.setItem(
            "finance_branch_id",
            resolvedBranchId
          );

          localStorage.setItem(
            "finance_branch_slug",
            branch
          );
        } catch (
          error: unknown
        ) {
          if (cancelled) {
            return;
          }

          setListsError(
            getErrorMessage(
              error,
              "تعذر تحديد الفرع"
            )
          );

          setListsLoading(false);
          return;
        }
      }

      if (cancelled) {
        return;
      }

      setBranchId(
        resolvedBranchId
      );

      await loadLists(
        resolvedBranchId,
        () => cancelled
      );
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [
    branch,
    loadLists,
    router,
  ]);

  useEffect(() => {
    if (
      !pageReady ||
      typeof window ===
        "undefined"
    ) {
      return;
    }

    let lastRefresh = 0;

    function handleActivity() {
      const now = Date.now();

      if (
        now - lastRefresh <
        ACTIVITY_REFRESH_INTERVAL_MS
      ) {
        return;
      }

      lastRefresh = now;
      renewFinanceSession();
    }

    const events:
      Array<keyof WindowEventMap> =
      [
        "pointerdown",
        "keydown",
        "scroll",
        "touchstart",
      ];

    events.forEach(
      (eventName) => {
        window.addEventListener(
          eventName,
          handleActivity,
          { passive: true }
        );
      }
    );

    const timer =
      window.setInterval(() => {
        const expiresAt =
          Number(
            localStorage.getItem(
              "finance_session_expires_at"
            ) || 0
          );

        if (
          expiresAt > 0 &&
          Date.now() >=
            expiresAt
        ) {
          redirectToLogin(true);
        }
      }, 30 * 1000);

    return () => {
      events.forEach(
        (eventName) => {
          window.removeEventListener(
            eventName,
            handleActivity
          );
        }
      );

      window.clearInterval(
        timer
      );
    };
  }, [pageReady, pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailableStock() {
      if (
        !branchId ||
        !investorId ||
        !productId
      ) {
        setAvailableStock(null);
        setStockLoading(false);
        return;
      }

      try {
        setStockLoading(true);

        const {
          data,
          error,
        } = await supabase
          .from(
            "finance_inventory"
          )
          .select("quantity")
          .eq(
            "branch_id",
            branchId
          )
          .eq(
            "investor_id",
            investorId
          )
          .eq(
            "product_id",
            productId
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

        setAvailableStock(
          data
            ? Number(
                data.quantity || 0
              )
            : 0
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Inventory loading error:",
          error
        );

        setAvailableStock(null);
      } finally {
        if (!cancelled) {
          setStockLoading(false);
        }
      }
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

  function renewFinanceSession() {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    const now = Date.now();

    localStorage.setItem(
      "finance_last_activity_at",
      String(now)
    );

    localStorage.setItem(
      "finance_session_expires_at",
      String(
        now +
          SESSION_DURATION_MS
      )
    );
  }

  function getLocalUser():
    | FinanceUser
    | null {
    if (
      typeof window ===
      "undefined"
    ) {
      return null;
    }

    const savedUser =
      localStorage.getItem(
        "finance_branch_user"
      ) ||
      localStorage.getItem(
        "finance_user"
      );

    if (savedUser) {
      try {
        const parsed =
          JSON.parse(
            savedUser
          ) as FinanceUser;

        if (
          parsed &&
          typeof parsed ===
            "object" &&
          !Array.isArray(parsed)
        ) {
          return {
            ...parsed,

            id:
              parsed.id ||
              parsed.user_id ||
              localStorage.getItem(
                "finance_user_id"
              ),

            branch_id:
              parsed.branch_id ||
              localStorage.getItem(
                "finance_branch_id"
              ),

            branch_slug:
              parsed.branch_slug ||
              localStorage.getItem(
                "finance_branch_slug"
              ),

            full_name:
              parsed.full_name ||
              localStorage.getItem(
                "finance_user_name"
              ),

            username:
              parsed.username ||
              localStorage.getItem(
                "finance_username"
              ),
          };
        }
      } catch {
        // الانتقال للمفاتيح المنفردة.
      }
    }

    const savedBranchId =
      localStorage.getItem(
        "finance_branch_id"
      );

    const savedBranchSlug =
      localStorage.getItem(
        "finance_branch_slug"
      );

    const savedUserId =
      localStorage.getItem(
        "finance_user_id"
      );

    if (
      !savedBranchSlug ||
      !savedUserId
    ) {
      return null;
    }

    return {
      id: savedUserId,
      branch_id:
        savedBranchId,
      branch_slug:
        savedBranchSlug,
      full_name:
        localStorage.getItem(
          "finance_user_name"
        ) || "الموظف",
      username:
        localStorage.getItem(
          "finance_username"
        ) || "",
      role:
        localStorage.getItem(
          "finance_role"
        ) || "",
      permissions: [],
      is_active:
        localStorage.getItem(
          "finance_is_active"
        ) !== "false",
    };
  }

  function isValidSession(
    user: FinanceUser | null
  ) {
    if (!user) {
      return false;
    }

    const userId = String(
      user.id ||
        user.user_id ||
        ""
    ).trim();

    const userBranchSlug =
      String(
        user.branch_slug || ""
      ).trim();

    if (
      !userId ||
      !userBranchSlug
    ) {
      return false;
    }

    if (
      user.is_active === false
    ) {
      return false;
    }

    const expiresAt = Number(
      localStorage.getItem(
        "finance_session_expires_at"
      ) || 0
    );

    if (
      expiresAt > 0 &&
      Date.now() >= expiresAt
    ) {
      return false;
    }

    return true;
  }

  function getCurrentReturnPath() {
    if (
      typeof window ===
      "undefined"
    ) {
      return (
        pathname ||
        `/finance/${branch}/new-request`
      );
    }

    return `${window.location.pathname}${window.location.search}`;
  }

  function isSafeReturnPath(
    value: string
  ) {
    if (
      !value.startsWith(
        `/finance/${branch}`
      )
    ) {
      return false;
    }

    if (
      value.startsWith("//") ||
      value.includes("://")
    ) {
      return false;
    }

    return true;
  }

  function clearFinanceSession({
    preserveReturnPath = false,
  }: {
    preserveReturnPath?: boolean;
  } = {}) {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    SESSION_KEYS.forEach(
      (key) => {
        if (
          preserveReturnPath &&
          key ===
            "finance_return_to"
        ) {
          return;
        }

        localStorage.removeItem(
          key
        );
      }
    );
  }

  function redirectToLogin(
    preserveReturnPath = true
  ) {
    if (
      typeof window ===
      "undefined"
    ) {
      router.replace("/login");
      return;
    }

    const returnTo =
      getCurrentReturnPath();

    if (
      preserveReturnPath &&
      isSafeReturnPath(returnTo)
    ) {
      localStorage.setItem(
        "finance_return_to",
        returnTo
      );
    }

    clearFinanceSession({
      preserveReturnPath,
    });

    if (
      preserveReturnPath &&
      isSafeReturnPath(returnTo)
    ) {
      localStorage.setItem(
        "finance_return_to",
        returnTo
      );

      router.replace(
        `/login?returnTo=${encodeURIComponent(
          returnTo
        )}`
      );

      return;
    }

    router.replace("/login");
  }

  async function logout() {
    try {
      await fetch(
        "/api/finance/login",
        {
          method: "DELETE",
          credentials:
            "same-origin",
          cache: "no-store",
        }
      );
    } catch (error) {
      console.error(
        "Finance logout request failed:",
        error
      );
    } finally {
      clearFinanceSession({
        preserveReturnPath:
          false,
      });

      router.replace("/login");
    }
  }

  function retryLists() {
    if (!branchId) {
      setListsError(
        "تعذر تحديد الفرع"
      );

      return;
    }

    void loadLists(branchId);
  }

  function handleNationalIdChange(
    rawValue: string
  ) {
    const nextNationalId =
      normalizeNumber(rawValue).slice(
        0,
        10
      );

    if (
      nextNationalId !== nationalId
    ) {
      customerLookupRequestRef.current +=
        1;

      clearCustomerDetails();
      setCustomerLookupStatus(
        "idle"
      );
      setCustomerLookupMessage("");
    }

    setNationalId(nextNationalId);
  }

  function resetDeferredPaymentsFields() {
    setInstallmentAmount("");
    setDeferredPaymentsCount("");
  }

  function resetGuarantorFields() {
    setGuarantorName("");
    setGuarantorNationalId("");
    setGuarantorPhone("");
    setGuarantorBirthDay("");
    setGuarantorBirthMonth("");
    setGuarantorBirthYear("");
  }

  function validateRequest() {
    const qty =
      toNumber(productQuantity);

    const debt =
      toNumber(debtAmount);

    const payment =
      toNumber(paymentAmount);

    const deferredPayment =
      toNumber(
        installmentAmount
      );

    const deferredCount =
      toNumber(
        deferredPaymentsCount
      );

    const cleanNationalId =
      normalizeNumber(
        nationalId
      );

    const cleanPhone =
      normalizeNumber(phone);

    if (!branchId) {
      return "تعذر تحديد الفرع";
    }

    if (listsLoading) {
      return "انتظر حتى يكتمل تحميل المستثمرين والمنتجات";
    }

    if (!fullName.trim()) {
      return "يرجى إدخال اسم العميل";
    }

    if (
      cleanNationalId.length !==
      10
    ) {
      return "رقم الهوية يجب أن يكون 10 أرقام";
    }

    if (!birthDay) {
      return "يرجى إدخال يوم الميلاد";
    }

    if (!birthMonth) {
      return "يرجى إدخال شهر الميلاد";
    }

    if (!birthYear) {
      return "يرجى إدخال سنة الميلاد";
    }

    if (
      !/^05\d{8}$/.test(
        cleanPhone
      )
    ) {
      return "رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05";
    }

    if (
      contractType !== "عقد بيع" &&
      contractType !== "عقد تقسيط"
    ) {
      return "يرجى اختيار نوع العقد";
    }

    if (!investorId) {
      return "يرجى اختيار المستثمر المرتبط بالمخزون";
    }

    if (!productId) {
      return "يرجى اختيار المنتج";
    }

    if (qty <= 0) {
      return "يرجى إدخال كمية صحيحة";
    }

    if (debt <= 0) {
      return "يرجى إدخال قيمة بضاعة صحيحة";
    }

    if (payment <= 0) {
      return "يرجى إدخال مبلغ سداد صحيح";
    }

    if (isInstallmentContract) {
      if (
        deferredPayment <= 0
      ) {
        return "يرجى إدخال قيمة دفعة صحيحة";
      }

      if (deferredCount <= 0) {
        return "يرجى إدخال عدد دفعات صحيح";
      }

      if (
        !Number.isInteger(
          deferredCount
        )
      ) {
        return "عدد الدفعات يجب أن يكون رقمًا صحيحًا";
      }

      if (
        deferredCount > 1 &&
        deferredPayment *
          (deferredCount - 1) >=
          payment
      ) {
        return "قيمة الدفعة وعدد الدفعات لا يتوافقان مع مبلغ السداد";
      }
    }

    if (!paymentDueDate) {
      return "يرجى اختيار تاريخ الاستحقاق";
    }

    if (!contractIssueDate) {
      return "يرجى اختيار تاريخ تحرير العقد";
    }

    if (hasGuarantor) {
      const cleanGuarantorNationalId =
        normalizeNumber(
          guarantorNationalId
        );

      const cleanGuarantorPhone =
        normalizeNumber(
          guarantorPhone
        );

      if (
        !guarantorName.trim()
      ) {
        return "يرجى إدخال اسم الكفيل";
      }

      if (
        cleanGuarantorNationalId.length !==
        10
      ) {
        return "رقم هوية الكفيل يجب أن يكون 10 أرقام";
      }

      if (
        cleanGuarantorNationalId ===
        cleanNationalId
      ) {
        return "لا يمكن أن يكون العميل كفيلًا لنفسه";
      }

      if (
        !/^05\d{8}$/.test(
          cleanGuarantorPhone
        )
      ) {
        return "رقم جوال الكفيل يجب أن يكون 10 أرقام ويبدأ بـ 05";
      }

      if (
        !guarantorBirthDay
      ) {
        return "يرجى إدخال يوم ميلاد الكفيل";
      }

      if (
        !guarantorBirthMonth
      ) {
        return "يرجى إدخال شهر ميلاد الكفيل";
      }

      if (
        !guarantorBirthYear
      ) {
        return "يرجى إدخال سنة ميلاد الكفيل";
      }
    }

    return "";
  }

  async function sendNewRequestToApi(
    payload: Record<
      string,
      unknown
    >
  ): Promise<{
    response: Response;
    data: NewRequestApiResponse;
  }> {
    const response = await fetch(
      "/api/finance/new-request",
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          payload
        ),
      }
    );

    let data:
      NewRequestApiResponse = {};

    try {
      data =
        (await response.json()) as
          NewRequestApiResponse;
    } catch {
      data = {};
    }

    return {
      response,
      data,
    };
  }

  async function createRequest() {
    if (saving) {
      return;
    }

    const validationMessage =
      validateRequest();

    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    if (!branchId) {
      alert(
        "تعذر تحديد الفرع"
      );

      return;
    }

    const selectedInvestor =
      investors.find(
        (item) =>
          item.id === investorId
      );

    const selectedProduct =
      products.find(
        (item) =>
          item.id === productId
      );

    if (!selectedInvestor) {
      alert(
        "تعذر تحديد المستثمر"
      );

      return;
    }

    if (!selectedProduct) {
      alert(
        "تعذر تحديد المنتج"
      );

      return;
    }

    const cleanNationalId =
      normalizeNumber(
        nationalId
      );

    const cleanPhone =
      normalizeNumber(phone);

    const cleanGuarantorNationalId =
      normalizeNumber(
        guarantorNationalId
      );

    const cleanGuarantorPhone =
      normalizeNumber(
        guarantorPhone
      );

    const qty =
      toNumber(productQuantity);

    const debt =
      toNumber(debtAmount);

    const payment =
      toNumber(paymentAmount);

    const deferredPayment =
      isInstallmentContract
        ? toNumber(
            installmentAmount
          )
        : 0;

    const deferredCount =
      isInstallmentContract
        ? toNumber(
            deferredPaymentsCount
          )
        : 0;

    try {
      setSaving(true);
      renewFinanceSession();

      const birthHijri =
        `${birthYear}/${birthMonth.padStart(
          2,
          "0"
        )}/${birthDay.padStart(
          2,
          "0"
        )}`;

      const guarantorBirthHijri =
        hasGuarantor
          ? `${guarantorBirthYear}/${guarantorBirthMonth.padStart(
              2,
              "0"
            )}/${guarantorBirthDay.padStart(
              2,
              "0"
            )}`
          : "";

      const requestPayload = {
        fullName:
          fullName.trim(),

        nationalId:
          cleanNationalId,

        birthHijri,

        phone:
          cleanPhone,

        workName:
          workName.trim(),

        address:
          address.trim(),

        contractType,

        investorId:
          selectedInvestor.id,

        productId:
          selectedProduct.id,

        productQuantity:
          qty,

        printPartyType,

        debtAmount:
          debt,

        paymentAmount:
          payment,

        installmentAmount:
          isInstallmentContract
            ? deferredPayment
            : null,

        installmentsCount:
          isInstallmentContract
            ? deferredCount
            : 1,

        firstDueDate:
          paymentDueDate,

        contractIssueDate,

        contractIssueDateHijri:
          "",

        legalCity:
          legalCity.trim(),

        notes:
          notes.trim(),

        hasGuarantor,

        guarantorName:
          hasGuarantor
            ? guarantorName.trim()
            : "",

        guarantorNationalId:
          hasGuarantor
            ? cleanGuarantorNationalId
            : "",

        guarantorPhone:
          hasGuarantor
            ? cleanGuarantorPhone
            : "",

        guarantorBirthHijri,
      };

      let apiResult =
        await sendNewRequestToApi({
          ...requestPayload,
          allowNegativeInventory:
            false,
        });

      if (
        !apiResult.response.ok &&
        apiResult.data.code ===
          "NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED"
      ) {
        const stockText =
          availableStock === null
            ? ""
            : ` المتوفر حاليًا (${availableStock}) والكمية المطلوبة (${qty}).`;

        const confirmContinue =
          window.confirm(
            `الكمية المطلوبة أكبر من المخزون.${stockText} هل تريد الاستمرار والسماح بوصول المخزون إلى السالب؟`
          );

        if (!confirmContinue) {
          return;
        }

        apiResult =
          await sendNewRequestToApi({
            ...requestPayload,
            allowNegativeInventory:
              true,
          });
      }

      if (
        apiResult.response.status ===
          401 ||
        apiResult.data.code ===
          "INVALID_SESSION"
      ) {
        redirectToLogin(true);
        return;
      }

      if (
        !apiResult.response.ok ||
        apiResult.data.ok !== true
      ) {
        throw new Error(
          apiResult.data.message ||
            "تعذر إنشاء الطلب الجديد"
        );
      }

      if (
        !apiResult.data.contractId ||
        !apiResult.data.noteId
      ) {
        throw new Error(
          "تم إنشاء الطلب لكن لم يتم إرجاع بيانات العقد والسند للطباعة"
        );
      }

      alert(
        "تم إنشاء الطلب وخصم المخزون بنجاح"
      );

      router.push(
        `/finance/${branch}/new-request/print/${apiResult.data.contractId}/${apiResult.data.noteId}`
      );
    } catch (error: unknown) {
      console.error(
        "Create request error:",
        error
      );

      alert(
        getErrorMessage(
          error,
          "حدث خطأ أثناء إنشاء الطلب"
        )
      );
    } finally {
      setSaving(false);
    }
  }

  if (!pageReady) {
    return null;
  }

  return (
    <main
      dir="rtl"
      style={getPageStyle(
        isMobile
      )}
    >
      <div
        style={getContainerStyle(
          isCompact
        )}
      >
        <section
          style={getHeroStyle(
            isMobile
          )}
        >
          <div
            style={heroCircleOne}
          />

          <div
            style={heroCircleTwo}
          />

          <div
            style={heroCircleThree}
          />

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
                <div
                  style={employeeIcon}
                >
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
                طلب جديد
              </h1>
            </div>

            <div
              style={getHeroActionBoxStyle(
                screen
              )}
            >
              <div style={dateBox}>
                <span
                  style={
                    dateLabelStyle
                  }
                >
                  تاريخ اليوم
                </span>

                <strong
                  style={dateText}
                >
                  {formatDisplayDate(
                    today
                  )}
                </strong>
              </div>
            </div>
          </div>
        </section>

        {listsError && (
          <section
            style={inlineErrorCard}
          >
            <span>{listsError}</span>

            <button
              type="button"
              style={
                inlineRetryButton
              }
              onClick={retryLists}
            >
              إعادة المحاولة
            </button>
          </section>
        )}

        <section style={card}>
          <h2 style={sectionTitle}>
            نوع العقد
          </h2>

          <Field label="نوع العقد">
            <CustomSelect
              value={contractType}
              placeholder="اختر نوع العقد"
              options={[
                {
                  value: "عقد بيع",
                  label: "عقد بيع",
                },
                {
                  value: "عقد تقسيط",
                  label: "عقد تقسيط",
                },
              ]}
              onChange={(value) => {
                const nextContractType =
                  value as ContractType;

                setContractType(
                  nextContractType
                );

                if (
                  nextContractType !==
                  "عقد تقسيط"
                ) {
                  resetDeferredPaymentsFields();
                }
              }}
            />
          </Field>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            بيانات العميل
          </h2>

          <Field label="رقم الهوية">
            <input
              style={{
                ...input,
                ...(!contractType
                  ? disabledInput
                  : {}),
              }}
              inputMode="numeric"
              maxLength={10}
              autoComplete="off"
              placeholder={
                contractType
                  ? "أدخل رقم الهوية للبحث تلقائيًا"
                  : "اختر نوع العقد أولًا"
              }
              disabled={
                !contractType ||
                saving
              }
              value={nationalId}
              onChange={(event) =>
                handleNationalIdChange(
                  event.target.value
                )
              }
            />
          </Field>

          {customerLookupStatus !==
            "idle" &&
            customerLookupStatus !==
              "found" &&
            customerLookupMessage && (
            <div
              role={
                customerLookupStatus ===
                "error"
                  ? "alert"
                  : "status"
              }
              aria-live="polite"
              style={{
                ...customerLookupNotice,
                ...(customerLookupStatus ===
                "found"
                  ? customerLookupFound
                  : {}),
                ...(customerLookupStatus ===
                "not_found"
                  ? customerLookupNotFound
                  : {}),
                ...(customerLookupStatus ===
                "error"
                  ? customerLookupError
                  : {}),
              }}
            >
              {customerLookupMessage}
            </div>
          )}

          <Field label="اسم العميل">
            <input
              style={input}
              value={fullName}
              onChange={(event) =>
                setFullName(
                  event.target.value
                )
              }
            />
          </Field>

          <div style={dateFieldTitle}>
            تاريخ الميلاد بالهجري
          </div>

          <div
            style={getDateGridStyle(
              isMobile
            )}
          >
            <Field label="اليوم">
              <input
                style={input}
                inputMode="numeric"
                maxLength={2}
                value={birthDay}
                onChange={(event) =>
                  setBirthDay(
                    normalizeNumber(
                      event.target.value
                    ).slice(0, 2)
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
                    normalizeNumber(
                      event.target.value
                    ).slice(0, 2)
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
                    normalizeNumber(
                      event.target.value
                    ).slice(0, 4)
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
                    normalizeNumber(
                      event.target.value
                    ).slice(0, 10)
                  )
                }
              />
            </Field>

            <Field label="العمل - اختياري">
              <input
                style={input}
                value={workName}
                onChange={(event) =>
                  setWorkName(
                    event.target.value
                  )
                }
              />
            </Field>
          </div>

          <Field label="العنوان - اختياري">
            <input
              style={input}
              value={address}
              onChange={(event) =>
                setAddress(
                  event.target.value
                )
              }
            />
          </Field>
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
              الطرف الأول
            </h2>

            {listsLoading && (
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

          <Field label="المستثمر المرتبط بالمخزون">
            <CustomSelect
              value={investorId}
              placeholder={
                listsLoading
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

          <Field label="اختر المنتج">
            <CustomSelect
              value={productId}
              placeholder={
                listsLoading
                  ? "جاري تحميل المنتجات..."
                  : products.length ===
                      0
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

          <Field label="الكمية">
            <input
              style={input}
              inputMode="numeric"
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
            {stockLoading
              ? "جاري تحميل الكمية المتوفرة..."
              : availableStock ===
                  null
                ? "اختر المستثمر والمنتج لعرض المخزون"
                : `المتوفر في المخزون: ${availableStock}`}
          </div>

          <Field label="الطرف الأول المسجّل في العقد والسند">
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
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            بيانات العقد والسند
          </h2>

          <Field label="قيمة البضاعة - للاستخدام الداخلي">
            <input
              style={input}
              inputMode="decimal"
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

          <Field label="مبلغ السداد / مبلغ العقد والسند">
            <input
              style={input}
              inputMode="decimal"
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

          {isInstallmentContract && (
            <>
              <Field label="قيمة الدفعة">
                <input
                  style={input}
                  inputMode="decimal"
                  value={
                    installmentAmount
                  }
                  onChange={(event) =>
                    setInstallmentAmount(
                      normalizeNumber(
                        event.target.value
                      )
                    )
                  }
                />
              </Field>

              <Field label="عدد الدفعات">
                <input
                  style={input}
                  inputMode="numeric"
                  value={
                    deferredPaymentsCount
                  }
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

          <Field
            label={
              isInstallmentContract
                ? "تاريخ أول دفعة بالميلادي"
                : "تاريخ الاستحقاق بالميلادي"
            }
          >
            <ProfessionalDatePicker
              value={paymentDueDate}
              onChange={
                setPaymentDueDate
              }
              placeholder={
                isInstallmentContract
                  ? "اختر تاريخ أول دفعة"
                  : "اختر تاريخ الاستحقاق"
              }
            />
          </Field>

          <Field label="مدينة التقاضي - اختياري">
            <input
              style={input}
              value={legalCity}
              placeholder="اتركه فارغًا عند عدم الحاجة"
              onChange={(event) =>
                setLegalCity(
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="هل يوجد كفيل؟">
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
              onChange={(value) => {
                const nextValue =
                  value === "yes";

                setHasGuarantor(
                  nextValue
                );

                if (!nextValue) {
                  resetGuarantorFields();
                }
              }}
            />
          </Field>

          {hasGuarantor && (
            <>
              <Field label="اسم الكفيل">
                <input
                  style={input}
                  value={
                    guarantorName
                  }
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
                  value={
                    guarantorNationalId
                  }
                  onChange={(event) =>
                    setGuarantorNationalId(
                      normalizeNumber(
                        event.target.value
                      ).slice(0, 10)
                    )
                  }
                />
              </Field>

              <Field label="رقم جوال الكفيل">
                <input
                  style={input}
                  inputMode="numeric"
                  maxLength={10}
                  value={
                    guarantorPhone
                  }
                  onChange={(event) =>
                    setGuarantorPhone(
                      normalizeNumber(
                        event.target.value
                      ).slice(0, 10)
                    )
                  }
                />
              </Field>

              <div style={dateFieldTitle}>
                تاريخ ميلاد الكفيل بالهجري
              </div>

              <div
                style={getDateGridStyle(
                  isMobile
                )}
              >
                <Field label="اليوم">
                  <input
                    style={input}
                    inputMode="numeric"
                    maxLength={2}
                    value={
                      guarantorBirthDay
                    }
                    onChange={(event) =>
                      setGuarantorBirthDay(
                        normalizeNumber(
                          event.target.value
                        ).slice(0, 2)
                      )
                    }
                  />
                </Field>

                <Field label="الشهر">
                  <input
                    style={input}
                    inputMode="numeric"
                    maxLength={2}
                    value={
                      guarantorBirthMonth
                    }
                    onChange={(event) =>
                      setGuarantorBirthMonth(
                        normalizeNumber(
                          event.target.value
                        ).slice(0, 2)
                      )
                    }
                  />
                </Field>

                <Field label="السنة">
                  <input
                    style={input}
                    inputMode="numeric"
                    maxLength={4}
                    value={
                      guarantorBirthYear
                    }
                    onChange={(event) =>
                      setGuarantorBirthYear(
                        normalizeNumber(
                          event.target.value
                        ).slice(0, 4)
                      )
                    }
                  />
                </Field>
              </div>
            </>
          )}

          <Field label="ملاحظات">
            <textarea
              style={textarea}
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="تاريخ تحرير العقد">
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

          <button
            type="button"
            style={{
              ...primaryButton,
              opacity:
                saving ||
                listsLoading
                  ? 0.7
                  : 1,
              cursor:
                saving ||
                listsLoading
                  ? "not-allowed"
                  : "pointer",
            }}
            onClick={
              createRequest
            }
            disabled={
              saving ||
              listsLoading
            }
          >
            {saving
              ? "جاري إنشاء الطلب..."
              : listsLoading
                ? "جاري تجهيز بيانات الطلب..."
                : "إنشاء الطلب وطباعة العقد"}
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
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={fieldBox}>
      <label style={fieldLabel}>
        {label}
      </label>

      {children}
    </div>
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
  onChange: (
    value: string
  ) => void;
}) {
  const [open, setOpen] =
    useState(false);

  const [
    menuRect,
    setMenuRect,
  ] = useState<DropdownRect | null>(
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
          "finance-new-request-select-menu"
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
            id="finance-new-request-select-menu"
            style={{
              ...selectOptionsMenu,
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
            }}
          >
            {options.length === 0 ? (
              <div
                style={emptyOption}
              >
                لا توجد خيارات متاحة
              </div>
            ) : (
              options.map(
                (option) => (
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

                      onChange(
                        option.value
                      );

                      closeMenu();
                    }}
                  >
                    {option.label}
                  </button>
                )
              )
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
  onChange: (
    value: string
  ) => void;
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
    onChange(
      formatLocalDate(
        new Date(
          year,
          month,
          day
        )
      )
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
            ? formatDisplayDate(
                value
              )
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
                  {String(
                    visibleMonth + 1
                  ).padStart(2, "0")}
                  /{visibleYear}
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
                        visibleMonth +
                          1
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
                    const currentDate =
                      new Date();

                    setVisibleYear(
                      currentDate.getFullYear()
                    );

                    setVisibleMonth(
                      currentDate.getMonth()
                    );

                    onChange(
                      formatLocalDate(
                        currentDate
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

function parseHijriDateParts(
  value: string
): {
  year: string;
  month: string;
  day: string;
} | null {
  const normalized =
    normalizeNumber(value)
      .trim()
      .replace(/[.\-]/g, "/")
      .replace(/\s+/g, "")
      .replace(/\/{2,}/g, "/");

  const parts =
    normalized.split("/");

  if (parts.length !== 3) {
    return null;
  }

  let year = "";
  let month = "";
  let day = "";

  if (parts[0].length === 4) {
    [year, month, day] = parts;
  } else if (
    parts[2].length === 4
  ) {
    [day, month, year] = parts;
  } else {
    return null;
  }

  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);

  if (
    !Number.isInteger(numericYear) ||
    numericYear < 1300 ||
    numericYear > 1600 ||
    !Number.isInteger(numericMonth) ||
    numericMonth < 1 ||
    numericMonth > 12 ||
    !Number.isInteger(numericDay) ||
    numericDay < 1 ||
    numericDay > 30
  ) {
    return null;
  }

  return {
    year: String(numericYear),
    month: String(numericMonth),
    day: String(numericDay),
  };
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
    new Date(
      year,
      month,
      day
    );

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

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const year = String(
    date.getFullYear()
  );

  return `${day}/${month}/${year}`;
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
    backgroundAttachment:
      isMobile
        ? "scroll"
        : "fixed",
    padding:
      isMobile ? 10 : 18,
    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getContainerStyle(
  isCompact: boolean
): CSSProperties {
  return {
    width: "100%",
    maxWidth:
      isCompact
        ? 980
        : 1040,
    margin: "auto",
  };
}

function getHeroStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "relative",
    minHeight:
      isMobile
        ? "auto"
        : 160,
    borderRadius:
      isMobile
        ? 20
        : 24,
    padding:
      isMobile
        ? "18px 14px"
        : "22px 26px",
    marginBottom: 14,
    overflow: "hidden",
    border: "none",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
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
    fontSize:
      isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getMainWorkstationButtonStyle(
  isMobile: boolean
): CSSProperties {
  return {
    width:
      isMobile
        ? "100%"
        : 220,
    maxWidth:
      isMobile
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
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
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
    fontFamily:
      "var(--font-almarai), sans-serif",
    whiteSpace: "nowrap",
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
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  };
}

function getDateGridStyle(
  isMobile: boolean
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns:
      isMobile
        ? "1fr"
        : "repeat(3,1fr)",
    gap: 10,
  };
}

const employeeIcon:
  CSSProperties = {
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
  color: "#ffffff",
};

const employeeDividerSmall:
  CSSProperties = {
  width: 1,
  height: 34,
  background:
    "rgba(255,255,255,0.30)",
};

const logoutInlineButton:
  CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 9,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const dateBox:
  CSSProperties = {
  minWidth: 130,
  display: "grid",
  gap: 5,
  textAlign: "center",
  color: "#ffffff",
};

const dateLabelStyle:
  CSSProperties = {
  color:
    "rgba(255,255,255,0.75)",
  fontSize: 13,
  fontWeight: 800,
};

const dateText:
  CSSProperties = {
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 900,
};

const heroCircleOne:
  CSSProperties = {
  position: "absolute",
  width: 210,
  height: 210,
  right: -78,
  top: -85,
  borderRadius: "50%",
  background:
    "rgba(255,255,255,0.075)",
  zIndex: 1,
};

const heroCircleTwo:
  CSSProperties = {
  position: "absolute",
  width: 245,
  height: 245,
  right: 145,
  bottom: -178,
  borderRadius: "50%",
  background:
    "rgba(255,255,255,0.045)",
  zIndex: 1,
};

const heroCircleThree:
  CSSProperties = {
  position: "absolute",
  width: 150,
  height: 150,
  left: 380,
  top: -96,
  borderRadius: "50%",
  background:
    "rgba(255,255,255,0.035)",
  zIndex: 1,
};

const heroDots:
  CSSProperties = {
  position: "absolute",
  top: 28,
  right: 34,
  width: 84,
  height: 58,
  opacity: 0.24,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.40) 2px, transparent 2px)",
  backgroundSize:
    "14px 14px",
  zIndex: 2,
};

const inlineErrorCard:
  CSSProperties = {
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
  fontWeight: 900,
};

const inlineRetryButton:
  CSSProperties = {
  minHeight: 38,
  border: "none",
  borderRadius: 10,
  padding: "8px 14px",
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const card:
  CSSProperties = {
  background:
    "rgba(255,255,255,0.97)",
  border:
    "1px solid #dbe5f3",
  borderRadius: 20,
  padding: 20,
  marginBottom: 14,
  boxShadow:
    "0 10px 26px rgba(15,23,42,0.05)",
};

const sectionTitleRow:
  CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 18,
};

const localLoadingBadge:
  CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  border:
    "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 900,
};

const sectionTitle:
  CSSProperties = {
  margin: "0 0 18px",
  color: "#0d47a1",
  fontSize: 22,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const fieldBox:
  CSSProperties = {
  marginBottom: 14,
};

const fieldLabel:
  CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#0d47a1",
  fontWeight: 900,
  fontSize: 15,
};

const input:
  CSSProperties = {
  width: "100%",
  minHeight: 54,
  padding: "0 14px",
  borderRadius: 14,
  border:
    "1.5px solid #cbd8eb",
  fontSize: 16,
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  boxSizing: "border-box",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const disabledInput:
  CSSProperties = {
  cursor: "not-allowed",
  background: "#f1f5f9",
  color: "#94a3b8",
};

const customerLookupNotice:
  CSSProperties = {
  margin: "-2px 0 16px",
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1.7,
};

const customerLookupFound:
  CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
};

const customerLookupNotFound:
  CSSProperties = {
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
};

const customerLookupError:
  CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
};

const textarea:
  CSSProperties = {
  ...input,
  minHeight: 110,
  padding: 14,
  resize: "vertical",
};

const dateFieldTitle:
  CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  marginBottom: 8,
  color: "#374151",
};

const twoColumns:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
};

const stockInfo:
  CSSProperties = {
  background: "#f0fdf4",
  color: "#166534",
  border:
    "1px solid #bbf7d0",
  padding: 12,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 900,
  marginBottom: 12,
};

const stockDanger:
  CSSProperties = {
  ...stockInfo,
  background: "#fef2f2",
  color: "#991b1b",
  border:
    "1px solid #fecaca",
};

const selectWrapper:
  CSSProperties = {
  position: "relative",
  width: "100%",
};

const selectButton:
  CSSProperties = {
  width: "100%",
  minHeight: 54,
  padding: "12px 15px",
  borderRadius: 14,
  border:
    "1.5px solid #cbd8eb",
  background: "#ffffff",
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
};

const selectButtonOpen:
  CSSProperties = {
  borderColor: "#3b82f6",
  boxShadow:
    "0 0 0 4px rgba(59,130,246,0.11)",
};

const selectValue:
  CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 800,
};

const selectPlaceholder:
  CSSProperties = {
  color: "#64748b",
  fontSize: 15,
  fontWeight: 700,
};

const selectArrow:
  CSSProperties = {
  color: "#2563eb",
  fontSize: 11,
  transition:
    "transform 0.18s ease",
};

const selectOptionsMenu:
  CSSProperties = {
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
};

const selectOptionButton:
  CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: "none",
  borderRadius: 10,
  padding: "10px 12px",
  background: "transparent",
  color: "#1e293b",
  textAlign: "right",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 800,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const selectedOptionButton:
  CSSProperties = {
  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
};

const disabledOptionButton:
  CSSProperties = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const emptyOption:
  CSSProperties = {
  padding: 14,
  color: "#64748b",
  textAlign: "center",
  fontWeight: 800,
};

const datePickerButton:
  CSSProperties = {
  ...input,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  textAlign: "right",
  direction: "rtl",
  color: "#2563eb",
};

const datePickerValue:
  CSSProperties = {
  color: "#0f172a",
  fontWeight: 800,
};

const datePickerPlaceholder:
  CSSProperties = {
  color: "#64748b",
  fontWeight: 700,
};

const calendarOverlay:
  CSSProperties = {
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

const calendarModal:
  CSSProperties = {
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

const calendarHeader:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "48px 1fr 48px",
  alignItems: "center",
  gap: 10,
  marginBottom: 18,
};

const calendarNavigationButton:
  CSSProperties = {
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

const calendarMonthTitle:
  CSSProperties = {
  textAlign: "center",
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const calendarWeekGrid:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(7,1fr)",
  gap: 6,
  marginBottom: 8,
};

const calendarWeekDay:
  CSSProperties = {
  textAlign: "center",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
  padding: "6px 0",
};

const calendarDaysGrid:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(7,1fr)",
  gap: 6,
};

const calendarDayButton:
  CSSProperties = {
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

const calendarTodayButton:
  CSSProperties = {
  border:
    "1.5px solid #22c55e",
  color: "#15803d",
};

const calendarSelectedButton:
  CSSProperties = {
  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
  boxShadow:
    "0 6px 14px rgba(37,99,235,0.24)",
};

const calendarFooter:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr",
  gap: 10,
  marginTop: 18,
};

const calendarTodayAction:
  CSSProperties = {
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

const calendarCancelAction:
  CSSProperties = {
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

const primaryButton:
  CSSProperties = {
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
};

const backWrapper:
  CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
  marginBottom: 8,
};

const backButton:
  CSSProperties = {
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
