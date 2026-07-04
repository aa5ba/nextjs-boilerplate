"use client"

import { useEffect, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
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

type StoredFinanceUser = {
  full_name?: string | null
  username?: string | null
  name?: string | null
}

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

  if (decimalParts.length === 0) return integerPart

  return `${integerPart}.${decimalParts.join("")}`
}

function parseArabicNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0

  const converted = normalizeDigits(String(value))
    .replace(/٫/g, ".")
    .replace(/,/g, "")
    .replace(/[^0-9.]/g, "")

  return converted === "" ? 0 : Number(converted)
}

function getInitialScreen(): ScreenType {
  if (typeof window === "undefined") return "desktop"
  if (window.innerWidth < 640) return "mobile"
  if (window.innerWidth < 1024) return "tablet"
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

  const [allowedPersonalMonths, setAllowedPersonalMonths] = useState(0)
  const [allowedRealEstateMonths, setAllowedRealEstateMonths] = useState(0)

  const [realEstateType, setRealEstateType] =
    useState<RealEstateType>("normal")
  const [product, setProduct] = useState<Product>("ready")
  const [supportType, setSupportType] = useState<SupportType>("none")
  const [bank, setBank] = useState("")

  const [result, setResult] = useState<EhtisabResult | null>(null)

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
    if (!birthY || !birthM || !birthD) {
      setAllowedPersonalMonths(0)
      setAllowedRealEstateMonths(0)
      setPersonalMonths("")
      setRealEstateMonths("")
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
  }, [birthY, birthM, birthD, sector, rank])

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
    setCalculationType(value)
    setResult(null)
  }

  function handleCalculate() {
    if (!calculationType) {
      alert("اختر نوع الاحتساب أولًا")
      return
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
  }

  function changePersonalMonths(value: string) {
    const normalizedValue = normalizeIntegerInput(value)
    const months = parseArabicNumber(normalizedValue)

    if (months > allowedPersonalMonths) {
      alert("عدد الأشهر المدخلة يتجاوز المسموح")
      setPersonalMonths(String(allowedPersonalMonths))
      return
    }

    setPersonalMonths(normalizedValue)
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
    const element = document.getElementById("ehtisab-report")
    if (!element) return

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
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
  }

  if (!authChecked) {
    return (
      <main dir="rtl" style={getPageStyle(screen)}>
        <div style={loadingCardStyle}>جارٍ التحقق من تسجيل الدخول...</div>
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

              <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
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
                محطة العمل الرئيسية
              </button>
            </div>
          </div>
        </header>

        <section style={getCardStyle(screen)}>
          <Field label="نوع الاحتساب">
            <select
              style={inputStyle}
              value={calculationType}
              onChange={event =>
                handleCalculationTypeChange(
                  event.target.value as CalculationType
                )
              }
            >
              <option value="">اختر نوع الاحتساب</option>
              <option value="personal">تمويل شخصي</option>
              <option value="real">تمويل عقاري</option>
              <option value="pos" disabled>
                تمويل نقاط بيع (قريبًا)
              </option>
            </select>
          </Field>
        </section>

        {calculationType && (
          <section style={getCardStyle(screen)}>
            <div style={getFieldsGridStyle(screen)}>
              <Field label="قطاع العمل">
                <select
                  style={inputStyle}
                  value={sector}
                  onChange={event => setSector(event.target.value as Sector)}
                >
                  <option value="civil">حكومي مدني</option>
                  <option value="private">قطاع خاص</option>
                  <option value="military">عسكري</option>
                  <option value="retired">متقاعد</option>
                </select>
              </Field>

              {sector === "military" && (
                <Field label="الرتبة العسكرية">
                  <select
                    style={inputStyle}
                    value={rank}
                    onChange={event => setRank(event.target.value as Rank)}
                  >
                    <option value="soldier">جندي / جندي أول</option>
                    <option value="corporal">عريف</option>
                    <option value="agent">وكيل رقيب</option>
                    <option value="sergeant">رقيب / رقيب أول</option>
                    <option value="chief">رئيس رقباء</option>
                  </select>
                </Field>
              )}

              <Field label="تاريخ الميلاد بالهجري" fullWidth>
                <div style={birthDateGridStyle}>
                  <input
                    style={inputStyle}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="السنة"
                    value={birthY}
                    onChange={event =>
                      setBirthY(normalizeIntegerInput(event.target.value))
                    }
                  />
                  <input
                    style={inputStyle}
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="الشهر"
                    value={birthM}
                    onChange={event =>
                      setBirthM(normalizeIntegerInput(event.target.value))
                    }
                  />
                  <input
                    style={inputStyle}
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="اليوم"
                    value={birthD}
                    onChange={event =>
                      setBirthD(normalizeIntegerInput(event.target.value))
                    }
                  />
                </div>
              </Field>

              <Field label="صافي الراتب">
                <input
                  style={inputStyle}
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={salary}
                  onChange={event =>
                    setSalary(normalizeDecimalInput(event.target.value))
                  }
                />
              </Field>

              <Field label="الاستقطاعات الشهرية في سمة">
                <input
                  style={inputStyle}
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={deductions}
                  onChange={event =>
                    setDeductions(normalizeDecimalInput(event.target.value))
                  }
                />
              </Field>

              {calculationType === "personal" && (
                <>
                  <Field label="هامش الربح السنوي للتمويل الشخصي">
                    <input
                      style={inputStyle}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={personalAnnualRate}
                      onChange={event =>
                        setPersonalAnnualRate(
                          normalizeDecimalInput(event.target.value)
                        )
                      }
                    />
                  </Field>

                  <Field
                    label={`عدد الأقساط المتاحة للتمويل الشخصي - ${allowedPersonalMonths}`}
                  >
                    <input
                      style={inputStyle}
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={personalMonths}
                      onChange={event =>
                        changePersonalMonths(event.target.value)
                      }
                    />
                  </Field>
                </>
              )}

              {calculationType === "real" && (
                <>
                  <Field label="هامش الربح السنوي للتمويل العقاري">
                    <input
                      style={inputStyle}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={realEstateAnnualRate}
                      onChange={event =>
                        setRealEstateAnnualRate(
                          normalizeDecimalInput(event.target.value)
                        )
                      }
                    />
                  </Field>

                  <Field
                    label={`عدد الأقساط المتاحة للتمويل العقاري - ${allowedRealEstateMonths}`}
                  >
                    <input
                      style={inputStyle}
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={realEstateMonths}
                      onChange={event => changeRealMonths(event.target.value)}
                    />
                  </Field>

                  <Field label="نوع التمويل العقاري">
                    <select
                      style={inputStyle}
                      value={realEstateType}
                      onChange={event =>
                        setRealEstateType(
                          event.target.value as RealEstateType
                        )
                      }
                    >
                      <option value="normal">اعتيادي</option>
                      <option value="supported">مدعوم</option>
                    </select>
                  </Field>

                  <Field label="المنتج العقاري">
                    <select
                      style={inputStyle}
                      value={product}
                      onChange={event =>
                        setProduct(event.target.value as Product)
                      }
                    >
                      <option value="ready">شراء وحدة جاهزة</option>
                      <option value="selfBuild">بناء ذاتي</option>
                      <option value="land">شراء أرض</option>
                      <option value="mortgage">رهن عقاري</option>
                    </select>
                  </Field>

                  {realEstateType === "supported" && (
                    <Field label="نوع الدعم">
                      <select
                        style={inputStyle}
                        value={supportType}
                        onChange={event =>
                          setSupportType(event.target.value as SupportType)
                        }
                      >
                        <option value="none">بدون</option>
                        <option value="monthly">دعم شهري</option>
                        <option value="package">باقة الدفعة المقدمة</option>
                      </select>
                    </Field>
                  )}

                  <Field label="البنك (اختياري)">
                    <select
                      style={inputStyle}
                      value={bank}
                      onChange={event => setBank(event.target.value)}
                    >
                      <option value="">بدون تحديد</option>
                      <option value="البنك الأهلي السعودي">
                        البنك الأهلي السعودي
                      </option>
                      <option value="مصرف الراجحي">مصرف الراجحي</option>
                      <option value="بنك الرياض">بنك الرياض</option>
                      <option value="مصرف الإنماء">مصرف الإنماء</option>
                      <option value="بنك البلاد">بنك البلاد</option>
                      <option value="البنك السعودي الفرنسي">
                        البنك السعودي الفرنسي
                      </option>
                      <option value="ساب">ساب</option>
                    </select>
                  </Field>
                </>
              )}

              <div style={fullWidthStyle}>
                <button
                  type="button"
                  style={calculateButtonStyle}
                  onClick={handleCalculate}
                >
                  احسب
                </button>
              </div>
            </div>
          </section>
        )}

        {result && (
          <section id="ehtisab-report" style={getResultCardStyle(screen)}>
            <h2 style={resultTitleStyle}>النتائج</h2>

            {!result.accepted && (
              <div style={errorStyle}>{result.reason}</div>
            )}

            {result.accepted && (
              <>
                <Row title="العمر" value={`${result.ageYears} سنة`} />

                {result.personal && (
                  <ResultGroup title="التمويل الشخصي">
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
                    />
                  </ResultGroup>
                )}

                {result.realEstate && (
                  <ResultGroup title="التمويل العقاري">
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
                      value={`${money(
                        result.realEstate.firstInstallment
                      )} ر.س`}
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
                      value={`${money(
                        result.realEstate.financeAmount
                      )} ر.س`}
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
                    />
                    <Row
                      title="مبلغ الدفعة المقدمة من العميل"
                      value={`${money(
                        result.realEstate.clientDownPayment
                      )} ر.س`}
                    />
                    <Row
                      title="باقة الدفعة المقدمة"
                      value={`${money(
                        result.realEstate.supportPackage
                      )} ر.س`}
                    />
                    <Row
                      title="قيمة العقار"
                      value={`${money(
                        result.realEstate.propertyValue
                      )} ر.س`}
                    />
                    <Row
                      title="مبلغ الشيك"
                      value={`${money(
                        result.realEstate.checkAmount
                      )} ر.س`}
                    />
                  </ResultGroup>
                )}
              </>
            )}

            {result.accepted && (
              <button
                type="button"
                onClick={shareResultPDF}
                style={shareButtonStyle}
                data-html2canvas-ignore="true"
              >
                مشاركة النتيجة
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
    <label style={fullWidth ? fullWidthFieldStyle : fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  )
}

type RowProps = {
  title: string
  value: string
}

function Row({ title, value }: RowProps) {
  return (
    <div style={rowStyle}>
      <span style={rowTitleStyle}>{title}</span>
      <b style={rowValueStyle}>{value}</b>
    </div>
  )
}

type ResultGroupProps = {
  title: string
  children: ReactNode
}

function ResultGroup({ title, children }: ResultGroupProps) {
  return (
    <div style={resultGroupStyle}>
      <h3 style={resultGroupTitleStyle}>{title}</h3>
      {children}
    </div>
  )
}

function getPageStyle(screen: ScreenType): CSSProperties {
  return {
    minHeight: "100vh",
    padding: screen === "mobile" ? 10 : screen === "tablet" ? 16 : 24,
    fontFamily: "var(--font-almarai), sans-serif",
    backgroundImage:
      "radial-gradient(circle at 12% 8%, rgba(56,189,248,0.12), transparent 28%), radial-gradient(circle at 88% 12%, rgba(34,197,94,0.10), transparent 24%), linear-gradient(rgba(239,246,255,0.88), rgba(248,250,252,0.94)), url('/backgrounds/v13-finance-bg-1.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
    color: "#0f172a",
  }
}

function getContainerStyle(screen: ScreenType): CSSProperties {
  return {
    width: "100%",
    maxWidth: screen === "desktop" ? 1180 : 900,
    margin: "0 auto",
  }
}

function getHeroStyle(screen: ScreenType): CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",
    borderRadius: screen === "mobile" ? 22 : 28,
    padding: screen === "mobile" ? 16 : screen === "tablet" ? 20 : 24,
    background:
      "linear-gradient(125deg, #0f2f5f 0%, #0b5aa6 52%, #0ea5e9 100%)",
    boxShadow: "0 22px 55px rgba(15, 47, 95, 0.24)",
    border: "1px solid rgba(255,255,255,0.18)",
  }
}

function getHeroContentStyle(screen: ScreenType): CSSProperties {
  return {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gridTemplateColumns: screen === "desktop" ? "1fr 1.3fr 1fr" : "1fr",
    alignItems: "center",
    gap: screen === "mobile" ? 12 : 16,
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
    background: "rgba(3, 20, 45, 0.28)",
    border: "1px solid rgba(255,255,255,0.16)",
    backdropFilter: "blur(10px)",
  }
}

function getEmployeeNameStyle(screen: ScreenType): CSSProperties {
  return {
    marginTop: 2,
    color: "#ffffff",
    fontSize: screen === "mobile" ? 13 : 14,
    fontWeight: 800,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: screen === "mobile" ? 125 : 180,
  }
}

function getHeroTitleBoxStyle(screen: ScreenType): CSSProperties {
  return {
    textAlign: "center",
    padding: screen === "mobile" ? "4px 0" : "8px 12px",
  }
}

function getTitleStyle(screen: ScreenType): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontFamily: "var(--font-almarai), sans-serif",
    fontWeight: 900,
    fontSize: screen === "mobile" ? 23 : screen === "tablet" ? 28 : 32,
    letterSpacing: "-0.5px",
    textShadow: "0 8px 22px rgba(2, 20, 48, 0.28)",
  }
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  return {
    display: "flex",
    justifyContent: screen === "desktop" ? "flex-end" : "center",
  }
}

function getCardStyle(screen: ScreenType): CSSProperties {
  return {
    marginTop: 18,
    padding: screen === "mobile" ? 16 : screen === "tablet" ? 20 : 24,
    borderRadius: screen === "mobile" ? 20 : 24,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(148,163,184,0.22)",
    boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
    backdropFilter: "blur(12px)",
  }
}

function getResultCardStyle(screen: ScreenType): CSSProperties {
  return {
    ...getCardStyle(screen),
    background: "#ffffff",
  }
}

function getFieldsGridStyle(screen: ScreenType): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: screen === "desktop" ? "repeat(2, minmax(0, 1fr))" : "1fr",
    gap: screen === "mobile" ? 14 : 18,
  }
}

const loadingCardStyle: CSSProperties = {
  width: "min(92%, 440px)",
  margin: "18vh auto 0",
  padding: 22,
  borderRadius: 20,
  textAlign: "center",
  background: "rgba(255,255,255,0.94)",
  boxShadow: "0 18px 45px rgba(15,23,42,0.10)",
  fontFamily: "var(--font-almarai), sans-serif",
  fontWeight: 700,
}

const heroCircleOneStyle: CSSProperties = {
  position: "absolute",
  width: 220,
  height: 220,
  borderRadius: "50%",
  top: -130,
  right: -70,
  background: "rgba(255,255,255,0.10)",
}

const heroCircleTwoStyle: CSSProperties = {
  position: "absolute",
  width: 180,
  height: 180,
  borderRadius: "50%",
  bottom: -120,
  left: "18%",
  background: "rgba(125,211,252,0.13)",
}

const heroCircleThreeStyle: CSSProperties = {
  position: "absolute",
  width: 120,
  height: 120,
  borderRadius: "50%",
  top: -46,
  left: -36,
  border: "20px solid rgba(255,255,255,0.06)",
}

const heroDotsStyle: CSSProperties = {
  position: "absolute",
  insetInlineEnd: 24,
  bottom: 18,
  width: 100,
  height: 50,
  opacity: 0.25,
  backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 1.3px, transparent 1.3px)",
  backgroundSize: "12px 12px",
}

const employeeTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minWidth: 0,
}

const employeeIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 11,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  background: "rgba(255,255,255,0.14)",
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
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
  padding: "7px 0 7px 8px",
  borderInlineStart: "1px solid rgba(255,255,255,0.20)",
}

const mainWorkstationButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.24)",
  borderRadius: 13,
  padding: "11px 14px",
  background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "0 10px 22px rgba(21,128,61,0.28)",
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
  color: "#1e293b",
  fontSize: 13,
  fontWeight: 800,
}

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  borderRadius: 13,
  border: "1px solid #dbe4f0",
  outline: "none",
  background: "#ffffff",
  color: "#0f172a",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 15,
  fontWeight: 600,
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.03)",
}

const birthDateGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
}

const fullWidthStyle: CSSProperties = {
  gridColumn: "1 / -1",
}

const calculateButtonStyle: CSSProperties = {
  width: "100%",
  padding: "15px 18px",
  border: "none",
  borderRadius: 14,
  background: "linear-gradient(135deg, #0f5fae 0%, #0284c7 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(2,132,199,0.22)",
}

const resultTitleStyle: CSSProperties = {
  margin: "0 0 16px",
  color: "#0f4f8f",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 22,
  fontWeight: 900,
}

const resultGroupStyle: CSSProperties = {
  marginTop: 18,
  paddingTop: 16,
  borderTop: "1px solid #e2e8f0",
}

const resultGroupTitleStyle: CSSProperties = {
  margin: "0 0 12px",
  color: "#0f172a",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 17,
  fontWeight: 900,
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 8,
  padding: "12px 13px",
  borderRadius: 12,
  background: "#f4f8ff",
  border: "1px solid #e7eef8",
}

const rowTitleStyle: CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 700,
}

const rowValueStyle: CSSProperties = {
  color: "#0d5ca8",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 900,
}

const shareButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 20,
  padding: "14px 16px",
  border: "none",
  borderRadius: 13,
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-almarai), sans-serif",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(37,99,235,0.20)",
}

const errorStyle: CSSProperties = {
  marginTop: 12,
  padding: 13,
  borderRadius: 12,
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  fontWeight: 800,
}

const backWrapperStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "22px 0 8px",
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
