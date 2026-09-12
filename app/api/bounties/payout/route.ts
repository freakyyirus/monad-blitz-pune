import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseEther, type Hash, type Transaction } from "viem";
import { db } from "@/app/lib/db";
import { decorateSupabaseError } from "@/app/lib/supabase-guard";
import { getMonadChain, MONAD_DEFAULT_RPC, MONAD_NATIVE_SYMBOL, MONAD_CHAIN_ID } from "@/app/lib/blockchain/config";

let _client: ReturnType<typeof createPublicClient> | null = null;
function getPublicClient() {
  if (!_client) {
    const chain = getMonadChain();
    const rpc = process.env.MONAD_RPC_URL || MONAD_DEFAULT_RPC;
    _client = createPublicClient({
      chain,
      transport: http(rpc, { timeout: 10_000, retryCount: 3, retryDelay: 500 }),
    });
  }
  return _client;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch a transaction with exponential backoff (public testnet RPCs are flaky). */
async function fetchTxWithRetry(hash: Hash): Promise<Transaction | null> {
  const client = getPublicClient();
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await client.getTransaction({ hash });
    } catch (err) {
      const known = err as { code?: number; shortMessage?: string; message?: string };
      if (attempt < attempts) {
        console.warn(
          `[payout] RPC getTransaction attempt ${attempt}/${attempts} failed ` +
            `(${known.shortMessage || (err instanceof Error ? err.message : "unknown")}). Retrying…`,
        );
        await wait(attempt === 1 ? 500 : 1250);
        continue;
      }
      throw err;
    }
  }
  return null; // unreachable
}

/**
 * Marks a bounty as PAID after a winner payout.
 *
 * The client sends the payout tx hash; this route verifies the on-chain
 * payment BEFORE recording it: recipient must be the winning submission's
 * hunter address, value must be >= the bounty prize, on Monad Testnet.
 * If verification fails the status is NOT flipped.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bountyId, submissionId, chainId, txHash } = body;

    if (!bountyId || !submissionId) {
      return NextResponse.json(
        { error: "Missing fields", code: "MISSING_FIELDS", hint: "bountyId and submissionId are required." },
        { status: 400 },
      );
    }

    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(String(txHash))) {
      return NextResponse.json(
        {
          error: "Missing or invalid payout tx hash",
          code: "MISSING_PAYOUT_TX",
          hint: "Send the payout tx hash returned by eth_sendTransaction so it can be verified on-chain.",
        },
        { status: 400 },
      );
    }
    const hash = txHash as Hash;

    // Defensive: the bounty must be paid on Monad Testnet.
    if (chainId !== undefined && String(chainId) !== String(MONAD_CHAIN_ID)) {
      return NextResponse.json(
        {
          error: "Wrong network for payout",
          code: "WRONG_NETWORK",
          hint: `Winner payouts must be sent on Monad Testnet (chain id ${MONAD_CHAIN_ID}).`,
        },
        { status: 400 },
      );
    }

    // Load the bounty and the winning submission to know what to verify against.
    let bounty;
    try {
      bounty = await db.getBounty(bountyId);
    } catch (err) {
      const decorated = decorateSupabaseError(err);
      return NextResponse.json(
        { error: "Could not load bounty.", code: (decorated as { code?: string }).code, hint: (decorated as { hint?: string }).hint },
        { status: 500 },
      );
    }
    if (!bounty) {
      return NextResponse.json(
        { error: "Bounty not found", code: "BOUNTY_NOT_FOUND", hint: "Check the bounty id." },
        { status: 404 },
      );
    }

    const winningSubmission = (bounty.submissions || []).find((s: { id: string }) => s.id === submissionId);
    if (!winningSubmission) {
      return NextResponse.json(
        { error: "Submission not found on bounty", code: "SUBMISSION_NOT_FOUND", hint: "Check the submission id." },
        { status: 404 },
      );
    }

    const expectedRecipient = winningSubmission.hunterAddress;

    // 1. Fetch the tx (with retry/backoff). RPC down → 503.
    let tx: Transaction | null;
    try {
      tx = await fetchTxWithRetry(hash);
    } catch (err) {
      const known = err as { code?: number; shortMessage?: string; message?: string };
      console.error("[payout] RPC unavailable while verifying:", hash, known.shortMessage || known.message || err);
      return NextResponse.json(
        {
          error: "RPC unavailable. Please try again.",
          code: "RPC_UNAVAILABLE",
          hint: "Monad Testnet RPC could not be reached while verifying the payout.",
        },
        { status: 503 },
      );
    }

    if (!tx) {
      console.error("[payout] Transaction not found:", hash);
      return NextResponse.json(
        { error: "Transaction not found", code: "TX_NOT_FOUND", hint: "No transaction found on Monad Testnet for the payout hash.", hash },
        { status: 400 },
      );
    }

    // 2. Recipient must be the winning submission's hunter.
    if (tx.to?.toLowerCase() !== expectedRecipient.toLowerCase()) {
      console.error(`[payout] Invalid recipient. Expected ${expectedRecipient}, got ${tx.to}`);
      return NextResponse.json(
        {
          error: "Invalid payout recipient",
          code: "BAD_RECIPIENT",
          hint: `The payout must be sent to the winning submission's hunter address (${expectedRecipient}).`,
        },
        { status: 400 },
      );
    }

    // 3. Amount must cover the prize.
    let prizeWei: bigint;
    try {
      prizeWei = parseEther(bounty.prize);
    } catch {
      prizeWei = BigInt(0);
    }
    if (tx.value < prizeWei) {
      console.error(`[payout] Insufficient amount. Expected >= ${prizeWei}, got ${tx.value}`);
      return NextResponse.json(
        {
          error: "Insufficient payout amount",
          code: "LOW_AMOUNT",
          hint: `Expected at least ${bounty.prize} ${MONAD_NATIVE_SYMBOL}. Paid ${Number(tx.value) / 1e18} ${MONAD_NATIVE_SYMBOL}.`,
        },
        { status: 400 },
      );
    }

    // 4. Wait for confirmation (up to ~30s).
    try {
      const receipt = await getPublicClient().waitForTransactionReceipt({
        hash,
        timeout: 30_000,
        confirmations: 1,
      });
      if (receipt.status === "reverted") {
        console.error("[payout] Payout tx reverted:", hash);
        return NextResponse.json(
          {
            error: "Payout transaction reverted",
            code: "TX_REVERTED",
            hint: "On-chain payout was reverted. Please send the prize to the hunter again.",
          },
          { status: 400 },
        );
      }
    } catch (err) {
      const known = err as { code?: string };
      if (known.code === "WaitForTransactionReceiptTimeoutError") {
        console.error("[payout] Receipt timeout:", hash);
        return NextResponse.json(
          {
            error: "Payout not yet confirmed",
            code: "TX_UNCONFIRMED",
            hint: "The payout is pending on Monad Testnet. Wait a moment and retry with the same hash.",
          },
          { status: 408 },
        );
      }
      console.error("[payout] Receipt wait error:", err);
      return NextResponse.json(
        {
          error: "Could not confirm payout",
          code: "RPC_UNAVAILABLE",
          hint: "Monad Testnet RPC failed while waiting for confirmation. Try again.",
        },
        { status: 503 },
      );
    }

    // 5. Verified — now record it.
    try {
      await db.markPaid(bountyId, submissionId);
    } catch (dbErr) {
      const decorated = decorateSupabaseError(dbErr);
      console.error("Payout DB error (payout tx verified, status NOT flipped):", decorated, "tx:", hash);
      const code = (decorated as { code?: string }).code;
      const hint = (decorated as { hint?: string }).hint;
      return NextResponse.json(
        { error: "Payout verified on-chain but could not be recorded. Contact support if this persists.", code, hint },
        { status: code === "SUPABASE_MIGRATIONS_REQUIRED" ? 503 : 500 },
      );
    }

    console.log(`[payout] Bounty ${bountyId} marked PAID, tx ${hash}`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const decorated = decorateSupabaseError(error);
    console.error("Payout error:", decorated);
    const code = (decorated as { code?: string }).code;
    const hint = (decorated as { hint?: string }).hint;
    return NextResponse.json(
      { error: "Failed to record payout.", code, hint },
      { status: code === "SUPABASE_MIGRATIONS_REQUIRED" ? 503 : 500 },
    );
  }
}