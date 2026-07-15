"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  FormEvent,
  ReactNode,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { clearFinanceSession } from "@/lib/financeSession";

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type ListingType =
  | "offered"
  | "wanted";

type CityCode =
  | "riyadh"
  | "makkah"
  | "madinah"
  | "qassim"
  | "eastern_region"
  | "asir"
  | "tabuk"
  | "hail"
  | "northern_borders"
  | "jazan"
  | "najran"
  | "al_baha"
  | "al_jouf";

type CardStoreListing = {
  id: string;
  listing_type: ListingType;
  product_id: string;
  product_name_snapshot: string;
  city_code: CityCode;
  quantity: number;
  total_price: number | string;
  unit_price: number | string;
  contact_phone: string;
  published_at: string;
  expires_at: string;
  card_expiry_month: number | null;
  card_expiry_year: number | null;
  branch_name: string | null;
  can_edit: boolean;
  can_delete: boolean;
  can_complete: boolean;
};

type CardStoreProduct = {
  id: string;
  name: string;
};

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

type ListingsResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  items?: unknown;
  pagination?: unknown;
};

type ProductsResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  items?: unknown;
};

type CreateListingResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  item?: unknown;
};

type ListingActionResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  item?: unknown;
};

type FormState = {
  listingType: ListingType;
  productId: string;
  cityCode: "" | CityCode;
  quantity: string;
  totalPrice: string;
  contactPhone: string;
  cardExpiryMonth: string;
  cardExpiryYear: string;
};

type FieldErrors = Partial<
  Record<keyof FormState, string>
>;

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

const TABS: Array<{
  key: ListingType;
  label: string;
}> = [
  {
    key: "offered",
    label: "بطاقات معروضة",
  },
  {
    key: "wanted",
    label: "بطاقات مطلوبة",
  },
];

const CITIES: Array<{
  code: CityCode;
  label: string;
}> = [
  {
    code: "riyadh",
    label: "الرياض",
  },
  {
    code: "makkah",
    label: "مكة المكرمة",
  },
  {
    code: "madinah",
    label: "المدينة المنورة",
  },
  {
    code: "qassim",
    label: "القصيم",
  },
  {
    code: "eastern_region",
    label: "المنطقة الشرقية",
  },
  {
    code: "asir",
    label: "عسير",
  },
  {
    code: "tabuk",
    label: "تبوك",
  },
  {
    code: "hail",
    label: "حائل",
  },
  {
    code: "northern_borders",
    label: "الحدود الشمالية",
  },
  {
    code: "jazan",
    label: "جازان",
  },
  {
    code: "najran",
    label: "نجران",
  },
  {
    code: "al_baha",
    label: "الباحة",
  },
  {
    code: "al_jouf",
    label: "الجوف",
  },
];

const CITY_LABELS = new Map(
  CITIES.map((city) => [
    city.code,
    city.label,
  ])
);

const CITY_CODES = new Set(
  CITIES.map((city) => city.code)
);

const emptyPagination: PaginationState = {
  page: 1,
  pageSize: 15,
  total: 0,
  totalPages: 0,
  hasPrevious: false,
  hasNext: false,
};

function createEmptyForm(
  listingType: ListingType
): FormState {
  return {
    listingType,
    productId: "",
    cityCode: "",
    quantity: "",
    totalPrice: "",
    contactPhone: "",
    cardExpiryMonth: "",
    cardExpiryYear: "",
  };
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeDigits(
  value: string
): string {
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

function digitsOnly(
  value: string
): string {
  return normalizeDigits(value).replace(
    /[^0-9]/g,
    ""
  );
}

function isListingType(
  value: unknown
): value is ListingType {
  return (
    value === "offered" ||
    value === "wanted"
  );
}

function isCityCode(
  value: unknown
): value is CityCode {
  return (
    typeof value === "string" &&
    CITY_CODES.has(value as CityCode)
  );
}

function getSafeMessage(
  payload: unknown,
  fallback: string
): string {
  if (
    isPlainObject(payload) &&
    typeof payload.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message.trim();
  }

  return fallback;
}

function parsePositiveInteger(
  value: string
): number | null {
  if (!/^[1-9][0-9]*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

function parseCardExpiryMonth(
  value: string
): number | null {
  if (!/^[0-9]{1,2}$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) &&
    parsed >= 1 &&
    parsed <= 12
    ? parsed
    : null;
}

function parseCardExpiryYear(
  value: string
): number | null {
  if (!/^[0-9]{4}$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) &&
    parsed >= 2000 &&
    parsed <= 9999
    ? parsed
    : null;
}

function normalizeListingExpiryPart(
  value: unknown,
  min: number,
  max: number
): number | null {
  const numeric = Number(value);

  return Number.isSafeInteger(numeric) &&
    numeric >= min &&
    numeric <= max
    ? numeric
    : null;
}

function formatCardExpiry(
  month: number | null,
  year: number | null
): string {
  if (month === null || year === null) {
    return "غير محدد";
  }

  return `${String(month).padStart(2, "0")}/${String(year).padStart(4, "0")}`;
}

function parsePagination(
  value: unknown
): PaginationState | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const page = Number(value.page);
  const pageSize = Number(value.pageSize);
  const total = Number(value.total);
  const totalPages = Number(
    value.totalPages
  );

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Number.isSafeInteger(totalPages) ||
    totalPages < 0 ||
    typeof value.hasPrevious !==
      "boolean" ||
    typeof value.hasNext !== "boolean"
  ) {
    return null;
  }

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevious: value.hasPrevious,
    hasNext: value.hasNext,
  };
}

function normalizeListing(
  value: unknown
): CardStoreListing | null {
  if (!isPlainObject(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    !isListingType(value.listing_type) ||
    typeof value.product_id !== "string" ||
    typeof value.product_name_snapshot !==
      "string" ||
    !isCityCode(value.city_code) ||
    typeof value.quantity !== "number" ||
    (typeof value.total_price !== "number" &&
      typeof value.total_price !==
        "string") ||
    (typeof value.unit_price !== "number" &&
      typeof value.unit_price !==
        "string") ||
    typeof value.contact_phone !==
      "string" ||
    typeof value.published_at !==
      "string" ||
    typeof value.expires_at !== "string" ||
    (value.branch_name !== null &&
      typeof value.branch_name !== "string")
  ) {
    return null;
  }

  return {
    id: value.id,
    listing_type: value.listing_type,
    product_id: value.product_id,
    product_name_snapshot:
      value.product_name_snapshot,
    city_code: value.city_code,
    quantity: value.quantity,
    total_price: value.total_price,
    unit_price: value.unit_price,
    contact_phone: value.contact_phone,
    published_at: value.published_at,
    expires_at: value.expires_at,
    card_expiry_month:
      normalizeListingExpiryPart(
        value.card_expiry_month,
        1,
        12
      ),
    card_expiry_year:
      normalizeListingExpiryPart(
        value.card_expiry_year,
        2000,
        9999
      ),
    branch_name: value.branch_name,
    can_edit: value.can_edit === true,
    can_delete: value.can_delete === true,
    can_complete:
      value.can_complete === true,
  };
}

function isProduct(
  value: unknown
): value is CardStoreProduct {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    value.id.trim().length > 0 &&
    value.name.trim().length > 0
  );
}

async function readJson(
  response: Response
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatNumber(
  value: number | string
): string {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return String(value || "-");
  }

  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function formatCurrency(
  value: number | string
): string {
  return `${formatNumber(value)} ريال`;
}

function formatDateTime(
  value: string
): string {
  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "-";
  }

  const year = String(
    date.getFullYear()
  );
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");
  const hour = String(
    date.getHours()
  ).padStart(2, "0");
  const minute = String(
    date.getMinutes()
  ).padStart(2, "0");

  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function getListingTypeLabel(
  listingType: ListingType
): string {
  return listingType === "offered"
    ? "عرض"
    : "طلب";
}

function getEmptyText(
  listingType: ListingType
): string {
  return listingType === "offered"
    ? "لا توجد بطاقات معروضة حاليًا"
    : "لا توجد بطاقات مطلوبة حاليًا";
}

export default function FinanceCardStorePage() {
  const params = useParams();
  const router = useRouter();

  const branch = useMemo(
    () =>
      String(params.branch || "")
        .trim()
        .toLowerCase(),
    [params.branch]
  );

  const [screen, setScreen] =
    useState<ScreenType>("desktop");
  const [activeTab, setActiveTab] =
    useState<ListingType>("offered");
  const [selectedCity, setSelectedCity] =
    useState<"" | CityCode>("");
  const [page, setPage] = useState(1);
  const [listings, setListings] =
    useState<CardStoreListing[]>([]);
  const [pagination, setPagination] =
    useState<PaginationState>(
      emptyPagination
    );
  const [listingsLoading, setListingsLoading] =
    useState(true);
  const [listingsError, setListingsError] =
    useState("");
  const [message, setMessage] =
    useState<MessageState>(null);
  const [loggingOut, setLoggingOut] =
    useState(false);
  const [modalOpen, setModalOpen] =
    useState(false);
  const [form, setForm] =
    useState<FormState>(() =>
      createEmptyForm("offered")
    );
  const [fieldErrors, setFieldErrors] =
    useState<FieldErrors>({});
  const [submitError, setSubmitError] =
    useState("");
  const [submitting, setSubmitting] =
    useState(false);
  const [editModalOpen, setEditModalOpen] =
    useState(false);
  const [editingListing, setEditingListing] =
    useState<CardStoreListing | null>(
      null
    );
  const [editForm, setEditForm] =
    useState<FormState>(() =>
      createEmptyForm("offered")
    );
  const [
    editFieldErrors,
    setEditFieldErrors,
  ] = useState<FieldErrors>({});
  const [editSubmitError, setEditSubmitError] =
    useState("");
  const [confirmAction, setConfirmAction] =
    useState<"delete" | "complete" | null>(
      null
    );
  const [
    confirmListing,
    setConfirmListing,
  ] =
    useState<CardStoreListing | null>(null);
  const [actionListingId, setActionListingId] =
    useState<string | null>(null);
  const [actionType, setActionType] =
    useState<
      "edit" | "delete" | "complete" | null
    >(null);
  const [actionError, setActionError] =
    useState("");
  const [products, setProducts] =
    useState<CardStoreProduct[]>([]);
  const [productsLoading, setProductsLoading] =
    useState(false);
  const [productsLoaded, setProductsLoaded] =
    useState(false);
  const [productsError, setProductsError] =
    useState("");
  const [refreshKey, setRefreshKey] =
    useState(0);

  const listingsAbortRef =
    useRef<AbortController | null>(
      null
    );
  const listingsRequestSeqRef =
    useRef(0);
  const productsAbortRef =
    useRef<AbortController | null>(
      null
    );
  const productsRequestSeqRef =
    useRef(0);
  const submitAbortRef =
    useRef<AbortController | null>(
      null
    );
  const actionAbortRef =
    useRef<AbortController | null>(
      null
    );
  const sessionRedirectStartedRef =
    useRef(false);
  const resultsRef =
    useRef<HTMLDivElement | null>(null);

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

  const handleSessionIssue =
    useCallback(
      (status: number) => {
        if (status === 401) {
          if (
            sessionRedirectStartedRef.current
          ) {
            return;
          }

          sessionRedirectStartedRef.current =
            true;

          listingsAbortRef.current?.abort();
          productsAbortRef.current?.abort();
          submitAbortRef.current?.abort();
          actionAbortRef.current?.abort();
          clearFinanceSession();

          const returnTo =
            `/finance/${branch}/card-store`;

          window.location.replace(
            `/login?returnTo=${encodeURIComponent(
              returnTo
            )}`
          );
          return;
        }

        if (status === 403) {
          setListingsError(
            "لا تملك صلاحية الدخول إلى متجر البطاقات"
          );
        }
      },
      [branch]
    );

  const loadListings = useCallback(
    async (targetPage: number) => {
      if (!branch) {
        setListings([]);
        setPagination(emptyPagination);
        setListingsError(
          "مسار الفرع غير صحيح"
        );
        setListingsLoading(false);
        return;
      }

      listingsAbortRef.current?.abort();

      const controller =
        new AbortController();
      const requestSeq =
        listingsRequestSeqRef.current + 1;

      listingsRequestSeqRef.current =
        requestSeq;
      listingsAbortRef.current =
        controller;

      setListings([]);
      setPagination({
        ...emptyPagination,
        page: targetPage,
      });
      setListingsError("");
      setListingsLoading(true);

      const params = new URLSearchParams({
        listing_type: activeTab,
        page: String(targetPage),
      });

      if (selectedCity) {
        params.set(
          "city_code",
          selectedCity
        );
      }

      try {
        const response = await fetch(
          `/finance/api/card-store/listings?${params.toString()}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
            signal:
              controller.signal,
          }
        );

        const payload =
          (await readJson(
            response
          )) as ListingsResponse;

        if (
          controller.signal.aborted ||
          listingsRequestSeqRef.current !==
            requestSeq
        ) {
          return;
        }

        if (response.status === 401) {
          handleSessionIssue(401);
          return;
        }

        if (response.status === 403) {
          handleSessionIssue(403);
        }

        if (
          !response.ok ||
          !isPlainObject(payload) ||
          payload.ok !== true
        ) {
          setListings([]);
          setPagination({
            ...emptyPagination,
            page: targetPage,
          });
          setListingsError(
            getSafeMessage(
              payload,
              "تعذر تحميل عروض متجر البطاقات"
            )
          );
          return;
        }

        if (
          !Array.isArray(payload.items)
        ) {
          setListings([]);
          setPagination({
            ...emptyPagination,
            page: targetPage,
          });
          setListingsError(
            "تعذر تحميل عروض متجر البطاقات"
          );
          return;
        }

        const nextPagination =
          parsePagination(
            payload.pagination
          );

        if (!nextPagination) {
          setListings([]);
          setPagination({
            ...emptyPagination,
            page: targetPage,
          });
          setListingsError(
            "تعذر تحميل عروض متجر البطاقات"
          );
          return;
        }

        const nextListings =
          payload.items.map(
            normalizeListing
          );

        if (
          nextListings.some(
            (item) => item === null
          )
        ) {
          setListings([]);
          setPagination({
            ...emptyPagination,
            page: targetPage,
          });
          setListingsError(
            "تعذر تحميل عروض متجر البطاقات"
          );
          return;
        }

        setListings(
          nextListings as CardStoreListing[]
        );
        setPagination(nextPagination);
      } catch {
        if (
          controller.signal.aborted ||
          listingsRequestSeqRef.current !==
            requestSeq
        ) {
          return;
        }

        setListings([]);
        setPagination({
          ...emptyPagination,
          page: targetPage,
        });
        setListingsError(
          "تعذر الاتصال بخدمة متجر البطاقات"
        );
      } finally {
        if (
          !controller.signal.aborted &&
          listingsRequestSeqRef.current ===
            requestSeq
        ) {
          setListingsLoading(false);
        }
      }
    },
    [
      activeTab,
      branch,
      handleSessionIssue,
      selectedCity,
    ]
  );

  useEffect(() => {
    void loadListings(page);

    return () => {
      listingsAbortRef.current?.abort();
    };
  }, [
    activeTab,
    loadListings,
    page,
    refreshKey,
    selectedCity,
  ]);

  const anyModalOpen =
    modalOpen ||
    editModalOpen ||
    confirmAction !== null;

  useEffect(() => {
    if (!anyModalOpen) {
      return;
    }

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [anyModalOpen]);

  useEffect(() => {
    return () => {
      listingsAbortRef.current?.abort();
      productsAbortRef.current?.abort();
      submitAbortRef.current?.abort();
      actionAbortRef.current?.abort();
    };
  }, []);

  const loadProducts = useCallback(
    async () => {
      productsAbortRef.current?.abort();

      const controller =
        new AbortController();
      const requestSeq =
        productsRequestSeqRef.current + 1;

      productsRequestSeqRef.current =
        requestSeq;
      productsAbortRef.current =
        controller;

      setProducts([]);
      setProductsError("");
      setProductsLoading(true);

      try {
        const response = await fetch(
          "/finance/api/card-store/products",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
            signal:
              controller.signal,
          }
        );

        const payload =
          (await readJson(
            response
          )) as ProductsResponse;

        if (
          controller.signal.aborted ||
          productsRequestSeqRef.current !==
            requestSeq
        ) {
          return;
        }

        if (response.status === 401) {
          handleSessionIssue(401);
          return;
        }

        if (response.status === 403) {
          handleSessionIssue(403);
        }

        if (
          !response.ok ||
          !isPlainObject(payload) ||
          payload.ok !== true ||
          !Array.isArray(payload.items)
        ) {
          setProductsError(
            getSafeMessage(
              payload,
              "تعذر تحميل منتجات متجر البطاقات"
            )
          );
          setProducts([]);
          return;
        }

        const nextProducts =
          payload.items.filter(
            isProduct
          );

        if (
          nextProducts.length !==
          payload.items.length
        ) {
          setProductsError(
            "تعذر تحميل منتجات متجر البطاقات"
          );
          setProducts([]);
          return;
        }

        setProducts(nextProducts);
        setProductsLoaded(true);
      } catch {
        if (
          controller.signal.aborted ||
          productsRequestSeqRef.current !==
            requestSeq
        ) {
          return;
        }

        setProducts([]);
        setProductsError(
          "تعذر الاتصال بخدمة المنتجات"
        );
      } finally {
        if (
          !controller.signal.aborted &&
          productsRequestSeqRef.current ===
            requestSeq
        ) {
          setProductsLoading(false);
        }
      }
    },
    [handleSessionIssue]
  );

  useEffect(() => {
    if (
      (!modalOpen && !editModalOpen) ||
      productsLoaded
    ) {
      return;
    }

    void loadProducts();
  }, [
    loadProducts,
    editModalOpen,
    modalOpen,
    productsLoaded,
  ]);

  function switchTab(
    tab: ListingType
  ) {
    if (tab === activeTab) {
      return;
    }

    setActiveTab(tab);
    setPage(1);
    setListings([]);
    setListingsError("");
    setMessage(null);
  }

  function changeCity(
    value: string
  ) {
    const nextCity =
      value === ""
        ? ""
        : isCityCode(value)
          ? value
          : "";

    setSelectedCity(nextCity);
    setPage(1);
    setListings([]);
    setListingsError("");
  }

  function changePage(
    nextPage: number
  ) {
    const safePage = Math.max(
      1,
      pagination.totalPages > 0
        ? Math.min(
            nextPage,
            pagination.totalPages
          )
        : 1
    );

    if (safePage === page) {
      return;
    }

    setPage(safePage);
    setListings([]);
    setListingsError("");
    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function openModal() {
    setForm(
      createEmptyForm(activeTab)
    );
    setFieldErrors({});
    setSubmitError("");
    setModalOpen(true);
  }

  async function logout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await fetch(
        "/finance/api/branch-logout",
        {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );
    } catch {
      // الخروج لا يعرض تفاصيل تقنية للمستخدم.
    } finally {
      router.replace("/login");
      setLoggingOut(false);
    }
  }

  function closeModal() {
    if (submitting) {
      return;
    }

    setModalOpen(false);
    setFieldErrors({});
    setSubmitError("");
    setForm(
      createEmptyForm(activeTab)
    );
  }

  function openEditModal(
    listing: CardStoreListing
  ) {
    if (actionListingId) {
      return;
    }

    setEditingListing(listing);
    setEditForm({
      listingType:
        listing.listing_type,
      productId: listing.product_id,
      cityCode: listing.city_code,
      quantity: String(
        listing.quantity
      ),
      totalPrice: String(
        Math.trunc(
          Number(listing.total_price)
        )
      ),
      contactPhone:
        listing.contact_phone,
      cardExpiryMonth:
        listing.card_expiry_month === null
          ? ""
          : String(
              listing.card_expiry_month
            ).padStart(2, "0"),
      cardExpiryYear:
        listing.card_expiry_year === null
          ? ""
          : String(
              listing.card_expiry_year
            ),
    });
    setEditFieldErrors({});
    setEditSubmitError("");
    setActionError("");
    setEditModalOpen(true);
  }

  function closeEditModal() {
    if (actionType === "edit") {
      return;
    }

    setEditModalOpen(false);
    setEditingListing(null);
    setEditFieldErrors({});
    setEditSubmitError("");
    setEditForm(
      createEmptyForm(activeTab)
    );
  }

  function updateFormField(
    field: keyof FormState,
    value: string
  ) {
    const nextValue =
      field === "quantity" ||
      field === "totalPrice" ||
      field === "contactPhone" ||
      field === "cardExpiryMonth" ||
      field === "cardExpiryYear"
        ? digitsOnly(value)
        : value;

    const limitedValue =
      field === "cardExpiryMonth"
        ? nextValue.slice(0, 2)
        : field === "cardExpiryYear"
          ? nextValue.slice(0, 4)
          : nextValue;

    setForm((current) => ({
      ...current,
      [field]: limitedValue,
    }));

    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setSubmitError("");
  }

  function updateEditFormField(
    field: keyof FormState,
    value: string
  ) {
    const nextValue =
      field === "quantity" ||
      field === "totalPrice" ||
      field === "contactPhone" ||
      field === "cardExpiryMonth" ||
      field === "cardExpiryYear"
        ? digitsOnly(value)
        : value;

    const limitedValue =
      field === "cardExpiryMonth"
        ? nextValue.slice(0, 2)
        : field === "cardExpiryYear"
          ? nextValue.slice(0, 4)
          : nextValue;

    setEditForm((current) => ({
      ...current,
      [field]: limitedValue,
    }));

    setEditFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setEditSubmitError("");
  }

  function validateForm() {
    const nextErrors: FieldErrors = {};

    if (
      !isListingType(
        form.listingType
      )
    ) {
      nextErrors.listingType =
        "نوع العرض مطلوب";
    }

    if (!form.productId) {
      nextErrors.productId =
        "اختر المنتج";
    }

    if (!form.cityCode) {
      nextErrors.cityCode =
        "اختر المدينة";
    }

    const quantity =
      parsePositiveInteger(
        form.quantity
      );

    if (quantity === null) {
      nextErrors.quantity =
        "الكمية يجب أن تكون عددًا صحيحًا موجبًا";
    }

    const totalPrice =
      parsePositiveInteger(
        form.totalPrice
      );

    if (totalPrice === null) {
      nextErrors.totalPrice =
        "السعر الإجمالي يجب أن يكون عددًا صحيحًا موجبًا";
    }

    if (
      !/^05[0-9]{8}$/.test(
        form.contactPhone
      )
    ) {
      nextErrors.contactPhone =
        "رقم التواصل يجب أن يكون بصيغة 05xxxxxxxx";
    }

    const cardExpiryMonth =
      parseCardExpiryMonth(
        form.cardExpiryMonth
      );
    const cardExpiryYear =
      parseCardExpiryYear(
        form.cardExpiryYear
      );

    if (
      cardExpiryMonth === null ||
      cardExpiryYear === null
    ) {
      nextErrors.cardExpiryMonth =
        "أدخل شهرًا من 1 إلى 12 وسنة من 4 أرقام";
      nextErrors.cardExpiryYear =
        "أدخل شهرًا من 1 إلى 12 وسنة من 4 أرقام";
    }

    setFieldErrors(nextErrors);

    if (
      Object.keys(nextErrors).length >
      0
    ) {
      return null;
    }

    return {
      listing_type:
        form.listingType,
      product_id:
        form.productId,
      city_code:
        form.cityCode as CityCode,
      quantity: quantity as number,
      total_price:
        totalPrice as number,
      contact_phone:
        form.contactPhone,
      card_expiry_month:
        cardExpiryMonth as number,
      card_expiry_year:
        cardExpiryYear as number,
    };
  }

  function validateEditForm() {
    const nextErrors: FieldErrors = {};

    if (
      !isListingType(
        editForm.listingType
      )
    ) {
      nextErrors.listingType =
        "نوع العرض مطلوب";
    }

    if (!editForm.productId) {
      nextErrors.productId =
        "اختر المنتج";
    } else if (
      !products.some(
        (product) =>
          product.id ===
          editForm.productId
      )
    ) {
      nextErrors.productId =
        "المنتج الحالي غير متاح، اختر منتجًا متاحًا";
    }

    if (!editForm.cityCode) {
      nextErrors.cityCode =
        "اختر المدينة";
    }

    const quantity =
      parsePositiveInteger(
        editForm.quantity
      );

    if (quantity === null) {
      nextErrors.quantity =
        "الكمية يجب أن تكون عددًا صحيحًا موجبًا";
    }

    const totalPrice =
      parsePositiveInteger(
        editForm.totalPrice
      );

    if (totalPrice === null) {
      nextErrors.totalPrice =
        "السعر الإجمالي يجب أن يكون عددًا صحيحًا موجبًا";
    }

    if (
      !/^05[0-9]{8}$/.test(
        editForm.contactPhone
      )
    ) {
      nextErrors.contactPhone =
        "رقم التواصل يجب أن يكون بصيغة 05xxxxxxxx";
    }

    const cardExpiryMonth =
      parseCardExpiryMonth(
        editForm.cardExpiryMonth
      );
    const cardExpiryYear =
      parseCardExpiryYear(
        editForm.cardExpiryYear
      );

    if (
      cardExpiryMonth === null ||
      cardExpiryYear === null
    ) {
      nextErrors.cardExpiryMonth =
        "أدخل شهرًا من 1 إلى 12 وسنة من 4 أرقام";
      nextErrors.cardExpiryYear =
        "أدخل شهرًا من 1 إلى 12 وسنة من 4 أرقام";
    }

    setEditFieldErrors(nextErrors);

    if (
      Object.keys(nextErrors).length >
      0
    ) {
      return null;
    }

    return {
      listing_type:
        editForm.listingType,
      product_id:
        editForm.productId,
      city_code:
        editForm.cityCode as CityCode,
      quantity: quantity as number,
      total_price:
        totalPrice as number,
      contact_phone:
        editForm.contactPhone,
      card_expiry_month:
        cardExpiryMonth as number,
      card_expiry_year:
        cardExpiryYear as number,
    };
  }

  async function submitListing(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submitting ||
      productsLoading ||
      products.length === 0
    ) {
      return;
    }

    const body = validateForm();

    if (!body) {
      return;
    }

    submitAbortRef.current?.abort();

    const controller =
      new AbortController();
    submitAbortRef.current =
      controller;

    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch(
        "/finance/api/card-store/listings",
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
          signal:
            controller.signal,
        }
      );

      const payload =
        (await readJson(
          response
        )) as CreateListingResponse;

      if (controller.signal.aborted) {
        return;
      }

      if (response.status === 401) {
        handleSessionIssue(401);
        return;
      }

      if (response.status === 403) {
        handleSessionIssue(403);
      }

      if (
        !response.ok ||
        !isPlainObject(payload) ||
        payload.ok !== true
      ) {
        const fallback =
          response.status === 409
            ? "لديك عرض فعال حاليًا في متجر البطاقات"
            : "تعذر إضافة العرض";

        setSubmitError(
          getSafeMessage(
            payload,
            fallback
          )
        );
        return;
      }

      setModalOpen(false);
      setForm(
        createEmptyForm(activeTab)
      );
      setFieldErrors({});
      setSubmitError("");
      setMessage({
        type: "success",
        text: "تمت إضافة العرض بنجاح",
      });
      setActiveTab(body.listing_type);
      setPage(1);
      setListings([]);
      setListingsError("");
      setRefreshKey(
        (current) => current + 1
      );
    } catch {
      if (
        controller.signal.aborted
      ) {
        return;
      }

      setSubmitError(
        "تعذر الاتصال بخدمة متجر البطاقات"
      );
    } finally {
      if (
        !controller.signal.aborted
      ) {
        setSubmitting(false);
      }
    }
  }

  function openConfirmModal(
    type: "delete" | "complete",
    listing: CardStoreListing
  ) {
    if (actionListingId) {
      return;
    }

    setConfirmAction(type);
    setConfirmListing(listing);
    setActionError("");
  }

  function closeConfirmModal() {
    if (actionType === "delete" || actionType === "complete") {
      return;
    }

    setConfirmAction(null);
    setConfirmListing(null);
    setActionError("");
  }

  function refreshAfterRemovingListing() {
    setListings([]);
    setListingsError("");

    if (listings.length === 1 && page > 1) {
      setPage(page - 1);
      return;
    }

    setRefreshKey(
      (current) => current + 1
    );
  }

  async function submitEditListing(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !editingListing ||
      actionListingId ||
      productsLoading ||
      products.length === 0
    ) {
      return;
    }

    const body = validateEditForm();

    if (!body) {
      return;
    }

    actionAbortRef.current?.abort();

    const controller =
      new AbortController();
    actionAbortRef.current =
      controller;

    setActionListingId(
      editingListing.id
    );
    setActionType("edit");
    setEditSubmitError("");

    try {
      const response = await fetch(
        `/finance/api/card-store/listings/${editingListing.id}`,
        {
          method: "PATCH",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
          signal:
            controller.signal,
        }
      );

      const payload =
        (await readJson(
          response
        )) as ListingActionResponse;

      if (controller.signal.aborted) {
        return;
      }

      if (response.status === 401) {
        handleSessionIssue(401);
        return;
      }

      if (response.status === 403) {
        handleSessionIssue(403);
      }

      if (
        !response.ok ||
        !isPlainObject(payload) ||
        payload.ok !== true
      ) {
        setEditSubmitError(
          getSafeMessage(
            payload,
            "تعذر تعديل العرض"
          )
        );
        return;
      }

      setEditModalOpen(false);
      setEditingListing(null);
      setEditFieldErrors({});
      setEditSubmitError("");
      setMessage({
        type: "success",
        text: "تم تعديل العرض بنجاح",
      });
      setListings([]);
      setListingsError("");
      setRefreshKey(
        (current) => current + 1
      );
    } catch {
      if (
        controller.signal.aborted
      ) {
        return;
      }

      setEditSubmitError(
        "تعذر الاتصال بخدمة متجر البطاقات"
      );
    } finally {
      if (
        !controller.signal.aborted
      ) {
        setActionListingId(null);
        setActionType(null);
      }
    }
  }

  async function runConfirmAction() {
    if (
      !confirmListing ||
      !confirmAction ||
      actionListingId
    ) {
      return;
    }

    actionAbortRef.current?.abort();

    const controller =
      new AbortController();
    actionAbortRef.current =
      controller;

    setActionListingId(
      confirmListing.id
    );
    setActionType(confirmAction);
    setActionError("");

    const endpoint =
      confirmAction === "complete"
        ? `/finance/api/card-store/listings/${confirmListing.id}/complete`
        : `/finance/api/card-store/listings/${confirmListing.id}`;
    const method =
      confirmAction === "complete"
        ? "POST"
        : "DELETE";

    try {
      const response = await fetch(
        endpoint,
        {
          method,
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal:
            controller.signal,
        }
      );

      const payload =
        (await readJson(
          response
        )) as ListingActionResponse;

      if (controller.signal.aborted) {
        return;
      }

      if (response.status === 401) {
        handleSessionIssue(401);
        return;
      }

      if (response.status === 403) {
        handleSessionIssue(403);
      }

      if (
        !response.ok ||
        !isPlainObject(payload) ||
        payload.ok !== true
      ) {
        setActionError(
          getSafeMessage(
            payload,
            confirmAction === "complete"
              ? "تعذر تسجيل الصفقة"
              : "تعذر حذف العرض"
          )
        );
        return;
      }

      const successText =
        confirmAction === "complete"
          ? "تم تسجيل الصفقة بنجاح"
          : "تم حذف العرض بنجاح";

      setConfirmAction(null);
      setConfirmListing(null);
      setActionError("");
      setMessage({
        type: "success",
        text: successText,
      });
      refreshAfterRemovingListing();
    } catch {
      if (
        controller.signal.aborted
      ) {
        return;
      }

      setActionError(
        confirmAction === "complete"
          ? "تعذر الاتصال بخدمة تسجيل الصفقة"
          : "تعذر الاتصال بخدمة حذف العرض"
      );
    } finally {
      if (
        !controller.signal.aborted
      ) {
        setActionListingId(null);
        setActionType(null);
      }
    }
  }

  const canSubmit =
    !submitting &&
    !productsLoading &&
    products.length > 0;
  const canSubmitEdit =
    !actionListingId &&
    !productsLoading &&
    products.length > 0;

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
                  الموظف
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
                  onClick={() =>
                    void logout()
                  }
                  disabled={loggingOut}
                >
                  <LogoutIcon />
                  <span>
                    {loggingOut
                      ? "جاري الخروج..."
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
                متجر البطاقات
              </h1>
            </div>

            <div
              style={getHeroActionBoxStyle(
                screen
              )}
            >
              <button
                type="button"
                style={primaryHeroButton}
                onClick={openModal}
              >
                <PlusIcon />
                <span>إضافة عرض</span>
              </button>
            </div>
          </div>
        </header>

        {message && (
          <section
            role={
              message.type === "error"
                ? "alert"
                : "status"
            }
            style={{
              ...messageBox,
              ...(message.type ===
              "error"
                ? errorMessageBox
                : successMessageBox),
            }}
          >
            {message.text}
          </section>
        )}

        <section style={toolbarPanel}>
          <div
            style={tabsBox}
            role="tablist"
            aria-label="تصنيف عروض متجر البطاقات"
          >
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={
                  activeTab === tab.key
                }
                style={
                  activeTab === tab.key
                    ? activeTabButton
                    : tabButton
                }
                onClick={() =>
                  switchTab(tab.key)
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={filterBox}>
            <label
              htmlFor="card-store-city-filter"
              style={label}
            >
              المدينة
            </label>

            <div style={selectWrapper}>
              <select
                id="card-store-city-filter"
                style={select}
                value={selectedCity}
                onChange={(event) =>
                  changeCity(
                    event.target.value
                  )
                }
              >
                <option value="">
                  جميع المدن
                </option>
                {CITIES.map((city) => (
                  <option
                    key={city.code}
                    value={city.code}
                  >
                    {city.label}
                  </option>
                ))}
              </select>
              <span
                style={selectArrow}
                aria-hidden="true"
              >
                <ChevronDownIcon />
              </span>
            </div>
          </div>
        </section>

        <section
          ref={resultsRef}
          style={resultsPanel}
        >
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>
                {activeTab === "offered"
                  ? "البطاقات المعروضة"
                  : "البطاقات المطلوبة"}
              </h2>
              <p style={sectionHint}>
                صفحة{" "}
                {formatNumber(
                  pagination.page
                )}{" "}
                من{" "}
                {formatNumber(
                  pagination.totalPages || 1
                )}
              </p>
            </div>

            <button
              type="button"
              style={addButton}
              onClick={openModal}
            >
              <PlusIcon />
              <span>إضافة عرض</span>
            </button>
          </div>

          {listingsLoading ? (
            <div style={cardsGrid}>
              {Array.from({
                length: 6,
              }).map((_, index) => (
                <div
                  key={index}
                  style={skeletonCard}
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : listingsError ? (
            <div
              role="alert"
              style={emptyState}
            >
              <strong>
                {listingsError}
              </strong>
              <button
                type="button"
                style={retryButton}
                onClick={() =>
                  void loadListings(
                    page
                  )
                }
              >
                إعادة المحاولة
              </button>
            </div>
          ) : listings.length === 0 ? (
            <div style={emptyState}>
              <strong>
                {getEmptyText(
                  activeTab
                )}
              </strong>
              <button
                type="button"
                style={addButton}
                onClick={openModal}
              >
                <PlusIcon />
                <span>إضافة عرض</span>
              </button>
            </div>
          ) : (
            <>
              <div style={cardsGrid}>
                {listings.map(
                  (listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      isActionLoading={
                        actionListingId ===
                        listing.id
                      }
                      onEdit={() =>
                        openEditModal(
                          listing
                        )
                      }
                      onDelete={() =>
                        openConfirmModal(
                          "delete",
                          listing
                        )
                      }
                      onComplete={() =>
                        openConfirmModal(
                          "complete",
                          listing
                        )
                      }
                    />
                  )
                )}
              </div>

              <Pagination
                pagination={pagination}
                onPrev={() =>
                  changePage(
                    page - 1
                  )
                }
                onNext={() =>
                  changePage(
                    page + 1
                  )
                }
              />
            </>
          )}
        </section>

        <div style={backWrapper}>
          <button
            type="button"
            style={backButton}
            onClick={() => router.back()}
          >
            <BackIcon />
            <span>رجوع</span>
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          style={modalOverlay}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-store-modal-title"
            style={modalCard}
          >
            <div style={modalHeader}>
              <h2
                id="card-store-modal-title"
                style={modalTitle}
              >
                إضافة عرض
              </h2>

              <button
                type="button"
                aria-label="إغلاق"
                style={iconButton}
                onClick={closeModal}
                disabled={submitting}
              >
                <CloseIcon />
              </button>
            </div>

            {productsLoading ? (
              <div style={modalNotice}>
                جاري تحميل المنتجات...
              </div>
            ) : productsError ? (
              <div
                role="alert"
                style={modalError}
              >
                <span>{productsError}</span>
                <button
                  type="button"
                  style={smallRetryButton}
                  onClick={() =>
                    void loadProducts()
                  }
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : products.length === 0 ? (
              <div style={modalNotice}>
                لا توجد منتجات متاحة حاليًا.
              </div>
            ) : null}

            {submitError && (
              <div
                role="alert"
                style={modalError}
              >
                {submitError}
              </div>
            )}

            <form
              onSubmit={submitListing}
              style={formGrid}
            >
              <FieldGroup
                label="نوع العرض"
                htmlFor="card-store-listing-type"
                error={
                  fieldErrors.listingType
                }
              >
                <select
                  id="card-store-listing-type"
                  style={selectInputStyle}
                  value={form.listingType}
                  onChange={(event) =>
                    updateFormField(
                      "listingType",
                      event.target
                        .value
                    )
                  }
                >
                  <option value="offered">
                    عرض بطاقات
                  </option>
                  <option value="wanted">
                    طلب بطاقات
                  </option>
                </select>
              </FieldGroup>

              <FieldGroup
                label="المنتج"
                htmlFor="card-store-product"
                error={
                  fieldErrors.productId
                }
              >
                <select
                  id="card-store-product"
                  style={selectInputStyle}
                  value={form.productId}
                  onChange={(event) =>
                    updateFormField(
                      "productId",
                      event.target
                        .value
                    )
                  }
                  disabled={
                    products.length ===
                    0
                  }
                >
                  <option value="">
                    اختر المنتج
                  </option>
                  {products.map(
                    (product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.name}
                      </option>
                    )
                  )}
                </select>
              </FieldGroup>

              <FieldGroup
                label="المدينة"
                htmlFor="card-store-city"
                error={
                  fieldErrors.cityCode
                }
              >
                <select
                  id="card-store-city"
                  style={selectInputStyle}
                  value={form.cityCode}
                  onChange={(event) =>
                    updateFormField(
                      "cityCode",
                      event.target
                        .value
                    )
                  }
                >
                  <option value="">
                    اختر المدينة
                  </option>
                  {CITIES.map((city) => (
                    <option
                      key={city.code}
                      value={city.code}
                    >
                      {city.label}
                    </option>
                  ))}
                </select>
              </FieldGroup>

              <FieldGroup
                label="الكمية"
                htmlFor="card-store-quantity"
                error={
                  fieldErrors.quantity
                }
              >
                <input
                  id="card-store-quantity"
                  style={inputStyle}
                  value={form.quantity}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={(event) =>
                    updateFormField(
                      "quantity",
                      event.target
                        .value
                    )
                  }
                />
              </FieldGroup>

              <FieldGroup
                label="السعر الإجمالي"
                htmlFor="card-store-total-price"
                error={
                  fieldErrors.totalPrice
                }
              >
                <input
                  id="card-store-total-price"
                  style={inputStyle}
                  value={form.totalPrice}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={(event) =>
                    updateFormField(
                      "totalPrice",
                      event.target
                        .value
                    )
                  }
                />
              </FieldGroup>

              <FieldGroup
                label="رقم التواصل"
                htmlFor="card-store-contact-phone"
                error={
                  fieldErrors.contactPhone
                }
              >
                <input
                  id="card-store-contact-phone"
                  style={inputStyle}
                  value={form.contactPhone}
                  inputMode="numeric"
                  pattern="05[0-9]{8}"
                  maxLength={10}
                  placeholder="05xxxxxxxx"
                  onChange={(event) =>
                    updateFormField(
                      "contactPhone",
                      event.target
                        .value
                    )
                  }
                />
              </FieldGroup>

              <div style={expirySection}>
                <span style={expiryTitle}>
                  تاريخ انتهاء البطاقات
                </span>
                <div style={expiryFieldsRow}>
                  <div style={expiryMonthField}>
                    <label
                      htmlFor="card-store-card-expiry-month"
                      style={labelStyle}
                    >
                      الشهر
                    </label>
                    <input
                      id="card-store-card-expiry-month"
                      style={inputStyle}
                      value={
                        form.cardExpiryMonth
                      }
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      placeholder="MM"
                      onChange={(event) =>
                        updateFormField(
                          "cardExpiryMonth",
                          event.target
                            .value
                        )
                      }
                    />
                  </div>

                  <div style={expiryYearField}>
                    <label
                      htmlFor="card-store-card-expiry-year"
                      style={labelStyle}
                    >
                      السنة
                    </label>
                    <input
                      id="card-store-card-expiry-year"
                      style={inputStyle}
                      value={
                        form.cardExpiryYear
                      }
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder="YYYY"
                      onChange={(event) =>
                        updateFormField(
                          "cardExpiryYear",
                          event.target
                            .value
                        )
                      }
                    />
                  </div>
                </div>
                {(fieldErrors.cardExpiryMonth ||
                  fieldErrors.cardExpiryYear) && (
                  <small style={fieldError}>
                    أدخل شهرًا من 1 إلى 12 وسنة من 4 أرقام
                  </small>
                )}
              </div>

              <div style={modalActions}>
                <button
                  type="button"
                  style={cancelButton}
                  onClick={closeModal}
                  disabled={submitting}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{
                    ...submitButton,
                    opacity: canSubmit
                      ? 1
                      : 0.58,
                  }}
                  disabled={!canSubmit}
                >
                  {submitting
                    ? "جاري الإضافة..."
                    : "إضافة عرض"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editModalOpen && editingListing && (
        <div
          style={modalOverlay}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-store-edit-modal-title"
            style={modalCard}
          >
            <div style={modalHeader}>
              <h2
                id="card-store-edit-modal-title"
                style={modalTitle}
              >
                تعديل العرض
              </h2>

              <button
                type="button"
                aria-label="إغلاق"
                style={iconButton}
                onClick={closeEditModal}
                disabled={
                  actionType === "edit"
                }
              >
                <CloseIcon />
              </button>
            </div>

            {productsLoading ? (
              <div style={modalNotice}>
                جاري تحميل المنتجات...
              </div>
            ) : productsError ? (
              <div
                role="alert"
                style={modalError}
              >
                <span>{productsError}</span>
                <button
                  type="button"
                  style={smallRetryButton}
                  onClick={() =>
                    void loadProducts()
                  }
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : products.length === 0 ? (
              <div style={modalNotice}>
                لا توجد منتجات متاحة حاليًا.
              </div>
            ) : productsLoaded &&
              editForm.productId &&
              !products.some(
                (product) =>
                  product.id ===
                  editForm.productId
              ) ? (
              <div
                role="alert"
                style={modalError}
              >
                المنتج الحالي غير متاح، اختر منتجًا متاحًا
              </div>
            ) : null}

            {editSubmitError && (
              <div
                role="alert"
                style={modalError}
              >
                {editSubmitError}
              </div>
            )}

            <form
              onSubmit={submitEditListing}
              style={formGrid}
            >
              <FieldGroup
                label="نوع العرض"
                htmlFor="card-store-edit-listing-type"
                error={
                  editFieldErrors.listingType
                }
              >
                <select
                  id="card-store-edit-listing-type"
                  style={selectInputStyle}
                  value={editForm.listingType}
                  onChange={(event) =>
                    updateEditFormField(
                      "listingType",
                      event.target
                        .value
                    )
                  }
                >
                  <option value="offered">
                    عرض بطاقة
                  </option>
                  <option value="wanted">
                    طلب بطاقة
                  </option>
                </select>
              </FieldGroup>

              <FieldGroup
                label="المنتج"
                htmlFor="card-store-edit-product"
                error={
                  editFieldErrors.productId
                }
              >
                <select
                  id="card-store-edit-product"
                  style={selectInputStyle}
                  value={editForm.productId}
                  onChange={(event) =>
                    updateEditFormField(
                      "productId",
                      event.target
                        .value
                    )
                  }
                  disabled={
                    products.length ===
                    0
                  }
                >
                  <option value="">
                    اختر المنتج
                  </option>
                  {products.map(
                    (product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.name}
                      </option>
                    )
                  )}
                </select>
              </FieldGroup>

              <FieldGroup
                label="المدينة"
                htmlFor="card-store-edit-city"
                error={
                  editFieldErrors.cityCode
                }
              >
                <select
                  id="card-store-edit-city"
                  style={selectInputStyle}
                  value={editForm.cityCode}
                  onChange={(event) =>
                    updateEditFormField(
                      "cityCode",
                      event.target
                        .value
                    )
                  }
                >
                  <option value="">
                    اختر المدينة
                  </option>
                  {CITIES.map((city) => (
                    <option
                      key={city.code}
                      value={city.code}
                    >
                      {city.label}
                    </option>
                  ))}
                </select>
              </FieldGroup>

              <FieldGroup
                label="الكمية"
                htmlFor="card-store-edit-quantity"
                error={
                  editFieldErrors.quantity
                }
              >
                <input
                  id="card-store-edit-quantity"
                  style={inputStyle}
                  value={editForm.quantity}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={(event) =>
                    updateEditFormField(
                      "quantity",
                      event.target
                        .value
                    )
                  }
                />
              </FieldGroup>

              <FieldGroup
                label="السعر الإجمالي"
                htmlFor="card-store-edit-total-price"
                error={
                  editFieldErrors.totalPrice
                }
              >
                <input
                  id="card-store-edit-total-price"
                  style={inputStyle}
                  value={editForm.totalPrice}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={(event) =>
                    updateEditFormField(
                      "totalPrice",
                      event.target
                        .value
                    )
                  }
                />
              </FieldGroup>

              <FieldGroup
                label="رقم التواصل"
                htmlFor="card-store-edit-contact-phone"
                error={
                  editFieldErrors.contactPhone
                }
              >
                <input
                  id="card-store-edit-contact-phone"
                  style={inputStyle}
                  value={editForm.contactPhone}
                  inputMode="numeric"
                  pattern="05[0-9]{8}"
                  maxLength={10}
                  placeholder="05xxxxxxxx"
                  onChange={(event) =>
                    updateEditFormField(
                      "contactPhone",
                      event.target
                        .value
                    )
                  }
                />
              </FieldGroup>

              <div style={expirySection}>
                <span style={expiryTitle}>
                  تاريخ انتهاء البطاقات
                </span>
                {!editForm.cardExpiryMonth &&
                  !editForm.cardExpiryYear && (
                    <small style={expiryHint}>
                      أدخل تاريخ انتهاء البطاقة قبل حفظ التعديل
                    </small>
                  )}
                <div style={expiryFieldsRow}>
                  <div style={expiryMonthField}>
                    <label
                      htmlFor="card-store-edit-card-expiry-month"
                      style={labelStyle}
                    >
                      الشهر
                    </label>
                    <input
                      id="card-store-edit-card-expiry-month"
                      style={inputStyle}
                      value={
                        editForm.cardExpiryMonth
                      }
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      placeholder="MM"
                      onChange={(event) =>
                        updateEditFormField(
                          "cardExpiryMonth",
                          event.target
                            .value
                        )
                      }
                    />
                  </div>

                  <div style={expiryYearField}>
                    <label
                      htmlFor="card-store-edit-card-expiry-year"
                      style={labelStyle}
                    >
                      السنة
                    </label>
                    <input
                      id="card-store-edit-card-expiry-year"
                      style={inputStyle}
                      value={
                        editForm.cardExpiryYear
                      }
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder="YYYY"
                      onChange={(event) =>
                        updateEditFormField(
                          "cardExpiryYear",
                          event.target
                            .value
                        )
                      }
                    />
                  </div>
                </div>
                {(editFieldErrors.cardExpiryMonth ||
                  editFieldErrors.cardExpiryYear) && (
                  <small style={fieldError}>
                    أدخل شهرًا من 1 إلى 12 وسنة من 4 أرقام
                  </small>
                )}
              </div>

              <div style={modalActions}>
                <button
                  type="button"
                  style={cancelButton}
                  onClick={closeEditModal}
                  disabled={
                    actionType === "edit"
                  }
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{
                    ...submitButton,
                    opacity: canSubmitEdit
                      ? 1
                      : 0.58,
                  }}
                  disabled={!canSubmitEdit}
                >
                  {actionType === "edit"
                    ? "جاري التعديل..."
                    : "حفظ التعديل"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {confirmAction && confirmListing && (
        <div
          style={modalOverlay}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-store-confirm-title"
            style={confirmCard}
          >
            <div style={modalHeader}>
              <h2
                id="card-store-confirm-title"
                style={modalTitle}
              >
                {confirmAction === "delete"
                  ? "حذف العرض"
                  : "تأكيد إتمام الصفقة"}
              </h2>

              <button
                type="button"
                aria-label="إغلاق"
                style={iconButton}
                onClick={closeConfirmModal}
                disabled={
                  actionType ===
                  confirmAction
                }
              >
                <CloseIcon />
              </button>
            </div>

            <p style={confirmText}>
              {confirmAction === "delete"
                ? "سيتم حذف هذا العرض نهائيًا من متجر البطاقات."
                : "سيتم تسجيل الصفقة وحذف العرض من متجر البطاقات."}
            </p>

            {actionError && (
              <div
                role="alert"
                style={modalError}
              >
                {actionError}
              </div>
            )}

            <div style={modalActions}>
              <button
                type="button"
                style={cancelButton}
                onClick={closeConfirmModal}
                disabled={
                  actionType ===
                  confirmAction
                }
              >
                إلغاء
              </button>
              <button
                type="button"
                style={{
                  ...submitButton,
                  ...(confirmAction ===
                  "delete"
                    ? dangerSubmitButton
                    : null),
                  opacity:
                    actionType ===
                    confirmAction
                      ? 0.58
                      : 1,
                }}
                onClick={() =>
                  void runConfirmAction()
                }
                disabled={
                  actionType ===
                  confirmAction
                }
              >
                {actionType ===
                confirmAction
                  ? "جاري التنفيذ..."
                  : confirmAction ===
                      "delete"
                    ? "حذف نهائي"
                    : "تأكيد تمت الصفقة"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ListingCard({
  listing,
  isActionLoading,
  onEdit,
  onDelete,
  onComplete,
}: {
  listing: CardStoreListing;
  isActionLoading: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
}) {
  const cityLabel =
    CITY_LABELS.get(
      listing.city_code
    ) || "غير متاح";
  const hasActions =
    listing.can_edit ||
    listing.can_delete ||
    listing.can_complete;

  return (
    <article style={listingCard}>
      <div style={listingCardHeader}>
        <span style={listingTypePill}>
          {getListingTypeLabel(
            listing.listing_type
          )}
        </span>
        <strong style={productTitle}>
          {listing.product_name_snapshot}
        </strong>
      </div>

      <div style={listingDetailsGrid}>
        <InfoItem
          icon={<StoreIcon />}
          label="الفرع"
          value={
            listing.branch_name ||
            "غير متاح"
          }
        />
        <InfoItem
          icon={<LocationIcon />}
          label="المدينة"
          value={cityLabel}
        />
        <InfoItem
          icon={<QuantityIcon />}
          label="الكمية"
          value={formatNumber(
            listing.quantity
          )}
        />
        <InfoItem
          icon={<MoneyIcon />}
          label="سعر الوحدة"
          value={formatCurrency(
            listing.unit_price
          )}
        />
        <InfoItem
          icon={<MoneyIcon />}
          label="السعر الإجمالي"
          value={formatCurrency(
            listing.total_price
          )}
        />
        <InfoItem
          icon={<CalendarIcon />}
          label="انتهاء البطاقات"
          value={formatCardExpiry(
            listing.card_expiry_month,
            listing.card_expiry_year
          )}
        />
        <InfoItem
          icon={<PhoneIcon />}
          label="رقم التواصل"
          value={
            <a
              href={`tel:${listing.contact_phone}`}
              style={phoneInlineLink}
            >
              {listing.contact_phone}
            </a>
          }
        />
        <InfoItem
          icon={<CalendarIcon />}
          label="تاريخ النشر"
          value={formatDateTime(
            listing.published_at
          )}
        />
      </div>

      {hasActions && (
        <div style={listingActions}>
          {listing.can_edit && (
            <button
              type="button"
              style={actionButton}
              onClick={onEdit}
              disabled={isActionLoading}
            >
              <EditIcon />
              <span>تعديل</span>
            </button>
          )}

          {listing.can_delete && (
            <button
              type="button"
              style={{
                ...actionButton,
                ...dangerActionButton,
              }}
              onClick={onDelete}
              disabled={isActionLoading}
            >
              <TrashIcon />
              <span>حذف</span>
            </button>
          )}

          {listing.can_complete && (
            <button
              type="button"
              style={{
                ...actionButton,
                ...successActionButton,
              }}
              onClick={onComplete}
              disabled={isActionLoading}
            >
              <CheckIcon />
              <span>تمت الصفقة</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={infoItem}>
      <span style={infoIcon}>
        {icon}
      </span>
      <span style={infoText}>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function FieldGroup({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div style={fieldGroup}>
      <label
        htmlFor={htmlFor}
        style={labelStyle}
      >
        {label}
      </label>
      {children}
      {error && (
        <small style={fieldError}>
          {error}
        </small>
      )}
    </div>
  );
}

function Pagination({
  pagination,
  onPrev,
  onNext,
}: {
  pagination: PaginationState;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div style={paginationBox}>
      <button
        type="button"
        style={paginationButton}
        onClick={onPrev}
        disabled={
          !pagination.hasPrevious
        }
      >
        السابق
      </button>
      <span style={paginationText}>
        الصفحة{" "}
        {formatNumber(
          pagination.page
        )}{" "}
        من{" "}
        {formatNumber(
          pagination.totalPages
        )}
      </span>
      <button
        type="button"
        style={paginationButton}
        onClick={onNext}
        disabled={!pagination.hasNext}
      >
        التالي
      </button>
    </div>
  );
}

function BaseIcon({
  children,
  size = 20,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function UserIcon() {
  return (
    <BaseIcon>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </BaseIcon>
  );
}

function LogoutIcon() {
  return (
    <BaseIcon>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </BaseIcon>
  );
}

function HomeIcon() {
  return (
    <BaseIcon>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </BaseIcon>
  );
}

function PlusIcon() {
  return (
    <BaseIcon>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

function BackIcon() {
  return (
    <BaseIcon>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </BaseIcon>
  );
}

function ChevronDownIcon() {
  return (
    <BaseIcon size={18}>
      <path d="M6 9l6 6 6-6" />
    </BaseIcon>
  );
}

function CloseIcon() {
  return (
    <BaseIcon>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </BaseIcon>
  );
}

function StoreIcon() {
  return (
    <BaseIcon size={18}>
      <path d="M4 10h16" />
      <path d="M5 10l1-5h12l1 5" />
      <path d="M6 10v9h12v-9" />
    </BaseIcon>
  );
}

function LocationIcon() {
  return (
    <BaseIcon size={18}>
      <path d="M12 21s7-4.35 7-11a7 7 0 0 0-14 0c0 6.65 7 11 7 11z" />
      <circle cx="12" cy="10" r="2" />
    </BaseIcon>
  );
}

function QuantityIcon() {
  return (
    <BaseIcon size={18}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7L12 12l8.7-5" />
      <path d="M12 22V12" />
    </BaseIcon>
  );
}

function MoneyIcon() {
  return (
    <BaseIcon size={18}>
      <path d="M4 7h16v10H4z" />
      <circle cx="12" cy="12" r="2" />
      <path d="M7 10v4" />
      <path d="M17 10v4" />
    </BaseIcon>
  );
}

function PhoneIcon() {
  return (
    <BaseIcon size={18}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.8a2 2 0 0 1-.45 2.11L8.09 9.86a16 16 0 0 0 6.05 6.05l1.23-1.23a2 2 0 0 1 2.11-.45c.9.31 1.84.53 2.8.66A2 2 0 0 1 22 16.92z" />
    </BaseIcon>
  );
}

function CalendarIcon() {
  return (
    <BaseIcon size={18}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect
        x="3"
        y="4"
        width="18"
        height="18"
        rx="2"
      />
      <path d="M3 10h18" />
    </BaseIcon>
  );
}

function EditIcon() {
  return (
    <BaseIcon size={17}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </BaseIcon>
  );
}

function TrashIcon() {
  return (
    <BaseIcon size={17}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </BaseIcon>
  );
}

function CheckIcon() {
  return (
    <BaseIcon size={17}>
      <path d="M20 6L9 17l-5-5" />
    </BaseIcon>
  );
}

function getPageStyle(
  isMobile: boolean
): CSSProperties {
  return {
    minHeight: "100dvh",
    backgroundColor: "#f6f9ff",
    backgroundImage:
      "radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%), radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%), radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%), linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)), url('/backgrounds/v13-finance-bg-1.png')",
    backgroundSize:
      "auto, auto, auto, auto, cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: isMobile
      ? "scroll"
      : "fixed",
    padding: isMobile ? 10 : 18,
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
  if (screen === "desktop") {
    return {
      width: "100%",
      maxWidth: 315,
      display: "grid",
      gap: 24,
      direction: "ltr",
      justifySelf: "start",
    };
  }

  return {
    width: "100%",
    maxWidth:
      screen === "tablet"
        ? 520
        : "100%",
    display: "grid",
    gap: 12,
    direction: "rtl",
    justifyItems: "center",
    order: 2,
  };
}

function getEmployeeTopRowStyle(
  screen: ScreenType
): CSSProperties {
  return {
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    justifyContent:
      screen === "desktop"
        ? "flex-start"
        : "center",
    flexWrap:
      screen === "mobile"
        ? "wrap"
        : "nowrap",
    gap: screen === "mobile" ? 10 : 14,
    direction: "rtl",
    color: "#ffffff",
    width: "100%",
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
        ? 28
        : screen === "tablet"
          ? 34
          : 40,
    fontWeight: 900,
    lineHeight: 1.25,
    letterSpacing: 0,
    textShadow:
      "0 8px 18px rgba(15,23,42,0.26)",
    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
  return {
    position: "relative",
    zIndex: 4,
    display: "flex",
    alignItems: "center",
    justifyContent:
      screen === "desktop"
        ? "flex-end"
        : "center",
    order: 3,
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
  color: "rgba(255,255,255,0.96)",
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

const primaryHeroButton: CSSProperties = {
  minHeight: 44,
  border: "none",
  borderRadius: 999,
  background:
    "linear-gradient(135deg,#2563eb,#0d65d9 58%,#0754b8)",
  color: "#ffffff",
  padding: "0 18px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  boxShadow:
    "0 10px 20px rgba(37,99,235,0.22)",
};

const toolbarPanel: CSSProperties = {
  background:
    "rgba(255,255,255,0.88)",
  border:
    "1px solid rgba(148,163,184,0.22)",
  borderRadius: 18,
  padding: 14,
  boxShadow:
    "0 18px 45px rgba(15,23,42,0.08)",
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1fr) minmax(220px,320px)",
  gap: 14,
  alignItems: "end",
};

const tabsBox: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  background: "#eef4ff",
  padding: 6,
  borderRadius: 999,
  alignSelf: "stretch",
};

const tabButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#334155",
  borderRadius: 999,
  minHeight: 42,
  padding: "0 18px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  flex: "1 1 160px",
};

const activeTabButton: CSSProperties = {
  ...tabButton,
  background: "#ffffff",
  color: "#0d47a1",
  boxShadow:
    "0 8px 18px rgba(37,99,235,0.14)",
};

const filterBox: CSSProperties = {
  display: "grid",
  gap: 7,
};

const label: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#334155",
};

const selectWrapper: CSSProperties = {
  position: "relative",
};

const select: CSSProperties = {
  width: "100%",
  height: 44,
  appearance: "none",
  border:
    "1px solid rgba(148,163,184,0.35)",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  padding: "0 14px 0 40px",
  fontSize: 14,
  fontWeight: 800,
  fontFamily:
    "var(--font-almarai), sans-serif",
  outline: "none",
};

const selectArrow: CSSProperties = {
  position: "absolute",
  left: 12,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#64748b",
  pointerEvents: "none",
  display: "flex",
};

const resultsPanel: CSSProperties = {
  background:
    "rgba(255,255,255,0.90)",
  border:
    "1px solid rgba(148,163,184,0.22)",
  borderRadius: 18,
  padding: 16,
  boxShadow:
    "0 18px 45px rgba(15,23,42,0.08)",
  display: "grid",
  gap: 16,
};

const sectionHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const sectionTitle: CSSProperties = {
  margin: 0,
  color: "#102a5c",
  fontSize: 22,
  fontWeight: 900,
};

const sectionHint: CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const addButton: CSSProperties = {
  minHeight: 42,
  border: "none",
  borderRadius: 999,
  background:
    "linear-gradient(135deg,#2563eb,#0d65d9)",
  color: "#ffffff",
  padding: "0 16px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const cardsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(min(100%,245px),1fr))",
  gap: 10,
};

const listingCard: CSSProperties = {
  border:
    "1px solid rgba(148,163,184,0.22)",
  borderRadius: 14,
  background:
    "linear-gradient(180deg,#ffffff,#f8fbff)",
  padding: 10,
  display: "grid",
  gap: 8,
  boxShadow:
    "0 8px 18px rgba(15,23,42,0.06)",
};

const listingCardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const listingTypePill: CSSProperties = {
  borderRadius: 999,
  background: "#e0f2fe",
  color: "#075985",
  padding: "5px 9px",
  fontSize: 10.5,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const productTitle: CSSProperties = {
  color: "#0f2f5f",
  fontSize: 15,
  fontWeight: 900,
  textAlign: "left",
  overflowWrap: "anywhere",
};

const listingDetailsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",
  gap: 7,
};

const infoItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};

const infoIcon: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 8,
  background: "#eef6ff",
  color: "#0d65d9",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
};

const infoText: CSSProperties = {
  display: "grid",
  gap: 1,
  minWidth: 0,
};

const phoneInlineLink: CSSProperties = {
  color: "#047857",
  textDecoration: "none",
  fontWeight: 900,
};

const listingActions: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  borderTop:
    "1px solid rgba(148,163,184,0.18)",
  paddingTop: 8,
};

const actionButton: CSSProperties = {
  minHeight: 32,
  border:
    "1px solid rgba(37,99,235,0.20)",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#0d47a1",
  padding: "0 10px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const dangerActionButton: CSSProperties = {
  background: "#fef2f2",
  border:
    "1px solid rgba(239,68,68,0.22)",
  color: "#b91c1c",
};

const successActionButton: CSSProperties = {
  background: "#ecfdf5",
  border:
    "1px solid rgba(16,185,129,0.24)",
  color: "#047857",
};

const emptyState: CSSProperties = {
  minHeight: 210,
  border:
    "1px dashed rgba(100,116,139,0.35)",
  borderRadius: 16,
  background:
    "rgba(248,250,252,0.82)",
  display: "grid",
  placeItems: "center",
  alignContent: "center",
  gap: 14,
  color: "#334155",
  textAlign: "center",
  padding: 18,
};

const skeletonCard: CSSProperties = {
  minHeight: 250,
  borderRadius: 16,
  background:
    "linear-gradient(90deg,#eef2f7 0%,#f8fafc 45%,#eef2f7 100%)",
  backgroundSize: "220% 100%",
  border:
    "1px solid rgba(148,163,184,0.20)",
};

const retryButton: CSSProperties = {
  ...addButton,
  background:
    "linear-gradient(135deg,#64748b,#334155)",
};

const messageBox: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 15,
  fontWeight: 900,
};

const successMessageBox: CSSProperties = {
  background: "#ecfdf5",
  color: "#047857",
  border:
    "1px solid rgba(16,185,129,0.22)",
};

const errorMessageBox: CSSProperties = {
  background: "#fef2f2",
  color: "#b91c1c",
  border:
    "1px solid rgba(239,68,68,0.22)",
};

const paginationBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: 10,
};

const paginationButton: CSSProperties = {
  minHeight: 40,
  minWidth: 96,
  border:
    "1px solid rgba(148,163,184,0.35)",
  borderRadius: 999,
  background: "#ffffff",
  color: "#0f2f5f",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const paginationText: CSSProperties = {
  color: "#334155",
  fontSize: 14,
  fontWeight: 900,
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  paddingBottom: 10,
};

const backButton: CSSProperties = {
  minHeight: 44,
  border: "none",
  borderRadius: 999,
  background:
    "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
  color: "#ffffff",
  padding: "0 20px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  boxShadow:
    "0 8px 18px rgba(22,163,74,0.20)",
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background:
    "rgba(15,23,42,0.48)",
  display: "grid",
  placeItems: "center",
  padding: 14,
};

const modalCard: CSSProperties = {
  width: "min(100%,760px)",
  maxHeight: "calc(100dvh - 28px)",
  overflow: "auto",
  borderRadius: 20,
  background: "#ffffff",
  padding: 18,
  boxShadow:
    "0 28px 80px rgba(15,23,42,0.30)",
  display: "grid",
  gap: 14,
};

const confirmCard: CSSProperties = {
  ...modalCard,
  width: "min(100%,480px)",
};

const modalHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const modalTitle: CSSProperties = {
  margin: 0,
  color: "#102a5c",
  fontSize: 22,
  fontWeight: 900,
};

const iconButton: CSSProperties = {
  width: 38,
  height: 38,
  border: "none",
  borderRadius: "50%",
  background: "#f1f5f9",
  color: "#334155",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalNotice: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 900,
};

const modalError: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  background: "#fef2f2",
  color: "#b91c1c",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const smallRetryButton: CSSProperties = {
  border: "none",
  borderRadius: 999,
  background: "#ffffff",
  color: "#b91c1c",
  minHeight: 34,
  padding: "0 12px",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(min(100%,220px),1fr))",
  gap: 12,
};

const fieldGroup: CSSProperties = {
  display: "grid",
  gap: 7,
};

const expirySection: CSSProperties = {
  display: "grid",
  gap: 8,
  alignContent: "start",
};

const expiryTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#102a5c",
};

const expiryFieldsRow: CSSProperties = {
  display: "flex",
  alignItems: "start",
  gap: 8,
  direction: "rtl",
};

const expiryMonthField: CSSProperties = {
  width: 86,
  display: "grid",
  gap: 7,
};

const expiryYearField: CSSProperties = {
  width: 118,
  display: "grid",
  gap: 7,
};

const expiryHint: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#334155",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  border:
    "1px solid rgba(148,163,184,0.38)",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  padding: "0 12px",
  fontSize: 14,
  fontWeight: 800,
  fontFamily:
    "var(--font-almarai), sans-serif",
  outline: "none",
};

const selectInputStyle: CSSProperties = {
  ...inputStyle,
  appearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, #64748b 50%), linear-gradient(135deg, #64748b 50%, transparent 50%)",
  backgroundPosition:
    "left 18px center, left 12px center",
  backgroundSize: "6px 6px, 6px 6px",
  backgroundRepeat: "no-repeat",
  padding: "0 12px 0 38px",
  cursor: "pointer",
};

const fieldError: CSSProperties = {
  color: "#b91c1c",
  fontSize: 12,
  fontWeight: 900,
};

const modalActions: CSSProperties = {
  gridColumn: "1 / -1",
  display: "flex",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: 10,
  paddingTop: 6,
};

const cancelButton: CSSProperties = {
  minHeight: 42,
  border:
    "1px solid rgba(148,163,184,0.35)",
  borderRadius: 999,
  background: "#ffffff",
  color: "#334155",
  padding: "0 18px",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const submitButton: CSSProperties = {
  minHeight: 42,
  border: "none",
  borderRadius: 999,
  background:
    "linear-gradient(135deg,#2563eb,#0d65d9)",
  color: "#ffffff",
  padding: "0 18px",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const dangerSubmitButton: CSSProperties = {
  background:
    "linear-gradient(135deg,#ef4444,#b91c1c)",
};

const confirmText: CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: 15,
  lineHeight: 1.8,
  fontWeight: 800,
};
