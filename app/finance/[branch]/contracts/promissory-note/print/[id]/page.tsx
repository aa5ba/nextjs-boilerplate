"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

type ScreenType = "mobile" | "tablet" | "desktop";
type BeneficiaryType = "organization" | "investor" | "other";

type FinanceSessionUser = {
  id?: string;
  branch_id?: string;
  branch_slug?: string;
  full_name?: string;
  username?: string;
  role?: string;
  permissions?: string[];
  is_active?: boolean;
};

type BranchData = {
  id: string;
  branch_name: string | null;
  organization_name: string | null;
  organization_phone: string | null;
  phone: string | null;
  organization_address: string | null;
  city: string | null;
  commercial_record: string | null;
};

type PromissoryNote = {
  id: string;
  note_number: number | string | null;
  branch_id: string;
  contract_id: string | null;
  customer_id: string | null;

  note_mode: string | null;

  beneficiary_type: BeneficiaryType | null;
  beneficiary_investor_id: string | null;
  beneficiary_customer_id: string | null;
  beneficiary_name: string | null;
  beneficiary_identifier: string | null;
  beneficiary_phone: string | null;
  beneficiary_birth_date_type: string | null;
  beneficiary_birth_hijri: string | null;
  beneficiary_birth_gregorian: string | null;
  beneficiary_nationality: string | null;
  beneficiary_address: string | null;
  beneficiary_work_name: string | null;
  beneficiary_identity_source: string | null;
  beneficiary_notes: string | null;

  debtor_name: string;
  debtor_national_id: string | null;
  debtor_phone: string | null;
  debtor_birth_date_type: string | null;
  debtor_birth_hijri: string | null;
  debtor_birth_gregorian: string | null;
  debtor_nationality: string | null;
  debtor_address: string | null;
  debtor_work_name: string | null;
  debtor_identity_source: string | null;
  debtor_notes: string | null;

  amount: number | string | null;
  amount_words: string | null;

  city: string | null;
  notes: string | null;
  status: string | null;

  due_date: string | null;
  due_phrase: string | null;

  note_issue_date_gregorian: string | null;
  note_issue_date_hijri: string | null;
  note_date_gregorian: string | null;
  note_date_hijri: string | null;

  has_guarantor: boolean | null;
  guarantor_customer_id: string | null;
  guarantor_name: string | null;
  guarantor_national_id: string | null;
  guarantor_phone: string | null;
  guarantor_work_name: string | null;
  guarantor_birth_date_type: string | null;
  guarantor_birth_hijri: string | null;
  guarantor_birth_gregorian: string | null;
  guarantor_nationality: string | null;
  guarantor_address: string | null;
  guarantor_identity_source: string | null;
  guarantor_notes: string | null;

  created_by: string | null;
  created_at: string | null;
  legal_body_text: string | null;
  legal_footer_text: string | null;
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

const FIXED_DUE_PHRASE = "وتستحق الدفع عند الطلب";

const LEGAL_FOOTER_TEXT =
  "هذا السند واجب الدفع بموجب قرار مجلس الوزراء رقم ٦٩٢ و تاريخ ٢٦ / ٩ / ١٣٨٣ هـ \nوالمتوج بالمرسوم الملكي رقم ٣٧ و تاريخ ١١ / ١٠ / ١٣٨٣ هـ / نظام الأوراق التجاريه - ويسري على هذا السند جميع القرارات والأنظمه والتنظيمات في المملكة العربية السعودية";

export default function PrintPromissoryNotePage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch || "");
  const noteId = String(params.id || "");

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] =
    useState<FinanceSessionUser | null>(null);

  const [employeeName, setEmployeeName] = useState("الموظف");
  const [branchId, setBranchId] = useState("");
  const [branchData, setBranchData] = useState<BranchData | null>(null);
  const [note, setNote] = useState<PromissoryNote | null>(null);

  const [canPrint, setCanPrint] = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  const [pageError, setPageError] = useState("");

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const beneficiaryName = useMemo(() => {
    if (!note) return "................";

    if (note.beneficiary_name?.trim()) {
      return note.beneficiary_name.trim();
    }

    if (note.beneficiary_type === "organization") {
      return branchData?.organization_name || "................";
    }

    return "................";
  }, [note, branchData]);

  const beneficiaryIdentifier = useMemo(() => {
    if (!note) return "";

    if (note.beneficiary_identifier?.trim()) {
      return note.beneficiary_identifier.trim();
    }

    if (note.beneficiary_type === "organization") {
      return branchData?.commercial_record || "";
    }

    return "";
  }, [note, branchData]);

  const beneficiaryIdentifierLabel = useMemo(() => {
    if (note?.beneficiary_type === "organization") {
      return "السجل التجاري";
    }

    return "رقم الهوية";
  }, [note]);

  const noteAmount = useMemo(() => {
    const value = Number(note?.amount || 0);

    return Number.isFinite(value) ? value : 0;
  }, [note]);

  const amountWords = useMemo(() => {
    if (note?.amount_words?.trim()) {
      return note.amount_words.trim();
    }

    if (noteAmount <= 0) {
      return "صفر ريال سعودي فقط لا غير";
    }

    return amountToArabicWords(noteAmount);
  }, [note, noteAmount]);

  const issueDate = useMemo(() => {
    return (
      note?.note_issue_date_gregorian ||
      note?.note_date_gregorian ||
      note?.created_at ||
      ""
    );
  }, [note]);

  const hasGuarantor = Boolean(
    note?.has_guarantor &&
      (note?.guarantor_name ||
        note?.guarantor_national_id ||
        note?.guarantor_phone)
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
    const printStyle = document.createElement("style");

    printStyle.setAttribute("data-promissory-note-print", "true");

    printStyle.innerHTML = `
      @page {
        size: A4 portrait;
        margin: 0;
      }

      @media print {
        html,
        body {
          width: 210mm !important;
          height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: hidden !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body * {
          visibility: hidden !important;
        }

        .promissory-print-sheet,
        .promissory-print-sheet * {
          visibility: visible !important;
        }

        .promissory-print-sheet {
          position: absolute !important;
          top: 0 !important;
          right: 0 !important;
          left: 0 !important;
          width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          margin: 0 !important;
          padding: 8mm 10mm !important;
          border: none !important;
          box-shadow: none !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
        }

        .no-print {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(printStyle);

    return () => {
      document.head.removeChild(printStyle);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializePage() {
      if (typeof window === "undefined") return;

      setLoading(true);
      setPageError("");

      const storedUser = readStoredFinanceUser();

      if (!storedUser?.id) {
        redirectToLogin();
        return;
      }

      const sessionExpiresAt = Number(
        localStorage.getItem("finance_session_expires_at") || "0"
      );

      if (
        !Number.isFinite(sessionExpiresAt) ||
        sessionExpiresAt <= 0 ||
        Date.now() >= sessionExpiresAt
      ) {
        clearFinanceSession({
          preserveReturnPath: true,
        });

        redirectToLogin();
        return;
      }

      if (storedUser.is_active === false) {
        clearFinanceSession({
          preserveReturnPath: true,
        });

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

      const resolvedBranchId =
        storedUser.branch_id ||
        localStorage.getItem("finance_branch_id") ||
        (await getBranchId(branch)) ||
        "";

      if (!resolvedBranchId) {
        if (!cancelled) {
          setPageError("تعذر تحديد الفرع");
          setLoading(false);
        }

        return;
      }

      const storedName =
        localStorage.getItem("finance_user_name") ||
        storedUser.full_name ||
        storedUser.username ||
        "الموظف";

      const role = normalizeRole(storedUser.role);

      const permissions = Array.isArray(storedUser.permissions)
        ? storedUser.permissions
        : [];

      const manager = MANAGER_ROLES.has(role);

      const printPermission =
        manager || permissions.includes("promissory_note_print");

      const createPermission =
        manager || permissions.includes("promissory_note_create");

      if (!cancelled) {
        setCurrentUser(storedUser);
        setEmployeeName(storedName);
        setBranchId(resolvedBranchId);
        setCanPrint(printPermission);
        setCanCreate(createPermission);
        setAuthChecked(true);
      }

      const [branchResult, noteResult] = await Promise.all([
        supabase
          .from("finance_branches")
          .select(
            `
              id,
              branch_name,
              organization_name,
              organization_phone,
              phone,
              organization_address,
              city,
              commercial_record
            `
          )
          .eq("id", resolvedBranchId)
          .maybeSingle(),

        supabase
          .from("finance_promissory_notes")
          .select(
            `
              id,
              note_number,
              branch_id,
              contract_id,
              customer_id,
              note_mode,

              beneficiary_type,
              beneficiary_investor_id,
              beneficiary_customer_id,
              beneficiary_name,
              beneficiary_identifier,
              beneficiary_phone,
              beneficiary_birth_date_type,
              beneficiary_birth_hijri,
              beneficiary_birth_gregorian,
              beneficiary_nationality,
              beneficiary_address,
              beneficiary_work_name,
              beneficiary_identity_source,
              beneficiary_notes,

              debtor_name,
              debtor_national_id,
              debtor_phone,
              debtor_birth_date_type,
              debtor_birth_hijri,
              debtor_birth_gregorian,
              debtor_nationality,
              debtor_address,
              debtor_work_name,
              debtor_identity_source,
              debtor_notes,

              amount,
              amount_words,
              city,
              notes,
              status,
              due_date,
              due_phrase,

              note_issue_date_gregorian,
              note_issue_date_hijri,
              note_date_gregorian,
              note_date_hijri,

              has_guarantor,
              guarantor_customer_id,
              guarantor_name,
              guarantor_national_id,
              guarantor_phone,
              guarantor_work_name,
              guarantor_birth_date_type,
              guarantor_birth_hijri,
              guarantor_birth_gregorian,
              guarantor_nationality,
              guarantor_address,
              guarantor_identity_source,
              guarantor_notes,

              created_by,
              created_at,
              legal_body_text,
              legal_footer_text
            `
          )
          .eq("id", noteId)
          .eq("branch_id", resolvedBranchId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (branchResult.error) {
        setPageError(
          branchResult.error.message || "تعذر تحميل بيانات الفرع"
        );
        setLoading(false);
        return;
      }

      if (noteResult.error) {
        setPageError(
          noteResult.error.message || "تعذر تحميل بيانات السند"
        );
        setLoading(false);
        return;
      }

      if (!noteResult.data) {
        setPageError("السند غير موجود أو لا يتبع هذا الفرع");
        setLoading(false);
        return;
      }

      setBranchData((branchResult.data as BranchData | null) || null);
      setNote(noteResult.data as PromissoryNote);
      setLoading(false);
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [branch, noteId, router]);

  function clearFinanceSession({
    preserveReturnPath = false,
  }: {
    preserveReturnPath?: boolean;
  } = {}) {
    if (typeof window === "undefined") return;

    FINANCE_SESSION_KEYS.forEach((key) => {
      if (preserveReturnPath && key === "finance_return_to") {
        return;
      }

      localStorage.removeItem(key);
    });
  }

  function redirectToLogin() {
    if (typeof window === "undefined") return;

    const returnTo =
      window.location.pathname + window.location.search;

    localStorage.setItem("finance_return_to", returnTo);

    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  function logout() {
    clearFinanceSession();
    router.replace("/login");
  }

  function handlePrintOrSavePdf() {
    if (!canPrint) {
      alert("ليس لديك صلاحية طباعة أو حفظ السند");
      return;
    }

    window.print();
  }

  if (!authChecked || loading) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={loadingBox}>جاري تحميل السند...</div>
      </main>
    );
  }

  if (pageError || !note) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getContainerStyle(isCompact)}>
          <section style={errorCard}>
            <div style={errorIcon}>!</div>
            <h1 style={errorTitle}>تعذر عرض السند</h1>
            <p style={errorText}>{pageError || "السند غير موجود"}</p>
          </section>

          <div style={bottomBackWrapper}>
            <button
              type="button"
              style={greenBackButton}
              onClick={() => router.back()}
            >
              ← رجوع
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!canPrint) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getContainerStyle(isCompact)}>
          <header className="no-print" style={getHeroStyle(isMobile)}>
            <div style={heroCircleOne} />
            <div style={heroCircleTwo} />
            <div style={heroCircleThree} />
            <div style={heroDots} />

            <div style={getHeroContentStyle(screen)}>
              <HeroUserArea
                screen={screen}
                employeeName={employeeName}
                onLogout={logout}
                onHome={() => router.push(`/finance/${branch}`)}
              />

              <div style={getHeroTitleBoxStyle(screen)}>
                <h1 style={getTitleStyle(screen)}>طباعة السند</h1>
              </div>

              <div style={getHeroActionBoxStyle(screen)} />
            </div>
          </header>

          <section style={errorCard}>
            <div style={errorIcon}>!</div>
            <h1 style={errorTitle}>غير مصرح</h1>
            <p style={errorText}>
              ليس لديك صلاحية طباعة أو حفظ سند لأمر.
            </p>
          </section>

          <div style={bottomBackWrapper}>
            <button
              type="button"
              style={greenBackButton}
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
        <header className="no-print" style={getHeroStyle(isMobile)}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div style={getHeroContentStyle(screen)}>
            <HeroUserArea
              screen={screen}
              employeeName={employeeName}
              onLogout={logout}
              onHome={() => router.push(`/finance/${branch}`)}
            />

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>طباعة السند</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        <div style={previewScroller}>
          <article
            className="promissory-print-sheet"
            dir="rtl"
            style={printSheet}
          >
            <header style={documentHeader}>
              <div style={documentTopMeta}>
                <span>
                  رقم السند:{" "}
                  <strong>{formatNoteNumber(note.note_number)}</strong>
                </span>

                <span>
                  تاريخ التحرير:{" "}
                  <strong>{formatDate(issueDate)}</strong>
                </span>
              </div>

              <h1 style={documentTitle}>سند لأمر</h1>

              <div style={documentAmountBox}>
                <span style={documentAmountLabel}>قيمة السند</span>

                <strong style={documentAmountValue}>
                  {formatMoney(noteAmount)} ريال سعودي
                </strong>
              </div>
            </header>

            <section style={legalBodySection}>
              <p style={legalParagraph}>
                حُرر هذا السند في مدينة{" "}
                <strong>{note.city || branchData?.city || "................"}</strong>{" "}
                بتاريخ <strong>{formatDate(issueDate)}</strong> وقيمة السند{" "}
                <strong>{formatMoney(noteAmount)}</strong> ريال سعودي.
              </p>

              <p style={legalParagraph}>
                بموجب هذا السند أتعهد أنا الموقع أدناه بأن أدفع لأمر{" "}
                <strong>{beneficiaryName}</strong> المستفيد، المبلغ الموضح
                أعلاه وقدره <strong>{amountWords}</strong>.
              </p>

              <p style={legalParagraph}>
                وذلك قيمة المبلغ المستحق على المدين للمستفيد،{" "}
                <strong>{note.due_phrase || FIXED_DUE_PHRASE}</strong>.
              </p>

              <p style={legalParagraph}>
                وبموجب هذا السند يسقط المدين كافة حقوق التقديم والمطالبة
                والاحتجاج والإخطار بالامتناع عن الوفاء.
              </p>

              <p style={legalParagraph}>
                ويجوز لحامل هذا السند المستفيد تقديم وإظهار هذا السند لأي
                طرف دون موافقة المدين.
              </p>

              <p style={legalParagraph}>
                وللمستفيد حق الرجوع بدون مصروفات أو احتجاج أو إخطار لعدم
                الوفاء، وهذا السند واجب الدفع دون تعطيل.
              </p>

              <p style={legalParagraph}>
                وفي حالة الترافع والنزاع يكون الفصل في المحاكم التنفيذية
                المختصة في المكان الذي يرغب فيه المدعي.
              </p>
            </section>

            <section style={partyGrid}>
              <div style={partyBox}>
                <h2 style={partyBoxTitle}>بيانات المستفيد</h2>

                <DataRow label="الاسم" value={beneficiaryName} />

                {beneficiaryIdentifier && (
                  <DataRow
                    label={beneficiaryIdentifierLabel}
                    value={beneficiaryIdentifier}
                  />
                )}

                {note.beneficiary_phone && (
                  <DataRow
                    label="رقم الجوال"
                    value={note.beneficiary_phone}
                  />
                )}
              </div>

              <div style={partyBox}>
                <h2 style={partyBoxTitle}>بيانات المدين</h2>

                <DataRow label="الاسم" value={note.debtor_name} />

                <DataRow
                  label="رقم الهوية"
                  value={note.debtor_national_id || "................"}
                />

                <DataRow
                  label="رقم الجوال"
                  value={note.debtor_phone || "................"}
                />

                {note.debtor_address && (
                  <DataRow label="العنوان" value={note.debtor_address} />
                )}

                {note.debtor_work_name && (
                  <DataRow label="العمل" value={note.debtor_work_name} />
                )}
              </div>
            </section>

            {note.notes?.trim() && (
              <section style={notesBox}>
                <strong style={notesTitle}>ملاحظات السند:</strong>
                <span>{note.notes.trim()}</span>
              </section>
            )}

            <section
              style={{
                ...signatureGrid,
                gridTemplateColumns: hasGuarantor
                  ? "repeat(2,minmax(0,1fr))"
                  : "minmax(0,1fr)",
              }}
            >
              <div style={signatureBox}>
                <h2 style={signatureTitle}>توقيع المدين</h2>

                <div style={signatureName}>
                  الاسم: {note.debtor_name || "................"}
                </div>

                <div style={signatureLine}>التوقيع:</div>
              </div>

              {hasGuarantor && (
                <div style={signatureBox}>
                  <h2 style={signatureTitle}>توقيع الكفيل</h2>

                  <div style={signatureName}>
                    الاسم: {note.guarantor_name || "................"}
                  </div>

                  <div style={signatureLine}>التوقيع:</div>
                </div>
              )}
            </section>

            {hasGuarantor && (
              <section style={guarantorDetailsBox}>
                <h2 style={guarantorTitle}>بيانات الكفيل</h2>

                <div style={guarantorDetailsGrid}>
                  <DataRow
                    label="الاسم"
                    value={note.guarantor_name || "................"}
                  />

                  <DataRow
                    label="رقم الهوية"
                    value={
                      note.guarantor_national_id || "................"
                    }
                  />

                  <DataRow
                    label="رقم الجوال"
                    value={note.guarantor_phone || "................"}
                  />

                  {note.guarantor_work_name && (
                    <DataRow
                      label="العمل"
                      value={note.guarantor_work_name}
                    />
                  )}
                </div>
              </section>
            )}

            <footer style={legalFooterBox}>
              {note.legal_footer_text?.trim() || LEGAL_FOOTER_TEXT}
            </footer>
          </article>
        </div>

        <div className="no-print" style={actionsArea}>
          <button
            type="button"
            style={pdfButton}
            onClick={handlePrintOrSavePdf}
          >
            مشاركة / حفظ PDF
          </button>

          {canCreate && (
            <button
              type="button"
              style={secondaryGreenButton}
              onClick={() =>
                router.push(
                  `/finance/${branch}/contracts/promissory-note/new`
                )
              }
            >
              إنشاء سند جديد
            </button>
          )}
        </div>

        <div className="no-print" style={bottomBackWrapper}>
          <button
            type="button"
            style={greenBackButton}
            onClick={() => router.back()}
          >
            ← رجوع
          </button>
        </div>
      </div>
    </main>
  );
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

        <div style={getEmployeeNameStyle(isMobile)}>{employeeName}</div>

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

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={dataRow}>
      <span style={dataLabel}>{label}:</span>
      <strong style={dataValue}>{value}</strong>
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
  if (typeof window === "undefined") return null;

  const keys = ["finance_branch_user", "finance_user"];

  for (const key of keys) {
    const value = localStorage.getItem(key);

    if (!value) continue;

    try {
      const parsed = JSON.parse(value) as FinanceSessionUser;

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeRole(role?: string) {
  return String(role || "").trim().toLowerCase();
}

function formatNoteNumber(value: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return String(Math.trunc(numericValue)).padStart(6, "0");
  }

  return String(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const datePart = String(value).slice(0, 10);
  const parts = datePart.split("-");

  if (parts.length !== 3) {
    return value;
  }

  const [year, month, day] = parts;

  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function amountToArabicWords(value: number) {
  const safeValue = Math.abs(value);
  const riyals = Math.floor(safeValue);
  const halalas = Math.round((safeValue - riyals) * 100);

  const riyalWords =
    riyals === 0 ? "صفر" : integerToArabicWords(riyals);

  let result = `${riyalWords} ريال سعودي`;

  if (halalas > 0) {
    result += ` و${integerToArabicWords(halalas)} هللة`;
  }

  return `${result} فقط لا غير`;
}

function integerToArabicWords(value: number): string {
  const integer = Math.floor(Math.abs(value));

  if (integer === 0) return "صفر";

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
    const count = Math.floor(remaining / group.value);

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
    parts.push(numberBelowThousandToArabic(remaining));
  }

  return parts.filter(Boolean).join(" و");
}

function renderArabicScale(
  count: number,
  singular: string,
  dual: string,
  plural: string
) {
  if (count === 1) return singular;
  if (count === 2) return dual;

  if (count >= 3 && count <= 10) {
    return `${numberBelowThousandToArabic(count)} ${plural}`;
  }

  return `${numberBelowThousandToArabic(count)} ${singular}`;
}

function numberBelowThousandToArabic(value: number): string {
  const number = Math.floor(value);

  if (number === 0) return "";

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
        parts.push(`${units[unit]} و${tens[ten]}`);
      } else {
        parts.push(tens[ten]);
      }
    }
  }

  return parts.join(" و");
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
    boxSizing: "border-box",
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
    outline: "none",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    boxShadow: "none",
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
    gridTemplateColumns:
      "minmax(250px,315px) 1fr minmax(220px,315px)",
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

function getEmployeeNameStyle(isMobile: boolean): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
    textShadow: "0 4px 10px rgba(15,23,42,0.18)",
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
    fontFamily: "var(--font-almarai), sans-serif",
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
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents: "none",
    order: screen === "desktop" ? 0 : 1,
  };
}

function getTitleStyle(screen: ScreenType): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize:
      screen === "mobile" ? 26 : screen === "tablet" ? 28 : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    textShadow: "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-almarai), sans-serif",
  };
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  if (screen !== "desktop") {
    return {
      display: "none",
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
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
  color: "rgba(255,255,255,0.96)",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background: "rgba(255,255,255,0.30)",
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
  fontFamily: "var(--font-almarai), sans-serif",
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
  background: "rgba(255,255,255,0.075)",
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
  background: "rgba(255,255,255,0.045)",
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
  background: "rgba(255,255,255,0.035)",
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

const previewScroller: CSSProperties = {
  width: "100%",
  overflowX: "auto",
  paddingBottom: 8,
  WebkitOverflowScrolling: "touch",
};

const printSheet: CSSProperties = {
  width: "210mm",
  height: "297mm",
  minHeight: "297mm",
  maxHeight: "297mm",
  margin: "0 auto",
  padding: "8mm 10mm",
  boxSizing: "border-box",
  overflow: "hidden",
  background: "#ffffff",
  color: "#111827",
  display: "flex",
  flexDirection: "column",
  fontFamily: "var(--font-almarai), sans-serif",
  boxShadow: "0 12px 34px rgba(15,23,42,0.12)",
};

const documentHeader: CSSProperties = {
  flex: "0 0 auto",
};

const documentTopMeta: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "8mm",
  borderBottom: "0.3mm solid #cbd5e1",
  paddingBottom: "2.5mm",
  fontSize: "10.5pt",
  lineHeight: 1.5,
};

const documentTitle: CSSProperties = {
  margin: "5mm 0 3mm",
  textAlign: "center",
  color: "#0f172a",
  fontSize: "25pt",
  lineHeight: 1.2,
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
};

const documentAmountBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "4mm",
  padding: "3mm 5mm",
  border: "0.4mm solid #1e3a8a",
  borderRadius: "2.5mm",
  background: "#eff6ff",
};

const documentAmountLabel: CSSProperties = {
  color: "#475569",
  fontSize: "10pt",
  fontWeight: 800,
};

const documentAmountValue: CSSProperties = {
  color: "#1e3a8a",
  fontSize: "14pt",
  fontWeight: 900,
};

const legalBodySection: CSSProperties = {
  marginTop: "4mm",
  flex: "0 0 auto",
};

const legalParagraph: CSSProperties = {
  margin: "1.4mm 0",
  color: "#111827",
  fontSize: "10.4pt",
  lineHeight: 1.75,
  textAlign: "justify",
};

const partyGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: "4mm",
  marginTop: "3.5mm",
  flex: "0 0 auto",
};

const partyBox: CSSProperties = {
  border: "0.3mm solid #cbd5e1",
  borderRadius: "2.5mm",
  padding: "3mm 4mm",
  minWidth: 0,
};

const partyBoxTitle: CSSProperties = {
  margin: "0 0 2mm",
  paddingBottom: "1.5mm",
  borderBottom: "0.25mm solid #e2e8f0",
  color: "#0f2b55",
  fontSize: "11pt",
  fontWeight: 900,
};

const dataRow: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "1.5mm",
  margin: "1.1mm 0",
  minWidth: 0,
  fontSize: "9.5pt",
  lineHeight: 1.45,
};

const dataLabel: CSSProperties = {
  color: "#475569",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const dataValue: CSSProperties = {
  color: "#111827",
  fontWeight: 900,
  overflowWrap: "anywhere",
};

const notesBox: CSSProperties = {
  display: "flex",
  gap: "2mm",
  marginTop: "3mm",
  padding: "2.5mm 3mm",
  border: "0.3mm solid #dbeafe",
  borderRadius: "2mm",
  background: "#f8fbff",
  color: "#334155",
  fontSize: "9.5pt",
  lineHeight: 1.6,
  flex: "0 0 auto",
};

const notesTitle: CSSProperties = {
  color: "#0f2b55",
  whiteSpace: "nowrap",
};

const signatureGrid: CSSProperties = {
  display: "grid",
  gap: "8mm",
  marginTop: "5mm",
  flex: "0 0 auto",
};

const signatureBox: CSSProperties = {
  minHeight: "24mm",
  borderTop: "0.4mm solid #111827",
  paddingTop: "2mm",
};

const signatureTitle: CSSProperties = {
  margin: "0 0 2mm",
  color: "#111827",
  fontSize: "11pt",
  fontWeight: 900,
};

const signatureName: CSSProperties = {
  fontSize: "9.5pt",
  marginBottom: "5mm",
};

const signatureLine: CSSProperties = {
  fontSize: "9.5pt",
  paddingTop: "3mm",
};

const guarantorDetailsBox: CSSProperties = {
  marginTop: "3mm",
  border: "0.3mm solid #cbd5e1",
  borderRadius: "2mm",
  padding: "2.5mm 3mm",
  flex: "0 0 auto",
};

const guarantorTitle: CSSProperties = {
  margin: "0 0 1.5mm",
  color: "#0f2b55",
  fontSize: "10.5pt",
  fontWeight: 900,
};

const guarantorDetailsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  columnGap: "5mm",
};

const legalFooterBox: CSSProperties = {
  marginTop: "auto",
  padding: "3mm 4mm",
  border: "0.4mm solid #475569",
  borderRadius: "2mm",
  background: "#f8fafc",
  color: "#111827",
  fontSize: "8.6pt",
  lineHeight: 1.75,
  fontWeight: 800,
  textAlign: "center",
  whiteSpace: "pre-line",
  flex: "0 0 auto",
};

const actionsArea: CSSProperties = {
  width: "100%",
  maxWidth: 840,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 12,
  margin: "18px auto 0",
};

const pdfButton: CSSProperties = {
  minHeight: 52,
  border: "none",
  borderRadius: 14,
  background:
    "linear-gradient(135deg,#0b3d91,#0d65d9,#22a9e5)",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
  boxShadow: "0 8px 18px rgba(13,101,217,0.22)",
};

const secondaryGreenButton: CSSProperties = {
  minHeight: 52,
  border: "none",
  borderRadius: 14,
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
  boxShadow: "0 8px 18px rgba(22,163,74,0.20)",
};

const bottomBackWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
  marginBottom: 10,
};

const greenBackButton: CSSProperties = {
  minWidth: 116,
  padding: "11px 18px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily: "var(--font-almarai), sans-serif",
};

const loadingBox: CSSProperties = {
  maxWidth: 520,
  margin: "160px auto",
  padding: 28,
  borderRadius: 20,
  textAlign: "center",
  background: "#ffffff",
  border: "1px solid #dbeafe",
  color: "#1e3a8a",
  fontSize: 16,
  fontWeight: 900,
  boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
};

const errorCard: CSSProperties = {
  maxWidth: 620,
  margin: "110px auto 0",
  padding: "38px 20px",
  borderRadius: 20,
  textAlign: "center",
  background: "rgba(255,255,255,0.97)",
  border: "1px solid #fecaca",
  boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
};

const errorIcon: CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: "50%",
  margin: "0 auto 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#fee2e2",
  color: "#b91c1c",
  fontSize: 30,
  fontWeight: 900,
};

const errorTitle: CSSProperties = {
  margin: "0 0 8px",
  color: "#991b1b",
  fontSize: 21,
  fontWeight: 900,
};

const errorText: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.8,
  fontWeight: 800,
};
