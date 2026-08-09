"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  clearFinanceSession,
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  logoutFinanceUser,
  redirectToFinanceLogin,
  validateFinanceSession,
  type FinanceSessionUser,
} from "@/lib/financeSession";

type ScreenType = "mobile" | "tablet" | "desktop";

const MANAGER_ROLES = new Set([
  "main_admin",
  "branch_manager",
  "مدير رئيسي",
  "مدير فرع",
  "مدير",
]);

type Customer = {
  id: string;
  full_name?: string | null;
  national_id?: string | null;
  birth_hijri?: string | null;
  phone?: string | null;
  work_name?: string | null;
  work?: string | null;
  address?: string | null;
  salary?: number | string | null;
  bank?: string | null;
  broker?: string | null;
  updated_at?: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
  archived_by?: string | null;
  finance_customer_groups?: {
    name?: string | null;
  } | null;
};

type Contract = {
  id: string;
  contract_number?: string | number | null;
  contract_status?: string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;
  payment_due_date?: string | null;
};

type PromissoryNote = {
  id: string;
  note_number?: string | number | null;
  status?: string | null;
  amount?: number | string | null;
};

type ActivityLog = {
  id: string;
  activity_type?: string | null;
  description?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type SupabaseRpcError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export default function FinanceCustomerProfilePage() {
  const params = useParams();
  const router = useRouter();

  const branch =
    typeof params.branch === "string"
      ? params.branch.trim().toLowerCase()
      : "";

  const customerId =
    typeof params.id === "string"
      ? params.id.trim()
      : "";

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [sessionUser, setSessionUser] =
    useState<FinanceSessionUser | null>(null);

  const [authChecked, setAuthChecked] =
    useState(false);

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [activeContracts, setActiveContracts] =
    useState<Contract[]>([]);

  const [closedContracts, setClosedContracts] =
    useState<Contract[]>([]);

  const [notes, setNotes] =
    useState<PromissoryNote[]>([]);

  const [activities, setActivities] =
    useState<ActivityLog[]>([]);

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [editing, setEditing] =
    useState(false);

  const [actionsOpen, setActionsOpen] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [fullName, setFullName] =
    useState("");

  const [nationalId, setNationalId] =
    useState("");

  const [birthHijri, setBirthHijri] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [workName, setWorkName] =
    useState("");

  const [address, setAddress] =
    useState("");

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;
  const isManager = Boolean(
    sessionUser &&
      MANAGER_ROLES.has(
        sessionUser.role
      )
  );
  const canCreateRequest = Boolean(
    sessionUser &&
      (isManager ||
        sessionUser.permissions.includes(
          "new_request_create"
        ))
  );
  const canEditCustomer = Boolean(
    sessionUser &&
      (isManager ||
        sessionUser.permissions.includes(
          "customers_edit"
        ))
  );
  const hasCustomerActions =
    canCreateRequest || canEditCustomer;

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
      setLoading(true);
      setAuthChecked(false);
      setBranchId(null);

      if (!branch) {
        clearFinanceSession();
        router.replace("/login");
        return;
      }

      if (!customerId) {
        resetPageData();
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      const validation =
        validateFinanceSession(branch);

      if (
        !validation.valid ||
        !validation.user
      ) {
        redirectToFinanceLogin(router, {
          branchSlug: branch,
        });

        return;
      }

      const authenticatedUser =
        validation.user;

      const currentBranchId = String(
        authenticatedUser.branch_id || ""
      ).trim();

      if (!currentBranchId) {
        clearFinanceSession();

        redirectToFinanceLogin(router, {
          branchSlug: branch,
        });

        return;
      }

      if (cancelled) {
        return;
      }

      setSessionUser(authenticatedUser);
      setBranchId(currentBranchId);

      setEmployeeName(
        getFinanceEmployeeName(
          authenticatedUser
        )
      );

      setAuthChecked(true);

      await loadData(
        currentBranchId,
        () => cancelled
      );
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [branch, customerId, router]);

  useEffect(() => {
    if (
      !authChecked ||
      !sessionUser
    ) {
      return;
    }

    const uninstall =
      installFinanceActivityTracker({
        expectedBranchSlug: branch,

        onExpired: () => {
          redirectToFinanceLogin(router, {
            branchSlug: branch,
          });
        },

        onInvalidated: () => {
          clearFinanceSession();
          router.replace("/login");
        },

        onSessionUpdated: (
          updatedUser
        ) => {
          const updatedBranchId = String(
            updatedUser.branch_id || ""
          ).trim();

          if (!updatedBranchId) {
            clearFinanceSession();
            router.replace("/login");
            return;
          }

          setSessionUser(updatedUser);
          setBranchId(updatedBranchId);

          setEmployeeName(
            getFinanceEmployeeName(
              updatedUser
            )
          );
        },
      });

    return uninstall;
  }, [
    authChecked,
    branch,
    router,
    sessionUser?.id,
  ]);

  const allContracts = useMemo(
    () => [
      ...activeContracts,
      ...closedContracts,
    ],
    [activeContracts, closedContracts]
  );

  const totalRemaining = useMemo(() => {
    return activeContracts.reduce(
      (sum, contract) =>
        sum +
        Number(
          contract.remaining_amount || 0
        ),
      0
    );
  }, [activeContracts]);

  const totalPaid = useMemo(() => {
    return allContracts.reduce(
      (sum, contract) =>
        sum +
        Number(
          contract.paid_amount || 0
        ),
      0
    );
  }, [allContracts]);

  const hasLateContract = useMemo(() => {
    return activeContracts.some(
      (contract) =>
        contract.contract_status ===
        "متأخر"
    );
  }, [activeContracts]);

  const customerStatus = hasLateContract
    ? "يوجد تأخير"
    : activeContracts.length > 0
      ? "عميل نشط"
      : closedContracts.length > 0
        ? "عميل سابق"
        : "لا توجد عقود";

  function logout() {
    logoutFinanceUser(router);
  }

  function resetPageData() {
    setCustomer(null);
    setActiveContracts([]);
    setClosedContracts([]);
    setNotes([]);
    setActivities([]);
    setEditing(false);
    setActionsOpen(false);
  }

  async function loadData(
    currentBranchId: string,
    isCancelled: () => boolean =
      () => false
  ) {
    try {
      setLoading(true);

      const safeBranchId =
        currentBranchId.trim();

      if (
        !safeBranchId ||
        !customerId
      ) {
        resetPageData();
        return;
      }

      const {
        data: customerData,
        error: customerError,
      } = await supabase
        .from("finance_customers")
        .select(
          "*, finance_customer_groups(name)"
        )
        .eq("id", customerId)
        .eq("branch_id", safeBranchId)
        .or(
          "is_archived.is.null,is_archived.eq.false"
        )
        .maybeSingle();

      if (isCancelled()) {
        return;
      }

      if (customerError) {
        throw new Error(
          customerError.message
        );
      }

      if (!customerData) {
        resetPageData();

        router.replace(
          `/finance/${branch}/customers`
        );

        router.refresh();
        return;
      }

      const [
        activeResponse,
        closedResponse,
        notesResponse,
        activitiesResponse,
      ] = await Promise.all([
        supabase
          .from("finance_contracts")
          .select(
            `
              id,
              contract_number,
              contract_status,
              paid_amount,
              remaining_amount,
              payment_due_date
            `
          )
          .eq(
            "customer_id",
            customerId
          )
          .eq(
            "branch_id",
            safeBranchId
          )
          .or(
            "is_archived.is.null,is_archived.eq.false"
          )
          .in(
            "contract_status",
            ["نشط", "متأخر", "متعثر"]
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("finance_contracts")
          .select(
            `
              id,
              contract_number,
              contract_status,
              paid_amount,
              remaining_amount,
              payment_due_date
            `
          )
          .eq(
            "customer_id",
            customerId
          )
          .eq(
            "branch_id",
            safeBranchId
          )
          .or(
            "is_archived.is.null,is_archived.eq.false"
          )
          .in(
            "contract_status",
            ["تم السداد", "ملغي", "مغلق"]
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from(
            "finance_promissory_notes"
          )
          .select(
            `
              id,
              note_number,
              status,
              amount
            `
          )
          .eq(
            "customer_id",
            customerId
          )
          .eq(
            "branch_id",
            safeBranchId
          )
          .or(
            "is_archived.is.null,is_archived.eq.false"
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from(
            "finance_activity_logs"
          )
          .select(
            `
              id,
              activity_type,
              description,
              status,
              created_at
            `
          )
          .eq(
            "customer_id",
            customerId
          )
          .eq(
            "branch_id",
            safeBranchId
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(20),
      ]);

      if (isCancelled()) {
        return;
      }

      if (activeResponse.error) {
        throw new Error(
          activeResponse.error.message ||
            "تعذر تحميل العقود الحالية"
        );
      }

      if (closedResponse.error) {
        throw new Error(
          closedResponse.error.message ||
            "تعذر تحميل العقود السابقة"
        );
      }

      if (notesResponse.error) {
        throw new Error(
          notesResponse.error.message ||
            "تعذر تحميل السندات"
        );
      }

      if (activitiesResponse.error) {
        throw new Error(
          activitiesResponse.error.message ||
            "تعذر تحميل سجل العمليات"
        );
      }

      const typedCustomer =
        customerData as Customer;

      setCustomer(typedCustomer);

      setActiveContracts(
        (activeResponse.data ||
          []) as Contract[]
      );

      setClosedContracts(
        (closedResponse.data ||
          []) as Contract[]
      );

      setNotes(
        (notesResponse.data ||
          []) as PromissoryNote[]
      );

      setActivities(
        (activitiesResponse.data ||
          []) as ActivityLog[]
      );

      setFullName(
        typedCustomer.full_name || ""
      );

      setNationalId(
        normalizeDigits(
          typedCustomer.national_id || ""
        )
      );

      setBirthHijri(
        normalizeDigits(
          typedCustomer.birth_hijri || ""
        )
      );

      setPhone(
        normalizeDigits(
          typedCustomer.phone || ""
        )
      );

      setWorkName(
        typedCustomer.work_name ||
          typedCustomer.work ||
          ""
      );

      setAddress(
        typedCustomer.address || ""
      );
    } catch (error) {
      if (isCancelled()) {
        return;
      }

      resetPageData();

      const message =
        error instanceof Error
          ? error.message
          : "تعذر تحميل ملف العميل";

      alert(message);
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  function normalizeDigits(
    value: string
  ) {
    return value
      .replace(
        /[٠-٩]/g,
        (digit) =>
          String(
            "٠١٢٣٤٥٦٧٨٩".indexOf(
              digit
            )
          )
      )
      .replace(
        /[۰-۹]/g,
        (digit) =>
          String(
            "۰۱۲۳۴۵۶۷۸۹".indexOf(
              digit
            )
          )
      );
  }

  async function saveCustomer() {
    if (
      saving ||
      deleting
    ) {
      return;
    }

    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    const safeBranchId =
      branchId.trim();

    const cleanFullName =
      fullName.trim();

    const cleanNationalId =
      normalizeDigits(nationalId)
        .replace(/\D/g, "")
        .trim();

    const cleanPhone =
      normalizeDigits(phone)
        .replace(/\D/g, "")
        .trim();

    const cleanBirthHijri =
      normalizeDigits(
        birthHijri
      ).trim();

    const cleanWorkName =
      workName.trim();

    const cleanAddress =
      address.trim();

    if (!cleanFullName) {
      alert(
        "يرجى إدخال اسم العميل"
      );
      return;
    }

    if (
      !/^\d{10}$/.test(
        cleanNationalId
      )
    ) {
      alert(
        "رقم الهوية يجب أن يكون 10 أرقام"
      );
      return;
    }

    if (
      !/^05\d{8}$/.test(cleanPhone)
    ) {
      alert(
        "رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05"
      );
      return;
    }

    try {
      setSaving(true);

      const response =
        await fetch(
          "/finance/api/customers/update",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials:
              "same-origin",
            body: JSON.stringify({
              branch,
              customerId,
              fullName:
                cleanFullName,
              nationalId:
                cleanNationalId,
              birthHijri:
                cleanBirthHijri ||
                null,
              phone: cleanPhone,
              workName:
                cleanWorkName ||
                null,
              address:
                cleanAddress ||
                null,
            }),
          }
        );

      const payload =
        (await response
          .json()
          .catch(
            () => null
          )) as
          | {
              ok?: boolean;
              message?: string;
              code?: string;
            }
          | null;

      if (
        !response.ok ||
        payload?.ok === false
      ) {
        throw new Error(
          getCustomerUpdateErrorMessage(
            payload?.message ||
              payload?.code ||
              "تعذر حفظ بيانات العميل"
          )
        );
      }

      alert(
        "تم حفظ بيانات العميل بنجاح"
      );

      setEditing(false);

      await loadData(
        safeBranchId
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر حفظ بيانات العميل";

      alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer() {
    if (
      deleting ||
      saving
    ) {
      return;
    }

    if (
      !branchId ||
      !customer
    ) {
      alert(
        "تعذر تحديد بيانات العميل أو الفرع"
      );
      return;
    }

    const confirmed =
      window.confirm(
        "هل انت متأكد من حذف العميل ؟ في حال الحذف سيتم حذف العقود والسندات ان وجدت"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);

      const response =
        await fetch(
          "/finance/api/customers/archive",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials:
              "same-origin",
            body: JSON.stringify({
              branch,
              customerId,
            }),
          }
        );

      const payload =
        (await response
          .json()
          .catch(
            () => null
          )) as
          | {
              ok?: boolean;
              message?: string;
              code?: string;
            }
          | null;

      if (
        !response.ok ||
        payload?.ok === false
      ) {
        throw new Error(
          getCustomerDeleteErrorMessage(
            {
              message:
                payload?.message,
              details:
                payload?.code,
            }
          )
        );
      }

      alert(
        "تم حذف العميل والعقود والسندات المرتبطة بنجاح"
      );

      resetPageData();
      setLoading(true);

      router.replace(
        `/finance/${branch}/customers`
      );

      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر حذف العميل";

      alert(message);
    } finally {
      setDeleting(false);
    }
  }

  function getCustomerUpdateErrorMessage(
    message: string
  ) {
    if (
      message.includes("23505") ||
      message
        .toLowerCase()
        .includes("duplicate")
    ) {
      return "رقم الهوية مستخدم لعميل آخر داخل الفرع";
    }

    if (
      message.includes(
        "CUSTOMER_NOT_FOUND"
      )
    ) {
      return "العميل غير موجود أو لا يتبع هذا الفرع";
    }

    return (
      message ||
      "تعذر حفظ بيانات العميل"
    );
  }

  function getCustomerDeleteErrorMessage(
    error: SupabaseRpcError
  ) {
    const combinedMessage = [
      error.message,
      error.details,
      error.hint,
    ]
      .filter(Boolean)
      .join(" ");

    if (
      combinedMessage.includes(
        "CUSTOMER_HAS_CONTRACTS"
      )
    ) {
      return "تعذر حذف العميل والعقود المرتبطة به";
    }

    if (
      combinedMessage.includes(
        "CUSTOMER_HAS_NOTES"
      )
    ) {
      return "تعذر حذف العميل والسندات المرتبطة به";
    }

    if (
      combinedMessage.includes(
        "CUSTOMER_NOT_FOUND"
      )
    ) {
      return "العميل غير موجود أو لا يتبع هذا الفرع";
    }

    if (
      combinedMessage.includes(
        "BRANCH_REQUIRED"
      )
    ) {
      return "تعذر تحديد الفرع";
    }

    if (
      combinedMessage.includes(
        "CUSTOMER_REQUIRED"
      )
    ) {
      return "تعذر تحديد العميل";
    }

    if (
      combinedMessage.includes(
        "CUSTOMER_ARCHIVE_FAILED"
      ) ||
      combinedMessage.includes(
        "CUSTOMER_DELETE_FAILED"
      )
    ) {
      return "تعذر حذف العميل والعقود والسندات المرتبطة";
    }

    return (
      combinedMessage ||
      "تعذر حذف العميل والعقود والسندات المرتبطة"
    );
  }

  function cancelEditing() {
    setFullName(
      customer?.full_name || ""
    );

    setNationalId(
      normalizeDigits(
        customer?.national_id || ""
      )
    );

    setBirthHijri(
      normalizeDigits(
        customer?.birth_hijri || ""
      )
    );

    setPhone(
      normalizeDigits(
        customer?.phone || ""
      )
    );

    setWorkName(
      customer?.work_name ||
        customer?.work ||
        ""
    );

    setAddress(
      customer?.address || ""
    );

    setEditing(false);
  }

  function formatDate(
    date?: string | null
  ) {
    if (!date) {
      return "-";
    }

    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return "-";
    }

    return parsedDate.toLocaleString(
      "ar-SA",
      {
        dateStyle: "short",
        timeStyle: "short",
      }
    );
  }

  function formatMoney(
    value: unknown
  ) {
    const number =
      Number(value || 0);

    if (
      !Number.isFinite(number)
    ) {
      return "0.00";
    }

    return number.toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function openContract(
    contractId: string
  ) {
    router.push(
      `/finance/${branch}/contracts/${contractId}`
    );
  }

  function openPromissoryNote(
    noteId: string
  ) {
    router.push(
      `/finance/${branch}/contracts/promissory-note/print/${noteId}`
    );
  }

  function renderPage(
    content: ReactNode
  ) {
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
            onLogout={logout}
            onHome={() =>
              router.push(
                `/finance/${branch}`
              )
            }
          />

          {content}
        </div>

        <GlobalResponsiveStyles />
      </main>
    );
  }

  if (
    !authChecked ||
    loading
  ) {
    return renderPage(
      <div style={loadingBox}>
        جاري تحميل ملف العميل...
      </div>
    );
  }

  if (!customer) {
    return renderPage(
      <div style={emptyPageCard}>
        <h2 style={{ margin: 0 }}>
          لم يتم العثور على العميل
        </h2>

        <div
          style={bottomBackWrapper}
        >
          <button
            type="button"
            style={backButton}
            onClick={() =>
              router.back()
            }
          >
            ← الرجوع
          </button>
        </div>
      </div>
    );
  }

  return renderPage(
    <>
      <section style={statsGrid}>
        <StatCard
          icon="📄"
          title="العقود النشطة"
          value={
            activeContracts.length
          }
        />

        <StatCard
          icon="✅"
          title="العقود السابقة"
          value={
            closedContracts.length
          }
        />

        <StatCard
          icon="💰"
          title="إجمالي المسدد"
          value={`${formatMoney(
            totalPaid
          )} ر.س`}
        />

        <StatCard
          icon="⚠️"
          title="إجمالي المتبقي"
          value={`${formatMoney(
            totalRemaining
          )} ر.س`}
        />
      </section>

      <section
        style={getMainGridStyle(
          screen
        )}
      >
        <section style={card}>
          <div style={cardHeader}>
            <h2 style={sectionTitle}>
              بيانات العميل
            </h2>

            {!editing &&
              hasCustomerActions && (
              <div
                style={
                  customerActions
                }
              >
                <button
                  type="button"
                  style={
                    editMiniButton
                  }
                  onClick={() =>
                    setActionsOpen(
                      (current) =>
                        !current
                    )
                  }
                  disabled={
                    deleting || saving
                  }
                  aria-haspopup="menu"
                  aria-expanded={
                    actionsOpen
                  }
                >
                  الإجراءات
                </button>

                {actionsOpen && (
                  <div
                    role="menu"
                    style={actionsMenu}
                  >
                    {canCreateRequest && (
                      <button
                        type="button"
                        role="menuitem"
                        style={actionsMenuItem}
                        onClick={() => {
                          setActionsOpen(false);
                          router.push(
                            `/finance/${branch}/new-request`
                          );
                        }}
                      >
                        طلب جديد
                      </button>
                    )}

                    {canEditCustomer && (
                      <button
                        type="button"
                        role="menuitem"
                        style={actionsMenuItem}
                        onClick={() => {
                          setActionsOpen(false);
                          setEditing(true);
                        }}
                        disabled={deleting}
                      >
                        تعديل بيانات العميل
                      </button>
                    )}

                    {canEditCustomer && (
                      <button
                        type="button"
                        role="menuitem"
                        style={{
                          ...actionsMenuItem,
                          ...deleteMiniButton,
                          opacity:
                            deleting
                              ? 0.65
                              : 1,
                          cursor:
                            deleting
                              ? "not-allowed"
                              : "pointer",
                        }}
                        onClick={() => {
                          setActionsOpen(false);
                          void deleteCustomer();
                        }}
                        disabled={
                          deleting ||
                          saving
                        }
                      >
                        {deleting
                          ? "جاري الحذف..."
                          : "حذف العميل"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={infoGrid}>
            <EditableInfo
              label="الاسم كاملاً"
              value={fullName}
              editing={editing}
              onChange={setFullName}
            />

            <EditableInfo
              label="رقم الهوية"
              value={nationalId}
              editing={editing}
              onChange={(value) =>
                setNationalId(
                  normalizeDigits(
                    value
                  ).replace(
                    /\D/g,
                    ""
                  )
                )
              }
              inputMode="numeric"
              maxLength={10}
            />

            <EditableInfo
              label="تاريخ الميلاد بالهجري"
              value={birthHijri}
              editing={editing}
              onChange={(value) =>
                setBirthHijri(
                  normalizeDigits(
                    value
                  )
                )
              }
            />

            <EditableInfo
              label="رقم الجوال"
              value={phone}
              editing={editing}
              onChange={(value) =>
                setPhone(
                  normalizeDigits(
                    value
                  ).replace(
                    /\D/g,
                    ""
                  )
                )
              }
              inputMode="numeric"
              maxLength={10}
            />

            <EditableInfo
              label="العمل"
              value={workName}
              editing={editing}
              onChange={setWorkName}
            />

            <EditableInfo
              label="العنوان"
              value={address}
              editing={editing}
              onChange={setAddress}
            />

            <InfoItem
              label="الراتب"
              value={
                customer.salary || "-"
              }
            />

            <InfoItem
              label="البنك"
              value={
                customer.bank || "-"
              }
            />

            <InfoItem
              label="الوسيط"
              value={
                customer.broker || "-"
              }
            />

            <InfoItem
              label="مجموعة العملاء"
              value={
                customer
                  .finance_customer_groups
                  ?.name || "-"
              }
            />
          </div>

          {editing && (
            <div style={editActions}>
              <button
                type="button"
                style={saveButton}
                onClick={saveCustomer}
                disabled={
                  saving ||
                  deleting
                }
              >
                {saving
                  ? "جاري الحفظ..."
                  : "حفظ التعديلات"}
              </button>

              <button
                type="button"
                style={
                  cancelEditButton
                }
                onClick={
                  cancelEditing
                }
                disabled={
                  saving ||
                  deleting
                }
              >
                إلغاء التعديل
              </button>
            </div>
          )}
        </section>

        <aside style={sideCard}>
          <h2 style={sideTitle}>
            {customerStatus}
          </h2>

          <div style={sideList}>
            <InfoLine
              label="عدد السندات"
              value={notes.length}
            />

            <InfoLine
              label="عدد العمليات"
              value={
                activities.length
              }
            />

            <InfoLine
              label="المجموعة"
              value={
                customer
                  .finance_customer_groups
                  ?.name || "-"
              }
            />

            <InfoLine
              label="آخر تحديث"
              value={formatDate(
                customer.updated_at
              )}
            />
          </div>
        </aside>
      </section>

      <section
        style={twoColumnsGrid}
      >
        <section style={card}>
          <div style={cardHeader}>
            <h2 style={sectionTitle}>
              العقود الحالية
            </h2>

            <span style={countBadge}>
              {activeContracts.length}
            </span>
          </div>

          {activeContracts.length ===
          0 ? (
            <div style={emptyBox}>
              لا توجد عقود حالية
            </div>
          ) : (
            <div style={listBox}>
              {activeContracts.map(
                (contract) => (
                  <ContractItem
                    key={
                      contract.id
                    }
                    contract={
                      contract
                    }
                    type="active"
                    onClick={() =>
                      openContract(
                        contract.id
                      )
                    }
                    formatMoney={
                      formatMoney
                    }
                  />
                )
              )}
            </div>
          )}
        </section>

        <section style={card}>
          <div style={cardHeader}>
            <h2 style={sectionTitle}>
              العقود السابقة
            </h2>

            <span style={countBadge}>
              {closedContracts.length}
            </span>
          </div>

          {closedContracts.length ===
          0 ? (
            <div style={emptyBox}>
              لا توجد عقود سابقة
            </div>
          ) : (
            <div style={listBox}>
              {closedContracts.map(
                (contract) => (
                  <ContractItem
                    key={
                      contract.id
                    }
                    contract={
                      contract
                    }
                    type="closed"
                    onClick={() =>
                      openContract(
                        contract.id
                      )
                    }
                    formatMoney={
                      formatMoney
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </section>

      <section
        style={twoColumnsGrid}
      >
        <section style={card}>
          <div style={cardHeader}>
            <h2 style={sectionTitle}>
              السندات المرتبطة
            </h2>

            <span style={countBadge}>
              {notes.length}
            </span>
          </div>

          {notes.length === 0 ? (
            <div style={emptyBox}>
              لا توجد سندات مرتبطة
              بالعميل
            </div>
          ) : (
            <div style={listBox}>
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  style={noteItem}
                  onClick={() =>
                    openPromissoryNote(
                      note.id
                    )
                  }
                >
                  <div>
                    <strong>
                      🧾 سند رقم{" "}
                      {note.note_number ||
                        "-"}
                    </strong>

                    <span
                      style={
                        itemSubText
                      }
                    >
                      الحالة:{" "}
                      {note.status ||
                        "-"}{" "}
                      · المبلغ:{" "}
                      {formatMoney(
                        note.amount
                      )}{" "}
                      ر.س
                    </span>
                  </div>

                  <span
                    style={openHint}
                  >
                    فتح
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section style={card}>
          <div style={cardHeader}>
            <h2 style={sectionTitle}>
              سجل العمليات
            </h2>

            <span style={countBadge}>
              {activities.length}
            </span>
          </div>

          {activities.length ===
          0 ? (
            <div style={emptyBox}>
              لا توجد عمليات حتى
              الآن
            </div>
          ) : (
            <div
              style={activityList}
            >
              {activities.map(
                (activity) => (
                  <div
                    key={activity.id}
                    style={
                      activityItem
                    }
                  >
                    <div>
                      <strong>
                        {activity.activity_type ||
                          "-"}
                      </strong>

                      <p
                        style={
                          activityDesc
                        }
                      >
                        {activity.description ||
                          "-"}
                      </p>
                    </div>

                    <div
                      style={
                        activityMeta
                      }
                    >
                      <span>
                        {activity.status ||
                          "-"}
                      </span>

                      <small>
                        {formatDate(
                          activity.created_at
                        )}
                      </small>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </section>

      <div
        style={bottomBackWrapper}
      >
        <button
          type="button"
          style={backButton}
          onClick={() =>
            router.back()
          }
        >
          ← الرجوع
        </button>
      </div>
    </>
  );
}

function PageHero({
  screen,
  employeeName,
  onLogout,
  onHome,
}: {
  screen: ScreenType;
  employeeName: string;
  onLogout: () => void;
  onHome: () => void;
}) {
  const isMobile =
    screen === "mobile";

  return (
    <header
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

      <div
        style={heroDots}
      />

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
            ملف العميل
          </h1>
        </div>

        <div
          style={getHeroActionBoxStyle(
            screen
          )}
        />
      </div>
    </header>
  );
}

function StatCard({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: ReactNode;
}) {
  return (
    <div style={statCard}>
      <div style={statIcon}>
        {icon}
      </div>

      <div>
        <span style={statTitle}>
          {title}
        </span>

        <strong style={statValue}>
          {value}
        </strong>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={infoItem}>
      <span style={infoLabel}>
        {label}
      </span>

      <strong style={infoValue}>
        {value || "-"}
      </strong>
    </div>
  );
}

function EditableInfo({
  label,
  value,
  editing,
  onChange,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (
    value: string
  ) => void;
  inputMode?:
    | "text"
    | "numeric"
    | "decimal"
    | "tel";
  maxLength?: number;
}) {
  return (
    <div style={infoItem}>
      <span style={infoLabel}>
        {label}
      </span>

      {editing ? (
        <input
          style={editInput}
          value={value}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
        />
      ) : (
        <strong style={infoValue}>
          {value || "-"}
        </strong>
      )}
    </div>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={infoLine}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function ContractItem({
  contract,
  type,
  onClick,
  formatMoney,
}: {
  contract: Contract;
  type: "active" | "closed";
  onClick: () => void;
  formatMoney: (
    value: unknown
  ) => string;
}) {
  const isLate =
    contract.contract_status ===
    "متأخر";

  const isClosed =
    contract.contract_status ===
    "مغلق";

  return (
    <button
      type="button"
      style={contractItem}
      onClick={onClick}
    >
      <div style={contractItemTop}>
        <strong>
          {type === "active"
            ? "📄"
            : "✅"}{" "}
          عقد رقم{" "}
          {contract.contract_number ||
            "-"}
        </strong>

        <span
          style={{
            ...contractStatusBadge,
            ...(isLate
              ? contractStatusLate
              : isClosed
                ? contractStatusClosed
                : contractStatusNormal),
          }}
        >
          {contract.contract_status ||
            "-"}
        </span>
      </div>

      <div style={contractItemGrid}>
        <span>
          المسدد:{" "}
          {formatMoney(
            contract.paid_amount
          )}{" "}
          ر.س
        </span>

        <span>
          المتبقي:{" "}
          {formatMoney(
            contract.remaining_amount
          )}{" "}
          ر.س
        </span>

        <span>
          الاستحقاق:{" "}
          {contract.payment_due_date ||
            "-"}
        </span>
      </div>
    </button>
  );
}

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      button,
      input {
        -webkit-tap-highlight-color: transparent;
      }

      button:disabled {
        cursor: not-allowed !important;
        opacity: 0.65;
      }

      @media (max-width: 640px) {
        button {
          touch-action: manipulation;
        }
      }
    `}</style>
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
    backgroundAttachment:
      isMobile
        ? "scroll"
        : "fixed",
    padding: isMobile
      ? 10
      : 18,
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
        ? 27
        : screen === "tablet"
          ? 30
          : 34,
    lineHeight: 1.35,
    fontWeight: 900,
    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
  if (screen !== "desktop") {
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

function getMainGridStyle(
  screen: ScreenType
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns:
      screen === "desktop"
        ? "minmax(0,2fr) minmax(280px,.8fr)"
        : "minmax(0,1fr)",
    gap: 16,
    marginBottom: 16,
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

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(210px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const statCard: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 18,
  display: "flex",
  alignItems: "center",
  gap: 14,
  boxShadow:
    "0 8px 20px rgba(15,23,42,.05)",
};

const statIcon: CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: 16,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
};

const statTitle: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
};

const statValue: CSSProperties = {
  display: "block",
  color: "#0f172a",
  fontSize: 22,
  marginTop: 3,
};

const twoColumnsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(280px,1fr))",
  gap: 16,
  marginBottom: 16,
};

const card: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 18,
  boxShadow:
    "0 8px 20px rgba(15,23,42,.05)",
  minWidth: 0,
};

const sideCard: CSSProperties = {
  background:
    "linear-gradient(135deg,#ffffff,#f8fafc)",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 18,
  boxShadow:
    "0 8px 20px rgba(15,23,42,.05)",
  minWidth: 0,
};

const cardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 14,
  flexWrap: "wrap",
};

const customerActions: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const actionsMenu: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  zIndex: 20,
  width: 220,
  display: "grid",
  gap: 6,
  padding: 8,
  border: "1px solid #dbeafe",
  borderRadius: 14,
  background: "#ffffff",
  boxShadow:
    "0 16px 32px rgba(15,23,42,0.16)",
};

const actionsMenuItem: CSSProperties = {
  width: "100%",
  minHeight: 40,
  border: "none",
  borderRadius: 10,
  padding: "9px 12px",
  background: "#f8fafc",
  color: "#0f172a",
  textAlign: "right",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  color: "#0f172a",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const sideTitle: CSSProperties = {
  margin: "0 0 16px",
  fontSize: 24,
  color: "#0f172a",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const sideList: CSSProperties = {
  display: "grid",
  gap: 10,
};

const infoLine: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 0",
  borderBottom:
    "1px solid #e2e8f0",
  color: "#334155",
};

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
};

const infoItem: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  minHeight: 82,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 8,
  minWidth: 0,
};

const infoLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
};

const infoValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
  lineHeight: 1.7,
  overflowWrap: "anywhere",
};

const editInput: CSSProperties = {
  width: "100%",
  height: 42,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  padding: "0 12px",
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit",
};

const editActions: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(170px,1fr))",
  gap: 10,
  marginTop: 16,
};

const editMiniButton: CSSProperties = {
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#ffffff",
  borderRadius: 11,
  padding: "9px 13px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 5px 12px rgba(37,99,235,0.18)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const deleteMiniButton: CSSProperties = {
  background: "#fef2f2",
  color: "#b91c1c",
};

const saveButton: CSSProperties = {
  padding: 14,
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const cancelEditButton: CSSProperties = {
  padding: 14,
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const countBadge: CSSProperties = {
  minWidth: 34,
  height: 34,
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
};

const listBox: CSSProperties = {
  display: "grid",
  gap: 10,
};

const contractItem: CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 16,
  padding: 14,
  cursor: "pointer",
  textAlign: "right",
  display: "grid",
  gap: 10,
  fontFamily: "inherit",
};

const contractItemTop: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const contractItemGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(125px,1fr))",
  gap: 8,
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
};

const contractStatusBadge: CSSProperties = {
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const contractStatusNormal: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
};

const contractStatusLate: CSSProperties = {
  background: "#ffedd5",
  color: "#9a3412",
};

const contractStatusClosed: CSSProperties = {
  background: "#f1f5f9",
  color: "#334155",
};

const noteItem: CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 16,
  padding: 14,
  cursor: "pointer",
  textAlign: "right",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  fontFamily: "inherit",
};

const itemSubText: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 13,
  marginTop: 7,
  fontWeight: 800,
};

const openHint: CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 900,
};

const activityList: CSSProperties = {
  display: "grid",
  gap: 10,
};

const activityItem: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 16,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const activityDesc: CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  lineHeight: 1.7,
  fontSize: 13,
};

const activityMeta: CSSProperties = {
  display: "grid",
  gap: 6,
  textAlign: "left",
  color: "#64748b",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border:
    "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 20,
  textAlign: "center",
  color: "#6b7280",
  fontWeight: 800,
};

const bottomBackWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "10px 17px",
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 11,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const emptyPageCard: CSSProperties = {
  marginTop: 30,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 28,
  textAlign: "center",
  boxShadow:
    "0 8px 20px rgba(15,23,42,.05)",
};

const loadingBox: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  textAlign: "center",
  color: "#0d47a1",
  fontWeight: 900,
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};
