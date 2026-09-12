/**
 * Unified blockchain service.
 *
 * Import this module to work with both EVM and Solana chains through a
 * single, chain-agnostic API.  Every helper is safe to import on both client
 * and server – keys are never exposed; signing happens via EIP-1193 provider
 * (browser wallets) or private-key holder (scripts / API routes).
 *
 * @example Server route
 * ```ts
 * import { getBalance, getTokenBalances } from "@/app/lib/blockchain";
 * ```
 *
 * @example Client component
 * ```ts
 * import { getBalance } from "@/app/lib/blockchain";
 * ```
 */

// Re-export service modules directly for advanced usage.
export { getEvmPublicClient, getEvmWalletClient, getEvmBalance, getEvmTokenBalances, getEvmWalletBalances, sendEvmTransfer, readEvmContract, writeEvmContract, normalizeEvmAddress, ERC20_ABI, ERC20_TRANSFER_ABI } from "./evm";
export { getSolanaConnection, getSolanaBalance, getSplTokenBalances, getSolanaWalletBalances, sendSolanaTransferViaWallet, sendSolanaTransferWithKeypair, getSolanaKeypair, solAmountToLamports, normalizeSolanaAddress, solanaRequestAirdrop } from "./solana";
export { getBtcBalance, getBtcWalletBalances, getBtcUtxos, getBtcAddressInfo, sendBtc, buildBtcPsbt, broadcastBtc, btcToSats, validateBtcAddress } from "./btc";
export { getEvmRpcUrl, getEvmChainId, getEvmChain, getSolanaRpcUrl, getSolanaNetwork, getEvmTokenList, getSplTokenList, getPrizeCurrencySymbol } from "./config";
export type { Chain, NetworkKind, TokenBalance, ChainBalances, SendTransactionResult, TransferRequest, EvmTokenRef, SplTokenRef, ReadContractRequest, WriteContractRequest } from "./types";

import { type Chain, type TokenBalance, type ChainBalances, type TransferRequest, type SendTransactionResult, type ReadContractRequest, type WriteContractRequest } from "./types";
import { getEvmBalance, getEvmTokenBalances, getEvmWalletBalances, sendEvmTransfer, readEvmContract, writeEvmContract, getEvmWalletClient, normalizeEvmAddress } from "./evm";
import { getSolanaBalance, getSplTokenBalances, getSolanaWalletBalances, sendSolanaTransferViaWallet, getSolanaConnection, normalizeSolanaAddress } from "./solana";
import { getBtcBalance, getBtcWalletBalances, sendBtc } from "./btc";
import { getEvmTokenList, getSplTokenList } from "./config";

// ----------------------------------------------------------------
//  Convenience helpers that hide the chain behind a single call.
// ----------------------------------------------------------------

/**
 * Fetch the native balance of `address` on the given `chain`.
 */
export async function getBalance(
  chain: Chain,
  address: string,
  opts?: { rpcUrl?: string },
): Promise<TokenBalance> {
  if (chain === "evm") {
    return getEvmBalance(address, { rpcUrl: opts?.rpcUrl });
  }
  if (chain === "btc") {
    return getBtcBalance(address);
  }
  return getSolanaBalance(address, {
    connection: opts?.rpcUrl ? getSolanaConnection(opts.rpcUrl) : undefined,
  });
}

/**
 * Fetch all configured ERC-20 / SPL token balances for `address`.
 * Tokens are listed via the `EVM_TOKEN_LIST` and `SOLANA_TOKEN_LIST` env vars
 * or can be passed explicitly. Bitcoin has no token layer.
 */
export async function getTokenBalances(
  chain: Chain,
  address: string,
  opts?: { rpcUrl?: string },
): Promise<TokenBalance[]> {
  if (chain === "evm") {
    return getEvmTokenBalances(address, getEvmTokenList(), opts);
  }
  if (chain === "btc") {
    return [];
  }
  return getSplTokenBalances(address, getSplTokenList(), {
    connection: opts?.rpcUrl ? getSolanaConnection(opts.rpcUrl) : undefined,
  });
}

/**
 * Fetch native (+ configured token) balances for a single address in one call.
 */
export async function getWalletBalances(
  chain: Chain,
  address: string,
  opts?: { rpcUrl?: string },
): Promise<ChainBalances> {
  if (chain === "evm") {
    return getEvmWalletBalances(address, getEvmTokenList(), opts);
  }
  if (chain === "btc") {
    return getBtcWalletBalances(address);
  }
  return getSolanaWalletBalances(address, getSplTokenList(), {
    connection: opts?.rpcUrl ? getSolanaConnection(opts.rpcUrl) : undefined,
  });
}

/**
 * Send a native-currency transfer.
 * - `provider` for browser EVM wallets (Privy / injected).
 * - `privateKey` / env PRIVATE_KEY for server-side EVM signing.
 * - `signTransaction` for browser Solana wallets; `privateKey` for scripts.
 * - `wif` (BTC_PRIVATE_KEY_WIF env) for server-side Bitcoin sends.
 */
export async function sendTransfer(request: TransferRequest, signerOpts?: { provider?: unknown; privateKey?: string; from?: string; wif?: string }): Promise<SendTransactionResult> {
  if (request.chain === "btc") {
    const { hash } = await sendBtc({ ...request, wif: signerOpts?.wif });
    return { chain: "btc", hash };
  }
  if (request.chain === "evm") {
    const { hash } = await sendEvmTransfer({ to: request.to, amount: request.amount, memo: request.memo, ...signerOpts });
    return { chain: "evm", hash };
  }
  // Solana – browser path uses signTransaction; server path uses private key.
  if (signerOpts?.provider) {
    throw new Error("Solana browser signing requires a signTransaction callback. Use sendSolanaTransferViaWallet directly.");
  }
  if (signerOpts?.privateKey) {
    const { sendSolanaTransferWithKeypair } = await import("./solana");
    const { hash } = await sendSolanaTransferWithKeypair({ ...request, from: normalizeSolanaAddress(signerOpts.from ?? "").toString() });
    return { chain: "solana", hash };
  }
  throw new Error("sendTransfer (solana): pass signerOpts.provider or signerOpts.privateKey.");
}

/** Read from any EVM contract (view). */
export async function readContract<Args extends readonly unknown[] = readonly unknown[]>(request: ReadContractRequest<Args>): Promise<unknown> {
  return readEvmContract(request);
}

/** Write to any EVM contract via wallet or private key. */
export async function writeContract<Args extends readonly unknown[] = readonly unknown[]>(
  request: WriteContractRequest<Args>,
  signerOpts?: { provider?: unknown; privateKey?: string; from?: string },
): Promise<SendTransactionResult> {
  const { hash } = await writeEvmContract({ ...request, ...signerOpts });
  return { chain: "evm", hash };
}