"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { normalizeNumber } from "@/lib/numberUtils"

import styles from "../../workTasks.module.css"
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_OPTIONS,
  formatDateTime,
  getRequestError,
  relationOne,
  workTasksRequest,
} from "../../shared"

type UserRow = { id: string; full_name: string; role: string }
type CustomerRow = { id: string; full_name: string; national_id: string; phone: string }
type TaskRow = {
  id: string
  task_name: string
  status: string
  next_follow_up_at: string | null
  updated_at: string
  customer: CustomerRow | CustomerRow[] | null
  assignee: UserRow | UserRow[] | null
}
type GroupResponse = {
  ok: true
  data: {
    group: { id: string; group_name: string }
    users: UserRow[]
    tasks: TaskRow[]
    pagination: { page: number; total: number; totalPages: number }
  }
}
type CustomersResponse = { ok: true; data: { customers: CustomerRow[] } }
type CustomerMode = "existing" | "new"

function normalizeDigits(value: string, maxLength: number) {
  return normalizeNumber(value).replace(/\D/g, "").slice(0, maxLength)
}

function normalizeHijriInput(value: string) {
  const digits = normalizeDigits(value, 8)

  if (digits.length <= 4) return digits
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}/${digits.slice(4)}`
  }

  return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6)}`
}

export default function WorkTaskGroupPage() {
  const params = useParams<{ branch: string; groupId: string }>()
  const router = useRouter()
  const branch = String(params.branch || "")
  const groupId = String(params.groupId || "")

  const [groupName, setGroupName] = useState("")
  const [renameValue, setRenameValue] = useState("")
  const [users, setUsers] = useState<UserRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [assignedUserId, setAssignedUserId] = useState("")
  const [due, setDue] = useState("")
  const [page, setPage] = useState(1)

  const [showCreate, setShowCreate] = useState(false)
  const [customerMode, setCustomerMode] = useState<CustomerMode>("existing")
  const [customerQuery, setCustomerQuery] = useState("")
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null)
  const [newCustomer, setNewCustomer] = useState({
    nationalId: "",
    fullName: "",
    phone: "",
    birthHijri: "",
  })
  const [taskName, setTaskName] = useState("")
  const [taskAssignee, setTaskAssignee] = useState("")
  const [saving, setSaving] = useState(false)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  const loadGroup = useCallback(async () => {
    if (!branch || !groupId) return
    setLoading(true)
    setError("")
    const search = new URLSearchParams({ branch, view: "group", groupId, page: String(page) })
    if (query.trim()) search.set("q", query.trim())
    if (status) search.set("status", status)
    if (assignedUserId) search.set("assignedUserId", assignedUserId)
    if (due) search.set("due", due)
    try {
      const response = await workTasksRequest<GroupResponse>(`/finance/api/work-tasks?${search}`)
      setGroupName(response.data.group.group_name)
      setRenameValue(response.data.group.group_name)
      setUsers(response.data.users)
      setTasks(response.data.tasks)
      setPagination(response.data.pagination)
      if (!taskAssignee && response.data.users[0]) setTaskAssignee(response.data.users[0].id)
    } catch (loadError) {
      const statusCode = Number((loadError as { status?: number }).status)
      if (statusCode === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(`/finance/${branch}/work-tasks/groups/${groupId}`)}`)
        return
      }
      setError(getRequestError(loadError))
    } finally {
      setLoading(false)
    }
  }, [assignedUserId, branch, due, groupId, page, query, router, status, taskAssignee])

  useEffect(() => {
    void loadGroup()
  }, [loadGroup])

  useEffect(() => {
    if (!showCreate || customerMode !== "existing" || customerQuery.trim().length < 2) {
      setCustomers([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const search = new URLSearchParams({ branch, view: "customers", q: customerQuery.trim() })
        const response = await workTasksRequest<CustomersResponse>(`/finance/api/work-tasks?${search}`, {
          signal: controller.signal,
        })
        setCustomers(response.data.customers)
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") setError(getRequestError(searchError))
      }
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [branch, customerMode, customerQuery, showCreate])

  async function renameGroup() {
    if (renameValue.trim().length < 2) return setError("اكتب اسم مجموعة صحيحًا")
    setSaving(true)
    setError("")
    try {
      await workTasksRequest("/finance/api/work-tasks", {
        method: "POST",
        body: JSON.stringify({ branch, action: "rename_group", groupId, groupName: renameValue }),
      })
      setSuccess("تم تعديل اسم المجموعة")
      await loadGroup()
    } catch (saveError) {
      setError(getRequestError(saveError))
    } finally {
      setSaving(false)
    }
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault()
    if (customerMode === "existing" && !selectedCustomer) {
      return setError("اختر عميلًا موجودًا من قائمة عملاء الفرع")
    }
    if (
      customerMode === "new" &&
      (newCustomer.fullName.trim().length < 2 ||
        newCustomer.nationalId.length !== 10 ||
        !/^05\d{8}$/.test(newCustomer.phone) ||
        (newCustomer.birthHijri !== "" && !/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(newCustomer.birthHijri)))
    ) {
      return setError("أكمل اسم العميل والهوية والجوال بصورة صحيحة، وتحقق من تاريخ الميلاد إذا أُدخل")
    }
    if (taskName.trim().length < 2 || !taskAssignee) {
      return setError("أكمل اسم المهمة والموظف المسؤول")
    }
    setSaving(true)
    setError("")
    try {
      const response = await workTasksRequest<{ ok: true; id: string }>("/finance/api/work-tasks", {
        method: "POST",
        body: JSON.stringify({
          branch,
          action: "create_task",
          groupId,
          customerMode,
          customerId: customerMode === "existing" ? selectedCustomer?.id : undefined,
          customerFullName: customerMode === "new" ? newCustomer.fullName : undefined,
          customerNationalId: customerMode === "new" ? newCustomer.nationalId : undefined,
          customerPhone: customerMode === "new" ? newCustomer.phone : undefined,
          customerBirthHijri: customerMode === "new" ? newCustomer.birthHijri : undefined,
          assignedUserId: taskAssignee,
          taskName,
          requestId,
        }),
      })
      setRequestId(crypto.randomUUID())
      setCustomerMode("existing")
      setCustomerQuery("")
      setSelectedCustomer(null)
      setNewCustomer({ nationalId: "", fullName: "", phone: "", birthHijri: "" })
      setTaskName("")
      setShowCreate(false)
      router.push(`/finance/${branch}/work-tasks/tasks/${response.id}`)
    } catch (saveError) {
      setError(getRequestError(saveError))
    } finally {
      setSaving(false)
    }
  }

  const filterActive = useMemo(
    () => Boolean(query || status || assignedUserId || due),
    [assignedUserId, due, query, status]
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>{groupName || "مجموعة مهام"}</h1>
            <p className={styles.subtitle}>قائمة مهام العملاء داخل المجموعة</p>
          </div>
          <div className={styles.actions}>
            <button className={styles.buttonSecondary} onClick={() => router.push(`/finance/${branch}/work-tasks`)}>← مهام العمل</button>
            <button className={styles.buttonSecondary} onClick={() => router.push(`/finance/${branch}`)}>🏠 الرئيسية</button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <section className={styles.panel}>
          <div className={styles.sectionTitle}><h2>بيانات المجموعة</h2></div>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="rename-group">اسم المجموعة</label>
              <input id="rename-group" className={styles.input} value={renameValue} onChange={event => setRenameValue(event.target.value)} maxLength={100} />
            </div>
            <button className={styles.button} disabled={saving || renameValue.trim() === groupName} onClick={renameGroup}>حفظ الاسم</button>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <h2>مهام العملاء ({pagination.total})</h2>
            <button className={styles.button} onClick={() => setShowCreate(true)}>＋ إنشاء مهمة</button>
          </div>

          <div className={styles.filterGrid}>
            <div className={styles.field}>
              <label>بحث</label>
              <input className={styles.input} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="الاسم أو الهوية أو الجوال أو اسم المهمة" />
            </div>
            <div className={styles.field}>
              <label>الحالة</label>
              <select className={styles.select} value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}>
                <option value="">كل الحالات</option>
                {TASK_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>الموظف المسؤول</label>
              <select className={styles.select} value={assignedUserId} onChange={event => { setAssignedUserId(event.target.value); setPage(1) }}>
                <option value="">كل الموظفين</option>
                {users.map(user => <option key={user.id} value={user.id}>{user.full_name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>موعد المتابعة</label>
              <select className={styles.select} value={due} onChange={event => { setDue(event.target.value); setPage(1) }}>
                <option value="">كل المواعيد</option>
                <option value="overdue">متأخرة</option>
                <option value="today">اليوم</option>
                <option value="upcoming">قادمة</option>
                <option value="none">بلا موعد</option>
              </select>
            </div>
          </div>
          {filterActive && <p className={styles.muted}>يتم تطبيق البحث والتصفية داخل هذا الفرع وهذه المجموعة فقط.</p>}

          {loading ? <div className={styles.empty}>جاري تحميل المهام...</div> : tasks.length === 0 ? (
            <div className={styles.empty}>لا توجد مهام مطابقة.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>العميل</th><th>اسم المهمة</th><th>الحالة</th><th>الموظف المسؤول</th><th>المتابعة القادمة</th></tr></thead>
                <tbody>
                  {tasks.map(task => {
                    const customer = relationOne(task.customer)
                    const assignee = relationOne(task.assignee)
                    return (
                      <tr key={task.id}>
                        <td><strong>{customer?.full_name || "-"}</strong><div className={styles.muted}>{customer?.phone || "-"}</div></td>
                        <td><button className={styles.rowButton} onClick={() => router.push(`/finance/${branch}/work-tasks/tasks/${task.id}`)}>{task.task_name}</button></td>
                        <td><span className={styles.badge} data-status={task.status}>{TASK_STATUS_LABELS[task.status] || task.status}</span></td>
                        <td>{assignee?.full_name || "-"}</td>
                        <td>{formatDateTime(task.next_follow_up_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.buttonSecondary} disabled={page <= 1} onClick={() => setPage(value => value - 1)}>السابق</button>
              <span>صفحة {pagination.page} من {pagination.totalPages}</span>
              <button className={styles.buttonSecondary} disabled={page >= pagination.totalPages} onClick={() => setPage(value => value + 1)}>التالي</button>
            </div>
          )}
        </section>
      </main>

      {showCreate && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setShowCreate(false)}>
          <form className={styles.modal} onSubmit={createTask} onMouseDown={event => event.stopPropagation()}>
            <h2>إنشاء مهمة عميل</h2>
            <div className={styles.formGrid}>
              <button
                type="button"
                className={customerMode === "existing" ? styles.button : styles.buttonSecondary}
                onClick={() => {
                  setCustomerMode("existing")
                  setError("")
                }}
              >
                اختيار عميل موجود
              </button>
              <button
                type="button"
                className={customerMode === "new" ? styles.button : styles.buttonSecondary}
                onClick={() => {
                  setCustomerMode("new")
                  setSelectedCustomer(null)
                  setCustomers([])
                  setError("")
                }}
              >
                إنشاء ملف عميل جديد
              </button>
            </div>

            {customerMode === "existing" ? (
              <>
                <div className={styles.field} style={{ marginTop: 14 }}>
                  <label>ابحث عن العميل داخل الفرع</label>
                  <input className={styles.input} value={customerQuery} onChange={event => { setCustomerQuery(normalizeNumber(event.target.value)); setSelectedCustomer(null) }} placeholder="الاسم أو الهوية أو الجوال" />
                </div>
                <div className={styles.searchResults} style={{ marginTop: 10 }}>
                  {customers.map(customer => (
                    <button key={customer.id} type="button" className={styles.searchResult} data-selected={selectedCustomer?.id === customer.id} onClick={() => setSelectedCustomer(customer)}>
                      <strong>{customer.full_name}</strong><div className={styles.muted}>{customer.national_id} • {customer.phone}</div>
                    </button>
                  ))}
                </div>
                {selectedCustomer && <div className={styles.notice} style={{ marginTop: 10 }}>العميل المحدد: {selectedCustomer.full_name}</div>}
              </>
            ) : (
              <>
                <div className={styles.notice} style={{ marginTop: 14 }}>
                  سيُنشأ ملف العميل والمهمة معًا. إذا فشلت المهمة فلن يبقى ملف عميل منفرد.
                </div>
                <div className={styles.formGrid} style={{ marginTop: 14 }}>
                  <div className={styles.field}>
                    <label>رقم الهوية</label>
                    <input
                      className={styles.input}
                      inputMode="numeric"
                      value={newCustomer.nationalId}
                      onChange={event => setNewCustomer(value => ({ ...value, nationalId: normalizeDigits(event.target.value, 10) }))}
                      maxLength={10}
                      placeholder="10 أرقام"
                    />
                  </div>
                  <div className={styles.field}>
                    <label>اسم العميل</label>
                    <input
                      className={styles.input}
                      value={newCustomer.fullName}
                      onChange={event => setNewCustomer(value => ({ ...value, fullName: event.target.value }))}
                      maxLength={160}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>رقم الجوال</label>
                    <input
                      className={styles.input}
                      inputMode="numeric"
                      value={newCustomer.phone}
                      onChange={event => setNewCustomer(value => ({ ...value, phone: normalizeDigits(event.target.value, 10) }))}
                      maxLength={10}
                      placeholder="05xxxxxxxx"
                    />
                  </div>
                  <div className={styles.field}>
                    <label>تاريخ الميلاد الهجري (اختياري)</label>
                    <input
                      className={styles.input}
                      inputMode="numeric"
                      value={newCustomer.birthHijri}
                      onChange={event => setNewCustomer(value => ({ ...value, birthHijri: normalizeHijriInput(event.target.value) }))}
                      maxLength={10}
                      placeholder="1440/01/01"
                    />
                  </div>
                </div>
              </>
            )}
            <div className={styles.formGrid} style={{ marginTop: 14 }}>
              <div className={styles.field}>
                <label>اسم المهمة</label>
                <input className={styles.input} value={taskName} onChange={event => setTaskName(event.target.value)} maxLength={160} placeholder="مثال: سداد الراجحي" />
              </div>
              <div className={styles.field}>
                <label>الموظف المسؤول</label>
                <select className={styles.select} value={taskAssignee} onChange={event => setTaskAssignee(event.target.value)}>
                  <option value="">اختر الموظف</option>
                  {users.map(user => <option key={user.id} value={user.id}>{user.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className={styles.actions} style={{ marginTop: 18 }}>
              <button className={styles.button} disabled={saving}>{saving ? "جاري الإنشاء..." : "إنشاء المهمة"}</button>
              <button type="button" className={styles.buttonDanger} onClick={() => setShowCreate(false)}>إلغاء</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
