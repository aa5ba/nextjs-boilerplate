"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  clearFinanceSession,
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  redirectToFinanceLogin,
  validateFinanceSession,
  type FinanceSessionUser,
} from "@/lib/financeSession";

const MANAGER_ROLES = new Set([
  "main_admin",
  "branch_manager",
  "admin",
  "manager",
  "مدير فرع",
  "مدير رئيسي",
  "مدير",
]);

export type SalesInvoicePermission =
  | "sales_invoice_view"
  | "sales_invoice_create"
  | "purchase_invoice_create"
  | "sales_invoice_print"
  | "sales_invoice_cancel";

export type InvoiceOperationType = "sale" | "purchase";

export type SalesInvoiceRecord = {
  id: string;
  branch_id: string;
  invoice_number: number | string;
  invoice_date: string;
  organization_name: string;
  customer_name: string;
  customer_national_id: string;
  customer_phone: string;
  product_name: string;
  investor_name: string;
  quantity: number | string;
  total_amount: number | string;
  payment_method: string;
  operation_type: InvoiceOperationType;
  sale_unit_cost: number | string;
  sale_total_cost: number | string;
  status: "active" | "cancelled";
  created_by_name: string;
  created_at: string;
  cancelled_at?: string | null;
  cancelled_by_name?: string | null;
  cancellation_reason?: string | null;
  inventory_quantity_after_sale?: number | string | null;
  goods_balance_after_sale?: number | string | null;
  cash_balance_after_operation?: number | string | null;
  inventory_quantity_after_cancellation?: number | string | null;
  goods_balance_after_cancellation?: number | string | null;
  cash_balance_after_cancellation?: number | string | null;
};

export function isManager(user: FinanceSessionUser | null) {
  return MANAGER_ROLES.has(String(user?.role || "").trim());
}

export function hasSalesInvoicePermission(
  user: FinanceSessionUser | null,
  permission: SalesInvoicePermission
) {
  return (
    isManager(user) ||
    (Array.isArray(user?.permissions) && user.permissions.includes(permission))
  );
}

export function useSalesInvoiceSession(
  branch: string,
  permission: SalesInvoicePermission | readonly SalesInvoicePermission[]
) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState<FinanceSessionUser | null>(null);

  useEffect(() => {
    if (!branch) return;

    let cancelled = false;

    const validation = validateFinanceSession(branch);

    if (!validation.valid || !validation.user) {
      redirectToFinanceLogin(router, { branchSlug: branch });
      return;
    }

    const requiredPermissions = Array.isArray(permission) ? permission : [permission];

    if (!requiredPermissions.some((item) => hasSalesInvoicePermission(validation.user, item))) {
      window.alert("لا تملك صلاحية الدخول إلى هذه الصفحة");
      router.replace(`/finance/${branch}`);
      return;
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setUser(validation.user);
      setChecked(true);
    });

    const disposeTracker = installFinanceActivityTracker({
      expectedBranchSlug: branch,
      onExpired: () => redirectToFinanceLogin(router, { branchSlug: branch }),
      onInvalidated: () => {
        clearFinanceSession();
        router.replace("/login");
      },
      onSessionUpdated: (updatedUser) => {
        if (!requiredPermissions.some((item) => hasSalesInvoicePermission(updatedUser, item))) {
          router.replace(`/finance/${branch}`);
          return;
        }

        setUser(updatedUser);
      },
    });

    return () => {
      cancelled = true;
      disposeTracker();
    };
  }, [branch, permission, router]);

  return {
    checked,
    user,
    employeeName: getFinanceEmployeeName(user),
    canCreateSale: hasSalesInvoicePermission(user, "sales_invoice_create"),
    canCreatePurchase: hasSalesInvoicePermission(user, "purchase_invoice_create"),
    canCreate:
      hasSalesInvoicePermission(user, "sales_invoice_create") ||
      hasSalesInvoicePermission(user, "purchase_invoice_create"),
    canPrint: hasSalesInvoicePermission(user, "sales_invoice_print"),
    canCancel: hasSalesInvoicePermission(user, "sales_invoice_cancel"),
  };
}

export function SalesInvoiceShell({
  branch,
  title,
  employeeName,
  actions,
  children,
}: {
  branch: string;
  title: string;
  employeeName: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <main dir="rtl" style={pageStyle}>
      <div style={containerStyle}>
        <header style={heroStyle}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={headerContent}>
            <div style={userBox}>{employeeName}</div>
            <h1 style={titleStyle}>{title}</h1>
            <button
              type="button"
              style={workstationButton}
              onClick={() => router.push(`/finance/${branch}`)}
            >
              محطة العمل الرئيسية
            </button>
          </div>
        </header>

        {actions ? <div style={actionsStyle}>{actions}</div> : null}
        {children}
      </div>
    </main>
  );
}

export function BackButton() {
  const router = useRouter();

  return (
    <button type="button" style={backButton} onClick={() => router.back()}>
      رجوع
    </button>
  );
}

export function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatQuantity(value: number | string | null | undefined) {
  const quantity = Number(value || 0);

  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 6,
  }).format(Number.isFinite(quantity) ? quantity : 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #dbe7f3",
  borderRadius: 22,
  boxShadow: "0 16px 40px rgba(15,47,95,0.08)",
  padding: 24,
};

export const primaryButton: CSSProperties = {
  border: 0,
  borderRadius: 13,
  padding: "12px 22px",
  fontFamily: "inherit",
  fontWeight: 800,
  cursor: "pointer",
  color: "#fff",
  background: "linear-gradient(135deg,#0f766e,#14b8a6)",
};

export const dangerButton: CSSProperties = {
  ...primaryButton,
  background: "linear-gradient(135deg,#b91c1c,#ef4444)",
};

export const secondaryButton: CSSProperties = {
  ...primaryButton,
  color: "#0f2f5f",
  background: "#eaf2fb",
  border: "1px solid #c9dced",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 46,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#fff",
  padding: "10px 13px",
  fontFamily: "inherit",
  fontSize: 15,
  color: "#0f172a",
  boxSizing: "border-box",
};

export const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#1e3a5f",
  fontWeight: 800,
  fontSize: 14,
};

export const noticeStyle: CSSProperties = {
  ...cardStyle,
  textAlign: "center",
  color: "#475569",
};

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  fontFamily: "var(--font-almarai), sans-serif",
  background: "#edf5fb url('/backgrounds/v13-finance-bg-1.png') center/cover fixed",
  color: "#0f172a",
  padding: "20px 14px 48px",
};

const containerStyle: CSSProperties = {
  width: "min(1180px, 100%)",
  margin: "0 auto",
};

const heroStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 26,
  background: "linear-gradient(135deg,#071f46,#0f4c81 58%,#0ea5b7)",
  color: "#fff",
  padding: "22px 24px",
  boxShadow: "0 20px 48px rgba(7,31,70,0.22)",
};

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 180,
  height: 180,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.14)",
  top: -90,
  right: -35,
};

const heroCircleTwo: CSSProperties = {
  position: "absolute",
  width: 120,
  height: 120,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.06)",
  bottom: -70,
  left: "28%",
};

const headerContent: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "minmax(130px,1fr) minmax(220px,2fr) minmax(160px,1fr)",
  gap: 16,
  alignItems: "center",
};

const userBox: CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
};

const titleStyle: CSSProperties = {
  margin: 0,
  textAlign: "center",
  fontSize: "clamp(24px,4vw,38px)",
  fontFamily: "var(--font-almarai), sans-serif",
};

const workstationButton: CSSProperties = {
  ...primaryButton,
  justifySelf: "end",
  background: "linear-gradient(135deg,#15803d,#22c55e)",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  margin: "18px 0",
};

const backButton: CSSProperties = {
  ...primaryButton,
  background: "linear-gradient(135deg,#15803d,#22c55e)",
};
