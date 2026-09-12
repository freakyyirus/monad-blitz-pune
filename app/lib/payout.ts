/**
 * Client-safe Monad payout helpers (bounty creation x402 + winner pay).
 *
 * These read the chain id 10143 (0x279F) and switch wallets onto the Monad
 * Testnet network before a transfer. Wrong-networks are surfaced as a clear,
 * actionable error instead of a cryptic RPC failure.
 */

import { monadTestnet } from "viem/chains";
import { defineChain, type Chain as ViemChain } from "viem";

export const MONAD_TX_LINK_PREFIX = "https://testnet.monadexplorer.com/tx/";

/** The chain we pay on. Honors MONAD_RPC_URL only on the server; in the browser
 *  this always resolves to the public Monad testnet chain (id 10143). */
export function getPayoutChain(): ViemChain {
  // In the browser process.env.MONAD_RPC_URL is undefined → monadTestnet.
  const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL;
  if (!rpcUrl) return monadTestnet;
  return defineChain({ ...monadTestnet, rpcUrls: { default: { http: [rpcUrl] } } });
}

export class WrongNetworkError extends Error {
  constructor(
    public readonly currentChainId: number,
    public readonly expectedChainId: number,
  ) {
    super(
      `Wrong network: wallet is on chain ${currentChainId}, expected Monad Testnet (${expectedChainId}).`,
    );
    this.name = "WrongNetworkError";
  }
}

/**
 * Ensures the EIP-1193 provider is connected to Monad Testnet.
 * Throws WrongNetworkError (with a user-facing message) when it can't switch.
 */
export async function ensureMonadNetwork(
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
): Promise<void> {
  const expected = getPayoutChain().id;

  let current = expected;
  try {
    const hex = (await provider.request({ method: "eth_chainId" })) as string;
    current = Number.parseInt(hex, 16);
  } catch {
    current = expected; // unreadable → assume fine, switch below will surface errors
  }

  if (current === expected) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${expected.toString(16)}` }],
    });
  } catch (err) {
    // 4902 = chain not added to the wallet yet — tell the user to add it.
    const code = (err as { code?: number }).code;
    if (code === 4902) {
      throw new WrongNetworkError(current, expected);
    }
    throw new WrongNetworkError(current, expected);
  }
}