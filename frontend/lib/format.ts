export function shortenHex(value: string, lead = 6, tail = 4): string {
  if (!value) return "";
  if (value.length <= lead + tail + 2) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

import { formatWeiAsGen } from "./wei";

export function formatGen(amount: string | number | bigint | null | undefined): string {
  return formatWeiAsGen(amount);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  if (/^\d+$/.test(iso)) {
    const seconds = Number(iso);
    const d = new Date(seconds > 1e12 ? seconds : seconds * 1000);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
