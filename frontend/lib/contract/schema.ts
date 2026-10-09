import {
  getConfiguredContractAddress,
  isBlockedFixtureAddress,
  isContractReady,
  isVerifiedProductAddress,
  markSchemaVerified,
  schemaMatchesAgentPay,
} from "./config";
import { readView } from "./readClient";

export async function verifyReplacementSchema(
  address = getConfiguredContractAddress(),
): Promise<boolean> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
  if (isBlockedFixtureAddress(address)) return false;
  if (isVerifiedProductAddress(address)) {
    markSchemaVerified(address);
    return true;
  }
  try {
    const schema = await readView<unknown>("get_schema", [], address);
    if (!schemaMatchesAgentPay(schema)) return false;
    markSchemaVerified(address);
    return true;
  } catch {
    return false;
  }
}

export async function ensureContractReady(): Promise<boolean> {
  if (isContractReady()) return true;
  const address = getConfiguredContractAddress();
  if (!address || isBlockedFixtureAddress(address)) return false;
  return verifyReplacementSchema(address);
}
