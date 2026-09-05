import { Asset } from '@stellar/stellar-sdk';

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';

export const DONATION_VAULT_CONTRACT_ID =
  process.env.NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID ?? '';

export const NGO_REGISTRY_CONTRACT_ID = process.env.NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID ?? '';

/** The native XLM asset's Stellar Asset Contract address is deterministic
 * per network, not something deployed/looked up separately. */
export function getNativeAssetAddress(): string {
  return Asset.native().contractId(NETWORK_PASSPHRASE);
}
