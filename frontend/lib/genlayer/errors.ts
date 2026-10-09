export type WalletErrorCode = 4001 | -32002 | 4902 | "timeout" | "disconnected" | "unsupported" | "unknown";

export type MappedWalletError = {
  code: WalletErrorCode;
  message: string;
  original?: unknown;
};

function readCode(err: unknown): number | string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const record = err as { code?: number | string; cause?: { code?: number | string } };
  return record.code ?? record.cause?.code;
}

function readMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err ?? "");
}

export function mapWalletError(err: unknown): MappedWalletError {
  const code = readCode(err);
  const message = readMessage(err);

  if (code === 4001 || /rejected|denied|cancelled|canceled/i.test(message)) {
    return { code: 4001, message: "Request rejected in the wallet.", original: err };
  }
  if (code === -32002 || /already pending|request already pending/i.test(message)) {
    return {
      code: -32002,
      message: "A wallet request is already open. Finish or close it, then retry.",
      original: err,
    };
  }
  if (code === 4902 || /unrecognized chain|unknown chain/i.test(message)) {
    return { code: 4902, message: "This wallet does not have Studio Next yet.", original: err };
  }
  if (/timed out/i.test(message)) {
    return { code: "timeout", message, original: err };
  }
  if (/disconnect/i.test(message)) {
    return {
      code: "disconnected",
      message: "The wallet disconnected. Connect again to continue.",
      original: err,
    };
  }
  return {
    code: "unknown",
    message: message || "Wallet request failed.",
    original: err,
  };
}
