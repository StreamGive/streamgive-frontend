import { Client } from '@stellar/stellar-sdk/contract';

import type { WalletSignTransaction } from '@/components/wallet/WalletProvider';

import { NETWORK_PASSPHRASE, NGO_REGISTRY_CONTRACT_ID, SOROBAN_RPC_URL } from './stellar';

export async function getNgoRegistryClient(
  publicKey: string,
  signTransaction: WalletSignTransaction,
) {
  if (!NGO_REGISTRY_CONTRACT_ID) {
    throw new Error('NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID is not set');
  }

  return Client.from({
    contractId: NGO_REGISTRY_CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
    signTransaction,
  });
}
