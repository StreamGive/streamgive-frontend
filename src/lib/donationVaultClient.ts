import { Client } from '@stellar/stellar-sdk/contract';

import type { WalletSignTransaction } from '@/components/wallet/WalletProvider';

import { DONATION_VAULT_CONTRACT_ID, NETWORK_PASSPHRASE, SOROBAN_RPC_URL } from './stellar';

/**
 * A fresh Client per call rather than a cached singleton: Client.from is
 * async (it fetches the contract's spec from the network) and cheap
 * enough not to bother caching yet — worth revisiting if this turns out
 * to be a real cost once this is actually running against a network.
 */
export async function getDonationVaultClient(
  publicKey: string,
  signTransaction: WalletSignTransaction,
) {
  if (!DONATION_VAULT_CONTRACT_ID) {
    throw new Error('NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID is not set');
  }

  return Client.from({
    contractId: DONATION_VAULT_CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
    signTransaction,
  });
}
