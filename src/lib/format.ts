export const formatINR = (n: number | string) => {
  const v = typeof n === "string" ? Number(n) : n;
  if (!isFinite(v)) return "₹0";
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(v))}`;
};
