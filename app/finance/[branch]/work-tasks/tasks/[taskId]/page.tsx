"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import type { WorksheetCommissionType } from "@/lib/workTaskWorksheet"

import styles from "../../workTasks.module.css"
import SmartWorksheet, {
  type SmartWorksheetData,
} from "./SmartWorksheet"
import {
  COMMITMENT_ENTITY_OPTIONS,
  COMMITMENT_STATUS_LABELS,
  COMMITMENT_STATUS_OPTIONS,
  TASK_STATUS_LABELS,
  TASK_STATUS_OPTIONS,
  formatMoney,
  getRequestError,
  normalizeNumericInput,
  relationOne,
  workTasksRequest,
} from "../../shared"

type UserRow = { id: string; full_name: string }
type CustomerRow = { id: string; full_name: string; national_id: string; phone: string }
type GroupRow = { id: string; group_name: string }
type TaskRow = {
  id: string
  group_id: string
  customer_id: string
  task_name: string
  status: string
  assigned_user_id: string
  general_notes: string | null
  approved_salary: number | string | null
  additional_income: number | string | null
  employer_name: string | null
  last_action: string | null
  next_step: string | null
  next_follow_up_at: string | null
  completion_note: string | null
  created_at: string
  updated_at: string
  group: GroupRow | GroupRow[] | null
  customer: CustomerRow | CustomerRow[] | null
  assignee: UserRow | UserRow[] | null
}
type CommitmentRow = {
  id: string
  entity_type: string
  entity_name: string
  commitment_type: string
  remaining_amount: number | string | null
  monthly_installment: number | string | null
  default_amount: number | string | null
  settlement_amount: number | string | null
  status: string
  notes: string | null
}
type OpportunityRow = {
  id: string
  provider_name: string
  expected_amount: number | string | null
  status: string
  notes: string | null
  commission_type: WorksheetCommissionType
  commission_value: number | string | null
}
type FollowupRow = {
  id: string
  action_text: string
  next_step: string | null
  next_follow_up_at: string | null
  created_by_name: string
  created_at: string
}
type OtherTaskRow = {
  id: string
  task_name: string
  status: string
  group: GroupRow | GroupRow[] | null
}
type DetailResponse = {
  ok: true
  data: {
    task: TaskRow
    commitments: CommitmentRow[]
    opportunities: OpportunityRow[]
    followups: FollowupRow[]
    otherTasks: OtherTaskRow[]
    users: UserRow[]
    summary: {
      remainingAmount: number
      monthlyInstallment: number
      remainingIncomplete: boolean
      installmentIncomplete: boolean
      paidCount: number
    }
    worksheet: SmartWorksheetData
  }
}

function dateTimeLocalValue(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
}

const EMPTY_COMMITMENT = {
  id: "",
  entityType: "bank",
  entityName: "",
  commitmentType: "",
  remainingAmount: "",
  monthlyInstallment: "",
  defaultAmount: "",
  settlementAmount: "",
  status: "pending_verification",
  notes: "",
}

export default function WorkTaskDetailPage() {
  const params = useParams<{ branch: string; taskId: string }>()
  const router = useRouter()
  const branch = String(params.branch || "")
  const taskId = String(params.taskId || "")

  const [data, setData] = useState<DetailResponse["data"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [taskForm, setTaskForm] = useState({
    taskName: "", status: "new", assignedUserId: "", generalNotes: "",
    approvedSalary: "", additionalIncome: "", employerName: "", nextStep: "",
    nextFollowUpAt: "", completionNote: "",
  })
  const [commitment, setCommitment] = useState(EMPTY_COMMITMENT)
  const [followup, setFollowup] = useState({ actionText: "", nextStep: "", nextFollowUpAt: "" })
  const [showCommitmentEditor, setShowCommitmentEditor] = useState(false)
  const [commitmentRequestId, setCommitmentRequestId] = useState(() => crypto.randomUUID())
  const [followupRequestId, setFollowupRequestId] = useState(() => crypto.randomUUID())

  const loadTask = useCallback(async () => {
    if (!branch || !taskId) return
    setLoading(true)
    setError("")
    try {
      const search = new URLSearchParams({ branch, view: "task", taskId })
      const response = await workTasksRequest<DetailResponse>(`/finance/api/work-tasks?${search}`)
      setData(response.data)
      const task = response.data.task
      setTaskForm({
        taskName: task.task_name,
        status: task.status,
        assignedUserId: task.assigned_user_id,
        generalNotes: task.general_notes || "",
        approvedSalary: task.approved_salary === null ? "" : String(task.approved_salary),
        additionalIncome: task.additional_income === null ? "" : String(task.additional_income),
        employerName: task.employer_name || "",
        nextStep: task.next_step || "",
        nextFollowUpAt: dateTimeLocalValue(task.next_follow_up_at),
        completionNote: task.completion_note || "",
      })
      setFollowup({
        actionText: task.last_action || "",
        nextStep: task.next_step || "",
        nextFollowUpAt: dateTimeLocalValue(task.next_follow_up_at),
      })
    } catch (loadError) {
      const status = Number((loadError as { status?: number }).status)
      if (status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(`/finance/${branch}/work-tasks/tasks/${taskId}`)}`)
        return
      }
      setError(getRequestError(loadError))
    } finally {
      setLoading(false)
    }
  }, [branch, router, taskId])

  useEffect(() => {
    void loadTask()
  }, [loadTask])

  async function postAction(payload: Record<string, unknown>) {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      await workTasksRequest("/finance/api/work-tasks", {
        method: "POST",
        body: JSON.stringify({ branch, ...payload }),
      })
      setSuccess("تم حفظ التغييرات بنجاح")
      await loadTask()
      return true
    } catch (saveError) {
      setError(getRequestError(saveError))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveUpdate(event: React.FormEvent) {
    event.preventDefault()
    const currentLastAction = data?.task.last_action?.trim() || ""
    const nextAction = followup.actionText.trim()

    const taskSaved = await postAction({
      action: "update_task",
      taskId,
      ...taskForm,
      nextStep: followup.nextStep,
      nextFollowUpAt: followup.nextFollowUpAt,
    })
    if (!taskSaved) return

    if (nextAction && nextAction !== currentLastAction) {
      const saved = await postAction({
        action: "add_followup",
        taskId,
        requestId: followupRequestId,
        ...followup,
      })
      if (saved) setFollowupRequestId(crypto.randomUUID())
    }
  }

  async function saveCommitment(event: React.FormEvent) {
    event.preventDefault()
    const saved = await postAction({
      action: "save_commitment",
      taskId,
      commitmentId: commitment.id || undefined,
      requestId: commitment.id ? undefined : commitmentRequestId,
      ...commitment,
    })
    if (saved) {
      setCommitment(EMPTY_COMMITMENT)
      setCommitmentRequestId(crypto.randomUUID())
      setShowCommitmentEditor(false)
    }
  }

  function openCommitment(item?: CommitmentRow) {
    setCommitment(item ? {
      id: item.id,
      entityType: item.entity_type,
      entityName: item.entity_name,
      commitmentType: item.commitment_type,
      remainingAmount: item.remaining_amount === null ? "" : String(item.remaining_amount),
      monthlyInstallment: item.monthly_installment === null ? "" : String(item.monthly_installment),
      defaultAmount: item.default_amount === null ? "" : String(item.default_amount),
      settlementAmount: item.settlement_amount === null ? "" : String(item.settlement_amount),
      status: item.status,
      notes: item.notes || "",
    } : EMPTY_COMMITMENT)
    setShowCommitmentEditor(true)
  }

  if (loading && !data) {
    return <div className={styles.page}><div className={styles.empty}>جاري تحميل تفاصيل المهمة...</div></div>
  }

  if (!data) {
    return <div className={styles.page}><main className={styles.main}>{error && <div className={styles.error}>{error}</div>}</main></div>
  }

  const task = data.task
  const customer = relationOne(task.customer)

  return (
    <div className={`${styles.page} ${styles.taskDetailPage}`}>
      <nav className={styles.taskTopbar} aria-label="التنقل في محطة العمل">
        <strong>مهام العمل</strong>
        <div className={styles.taskTopbarActions}>
          <button type="button" className={styles.taskBackButton} onClick={() => router.back()}>رجوع</button>
          <button type="button" onClick={() => router.push(`/finance/${branch}`)}>محطة العمل</button>
        </div>
      </nav>

      <main className={styles.taskSheet}>
        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <header className={styles.taskHero}>
          <h1>ورقة مهمة العميل</h1>
          <div className={styles.taskIdentity}>
            <h2>{customer?.full_name || "العميل"}</h2>
            <span className={styles.taskStatus} data-status={taskForm.status}>
              {TASK_STATUS_LABELS[taskForm.status] || taskForm.status}
            </span>
          </div>
        </header>

        <section className={styles.taskCustomerStrip} aria-label="بيانات العميل">
          <label>
            <span>اسم العميل</span>
            <strong>{customer?.full_name || "غير محدد"}</strong>
          </label>
          <label>
            <span>رقم الهاتف</span>
            <strong dir="ltr">{customer?.phone || "غير محدد"}</strong>
          </label>
          <label>
            <span>جهة العمل</span>
            <input value={taskForm.employerName} onChange={event => setTaskForm(value => ({ ...value, employerName: event.target.value }))} placeholder="غير محددة" />
          </label>
          <label>
            <span>الراتب المعتمد</span>
            <input inputMode="decimal" value={taskForm.approvedSalary} onChange={event => setTaskForm(value => ({ ...value, approvedSalary: normalizeNumericInput(event.target.value) }))} placeholder="غير محدد" />
          </label>
          <label>
            <span>حالة المهمة</span>
            <select value={taskForm.status} onChange={event => setTaskForm(value => ({ ...value, status: event.target.value }))}>
              {TASK_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </section>

        <section className={styles.taskSection}>
          <div className={styles.taskSectionHeader}>
            <h2>١. الالتزامات</h2>
            <button
              type="button"
              className={styles.taskAddButton}
              onClick={() => {
                setCommitment(EMPTY_COMMITMENT)
                setShowCommitmentEditor(true)
              }}
            >
              <span aria-hidden="true">＋</span> إضافة التزام
            </button>
          </div>

          {showCommitmentEditor && (
            <form onSubmit={saveCommitment} className={`${styles.inlineEditorForm} ${styles.inlineNewEditor}`}>
              <div className={styles.inlineEditorGrid}>
                <label><span>نوع الجهة</span><select value={commitment.entityType} onChange={event => setCommitment(value => ({ ...value, entityType: event.target.value }))}>{COMMITMENT_ENTITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>اسم الجهة</span><input value={commitment.entityName} onChange={event => setCommitment(value => ({ ...value, entityName: event.target.value }))} /></label>
                <label><span>نوع الالتزام</span><input value={commitment.commitmentType} onChange={event => setCommitment(value => ({ ...value, commitmentType: event.target.value }))} /></label>
                <label><span>الحالة</span><select value={commitment.status} onChange={event => setCommitment(value => ({ ...value, status: event.target.value }))}>{COMMITMENT_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                {(["remainingAmount", "settlementAmount", "monthlyInstallment", "defaultAmount"] as const).map((key, index) => (
                  <label key={key}>
                    <span>{["المبلغ المتبقي", "مبلغ السداد المطلوب", "القسط الشهري", "مبلغ التعثر"][index]}</span>
                    <input inputMode="decimal" value={commitment[key]} onChange={event => setCommitment(value => ({ ...value, [key]: normalizeNumericInput(event.target.value) }))} placeholder="غير محدد" />
                  </label>
                ))}
                <label className={styles.inlineWideField}><span>ملاحظات</span><textarea value={commitment.notes} onChange={event => setCommitment(value => ({ ...value, notes: event.target.value }))} /></label>
              </div>
              <div className={styles.inlineFormActions}>
                <button className={styles.inlineSaveButton} disabled={saving}>{commitment.id ? "حفظ تعديل الالتزام" : "حفظ الالتزام"}</button>
                <button type="button" className={styles.inlineCancelButton} onClick={() => { setCommitment(EMPTY_COMMITMENT); setShowCommitmentEditor(false) }}>إلغاء</button>
              </div>
            </form>
          )}

          <div className={styles.taskCommitmentTable}>
            {data.commitments.length === 0 ? (
              <div className={styles.taskEmptyRow}>لا توجد التزامات مسجلة.</div>
            ) : data.commitments.map(item => (
              <button
                type="button"
                key={item.id}
                className={styles.inlineCommitmentCard}
                onClick={() => {
                  openCommitment(item)
                  setShowCommitmentEditor(true)
                }}
                title={`تعديل ${item.entity_name}`}
              >
                <strong>{item.entity_name}</strong>
                <span>نوع الالتزام <b>{item.commitment_type}</b></span>
                <span>المتبقي <b>{formatMoney(item.remaining_amount)}</b></span>
                <span>السداد المطلوب <b>{formatMoney(item.settlement_amount)}</b></span>
                <span>القسط <b>{formatMoney(item.monthly_installment)}</b></span>
                <span>التعثر <b>{formatMoney(item.default_amount)}</b></span>
                <span>الحالة <b>{COMMITMENT_STATUS_LABELS[item.status] || item.status}</b></span>
                {item.notes && <small>{item.notes}</small>}
              </button>
            ))}
            <div className={styles.taskTableTotal}>
              <span>إجمالي الالتزامات</span>
              <strong>{formatMoney(data.summary.remainingAmount)}</strong>
              {data.summary.remainingIncomplete && (
                <small>الإجمالي غير مكتمل لوجود قيم غير محددة</small>
              )}
            </div>
          </div>
        </section>

        <section className={styles.taskSection}>
          <SmartWorksheet
            taskId={taskId}
            commitments={data.commitments}
            opportunities={data.opportunities}
            worksheet={data.worksheet}
            saving={saving}
            postAction={postAction}
          />
        </section>

        <form className={styles.taskSection} onSubmit={saveUpdate}>
          <div className={styles.taskSectionHeader}>
            <h2>٣. المتابعة</h2>
          </div>
          <div className={styles.taskFollowupGrid}>
            <label>
              <span>آخر ملاحظة</span>
              <textarea
                value={followup.actionText}
                onChange={event => setFollowup(value => ({ ...value, actionText: event.target.value }))}
                placeholder="لا توجد ملاحظة مسجلة"
              />
            </label>
            <label>
              <span>الخطوة التالية</span>
              <input
                value={followup.nextStep}
                onChange={event => setFollowup(value => ({ ...value, nextStep: event.target.value }))}
                placeholder="غير محددة"
              />
            </label>
            <label>
              <span>تاريخ الخطوة التالية</span>
              <input
                type="datetime-local"
                value={followup.nextFollowUpAt}
                onChange={event => setFollowup(value => ({ ...value, nextFollowUpAt: event.target.value }))}
              />
            </label>
          </div>
          <button className={styles.taskSaveButton} disabled={saving}>
            <span aria-hidden="true">✓</span>
            {saving ? "جارٍ الحفظ..." : "حفظ التحديث"}
          </button>
        </form>
      </main>
    </div>
  )
}
