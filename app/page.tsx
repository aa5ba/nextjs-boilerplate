"use client"

import { useState } from "react"
import { calculateEhtisab } from "@/lib/ehtisabEngine"

export default function Home() {

  const [financeType,setFinanceType] = useState("personal")
  const [customerType,setCustomerType] = useState("employee")
  const [birthDate,setBirthDate] = useState("")
  const [salary,setSalary] = useState("")
  const [deductions,setDeductions] = useState("")
  const [rate,setRate] = useState("")
  const [months,setMonths] = useState("")

  const [result,setResult] = useState<any>(null)

  const handleCalculate = () => {

    const res = calculateEhtisab({

      financeType: financeType as any,
      customerType: customerType as any,
      birthDate: birthDate,
      salary: Number(salary),
      deductions: Number(deductions),
      annualRate: Number(rate),
      months: Number(months)

    })

    setResult(res)

  }

  return (

    <div className="min-h-screen bg-slate-100 flex justify-center items-start p-6">

      <div className="w-full max-w-md">

        {/* header */}

        <div className="bg-blue-700 text-white rounded-3xl p-6 mb-6">

          <h1 className="text-3xl font-bold">احتساب</h1>

          <p className="opacity-80 mt-1">
          منصة احتساب التمويل
          </p>

        </div>


        {/* inputs */}

        <div className="bg-white rounded-2xl p-6 shadow">

          <h2 className="text-lg font-bold mb-4">
          المدخلات
          </h2>

          {/* نوع التمويل */}

          <label className="text-sm">نوع التمويل</label>

          <select
          className="w-full border rounded-lg p-2 mb-3"
          value={financeType}
          onChange={(e)=>setFinanceType(e.target.value)}
          >

            <option value="personal">تمويل شخصي</option>
            <option value="realEstate">تمويل عقاري</option>

          </select>


          {/* نوع العميل */}

          <label className="text-sm">نوع العميل</label>

          <select
          className="w-full border rounded-lg p-2 mb-3"
          value={customerType}
          onChange={(e)=>setCustomerType(e.target.value)}
          >

            <option value="employee">موظف</option>
            <option value="retired">متقاعد</option>

          </select>


          {/* تاريخ الميلاد */}

          <label className="text-sm">تاريخ الميلاد</label>

          <input
          type="date"
          className="w-full border rounded-lg p-2 mb-3"
          value={birthDate}
          onChange={(e)=>setBirthDate(e.target.value)}
          />


          {/* الراتب */}

          <label className="text-sm">صافي الراتب</label>

          <input
          className="w-full border rounded-lg p-2 mb-3"
          value={salary}
          onChange={(e)=>setSalary(e.target.value)}
          />


          {/* الاستقطاعات */}

          <label className="text-sm">الاستقطاعات</label>

          <input
          className="w-full border rounded-lg p-2 mb-3"
          value={deductions}
          onChange={(e)=>setDeductions(e.target.value)}
          />


          {/* النسبة */}

          <label className="text-sm">النسبة السنوية</label>

          <input
          className="w-full border rounded-lg p-2 mb-3"
          value={rate}
          onChange={(e)=>setRate(e.target.value)}
          />


          {/* المدة */}

          <label className="text-sm">مدة التمويل بالشهور</label>

          <input
          className="w-full border rounded-lg p-2 mb-4"
          value={months}
          onChange={(e)=>setMonths(e.target.value)}
          />


          {/* زر الحساب */}

          <button
          onClick={handleCalculate}
          className="w-full bg-blue-700 text-white py-3 rounded-xl text-lg"
          >

          احسب النتيجة

          </button>

        </div>


        {/* النتائج */}

        {result && (

          <div className="bg-white rounded-2xl p-6 shadow mt-6">

            {!result.accepted && (

              <div className="text-red-600">

                {result.reason}

              </div>

            )}


            {result.accepted && (

              <div className="space-y-2">

                <div>
                مبلغ التمويل :
                <b> {result.financeAmount.toLocaleString()} ر.س</b>
                </div>

                <div>
                القسط :
                <b> {result.installment.toLocaleString()} ر.س</b>
                </div>

                <div>
                إجمالي الربح :
                <b> {result.profit.toLocaleString()} ر.س</b>
                </div>

                <div>
                الإجمالي :
                <b> {result.total.toLocaleString()} ر.س</b>
                </div>

                <div>
                الرسوم الإدارية :
                <b> {result.adminFee.toLocaleString()} ر.س</b>
                </div>

              </div>

            )}

          </div>

        )}

      </div>

    </div>

  )

}
