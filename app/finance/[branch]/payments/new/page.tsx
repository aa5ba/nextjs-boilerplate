"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CSSProperties } from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  normalizeNumber,
  toNumber,
} from "@/lib/numberUtils";
import {
  clearFinanceSession,
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  logoutFinanceUser,
  redirectToFinanceLogin,
  validateFinanceSession,
  type FinanceSessionUser,
} from "@/lib/financeSession";

const SEARCH_LIMIT = 300;

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type Contract = {
  id: string;
  branch_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_national_id?: string | null;
  customer_phone?: string | null;
  contract_number?: string | number | null;
  contract_status?: string | null;
  debt_amount?: number | string | null;
  payment_amount?: number | string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;
  payment_due_date?: string | null;
  created_at?: string | null;
};

type PaymentRpcResult = {
  payment_id: string;
  new_paid_amount: number | string;
  new_remaining_amount: number | string;
  new_contract_status: string;
};

export default function NewPaymentPage() {
  const params = useParams();
  const router = useRouter();

  const branch =
    typeof params.branch === "string"
      ? params.branch.trim()
      : "";

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [sessionUser, setSessionUser] =
    useState<FinanceSessionUser | null>(
      null
    );

  const [authChecked, setAuthChecked] =
    useState(false);

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [contracts, setContracts] =
    useState<Contract[]>([]);

  const [
    selectedContract,
    setSelectedContract,
  ] = useState<Contract | null>(null);

  const [paymentType, setPaymentType] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [method, setMethod] =
    useState("");

  const [pageLoading, setPageLoading] =
    useState(true);

  const [searching, setSearching] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [
    loadingContract,
    setLoadingContract,
  ] = useState(false);

  const [hasSearched, setHasSearched] =
    useState(false);

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
      setPageLoading(true);
      setAuthChecked(false);
      setBranchId(null);

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

      if (cancelled) {
        return;
      }

      setSessionUser(
        authenticatedUser
      );

      setBranchId(
        currentBranchId
      );

      setEmployeeName(
        getFinanceEmployeeName(
          authenticatedUser
        )
      );

      setAuthChecked(true);

      await loadContractFromUrl(
        currentBranchId,
        () => cancelled
      );

      if (!cancelled) {
        setPageLoading(false);
      }
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [branch, router]);

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

          setBranchId(
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
    const timer =
      window.setTimeout(() => {
        const value =
          search.trim();

        if (!branchId) {
          return;
        }

        if (value.length >= 2) {
          void smartSearchContracts(
            false
          );
        }

        if (value.length === 0) {
          setContracts(
            selectedContract
              ? [selectedContract]
              : []
          );

          setHasSearched(false);
        }
      }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    search,
    branchId,
    selectedContract,
  ]);

  const canShowSuggestions =
    useMemo(() => {
      return (
        contracts.length > 0 &&
        search.trim().length >= 2
      );
    }, [contracts, search]);

  function logout() {
    logoutFinanceUser(router);
  }

  async function loadContractFromUrl(
    currentBranchId: string,
    isCancelled: () => boolean =
      () => false
  ) {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    const urlParams =
      new URLSearchParams(
        window.location.search
      );

    const contractId =
      urlParams.get("contract");

    if (!contractId) {
      return;
    }

    try {
      setLoadingContract(true);

      const { data, error } =
        await supabase
          .from("finance_contracts")
          .select("*")
          .eq("id", contractId)
          .eq(
            "branch_id",
            currentBranchId
          )
          .eq("is_archived", false)
          .maybeSingle();

      if (isCancelled()) {
        return;
      }

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (!data) {
        alert(
          "العقد المحدد غير موجود أو لا يتبع هذا الفرع"
        );

        return;
      }

      const typedContract =
        data as Contract;

      selectContract(
        typedContract
      );

      setContracts([
        typedContract,
      ]);
    } catch (error) {
      if (isCancelled()) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "تعذر تحميل العقد المحدد";

      alert(message);
    } finally {
      if (!isCancelled()) {
        setLoadingContract(false);
      }
    }
  }

  async function smartSearchContracts(
    showAlert = true
  ) {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    const rawSearch =
      search.trim();

    const normalizedSearch =
      normalizeDigits(rawSearch);

    if (!rawSearch) {
      if (showAlert) {
        alert(
          "اكتب الاسم أو رقم الهوية أو رقم الجوال أو رقم العقد"
        );
      }

      return;
    }

    try {
      setSearching(true);
      setHasSearched(true);

      const { data, error } =
        await supabase
          .from("finance_contracts")
          .select("*")
          .eq(
            "branch_id",
            branchId
          )
          .eq("is_archived", false)
          .order("created_at", {
            ascending: false,
          })
          .limit(SEARCH_LIMIT);

      if (error) {
        throw new Error(
          error.message
        );
      }

      const searchValue =
        normalizeForSearch(
          rawSearch
        );

      const searchNumber =
        normalizeForSearch(
          normalizedSearch
        );

      const results = (
        (data || []) as Contract[]
      )
        .filter((contract) =>
          isContractPayable(
            contract
          )
        )
        .filter((contract) => {
          const customerName =
            normalizeForSearch(
              contract.customer_name
            );

          const customerNationalId =
            normalizeForSearch(
              normalizeDigits(
                String(
                  contract.customer_national_id ||
                    ""
                )
              )
            );

          const customerPhone =
            normalizeForSearch(
              normalizeDigits(
                String(
                  contract.customer_phone ||
                    ""
                )
              )
            );

          const contractNumber =
            normalizeForSearch(
              normalizeDigits(
                String(
                  contract.contract_number ||
                    ""
                )
              )
            );

          return (
            customerName.includes(
              searchValue
            ) ||
            customerNationalId.includes(
              searchNumber
            ) ||
            customerPhone.includes(
              searchNumber
            ) ||
            contractNumber.includes(
              searchNumber
            )
          );
        })
        .slice(0, 25);

      setContracts(results);
    } catch (error) {
      setContracts([]);

      const message =
        error instanceof Error
          ? error.message
          : "تعذر البحث عن العقود";

      alert(message);
    } finally {
      setSearching(false);
    }
  }

  function selectContract(
    contract: Contract
  ) {
    setSelectedContract(
      contract
    );

    setAmount("");
    setPaymentType("");
    setMethod("");
  }

  async function refreshSelectedContract(
    contractId: string
  ) {
    if (!branchId) {
      return;
    }

    const { data, error } =
      await supabase
        .from("finance_contracts")
        .select("*")
        .eq("id", contractId)
        .eq(
          "branch_id",
          branchId
        )
        .eq("is_archived", false)
        .maybeSingle();

    if (error || !data) {
      return;
    }

    const typedContract =
      data as Contract;

    setSelectedContract(
      typedContract
    );

    setContracts(
      (previousContracts) =>
        previousContracts.map(
          (contract) =>
            contract.id ===
            typedContract.id
              ? typedContract
              : contract
        )
    );
  }

  function getPaymentErrorMessage(
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
        "CONTRACT_FULLY_PAID"
      )
    ) {
      return "هذا العقد مسدد بالكامل";
    }

    if (
      message.includes(
        "INVALID_PAYMENT_AMOUNT"
      )
    ) {
      return "مبلغ السداد غير صحيح";
    }

    if (
      message.includes(
        "PAYMENT_EXCEEDS_REMAINING"
      )
    ) {
      return "مبلغ السداد أكبر من المبلغ المتبقي";
    }

    return (
      message ||
      "تعذر تسجيل السداد"
    );
  }

  async function savePayment() {
    if (saving) {
      return;
    }

    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    if (
      !selectedContract?.id
    ) {
      alert("اختر العقد أولاً");
      return;
    }

    if (!paymentType) {
      alert("اختر نوع السداد");
      return;
    }

    if (!amount) {
      alert("أدخل مبلغ السداد");
      return;
    }

    if (!method) {
      alert("اختر طريقة الدفع");
      return;
    }

    const safeContractId =
      selectedContract.id;

    const normalizedAmount =
      normalizeNumber(
        normalizeDigits(amount)
      );

    const paid =
      toNumber(
        normalizedAmount
      );

    if (
      !Number.isFinite(paid) ||
      paid <= 0
    ) {
      alert(
        "أدخل مبلغ سداد صحيح"
      );

      return;
    }

    async function executePayment(
      allowOverpayment: boolean
    ) {
      const response =
        await fetch(
          "/finance/api/payments/record",
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
              contractId:
                safeContractId,
              paymentAmount:
                paid,
              paymentType,
              paymentMethod:
                method,
              allowOverpayment,
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
              payment?: unknown;
              payment_id?: unknown;
              message?: string;
              code?: string;
            }
          | null;

      if (!response.ok) {
        return {
          data: null,
          error: {
            message:
              payload?.message ||
              payload?.code ||
              "تعذر تسجيل السداد",
          },
        };
      }

      return {
        data:
          payload?.payment ??
          payload,
        error: null,
      };
    }

    try {
      setSaving(true);

      let { data, error } =
        await executePayment(
          false
        );

      if (
        error?.message?.includes(
          "PAYMENT_EXCEEDS_REMAINING"
        )
      ) {
        const confirmed =
          window.confirm(
            "مبلغ السداد أكبر من المتبقي. هل تريد المتابعة؟"
          );

        if (!confirmed) {
          return;
        }

        const retryResult =
          await executePayment(
            true
          );

        data =
          retryResult.data;

        error =
          retryResult.error;
      }

      if (error) {
        throw new Error(
          getPaymentErrorMessage(
            error.message
          )
        );
      }

      const rawResult =
        Array.isArray(data)
          ? data[0]
          : data;

      const paymentResult =
        rawResult as
          | PaymentRpcResult
          | null;

      if (
        !paymentResult?.payment_id
      ) {
        throw new Error(
          "لم يتم استلام رقم عملية السداد"
        );
      }

      await refreshSelectedContract(
        safeContractId
      );

      router.push(
        `/finance/${branch}/payments/receipt/${paymentResult.payment_id}?contract=${safeContractId}`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر تسجيل السداد";

      alert(
        getPaymentErrorMessage(
          message
        )
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    !authChecked ||
    pageLoading
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

          <div
            style={loadingBox}
          >
            جاري تحميل صفحة
            السداد...
          </div>
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

        <section style={card}>
          <div
            className="payment-search-row"
            style={searchRow}
          >
            <input
              style={input}
              placeholder="بحث بالاسم أو رقم الهوية أو رقم الجوال أو رقم العقد"
              value={search}
              onChange={(event) =>
                setSearch(
                  normalizeDigits(
                    event.target.value
                  )
                )
              }
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  void smartSearchContracts(
                    true
                  );
                }
              }}
            />

            <button
              type="button"
              style={searchButton}
              onClick={() =>
                void smartSearchContracts(
                  true
                )
              }
              disabled={searching}
            >
              {searching
                ? "جاري البحث..."
                : "بحث"}
            </button>
          </div>

          {loadingContract && (
            <div
              style={emptyBox}
            >
              جاري تحميل العقد
              المحدد...
            </div>
          )}

          {hasSearched &&
            contracts.length ===
              0 &&
            search.trim() &&
            !searching && (
              <div
                style={emptyBox}
              >
                لا توجد عقود
                مطابقة قابلة للسداد
              </div>
            )}

          {canShowSuggestions && (
            <div
              style={suggestionsBox}
            >
              {contracts.map(
                (contract) => (
                  <button
                    key={
                      contract.id
                    }
                    type="button"
                    style={
                      selectedContract?.id ===
                      contract.id
                        ? selectedSuggestionButton
                        : suggestionButton
                    }
                    onClick={() =>
                      selectContract(
                        contract
                      )
                    }
                  >
                    <div
                      style={
                        suggestionTop
                      }
                    >
                      <strong>
                        {contract.customer_name ||
                          "-"}
                      </strong>

                      <span
                        style={
                          contractNumberBadge
                        }
                      >
                        عقد{" "}
                        {contract.contract_number ||
                          "-"}
                      </span>
                    </div>

                    <div
                      style={
                        suggestionMeta
                      }
                    >
                      <span>
                        هوية:{" "}
                        {contract.customer_national_id ||
                          "-"}
                      </span>

                      <span>
                        جوال:{" "}
                        {contract.customer_phone ||
                          "-"}
                      </span>

                      <span>
                        المتبقي:{" "}
                        {formatMoney(
                          contract.remaining_amount
                        )}{" "}
                        ر.س
                      </span>
                    </div>
                  </button>
                )
              )}
            </div>
          )}
        </section>

        {selectedContract && (
          <section style={card}>
            <div
              style={selectedHeader}
            >
              <h2
                style={sectionTitle}
              >
                عقد رقم{" "}
                {selectedContract.contract_number ||
                  "-"}
              </h2>

              <span
                style={remainingPill}
              >
                المتبقي{" "}
                {formatMoney(
                  selectedContract.remaining_amount
                )}{" "}
                ر.س
              </span>
            </div>

            <div
              style={detailsGrid}
            >
              <Row
                label="العميل"
                value={
                  selectedContract.customer_name
                }
              />

              <Row
                label="رقم الهوية"
                value={
                  selectedContract.customer_national_id
                }
              />

              <Row
                label="رقم الجوال"
                value={
                  selectedContract.customer_phone
                }
              />

              <Row
                label="مبلغ الدين"
                value={`${formatMoney(
                  selectedContract.debt_amount
                )} ر.س`}
              />

              <Row
                label="المسدد"
                value={`${formatMoney(
                  selectedContract.paid_amount
                )} ر.س`}
              />

              <Row
                label="المتبقي"
                value={`${formatMoney(
                  selectedContract.remaining_amount
                )} ر.س`}
              />
            </div>

            <div
              style={formGrid}
            >
              <div>
                <label
                  style={label}
                >
                  نوع السداد
                </label>

                <select
                  style={input}
                  value={
                    paymentType
                  }
                  onChange={(
                    event
                  ) => {
                    const value =
                      event.target
                        .value;

                    setPaymentType(
                      value
                    );

                    if (
                      value ===
                      "كلي"
                    ) {
                      setAmount(
                        normalizeNumber(
                          normalizeDigits(
                            String(
                              selectedContract.remaining_amount ||
                                ""
                            )
                          )
                        )
                      );
                    }

                    if (
                      value ===
                      "جزئي"
                    ) {
                      setAmount("");
                    }
                  }}
                >
                  <option value="">
                    اختر نوع السداد
                  </option>

                  <option value="كلي">
                    كلي
                  </option>

                  <option value="جزئي">
                    جزئي
                  </option>
                </select>
              </div>

              <div>
                <label
                  style={label}
                >
                  المبلغ المدفوع
                </label>

                <input
                  style={input}
                  inputMode="decimal"
                  placeholder="المبلغ المدفوع"
                  value={amount}
                  onChange={(
                    event
                  ) =>
                    setAmount(
                      normalizeNumber(
                        normalizeDigits(
                          event.target
                            .value
                        )
                      )
                    )
                  }
                />
              </div>

              <div>
                <label
                  style={label}
                >
                  طريقة الدفع
                </label>

                <select
                  style={input}
                  value={method}
                  onChange={(
                    event
                  ) =>
                    setMethod(
                      event.target
                        .value
                    )
                  }
                >
                  <option value="">
                    اختر طريقة الدفع
                  </option>

                  <option value="نقدًا">
                    نقدًا
                  </option>

                  <option value="تحويل">
                    تحويل
                  </option>

                  <option value="شبكة">
                    شبكة
                  </option>

                  <option value="شيك">
                    شيك
                  </option>

                  <option value="تسوية">
                    تسوية
                  </option>
                </select>
              </div>
            </div>

            <button
              type="button"
              style={primaryButton}
              onClick={savePayment}
              disabled={saving}
            >
              {saving
                ? "جاري حفظ السداد..."
                : "حفظ السداد"}
            </button>
          </section>
        )}

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

          <button
            type="button"
            style={
              homeBottomButton
            }
            onClick={() =>
              router.push(
                `/finance/${branch}`
              )
            }
          >
            محطة العمل الرئيسية
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
            إجراء سداد
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

function Row({
  label,
  value,
}: {
  label: string;
  value?:
    | string
    | number
    | null;
}) {
  return (
    <div style={row}>
      <span>{label}</span>

      <strong>
        {value || "-"}
      </strong>
    </div>
  );
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

function normalizeForSearch(
  value: unknown
) {
  return normalizeDigits(
    String(value || "")
  )
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/\s+/g, " ");
}

function isContractPayable(
  contract: Contract
) {
  const status =
    String(
      contract.contract_status ||
        ""
    ).trim();

  const remaining =
    Number(
      contract.remaining_amount ||
        0
    );

  return (
    remaining > 0 &&
    status !== "مغلق" &&
    status !== "closed" &&
    status !== "تم السداد" &&
    status !== "ملغي"
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

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      button,
      input,
      select {
        -webkit-tap-highlight-color: transparent;
      }

      button:disabled {
        cursor: not-allowed !important;
        opacity: 0.65;
      }

      @media (max-width: 720px) {
        .payment-search-row {
          grid-template-columns: 1fr !important;
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
    backgroundColor:
      "#f6f9ff",
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
    color: "#0f172a",
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
  if (
    screen === "mobile"
  ) {
    return {
      position: "relative",
      zIndex: 3,
      display: "flex",
      flexDirection:
        "column",
      alignItems: "stretch",
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
  if (
    screen === "mobile"
  ) {
    return {
      width: "100%",
      display: "grid",
      gap: 12,
      direction: "rtl",
      justifyItems: "center",
      justifySelf: "center",
      order: 2,
    };
  }

  if (
    screen === "tablet"
  ) {
    return {
      width: "100%",
      maxWidth: 520,
      display: "grid",
      gap: 14,
      direction: "rtl",
      justifyItems: "center",
      justifySelf: "center",
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
  if (
    screen === "mobile"
  ) {
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

  if (
    screen === "tablet"
  ) {
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
    flexDirection:
      "column",
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
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    flexDirection:
      "column",
    justifyContent:
      "center",
    alignItems:
      "flex-end",
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
  };

const logoutInlineButton: CSSProperties =
  {
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
  backgroundSize:
    "14px 14px",
  zIndex: 2,
};

const card: CSSProperties = {
  background: "#ffffff",
  border:
    "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 18,
  marginBottom: 16,
  boxShadow:
    "0 8px 20px rgba(15,23,42,.05)",
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

const searchRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 130px",
  gap: 12,
};

const input: CSSProperties = {
  width: "100%",
  minHeight: 50,
  padding: "0 14px",
  borderRadius: 14,
  border:
    "1px solid #cbd5e1",
  fontSize: 16,
  marginBottom: 12,
  background: "#f8fafc",
  fontFamily: "inherit",
  outline: "none",
};

const searchButton: CSSProperties = {
  minHeight: 50,
  padding: "0 14px",
  background:
    "linear-gradient(135deg,#2563eb,#1e3a8a)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 15,
  cursor: "pointer",
  fontWeight: 900,
  fontFamily: "inherit",
};

const suggestionsBox: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 10,
};

const suggestionButton: CSSProperties = {
  width: "100%",
  border:
    "1px solid #e2e8f0",
  background: "#f8fbff",
  borderRadius: 16,
  padding: 14,
  cursor: "pointer",
  textAlign: "right",
  display: "grid",
  gap: 8,
  fontFamily: "inherit",
};

const selectedSuggestionButton: CSSProperties =
  {
    ...suggestionButton,
    border:
      "1px solid #2563eb",
    background: "#eff6ff",
  };

const suggestionTop: CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const contractNumberBadge: CSSProperties =
  {
    background: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "5px 10px",
    fontWeight: 900,
    fontSize: 13,
  };

const suggestionMeta: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border:
    "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center",
  color: "#6b7280",
  marginTop: 12,
  fontWeight: 800,
};

const selectedHeader: CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 14,
};

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  color: "#0f172a",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const remainingPill: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "8px 12px",
  fontWeight: 900,
};

const detailsGrid: CSSProperties = {
  display: "grid",
  gap: 0,
  marginBottom: 14,
};

const row: CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom:
    "1px solid #eef2f7",
  flexWrap: "wrap",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
};

const label: CSSProperties = {
  display: "block",
  fontWeight: 900,
  color: "#334155",
  marginBottom: 7,
};

const primaryButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background:
    "linear-gradient(135deg,#2563eb,#1e3a8a)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  cursor: "pointer",
  fontWeight: 900,
  fontFamily: "inherit",
};

const bottomActions: CSSProperties = {
  display: "flex",
  justifyContent:
    "center",
  gap: 10,
  flexWrap: "wrap",
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

const homeBottomButton: CSSProperties =
  {
    padding: "10px 17px",
    background:
      "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
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
