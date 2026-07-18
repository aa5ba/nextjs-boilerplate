"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

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
  id?: string | null;
  full_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
  birth_hijri?: string | null;
  work?: string | null;
  work_name?: string | null;
  address?: string | null;
};

type Contract = {
  id: string;
  branch_id?: string | null;
  customer_id?: string | null;
  guarantor_customer_id?: string | null;

  customer_name?: string | null;
  customer_national_id?: string | null;
  customer_phone?: string | null;
  customer_birth_hijri?: string | null;
  customer_work_name?: string | null;

  contract_number?: string | number | null;
  contract_status?: string | null;
  finance_type?: string | null;
  investor_name?: string | null;
  product_name?: string | null;
  product_quantity?: number | string | null;

  print_party_name?: string | null;
  print_party_type?: string | null;
  print_party_identifier?: string | null;

  debt_amount?: number | string | null;
  payment_amount?: number | string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;

  payment_due_date?: string | null;
  legal_city?: string | null;
  judicial_amount?: number | string | null;

  contract_issue_date_gregorian?: string | null;
  contract_date_gregorian?: string | null;

  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;

  default_declared_at?: string | null;
  default_expires_at?: string | null;
  default_declared_by?: string | null;
  default_declared_by_name?: string | null;
  default_reason?: string | null;
  default_notes?: string | null;

  has_deferred_payments?: boolean | null;
  installment_amount?: number | string | null;
  deferred_payments_count?: number | string | null;

  has_guarantor?: boolean | null;
  guarantor_name?: string | null;
  guarantor_national_id?: string | null;
  guarantor_phone?: string | null;
  guarantor_birth_hijri?: string | null;
  guarantor_work_name?: string | null;

  is_deleted?: boolean | null;
  deleted_at?: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;

  customer?: CustomerRelation | CustomerRelation[] | null;
  guarantor_customer?: CustomerRelation | CustomerRelation[] | null;
};

type Payment = {
  id: string;
  payment_amount?: number | string | null;
  payment_type?: string | null;
  created_at?: string | null;
  is_cancelled?: boolean | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
};

type PromissoryNote = {
  id: string;
  note_number?: string | number | null;
  amount?: number | string | null;
  due_date?: string | null;
  status?: string | null;
};

type CancelPaymentResult = {
  payment_id: string;
  new_paid_amount: number | string;
  new_remaining_amount: number | string;
  new_contract_status: string;
};

type CloseContractResult = {
  contract_id: string;
  new_paid_amount: number | string;
  new_remaining_amount: number | string;
  new_contract_status: string;
};

type ReopenContractResult = {
  contract_id: string;
  new_paid_amount: number | string;
  new_remaining_amount: number | string;
  new_contract_status: string;
};

type DialogTone = "info" | "success" | "warning" | "error";

type MessageDialogState = {
  title: string;
  message: string;
  tone: DialogTone;
} | null;

const SESSION_DURATION_MS = 60 * 60 * 1000;
const ACTIVITY_REFRESH_INTERVAL_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

const MANAGER_ROLES = [
  "main_admin",
  "branch_manager",
  "مدير فرع",
  "مدير رئيسي",
  "مدير",
];

export default function FinanceContractDetailsPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const branch = String(params.branch ?? "").trim();
  const contractId = String(params.id ?? "").trim();

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [pageReady, setPageReady] = useState(false);
  const [employeeName, setEmployeeName] = useState("الموظف");
  const [session, setSession] = useState<FinanceSession | null>(null);

  const [contract, setContract] = useState<Contract | null>(null);
  const [note, setNote] = useState<PromissoryNote | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [branchId, setBranchId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [cancellingPaymentId, setCancellingPaymentId] =
    useState<string | null>(null);
  const [closingContract, setClosingContract] = useState(false);
  const [reopeningContract, setReopeningContract] = useState(false);
  const [sharingContract, setSharingContract] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [messageDialog, setMessageDialog] =
    useState<MessageDialogState>(null);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const sessionRoles = useMemo(() => getStringArray(session?.roles), [session]);
  const sessionPermissions = useMemo(() => {
    const directPermissions = getStringArray(session?.permissions);

    if (directPermissions.length > 0 || typeof window === "undefined") {
      return directPermissions;
    }

    const rawPermissions = localStorage.getItem("finance_permissions");

    if (!rawPermissions) return [];

    try {
      return getStringArray(JSON.parse(rawPermissions));
    } catch {
      return [];
    }
  }, [session]);

  const isManager = useMemo(() => {
    const allRoles = [...sessionRoles];
    const directRole = String(session?.role || "").trim();

    if (directRole && !allRoles.includes(directRole)) {
      allRoles.push(directRole);
    }

    return allRoles.some((role) => MANAGER_ROLES.includes(role));
  }, [session, sessionRoles]);

  const canEditFromMenu =
    isManager ||
    hasAnyPermission(sessionPermissions, [
      "contracts_edit",
      "contracts_update",
      "edit_contract",
      "contracts",
    ]);

  const canPrintFromMenu =
    isManager ||
    hasAnyPermission(sessionPermissions, [
      "contracts_print",
      "contract_print",
      "promissory_note_view",
      "contracts_view",
      "contracts",
    ]);

  const canCreateLinkedPromissoryNote =
    isManager ||
    (sessionPermissions.includes("promissory_note_create") &&
      sessionPermissions.includes("promissory_note_link_contract"));

  const canCloseFromMenu =
    isManager ||
    hasAnyPermission(sessionPermissions, [
      "contracts_close",
      "close_contract",
      "contracts",
    ]);

  const loadData = useCallback(
    async (
      currentBranchId: string,
      isCancelled: () => boolean = () => false
    ) => {
      if (!currentBranchId) return;

      setDataLoading(true);
      setPageError("");

      try {
        const [contractResult, noteResult, paymentsResult] =
          await Promise.all([
            supabase
              .from("finance_contracts")
              .select(
                `
                *,
                customer:finance_customers!finance_contracts_customer_id_fkey(
                  id,
                  full_name,
                  national_id,
                  phone,
                  birth_hijri,
                  work,
                  work_name,
                  address
                ),
                guarantor_customer:finance_customers!finance_contracts_guarantor_customer_id_fkey(
                  id,
                  full_name,
                  national_id,
                  phone,
                  birth_hijri,
                  work,
                  work_name,
                  address
                )
              `
              )
              .eq("id", contractId)
              .eq("branch_id", currentBranchId)
              .maybeSingle(),

            supabase
              .from("finance_promissory_notes")
              .select("id, note_number, amount, due_date, status")
              .eq("contract_id", contractId)
              .eq("branch_id", currentBranchId)
              .eq("is_archived", false)
              .eq("status", "نشط")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),

            supabase
              .from("finance_payments")
              .select(
                "id, payment_amount, payment_type, created_at, is_cancelled, cancelled_at, cancelled_by"
              )
              .eq("contract_id", contractId)
              .eq("branch_id", currentBranchId)
              .order("created_at", { ascending: false }),
          ]);

        if (isCancelled()) return;

        if (contractResult.error) {
          throw new Error(contractResult.error.message);
        }

        if (noteResult.error) {
          throw new Error(noteResult.error.message);
        }

        if (paymentsResult.error) {
          throw new Error(paymentsResult.error.message);
        }

        const loadedContract =
          (contractResult.data as Contract | null) || null;

        if (loadedContract && isHiddenContract(loadedContract)) {
          setContract(null);
          setNote(null);
          setPayments([]);
          setPageError("هذا العقد مؤرشف أو محذوف ولا يمكن عرضه");
          return;
        }

        setContract(loadedContract);
        setNote((noteResult.data as PromissoryNote | null) || null);
        setPayments((paymentsResult.data as Payment[] | null) || []);
      } catch (error) {
        if (isCancelled()) return;

        console.error("Contract details loading error:", error);
        setPageError(getErrorMessage(error, "تعذر تحميل تفاصيل العقد"));
      } finally {
        if (!isCancelled()) {
          setDataLoading(false);
        }
      }
    },
    [contractId]
  );

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
    let cancelled = false;

    async function initializePage() {
      if (typeof window === "undefined") return;

      setPageError("");
      setDataLoading(true);

      const storedSession = readStoredSession();

      if (!isValidSession(storedSession)) {
        redirectToLogin(true);
        return;
      }

      const sessionBranchSlug = String(
        storedSession?.branch_slug || ""
      ).trim();

      if (sessionBranchSlug && sessionBranchSlug !== branch) {
        router.replace(`/finance/${sessionBranchSlug}`);
        return;
      }

      setSession(storedSession);

      const localEmployeeName =
        localStorage.getItem("finance_user_name") ||
        storedSession?.full_name ||
        storedSession?.username ||
        "الموظف";

      setEmployeeName(localEmployeeName);

      const storedBranchId = String(
        storedSession?.branch_id ||
          localStorage.getItem("finance_branch_id") ||
          ""
      ).trim();

      if (storedBranchId) {
        setBranchId(storedBranchId);
      }

      renewFinanceSession();
      setPageReady(true);

      let resolvedBranchId = storedBranchId;

      if (!resolvedBranchId) {
        try {
          const fetchedBranchId = await getBranchId(branch);

          if (cancelled) return;

          if (!fetchedBranchId) {
            setPageError("تعذر تحديد الفرع");
            setDataLoading(false);
            return;
          }

          resolvedBranchId = String(fetchedBranchId);
          setBranchId(resolvedBranchId);
          localStorage.setItem("finance_branch_id", resolvedBranchId);
          localStorage.setItem("finance_branch_slug", branch);
        } catch (error) {
          if (cancelled) return;

          setPageError(getErrorMessage(error, "تعذر تحديد الفرع"));
          setDataLoading(false);
          return;
        }
      }

      await loadData(resolvedBranchId, () => cancelled);
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [branch, loadData, router]);

  useEffect(() => {
    if (!pageReady || typeof window === "undefined") return;

    let lastRefresh = 0;

    function handleActivity() {
      const now = Date.now();

      if (now - lastRefresh < ACTIVITY_REFRESH_INTERVAL_MS) return;

      lastRefresh = now;
      renewFinanceSession();
    }

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    const timer = window.setInterval(() => {
      const expiresAt = Number(
        localStorage.getItem("finance_session_expires_at") || 0
      );

      if (expiresAt > 0 && Date.now() >= expiresAt) {
        redirectToLogin(true);
      }
    }, 30 * 1000);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });

      window.clearInterval(timer);
    };
  }, [pageReady, pathname]);

  function clearSession({
    clearReturnPath = true,
  }: {
    clearReturnPath?: boolean;
  } = {}) {
    if (typeof window === "undefined") return;

    SESSION_KEYS.forEach((key) => {
      if (!clearReturnPath && key === "finance_return_to") return;
      localStorage.removeItem(key);
    });
  }

  function getCurrentReturnPath() {
    if (typeof window === "undefined") {
      return pathname || `/finance/${branch}`;
    }

    return `${window.location.pathname}${window.location.search}`;
  }

  function redirectToLogin(preserveReturnPath = true) {
    if (typeof window === "undefined") {
      router.replace("/login");
      return;
    }

    const returnTo = getCurrentReturnPath();

    if (preserveReturnPath && isSafeInternalReturnPath(returnTo)) {
      localStorage.setItem("finance_return_to", returnTo);
    }

    clearSession({ clearReturnPath: !preserveReturnPath });

    if (preserveReturnPath && isSafeInternalReturnPath(returnTo)) {
      localStorage.setItem("finance_return_to", returnTo);
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    router.replace("/login");
  }

  function isSafeInternalReturnPath(value: string) {
    if (!value.startsWith("/finance/")) return false;
    if (value.startsWith("//") || value.includes("://")) return false;

    return value.startsWith(`/finance/${branch}`);
  }

  function renewFinanceSession() {
    if (typeof window === "undefined") return;

    const now = Date.now();
    localStorage.setItem("finance_last_activity_at", String(now));
    localStorage.setItem(
      "finance_session_expires_at",
      String(now + SESSION_DURATION_MS)
    );
  }

  function readStoredSession(): FinanceSession | null {
    if (typeof window === "undefined") return null;

    const rawSession =
      localStorage.getItem("finance_branch_user") ||
      localStorage.getItem("finance_user");

    if (!rawSession) return null;

    try {
      const parsed = JSON.parse(rawSession) as FinanceSession;

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }

      return {
        ...parsed,
        id:
          parsed.id ||
          parsed.user_id ||
          localStorage.getItem("finance_user_id"),
        full_name:
          parsed.full_name ||
          localStorage.getItem("finance_user_name") ||
          null,
        username:
          parsed.username || localStorage.getItem("finance_username") || null,
        role: parsed.role || localStorage.getItem("finance_role") || null,
        branch_id:
          parsed.branch_id || localStorage.getItem("finance_branch_id") || null,
        branch_slug:
          parsed.branch_slug ||
          localStorage.getItem("finance_branch_slug") ||
          null,
        branch_name:
          parsed.branch_name ||
          localStorage.getItem("finance_branch_name") ||
          null,
        organization_name:
          parsed.organization_name ||
          localStorage.getItem("finance_organization_name") ||
          null,
        investor_id:
          parsed.investor_id ||
          localStorage.getItem("finance_investor_id") ||
          null,
        last_login_at:
          parsed.last_login_at ||
          localStorage.getItem("finance_last_login_at") ||
          null,
      };
    } catch {
      return null;
    }
  }

  function isValidSession(currentSession: FinanceSession | null) {
    if (!currentSession) return false;

    const userId = String(
      currentSession.id || currentSession.user_id || ""
    ).trim();
    const sessionBranchSlug = String(
      currentSession.branch_slug || ""
    ).trim();

    if (!userId || !sessionBranchSlug) return false;
    if (currentSession.is_active === false) return false;

    const expiresAt = Number(
      localStorage.getItem("finance_session_expires_at") || 0
    );

    return !(expiresAt > 0 && Date.now() >= expiresAt);
  }

  function getSingleRelation(
    relation:
      | CustomerRelation
      | CustomerRelation[]
      | null
      | undefined
  ) {
    return Array.isArray(relation) ? relation[0] || null : relation || null;
  }

  function getCustomerRelation(currentContract: Contract | null) {
    return getSingleRelation(currentContract?.customer);
  }

  function getGuarantorRelation(currentContract: Contract | null) {
    return getSingleRelation(currentContract?.guarantor_customer);
  }

  function logout() {
    clearSession({ clearReturnPath: true });
    router.replace("/login");
  }

  function retryLoading() {
    if (!branchId) {
      setPageError("تعذر تحديد الفرع");
      return;
    }

    void loadData(branchId);
  }

  function showMessage(
    title: string,
    message: string,
    tone: DialogTone
  ) {
    setMessageDialog({ title, message, tone });
  }

  function getCancelErrorMessage(message: string) {
    if (message.includes("PAYMENT_NOT_FOUND")) {
      return "الدفعة غير موجودة أو لا تتبع هذا العقد";
    }

    if (message.includes("PAYMENT_ALREADY_CANCELLED")) {
      return "تم إلغاء هذه الدفعة مسبقًا";
    }

    if (message.includes("CONTRACT_NOT_FOUND")) {
      return "العقد غير موجود أو لا يتبع هذا الفرع";
    }

    return message || "تعذر إلغاء الدفعة";
  }

  async function cancelPayment(payment: Payment) {
    if (!branchId || !contract?.id || cancellingPaymentId) {
      if (!branchId || !contract?.id) {
        showMessage("تعذر تنفيذ العملية", "تعذر تحديد العقد أو الفرع", "error");
      }
      return;
    }

    if (payment.is_cancelled) {
      showMessage("الدفعة ملغية", "تم إلغاء هذه الدفعة مسبقًا", "warning");
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من إلغاء الدفعة بمبلغ ${formatMoney(
        payment.payment_amount
      )} ر.س؟`
    );

    if (!confirmed) return;

    try {
      setCancellingPaymentId(payment.id);
      renewFinanceSession();

      const response = await fetch("/finance/api/payments/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branch,
          contractId: contract.id,
          paymentId: payment.id,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | (CancelPaymentResult & {
            ok?: boolean;
            message?: string;
          })
        | null;

      if (!response.ok || !result?.ok) {
        throw new Error(
          getCancelErrorMessage(result?.message || "تعذر إلغاء الدفعة")
        );
      }

      if (!result?.payment_id) {
        throw new Error("لم يتم استلام نتيجة إلغاء الدفعة");
      }

      await loadData(branchId);
      showMessage(
        "تم إلغاء الدفعة",
        "تم إلغاء الدفعة وتحديث العقد بنجاح",
        "success"
      );
    } catch (error) {
      showMessage(
        "تعذر إلغاء الدفعة",
        getCancelErrorMessage(getErrorMessage(error, "تعذر إلغاء الدفعة")),
        "error"
      );
    } finally {
      setCancellingPaymentId(null);
    }
  }

  function getCloseErrorMessage(message: string) {
    if (message.includes("CONTRACT_NOT_FOUND")) {
      return "العقد غير موجود أو لا يتبع هذا الفرع";
    }

    if (message.includes("CONTRACT_ALREADY_PAID")) {
      return "العقد مسدد بالكامل مسبقًا";
    }

    return message || "تعذر إغلاق العقد";
  }

  async function closeContract(skipBrowserConfirmation = false) {
    if (!branchId || !contract?.id || closingContract) {
      if (!branchId || !contract?.id) {
        showMessage("تعذر تنفيذ العملية", "تعذر تحديد العقد أو الفرع", "error");
      }
      return;
    }

    if (!skipBrowserConfirmation) {
      const confirmed = window.confirm(
        "هل أنت متأكد من إغلاق العقد كسداد كامل؟"
      );

      if (!confirmed) return;
    }

    try {
      setClosingContract(true);
      setShowCloseDialog(false);
      renewFinanceSession();

      const response = await fetch("/finance/api/contracts/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          branch,
          contractId: contract.id,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | (Partial<CloseContractResult> & {
            ok?: boolean;
            message?: string;
            code?: string;
          })
        | null;

      if (!response.ok || !result?.ok) {
        throw new Error(
          getCloseErrorMessage(
            result?.message || result?.code || "تعذر إغلاق العقد"
          )
        );
      }

      if (!result?.contract_id) {
        throw new Error("لم يتم استلام نتيجة إغلاق العقد");
      }

      await loadData(branchId);
      showMessage("تم إغلاق العقد", "تم إغلاق العقد كسداد كامل", "success");
    } catch (error) {
      showMessage(
        "تعذر إغلاق العقد",
        getCloseErrorMessage(getErrorMessage(error, "تعذر إغلاق العقد")),
        "error"
      );
    } finally {
      setClosingContract(false);
    }
  }

  function getReopenErrorMessage(message: string) {
    if (message.includes("CONTRACT_NOT_FOUND")) {
      return "العقد غير موجود أو لا يتبع هذا الفرع";
    }

    if (message.includes("CONTRACT_NOT_CLOSED")) {
      return "العقد غير مغلق ولا يحتاج إلى إعادة تنشيط";
    }

    return message || "تعذر إعادة تنشيط العقد";
  }

  async function reopenContract() {
    if (!branchId || !contract?.id || reopeningContract) {
      if (!branchId || !contract?.id) {
        showMessage("تعذر تنفيذ العملية", "تعذر تحديد العقد أو الفرع", "error");
      }
      return;
    }

    const confirmed = window.confirm(
      "هل أنت متأكد من إعادة تنشيط العقد وإعادة احتساب المسدد والمتبقي؟"
    );

    if (!confirmed) return;

    try {
      setReopeningContract(true);
      renewFinanceSession();

      const response = await fetch("/finance/api/contracts/reopen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          branch,
          contractId: contract.id,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | (Partial<ReopenContractResult> & {
            ok?: boolean;
            message?: string;
            code?: string;
          })
        | null;

      if (!response.ok || !result?.ok) {
        throw new Error(
          getReopenErrorMessage(
            result?.message || result?.code || "تعذر إعادة تنشيط العقد"
          )
        );
      }

      if (!result?.contract_id) {
        throw new Error("لم يتم استلام نتيجة إعادة تنشيط العقد");
      }

      await loadData(branchId);

      if (result.new_contract_status === "تم السداد") {
        showMessage(
          "العقد مسدد بالكامل",
          "العقد ما زال مسددًا بالكامل لأن مجموع الدفعات المسجلة يغطي كامل المبلغ",
          "info"
        );
      } else {
        showMessage(
          "تمت إعادة التنشيط",
          "تمت إعادة تنشيط العقد وإعادة احتساب المبالغ بنجاح",
          "success"
        );
      }
    } catch (error) {
      showMessage(
        "تعذر إعادة تنشيط العقد",
        getReopenErrorMessage(
          getErrorMessage(error, "تعذر إعادة تنشيط العقد")
        ),
        "error"
      );
    } finally {
      setReopeningContract(false);
    }
  }

  function openCustomerProfile() {
    if (!contract?.customer_id) {
      showMessage(
        "لا يوجد عميل مرتبط",
        "لا يوجد رقم عميل مرتبط بهذا العقد",
        "warning"
      );
      return;
    }

    router.push(`/finance/${branch}/customers/${contract.customer_id}`);
  }

  function openCombinedPrintPage() {
    if (!note) {
      showMessage(
        "لا يوجد سند مرتبط",
        "لا يمكن طباعة العقد والسند لأن هذا العقد لا يحتوي على سند مرتبط",
        "warning"
      );
      return;
    }

    router.push(
      `/finance/${branch}/new-request/print/${contractId}/${note.id}`
    );
  }

  async function shareContractPdf() {
    if (!contract || !note || sharingContract) {
      if (!note) {
        showMessage(
          "لا يوجد سند مرتبط",
          "لا يمكن مشاركة ملف العقد والسند لأن هذا العقد لا يحتوي على سند مرتبط",
          "warning"
        );
      }
      return;
    }

    setSharingContract(true);
    renewFinanceSession();

    let printWindow: Window | null = null;

    try {
      const printUrl = `/finance/${branch}/new-request/print/${contractId}/${note.id}`;

      printWindow = window.open(
        printUrl,
        `contract-pdf-${contractId}`,
        "popup=yes,width=1280,height=900,resizable=yes,scrollbars=yes"
      );

      if (!printWindow) {
        throw new Error(
          "تعذر فتح نافذة تجهيز الملف. اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مرة أخرى"
        );
      }

      const { contractElement, noteElement, printDocument } =
        await waitForPrintWindowElements(printWindow);

      if (printDocument.fonts?.ready) {
        await printDocument.fonts.ready;
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const printElements = [contractElement, noteElement];

      for (let index = 0; index < printElements.length; index += 1) {
        const canvas = await html2canvas(printElements[index], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 1280,
          windowHeight: 2200,
          scrollX: 0,
          scrollY: 0,
        });

        if (index > 0) pdf.addPage("a4", "portrait");

        const imageData = canvas.toDataURL("image/jpeg", 0.96);
        const scale = Math.min(
          pageWidth / canvas.width,
          pageHeight / canvas.height
        );
        const imageWidth = canvas.width * scale;
        const imageHeight = canvas.height * scale;
        const x = (pageWidth - imageWidth) / 2;
        const y = (pageHeight - imageHeight) / 2;

        pdf.addImage(
          imageData,
          "JPEG",
          x,
          y,
          imageWidth,
          imageHeight,
          undefined,
          "FAST"
        );
      }

      const pdfBlob = pdf.output("blob");
      const fileName = `عقد-${String(
        contract.contract_number || contractId
      )}-والسند.pdf`;
      const pdfFile = new File([pdfBlob], fileName, {
        type: "application/pdf",
      });

      const sharePayload = {
        files: [pdfFile],
        title: `العقد رقم ${contract.contract_number || "-"}`,
        text: "مرفق ملف العقد والسند لأمر",
      };

      if (
        typeof navigator.share === "function" &&
        (!navigator.canShare || navigator.canShare(sharePayload))
      ) {
        await navigator.share(sharePayload);
      } else {
        const downloadUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(downloadUrl);

        showMessage(
          "تم تجهيز الملف",
          "جهازك لا يدعم مشاركة ملفات PDF مباشرة، لذلك تم حفظ الملف ويمكنك إرساله عبر واتساب",
          "info"
        );
      }
    } catch (error) {
      if (isShareCancellation(error)) return;

      console.error("Contract PDF sharing error:", error);
      showMessage(
        "تعذر إرسال العقد",
        getErrorMessage(error, "تعذر تجهيز ملف العقد والسند للمشاركة"),
        "error"
      );
    } finally {
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }

      setSharingContract(false);
    }
  }

  function getCustomerName() {
    return (
      getCustomerRelation(contract)?.full_name || contract?.customer_name || "-"
    );
  }

  function getCustomerNationalId() {
    return (
      getCustomerRelation(contract)?.national_id ||
      contract?.customer_national_id ||
      "-"
    );
  }

  function getCustomerPhone() {
    return (
      getCustomerRelation(contract)?.phone || contract?.customer_phone || "-"
    );
  }

  function getCustomerBirthHijri() {
    return (
      getCustomerRelation(contract)?.birth_hijri ||
      contract?.customer_birth_hijri ||
      "-"
    );
  }

  function getCustomerWorkName() {
    const customer = getCustomerRelation(contract);

    return (
      customer?.work_name ||
      customer?.work ||
      contract?.customer_work_name ||
      "-"
    );
  }

  function getCustomerAddress() {
    return getCustomerRelation(contract)?.address || "-";
  }

  function getGuarantorName() {
    return (
      getGuarantorRelation(contract)?.full_name ||
      contract?.guarantor_name ||
      "-"
    );
  }

  function getGuarantorNationalId() {
    return (
      getGuarantorRelation(contract)?.national_id ||
      contract?.guarantor_national_id ||
      "-"
    );
  }

  function getGuarantorPhone() {
    return (
      getGuarantorRelation(contract)?.phone || contract?.guarantor_phone || "-"
    );
  }

  function getGuarantorBirthHijri() {
    return (
      getGuarantorRelation(contract)?.birth_hijri ||
      contract?.guarantor_birth_hijri ||
      "-"
    );
  }

  function getGuarantorWorkName() {
    const guarantor = getGuarantorRelation(contract);

    return (
      guarantor?.work_name ||
      guarantor?.work ||
      contract?.guarantor_work_name ||
      "-"
    );
  }

  if (!pageReady) return null;

  const remainingAmount = Number(contract?.remaining_amount || 0);
  const storedContractStatus = String(contract?.contract_status || "").trim();
  const isCancelledContract = ["ملغي", "ملغى"].includes(storedContractStatus);
  const isStoredClosedContract = ["تم السداد", "مغلق"].includes(
    storedContractStatus
  );
  const isFullyPaid =
    remainingAmount <= 0 || storedContractStatus === "تم السداد";
  const contractDueDate = parseContractDueDate(contract?.payment_due_date);
  const contractDaysAfterDue = contractDueDate
    ? Math.floor(
        (getTodayDateOnly().getTime() - contractDueDate.getTime()) / DAY_MS
      )
    : null;
  const hasActiveDefault = Boolean(
    contract?.default_declared_at &&
      contract?.default_expires_at &&
      new Date(contract.default_expires_at).getTime() > Date.now()
  );
  const isAutomaticallyLate = Boolean(
    contractDueDate &&
      contractDaysAfterDue !== null &&
      contractDaysAfterDue >= 7 &&
      remainingAmount > 0 &&
      !isFullyPaid &&
      !isStoredClosedContract &&
      !isCancelledContract
  );

  const displayedContractState = (() => {
    if (isCancelledContract) return storedContractStatus || "ملغي";
    if (storedContractStatus === "مغلق") return "مغلق";
    if (isFullyPaid || storedContractStatus === "تم السداد") {
      return "تم السداد";
    }

    return "ساري";
  })();

  const displayedContractPosition = (() => {
    if (hasActiveDefault) return "متعثر";
    if (isAutomaticallyLate) return "متأخر";
    return "نشط";
  })();

  const canDeclareDefault = Boolean(
    contract &&
      displayedContractState === "ساري" &&
      displayedContractPosition === "متأخر" &&
      isAutomaticallyLate &&
      !hasActiveDefault
  );

  const hasDeferredPayments =
    Boolean(contract?.has_deferred_payments) ||
    Number(contract?.installment_amount || 0) > 0;

  const hasGuarantor =
    Boolean(contract?.has_guarantor) ||
    Boolean(contract?.guarantor_customer_id) ||
    Boolean(contract?.guarantor_name);

  const canPrintClearanceOrReopen = isFullyPaid || isStoredClosedContract;
  const canCloseActiveContract =
    displayedContractState === "ساري" && !closingContract;

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <PageHero
          screen={screen}
          employeeName={employeeName}
          title={
            contract
              ? `عقد رقم ${contract.contract_number || "-"}`
              : "تفاصيل العقد"
          }
          status={
            contract ? (
              <div style={headerStatuses}>
                <div style={headerStatusItem}>
                  <span style={headerStatusLabel}>حالة العقد</span>
                  <span style={statusStyle(displayedContractState)}>
                    {displayedContractState}
                  </span>
                </div>

                <div style={headerStatusItem}>
                  <span style={headerStatusLabel}>وضع العقد</span>
                  <span style={statusStyle(displayedContractPosition)}>
                    {displayedContractPosition}
                  </span>
                </div>
              </div>
            ) : undefined
          }
          actions={
            contract ? (
              <ContractActionsMenu
                canEdit={canEditFromMenu}
                canPrint={canPrintFromMenu}
                canClose={canCloseFromMenu && canCloseActiveContract}
                sharing={sharingContract}
                closing={closingContract}
                onEdit={() =>
                  router.push(
                    `/finance/${branch}/contracts/edit/${contractId}`
                  )
                }
                onShare={() => void shareContractPdf()}
                onPrint={openCombinedPrintPage}
                onClose={() => setShowCloseDialog(true)}
              />
            ) : undefined
          }
          onLogout={logout}
          onHome={() => router.push(`/finance/${branch}`)}
        />

        {dataLoading && (
          <section style={inlineLoadingBox}>جاري تحميل بيانات العقد...</section>
        )}

        {pageError && (
          <section style={inlineErrorBox}>
            <span>{pageError}</span>
            <button type="button" style={retryButton} onClick={retryLoading}>
              إعادة المحاولة
            </button>
          </section>
        )}

        {!dataLoading && !pageError && !contract && (
          <section style={emptyContractBox}>
            لم يتم العثور على العقد أو أنه غير متاح في هذا الفرع
          </section>
        )}

        {contract && (
          <>
            <section style={summaryGrid}>
              <SummaryBox
                title="مبلغ الاستحقاق"
                value={`${formatMoney(
                  contract.payment_amount ?? contract.debt_amount
                )} ر.س`}
              />
              <SummaryBox
                title="المسدد"
                value={`${formatMoney(contract.paid_amount)} ر.س`}
              />
              <SummaryBox
                title="المتبقي"
                value={`${formatMoney(contract.remaining_amount)} ر.س`}
              />
            </section>

            <InfoCard title="بيانات العميل">
              <Row
                label="العميل"
                value={
                  <button
                    type="button"
                    style={customerNameButton}
                    onClick={openCustomerProfile}
                  >
                    {getCustomerName()}
                  </button>
                }
              />
              <Row label="رقم الهوية" value={getCustomerNationalId()} />
              <Row
                label="تاريخ الميلاد بالهجري"
                value={getCustomerBirthHijri()}
              />
              <Row label="رقم الجوال" value={getCustomerPhone()} />
              <Row label="العمل" value={getCustomerWorkName()} />
              <Row label="العنوان" value={getCustomerAddress()} />
            </InfoCard>

            <InfoCard title="بيانات العقد">
              <Row
                label="حالة العقد"
                value={
                  <span style={statusStyle(displayedContractState)}>
                    {displayedContractState}
                  </span>
                }
              />
              <Row
                label="وضع العقد"
                value={
                  <span style={statusStyle(displayedContractPosition)}>
                    {displayedContractPosition}
                  </span>
                }
              />

              {isAutomaticallyLate && contractDaysAfterDue !== null && (
                <Row label="أيام التأخير" value={`${contractDaysAfterDue} يوم`} />
              )}

              {hasActiveDefault && (
                <>
                  <Row
                    label="تاريخ إعلان التعثر"
                    value={<DateValue value={contract.default_declared_at} />}
                  />
                  <Row
                    label="تاريخ انتهاء مدة التعثر"
                    value={<DateValue value={contract.default_expires_at} />}
                  />
                </>
              )}

              <Row label="نوع التمويل" value={contract.finance_type || "-"} />
              <Row
                label="المستثمر المرتبط بالمخزون"
                value={contract.investor_name || "-"}
              />
              <Row label="المنتج" value={contract.product_name || "-"} />
              <Row
                label="كمية المنتجات"
                value={contract.product_quantity || "-"}
              />
              <Row
                label="الطرف الأول في الطباعة"
                value={contract.print_party_name || "-"}
              />
              <Row
                label={
                  contract.print_party_type === "investor"
                    ? "رقم هوية الطرف الأول"
                    : "السجل التجاري للطرف الأول"
                }
                value={contract.print_party_identifier || "-"}
              />
              <Row
                label="مبلغ الدين"
                value={`${formatMoney(contract.debt_amount)} ر.س`}
              />
              <Row
                label="مبلغ السداد"
                value={`${formatMoney(contract.payment_amount)} ر.س`}
              />
              <Row
                label="تاريخ استحقاق السداد"
                value={<DateValue value={contract.payment_due_date} />}
              />
              <Row label="مدينة التقاضي" value={contract.legal_city || "-"} />

              {Number(contract.judicial_amount || 0) > 0 && (
                <Row
                  label="المبلغ القضائي"
                  value={`${formatMoney(contract.judicial_amount)} ر.س`}
                />
              )}

              <Row
                label="تاريخ تحرير العقد"
                value={
                  <DateValue
                    value={
                      contract.contract_issue_date_gregorian ||
                      contract.contract_date_gregorian
                    }
                  />
                }
              />
              <Row label="الموظف المنشئ" value={contract.created_by || "-"} />
              <Row
                label="تاريخ الإنشاء"
                value={<DateValue value={contract.created_at} />}
              />
              <Row
                label="تاريخ آخر تحديث"
                value={<DateValue value={contract.updated_at} />}
              />
            </InfoCard>

            <InfoCard title="الدفعات الآجلة">
              {hasDeferredPayments ? (
                <>
                  <Row
                    label="قيمة الدفعة الآجلة"
                    value={`${formatMoney(contract.installment_amount)} ر.س`}
                  />
                  <Row
                    label="عدد الدفعات الآجلة"
                    value={`${contract.deferred_payments_count || 0} دفعات`}
                  />
                </>
              ) : (
                <div style={emptyBox}>لا توجد دفعات آجلة لهذا العقد</div>
              )}
            </InfoCard>

            <InfoCard title="بيانات الكفيل">
              {hasGuarantor ? (
                <>
                  <Row label="اسم الكفيل" value={getGuarantorName()} />
                  <Row
                    label="رقم هوية الكفيل"
                    value={getGuarantorNationalId()}
                  />
                  <Row label="رقم جوال الكفيل" value={getGuarantorPhone()} />
                  <Row
                    label="تاريخ ميلاد الكفيل بالهجري"
                    value={getGuarantorBirthHijri()}
                  />
                  <Row label="عمل الكفيل" value={getGuarantorWorkName()} />
                </>
              ) : (
                <div style={emptyBox}>لا يوجد كفيل لهذا العقد</div>
              )}
            </InfoCard>

            <InfoCard title="السند المرتبط">
              {note ? (
                <>
                  <Row label="رقم السند" value={note.note_number || "-"} />
                  <Row
                    label="مبلغ السند"
                    value={`${formatMoney(note.amount)} ر.س`}
                  />
                  <Row
                    label="تاريخ استحقاق السند"
                    value={<DateValue value={note.due_date} />}
                  />
                  <Row label="حالة السند" value={note.status || "-"} />
                </>
              ) : (
                <div style={emptyBox}>لا يوجد سند مرتبط بهذا العقد</div>
              )}
            </InfoCard>

            <InfoCard title="سجل الدفعات">
              {payments.length === 0 ? (
                <div style={emptyBox}>لا توجد دفعات مسجلة</div>
              ) : (
                payments.map((payment) => {
                  const isCancelling = cancellingPaymentId === payment.id;

                  return (
                    <div
                      key={payment.id}
                      className="payment-row"
                      style={{
                        ...paymentRow,
                        opacity: payment.is_cancelled ? 0.6 : 1,
                      }}
                    >
                      <span>
                        💰 {formatMoney(payment.payment_amount)} ر.س
                      </span>
                      <span>
                        {payment.is_cancelled
                          ? "❌ ملغية"
                          : `💳 ${payment.payment_type || "-"}`}
                      </span>
                      <span>
                        📅 <DateValue value={payment.created_at} />
                      </span>

                      <div className="payment-actions" style={paymentActions}>
                        <button
                          type="button"
                          style={receiptButton}
                          onClick={() =>
                            router.push(
                              `/finance/${branch}/payments/receipt/${payment.id}`
                            )
                          }
                          disabled={Boolean(payment.is_cancelled) || isCancelling}
                        >
                          🧾 طباعة الإيصال
                        </button>
                        <button
                          type="button"
                          style={cancelButton}
                          onClick={() => void cancelPayment(payment)}
                          disabled={Boolean(payment.is_cancelled) || isCancelling}
                        >
                          {isCancelling ? "جاري الإلغاء..." : "⛔ إلغاء"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </InfoCard>

            <section style={actionsSection}>
              {displayedContractState === "ساري" && (
                <ActionButton
                  icon="💳"
                  title="تسجيل سداد"
                  onClick={() =>
                    router.push(
                      `/finance/${branch}/payments/new?contract=${contractId}`
                    )
                  }
                />
              )}

              {canDeclareDefault && (
                <ActionButton
                  icon="⚠️"
                  title="إعلان التعثر"
                  onClick={() =>
                    router.push(
                      `/finance/${branch}/contracts/${contractId}/declare-default`
                    )
                  }
                />
              )}

              <ActionButton
                icon="✏️"
                title="تعديل العقد"
                onClick={() =>
                  router.push(
                    `/finance/${branch}/contracts/edit/${contractId}`
                  )
                }
              />

              <ActionButton
                icon="🖨️"
                title="طباعة العقد"
                onClick={() =>
                  router.push(
                    `/finance/${branch}/contracts/print/${contractId}`
                  )
                }
              />

              {note && (
                <ActionButton
                  icon="🧾"
                  title="طباعة العقد والسند"
                  onClick={openCombinedPrintPage}
                />
              )}

              {note && (
                <ActionButton
                  icon="📑"
                  title="طباعة السند"
                  onClick={() =>
                    router.push(
                      `/finance/${branch}/contracts/promissory-note/print/${note.id}`
                    )
                  }
                />
              )}

              {!note && canCreateLinkedPromissoryNote && (
                <ActionButton
                  icon="📝"
                  title="إنشاء سند مرتبط"
                  onClick={() =>
                    router.push(
                      `/finance/${branch}/contracts/promissory-note/new?contractId=${encodeURIComponent(
                        contractId
                      )}`
                    )
                  }
                />
              )}

              {canPrintClearanceOrReopen && (
                <ActionButton
                  icon="📄"
                  title="طباعة المخالصة"
                  onClick={() =>
                    router.push(
                      `/finance/${branch}/contracts/clearance/${contractId}`
                    )
                  }
                />
              )}

              {canPrintClearanceOrReopen && (
                <ActionButton
                  icon="🔄"
                  title={
                    reopeningContract
                      ? "جاري إعادة التنشيط..."
                      : "إعادة تنشيط العقد"
                  }
                  onClick={() => void reopenContract()}
                  disabled={reopeningContract}
                />
              )}

              {displayedContractState === "ساري" && (
                <ActionButton
                  icon="🔒"
                  title={
                    closingContract ? "جاري إغلاق العقد..." : "إغلاق العقد"
                  }
                  onClick={() => void closeContract()}
                  disabled={closingContract}
                />
              )}
            </section>
          </>
        )}

        <div style={backWrapper}>
          <button type="button" style={backButton} onClick={() => router.back()}>
            ← رجوع
          </button>
        </div>
      </div>

      {showCloseDialog && (
        <ConfirmDialog
          title="إغلاق العقد"
          message="سيتم إغلاق العقد كسداد كامل. هل تريد متابعة العملية؟"
          confirmText={closingContract ? "جاري الإغلاق..." : "إغلاق العقد"}
          disabled={closingContract}
          onCancel={() => setShowCloseDialog(false)}
          onConfirm={() => void closeContract(true)}
        />
      )}

      {messageDialog && (
        <MessageDialog
          title={messageDialog.title}
          message={messageDialog.message}
          tone={messageDialog.tone}
          onClose={() => setMessageDialog(null)}
        />
      )}

      <GlobalResponsiveStyles />
    </main>
  );
}

function PageHero({
  screen,
  employeeName,
  title,
  status,
  actions,
  onLogout,
  onHome,
}: {
  screen: ScreenType;
  employeeName: string;
  title: string;
  status?: ReactNode;
  actions?: ReactNode;
  onLogout: () => void;
  onHome: () => void;
}) {
  const isMobile = screen === "mobile";

  return (
    <header style={getHeroStyle(isMobile)}>
      <div style={heroVisualLayer}>
        <div style={heroCircleOne} />
        <div style={heroCircleTwo} />
        <div style={heroCircleThree} />
        <div style={heroDots} />
      </div>

      <div style={getHeroContentStyle(screen)}>
        <div style={getHeroUserCardStyle(screen)}>
          <div style={getEmployeeTopRowStyle(screen)}>
            <div style={employeeIcon}>
              <UserIcon />
            </div>
            <div style={getEmployeeNameStyle(isMobile)}>{employeeName}</div>
            {!isMobile && <div style={employeeDividerSmall} />}
            <button
              type="button"
              style={logoutInlineButton}
              onClick={onLogout}
            >
              <LogoutIcon />
              <span>تسجيل الخروج</span>
            </button>
          </div>

          <button
            type="button"
            style={getMainWorkstationButtonStyle(isMobile)}
            onClick={onHome}
          >
            <HomeIcon />
            <span>محطة العمل الرئيسية</span>
          </button>
        </div>

        <div style={getHeroTitleBoxStyle(screen)}>
          <h1 style={getTitleStyle(screen)}>{title}</h1>
        </div>

        <div style={getHeroActionBoxStyle(screen)}>
          {actions}
          {status}
        </div>
      </div>
    </header>
  );
}

function ContractActionsMenu({
  canEdit,
  canPrint,
  canClose,
  sharing,
  closing,
  onEdit,
  onShare,
  onPrint,
  onClose,
}: {
  canEdit: boolean;
  canPrint: boolean;
  canClose: boolean;
  sharing: boolean;
  closing: boolean;
  onEdit: () => void;
  onShare: () => void;
  onPrint: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        wrapperRef.current &&
        !wrapperRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, {
      passive: true,
    });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const hasAvailableAction = canEdit || canPrint || canClose;

  function runAction(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={wrapperRef} style={actionsMenuWrapper}>
      <button
        type="button"
        style={actionsMenuButton}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ActionsIcon />
        <span>الإجراءات</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div role="menu" style={actionsDropdown}>
          {canEdit && (
            <DropdownAction
              icon={<EditIcon />}
              label="تعديل العقد"
              onClick={() => runAction(onEdit)}
            />
          )}

          {canPrint && (
            <DropdownAction
              icon={<ShareIcon />}
              label={sharing ? "جاري تجهيز ملف PDF..." : "إرسال العقد عبر واتساب"}
              onClick={() => runAction(onShare)}
              disabled={sharing}
            />
          )}

          {canPrint && (
            <DropdownAction
              icon={<PrintIcon />}
              label="طباعة العقد والسند"
              onClick={() => runAction(onPrint)}
            />
          )}

          {canClose && (
            <>
              <div style={dropdownDivider} />
              <DropdownAction
                icon={<LockIcon />}
                label={closing ? "جاري إغلاق العقد..." : "إغلاق العقد"}
                onClick={() => runAction(onClose)}
                disabled={closing}
                danger
              />
            </>
          )}

          {!hasAvailableAction && (
            <div style={emptyActionsText}>لا توجد إجراءات متاحة لصلاحيتك</div>
          )}
        </div>
      )}
    </div>
  );
}

function DropdownAction({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="contract-dropdown-action"
      style={{
        ...dropdownAction,
        ...(danger ? dropdownDangerAction : {}),
      }}
      onClick={onClick}
      disabled={disabled}
    >
      <span style={dropdownActionIcon}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={card}>
      <h2 style={sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div style={row}>
      <span>{label}</span>
      <strong style={rowValue}>{value || "-"}</strong>
    </div>
  );
}

function DateValue({ value }: { value?: string | null }) {
  return <span style={dateValueStyle}>{formatGregorianDate(value)}</span>;
}

function SummaryBox({ title, value }: { title: string; value: string }) {
  return (
    <div style={summaryBox}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionButton({
  icon,
  title,
  onClick,
  disabled = false,
}: {
  icon: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      style={actionButton}
      onClick={onClick}
      disabled={disabled}
    >
      <span style={buttonContent}>
        <span style={buttonIcon}>{icon}</span>
        {title}
      </span>
    </button>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmText,
  disabled,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmText: string;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={dialogOverlay} role="presentation" onMouseDown={onCancel}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-confirm-title"
        style={dialogCard}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={{ ...dialogIcon, ...dialogWarningIcon }}>
          <LockIcon />
        </div>
        <h2 id="contract-confirm-title" style={dialogTitle}>
          {title}
        </h2>
        <p style={dialogMessage}>{message}</p>
        <div style={dialogActions}>
          <button
            type="button"
            style={dialogCancelButton}
            onClick={onCancel}
            disabled={disabled}
          >
            إلغاء
          </button>
          <button
            type="button"
            style={dialogDangerButton}
            onClick={onConfirm}
            disabled={disabled}
          >
            {confirmText}
          </button>
        </div>
      </section>
    </div>
  );
}

function MessageDialog({
  title,
  message,
  tone,
  onClose,
}: {
  title: string;
  message: string;
  tone: DialogTone;
  onClose: () => void;
}) {
  const toneStyle =
    tone === "success"
      ? dialogSuccessIcon
      : tone === "warning"
        ? dialogWarningIcon
        : tone === "error"
          ? dialogErrorIcon
          : dialogInfoIcon;

  return (
    <div style={dialogOverlay} role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-message-title"
        style={dialogCard}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={{ ...dialogIcon, ...toneStyle }}>
          {tone === "success" ? <CheckIcon /> : <InfoIcon />}
        </div>
        <h2 id="contract-message-title" style={dialogTitle}>
          {title}
        </h2>
        <p style={dialogMessage}>{message}</p>
        <button type="button" style={dialogPrimaryButton} onClick={onClose}>
          حسناً
        </button>
      </section>
    </div>
  );
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0
  );
}

function hasAnyPermission(permissions: string[], expected: string[]) {
  return expected.some((permission) => permissions.includes(permission));
}

function isHiddenContract(currentContract: Contract) {
  const status = String(currentContract.contract_status || "").trim();

  return Boolean(
    currentContract.is_deleted ||
      currentContract.deleted_at ||
      currentContract.is_archived ||
      currentContract.archived_at ||
      ["مؤرشف", "محذوف", "مؤرشف ومحذوف", "محذوف مؤرشف"].includes(status)
  );
}

async function waitForPrintWindowElements(printWindow: Window) {
  const timeoutAt = Date.now() + 30000;

  while (Date.now() < timeoutAt) {
    if (printWindow.closed) {
      throw new Error("تم إغلاق نافذة تجهيز الملف قبل اكتمال العملية");
    }

    try {
      const printDocument = printWindow.document;
      const contractElement = printDocument.querySelector<HTMLElement>(
        ".contract-print-area"
      );
      const noteElement = printDocument.querySelector<HTMLElement>(
        ".note-print-area"
      );

      if (contractElement && noteElement) {
        return {
          contractElement,
          noteElement,
          printDocument,
        };
      }
    } catch {
      // قد تكون النافذة في مرحلة الانتقال إلى صفحة الطباعة؛ ننتظر اكتمالها.
    }

    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  throw new Error(
    "تعذر تجهيز صفحة الطباعة خلال الوقت المحدد. أعد المحاولة وتأكد من السماح بالنوافذ المنبثقة"
  );
}

function isShareCancellation(error: unknown) {
  return (
    error instanceof DOMException &&
    ["AbortError", "NotAllowedError"].includes(error.name)
  );
}

function parseContractDueDate(value?: string | null) {
  const cleanValue = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanValue);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function getTodayDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function formatGregorianDate(value?: string | null) {
  if (!value) return "-";

  const cleanValue = String(value).trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanValue);

  if (dateOnlyMatch) {
    return `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]}`;
  }

  const parsedDate = new Date(cleanValue);

  if (Number.isNaN(parsedDate.getTime())) return cleanValue;

  return new Intl.DateTimeFormat("en-GB-u-ca-gregory", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}

function formatMoney(value: unknown) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusStyle(status?: string | null) {
  if (status === "تم السداد" || status === "مغلق") return paidStatus;
  if (status === "متعثر") return defaultedStatus;
  if (status === "متأخر") return lateStatus;
  if (status === "ملغي" || status === "ملغى") return cancelledStatus;
  return activeStatus;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error || fallback;
  return fallback;
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
      <path d="M4.8 12h9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
      <path d="M6.2 10.4v9.1h11.6v-9.1" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 19.5v-5.2h4v5.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function ActionsIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }}
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return <MiniIcon path="M4 20h4l11-11-4-4L4 16v4Zm9-13 4 4" />;
}

function ShareIcon() {
  return <MiniIcon path="M12 16V4m0 0L8 8m4-4 4 4M5 13v6h14v-6" />;
}

function PrintIcon() {
  return <MiniIcon path="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7v-6Z" />;
}

function LockIcon() {
  return <MiniIcon path="M7 10V7a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v8H6v-8a2 2 0 0 1 2-2Z" />;
}

function InfoIcon() {
  return <MiniIcon path="M12 10v7m0-11h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />;
}

function CheckIcon() {
  return <MiniIcon path="m5 12 4 4L19 6" />;
}

function MiniIcon({ path }: { path: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * { box-sizing: border-box; }
      body { overflow-x: hidden; }
      button { -webkit-tap-highlight-color: transparent; }
      button:disabled { cursor: not-allowed !important; opacity: 0.65; }

      .contract-dropdown-action:hover:not(:disabled) {
        background: #f0f7ff !important;
        transform: translateX(-2px);
      }

      @media (max-width: 760px) {
        .payment-row { grid-template-columns: 1fr !important; }
        .payment-actions {
          justify-content: stretch !important;
          flex-direction: column !important;
        }
        .payment-actions button { width: 100% !important; }
      }
    `}</style>
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
    color: "#0f172a",
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
    overflow: "visible",
    border: "none",
    background: "transparent",
    isolation: "isolate",
  };
}

function getHeroContentStyle(screen: ScreenType): CSSProperties {
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
    gridTemplateColumns: "minmax(250px,315px) 1fr minmax(220px,315px)",
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
    fontFamily: "var(--font-almarai), sans-serif",
    fontSize: screen === "mobile" ? 24 : screen === "tablet" ? 26 : 28,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow: "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile" || screen === "tablet") {
    return {
      position: "relative",
      zIndex: 10,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      gap: 12,
      order: 3,
    };
  }

  return {
    position: "relative",
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 12,
    direction: "rtl",
  };
}

const heroVisualLayer: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  borderRadius: "inherit",
  background:
    "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
  pointerEvents: "none",
  zIndex: 0,
};

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
  backgroundImage: "radial-gradient(rgba(255,255,255,0.40) 2px, transparent 2px)",
  backgroundSize: "14px 14px",
  zIndex: 2,
};

const headerStatuses: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  flexWrap: "wrap",
  direction: "rtl",
};

const headerStatusItem: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
};

const headerStatusLabel: CSSProperties = {
  color: "rgba(255,255,255,0.88)",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const actionsMenuWrapper: CSSProperties = {
  position: "relative",
  width: "fit-content",
  zIndex: 30,
};

const actionsMenuButton: CSSProperties = {
  minWidth: 146,
  height: 46,
  border: "1px solid rgba(255,255,255,0.46)",
  borderRadius: 13,
  padding: "0 16px",
  background: "rgba(255,255,255,0.96)",
  color: "#0d47a1",
  boxShadow: "0 10px 24px rgba(3,25,73,0.20)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
  direction: "rtl",
};

const actionsDropdown: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 9px)",
  right: 0,
  width: 270,
  padding: 8,
  border: "1px solid #dbe7f7",
  borderRadius: 16,
  background: "rgba(255,255,255,0.99)",
  boxShadow: "0 22px 48px rgba(15,23,42,0.22)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  overflow: "hidden",
  zIndex: 50,
  direction: "rtl",
};

const dropdownAction: CSSProperties = {
  width: "100%",
  minHeight: 48,
  border: "none",
  borderRadius: 11,
  padding: "10px 12px",
  background: "transparent",
  color: "#17345f",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 11,
  cursor: "pointer",
  textAlign: "right",
  fontSize: 14,
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
  transition: "background 160ms ease, transform 160ms ease",
};

const dropdownDangerAction: CSSProperties = {
  color: "#b42318",
  background: "#fff7f6",
};

const dropdownActionIcon: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9,
  background: "#eef5ff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
};

const dropdownDivider: CSSProperties = {
  height: 1,
  margin: "6px 4px",
  background: "#e8eef7",
};

const emptyActionsText: CSSProperties = {
  padding: "14px 10px",
  textAlign: "center",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const inlineLoadingBox: CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  padding: "12px 15px",
  marginBottom: 14,
  textAlign: "center",
  color: "#1d4ed8",
  fontWeight: 900,
};

const inlineErrorBox: CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 14,
  padding: 14,
  marginBottom: 14,
  color: "#9a3412",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const retryButton: CSSProperties = {
  minHeight: 38,
  padding: "8px 14px",
  border: "none",
  borderRadius: 10,
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
};

const emptyContractBox: CSSProperties = {
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 24,
  marginBottom: 16,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 900,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const summaryBox: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#0d47a1",
  fontWeight: 900,
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const card: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const sectionTitle: CSSProperties = {
  marginTop: 0,
  fontSize: 22,
  color: "#0d47a1",
  fontFamily: "var(--font-almarai), sans-serif",
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
  flexWrap: "wrap",
};

const rowValue: CSSProperties = {
  textAlign: "left",
};

const dateValueStyle: CSSProperties = {
  display: "inline-block",
  direction: "ltr",
  unicodeBidi: "isolate",
  textAlign: "right",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

const customerNameButton: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: "#0d47a1",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  textDecoration: "underline",
  fontFamily: "inherit",
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center",
  color: "#6b7280",
};

const paymentRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 260px",
  gap: 12,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const paymentActions: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};

const receiptButton: CSSProperties = {
  background: "#e0f2fe",
  color: "#075985",
  border: "none",
  borderRadius: 12,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
};

const cancelButton: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 12,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
};

const actionsSection: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const actionButton: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  color: "#0d47a1",
  fontFamily: "var(--font-almarai), sans-serif",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const buttonContent: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const buttonIcon: CSSProperties = { fontSize: 20 };

const activeStatus: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const lateStatus: CSSProperties = {
  background: "#ffedd5",
  color: "#9a3412",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const defaultedStatus: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const paidStatus: CSSProperties = {
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const cancelledStatus: CSSProperties = {
  background: "#f1f5f9",
  color: "#475569",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: 900,
  whiteSpace: "nowrap",
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

const dialogOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  padding: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(3,12,31,0.58)",
  backdropFilter: "blur(7px)",
  WebkitBackdropFilter: "blur(7px)",
};

const dialogCard: CSSProperties = {
  width: "100%",
  maxWidth: 430,
  border: "1px solid rgba(255,255,255,0.95)",
  borderRadius: 22,
  padding: "25px 22px 21px",
  background: "rgba(255,255,255,0.98)",
  boxShadow: "0 28px 75px rgba(2,12,31,0.30)",
  textAlign: "center",
  fontFamily: "var(--font-almarai), sans-serif",
};

const dialogIcon: CSSProperties = {
  width: 58,
  height: 58,
  margin: "0 auto 14px",
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dialogSuccessIcon: CSSProperties = {
  background: "#dcfce7",
  color: "#15803d",
};

const dialogWarningIcon: CSSProperties = {
  background: "#fff7ed",
  color: "#c2410c",
};

const dialogErrorIcon: CSSProperties = {
  background: "#fee2e2",
  color: "#b91c1c",
};

const dialogInfoIcon: CSSProperties = {
  background: "#dbeafe",
  color: "#1d4ed8",
};

const dialogTitle: CSSProperties = {
  margin: "0 0 9px",
  color: "#0f274d",
  fontSize: 21,
  fontWeight: 900,
};

const dialogMessage: CSSProperties = {
  margin: "0 0 20px",
  color: "#52627a",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.9,
};

const dialogActions: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const dialogCancelButton: CSSProperties = {
  minHeight: 46,
  border: "1px solid #d8e2ef",
  borderRadius: 12,
  background: "#f8fafc",
  color: "#475569",
  cursor: "pointer",
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
};

const dialogDangerButton: CSSProperties = {
  minHeight: 46,
  border: "none",
  borderRadius: 12,
  background: "linear-gradient(135deg,#ef4444,#b91c1c)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
  boxShadow: "0 9px 20px rgba(185,28,28,0.20)",
};

const dialogPrimaryButton: CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: "none",
  borderRadius: 12,
  background: "linear-gradient(135deg,#2563eb,#0d65d9)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
  boxShadow: "0 9px 20px rgba(37,99,235,0.20)",
};
