export function calculateAge(birthDate: string) {

  const today = new Date()
  const birth = new Date(birthDate)

  let age = today.getFullYear() - birth.getFullYear()

  const m = today.getMonth() - birth.getMonth()

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return age
}

export function maxFinanceMonths(age:number){

  const maxAge = 60

  const remainingYears = maxAge - age

  if(remainingYears <= 0) return 0

  const remainingMonths = remainingYears * 12

  return Math.min(remainingMonths,60)

}

export function calculateFinance({
salary,
deductions,
annualRate,
months,
isRetired
}:{
salary:number
deductions:number
annualRate:number
months:number
isRetired:boolean
}){

const available = salary - deductions

const ratio = isRetired ? 0.25 : 0.33

const installment = available * ratio

const totalInstallments = installment * months

// النسبة الشهرية

const monthlyRate = annualRate / 12 / 100

// النسبة الكلية حسب الشهور

const totalRate = monthlyRate * months

// مبلغ التمويل حسب طريقتنا

const financeAmount = totalInstallments / (1 + totalRate)

const profit = financeAmount * totalRate

const total = financeAmount + profit

const adminFee = financeAmount * 0.005

const netAmount = financeAmount - adminFee

return{

installment,
financeAmount,
profit,
adminFee,
netAmount,
total

}

}
