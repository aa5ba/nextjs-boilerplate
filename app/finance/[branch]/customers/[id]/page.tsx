"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function FinanceCustomerProfilePage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<any>(null);
  const [activeContracts, setActiveContracts] = useState<any[]>([]);
  const [closedContracts, setClosedContracts] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [birthHijri, setBirthHijri] = useState("");
  const [phone, setPhone] = useState("");
  const [workName, setWorkName] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    loadData();
  }, [branch, customerId]);

  const allContracts = useMemo(
    () => [...activeContracts, ...closedContracts],
    [activeContracts, closedContracts]
  );

  const totalRemaining = useMemo(() => {
    return activeContracts.reduce(
      (sum, contract) => sum + Number(contract?.remaining_amount || 0),
      0
    );
  }, [activeContracts]);

  const totalPaid = useMemo(() => {
    return allContracts.reduce(
      (sum, contract) => sum + Number(contract?.paid_amount || 0),
      0
    );
  }, [allContracts]);

  const hasLateContract = useMemo(() => {
    return activeContracts.some((contract) => contract?.contract_status === "متأخر");
  }, [activeContracts]);

  const customerStatus = hasLateContract
    ? "يوجد تأخير"
    : activeContracts.length > 0
    ? "عميل نشط"
    : closedContracts.length > 0
    ? "عميل سابق"
    : "لا توجد عقود";

  async function loadData() {
    setLoading(true);

    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setCustomer(null);
      setActiveContracts([]);
      setClosedContracts([]);
      setNotes([]);
      setActivities([]);
      setLoading(false);
      return;
    }

    const { data: customerData } = await supabase
      .from("finance_customers")
      .select("*, finance_customer_groups(name)")
      .eq("id", customerId)
      .eq("branch_id", currentBranchId)
      .single();

    const { data: activeData } = await supabase
      .from("finance_contracts")
      .select("*")
      .eq("customer_id", customerId)
      .eq("branch_id", currentBranchId)
      .in("contract_status", ["نشط", "متأخر"])
      .order("created_at", { ascending: false });

    const { data: closedData } = await supabase
      .from("finance_contracts")
      .select("*")
      .eq("customer_id", customerId)
      .eq("branch_id", currentBranchId)
      .in("contract_status", ["تم السداد", "ملغي"])
      .order("created_at", { ascending: false });

    const { data: notesData } = await supabase
      .from("finance_promissory_notes")
      .select("*")
      .eq("customer_id", customerId)
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    const { data: activitiesData } = await supabase
      .from("finance_activity_logs")
      .select("*")
      .eq("customer_id", customerId)
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false })
      .limit(20);

    setCustomer(customerData);
    setActiveContracts(activeData || []);
    setClosedContracts(closedData || []);
    setNotes(notesData || []);
    setActivities(activitiesData || []);

    setFullName(customerData?.full_name || "");
    setNationalId(customerData?.national_id || "");
    setBirthHijri(customerData?.birth_hijri || "");
    setPhone(customerData?.phone || "");
    setWorkName(customerData?.work_name || customerData?.work || "");
    setAddress(customerData?.address || "");

    setLoading(false);
  }

  function normalizeDigits(value: string) {
    return value
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
      .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString());
  }

  async function saveCustomer() {
    if (saving) return;

    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    const cleanNationalId = normalizeDigits(nationalId);
    const cleanPhone = normalizeDigits(phone);

    if (!fullName.trim()) {
      alert("يرجى إدخال اسم العميل");
      return;
    }

    if (cleanNationalId.length !== 10) {
      alert("رقم الهوية يجب أن يكون 10 أرقام");
      return;
    }

    if (!/^05\d{8}$/.test(cleanPhone)) {
      alert("رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05");
      return;
    }

    try {
      setSaving(true);

      const { error: customerError } = await supabase
        .from("finance_customers")
        .update({
          full_name: fullName.trim(),
          national_id: cleanNationalId,
          birth_hijri: birthHijri.trim(),
          phone: cleanPhone,
          work_name: workName.trim(),
          work: workName.trim(),
          address: address.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId)
        .eq("branch_id", branchId);

      if (customerError) {
        throw new Error(customerError.message);
      }

      await supabase
        .from("finance_contracts")
        .update({
          customer_name: fullName.trim(),
          customer_national_id: cleanNationalId,
          customer_birth_hijri: birthHijri.trim(),
          customer_phone: cleanPhone,
          customer_work_name: workName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("customer_id", customerId)
        .eq("branch_id", branchId);

      await supabase
        .from("finance_promissory_notes")
        .update({
          debtor_name: fullName.trim(),
          debtor_national_id: cleanNationalId,
          debtor_phone: cleanPhone,
          updated_at: new Date().toISOString(),
        })
        .eq("customer_id", customerId)
        .eq("branch_id", branchId);

      await supabase.from("finance_activity_logs").insert([
        {
          branch_id: branchId,
          activity_type: "تعديل عميل",
          description: `تم تعديل بيانات العميل ${fullName.trim()}`,
          customer_id: customerId,
          customer_name: fullName.trim(),
          employee_name: "المدير",
          status: "تم التعديل",
        },
      ]);

      alert("تم حفظ بيانات العميل بنجاح");
      setEditing(false);
      await loadData();
    } catch (error: any) {
      alert(error.message || "تعذر حفظ بيانات العميل");
    } finally {
      setSaving(false);
    }
  }

  function cancelEditing() {
    setFullName(customer?.full_name || "");
    setNationalId(customer?.national_id || "");
    setBirthHijri(customer?.birth_hijri || "");
    setPhone(customer?.phone || "");
    setWorkName(customer?.work_name || customer?.work || "");
    setAddress(customer?.address || "");
    setEditing(false);
  }

  function formatDate(date: string) {
    if (!date) return "-";

    return new Date(date).toLocaleString("ar-SA", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function formatMoney(value: any) {
    return Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function openContract(contractId: string) {
    router.push(`/finance/${branch}/contracts/${contractId}`);
  }

  function openPromissoryNote(noteId: string) {
    router.push(`/finance/${branch}/contracts/promissory-note/print/${noteId}`);
  }

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل ملف العميل...</div>
      </main>
    );
  }

  if (!customer) {
    return (
      <main dir="rtl" style={page}>
        <div style={container}>
          <div style={emptyPageCard}>
            <h2 style={{ margin: 0 }}>لم يتم العثور على العميل</h2>
            <p style={emptyPageText}>قد يكون العميل غير موجود أو لا يتبع هذا الفرع.</p>
            <button style={bottomBackButton} onClick={() => router.back()}>
              رجوع
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <header style={header}>
          <div style={headerTop}>
            <button
              style={navButton}
              onClick={() => router.push(`/finance/${branch}`)}
            >
              محطة العمل الرئيسية
            </button>
          </div>

          <div style={heroContent}>
            <div style={avatarCircle}>
              {(customer?.full_name || "ع").trim().slice(0, 1)}
            </div>

            <div style={heroInfo}>
              <p style={headerLabel}>ملف العميل</p>
              <h1 style={headerTitle}>{customer?.full_name || "ملف العميل"}</h1>
              <p style={headerSub}>
                رقم الهوية: {customer?.national_id || "-"} · الجوال:{" "}
                {customer?.phone || "-"}
              </p>
            </div>

            <div
              style={{
                ...statusPill,
                ...(hasLateContract ? statusPillLate : statusPillGood),
              }}
            >
              {customerStatus}
            </div>
          </div>
        </header>

        <section style={statsGrid}>
          <StatCard
            icon="📄"
            title="العقود النشطة"
            value={activeContracts.length}
            hint="نشط / متأخر"
          />

          <StatCard
            icon="✅"
            title="العقود السابقة"
            value={closedContracts.length}
            hint="مسدد / ملغي"
          />

          <StatCard
            icon="💰"
            title="إجمالي المسدد"
            value={`${formatMoney(totalPaid)} ر.س`}
            hint="حسب العقود المسجلة"
          />

          <StatCard
            icon="⚠️"
            title="إجمالي المتبقي"
            value={`${formatMoney(totalRemaining)} ر.س`}
            hint="للعقود الحالية"
          />
        </section>

        <section style={mainGrid}>
          <section style={card}>
            <div style={cardHeader}>
              <div>
                <p style={cardKicker}>البيانات الأساسية</p>
                <h2 style={sectionTitle}>بيانات العميل</h2>
              </div>

              {!editing && (
                <button style={editMiniButton} onClick={() => setEditing(true)}>
                  تعديل البيانات
                </button>
              )}
            </div>

            <div style={infoGrid}>
              <EditableInfo
                label="الاسم كاملاً"
                value={fullName}
                editing={editing}
                onChange={setFullName}
              />

              <EditableInfo
                label="رقم الهوية"
                value={nationalId}
                editing={editing}
                onChange={(value: string) => setNationalId(normalizeDigits(value))}
                inputMode="numeric"
                maxLength={10}
              />

              <EditableInfo
                label="تاريخ الميلاد بالهجري"
                value={birthHijri}
                editing={editing}
                onChange={setBirthHijri}
              />

              <EditableInfo
                label="رقم الجوال"
                value={phone}
                editing={editing}
                onChange={(value: string) => setPhone(normalizeDigits(value))}
                inputMode="numeric"
                maxLength={10}
              />

              <EditableInfo
                label="العمل"
                value={workName}
                editing={editing}
                onChange={setWorkName}
              />

              <EditableInfo
                label="العنوان"
                value={address}
                editing={editing}
                onChange={setAddress}
              />

              <InfoItem label="الراتب" value={customer?.salary || "-"} />
              <InfoItem label="البنك" value={customer?.bank || "-"} />
              <InfoItem label="الوسيط" value={customer?.broker || "-"} />
              <InfoItem
                label="مجموعة العملاء"
                value={customer?.finance_customer_groups?.name || "-"}
              />
            </div>

            {editing && (
              <div style={editActions}>
                <button style={saveButton} onClick={saveCustomer} disabled={saving}>
                  {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>

                <button
                  style={cancelEditButton}
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  إلغاء التعديل
                </button>
              </div>
            )}
          </section>

          <aside style={sideCard}>
            <p style={cardKicker}>مختصر العميل</p>
            <h2 style={sideTitle}>{customerStatus}</h2>

            <div style={sideList}>
              <InfoLine label="عدد السندات" value={notes.length} />
              <InfoLine label="عدد العمليات" value={activities.length} />
              <InfoLine
                label="المجموعة"
                value={customer?.finance_customer_groups?.name || "-"}
              />
              <InfoLine label="آخر تحديث" value={formatDate(customer?.updated_at)} />
            </div>
          </aside>
        </section>

        <section style={twoColumnsGrid}>
          <section style={card}>
            <div style={cardHeader}>
              <div>
                <p style={cardKicker}>العقود</p>
                <h2 style={sectionTitle}>العقود الحالية</h2>
              </div>
              <span style={countBadge}>{activeContracts.length}</span>
            </div>

            {activeContracts.length === 0 ? (
              <div style={emptyBox}>لا توجد عقود حالية</div>
            ) : (
              <div style={listBox}>
                {activeContracts.map((contract) => (
                  <ContractItem
                    key={contract.id}
                    contract={contract}
                    type="active"
                    onClick={() => openContract(contract.id)}
                    formatMoney={formatMoney}
                  />
                ))}
              </div>
            )}
          </section>

          <section style={card}>
            <div style={cardHeader}>
              <div>
                <p style={cardKicker}>الأرشيف</p>
                <h2 style={sectionTitle}>العقود السابقة</h2>
              </div>
              <span style={countBadge}>{closedContracts.length}</span>
            </div>

            {closedContracts.length === 0 ? (
              <div style={emptyBox}>لا توجد عقود سابقة</div>
            ) : (
              <div style={listBox}>
                {closedContracts.map((contract) => (
                  <ContractItem
                    key={contract.id}
                    contract={contract}
                    type="closed"
                    onClick={() => openContract(contract.id)}
                    formatMoney={formatMoney}
                  />
                ))}
              </div>
            )}
          </section>
        </section>

        <section style={twoColumnsGrid}>
          <section style={card}>
            <div style={cardHeader}>
              <div>
                <p style={cardKicker}>السندات</p>
                <h2 style={sectionTitle}>السندات المرتبطة</h2>
              </div>
              <span style={countBadge}>{notes.length}</span>
            </div>

            {notes.length === 0 ? (
              <div style={emptyBox}>لا توجد سندات مرتبطة بالعميل</div>
            ) : (
              <div style={listBox}>
                {notes.map((note) => (
                  <button
                    key={note.id}
                    style={noteItem}
                    onClick={() => openPromissoryNote(note.id)}
                  >
                    <div>
                      <strong>🧾 سند رقم {note.note_number || "-"}</strong>
                      <span style={itemSubText}>
                        الحالة: {note.status || "-"} · المبلغ:{" "}
                        {formatMoney(note.amount)} ر.س
                      </span>
                    </div>
                    <span style={openHint}>فتح</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section style={card}>
            <div style={cardHeader}>
              <div>
                <p style={cardKicker}>السجل</p>
                <h2 style={sectionTitle}>سجل العمليات</h2>
              </div>
              <span style={countBadge}>{activities.length}</span>
            </div>

            {activities.length === 0 ? (
              <div style={emptyBox}>لا توجد عمليات حتى الآن</div>
            ) : (
              <div style={activityList}>
                {activities.map((activity) => (
                  <div key={activity.id} style={activityItem}>
                    <div>
                      <strong>{activity.activity_type || "-"}</strong>
                      <p style={activityDesc}>{activity.description || "-"}</p>
                    </div>

                    <div style={activityMeta}>
                      <span>{activity.status || "-"}</span>
                      <small>{formatDate(activity.created_at)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        <div style={bottomBackWrapper}>
          <button style={bottomBackButton} onClick={() => router.back()}>
            رجوع
          </button>
        </div>
      </div>

      <GlobalResponsiveStyles />
    </main>
  );
}

function StatCard({ icon, title, value, hint }: any) {
  return (
    <div style={statCard}>
      <div style={statIcon}>{icon}</div>
      <div>
        <span style={statTitle}>{title}</span>
        <strong style={statValue}>{value}</strong>
        <small style={statHint}>{hint}</small>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: any) {
  return (
    <div style={infoItem}>
      <span style={infoLabel}>{label}</span>
      <strong style={infoValue}>{value || "-"}</strong>
    </div>
  );
}

function EditableInfo({
  label,
  value,
  editing,
  onChange,
  inputMode,
  maxLength,
}: any) {
  return (
    <div style={infoItem}>
      <span style={infoLabel}>{label}</span>

      {editing ? (
        <input
          style={editInput}
          value={value || ""}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <strong style={infoValue}>{value || "-"}</strong>
      )}
    </div>
  );
}

function InfoLine({ label, value }: any) {
  return (
    <div style={infoLine}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function ContractItem({ contract, type, onClick, formatMoney }: any) {
  const isLate = contract?.contract_status === "متأخر";

  return (
    <button style={contractItem} onClick={onClick}>
      <div style={contractItemTop}>
        <strong>
          {type === "active" ? "📄" : "✅"} عقد رقم{" "}
          {contract.contract_number || "-"}
        </strong>

        <span
          style={{
            ...contractStatusBadge,
            ...(isLate ? contractStatusLate : contractStatusNormal),
          }}
        >
          {contract.contract_status || "-"}
        </span>
      </div>

      <div style={contractItemGrid}>
        <span>المسدد: {formatMoney(contract.paid_amount)} ر.س</span>
        <span>المتبقي: {formatMoney(contract.remaining_amount)} ر.س</span>
        <span>الاستحقاق: {contract.payment_due_date || "-"}</span>
      </div>
    </button>
  );
}

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      @media (max-width: 760px) {
        .hide-on-mobile {
          display: none !important;
        }
      }
    `}</style>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#f4f7fb",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
  color: "#0f172a",
};

const container: CSSProperties = {
  width: "100%",
  maxWidth: 1150,
  margin: "auto",
};

const header: CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  padding: 24,
  borderRadius: 24,
  marginBottom: 18,
  boxShadow: "0 14px 30px rgba(15,23,42,.16)",
};

const headerTop: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: 18,
};

const navButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,.20)",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,.20)",
};

const heroContent: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  flexWrap: "wrap",
};

const avatarCircle: CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 24,
  background: "rgba(255,255,255,.14)",
  border: "1px solid rgba(255,255,255,.22)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#ffffff",
  fontSize: 32,
  fontWeight: 900,
};

const heroInfo: CSSProperties = {
  flex: 1,
  minWidth: 240,
};

const headerLabel: CSSProperties = {
  margin: 0,
  color: "#bfdbfe",
  fontWeight: 900,
  fontSize: 14,
};

const headerTitle: CSSProperties = {
  margin: "4px 0",
  fontSize: 34,
  lineHeight: 1.4,
};

const headerSub: CSSProperties = {
  margin: 0,
  color: "#dbeafe",
  lineHeight: 1.8,
};

const statusPill: CSSProperties = {
  borderRadius: 999,
  padding: "9px 14px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const statusPillGood: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
};

const statusPillLate: CSSProperties = {
  background: "#ffedd5",
  color: "#9a3412",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const statCard: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 18,
  display: "flex",
  alignItems: "center",
  gap: 14,
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const statIcon: CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: 16,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
};

const statTitle: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
};

const statValue: CSSProperties = {
  display: "block",
  color: "#0f172a",
  fontSize: 22,
  marginTop: 3,
};

const statHint: CSSProperties = {
  display: "block",
  color: "#94a3b8",
  marginTop: 3,
  fontWeight: 800,
};

const mainGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,2fr) minmax(280px,.8fr)",
  gap: 16,
  marginBottom: 16,
};

const twoColumnsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: 16,
  marginBottom: 16,
};

const card: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const sideCard: CSSProperties = {
  background: "linear-gradient(135deg,#ffffff,#f8fafc)",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const cardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 14,
  flexWrap: "wrap",
};

const cardKicker: CSSProperties = {
  margin: 0,
  color: "#2563eb",
  fontWeight: 900,
  fontSize: 13,
};

const sectionTitle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 22,
  color: "#0f172a",
};

const sideTitle: CSSProperties = {
  margin: "6px 0 16px",
  fontSize: 24,
  color: "#0f172a",
};

const sideList: CSSProperties = {
  display: "grid",
  gap: 10,
};

const infoLine: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 0",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
};

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
  gap: 12,
};

const infoItem: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  minHeight: 82,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 8,
};

const infoLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
};

const infoValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
  lineHeight: 1.7,
};

const editInput: CSSProperties = {
  width: "100%",
  height: 42,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  padding: "0 12px",
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit",
};

const editActions: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
  marginTop: 16,
};

const editMiniButton: CSSProperties = {
  border: "none",
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const saveButton: CSSProperties = {
  padding: 14,
  background: "#166534",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
};

const cancelEditButton: CSSProperties = {
  padding: 14,
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
};

const countBadge: CSSProperties = {
  minWidth: 34,
  height: 34,
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
};

const listBox: CSSProperties = {
  display: "grid",
  gap: 10,
};

const contractItem: CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 16,
  padding: 14,
  cursor: "pointer",
  textAlign: "right",
  display: "grid",
  gap: 10,
  fontFamily: "inherit",
};

const contractItemTop: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const contractItemGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
  gap: 8,
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
};

const contractStatusBadge: CSSProperties = {
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const contractStatusNormal: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
};

const contractStatusLate: CSSProperties = {
  background: "#ffedd5",
  color: "#9a3412",
};

const noteItem: CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 16,
  padding: 14,
  cursor: "pointer",
  textAlign: "right",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  fontFamily: "inherit",
};

const itemSubText: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 13,
  marginTop: 7,
  fontWeight: 800,
};

const openHint: CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 900,
};

const activityList: CSSProperties = {
  display: "grid",
  gap: 10,
};

const activityItem: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 16,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const activityDesc: CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  lineHeight: 1.7,
  fontSize: 13,
};

const activityMeta: CSSProperties = {
  display: "grid",
  gap: 6,
  textAlign: "left",
  color: "#64748b",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 20,
  textAlign: "center",
  color: "#6b7280",
  fontWeight: 800,
};

const bottomBackWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const bottomBackButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,.20)",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,.20)",
};

const emptyPageCard: CSSProperties = {
  marginTop: 80,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 28,
  textAlign: "center",
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const emptyPageText: CSSProperties = {
  color: "#64748b",
  lineHeight: 1.8,
};

const loadingBox: CSSProperties = {
  textAlign: "center",
  paddingTop: 80,
  fontSize: 18,
  color: "#0f172a",
};
