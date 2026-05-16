export function normalizeNumber(value: string) {
  return value
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/,/g, "")
    .replace(/٫/g, ".");
}

export function toNumber(value: string) {
  return Number(normalizeNumber(value) || 0);
}
