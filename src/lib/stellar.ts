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

/** Circle's USDC issuer. Testnet by default; override for mainnet, where
 * Circle issues from a different account. */
export const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER ?? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

/** USDC's Stellar Asset Contract address, derived the same deterministic
 * way as the native one rather than pinned as a literal — so pointing
 * NEXT_PUBLIC_USDC_ISSUER at mainnet's issuer is all it takes to move
 * networks. Circle's SAC is already deployed on testnet, so no separate
 * `stellar contract asset deploy` step is needed. */
export function getUsdcAssetAddress(): string {
  return new Asset('USDC', USDC_ISSUER).contractId(NETWORK_PASSPHRASE);
}

const PUBLIC_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

/** Builds a stellar.expert URL for an account (wallet/NGO) or contract
 * (token) address, pointed at whichever network NETWORK_PASSPHRASE selects. */
export function explorerUrl(kind: 'account' | 'contract', id: string): string {
  const network = NETWORK_PASSPHRASE === PUBLIC_NETWORK_PASSPHRASE ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${network}/${kind}/${id}`;
}
