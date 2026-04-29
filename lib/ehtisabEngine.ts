export function calculateAge(birthDate: string) {
  const today = new Date();
  const birth = new Date(birthDate);

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

export function maxFinanceMonths(age: number) {
  const maxAge = 60;
  const remainingYears = maxAge - age;

  if (remainingYears <= 0) return 0;

  return remainingYears * 12;
}

export function calculateFinance({
  salary,
  deductions,
  annualRate,
  months
}: {
  salary: number;
  deductions: number;
  annualRate: number;
  months: number;
}) {

  const available = salary - deductions;

  const installment = available * 0.33;

  const totalInstallments = installment * months;

  const profit = totalInstallments * (annualRate / 100);

  const financeAmount = totalInstallments - profit;

  const adminFee = financeAmount * 0.005;

  const netAmount = financeAmount - adminFee;

  return {
    installment,
    financeAmount,
    profit,
    adminFee,
    netAmount,
    total: totalInstallments
  };
}
