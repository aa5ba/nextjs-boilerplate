"use client";

import { useEffect, useState } from "react";
import type {
  CSSProperties,
  ReactNode,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type FinanceSession = {
  id?: string | null;
  user_id?: string | null;
  full_name?: string | null;
  username?: string | null;
  role?: string | null;
  branch_id?: string | null;
  branch_slug?: string | null;
  branch_name?: string | null;
};

type CustomerRelation = {
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
  customer_name?: string | null;
  customer_national_id?: string | null;
  customer_phone?: string | null;
  customer_birth_hijri?: string | null;
  customer_work_name?: string | null;

  contract_number?:
    | string
    | number
    | null;

  contract_status?: string | null;
  finance_type?: string | null;
  investor_name?: string | null;
  product_name?: string | null;

  product_quantity?:
    | number
    | string
    | null;

  print_party_name?: string | null;
  print_party_type?: string | null;

  print_party_identifier?:
    | string
    | null;

  debt_amount?:
    | number
    | string
    | null;

  payment_amount?:
    | number
    | string
    | null;

  paid_amount?:
    | number
    | string
    | null;

  remaining_amount?:
    | number
    | string
    | null;

  payment_due_date?: string | null;
  legal_city?: string | null;

  contract_issue_date_gregorian?:
    | string
    | null;

  contract_date_gregorian?:
    | string
    | null;

  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  has_deferred_payments?:
    | boolean
    | null;

  installment_amount?:
    | number
    | string
    | null;

  deferred_payments_count?:
    | number
    | string
    | null;

  has_guarantor?:
    | boolean
    | null;

  guarantor_name?: string | null;

  guarantor_national_id?:
    | string
    | null;

  guarantor_phone?: string | null;

  guarantor_birth_hijri?:
    | string
    | null;

  finance_customers?:
    | CustomerRelation
    | null;
};

type Payment = {
  id: string;

  payment_amount?:
    | number
    | string
    | null;

  payment_type?: string | null;

  created_at?: string | null;

  is_cancelled?:
    | boolean
    | null;

  cancelled_at?: string | null;

  cancelled_by?: string | null;
};

type PromissoryNote = {
  id: string;
  note_number?: string | null;

  amount?:
    | number
    | string
    | null;

  due_date?: string | null;
  status?: string | null;
};

type CancelPaymentResult = {
  payment_id: string;

  new_paid_amount:
    | number
    | string;

  new_remaining_amount:
    | number
    | string;

  new_contract_status: string;
};

type CloseContractResult = {
  contract_id: string;

  new_paid_amount:
    | number
    | string;

  new_remaining_amount:
    | number
    | string;

  new_contract_status: string;
};

type ReopenContractResult = {
  contract_id: string;

  new_paid_amount:
    | number
    | string;

  new_remaining_amount:
    | number
    | string;

  new_contract_status: string;
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
];

export default function FinanceContractDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(
    params.branch ?? ""
  );

  const contractId = String(
    params.id ?? ""
  );

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [contract, setContract] =
    useState<Contract | null>(null);

  const [note, setNote] =
    useState<PromissoryNote | null>(
      null
    );

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [
    cancellingPaymentId,
    setCancellingPaymentId,
  ] = useState<string | null>(null);

  const [
    closingContract,
    setClosingContract,
  ] = useState(false);

  const [
    reopeningContract,
    setReopeningContract,
  ] = useState(false);

  const isMobile =
    screen === "mobile";

  const isTablet =
    screen === "tablet";

  const isCompact =
    isMobile || isTablet;

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

    return () =>
      window.removeEventListener(
        "resize",
        updateScreen
      );
  }, []);

  useEffect(() => {
    void initializePage();
  }, [branch, contractId]);

  function clearSession() {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    SESSION_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });
  }

  function readStoredSession():
    | FinanceSession
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

    if (rawSession) {
      try {
        const parsed =
          JSON.parse(
            rawSession
          ) as FinanceSession;

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
        };
      } catch {
        return null;
      }
    }

    const legacyUserId =
      localStorage.getItem(
        "finance_user_id"
      );

    const legacyUsername =
      localStorage.getItem(
        "finance_username"
      );

    if (
      !legacyUserId &&
      !legacyUsername
    ) {
      return null;
    }

    return {
      id: legacyUserId,

      full_name:
        localStorage.getItem(
          "finance_user_name"
        ),

      username: legacyUsername,

      role:
        localStorage.getItem(
          "finance_role"
        ),

      branch_id:
        localStorage.getItem(
          "finance_branch_id"
        ),

      branch_slug:
        localStorage.getItem(
          "finance_branch_slug"
        ),

      branch_name:
        localStorage.getItem(
          "finance_branch_name"
        ),
    };
  }

  async function initializePage() {
    try {
      setLoading(true);

      if (
        !branch ||
        !contractId
      ) {
        clearSession();
        router.replace("/login");
        return;
      }

      const storedSession =
        readStoredSession();

      if (!storedSession) {
        clearSession();
        router.replace("/login");
        return;
      }

      if (
        storedSession.branch_slug &&
        storedSession.branch_slug !==
          branch
      ) {
        router.replace(
          `/finance/${storedSession.branch_slug}`
        );
        return;
      }

      const {
        data: branchData,
        error: branchError,
      } = await supabase
        .from("finance_branches")
        .select(
          "id, branch_slug, branch_name, organization_name, is_active"
        )
        .eq("branch_slug", branch)
        .eq("is_active", true)
        .maybeSingle();

      if (
        branchError ||
        !branchData?.id
      ) {
        clearSession();
        router.replace("/login");
        return;
      }

      const safeBranchId =
        String(branchData.id);

      if (
        storedSession.branch_id &&
        storedSession.branch_id !==
          safeBranchId
      ) {
        if (
          storedSession.branch_slug
        ) {
          router.replace(
            `/finance/${storedSession.branch_slug}`
          );
        } else {
          clearSession();
          router.replace("/login");
        }

        return;
      }

      let userQuery = supabase
        .from(
          "finance_branch_users"
        )
        .select(
          "id, full_name, username, role, branch_id, is_active"
        )
        .eq(
          "branch_id",
          safeBranchId
        )
        .eq("is_active", true);

      if (storedSession.id) {
        userQuery = userQuery.eq(
          "id",
          storedSession.id
        );
      } else if (
        storedSession.username
      ) {
        userQuery = userQuery.eq(
          "username",
          storedSession.username
        );
      } else {
        clearSession();
        router.replace("/login");
        return;
      }

      const {
        data: userData,
        error: userError,
      } =
        await userQuery.maybeSingle();

      if (
        userError ||
        !userData?.id
      ) {
        clearSession();
        router.replace("/login");
        return;
      }

      const resolvedEmployeeName =
        userData.full_name ||
        userData.username ||
        storedSession.full_name ||
        storedSession.username ||
        "الموظف";

      setEmployeeName(
        resolvedEmployeeName
      );

      setBranchId(safeBranchId);

      if (
        typeof window !== "undefined"
      ) {
        localStorage.setItem(
          "finance_user_id",
          String(userData.id)
        );

        localStorage.setItem(
          "finance_user_name",
          resolvedEmployeeName
        );

        localStorage.setItem(
          "finance_username",
          String(
            userData.username ||
              storedSession.username ||
              ""
          )
        );

        localStorage.setItem(
          "finance_role",
          String(
            userData.role ||
              storedSession.role ||
              ""
          )
        );

        localStorage.setItem(
          "finance_branch_id",
          safeBranchId
        );

        localStorage.setItem(
          "finance_branch_slug",
          branch
        );

        localStorage.setItem(
          "finance_branch_name",
          String(
            branchData.branch_name ||
              ""
          )
        );

        localStorage.setItem(
          "finance_organization_name",
          String(
            branchData.organization_name ||
              ""
          )
        );
      }

      await loadData(
        safeBranchId
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر تحميل تفاصيل العقد";

      alert(message);

      setContract(null);
      setNote(null);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  async function loadData(
    currentBranchId = branchId
  ) {
    if (!currentBranchId) {
      return;
    }

    const [
      contractResult,
      noteResult,
      paymentsResult,
    ] = await Promise.all([
      supabase
        .from("finance_contracts")
        .select(
          `
          *,
          finance_customers(
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
        .eq(
          "branch_id",
          currentBranchId
        )
        .maybeSingle(),

      supabase
        .from(
          "finance_promissory_notes"
        )
        .select("*")
        .eq(
          "contract_id",
          contractId
        )
        .eq(
          "branch_id",
          currentBranchId
        )
        .maybeSingle(),

      supabase
        .from("finance_payments")
        .select("*")
        .eq(
          "contract_id",
          contractId
        )
        .eq(
          "branch_id",
          currentBranchId
        )
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (
      contractResult.error
    ) {
      throw new Error(
        contractResult.error.message
      );
    }

    if (noteResult.error) {
      throw new Error(
        noteResult.error.message
      );
    }

    if (
      paymentsResult.error
    ) {
      throw new Error(
        paymentsResult.error.message
      );
    }

    setContract(
      (contractResult.data as
        | Contract
        | null) || null
    );

    setNote(
      (noteResult.data as
        | PromissoryNote
        | null) || null
    );

    setPayments(
      (paymentsResult.data as
        | Payment[]
        | null) || []
    );
  }

  function getCancelErrorMessage(
    message: string
  ) {
    if (
      message.includes(
        "PAYMENT_NOT_FOUND"
      )
    ) {
      return "الدفعة غير موجودة أو لا تتبع هذا العقد";
    }

    if (
      message.includes(
        "PAYMENT_ALREADY_CANCELLED"
      )
    ) {
      return "تم إلغاء هذه الدفعة مسبقًا";
    }

    if (
      message.includes(
        "CONTRACT_NOT_FOUND"
      )
    ) {
      return "العقد غير موجود أو لا يتبع هذا الفرع";
    }

    return (
      message ||
      "تعذر إلغاء الدفعة"
    );
  }

  async function cancelPayment(
    payment: Payment
  ) {
    if (
      !branchId ||
      !contract?.id ||
      cancellingPaymentId
    ) {
      if (
        !branchId ||
        !contract?.id
      ) {
        alert(
          "تعذر تحديد العقد أو الفرع"
        );
      }

      return;
    }

    if (payment.is_cancelled) {
      alert(
        "تم إلغاء هذه الدفعة مسبقًا"
      );
      return;
    }

    const confirmed =
      window.confirm(
        `هل أنت متأكد من إلغاء الدفعة بمبلغ ${formatMoney(
          payment.payment_amount
        )} ر.س؟`
      );

    if (!confirmed) return;

    try {
      setCancellingPaymentId(
        payment.id
      );

      const { data, error } =
        await supabase.rpc(
          "cancel_payment_atomic",
          {
            p_branch_id: branchId,

            p_contract_id:
              contract.id,

            p_payment_id:
              payment.id,

            p_employee_name:
              employeeName ||
              "الموظف",
          }
        );

      if (error) {
        throw new Error(
          getCancelErrorMessage(
            error.message
          )
        );
      }

      const rawResult =
        Array.isArray(data)
          ? data[0]
          : data;

      const result =
        rawResult as
          | CancelPaymentResult
          | null;

      if (!result?.payment_id) {
        throw new Error(
          "لم يتم استلام نتيجة إلغاء الدفعة"
        );
      }

      await loadData(branchId);

      alert(
        "تم إلغاء الدفعة وتحديث العقد بنجاح"
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر إلغاء الدفعة";

      alert(
        getCancelErrorMessage(
          message
        )
      );
    } finally {
      setCancellingPaymentId(
        null
      );
    }
  }

  function getCloseErrorMessage(
    message: string
  ) {
    if (
      message.includes(
        "CONTRACT_NOT_FOUND"
      )
    ) {
      return "العقد غير موجود أو لا يتبع هذا الفرع";
    }

    if (
      message.includes(
        "CONTRACT_ALREADY_PAID"
      )
    ) {
      return "العقد مسدد بالكامل مسبقًا";
    }

    return (
      message ||
      "تعذر إغلاق العقد"
    );
  }

  async function closeContract() {
    if (
      !branchId ||
      !contract?.id ||
      closingContract
    ) {
      if (
        !branchId ||
        !contract?.id
      ) {
        alert(
          "تعذر تحديد العقد أو الفرع"
        );
      }

      return;
    }

    const confirmed =
      window.confirm(
        "هل أنت متأكد من إغلاق العقد كسداد كامل؟"
      );

    if (!confirmed) return;

    try {
      setClosingContract(true);

      const { data, error } =
        await supabase.rpc(
          "close_contract_atomic",
          {
            p_branch_id: branchId,

            p_contract_id:
              contract.id,

            p_employee_name:
              employeeName ||
              "الموظف",
          }
        );

      if (error) {
        throw new Error(
          getCloseErrorMessage(
            error.message
          )
        );
      }

      const rawResult =
        Array.isArray(data)
          ? data[0]
          : data;

      const result =
        rawResult as
          | CloseContractResult
          | null;

      if (!result?.contract_id) {
        throw new Error(
          "لم يتم استلام نتيجة إغلاق العقد"
        );
      }

      await loadData(branchId);

      alert(
        "تم إغلاق العقد كسداد كامل"
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر إغلاق العقد";

      alert(
        getCloseErrorMessage(
          message
        )
      );
    } finally {
      setClosingContract(false);
    }
  }

  function getReopenErrorMessage(
    message: string
  ) {
    if (
      message.includes(
        "CONTRACT_NOT_FOUND"
      )
    ) {
      return "العقد غير موجود أو لا يتبع هذا الفرع";
    }

    if (
      message.includes(
        "CONTRACT_NOT_CLOSED"
      )
    ) {
      return "العقد غير مغلق ولا يحتاج إلى إعادة تنشيط";
    }

    return (
      message ||
      "تعذر إعادة تنشيط العقد"
    );
  }

  async function reopenContract() {
    if (
      !branchId ||
      !contract?.id ||
      reopeningContract
    ) {
      if (
        !branchId ||
        !contract?.id
      ) {
        alert(
          "تعذر تحديد العقد أو الفرع"
        );
      }

      return;
    }

    const confirmed =
      window.confirm(
        "هل أنت متأكد من إعادة تنشيط العقد وإعادة احتساب المسدد والمتبقي؟"
      );

    if (!confirmed) return;

    try {
      setReopeningContract(true);

      const { data, error } =
        await supabase.rpc(
          "reopen_contract_atomic",
          {
            p_branch_id: branchId,

            p_contract_id:
              contract.id,

            p_employee_name:
              employeeName ||
              "الموظف",
          }
        );

      if (error) {
        throw new Error(
          getReopenErrorMessage(
            error.message
          )
        );
      }

      const rawResult =
        Array.isArray(data)
          ? data[0]
          : data;

      const result =
        rawResult as
          | ReopenContractResult
          | null;

      if (!result?.contract_id) {
        throw new Error(
          "لم يتم استلام نتيجة إعادة تنشيط العقد"
        );
      }

      await loadData(branchId);

      if (
        result.new_contract_status ===
        "تم السداد"
      ) {
        alert(
          "العقد ما زال مسددًا بالكامل لأن مجموع الدفعات المسجلة يغطي كامل المبلغ"
        );
      } else {
        alert(
          "تمت إعادة تنشيط العقد وإعادة احتساب المبالغ بنجاح"
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر إعادة تنشيط العقد";

      alert(
        getReopenErrorMessage(
          message
        )
      );
    } finally {
      setReopeningContract(false);
    }
  }

  function openCustomerProfile() {
    if (
      !contract?.customer_id
    ) {
      alert(
        "لا يوجد رقم عميل مرتبط بهذا العقد"
      );
      return;
    }

    router.push(
      `/finance/${branch}/customers/${contract.customer_id}`
    );
  }

  function getCustomerName() {
    return (
      contract
        ?.finance_customers
        ?.full_name ||
      contract?.customer_name ||
      "-"
    );
  }

  function getCustomerNationalId() {
    return (
      contract
        ?.finance_customers
        ?.national_id ||
      contract
        ?.customer_national_id ||
      "-"
    );
  }

  function getCustomerPhone() {
    return (
      contract
        ?.finance_customers
        ?.phone ||
      contract?.customer_phone ||
      "-"
    );
  }

  function getCustomerBirthHijri() {
    return (
      contract
        ?.finance_customers
        ?.birth_hijri ||
      contract
        ?.customer_birth_hijri ||
      "-"
    );
  }

  function getCustomerWorkName() {
    return (
      contract
        ?.finance_customers
        ?.work_name ||
      contract
        ?.finance_customers
        ?.work ||
      contract
        ?.customer_work_name ||
      "-"
    );
  }

  function getCustomerAddress() {
    return (
      contract
        ?.finance_customers
        ?.address ||
      "-"
    );
  }

  function formatDate(
    date?: string | null
  ) {
    if (!date) return "-";

    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return String(date);
    }

    return parsedDate.toLocaleString(
      "ar-SA-u-ca-gregory",
      {
        dateStyle: "short",
        timeStyle: "short",
      }
    );
  }

  function formatDateOnly(
    date?: string | null
  ) {
    if (!date) return "-";

    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return String(date);
    }

    return parsedDate.toLocaleDateString(
      "ar-SA-u-ca-gregory"
    );
  }

  function formatMoney(
    value: unknown
  ) {
    const number =
      Number(value || 0);

    return number.toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function statusStyle(
    status?: string | null
  ) {
    if (
      status === "تم السداد"
    ) {
      return paidStatus;
    }

    if (status === "متأخر") {
      return lateStatus;
    }

    if (status === "ملغي") {
      return cancelledStatus;
    }

    return activeStatus;
  }
    if (loading) {
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
          <PageHero
            screen={screen}
            employeeName={
              employeeName
            }
            title="جاري تحميل العقد..."
            onLogout={logout}
            onHome={() =>
              router.push(
                `/finance/${branch}`
              )
            }
          />

          <div style={loadingBox}>
            جاري تحميل تفاصيل
            العقد...
          </div>
        </div>

        <GlobalResponsiveStyles />
      </main>
    );
  }

  if (!contract) {
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
          <PageHero
            screen={screen}
            employeeName={
              employeeName
            }
            title="لم يتم العثور على العقد"
            onLogout={logout}
            onHome={() =>
              router.push(
                `/finance/${branch}`
              )
            }
          />

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

        <GlobalResponsiveStyles />
      </main>
    );
  }

  const isFullyPaid =
    Number(
      contract.remaining_amount || 0
    ) <= 0 ||
    contract.contract_status ===
      "تم السداد";

  const hasDeferredPayments =
    Boolean(
      contract.has_deferred_payments
    ) ||
    Number(
      contract.installment_amount || 0
    ) > 0;

  const hasGuarantor =
    Boolean(
      contract.has_guarantor
    );

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
        <PageHero
          screen={screen}
          employeeName={employeeName}
          title={`عقد رقم ${
            contract.contract_number ||
            "-"
          }`}
          status={
            <span
              style={statusStyle(
                contract.contract_status
              )}
            >
              {contract.contract_status ||
                "نشط"}
            </span>
          }
          onLogout={logout}
          onHome={() =>
            router.push(
              `/finance/${branch}`
            )
          }
        />

        <section
          style={summaryGrid}
        >
          <SummaryBox
            title="مبلغ الاستحقاق"
            value={`${formatMoney(
              contract.debt_amount ??
                contract.payment_amount
            )} ر.س`}
          />

          <SummaryBox
            title="المسدد"
            value={`${formatMoney(
              contract.paid_amount
            )} ر.س`}
          />

          <SummaryBox
            title="المتبقي"
            value={`${formatMoney(
              contract.remaining_amount
            )} ر.س`}
          />
        </section>

        <InfoCard title="بيانات العميل">
          <Row
            label="العميل"
            value={
              <button
                type="button"
                style={
                  customerNameButton
                }
                onClick={
                  openCustomerProfile
                }
              >
                {getCustomerName()}
              </button>
            }
          />

          <Row
            label="رقم الهوية"
            value={
              getCustomerNationalId()
            }
          />

          <Row
            label="تاريخ الميلاد بالهجري"
            value={
              getCustomerBirthHijri()
            }
          />

          <Row
            label="رقم الجوال"
            value={getCustomerPhone()}
          />

          <Row
            label="العمل"
            value={
              getCustomerWorkName()
            }
          />

          <Row
            label="العنوان"
            value={
              getCustomerAddress()
            }
          />
        </InfoCard>

        <InfoCard title="بيانات العقد">
          <Row
            label="نوع التمويل"
            value={
              contract.finance_type ||
              "-"
            }
          />

          <Row
            label="المستثمر المرتبط بالمخزون"
            value={
              contract.investor_name ||
              "-"
            }
          />

          <Row
            label="المنتج"
            value={
              contract.product_name ||
              "-"
            }
          />

          <Row
            label="كمية المنتجات"
            value={
              contract.product_quantity ||
              "-"
            }
          />

          <Row
            label="الطرف الأول في الطباعة"
            value={
              contract.print_party_name ||
              "-"
            }
          />

          <Row
            label={
              contract.print_party_type ===
              "investor"
                ? "رقم هوية الطرف الأول"
                : "السجل التجاري للطرف الأول"
            }
            value={
              contract.print_party_identifier ||
              "-"
            }
          />

          <Row
            label="مبلغ الدين"
            value={`${formatMoney(
              contract.debt_amount
            )} ر.س`}
          />

          <Row
            label="مبلغ السداد"
            value={`${formatMoney(
              contract.payment_amount
            )} ر.س`}
          />

          <Row
            label="تاريخ الاستحقاق"
            value={
              contract.payment_due_date ||
              "-"
            }
          />

          <Row
            label="مدينة التقاضي"
            value={
              contract.legal_city ||
              "-"
            }
          />

          <Row
            label="تاريخ تحرير العقد"
            value={
              contract.contract_issue_date_gregorian ||
              contract.contract_date_gregorian ||
              "-"
            }
          />

          <Row
            label="الموظف المنشئ"
            value={
              contract.created_by ||
              "-"
            }
          />

          <Row
            label="تاريخ الإنشاء"
            value={formatDate(
              contract.created_at
            )}
          />

          <Row
            label="آخر تحديث"
            value={formatDate(
              contract.updated_at
            )}
          />
        </InfoCard>

        <InfoCard title="الدفعات الآجلة">
          {hasDeferredPayments ? (
            <>
              <Row
                label="قيمة الدفعة الآجلة"
                value={`${formatMoney(
                  contract.installment_amount
                )} ر.س`}
              />

              <Row
                label="عدد الدفعات الآجلة"
                value={`${
                  contract.deferred_payments_count ||
                  0
                } دفعات`}
              />
            </>
          ) : (
            <div style={emptyBox}>
              لا توجد دفعات آجلة
              لهذا العقد
            </div>
          )}
        </InfoCard>

        <InfoCard title="بيانات الكفيل">
          {hasGuarantor ? (
            <>
              <Row
                label="اسم الكفيل"
                value={
                  contract.guarantor_name ||
                  "-"
                }
              />

              <Row
                label="رقم هوية الكفيل"
                value={
                  contract.guarantor_national_id ||
                  "-"
                }
              />

              <Row
                label="رقم جوال الكفيل"
                value={
                  contract.guarantor_phone ||
                  "-"
                }
              />

              <Row
                label="تاريخ ميلاد الكفيل"
                value={
                  contract.guarantor_birth_hijri ||
                  "-"
                }
              />
            </>
          ) : (
            <div style={emptyBox}>
              لا يوجد كفيل لهذا
              العقد
            </div>
          )}
        </InfoCard>

        <InfoCard title="السند المرتبط">
          {note ? (
            <>
              <Row
                label="رقم السند"
                value={
                  note.note_number ||
                  "-"
                }
              />

              <Row
                label="مبلغ السند"
                value={`${formatMoney(
                  note.amount
                )} ر.س`}
              />

              <Row
                label="تاريخ الاستحقاق"
                value={
                  note.due_date ||
                  "-"
                }
              />

              <Row
                label="حالة السند"
                value={
                  note.status ||
                  "-"
                }
              />
            </>
          ) : (
            <div style={emptyBox}>
              لا يوجد سند مرتبط
              بهذا العقد
            </div>
          )}
        </InfoCard>

        <InfoCard title="سجل الدفعات">
          {payments.length === 0 ? (
            <div style={emptyBox}>
              لا توجد دفعات مسجلة
            </div>
          ) : (
            payments.map(
              (payment) => {
                const isCancelling =
                  cancellingPaymentId ===
                  payment.id;

                return (
                  <div
                    key={payment.id}
                    className="payment-row"
                    style={{
                      ...paymentRow,

                      opacity:
                        payment.is_cancelled
                          ? 0.6
                          : 1,
                    }}
                  >
                    <span>
                      💰{" "}
                      {formatMoney(
                        payment.payment_amount
                      )}{" "}
                      ر.س
                    </span>

                    <span>
                      {payment.is_cancelled
                        ? "❌ ملغية"
                        : `💳 ${
                            payment.payment_type ||
                            "-"
                          }`}
                    </span>

                    <span>
                      📅{" "}
                      {formatDateOnly(
                        payment.created_at
                      )}
                    </span>

                    <div
                      className="payment-actions"
                      style={
                        paymentActions
                      }
                    >
                      <button
                        type="button"
                        style={
                          receiptButton
                        }
                        onClick={() =>
                          router.push(
                            `/finance/${branch}/payments/receipt/${payment.id}`
                          )
                        }
                        disabled={
                          Boolean(
                            payment.is_cancelled
                          ) ||
                          isCancelling
                        }
                      >
                        🧾 طباعة الإيصال
                      </button>

                      <button
                        type="button"
                        style={
                          cancelButton
                        }
                        onClick={() =>
                          void cancelPayment(
                            payment
                          )
                        }
                        disabled={
                          Boolean(
                            payment.is_cancelled
                          ) ||
                          isCancelling
                        }
                      >
                        {isCancelling
                          ? "جاري الإلغاء..."
                          : "⛔ إلغاء"}
                      </button>
                    </div>
                  </div>
                );
              }
            )
          )}
        </InfoCard>

        <section
          style={actionsSection}
        >
          {!isFullyPaid && (
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
              onClick={() =>
                router.push(
                  `/finance/${branch}/new-request/print/${contractId}/${note.id}`
                )
              }
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

          {isFullyPaid && (
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

          {isFullyPaid && (
            <ActionButton
              icon="🔄"
              title={
                reopeningContract
                  ? "جاري إعادة التنشيط..."
                  : "إعادة تنشيط العقد"
              }
              onClick={() =>
                void reopenContract()
              }
              disabled={
                reopeningContract
              }
            />
          )}

          {!isFullyPaid && (
            <ActionButton
              icon="🔒"
              title={
                closingContract
                  ? "جاري إغلاق العقد..."
                  : "إغلاق العقد"
              }
              onClick={() =>
                void closeContract()
              }
              disabled={
                closingContract
              }
            />
          )}
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

      <GlobalResponsiveStyles />
    </main>
  );
}

function PageHero({
  screen,
  employeeName,
  title,
  status,
  onLogout,
  onHome,
}: {
  screen: ScreenType;
  employeeName: string;
  title: string;
  status?: ReactNode;
  onLogout: () => void;
  onHome: () => void;
}) {
  const isMobile =
    screen === "mobile";

  return (
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
              onClick={onLogout}
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
            onClick={onHome}
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
            {title}
          </h1>
        </div>

        <div
          style={getHeroActionBoxStyle(
            screen
          )}
        >
          {status}
        </div>
      </div>
    </header>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={card}>
      <h2 style={sectionTitle}>
        {title}
      </h2>

      {children}
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  return (
    <div style={row}>
      <span>{label}</span>

      <strong style={rowValue}>
        {value || "-"}
      </strong>
    </div>
  );
}

function SummaryBox({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
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
        <span style={buttonIcon}>
          {icon}
        </span>

        {title}
      </span>
    </button>
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

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        overflow-x: hidden;
      }

      button {
        -webkit-tap-highlight-color: transparent;
      }

      button:disabled {
        cursor: not-allowed !important;
        opacity: 0.65;
      }

      @media (max-width: 760px) {
        .payment-row {
          grid-template-columns: 1fr !important;
        }

        .payment-actions {
          justify-content: stretch !important;
          flex-direction: column !important;
        }

        .payment-actions button {
          width: 100% !important;
        }
      }
    `}</style>
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

    color: "#0f172a",
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
        : 1180,

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

      gridTemplateColumns:
        "1fr",

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

    fontSize:
      isMobile
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
    width:
      isMobile
        ? "100%"
        : 220,

    maxWidth:
      isMobile
        ? 280
        : 220,

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

    fontFamily:
      "var(--font-almarai), sans-serif",

    fontSize:
      screen === "mobile"
        ? 24
        : screen === "tablet"
          ? 26
          : 28,

    lineHeight: 1.35,

    fontWeight: 900,

    letterSpacing: "-0.4px",

    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",

    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
  if (screen === "mobile") {
    return {
      display: "flex",

      justifyContent: "center",
      alignItems: "center",

      width: "100%",

      order: 3,
    };
  }

  if (screen === "tablet") {
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

    justifyContent: "center",
    alignItems: "flex-end",

    direction: "rtl",
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

  background:
    "transparent",

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

  backgroundSize:
    "14px 14px",

  zIndex: 2,
};

const loadingBox: CSSProperties = {
  background: "#ffffff",

  border:
    "1px solid #d9e3f5",

  borderRadius: 18,

  padding: 20,

  textAlign: "center",

  color: "#0d47a1",

  fontWeight: 900,

  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const summaryGrid: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",

  gap: 14,

  marginBottom: 16,
};

const summaryBox: CSSProperties = {
  background: "#ffffff",

  border:
    "1px solid #d9e3f5",

  borderRadius: 18,

  padding: 18,

  display: "flex",

  justifyContent:
    "space-between",

  gap: 12,

  color: "#0d47a1",

  fontWeight: 900,

  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const card: CSSProperties = {
  background: "#ffffff",

  border:
    "1px solid #d9e3f5",

  borderRadius: 18,

  padding: 20,

  marginBottom: 16,

  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const sectionTitle: CSSProperties = {
  marginTop: 0,

  fontSize: 22,

  color: "#0d47a1",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const row: CSSProperties = {
  display: "flex",

  justifyContent:
    "space-between",

  alignItems: "center",

  gap: 12,

  padding: "12px 0",

  borderBottom:
    "1px solid #eef2f7",

  flexWrap: "wrap",
};

const rowValue: CSSProperties = {
  textAlign: "left",
};

const customerNameButton: CSSProperties = {
  background:
    "transparent",

  border: "none",

  padding: 0,

  color: "#0d47a1",

  fontSize: 16,

  fontWeight: 900,

  cursor: "pointer",

  textDecoration:
    "underline",

  fontFamily: "inherit",
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",

  border:
    "1px dashed #cbd5e1",

  borderRadius: 14,

  padding: 18,

  textAlign: "center",

  color: "#6b7280",
};

const paymentRow: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "1fr 1fr 1fr 260px",

  gap: 12,

  padding: 14,

  borderBottom:
    "1px solid #eef2f7",

  alignItems: "center",
};

const paymentActions: CSSProperties = {
  display: "flex",

  gap: 8,

  justifyContent:
    "flex-end",
};

const receiptButton: CSSProperties = {
  background: "#e0f2fe",

  color: "#075985",

  border: "none",

  borderRadius: 12,

  padding: "10px 12px",

  cursor: "pointer",

  fontWeight: 900,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const cancelButton: CSSProperties = {
  background: "#fee2e2",

  color: "#991b1b",

  border: "none",

  borderRadius: 12,

  padding: "10px 12px",

  cursor: "pointer",

  fontWeight: 900,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const actionsSection: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",

  gap: 14,

  marginBottom: 16,
};

const actionButton: CSSProperties = {
  background: "#ffffff",

  border:
    "1px solid #d9e3f5",

  borderRadius: 18,

  padding: 18,

  fontSize: 16,

  fontWeight: 900,

  cursor: "pointer",

  color: "#0d47a1",

  fontFamily:
    "var(--font-almarai), sans-serif",

  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const buttonContent: CSSProperties = {
  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  gap: 10,
};

const buttonIcon: CSSProperties = {
  fontSize: 20,
};

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

const paidStatus: CSSProperties = {
  background: "#dbeafe",

  color: "#1d4ed8",

  borderRadius: 999,

  padding: "8px 14px",

  fontWeight: 900,

  whiteSpace: "nowrap",
};

const cancelledStatus: CSSProperties = {
  background: "#fee2e2",

  color: "#991b1b",

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
