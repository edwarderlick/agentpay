import { STUDIO_NEXT } from "./constants";

function explorerBase(): string {
  return (
    process.env.NEXT_PUBLIC_EXPLORER_URL?.replace(/\/$/, "") ||
    STUDIO_NEXT.explorerUrl
  );
}

export function explorerHomeUrl(): string {
  return explorerBase();
}

export function explorerTxUrl(txId: string): string {
  return `${explorerBase()}/tx/${txId}`;
}

export function explorerAddressUrl(address: string): string {
  return `${explorerBase()}/address/${address}`;
}
