"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  logoutFinanceUser,
  redirectToFinanceLogin,
  renewFinanceSession,
  validateFinanceSession,
} from "@/lib/financeSession";

const ITEMS_PER_PAGE = 25;
const SUPPORT_SESSION_TIMEOUT_MS = 1200;

type ScreenType = "mobile" | "tablet" | "desktop";
type SessionType = "branch_user" | "admin_support" | null;
type ListFilter = "active" | "inactive" | "all";

type FinanceUser = {
  id: string;
  branch_id: string;
  branch_slug: string;
  branch_name?: string;
  organization_name?: string;
  full_name?: string;
  username?: string;
  role?: string;
  permissions?: string[];
  is_active?: boolean;
};

type SupportSessionResponse = {
  ok: boolean;
  message?: string;
  session_type?: "admin_support";
  user?: FinanceUser;
};

type BlocklistRow = {
  id: string;
  branch_id: string;
  customer_id: string | null;
  national_id: string;
  customer_name: string;
  phone: string | null;
  block_reason: string;
  notes: string | null;
  is_active: boolean;
  blocked_at: string;
  blocked_by_name: string | null;
  unblocked_at: string | null;
  unblocked_by_name: string | null;
  unblock_reason: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerSearchRow = {
  id: string;
  full_name: string | null;
  national_id: string | null;
  phone: string | null;
};

type AddBlockForm = {
  customer_id: string | null;
  customer_name: string;
  national_id: string;
  phone: string;
  block_reason: string;
  notes: string;
};

const MANAGER_ROLES = [
  "main_admin",
  "branch_manager",
  "admin",
  "manager",
  "مدير فرع",
  "مدير رئيسي",
  "مدير",
];

const EMPTY_ADD_FORM: AddBlockForm = {
  customer_id: null,
  customer_name: "",
  national_id: "",
  phone: "",
  block_reason: "",
  notes: "",
};

export default function CustomerBlocklistPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "")
    .trim()
    .toLowerCase();

  const [screen, setScreen] = useState<ScreenType>("desktop");

  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [sessionType, setSessionType] = useState<SessionType>(null);
  const [employeeName, setEmployeeName] = useState("الموظف");
  const [organizationName, setOrganizationName] = useState("احتساب");
  const [branchId, setBranchId] = useState<string | null>(null);

  const [role, setRole] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);

  const [rows, setRows] = useState<BlocklistRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [listFilter, setListFilter] = useState<ListFilter>("active");
  const [currentPage, setCurrentPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddBlockForm>(EMPTY_ADD_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [customerSearchText, setCustomerSearchText] = useState("");
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<
    CustomerSearchRow[]
  >([]);

  const [selectedUnblockRow, setSelectedUnblockRow] =
    useState<BlocklistRow | null>(null);
  const [unblockReason, setUnblockReason] = useState("");
  const [unblockError, setUnblockError] = useState("");
  const [unblockLoading, setUnblockLoading] = useState(false);

  const [logoutLoading, setLogoutLoading] = useState(false);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;
  const isSupportSession = sessionType === "admin_support";

  const isManager = useMemo(
    () =>
      role === "support_impersonation" ||
      MANAGER_ROLES.includes(role),
    [role]
  );

  const canView = isManager || permissions.includes("customer_blocklist_view");
  const canAdd = isManager || permissions.includes("customer_blocklist_add");
  const canRemove =
    isManager || permissions.includes("customer_blocklist_remove");

  const filteredRows = useMemo(() => {
    const cleanSearch = normalizeSearch(searchText);

    return rows.filter((row) => {
      const matchesFilter =
        listFilter === "all" ||
        (listFilter === "active" && row.is_active) ||
        (listFilter === "inactive" && !row.is_active);

      if (!matchesFilter) {
        return false;
      }

      if (!cleanSearch) {
        return true;
      }

      const values = [
        row.customer_name,
        row.national_id,
        row.phone || "",
        row.block_reason,
        row.blocked_by_name || "",
      ];

      return values.some((value) =>
        normalizeSearch(value).includes(cleanSearch)
      );
    });
  }, [rows, searchText, listFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / ITEMS_PER_PAGE)
  );

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  const activeCount = useMemo(
    () => rows.filter((row) => row.is_active).length,
    [rows]
  );

  const inactiveCount = useMemo(
    () => rows.filter((row) => !row.is_active).length,
    [rows]
  );

  const applyAuthorizedUser = useCallback(
    (user: FinanceUser, type: Exclude<SessionType, null>) => {
      const nextRole = user.role || "";
      const nextPermissions = Array.isArray(user.permissions)
        ? user.permissions.filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0
          )
        : [];

      setEmployeeName(user.full_name || user.username || "الموظف");
      setOrganizationName(user.organization_name || "احتساب");
      setBranchId(user.branch_id);
      setRole(nextRole);
      setPermissions(nextPermissions);
      setSessionType(type);
      setAuthorized(true);
    },
    []
  );

  const getSupportSession = useCallback(
    async (isCancelled: () => boolean): Promise<FinanceUser | null> => {
      const controller = new AbortController();

      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, SUPPORT_SESSION_TIMEOUT_MS);

      try {
        const response = await fetch(
          `/finance/api/support-session?branch=${encodeURIComponent(branch)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

        let payload: SupportSessionResponse;

        try {
          payload = (await response.json()) as SupportSessionResponse;
        } catch {
          payload = {
            ok: false,
            message: "تعذر قراءة استجابة جلسة الدعم",
          };
        }

        if (isCancelled()) {
          return null;
        }

        if (
          response.ok &&
          payload.ok &&
          payload.session_type === "admin_support" &&
          payload.user?.id &&
          payload.user.branch_id &&
          payload.user.branch_slug
        ) {
          return payload.user;
        }

        return null;
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return null;
        }

        console.error("Support session verification failed:", error);
        return null;
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    [branch]
  );

  const verifyUserInBackground = useCallback(
    async (user: FinanceUser, isCancelled: () => boolean) => {
      try {
        const [branchResult, userResult] = await Promise.all([
          supabase
            .from("finance_branches")
            .select("id, branch_slug, organization_name, is_active")
            .eq("id", user.branch_id)
            .maybeSingle(),

          supabase
            .from("finance_branch_users")
            .select("id, full_name, username, role, is_active, branch_id")
            .eq("id", user.id)
            .eq("branch_id", user.branch_id)
            .maybeSingle(),
        ]);

        if (isCancelled()) {
          return;
        }

        if (branchResult.error) {
          console.error(
            "Background branch verification error:",
            branchResult.error
          );
        }

        if (userResult.error) {
          console.error(
            "Background user verification error:",
            userResult.error
          );
        }

        if (
          !branchResult.error &&
          (!branchResult.data || branchResult.data.is_active === false)
        ) {
          redirectToFinanceLogin(router, {
            branchSlug: branch,
            preserveReturnPath: true,
          });

          return;
        }

        if (
          !userResult.error &&
          (!userResult.data || userResult.data.is_active === false)
        ) {
          redirectToFinanceLogin(router, {
            branchSlug: branch,
            preserveReturnPath: true,
          });

          return;
        }

        if (branchResult.data?.organization_name) {
          setOrganizationName(branchResult.data.organization_name);
          localStorage.setItem(
            "finance_organization_name",
            branchResult.data.organization_name
          );
        }

        if (userResult.data) {
          const refreshedEmployeeName =
            userResult.data.full_name ||
            userResult.data.username ||
            user.full_name ||
            user.username ||
            "الموظف";

          setEmployeeName(refreshedEmployeeName);
          localStorage.setItem("finance_user_name", refreshedEmployeeName);
        }
      } catch (error) {
        console.error("Background session verification failed:", error);
      }
    },
    [branch, router]
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
    if (!branch) {
      redirectToFinanceLogin(router, {
        preserveReturnPath: true,
      });

      return;
    }

    let cancelled = false;

    async function initializeSession() {
      const validation = validateFinanceSession(branch);

      if (validation.valid && validation.user) {
        const session = validation.user;

        const localUser: FinanceUser = {
          id: String(session.id || ""),
          branch_id: String(session.branch_id || ""),
          branch_slug: String(session.branch_slug || branch)
            .trim()
            .toLowerCase(),
          branch_name: session.branch_name || "",
          organization_name:
            session.organization_name ||
            localStorage.getItem("finance_organization_name") ||
            "احتساب",
          full_name: getFinanceEmployeeName(session),
          username: session.username || "",
          role: session.role || "",
          permissions: Array.isArray(session.permissions)
            ? session.permissions
            : [],
          is_active: session.is_active !== false,
        };

        if (localUser.id && localUser.branch_id) {
          renewFinanceSession(true);
          applyAuthorizedUser(localUser, "branch_user");
          setAuthChecked(true);

          void verifyUserInBackground(localUser, () => cancelled);

          void getSupportSession(() => cancelled).then((supportUser) => {
            if (cancelled || !supportUser) {
              return;
            }

            if (
              supportUser.branch_slug.trim().toLowerCase() === branch &&
              supportUser.branch_id
            ) {
              applyAuthorizedUser(supportUser, "admin_support");
            }
          });

          return;
        }
      }

      const supportUser = await getSupportSession(() => cancelled);

      if (cancelled) {
        return;
      }

      if (supportUser) {
        const supportBranchSlug = supportUser.branch_slug
          .trim()
          .toLowerCase();

        if (supportBranchSlug !== branch) {
          router.replace(
            `/finance/${encodeURIComponent(supportBranchSlug)}/customers/blocklist`
          );

          return;
        }

        applyAuthorizedUser(supportUser, "admin_support");
        setAuthChecked(true);
        return;
      }

      setAuthChecked(true);

      redirectToFinanceLogin(router, {
        branchSlug: branch,
        preserveReturnPath: true,
      });
    }

    void initializeSession();

    return () => {
      cancelled = true;
    };
  }, [
    applyAuthorizedUser,
    branch,
    getSupportSession,
    router,
    verifyUserInBackground,
  ]);

  useEffect(() => {
    if (!authorized || isSupportSession) {
      return;
    }

    return installFinanceActivityTracker({
      onExpired: () => {
        redirectToFinanceLogin(router, {
          branchSlug: branch,
          preserveReturnPath: true,
        });
      },
    });
  }, [authorized, branch, isSupportSession, router]);

  useEffect(() => {
    if (!authorized) {
      return;
    }

    if (!canView) {
      setAccessDenied(true);
      return;
    }

    setAccessDenied(false);
  }, [authorized, canView]);

  useEffect(() => {
    if (!authorized || !branchId || !canView) {
      return;
    }

    let cancelled = false;

    void loadBlocklist(branchId, () => cancelled);

    return () => {
      cancelled = true;
    };
  }, [authorized, branchId, canView]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, listFilter]);

  useEffect(() => {
    if (!showAddModal || customerSearchText.trim().length < 2 || !branchId) {
      setCustomerSearchResults([]);
      setCustomerSearchLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void searchCustomers(customerSearchText);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [customerSearchText, showAddModal, branchId]);

  useEffect(() => {
    const modalOpen = showAddModal || Boolean(selectedUnblockRow);

    if (!modalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      closeAddModal();
      closeUnblockModal();
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showAddModal, selectedUnblockRow]);

  async function loadBlocklist(
    currentBranchId: string,
    isCancelled: () => boolean = () => false
  ) {
    setListLoading(true);
    setListError("");

    try {
      const { data, error } = await supabase
        .from("finance_customer_blocklist")
        .select(
          `
            id,
            branch_id,
            customer_id,
            national_id,
            customer_name,
            phone,
            block_reason,
            notes,
            is_active,
            blocked_at,
            blocked_by_name,
            unblocked_at,
            unblocked_by_name,
            unblock_reason,
            created_at,
            updated_at
          `
        )
        .eq("branch_id", currentBranchId)
        .order("blocked_at", { ascending: false });

      if (isCancelled()) {
        return;
      }

      if (error) {
        console.error("Blocklist loading error:", error);
        setRows([]);
        setListError("تعذر تحميل قائمة الحظر. حاول مرة أخرى.");
        return;
      }

      setRows((data || []) as BlocklistRow[]);
    } catch (error) {
      console.error("Blocklist loading failed:", error);

      if (!isCancelled()) {
        setRows([]);
        setListError("تعذر تحميل قائمة الحظر بسبب مشكلة في الاتصال.");
      }
    } finally {
      if (!isCancelled()) {
        setListLoading(false);
      }
    }
  }

  async function searchCustomers(value: string) {
    if (!branchId) {
      return;
    }

    const cleanValue = normalizeSearch(value);

    if (cleanValue.length < 2) {
      setCustomerSearchResults([]);
      return;
    }

    setCustomerSearchLoading(true);

    try {
      const safeValue = cleanValue
        .replace(/[(),.%]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const { data, error } = await supabase
        .from("finance_customers")
        .select("id, full_name, national_id, phone")
        .eq("branch_id", branchId)
        .or(
          `full_name.ilike.%${safeValue}%,national_id.ilike.%${safeValue}%,phone.ilike.%${safeValue}%`
        )
        .limit(8);

      if (error) {
        console.error("Customer search error:", error);
        setCustomerSearchResults([]);
        return;
      }

      setCustomerSearchResults((data || []) as CustomerSearchRow[]);
    } catch (error) {
      console.error("Customer search failed:", error);
      setCustomerSearchResults([]);
    } finally {
      setCustomerSearchLoading(false);
    }
  }

  function selectCustomer(customer: CustomerSearchRow) {
    setAddForm((current) => ({
      ...current,
      customer_id: customer.id,
      customer_name: customer.full_name || "",
      national_id: normalizeDigits(customer.national_id || "").slice(0, 10),
      phone: normalizeDigits(customer.phone || ""),
    }));

    setCustomerSearchText("");
    setCustomerSearchResults([]);
    setAddError("");
  }

  async function addToBlocklist() {
    if (!branchId || addLoading || !canAdd) {
      return;
    }

    const cleanName = addForm.customer_name.trim().replace(/\s+/g, " ");
    const cleanNationalId = normalizeDigits(addForm.national_id).replace(
      /\D/g,
      ""
    );
    const cleanPhone = normalizeDigits(addForm.phone).replace(/\D/g, "");
    const cleanReason = addForm.block_reason.trim().replace(/\s+/g, " ");
    const cleanNotes = addForm.notes.trim().replace(/\s+/g, " ");

    setAddError("");

    if (cleanName.length < 2) {
      setAddError("يرجى إدخال اسم العميل بشكل صحيح.");
      return;
    }

    if (cleanNationalId.length !== 10) {
      setAddError("رقم الهوية يجب أن يتكون من 10 أرقام.");
      return;
    }

    if (cleanReason.length < 3) {
      setAddError("يرجى كتابة سبب واضح للحظر.");
      return;
    }

    try {
      setAddLoading(true);

      const { error } = await supabase.rpc("block_finance_customer", {
        p_branch_id: branchId,
        p_customer_id: addForm.customer_id,
        p_national_id: cleanNationalId,
        p_customer_name: cleanName,
        p_phone: cleanPhone || null,
        p_block_reason: cleanReason,
        p_notes: cleanNotes || null,
        p_employee_name: employeeName,
        p_user_id: isUuid(getCurrentUserId()) ? getCurrentUserId() : null,
      });

      if (error) {
        console.error("Block customer error:", error);

        const message = String(error.message || "");

        if (
          message.includes("موجود بالفعل") ||
          message.includes("duplicate") ||
          message.includes("unique")
        ) {
          setAddError("العميل موجود بالفعل في قائمة حظر هذا الفرع.");
        } else {
          setAddError("تعذر إضافة العميل إلى قائمة الحظر.");
        }

        return;
      }

      closeAddModal();
      await loadBlocklist(branchId);
    } catch (error) {
      console.error("Block customer failed:", error);
      setAddError("تعذر تنفيذ العملية بسبب مشكلة في الاتصال.");
    } finally {
      setAddLoading(false);
    }
  }

  async function removeFromBlocklist() {
    if (
      !branchId ||
      !selectedUnblockRow ||
      unblockLoading ||
      !canRemove
    ) {
      return;
    }

    const cleanReason = unblockReason.trim().replace(/\s+/g, " ");

    setUnblockError("");

    if (cleanReason.length < 3) {
      setUnblockError("يرجى كتابة سبب رفع الحظر.");
      return;
    }

    try {
      setUnblockLoading(true);

      const { error } = await supabase.rpc("unblock_finance_customer", {
        p_branch_id: branchId,
        p_block_id: selectedUnblockRow.id,
        p_unblock_reason: cleanReason,
        p_employee_name: employeeName,
      });

      if (error) {
        console.error("Unblock customer error:", error);
        setUnblockError("تعذر رفع الحظر عن العميل.");
        return;
      }

      closeUnblockModal();
      await loadBlocklist(branchId);
    } catch (error) {
      console.error("Unblock customer failed:", error);
      setUnblockError("تعذر تنفيذ العملية بسبب مشكلة في الاتصال.");
    } finally {
      setUnblockLoading(false);
    }
  }

  function openAddModal() {
    if (!canAdd) {
      return;
    }

    setAddForm(EMPTY_ADD_FORM);
    setCustomerSearchText("");
    setCustomerSearchResults([]);
    setAddError("");
    setShowAddModal(true);
  }

  function closeAddModal() {
    if (addLoading) {
      return;
    }

    setShowAddModal(false);
    setAddForm(EMPTY_ADD_FORM);
    setCustomerSearchText("");
    setCustomerSearchResults([]);
    setAddError("");
  }

  function openUnblockModal(row: BlocklistRow) {
    if (!canRemove || !row.is_active) {
      return;
    }

    setSelectedUnblockRow(row);
    setUnblockReason("");
    setUnblockError("");
  }

  function closeUnblockModal() {
    if (unblockLoading) {
      return;
    }

    setSelectedUnblockRow(null);
    setUnblockReason("");
    setUnblockError("");
  }

  async function leaveSupportBranch() {
    setLogoutLoading(true);

    try {
      await fetch("/finance/api/support-session", {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      console.error("Support logout failed:", error);
    } finally {
      setLogoutLoading(false);
      router.replace("/admin-support");
      router.refresh();
    }
  }

  async function logout() {
    if (logoutLoading) {
      return;
    }

    if (isSupportSession) {
      await leaveSupportBranch();
      return;
    }

    logoutFinanceUser(router);
  }

  function getCurrentUserId() {
    if (typeof window === "undefined") {
      return "";
    }

    try {
      const rawUser =
        localStorage.getItem("finance_branch_user") ||
        localStorage.getItem("finance_user");

      if (!rawUser) {
        return "";
      }

      const parsed = JSON.parse(rawUser);
      return String(parsed?.id || "");
    } catch {
      return "";
    }
  }

  if (!authChecked || !authorized) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getContainerStyle(isCompact)}>
          <header style={getHeroStyle(isMobile)}>
            <div style={heroCircleOne} />
            <div style={heroCircleTwo} />
            <div style={heroCircleThree} />
            <div style={heroDots} />

            <div style={loadingHeroContent}>
              <span style={loadingSpinner} />
              <h1 style={getTitleStyle(screen)}>جاري فتح قائمة الحظر...</h1>
            </div>
          </header>
        </div>

        <GlobalStyles />
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getContainerStyle(isCompact)}>
          <PageHeader
            screen={screen}
            branch={branch}
            employeeName={employeeName}
            organizationName={organizationName}
            logoutLoading={logoutLoading}
            isSupportSession={isSupportSession}
            onLogout={() => void logout()}
            onHome={() => router.push(`/finance/${branch}`)}
          />

          <section style={accessDeniedCard}>
            <div style={accessDeniedIcon}>🔒</div>
            <h2 style={accessDeniedTitle}>ليس لديك صلاحية مشاهدة قائمة الحظر</h2>
            <button
              type="button"
              style={accessDeniedButton}
              onClick={() => router.back()}
            >
              رجوع
            </button>
          </section>
        </div>

        <GlobalStyles />
      </main>
    );
  }

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <PageHeader
          screen={screen}
          branch={branch}
          employeeName={employeeName}
          organizationName={organizationName}
          logoutLoading={logoutLoading}
          isSupportSession={isSupportSession}
          onLogout={() => void logout()}
          onHome={() => router.push(`/finance/${branch}`)}
        />

        <section style={summaryPanel}>
          <div style={summaryHeader}>
            <div>
              <h2 style={summaryTitle}>قائمة حظر العملاء</h2>
            </div>

            {canAdd && (
              <button
                type="button"
                style={addMainButton}
                onClick={openAddModal}
              >
                <span>➕</span>
                إضافة عميل للحظر
              </button>
            )}
          </div>

          <div style={statsGrid}>
            <StatCard
              title="الحظر النشط"
              value={activeCount}
              icon="⛔"
              tone="red"
              active={listFilter === "active"}
              onClick={() => setListFilter("active")}
            />

            <StatCard
              title="تم رفع الحظر"
              value={inactiveCount}
              icon="✅"
              tone="green"
              active={listFilter === "inactive"}
              onClick={() => setListFilter("inactive")}
            />

            <StatCard
              title="جميع السجلات"
              value={rows.length}
              icon="📋"
              tone="blue"
              active={listFilter === "all"}
              onClick={() => setListFilter("all")}
            />
          </div>
        </section>

        <section style={searchPanel}>
          <div style={searchBox}>
            <span style={searchIcon}>🔎</span>

            <input
              style={searchInput}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="البحث بالاسم أو الهوية أو الجوال أو سبب الحظر"
            />

            {searchText && (
              <button
                type="button"
                style={clearSearchButton}
                onClick={() => setSearchText("")}
                aria-label="مسح البحث"
              >
                ×
              </button>
            )}
          </div>

          <button
            type="button"
            style={refreshButton}
            onClick={() => branchId && void loadBlocklist(branchId)}
            disabled={listLoading}
          >
            {listLoading ? "جاري التحديث..." : "تحديث القائمة"}
          </button>
        </section>

        {listError && <div style={errorNotice}>{listError}</div>}

        <section style={listPanel}>
          <div style={listPanelHeader}>
            <strong>السجلات</strong>

            <span style={recordsCount}>
              {filteredRows.length} سجل
            </span>
          </div>

          {listLoading ? (
            <div style={emptyState}>جاري تحميل قائمة الحظر...</div>
          ) : paginatedRows.length === 0 ? (
            <div style={emptyState}>لا توجد سجلات مطابقة</div>
          ) : (
            <div style={cardsGrid}>
              {paginatedRows.map((row) => (
                <article
                  key={row.id}
                  style={{
                    ...blockCard,
                    borderColor: row.is_active ? "#fecaca" : "#bbf7d0",
                  }}
                >
                  <div style={cardHeader}>
                    <div style={customerIdentity}>
                      <div
                        style={{
                          ...customerIcon,
                          background: row.is_active ? "#fef2f2" : "#f0fdf4",
                          color: row.is_active ? "#b91c1c" : "#15803d",
                        }}
                      >
                        {row.is_active ? "⛔" : "✅"}
                      </div>

                      <div>
                        <h3 style={customerName}>{row.customer_name}</h3>

                        <span
                          style={{
                            ...statusBadge,
                            background: row.is_active ? "#fee2e2" : "#dcfce7",
                            color: row.is_active ? "#991b1b" : "#166534",
                          }}
                        >
                          {row.is_active ? "محظور حاليًا" : "تم رفع الحظر"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={detailsGrid}>
                    <DetailItem label="رقم الهوية" value={row.national_id} />
                    <DetailItem label="رقم الجوال" value={row.phone || "-"} />
                    <DetailItem
                      label="تاريخ الحظر"
                      value={formatDateTime(row.blocked_at)}
                    />
                    <DetailItem
                      label="تم الحظر بواسطة"
                      value={row.blocked_by_name || "-"}
                    />
                  </div>

                  <div style={reasonBox}>
                    <span style={reasonLabel}>سبب الحظر</span>
                    <p style={reasonText}>{row.block_reason}</p>
                  </div>

                  {row.notes && (
                    <div style={notesBox}>
                      <span style={reasonLabel}>ملاحظات</span>
                      <p style={reasonText}>{row.notes}</p>
                    </div>
                  )}

                  {!row.is_active && (
                    <div style={unblockInfoBox}>
                      <DetailItem
                        label="تاريخ رفع الحظر"
                        value={formatDateTime(row.unblocked_at)}
                      />

                      <DetailItem
                        label="تم رفعه بواسطة"
                        value={row.unblocked_by_name || "-"}
                      />

                      <div style={unblockReasonRow}>
                        <span style={reasonLabel}>سبب رفع الحظر</span>
                        <p style={reasonText}>{row.unblock_reason || "-"}</p>
                      </div>
                    </div>
                  )}

                  <div style={cardActions}>
                    {row.customer_id && (
                      <button
                        type="button"
                        style={profileButton}
                        onClick={() =>
                          router.push(
                            `/finance/${branch}/customers/${row.customer_id}`
                          )
                        }
                      >
                        فتح ملف العميل
                      </button>
                    )}

                    {row.is_active && canRemove && (
                      <button
                        type="button"
                        style={unblockButton}
                        onClick={() => openUnblockModal(row)}
                      >
                        رفع الحظر
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {totalPages > 1 && (
          <div style={paginationBox}>
            <button
              type="button"
              style={{
                ...paginationButton,
                opacity: currentPage === 1 ? 0.5 : 1,
              }}
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
            >
              السابق
            </button>

            <span style={paginationText}>
              صفحة {currentPage} من {totalPages}
            </span>

            <button
              type="button"
              style={{
                ...paginationButton,
                opacity: currentPage === totalPages ? 0.5 : 1,
              }}
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
            >
              التالي
            </button>
          </div>
        )}

        <div style={backWrapper}>
          <button type="button" style={backButton} onClick={() => router.back()}>
            ← رجوع
          </button>
        </div>
      </div>

      {showAddModal && (
        <div style={modalOverlay} onMouseDown={closeAddModal}>
          <section
            style={modalCard}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div style={modalHeader}>
              <h2 style={modalTitle}>إضافة عميل إلى قائمة الحظر</h2>

              <button
                type="button"
                style={closeButton}
                onClick={closeAddModal}
                disabled={addLoading}
              >
                ×
              </button>
            </div>

            <div style={formSection}>
              <h3 style={formSectionTitle}>اختيار عميل موجود</h3>

              <div style={modalSearchBox}>
                <span style={searchIcon}>🔎</span>

                <input
                  style={searchInput}
                  value={customerSearchText}
                  onChange={(event) =>
                    setCustomerSearchText(event.target.value)
                  }
                  placeholder="ابحث بالاسم أو الهوية أو الجوال"
                />
              </div>

              {customerSearchText.trim().length >= 2 && (
                <div style={customerResultsBox}>
                  {customerSearchLoading ? (
                    <div style={smallEmptyState}>جاري البحث...</div>
                  ) : customerSearchResults.length === 0 ? (
                    <div style={smallEmptyState}>لا توجد نتائج مطابقة</div>
                  ) : (
                    customerSearchResults.map((customer) => (
                      <button
                        type="button"
                        key={customer.id}
                        style={customerResultButton}
                        onClick={() => selectCustomer(customer)}
                      >
                        <strong>{customer.full_name || "-"}</strong>

                        <span>
                          {customer.national_id || "-"} | {customer.phone || "-"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div style={formSection}>
              <h3 style={formSectionTitle}>بيانات الحظر</h3>

              <div style={formGrid}>
                <FormField label="اسم العميل">
                  <input
                    style={input}
                    value={addForm.customer_name}
                    onChange={(event) =>
                      setAddForm((current) => ({
                        ...current,
                        customer_name: event.target.value,
                        customer_id: null,
                      }))
                    }
                    placeholder="اسم العميل"
                  />
                </FormField>

                <FormField label="رقم الهوية">
                  <input
                    style={input}
                    value={addForm.national_id}
                    onChange={(event) =>
                      setAddForm((current) => ({
                        ...current,
                        national_id: normalizeDigits(event.target.value)
                          .replace(/\D/g, "")
                          .slice(0, 10),
                        customer_id: null,
                      }))
                    }
                    placeholder="10 أرقام"
                    inputMode="numeric"
                  />
                </FormField>

                <FormField label="رقم الجوال">
                  <input
                    style={input}
                    value={addForm.phone}
                    onChange={(event) =>
                      setAddForm((current) => ({
                        ...current,
                        phone: normalizeDigits(event.target.value)
                          .replace(/\D/g, "")
                          .slice(0, 15),
                      }))
                    }
                    placeholder="اختياري"
                    inputMode="tel"
                  />
                </FormField>

                <FormField label="سبب الحظر">
                  <input
                    style={input}
                    value={addForm.block_reason}
                    onChange={(event) =>
                      setAddForm((current) => ({
                        ...current,
                        block_reason: event.target.value,
                      }))
                    }
                    placeholder="اكتب سبب الحظر"
                  />
                </FormField>
              </div>

              <FormField label="ملاحظات إضافية">
                <textarea
                  style={textarea}
                  value={addForm.notes}
                  onChange={(event) =>
                    setAddForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="اختياري"
                />
              </FormField>

              {addError && <div style={modalErrorBox}>{addError}</div>}
            </div>

            <div style={modalActions}>
              <button
                type="button"
                style={cancelButton}
                onClick={closeAddModal}
                disabled={addLoading}
              >
                إلغاء
              </button>

              <button
                type="button"
                style={{
                  ...confirmBlockButton,
                  opacity: addLoading ? 0.65 : 1,
                }}
                onClick={() => void addToBlocklist()}
                disabled={addLoading}
              >
                {addLoading ? "جاري الإضافة..." : "تأكيد الحظر"}
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedUnblockRow && (
        <div style={modalOverlay} onMouseDown={closeUnblockModal}>
          <section
            style={smallModalCard}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div style={modalHeader}>
              <h2 style={modalTitle}>رفع الحظر</h2>

              <button
                type="button"
                style={closeButton}
                onClick={closeUnblockModal}
                disabled={unblockLoading}
              >
                ×
              </button>
            </div>

            <div style={selectedCustomerBox}>
              <strong>{selectedUnblockRow.customer_name}</strong>
              <span>{selectedUnblockRow.national_id}</span>
            </div>

            <FormField label="سبب رفع الحظر">
              <textarea
                style={textarea}
                value={unblockReason}
                onChange={(event) => setUnblockReason(event.target.value)}
                placeholder="اكتب سبب رفع الحظر"
              />
            </FormField>

            {unblockError && <div style={modalErrorBox}>{unblockError}</div>}

            <div style={modalActions}>
              <button
                type="button"
                style={cancelButton}
                onClick={closeUnblockModal}
                disabled={unblockLoading}
              >
                إلغاء
              </button>

              <button
                type="button"
                style={{
                  ...confirmUnblockButton,
                  opacity: unblockLoading ? 0.65 : 1,
                }}
                onClick={() => void removeFromBlocklist()}
                disabled={unblockLoading}
              >
                {unblockLoading ? "جاري رفع الحظر..." : "تأكيد رفع الحظر"}
              </button>
            </div>
          </section>
        </div>
      )}

      <GlobalStyles />
    </main>
  );
}

function PageHeader({
  screen,
  branch,
  employeeName,
  organizationName,
  logoutLoading,
  isSupportSession,
  onLogout,
  onHome,
}: {
  screen: ScreenType;
  branch: string;
  employeeName: string;
  organizationName: string;
  logoutLoading: boolean;
  isSupportSession: boolean;
  onLogout: () => void;
  onHome: () => void;
}) {
  const isMobile = screen === "mobile";

  return (
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

            <div style={getEmployeeNameStyle(isMobile)}>{employeeName}</div>

            {isSupportSession && (
              <span style={supportBadge}>دخول دعم</span>
            )}

            {!isMobile && <div style={employeeDividerSmall} />}

            <button
              type="button"
              style={{
                ...logoutInlineButton,
                opacity: logoutLoading ? 0.65 : 1,
              }}
              onClick={onLogout}
              disabled={logoutLoading}
            >
              <LogoutIcon />

              <span>
                {logoutLoading
                  ? "جاري الخروج..."
                  : isSupportSession
                    ? "العودة للوحة الدعم"
                    : "تسجيل الخروج"}
              </span>
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
          <h1 style={getTitleStyle(screen)}>قائمة حظر العملاء</h1>
          <div style={heroOrganizationName}>{organizationName}</div>
        </div>

        <div style={getHeroActionBoxStyle(screen)} />
      </div>
    </header>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
  active,
  onClick,
}: {
  title: string;
  value: number;
  icon: string;
  tone: "red" | "green" | "blue";
  active: boolean;
  onClick: () => void;
}) {
  const colors = {
    red: {
      background: "#fef2f2",
      border: "#fecaca",
      color: "#b91c1c",
    },
    green: {
      background: "#f0fdf4",
      border: "#bbf7d0",
      color: "#15803d",
    },
    blue: {
      background: "#eff6ff",
      border: "#bfdbfe",
      color: "#1d4ed8",
    },
  };

  const selected = colors[tone];

  return (
    <button
      type="button"
      style={{
        ...statCard,
        borderColor: active ? selected.color : selected.border,
        boxShadow: active
          ? `0 10px 24px ${selected.color}20`
          : "0 8px 18px rgba(15,23,42,0.04)",
      }}
      onClick={onClick}
    >
      <span
        style={{
          ...statIcon,
          background: selected.background,
          color: selected.color,
        }}
      >
        {icon}
      </span>

      <span style={statContent}>
        <strong style={statValue}>{value}</strong>
        <span style={statLabel}>{title}</span>
      </span>
    </button>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={detailItem}>
      <span style={detailLabel}>{label}</span>
      <strong style={detailValue}>{value}</strong>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={formField}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
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

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      "٠١٢٣٤٥٦٧٨٩".indexOf(digit).toString()
    )
    .replace(/[۰-۹]/g, (digit) =>
      "۰۱۲۳۴۵۶۷۸۹".indexOf(digit).toString()
    );
}

function normalizeSearch(value: string) {
  return normalizeDigits(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function GlobalStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        overflow-x: hidden;
      }

      button,
      input,
      textarea {
        font-family: var(--font-almarai), sans-serif;
      }

      button {
        -webkit-tap-highlight-color: transparent;
      }

      button:disabled {
        cursor: not-allowed !important;
      }

      @keyframes blocklistSpin {
        to {
          transform: rotate(360deg);
        }
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
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
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
  return {
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: screen === "desktop" ? "flex-start" : "center",
    flexWrap: "wrap",
    gap: screen === "mobile" ? 10 : 14,
    direction: screen === "desktop" ? "ltr" : "rtl",
    color: "#ffffff",
    width: "100%",
  };
}

function getEmployeeNameStyle(isMobile: boolean): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
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
    order: screen === "desktop" ? 0 : 1,
  };
}

function getTitleStyle(screen: ScreenType): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize: screen === "mobile" ? 24 : screen === "tablet" ? 28 : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    textShadow: "0 5px 14px rgba(15,23,42,0.14)",
    fontFamily: "var(--font-almarai), sans-serif",
  };
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  return {
    display: screen === "desktop" ? "flex" : "none",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-end",
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
  color: "#ffffff",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background: "rgba(255,255,255,0.30)",
};

const supportBadge: CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  background: "rgba(22,163,74,0.22)",
  border: "1px solid rgba(187,247,208,0.42)",
  color: "#dcfce7",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
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
  padding: 0,
  whiteSpace: "nowrap",
  direction: "rtl",
};

const heroOrganizationName: CSSProperties = {
  marginTop: 5,
  color: "rgba(255,255,255,0.80)",
  fontSize: 13,
  fontWeight: 800,
};

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 210,
  height: 210,
  right: -78,
  top: -85,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.075)",
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

const loadingHeroContent: CSSProperties = {
  position: "relative",
  zIndex: 3,
  minHeight: 116,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
};

const loadingSpinner: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "3px solid rgba(255,255,255,0.28)",
  borderTopColor: "#ffffff",
  animation: "blocklistSpin 0.8s linear infinite",
};

const summaryPanel: CSSProperties = {
  background: "rgba(255,255,255,0.97)",
  border: "1px solid #dbeafe",
  borderRadius: 24,
  padding: 18,
  marginBottom: 14,
  boxShadow: "0 12px 28px rgba(37,99,235,0.06)",
};

const summaryHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 14,
  marginBottom: 16,
};

const summaryTitle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 21,
  fontWeight: 900,
};

const addMainButton: CSSProperties = {
  border: "none",
  borderRadius: 15,
  padding: "13px 17px",
  background: "linear-gradient(135deg,#dc2626,#991b1b)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "0 10px 22px rgba(185,28,28,0.20)",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
};

const statCard: CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: 17,
  padding: 12,
  background: "#ffffff",
  display: "flex",
  alignItems: "center",
  gap: 11,
  textAlign: "right",
  cursor: "pointer",
};

const statIcon: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 13,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
};

const statContent: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const statValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 21,
  fontWeight: 900,
};

const statLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const searchPanel: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  marginBottom: 14,
};

const searchBox: CSSProperties = {
  minHeight: 56,
  padding: "0 14px",
  borderRadius: 18,
  border: "1px solid #dbeafe",
  background: "#ffffff",
  display: "flex",
  alignItems: "center",
  gap: 9,
};

const modalSearchBox: CSSProperties = {
  ...searchBox,
  minHeight: 50,
};

const searchIcon: CSSProperties = {
  fontSize: 20,
};

const searchInput: CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#0f172a",
  fontSize: 14,
};

const clearSearchButton: CSSProperties = {
  width: 32,
  height: 32,
  border: "none",
  borderRadius: 999,
  background: "#e2e8f0",
  color: "#475569",
  fontSize: 20,
  cursor: "pointer",
};

const refreshButton: CSSProperties = {
  border: "none",
  borderRadius: 16,
  padding: "0 18px",
  minHeight: 56,
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const errorNotice: CSSProperties = {
  marginBottom: 14,
  padding: 13,
  borderRadius: 15,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  fontSize: 14,
  fontWeight: 800,
};

const listPanel: CSSProperties = {
  background: "rgba(255,255,255,0.97)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 16,
  boxShadow: "0 12px 28px rgba(15,23,42,0.05)",
};

const listPanelHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 13,
  color: "#0f172a",
  fontSize: 17,
};

const recordsCount: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 900,
};

const cardsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: 12,
};

const blockCard: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 15,
  background: "#ffffff",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const cardHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 14,
};

const customerIdentity: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
};

const customerIcon: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 21,
};

const customerName: CSSProperties = {
  margin: "0 0 5px",
  color: "#0f172a",
  fontSize: 17,
  fontWeight: 900,
};

const statusBadge: CSSProperties = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
};

const detailsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 8,
  marginBottom: 11,
};

const detailItem: CSSProperties = {
  padding: 10,
  borderRadius: 13,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const detailLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
};

const detailValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: "anywhere",
};

const reasonBox: CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff7f7",
  borderRadius: 14,
  padding: 11,
  marginBottom: 9,
};

const notesBox: CSSProperties = {
  border: "1px solid #dbeafe",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 11,
  marginBottom: 9,
};

const reasonLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
};

const reasonText: CSSProperties = {
  margin: "5px 0 0",
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.7,
  overflowWrap: "anywhere",
};

const unblockInfoBox: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 8,
  padding: 10,
  borderRadius: 15,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  marginBottom: 10,
};

const unblockReasonRow: CSSProperties = {
  gridColumn: "1 / -1",
};

const cardActions: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
  gap: 8,
  marginTop: 12,
};

const profileButton: CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 900,
  cursor: "pointer",
};

const unblockButton: CSSProperties = {
  border: "1px solid #bbf7d0",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#f0fdf4",
  color: "#15803d",
  fontWeight: 900,
  cursor: "pointer",
};

const emptyState: CSSProperties = {
  padding: 28,
  textAlign: "center",
  color: "#64748b",
  border: "1px dashed #cbd5e1",
  borderRadius: 17,
  background: "#f8fafc",
};

const smallEmptyState: CSSProperties = {
  padding: 12,
  textAlign: "center",
  color: "#64748b",
  fontSize: 13,
};

const paginationBox: CSSProperties = {
  marginTop: 14,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 10,
};

const paginationButton: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 17px",
  background: "#1d4ed8",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const paginationText: CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "11px 20px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(22,163,74,0.22)",
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  padding: 14,
  background: "rgba(15,23,42,0.58)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalCard: CSSProperties = {
  width: "100%",
  maxWidth: 760,
  maxHeight: "92vh",
  overflowY: "auto",
  borderRadius: 24,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 24px 80px rgba(15,23,42,0.30)",
  padding: 20,
};

const smallModalCard: CSSProperties = {
  ...modalCard,
  maxWidth: 520,
};

const modalHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 16,
};

const modalTitle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 21,
  fontWeight: 900,
};

const closeButton: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 24,
  cursor: "pointer",
};

const formSection: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  marginBottom: 13,
};

const formSectionTitle: CSSProperties = {
  margin: "0 0 12px",
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
};

const customerResultsBox: CSSProperties = {
  marginTop: 8,
  maxHeight: 220,
  overflowY: "auto",
  display: "grid",
  gap: 6,
};

const customerResultButton: CSSProperties = {
  width: "100%",
  border: "1px solid #dbeafe",
  borderRadius: 13,
  padding: 11,
  background: "#ffffff",
  textAlign: "right",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: "#0f172a",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 11,
};

const formField: CSSProperties = {
  display: "block",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const input: CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 13,
  padding: "12px 13px",
  outline: "none",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
};

const textarea: CSSProperties = {
  ...input,
  minHeight: 92,
  resize: "vertical",
};

const modalErrorBox: CSSProperties = {
  marginTop: 11,
  padding: 11,
  borderRadius: 13,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  fontSize: 13,
  fontWeight: 800,
};

const modalActions: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 14,
};

const cancelButton: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 13,
  padding: "12px 14px",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 900,
  cursor: "pointer",
};

const confirmBlockButton: CSSProperties = {
  border: "none",
  borderRadius: 13,
  padding: "12px 14px",
  background: "linear-gradient(135deg,#dc2626,#991b1b)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const confirmUnblockButton: CSSProperties = {
  border: "none",
  borderRadius: 13,
  padding: "12px 14px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const selectedCustomerBox: CSSProperties = {
  padding: 13,
  marginBottom: 13,
  borderRadius: 15,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: "#0f172a",
};

const accessDeniedCard: CSSProperties = {
  maxWidth: 620,
  margin: "30px auto",
  padding: 28,
  borderRadius: 24,
  border: "1px solid #fecaca",
  background: "#ffffff",
  textAlign: "center",
  boxShadow: "0 14px 34px rgba(15,23,42,0.08)",
};

const accessDeniedIcon: CSSProperties = {
  fontSize: 42,
  marginBottom: 10,
};

const accessDeniedTitle: CSSProperties = {
  margin: "0 0 18px",
  color: "#991b1b",
  fontSize: 20,
  fontWeight: 900,
};

const accessDeniedButton: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "11px 20px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};
