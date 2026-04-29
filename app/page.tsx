"use client"

import { useState, useEffect } from "react"

function format(n:number){
return Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
}

function todayHijri(){

const parts=new Intl.DateTimeFormat("en-u-ca-islamic-umalqura",{
year:"numeric",
month:"numeric",
day:"numeric"
}).formatToParts(new Date())

return{
y:Number(parts.find(p=>p.type==="year")?.value),
m:Number(parts.find(p=>p.type==="month")?.value),
d:Number(parts.find(p=>p.type==="day")?.value)
}

}

export default function Home(){

const [financeType,setFinanceType]=useState("real")

const [sector,setSector]=useState("civil")

const [birthY,setBirthY]=useState("")
const [birthM,setBirthM]=useState("")
const [birthD,setBirthD]=useState("")

const [salary,setSalary]=useState(10000)
const [deductions,setDeductions]=useState(0)

const [rate,setRate]=useState(3)

const [personalMonths,setPersonalMonths]=useState(60)
const [realMonths,setRealMonths]=useState(360)

const [allowedRealMonths,setAllowedRealMonths]=useState(360)

const [realEstateType,setRealEstateType]=useState("normal")

const [result,setResult]=useState<any>(null)

function calcAgeMonths(){

const t=todayHijri()

let months=(t.y-Number(birthY))*12+(t.m-Number(birthM))

if(t.d<Number(birthD)) months--

return months

}

useEffect(()=>{

if(!birthY||!birthM||!birthD) return

const ageMonths=calcAgeMonths()

const maxAge=sector==="retired"?70*12:60*12

const remaining=Math.max(0,maxAge-ageMonths)

const allowed=Math.min(360,remaining)

setAllowedRealMonths(allowed)

setRealMonths(allowed)

},[birthY,birthM,birthD,sector])

function calcFinance(installment:number,months:number,feeRate:number,feeCap:number){

const totalInstallments=installment*months

const r=(rate/100/12)*months

const finance=totalInstallments/(1+r)

const profit=finance*r

const total=finance+profit

let fee=finance*feeRate

if(fee>feeCap) fee=feeCap

const net=finance-fee

return{installment,months,finance,profit,total,fee,net}

}

function calculate(){

if(!birthY||!birthM||!birthD){

alert("ادخل تاريخ الميلاد الهجري")

return

}

const ageMonths=calcAgeMonths()

const ageYears=Math.floor(ageMonths/12)

const maxAge=sector==="retired"?70*12:60*12

const remainingMonths=Math.max(0,maxAge-ageMonths)

if(remainingMonths<=0){

alert("العمر لا يطابق سياسات التمويل")

return

}

let personalResult=null
let realResult=null

if(financeType==="personal"||financeType==="both"){

const allowedPersonal=Math.min(60,remainingMonths)

if(personalMonths>allowedPersonal){

alert("عدد الأشهر المدخلة تتجاوز المسموح")

return

}

let ratio=sector==="retired"?0.25:0.3333

let installment=salary*ratio

if(deductions>salary*0.1167){

installment=salary*0.45-deductions

}

if(installment<=0){

alert("تم الرفض بسبب الاستقطاعات")

return

}

personalResult=calcFinance(installment,personalMonths,0.005,2500)

}

if(financeType==="real"||financeType==="both"){

if(realMonths>allowedRealMonths){

alert("عدد الأشهر المدخلة يتجاوز المسموح")

return

}

let ratio=realEstateType==="supported"?0.65:0.55

let personalInstallment=personalResult?personalResult.installment:0

let installmentReal=salary*ratio-deductions-personalInstallment

if(installmentReal<500){

alert("القسط أقل من الحد الأدنى 500")

return

}

realResult=calcFinance(installmentReal,realMonths,0.01,5000)

if(realResult.finance>2500000){

realResult.finance=2500000

}

}

setResult({

ageYears,

personal:personalResult,

real:realResult

})

}

return(

<main dir="rtl" style={{minHeight:"100vh",background:"#eef5ff",padding:16,fontFamily:"system-ui"}}>

<div style={{maxWidth:520,margin:"auto"}}>

<div style={{background:"linear-gradient(135deg,#0d47a1,#1976d2)",color:"white",padding:24,borderRadius:24}}>

<h1>احتساب</h1>
<p>منصة احتساب التمويل</p>

</div>

<section style={card}>

<h2>المدخلات</h2>

<label>نوع التمويل</label>

<select style={input} value={financeType} onChange={e=>setFinanceType(e.target.value)}>

<option value="personal">تمويل شخصي</option>
<option value="real">تمويل عقاري</option>
<option value="both">شخصي + عقاري</option>

</select>

<label>القطاع</label>

<select style={input} value={sector} onChange={e=>setSector(e.target.value)}>

<option value="civil">موظف</option>
<option value="retired">متقاعد</option>

</select>

<label>تاريخ الميلاد الهجري</label>

<div style={{display:"flex",gap:8}}>

<input style={input} placeholder="السنة" value={birthY} onChange={e=>setBirthY(e.target.value)}/>
<input style={input} placeholder="الشهر" value={birthM} onChange={e=>setBirthM(e.target.value)}/>
<input style={input} placeholder="اليوم" value={birthD} onChange={e=>setBirthD(e.target.value)}/>

</div>

<label>صافي الراتب</label>

<input style={input} type="number" value={salary} onChange={e=>setSalary(Number(e.target.value))}/>

<label>الاستقطاعات</label>

<input style={input} type="number" value={deductions} onChange={e=>setDeductions(Number(e.target.value))}/>

<label>النسبة السنوية</label>

<input style={input} type="number" value={rate} onChange={e=>setRate(Number(e.target.value))}/>

{(financeType==="personal"||financeType==="both")&&(

<>

<label>مدة التمويل الشخصي</label>

<input style={input} type="number" value={personalMonths} onChange={e=>setPersonalMonths(Number(e.target.value))}/>

</>

)}

{(financeType==="real"||financeType==="both")&&(

<>

<label>مدة التمويل العقاري (الحد {allowedRealMonths})</label>

<input style={input} type="number" value={realMonths} onChange={e=>setRealMonths(Number(e.target.value))}/>

<label>نوع العقاري</label>

<select style={input} value={realEstateType} onChange={e=>setRealEstateType(e.target.value)}>

<option value="normal">اعتيادي 55%</option>
<option value="supported">مدعوم 65%</option>

</select>

</>

)}

<button onClick={calculate} style={button}>احسب</button>

</section>

{result&&(

<section style={card}>

<h2>النتائج</h2>

<Row k="العمر" v={`${result.ageYears} سنة`}/>

{result.personal&&(

<>

<h3>التمويل الشخصي</h3>

<Row k="القسط" v={`${format(result.personal.installment)} ر.س`}/>
<Row k="مبلغ التمويل" v={`${format(result.personal.finance)} ر.س`}/>
<Row k="الربح" v={`${format(result.personal.profit)} ر.س`}/>
<Row k="الإجمالي" v={`${format(result.personal.total)} ر.س`}/>
<Row k="الرسوم" v={`${format(result.personal.fee)} ر.س`}/>
<Row k="الصافي" v={`${format(result.personal.net)} ر.س`}/>

</>

)}

{result.real&&(

<>

<h3>التمويل العقاري</h3>

<Row k="القسط" v={`${format(result.real.installment)} ر.س`}/>
<Row k="مبلغ التمويل" v={`${format(result.real.finance)} ر.س`}/>
<Row k="الربح" v={`${format(result.real.profit)} ر.س`}/>
<Row k="الإجمالي" v={`${format(result.real.total)} ر.س`}/>
<Row k="الرسوم" v={`${format(result.real.fee)} ر.س`}/>
<Row k="الصافي" v={`${format(result.real.net)} ر.س`}/>

</>

)}

</section>

)}

</div>

</main>

)

}

function Row({k,v}:any){

return(

<div style={{display:"flex",justifyContent:"space-between",background:"#f4f8ff",padding:12,borderRadius:12,marginBottom:8}}>

<span>{k}</span>
<b style={{color:"#0d47a1"}}>{v}</b>

</div>

)

}

const card={background:"white",padding:20,borderRadius:24,marginTop:16,boxShadow:"0 10px 30px rgba(13,71,161,.08)"}

const input={width:"100%",padding:14,borderRadius:14,border:"1px solid #d9e3f5",marginTop:6,marginBottom:12,fontSize:16}

const button={width:"100%",padding:16,background:"#0d47a1",color:"white",border:"none",borderRadius:14,fontSize:18}
