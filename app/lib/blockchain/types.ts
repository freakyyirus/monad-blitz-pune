export type Chain = "evm" | "solana" | "btc";
export type NetworkKind = "mainnet" | "testnet" | "devnet" | "local";

export interface TokenBalance {
  /** Ticker symbol (e.g. SOL, ETH, MON, USDC). */
  symbol: string;
  /** Human readable asset name. */
  name: string;
  /** Number of decimal places used by the asset. */
  decimals: number;
  /** Raw integer amount (wei / lamports / smallest unit). */
  raw: string;
  /** Formatted, human readable balance. */
  balance: string;
  /** True when this is the chain's native asset. */
  native: boolean;
  /** For SPL tokens: the token mint address. */
  mint?: string;
  /** For EVM tokens: the ERC-20 contract address. */
  contract?: string;
}

export interface ChainBalances {
  chain: Chain;
  /** The queried address. */
  address: string;
  /** Network label the data was read from (used for logging). */
  network: string;
  native: TokenBalance;
  tokens: TokenBalance[];
  updatedAt: number;
}

export interface SendTransactionResult {
  chain: Chain;
  /** Transaction signature / hash. */
  hash: string;
  /** Optional confirmation details. */
  blockhash?: string;
}

/** A reference to an ERC-20 token to display balances for. */
export interface EvmTokenRef {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
}

/** A reference to an SPL token to display balances for. */
export interface SplTokenRef {
  mint: string;
  symbol?: string;
  name?: string;
  decimals?: number;
}

export interface TransferRequest {
  chain: Chain;
  /** Recipient address (hex for EVM, base58 for Solana / Bitcoin). */
  to: string;
  /** Amount in the chain's native unit (e.g. "0.001"). */
  amount: string;
  /** Optional memo/note. */
  memo?: string;
}

export interface ReadContractRequest<Args extends readonly unknown[] = readonly unknown[]> {
  /** Contract address. */
  address: string;
  /** JSON ABI fragment (must include the function). */
  abi: unknown[];
  functionName: string;
  args?: Args;
  /** Override the active RPC (defaults to the configured chain). */
  rpcUrl?: string;
}

export interface WriteContractRequest<Args extends readonly unknown[] = readonly unknown[]> {
  address: string;
  abi: unknown[];
  functionName: string;
  args?: Args;
  /** Value in native units (validation only; actual value attached by wallet). */
  value?: string;
}