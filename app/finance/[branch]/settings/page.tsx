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
  const [organizationCommercialRecord, setOrganizationCommercialRecord] =
    useState("");

  const [organizationLogoUrl, setOrganizationLogoUrl] = useState("");
  const [organizationStampUrl, setOrganizationStampUrl] = useState("");
  const [printFooterText, setPrintFooterText] = useState("");
  const [printMargin, setPrintMargin] = useState("8mm");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  function normalizeDigits(value: string) {
    return value
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
      .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString());
  }

  async function loadSettings() {
    setLoading(true);

    const { data, error } = await supabase.from("finance_settings").select("*");

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const getValue = (key: string) =>
      data?.find((x) => x.setting_key === key)?.setting_value || "";

    setOrganizationName(getValue("organization_name"));
    setOrganizationPhone(getValue("organization_phone"));
    setOrganizationCity(getValue("organization_city"));
    setOrganizationCommercialRecord(getValue("organization_commercial_record"));
    setOrganizationLogoUrl(getValue("organization_logo_url"));
    setOrganizationStampUrl(getValue("organization_stamp_url"));
    setPrintFooterText(getValue("print_footer_text"));
    setPrintMargin(getValue("print_margin") || "8mm");

    setLoading(false);
  }

  async function saveSetting(key: string, value: string) {
    const cleanValue = value.trim();

    const { error } = await supabase.from("finance_settings").upsert(
      {
        setting_key: key,
        setting_value: cleanValue,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "setting_key",
      }
    );

    if (error) throw error;
  }

  async function saveSettings() {
    const cleanPhone = normalizeDigits(organizationPhone);
    const cleanCommercialRecord = normalizeDigits(organizationCommercialRecord);

    if (!organizationName.trim()) {
      alert("يرجى إدخال اسم المنظمة");
      return;
    }

    if (!organizationCity.trim()) {
      alert("يرجى إدخال المدينة");
      return;
    }

    if (!cleanCommercialRecord.trim()) {
      alert("يرجى إدخال رقم السجل التجاري");
      return;
    }

    try {
      setSaving(true);

      await saveSetting("organization_name", organizationName);
      await saveSetting("organization_phone", cleanPhone);
      await saveSetting("organization_city", organizationCity);
      await saveSetting(
        "organization_commercial_record",
        cleanCommercialRecord
      );

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
          <h1 style={{ margin: 0 }}>⚙️ إعدادات النظام</h1>
          <p style={headerText}>
            بيانات المنظمة تظهر في العقود والسندات والطباعة الرسمية.
          </p>
        </div>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات المنظمة</h2>

          <Field label="اسم المنظمة">
            <input
              style={input}
              type="text"
              placeholder="مثال: مؤسسة احتساب للتقسيط"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
          </Field>

          <Field label="المدينة">
            <input
              style={input}
              type="text"
              placeholder="مثال: المدينة المنورة"
              value={organizationCity}
              onChange={(e) => setOrganizationCity(e.target.value)}
            />
          </Field>

          <Field label="رقم السجل التجاري">
            <input
              style={input}
              type="text"
              inputMode="numeric"
              placeholder="أدخل رقم السجل التجاري"
              value={organizationCommercialRecord}
              onChange={(e) =>
                setOrganizationCommercialRecord(normalizeDigits(e.target.value))
              }
            />
          </Field>

          <Field label="رقم الجوال - اختياري">
            <input
              style={input}
              type="text"
              inputMode="numeric"
              placeholder="05xxxxxxxx"
              value={organizationPhone}
              onChange={(e) =>
                setOrganizationPhone(normalizeDigits(e.target.value))
              }
            />
          </Field>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>إعدادات الطباعة</h2>

          <Field label="رابط الشعار - اختياري">
            <input
              style={input}
              type="text"
              placeholder="رابط صورة الشعار إن وجد"
              value={organizationLogoUrl}
              onChange={(e) => setOrganizationLogoUrl(e.target.value)}
            />
          </Field>

          <Field label="رابط الختم - اختياري">
            <input
              style={input}
              type="text"
              placeholder="رابط صورة الختم إن وجد"
              value={organizationStampUrl}
              onChange={(e) => setOrganizationStampUrl(e.target.value)}
            />
          </Field>

          <Field label="نص التذييل في الطباعة - اختياري">
            <textarea
              style={textarea}
              placeholder="مثال: للاستفسار يرجى التواصل مع الإدارة"
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
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container = {
  width: "100%",
  maxWidth: 900,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
};

const headerText = {
  margin: "10px 0 0",
  opacity: 0.9,
  fontSize: 15,
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
};

const sectionTitle = {
  marginTop: 0,
  marginBottom: 18,
  color: "#0d47a1",
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
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box" as const,
  background: "white",
};

const textarea = {
  width: "100%",
  minHeight: 90,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box" as const,
  background: "white",
};

const saveButton = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
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
