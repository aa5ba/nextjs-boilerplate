"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

type ScreenType = "mobile" | "tablet" | "desktop";
type NoteMode = "independent" | "contract";
type BeneficiaryType = "organization" | "investor" | "other";
type BirthDateType = "hijri" | "gregorian";
type DueMode = "on_demand" | "fixed_date";
type CustomerLookupTarget = "debtor" | "beneficiary" | "guarantor";
type LookupStatus = "idle" | "searching" | "not_found" | "error";

type FinanceSessionUser = {
  id?: string;
  user_id?: string;
  branch_id?: string;
  branch_slug?: string;
  full_name?: string;
  username?: string;
  role?: string;
  permissions?: string[];
  is_active?: boolean;
  investor_id?: string | null;
};

type BranchData = {
  id: string;
  organization_name: string | null;
  commercial_record: string | null;
  organization_phone: string | null;
  phone: string | null;
  organization_address: string | null;
  city: string | null;
};

type Investor = {
  id: string;
  investor_name: string;
  national_id: string | null;
  phone: string | null;
  notes: string | null;
};

type CustomerData = {
  id: string;
  full_name: string;
  national_id: string;
  phone: string;
  birth_date_type: BirthDateType | null;
  birth_hijri: string | null;
  birth_gregorian: string | null;
  nationality: string | null;
  address: string | null;
  work: string | null;
  work_name: string | null;
  identity_source: string | null;
  notes: string | null;
};

type ContractSearchResult = {
  id: string;
  contract_number: number;
  customer_id: string | null;
  customer_name: string | null;
  customer_national_id: string | null;
  customer_phone: string | null;
  customer_birth_hijri: string | null;
  customer_work_name: string | null;
  payment_amount: number | null;
  payment_due_date: string | null;
  legal_city: string | null;
  investor_id: string | null;
  investor_name: string | null;
  print_party_type: string | null;
  print_party_name: string | null;
  print_party_identifier: string | null;
  first_party_type: string | null;
  first_party_name: string | null;
  first_party_identifier: string | null;
  has_guarantor: boolean | null;
  guarantor_customer_id: string | null;
  guarantor_name: string | null;
  guarantor_national_id: string | null;
  guarantor_phone: string | null;
  guarantor_birth_hijri: string | null;
  guarantor_work_name: string | null;
  contract_status: string | null;
  is_archived: boolean;
  customer?: CustomerData | null;
  guarantor_customer?: CustomerData | null;
  first_installment_due_date?: string | null;
};

type PartyForm = {
  customerId: string | null;
  fullName: string;
  nationalId: string;
  phone: string;
  birthDateType: BirthDateType;
  birthHijri: string;
  birthGregorian: string;
  nationality: string;
  address: string;
  workName: string;
  identitySource: string;
  notes: string;
};

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

type CreateNoteApiResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  noteId?: string | null;
  noteNumber?: string | number | null;
  amount?: string | number | null;
  dueDate?: string | null;
  dueMode?: string | null;
};

type DropdownLookupState = Record<CustomerLookupTarget, LookupStatus>;
type LookupMessageState = Record<CustomerLookupTarget, string>;

type ContractBeneficiaryPreview = {
  type: "organization" | "investor";
  name: string;
  identifier: string;
  phone: string;
};

const EMPTY_PARTY: PartyForm = {
  customerId: null,
  fullName: "",
  nationalId: "",
  phone: "",
  birthDateType: "hijri",
  birthHijri: "",
  birthGregorian: "",
  nationality: "",
  address: "",
  workName: "",
  identitySource: "",
  notes: "",
};

const EMPTY_LOOKUP_STATUS: DropdownLookupState = {
  debtor: "idle",
  beneficiary: "idle",
  guarantor: "idle",
};

const EMPTY_LOOKUP_MESSAGES: LookupMessageState = {
  debtor: "",
  beneficiary: "",
  guarantor: "",
};

const MANAGER_ROLES = new Set([
  "main_admin",
  "branch_manager",
  "admin",
  "manager",
  "مدير رئيسي",
  "مدير",
  "مدير فرع",
]);

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
  "finance_session_expires_at",
  "finance_last_activity_at",
  "finance_return_to",
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HIJRI_DATE_PATTERN =
  /^[0-9]{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|30)$/;
const SESSION_DURATION_MS = 60 * 60 * 1000;
const ACTIVITY_REFRESH_INTERVAL_MS = 60 * 1000;
const CUSTOMER_LOOKUP_DELAY_MS = 300;

export default function NewPromissoryNotePage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch || "").trim();

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [requestedContractId, setRequestedContractId] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [branchId, setBranchId] = useState("");
  const [branchData, setBranchData] = useState<BranchData | null>(null);
  const [currentUser, setCurrentUser] =
    useState<FinanceSessionUser | null>(null);
  const [employeeName, setEmployeeName] = useState("الموظف");
  const [canCreate, setCanCreate] = useState(false);
  const [canLinkContract, setCanLinkContract] = useState(false);
  const [canManageGuarantor, setCanManageGuarantor] = useState(false);

  const [noteMode, setNoteMode] = useState<NoteMode>("independent");
  const [contractSearch, setContractSearch] = useState("");
  const [contractResults, setContractResults] = useState<
    ContractSearchResult[]
  >([]);
  const [selectedContract, setSelectedContract] =
    useState<ContractSearchResult | null>(null);
  const [searchingContracts, setSearchingContracts] = useState(false);
  const [loadingRequestedContract, setLoadingRequestedContract] =
    useState(false);
  const [showContractResults, setShowContractResults] = useState(false);

  const [beneficiaryType, setBeneficiaryType] =
    useState<BeneficiaryType>("organization");
  const [beneficiaryInvestorId, setBeneficiaryInvestorId] = useState("");
  const [investors, setInvestors] = useState<Investor[]>([]);

  const [debtor, setDebtor] = useState<PartyForm>({ ...EMPTY_PARTY });
  const [beneficiary, setBeneficiary] = useState<PartyForm>({
    ...EMPTY_PARTY,
  });
  const [guarantor, setGuarantor] = useState<PartyForm>({
    ...EMPTY_PARTY,
  });
  const [hasGuarantor, setHasGuarantor] = useState(false);

  const [amount, setAmount] = useState("");
  const [city, setCity] = useState("");
  const [issueDate, setIssueDate] = useState(getTodayIsoDate());
  const [dueMode, setDueMode] = useState<DueMode>("on_demand");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [lookupStatus, setLookupStatus] =
    useState<DropdownLookupState>({ ...EMPTY_LOOKUP_STATUS });
  const [lookupMessages, setLookupMessages] =
    useState<LookupMessageState>({ ...EMPTY_LOOKUP_MESSAGES });
  const [saving, setSaving] = useState(false);

  const contractSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lookupTimers = useRef<
    Partial<Record<CustomerLookupTarget, ReturnType<typeof setTimeout>>>
  >({});
  const lookupRequestCounters = useRef<
    Record<CustomerLookupTarget, number>
  >({
    debtor: 0,
    beneficiary: 0,
    guarantor: 0,
  });
  const skipNextContractSearch = useRef(false);
  const loadedQueryContractRef = useRef("");

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;
  const noteAmount = useMemo(() => toNumber(amount), [amount]);
  const amountWords = useMemo(() => {
    if (!Number.isFinite(noteAmount) || noteAmount <= 0) {
      return "";
    }

    return amountToArabicWords(noteAmount);
  }, [noteAmount]);

  const selectedInvestor = useMemo(
    () =>
      investors.find((item) => item.id === beneficiaryInvestorId) || null,
    [investors, beneficiaryInvestorId]
  );

  const contractBeneficiary = useMemo<ContractBeneficiaryPreview | null>(
    () =>
      selectedContract
        ? getContractBeneficiaryPreview(
            selectedContract,
            branchData,
            investors
          )
        : null,
    [selectedContract, branchData, investors]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRequestedContractId(
        String(
          new URLSearchParams(window.location.search).get("contractId") ||
            ""
        ).trim()
      );
    }
  }, []);

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
      if (typeof window === "undefined") {
        return;
      }

      setLoadingPage(true);

      const storedUser = readStoredFinanceUser();

      if (!storedUser?.id && !storedUser?.user_id) {
        redirectToLogin();
        return;
      }

      const userId = String(storedUser.id || storedUser.user_id || "");
      const sessionExpiresAt = Number(
        localStorage.getItem("finance_session_expires_at") || "0"
      );

      if (
        !Number.isFinite(sessionExpiresAt) ||
        sessionExpiresAt <= 0 ||
        Date.now() >= sessionExpiresAt ||
        storedUser.is_active === false
      ) {
        clearFinanceSession({ preserveReturnPath: true });
        redirectToLogin();
        return;
      }

      if (
        storedUser.branch_slug &&
        storedUser.branch_slug.trim() &&
        storedUser.branch_slug.trim() !== branch
      ) {
        router.replace(`/finance/${storedUser.branch_slug.trim()}`);
        return;
      }

      let resolvedBranchId =
        storedUser.branch_id ||
        localStorage.getItem("finance_branch_id") ||
        "";

      if (!resolvedBranchId) {
        resolvedBranchId = (await getBranchId(branch)) || "";
      }

      if (!resolvedBranchId) {
        if (!cancelled) {
          alert("تعذر تحديد الفرع");
          router.replace("/login");
        }

        return;
      }

      const storedUserName =
        localStorage.getItem("finance_user_name") ||
        storedUser.full_name ||
        storedUser.username ||
        "الموظف";
      const normalizedRole = normalizeRole(storedUser.role);
      const permissions = Array.isArray(storedUser.permissions)
        ? storedUser.permissions
        : [];
      const manager = MANAGER_ROLES.has(normalizedRole);
      const createPermission =
        manager || permissions.includes("promissory_note_create");
      const linkPermission =
        manager || permissions.includes("promissory_note_link_contract");
      const guarantorPermission =
        manager || permissions.includes("promissory_note_manage_guarantor");

      const normalizedUser: FinanceSessionUser = {
        ...storedUser,
        id: userId,
        branch_id: resolvedBranchId,
      };

      if (!cancelled) {
        setCurrentUser(normalizedUser);
        setEmployeeName(storedUserName);
        setBranchId(resolvedBranchId);
        setCanCreate(createPermission);
        setCanLinkContract(linkPermission);
        setCanManageGuarantor(guarantorPermission);
        setAuthChecked(true);
        renewFinanceSession();
      }

      const [branchResult, investorsResult] = await Promise.all([
        supabase
          .from("finance_branches")
          .select(
            "id, organization_name, commercial_record, organization_phone, phone, organization_address, city"
          )
          .eq("id", resolvedBranchId)
          .maybeSingle(),
        supabase
          .from("finance_investors")
          .select("id, investor_name, national_id, phone, notes")
          .eq("branch_id", resolvedBranchId)
          .eq("is_active", true)
          .order("is_primary", { ascending: false })
          .order("investor_name", { ascending: true }),
      ]);

      if (cancelled) {
        return;
      }

      if (branchResult.error) {
        alert(branchResult.error.message || "تعذر تحميل بيانات الفرع");
      } else {
        const normalizedBranchData =
          (branchResult.data as BranchData | null) || null;
        setBranchData(normalizedBranchData);
        setCity(normalizedBranchData?.city || "");
      }

      if (investorsResult.error) {
        alert(investorsResult.error.message || "تعذر تحميل المستثمرين");
      } else {
        setInvestors((investorsResult.data as Investor[]) || []);
      }

      setLoadingPage(false);
    }

    void initializePage();

    return () => {
      cancelled = true;

      if (contractSearchTimer.current) {
        clearTimeout(contractSearchTimer.current);
      }

      Object.values(lookupTimers.current).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
    };
  }, [branch, router]);

  useEffect(() => {
    if (!authChecked || typeof window === "undefined") {
      return;
    }

    let lastRefresh = 0;

    function handleActivity() {
      const now = Date.now();

      if (now - lastRefresh < ACTIVITY_REFRESH_INTERVAL_MS) {
        return;
      }

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
      window.addEventListener(eventName, handleActivity, {
        passive: true,
      });
    });

    const timer = window.setInterval(() => {
      const expiresAt = Number(
        localStorage.getItem("finance_session_expires_at") || "0"
      );

      if (expiresAt > 0 && Date.now() >= expiresAt) {
        redirectToLogin();
      }
    }, 30 * 1000);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });

      window.clearInterval(timer);
    };
  }, [authChecked]);

  useEffect(() => {
    if (
      !authChecked ||
      !branchId ||
      noteMode !== "contract" ||
      !canLinkContract
    ) {
      setContractResults([]);
      setShowContractResults(false);
      return;
    }

    const query = contractSearch.trim();

    if (skipNextContractSearch.current) {
      skipNextContractSearch.current = false;
      setContractResults([]);
      setShowContractResults(false);
      return;
    }

    if (contractSearchTimer.current) {
      clearTimeout(contractSearchTimer.current);
    }

    if (query.length < 2) {
      setContractResults([]);
      setShowContractResults(false);
      return;
    }

    contractSearchTimer.current = setTimeout(() => {
      void searchContracts(query);
    }, 350);

    return () => {
      if (contractSearchTimer.current) {
        clearTimeout(contractSearchTimer.current);
      }
    };
  }, [contractSearch, authChecked, branchId, noteMode, canLinkContract]);

  useEffect(() => {
    if (
      !authChecked ||
      !branchId ||
      !canLinkContract ||
      !requestedContractId ||
      loadedQueryContractRef.current === requestedContractId
    ) {
      return;
    }

    if (!UUID_PATTERN.test(requestedContractId)) {
      loadedQueryContractRef.current = requestedContractId;
      alert("رابط العقد غير صحيح");
      return;
    }

    loadedQueryContractRef.current = requestedContractId;
    setNoteMode("contract");
    void loadRequestedContract(requestedContractId);
  }, [authChecked, branchId, canLinkContract, requestedContractId]);

  function renewFinanceSession() {
    if (typeof window === "undefined") {
      return;
    }

    const now = Date.now();
    localStorage.setItem("finance_last_activity_at", String(now));
    localStorage.setItem(
      "finance_session_expires_at",
      String(now + SESSION_DURATION_MS)
    );
  }

  function clearFinanceSession({
    preserveReturnPath = false,
  }: {
    preserveReturnPath?: boolean;
  } = {}) {
    if (typeof window === "undefined") {
      return;
    }

    FINANCE_SESSION_KEYS.forEach((key) => {
      if (preserveReturnPath && key === "finance_return_to") {
        return;
      }

      localStorage.removeItem(key);
    });
  }

  function redirectToLogin() {
    if (typeof window === "undefined") {
      router.replace("/login");
      return;
    }

    const returnTo = window.location.pathname + window.location.search;
    localStorage.setItem("finance_return_to", returnTo);
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function logout() {
    try {
      await fetch("/api/finance/login", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch (error) {
      console.error("Finance logout failed:", error);
    } finally {
      clearFinanceSession();
      router.replace("/login");
    }
  }

  function changeNoteMode(mode: NoteMode) {
    if (mode === "contract" && !canLinkContract) {
      alert("ليس لديك صلاحية ربط السند بعقد");
      return;
    }

    skipNextContractSearch.current = false;
    setNoteMode(mode);
    setSelectedContract(null);
    setContractSearch("");
    setContractResults([]);
    setShowContractResults(false);
    setIssueDate(getTodayIsoDate());
    setNotes("");

    if (mode === "independent") {
      resetFormForIndependentNote();
    } else {
      setDebtor({ ...EMPTY_PARTY });
      setBeneficiary({ ...EMPTY_PARTY });
      setGuarantor({ ...EMPTY_PARTY });
      setHasGuarantor(false);
      setAmount("");
      setCity("");
      setDueMode("fixed_date");
      setDueDate("");
      clearAllLookupStates();
    }
  }

  function resetFormForIndependentNote() {
    setDebtor({ ...EMPTY_PARTY });
    setBeneficiary({ ...EMPTY_PARTY });
    setGuarantor({ ...EMPTY_PARTY });
    setBeneficiaryType("organization");
    setBeneficiaryInvestorId("");
    setHasGuarantor(false);
    setAmount("");
    setCity(branchData?.city || "");
    setIssueDate(getTodayIsoDate());
    setDueMode("on_demand");
    setDueDate("");
    setNotes("");
    clearAllLookupStates();
  }

  async function searchContracts(query: string) {
    if (!branchId || !canLinkContract) {
      return;
    }

    try {
      setSearchingContracts(true);
      setShowContractResults(true);

      const normalized = normalizeNumber(query);
      const escaped = escapePostgrestSearch(query);
      const escapedNormalized = escapePostgrestSearch(normalized);
      const filters = [
        `customer_name.ilike.%${escaped}%`,
        `customer_national_id.ilike.%${escapedNormalized}%`,
        `customer_phone.ilike.%${escapedNormalized}%`,
      ];

      if (/^\d+$/.test(normalized)) {
        filters.unshift(`contract_number.eq.${normalized}`);
      }

      const { data, error } = await supabase
        .from("finance_contracts")
        .select(CONTRACT_SELECT_FIELDS)
        .eq("branch_id", branchId)
        .eq("is_archived", false)
        .or(filters.join(","))
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) {
        throw new Error(error.message);
      }

      const hydrated = await hydrateContracts(
        ((data as ContractSearchResult[]) || []).map((item) => ({
          ...item,
          is_archived: Boolean(item.is_archived),
        }))
      );

      setContractResults(hydrated);
    } catch (error) {
      setContractResults([]);
      alert(getErrorMessage(error, "تعذر البحث عن العقود"));
    } finally {
      setSearchingContracts(false);
    }
  }

  async function loadRequestedContract(contractId: string) {
    if (!branchId || !canLinkContract) {
      return;
    }

    try {
      setLoadingRequestedContract(true);

      const { data, error } = await supabase
        .from("finance_contracts")
        .select(CONTRACT_SELECT_FIELDS)
        .eq("id", contractId)
        .eq("branch_id", branchId)
        .eq("is_archived", false)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error("العقد غير موجود في هذا الفرع أو مؤرشف");
      }

      const hydrated = await hydrateContracts([
        {
          ...(data as ContractSearchResult),
          is_archived: Boolean(
            (data as ContractSearchResult).is_archived
          ),
        },
      ]);

      if (!hydrated[0]) {
        throw new Error("تعذر تحميل بيانات العقد");
      }

      applySelectedContract(hydrated[0]);
    } catch (error) {
      alert(getErrorMessage(error, "تعذر تحميل العقد المرتبط"));
    } finally {
      setLoadingRequestedContract(false);
    }
  }

  async function hydrateContracts(
    rows: ContractSearchResult[]
  ): Promise<ContractSearchResult[]> {
    if (!branchId || rows.length === 0) {
      return rows;
    }

    const customerIds = Array.from(
      new Set(
        rows
          .flatMap((item) => [
            item.customer_id,
            item.guarantor_customer_id,
          ])
          .filter((value): value is string => Boolean(value))
      )
    );
    const contractIds = rows.map((item) => item.id);
    let customersMap = new Map<string, CustomerData>();
    const installmentMap = new Map<string, string>();

    const [customersResult, installmentsResult] = await Promise.all([
      customerIds.length > 0
        ? supabase
            .from("finance_customers")
            .select(
              "id, full_name, national_id, phone, birth_date_type, birth_hijri, birth_gregorian, nationality, address, work, work_name, identity_source, notes"
            )
            .eq("branch_id", branchId)
            .in("id", customerIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("finance_contract_installments")
        .select("contract_id, installment_number, due_date")
        .eq("branch_id", branchId)
        .in("contract_id", contractIds)
        .order("installment_number", { ascending: true }),
    ]);

    if (customersResult.error) {
      throw new Error(customersResult.error.message);
    }

    if (installmentsResult.error) {
      throw new Error(installmentsResult.error.message);
    }

    customersMap = new Map(
      (((customersResult.data || []) as CustomerData[]) || []).map(
        (item) => [item.id, item]
      )
    );

    (
      (installmentsResult.data || []) as Array<{
        contract_id: string;
        installment_number: number;
        due_date: string;
      }>
    ).forEach((item) => {
      if (!installmentMap.has(item.contract_id)) {
        installmentMap.set(item.contract_id, item.due_date);
      }
    });

    return rows.map((item) => ({
      ...item,
      customer: item.customer_id
        ? customersMap.get(item.customer_id) || null
        : null,
      guarantor_customer: item.guarantor_customer_id
        ? customersMap.get(item.guarantor_customer_id) || null
        : null,
      first_installment_due_date:
        installmentMap.get(item.id) ||
        normalizeContractDueDate(item.payment_due_date),
    }));
  }

  function applySelectedContract(contract: ContractSearchResult) {
    const firstDueDate =
      contract.first_installment_due_date ||
      normalizeContractDueDate(contract.payment_due_date);

    skipNextContractSearch.current = true;
    setSelectedContract(contract);
    setContractSearch(
      `عقد رقم ${contract.contract_number} - ${
        contract.customer_name || contract.customer?.full_name || "بدون اسم"
      }`
    );
    setShowContractResults(false);
    setContractResults([]);

    const debtorParty = contract.customer
      ? customerToParty(contract.customer)
      : {
          ...EMPTY_PARTY,
          customerId: contract.customer_id,
          fullName: contract.customer_name || "",
          nationalId: contract.customer_national_id || "",
          phone: contract.customer_phone || "",
          birthDateType: "hijri" as BirthDateType,
          birthHijri: contract.customer_birth_hijri || "",
          workName: contract.customer_work_name || "",
        };

    setDebtor(debtorParty);
    setAmount(
      contract.payment_amount != null
        ? normalizeNumber(String(contract.payment_amount))
        : ""
    );
    setCity(contract.legal_city || "");
    setDueMode("fixed_date");
    setDueDate(firstDueDate || "");
    applyContractBeneficiaryState(contract);

    const contractHasGuarantor =
      Boolean(contract.has_guarantor) ||
      Boolean(contract.guarantor_name) ||
      Boolean(contract.guarantor_customer_id);

    if (contractHasGuarantor) {
      setHasGuarantor(true);

      if (contract.guarantor_customer) {
        setGuarantor(customerToParty(contract.guarantor_customer));
      } else {
        setGuarantor({
          ...EMPTY_PARTY,
          customerId: contract.guarantor_customer_id,
          fullName: contract.guarantor_name || "",
          nationalId: contract.guarantor_national_id || "",
          phone: contract.guarantor_phone || "",
          birthDateType: "hijri",
          birthHijri: contract.guarantor_birth_hijri || "",
          workName: contract.guarantor_work_name || "",
        });
      }
    } else {
      setHasGuarantor(false);
      setGuarantor({ ...EMPTY_PARTY });
    }

    clearAllLookupStates();
  }

  function applyContractBeneficiaryState(
    contract: ContractSearchResult
  ) {
    const partyType = String(
      contract.print_party_type || contract.first_party_type || "organization"
    ).toLowerCase();

    if (partyType === "investor") {
      setBeneficiaryType("investor");
      setBeneficiaryInvestorId(contract.investor_id || "");
    } else {
      setBeneficiaryType("organization");
      setBeneficiaryInvestorId("");
    }

    setBeneficiary({ ...EMPTY_PARTY });
  }

  function changeBeneficiaryType(type: BeneficiaryType) {
    if (noteMode === "contract") {
      return;
    }

    setBeneficiaryType(type);
    setBeneficiaryInvestorId("");
    setBeneficiary({ ...EMPTY_PARTY });
    clearLookupState("beneficiary");
  }

  function toggleGuarantor(nextValue: boolean) {
    if (noteMode === "contract") {
      return;
    }

    if (nextValue && !canManageGuarantor) {
      alert("ليس لديك صلاحية إضافة أو تعديل الكفيل");
      return;
    }

    setHasGuarantor(nextValue);

    if (!nextValue) {
      setGuarantor({ ...EMPTY_PARTY });
      clearLookupState("guarantor");
    }
  }

  function updateParty(
    target: CustomerLookupTarget,
    patch: Partial<PartyForm>
  ) {
    if (target === "debtor") {
      setDebtor((current) => ({ ...current, ...patch }));
      return;
    }

    if (target === "beneficiary") {
      setBeneficiary((current) => ({ ...current, ...patch }));
      return;
    }

    setGuarantor((current) => ({ ...current, ...patch }));
  }

  function handlePartyNationalIdChange(
    target: CustomerLookupTarget,
    rawValue: string
  ) {
    if (noteMode === "contract") {
      return;
    }

    const nationalId = normalizeNumber(rawValue)
      .replace(/[^0-9]/g, "")
      .slice(0, 10);
    const timer = lookupTimers.current[target];

    if (timer) {
      clearTimeout(timer);
    }

    lookupRequestCounters.current[target] += 1;
    updateParty(target, {
      ...EMPTY_PARTY,
      nationalId,
    });
    clearLookupState(target);

    if (nationalId.length === 10) {
      lookupTimers.current[target] = setTimeout(() => {
        void lookupCustomerByNationalId(target, nationalId);
      }, CUSTOMER_LOOKUP_DELAY_MS);
    }
  }

  async function lookupCustomerByNationalId(
    target: CustomerLookupTarget,
    nationalId: string
  ) {
    if (!branch || nationalId.length !== 10) {
      return;
    }

    const requestId = lookupRequestCounters.current[target] + 1;
    lookupRequestCounters.current[target] = requestId;
    setLookupStatus((current) => ({
      ...current,
      [target]: "searching",
    }));
    setLookupMessages((current) => ({ ...current, [target]: "" }));

    try {
      const response = await fetch(
        `/api/finance/customers?branchSlug=${encodeURIComponent(
          branch
        )}&nationalId=${encodeURIComponent(nationalId)}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      let result: CustomerLookupApiResponse = {};

      try {
        result = (await response.json()) as CustomerLookupApiResponse;
      } catch {
        result = {};
      }

      if (requestId !== lookupRequestCounters.current[target]) {
        return;
      }

      if (response.status === 401 || result.code === "INVALID_SESSION") {
        redirectToLogin();
        return;
      }

      if (!response.ok || result.ok !== true) {
        throw new Error(result.message || "تعذر البحث عن العميل");
      }

      if (result.found !== true || !result.customer) {
        updateParty(target, {
          ...EMPTY_PARTY,
          nationalId,
        });
        setLookupStatus((current) => ({
          ...current,
          [target]: "not_found",
        }));
        setLookupMessages((current) => ({
          ...current,
          [target]:
            "رقم الهوية غير مسجل في هذا الفرع. أكمل البيانات الجديدة.",
        }));
        return;
      }

      updateParty(target, {
        ...EMPTY_PARTY,
        customerId: result.customer.id || null,
        fullName: String(result.customer.fullName || "").trim(),
        nationalId: normalizeNumber(
          String(result.customer.nationalId || nationalId)
        ).slice(0, 10),
        phone: normalizeNumber(String(result.customer.phone || "")).slice(
          0,
          10
        ),
        birthDateType: "hijri",
        birthHijri: normalizeHijriInput(
          String(result.customer.birthHijri || "")
        ),
        workName: String(result.customer.workName || "").trim(),
        address: String(result.customer.address || "").trim(),
      });
      setLookupStatus((current) => ({ ...current, [target]: "idle" }));
      setLookupMessages((current) => ({ ...current, [target]: "" }));
    } catch (error) {
      if (requestId !== lookupRequestCounters.current[target]) {
        return;
      }

      setLookupStatus((current) => ({ ...current, [target]: "error" }));
      setLookupMessages((current) => ({
        ...current,
        [target]: getErrorMessage(error, "تعذر البحث عن العميل"),
      }));
    }
  }

  function clearLookupState(target: CustomerLookupTarget) {
    setLookupStatus((current) => ({ ...current, [target]: "idle" }));
    setLookupMessages((current) => ({ ...current, [target]: "" }));
  }

  function clearAllLookupStates() {
    setLookupStatus({ ...EMPTY_LOOKUP_STATUS });
    setLookupMessages({ ...EMPTY_LOOKUP_MESSAGES });
  }

  function validateParty(
    party: PartyForm,
    partyLabel: string
  ): string | null {
    if (!party.fullName.trim()) {
      return `أدخل اسم ${partyLabel}`;
    }

    if (!/^\d{10}$/.test(normalizeNumber(party.nationalId))) {
      return `رقم هوية ${partyLabel} يجب أن يكون 10 أرقام`;
    }

    if (!/^05\d{8}$/.test(normalizeNumber(party.phone))) {
      return `رقم جوال ${partyLabel} يجب أن يكون 10 أرقام ويبدأ بـ 05`;
    }

    if (
      party.birthDateType === "hijri" &&
      !HIJRI_DATE_PATTERN.test(normalizeHijriInput(party.birthHijri))
    ) {
      return `تاريخ ميلاد ${partyLabel} الهجري غير صحيح`;
    }

    if (
      party.birthDateType === "gregorian" &&
      !parseDateValue(party.birthGregorian)
    ) {
      return `تاريخ ميلاد ${partyLabel} الميلادي غير صحيح`;
    }

    return null;
  }

  function validateForm(): string | null {
    if (!canCreate) {
      return "ليس لديك صلاحية إنشاء سند لأمر";
    }

    if (!issueDate || !parseDateValue(issueDate)) {
      return "حدد تاريخ تحرير السند";
    }

    if (noteMode === "contract") {
      if (!canLinkContract) {
        return "ليس لديك صلاحية ربط السند بعقد";
      }

      if (!selectedContract) {
        return "اختر العقد المرتبط بالسند";
      }

      if (!dueDate) {
        return "تعذر تحديد تاريخ أول دفعة للعقد";
      }

      return null;
    }

    const debtorError = validateParty(debtor, "المدين");

    if (debtorError) {
      return debtorError;
    }

    if (beneficiaryType === "investor" && !beneficiaryInvestorId) {
      return "اختر المستثمر المستفيد";
    }

    if (beneficiaryType === "other") {
      const beneficiaryError = validateParty(beneficiary, "المستفيد");

      if (beneficiaryError) {
        return beneficiaryError;
      }
    }

    if (hasGuarantor) {
      if (!canManageGuarantor) {
        return "ليس لديك صلاحية إضافة أو تعديل الكفيل";
      }

      const guarantorError = validateParty(guarantor, "الكفيل");

      if (guarantorError) {
        return guarantorError;
      }

      if (
        normalizeNumber(guarantor.nationalId) ===
        normalizeNumber(debtor.nationalId)
      ) {
        return "لا يمكن أن يكون المدين كفيلًا لنفسه";
      }
    }

    if (!Number.isFinite(noteAmount) || noteAmount <= 0) {
      return "أدخل مبلغ سند صحيح";
    }

    if (dueMode === "fixed_date" && !parseDateValue(dueDate)) {
      return "حدد تاريخ استحقاق صحيحًا";
    }

    return null;
  }

  async function createNote() {
    if (saving) {
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      alert(validationError);
      return;
    }

    if (!branchId || !currentUser?.id) {
      redirectToLogin();
      return;
    }

    const isContractMode = noteMode === "contract";
    const isOtherBeneficiary =
      !isContractMode && beneficiaryType === "other";
    const hasIndependentGuarantor =
      !isContractMode && hasGuarantor;

    try {
      setSaving(true);
      renewFinanceSession();

      const payload = {
        noteMode,
        contractId: isContractMode ? selectedContract?.id || "" : "",
        amount: isContractMode ? null : noteAmount,
        city: isContractMode ? selectedContract?.legal_city || "" : city,
        issueDate,
        notes: notes.trim(),
        dueMode: isContractMode ? "fixed_date" : dueMode,
        dueDate:
          !isContractMode && dueMode === "fixed_date" ? dueDate : "",
        beneficiaryType: isContractMode ? "organization" : beneficiaryType,
        beneficiaryInvestorId:
          !isContractMode && beneficiaryType === "investor"
            ? beneficiaryInvestorId
            : "",
        beneficiaryFullName: isOtherBeneficiary
          ? beneficiary.fullName.trim()
          : "",
        beneficiaryNationalId: isOtherBeneficiary
          ? normalizeNumber(beneficiary.nationalId)
          : "",
        beneficiaryPhone: isOtherBeneficiary
          ? normalizeNumber(beneficiary.phone)
          : "",
        beneficiaryBirthDateType: isOtherBeneficiary
          ? beneficiary.birthDateType
          : "",
        beneficiaryBirthHijri:
          isOtherBeneficiary && beneficiary.birthDateType === "hijri"
            ? normalizeHijriInput(beneficiary.birthHijri)
            : "",
        beneficiaryBirthGregorian:
          isOtherBeneficiary && beneficiary.birthDateType === "gregorian"
            ? beneficiary.birthGregorian
            : "",
        beneficiaryNationality: isOtherBeneficiary
          ? beneficiary.nationality.trim()
          : "",
        beneficiaryAddress: isOtherBeneficiary
          ? beneficiary.address.trim()
          : "",
        beneficiaryWorkName: isOtherBeneficiary
          ? beneficiary.workName.trim()
          : "",
        beneficiaryIdentitySource: isOtherBeneficiary
          ? beneficiary.identitySource.trim()
          : "",
        beneficiaryNotes: isOtherBeneficiary
          ? beneficiary.notes.trim()
          : "",
        debtorFullName: isContractMode ? "" : debtor.fullName.trim(),
        debtorNationalId: isContractMode
          ? ""
          : normalizeNumber(debtor.nationalId),
        debtorPhone: isContractMode ? "" : normalizeNumber(debtor.phone),
        debtorBirthDateType: isContractMode ? "" : debtor.birthDateType,
        debtorBirthHijri:
          !isContractMode && debtor.birthDateType === "hijri"
            ? normalizeHijriInput(debtor.birthHijri)
            : "",
        debtorBirthGregorian:
          !isContractMode && debtor.birthDateType === "gregorian"
            ? debtor.birthGregorian
            : "",
        debtorNationality: isContractMode
          ? ""
          : debtor.nationality.trim(),
        debtorAddress: isContractMode ? "" : debtor.address.trim(),
        debtorWorkName: isContractMode ? "" : debtor.workName.trim(),
        debtorIdentitySource: isContractMode
          ? ""
          : debtor.identitySource.trim(),
        debtorNotes: isContractMode ? "" : debtor.notes.trim(),
        hasGuarantor: hasIndependentGuarantor,
        guarantorFullName: hasIndependentGuarantor
          ? guarantor.fullName.trim()
          : "",
        guarantorNationalId: hasIndependentGuarantor
          ? normalizeNumber(guarantor.nationalId)
          : "",
        guarantorPhone: hasIndependentGuarantor
          ? normalizeNumber(guarantor.phone)
          : "",
        guarantorBirthDateType: hasIndependentGuarantor
          ? guarantor.birthDateType
          : "",
        guarantorBirthHijri:
          hasIndependentGuarantor && guarantor.birthDateType === "hijri"
            ? normalizeHijriInput(guarantor.birthHijri)
            : "",
        guarantorBirthGregorian:
          hasIndependentGuarantor &&
          guarantor.birthDateType === "gregorian"
            ? guarantor.birthGregorian
            : "",
        guarantorNationality: hasIndependentGuarantor
          ? guarantor.nationality.trim()
          : "",
        guarantorAddress: hasIndependentGuarantor
          ? guarantor.address.trim()
          : "",
        guarantorWorkName: hasIndependentGuarantor
          ? guarantor.workName.trim()
          : "",
        guarantorIdentitySource: hasIndependentGuarantor
          ? guarantor.identitySource.trim()
          : "",
        guarantorNotes: hasIndependentGuarantor
          ? guarantor.notes.trim()
          : "",
      };

      const response = await fetch("/api/finance/promissory-notes", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let result: CreateNoteApiResponse = {};

      try {
        result = (await response.json()) as CreateNoteApiResponse;
      } catch {
        result = {};
      }

      if (response.status === 401 || result.code === "INVALID_SESSION") {
        redirectToLogin();
        return;
      }

      if (!response.ok || result.ok !== true || !result.noteId) {
        throw new Error(result.message || "تعذر إنشاء السند");
      }

      alert("تم إنشاء سند لأمر بنجاح");
      router.push(
        `/finance/${branch}/contracts/promissory-note/print/${result.noteId}`
      );
    } catch (error) {
      alert(getErrorMessage(error, "تعذر إنشاء السند"));
    } finally {
      setSaving(false);
    }
  }

  if (!authChecked || loadingPage) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getLoadingBoxStyle(isMobile)}>
          جاري تحميل صفحة السند...
        </div>
      </main>
    );
  }

  if (!canCreate) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getContainerStyle(isCompact)}>
          <header style={getHeroStyle(isMobile)}>
            <div style={heroCircleOne} />
            <div style={heroCircleTwo} />
            <div style={heroCircleThree} />
            <div style={heroDots} />

            <div style={getHeroContentStyle(screen)}>
              <HeroUserArea
                screen={screen}
                employeeName={employeeName}
                onLogout={() => void logout()}
                onHome={() => router.push(`/finance/${branch}`)}
              />

              <div style={getHeroTitleBoxStyle(screen)}>
                <h1 style={getTitleStyle(screen)}>سند لأمر</h1>
              </div>

              <div style={getHeroActionBoxStyle(screen)} />
            </div>
          </header>

          <section style={permissionDeniedCard}>
            <div style={permissionDeniedIcon}>!</div>
            <h2 style={permissionDeniedTitle}>غير مصرح</h2>
            <p style={permissionDeniedText}>
              ليس لديك صلاحية إنشاء سند لأمر.
            </p>
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
      </main>
    );
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
            <HeroUserArea
              screen={screen}
              employeeName={employeeName}
              onLogout={() => void logout()}
              onHome={() => router.push(`/finance/${branch}`)}
            />

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>سند لأمر</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        <section style={card}>
          <SectionTitle>نوع السند</SectionTitle>

          <div style={getModeGridStyle(isMobile)}>
            <ModeButton
              active={noteMode === "independent"}
              title="سند مستقل"
              onClick={() => changeNoteMode("independent")}
            />

            <ModeButton
              active={noteMode === "contract"}
              title="مرتبط بعقد"
              disabled={!canLinkContract}
              onClick={() => changeNoteMode("contract")}
            />
          </div>

          {noteMode === "contract" && (
            <div style={sectionBlock}>
              <SectionTitle>اختيار العقد</SectionTitle>

              {loadingRequestedContract && (
                <div style={linkedInfoBox}>جاري تحميل العقد المرتبط...</div>
              )}

              <div style={searchWrapper}>
                <label style={labelStyle}>البحث عن العقد</label>

                <input
                  style={input}
                  placeholder="رقم العقد أو اسم العميل أو الهوية أو الجوال"
                  value={contractSearch}
                  onFocus={() => {
                    if (contractResults.length > 0) {
                      setShowContractResults(true);
                    }
                  }}
                  onChange={(event) => {
                    skipNextContractSearch.current = false;
                    setContractSearch(event.target.value);
                    setSelectedContract(null);
                    setAmount("");
                    setDueDate("");
                  }}
                />

                {showContractResults && (
                  <div style={searchResultsBox}>
                    {searchingContracts ? (
                      <div style={searchStateText}>جاري البحث...</div>
                    ) : contractResults.length === 0 ? (
                      <div style={searchStateText}>
                        لا توجد نتائج مطابقة
                      </div>
                    ) : (
                      contractResults.map((contract) => (
                        <button
                          key={contract.id}
                          type="button"
                          style={contractResultButton}
                          onClick={() => applySelectedContract(contract)}
                        >
                          <span style={contractResultNumber}>
                            عقد رقم {contract.contract_number}
                          </span>
                          <span style={contractResultName}>
                            {contract.customer_name ||
                              contract.customer?.full_name ||
                              "بدون اسم"}
                          </span>
                          <span style={contractResultDetails}>
                            الهوية: {contract.customer_national_id || "—"} ·
                            الجوال: {contract.customer_phone || "—"} · مبلغ
                            العقد: {formatMoney(Number(contract.payment_amount || 0))}{" "}
                            ر.س
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {noteMode === "contract" && selectedContract && (
            <div style={sectionBlock}>
              <SectionTitle>بيانات السند المرتبط</SectionTitle>

              <div style={linkedInfoBox}>
                جميع البيانات التالية مأخوذة من العقد مباشرة ولا يمكن
                تعديلها من صفحة السند.
              </div>

              <div style={beneficiaryPreview}>
                <PreviewItem
                  title="رقم العقد"
                  value={String(selectedContract.contract_number)}
                />
                <PreviewItem
                  title="المدين"
                  value={debtor.fullName || "—"}
                />
                <PreviewItem
                  title="رقم هوية المدين"
                  value={debtor.nationalId || "—"}
                />
                <PreviewItem
                  title="المستفيد"
                  value={contractBeneficiary?.name || "—"}
                />
                <PreviewItem
                  title="صفة المستفيد"
                  value={
                    contractBeneficiary?.type === "investor"
                      ? "مستثمر"
                      : "المؤسسة"
                  }
                />
                <PreviewItem
                  title="معرّف المستفيد"
                  value={contractBeneficiary?.identifier || "—"}
                />
                <PreviewItem
                  title="مبلغ السند"
                  value={`${formatMoney(noteAmount)} ر.س`}
                />
                <PreviewItem
                  title="تاريخ الاستحقاق"
                  value={dueDate ? formatDisplayDate(dueDate) : "—"}
                />
                <PreviewItem
                  title="مدينة التقاضي"
                  value={city || "غير محددة"}
                />
                <PreviewItem
                  title="الكفيل"
                  value={hasGuarantor ? guarantor.fullName || "—" : "بدون كفيل"}
                />
                {hasGuarantor && (
                  <PreviewItem
                    title="هوية الكفيل"
                    value={guarantor.nationalId || "—"}
                  />
                )}
              </div>

              <Field label="المبلغ كتابةً">
                <div style={amountWordsBox}>
                  {amountWords || "تعذر قراءة مبلغ العقد"}
                </div>
              </Field>
            </div>
          )}

          {noteMode === "independent" && (
            <>
              <div style={sectionBlock}>
                <SectionTitle>المستفيد</SectionTitle>

                <div style={getThreeColumnGridStyle(isCompact)}>
                  <ChoiceButton
                    active={beneficiaryType === "organization"}
                    onClick={() => changeBeneficiaryType("organization")}
                  >
                    المؤسسة
                  </ChoiceButton>
                  <ChoiceButton
                    active={beneficiaryType === "investor"}
                    onClick={() => changeBeneficiaryType("investor")}
                  >
                    مستثمر
                  </ChoiceButton>
                  <ChoiceButton
                    active={beneficiaryType === "other"}
                    onClick={() => changeBeneficiaryType("other")}
                  >
                    مستفيد آخر
                  </ChoiceButton>
                </div>

                {beneficiaryType === "organization" && (
                  <div style={beneficiaryPreview}>
                    <PreviewItem
                      title="اسم المستفيد"
                      value={branchData?.organization_name || "غير مسجل"}
                    />
                    <PreviewItem
                      title="السجل التجاري"
                      value={branchData?.commercial_record || "غير مسجل"}
                    />
                    <PreviewItem
                      title="الجوال"
                      value={
                        branchData?.organization_phone ||
                        branchData?.phone ||
                        "غير مسجل"
                      }
                    />
                  </div>
                )}

                {beneficiaryType === "investor" && (
                  <>
                    <Field label="المستثمر المستفيد" required>
                      <select
                        style={input}
                        value={beneficiaryInvestorId}
                        onChange={(event) =>
                          setBeneficiaryInvestorId(event.target.value)
                        }
                      >
                        <option value="">اختر المستثمر</option>
                        {investors.map((investor) => (
                          <option key={investor.id} value={investor.id}>
                            {investor.investor_name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    {selectedInvestor && (
                      <div style={beneficiaryPreview}>
                        <PreviewItem
                          title="اسم المستثمر"
                          value={selectedInvestor.investor_name}
                        />
                        <PreviewItem
                          title="رقم الهوية"
                          value={selectedInvestor.national_id || "غير مسجل"}
                        />
                        <PreviewItem
                          title="الجوال"
                          value={selectedInvestor.phone || "غير مسجل"}
                        />
                      </div>
                    )}
                  </>
                )}

                {beneficiaryType === "other" && (
                  <PartyFields
                    title="بيانات المستفيد"
                    party={beneficiary}
                    target="beneficiary"
                    isCompact={isCompact}
                    lookupStatus={lookupStatus.beneficiary}
                    lookupMessage={lookupMessages.beneficiary}
                    onChange={(patch) => updateParty("beneficiary", patch)}
                    onNationalIdChange={(value) =>
                      handlePartyNationalIdChange("beneficiary", value)
                    }
                  />
                )}
              </div>

              <div style={sectionBlock}>
                <PartyFields
                  title="بيانات المدين"
                  party={debtor}
                  target="debtor"
                  isCompact={isCompact}
                  lookupStatus={lookupStatus.debtor}
                  lookupMessage={lookupMessages.debtor}
                  onChange={(patch) => updateParty("debtor", patch)}
                  onNationalIdChange={(value) =>
                    handlePartyNationalIdChange("debtor", value)
                  }
                />
              </div>

              <div style={sectionBlock}>
                <SectionTitle>بيانات السند</SectionTitle>

                <div style={getFormGridStyle(isCompact)}>
                  <Field label="مبلغ السند" required>
                    <input
                      style={input}
                      inputMode="decimal"
                      placeholder="0"
                      value={amount}
                      onChange={(event) =>
                        setAmount(normalizeAmountInput(event.target.value))
                      }
                    />
                  </Field>

                  <Field label="مدينة التحرير / التقاضي - اختياري">
                    <input
                      style={input}
                      placeholder="اتركها فارغة عند عدم الحاجة"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                    />
                  </Field>
                </div>

                <Field label="طريقة الاستحقاق" required>
                  <div style={getModeGridStyle(isMobile)}>
                    <ChoiceButton
                      active={dueMode === "on_demand"}
                      onClick={() => {
                        setDueMode("on_demand");
                        setDueDate("");
                      }}
                    >
                      عند الطلب
                    </ChoiceButton>
                    <ChoiceButton
                      active={dueMode === "fixed_date"}
                      onClick={() => setDueMode("fixed_date")}
                    >
                      بتاريخ محدد
                    </ChoiceButton>
                  </div>
                </Field>

                {dueMode === "fixed_date" && (
                  <Field label="تاريخ الاستحقاق" required>
                    <ProfessionalDatePicker
                      value={dueDate}
                      onChange={setDueDate}
                      placeholder="اختر تاريخ الاستحقاق"
                    />
                  </Field>
                )}

                <Field label="المبلغ كتابةً">
                  <div style={amountWordsBox}>
                    {amountWords || "سيظهر المبلغ كتابةً بعد إدخال الرقم"}
                  </div>
                </Field>
              </div>

              <div style={sectionBlock}>
                <div style={guarantorHeader}>
                  <SectionTitle>الكفيل</SectionTitle>

                  <label style={toggleLabel}>
                    <input
                      type="checkbox"
                      checked={hasGuarantor}
                      disabled={!canManageGuarantor}
                      onChange={(event) =>
                        toggleGuarantor(event.target.checked)
                      }
                    />
                    <span>يوجد كفيل</span>
                  </label>
                </div>

                {!canManageGuarantor && (
                  <div style={permissionHint}>
                    لا تملك صلاحية إضافة أو تعديل الكفيل.
                  </div>
                )}

                {hasGuarantor && canManageGuarantor && (
                  <PartyFields
                    title="بيانات الكفيل"
                    party={guarantor}
                    target="guarantor"
                    isCompact={isCompact}
                    lookupStatus={lookupStatus.guarantor}
                    lookupMessage={lookupMessages.guarantor}
                    onChange={(patch) => updateParty("guarantor", patch)}
                    onNationalIdChange={(value) =>
                      handlePartyNationalIdChange("guarantor", value)
                    }
                  />
                )}
              </div>
            </>
          )}

          <div style={sectionBlock}>
            <SectionTitle>تحرير السند</SectionTitle>

            <Field label="تاريخ تحرير السند" required>
              <ProfessionalDatePicker
                value={issueDate}
                onChange={setIssueDate}
                placeholder="اختر تاريخ تحرير السند"
              />
            </Field>

            <Field label="ملاحظات السند">
              <textarea
                style={textarea}
                placeholder="ملاحظات اختيارية"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </div>

          <button
            type="button"
            style={{
              ...primaryButton,
              opacity: saving || loadingRequestedContract ? 0.7 : 1,
              cursor:
                saving || loadingRequestedContract
                  ? "not-allowed"
                  : "pointer",
            }}
            onClick={() => void createNote()}
            disabled={saving || loadingRequestedContract}
          >
            {saving ? "جاري إنشاء السند..." : "إنشاء سند لأمر"}
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
    </main>
  );
}

const CONTRACT_SELECT_FIELDS = `
  id,
  contract_number,
  customer_id,
  customer_name,
  customer_national_id,
  customer_phone,
  customer_birth_hijri,
  customer_work_name,
  payment_amount,
  payment_due_date,
  legal_city,
  investor_id,
  investor_name,
  print_party_type,
  print_party_name,
  print_party_identifier,
  first_party_type,
  first_party_name,
  first_party_identifier,
  has_guarantor,
  guarantor_customer_id,
  guarantor_name,
  guarantor_national_id,
  guarantor_phone,
  guarantor_birth_hijri,
  guarantor_work_name,
  contract_status,
  is_archived
`;

function getContractBeneficiaryPreview(
  contract: ContractSearchResult,
  branchData: BranchData | null,
  investors: Investor[]
): ContractBeneficiaryPreview {
  const partyType = String(
    contract.print_party_type || contract.first_party_type || "organization"
  ).toLowerCase();

  if (partyType === "investor") {
    const investor = investors.find(
      (item) => item.id === contract.investor_id
    );

    return {
      type: "investor",
      name:
        contract.print_party_name ||
        contract.first_party_name ||
        investor?.investor_name ||
        contract.investor_name ||
        "غير مسجل",
      identifier:
        contract.print_party_identifier ||
        contract.first_party_identifier ||
        investor?.national_id ||
        "غير مسجل",
      phone: investor?.phone || "غير مسجل",
    };
  }

  return {
    type: "organization",
    name:
      contract.print_party_name ||
      contract.first_party_name ||
      branchData?.organization_name ||
      "غير مسجل",
    identifier:
      contract.print_party_identifier ||
      contract.first_party_identifier ||
      branchData?.commercial_record ||
      "غير مسجل",
    phone:
      branchData?.organization_phone || branchData?.phone || "غير مسجل",
  };
}

function normalizeContractDueDate(value: string | null | undefined) {
  const normalized = normalizeNumber(String(value || "")).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return parseDateValue(normalized) ? normalized : null;
  }

  const dayFirst = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);

  if (dayFirst) {
    const iso = `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}`;
    return parseDateValue(iso) ? iso : null;
  }

  const yearFirst = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(normalized);

  if (yearFirst) {
    const iso = `${yearFirst[1]}-${yearFirst[2]}-${yearFirst[3]}`;
    return parseDateValue(iso) ? iso : null;
  }

  return null;
}

function normalizeHijriInput(value: string) {
  return normalizeNumber(value)
    .replace(/[.\-]/g, "/")
    .replace(/[^0-9/]/g, "")
    .replace(/\/{2,}/g, "/")
    .slice(0, 10);
}

function HeroUserArea({
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
  const isMobile = screen === "mobile";

  return (
    <div style={getHeroUserCardStyle(screen)}>
      <div style={getEmployeeTopRowStyle(screen)}>
        <div style={employeeIcon}>
          <UserIcon />
        </div>

        <div style={getEmployeeNameStyle(isMobile)}>
          {employeeName}
        </div>

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
  );
}

function PartyFields({
  title,
  party,
  target,
  isCompact,
  lookupStatus,
  lookupMessage,
  onChange,
  onNationalIdChange,
}: {
  title: string;
  party: PartyForm;
  target: CustomerLookupTarget;
  isCompact: boolean;
  lookupStatus: LookupStatus;
  lookupMessage: string;
  onChange: (patch: Partial<PartyForm>) => void;
  onNationalIdChange: (value: string) => void;
}) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>

      <div style={getFormGridStyle(isCompact)}>
        <Field label="رقم الهوية" required>
          <input
            style={input}
            inputMode="numeric"
            maxLength={10}
            autoComplete="off"
            placeholder="أدخل رقم الهوية للبحث تلقائيًا"
            value={party.nationalId}
            onChange={(event) => onNationalIdChange(event.target.value)}
          />
        </Field>

        <Field label="الاسم الكامل" required>
          <input
            style={input}
            placeholder="الاسم الرباعي"
            value={party.fullName}
            onChange={(event) =>
              onChange({ fullName: event.target.value })
            }
          />
        </Field>

        <Field label="رقم الجوال" required>
          <input
            style={input}
            inputMode="numeric"
            maxLength={10}
            placeholder="05xxxxxxxx"
            value={party.phone}
            onChange={(event) =>
              onChange({
                phone: normalizeNumber(event.target.value)
                  .replace(/[^0-9]/g, "")
                  .slice(0, 10),
              })
            }
          />
        </Field>

        <Field label="نوع تاريخ الميلاد" required>
          <select
            style={input}
            value={party.birthDateType}
            onChange={(event) => {
              const birthDateType =
                event.target.value as BirthDateType;

              onChange({
                birthDateType,
                birthHijri:
                  birthDateType === "hijri" ? party.birthHijri : "",
                birthGregorian:
                  birthDateType === "gregorian"
                    ? party.birthGregorian
                    : "",
              });
            }}
          >
            <option value="hijri">هجري</option>
            <option value="gregorian">ميلادي</option>
          </select>
        </Field>

        {party.birthDateType === "hijri" ? (
          <Field label="تاريخ الميلاد الهجري" required>
            <input
              style={input}
              inputMode="numeric"
              maxLength={10}
              placeholder="1440/05/12"
              value={party.birthHijri}
              onChange={(event) =>
                onChange({
                  birthHijri: normalizeHijriInput(event.target.value),
                })
              }
            />
          </Field>
        ) : (
          <Field label="تاريخ الميلاد الميلادي" required>
            <ProfessionalDatePicker
              value={party.birthGregorian}
              onChange={(value) =>
                onChange({ birthGregorian: value })
              }
              placeholder="اختر تاريخ الميلاد"
            />
          </Field>
        )}

        <Field label="الجنسية">
          <input
            style={input}
            placeholder="الجنسية"
            value={party.nationality}
            onChange={(event) =>
              onChange({ nationality: event.target.value })
            }
          />
        </Field>

        <Field label="العمل">
          <input
            style={input}
            placeholder="جهة أو مسمى العمل"
            value={party.workName}
            onChange={(event) =>
              onChange({ workName: event.target.value })
            }
          />
        </Field>

        <Field label="مصدر الهوية">
          <input
            style={input}
            placeholder="مصدر إصدار الهوية"
            value={party.identitySource}
            onChange={(event) =>
              onChange({ identitySource: event.target.value })
            }
          />
        </Field>
      </div>

      <Field label="العنوان">
        <input
          style={input}
          placeholder="العنوان"
          value={party.address}
          onChange={(event) => onChange({ address: event.target.value })}
        />
      </Field>

      <Field label={`ملاحظات ${getPartyDisplayLabel(target)}`}>
        <textarea
          style={smallTextarea}
          placeholder="ملاحظات اختيارية"
          value={party.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </Field>

      {lookupStatus !== "idle" && (
        <div
          role={lookupStatus === "error" ? "alert" : "status"}
          aria-live="polite"
          style={{
            ...lookupMessageBox,
            ...(lookupStatus === "not_found"
              ? lookupNotFoundBox
              : {}),
            ...(lookupStatus === "error" ? lookupErrorBox : {}),
          }}
        >
          {lookupStatus === "searching"
            ? "جاري البحث عن العميل..."
            : lookupMessage}
        </div>
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
  const initialDate = parseDateValue(value) || new Date();
  const [open, setOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(
    initialDate.getFullYear()
  );
  const [visibleMonth, setVisibleMonth] = useState(
    initialDate.getMonth()
  );

  useEffect(() => {
    const selectedDate = parseDateValue(value);

    if (selectedDate) {
      setVisibleYear(selectedDate.getFullYear());
      setVisibleMonth(selectedDate.getMonth());
    }
  }, [value]);

  const days = getCalendarDays(visibleYear, visibleMonth);

  function selectDate(year: number, month: number, day: number) {
    onChange(formatLocalDate(new Date(year, month, day)));
    setOpen(false);
  }

  function goToPreviousMonth() {
    if (visibleMonth === 0) {
      setVisibleMonth(11);
      setVisibleYear((current) => current - 1);
    } else {
      setVisibleMonth((current) => current - 1);
    }
  }

  function goToNextMonth() {
    if (visibleMonth === 11) {
      setVisibleMonth(0);
      setVisibleYear((current) => current + 1);
    } else {
      setVisibleMonth((current) => current + 1);
    }
  }

  return (
    <>
      <button
        type="button"
        style={datePickerButton}
        onClick={() => setOpen(true)}
      >
        <span
          style={value ? datePickerValue : datePickerPlaceholder}
        >
          {value ? formatDisplayDate(value) : placeholder}
        </span>

        <CalendarIcon />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={calendarOverlay}
            onPointerDown={() => setOpen(false)}
          >
            <div
              style={calendarModal}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div style={calendarHeader}>
                <button
                  type="button"
                  style={calendarNavigationButton}
                  onClick={goToPreviousMonth}
                >
                  ‹
                </button>

                <strong style={calendarMonthTitle}>
                  {String(visibleMonth + 1).padStart(2, "0")}/
                  {visibleYear}
                </strong>

                <button
                  type="button"
                  style={calendarNavigationButton}
                  onClick={goToNextMonth}
                >
                  ›
                </button>
              </div>

              <div style={calendarWeekGrid}>
                {ARABIC_WEEK_DAYS.map((day) => (
                  <div key={day} style={calendarWeekDay}>
                    {day}
                  </div>
                ))}
              </div>

              <div style={calendarDaysGrid}>
                {days.map((item, index) => {
                  if (!item) {
                    return <div key={`empty-${index}`} />;
                  }

                  const currentValue = `${visibleYear}-${String(
                    visibleMonth + 1
                  ).padStart(2, "0")}-${String(item).padStart(2, "0")}`;
                  const isSelected = currentValue === value;
                  const isToday = currentValue === getTodayIsoDate();

                  return (
                    <button
                      key={currentValue}
                      type="button"
                      style={{
                        ...calendarDayButton,
                        ...(isToday ? calendarTodayButton : {}),
                        ...(isSelected ? calendarSelectedButton : {}),
                      }}
                      onClick={() =>
                        selectDate(visibleYear, visibleMonth, item)
                      }
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <div style={calendarFooter}>
                <button
                  type="button"
                  style={calendarTodayAction}
                  onClick={() => {
                    const currentDate = new Date();
                    setVisibleYear(currentDate.getFullYear());
                    setVisibleMonth(currentDate.getMonth());
                    onChange(formatLocalDate(currentDate));
                    setOpen(false);
                  }}
                >
                  اختيار اليوم
                </button>

                <button
                  type="button"
                  style={calendarCancelAction}
                  onClick={() => setOpen(false)}
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

const ARABIC_WEEK_DAYS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const values: Array<number | null> = [];

  for (let index = 0; index < firstDay; index += 1) {
    values.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    values.push(day);
  }

  while (values.length % 7 !== 0) {
    values.push(null);
  }

  return values;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDisplayDate(value: string) {
  const date = parseDateValue(value);

  if (!date) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());

  return `${day}/${month}/${year}`;
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label style={fieldWrapper}>
      <span style={labelStyle}>
        {label}

        {required && (
          <span style={requiredMark}> *</span>
        )}
      </span>

      {children}
    </label>
  );
}

function SectionTitle({
  children,
}: {
  children: ReactNode;
}) {
  return <h2 style={sectionTitle}>{children}</h2>;
}

function ModeButton({
  active,
  title,
  disabled,
  onClick,
}: {
  active: boolean;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...modeButton,
        ...(active ? activeModeButton : {}),
        opacity: disabled ? 0.48 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {title}
    </button>
  );
}

function ChoiceButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...choiceButton,
        ...(active ? activeChoiceButton : {}),
      }}
    >
      {children}
    </button>
  );
}

function PreviewItem({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div style={previewItem}>
      <span style={previewTitle}>{title}</span>
      <strong style={previewValue}>{value}</strong>
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

function readStoredFinanceUser(): FinanceSessionUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const possibleKeys = ["finance_branch_user", "finance_user"];

  for (const key of possibleKeys) {
    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawValue) as FinanceSessionUser;

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return {
          ...parsed,
          id:
            parsed.id ||
            parsed.user_id ||
            localStorage.getItem("finance_user_id") ||
            undefined,
          branch_id:
            parsed.branch_id ||
            localStorage.getItem("finance_branch_id") ||
            undefined,
          branch_slug:
            parsed.branch_slug ||
            localStorage.getItem("finance_branch_slug") ||
            undefined,
          full_name:
            parsed.full_name ||
            localStorage.getItem("finance_user_name") ||
            undefined,
          username:
            parsed.username ||
            localStorage.getItem("finance_username") ||
            undefined,
          role:
            parsed.role ||
            localStorage.getItem("finance_role") ||
            undefined,
          permissions: Array.isArray(parsed.permissions)
            ? parsed.permissions
            : readStoredPermissions(),
          is_active:
            parsed.is_active === false
              ? false
              : localStorage.getItem("finance_is_active") !== "false",
        };
      }
    } catch {
      continue;
    }
  }

  const userId = localStorage.getItem("finance_user_id") || "";
  const branchSlug = localStorage.getItem("finance_branch_slug") || "";

  if (!userId || !branchSlug) {
    return null;
  }

  return {
    id: userId,
    branch_id: localStorage.getItem("finance_branch_id") || undefined,
    branch_slug: branchSlug,
    full_name: localStorage.getItem("finance_user_name") || "الموظف",
    username: localStorage.getItem("finance_username") || undefined,
    role: localStorage.getItem("finance_role") || undefined,
    permissions: readStoredPermissions(),
    is_active: localStorage.getItem("finance_is_active") !== "false",
  };
}

function readStoredPermissions() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  const rawPermissions = localStorage.getItem("finance_permissions");

  if (!rawPermissions) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(rawPermissions) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return rawPermissions
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function normalizeRole(role?: string) {
  return String(role || "").trim().toLowerCase();
}

function customerToParty(
  customer: CustomerData
): PartyForm {
  const birthDateType: BirthDateType =
    customer.birth_date_type === "gregorian"
      ? "gregorian"
      : "hijri";

  return {
    customerId: customer.id,
    fullName: customer.full_name || "",
    nationalId: customer.national_id || "",
    phone: customer.phone || "",
    birthDateType,
    birthHijri: customer.birth_hijri || "",
    birthGregorian: customer.birth_gregorian || "",
    nationality: customer.nationality || "",
    address: customer.address || "",
    workName:
      customer.work_name || customer.work || "",
    identitySource: customer.identity_source || "",
    notes: customer.notes || "",
  };
}

function getTodayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();

  const localDate = new Date(
    now.getTime() - offset * 60 * 1000
  );

  return localDate.toISOString().slice(0, 10);
}

function normalizeAmountInput(value: string) {
  const normalized = normalizeNumber(value)
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "");

  const parts = normalized.split(".");

  if (parts.length <= 1) {
    return normalized;
  }

  return `${parts[0]}.${parts
    .slice(1)
    .join("")
    .slice(0, 2)}`;
}

function escapePostgrestSearch(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, " ")
    .replace(/\(/g, " ")
    .replace(/\)/g, " ")
    .trim();
}

function getPartyDisplayLabel(
  target: CustomerLookupTarget
) {
  if (target === "debtor") {
    return "المدين";
  }

  if (target === "beneficiary") {
    return "المستفيد";
  }

  return "الكفيل";
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message ===
      "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(value);
}

function amountToArabicWords(value: number) {
  const safeValue = Math.abs(value);
  const riyals = Math.floor(safeValue);
  const halalas = Math.round((safeValue - riyals) * 100);

  const riyalWords =
    riyals === 0
      ? "صفر"
      : integerToArabicWords(riyals);

  let result = `${riyalWords} ريال سعودي`;

  if (halalas > 0) {
    result += ` و${integerToArabicWords(halalas)} هللة`;
  }

  return `${result} فقط لا غير`;
}

function integerToArabicWords(value: number): string {
  const integer = Math.floor(Math.abs(value));

  if (integer === 0) {
    return "صفر";
  }

  const groups = [
    {
      value: 1_000_000_000,
      singular: "مليار",
      dual: "ملياران",
      plural: "مليارات",
    },
    {
      value: 1_000_000,
      singular: "مليون",
      dual: "مليونان",
      plural: "ملايين",
    },
    {
      value: 1_000,
      singular: "ألف",
      dual: "ألفان",
      plural: "آلاف",
    },
  ];

  let remaining = integer;

  const parts: string[] = [];

  for (const group of groups) {
    const count = Math.floor(
      remaining / group.value
    );

    if (count > 0) {
      parts.push(
        renderArabicScale(
          count,
          group.singular,
          group.dual,
          group.plural
        )
      );

      remaining %= group.value;
    }
  }

  if (remaining > 0) {
    parts.push(
      numberBelowThousandToArabic(remaining)
    );
  }

  return parts.filter(Boolean).join(" و");
}

function renderArabicScale(
  count: number,
  singular: string,
  dual: string,
  plural: string
) {
  if (count === 1) {
    return singular;
  }

  if (count === 2) {
    return dual;
  }

  if (count >= 3 && count <= 10) {
    return `${numberBelowThousandToArabic(
      count
    )} ${plural}`;
  }

  return `${numberBelowThousandToArabic(
    count
  )} ${singular}`;
}

function numberBelowThousandToArabic(
  value: number
): string {
  const number = Math.floor(value);

  if (number === 0) {
    return "";
  }

  const units = [
    "",
    "واحد",
    "اثنان",
    "ثلاثة",
    "أربعة",
    "خمسة",
    "ستة",
    "سبعة",
    "ثمانية",
    "تسعة",
  ];

  const teens: Record<number, string> = {
    10: "عشرة",
    11: "أحد عشر",
    12: "اثنا عشر",
    13: "ثلاثة عشر",
    14: "أربعة عشر",
    15: "خمسة عشر",
    16: "ستة عشر",
    17: "سبعة عشر",
    18: "ثمانية عشر",
    19: "تسعة عشر",
  };

  const tens = [
    "",
    "",
    "عشرون",
    "ثلاثون",
    "أربعون",
    "خمسون",
    "ستون",
    "سبعون",
    "ثمانون",
    "تسعون",
  ];

  const hundreds = [
    "",
    "مائة",
    "مائتان",
    "ثلاثمائة",
    "أربعمائة",
    "خمسمائة",
    "ستمائة",
    "سبعمائة",
    "ثمانمائة",
    "تسعمائة",
  ];

  const parts: string[] = [];

  const hundred = Math.floor(number / 100);
  const remainder = number % 100;

  if (hundred > 0) {
    parts.push(hundreds[hundred]);
  }

  if (remainder > 0) {
    if (remainder < 10) {
      parts.push(units[remainder]);
    } else if (remainder < 20) {
      parts.push(teens[remainder]);
    } else {
      const ten = Math.floor(remainder / 10);
      const unit = remainder % 10;

      if (unit > 0) {
        parts.push(
          `${units[unit]} و${tens[ten]}`
        );
      } else {
        parts.push(tens[ten]);
      }
    }
  }

  return parts.join(" و");
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
    backgroundAttachment: isMobile ? "scroll" : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily: "var(--font-almarai), sans-serif",
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

function getLoadingBoxStyle(
  isMobile: boolean
): CSSProperties {
  return {
    maxWidth: 520,
    margin: isMobile
      ? "110px auto"
      : "170px auto",
    padding: 28,
    borderRadius: 20,
    textAlign: "center",
    color: "#1e3a8a",
    background: "rgba(255,255,255,0.94)",
    border: "1px solid #dbeafe",
    boxShadow:
      "0 18px 45px rgba(15,23,42,0.08)",
    fontSize: 16,
    fontWeight: 900,
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
        ? 29
        : screen === "tablet"
          ? 33
          : 38,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.5px",
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

function getModeGridStyle(
  isMobile: boolean
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isMobile
      ? "1fr"
      : "repeat(2,minmax(0,1fr))",
    gap: 12,
    marginBottom: 18,
  };
}

function getThreeColumnGridStyle(
  isCompact: boolean
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isCompact
      ? "1fr"
      : "repeat(3,minmax(0,1fr))",
    gap: 10,
    marginBottom: 16,
  };
}

function getFormGridStyle(
  isCompact: boolean
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isCompact
      ? "1fr"
      : "repeat(2,minmax(0,1fr))",
    gap: "14px 16px",
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
    "1px solid #d9e3f5",
  borderRadius: 20,
  padding: 20,
  marginBottom: 16,
  boxShadow:
    "0 10px 26px rgba(15,23,42,0.055)",
};

const sectionBlock: CSSProperties = {
  borderTop:
    "1px solid #e2e8f0",
  paddingTop: 22,
  marginTop: 22,
};

const sectionTitle: CSSProperties = {
  margin: "0 0 15px",
  color: "#0f2b55",
  fontSize: 19,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const fieldWrapper: CSSProperties = {
  display: "block",
  width: "100%",
  marginBottom: 13,
};

const labelStyle: CSSProperties = {
  display: "block",
  color: "#334155",
  fontSize: 14,
  fontWeight: 900,
  marginBottom: 8,
};

const requiredMark: CSSProperties = {
  color: "#dc2626",
};

const input: CSSProperties = {
  width: "100%",
  minHeight: 50,
  padding: "12px 14px",
  borderRadius: 13,
  border:
    "1px solid #cbd7ea",
  fontSize: 15,
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const textarea: CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: 14,
  borderRadius: 13,
  border:
    "1px solid #cbd7ea",
  fontSize: 15,
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#0f172a",
  fontFamily:
    "var(--font-almarai), sans-serif",
  resize: "vertical",
};

const smallTextarea: CSSProperties = {
  ...textarea,
  minHeight: 80,
};

const modeButton: CSSProperties = {
  minHeight: 54,
  padding: "13px 18px",
  borderRadius: 15,
  border:
    "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 15,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const activeModeButton: CSSProperties = {
  border:
    "1px solid #2563eb",
  color: "#ffffff",
  background:
    "linear-gradient(135deg,#0f4db8,#2563eb,#38bdf8)",
  boxShadow:
    "0 8px 18px rgba(37,99,235,0.18)",
};

const choiceButton: CSSProperties = {
  minHeight: 48,
  borderRadius: 13,
  border:
    "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const activeChoiceButton: CSSProperties = {
  border:
    "1px solid #16a34a",
  background:
    "linear-gradient(135deg,#dcfce7,#bbf7d0)",
  color: "#166534",
};

const searchWrapper: CSSProperties = {
  position: "relative",
};

const searchResultsBox: CSSProperties = {
  position: "absolute",
  top: "calc(100% - 5px)",
  right: 0,
  left: 0,
  zIndex: 30,
  maxHeight: 360,
  overflowY: "auto",
  borderRadius: 15,
  border:
    "1px solid #bfdbfe",
  background: "#ffffff",
  boxShadow:
    "0 18px 42px rgba(15,23,42,0.16)",
  padding: 7,
};

const contractResultButton: CSSProperties = {
  width: "100%",
  border: "none",
  borderBottom:
    "1px solid #e2e8f0",
  background: "#ffffff",
  textAlign: "right",
  padding: "12px 13px",
  cursor: "pointer",
  display: "grid",
  gap: 5,
  color: "#0f172a",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const contractResultNumber: CSSProperties = {
  color: "#1d4ed8",
  fontSize: 14,
  fontWeight: 900,
};

const contractResultName: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
};

const contractResultDetails: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.7,
};

const searchStateText: CSSProperties = {
  padding: 18,
  color: "#64748b",
  textAlign: "center",
  fontSize: 14,
  fontWeight: 800,
};




const beneficiaryPreview: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
  padding: 15,
  borderRadius: 14,
  border:
    "1px solid #dbeafe",
  background: "#f8fbff",
};

const previewItem: CSSProperties = {
  minWidth: 0,
};

const previewTitle: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 5,
};

const previewValue: CSSProperties = {
  display: "block",
  color: "#0f2b55",
  fontSize: 14,
  fontWeight: 900,
  overflowWrap: "anywhere",
};


const amountWordsBox: CSSProperties = {
  minHeight: 58,
  padding: "14px 16px",
  borderRadius: 13,
  border:
    "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  fontSize: 15,
  lineHeight: 1.8,
  fontWeight: 900,
};

const lookupMessageBox: CSSProperties = {
  marginTop: 4,
  marginBottom: 12,
  padding: "10px 12px",
  borderRadius: 11,
  border: "1px solid",
  fontSize: 12,
  lineHeight: 1.65,
  fontWeight: 800,
};

const guarantorHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  flexWrap: "wrap",
  gap: 12,
};

const toggleLabel: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "#334155",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const permissionHint: CSSProperties = {
  padding: "11px 13px",
  borderRadius: 12,
  border:
    "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  fontSize: 13,
  fontWeight: 800,
};

const primaryButton: CSSProperties = {
  width: "100%",
  minHeight: 56,
  padding: 16,
  marginTop: 22,
  background:
    "linear-gradient(135deg,#0b3d91,#0d65d9,#22a9e5)",
  color: "#ffffff",
  border: "none",
  borderRadius: 15,
  fontSize: 16,
  fontWeight: 900,
  boxShadow:
    "0 10px 22px rgba(13,101,217,0.22)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const permissionDeniedCard: CSSProperties = {
  background:
    "rgba(255,255,255,0.96)",
  border:
    "1px solid #fecaca",
  borderRadius: 20,
  padding:
    "38px 20px",
  textAlign: "center",
  boxShadow:
    "0 12px 30px rgba(15,23,42,0.06)",
};

const permissionDeniedIcon: CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: "50%",
  margin:
    "0 auto 14px",
  display: "flex",
  alignItems: "center",
  justifyContent:
    "center",
  background: "#fee2e2",
  color: "#b91c1c",
  fontSize: 30,
  fontWeight: 900,
};

const permissionDeniedTitle: CSSProperties = {
  margin: "0 0 8px",
  color: "#991b1b",
  fontSize: 21,
  fontWeight: 900,
};

const permissionDeniedText: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 14,
  fontWeight: 800,
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
  marginBottom: 12,
};

const backButton: CSSProperties = {
  minWidth: 116,
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
const linkedInfoBox: CSSProperties = {
  marginBottom: 14,
  padding: "12px 14px",
  borderRadius: 13,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e40af",
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1.8,
};

const lookupNotFoundBox: CSSProperties = {
  borderColor: "#fde68a",
  background: "#fffbeb",
  color: "#92400e",
};

const lookupErrorBox: CSSProperties = {
  borderColor: "#fecaca",
  background: "#fef2f2",
  color: "#991b1b",
};

const datePickerButton: CSSProperties = {
  ...input,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
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
  background: "rgba(15,23,42,0.45)",
  backdropFilter: "blur(5px)",
};

const calendarModal: CSSProperties = {
  width: "100%",
  maxWidth: 430,
  padding: 20,
  borderRadius: 22,
  background: "#ffffff",
  border: "1px solid #dbeafe",
  boxShadow: "0 30px 80px rgba(15,23,42,0.28)",
  direction: "rtl",
  fontFamily: "var(--font-almarai), sans-serif",
};

const calendarHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "48px 1fr 48px",
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
  gridTemplateColumns: "repeat(7,1fr)",
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
  gridTemplateColumns: "repeat(7,1fr)",
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
  fontFamily: "var(--font-almarai), sans-serif",
};

const calendarTodayButton: CSSProperties = {
  border: "1.5px solid #22c55e",
  color: "#15803d",
};

const calendarSelectedButton: CSSProperties = {
  background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
  boxShadow: "0 6px 14px rgba(37,99,235,0.24)",
};

const calendarFooter: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 18,
};

const calendarTodayAction: CSSProperties = {
  minHeight: 46,
  border: "none",
  borderRadius: 13,
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
};

const calendarCancelAction: CSSProperties = {
  minHeight: 46,
  border: "1px solid #cbd5e1",
  borderRadius: 13,
  background: "#ffffff",
  color: "#475569",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
};
