export function formatCents(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "$0.00";
  const dollars = n / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function parseDollarsToCents(value) {
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}
