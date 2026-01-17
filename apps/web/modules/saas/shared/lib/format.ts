/**
 * Format a numeric value as currency (INR by default)
 * Handles string, number, null, and undefined inputs
 */
export const formatMoney = (
  value: string | number | null | undefined,
  currency = "INR"
): string => {
  if (value === null || value === undefined) {
    return "—";
  }
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) {
    return "—";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(num);
};
