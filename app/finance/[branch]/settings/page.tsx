"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function FinanceSettingsPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [organizationName, setOrganizationName] = useState("");
  const [organizationPhone, setOrganizationPhone] = useState("");
  const [organizationCity, setOrganizationCity] = useState("");
  const [commercialRecord, setCommercialRecord] = useState("");

  const [organizationLogoUrl, setOrganizationLogoUrl] = useState("");
  const [organizationStampUrl, setOrganizationStampUrl] = useState("");
  const [printFooterText, setPrintFooterText] = useState("");
  const [printMargin, setPrintMargin] = useState("8mm");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (branch) loadSettings();
  }, [branch]);

  function normalizeDigits(value: string) {
    return value
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
      .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString());
  }

  async function loadSettings() {
    setLoading(true);

    const { data: branchData, error: branchError } = await supabase
      .from("finance_branches")
      .select("organization_name, commercial_record, phone, city")
      .eq("branch_slug", branch)
      .single();

    if (branchError) {
      alert(branchError.message);
      setLoading(false);
      return;
    }

    setOrganizationName(branchData?.organization_name || "");
    setCommercialRecord(branchData?.commercial_record || "");
    setOrganizationPhone(branchData?.phone || "");
    setOrganizationCity(branchData?.city || "");

    const { data: settingsData } = await supabase
      .from("finance_settings")
      .select("*");

    const getValue = (key: string) =>
      settingsData?.find((x) => x.setting_key === key)?.setting_value || "";

    setOrganizationLogoUrl(getValue("organization_logo_url"));
    setOrganizationStampUrl(getValue("organization_stamp_url"));
    setPrintFooterText(getValue("print_footer_text"));
    setPrintMargin(getValue("print_margin") || "8mm");

    setLoading(false);
  }

  async function saveSetting(key: string, value: string) {
    const { error } = await supabase.from("finance_settings").upsert(
      {
        setting_key: key,
        setting_value: value.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setting_key" }
    );

    if (error) throw error;
  }

  async function saveSettings() {
    const cleanPhone = normalizeDigits(organizationPhone);
    const cleanCommercialRecord = normalizeDigits(commercialRecord);

    if (!organizationName.trim()) {
      alert("يرجى إدخال اسم المنظمة");
      return;
    }

    if (!cleanCommercialRecord.trim()) {
      alert("يرجى إدخال رقم السجل التجاري");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("finance_branches")
        .update({
          organization_name: organizationName.trim(),
          commercial_record: cleanCommercialRecord.trim(),
          phone: cleanPhone.trim(),
          city: organizationCity.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("branch_slug", branch);

      if (error) throw error;

      await saveSetting("organization_logo_url", organizationLogoUrl);
      await saveSetting("organization_stamp_url", organizationStampUrl);
      await saveSetting("print_footer_text", printFooterText);
      await saveSetting("print_margin", printMargin);

      alert("تم حفظ الإعدادات بنجاح");
      await loadSettings();
    } catch (error: any) {
      alert(error?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل الإعدادات...</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>⚙️ الإعدادات</h1>
          <p style={headerText}>
            بيانات المنظمة خاصة بهذا الفرع وتظهر في العقود والسندات والطباعة.
          </p>
        </div>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات المنظمة</h2>

          <Field label="اسم المنظمة">
            <input
              style={input}
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
          </Field>

          <Field label="رقم السجل التجاري">
            <input
              style={input}
              type="text"
              inputMode="numeric"
              value={commercialRecord}
              onChange={(e) =>
                setCommercialRecord(normalizeDigits(e.target.value))
              }
            />
          </Field>

          <Field label="رقم الجوال - اختياري">
            <input
              style={input}
              type="text"
              inputMode="numeric"
              value={organizationPhone}
              onChange={(e) =>
                setOrganizationPhone(normalizeDigits(e.target.value))
              }
            />
          </Field>

          <Field label="المدينة - اختياري">
            <input
              style={input}
              type="text"
              value={organizationCity}
              onChange={(e) => setOrganizationCity(e.target.value)}
            />
          </Field>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>إعدادات الطباعة</h2>

          <Field label="رابط الشعار - اختياري">
            <input
              style={input}
              type="text"
              value={organizationLogoUrl}
              onChange={(e) => setOrganizationLogoUrl(e.target.value)}
            />
          </Field>

          <Field label="رابط الختم - اختياري">
            <input
              style={input}
              type="text"
              value={organizationStampUrl}
              onChange={(e) => setOrganizationStampUrl(e.target.value)}
            />
          </Field>

          <Field label="نص التذييل في الطباعة - اختياري">
            <textarea
              style={textarea}
              value={printFooterText}
              onChange={(e) => setPrintFooterText(e.target.value)}
            />
          </Field>

          <Field label="هامش الطباعة">
            <select
              style={input}
              value={printMargin}
              onChange={(e) => setPrintMargin(e.target.value)}
            >
              <option value="6mm">6mm</option>
              <option value="8mm">8mm - المعتمد</option>
              <option value="10mm">10mm</option>
              <option value="12mm">12mm</option>
            </select>
          </Field>

          <button style={saveButton} onClick={saveSettings} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </button>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}`)}
        >
          الرجوع لمحطة العمل الرئيسية
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: any) {
  return (
    <div style={fieldBox}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#f4f7fb",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container = {
  width: "100%",
  maxWidth: 900,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
  boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
};

const headerText = {
  margin: "10px 0 0",
  opacity: 0.9,
  fontSize: 15,
};

const card = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  boxShadow: "0 8px 22px rgba(15,23,42,0.04)",
};

const sectionTitle = {
  marginTop: 0,
  marginBottom: 18,
  color: "#0f172a",
};

const fieldBox = {
  marginBottom: 12,
};

const labelStyle = {
  display: "block",
  marginBottom: 7,
  color: "#0f172a",
  fontWeight: "bold",
  fontSize: 14,
};

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #dbe3ef",
  fontSize: 16,
  boxSizing: "border-box" as const,
  background: "#f8fafc",
};

const textarea = {
  width: "100%",
  minHeight: 90,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #dbe3ef",
  fontSize: 16,
  boxSizing: "border-box" as const,
  background: "#f8fafc",
};

const saveButton = {
  width: "100%",
  padding: 16,
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginTop: 8,
  fontWeight: "bold",
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#16a34a",
  color: "white",
  border: "none",
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
