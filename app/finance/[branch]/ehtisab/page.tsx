"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { createPortal } from "react-dom"
import { useParams, useRouter } from "next/navigation"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import {
  calculateEhtisab,
  calculateHijriAgeMonths,
  getMaxAgeMonths,
  type FinanceType,
  type Sector,
  type Rank,
  type RealEstateType,
  type Product,
  type SupportType,
  type EhtisabResult,
} from "@/lib/ehtisabEngine"

type ScreenType = "mobile" | "tablet" | "desktop"
type CalculationType = "" | "personal" | "real"
type WorkCategory =
  | "civil"
  | "military"
  | "retired"
  | "semi_government"
  | "private"
type ProvidersLoadStatus = "idle" | "loading" | "success" | "error"

type StoredFinanceUser = {
  full_name?: string | null
  username?: string | null
  name?: string | null
}

type FinanceProvider = {
  id: string
  providerName: string
  displayOrder: number
}

type SelectOption = {
  value: string
  label: string
  disabled?: boolean
  description?: string
}

type DropdownRect = {
  top: number
  left: number
  width: number
  openUpward: boolean
}

const CALCULATION_TYPE_OPTIONS: SelectOption[] = [
  {
    value: "personal",
    label: "تمويل شخصي",
  },
  {
    value: "real",
    label: "تمويل عقاري (قريبًا)",
    disabled: true,
  },
  {
    value: "pos",
    label: "تمويل نقاط بيع — قريبًا",
    disabled: true,
  },
]

const SECTOR_OPTIONS: SelectOption[] = [
  { value: "civil", label: "حكومي مدني" },
  { value: "military", label: "حكومي عسكري" },
  { value: "retired", label: "المتقاعدون" },
  { value: "semi_government", label: "القطاع الخاص - شبه حكومي" },
  { value: "private", label: "القطاع الخاص" },
]

const WORK_CATEGORY_BY_SECTOR: Record<Sector, WorkCategory> = {
  civil: "civil",
  military: "military",
  retired: "retired",
  semi_government: "semi_government",
  private: "private",
}

const RANK_OPTIONS: SelectOption[] = [
  { value: "soldier", label: "جندي / جندي أول" },
  { value: "corporal", label: "عريف" },
  { value: "agent", label: "وكيل رقيب" },
  { value: "sergeant", label: "رقيب / رقيب أول" },
  { value: "chief", label: "رئيس رقباء" },
]

const REAL_ESTATE_TYPE_OPTIONS: SelectOption[] = [
  { value: "normal", label: "تمويل عقاري اعتيادي" },
  { value: "supported", label: "تمويل عقاري مدعوم" },
]

const PRODUCT_OPTIONS: SelectOption[] = [
  { value: "ready", label: "شراء وحدة جاهزة" },
  { value: "selfBuild", label: "بناء ذاتي" },
  { value: "land", label: "شراء أرض" },
  { value: "mortgage", label: "رهن عقاري" },
]

const SUPPORT_TYPE_OPTIONS: SelectOption[] = [
  { value: "none", label: "بدون دعم" },
  { value: "monthly", label: "دعم شهري" },
  { value: "package", label: "باقة الدفعة المقدمة" },
]

const BANK_OPTIONS: SelectOption[] = [
  { value: "", label: "بدون تحديد" },
  { value: "البنك الأهلي السعودي", label: "البنك الأهلي السعودي" },
  { value: "مصرف الراجحي", label: "مصرف الراجحي" },
  { value: "بنك الرياض", label: "بنك الرياض" },
  { value: "مصرف الإنماء", label: "مصرف الإنماء" },
  { value: "بنك البلاد", label: "بنك البلاد" },
  { value: "البنك السعودي الفرنسي", label: "البنك السعودي الفرنسي" },
  { value: "ساب", label: "ساب" },
]

function money(n: number) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
}

function normalizeIntegerInput(value: string) {
  return normalizeDigits(value).replace(/[^0-9]/g, "")
}

function normalizeDecimalInput(value: string) {
  const normalized = normalizeDigits(value)
    .replace(/٫/g, ".")
    .replace(/,/g, "")
    .replace(/[^0-9.]/g, "")

  const [integerPart = "", ...decimalParts] = normalized.split(".")

  if (decimalParts.length === 0) {
    return integerPart
  }

  return `${integerPart}.${decimalParts.join("")}`
}

function parseArabicNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0
  }

  const converted = normalizeDigits(String(value))
    .replace(/٫/g, ".")
    .replace(/,/g, "")
    .replace(/[^0-9.]/g, "")

  return converted === "" ? 0 : Number(converted)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFinanceProvider(value: unknown): value is FinanceProvider {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === "string" &&
    typeof value.providerName === "string" &&
    typeof value.displayOrder === "number"
  )
}

function getInitialScreen(): ScreenType {
  if (typeof window === "undefined") {
    return "desktop"
  }

  if (window.innerWidth < 640) {
    return "mobile"
  }

  if (window.innerWidth < 1024) {
    return "tablet"
  }

  return "desktop"
}

export default function EhtisabPage() {
  const router = useRouter()
  const params = useParams<{ branch: string }>()
  const branch = typeof params?.branch === "string" ? params.branch : ""

  const [screen, setScreen] = useState<ScreenType>("desktop")
  const [authChecked, setAuthChecked] = useState(false)
  const [employeeName, setEmployeeName] = useState("الموظف")

  const [calculationType, setCalculationType] =
    useState<CalculationType>("")
  const [sector, setSector] = useState<Sector>("civil")
  const [rank, setRank] = useState<Rank>("agent")

  const [birthY, setBirthY] = useState("")
  const [birthM, setBirthM] = useState("")
  const [birthD, setBirthD] = useState("")

  const [salary, setSalary] = useState("")
  const [deductions, setDeductions] = useState("")
  const [personalAnnualRate, setPersonalAnnualRate] = useState("")
  const [realEstateAnnualRate, setRealEstateAnnualRate] = useState("")
  const [personalMonths, setPersonalMonths] = useState("")
  const [realEstateMonths, setRealEstateMonths] = useState("")
  const [providers, setProviders] = useState<FinanceProvider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState("")
  const [providersLoadStatus, setProvidersLoadStatus] =
    useState<ProvidersLoadStatus>("idle")
  const [providersError, setProvidersError] = useState("")
  const [marginLoading, setMarginLoading] = useState(false)
  const [marginError, setMarginError] = useState("")
  const [autoMarginApplied, setAutoMarginApplied] = useState(false)
  const [manualMarginEdited, setManualMarginEdited] = useState(false)

  const [allowedPersonalMonths, setAllowedPersonalMonths] = useState(0)
  const [allowedRealEstateMonths, setAllowedRealEstateMonths] = useState(0)

  const [realEstateType, setRealEstateType] =
    useState<RealEstateType>("normal")
  const [product, setProduct] = useState<Product>("ready")
  const [supportType, setSupportType] = useState<SupportType>("none")
  const [bank, setBank] = useState("")

  const [result, setResult] = useState<EhtisabResult | null>(null)
  const [sharing, setSharing] = useState(false)
  const providerAbortRef = useRef<AbortController | null>(null)
  const marginAbortRef = useRef<AbortController | null>(null)
  const marginRequestSeqRef = useRef(0)
  const providersLoading = providersLoadStatus === "loading"
  const selectedProviderIsValid = useMemo(
    () =>
      selectedProviderId !== "" &&
      providers.some(provider => provider.id === selectedProviderId),
    [providers, selectedProviderId]
  )

  const resetPersonalMarginMatch = useCallback(() => {
    marginAbortRef.current?.abort()
    marginRequestSeqRef.current += 1
    setPersonalAnnualRate("")
    setMarginLoading(false)
    setMarginError("")
    setAutoMarginApplied(false)
    setManualMarginEdited(false)
    setResult(null)
  }, [])

  useEffect(() => {
    setScreen(getInitialScreen())

    function handleResize() {
      setScreen(getInitialScreen())
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const storedUser = localStorage.getItem("finance_branch_user")

    if (!storedUser) {
      router.replace("/login")
      return
    }

    let parsedUser: StoredFinanceUser | null = null

    try {
      parsedUser = JSON.parse(storedUser) as StoredFinanceUser
    } catch {
      parsedUser = null
    }

    const directName = localStorage.getItem("finance_user_name")?.trim()
    const resolvedName =
      directName ||
      parsedUser?.full_name?.trim() ||
      parsedUser?.username?.trim() ||
      parsedUser?.name?.trim() ||
      "الموظف"

    setEmployeeName(resolvedName)
    setAuthChecked(true)
  }, [router])

  useEffect(() => {
    if (calculationType !== "personal") {
      providerAbortRef.current?.abort()
      setProviders([])
      setSelectedProviderId("")
      setProvidersLoadStatus("idle")
      setProvidersError("")
      resetPersonalMarginMatch()
      return
    }

    providerAbortRef.current?.abort()
    const controller = new AbortController()
    providerAbortRef.current = controller
    setProvidersLoadStatus("loading")
    setProvidersError("")

    async function loadProviders() {
      try {
        const response = await fetch(
          "/api/ehtisab/finance-providers?finance_type=personal",
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        )

        const payload: unknown = await response.json().catch(() => null)

        if (controller.signal.aborted) {
          return
        }

        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          throw new Error("PROVIDERS_LOAD_FAILED")
        }

        if (!Array.isArray(payload.providers)) {
          throw new Error("PROVIDERS_LOAD_FAILED")
        }

        const nextProviders = payload.providers.filter(isFinanceProvider)

        setProviders(nextProviders)
        setProvidersLoadStatus("success")
        setProvidersError("")
      } catch {
        if (controller.signal.aborted) {
          return
        }

        setProviders([])
        setSelectedProviderId("")
        setProvidersLoadStatus("error")
        setProvidersError("تعذر تحميل جهات التمويل، أعد المحاولة")
        resetPersonalMarginMatch()
      }
    }

    loadProviders()

    return () => {
      controller.abort()
    }
  }, [calculationType, resetPersonalMarginMatch])

  useEffect(() => {
    if (
      providersLoadStatus !== "success" ||
      selectedProviderId === "" ||
      selectedProviderIsValid
    ) {
      return
    }

    setSelectedProviderId("")
    resetPersonalMarginMatch()
  }, [
    providersLoadStatus,
    resetPersonalMarginMatch,
    selectedProviderId,
    selectedProviderIsValid,
  ])

  useEffect(() => {
    if (!birthY || !birthM || !birthD) {
      setAllowedPersonalMonths(0)
      setAllowedRealEstateMonths(0)
      setPersonalMonths("")
      setRealEstateMonths("")
      marginAbortRef.current?.abort()
      marginRequestSeqRef.current += 1
      setPersonalAnnualRate("")
      setMarginLoading(false)
      setMarginError("")
      setAutoMarginApplied(false)
      setManualMarginEdited(false)
      return
    }

    const ageMonths = calculateHijriAgeMonths(
      parseArabicNumber(birthY),
      parseArabicNumber(birthM),
      parseArabicNumber(birthD)
    )

    const remaining = Math.max(0, getMaxAgeMonths(sector, rank) - ageMonths)
    const personalAllowed = Math.min(60, remaining)
    const realAllowed = Math.min(360, remaining)

    setAllowedPersonalMonths(personalAllowed)
    setAllowedRealEstateMonths(realAllowed)
    setPersonalMonths(String(personalAllowed))
    setRealEstateMonths(String(realAllowed))
    marginAbortRef.current?.abort()
    marginRequestSeqRef.current += 1
    setPersonalAnnualRate("")
    setMarginLoading(false)
    setMarginError("")
    setAutoMarginApplied(false)
    setManualMarginEdited(false)
  }, [birthY, birthM, birthD, sector, rank])

  useEffect(() => {
    if (manualMarginEdited) {
      return
    }

    if (
      calculationType !== "personal" ||
      providersLoadStatus !== "success"
    ) {
      marginAbortRef.current?.abort()
      marginRequestSeqRef.current += 1
      setMarginLoading(false)
      setAutoMarginApplied(false)
      return
    }

    const providerId = selectedProviderId.trim()
    const workCategory = WORK_CATEGORY_BY_SECTOR[sector]
    const salaryValue = parseArabicNumber(salary)
    const termMonths = parseArabicNumber(personalMonths)

    if (
      !providerId ||
      !selectedProviderIsValid ||
      !workCategory ||
      !Number.isFinite(salaryValue) ||
      salaryValue <= 0 ||
      !Number.isFinite(termMonths) ||
      !Number.isSafeInteger(termMonths) ||
      termMonths <= 0
    ) {
      marginAbortRef.current?.abort()
      marginRequestSeqRef.current += 1
      setPersonalAnnualRate("")
      setMarginLoading(false)
      setMarginError("")
      setAutoMarginApplied(false)
      return
    }

    const requestSeq = marginRequestSeqRef.current + 1
    marginRequestSeqRef.current = requestSeq
    marginAbortRef.current?.abort()

    const controller = new AbortController()
    marginAbortRef.current = controller
    setMarginLoading(true)
    setMarginError("")
    setAutoMarginApplied(false)
    setPersonalAnnualRate("")

    const snapshot = {
      financeType: "personal",
      providerId,
      workCategory,
      salary: salaryValue,
      termMonths,
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/ehtisab/margin-match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          signal: controller.signal,
          body: JSON.stringify(snapshot),
        })

        const payload: unknown = await response.json().catch(() => null)

        if (
          controller.signal.aborted ||
          marginRequestSeqRef.current !== requestSeq
        ) {
          return
        }

        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          throw new Error("تعذر تحديد هامش الربح تلقائيًا")
        }

        const matchedMargin =
          typeof payload.matchedMargin === "number"
            ? payload.matchedMargin
            : typeof payload.matchedMargin === "string"
              ? Number(payload.matchedMargin)
              : NaN

        if (
          !Number.isFinite(matchedMargin) ||
          matchedMargin <= 0 ||
          matchedMargin > 100
        ) {
          throw new Error("تعذر تحديد هامش الربح تلقائيًا")
        }

        setPersonalAnnualRate(String(matchedMargin))
        setAutoMarginApplied(true)
        setMarginError("")
      } catch {
        if (
          controller.signal.aborted ||
          marginRequestSeqRef.current !== requestSeq
        ) {
          return
        }

        setPersonalAnnualRate("")
        setAutoMarginApplied(false)
        setMarginError("تعذر تحديد هامش الربح تلقائيًا")
      } finally {
        if (
          !controller.signal.aborted &&
          marginRequestSeqRef.current === requestSeq
        ) {
          setMarginLoading(false)
        }
      }
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    calculationType,
    manualMarginEdited,
    personalMonths,
    providersLoadStatus,
    salary,
    sector,
    selectedProviderId,
    selectedProviderIsValid,
  ])

  useEffect(() => {
    if (realEstateType !== "supported") {
      setSupportType("none")
    }
  }, [realEstateType])

  function handleLogout() {
    localStorage.removeItem("finance_user")
    localStorage.removeItem("finance_user_name")
    localStorage.removeItem("finance_branch_user")
    localStorage.removeItem("finance_role")
    router.replace("/login")
  }

  function handleCalculationTypeChange(value: CalculationType) {
    if (value === "real") {
      return
    }

    setCalculationType(value)
    setResult(null)

    providerAbortRef.current?.abort()
    marginAbortRef.current?.abort()
    marginRequestSeqRef.current += 1
    setSelectedProviderId("")
    setPersonalAnnualRate("")
    setMarginLoading(false)
    setMarginError("")
    setAutoMarginApplied(false)
    setManualMarginEdited(false)

    if (value !== "personal") {
      setProviders([])
      setProvidersLoadStatus("idle")
      setProvidersError("")
    }
  }

  function handleProviderChange(value: string) {
    setSelectedProviderId(value)
    resetPersonalMarginMatch()
  }

  function handleSectorChange(value: string) {
    setSector(value as Sector)
    resetPersonalMarginMatch()
  }

  function handleSalaryChange(value: string) {
    setSalary(value)
    resetPersonalMarginMatch()
  }

  function handlePersonalAnnualRateChange(value: string) {
    marginAbortRef.current?.abort()
    marginRequestSeqRef.current += 1
    setManualMarginEdited(true)
    setAutoMarginApplied(false)
    setMarginError("")
    setMarginLoading(false)
    setPersonalAnnualRate(value)
  }

  function handleCalculate() {
    if (!calculationType) {
      alert("اختر نوع التمويل أولًا")
      return
    }

    if (calculationType === "personal") {
      if (
        providersLoadStatus === "idle" ||
        providersLoadStatus === "loading"
      ) {
        alert("انتظر حتى يكتمل تحميل جهات التمويل")
        return
      }

      if (providersLoadStatus === "error") {
        alert("تعذر تحميل جهات التمويل، أعد المحاولة")
        return
      }

      if (providers.length === 0) {
        alert("لا توجد جهات تمويل مفعلة حاليًا")
        return
      }

      if (!selectedProviderId) {
        alert("اختر جهة التمويل أولًا")
        return
      }

      if (!selectedProviderIsValid) {
        setSelectedProviderId("")
        resetPersonalMarginMatch()
        alert("جهة التمويل المختارة لم تعد متاحة، اختر جهة أخرى")
        return
      }

      const personalRate = parseArabicNumber(personalAnnualRate)

      if (
        !Number.isFinite(personalRate) ||
        personalRate <= 0 ||
        personalRate > 100
      ) {
        alert("أدخل هامش ربح صحيح")
        return
      }
    }

    const res = calculateEhtisab({
      financeType: calculationType as FinanceType,
      sector,
      rank,
      birthHijriYear: parseArabicNumber(birthY),
      birthHijriMonth: parseArabicNumber(birthM),
      birthHijriDay: parseArabicNumber(birthD),
      salary: parseArabicNumber(salary),
      deductions: parseArabicNumber(deductions),
      personalAnnualRate: parseArabicNumber(personalAnnualRate),
      realEstateAnnualRate: parseArabicNumber(realEstateAnnualRate),
      personalMonths: parseArabicNumber(personalMonths),
      realEstateMonths: parseArabicNumber(realEstateMonths),
      realEstateType,
      product,
      supportType,
      bank,
      flexEnabled: false,
      flexFirstInstallment: 500,
    })

    setResult(res)

    window.setTimeout(() => {
      document.getElementById("ehtisab-report")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 80)
  }

  function changePersonalMonths(value: string) {
    const normalizedValue = normalizeIntegerInput(value)
    const months = parseArabicNumber(normalizedValue)

    if (months > allowedPersonalMonths) {
      alert("عدد الأشهر المدخلة يتجاوز المسموح")
      setPersonalMonths(String(allowedPersonalMonths))
      resetPersonalMarginMatch()
      return
    }

    setPersonalMonths(normalizedValue)
    resetPersonalMarginMatch()
  }

  function changeRealMonths(value: string) {
    const normalizedValue = normalizeIntegerInput(value)
    const months = parseArabicNumber(normalizedValue)

    if (months > allowedRealEstateMonths) {
      alert("عدد الأشهر المدخلة يتجاوز المسموح")
      setRealEstateMonths(String(allowedRealEstateMonths))
      return
    }

    setRealEstateMonths(normalizedValue)
  }

  async function shareResultPDF() {
    if (sharing) {
      return
    }

    const element = document.getElementById("ehtisab-report")
    if (!element) {
      return
    }

    try {
      setSharing(true)

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      })

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF("p", "mm", "a4")
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const pdfBlob = pdf.output("blob")
      const file = new File([pdfBlob], "ehtisab-result.pdf", {
        type: "application/pdf",
      })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "نتيجة احتساب التمويل",
          text: "نتيجة احتساب التمويل",
          files: [file],
        })
      } else {
        pdf.save("ehtisab-result.pdf")
      }
    } catch (error) {
      console.error("Share calculation result failed:", error)
      alert("تعذرت مشاركة النتيجة حاليًا")
    } finally {
      setSharing(false)
    }
  }

  if (!authChecked) {
    return (
      <main dir="rtl" style={getPageStyle(screen)}>
        <div style={loadingCardStyle}>
          <span style={loadingSpinnerStyle} />
          <span>جارٍ التحقق من تسجيل الدخول...</span>
        </div>
      </main>
    )
  }

  return (
    <main dir="rtl" style={getPageStyle(screen)}>
      <div style={getContainerStyle(screen)}>
        <header style={getHeroStyle(screen)}>
          <div style={heroCircleOneStyle} />
          <div style={heroCircleTwoStyle} />
          <div style={heroCircleThreeStyle} />
          <div style={heroDotsStyle} />

          <div style={getHeroContentStyle(screen)}>
            <div style={getHeroUserCardStyle(screen)}>
              <div style={employeeTopRowStyle}>
                <div style={employeeIconStyle}>👤</div>

                <div style={{ minWidth: 0 }}>
                  <div style={employeeLabelStyle}>الموظف</div>
                  <div style={getEmployeeNameStyle(screen)}>{employeeName}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                style={logoutButtonStyle}
              >
                تسجيل الخروج
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>احتساب التمويل</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)}>
              <button
                type="button"
                onClick={() => router.push(`/finance/${branch}`)}
                style={mainWorkstationButtonStyle}
              >
                <span>🏠</span>
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>
          </div>
        </header>

        <div
          role="note"
          style={getResponsibleFinanceNoticeStyle(screen)}
        >
          يتم الاحتساب وفقًا لمبادئ التمويل المسؤول للأفراد حسب تعليمات البنك المركزي السعودي
        </div>

        <section style={getCardStyle(screen)}>
          <SectionHeading
            icon="🧮"
            title="ابدأ الاحتساب"
            badge="اختر نوع التمويل"
          />

          <Field label="نوع التمويل" fullWidth>
            <CustomSelect
              value={calculationType}
              placeholder="اختر نوع التمويل"
              options={CALCULATION_TYPE_OPTIONS}
              onChange={value =>
                handleCalculationTypeChange(value as CalculationType)
              }
            />
          </Field>

          {calculationType === "personal" && (
            <Field label="جهة التمويل" fullWidth>
              <CustomSelect
                value={selectedProviderId}
                placeholder={
                  providersLoading
                    ? "جاري تحميل جهات التمويل..."
                    : "اختر جهة التمويل"
                }
                options={providers.map(provider => ({
                  value: provider.id,
                  label: provider.providerName,
                }))}
                onChange={handleProviderChange}
              />

              {providersLoading && (
                <HelperMessage tone="info">
                  جاري تحميل جهات التمويل...
                </HelperMessage>
              )}

              {!providersLoading && providersError && (
                <HelperMessage tone="danger">
                  {providersError}
                </HelperMessage>
              )}

              {providersLoadStatus === "success" &&
                providers.length === 0 && (
                  <HelperMessage tone="info">
                    لا توجد جهات تمويل مفعلة حاليًا
                  </HelperMessage>
                )}
            </Field>
          )}
        </section>

        {calculationType && (
          <section style={getCardStyle(screen)}>
            <SectionHeading
              icon={calculationType === "personal" ? "💳" : "🏠"}
              title={
                calculationType === "personal"
                  ? "بيانات التمويل الشخصي"
                  : "بيانات التمويل العقاري"
              }
              badge="الحقول المطلوبة"
            />

            <div style={getFieldsGridStyle(screen)}>
              <Field label="قطاع العمل">
                <CustomSelect
                  value={sector}
                  placeholder="اختر قطاع العمل"
                  options={SECTOR_OPTIONS}
                  onChange={handleSectorChange}
                />
              </Field>

              {sector === "military" && (
                <Field label="الرتبة العسكرية">
                  <CustomSelect
                    value={rank}
                    placeholder="اختر الرتبة العسكرية"
                    options={RANK_OPTIONS}
                    onChange={value => setRank(value as Rank)}
                  />
                </Field>
              )}

              <Field label="تاريخ الميلاد بالهجري" fullWidth>
                <div style={getBirthDateGridStyle(screen)}>
                  <DatePartInput
                    label="اليوم"
                    maxLength={2}
                    value={birthD}
                    onChange={setBirthD}
                  />

                  <DatePartInput
                    label="الشهر"
                    maxLength={2}
                    value={birthM}
                    onChange={setBirthM}
                  />

                  <DatePartInput
                    label="السنة"
                    maxLength={4}
                    value={birthY}
                    onChange={setBirthY}
                  />
                </div>
              </Field>

              <Field label="صافي الراتب">
                <NumberInput
                  value={salary}
                  placeholder="أدخل صافي الراتب"
                  decimal
                  suffix="ر.س"
                  onChange={handleSalaryChange}
                />
              </Field>

              <Field label="الاستقطاعات الشهرية في سمة">
                <NumberInput
                  value={deductions}
                  placeholder="أدخل إجمالي الاستقطاعات"
                  decimal
                  suffix="ر.س"
                  onChange={setDeductions}
                />
              </Field>

              {calculationType === "personal" && (
                <>
                  <Field label="هامش الربح السنوي للتمويل الشخصي">
                    <NumberInput
                      value={personalAnnualRate}
                      placeholder="مثال: 4.25"
                      decimal
                      suffix="%"
                      onChange={handlePersonalAnnualRateChange}
                    />

                    {marginLoading && (
                      <HelperMessage tone="info">
                        جاري تحديد الهامش تلقائيًا...
                      </HelperMessage>
                    )}

                    {!marginLoading && autoMarginApplied && (
                      <HelperMessage tone="success">
                        تم تحديد الهامش تلقائيًا حسب جهة التمويل
                      </HelperMessage>
                    )}

                    {!marginLoading && marginError && (
                      <HelperMessage tone="danger">
                        {marginError}
                      </HelperMessage>
                    )}
                  </Field>

                  <Field label="عدد أقساط التمويل الشخصي">
                    <NumberInput
                      value={personalMonths}
                      placeholder="عدد الأشهر"
                      suffix="شهر"
                      onChange={changePersonalMonths}
                    />
                    <LimitHint
                      value={allowedPersonalMonths}
                      label="الحد الأعلى المتاح"
                    />
                  </Field>
                </>
              )}

              {calculationType === "real" && (
                <>
                  <Field label="هامش الربح السنوي للتمويل العقاري">
                    <NumberInput
                      value={realEstateAnnualRate}
                      placeholder="مثال: 4.25"
                      decimal
                      suffix="%"
                      onChange={setRealEstateAnnualRate}
                    />
                  </Field>

                  <Field label="عدد أقساط التمويل العقاري">
                    <NumberInput
                      value={realEstateMonths}
                      placeholder="عدد الأشهر"
                      suffix="شهر"
                      onChange={changeRealMonths}
                    />
                    <LimitHint
                      value={allowedRealEstateMonths}
                      label="الحد الأعلى المتاح"
                    />
                  </Field>

                  <Field label="نوع التمويل العقاري">
                    <CustomSelect
                      value={realEstateType}
                      placeholder="اختر نوع التمويل العقاري"
                      options={REAL_ESTATE_TYPE_OPTIONS}
                      onChange={value =>
                        setRealEstateType(value as RealEstateType)
                      }
                    />
                  </Field>

                  <Field label="المنتج العقاري">
                    <CustomSelect
                      value={product}
                      placeholder="اختر المنتج العقاري"
                      options={PRODUCT_OPTIONS}
                      onChange={value => setProduct(value as Product)}
                    />
                  </Field>

                  {realEstateType === "supported" && (
                    <Field label="نوع الدعم">
                      <CustomSelect
                        value={supportType}
                        placeholder="اختر نوع الدعم"
                        options={SUPPORT_TYPE_OPTIONS}
                        onChange={value =>
                          setSupportType(value as SupportType)
                        }
                      />
                    </Field>
                  )}

                  <Field label="البنك — اختياري">
                    <CustomSelect
                      value={bank}
                      placeholder="اختر البنك أو اتركه بدون تحديد"
                      options={BANK_OPTIONS}
                      onChange={setBank}
                    />
                  </Field>
                </>
              )}

              <div style={fullWidthStyle}>
                <button
                  type="button"
                  style={calculateButtonStyle}
                  onClick={handleCalculate}
                >
                  <span style={calculateButtonIconStyle}>🧮</span>
                  <span>احسب التمويل</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {result && (
          <section id="ehtisab-report" style={getResultCardStyle(screen)}>
            <SectionHeading
              icon={result.accepted ? "✅" : "⚠️"}
              title="نتيجة الاحتساب"
              badge={result.accepted ? "مقبول مبدئيًا" : "تعذر الاحتساب"}
            />

            {!result.accepted && <div style={errorStyle}>{result.reason}</div>}

            {result.accepted && (
              <>
                <div style={summaryGridStyle}>
                  <SummaryCard
                    title="العمر"
                    value={`${result.ageYears} سنة`}
                    icon="🎂"
                  />

                  <SummaryCard
                    title="نوع التمويل"
                    value={
                      calculationType === "personal"
                        ? "تمويل شخصي"
                        : "تمويل عقاري"
                    }
                    icon={calculationType === "personal" ? "💳" : "🏠"}
                  />
                </div>

                {result.personal && (
                  <ResultGroup title="التمويل الشخصي" icon="💳">
                    <Row
                      title="عدد الأقساط"
                      value={`${result.personal.months} شهر`}
                    />
                    <Row
                      title="القسط"
                      value={`${money(result.personal.installment)} ر.س`}
                    />
                    <Row
                      title="مبلغ التمويل"
                      value={`${money(result.personal.financeAmount)} ر.س`}
                    />
                    <Row
                      title="الربح"
                      value={`${money(result.personal.profit)} ر.س`}
                    />
                    <Row
                      title="الإجمالي"
                      value={`${money(result.personal.total)} ر.س`}
                    />
                    <Row
                      title="الرسوم"
                      value={`${money(result.personal.fee)} ر.س`}
                    />
                    <Row
                      title="الصافي"
                      value={`${money(result.personal.net)} ر.س`}
                      emphasized
                    />
                  </ResultGroup>
                )}

                {result.realEstate && (
                  <ResultGroup title="التمويل العقاري" icon="🏠">
                    <Row
                      title="عدد الأقساط"
                      value={`${result.realEstate.months} شهر`}
                    />
                    <Row
                      title="نسبة القسط العقاري"
                      value={`${Math.round(result.realEstate.ratio * 100)}%`}
                    />
                    <Row
                      title="قسط الفترة الأولى"
                      value={`${money(result.realEstate.firstInstallment)} ر.س`}
                    />

                    {result.realEstate.secondMonths > 0 && (
                      <>
                        <Row
                          title="عدد أقساط الفترة الثانية"
                          value={`${result.realEstate.secondMonths} شهر`}
                        />
                        <Row
                          title="قسط الفترة الثانية"
                          value={`${money(
                            result.realEstate.secondInstallment
                          )} ر.س`}
                        />
                      </>
                    )}

                    <Row
                      title="مبلغ التمويل"
                      value={`${money(result.realEstate.financeAmount)} ر.س`}
                    />
                    <Row
                      title="الربح"
                      value={`${money(result.realEstate.profit)} ر.س`}
                    />
                    <Row
                      title="الإجمالي"
                      value={`${money(result.realEstate.total)} ر.س`}
                    />
                    <Row
                      title="الرسوم"
                      value={`${money(result.realEstate.fee)} ر.س`}
                    />
                    <Row
                      title="الصافي"
                      value={`${money(result.realEstate.net)} ر.س`}
                      emphasized
                    />
                    <Row
                      title="مبلغ الدفعة المقدمة من العميل"
                      value={`${money(
                        result.realEstate.clientDownPayment
                      )} ر.س`}
                    />
                    <Row
                      title="باقة الدفعة المقدمة"
                      value={`${money(result.realEstate.supportPackage)} ر.س`}
                    />
                    <Row
                      title="قيمة العقار"
                      value={`${money(result.realEstate.propertyValue)} ر.س`}
                      emphasized
                    />
                    <Row
                      title="مبلغ الشيك"
                      value={`${money(result.realEstate.checkAmount)} ر.س`}
                    />
                  </ResultGroup>
                )}
              </>
            )}

            {result.accepted && (
              <button
                type="button"
                onClick={() => void shareResultPDF()}
                style={{
                  ...shareButtonStyle,
                  opacity: sharing ? 0.7 : 1,
                  cursor: sharing ? "not-allowed" : "pointer",
                }}
                disabled={sharing}
                data-html2canvas-ignore="true"
              >
                <span>📤</span>
                <span>{sharing ? "جاري تجهيز الملف..." : "مشاركة النتيجة"}</span>
              </button>
            )}
          </section>
        )}

        <div style={backWrapperStyle}>
          <button
            type="button"
            onClick={() => router.back()}
            style={backButtonStyle}
          >
            ← رجوع
          </button>
        </div>
      </div>

      <GlobalStyles />
    </main>
  )
}

type FieldProps = {
  label: string
  children: ReactNode
  fullWidth?: boolean
}

function Field({ label, children, fullWidth = false }: FieldProps) {
  return (
    <div style={fullWidth ? fullWidthFieldStyle : fieldStyle}>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  )
}

function SectionHeading({
  icon,
  title,
  badge,
}: {
  icon: string
  title: string
  badge?: string
}) {
  return (
    <div style={sectionHeadingStyle}>
      <div style={sectionHeadingTitleWrapStyle}>
        <span style={sectionHeadingIconStyle}>{icon}</span>
        <h2 style={sectionHeadingTitleStyle}>{title}</h2>
      </div>

      {badge && <span style={sectionHeadingBadgeStyle}>{badge}</span>}
    </div>
  )
}

function DatePartInput({
  label,
  maxLength,
  value,
  onChange,
}: {
  label: string
  maxLength: number
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div style={datePartBoxStyle}>
      <span style={datePartLabelStyle}>{label}</span>
      <input
        style={datePartInputStyle}
        inputMode="numeric"
        maxLength={maxLength}
        value={value}
        onChange={event =>
          onChange(normalizeIntegerInput(event.target.value).slice(0, maxLength))
        }
        aria-label={label}
      />
    </div>
  )
}

function NumberInput({
  value,
  placeholder,
  suffix,
  decimal = false,
  onChange,
}: {
  value: string
  placeholder: string
  suffix?: string
  decimal?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div style={numberInputWrapperStyle}>
      <input
        style={numberInputStyle}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        placeholder={placeholder}
        value={value}
        onChange={event =>
          onChange(
            decimal
              ? normalizeDecimalInput(event.target.value)
              : normalizeIntegerInput(event.target.value)
          )
        }
      />

      {suffix && <span style={numberInputSuffixStyle}>{suffix}</span>}
    </div>
  )
}

function LimitHint({ value, label }: { value: number; label: string }) {
  return (
    <div style={limitHintStyle}>
      <span>{label}</span>
      <strong>{value} شهر</strong>
    </div>
  )
}

function HelperMessage({
  children,
  tone,
}: {
  children: ReactNode
  tone: "info" | "success" | "danger"
}) {
  return (
    <div
      style={{
        ...helperMessageStyle,
        ...(tone === "success" ? helperMessageSuccessStyle : {}),
        ...(tone === "danger" ? helperMessageDangerStyle : {}),
      }}
    >
      {children}
    </div>
  )
}

function CustomSelect({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string
  placeholder: string
  options: SelectOption[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState<DropdownRect | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const selectedOption = options.find(option => option.value === value)

  const updateMenuPosition = useCallback(() => {
    if (!wrapperRef.current || typeof window === "undefined") {
      return
    }

    const rect = wrapperRef.current.getBoundingClientRect()
    const viewportPadding = 12
    const preferredWidth = Math.max(rect.width, 310)
    const width = Math.min(preferredWidth, window.innerWidth - viewportPadding * 2)
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - width - viewportPadding
    )
    const estimatedMenuHeight = Math.min(330, options.length * 68 + 18)
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding
    const availableAbove = rect.top - viewportPadding
    const openUpward =
      availableBelow < Math.min(estimatedMenuHeight, 220) &&
      availableAbove > availableBelow

    setMenuRect({
      top: openUpward
        ? Math.max(viewportPadding, rect.top - estimatedMenuHeight - 8)
        : rect.bottom + 8,
      left,
      width,
      openUpward,
    })
  }, [options.length])

  const closeMenu = useCallback(() => {
    setOpen(false)
    setMenuRect(null)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    updateMenuPosition()

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node

      if (wrapperRef.current?.contains(target)) {
        return
      }

      if (menuRef.current?.contains(target)) {
        return
      }

      closeMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu()
      }
    }

    function handlePositionChange() {
      updateMenuPosition()
    }

    document.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("resize", handlePositionChange)
    window.addEventListener("scroll", handlePositionChange, true)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", handlePositionChange)
      window.removeEventListener("scroll", handlePositionChange, true)
    }
  }, [closeMenu, open, options.length, updateMenuPosition])

  return (
    <div ref={wrapperRef} style={selectWrapperStyle}>
      <button
        type="button"
        style={{
          ...selectButtonStyle,
          ...(open ? selectButtonOpenStyle : {}),
        }}
        onClick={() => {
          if (open) {
            closeMenu()
          } else {
            updateMenuPosition()
            setOpen(true)
          }
        }}
        aria-expanded={open}
      >
        <span style={selectTextWrapStyle}>
          <span
            style={selectedOption ? selectValueStyle : selectPlaceholderStyle}
          >
            {selectedOption?.label || placeholder}
          </span>

          {selectedOption?.description && (
            <span style={selectSelectedDescriptionStyle}>
              {selectedOption.description}
            </span>
          )}
        </span>

        <span
          style={{
            ...selectArrowStyle,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>

      {open &&
        menuRect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              ...selectMenuStyle,
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              transformOrigin: menuRect.openUpward ? "bottom" : "top",
            }}
          >
            {options.map(option => (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                disabled={option.disabled}
                style={{
                  ...selectOptionStyle,
                  ...(option.value === value ? selectOptionSelectedStyle : {}),
                  ...(option.disabled ? selectOptionDisabledStyle : {}),
                }}
                onClick={() => {
                  if (option.disabled) {
                    return
                  }

                  onChange(option.value)
                  closeMenu()
                }}
              >
                <span style={selectOptionCheckStyle}>
                  {option.value === value ? "✓" : ""}
                </span>

                <span style={selectOptionContentStyle}>
                  <strong style={selectOptionLabelStyle}>{option.label}</strong>

                  {option.description && (
                    <small style={selectOptionDescriptionStyle}>
                      {option.description}
                    </small>
                  )}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}

type RowProps = {
  title: string
  value: string
  emphasized?: boolean
}

function Row({ title, value, emphasized = false }: RowProps) {
  return (
    <div
      style={{
        ...rowStyle,
        ...(emphasized ? emphasizedRowStyle : {}),
      }}
    >
      <span style={rowTitleStyle}>{title}</span>
      <b style={emphasized ? emphasizedRowValueStyle : rowValueStyle}>
        {value}
      </b>
    </div>
  )
}

type ResultGroupProps = {
  title: string
  icon: string
  children: ReactNode
}

function ResultGroup({ title, icon, children }: ResultGroupProps) {
  return (
    <div style={resultGroupStyle}>
      <div style={resultGroupHeadingStyle}>
        <span style={resultGroupIconStyle}>{icon}</span>
        <h3 style={resultGroupTitleStyle}>{title}</h3>
      </div>

      <div style={resultRowsGridStyle}>{children}</div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon: string
}) {
  return (
    <div style={summaryCardStyle}>
      <span style={summaryCardIconStyle}>{icon}</span>
      <div style={summaryCardContentStyle}>
        <span style={summaryCardTitleStyle}>{title}</span>
        <strong style={summaryCardValueStyle}>{value}</strong>
      </div>
    </div>
  )
}

function GlobalStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        overflow-x: hidden;
      }

      button,
      input {
        -webkit-tap-highlight-color: transparent;
      }

      button:disabled {
        cursor: not-allowed !important;
      }

      input::placeholder {
        color: #94a3b8;
      }

      @keyframes ehtisabSpin {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes ehtisabMenuIn {
        from {
          opacity: 0;
          transform: translateY(-5px) scale(0.985);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `}</style>
  )
}

function getPageStyle(screen: ScreenType): CSSProperties {
  return {
    minHeight: "100vh",
    padding: screen === "mobile" ? 10 : screen === "tablet" ? 16 : 20,
    fontFamily: "var(--font-almarai), sans-serif",
    backgroundColor: "#f6f9ff",
    backgroundImage:
      "radial-gradient(circle at 12% 12%, rgba(56,189,248,0.15), transparent 28%), radial-gradient(circle at 88% 14%, rgba(34,197,94,0.11), transparent 24%), radial-gradient(circle at 82% 88%, rgba(139,92,246,0.08), transparent 26%), linear-gradient(rgba(242,247,255,0.88), rgba(248,250,252,0.94)), url('/backgrounds/v13-finance-bg-1.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: screen === "mobile" ? "scroll" : "fixed",
    color: "#0f172a",
  }
}

function getContainerStyle(screen: ScreenType): CSSProperties {
  return {
    width: "100%",
    maxWidth: screen === "desktop" ? 1120 : 920,
    margin: "0 auto",
  }
}

function getHeroStyle(screen: ScreenType): CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",
    borderRadius: screen === "mobile" ? 20 : 24,
    padding: screen === "mobile" ? "18px 14px" : "22px 24px",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    boxShadow: "0 18px 42px rgba(15, 47, 95, 0.18)",
    isolation: "isolate",
  }
}

function getHeroContentStyle(screen: ScreenType): CSSProperties {
  return {
    position: "relative",
    zIndex: 3,
    display: "grid",
    gridTemplateColumns:
      screen === "desktop" ? "minmax(250px, 1fr) 1.2fr minmax(220px, 1fr)" : "1fr",
    alignItems: "center",
    gap: screen === "mobile" ? 16 : 18,
  }
}

function getHeroUserCardStyle(screen: ScreenType): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minWidth: 0,
    padding: screen === "mobile" ? "10px 12px" : "11px 14px",
    borderRadius: 16,
    background: "rgba(3, 20, 45, 0.24)",
    border: "1px solid rgba(255,255,255,0.18)",
    backdropFilter: "blur(10px)",
    order: screen === "desktop" ? 0 : 2,
  }
}

function getEmployeeNameStyle(screen: ScreenType): CSSProperties {
  return {
    marginTop: 2,
    color: "#ffffff",
    fontSize: screen === "mobile" ? 13 : 14,
    fontWeight: 900,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: screen === "mobile" ? 132 : 190,
  }
}

function getHeroTitleBoxStyle(screen: ScreenType): CSSProperties {
  return {
    textAlign: "center",
    padding: screen === "mobile" ? "3px 0" : "8px 12px",
    order: screen === "desktop" ? 0 : 1,
  }
}

function getTitleStyle(screen: ScreenType): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontFamily: "var(--font-almarai), sans-serif",
    fontWeight: 900,
    fontSize: screen === "mobile" ? 25 : screen === "tablet" ? 29 : 32,
    lineHeight: 1.45,
    textShadow: "0 8px 22px rgba(2, 20, 48, 0.24)",
  }
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  return {
    display: "flex",
    justifyContent: screen === "desktop" ? "flex-end" : "center",
    order: screen === "desktop" ? 0 : 3,
  }
}

function getResponsibleFinanceNoticeStyle(
  screen: ScreenType
): CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    marginTop: screen === "mobile" ? 12 : 14,
    padding:
      screen === "mobile"
        ? "9px 12px"
        : "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(30, 64, 175, 0.16)",
    background: "rgba(239, 246, 255, 0.92)",
    color: "#173b72",
    fontFamily: "var(--font-almarai), sans-serif",
    fontSize: screen === "mobile" ? 11 : 12,
    fontWeight: 800,
    lineHeight: 1.8,
    textAlign: "center",
    boxShadow: "0 8px 20px rgba(30, 64, 175, 0.06)",
  }
}

function getCardStyle(screen: ScreenType): CSSProperties {
  return {
    marginTop: 16,
    padding: screen === "mobile" ? 15 : screen === "tablet" ? 19 : 22,
    borderRadius: screen === "mobile" ? 19 : 22,
    background: "rgba(255,255,255,0.97)",
    border: "1px solid rgba(148,163,184,0.22)",
    boxShadow: "0 14px 34px rgba(15,23,42,0.065)",
    backdropFilter: "blur(12px)",
  }
}

function getResultCardStyle(screen: ScreenType): CSSProperties {
  return {
    ...getCardStyle(screen),
    background: "#ffffff",
    scrollMarginTop: 16,
  }
}

function getFieldsGridStyle(screen: ScreenType): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns:
      screen === "desktop" ? "repeat(2, minmax(0, 1fr))" : "1fr",
    gap: screen === "mobile" ? 14 : 17,
  }
}

function getBirthDateGridStyle(screen: ScreenType): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns:
      screen === "mobile" ? "1fr" : "repeat(3, minmax(0, 1fr))",
    gap: 10,
  }
}

const loadingCardStyle: CSSProperties = {
  width: "min(92%, 440px)",
  margin: "18vh auto 0",
  padding: 22,
  borderRadius: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  textAlign: "center",
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 18px 45px rgba(15,23,42,0.10)",
  fontFamily: "var(--font-almarai), sans-serif",
  fontWeight: 800,
}

const loadingSpinnerStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: "50%",
  border: "3px solid #dbeafe",
  borderTopColor: "#2563eb",
  animation: "ehtisabSpin 0.8s linear infinite",
}

const heroCircleOneStyle: CSSProperties = {
  position: "absolute",
  width: 220,
  height: 220,
  borderRadius: "50%",
  top: -130,
  right: -70,
  background: "rgba(255,255,255,0.10)",
  pointerEvents: "none",
}

const heroCircleTwoStyle: CSSProperties = {
  position: "absolute",
  width: 180,
  height: 180,
  borderRadius: "50%",
  bottom: -120,
  left: "18%",
  background: "rgba(125,211,252,0.13)",
  pointerEvents: "none",
}

const heroCircleThreeStyle: CSSProperties = {
  position: "absolute",
  width: 120,
  height: 120,
  borderRadius: "50%",
  top: -46,
  left: -36,
  border: "20px solid rgba(255,255,255,0.06)",
  pointerEvents: "none",
}

const heroDotsStyle: CSSProperties = {
  position: "absolute",
  insetInlineEnd: 24,
  bottom: 18,
  width: 100,
  height: 50,
  opacity: 0.25,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.85) 1.3px, transparent 1.3px)",
  backgroundSize: "12px 12px",
  pointerEvents: "none",
}

const employeeTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minWidth: 0,
}

const employeeIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.16)",
  fontSize: 16,
}

const employeeLabelStyle: CSSProperties = {
  color: "rgba(255,255,255,0.72)",
  fontSize: 10,
  fontWeight: 700,
}

const logoutButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#ffffff",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
  padding: "7px 0 7px 8px",
  borderInlineStart: "1px solid rgba(255,255,255,0.20)",
}

const mainWorkstationButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.24)",
  borderRadius: 999,
  minHeight: 44,
  padding: "0 16px",
  background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "0 10px 22px rgba(21,128,61,0.28)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
}

const sectionHeadingStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 18,
}

const sectionHeadingTitleWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
}

const sectionHeadingIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 13,
  background: "linear-gradient(135deg,#eff6ff,#dbeafe)",
  display: "grid",
  placeItems: "center",
  fontSize: 20,
  flexShrink: 0,
}

const sectionHeadingTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f3f76",
  fontSize: 18,
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
}

const sectionHeadingBadgeStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
}

const fieldStyle: CSSProperties = {
  display: "block",
  minWidth: 0,
}

const fullWidthFieldStyle: CSSProperties = {
  ...fieldStyle,
  gridColumn: "1 / -1",
}

const fieldLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#1e3a5f",
  fontSize: 13,
  fontWeight: 900,
}

const fullWidthStyle: CSSProperties = {
  gridColumn: "1 / -1",
}

const datePartBoxStyle: CSSProperties = {
  position: "relative",
  minHeight: 58,
  borderRadius: 14,
  border: "1.5px solid #d6e2f1",
  background: "#ffffff",
  overflow: "hidden",
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.025)",
}

const datePartLabelStyle: CSSProperties = {
  position: "absolute",
  top: 7,
  right: 12,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 900,
  pointerEvents: "none",
}

const datePartInputStyle: CSSProperties = {
  width: "100%",
  height: 58,
  padding: "20px 12px 6px",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#0f172a",
  textAlign: "center",
  fontSize: 16,
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
}

const numberInputWrapperStyle: CSSProperties = {
  minHeight: 56,
  display: "flex",
  alignItems: "center",
  borderRadius: 14,
  border: "1.5px solid #d6e2f1",
  background: "#ffffff",
  overflow: "hidden",
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.025)",
}

const numberInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 54,
  padding: "0 14px",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#0f172a",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 15,
  fontWeight: 800,
}

const numberInputSuffixStyle: CSSProperties = {
  alignSelf: "stretch",
  minWidth: 58,
  padding: "0 11px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderInlineStart: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#475569",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
}

const limitHintStyle: CSSProperties = {
  marginTop: 7,
  padding: "7px 9px",
  borderRadius: 10,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 11,
  fontWeight: 800,
}

const helperMessageStyle: CSSProperties = {
  marginTop: 7,
  padding: "8px 10px",
  borderRadius: 10,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1.7,
}

const helperMessageSuccessStyle: CSSProperties = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
}

const helperMessageDangerStyle: CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
}

const selectWrapperStyle: CSSProperties = {
  position: "relative",
  width: "100%",
}

const selectButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 58,
  padding: "10px 14px",
  borderRadius: 14,
  border: "1.5px solid #d6e2f1",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  textAlign: "right",
  direction: "rtl",
  fontFamily: "var(--font-almarai), sans-serif",
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.025)",
}

const selectButtonOpenStyle: CSSProperties = {
  borderColor: "#3b82f6",
  boxShadow: "0 0 0 4px rgba(59,130,246,0.10)",
}

const selectTextWrapStyle: CSSProperties = {
  minWidth: 0,
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 3,
}

const selectValueStyle: CSSProperties = {
  width: "100%",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 900,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  lineHeight: 1.55,
}

const selectPlaceholderStyle: CSSProperties = {
  ...selectValueStyle,
  color: "#64748b",
  fontWeight: 700,
}

const selectSelectedDescriptionStyle: CSSProperties = {
  width: "100%",
  color: "#64748b",
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.5,
  whiteSpace: "normal",
}

const selectArrowStyle: CSSProperties = {
  color: "#2563eb",
  fontSize: 11,
  transition: "transform 0.18s ease",
  flexShrink: 0,
}

const selectMenuStyle: CSSProperties = {
  position: "fixed",
  maxHeight: "min(330px, calc(100vh - 24px))",
  overflowY: "auto",
  padding: 7,
  borderRadius: 15,
  border: "1px solid #cbd8eb",
  background: "#ffffff",
  boxShadow: "0 20px 55px rgba(15,23,42,0.24)",
  zIndex: 300000,
  direction: "rtl",
  animation: "ehtisabMenuIn 0.15s ease both",
  fontFamily: "var(--font-almarai), sans-serif",
}

const selectOptionStyle: CSSProperties = {
  width: "100%",
  minHeight: 52,
  border: "none",
  borderRadius: 11,
  padding: "9px 10px",
  background: "transparent",
  color: "#1e293b",
  textAlign: "right",
  cursor: "pointer",
  display: "grid",
  gridTemplateColumns: "24px minmax(0, 1fr)",
  alignItems: "center",
  gap: 8,
  fontFamily: "var(--font-almarai), sans-serif",
}

const selectOptionSelectedStyle: CSSProperties = {
  background: "linear-gradient(135deg,#eff6ff,#e0f2fe)",
  color: "#1d4ed8",
}

const selectOptionDisabledStyle: CSSProperties = {
  opacity: 0.5,
  cursor: "not-allowed",
  background: "#f8fafc",
}

const selectOptionCheckStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  color: "#2563eb",
  fontSize: 14,
  fontWeight: 900,
}

const selectOptionContentStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 3,
}

const selectOptionLabelStyle: CSSProperties = {
  color: "inherit",
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1.65,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
}

const selectOptionDescriptionStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.6,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
}

const calculateButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 54,
  padding: "13px 18px",
  border: "none",
  borderRadius: 14,
  background: "linear-gradient(135deg, #0f5fae 0%, #0284c7 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(2,132,199,0.22)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
}

const calculateButtonIconStyle: CSSProperties = {
  fontSize: 19,
}

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 10,
  marginBottom: 14,
}

const summaryCardStyle: CSSProperties = {
  minHeight: 78,
  padding: 13,
  borderRadius: 16,
  background: "linear-gradient(135deg,#f8fbff,#eff6ff)",
  border: "1px solid #dbeafe",
  display: "flex",
  alignItems: "center",
  gap: 11,
}

const summaryCardIconStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "#dbeafe",
  fontSize: 20,
  flexShrink: 0,
}

const summaryCardContentStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 3,
}

const summaryCardTitleStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
}

const summaryCardValueStyle: CSSProperties = {
  color: "#0f3f76",
  fontSize: 15,
  fontWeight: 900,
}

const resultGroupStyle: CSSProperties = {
  marginTop: 15,
  padding: 14,
  borderRadius: 18,
  background: "#fbfdff",
  border: "1px solid #e2e8f0",
}

const resultGroupHeadingStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  marginBottom: 12,
}

const resultGroupIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 11,
  display: "grid",
  placeItems: "center",
  background: "#eff6ff",
  fontSize: 17,
}

const resultGroupTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 16,
  fontWeight: 900,
}

const resultRowsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(245px, 1fr))",
  gap: 8,
}

const rowStyle: CSSProperties = {
  minHeight: 52,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "11px 12px",
  borderRadius: 12,
  background: "#ffffff",
  border: "1px solid #e7eef8",
}

const emphasizedRowStyle: CSSProperties = {
  background: "linear-gradient(135deg,#ecfdf5,#f0fdf4)",
  border: "1px solid #bbf7d0",
}

const rowTitleStyle: CSSProperties = {
  color: "#475569",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.6,
}

const rowValueStyle: CSSProperties = {
  color: "#0d5ca8",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
}

const emphasizedRowValueStyle: CSSProperties = {
  ...rowValueStyle,
  color: "#15803d",
}

const shareButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 18,
  minHeight: 50,
  padding: "12px 16px",
  border: "none",
  borderRadius: 13,
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(37,99,235,0.20)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
}

const errorStyle: CSSProperties = {
  marginTop: 4,
  padding: 14,
  borderRadius: 13,
  background: "#fef2f2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  fontWeight: 900,
  lineHeight: 1.7,
}

const backWrapperStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "20px 0 8px",
}

const backButtonStyle: CSSProperties = {
  minWidth: 118,
  padding: "11px 18px",
  border: "none",
  borderRadius: 13,
  background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(21,128,61,0.22)",
}
