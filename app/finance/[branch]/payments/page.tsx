"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import {
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  logoutFinanceUser,
  redirectToFinanceLogin,
  renewFinanceSession,
  validateFinanceSession,
} from "@/lib/financeSession";

const ITEMS_PER_PAGE = 25;

type ScreenType = "mobile" | "tablet" | "desktop";

type CustomerRelation = {
  full_name?: string | null;
  national_id?: string | null;
};

type ContractRelation = {
  id?: string | null;
  customer_id?: string | null;
  contract_number?: string | number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  debt_amount?: number | string | null;
  payment_amount?: number | string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;
  payment_due_date?: string | null;
  contract_status?: string | null;

  customer?:
    | CustomerRelation
    | CustomerRelation[]
    | null;
};

type Payment = {
  id: string;
  branch_id?: string | null;
  contract_id?: string | null;
  payment_amount?: number | string | null;
  payment_type?: string | null;
  notes?: string | null;
  is_cancelled?: boolean | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  created_at?: string | null;

  finance_contracts?:
    | ContractRelation
    | ContractRelation[]
    | null;
};

type CancelPaymentResult = {
  payment_id: string;
  new_paid_amount: number | string;
  new_remaining_amount: number | string;
  new_contract_status: string;
};

export default function FinancePaymentsPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "").trim();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [authChecked, setAuthChecked] =
    useState(false);

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [currentPage, setCurrentPage] =
    useState(1);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [
    cancellingPaymentId,
    setCancellingPaymentId,
  ] = useState<string | null>(null);

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

  function getSingleContract(
    relation:
      | ContractRelation
      | ContractRelation[]
      | null
      | undefined
  ): ContractRelation | null {
    if (Array.isArray(relation)) {
      return relation[0] || null;
    }

    return relation || null;
  }

  function getSingleCustomer(
    relation:
      | CustomerRelation
      | CustomerRelation[]
      | null
      | undefined
  ): CustomerRelation | null {
    if (Array.isArray(relation)) {
      return relation[0] || null;
    }

    return relation || null;
  }

  const loadPayments = useCallback(
    async (
      currentBranchId: string | null,
      isCancelled: () => boolean = () => false
    ) => {
      if (!currentBranchId) {
        if (!isCancelled()) {
          setLoading(false);
          setPageError("تعذر تحديد الفرع");
        }

        return;
      }

      setLoading(true);
      setPageError("");

      try {
        const { data, error } = await supabase
          .from("finance_payments")
          .select(
            `
              id,
              branch_id,
              contract_id,
              payment_amount,
              payment_type,
              notes,
              is_cancelled,
              cancelled_at,
              cancelled_by,
              created_at,

              finance_contracts(
                id,
                customer_id,
                contract_number,
                customer_name,
                customer_phone,
                debt_amount,
                payment_amount,
                paid_amount,
                remaining_amount,
                payment_due_date,
                contract_status,

                customer:finance_customers!finance_contracts_customer_id_fkey(
                  full_name,
                  national_id
                )
              )
            `
          )
          .eq(
            "branch_id",
            currentBranchId
          )
          .order("created_at", {
            ascending: false,
          });

        if (isCancelled()) {
          return;
        }

        if (error) {
          throw new Error(
            error.message
          );
        }

        setPayments(
          (data as Payment[] | null) || []
        );

        setCurrentPage(1);
      } catch (error) {
        if (isCancelled()) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "تعذر تحميل عمليات السداد";

        console.error(
          "Load payments error:",
          error
        );

        setPayments([]);
        setPageError(message);
      } finally {
        if (!isCancelled()) {
          setLoading(false);
        }
      }
    },
    []
  );

  const verifyEmployeeInBackground =
    useCallback(
      async (
        currentEmployeeId: string,
        currentBranchId: string,
        isCancelled: () => boolean
      ) => {
        try {
          const { data, error } =
            await supabase
              .from(
                "finance_branch_users"
              )
              .select(
                `
                  id,
                  full_name,
                  username,
                  branch_id,
                  is_active
                `
              )
              .eq(
                "id",
                currentEmployeeId
              )
              .eq(
                "branch_id",
                currentBranchId
              )
              .maybeSingle();

          if (isCancelled()) {
            return;
          }

          /*
            خطأ الشبكة أو فشل الاستعلام لا يعني
            أن الجلسة انتهت.
          */
          if (error) {
            console.error(
              "Background employee verification error:",
              error
            );

            return;
          }

          /*
            التحويل إلى تسجيل الدخول يتم فقط عندما
            تؤكد قاعدة البيانات أن الحساب غير موجود
            أو أنه معطل.
          */
          if (
            !data?.id ||
            data.is_active === false
          ) {
            redirectToFinanceLogin(
              router,
              {
                branchSlug: branch,
                preserveReturnPath: true,
              }
            );

            return;
          }

          const refreshedEmployeeName =
            data.full_name ||
            data.username ||
            "الموظف";

          setEmployeeName(
            refreshedEmployeeName
          );

          localStorage.setItem(
            "finance_user_name",
            refreshedEmployeeName
          );
        } catch (error) {
          console.error(
            "Background employee verification failed:",
            error
          );
        }
      },
      [branch, router]
    );

  useEffect(() => {
    let cancelled = false;

    async function initializePage() {
      if (
        typeof window === "undefined"
      ) {
        return;
      }

      setLoading(true);
      setPageError("");

      if (!branch) {
        redirectToFinanceLogin(
          router,
          {
            preserveReturnPath: true,
          }
        );

        return;
      }

      const validation =
        validateFinanceSession(branch);

      if (
        validation.reason ===
          "BRANCH_MISMATCH" &&
        validation.user?.branch_slug
      ) {
        router.replace(
          `/finance/${validation.user.branch_slug}`
        );

        return;
      }

      if (
        !validation.valid ||
        !validation.user
      ) {
        redirectToFinanceLogin(
          router,
          {
            branchSlug: branch,
            preserveReturnPath: true,
          }
        );

        return;
      }

      const session =
        validation.user;

      const resolvedEmployeeId =
        String(
          session.id || ""
        ).trim();

      if (!resolvedEmployeeId) {
        redirectToFinanceLogin(
          router,
          {
            branchSlug: branch,
            preserveReturnPath: true,
          }
        );

        return;
      }

      const resolvedEmployeeName =
        getFinanceEmployeeName(
          session
        );

      /*
        نستخدم معرف الفرع الموجود في الجلسة
        مباشرة لتسريع فتح الصفحة.
      */
      let resolvedBranchId =
        String(
          session.branch_id ||
            localStorage.getItem(
              "finance_branch_id"
            ) ||
            ""
        ).trim();

      /*
        لا نستدعي getBranchId إلا عندما يكون
        معرف الفرع غير موجود محليًا.
      */
      if (!resolvedBranchId) {
        try {
          const fetchedBranchId =
            await getBranchId(branch);

          if (cancelled) {
            return;
          }

          resolvedBranchId =
            String(
              fetchedBranchId || ""
            ).trim();
        } catch (error) {
          if (cancelled) {
            return;
          }

          console.error(
            "Resolve branch error:",
            error
          );
        }
      }

      if (!resolvedBranchId) {
        if (!cancelled) {
          setAuthChecked(true);
          setLoading(false);
          setPageError(
            "تعذر تحديد الفرع"
          );
        }

        return;
      }

      localStorage.setItem(
        "finance_branch_id",
        resolvedBranchId
      );

      localStorage.setItem(
        "finance_branch_slug",
        branch
      );

      renewFinanceSession(true);

      if (cancelled) {
        return;
      }

      /*
        إظهار الصفحة مباشرة اعتمادًا على
        الجلسة المحلية.
      */
      setEmployeeName(
        resolvedEmployeeName
      );

      setBranchId(
        resolvedBranchId
      );

      setAuthChecked(true);

      /*
        تحميل عمليات السداد والتحقق من الموظف
        يتمان دون حجب واجهة الصفحة.
      */
      void loadPayments(
        resolvedBranchId,
        () => cancelled
      );

      void verifyEmployeeInBackground(
        resolvedEmployeeId,
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
    loadPayments,
    router,
    verifyEmployeeInBackground,
  ]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    return installFinanceActivityTracker({
      onExpired: () => {
        redirectToFinanceLogin(
          router,
          {
            branchSlug: branch,
            preserveReturnPath: true,
          }
        );
      },
    });
  }, [
    authChecked,
    branch,
    router,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      payments.length /
        ITEMS_PER_PAGE
    )
  );

  const paginatedPayments =
    useMemo(() => {
      const startIndex =
        (currentPage - 1) *
        ITEMS_PER_PAGE;

      return payments.slice(
        startIndex,
        startIndex +
          ITEMS_PER_PAGE
      );
    }, [
      payments,
      currentPage,
    ]);

  function logout() {
    logoutFinanceUser(router);
  }

  function getCancelErrorMessage(
    message: string
  ) {
    if (
      message.includes(
        "PAYMENT_NOT_FOUND"
      )
    ) {
      return "عملية السداد غير موجودة أو لا تتبع هذا الفرع";
    }

    if (
      message.includes(
        "PAYMENT_ALREADY_CANCELLED"
      )
    ) {
      return "عملية السداد ملغية مسبقًا";
    }

    if (
      message.includes(
        "CONTRACT_NOT_FOUND"
      )
    ) {
      return "تعذر العثور على العقد المرتبط بعملية السداد";
    }

    if (
      message.includes(
        "INVALID_EMPLOYEE_SESSION"
      )
    ) {
      return "انتهت جلسة الموظف، سجل الدخول مرة أخرى";
    }

    return (
      message ||
      "تعذر إلغاء عملية السداد"
    );
  }

  async function cancelPayment(
    payment: Payment
  ) {
    if (
      !branchId ||
      cancellingPaymentId
    ) {
      if (!branchId) {
        alert(
          "تعذر تحديد الفرع"
        );
      }

      return;
    }

    const validation =
      validateFinanceSession(
        branch
      );

    if (
      !validation.valid ||
      !validation.user
    ) {
      redirectToFinanceLogin(
        router,
        {
          branchSlug: branch,
          preserveReturnPath: true,
        }
      );

      return;
    }

    if (payment.is_cancelled) {
      alert(
        "عملية السداد ملغية مسبقًا"
      );

      return;
    }

    const contract =
      getSingleContract(
        payment.finance_contracts
      );

    if (
      !contract?.id ||
      !payment.contract_id
    ) {
      alert(
        "تعذر العثور على العقد المرتبط بعملية السداد"
      );

      return;
    }

    const confirmed =
      window.confirm(
        `هل تريد إلغاء عملية السداد بمبلغ ${formatMoney(
          payment.payment_amount
        )} ر.س؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      setCancellingPaymentId(
        payment.id
      );

      renewFinanceSession(true);

      const { data, error } =
        await supabase.rpc(
          "cancel_payment_atomic",
          {
            p_branch_id:
              branchId,

            p_contract_id:
              payment.contract_id,

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
          "لم يتم استلام نتيجة إلغاء عملية السداد"
        );
      }

      await loadPayments(
        branchId
      );

      alert(
        "تم إلغاء عملية السداد وتحديث العقد بنجاح"
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر إلغاء عملية السداد";

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

  if (!authChecked) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(
          isMobile
        )}
      >
        <div
          style={initialLoadingBox}
        >
          جاري فتح صفحة السداد...
        </div>

        <GlobalResponsiveStyles />
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

        <section
          style={actionsSection}
        >
          <button
            type="button"
            style={actionButton}
            onClick={() =>
              router.push(
                `/finance/${branch}/payments/new`
              )
            }
          >
            <span style={actionIcon}>
              💳
            </span>

            <strong>
              إجراء سداد
            </strong>
          </button>
        </section>

        <section style={card}>
          <div style={listHeader}>
            <h2 style={sectionTitle}>
              عمليات السداد
            </h2>

            {payments.length >
              0 && (
              <span style={pageInfo}>
                صفحة{" "}
                {currentPage} من{" "}
                {totalPages} - عرض{" "}
                {
                  paginatedPayments.length
                }{" "}
                من{" "}
                {payments.length}
              </span>
            )}
          </div>

          {pageError && (
            <div
              style={pageErrorBox}
            >
              <span>
                {pageError}
              </span>

              <button
                type="button"
                style={retryButton}
                onClick={() =>
                  void loadPayments(
                    branchId
                  )
                }
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          <div
            className="desktop-table"
            style={tableBox}
          >
            <div
              style={tableHeader}
            >
              <span>العميل</span>

              <span>
                رقم العقد
              </span>

              <span>
                المبلغ
              </span>

              <span>
                طريقة الدفع
              </span>

              <span>
                نوع السداد
              </span>

              <span>
                الإجراء
              </span>
            </div>

            {loading ? (
              <div
                style={emptyBox}
              >
                جاري تحميل عمليات
                السداد...
              </div>
            ) : payments.length ===
              0 ? (
              <div
                style={emptyBox}
              >
                لا توجد عمليات سداد
                حتى الآن
              </div>
            ) : (
              paginatedPayments.map(
                (payment) => {
                  const contract =
                    getSingleContract(
                      payment.finance_contracts
                    );

                  const customer =
                    getSingleCustomer(
                      contract?.customer
                    );

                  const customerName =
                    contract
                      ?.customer_name ||
                    customer
                      ?.full_name ||
                    "-";

                  const isCancelling =
                    cancellingPaymentId ===
                    payment.id;

                  return (
                    <div
                      key={
                        payment.id
                      }
                      style={{
                        ...tableRow,

                        opacity:
                          payment.is_cancelled
                            ? 0.55
                            : 1,
                      }}
                      onClick={() => {
                        if (
                          payment.contract_id
                        ) {
                          router.push(
                            `/finance/${branch}/contracts/${payment.contract_id}`
                          );
                        }
                      }}
                    >
                      <span
                        style={
                          customerLink
                        }
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          if (
                            contract?.customer_id
                          ) {
                            router.push(
                              `/finance/${branch}/customers/${contract.customer_id}`
                            );
                          }
                        }}
                      >
                        {
                          customerName
                        }
                      </span>

                      <span>
                        {contract?.contract_number ||
                          "-"}
                      </span>

                      <span>
                        {formatMoney(
                          payment.payment_amount
                        )}{" "}
                        ر.س
                      </span>

                      <span>
                        {payment.notes ||
                          "-"}
                      </span>

                      <span>
                        {payment.is_cancelled
                          ? "ملغية"
                          : payment.payment_type ||
                            "-"}
                      </span>

                      <span>
                        {payment.is_cancelled ? (
                          <span
                            style={
                              cancelledBadge
                            }
                          >
                            ملغية
                          </span>
                        ) : (
                          <button
                            type="button"
                            style={
                              cancelButton
                            }
                            disabled={
                              isCancelling
                            }
                            onClick={(
                              event
                            ) => {
                              event.stopPropagation();

                              void cancelPayment(
                                payment
                              );
                            }}
                          >
                            {isCancelling
                              ? "جاري الإلغاء..."
                              : "إلغاء"}
                          </button>
                        )}
                      </span>
                    </div>
                  );
                }
              )
            )}
          </div>

          <div
            className="mobile-cards"
          >
            {loading ? (
              <div
                style={emptyBox}
              >
                جاري تحميل عمليات
                السداد...
              </div>
            ) : payments.length ===
              0 ? (
              <div
                style={emptyBox}
              >
                لا توجد عمليات سداد
                حتى الآن
              </div>
            ) : (
              paginatedPayments.map(
                (payment) => {
                  const contract =
                    getSingleContract(
                      payment.finance_contracts
                    );

                  const customer =
                    getSingleCustomer(
                      contract?.customer
                    );

                  const customerName =
                    contract
                      ?.customer_name ||
                    customer
                      ?.full_name ||
                    "-";

                  const isCancelling =
                    cancellingPaymentId ===
                    payment.id;

                  return (
                    <article
                      key={
                        payment.id
                      }
                      style={{
                        ...mobileCard,

                        opacity:
                          payment.is_cancelled
                            ? 0.6
                            : 1,
                      }}
                    >
                      <div
                        style={
                          mobileCardTop
                        }
                      >
                        <strong>
                          {
                            customerName
                          }
                        </strong>

                        {payment.is_cancelled ? (
                          <span
                            style={
                              cancelledBadge
                            }
                          >
                            ملغية
                          </span>
                        ) : (
                          <span
                            style={
                              successBadge
                            }
                          >
                            مسجلة
                          </span>
                        )}
                      </div>

                      <span>
                        رقم العقد:{" "}
                        {contract?.contract_number ||
                          "-"}
                      </span>

                      <span>
                        المبلغ:{" "}
                        {formatMoney(
                          payment.payment_amount
                        )}{" "}
                        ر.س
                      </span>

                      <span>
                        طريقة الدفع:{" "}
                        {payment.notes ||
                          "-"}
                      </span>

                      <span>
                        نوع السداد:{" "}
                        {payment.is_cancelled
                          ? "ملغية"
                          : payment.payment_type ||
                            "-"}
                      </span>

                      <div
                        style={
                          mobileActions
                        }
                      >
                        {payment.contract_id && (
                          <button
                            type="button"
                            style={
                              smallBlueButton
                            }
                            onClick={() =>
                              router.push(
                                `/finance/${branch}/contracts/${payment.contract_id}`
                              )
                            }
                          >
                            فتح العقد
                          </button>
                        )}

                        {!payment.is_cancelled && (
                          <button
                            type="button"
                            style={
                              cancelButton
                            }
                            disabled={
                              isCancelling
                            }
                            onClick={() =>
                              void cancelPayment(
                                payment
                              )
                            }
                          >
                            {isCancelling
                              ? "جاري الإلغاء..."
                              : "إلغاء"}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                }
              )
            )}
          </div>

          {payments.length >
            ITEMS_PER_PAGE && (
            <div
              style={paginationBox}
            >
              <button
                type="button"
                style={{
                  ...paginationButton,

                  opacity:
                    currentPage === 1
                      ? 0.5
                      : 1,
                }}
                disabled={
                  currentPage === 1
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.max(
                        page - 1,
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
                }}
                disabled={
                  currentPage ===
                  totalPages
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.min(
                        page + 1,
                        totalPages
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
          style={bottomActions}
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

      <GlobalResponsiveStyles />
    </main>
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
      <div style={heroCircleOne} />
      <div style={heroCircleTwo} />
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
            سداد
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

      .mobile-cards {
        display: none;
      }

      @media (max-width: 760px) {
        .desktop-table {
          display: none !important;
        }

        .mobile-cards {
          display: grid !important;
          gap: 10px;
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
      isMobile
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
  if (
    screen !== "desktop"
  ) {
    return {
      display: "none",
    };
  }

  return {
    display: "flex",

    justifyContent: "center",
    alignItems: "flex-end",
  };
}

const initialLoadingBox: CSSProperties = {
  width: "calc(100% - 32px)",

  maxWidth: 520,

  margin: "120px auto",

  padding: "22px 26px",

  borderRadius: 18,

  background:
    "rgba(255,255,255,0.96)",

  border:
    "1px solid #dbeafe",

  color: "#1e3a8a",

  textAlign: "center",

  fontSize: 15,
  fontWeight: 900,

  boxShadow:
    "0 12px 30px rgba(15,23,42,0.08)",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

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

const actionsSection: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(240px,1fr))",

  gap: 14,

  marginBottom: 18,
};

const actionButton: CSSProperties = {
  background: "#ffffff",

  border:
    "1px solid #e2e8f0",

  borderRadius: 20,

  padding: 18,

  cursor: "pointer",

  color: "#0f172a",

  display: "flex",

  alignItems: "center",

  gap: 12,

  textAlign: "right",

  fontFamily:
    "var(--font-almarai), sans-serif",

  boxShadow:
    "0 8px 20px rgba(15,23,42,.05)",
};

const actionIcon: CSSProperties = {
  width: 48,
  height: 48,

  borderRadius: 16,

  background: "#eff6ff",

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  fontSize: 22,
};

const card: CSSProperties = {
  background: "#ffffff",

  border:
    "1px solid #e2e8f0",

  borderRadius: 22,

  padding: 18,

  boxShadow:
    "0 8px 20px rgba(15,23,42,.05)",
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

  fontSize: 22,

  color: "#0f172a",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const pageInfo: CSSProperties = {
  color: "#64748b",

  fontSize: 14,

  fontWeight: 900,
};

const pageErrorBox: CSSProperties = {
  display: "flex",

  alignItems: "center",

  justifyContent:
    "space-between",

  gap: 12,

  flexWrap: "wrap",

  marginBottom: 14,

  padding: "12px 14px",

  borderRadius: 12,

  border:
    "1px solid #fecaca",

  background: "#fff7f7",

  color: "#991b1b",

  fontSize: 13,
  fontWeight: 900,
};

const retryButton: CSSProperties = {
  minHeight: 38,

  padding: "8px 14px",

  border: "none",

  borderRadius: 10,

  background:
    "linear-gradient(135deg,#22c55e,#15803d)",

  color: "#ffffff",

  fontSize: 13,
  fontWeight: 900,

  cursor: "pointer",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const tableBox: CSSProperties = {
  width: "100%",

  overflowX: "auto",
};

const tableHeader: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "2fr 1fr 1fr 1fr 1fr 1fr",

  gap: 12,

  minWidth: 980,

  background: "#f1f5f9",

  color: "#1e3a8a",

  fontWeight: 900,

  padding: 14,

  borderRadius: 12,

  marginBottom: 10,
};

const tableRow: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "2fr 1fr 1fr 1fr 1fr 1fr",

  gap: 12,

  minWidth: 980,

  padding: 14,

  borderBottom:
    "1px solid #eef2f7",

  cursor: "pointer",

  alignItems: "center",
};

const customerLink: CSSProperties = {
  cursor: "pointer",

  color: "#1d4ed8",

  fontWeight: 900,
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",

  border:
    "1px dashed #cbd5e1",

  borderRadius: 14,

  padding: 22,

  textAlign: "center",

  color: "#6b7280",
};

const cancelButton: CSSProperties = {
  background: "#fee2e2",

  color: "#991b1b",

  border: "none",

  borderRadius: 10,

  padding: "8px 12px",

  fontWeight: 900,

  cursor: "pointer",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const cancelledBadge: CSSProperties = {
  background: "#e5e7eb",

  color: "#6b7280",

  borderRadius: 999,

  padding: "7px 12px",

  fontWeight: 900,

  width: "fit-content",
};

const successBadge: CSSProperties = {
  background: "#dcfce7",

  color: "#166534",

  borderRadius: 999,

  padding: "7px 12px",

  fontWeight: 900,

  width: "fit-content",
};

const paginationBox: CSSProperties = {
  marginTop: 18,

  display: "flex",

  justifyContent: "center",
  alignItems: "center",

  gap: 12,

  flexWrap: "wrap",
};

const paginationButton: CSSProperties = {
  padding: "10px 16px",

  background: "#1e3a8a",

  color: "#ffffff",

  border: "none",

  borderRadius: 12,

  fontSize: 14,

  fontWeight: 900,

  cursor: "pointer",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const paginationText: CSSProperties = {
  color: "#0f172a",

  fontWeight: 900,
};

const mobileCard: CSSProperties = {
  border:
    "1px solid #e2e8f0",

  borderRadius: 16,

  padding: 13,

  background: "#f8fafc",

  display: "grid",

  gap: 7,
};

const mobileCardTop: CSSProperties = {
  display: "flex",

  justifyContent:
    "space-between",

  gap: 8,

  alignItems: "center",
};

const mobileActions: CSSProperties = {
  display: "flex",

  gap: 8,

  flexWrap: "wrap",

  marginTop: 8,
};

const smallBlueButton: CSSProperties = {
  border: "none",

  background: "#dbeafe",

  color: "#1d4ed8",

  borderRadius: 10,

  padding: "8px 12px",

  fontWeight: 900,

  cursor: "pointer",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const bottomActions: CSSProperties = {
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
