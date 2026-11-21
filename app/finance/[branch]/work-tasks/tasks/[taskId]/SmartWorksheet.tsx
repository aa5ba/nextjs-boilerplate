"use client"

import { useMemo, useState } from "react"

import {
  calculateWorkTaskOpportunity,
  type WorksheetCalculation,
  type WorksheetCommissionType,
} from "@/lib/workTaskWorksheet"

import styles from "../../workTasks.module.css"
import {
  COMMITMENT_STATUS_LABELS,
  OPPORTUNITY_STATUS_OPTIONS,
  formatMoney,
  normalizeNumericInput,
} from "../../shared"

export type WorksheetCommitment = {
  id: string
  entity_name: string
  commitment_type: string
  remaining_amount: number | string | null
  monthly_installment: number | string | null
  default_amount: number | string | null
  settlement_amount: number | string | null
  status: string
  notes: string | null
}

export type WorksheetOpportunity = {
  id: string
  provider_name: string
  expected_amount: number | string | null
  status: string
  notes: string | null
  commission_type: WorksheetCommissionType
  commission_value: number | string | null
}

export type WorksheetCost = {
  id: string
  opportunity_id: string
  cost_name: string
  amount: number | string | null
}

export type WorksheetChecklistItem = {
  id: string
  item_name: string
  is_completed: boolean
  completed_at: string | null
  completed_by_name: string | null
}

export type WorksheetSettlementSource = {
  id: string
  opportunity_id: string
  commitment_id: string | null
  provider_type: "office" | "customer" | "other"
  provider_name: string | null
  planned_amount: number | string | null
  paid_amount: number | string | null
  notes: string | null
}

export type SmartWorksheetData = {
  selectedOpportunityId: string | null
  opportunityCommitmentLinks: Array<{
    id: string
    opportunity_id: string
    commitment_id: string
  }>
  costs: WorksheetCost[]
  checklistItems: WorksheetChecklistItem[]
  settlementSources: WorksheetSettlementSource[]
  calculations: Array<{
    opportunityId: string
    calculation: WorksheetCalculation
  }>
}

type Props = {
  taskId: string
  commitments: WorksheetCommitment[]
  opportunities: WorksheetOpportunity[]
  worksheet: SmartWorksheetData
  saving: boolean
  postAction: (payload: Record<string, unknown>) => Promise<boolean>
}

const EMPTY_OPPORTUNITY = {
  providerName: "",
  expectedAmount: "",
  status: "preliminary",
  notes: "",
}

function OpportunityEditor({
  taskId,
  opportunity,
  commitments,
  selectedCommitmentIds,
  costs,
  saving,
  postAction,
}: {
  taskId: string
  opportunity: WorksheetOpportunity
  commitments: WorksheetCommitment[]
  selectedCommitmentIds: string[]
  costs: WorksheetCost[]
  saving: boolean
  postAction: Props["postAction"]
}) {
  const [details, setDetails] = useState({
    providerName: opportunity.provider_name,
    expectedAmount: opportunity.expected_amount === null ? "" : String(opportunity.expected_amount),
    status: opportunity.status,
    notes: opportunity.notes || "",
  })
  const [selectedIds, setSelectedIds] = useState(selectedCommitmentIds)
  const [commissionType, setCommissionType] = useState<WorksheetCommissionType>(
    opportunity.commission_type || "unset"
  )
  const [commissionValue, setCommissionValue] = useState(
    opportunity.commission_value === null ? "" : String(opportunity.commission_value)
  )
  const [costForm, setCostForm] = useState({ id: "", costName: "", amount: "" })
  const [costRequestId, setCostRequestId] = useState(() => crypto.randomUUID())

  const liveCalculation = useMemo(
    () => calculateWorkTaskOpportunity(
      {
        ...opportunity,
        expected_amount: details.expectedAmount,
        commission_type: commissionType,
        commission_value: commissionValue,
      },
      commitments,
      selectedIds,
      costs
    ),
    [commissionType, commissionValue, commitments, costs, details.expectedAmount, opportunity, selectedIds]
  )

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault()
    await postAction({
      action: "save_opportunity",
      taskId,
      opportunityId: opportunity.id,
      ...details,
    })
  }

  async function savePlan() {
    await postAction({
      action: "save_opportunity_plan",
      taskId,
      opportunityId: opportunity.id,
      commitmentIds: selectedIds,
      commissionType,
      commissionValue:
        commissionType === "fixed" || commissionType === "percentage"
          ? commissionValue
          : "",
    })
  }

  async function saveCost(event: React.FormEvent) {
    event.preventDefault()
    const saved = await postAction({
      action: "save_worksheet_cost",
      taskId,
      opportunityId: opportunity.id,
      costId: costForm.id || undefined,
      requestId: costForm.id ? undefined : costRequestId,
      costName: costForm.costName,
      amount: costForm.amount,
    })
    if (saved) {
      setCostForm({ id: "", costName: "", amount: "" })
      setCostRequestId(crypto.randomUUID())
    }
  }

  async function archiveCost(costId: string) {
    await postAction({
      action: "archive_worksheet_cost",
      taskId,
      opportunityId: opportunity.id,
      costId,
    })
  }

  return (
    <article className={styles.inlineOpportunityCard}>
      <form onSubmit={saveDetails} className={styles.inlineEditorForm}>
        <div className={styles.inlineEditorGrid}>
          <label>
            <span>جهة التمويل</span>
            <input value={details.providerName} onChange={event => setDetails(value => ({ ...value, providerName: event.target.value }))} />
          </label>
          <label>
            <span>التمويل المتوقع</span>
            <input inputMode="decimal" value={details.expectedAmount} onChange={event => setDetails(value => ({ ...value, expectedAmount: normalizeNumericInput(event.target.value) }))} placeholder="غير محدد" />
          </label>
          <label>
            <span>حالة الفرصة</span>
            <select value={details.status} onChange={event => setDetails(value => ({ ...value, status: event.target.value }))}>
              {OPPORTUNITY_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={styles.inlineWideField}>
            <span>ملاحظات</span>
            <textarea value={details.notes} onChange={event => setDetails(value => ({ ...value, notes: event.target.value }))} />
          </label>
        </div>
        <button className={styles.inlineSaveButton} disabled={saving}>حفظ بيانات العرض</button>
      </form>

      <div className={styles.inlineOpportunityBody}>
        <div className={styles.inlineSubsection}>
          <h3>الالتزامات المطلوب سدادها</h3>
          {commitments.length === 0 ? <p className={styles.muted}>لا توجد التزامات مسجلة في المهمة.</p> : (
            <div className={styles.inlineChecks}>
              {commitments.map(commitment => (
                <label key={commitment.id}>
                  <input type="checkbox" checked={selectedIds.includes(commitment.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, commitment.id] : current.filter(id => id !== commitment.id))} />
                  <span>
                    <strong>{commitment.entity_name}</strong>
                    <small>{COMMITMENT_STATUS_LABELS[commitment.status] || commitment.status}{" • "}السداد: {formatMoney(commitment.settlement_amount)}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className={styles.inlineSubsection}>
          <h3>عمولة المكتب</h3>
          <div className={styles.inlineTwoColumns}>
            <label>
              <span>طريقة العمولة</span>
              <select value={commissionType} onChange={event => { const type = event.target.value as WorksheetCommissionType; setCommissionType(type); if (type === "none" || type === "unset") setCommissionValue("") }}>
                <option value="unset">غير محددة</option>
                <option value="none">بدون عمولة</option>
                <option value="fixed">مبلغ ثابت</option>
                <option value="percentage">نسبة من التمويل</option>
              </select>
            </label>
            {(commissionType === "fixed" || commissionType === "percentage") && (
              <label>
                <span>{commissionType === "fixed" ? "مبلغ العمولة" : "نسبة العمولة %"}</span>
                <input inputMode="decimal" value={commissionValue} onChange={event => setCommissionValue(normalizeNumericInput(event.target.value, commissionType === "percentage" ? 4 : 2))} placeholder="غير محدد" />
              </label>
            )}
          </div>
          <button type="button" className={styles.inlineSaveButton} disabled={saving} onClick={savePlan}>حفظ الالتزامات والعمولة</button>
        </div>

        <div className={styles.inlineSubsection}>
          <h3>التكاليف</h3>
          {costs.map(cost => (
            <div className={styles.inlineCostRow} key={cost.id}>
              <span><strong>{cost.cost_name}</strong><small>{formatMoney(cost.amount)}</small></span>
              <div>
                <button type="button" onClick={() => setCostForm({ id: cost.id, costName: cost.cost_name, amount: cost.amount === null ? "" : String(cost.amount) })}>تعديل</button>
                <button type="button" onClick={() => void archiveCost(cost.id)}>إزالة</button>
              </div>
            </div>
          ))}
          <form onSubmit={saveCost} className={styles.inlineCostForm}>
            <label><span>اسم التكلفة</span><input value={costForm.costName} onChange={event => setCostForm(value => ({ ...value, costName: event.target.value }))} placeholder="مثال: رسوم إدارية" /></label>
            <label><span>المبلغ</span><input inputMode="decimal" value={costForm.amount} onChange={event => setCostForm(value => ({ ...value, amount: normalizeNumericInput(event.target.value) }))} placeholder="غير محدد" /></label>
            <button className={styles.inlineSaveButton} disabled={saving}>{costForm.id ? "حفظ التكلفة" : "إضافة تكلفة"}</button>
            {costForm.id && <button type="button" className={styles.inlineCancelButton} onClick={() => setCostForm({ id: "", costName: "", amount: "" })}>إلغاء</button>}
          </form>
        </div>
      </div>

      <div className={styles.inlineCalculation} data-complete={liveCalculation.isComplete || undefined}>
        <span>التمويل <strong>{formatMoney(liveCalculation.expectedAmount)}</strong></span>
        <span>السداد <strong>{formatMoney(liveCalculation.settlementAmount)}</strong></span>
        <span>التكاليف <strong>{formatMoney(liveCalculation.otherCostsAmount)}</strong></span>
        <span>العمولة <strong>{formatMoney(liveCalculation.commissionAmount)}</strong></span>
        <span className={styles.inlineNetAmount}>صافي العميل التقديري <strong className={liveCalculation.netAmount?.startsWith("-") ? styles.negativeAmount : ""}>{liveCalculation.isComplete ? formatMoney(liveCalculation.netAmount) : "غير مكتمل"}</strong></span>
        {!liveCalculation.isComplete && liveCalculation.missing.length > 0 && <small>البيانات الناقصة: {liveCalculation.missing.join("، ")}</small>}
      </div>
    </article>
  )
}

export default function SmartWorksheet({ taskId, commitments, opportunities, worksheet, saving, postAction }: Props) {
  const [showNew, setShowNew] = useState(false)
  const [newOpportunity, setNewOpportunity] = useState(EMPTY_OPPORTUNITY)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  async function saveNewOpportunity(event: React.FormEvent) {
    event.preventDefault()
    const saved = await postAction({ action: "save_opportunity", taskId, requestId, ...newOpportunity })
    if (saved) {
      setNewOpportunity(EMPTY_OPPORTUNITY)
      setRequestId(crypto.randomUUID())
      setShowNew(false)
    }
  }

  return (
    <>
      <div className={styles.taskSectionHeader}>
        <h2>٢. التمويل والصافي</h2>
        <button type="button" className={styles.taskAddButton} onClick={() => setShowNew(true)}><span aria-hidden="true">＋</span> إضافة عرض</button>
      </div>

      {showNew && (
        <form className={`${styles.inlineEditorForm} ${styles.inlineNewEditor}`} onSubmit={saveNewOpportunity}>
          <div className={styles.inlineEditorGrid}>
            <label><span>جهة التمويل</span><input value={newOpportunity.providerName} onChange={event => setNewOpportunity(value => ({ ...value, providerName: event.target.value }))} /></label>
            <label><span>التمويل المتوقع</span><input inputMode="decimal" value={newOpportunity.expectedAmount} onChange={event => setNewOpportunity(value => ({ ...value, expectedAmount: normalizeNumericInput(event.target.value) }))} placeholder="غير محدد" /></label>
            <label><span>الحالة</span><select value={newOpportunity.status} onChange={event => setNewOpportunity(value => ({ ...value, status: event.target.value }))}>{OPPORTUNITY_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className={styles.inlineWideField}><span>ملاحظات</span><textarea value={newOpportunity.notes} onChange={event => setNewOpportunity(value => ({ ...value, notes: event.target.value }))} /></label>
          </div>
          <div className={styles.inlineFormActions}>
            <button className={styles.inlineSaveButton} disabled={saving}>حفظ العرض</button>
            <button type="button" className={styles.inlineCancelButton} onClick={() => setShowNew(false)}>إلغاء</button>
          </div>
        </form>
      )}

      {opportunities.length === 0 && !showNew ? <div className={styles.taskEmptyRow}>لا توجد فرص تمويل مسجلة.</div> : (
        <div className={styles.inlineOpportunityList}>
          {opportunities.map(opportunity => (
            <OpportunityEditor
              key={`${opportunity.id}:${opportunity.provider_name}:${opportunity.expected_amount ?? ""}:${opportunity.status}:${opportunity.notes || ""}:${opportunity.commission_type}:${opportunity.commission_value ?? ""}`}
              taskId={taskId}
              opportunity={opportunity}
              commitments={commitments}
              selectedCommitmentIds={worksheet.opportunityCommitmentLinks.filter(link => link.opportunity_id === opportunity.id).map(link => link.commitment_id)}
              costs={worksheet.costs.filter(cost => cost.opportunity_id === opportunity.id)}
              saving={saving}
              postAction={postAction}
            />
          ))}
        </div>
      )}
    </>
  )
}
