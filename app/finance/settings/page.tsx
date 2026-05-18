"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FinanceSettingsPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);

    const { data, error } = await supabase
      .from("finance_settings")
      .select("*")
      .limit(1)
      .single();

    if (!error && data) {
      setOrganizationName(data.organization_name || "");
    }

    setLoading(false);
  }

  async function saveSettings() {
    try {
      setSaving(true);

      const { data } = await supabase
        .from("finance_settings")
        .select("id")
        .limit(1)
        .single();

      if (data?.id) {
        await supabase
          .from("finance_settings")
          .update({
            organization_name: organizationName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
      }

      alert("تم حفظ الإعدادات بنجاح");
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        جاري تحميل الإعدادات...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-2xl shadow-sm border p-6">

        <h1 className="text-2xl font-bold mb-6 text-center">
          إعدادات النظام
        </h1>

        <div className="space-y-2 mb-6">
          <label className="block text-sm font-medium">
            اسم المنظمة
          </label>

          <input
            type="text"
            value={organizationName}
            onChange={(e) =>
              setOrganizationName(e.target.value)
            }
            className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="أدخل اسم المنظمة"
          />
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-medium transition"
        >
          {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </button>

      </div>
    </div>
  );
}
