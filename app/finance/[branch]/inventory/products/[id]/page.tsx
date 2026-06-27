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

type SessionWithPermissions = FinanceSessionUser & {
  permissions?: string[] | null;
  roles?: string[] | null;
  role?: string | null;
};

type Product = {
  id: string;
  branch_id?: string | null;
  product_name?: string | null;
  product_category?: string | null;
  unit_price?: number | string | null;
  notes?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

type InvestorRelation = {
  investor_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
};

type InventoryItem = {
  id: string;
  branch_id?: string | null;
  product_id?: string | null;
  investor_id?: string | null;
  quantity?: number | string | null;
  updated_at?: string | null;
  finance_investors?:
    | InvestorRelation
    | InvestorRelation[]
    | null;
};

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const branch =
    typeof params.branch === "string"
      ? params.branch.trim()
      : "";

  const productId =
    typeof params.id === "string"
      ? params.id.trim()
      : "";

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [sessionUser, setSessionUser] =
    useState<SessionWithPermissions | null>(null);

  const [authChecked, setAuthChecked] =
    useState(false);

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [product, setProduct] =
    useState<Product | null>(null);

  const [inventory, setInventory] =
    useState<InventoryItem[]>([]);

  const [contractsCount, setContractsCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [statusUpdating, setStatusUpdating] =
    useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function initializePage() {
      setLoading(true);
      setAuthChecked(false);
      setBranchId(null);
      setProduct(null);
      setInventory([]);
      setContractsCount(0);

      if (!branch) {
        clearFinanceSession();
        router.replace("/login");
        return;
      }

      if (!productId) {
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
        validation.user as SessionWithPermissions;

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

      await loadProduct(
        currentBranchId,
        () => cancelled
      );
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [branch, productId, router]);

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
          const typedUpdatedUser =
            updatedUser as SessionWithPermissions;

          const updatedBranchId = String(
            typedUpdatedUser.branch_id || ""
          ).trim();

          if (!updatedBranchId) {
            clearFinanceSession();
            router.replace("/login");
            return;
          }

          setSessionUser(typedUpdatedUser);
          setBranchId(updatedBranchId);

          setEmployeeName(
            getFinanceEmployeeName(
              typedUpdatedUser
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

  const roles = useMemo(() => {
    if (!sessionUser) {
      return [];
    }

    const roleList = Array.isArray(
      sessionUser.roles
    )
      ? sessionUser.roles
      : [];

    const singleRole =
      typeof sessionUser.role === "string" &&
      sessionUser.role.trim()
        ? [sessionUser.role.trim()]
        : [];

    return Array.from(
      new Set([
        ...roleList,
        ...singleRole,
      ])
    );
  }, [sessionUser]);

  const permissions = useMemo(() => {
    return Array.isArray(
      sessionUser?.permissions
    )
      ? sessionUser.permissions
      : [];
  }, [sessionUser]);

  function hasPermission(
    permissionKey: string
  ) {
    const normalizedRoles = roles.map(
      (role) => role.trim()
    );

    return (
      normalizedRoles.includes(
        "مدير رئيسي"
      ) ||
      normalizedRoles.includes(
        "main_admin"
      ) ||
      normalizedRoles.includes(
        "مدير"
      ) ||
      normalizedRoles.includes(
        "branch_manager"
      ) ||
      permissions.includes(
        permissionKey
      )
    );
  }

  async function loadProduct(
    currentBranchId: string,
    isCancelled: () => boolean =
      () => false
  ) {
    try {
      setLoading(true);
      setProduct(null);
      setInventory([]);
      setContractsCount(0);

      const safeBranchId =
        currentBranchId.trim();

      if (
        !safeBranchId ||
        !productId
      ) {
        return;
      }

      const [
        productResponse,
        inventoryResponse,
        contractsResponse,
      ] = await Promise.all([
        supabase
          .from("finance_products")
          .select(
            `
              id,
              branch_id,
              product_name,
              product_category,
              unit_price,
              notes,
              is_active,
              created_at
            `
          )
          .eq("id", productId)
          .eq(
            "branch_id",
            safeBranchId
          )
          .maybeSingle(),

        supabase
          .from("finance_inventory")
          .select(
            `
              id,
              branch_id,
              product_id,
              investor_id,
              quantity,
              updated_at,
              finance_investors(
                investor_name,
                national_id,
                phone
              )
            `
          )
          .eq(
            "branch_id",
            safeBranchId
          )
          .eq(
            "product_id",
            productId
          )
          .order("updated_at", {
            ascending: false,
          }),

        supabase
          .from("finance_contracts")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "branch_id",
            safeBranchId
          )
          .eq(
            "product_id",
            productId
          ),
      ]);

      if (isCancelled()) {
        return;
      }

      if (productResponse.error) {
        throw new Error(
          productResponse.error.message
        );
      }

      if (inventoryResponse.error) {
        throw new Error(
          inventoryResponse.error.message
        );
      }

      if (contractsResponse.error) {
        throw new Error(
          contractsResponse.error.message
        );
      }

      setProduct(
        productResponse.data as
          | Product
          | null
      );

      setInventory(
        (inventoryResponse.data ||
          []) as InventoryItem[]
      );

      setContractsCount(
        contractsResponse.count || 0
      );
    } catch (error) {
      if (isCancelled()) {
        return;
      }

      setProduct(null);
      setInventory([]);
      setContractsCount(0);

      const message =
        error instanceof Error
          ? error.message
          : "تعذر تحميل بيانات المنتج";

      alert(message);
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  async function toggleProductStatus() {
    if (
      !hasPermission(
        "toggle_product"
      )
    ) {
      alert(
        "لا تملك صلاحية تعطيل أو تفعيل المنتجات"
      );
      return;
    }

    if (
      !product ||
      !branchId ||
      statusUpdating
    ) {
      return;
    }

    const nextStatus =
      !Boolean(product.is_active);

    const confirmed = window.confirm(
      product.is_active
        ? "هل تريد تعطيل هذا المنتج؟"
        : "هل تريد تفعيل هذا المنتج؟"
    );

    if (!confirmed) {
      return;
    }

    try {
      setStatusUpdating(true);

      const { error } = await supabase
        .from("finance_products")
        .update({
          is_active: nextStatus,
        })
        .eq("id", productId)
        .eq("branch_id", branchId);

      if (error) {
        throw new Error(
          error.message
        );
      }

      await loadProduct(branchId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر تعديل حالة المنتج";

      alert(message);
    } finally {
      setStatusUpdating(false);
    }
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

    return parsedDate.toLocaleDateString(
      "ar-SA-u-ca-gregory",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  }

  function formatMoney(
    value:
      | number
      | string
      | null
      | undefined
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

  function getInvestor(
    relation:
      | InvestorRelation
      | InvestorRelation[]
      | null
      | undefined
  ) {
    if (Array.isArray(relation)) {
      return relation[0] || null;
    }

    return relation || null;
  }

  function goBackToProducts() {
    router.push(
      `/finance/${branch}/inventory/products`
    );
  }

  const totalQuantity = useMemo(() => {
    return inventory.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity || 0),
      0
    );
  }, [inventory]);

  const investorsCount =
    useMemo(() => {
      return new Set(
        inventory
          .map((item) =>
            String(
              item.investor_id || ""
            ).trim()
          )
          .filter(Boolean)
      ).size;
    }, [inventory]);

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
            onLogout={() =>
              logoutFinanceUser(router)
            }
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
        جاري تحميل بيانات المنتج...
      </div>
    );
  }

  if (!product) {
    return renderPage(
      <div style={notFoundCard}>
        <h2 style={notFoundTitle}>
          لم يتم العثور على المنتج
        </h2>

        <button
          type="button"
          style={backButton}
          onClick={goBackToProducts}
        >
          ← الرجوع إلى المنتجات
        </button>
      </div>
    );
  }

  return renderPage(
    <>
      <section style={productHeader}>
        <div>
          <h2 style={productNameTitle}>
            {product.product_name || "-"}
          </h2>
        </div>

        <span
          style={
            product.is_active
              ? activeBadge
              : inactiveBadge
          }
        >
          {product.is_active
            ? "نشط"
            : "معطل"}
        </span>
      </section>

      <section style={summaryGrid}>
        <SummaryBox
          title="عدد المستثمرين"
          value={investorsCount}
        />

        <SummaryBox
          title="إجمالي المخزون"
          value={totalQuantity}
        />

        <SummaryBox
          title="عدد العقود"
          value={contractsCount}
        />
      </section>

      <section style={card}>
        <h2 style={sectionTitle}>
          بيانات المنتج
        </h2>

        <Row
          label="اسم المنتج"
          value={
            product.product_name || "-"
          }
        />

        <Row
          label="التصنيف"
          value={
            product.product_category ||
            "-"
          }
        />

        <Row
          label="سعر الوحدة"
          value={`${formatMoney(
            product.unit_price
          )} ر.س`}
        />

        <Row
          label="الملاحظات"
          value={product.notes || "-"}
        />

        <Row
          label="تاريخ الإنشاء"
          value={formatDate(
            product.created_at
          )}
        />
      </section>

      <section style={actionsSection}>
        {hasPermission(
          "edit_product"
        ) && (
          <ActionButton
            title="✏️ تعديل المنتج"
            onClick={() =>
              router.push(
                `/finance/${branch}/inventory/products/${productId}/edit`
              )
            }
          />
        )}

        {hasPermission(
          "toggle_product"
        ) && (
          <button
            type="button"
            style={
              product.is_active
                ? dangerButton
                : activateButton
            }
            onClick={() =>
              void toggleProductStatus()
            }
            disabled={statusUpdating}
          >
            {statusUpdating
              ? "جاري التحديث..."
              : product.is_active
                ? "تعطيل المنتج"
                : "تفعيل المنتج"}
          </button>
        )}
      </section>

      <section style={card}>
        <h2 style={sectionTitle}>
          المستثمرون المرتبطون بالمنتج
        </h2>

        <div style={tableScroller}>
          <div style={tableHeader}>
            <span>المستثمر</span>
            <span>الهوية</span>
            <span>الجوال</span>
            <span>الكمية الحالية</span>
            <span>آخر تحديث</span>
          </div>

          {inventory.length === 0 ? (
            <div style={emptyBox}>
              لا يوجد مستثمرون مرتبطون
              بهذا المنتج
            </div>
          ) : (
            inventory.map((item) => {
              const investor =
                getInvestor(
                  item.finance_investors
                );

              const investorId =
                String(
                  item.investor_id || ""
                ).trim();

              return (
                <div
                  key={item.id}
                  style={tableRow}
                >
                  <button
                    type="button"
                    style={investorLink}
                    disabled={!investorId}
                    onClick={() => {
                      if (!investorId) {
                        return;
                      }

                      router.push(
                        `/finance/${branch}/inventory/investors/${investorId}`
                      );
                    }}
                  >
                    {investor?.investor_name ||
                      "-"}
                  </button>

                  <span>
                    {investor?.national_id ||
                      "-"}
                  </span>

                  <span>
                    {investor?.phone || "-"}
                  </span>

                  <strong>
                    {Number(
                      item.quantity || 0
                    )}
                  </strong>

                  <span>
                    {formatDate(
                      item.updated_at
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      <div style={backWrapper}>
        <button
          type="button"
          style={backButton}
          onClick={goBackToProducts}
        >
          ← الرجوع إلى المنتجات
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
            ملف المنتج
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
  value: ReactNode;
}) {
  return (
    <div style={row}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function SummaryBox({
  title,
  value,
}: {
  title: string;
  value: ReactNode;
}) {
  return (
    <div style={summaryBox}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionButton({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      style={actionButton}
      onClick={onClick}
    >
      {title}
    </button>
  );
}

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      button {
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

const productHeader: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 20,
  padding: 18,
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.05)",
};

const productNameTitle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 23,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
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
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#0d47a1",
  fontWeight: 900,
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const card: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  minWidth: 0,
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const sectionTitle: CSSProperties = {
  margin: "0 0 14px",
  color: "#0d47a1",
  fontSize: 22,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: "12px 0",
  borderBottom:
    "1px solid #eef2f7",
  flexWrap: "wrap",
};

const actionsSection: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const actionButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#ffffff",
  color: "#0d47a1",
  border: "1px solid #d9e3f5",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const dangerButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const activateButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#dcfce7",
  color: "#166534",
  border: "none",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const tableScroller: CSSProperties = {
  overflowX: "auto",
  width: "100%",
};

const tableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "2fr 1.4fr 1.4fr 1fr 1.5fr",
  gap: 12,
  minWidth: 900,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: 900,
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "2fr 1.4fr 1.4fr 1fr 1.5fr",
  gap: 12,
  minWidth: 900,
  padding: 14,
  borderBottom:
    "1px solid #eef2f7",
  alignItems: "center",
};

const investorLink: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  textAlign: "right",
  cursor: "pointer",
  color: "#0d47a1",
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const emptyBox: CSSProperties = {
  minWidth: 900,
  background: "#f8fbff",
  border:
    "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  textAlign: "center",
  color: "#6b7280",
  fontWeight: 800,
};

const activeBadge: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const inactiveBadge: CSSProperties = {
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

const notFoundCard: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 24,
  textAlign: "center",
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const notFoundTitle: CSSProperties = {
  margin: "0 0 18px",
  color: "#0f172a",
  fontFamily:
    "var(--font-almarai), sans-serif",
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
