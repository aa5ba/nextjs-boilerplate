"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function FinanceCustomerProfilePage() {
  const params = useParams();

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

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل ملف العميل...</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>{customer?.full_name || "ملف العميل"}</h1>
        </div>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات العميل</h2>

          <EditableRow
            label="الاسم كاملاً"
            value={fullName}
            editing={editing}
            onChange={setFullName}
          />

          <EditableRow
            label="رقم الهوية"
            value={nationalId}
            editing={editing}
            onChange={(value: string) => setNationalId(normalizeDigits(value))}
            inputMode="numeric"
            maxLength={10}
          />

          <EditableRow
            label="تاريخ الميلاد بالهجري"
            value={birthHijri}
            editing={editing}
            onChange={setBirthHijri}
          />

          <EditableRow
            label="رقم الجوال"
            value={phone}
            editing={editing}
            onChange={(value: string) => setPhone(normalizeDigits(value))}
            inputMode="numeric"
            maxLength={10}
          />

          <EditableRow
            label="العمل"
            value={workName}
            editing={editing}
            onChange={setWorkName}
          />

          <EditableRow
            label="العنوان"
            value={address}
            editing={editing}
            onChange={setAddress}
          />

          <Row label="الراتب" value={customer?.salary || "-"} />
          <Row label="البنك" value={customer?.bank || "-"} />
          <Row label="الوسيط" value={customer?.broker || "-"} />
          <Row
            label="مجموعة العملاء"
            value={customer?.finance_customer_groups?.name || "-"}
          />

          <div style={editActions}>
            {editing ? (
              <>
                <button style={saveButton} onClick={saveCustomer} disabled={saving}>
                  {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>

                <button style={cancelEditButton} onClick={cancelEditing} disabled={saving}>
                  إلغاء التعديل
                </button>
              </>
            ) : (
              <button style={editButton} onClick={() => setEditing(true)}>
                تعديل بيانات العميل
              </button>
            )}
          </div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>العقود الحالية</h2>

          {activeContracts.length === 0 ? (
            <div style={emptyBox}>لا توجد عقود حالية</div>
          ) : (
            activeContracts.map((contract) => (
              <button
                key={contract.id}
                style={itemButton}
                onClick={() =>
                  (window.location.href = `/finance/${branch}/contracts/${contract.id}`)
                }
              >
                📄 عقد رقم {contract.contract_number} -{" "}
                {contract.contract_status} - المتبقي{" "}
                {contract.remaining_amount || 0} ر.س
              </button>
            ))
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>العقود السابقة</h2>

          {closedContracts.length === 0 ? (
            <div style={emptyBox}>لا توجد عقود سابقة</div>
          ) : (
            closedContracts.map((contract) => (
              <button
                key={contract.id}
                style={itemButton}
                onClick={() =>
                  (window.location.href = `/finance/${branch}/contracts/${contract.id}`)
                }
              >
                ✅ عقد رقم {contract.contract_number} -{" "}
                {contract.contract_status} - المسدد {contract.paid_amount || 0}{" "}
                ر.س
              </button>
            ))
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>السندات</h2>

          {notes.length === 0 ? (
            <div style={emptyBox}>لا توجد سندات مرتبطة بالعميل</div>
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                style={itemButton}
                onClick={() =>
                  (window.location.href = `/finance/${branch}/contracts/promissory-note/print/${note.id}`)
                }
              >
                🧾 سند رقم {note.note_number} - {note.amount || 0} ر.س -{" "}
                {note.status || "-"}
              </button>
            ))
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>سجل العمليات</h2>

          {activities.length === 0 ? (
            <div style={emptyBox}>لا توجد عمليات حتى الآن</div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} style={activityRow}>
                <span>{activity.activity_type || "-"}</span>
                <span>{activity.status || "-"}</span>
                <span>{formatDate(activity.created_at)}</span>
              </div>
            ))
          )}
        </section>

        <button style={backButton} onClick={() => window.history.back()}>
          الرجوع للعملاء
        </button>
      </div>
    </main>
  );
}

function Row({ label, value }: any) {
  return (
    <div style={row}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function EditableRow({
  label,
  value,
  editing,
  onChange,
  inputMode,
  maxLength,
}: any) {
  return (
    <div style={row}>
      <span>{label}</span>

      {editing ? (
        <input
          style={editInput}
          value={value || ""}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <strong>{value || "-"}</strong>
      )}
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
};

const sectionTitle = {
  marginTop: 0,
  fontSize: 20,
  color: "#0d47a1",
};

const editInput = {
  width: "55%",
  minWidth: 180,
  height: 42,
  borderRadius: 10,
  border: "1px solid #d9e3f5",
  padding: "0 12px",
  fontSize: 15,
  boxSizing: "border-box" as const,
};

const editActions = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
  marginTop: 18,
};

const editButton = {
  width: "100%",
  padding: 14,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const saveButton = {
  width: "100%",
  padding: 14,
  background: "#166534",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const cancelEditButton = {
  width: "100%",
  padding: 14,
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const emptyBox = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center" as const,
  color: "#6b7280",
};

const itemButton = {
  width: "100%",
  padding: 14,
  background: "#f8fbff",
  border: "1px solid #d9e3f5",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
  marginBottom: 10,
  textAlign: "right" as const,
};

const activityRow = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1.5fr",
  gap: 12,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
};

const loadingBox = {
  textAlign: "center" as const,
  paddingTop: 80,
  fontSize: 18,
};
