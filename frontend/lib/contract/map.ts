import type { DecisionOutcome, MandateStatus } from "./types";

export function mapOutcome(raw: string | null | undefined): DecisionOutcome {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "APPROVED") return "approved";
  if (value === "DENIED") return "denied";
  return "unresolved";
}

export function mapMandateStatus(raw: string | null | undefined, closed?: boolean): MandateStatus {
  if (closed) return "closed";
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "active" || value === "expired" || value === "closed") return value;
  return "unknown";
}

export function asAddress(value: string): `0x${string}` {
  return value as `0x${string}`;
}

export function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

export function asWeiString(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return BigInt(value).toString();
  if (typeof value === "string" && value !== "") {
    try {
      return BigInt(value).toString();
    } catch {
      return "0";
    }
  }
  return "0";
}

export function asBool(value: unknown): boolean {
  return value === true || value === "true";
}
