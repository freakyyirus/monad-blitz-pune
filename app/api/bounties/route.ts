import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { db } from "@/app/lib/db";

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

const PLATFORM_FEE = "0.001"; // MON
const PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET || "0xB82fa8973393578FE15bB7917300336CAFC255C4";

export async function POST(req: NextRequest) {
  try {
    const paymentHash = req.headers.get("x-payment-hash");

    // 1. x402 Check: If no payment hash, return 402 with details
    if (!paymentHash) {
      console.log("Payment required for bounty creation");
      return NextResponse.json(
        {
          error: "Payment Required",
          message: "Please pay the platform fee to post a bounty.",
          paymentDetails: {
            address: PLATFORM_WALLET,
            amount: PLATFORM_FEE,
            currency: "MON",
            chainId: monadTestnet.id,
          },
        },
        { status: 402 }
      );
    }

    // 2. Verify Payment
    console.log("Fetching tx hash:", paymentHash);
    let tx;
    try {
      tx = await publicClient.getTransaction({ hash: paymentHash as `0x${string}` });
    } catch (err: any) {
      console.error("getTransaction Error:", err.message);
      return NextResponse.json({ error: "Transaction verification error: " + err.message }, { status: 400 });
    }

    // Basic verification checks
    if (!tx) {
      console.error("Transaction not found for hash:", paymentHash);
      return NextResponse.json({ error: "Transaction not found" }, { status: 400 });
    }

    // Check if payment was made to platform wallet
    if (tx.to?.toLowerCase() !== PLATFORM_WALLET.toLowerCase()) {
      console.error(`Invalid payment recipient. Expected ${PLATFORM_WALLET}, got ${tx.to}`);
      return NextResponse.json({ error: "Invalid payment recipient" }, { status: 400 });
    }

    const expectedValue = BigInt(parseFloat(PLATFORM_FEE) * 1e18);
    if (tx.value < expectedValue) {
      console.error(`Insufficient amount. Expected ${expectedValue}, got ${tx.value}`);
      return NextResponse.json({ error: "Insufficient payment amount" }, { status: 400 });
    }

    // 3. Create Bounty
    const body = await req.json();
    const { title, description, prize, creatorAddress, userId } = body;

    console.log("Inserting bounty:", { title, prize, creatorAddress, userId });

    if (!title || !description || !prize || !creatorAddress) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    try {
      const newBounty = await db.createBounty({
        title,
        description,
        prize,
        creatorAddress,
        userId, // Include Privy user ID for tracking across wallets
      });

      console.log("Bounty created successfully:", newBounty.id);
      return NextResponse.json(newBounty, { status: 200 });
    } catch (dbErr: any) {
      console.error("DB Create Error:", dbErr);
      return NextResponse.json({ error: "Database error: " + dbErr.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Bounty creation error (outer):", error);
    return NextResponse.json({ error: "Internal Server Error: " + error.message }, { status: 500 });
  }
}

export async function GET() {
  const bounties = await db.getBounties();
  return NextResponse.json(bounties);
}
