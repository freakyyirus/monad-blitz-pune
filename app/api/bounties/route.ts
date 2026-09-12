import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseEther, type Hash, type Transaction } from "viem";
import { db } from "@/app/lib/db";
import { decorateSupabaseError } from "@/app/lib/supabase-guard";
import { getMonadChain, PLATFORM_FEE, MONAD_DEFAULT_RPC, MONAD_NATIVE_SYMBOL } from "@/app/lib/blockchain/config";

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

/**
 * Fetches a transaction with exponential backoff. Public testnet RPCs are
 * flaky; a single timeout should not fail the user's payment verification.
 */
async function fetchTxWithRetry(hash: Hash): Promise<Transaction | null> {
  const client = getPublicClient();
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await client.getTransaction({ hash });
    } catch (err) {
      const known = err as { code?: number; shortMessage?: string; message?: string };
      // RPC-level failure → retry with backoff (500ms → 1250ms).
      if (attempt < attempts) {
        console.warn(
          `[x402] RPC getTransaction attempt ${attempt}/${attempts} failed ` +
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

export async function POST(req: NextRequest) {
  try {
    const paymentHash = req.headers.get("x-payment-hash");
    const chain = getMonadChain();
    const PLATFORM_WALLET =
      process.env.NEXT_PUBLIC_PLATFORM_WALLET || "0xB82fa8973393578FE15bB7917300336CAFC255C4";

    // 1. x402 Check: if no payment hash, return 402 with payment details
    if (!paymentHash) {
      console.log("[x402] Payment required for bounty creation");
      return NextResponse.json(
        {
          error: "Payment Required",
          code: "PAYMENT_REQUIRED",
          hint: `Send ${PLATFORM_FEE} ${MONAD_NATIVE_SYMBOL} on Monad Testnet to the platform wallet, then repeat the request with the x-payment-hash header.`,
          paymentDetails: {
            address: PLATFORM_WALLET,
            amount: PLATFORM_FEE,
            currency: MONAD_NATIVE_SYMBOL,
            chainId: chain.id,
            chainName: chain.name,
          },
        },
        { status: 402 },
      );
    }

    // 2. Sanitize the payment hash early
    if (!/^0x[a-fA-F0-9]{64}$/.test(paymentHash)) {
      return NextResponse.json(
        {
          error: "Invalid transaction hash",
          code: "INVALID_PAYMENT_HASH",
          hint: "x-payment-hash must be a 64-char hex tx hash (e.g. 0x…).",
        },
        { status: 400 },
      );
    }
    const hash = paymentHash as Hash;

    // 3. Verify payment on Monad Testnet (with retry/backoff)
    let tx: Transaction | null;
    try {
      tx = await fetchTxWithRetry(hash);
    } catch (err) {
      const known = err as { code?: number; shortMessage?: string; message?: string };
      console.error(
        `[x402] RPC unavailable while verifying ${hash}:`,
        known.shortMessage || known.message || err,
      );
      return NextResponse.json(
        {
          error: "RPC unavailable. Please try again.",
          code: "RPC_UNAVAILABLE",
          hint: "Monad Testnet RPC could not be reached while verifying your payment. Try again in a few seconds.",
        },
        { status: 503 },
      );
    }

    if (!tx) {
      console.error("[x402] Transaction not found:", hash);
      return NextResponse.json(
        {
          error: "Transaction not found",
          code: "TX_NOT_FOUND",
          hint: "No transaction found on Monad Testnet for hash.",
          hash,
        },
        { status: 400 },
      );
    }

    if (tx.to?.toLowerCase() !== PLATFORM_WALLET.toLowerCase()) {
      console.error(`[x402] Invalid recipient. Expected ${PLATFORM_WALLET}, got ${tx.to}`);
      return NextResponse.json(
        {
          error: "Invalid payment recipient",
          code: "BAD_RECIPIENT",
          hint: `The payment must be sent to the platform wallet (${PLATFORM_WALLET}).`,
        },
        { status: 400 },
      );
    }

    const expectedValue = parseEther(PLATFORM_FEE);
    if (tx.value < expectedValue) {
      console.error(`[x402] Insufficient amount. Expected ${expectedValue}, got ${tx.value}`);
      return NextResponse.json(
        {
          error: "Insufficient payment amount",
          code: "LOW_AMOUNT",
          hint: `Expected at least ${PLATFORM_FEE} ${MONAD_NATIVE_SYMBOL}. Paid ${Number(tx.value) / 1e18} ${MONAD_NATIVE_SYMBOL}.`,
        },
        { status: 400 },
      );
    }

    // 4. Wait for the tx to be confirmed (up to ~30s). Public testnets can lag.
    try {
      const receipt = await getPublicClient().waitForTransactionReceipt({
        hash,
        timeout: 30_000,
        confirmations: 1,
      });
      if (receipt.status === "reverted") {
        console.error("[x402] Payment tx reverted:", hash);
        return NextResponse.json(
          {
            error: "Payment transaction reverted",
            code: "TX_REVERTED",
            hint: "On-chain payment was reverted. Please ensure a valid native transfer and try again.",
          },
          { status: 400 },
        );
      }
    } catch (err) {
      const known = err as { code?: string };
      if (known.code === "WaitForTransactionReceiptTimeoutError") {
        console.error("[x402] Receipt timeout:", hash);
        return NextResponse.json(
          {
            error: "Payment not yet confirmed",
            code: "TX_UNCONFIRMED",
            hint: "Your transaction is pending on Monad Testnet. Wait a moment and try verifying with the same hash.",
          },
          { status: 408 },
        );
      }
      console.error("[x402] Receipt wait error:", err);
      return NextResponse.json(
        {
          error: "Could not confirm payment",
          code: "RPC_UNAVAILABLE",
          hint: "Monad Testnet RPC failed while waiting for confirmation. Try again.",
        },
        { status: 503 },
      );
    }

    // 5. Parse & validate bounty
    const body = await req.json();
    const { title, description, prize, creatorAddress, userId } = body;
    if (!title || !description || !prize || !creatorAddress) {
      return NextResponse.json(
        { error: "Missing fields", code: "MISSING_FIELDS", hint: "title, description, prize and creatorAddress are required." },
        { status: 400 },
      );
    }

    // 6. Create bounty
    try {
      const newBounty = await db.createBounty({
        title,
        description,
        prize,
        creatorAddress,
        userId,
      });
      console.log("[x402] Bounty created successfully:", newBounty.id, "tx:", hash);
      return NextResponse.json(newBounty, { status: 200 });
    } catch (dbErr) {
      const decorated = decorateSupabaseError(dbErr);
      console.error("[x402] DB create error:", decorated);
      const code = (decorated as { code?: string }).code;
      const hint = (decorated as { hint?: string }).hint;

      // Compensating action: the platform fee was received on-chain but the
      // bounty row failed to persist. Keep the record so it can be reconciled.
      try {
        await db.savePendingBounty({
          title,
          description,
          prize,
          creatorAddress,
          userId,
          txHash: hash,
        });
        console.log(`[x402] PAID-BUT-NOT-SAVED — recorded in pending_bounties (tx ${hash})`);
      } catch (pendingErr) {
        console.error("[x402] PAID-BUT-NOT-SAVED — pending_bounties insert failed, full fields:", {
          title,
          description,
          prize,
          creator_address: creatorAddress,
          user_id: userId,
          tx_hash: hash,
          pending_error: String(pendingErr),
        });
      }

      return NextResponse.json(
        { error: "Could not save bounty. Payment was received, contact support if this persists.", code, hint },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[x402] Bounty creation error (outer):", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR", hint: undefined },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const bounties = await db.getBounties();
    return NextResponse.json(bounties);
  } catch (error) {
    const decorated = decorateSupabaseError(error);
    console.error("GET /api/bounties error:", decorated);
    const code = (decorated as { code?: string }).code;
    const hint = (decorated as { hint?: string }).hint;
    return NextResponse.json(
      { error: "Could not load bounties.", code, hint },
      { status: code === "SUPABASE_MIGRATIONS_REQUIRED" ? 503 : 500 },
    );
  }
}