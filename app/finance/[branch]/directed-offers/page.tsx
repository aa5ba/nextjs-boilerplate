"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type {
  CSSProperties,
  ReactNode,
} from "react";
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
  renewFinanceSession,
  validateFinanceSession,
} from "@/lib/financeSession";
import {
  normalizeNumber,
  toNumber,
} from "@/lib/numberUtils";

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type TabKey =
  | "open"
  | "sent"
  | "accepted"
  | "archive";

type OfferStatus =
  | "active"
  | "accepted"
  | "contract_created"
  | "paid"
  | "cancelled";

type CommissionStatus =
  | "pending"
  | "not_delivered"
  | "received";

type DirectedOffer = {
  id: string;
  requestType: string;
  customerName: string;
  customerNationalId?: string | null;
  customerPhone?: string | null;
  city: string;
  requestedAmount: number;
  workName: string;
  birthHijriDay?: number | null;
  birthHijriMonth?: number | null;
  birthHijriYear?: number | null;
  commissionAmount: number;
  status: OfferStatus;
  commissionStatus: CommissionStatus;
  contractId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  acceptedAt?: string | null;
  expiresAt: string;
  createdByBranchId?: string | null;
  acceptedByBranchId?: string | null;
  createdByBranchName?: string;
  acceptedByBranchName?: string;
  creatorBranchPhone?: string;
  acceptedBranchPhone?: string;
  otherBranchPhone?: string;
  createdByUserName?: string;
  createdByUserPhone?: string;
  acceptedByUserName?: string;
  acceptedByUserPhone?: string;
  otherUserName?: string;
  otherUserPhone?: string;
  isCreator: boolean;
  isAcceptedByCurrent: boolean;
};

type OffersResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  offers?: DirectedOffer[];
  blockStatus?: {
    activeNotDeliveredCount?: number;
    isBlocked?: boolean;
  };
};

type ActionResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  acceptedOffer?: DirectedOffer | null;
};

const tabs: Array<{
  key: TabKey;
  label: string;
}> = [
  {
    key: "open",
    label: "العروض المفتوحة",
  },
  {
    key: "sent",
    label: "عروضي المرسلة",
  },
  {
    key: "accepted",
    label: "العروض المقبولة",
  },
  {
    key: "archive",
    label: "الأرشيف",
  },
];

const requestTypes = [
  "طلب مهلة",
  "طلب سداد",
];

const saudiRegions = [
  "الرياض",
  "مكة المكرمة",
  "المدينة المنورة",
  "القصيم",
  "المنطقة الشرقية",
  "عسير",
  "تبوك",
  "حائل",
  "الحدود الشمالية",
  "جازان",
  "نجران",
  "الباحة",
  "الجوف",
];

function emptyForm() {
  return {
    requestType: "طلب مهلة",
    customerName: "",
    customerNationalId: "",
    customerPhone: "",
    city: "",
    requestedAmount: "",
    workName: "",
    birthHijriDay: "",
    birthHijriMonth: "",
    birthHijriYear: "",
    commissionAmount: "",
  };
}

function formatMoney(
  value: number | string | null | undefined
) {
  const amount = Number(value || 0);

  return Number.isFinite(amount)
    ? amount.toLocaleString("ar-SA", {
        maximumFractionDigits: 2,
      })
    : "0";
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "-";
  }

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}/${month}/${day}`;
}

function getRemainingText(
  expiresAt: string
) {
  const expires =
    new Date(expiresAt).getTime();

  const diff =
    expires - Date.now();

  if (
    !Number.isFinite(diff) ||
    diff <= 0
  ) {
    return "منتهي";
  }

  const hours = Math.ceil(
    diff / 3_600_000
  );

  if (hours < 24) {
    return `${hours} ساعة`;
  }

  return `${Math.ceil(
    hours / 24
  )} يوم`;
}

function statusLabel(
  status: OfferStatus
) {
  if (status === "active") {
    return "نشط";
  }

  if (status === "accepted") {
    return "مقبول";
  }

  if (
    status === "contract_created"
  ) {
    return "تم إنشاء عقد العميل";
  }

  if (status === "paid") {
    return "تم السداد";
  }

  return "ملغي";
}

function commissionLabel(
  status: CommissionStatus
) {
  if (status === "received") {
    return "تم استلام العمولة";
  }

  if (status === "not_delivered") {
    return "لم يتم تسليم العمولة";
  }

  return "بانتظار تسليم العمولة";
}

function getStatusPillStyle(
  status: OfferStatus
): CSSProperties {
  if (status === "active") {
    return {
      ...statusPill,
      background: "#dcfce7",
      color: "#15803d",
    };
  }

  if (status === "cancelled") {
    return {
      ...statusPill,
      background: "#fee2e2",
      color: "#b91c1c",
    };
  }

  return statusPill;
}

function getOfferTimelineInfo(
  offer: DirectedOffer,
  activeTab: TabKey
) {
  if (activeTab === "open") {
    return {
      label: "الوقت المتبقي",
      value: getRemainingText(
        offer.expiresAt
      ),
    };
  }

  if (offer.status === "paid") {
    return {
      label: "حالة العقد",
      value: "تم السداد",
    };
  }

  if (
    offer.status ===
    "contract_created"
  ) {
    return {
      label: "حالة العقد",
      value: "تم إنشاء عقد",
    };
  }

  if (offer.status === "accepted") {
    return {
      label: "تاريخ القبول",
      value: formatDateTime(
        offer.acceptedAt
      ),
    };
  }

  if (offer.status === "cancelled") {
    return {
      label: "الحالة",
      value: "ملغي",
    };
  }

  return {
    label: "الوقت المتبقي",
    value: getRemainingText(
      offer.expiresAt
    ),
  };
}

export default function DirectedOffersPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(
    params.branch ?? ""
  )
    .trim()
    .toLowerCase();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [pageReady, setPageReady] =
    useState(false);

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [activeTab, setActiveTab] =
    useState<TabKey>("open");

  const [offers, setOffers] =
    useState<DirectedOffer[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [feedback, setFeedback] =
    useState("");

  const [form, setForm] =
    useState(emptyForm);

  const [
    pendingAcceptOffer,
    setPendingAcceptOffer,
  ] = useState<DirectedOffer | null>(
    null
  );

  const [
    acceptedOfferSuccess,
    setAcceptedOfferSuccess,
  ] = useState<DirectedOffer | null>(
    null
  );

  const [
    acceptError,
    setAcceptError,
  ] = useState("");

  const [
    acceptLoading,
    setAcceptLoading,
  ] = useState(false);

  const [
    showCreateForm,
    setShowCreateForm,
  ] = useState(false);

  const [filters, setFilters] =
    useState({
      city: "",
      amountFrom: "",
      amountTo: "",
      requestType: "",
    });

  const [blockStatus, setBlockStatus] =
    useState({
      activeNotDeliveredCount: 0,
      isBlocked: false,
    });

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
    if (!branch) {
      clearFinanceSession();
      router.replace("/login");
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

    const readyTimer =
      window.setTimeout(() => {
        setEmployeeName(
          getFinanceEmployeeName()
        );
        setPageReady(true);
      }, 0);

    const cleanup =
      installFinanceActivityTracker({
        expectedBranchSlug: branch,
        onExpired: () =>
          redirectToFinanceLogin(
            router,
            {
              branchSlug: branch,
              preserveReturnPath:
                true,
            }
          ),
      });

    return () => {
      window.clearTimeout(
        readyTimer
      );
      cleanup();
    };
  }, [branch, router]);

  const loadOffers = useCallback(
    async () => {
      if (!branch) {
        return;
      }

      try {
        setLoading(true);
        setFeedback("");

        const url = new URL(
          "/finance/api/directed-offers",
          window.location.origin
        );

        url.searchParams.set(
          "branch",
          branch
        );

        url.searchParams.set(
          "scope",
          activeTab
        );

        if (activeTab === "open") {
          if (filters.city.trim()) {
            url.searchParams.set(
              "city",
              filters.city.trim()
            );
          }

          if (filters.amountFrom) {
            url.searchParams.set(
              "amountFrom",
              filters.amountFrom
            );
          }

          if (filters.amountTo) {
            url.searchParams.set(
              "amountTo",
              filters.amountTo
            );
          }

          if (
            filters.requestType
          ) {
            url.searchParams.set(
              "requestType",
              filters.requestType
            );
          }
        }

        const response = await fetch(
          url.toString(),
          {
            method: "GET",
            credentials:
              "same-origin",
            cache: "no-store",
          }
        );

        const payload =
          (await response
            .json()
            .catch(
              () => null
            )) as OffersResponse | null;

        if (
          !response.ok ||
          !payload?.ok
        ) {
          throw new Error(
            payload?.message ||
              "تعذر تحميل العروض"
          );
        }

        setOffers(
          payload.offers || []
        );

        setBlockStatus({
          activeNotDeliveredCount:
            Number(
              payload.blockStatus
                ?.activeNotDeliveredCount ||
                0
            ),
          isBlocked: Boolean(
            payload.blockStatus
              ?.isBlocked
          ),
        });
      } catch (error) {
        setOffers([]);
        setFeedback(
          error instanceof Error
            ? error.message
            : "تعذر تحميل العروض"
        );
      } finally {
        setLoading(false);
      }
    },
    [activeTab, branch, filters]
  );

  useEffect(() => {
    if (pageReady) {
      const timer =
        window.setTimeout(() => {
          void loadOffers();
        }, 0);

      return () => {
        window.clearTimeout(
          timer
        );
      };
    }
  }, [loadOffers, pageReady]);

  function updateForm(
    key: keyof ReturnType<
      typeof emptyForm
    >,
    value: string
  ) {
    const numericKeys = new Set([
      "customerNationalId",
      "customerPhone",
      "requestedAmount",
      "birthHijriDay",
      "birthHijriMonth",
      "birthHijriYear",
      "commissionAmount",
    ]);

    setForm((current) => ({
      ...current,
      [key]: numericKeys.has(key)
        ? normalizeNumber(value)
        : value,
    }));
  }

  async function postAction(
    body: Record<string, unknown>,
    successMessage: string
  ): Promise<ActionResponse> {
    const response = await fetch(
      "/finance/api/directed-offers",
      {
        method: "POST",
        credentials:
          "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          branch,
          ...body,
        }),
      }
    );

    const payload =
      (await response
        .json()
        .catch(
          () => null
        )) as ActionResponse | null;

    if (
      !response.ok ||
      !payload?.ok
    ) {
      throw new Error(
        payload?.message ||
          "تعذر تنفيذ العملية"
      );
    }

    setFeedback(successMessage);
    await loadOffers();

    return payload;
  }

  async function createOffer() {
    if (saving) {
      return;
    }

    const nationalId =
      normalizeNumber(
        form.customerNationalId
      );

    const requestedAmount =
      toNumber(
        form.requestedAmount
      );

    const customerPhone =
      normalizeNumber(
        form.customerPhone
      );

    const commissionAmount =
      toNumber(
        form.commissionAmount
      );

    const birthHijriDay = Number(
      form.birthHijriDay
    );

    const birthHijriMonth = Number(
      form.birthHijriMonth
    );

    const birthHijriYear = Number(
      form.birthHijriYear
    );

    if (
      form.customerName.trim()
        .length < 2
    ) {
      alert(
        "اسم العميل مطلوب"
      );
      return;
    }

    if (nationalId.length !== 10) {
      alert(
        "رقم الهوية يجب أن يكون 10 أرقام"
      );
      return;
    }

    if (
      customerPhone.length !== 10 ||
      !customerPhone.startsWith(
        "05"
      )
    ) {
      alert(
        "رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05"
      );
      return;
    }

    if (
      !saudiRegions.includes(
        form.city
      )
    ) {
      alert("المنطقة مطلوبة");
      return;
    }

    if (
      form.workName.trim().length < 2
    ) {
      alert("جهة العمل مطلوبة");
      return;
    }

    if (
      !Number.isInteger(
        birthHijriDay
      ) ||
      birthHijriDay < 1 ||
      birthHijriDay > 30
    ) {
      alert(
        "يوم الميلاد الهجري غير صحيح"
      );
      return;
    }

    if (
      !Number.isInteger(
        birthHijriMonth
      ) ||
      birthHijriMonth < 1 ||
      birthHijriMonth > 12
    ) {
      alert(
        "شهر الميلاد الهجري غير صحيح"
      );
      return;
    }

    if (
      !Number.isInteger(
        birthHijriYear
      ) ||
      birthHijriYear < 1200 ||
      birthHijriYear > 1600
    ) {
      alert(
        "سنة الميلاد الهجري غير صحيحة"
      );
      return;
    }

    if (requestedAmount <= 0) {
      alert(
        "المبلغ المطلوب غير صحيح"
      );
      return;
    }

    if (commissionAmount < 0) {
      alert("العمولة غير صحيحة");
      return;
    }

    try {
      setSaving(true);
      renewFinanceSession();

      await postAction(
        {
          action: "create",
          requestType:
            form.requestType,
          customerName:
            form.customerName,
          customerNationalId:
            nationalId,
          customerPhone,
          city: form.city,
          requestedAmount:
            form.requestedAmount,
          workName:
            form.workName,
          birthHijriDay:
            form.birthHijriDay,
          birthHijriMonth:
            form.birthHijriMonth,
          birthHijriYear:
            form.birthHijriYear,
          commissionAmount:
            form.commissionAmount,
        },
        "تم إنشاء العرض"
      );

      setForm(emptyForm());
      setShowCreateForm(false);
      setOffers([]);
      setLoading(true);
      setActiveTab("sent");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "تعذر إنشاء العرض"
      );
    } finally {
      setSaving(false);
    }
  }

  async function runOfferAction(
    offerId: string,
    action: string,
    successMessage: string
  ) {
    if (saving) {
      return;
    }

    try {
      setSaving(true);
      renewFinanceSession();
      await postAction(
        {
          action,
          offerId,
        },
        successMessage
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "تعذر تنفيذ العملية"
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmAcceptOffer() {
    if (
      !pendingAcceptOffer ||
      acceptLoading
    ) {
      return;
    }

    try {
      setAcceptLoading(true);
      setSaving(true);
      setAcceptError("");
      renewFinanceSession();

      const payload =
        await postAction(
          {
            action: "accept",
            offerId:
              pendingAcceptOffer.id,
          },
          ""
        );

      setPendingAcceptOffer(null);
      setAcceptedOfferSuccess(
        payload.acceptedOffer ||
          pendingAcceptOffer
      );
    } catch (error) {
      setAcceptError(
        error instanceof Error
          ? error.message
          : "تعذر قبول العرض"
      );
    } finally {
      setAcceptLoading(false);
      setSaving(false);
    }
  }

  function changeTab(
    tabKey: TabKey
  ) {
    if (tabKey === activeTab) {
      return;
    }

    setOffers([]);
    setFeedback("");
    setLoading(true);
    setActiveTab(tabKey);
  }

  function openNewRequest(
    offer: DirectedOffer
  ) {
    router.push(
      `/finance/${branch}/new-request?directedOfferId=${encodeURIComponent(
        offer.id
      )}`
    );
  }

  function logout() {
    logoutFinanceUser(router);
  }

  function closeAcceptSuccess() {
    setAcceptedOfferSuccess(null);
  }

  function openAcceptedOfferRequest() {
    if (!acceptedOfferSuccess) {
      return;
    }

    const offer =
      acceptedOfferSuccess;

    setAcceptedOfferSuccess(null);
    openNewRequest(offer);
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
                عروض الطلب الموجه
              </h1>
            </div>

            <div
              style={getHeroActionBoxStyle(
                screen
              )}
            />
          </div>
        </header>

        {blockStatus.isBlocked && (
          <section style={warningBox}>
            تم حجب قبول الطلبات الموجهة مؤقتًا بسبب بلاغات عمولة قائمة.
          </section>
        )}

        {feedback && (
          <section style={successBox}>
            {feedback}
          </section>
        )}

        <section style={panel}>
          <div style={sectionHeader}>
            <strong>
              إنشاء عرض موجه
            </strong>
            <button
              type="button"
              style={toggleCreateButton}
              onClick={() =>
                setShowCreateForm(
                  (current) =>
                    !current
                )
              }
            >
              إنشاء عرض موجه
            </button>
          </div>

          {showCreateForm && (
          <div style={formRows}>
            <div
              style={getFormGridStyle(
                isCompact
              )}
            >
              <Field label="نوع الطلب">
                <select
                  style={selectInput}
                  value={
                    form.requestType
                  }
                  onChange={(event) =>
                    updateForm(
                      "requestType",
                      event.target.value
                    )
                  }
                >
                  {requestTypes.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="اسم العميل">
                <input
                  style={input}
                  value={
                    form.customerName
                  }
                  onChange={(event) =>
                    updateForm(
                      "customerName",
                      event.target.value
                    )
                  }
                />
              </Field>

              <Field label="رقم الهوية">
                <input
                  style={input}
                  inputMode="numeric"
                  maxLength={10}
                  value={
                    form.customerNationalId
                  }
                  onChange={(event) =>
                    updateForm(
                      "customerNationalId",
                      event.target.value
                    )
                  }
                />
              </Field>

              <Field label="رقم الجوال">
                <input
                  style={input}
                  inputMode="numeric"
                  maxLength={10}
                  value={
                    form.customerPhone
                  }
                  onChange={(event) =>
                    updateForm(
                      "customerPhone",
                      event.target.value
                    )
                  }
                />
              </Field>
            </div>

            <div
              style={getFormGridStyle(
                isCompact
              )}
            >
              <Field label="المنطقة">
                <select
                  style={selectInput}
                  value={form.city}
                  onChange={(event) =>
                    updateForm(
                      "city",
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    اختر المنطقة
                  </option>
                  {saudiRegions.map(
                    (region) => (
                      <option
                        key={region}
                        value={region}
                      >
                        {region}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="المبلغ المطلوب">
                <input
                  style={input}
                  inputMode="decimal"
                  value={
                    form.requestedAmount
                  }
                  onChange={(event) =>
                    updateForm(
                      "requestedAmount",
                      event.target.value
                    )
                  }
                />
              </Field>

              <Field label="جهة العمل">
                <input
                  style={input}
                  value={form.workName}
                  onChange={(event) =>
                    updateForm(
                      "workName",
                      event.target.value
                    )
                  }
                />
              </Field>
            </div>

            <div
              style={getFormFooterStyle(
                isCompact
              )}
            >
              <div style={birthDateGroup}>
                <span style={labelStyle}>
                  تاريخ الميلاد الهجري
                </span>

                <div style={birthDateInputs}>
                  <input
                    aria-label="يوم الميلاد"
                    placeholder="اليوم"
                    style={smallDateInput}
                    inputMode="numeric"
                    maxLength={2}
                    value={
                      form.birthHijriDay
                    }
                    onChange={(event) =>
                      updateForm(
                        "birthHijriDay",
                        event.target.value
                      )
                    }
                  />

                  <input
                    aria-label="شهر الميلاد"
                    placeholder="الشهر"
                    style={smallDateInput}
                    inputMode="numeric"
                    maxLength={2}
                    value={
                      form.birthHijriMonth
                    }
                    onChange={(event) =>
                      updateForm(
                        "birthHijriMonth",
                        event.target.value
                      )
                    }
                  />

                  <input
                    aria-label="سنة الميلاد"
                    placeholder="السنة"
                    style={yearDateInput}
                    inputMode="numeric"
                    maxLength={4}
                    value={
                      form.birthHijriYear
                    }
                    onChange={(event) =>
                      updateForm(
                        "birthHijriYear",
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>

              <label style={commissionField}>
                <span style={labelStyle}>
                  العمولة
                </span>
                <input
                  style={commissionInput}
                  inputMode="decimal"
                  value={
                    form.commissionAmount
                  }
                  onChange={(event) =>
                    updateForm(
                      "commissionAmount",
                      event.target.value
                    )
                  }
                />
              </label>

              <button
                type="button"
                style={primaryButton}
                onClick={createOffer}
                disabled={saving}
              >
                {saving
                  ? "جاري الحفظ..."
                  : "إنشاء عرض"}
              </button>
            </div>
          </div>
          )}
        </section>

        <section style={panel}>
          <div style={tabsRow}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                style={
                  activeTab === tab.key
                    ? activeTabButton
                    : tabButton
                }
                onClick={() =>
                  changeTab(
                    tab.key
                  )
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "open" && (
            <div
              style={getFilterGridStyle(
                isCompact
              )}
            >
              <Field label="المنطقة">
                <select
                  style={selectInput}
                  value={filters.city}
                  onChange={(event) =>
                    setFilters(
                      (current) => ({
                        ...current,
                        city: event
                          .target.value,
                      })
                    )
                  }
                >
                  <option value="">
                    كل المناطق
                  </option>
                  {saudiRegions.map(
                    (region) => (
                      <option
                        key={region}
                        value={region}
                      >
                        {region}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="المبلغ من">
                <input
                  style={input}
                  inputMode="decimal"
                  value={
                    filters.amountFrom
                  }
                  onChange={(event) =>
                    setFilters(
                      (current) => ({
                        ...current,
                        amountFrom:
                          normalizeNumber(
                            event.target
                              .value
                          ),
                      })
                    )
                  }
                />
              </Field>

              <Field label="المبلغ إلى">
                <input
                  style={input}
                  inputMode="decimal"
                  value={
                    filters.amountTo
                  }
                  onChange={(event) =>
                    setFilters(
                      (current) => ({
                        ...current,
                        amountTo:
                          normalizeNumber(
                            event.target
                              .value
                          ),
                      })
                    )
                  }
                />
              </Field>

              <Field label="نوع الطلب">
                <select
                  style={selectInput}
                  value={
                    filters.requestType
                  }
                  onChange={(event) =>
                    setFilters(
                      (current) => ({
                        ...current,
                        requestType:
                          event.target
                            .value,
                      })
                    )
                  }
                >
                  <option value="">
                    كل الأنواع
                  </option>
                  {requestTypes.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    )
                  )}
                </select>
              </Field>
            </div>
          )}

          {loading ? (
            <div style={emptyBox}>
              جاري تحميل العروض...
            </div>
          ) : offers.length === 0 ? (
            <div style={emptyBox}>
              لا توجد عروض
            </div>
          ) : (
            <div
              style={getOffersGridStyle(
                screen
              )}
            >
              {offers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  activeTab={activeTab}
                  saving={saving}
                  acceptBlocked={
                    blockStatus.isBlocked
                  }
                  onAccept={() =>
                    setPendingAcceptOffer(
                      offer
                    )
                  }
                  onWithdraw={() =>
                    void runOfferAction(
                      offer.id,
                      "withdraw",
                      "تم التراجع عن القبول"
                    )
                  }
                  onCancel={() =>
                    void runOfferAction(
                      offer.id,
                      "cancel",
                      "تم إلغاء العرض"
                    )
                  }
                  onCommissionReceived={() =>
                    void runOfferAction(
                      offer.id,
                      "commissionReceived",
                      "تم تحديث حالة العمولة"
                    )
                  }
                  onCommissionNotDelivered={() =>
                    void runOfferAction(
                      offer.id,
                      "commissionNotDelivered",
                      "تم تسجيل بلاغ العمولة"
                    )
                  }
                  onOpenNewRequest={() =>
                    openNewRequest(
                      offer
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>

        {pendingAcceptOffer && (
          <AcceptConfirmModal
            loading={acceptLoading}
            error={acceptError}
            onCancel={() => {
              if (!acceptLoading) {
                setPendingAcceptOffer(
                  null
                );
                setAcceptError("");
              }
            }}
            onConfirm={() =>
              void confirmAcceptOffer()
            }
          />
        )}

        {acceptedOfferSuccess && (
          <AcceptSuccessModal
            customerPhone={
              acceptedOfferSuccess.customerPhone ||
              ""
            }
            onClose={closeAcceptSuccess}
            onOpenNewRequest={
              openAcceptedOfferRequest
            }
          />
        )}

        <button
          type="button"
          style={backButton}
          onClick={() =>
            router.back()
          }
        >
          رجوع
        </button>
      </div>
    </main>
  );
}

function OfferCard({
  offer,
  activeTab,
  saving,
  acceptBlocked,
  onAccept,
  onWithdraw,
  onCancel,
  onCommissionReceived,
  onCommissionNotDelivered,
  onOpenNewRequest,
}: {
  offer: DirectedOffer;
  activeTab: TabKey;
  saving: boolean;
  acceptBlocked: boolean;
  onAccept: () => void;
  onWithdraw: () => void;
  onCancel: () => void;
  onCommissionReceived: () => void;
  onCommissionNotDelivered: () => void;
  onOpenNewRequest: () => void;
}) {
  const canAccept =
    activeTab === "open" &&
    offer.status === "active" &&
    !offer.isCreator;

  const canCreateContract =
    activeTab === "accepted" &&
    offer.status === "accepted" &&
    offer.isAcceptedByCurrent;

  const canWithdraw =
    activeTab === "accepted" &&
    offer.status === "accepted" &&
    offer.isAcceptedByCurrent;

  const canCancel =
    activeTab === "sent" &&
    offer.isCreator &&
    offer.status === "active";

  const canMarkCommission =
    offer.isCreator &&
    offer.status === "paid";

  const canShowAcceptedPhone =
    offer.status === "accepted" ||
    offer.status ===
      "contract_created" ||
    offer.status === "paid";

  const timelineInfo =
    getOfferTimelineInfo(
      offer,
      activeTab
    );

  return (
    <article style={offerCard}>
      <div style={offerTopRow}>
        <span
          style={getStatusPillStyle(
            offer.status
          )}
        >
          {statusLabel(offer.status)}
        </span>
        <span style={mutedText}>
          {formatDateTime(
            offer.createdAt
          )}
        </span>
      </div>

      <h3 style={offerTitle}>
        {offer.customerName}
      </h3>

      <div style={dataGrid}>
        <Info label="نوع الطلب" value={offer.requestType} />
        <Info label="المنطقة" value={offer.city} />
        <Info
          label="المبلغ"
          value={`${formatMoney(
            offer.requestedAmount
          )} ر.س`}
        />
        <Info label="جهة العمل" value={offer.workName || "-"} />
        <Info
          label="العمولة"
          value={`${formatMoney(
            offer.commissionAmount
          )} ر.س`}
        />
        <Info
          label={timelineInfo.label}
          value={timelineInfo.value}
        />
      </div>

      {offer.customerNationalId && (
        <div style={sensitiveBox}>
          <Info
            label="رقم الهوية"
            value={
              offer.customerNationalId
            }
          />
          <Info
            label="تاريخ الميلاد"
            value={`${offer.birthHijriYear || ""}/${String(
              offer.birthHijriMonth || ""
            ).padStart(2, "0")}/${String(
              offer.birthHijriDay || ""
            ).padStart(2, "0")}`}
          />
          {canShowAcceptedPhone && (
            <Info
              label="رقم الجوال"
              value={
                offer.customerPhone ||
                "-"
              }
            />
          )}
          {canShowAcceptedPhone &&
            offer.otherUserName && (
              <Info
                label="مستخدم الطرف الآخر"
                value={
                  offer.otherUserName
                }
              />
            )}
          {canShowAcceptedPhone &&
            offer.otherUserPhone && (
              <Info
                label="رقم مستخدم الطرف الآخر"
                value={
                  offer.otherUserPhone
                }
              />
            )}
          {canShowAcceptedPhone &&
            offer.otherBranchPhone && (
              <Info
                label="رقم المنظمة الأخرى"
                value={
                  offer.otherBranchPhone
                }
              />
            )}
        </div>
      )}

      {(offer.createdByBranchName ||
        offer.acceptedByBranchName) && (
        <div style={branchLine}>
          {offer.createdByBranchName && (
            <span>
              المنشئ:{" "}
              {
                offer.createdByBranchName
              }
            </span>
          )}

          {offer.acceptedByBranchName && (
            <span>
              القابل:{" "}
              {
                offer.acceptedByBranchName
              }
            </span>
          )}
        </div>
      )}

      {offer.status === "paid" && (
        <div style={commissionLine}>
          {commissionLabel(
            offer.commissionStatus
          )}
        </div>
      )}

      <div style={actionsRow}>
        {offer.isCreator &&
          activeTab === "open" && (
            <button
              type="button"
              style={disabledButton}
              disabled
            >
              عرضك
            </button>
          )}

        {canAccept && (
          <button
            type="button"
            style={primarySmallButton}
            disabled={
              saving ||
              acceptBlocked
            }
            onClick={onAccept}
          >
            قبول العرض
          </button>
        )}

        {canAccept &&
          acceptBlocked && (
            <span style={blockedHint}>
              قبول العروض محجوب مؤقتًا
            </span>
          )}

        {canCreateContract && (
          <button
            type="button"
            style={primarySmallButton}
            disabled={saving}
            onClick={onOpenNewRequest}
          >
            تسجيل وصول العميل وإنشاء العقد
          </button>
        )}

        {canWithdraw && (
          <button
            type="button"
            style={secondarySmallButton}
            disabled={saving}
            onClick={onWithdraw}
          >
            تراجع عن القبول
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            style={dangerSmallButton}
            disabled={saving}
            onClick={onCancel}
          >
            إلغاء العرض
          </button>
        )}

        {canMarkCommission && (
          <>
            <button
              type="button"
              style={primarySmallButton}
              disabled={saving}
              onClick={
                onCommissionReceived
              }
            >
              تم استلام العمولة
            </button>
            <button
              type="button"
              style={dangerSmallButton}
              disabled={saving}
              onClick={
                onCommissionNotDelivered
              }
            >
              لم يتم تسليم العمولة
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function AcceptConfirmModal({
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  loading: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <h3 style={modalTitle}>
          هل أنت متأكد من قبول الطلب ؟
        </h3>

        {error && (
          <div style={modalError}>
            {error}
          </div>
        )}

        <div style={modalActions}>
          <button
            type="button"
            style={secondaryModalButton}
            onClick={onCancel}
            disabled={loading}
          >
            إلغاء
          </button>

          <button
            type="button"
            style={primaryModalButton}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading
              ? "جاري القبول..."
              : "موافق"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AcceptSuccessModal({
  customerPhone,
  onClose,
  onOpenNewRequest,
}: {
  customerPhone: string;
  onClose: () => void;
  onOpenNewRequest: () => void;
}) {
  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <div style={successMark}>
          ✓
        </div>

        <h3 style={modalTitle}>
          تم قبول العرض
        </h3>

        <p style={modalText}>
          نرجوا تواصلكم مع العميل على الرقم
        </p>

        <strong style={phoneValue}>
          {customerPhone || "-"}
        </strong>

        <div style={modalActions}>
          <button
            type="button"
            style={secondaryModalButton}
            onClick={onClose}
          >
            موافق
          </button>

          <button
            type="button"
            style={primaryModalButton}
            onClick={onOpenNewRequest}
          >
            تسجيل وصول العميل وإنشاء العقد
          </button>
        </div>
      </div>
    </div>
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
    <label style={field}>
      <span style={labelStyle}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Info({
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
        {value}
      </strong>
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

function getPageStyle(
  isMobile: boolean
): CSSProperties {
  return {
    minHeight: "100vh",
    backgroundColor: "#f6f9ff",
    backgroundImage:
      "radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%), radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%), radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%), linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)), url('/backgrounds/v13-finance-bg-1.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: isMobile
      ? "scroll"
      : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily:
      "var(--font-almarai), sans-serif",
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
    display: "grid",
    gap: isCompact ? 12 : 16,
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
    fontSize:
      screen === "mobile"
        ? 26
        : screen === "tablet"
          ? 28
          : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: 0,
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
    justifyContent: "center",
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

const panel: CSSProperties = {
  background:
    "linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))",
  border: "1px solid rgba(226,232,240,0.90)",
  borderRadius: 8,
  padding: 18,
  boxShadow:
    "0 18px 42px rgba(15,23,42,.08)",
  backdropFilter: "blur(10px)",
};

const sectionHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
  color: "#0f172a",
  fontSize: 17,
};

function getFormGridStyle(
  isCompact: boolean
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isCompact
      ? "1fr"
      : "repeat(4,minmax(0,1fr))",
    gap: 12,
  };
}

function getFormFooterStyle(
  isCompact: boolean
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isCompact
      ? "1fr"
      : "minmax(280px,max-content) 160px minmax(160px,max-content)",
    alignItems: "end",
    gap: 12,
  };
}

function getFilterGridStyle(
  isCompact: boolean
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isCompact
      ? "1fr"
      : "repeat(4,minmax(0,1fr))",
    gap: 12,
    marginBottom: 16,
    padding: 12,
    border: "1px solid rgba(226,232,240,0.95)",
    borderRadius: 8,
    background:
      "rgba(248,250,252,0.86)",
  };
}

function getOffersGridStyle(
  screen: ScreenType
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns:
      screen === "mobile"
        ? "1fr"
        : screen === "tablet"
          ? "repeat(2,minmax(0,1fr))"
          : "repeat(3,minmax(0,1fr))",
    gap: 14,
  };
}

const formRows: CSSProperties = {
  display: "grid",
  gap: 14,
};

const field: CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  color: "#475569",
  fontWeight: 800,
};

const input: CSSProperties = {
  width: "100%",
  height: 44,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "0 12px",
  fontFamily:
    "var(--font-almarai), sans-serif",
  fontWeight: 700,
  outline: "none",
  background: "rgba(255,255,255,0.98)",
  color: "#0f172a",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.80)",
};

const selectInput: CSSProperties = {
  ...input,
  appearance: "none",
  WebkitAppearance: "none",
  paddingLeft: 34,
  backgroundImage:
    "linear-gradient(45deg,transparent 50%,#64748b 50%), linear-gradient(135deg,#64748b 50%,transparent 50%)",
  backgroundPosition:
    "left 18px center, left 12px center",
  backgroundSize: "6px 6px, 6px 6px",
  backgroundRepeat: "no-repeat",
};

const birthDateGroup: CSSProperties = {
  display: "grid",
  gap: 6,
  justifyContent: "start",
};

const birthDateInputs: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const smallDateInput: CSSProperties = {
  ...input,
  width: 86,
  flex: "0 0 86px",
  textAlign: "center",
  padding: "0 8px",
};

const yearDateInput: CSSProperties = {
  ...input,
  width: 116,
  flex: "0 0 116px",
  textAlign: "center",
  padding: "0 8px",
};

const primaryButton: CSSProperties = {
  minHeight: 44,
  border: "none",
  borderRadius: 8,
  padding: "0 18px",
  background:
    "linear-gradient(135deg,#2563eb,#0d65d9 58%,#0754b8)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  boxShadow:
    "0 12px 22px rgba(37,99,235,0.22)",
};

const toggleCreateButton: CSSProperties = {
  ...primaryButton,
  minHeight: 38,
  padding: "0 14px",
  boxShadow:
    "0 10px 18px rgba(37,99,235,0.16)",
};

const commissionField: CSSProperties = {
  ...field,
  width: "100%",
  maxWidth: 170,
};

const commissionInput: CSSProperties = {
  ...input,
  maxWidth: 170,
};

const tabsRow: CSSProperties = {
  display: "inline-flex",
  gap: 4,
  flexWrap: "wrap",
  marginBottom: 16,
  padding: 5,
  borderRadius: 999,
  background:
    "rgba(241,245,249,0.92)",
  border: "1px solid rgba(226,232,240,0.95)",
};

const tabButton: CSSProperties = {
  border: "1px solid transparent",
  borderRadius: 999,
  padding: "10px 14px",
  background: "transparent",
  color: "#334155",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const activeTabButton: CSSProperties = {
  ...tabButton,
  borderColor: "#bfdbfe",
  background: "#ffffff",
  color: "#1d4ed8",
  boxShadow:
    "0 8px 18px rgba(37,99,235,0.10)",
};

const offerCard: CSSProperties = {
  border:
    "1px solid rgba(226,232,240,0.95)",
  borderRadius: 8,
  padding: 16,
  background:
    "linear-gradient(180deg,#ffffff,#f8fafc)",
  display: "grid",
  gap: 11,
  boxShadow:
    "0 14px 30px rgba(15,23,42,0.07)",
};

const offerTopRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const statusPill: CSSProperties = {
  borderRadius: 999,
  padding: "7px 10px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 900,
  fontSize: 12,
};

const mutedText: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const offerTitle: CSSProperties = {
  margin: 0,
  color: "#0f2f5f",
  fontSize: 19,
  lineHeight: 1.5,
};

const dataGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",
  gap: 9,
};

const infoItem: CSSProperties = {
  display: "grid",
  gap: 3,
  padding: 9,
  borderRadius: 8,
  background:
    "rgba(241,245,249,0.82)",
};

const infoLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const infoValue: CSSProperties = {
  color: "#0f2f5f",
  fontSize: 13,
  lineHeight: 1.45,
};

const sensitiveBox: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",
  gap: 8,
  padding: 10,
  border: "1px solid #bae6fd",
  borderRadius: 8,
  background: "#f0f9ff",
};

const branchLine: CSSProperties = {
  display: "grid",
  gap: 5,
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
};

const commissionLine: CSSProperties = {
  padding: 10,
  borderRadius: 8,
  background: "#fef3c7",
  color: "#92400e",
  fontWeight: 900,
};

const actionsRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const primarySmallButton: CSSProperties = {
  border: "none",
  borderRadius: 8,
  padding: "10px 12px",
  background:
    "linear-gradient(135deg,#2563eb,#0d65d9)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const secondarySmallButton: CSSProperties = {
  ...primarySmallButton,
  background:
    "linear-gradient(135deg,#0ea5e9,#0284c7)",
};

const dangerSmallButton: CSSProperties = {
  ...primarySmallButton,
  background: "#dc2626",
};

const disabledButton: CSSProperties = {
  ...primarySmallButton,
  background: "#cbd5e1",
  color: "#475569",
  cursor: "not-allowed",
};

const emptyBox: CSSProperties = {
  padding: 18,
  borderRadius: 8,
  background: "#f8fafc",
  textAlign: "center",
  color: "#475569",
  fontWeight: 800,
};

const successBox: CSSProperties = {
  padding: 12,
  borderRadius: 8,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
};

const warningBox: CSSProperties = {
  padding: 12,
  borderRadius: 8,
  background: "#fef2f2",
  color: "#991b1b",
  fontWeight: 900,
};

const backButton: CSSProperties = {
  border: "none",
  borderRadius: 8,
  padding: "13px 18px",
  background:
    "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  justifySelf: "start",
};

const blockedHint: CSSProperties = {
  color: "#991b1b",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 12,
  fontWeight: 900,
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background:
    "rgba(15,23,42,0.38)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalCard: CSSProperties = {
  width: "min(100%, 430px)",
  borderRadius: 12,
  border:
    "1px solid rgba(226,232,240,0.96)",
  background: "#ffffff",
  boxShadow:
    "0 24px 60px rgba(15,23,42,0.24)",
  padding: 22,
  display: "grid",
  gap: 16,
  textAlign: "center",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const modalTitle: CSSProperties = {
  margin: 0,
  color: "#0f2f5f",
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.6,
};

const modalText: CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.8,
};

const modalError: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  background: "#fef2f2",
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 900,
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 10,
  flexWrap: "wrap",
};

const primaryModalButton: CSSProperties = {
  border: "none",
  borderRadius: 8,
  padding: "11px 16px",
  background:
    "linear-gradient(135deg,#2563eb,#0d65d9)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const secondaryModalButton: CSSProperties = {
  ...primaryModalButton,
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #cbd5e1",
};

const successMark: CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: "50%",
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#dcfce7",
  color: "#15803d",
  fontSize: 34,
  fontWeight: 900,
};

const phoneValue: CSSProperties = {
  color: "#0f2f5f",
  fontSize: 21,
  fontWeight: 900,
  direction: "ltr",
};
