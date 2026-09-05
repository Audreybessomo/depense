import { Prisma } from "@prisma/client";

export type Decimalish = Prisma.Decimal | number | string;

export function toNumber(value: Decimalish | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

const FORMATTERS = new Map<string, Intl.NumberFormat>();

/**
 * Formatage monetaire francais. Les devises sans sous-unite (XAF, XOF, JPY...)
 * sont affichees sans decimales.
 */
export function formatMoney(
  value: Decimalish | null | undefined,
  devise: string,
  decimals?: number,
): string {
  const n = toNumber(value);
  const d = decimals ?? (ZERO_DECIMAL.has(devise) ? 0 : 2);
  const key = `${devise}:${d}`;
  let fmt = FORMATTERS.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
    FORMATTERS.set(key, fmt);
  }
  return `${fmt.format(n)} ${devise}`;
}

export const ZERO_DECIMAL = new Set(["XAF", "XOF", "JPY", "KRW", "CLP", "VND"]);

export function formatCompact(value: Decimalish, devise: string): string {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const fmt = (v: number, suffix: string) =>
    `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)}${suffix} ${devise}`;
  if (abs >= 1_000_000_000) return fmt(n / 1_000_000_000, " Md");
  if (abs >= 1_000_000) return fmt(n / 1_000_000, " M");
  if (abs >= 10_000) return fmt(n / 1_000, " k");
  return formatMoney(n, devise);
}

/** Arrondi bancaire a `decimals` decimales, en Decimal Prisma. */
export function round(value: Decimalish, decimals = 2): Prisma.Decimal {
  return new Prisma.Decimal(toNumber(value).toFixed(decimals));
}
