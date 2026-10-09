import { formatUnits, parseUnits } from "viem";

export const GEN_DECIMALS = 18;

export function parseGenToWei(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
  try {
    const wei = parseUnits(trimmed, GEN_DECIMALS);
    if (wei <= 0n) return null;
    return wei;
  } catch {
    return null;
  }
}

export function weiToGenNumber(wei: bigint): number {
  return Number(formatUnits(wei, GEN_DECIMALS));
}

export function formatWeiAsGen(amount: string | number | bigint | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }
  try {
    const wei = typeof amount === "bigint" ? amount : BigInt(amount);
    const formatted = formatUnits(wei, GEN_DECIMALS);
    const n = Number(formatted);
    if (!Number.isFinite(n)) return `${formatted} test GEN`;
    return `${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })} test GEN`;
  } catch {
    return "—";
  }
}

export function toWeiString(value: bigint | number | string): string {
  return BigInt(value).toString();
}
