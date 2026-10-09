const PREFIX: Record<string, string> = {
  mandate: "m",
  invoice: "inv",
  request: "req",
};

export function newContractId(kind: keyof typeof PREFIX): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${PREFIX[kind]}-${hex}`;
}
