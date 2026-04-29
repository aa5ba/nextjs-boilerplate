"use client"

import { useEffect, useState } from "react"

function format(n:number){
return Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
}

function formatCheck(n:number){
const v=Math.round(Number(n||0)*100)/100
if(v%1===0)return v.toLocaleString("en-US",{maximumFractionDigits:0})
return v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
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

const [financeType,setFinanceType]=useState("both")
const [sector,setSector]=useState("civil")

const [birthY,setBirthY]=useState("")
const [birthM,setBirthM]=useState("")
const [birthD,setBirthD]=useState("")

const [salary,setSalary]=useState(10000)
const [deductions,setDeductions]=useState(0)

const [rate,setRate]=useState(3)

const [personalMonths,setPersonalMonths]=useState(60)
const [realMonths,setRealMonths]=useState(360)

const [allowedPersonalMonths,setAllowedPersonalMonths]=useState(60)
const [allowedRealMonths,setAllowedRealMonths]=useState(360)

const [realEstateType,setRealEstateType]=useState("normal")
const [product,setProduct]=useState("ready")
const [supportType,setSupportType]=useState("none")

const [flex,setFlex]=useState(false)
const [flexInstallment,setFlexInstallment]=useState(500)

const [result,setResult]=useState<any>(null)

function maxAgeMonths(){
if(sector==="retired") return 70*12
return 60*12
}

function calcAgeMonths(){

const t=todayHijri()

let months=(t.y-Number(birthY))*12+(t.m-Number(birthM))

if(t.d<Number(birthD)) months--

return months

}

function updateAllowedMonths(){

if(!birthY||!birthM||!birthD) return

const ageMonths=calcAgeMonths()

const remaining=Math.max(0,maxAgeMonths()-ageMonths)

const personalAllowed=Math.min(60,remaining)
const realAllowed=Math.min(360,remaining)

setAllowedPersonalMonths(personalAllowed)
setAllowedRealMonths(realAllowed)

setPersonalMonths(personalAllowed)
setRealMonths(realAllowed)

}

useEffect(()=>{

updateAllowedMonths()

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

const remainingMonths=Math.max(0,maxAgeMonths()-ageMonths)

if(rate>20){

setResult({accepted:false,reason:"النسبة أعلى من الحد المسموح 20%"})

return

}

if(remainingMonths<=0){

setResult({accepted:false,reason:"تم الرفض بسبب العمر"})

return

}

let personalResult:any=null
let realResult:any=null

let personalInstallment=0

if(financeType==="personal"||financeType==="both"){

let ratio=sector==="retired"?0.25:0.3333

personalInstallment=salary*ratio

if(personalInstallment<=0){

setResult({accepted:false,reason:"رفض بسبب الاستقطاعات"})

return

}

personalResult=calcFinance(personalInstallment,personalMonths,0.005,2500)

if(personalResult.finance<5000){

setResult({accepted:false,reason:"التمويل أقل من الحد الأدنى 5000"})

return

}

}

if(financeType==="real"||financeType==="both"){

const ratio=salary>=15000?0.65:0.55

const maxInstallment=salary*ratio

const available=maxInstallment-deductions-personalInstallment

if(available<500){

setResult({accepted:false,reason:"القسط أقل من الحد الأدنى"})

return

}

let totalInstallments=available*realMonths

const r=(rate/100/12)*realMonths

let finance=totalInstallments/(1+r)

if(finance>2500000) finance=2500000

const profit=finance*r

const total=finance+profit

let fee=finance*0.01

if(fee>5000) fee=5000

const net=finance-fee

const down=product==="land"?finance*0.30:(realEstateType==="supported"?finance*0.05:finance*0.10)

const support=supportType==="package"?100000:0

const clientDown=Math.max(0,down-support)

const propertyValue=finance+down

const checkAmount=finance+support+clientDown

realResult={
installment:available,
months:realMonths,
finance,
profit,
total,
fee,
net,
clientDown,
support,
propertyValue,
checkAmount
}

}

setResult({

accepted:true,
ageYears,
personal:personalResult,
real:realResult

})

}

return(

<main dir="rtl" style={{minHeight:"100vh",background:"#eef5ff",padding:16,fontFamily:"system-ui"}}>

<div style={{maxWidth:560,margin:"auto"}}>

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

<label>الراتب</label>

<input style={input} type="number" value={salary} onChange={e=>setSalary(Number(e.target.value))}/>

<label>الاستقطاعات</label>

<input style={input} type="number" value={deductions} onChange={e=>setDeductions(Number(e.target.value))}/>

<label>النسبة السنوية</label>

<input style={input} type="number" value={rate} onChange={e=>setRate(Number(e.target.value))}/>

<button onClick={calculate} style={button}>احسب</button>

</section>

{result&&(

<section style={card}>

<h2>النتائج</h2>

{!result.accepted&&(

<div style={{background:"#fee2e2",color:"#991b1b",padding:12,borderRadius:12}}>

{result.reason}

</div>

)}

{result.accepted&&(

<>

<Row k="العمر" v={`${result.ageYears} سنة`}/>

{result.personal&&(

<>

<h3>التمويل الشخصي</h3>

<Row k="القسط" v={`${format(result.personal.installment)} ر.س`}/>
<Row k="مبلغ التمويل" v={`${format(result.personal.finance)} ر.س`}/>
<Row k="الربح" v={`${format(result.personal.profit)} ر.س`}/>
<Row k="الصافي" v={`${format(result.personal.net)} ر.س`}/>

</>

)}

{result.real&&(

<>

<h3>التمويل العقاري</h3>

<Row k="القسط" v={`${format(result.real.installment)} ر.س`}/>
<Row k="مبلغ التمويل" v={`${format(result.real.finance)} ر.س`}/>
<Row k="الربح" v={`${format(result.real.profit)} ر.س`}/>
<Row k="الصافي" v={`${format(result.real.net)} ر.س`}/>
<Row k="الدفعة من العميل" v={`${format(result.real.clientDown)} ر.س`}/>
<Row k="باقة الدعم" v={`${format(result.real.support)} ر.س`}/>
<Row k="قيمة العقار" v={`${format(result.real.propertyValue)} ر.س`}/>
<Row k="مبلغ الشيك" v={`${formatCheck(result.real.checkAmount)} ر.س`}/>

</>

)}

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
