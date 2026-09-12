import {
  LAMPORTS_PER_SOL,
  PublicKey,
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  TransactionSignature,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import bs58 from "bs58";
import { getSolanaRpcUrl, SOLANA_COMMITMENT } from "./config";
import type {
  ChainBalances,
  SplTokenRef,
  TokenBalance,
  TransferRequest,
} from "./types";

let connectionCache: Connection | null = null;

export function getSolanaConnection(rpcUrl?: string): Connection {
  const endpoint = rpcUrl || getSolanaRpcUrl();
  if (!connectionCache || connectionCache.rpcEndpoint !== endpoint) {
    connectionCache = new Connection(endpoint, SOLANA_COMMITMENT);
  }
  return connectionCache;
}

export { clusterApiUrl };

/** Load a keypair from a base58 secret key (SOLANA_PRIVATE_KEY). */
export function getSolanaKeypair(privateKey?: string): Keypair {
  const secret = privateKey || process.env.SOLANA_PRIVATE_KEY;
  if (!secret) {
    throw new Error(
      "getSolanaKeypair: no secret key. Pass a base58 private key or set SOLANA_PRIVATE_KEY.",
    );
  }
  const decoded = bs58.decode(secret);
  if (decoded.length !== 64) {
    throw new Error("getSolanaKeypair: invalid secret key. Expected a 64-byte base58 key.");
  }
  return Keypair.fromSecretKey(decoded);
}

export function normalizeSolanaAddress(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch {
    throw new Error(`Invalid Solana address: ${address}`);
  }
}

/** Fetch the native SOL balance for an address. */
export async function getSolanaBalance(
  address: string,
  opts?: { connection?: Connection },
): Promise<TokenBalance> {
  const owner = normalizeSolanaAddress(address);
  const connection = opts?.connection ?? getSolanaConnection();
  const raw = await connection.getBalance(owner, SOLANA_COMMITMENT);
  const balance = raw / LAMPORTS_PER_SOL;
  return {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    raw: raw.toString(),
    balance: balance.toLocaleString("en-US", { maximumFractionDigits: 9 }),
    native: true,
  };
}

/**
 * Parse SPL (and Token-2022) token accounts owned by `address`.
 * If `mints` is provided only those tokens are returned; symbol/decimals are
 * pulled from the refs (SPL metadata is not on-chain by default).
 */
export async function getSplTokenBalances(
  address: string,
  mints: SplTokenRef[] = [],
  opts?: { connection?: Connection },
): Promise<TokenBalance[]> {
  const owner = normalizeSolanaAddress(address);
  const connection = opts?.connection ?? getSolanaConnection();
  const allowlist = mints.length > 0 ? new Set(mints.map((m) => m.mint)) : null;

  const programIds = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];
  const accounts: Array<{
    mint: string;
    amount: string;
    decimals: number;
  }> = [];

  for (const programId of programIds) {
    try {
      const { value } = await connection.getParsedTokenAccountsByOwner(owner, { programId });
      for (const account of value) {
        const parsed = account.account.data.parsed as {
          info: { mint: string; tokenAmount: { amount: string; decimals: number } };
        };
        accounts.push({
          mint: parsed.info.mint,
          amount: parsed.info.tokenAmount.amount,
          decimals: parsed.info.tokenAmount.decimals,
        });
      }
    } catch {
      // Token-2022 program may not exist on some clusters — ignore.
    }
  }

  const results: TokenBalance[] = [];
  for (const account of accounts) {
    if (allowlist && !allowlist.has(account.mint)) continue;
    const ref = mints.find((m) => m.mint === account.mint);
    const raw = BigInt(account.amount);
    const decimals = ref?.decimals ?? account.decimals;
    const symbol = ref?.symbol ?? account.mint.slice(0, 4).toUpperCase();
    const name = ref?.name ?? `SPL ${account.mint.slice(0, 6)}...`;
    results.push({
      symbol,
      name,
      decimals,
      raw: raw.toString(),
      balance: formatSpl(raw, decimals),
      native: false,
      mint: account.mint,
    });
  }
  // Always include allowlisted mints even when the account is empty.
  if (mints.length > 0) {
    for (const ref of mints) {
      const existing = results.find((t) => t.mint === ref.mint);
      if (existing) continue;
      results.push({
        symbol: ref.symbol ?? ref.mint.slice(0, 4).toUpperCase(),
        name: ref.name ?? `SPL ${ref.mint.slice(0, 6)}...`,
        decimals: ref.decimals ?? 0,
        raw: "0",
        balance: "0",
        native: false,
        mint: ref.mint,
      });
    }
  }
  return results;
}

function formatSpl(raw: bigint, decimals: number): string {
  return (Number(raw) / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: decimals });
}

export async function getSolanaWalletBalances(
  address: string,
  mints: SplTokenRef[] = [],
  opts?: { connection?: Connection },
): Promise<ChainBalances> {
  const [native, tokens] = await Promise.all([
    getSolanaBalance(address, opts),
    getSplTokenBalances(address, mints, opts),
  ]);
  return {
    chain: "solana",
    address,
    network: (opts?.connection ?? getSolanaConnection()).rpcEndpoint,
    native,
    tokens,
    updatedAt: Date.now(),
  };
}

export interface SolanaTransferInput extends TransferRequest {
  connection?: Connection;
  /** Sender public key (base58). */
  from: string;
  /** Called with a partially prepared Transaction; the wallet signs it. */
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

/**
 * Send SOL from a connected wallet (browser). The transaction is built by the
 * SDK, signed by the wallet adapter's `signTransaction`, then broadcast.
 */
export async function sendSolanaTransferViaWallet(request: SolanaTransferInput): Promise<{ hash: string }> {
  const connection = request.connection ?? getSolanaConnection();
  const from = normalizeSolanaAddress(request.from);
  const to = normalizeSolanaAddress(request.to);
  const lamports = solAmountToLamports(request.amount);

  if (from.equals(to)) throw new Error("Sender and recipient must differ.");

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(SOLANA_COMMITMENT);
  const transaction = new Transaction({
    feePayer: from,
    blockhash,
    lastValidBlockHeight,
  });
  transaction.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports }));

  const signed = await request.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 5, skipPreflight: false });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, SOLANA_COMMITMENT);
  return { hash: signature };
}

/** Send SOL using a keypair (scripts / server-side signing). */
export async function sendSolanaTransferWithKeypair(
  request: Omit<SolanaTransferInput, "signTransaction" | "from"> & { from?: string },
): Promise<{ hash: string }> {
  const keypair = getSolanaKeypair(request.memo?.includes("use:") ? undefined : process.env.SOLANA_PRIVATE_KEY);
  void keypair;
  const signer = getSolanaKeypair();
  const connection = request.connection ?? getSolanaConnection();
  const to = normalizeSolanaAddress(request.to);
  const lamports = solAmountToLamports(request.amount);

  const transaction = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: signer.publicKey, toPubkey: to, lamports }),
  );
  const signature: TransactionSignature = await sendAndConfirmTransaction(connection, transaction, [signer], {
    commitment: SOLANA_COMMITMENT,
    skipPreflight: false,
  });
  return { hash: signature };
}

/** Convert a SOL amount string to lamports. */
export function solAmountToLamports(amount: string): number {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid SOL amount: ${amount}`);
  }
  return Math.floor(parsed * LAMPORTS_PER_SOL);
}

export { getOrCreateAssociatedTokenAccount };

/** Request an airdrop (works on devnet and local test-validator). */
export async function solanaRequestAirdrop(address: string, amountSol: number, connection?: Connection): Promise<string> {
  const conn = connection ?? getSolanaConnection();
  const pubkey = normalizeSolanaAddress(address);
  const signature = await conn.requestAirdrop(pubkey, Math.floor(amountSol * LAMPORTS_PER_SOL));
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash(SOLANA_COMMITMENT);
  await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, SOLANA_COMMITMENT);
  return signature;
}