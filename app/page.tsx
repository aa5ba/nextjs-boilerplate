"use client"

import { useState } from "react"

function format(n:number){
return Number(n||0).toLocaleString()
}

export default function Home(){

const [birthYear,setBirthYear]=useState("")
const [birthMonth,setBirthMonth]=useState("")
const [birthDay,setBirthDay]=useState("")

const [salary,setSalary]=useState(0)
const [deductions,setDeductions]=useState(0)

const [rate,setRate]=useState(3.5)

const [personalMonths,setPersonalMonths]=useState(60)

const [sector,setSector]=useState("civil")

const [result,setResult]=useState<any>(null)

function calc(){

if(!birthYear) return alert("ادخل تاريخ الميلاد")

let ageYears=1446-Number(birthYear)

let maxAge=60

if(sector=="retired") maxAge=70

let remainYears=maxAge-ageYears

let remainMonths=remainYears*12

let months=Math.min(personalMonths,remainMonths,60)

if(personalMonths>months){
alert("عدد الاشهر المدخله تتجاوز المسموح")
return
}

let ratio=0.33

if(sector=="retired") ratio=0.25

let installment=salary*ratio

if(deductions>salary*0.1167){

installment=salary*0.45-deductions

}

if(installment<=0){
alert("الاستقطاعات تجاوزت المسموح")
return
}

let totalInstallments=installment*months

let r=(rate/100/12)*months

let finance=totalInstallments/(1+r)

let profit=finance*r

let total=finance+profit

let fee=finance*0.005

if(fee>2500) fee=2500

let net=finance-fee

setResult({
age:ageYears,
months,
installment,
finance,
profit,
total,
fee,
net
})

}

return(

<div style={{maxWidth:420,margin:"auto",padding:20,fontFamily:"sans-serif"}}>

<h1 style={{color:"#0d47a1"}}>احتساب</h1>

<h3>المدخلات</h3>

<label>السنة الهجرية</label>
<input value={birthYear} onChange={e=>setBirthYear(e.target.value)} />

<label>الشهر</label>
<input value={birthMonth} onChange={e=>setBirthMonth(e.target.value)} />

<label>اليوم</label>
<input value={birthDay} onChange={e=>setBirthDay(e.target.value)} />

<label>القطاع</label>

<select value={sector} onChange={e=>setSector(e.target.value)}>

<option value="civil">مدني</option>
<option value="private">خاص</option>
<option value="military">عسكري</option>
<option value="retired">متقاعد</option>

</select>

<label>الراتب</label>

<input
type="number"
value={salary}
onChange={e=>setSalary(Number(e.target.value))}
/>

<label>الاستقطاعات</label>

<input
type="number"
value={deductions}
onChange={e=>setDeductions(Number(e.target.value))}
/>

<label>النسبة السنوية</label>

<input
type="number"
value={rate}
onChange={e=>setRate(Number(e.target.value))}
/>

<label>مدة التمويل الشخصي</label>

<input
type="number"
value={personalMonths}
onChange={e=>setPersonalMonths(Number(e.target.value))}
/>

<br/><br/>

<button onClick={calc}>احسب</button>

{result &&(

<div style={{marginTop:30}}>

<h3>النتائج</h3>

<p>العمر: {result.age}</p>

<p>المدة: {result.months} شهر</p>

<p>القسط: {format(result.installment)} ريال</p>

<p>مبلغ التمويل: {format(result.finance)}</p>

<p>الربح: {format(result.profit)}</p>

<p>الإجمالي: {format(result.total)}</p>

<p>الرسوم: {format(result.fee)}</p>

<p>الصافي: {format(result.net)}</p>

</div>

)}

</div>

)

}
