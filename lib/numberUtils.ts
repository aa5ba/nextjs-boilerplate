export function normalizeNumber(value: string) {
  return value
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/,/g, "")
    .replace(/٫/g, ".");
}

export function toEnglishDigits(
  value: string | number | null | undefined
) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    )
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    );
}

export function toNumber(value: string) {
  return Number(normalizeNumber(value) || 0);
}
