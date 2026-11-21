"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import styles from "./workTasks.module.css"
import {
  formatDateTime,
  getRequestError,
  workTasksRequest,
} from "./shared"

type GroupRow = {
  id: string
  group_name: string
  created_at: string
  updated_at: string
  tasks?: Array<{ count?: number }> | { count?: number } | null
}

type AlertRow = {
  task_id: string
  group_id: string
  group_name: string
  customer_name: string
  customer_phone: string
  task_name: string
  task_status: string
  assigned_user_name: string
  next_follow_up_at: string | null
  alert_type: "overdue" | "today" | "unscheduled"
}

type DashboardResponse = {
  ok: true
  data: { groups: GroupRow[]; alerts: AlertRow[] }
}

const ALERT_TITLES = {
  overdue: "فات موعد متابعتها",
  today: "متابعة اليوم",
  unscheduled: "مفتوحة بلا موعد",
} as const

function groupTaskCount(group: GroupRow) {
  const relation = group.tasks
  if (Array.isArray(relation)) return Number(relation[0]?.count || 0)
  return Number(relation?.count || 0)
}

export default function WorkTasksPage() {
  const params = useParams<{ branch: string }>()
  const router = useRouter()
  const branch = String(params.branch || "")

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [saving, setSaving] = useState(false)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  const loadDashboard = useCallback(async () => {
    if (!branch) return
    setLoading(true)
    setError("")
    try {
      const response = await workTasksRequest<DashboardResponse>(
        `/finance/api/work-tasks?branch=${encodeURIComponent(branch)}&view=dashboard`
      )
      setGroups(response.data.groups)
      setAlerts(response.data.alerts)
    } catch (loadError) {
      const status = Number((loadError as { status?: number }).status)
      if (status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(`/finance/${branch}/work-tasks`)}`)
        return
      }
      setError(getRequestError(loadError))
    } finally {
      setLoading(false)
    }
  }, [branch, router])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const alertsByType = useMemo(
    () => ({
      overdue: alerts.filter(item => item.alert_type === "overdue"),
      today: alerts.filter(item => item.alert_type === "today"),
      unscheduled: alerts.filter(item => item.alert_type === "unscheduled"),
    }),
    [alerts]
  )

  async function createGroup(event: React.FormEvent) {
    event.preventDefault()
    if (groupName.trim().length < 2) {
      setError("اكتب اسم المجموعة")
      return
    }
    setSaving(true)
    setError("")
    try {
      await workTasksRequest("/finance/api/work-tasks", {
        method: "POST",
        body: JSON.stringify({
          branch,
          action: "create_group",
          groupName,
          requestId,
        }),
      })
      setGroupName("")
      setRequestId(crypto.randomUUID())
      setShowCreate(false)
      await loadDashboard()
    } catch (saveError) {
      setError(getRequestError(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>مهام العمل</h1>
            <p className={styles.subtitle}>تنظيم مهام العملاء ومواعيد متابعتها داخل الفرع</p>
          </div>
          <button className={styles.buttonSecondary} onClick={() => router.push(`/finance/${branch}`)}>
            🏠 محطة العمل الرئيسية
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {error && <div className={styles.error}>{error}</div>}

        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <h2>المهام التي تحتاج متابعة</h2>
            <span className={styles.badge}>{alerts.length} مهمة</span>
          </div>
          {loading ? (
            <div className={styles.empty}>جاري تحميل مهام المتابعة...</div>
          ) : (
            <div className={styles.alertColumns}>
              {(Object.keys(ALERT_TITLES) as Array<keyof typeof ALERT_TITLES>).map(kind => (
                <div key={kind} className={styles.alertColumn} data-kind={kind}>
                  <h3>{ALERT_TITLES[kind]} ({alertsByType[kind].length})</h3>
                  {alertsByType[kind].length === 0 ? (
                    <div className={styles.muted}>لا توجد مهام في هذه القائمة.</div>
                  ) : (
                    alertsByType[kind].map(item => (
                      <button
                        key={item.task_id}
                        className={styles.alertItem}
                        onClick={() => router.push(`/finance/${branch}/work-tasks/tasks/${item.task_id}`)}
                      >
                        <strong>{item.customer_name} — {item.task_name}</strong>
                        <span className={styles.muted}>
                          {item.group_name} • {item.assigned_user_name} • {formatDateTime(item.next_follow_up_at)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <h2>المجموعات</h2>
            <button className={styles.button} onClick={() => setShowCreate(true)}>＋ إنشاء مجموعة</button>
          </div>
          {loading ? (
            <div className={styles.empty}>جاري تحميل المجموعات...</div>
          ) : groups.length === 0 ? (
            <div className={styles.empty}>لا توجد مجموعات بعد. أنشئ المجموعة الأولى للبدء.</div>
          ) : (
            <div className={styles.grid}>
              {groups.map(group => (
                <article
                  key={group.id}
                  className={`${styles.card} ${styles.clickable}`}
                  onClick={() => router.push(`/finance/${branch}/work-tasks/groups/${group.id}`)}
                >
                  <div className={styles.cardHeader}>
                    <h3>{group.group_name}</h3>
                    <span className={styles.count}>{groupTaskCount(group)}</span>
                  </div>
                  <p className={styles.muted}>آخر تحديث: {formatDateTime(group.updated_at)}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {showCreate && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setShowCreate(false)}>
          <form className={styles.modal} onSubmit={createGroup} onMouseDown={event => event.stopPropagation()}>
            <h2>إنشاء مجموعة جديدة</h2>
            <div className={styles.field}>
              <label htmlFor="group-name">اسم المجموعة</label>
              <input
                id="group-name"
                className={styles.input}
                value={groupName}
                onChange={event => setGroupName(event.target.value)}
                maxLength={100}
                autoFocus
                placeholder="مثال: عملاء السداد"
              />
            </div>
            <div className={styles.actions} style={{ marginTop: 18 }}>
              <button className={styles.button} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ المجموعة"}</button>
              <button type="button" className={styles.buttonDanger} onClick={() => setShowCreate(false)}>إلغاء</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
