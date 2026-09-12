import { defineChain, type Chain as ViemChain } from "viem";
import { mainnet, monadTestnet } from "viem/chains";
import type { EvmTokenRef, NetworkKind, SplTokenRef } from "./types";

/**
 * Central blockchain configuration.
 *
 * All values are read lazily from the environment so this module is safe to
 * import in both browser (NEXT_PUBLIC_* is inlined at build time) and
 * Node/Next-server contexts. Nothing here is secret; signing keys live in
 * scripts/server-routes and are never shipped to the client.
 */

/** Default EVM chain for the app — Ethereum mainnet. */
export const DEFAULT_APP_EVM_CHAIN = mainnet;

/**
 * Default endpoints.
 * - The *app* reads Ethereum mainnet RPCs when no env var is set.
 * - *Scripts* (Hardhat deploys / demos) default to local anvil + solana-test-validator
 *   so local development works with zero funds, and fall back to public testnets
 *   only when the user sets the env vars explicitly.
 */
export const EVM_LOCAL_RPC = "http://127.0.0.1:8545";
export const SOLANA_LOCAL_RPC = "http://127.0.0.1:8899";
export const SOLANA_DEVNET_RPC = "https://api.devnet.solana.com";

export const SOLANA_COMMITMENT = "confirmed" as const;

/** Bitcoin defaults. Reads use public Blockstream API; sends use WIF keys. */
export const BTC_MAINNET_API = "https://blockstream.info/api";
export const BTC_TESTNET_API = "https://blockstream.info/testnet/api";

export function getEvmRpcUrl(): string {
  // App default: Ethereum mainnet (Backwards compatible). Scripts override this
  // before calling the service modules.
  return process.env.EVM_RPC_URL || process.env.RPC_URL || DEFAULT_APP_EVM_CHAIN.rpcUrls.default.http[0];
}

export function getEvmChainId(): number {
  const raw = process.env.EVM_CHAIN_ID || process.env.CHAIN_ID || String(DEFAULT_APP_EVM_CHAIN.id);
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? DEFAULT_APP_EVM_CHAIN.id : parsed;
}

/** Best-effort: returns a known viem chain or a minimal custom chain object. */
export function getEvmChain(): ViemChain {
  const chainId = getEvmChainId();
  if (chainId === 1) {
    const rpcUrl = getEvmRpcUrl();
    if (rpcUrl.includes("cloudflare-eth.com")) return mainnet;
    return getEvmChainForEnv(rpcUrl, "Ethereum Mainnet (custom RPC)", chainId);
  }
  if (chainId === 11155111) return getEvmChainForEnv(getEvmRpcUrl(), "Ethereum Sepolia (custom RPC)", chainId);
  if (chainId === 31337) return getEvmChainForEnv(EVM_LOCAL_RPC, "Local Anvil", 31337);
  return getEvmChainForEnv(getEvmRpcUrl(), undefined, chainId);
}

/** Build a viem chain object from an arbitrary RPC + chain id. */
export function getEvmChainForEnv(rpcUrl: string, name?: string, chainId?: number): ViemChain {
  const id = chainId ?? getEvmChainId();
  return defineChain({
    id,
    name: name ?? `Chain ${id}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

/**
 * Monad Testnet (chainId 10143 / 0x279F) — the x402 payment chain.
 * Node in the viem registry is `monadTestnet`; its public RPC currently points
 * at the public testnet endpoint. Override the RPC via MONAD_RPC_URL.
 */
export const MONAD_CHAIN_ID = monadTestnet.id; // 10143
export const MONAD_DEFAULT_RPC = "https://testnet-rpc.monad.xyz";
export const MONAD_NATIVE_SYMBOL = "MON";

/** The Monad Testnet viem chain, using MONAD_RPC_URL when set. */
export function getMonadChain(): ViemChain {
  const rpcUrl = process.env.MONAD_RPC_URL || MONAD_DEFAULT_RPC;
  if (!process.env.MONAD_RPC_URL) return monadTestnet;
  return defineChain({
    ...monadTestnet,
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

/** Native currency label for bounty prizes. Defaults to MON. */
export function getPrizeCurrencySymbol(): string {
  return process.env.NEXT_PUBLIC_PRIZE_CURRENCY || MONAD_NATIVE_SYMBOL;
}

/** Platform fee to post a bounty, denominated in native MON. */
export const PLATFORM_FEE = "0.001";

/** Solana RPC. The app/servers default to devnet; lean scripts default to the local validator. */
export function getSolanaRpcUrl(defaultRpc: string = SOLANA_DEVNET_RPC): string {
  return process.env.SOLANA_RPC_URL || defaultRpc;
}

export function getSolanaNetwork(defaultRpc: string = SOLANA_DEVNET_RPC): NetworkKind {
  const rpc = getSolanaRpcUrl(defaultRpc);
  if (rpc.includes("127.0.0.1") || rpc.includes("localhost")) return "local";
  if (rpc.includes("devnet")) return "devnet";
  if (rpc.includes("testnet")) return "testnet";
  if (rpc.includes("mainnet")) return "mainnet";
  return "devnet";
}

/** Optional list of ERC-20 tokens the app should surface as `{address}:{symbol}`(:{decimals}). */
export function getEvmTokenList(): EvmTokenRef[] {
  const raw = process.env.EVM_TOKEN_LIST;
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [address, symbol, decimals] = entry.split(":");
      return { address, symbol: symbol || undefined, decimals: decimals ? Number.parseInt(decimals, 10) : undefined };
    });
}

/** Optional list of SPL token mints as `{mint}:{symbol}`(:{decimals}). */
export function getSplTokenList(): SplTokenRef[] {
  const raw = process.env.SOLANA_TOKEN_LIST;
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [mint, symbol, decimals] = entry.split(":");
      return { mint, symbol: symbol || undefined, decimals: decimals ? Number.parseInt(decimals, 10) : undefined };
    });
}