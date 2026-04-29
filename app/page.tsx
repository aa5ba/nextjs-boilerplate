'use client'

import { useState } from "react"
import { calculateFinance, calculateAge, maxFinanceMonths } from "../lib/ehtisabEngine"

export default function Home() {

const [salary,setSalary]=useState(0)
const [deductions,setDeductions]=useState(0)
const [rate,setRate]=useState(3.7)
const [birthDate,setBirthDate]=useState("")
const [months,setMonths]=useState(0)
const [result,setResult]=useState<any>(null)

function calculate(){

const age = calculateAge(birthDate)

const maxMonths = maxFinanceMonths(age)

if(months > maxMonths){
alert("عدد الاشهر المدخلة تتجاوز المسموح")
return
}

const finance = calculateFinance({
salary,
deductions,
annualRate:rate,
months
})

setResult(finance)

}

return (

<div style={{maxWidth:500,margin:"auto",padding:20,fontFamily:"sans-serif"}}>

<h2>احتساب</h2>

<input placeholder="تاريخ الميلاد" type="date"
onChange={(e)=>setBirthDate(e.target.value)}/>

<input placeholder="صافي الراتب"
onChange={(e)=>setSalary(Number(e.target.value))}/>

<input placeholder="الاستقطاعات"
onChange={(e)=>setDeductions(Number(e.target.value))}/>

<input placeholder="النسبة السنوية"
onChange={(e)=>setRate(Number(e.target.value))}/>

<input placeholder="مدة التمويل بالشهور"
onChange={(e)=>setMonths(Number(e.target.value))}/>

<button onClick={calculate}>احسب النتيجة</button>

{result && (

<div>

<h3>النتائج</h3>

<p>مبلغ التمويل: {result.financeAmount}</p>

<p>القسط الشهري: {result.installment}</p>

<p>الأرباح: {result.profit}</p>

<p>الرسوم الادارية: {result.adminFee}</p>

<p>صافي التمويل: {result.netAmount}</p>

<p>اجمالي السداد: {result.total}</p>

</div>

)}

</div>

)

}
