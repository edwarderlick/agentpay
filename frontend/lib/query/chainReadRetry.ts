/** Finite retries for Studio Next gen_call / RPC reads. Persistent failures must surface as errors. */
export const CHAIN_READ_RETRY_LIMIT = 2;
export const CHAIN_READ_RETRY_DELAY_MS = 1000;

const TRANSIENT_READ = /Failed to fetch|Server busy|retry later|-32006/i;

export function shouldRetryChainRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= CHAIN_READ_RETRY_LIMIT) return false;
  const text = error instanceof Error ? error.message : String(error);
  return TRANSIENT_READ.test(text);
}

export function chainReadRetryDelay(): number {
  return CHAIN_READ_RETRY_DELAY_MS;
}
