import { GENLAYER_CHAIN } from "../genlayer/client";

const BLOCKED_ADDRESSES = new Set(
  [
    "0x0a18edf32FfB3B58ED274207210E7516FF77b058",
    "0x86f154Fa44A130BB9d653A42c3362C658B058837",
    "0x93f166F3d6BA408dC9d427B32d716dff6b705461",
    "0x00c12559fa8C78e76F369a0d513ce45447E61892",
    "0xdeE932fA7997325381d47808A3283eD4A420Ba22",
    "0x7F53A0e573AA486b9bc19557e9a9149F5D1068B5",
    "0x7561080FEB7557beF4E19BEAB3E95CcBdbfB1Fbd",
    "0x49bCB8C291a1Ee61c3ea5341ACA3b7eb38eC7283",
  ].map((value) => value.toLowerCase()),
);

export const VERIFIED_PRODUCT_ADDRESS = "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F";

export const REQUIRED_WRITES = [
  "create_mandate",
  "issue_invoice",
  "request_payment",
  "withdraw_credit",
  "close_mandate",
] as const;

export const REQUIRED_VIEWS = [
  "get_mandate",
  "get_invoice",
  "get_request",
  "get_merchant_credit",
  "get_withdrawn",
  "get_merchant_credit_row",
  "list_mandates_for_owner",
  "list_mandates_for_agent",
  "list_mandates_for_merchant",
  "list_invoices_for_mandate",
  "list_invoices_for_merchant",
  "list_requests_for_mandate",
  "list_requests_for_agent",
  "list_credit_mandates_for_merchant",
  "list_mandates",
  "list_requests",
  "get_accounting",
  "get_schema",
] as const;

const schemaVerified = new Set<string>();

export function getConfiguredContractAddress(): string {
  return process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim() ?? "";
}

export function isBlockedFixtureAddress(address: string): boolean {
  return BLOCKED_ADDRESSES.has(address.toLowerCase());
}

export function isVerifiedProductAddress(address: string): boolean {
  return address.toLowerCase() === VERIFIED_PRODUCT_ADDRESS.toLowerCase();
}

export function markSchemaVerified(address: string): void {
  schemaVerified.add(address.toLowerCase());
}

export function clearSchemaVerification(): void {
  schemaVerified.clear();
}

export function schemaMatchesAgentPay(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const schema = raw as { name?: unknown; writes?: unknown; views?: unknown };
  if (String(schema.name ?? "") !== "AgentPay") return false;
  const writes = Array.isArray(schema.writes) ? schema.writes.map(String) : [];
  const views = Array.isArray(schema.views) ? schema.views.map(String) : [];
  return (
    REQUIRED_WRITES.every((method) => writes.includes(method)) &&
    REQUIRED_VIEWS.every((method) => views.includes(method))
  );
}

export function isContractReady(): boolean {
  const address = getConfiguredContractAddress();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
  if (isBlockedFixtureAddress(address)) return false;
  if (isVerifiedProductAddress(address)) return true;
  return schemaVerified.has(address.toLowerCase());
}

export function contractPendingMessage(): string {
  const address = getConfiguredContractAddress();
  if (isBlockedFixtureAddress(address)) {
    return "This address is a probe or test fixture. Set NEXT_PUBLIC_CONTRACT_ADDRESS to the dedicated product deploy.";
  }
  if (!address) {
    return "Writes stay disabled until NEXT_PUBLIC_CONTRACT_ADDRESS points at the dedicated Studio Next AgentPay deployment.";
  }
  if (isVerifiedProductAddress(address) || schemaVerified.has(address.toLowerCase())) {
    return "Contract methods are confirmed. A Studio Next wallet can submit writes.";
  }
  return "This address is not the verified AgentPay deploy. It becomes ready only after get_schema matches the AgentPay surface.";
}

export function getChainBinding() {
  return {
    chainId: GENLAYER_CHAIN.id,
    chainName: GENLAYER_CHAIN.name,
    rpcUrl: GENLAYER_CHAIN.rpcUrls.default.http[0],
    contractAddress: getConfiguredContractAddress() || null,
    methodsConfirmed: isContractReady(),
  };
}
