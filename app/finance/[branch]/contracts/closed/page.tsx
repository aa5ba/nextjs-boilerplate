"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
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

const ITEMS_PER_PAGE = 25;

type ScreenType = "mobile" | "tablet" | "desktop";

type CustomerRelation = {
  full_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
};

type ClosedContract = {
  id: string;
  customer_id?: string | null;
  contract_number?: string | number | null;
  finance_type?: string | null;
  paid_amount?: number | string | null;
  contract_status?: string | null;
  updated_at?: string | null;
  finance_customers?:
    | CustomerRelation
    | CustomerRelation[]
    | null;
};

export default function ClosedContractsPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(
    params.branch ?? ""
  )
    .trim()
    .toLowerCase();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [authChecked, setAuthChecked] =
    useState(false);

  const [sessionUser, setSessionUser] =
    useState<FinanceSessionUser | null>(
      null
    );

  const [
    resolvedBranchId,
    setResolvedBranchId,
  ] = useState<string | null>(null);

  const [contracts, setContracts] =
    useState<ClosedContract[]>([]);

  const [totalCount, setTotalCount] =
    useState(0);

  const [currentPage, setCurrentPage] =
    useState(1);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const isMobile =
    screen === "mobile";

  const isTablet =
    screen === "tablet";

  const isCompact =
    isMobile || isTablet;

  const totalPages = Math.max(
    1,
    Math.ceil(
      totalCount / ITEMS_PER_PAGE
    )
  );

  const pageStart = useMemo(() => {
    if (totalCount === 0) {
      return 0;
    }

    return (
      (currentPage - 1) *
        ITEMS_PER_PAGE +
      1
    );
  }, [
    currentPage,
    totalCount,
  ]);

  const pageEnd = useMemo(() => {
    return Math.min(
      currentPage *
        ITEMS_PER_PAGE,
      totalCount
    );
  }, [
    currentPage,
    totalCount,
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

  useEffect(() => {
    if (!branch) {
      clearFinanceSession();
      router.replace("/login");
      return;
    }

    const validation =
      validateFinanceSession(branch);

    if (
      !validation.valid ||
      !validation.user
    ) {
      redirectToFinanceLogin(
        router,
        {
          branchSlug: branch,
        }
      );

      return;
    }

    const authenticatedUser =
      validation.user;

    const currentBranchId =
      String(
        authenticatedUser.branch_id ||
          ""
      ).trim();

    if (!currentBranchId) {
      clearFinanceSession();

      redirectToFinanceLogin(
        router,
        {
          branchSlug: branch,
        }
      );

      return;
    }

    setSessionUser(
      authenticatedUser
    );

    setResolvedBranchId(
      currentBranchId
    );

    setEmployeeName(
      getFinanceEmployeeName(
        authenticatedUser
      )
    );

    setCurrentPage(1);
    setContracts([]);
    setTotalCount(0);
    setPageError("");
    setLoading(true);
    setAuthChecked(true);
  }, [
    branch,
    router,
  ]);

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
          redirectToFinanceLogin(
            router,
            {
              branchSlug: branch,
            }
          );
        },

        onInvalidated: () => {
          clearFinanceSession();
          router.replace("/login");
        },

        onSessionUpdated: (
          updatedUser
        ) => {
          const updatedBranchId =
            String(
              updatedUser.branch_id ||
                ""
            ).trim();

          if (!updatedBranchId) {
            clearFinanceSession();
            router.replace("/login");
            return;
          }

          setSessionUser(
            updatedUser
          );

          setResolvedBranchId(
            updatedBranchId
          );

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

  useEffect(() => {
    let cancelled = false;

    async function fetchContracts() {
      if (
        !authChecked ||
        !resolvedBranchId
      ) {
        return;
      }

      await loadContracts(
        resolvedBranchId,
        currentPage,
        () => cancelled
      );
    }

    void fetchContracts();

    return () => {
      cancelled = true;
    };
  }, [
    authChecked,
    resolvedBranchId,
    currentPage,
  ]);

  async function loadContracts(
    currentBranchId: string,
    pageNumber: number,
    isCancelled: () => boolean =
      () => false
  ) {
    setLoading(true);
    setPageError("");

    try {
      const from =
        (pageNumber - 1) *
        ITEMS_PER_PAGE;

      const to =
        from +
        ITEMS_PER_PAGE -
        1;

      const {
        data,
        error,
        count,
      } = await supabase
        .from("finance_contracts")
        .select(
          `
            id,
            customer_id,
            contract_number,
            finance_type,
            paid_amount,
            contract_status,
            updated_at,
            finance_customers:finance_customers!finance_contracts_customer_id_fkey (
              full_name,
              national_id,
              phone
            )
          `,
          {
            count: "exact",
          }
        )
        .eq(
          "branch_id",
          currentBranchId
        )
        .or(
          "is_archived.is.null,is_archived.eq.false"
        )
        .in(
          "contract_status",
          [
            "تم السداد",
            "ملغي",
          ]
        )
        .order("updated_at", {
          ascending: false,
        })
        .range(from, to);

      if (isCancelled()) {
        return;
      }

      if (error) {
        console.error(
          "Closed contracts loading error:",
          error
        );

        setContracts([]);
        setTotalCount(0);

        setPageError(
          error.message ||
            "تعذر تحميل العقود المنتهية"
        );

        return;
      }

      const safeCount =
        count ?? 0;

      const calculatedTotalPages =
        Math.max(
          1,
          Math.ceil(
            safeCount /
              ITEMS_PER_PAGE
          )
        );

      if (
        pageNumber >
        calculatedTotalPages
      ) {
        setCurrentPage(
          calculatedTotalPages
        );

        return;
      }

      setContracts(
        (data || []) as ClosedContract[]
      );

      setTotalCount(
        safeCount
      );
    } catch (error) {
      if (isCancelled()) {
        return;
      }

      console.error(
        "Unexpected closed contracts error:",
        error
      );

      setContracts([]);
      setTotalCount(0);

      setPageError(
        "حدث خطأ غير متوقع أثناء تحميل العقود المنتهية"
      );
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  function getCustomer(
    contract: ClosedContract
  ): CustomerRelation | null {
    if (
      Array.isArray(
        contract.finance_customers
      )
    ) {
      return (
        contract.finance_customers[0] ||
        null
      );
    }

    return (
      contract.finance_customers ||
      null
    );
  }

  function getCustomerName(
    contract: ClosedContract
  ) {
    return (
      getCustomer(contract)
        ?.full_name ||
      "-"
    );
  }

  function formatMoney(
    value: unknown
  ) {
    const number = Number(
      value ?? 0
    );

    if (
      !Number.isFinite(number)
    ) {
      return "0";
    }

    return number.toLocaleString(
      "ar-SA"
    );
  }

  function logout() {
    logoutFinanceUser(router);
  }

  if (!authChecked) {
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
                العقود المنتهية
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
          <div
            style={listHeader}
          >
            <h2
              style={sectionTitle}
            >
              قائمة العقود المنتهية
            </h2>

            {!loading &&
              !pageError &&
              totalCount > 0 && (
                <span
                  style={pageInfo}
                >
                  صفحة{" "}
                  {currentPage} من{" "}
                  {totalPages} - عرض{" "}
                  {pageStart} إلى{" "}
                  {pageEnd} من{" "}
                  {totalCount}
                </span>
              )}
          </div>

          {loading ? (
            <div
              style={loadingBox}
            >
              جاري تحميل العقود
              المنتهية...
            </div>
          ) : pageError ? (
            <div
              style={errorBox}
            >
              <div>
                {pageError}
              </div>

              <button
                type="button"
                style={retryButton}
                onClick={() => {
                  if (
                    resolvedBranchId
                  ) {
                    void loadContracts(
                      resolvedBranchId,
                      currentPage
                    );
                  }
                }}
              >
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <div
              style={tableScroll}
            >
              <div
                style={tableHeader}
              >
                <span>
                  رقم العقد
                </span>

                <span>
                  العميل
                </span>

                <span>
                  نوع التمويل
                </span>

                <span>
                  المسدد
                </span>

                <span>
                  الحالة
                </span>
              </div>

              {contracts.length ===
              0 ? (
                <div
                  style={emptyBox}
                >
                  لا توجد عقود منتهية
                </div>
              ) : (
                contracts.map(
                  (contract) => (
                    <div
                      key={
                        contract.id
                      }
                      style={tableRow}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        router.push(
                          `/finance/${branch}/contracts/${contract.id}`
                        )
                      }
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                            "Enter" ||
                          event.key ===
                            " "
                        ) {
                          event.preventDefault();

                          router.push(
                            `/finance/${branch}/contracts/${contract.id}`
                          );
                        }
                      }}
                    >
                      <span>
                        {contract.contract_number ||
                          "-"}
                      </span>

                      <button
                        type="button"
                        style={
                          customerLink
                        }
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          if (
                            !contract.customer_id
                          ) {
                            return;
                          }

                          router.push(
                            `/finance/${branch}/customers/${contract.customer_id}`
                          );
                        }}
                      >
                        {getCustomerName(
                          contract
                        )}
                      </button>

                      <span>
                        {contract.finance_type ||
                          "-"}
                      </span>

                      <span>
                        {formatMoney(
                          contract.paid_amount
                        )}{" "}
                        ر.س
                      </span>

                      <span>
                        <span
                          style={{
                            ...statusBadge,

                            ...(contract.contract_status ===
                            "ملغي"
                              ? canceledBadge
                              : paidBadge),
                          }}
                        >
                          {contract.contract_status ||
                            "-"}
                        </span>
                      </span>
                    </div>
                  )
                )
              )}

              {totalCount >
                ITEMS_PER_PAGE && (
                <div
                  style={
                    paginationBox
                  }
                >
                  <button
                    type="button"
                    style={{
                      ...paginationButton,

                      opacity:
                        currentPage ===
                        1
                          ? 0.5
                          : 1,

                      cursor:
                        currentPage ===
                        1
                          ? "not-allowed"
                          : "pointer",
                    }}
                    disabled={
                      currentPage ===
                      1
                    }
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.max(
                            page -
                              1,
                            1
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
                    صفحة{" "}
                    {currentPage} من{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    style={{
                      ...paginationButton,

                      opacity:
                        currentPage ===
                        totalPages
                          ? 0.5
                          : 1,

                      cursor:
                        currentPage ===
                        totalPages
                          ? "not-allowed"
                          : "pointer",
                    }}
                    disabled={
                      currentPage ===
                      totalPages
                    }
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.min(
                            page +
                              1,
                            totalPages
                          )
                      )
                    }
                  >
                    التالي
                  </button>
                </div>
              )}
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
    </main>
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
    backgroundPosition:
      "center",
    backgroundAttachment:
      isMobile
        ? "scroll"
        : "fixed",
    padding: isMobile
      ? 10
      : 18,
    fontFamily:
      "var(--font-almarai), sans-serif",
    overflowX: "hidden",
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
      minHeight: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent:
        "center",
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
      justifyContent:
        "center",
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
      justifyContent:
        "center",
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
    justifyContent:
      "center",
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
    justifyContent:
      "center",
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
    justifyContent:
      "center",
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
  background:
    "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent:
    "center",
  color:
    "rgba(255,255,255,0.96)",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties =
  {
    width: 1,
    height: 34,
    background:
      "rgba(255,255,255,0.30)",
    flex: "0 0 auto",
  };

const logoutInlineButton: CSSProperties =
  {
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

const heroCircleThree: CSSProperties =
  {
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
    "1px solid #dbe7f5",
  borderRadius: 20,
  padding: 18,
  marginBottom: 16,
  boxShadow:
    "0 10px 24px rgba(15,23,42,0.045)",
};

const listHeader: CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  flexWrap: "wrap",
};

const sectionTitle: CSSProperties = {
  margin: 0,
  color: "#0f3f8a",
  fontSize: 20,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const pageInfo: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const tableScroll: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 2fr 1.5fr 1fr 1fr",
  gap: 10,
  minWidth: 820,
  background:
    "linear-gradient(135deg,#f8fbff,#eef5ff)",
  color: "#0f3f8a",
  fontWeight: 900,
  padding: 13,
  borderRadius: 12,
  marginBottom: 8,
  border:
    "1px solid #e2e8f0",
};

const tableRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 2fr 1.5fr 1fr 1fr",
  gap: 10,
  minWidth: 820,
  padding: 13,
  borderBottom:
    "1px solid #eef2f7",
  cursor: "pointer",
  alignItems: "center",
  color: "#334155",
  fontSize: 14,
};

const customerLink: CSSProperties = {
  cursor: "pointer",
  color: "#0d47a1",
  fontWeight: 900,
  border: "none",
  background: "transparent",
  padding: 0,
  textAlign: "right",
  fontFamily:
    "var(--font-almarai), sans-serif",
  fontSize: "inherit",
};

const statusBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent:
    "center",
  minWidth: 80,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
};

const paidBadge: CSSProperties = {
  color: "#166534",
  background: "#dcfce7",
  border:
    "1px solid #bbf7d0",
};

const canceledBadge: CSSProperties = {
  color: "#991b1b",
  background: "#fee2e2",
  border:
    "1px solid #fecaca",
};

const emptyBox: CSSProperties = {
  minWidth: 820,
  background: "#f8fbff",
  border:
    "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 20,
  textAlign: "center",
  color: "#64748b",
};

const loadingBox: CSSProperties = {
  background: "#f8fbff",
  border:
    "1px solid #dbe7f5",
  borderRadius: 14,
  padding: 20,
  textAlign: "center",
  color: "#0d47a1",
  fontWeight: 900,
};

const errorBox: CSSProperties = {
  background: "#fff7ed",
  border:
    "1px solid #fed7aa",
  borderRadius: 14,
  padding: 20,
  textAlign: "center",
  color: "#9a3412",
  fontWeight: 900,
};

const retryButton: CSSProperties = {
  marginTop: 12,
  padding: "9px 16px",
  border: "none",
  borderRadius: 11,
  background:
    "linear-gradient(135deg,#1d4ed8,#2563eb)",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const paginationBox: CSSProperties = {
  minWidth: 820,
  marginTop: 16,
  display: "flex",
  justifyContent:
    "center",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const paginationButton: CSSProperties =
  {
    padding: "10px 16px",
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb)",
    color: "#ffffff",
    border: "none",
    borderRadius: 11,
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily:
      "var(--font-almarai), sans-serif",
  };

const paginationText: CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 13,
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
  fontFamily:
    "var(--font-almarai), sans-serif",
};
