"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  clearFinanceSession,
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  logoutFinanceUser,
  redirectToFinanceLogin,
  validateFinanceSession,
  type FinanceSessionUser,
} from "@/lib/financeSession";

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type NoteFilter =
  | "all"
  | "with-note"
  | "without-note";

type SortType =
  | "all"
  | "paid"
  | "overdue"
  | "not-due";

type DelayFilter =
  | "all"
  | "1-7"
  | "8-15"
  | "16-30"
  | "31-60"
  | "61-plus";

type NoteModalMode =
  | "create"
  | "edit";

type FollowUpNote = {
  id: string;
  branch_id: string;
  contract_id: string;
  customer_id?: string | null;
  investor_id?: string | null;
  note_text: string;
  created_by_user_id: string;
  created_by_name: string;
  created_at: string;
  updated_at?: string | null;
};

type FollowUpRow = {
  id: string;
  contract_id: string;
  contract_number?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_national_id?: string | null;
  investor_id?: string | null;
  investor_name?: string | null;
  remaining_amount: number;
  debt_amount: number;
  payment_amount: number;
  payment_due_date?: string | null;
  contract_status?: string | null;
  follow_up_status:
    | "paid"
    | "overdue"
    | "not_due";
  days_late: number;
  latest_note?: FollowUpNote | null;
  notes: FollowUpNote[];
  notes_count: number;
};

type FollowUpApiResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  rows?: unknown[];
  overdue_count?: number;
  server_date?: string;
  organization_name?: string;
  note?: unknown;
};

type SupportSessionResponse = {
  ok?: boolean;
  message?: string;
  session_type?: "admin_support";
  user?: FinanceSessionUser;
};

const BRANCH_SLUG_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

const MANAGER_ROLES = new Set([
  "main_admin",
  "branch_manager",
  "admin",
  "manager",
  "مدير رئيسي",
  "مدير فرع",
  "مدير",
]);

const ITEMS_PER_PAGE = 25;

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String(
        "٠١٢٣٤٥٦٧٨٩".indexOf(
          digit
        )
      )
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".indexOf(
          digit
        )
      )
    );
}

function cleanPhone(
  value: string | null | undefined
) {
  return normalizeDigits(
    String(value ?? "")
  ).replace(/\D/g, "");
}


function normalizeNote(
  value: unknown
): FollowUpNote | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const note =
    value as Record<string, unknown>;

  const id =
    String(note.id ?? "").trim();

  const contractId =
    String(
      note.contract_id ?? ""
    ).trim();

  if (!id || !contractId) {
    return null;
  }

  return {
    id,
    branch_id:
      String(
        note.branch_id ?? ""
      ),
    contract_id:
      contractId,
    customer_id:
      note.customer_id
        ? String(note.customer_id)
        : null,
    investor_id:
      note.investor_id
        ? String(note.investor_id)
        : null,
    note_text:
      String(
        note.note_text ?? ""
      ).slice(0, 2000),
    created_by_user_id:
      String(
        note.created_by_user_id ??
          ""
      ),
    created_by_name:
      String(
        note.created_by_name ??
          ""
      ),
    created_at:
      String(
        note.created_at ?? ""
      ),
    updated_at:
      note.updated_at
        ? String(note.updated_at)
        : null,
  };
}

function normalizeRow(
  value: unknown
): FollowUpRow {
  const row =
    value &&
    typeof value === "object"
      ? (value as Record<
          string,
          unknown
        >)
      : {};

  const notes =
    Array.isArray(row.notes)
      ? row.notes
          .map(normalizeNote)
          .filter(
            (
              note
            ): note is FollowUpNote =>
              Boolean(note)
          )
      : [];

  const latestNote =
    normalizeNote(
      row.latest_note
    ) ??
    notes[0] ??
    null;

  const contractId =
    String(
      row.contract_id ??
        row.id ??
        ""
    );

  return {
    id:
      String(
        row.id ??
          contractId
      ),
    contract_id:
      contractId,
    contract_number:
      row.contract_number
        ? String(
            row.contract_number
          )
        : null,
    customer_id:
      row.customer_id
        ? String(
            row.customer_id
          )
        : null,
    customer_name:
      row.customer_name
        ? String(
            row.customer_name
          )
        : null,
    customer_phone:
      row.customer_phone
        ? String(
            row.customer_phone
          )
        : null,
    customer_national_id:
      row.customer_national_id
        ? String(
            row.customer_national_id
          )
        : null,
    investor_id:
      row.investor_id
        ? String(
            row.investor_id
          )
        : null,
    investor_name:
      row.investor_name
        ? String(
            row.investor_name
          )
        : null,
    remaining_amount:
      Number(
        row.remaining_amount ?? 0
      ) || 0,
    debt_amount:
      Number(
        row.debt_amount ?? 0
      ) || 0,
    payment_amount:
      Number(
        row.payment_amount ?? 0
      ) || 0,
    payment_due_date:
      row.payment_due_date
        ? String(
            row.payment_due_date
          )
        : null,
    contract_status:
      row.contract_status
        ? String(
            row.contract_status
          )
        : null,
    follow_up_status:
      row.follow_up_status === "paid" ||
      row.follow_up_status === "overdue" ||
      row.follow_up_status === "not_due"
        ? row.follow_up_status
        : "not_due",
    days_late:
      Number(
        row.days_late ?? 0
      ) || 0,
    latest_note:
      latestNote,
    notes,
    notes_count:
      Number(
        row.notes_count ??
          notes.length
      ) || notes.length,
  };
}

async function readApiResponse(
  response: Response
): Promise<FollowUpApiResponse> {
  try {
    return (await response.json()) as FollowUpApiResponse;
  } catch {
    return {};
  }
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message ===
      "string"
  ) {
    return error.message.slice(
      0,
      300
    );
  }

  return fallback;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(
    "ar-SA",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatGregorianDate(
  value?: string | null
) {
  if (!value) {
    return "-";
  }

  const raw =
    value.slice(0, 10);

  const parts =
    raw.split("-");

  if (
    parts.length === 3 &&
    parts.every(Boolean)
  ) {
    const [year, month, day] =
      parts;

    return `${day}/${month}/${year}`;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date);
}

function formatGregorianDateTime(
  value?: string | null
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  const formatted =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Asia/Riyadh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(date);

  return formatted.replace(
    ",",
    " -"
  );
}

function matchesDelayFilter(
  daysLate: number,
  filter: DelayFilter
) {
  if (filter === "1-7") {
    return (
      daysLate >= 1 &&
      daysLate <= 7
    );
  }

  if (filter === "8-15") {
    return (
      daysLate >= 8 &&
      daysLate <= 15
    );
  }

  if (filter === "16-30") {
    return (
      daysLate >= 16 &&
      daysLate <= 30
    );
  }

  if (filter === "31-60") {
    return (
      daysLate >= 31 &&
      daysLate <= 60
    );
  }

  if (filter === "61-plus") {
    return daysLate >= 61;
  }

  return true;
}

export default function FollowUpPage() {
  const params = useParams();
  const router = useRouter();

  const branch =
    String(
      params.branch ?? ""
    )
      .trim()
      .toLowerCase();

  const [screen, setScreen] =
    useState<ScreenType>(
      "desktop"
    );

  const [
    authChecked,
    setAuthChecked,
  ] = useState(false);

  const [
    sessionUser,
    setSessionUser,
  ] =
    useState<FinanceSessionUser | null>(
      null
    );

  const [
    sessionType,
    setSessionType,
  ] = useState<
    "branch_user" |
    "admin_support" |
    null
  >(null);

  const [
    employeeName,
    setEmployeeName,
  ] = useState("الموظف");

  const [
    organizationName,
    setOrganizationName,
  ] = useState("");

  const [rows, setRows] =
    useState<FollowUpRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [search, setSearch] =
    useState("");

  const [
    investorFilter,
    setInvestorFilter,
  ] = useState("");

  const [
    noteFilter,
    setNoteFilter,
  ] =
    useState<NoteFilter>(
      "all"
    );

  const [
    sortType,
    setSortType,
  ] =
    useState<SortType>(
      "all"
    );

  const [
    delayFilter,
    setDelayFilter,
  ] =
    useState<DelayFilter>(
      "all"
    );

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    serverDate,
    setServerDate,
  ] = useState("");

  const [
    actionsRow,
    setActionsRow,
  ] =
    useState<FollowUpRow | null>(
      null
    );

  const [
    notesRow,
    setNotesRow,
  ] =
    useState<FollowUpRow | null>(
      null
    );

  const [
    noteModalOpen,
    setNoteModalOpen,
  ] = useState(false);

  const [
    noteModalMode,
    setNoteModalMode,
  ] =
    useState<NoteModalMode>(
      "create"
    );

  const [
    selectedNote,
    setSelectedNote,
  ] =
    useState<FollowUpNote | null>(
      null
    );

  const [
    noteText,
    setNoteText,
  ] = useState("");

  const [
    savingNote,
    setSavingNote,
  ] = useState(false);

  const [
    deletingNoteId,
    setDeletingNoteId,
  ] =
    useState<string | null>(
      null
    );

  const [
    logoutLoading,
    setLogoutLoading,
  ] = useState(false);

  const loadRequestIdRef =
    useRef(0);

  const isMobile =
    screen === "mobile";

  const isTablet =
    screen === "tablet";

  const isCompact =
    isMobile || isTablet;

  const isSupportSession =
    sessionType ===
    "admin_support";

  const currentUserId =
    String(
      sessionUser?.id ?? ""
    );

  const isManager =
    isSupportSession ||
    MANAGER_ROLES.has(
      String(
        sessionUser?.role ?? ""
      ).trim()
    );

  const investors =
    useMemo(() => {
      return Array.from(
        new Set(
          rows
            .map(
              (row) =>
                row.investor_name?.trim()
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(value)
            )
        )
      ).sort((a, b) =>
        a.localeCompare(
          b,
          "ar"
        )
      );
    }, [rows]);

  const filteredRows =
    useMemo(() => {
      const query =
        normalizeDigits(
          search
        )
          .trim()
          .toLowerCase();

      return rows.filter(
        (row) => {
          const allNotesText =
            row.notes
              .map(
                (note) =>
                  note.note_text
              )
              .join(" ");

          const searchValues =
            [
              row.contract_number,
              row.customer_name,
              row.customer_phone,
              row.customer_national_id,
              row.investor_name,
              allNotesText,
            ]
              .map((value) =>
                normalizeDigits(
                  String(
                    value ?? ""
                  )
                ).toLowerCase()
              )
              .join(" ");

          if (
            query &&
            !searchValues.includes(
              query
            )
          ) {
            return false;
          }

          if (
            investorFilter &&
            row.investor_name !==
              investorFilter
          ) {
            return false;
          }

          if (
            noteFilter ===
              "with-note" &&
            row.notes_count === 0
          ) {
            return false;
          }

          if (
            noteFilter ===
              "without-note" &&
            row.notes_count > 0
          ) {
            return false;
          }

          if (
            sortType === "paid" &&
            row.follow_up_status !== "paid"
          ) {
            return false;
          }

          if (
            sortType === "overdue" &&
            row.follow_up_status !== "overdue"
          ) {
            return false;
          }

          if (
            sortType === "not-due" &&
            row.follow_up_status !== "not_due"
          ) {
            return false;
          }

          if (
            sortType === "overdue" &&
            !matchesDelayFilter(
              row.days_late,
              delayFilter
            )
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      rows,
      search,
      investorFilter,
      noteFilter,
      sortType,
      delayFilter,
    ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRows.length /
          ITEMS_PER_PAGE
      )
    );

  const paginatedRows =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        ITEMS_PER_PAGE;

      return filteredRows.slice(
        start,
        start +
          ITEMS_PER_PAGE
      );
    }, [
      filteredRows,
      currentPage,
    ]);

  const totalRemaining =
    useMemo(() => {
      return filteredRows.reduce(
        (sum, row) =>
          sum +
          row.remaining_amount,
        0
      );
    }, [filteredRows]);

  const withoutNotesCount =
    useMemo(() => {
      return filteredRows.filter(
        (row) =>
          row.notes_count === 0
      ).length;
    }, [filteredRows]);

  const withNotesCount =
    filteredRows.length -
    withoutNotesCount;


  const overdueCount =
    rows.filter(
      (row) =>
        row.follow_up_status ===
        "overdue"
    ).length;


  useEffect(() => {
    function updateScreen() {
      const width =
        window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (
        width < 980
      ) {
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
    if (
      !branch ||
      !BRANCH_SLUG_PATTERN.test(
        branch
      )
    ) {
      clearFinanceSession({
        preserveReturnPath:
          true,
      });

      redirectToFinanceLogin(
        router,
        {
          preserveReturnPath:
            true,
        }
      );

      return;
    }

    let cancelled = false;

    async function initializeSession() {
      const validation =
        validateFinanceSession(
          branch
        );

      if (
        validation.valid &&
        validation.user
      ) {
        const user =
          validation.user;

        const permissions =
          Array.isArray(
            user.permissions
          )
            ? user.permissions
            : [];

        const allowed =
          MANAGER_ROLES.has(
            String(
              user.role ?? ""
            ).trim()
          ) ||
          permissions.includes(
            "follow_up"
          );

        if (!allowed) {
          window.alert(
            "لا تملك صلاحية الدخول إلى المتابعة والتواصل"
          );

          router.replace(
            `/finance/${branch}`
          );

          return;
        }

        if (cancelled) {
          return;
        }

        setSessionUser(user);
        setSessionType(
          "branch_user"
        );

        setEmployeeName(
          getFinanceEmployeeName(
            user
          )
        );


        setAuthChecked(true);
        return;
      }

      try {
        const response =
          await fetch(
            `/finance/api/support-session?branch=${encodeURIComponent(
              branch
            )}`,
            {
              method: "GET",
              credentials:
                "include",
              cache: "no-store",
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const payload =
          (await response
            .json()
            .catch(
              () => ({})
            )) as SupportSessionResponse;

        if (cancelled) {
          return;
        }

        if (
          response.ok &&
          payload.ok &&
          payload.session_type ===
            "admin_support" &&
          payload.user
        ) {
          setSessionUser(
            payload.user
          );

          setSessionType(
            "admin_support"
          );

          setEmployeeName(
            getFinanceEmployeeName(
              payload.user
            )
          );


          setAuthChecked(true);
          return;
        }
      } catch (error) {
        console.error(
          "Support session verification failed:",
          error
        );
      }

      if (!cancelled) {
        redirectToFinanceLogin(
          router,
          {
            branchSlug: branch,
            preserveReturnPath:
              true,
          }
        );
      }
    }

    void initializeSession();

    return () => {
      cancelled = true;
    };
  }, [branch, router]);

  useEffect(() => {
    if (
      !authChecked ||
      !sessionUser ||
      isSupportSession
    ) {
      return;
    }

    return installFinanceActivityTracker({
      expectedBranchSlug:
        branch,

      onExpired: () => {
        redirectToFinanceLogin(
          router,
          {
            branchSlug: branch,
            preserveReturnPath:
              true,
          }
        );
      },

      onInvalidated: () => {
        clearFinanceSession();
        router.replace(
          "/login"
        );
      },

      onSessionUpdated: (
        updatedUser
      ) => {
        const permissions =
          Array.isArray(
            updatedUser.permissions
          )
            ? updatedUser.permissions
            : [];

        const allowed =
          MANAGER_ROLES.has(
            String(
              updatedUser.role ??
                ""
            ).trim()
          ) ||
          permissions.includes(
            "follow_up"
          );

        if (!allowed) {
          router.replace(
            `/finance/${branch}`
          );

          return;
        }

        setSessionUser(
          updatedUser
        );

        setEmployeeName(
          getFinanceEmployeeName(
            updatedUser
          )
        );

      },
    });
  }, [
    authChecked,
    branch,
    router,
    sessionUser?.id,
    isSupportSession,
  ]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    let cancelled = false;

    void loadRows(
      () => cancelled
    );

    return () => {
      cancelled = true;
    };
  }, [
    authChecked,
    branch,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    investorFilter,
    noteFilter,
    sortType,
    delayFilter,
  ]);


  useEffect(() => {
    if (sortType !== "overdue") {
      setDelayFilter("all");
    }
  }, [sortType]);

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(
        totalPages
      );
    }
  }, [
    currentPage,
    totalPages,
  ]);

  useEffect(() => {
    const anyModalOpen =
      Boolean(
        actionsRow ||
        notesRow ||
        noteModalOpen
      );

    if (!anyModalOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleEscape(
      event: KeyboardEvent
    ) {
      if (
        event.key !== "Escape" ||
        savingNote ||
        deletingNoteId
      ) {
        return;
      }

      if (noteModalOpen) {
        closeNoteModal();
      } else if (notesRow) {
        setNotesRow(null);
      } else {
        setActionsRow(null);
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [
    actionsRow,
    notesRow,
    noteModalOpen,
    savingNote,
    deletingNoteId,
  ]);

  function handleApiSessionError(
    status: number,
    code?: string
  ) {
    if (
      status === 401 ||
      code ===
        "INVALID_SESSION" ||
      code ===
        "SESSION_REVOKED" ||
      code ===
        "BRANCH_MISMATCH"
    ) {
      clearFinanceSession({
        preserveReturnPath:
          true,
      });

      redirectToFinanceLogin(
        router,
        {
          branchSlug: branch,
          preserveReturnPath:
            true,
        }
      );

      return true;
    }

    if (status === 403) {
      window.alert(
        "لا تملك صلاحية تنفيذ هذه العملية"
      );

      router.replace(
        `/finance/${branch}`
      );

      return true;
    }

    return false;
  }

  async function loadRows(
    isCancelled: () => boolean =
      () => false,
    silent = false
  ) {
    const requestId =
      ++loadRequestIdRef.current;

    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response =
        await fetch(
          `/finance/api/follow-up?branch=${encodeURIComponent(
            branch
          )}`,
          {
            method: "GET",
            credentials:
              "include",
            cache: "no-store",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const payload =
        await readApiResponse(
          response
        );

      if (
        isCancelled() ||
        requestId !==
          loadRequestIdRef.current
      ) {
        return false;
      }

      if (
        !response.ok ||
        payload.ok === false
      ) {
        if (
          handleApiSessionError(
            response.status,
            payload.code
          )
        ) {
          return false;
        }

        throw new Error(
          payload.message ||
            "تعذر تحميل بيانات المتابعة"
        );
      }

      const normalizedRows =
        Array.isArray(
          payload.rows
        )
          ? payload.rows.map(
              normalizeRow
            )
          : [];

      setRows(
        normalizedRows
      );

      setServerDate(
        String(
          payload.server_date ??
            ""
        )
      );

      setOrganizationName(
        String(
          payload.organization_name ??
            ""
        ).trim()
      );

      if (notesRow) {
        const refreshedNotesRow =
          normalizedRows.find(
            (row) =>
              row.contract_id ===
              notesRow.contract_id
          ) ?? null;

        setNotesRow(
          refreshedNotesRow
        );
      }

      return true;
    } catch (error) {
      if (
        isCancelled() ||
        requestId !==
          loadRequestIdRef.current
      ) {
        return false;
      }

      console.error(
        "Follow-up page load error:",
        error
      );

      setRows([]);

      window.alert(
        getErrorMessage(
          error,
          "تعذر تحميل بيانات المتابعة والتواصل"
        )
      );

      return false;
    } finally {
      if (
        !isCancelled() &&
        requestId ===
          loadRequestIdRef.current
      ) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  function canManageNote(
    note?: FollowUpNote | null
  ) {
    if (!note) {
      return false;
    }

    return (
      isManager ||
      note.created_by_user_id ===
        currentUserId
    );
  }

  function openCreateNote(
    row: FollowUpRow
  ) {
    setActionsRow(null);
    setSelectedNote(null);
    setNoteModalMode("create");
    setNoteText("");
    setNotesRow(row);
    setNoteModalOpen(true);
  }

  function openEditNote(
    row: FollowUpRow,
    note: FollowUpNote
  ) {
    if (!canManageNote(note)) {
      window.alert(
        "لا يمكنك تعديل هذه الملاحظة"
      );

      return;
    }

    setActionsRow(null);
    setSelectedNote(note);
    setNoteModalMode("edit");
    setNoteText(
      note.note_text
    );
    setNotesRow(row);
    setNoteModalOpen(true);
  }

  function closeNoteModal(
    force = false
  ) {
    if (
      !force &&
      (savingNote ||
        deletingNoteId)
    ) {
      return;
    }

    setNoteModalOpen(false);
    setSelectedNote(null);
    setNoteText("");
    setNoteModalMode("create");
  }

  async function saveNote() {
    if (!notesRow) {
      return;
    }

    const normalizedText =
      noteText.trim();

    if (
      normalizedText.length < 2 ||
      normalizedText.length > 2000
    ) {
      window.alert(
        "اكتب ملاحظة متابعة صحيحة من حرفين إلى 2000 حرف"
      );

      return;
    }

    if (
      noteModalMode === "edit" &&
      !selectedNote
    ) {
      return;
    }

    try {
      setSavingNote(true);

      const response =
        await fetch(
          "/finance/api/follow-up",
          {
            method:
              noteModalMode ===
              "edit"
                ? "PATCH"
                : "POST",
            credentials:
              "include",
            cache: "no-store",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify(
              noteModalMode ===
                "edit"
                ? {
                    branch,
                    noteId:
                      selectedNote?.id,
                    noteText:
                      normalizedText,
                  }
                : {
                    branch,
                    contractId:
                      notesRow.contract_id,
                    noteText:
                      normalizedText,
                  }
            ),
          }
        );

      const payload =
        await readApiResponse(
          response
        );

      if (
        !response.ok ||
        payload.ok === false
      ) {
        if (
          handleApiSessionError(
            response.status,
            payload.code
          )
        ) {
          return;
        }

        throw new Error(
          payload.message ||
            "تعذر حفظ ملاحظة المتابعة"
        );
      }

      closeNoteModal(true);

      await loadRows(
        () => false,
        true
      );

      window.alert(
        payload.message ||
          "تم حفظ ملاحظة المتابعة"
      );
    } catch (error) {
      console.error(
        "Save follow-up note error:",
        error
      );

      window.alert(
        getErrorMessage(
          error,
          "تعذر حفظ ملاحظة المتابعة"
        )
      );
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(
    note: FollowUpNote
  ) {
    if (!canManageNote(note)) {
      window.alert(
        "لا يمكنك حذف هذه الملاحظة"
      );

      return;
    }

    const confirmed =
      window.confirm(
        "هل أنت متأكد من حذف ملاحظة المتابعة؟"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingNoteId(
        note.id
      );

      const response =
        await fetch(
          `/finance/api/follow-up?branch=${encodeURIComponent(
            branch
          )}&noteId=${encodeURIComponent(
            note.id
          )}`,
          {
            method: "DELETE",
            credentials:
              "include",
            cache: "no-store",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const payload =
        await readApiResponse(
          response
        );

      if (
        !response.ok ||
        payload.ok === false
      ) {
        if (
          handleApiSessionError(
            response.status,
            payload.code
          )
        ) {
          return;
        }

        throw new Error(
          payload.message ||
            "تعذر حذف ملاحظة المتابعة"
        );
      }

      await loadRows(
        () => false,
        true
      );

      window.alert(
        payload.message ||
          "تم حذف ملاحظة المتابعة"
      );
    } catch (error) {
      console.error(
        "Delete follow-up note error:",
        error
      );

      window.alert(
        getErrorMessage(
          error,
          "تعذر حذف ملاحظة المتابعة"
        )
      );
    } finally {
      setDeletingNoteId(null);
    }
  }

  function normalizeSaudiPhone(
    value:
      | string
      | null
      | undefined
  ) {
    let phone =
      cleanPhone(value);

    if (
      phone.startsWith(
        "00966"
      )
    ) {
      phone =
        phone.slice(2);
    }

    if (
      phone.startsWith("05")
    ) {
      phone =
        `966${phone.slice(1)}`;
    } else if (
      phone.startsWith("5")
    ) {
      phone =
        `966${phone}`;
    }

    return phone;
  }

  function openWhatsApp(
    row: FollowUpRow
  ) {
    const phone =
      normalizeSaudiPhone(
        row.customer_phone
      );

    if (
      !/^9665\d{8}$/.test(
        phone
      )
    ) {
      window.alert(
        "رقم الجوال المسجل غير صحيح"
      );

      return;
    }

    const safeOrganizationName =
      organizationName.trim();

    if (!safeOrganizationName) {
      window.alert(
        "تعذر جلب اسم المنظمة لهذا الفرع"
      );

      return;
    }

    const dueDate =
      formatGregorianDate(
        row.payment_due_date
      );

    const contractNumber =
      row.contract_number ||
      "-";

    const amount =
      `${formatMoney(
        row.remaining_amount
      )} ريال`;

    const message =
      `السلام عليكم ورحمة الله وبركاته

نود تذكيركم بإستحقاقكم للسداد بتاريخ (${dueDate}) للعقد رقم (${contractNumber}) بمبلغ (${amount}) لدى (${safeOrganizationName})
شاكرين التزامكم .`;

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(
        message
      )}`,
      "_blank",
      "noopener,noreferrer"
    );

    setActionsRow(null);
  }


  function openNotesHistory(
    row: FollowUpRow
  ) {
    setActionsRow(null);
    setNotesRow(row);
  }

  function openContract(
    row: FollowUpRow
  ) {
    setActionsRow(null);

    router.push(
      `/finance/${branch}/contracts/${encodeURIComponent(
        row.contract_id
      )}`
    );
  }

  function openCustomer(
    row: FollowUpRow
  ) {
    if (!row.customer_id) {
      window.alert(
        "لا يوجد ملف عميل مرتبط بهذا العقد"
      );

      return;
    }

    setActionsRow(null);

    router.push(
      `/finance/${branch}/customers/${encodeURIComponent(
        row.customer_id
      )}`
    );
  }

  async function logout() {
    if (logoutLoading) {
      return;
    }

    setLogoutLoading(true);

    try {
      if (
        isSupportSession
      ) {
        try {
          await fetch(
            "/finance/api/support-session",
            {
              method: "DELETE",
              credentials:
                "include",
              cache: "no-store",
              headers: {
                Accept:
                  "application/json",
              },
            }
          );
        } catch (error) {
          console.error(
            "Support session logout failed:",
            error
          );
        }

        setAuthChecked(false);
        setSessionUser(null);
        setSessionType(null);

        router.replace(
          "/admin-support"
        );

        router.refresh();
        return;
      }

      logoutFinanceUser(
        router
      );
    } finally {
      setLogoutLoading(false);
    }
  }

  if (
    !authChecked ||
    loading
  ) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(
          isMobile
        )}
      >
        <div
          style={loadingBox}
        >
          جاري تحميل المتابعة والتواصل...
        </div>

        <GlobalStyles />
      </main>
    );
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
        <header
          style={getHeroStyle(
            isMobile
          )}
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

                {isSupportSession && (
                  <span
                    style={
                      supportBadge
                    }
                  >
                    دخول دعم
                  </span>
                )}

                {!isMobile && (
                  <div
                    style={
                      employeeDividerSmall
                    }
                  />
                )}

                <button
                  type="button"
                  style={{
                    ...logoutInlineButton,
                    opacity:
                      logoutLoading
                        ? 0.65
                        : 1,
                  }}
                  onClick={() =>
                    void logout()
                  }
                  disabled={
                    logoutLoading
                  }
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
                المتابعة والتواصل
              </h1>
            </div>

            <div
              style={getHeroActionBoxStyle(
                screen
              )}
            />
          </div>
        </header>

        <section
          style={statsGrid}
        >
          <StatCard
            label="العقود المتأخرة"
            value={String(
              overdueCount
            )}
          />

          <StatCard
            label="إجمالي المتبقي"
            value={`${formatMoney(
              totalRemaining
            )} ر.س`}
          />

          <StatCard
            label="بلا ملاحظة متابعة"
            value={String(
              withoutNotesCount
            )}
          />

          <StatCard
            label="تمت متابعتها"
            value={String(
              withNotesCount
            )}
          />

          <StatCard
            label="تاريخ النظام"
            value={formatGregorianDate(
              serverDate
            )}
            compact
          />
        </section>

        <section
          style={filterCard}
        >
          <div
            style={filterGrid}
          >
            <Field
              label="البحث"
            >
              <input
                className="follow-up-input"
                style={input}
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="الاسم، الجوال، الهوية، العقد، المستثمر أو نص الملاحظة"
              />
            </Field>

            <Field
              label="المستثمر"
            >
              <select
                className="follow-up-input follow-up-select"
                style={input}
                value={
                  investorFilter
                }
                onChange={(event) =>
                  setInvestorFilter(
                    event.target.value
                  )
                }
              >
                <option value="">
                  جميع المستثمرين
                </option>

                {investors.map(
                  (investor) => (
                    <option
                      key={investor}
                      value={investor}
                    >
                      {investor}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field
              label="حالة المتابعة"
            >
              <select
                className="follow-up-input follow-up-select"
                style={input}
                value={noteFilter}
                onChange={(event) =>
                  setNoteFilter(
                    event.target
                      .value as NoteFilter
                  )
                }
              >
                <option value="all">
                  الجميع
                </option>

                <option value="with-note">
                  يوجد ملاحظات
                </option>

                <option value="without-note">
                  بدون ملاحظات
                </option>
              </select>
            </Field>

            <Field
              label="نوع الفرز"
            >
              <select
                className="follow-up-input follow-up-select"
                style={input}
                value={sortType}
                onChange={(event) =>
                  setSortType(
                    event.target
                      .value as SortType
                  )
                }
              >
                <option value="all">
                  الجميع
                </option>

                <option value="paid">
                  تم السداد
                </option>

                <option value="overdue">
                  متأخر
                </option>

                <option value="not-due">
                  لم يحل موعده
                </option>
              </select>
            </Field>

            {sortType === "overdue" && (
              <Field
                label="مدة التأخير"
              >
                <select
                  className="follow-up-input follow-up-select"
                  style={input}
                  value={delayFilter}
                  onChange={(event) =>
                    setDelayFilter(
                      event.target
                        .value as DelayFilter
                    )
                  }
                >
                  <option value="all">
                    جميع المتأخرين
                  </option>

                  <option value="1-7">
                    من يوم إلى 7 أيام
                  </option>

                  <option value="8-15">
                    من 8 إلى 15 يومًا
                  </option>

                  <option value="16-30">
                    من 16 إلى 30 يومًا
                  </option>

                  <option value="31-60">
                    من 31 إلى 60 يومًا
                  </option>

                  <option value="61-plus">
                    أكثر من 60 يومًا
                  </option>
                </select>
              </Field>
            )}

            <button
              type="button"
              style={refreshButton}
              disabled={
                refreshing
              }
              onClick={() =>
                void loadRows(
                  () => false,
                  true
                )
              }
            >
              {refreshing
                ? "جاري التحديث..."
                : "تحديث البيانات"}
            </button>
          </div>
        </section>

        <section
          style={tableCard}
        >
          {filteredRows.length ===
          0 ? (
            <div
              style={emptyBox}
            >
              لا توجد عقود مطابقة للفلاتر الحالية.
            </div>
          ) : isMobile ? (
            <div
              style={mobileCards}
            >
              {paginatedRows.map(
                (row) => (
                  <article
                    key={
                      row.contract_id
                    }
                    style={
                      mobileContractCard
                    }
                  >
                    <div
                      style={
                        mobileCardHeader
                      }
                    >
                      <strong
                        style={
                          customerName
                        }
                      >
                        {row.customer_name ||
                          "-"}
                      </strong>

                      <span
                        style={getStatusBadgeStyle(
                          row.follow_up_status
                        )}
                      >
                        {getStatusLabel(
                          row.follow_up_status,
                          row.days_late
                        )}
                      </span>
                    </div>

                    <div
                      style={
                        mobileInfoGrid
                      }
                    >
                      <InfoItem
                        label="رقم العقد"
                        value={
                          row.contract_number ||
                          "-"
                        }
                      />

                      <InfoItem
                        label="المتبقي"
                        value={`${formatMoney(
                          row.remaining_amount
                        )} ر.س`}
                      />

                      <InfoItem
                        label="الاستحقاق الميلادي"
                        value={formatGregorianDate(
                          row.payment_due_date
                        )}
                      />

                      <InfoItem
                        label="الجوال"
                        value={
                          row.customer_phone ||
                          "-"
                        }
                      />

                      <InfoItem
                        label="المستثمر"
                        value={
                          row.investor_name ||
                          "-"
                        }
                      />

                      <InfoItem
                        label="عدد الملاحظات"
                        value={String(
                          row.notes_count
                        )}
                      />
                    </div>

                    <LatestNoteBox
                      row={row}
                    />

                    <button
                      type="button"
                      style={
                        actionsButton
                      }
                      onClick={() =>
                        setActionsRow(
                          row
                        )
                      }
                    >
                      إجراءات التواصل
                    </button>
                  </article>
                )
              )}
            </div>
          ) : (
            <div
              style={
                tableWrapper
              }
            >
              <table
                style={table}
              >
                <thead>
                  <tr>
                    <th style={th}>
                      العقد
                    </th>
                    <th style={th}>
                      العميل
                    </th>
                    <th style={th}>
                      الجوال
                    </th>
                    <th style={th}>
                      المستثمر
                    </th>
                    <th style={th}>
                      المتبقي
                    </th>
                    <th style={th}>
                      الاستحقاق الميلادي
                    </th>
                    <th style={th}>
                      التأخير
                    </th>
                    <th style={th}>
                      آخر ملاحظة
                    </th>
                    <th style={th}>
                      الإجراءات
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedRows.map(
                    (row) => (
                      <tr
                        key={
                          row.contract_id
                        }
                      >
                        <td style={td}>
                          <strong>
                            {row.contract_number ||
                              "-"}
                          </strong>
                        </td>

                        <td style={td}>
                          <strong>
                            {row.customer_name ||
                              "-"}
                          </strong>

                          <div
                            style={
                              smallMutedText
                            }
                          >
                            {row.customer_national_id ||
                              "-"}
                          </div>
                        </td>

                        <td style={td}>
                          {row.customer_phone ||
                            "-"}
                        </td>

                        <td style={td}>
                          {row.investor_name ||
                            "-"}
                        </td>

                        <td style={td}>
                          <strong
                            style={
                              amountText
                            }
                          >
                            {formatMoney(
                              row.remaining_amount
                            )} ر.س
                          </strong>
                        </td>

                        <td style={td}>
                          {formatGregorianDate(
                            row.payment_due_date
                          )}
                        </td>

                        <td style={td}>
                          <span
                            style={getStatusBadgeStyle(
                              row.follow_up_status
                            )}
                          >
                            {getStatusLabel(
                              row.follow_up_status,
                              row.days_late
                            )}
                          </span>
                        </td>

                        <td
                          style={{
                            ...td,
                            minWidth: 270,
                          }}
                        >
                          <LatestNoteBox
                            row={row}
                          />
                        </td>

                        <td style={td}>
                          <button
                            type="button"
                            style={
                              actionsButton
                            }
                            onClick={() =>
                              setActionsRow(
                                row
                              )
                            }
                          >
                            إجراءات التواصل
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {filteredRows.length >
            ITEMS_PER_PAGE && (
            <div
              style={
                paginationWrapper
              }
            >
              <button
                type="button"
                style={
                  paginationButton
                }
                disabled={
                  currentPage <= 1
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.max(
                        1,
                        page - 1
                      )
                  )
                }
              >
                السابق
              </button>

              <span
                style={
                  paginationText
                }
              >
                صفحة {currentPage} من {totalPages}
              </span>

              <button
                type="button"
                style={
                  paginationButton
                }
                disabled={
                  currentPage >=
                  totalPages
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.min(
                        totalPages,
                        page + 1
                      )
                  )
                }
              >
                التالي
              </button>
            </div>
          )}
        </section>

        <div
          style={backWrapper}
        >
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

      {actionsRow && (
        <ModalOverlay
          onClose={() =>
            setActionsRow(null)
          }
        >
          <div
            style={modalCard}
          >
            <ModalHeader
              title="إجراءات التواصل"
              subtitle={`${actionsRow.customer_name || "-"} - العقد ${actionsRow.contract_number || "-"}`}
              onClose={() =>
                setActionsRow(null)
              }
            />

            <div
              style={
                actionMenuList
              }
            >
              <ActionMenuButton
                label="واتساب"
                onClick={() =>
                  openWhatsApp(
                    actionsRow
                  )
                }
              />

              <ActionMenuButton
                label="إضافة ملاحظة متابعة"
                onClick={() =>
                  openCreateNote(
                    actionsRow
                  )
                }
              />

              <ActionMenuButton
                label={`عرض سجل الملاحظات (${actionsRow.notes_count})`}
                onClick={() =>
                  openNotesHistory(
                    actionsRow
                  )
                }
              />

              <ActionMenuButton
                label="فتح تفاصيل العقد"
                onClick={() =>
                  openContract(
                    actionsRow
                  )
                }
              />

              <ActionMenuButton
                label="فتح ملف العميل"
                onClick={() =>
                  openCustomer(
                    actionsRow
                  )
                }
              />
            </div>
          </div>
        </ModalOverlay>
      )}

      {notesRow && (
        <ModalOverlay
          onClose={() =>
            !noteModalOpen &&
            setNotesRow(null)
          }
        >
          <div
            style={
              notesModalCard
            }
          >
            <ModalHeader
              title="سجل الملاحظات"
              subtitle={`${notesRow.customer_name || "-"} - العقد ${notesRow.contract_number || "-"}`}
              onClose={() =>
                setNotesRow(null)
              }
            />

            <button
              type="button"
              style={
                addNoteHistoryButton
              }
              onClick={() =>
                openCreateNote(
                  notesRow
                )
              }
            >
              إضافة ملاحظة متابعة
            </button>

            {notesRow.notes.length ===
            0 ? (
              <div
                style={emptyBox}
              >
                لا توجد ملاحظات متابعة لهذا العقد.
              </div>
            ) : (
              <div
                style={
                  notesVerticalList
                }
              >
                {notesRow.notes.map(
                  (note) => (
                    <article
                      key={note.id}
                      style={
                        noteHistoryCard
                      }
                    >
                      <p
                        style={
                          noteHistoryText
                        }
                      >
                        {note.note_text}
                      </p>

                      <div
                        style={
                          noteHistoryMeta
                        }
                      >
                        <span>
                          بواسطة:{" "}
                          {note.created_by_name ||
                            "-"}
                        </span>

                        <span>
                          الإنشاء:{" "}
                          {formatGregorianDateTime(
                            note.created_at
                          )}
                        </span>

                        {note.updated_at && (
                          <span>
                            التعديل:{" "}
                            {formatGregorianDateTime(
                              note.updated_at
                            )}
                          </span>
                        )}
                      </div>

                      {canManageNote(
                        note
                      ) && (
                        <div
                          style={
                            noteHistoryActions
                          }
                        >
                          <button
                            type="button"
                            style={
                              editNoteButton
                            }
                            disabled={
                              savingNote ||
                              Boolean(
                                deletingNoteId
                              )
                            }
                            onClick={() =>
                              openEditNote(
                                notesRow,
                                note
                              )
                            }
                          >
                            تعديل
                          </button>

                          <button
                            type="button"
                            style={
                              deleteNoteButton
                            }
                            disabled={
                              savingNote ||
                              Boolean(
                                deletingNoteId
                              )
                            }
                            onClick={() =>
                              void deleteNote(
                                note
                              )
                            }
                          >
                            {deletingNoteId ===
                            note.id
                              ? "جاري الحذف..."
                              : "حذف"}
                          </button>
                        </div>
                      )}
                    </article>
                  )
                )}
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {noteModalOpen &&
        notesRow && (
          <ModalOverlay
            onClose={() =>
              closeNoteModal()
            }
          >
            <div
              style={modalCard}
            >
              <ModalHeader
                title={
                  noteModalMode ===
                  "edit"
                    ? "تعديل ملاحظة المتابعة"
                    : "إضافة ملاحظة متابعة"
                }
                subtitle={`${notesRow.customer_name || "-"} - العقد ${notesRow.contract_number || "-"}`}
                onClose={() =>
                  closeNoteModal()
                }
              />

              <textarea
                className="follow-up-input"
                style={
                  modalTextarea
                }
                value={noteText}
                onChange={(event) =>
                  setNoteText(
                    event.target.value.slice(
                      0,
                      2000
                    )
                  )
                }
                rows={7}
                placeholder="اكتب تفاصيل التواصل أو نتيجة المتابعة..."
                autoFocus
              />

              <div
                style={
                  noteCounter
                }
              >
                {noteText.length} / 2000
              </div>

              <div
                style={
                  modalActions
                }
              >
                <button
                  type="button"
                  style={
                    saveModalButton
                  }
                  disabled={
                    savingNote ||
                    Boolean(
                      deletingNoteId
                    )
                  }
                  onClick={() =>
                    void saveNote()
                  }
                >
                  {savingNote
                    ? "جاري الحفظ..."
                    : "حفظ الملاحظة"}
                </button>

                <button
                  type="button"
                  style={
                    cancelModalButton
                  }
                  disabled={
                    savingNote ||
                    Boolean(
                      deletingNoteId
                    )
                  }
                  onClick={() =>
                    closeNoteModal()
                  }
                >
                  إلغاء
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}

      <GlobalStyles />
    </main>
  );
}


function getStatusLabel(
  status: FollowUpRow["follow_up_status"],
  daysLate: number
) {
  if (status === "paid") {
    return "تم السداد";
  }

  if (status === "overdue") {
    return `متأخر ${daysLate} يوم`;
  }

  return "لم يحل موعده";
}

function getStatusBadgeStyle(
  status: FollowUpRow["follow_up_status"]
): CSSProperties {
  if (status === "paid") {
    return {
      ...lateBadge,
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (status === "not_due") {
    return {
      ...lateBadge,
      background: "#e0f2fe",
      color: "#075985",
      border: "1px solid #bae6fd",
    };
  }

  return lateBadge;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={fieldBox}>
      <label style={labelStyle}>
        {label}
      </label>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div style={statCard}>
      <span style={statLabel}>
        {label}
      </span>

      <strong
        style={
          compact
            ? statDateValue
            : statValue
        }
      >
        {value}
      </strong>
    </div>
  );
}

function LatestNoteBox({
  row,
}: {
  row: FollowUpRow;
}) {
  if (!row.latest_note) {
    return (
      <div
        style={
          noLatestNote
        }
      >
        لا توجد ملاحظة متابعة
      </div>
    );
  }

  return (
    <div
      style={
        latestNoteBox
      }
    >
      <div
        style={
          latestNoteText
        }
      >
        {row.latest_note.note_text}
      </div>

      <div
        style={
          latestNoteMeta
        }
      >
        {row.latest_note.created_by_name ||
          "-"}{" "}
        -{" "}
        {formatGregorianDateTime(
          row.latest_note.updated_at ||
            row.latest_note.created_at
        )}
      </div>

      <div
        style={
          latestNoteCount
        }
      >
        إجمالي الملاحظات:{" "}
        {row.notes_count}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={infoItem}>
      <span style={infoLabel}>
        {label}
      </span>

      <strong
        style={infoValue}
      >
        {value}
      </strong>
    </div>
  );
}

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={modalOverlay}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <div
      style={modalHeader}
    >
      <div>
        <h2
          style={modalTitle}
        >
          {title}
        </h2>

        <div
          style={modalSubtitle}
        >
          {subtitle}
        </div>
      </div>

      <button
        type="button"
        style={closeModalButton}
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

function ActionMenuButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      style={actionMenuButton}
      onClick={onClick}
    >
      {label}
      <span>‹</span>
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

function GlobalStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        overflow-x: hidden;
      }

      button,
      input,
      select,
      textarea {
        font-family: var(--font-almarai), sans-serif;
      }

      .follow-up-input {
        transition:
          border-color 0.18s ease,
          box-shadow 0.18s ease,
          background 0.18s ease;
      }

      .follow-up-input:focus {
        outline: none !important;
        border-color: #3b82f6 !important;
        box-shadow:
          0 0 0 4px rgba(59,130,246,0.11) !important;
        background: #ffffff !important;
      }

      .follow-up-select {
        appearance: none;
        -webkit-appearance: none;
        background-image:
          linear-gradient(45deg, transparent 50%, #64748b 50%),
          linear-gradient(135deg, #64748b 50%, transparent 50%);
        background-position:
          16px calc(50% - 2px),
          11px calc(50% - 2px);
        background-size: 5px 5px, 5px 5px;
        background-repeat: no-repeat;
        padding-left: 32px !important;
      }

      button:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }
    `}</style>
  );
}

function getPageStyle(
  isMobile: boolean
): CSSProperties {
  return {
    minHeight: "100vh",
    backgroundColor:
      "#f6f9ff",
    backgroundImage: `
      radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%),
      radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%),
      radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%),
      linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)),
      url('/backgrounds/v13-finance-bg-1.png')
    `,
    backgroundSize:
      "cover",
    backgroundPosition:
      "center",
    backgroundAttachment:
      isMobile
        ? "scroll"
        : "fixed",
    padding:
      isMobile
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
    maxWidth:
      isCompact
        ? 980
        : 1320,
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
  if (
    screen === "mobile"
  ) {
    return {
      position: "relative",
      zIndex: 3,
      display: "flex",
      flexDirection:
        "column",
      alignItems:
        "stretch",
      justifyContent:
        "center",
      gap: 16,
      direction: "rtl",
    };
  }

  if (
    screen === "tablet"
  ) {
    return {
      position: "relative",
      zIndex: 3,
      display: "grid",
      gridTemplateColumns:
        "1fr",
      justifyItems:
        "center",
      alignItems:
        "center",
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
    alignItems:
      "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(
  screen: ScreenType
): CSSProperties {
  if (
    screen === "mobile" ||
    screen === "tablet"
  ) {
    return {
      width: "100%",
      maxWidth: 520,
      display: "grid",
      gap: 12,
      direction: "rtl",
      justifyItems:
        "center",
      order: 2,
    };
  }

  return {
    width: "100%",
    maxWidth: 315,
    display: "grid",
    gap: 24,
    direction: "ltr",
    justifySelf:
      "start",
  };
}

function getEmployeeTopRowStyle(
  screen: ScreenType
): CSSProperties {
  return {
    minHeight: 42,
    display: "flex",
    alignItems:
      "center",
    justifyContent:
      screen ===
      "desktop"
        ? "flex-start"
        : "center",
    flexWrap: "wrap",
    gap: 12,
    direction:
      screen ===
      "desktop"
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
      isMobile
        ? 15
        : 17,
    fontWeight: 900,
    whiteSpace:
      "nowrap",
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
    boxShadow:
      "0 8px 18px rgba(22,163,74,0.20)",
    display:
      "inline-flex",
    alignItems:
      "center",
    justifyContent:
      "center",
    gap: 9,
    whiteSpace:
      "nowrap",
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
    alignItems:
      "center",
    justifyContent:
      "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents:
      "none",
    order:
      screen ===
      "desktop"
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
        ? 24
        : screen ===
            "tablet"
          ? 28
          : 30,
    lineHeight: 1.4,
    fontWeight: 900,
    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",
    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
  return {
    display:
      screen ===
      "desktop"
        ? "flex"
        : "none",
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
  justifyContent:
    "center",
  color:
    "rgba(255,255,255,0.96)",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background:
    "rgba(255,255,255,0.30)",
};

const supportBadge: CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  background:
    "rgba(22,163,74,0.22)",
  border:
    "1px solid rgba(187,247,208,0.42)",
  color: "#dcfce7",
  fontSize: 11,
  fontWeight: 900,
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
  padding: 0,
  whiteSpace:
    "nowrap",
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
  pointerEvents:
    "none",
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
  pointerEvents:
    "none",
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
  pointerEvents:
    "none",
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

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(175px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: CSSProperties = {
  background: "#ffffff",
  border:
    "1px solid #d9e3f5",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 7,
  boxShadow:
    "0 7px 18px rgba(15,23,42,0.04)",
};

const statLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const statValue: CSSProperties = {
  color: "#0d47a1",
  fontSize: 22,
  fontWeight: 900,
};

const statDateValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
};

const filterCard: CSSProperties = {
  background: "#ffffff",
  border:
    "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 16,
  marginBottom: 14,
  boxShadow:
    "0 7px 18px rgba(15,23,42,0.04)",
};

const filterGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: 12,
  alignItems: "end",
};

const fieldBox: CSSProperties = {
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 13,
};

const input: CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "9px 12px",
  borderRadius: 11,
  border:
    "1px solid #dbe4f0",
  fontSize: 13,
  background: "rgba(255,255,255,0.96)",
  color: "#0f172a",
  outline: "none",
  boxShadow:
    "0 2px 8px rgba(15,23,42,0.025)",
};

const refreshButton: CSSProperties = {
  minHeight: 45,
  border: "none",
  borderRadius: 12,
  padding: "0 16px",
  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const tableCard: CSSProperties = {
  background: "#ffffff",
  border:
    "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 14,
  boxShadow:
    "0 7px 18px rgba(15,23,42,0.04)",
};

const tableWrapper: CSSProperties = {
  width: "100%",
  overflowX: "auto",
  borderRadius: 14,
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse:
    "separate",
  borderSpacing: 0,
  minWidth: 1260,
};

const th: CSSProperties = {
  background: "#eff6ff",
  color: "#1e3a8a",
  padding: "13px 11px",
  textAlign: "right",
  fontSize: 13,
  fontWeight: 900,
  borderBottom:
    "1px solid #bfdbfe",
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "13px 11px",
  borderBottom:
    "1px solid #eef2f7",
  verticalAlign: "top",
  color: "#0f172a",
  fontSize: 13,
};

const smallMutedText: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  marginTop: 4,
};

const amountText: CSSProperties = {
  color: "#b45309",
};

const lateBadge: CSSProperties = {
  display:
    "inline-flex",
  alignItems:
    "center",
  justifyContent:
    "center",
  background: "#fee2e2",
  color: "#991b1b",
  border:
    "1px solid #fecaca",
  borderRadius: 999,
  padding: "6px 9px",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace:
    "nowrap",
};

const mobileCards: CSSProperties = {
  display: "grid",
  gap: 12,
};

const mobileContractCard: CSSProperties = {
  border:
    "1px solid #d9e3f5",
  borderRadius: 16,
  padding: 14,
  background: "#fbfdff",
};

const mobileCardHeader: CSSProperties = {
  display: "flex",
  alignItems:
    "center",
  justifyContent:
    "space-between",
  gap: 10,
  marginBottom: 12,
};

const customerName: CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
};

const mobileInfoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",
  gap: 9,
};

const infoItem: CSSProperties = {
  border:
    "1px solid #e2e8f0",
  borderRadius: 11,
  background: "#ffffff",
  padding: 10,
  display: "grid",
  gap: 4,
};

const infoLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 800,
};

const infoValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 12,
  overflowWrap:
    "anywhere",
};

const latestNoteBox: CSSProperties = {
  background: "#eff6ff",
  border:
    "1px solid #bfdbfe",
  borderRadius: 12,
  padding: 10,
};

const noLatestNote: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
};

const latestNoteText: CSSProperties = {
  color: "#334155",
  lineHeight: 1.7,
  whiteSpace:
    "pre-wrap",
  wordBreak:
    "break-word",
  fontSize: 12,
};

const latestNoteMeta: CSSProperties = {
  color: "#64748b",
  marginTop: 6,
  fontSize: 10,
};

const latestNoteCount: CSSProperties = {
  color: "#1d4ed8",
  marginTop: 6,
  fontSize: 10,
  fontWeight: 900,
};

const actionsButton: CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 10,
  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
  padding: "10px 12px",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const paginationWrapper: CSSProperties = {
  display: "flex",
  alignItems:
    "center",
  justifyContent:
    "center",
  gap: 12,
  marginTop: 16,
  flexWrap: "wrap",
};

const paginationButton: CSSProperties = {
  border:
    "1px solid #bfdbfe",
  borderRadius: 10,
  background: "#eff6ff",
  color: "#1d4ed8",
  padding: "9px 14px",
  fontWeight: 900,
  cursor: "pointer",
};

const paginationText: CSSProperties = {
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border:
    "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 24,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 800,
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent:
    "center",
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
};

const loadingBox: CSSProperties = {
  maxWidth: 850,
  margin: "80px auto",
  background: "#ffffff",
  border:
    "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 24,
  textAlign: "center",
  color: "#0d47a1",
  fontWeight: 900,
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background:
    "rgba(15,23,42,0.62)",
  backdropFilter:
    "blur(5px)",
  display: "flex",
  alignItems:
    "center",
  justifyContent:
    "center",
  padding: 10,
};

const modalCard: CSSProperties = {
  width:
    "min(620px,calc(100vw - 24px))",
  maxHeight:
    "calc(100vh - 30px)",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 20,
  border:
    "1px solid #d9e3f5",
  boxShadow:
    "0 26px 80px rgba(15,23,42,0.28)",
  padding: 20,
};

const notesModalCard: CSSProperties = {
  ...modalCard,
  width:
    "min(760px,calc(100vw - 24px))",
};

const modalHeader: CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems:
    "flex-start",
  gap: 14,
  marginBottom: 16,
};

const modalTitle: CSSProperties = {
  margin: 0,
  color: "#0d47a1",
  fontSize: 20,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const modalSubtitle: CSSProperties = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 12,
};

const closeModalButton: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border:
    "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  fontSize: 24,
  lineHeight: 1,
  cursor: "pointer",
};

const actionMenuList: CSSProperties = {
  display: "grid",
  gap: 8,
};

const actionMenuButton: CSSProperties = {
  width: "100%",
  minHeight: 46,
  border:
    "1px solid #dbeafe",
  borderRadius: 12,
  background: "#ffffff",
  color: "#0f172a",
  padding: "10px 13px",
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  fontWeight: 900,
  cursor: "pointer",
};

const addNoteHistoryButton: CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 12,
  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
  padding: 12,
  fontWeight: 900,
  cursor: "pointer",
  marginBottom: 14,
};

const notesVerticalList: CSSProperties = {
  display: "grid",
  gap: 12,
};

const noteHistoryCard: CSSProperties = {
  border:
    "1px solid #dbeafe",
  borderRadius: 14,
  background: "#f8fbff",
  padding: 14,
};

const noteHistoryText: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  lineHeight: 1.8,
  whiteSpace:
    "pre-wrap",
  wordBreak:
    "break-word",
};

const noteHistoryMeta: CSSProperties = {
  display: "grid",
  gap: 4,
  marginTop: 10,
  color: "#64748b",
  fontSize: 11,
};

const noteHistoryActions: CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 12,
};

const editNoteButton: CSSProperties = {
  border:
    "1px solid #bfdbfe",
  borderRadius: 9,
  background: "#eff6ff",
  color: "#1d4ed8",
  padding: "8px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const deleteNoteButton: CSSProperties = {
  border:
    "1px solid #fecaca",
  borderRadius: 9,
  background: "#fee2e2",
  color: "#991b1b",
  padding: "8px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const modalTextarea: CSSProperties = {
  width: "100%",
  minHeight: 170,
  padding: 13,
  borderRadius: 13,
  border:
    "1px solid #d9e3f5",
  fontSize: 14,
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  resize: "vertical",
  lineHeight: 1.8,
};

const noteCounter: CSSProperties = {
  color: "#94a3b8",
  fontSize: 11,
  textAlign: "left",
  marginTop: 6,
};

const modalActions: CSSProperties = {
  display: "flex",
  gap: 9,
  flexWrap: "wrap",
  marginTop: 16,
};

const saveModalButton: CSSProperties = {
  flex: "1 1 180px",
  border: "none",
  borderRadius: 11,
  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
  padding: "12px 14px",
  fontWeight: 900,
  cursor: "pointer",
};

const cancelModalButton: CSSProperties = {
  flex: "1 1 100px",
  border:
    "1px solid #cbd5e1",
  borderRadius: 11,
  background: "#f8fafc",
  color: "#475569",
  padding: "12px 14p
