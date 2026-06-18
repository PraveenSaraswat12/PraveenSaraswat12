export const fmtPct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

export const fmtNum = (n: number) => n.toLocaleString("en-IN");

export const fmtInr = (n: number) =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;

export const fmtInrCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

export const fmtDays = (n: number | null) =>
  n == null ? "—" : `${n.toFixed(1)}d`;
