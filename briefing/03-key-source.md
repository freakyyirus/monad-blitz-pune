# MonQuest — Key Source Files (verbatim)

All contents below are quoted verbatim from the workspace. Env-var *names* only are shown; no secrets.

TOC:
1. [Bounty API route (x402 payment verification)](#1-appapibountiesroutets)
2. [Bounty payout route](#2-appapibountiespayoutroutets)
3. [AI review route (Gemini streaming)](#3-appapiai-reviewroutets)
4. [Profile route](#4-appapiprofilets)
5. [Submissions route](#5-appapisubmissionsroutets)
6. [Balances route (bonus multi-chain surface)](#6-appapiblockchainbalancesroutets)
7. [Privy provider (chains + app id)](#7-appcomponentsprivy-providertsx)
8. [Client-safe Monad payout helpers](#8-applibpayoutts)
9. [Supabase browser client](#9-applibsupabase-clientts)
10. [Supabase admin client + db layer](#10-applibdbts)
11. [Supabase error guard](#11-applibsupabase-guardts)
12. [Blockchain central config](#12-applibblockchainconfigts)
13. [Env guard](#13-applibenvts)
14. [Server instrumentation (boot-time env validation)](#14-instrumentationts)
15. [next.config.mjs](#15-nextconfigmjs)
16. [tailwind.config.ts](#16-tailwindconfigts)
17. [tsconfig.json](#17-tsconfigjson)

---

## 1. app/api/bounties/route.ts

```ts
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
```

---

## 2. app/api/bounties/payout/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { decorateSupabaseError } from "@/app/lib/supabase-guard";

/**
 * Marks a bounty as PAID after a successful winner payout.
 *
 * The actual value transfer happens client-side (wallet → winner on Monad
 * Testnet). This endpoint only records the outcome, but validates the request
 * shape and surfaces actionable hints when the DB write fails (e.g. missing
 * migration → SUPABASE_MIGRATIONS_REQUIRED).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bountyId, submissionId, chainId } = body;

    if (!bountyId) {
      return NextResponse.json(
        { error: "Missing bountyId", code: "MISSING_FIELDS", hint: "bountyId is required." },
        { status: 400 },
      );
    }

    // Defensive: the bounty must have been paid on Monad Testnet.
    if (chainId !== undefined && String(chainId) !== "10143") {
      return NextResponse.json(
        {
          error: "Wrong network for payout",
          code: "WRONG_NETWORK",
          hint: "Winner payouts must be sent on Monad Testnet (chain id 10143).",
        },
        { status: 400 },
      );
    }

    await db.markPaid(bountyId, submissionId);

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
```

---

## 3. app/api/ai-review/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabaseAdminClient } from "@/app/lib/db";

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    const { bountyId } = await req.json();

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: "AI review not configured",
          code: "GEMINI_NOT_CONFIGURED",
          hint: "Set GOOGLE_GEMINI_API_KEY in .env.local (see .env.example).",
        },
        { status: 500 },
      );
    }

    // 1. Verify Bounty
    const { data: bounty, error: bountyError } = await supabase
      .from("bounties")
      .select("*")
      .eq("id", bountyId)
      .single();

    if (bountyError || !bounty) {
      return NextResponse.json(
        { error: "Bounty not found", code: "BOUNTY_NOT_FOUND", hint: "Check the bounty id." },
        { status: 404 },
      );
    }

    // 2. Fetch Submissions
    const { data: submissions, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("bounty_id", bountyId);

    if (subError || !submissions || submissions.length === 0) {
      return NextResponse.json(
        { error: "No submissions found", code: "NO_SUBMISSIONS", hint: "Wait for hunters to submit before running AI review." },
        { status: 400 },
      );
    }

    // 3. Prepare Gemini Prompt
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const promptParts: any[] = [
      {
        text: `You are an expert judge for a bounty contest. 
      Bounty Title: ${bounty.title}
      Bounty Description: ${bounty.description}
      
      Please analyze the following submissions and select the top 3 best ones based on quality, relevance, and creativity.
      If a submission has images, consider them in your evaluation.
      ` }
    ];

    for (let i = 0; i < submissions.length; i++) {
      const s = submissions[i];
      promptParts.push({ text: `\n--- Submission ${i + 1} (ID: ${s.id}) ---\nContent: ${s.content}\n` });

      // Extract and attach images
      const imgRegex = /!\[.*?\]\((.*?)\)/g;
      let match;
      while ((match = imgRegex.exec(s.content)) !== null) {
        const url = match[1];
        try {
          const imgRes = await fetch(url);
          if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

            // Only attach if valid image type
            if (mimeType.startsWith("image/")) {
              promptParts.push({
                inlineData: {
                  data: base64,
                  mimeType: mimeType,
                },
              });
            }
          }
        } catch (e) {
          console.error(`Failed to fetch image for submission ${s.id}:`, url);
        }
      }
    }

    promptParts.push({
      text: `
      \n\nInstructions:
      Output a single JSON block strictly in this exact format. Do NOT provide any conversational text, thinking process, or preamble. Just the JSON:
      
      \`\`\`json
      {
        "top_submissions": [
          { "id": "submission_id", "feedback": "Provide 1-2 short sentences of punchy, concise feedback explaining why this was chosen or flagged." }
        ]
      }
      \`\`\`
    `});

    // 4. Stream Response
    const result = await model.generateContentStream(promptParts);

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = "";
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            fullText += text;
            controller.enqueue(new TextEncoder().encode(text));
          }

          // 5. Parse JSON and Update DB
          const jsonMatch = fullText.match(/```json\n([\s\S]*?)\n```/) || fullText.match(/{[\s\S]*}/);
          if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            // Clean up any potential markdown artifacts if match was loose
            const cleanJsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();

            const parsed = JSON.parse(cleanJsonStr);

            if (parsed.top_submissions) {
              // Reset previous selections
              await supabase
                .from("submissions")
                .update({ is_ai_selected: false, ai_feedback: null })
                .eq("bounty_id", bountyId);

              // Update new selections
              for (const sub of parsed.top_submissions) {
                await supabase
                  .from("submissions")
                  .update({ is_ai_selected: true, ai_feedback: sub.feedback })
                  .eq("id", sub.id);
              }
            }
          }
        } catch (e) {
          console.error("Stream processing error:", e);
          controller.enqueue(new TextEncoder().encode("\n\n[Error processing AI results]"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "AI review failed", code: "AI_REVIEW_ERROR", hint: "Try again in a moment." },
      { status: 500 },
    );
  }
}
```

---

## 4. app/api/profile/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { decorateSupabaseError } from "@/app/lib/supabase-guard";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // 'created' or 'participated'
  const userId = searchParams.get("userId"); // Privy user ID
  const addresses = searchParams.get("addresses"); // Comma-separated addresses

  if (!userId && !addresses) {
    return NextResponse.json(
      { error: "userId or addresses required", code: "MISSING_FIELDS", hint: "Pass userId or a comma-separated addresses list." },
      { status: 400 },
    );
  }

  const addressList = addresses ? addresses.split(",").filter(Boolean) : [];

  try {
    let data;
    if (type === "created") {
      data = await db.getBountiesByUser(userId || undefined, addressList);
    } else if (type === "participated") {
      data = await db.getParticipatedByUser(userId || undefined, addressList);
    } else {
      return NextResponse.json(
        { error: "Invalid type. Use 'created' or 'participated'", code: "BAD_TYPE", hint: undefined },
        { status: 400 },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    const decorated = decorateSupabaseError(error);
    console.error("Profile fetch error:", decorated);
    const code = (decorated as { code?: string }).code;
    const hint = (decorated as { hint?: string }).hint;
    return NextResponse.json(
      { error: "Could not load profile.", code, hint },
      { status: code === "SUPABASE_MIGRATIONS_REQUIRED" ? 503 : 500 },
    );
  }
}
```

---

## 5. app/api/submissions/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { decorateSupabaseError } from "@/app/lib/supabase-guard";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bountyId, hunterAddress, content, contact, userId } = body;

    if (!bountyId || !hunterAddress || !content) {
      return NextResponse.json(
        { error: "Missing fields", code: "MISSING_FIELDS", hint: "bountyId, hunterAddress and content are required." },
        { status: 400 },
      );
    }

    const submission = await db.addSubmission(bountyId, {
      hunterAddress,
      content,
      contact: contact || "",
      userId,
    });

    return NextResponse.json(submission, { status: 200 });
  } catch (error) {
    const decorated = decorateSupabaseError(error);
    console.error("Submission error:", decorated);
    const code = (decorated as { code?: string }).code;
    const hint = (decorated as { hint?: string }).hint;
    return NextResponse.json(
      { error: "Failed to submit.", code, hint },
      { status: code === "SUPABASE_MIGRATIONS_REQUIRED" ? 503 : 500 },
    );
  }
}
```

---

## 6. app/api/blockchain/balances/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { getEvmBalance, getEvmTokenBalances, normalizeEvmAddress } from "@/app/lib/blockchain/evm";
import { getSolanaBalance, getSplTokenBalances, getSolanaConnection } from "@/app/lib/blockchain/solana";
import { getBtcWalletBalances } from "@/app/lib/blockchain/btc";
import { getEvmTokenList, getSplTokenList } from "@/app/lib/blockchain/config";

export const runtime = "nodejs";

/**
 * GET /api/blockchain/balances?address=0x...&chains=evm,solana,btc
 *
 * Returns aggregated native + configured token balances for the requested chains.
 * No secrets are exposed; RPC/API endpoints are public.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  if (!address) {
    return NextResponse.json(
      { error: "Missing address query parameter.", code: "MISSING_FIELDS", hint: "Pass ?address=0x…" },
      { status: 400 },
    );
  }
  const chainsParam = searchParams.get("chains") ?? "evm,solana,btc";
  const chains = chainsParam.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);

  const errors: string[] = [];
  const balances: Record<string, unknown> = {};

  // EVM
  if (chains.includes("evm")) {
    try {
      const normalized = normalizeEvmAddress(address);
      const [native, tokens] = await Promise.all([
        getEvmBalance(normalized),
        getEvmTokenBalances(normalized, getEvmTokenList()),
      ]);
      balances.evm = { address: normalized, native, tokens, updatedAt: Date.now() };
    } catch (error: any) {
      errors.push(`evm: ${error?.message ?? error}`);
    }
  }

  // Solana
  if (chains.includes("solana")) {
    try {
      const [native, tokens] = await Promise.all([
        getSolanaBalance(address),
        getSplTokenBalances(address, getSplTokenList()),
      ]);
      balances.solana = { address, native, tokens, updatedAt: Date.now() };
    } catch (error: any) {
      errors.push(`solana: ${error?.message ?? error}`);
    }
  }

  // Bitcoin
  if (chains.includes("btc")) {
    try {
      balances.btc = await getBtcWalletBalances(address);
    } catch (error: any) {
      errors.push(`btc: ${error?.message ?? error}`);
    }
  }

  return NextResponse.json(
    { ...balances, ...(errors.length > 0 ? { errors } : {}) },
    { status: errors.length > 0 && Object.keys(balances).length === 0 ? 400 : 200 },
  );
}
```

---

## 7. app/components/privy-provider.tsx

```tsx
"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { monadTestnet } from "viem/chains";

export default function PrivyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BasePrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || undefined}
      config={{
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false,
        },
        loginMethods: ["wallet", "email"],
        appearance: {
          showWalletLoginFirst: false,
        },
        // The bounty x402 + winnder-pay flow runs on Monad Testnet (10143 / 0x279F).
        // Enable the same network in the Privy dashboard:
        //   App → Embedded wallets → Networks → Monad Testnet.
        // Before first login, sidebar prompts "Add ISC/RPC" if not enabled there.
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}
```

---

## 8. app/lib/payout.ts

```ts
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
```

---

## 9. app/lib/supabase-client.ts

```ts
import { createClient } from "@supabase/supabase-js";

export const getSupabaseBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }
  
  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};
```

---

## 10. app/lib/db.ts

```ts
import { createClient } from "@supabase/supabase-js";
import { decorateSupabaseError } from "./supabase-guard";

/** Raises a supabase error with a stable code + hint (see supabase-guard.ts). */
const throwDbError = (error: unknown): never => {
  throw decorateSupabaseError(error);
};

export const getSupabaseAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }
  
  if (!supabaseKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }

  return createClient(supabaseUrl, supabaseKey);
};

export interface Submission {
  id: string;
  hunterAddress: string;
  content: string;
  contact: string;
  timestamp: number;
  userId?: string;
  isAiSelected?: boolean;
  aiFeedback?: string;
}

export interface Bounty {
  id: string;
  title: string;
  description: string;
  prize: string;
  creatorAddress: string;
  userId?: string;
  status: "OPEN" | "PAID";
  winnerSubmissionId?: string;
  submissions: Submission[];
  createdAt: number;
}

// Helper to normalize addresses for comparison
const normalizeAddress = (addr: string) => addr?.toLowerCase() || "";

export const db = {
  getBounties: async () => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("bounties")
      .select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
      .order("created_at", { ascending: false });

    if (error) throwDbError(error);

    return (data ?? []).map((b: any) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      prize: b.prize,
      creatorAddress: b.creator_address,
      userId: b.user_id,
      status: b.status,
      winnerSubmissionId: b.winner_submission_id,
      createdAt: new Date(b.created_at).getTime(),
      submissions: (b.submissions || []).map((s: any) => ({
        id: s.id,
        hunterAddress: s.hunter_address,
        content: s.content,
        contact: s.contact,
        timestamp: new Date(s.created_at).getTime(),
        userId: s.user_id,
        isAiSelected: s.is_ai_selected,
        aiFeedback: s.ai_feedback,
      })),
    }));
  },

  getBounty: async (id: string) => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("bounties")
      .select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
      .eq("id", id)
      .single();

    if (error) return undefined;

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      prize: data.prize,
      creatorAddress: data.creator_address,
      userId: data.user_id,
      status: data.status,
      winnerSubmissionId: data.winner_submission_id,
      createdAt: new Date(data.created_at).getTime(),
      submissions: (data.submissions || []).map((s: any) => ({
        id: s.id,
        hunterAddress: s.hunter_address,
        content: s.content,
        contact: s.contact,
        timestamp: new Date(s.created_at).getTime(),
        userId: s.user_id,
        isAiSelected: s.is_ai_selected,
        aiFeedback: s.ai_feedback,
      })),
    };
  },

  createBounty: async (bounty: {
    title: string;
    description: string;
    prize: string;
    creatorAddress: string;
    userId?: string;
  }) => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("bounties")
      .insert([
        {
          title: bounty.title,
          description: bounty.description,
          prize: bounty.prize,
          creator_address: normalizeAddress(bounty.creatorAddress),
          user_id: bounty.userId,
          status: "OPEN",
        },
      ])
      .select()
      .single();

    if (error) throwDbError(error);
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      prize: data.prize,
      creatorAddress: data.creator_address,
      userId: data.user_id,
      status: data.status,
      createdAt: new Date(data.created_at).getTime(),
      submissions: []
    };
  },

  addSubmission: async (bountyId: string, submission: {
    hunterAddress: string;
    content: string;
    contact: string;
    userId?: string;
  }) => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("submissions")
      .insert([
        {
          bounty_id: bountyId,
          hunter_address: normalizeAddress(submission.hunterAddress),
          content: submission.content,
          contact: submission.contact,
          user_id: submission.userId,
        },
      ])
      .select()
      .single();

    if (error) throwDbError(error);
    return {
      id: data.id,
      hunterAddress: data.hunter_address,
      content: data.content,
      contact: data.contact,
      timestamp: new Date(data.created_at).getTime(),
      userId: data.user_id,
    };
  },

  markPaid: async (bountyId: string, submissionId?: string) => {
    const updateData: any = { status: "PAID" };
    if (submissionId) {
      updateData.winner_submission_id = submissionId;
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("bounties")
      .update(updateData)
      .eq("id", bountyId);

    if (error) throwDbError(error);
  },

  // Get bounties by user ID OR any of their wallet addresses
  getBountiesByUser: async (userId?: string, addresses?: string[]) => {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("bounties")
      .select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
      .order("created_at", { ascending: false });

    // Build OR conditions
    const conditions: string[] = [];
    if (userId) {
      conditions.push(`user_id.eq.${userId}`);
    }
    if (addresses && addresses.length > 0) {
      const normalizedAddresses = addresses.map(normalizeAddress).filter(Boolean);
      if (normalizedAddresses.length > 0) {
        conditions.push(`creator_address.in.(${normalizedAddresses.join(",")})`);
      }
    }

    if (conditions.length === 0) {
      return [];
    }

    // Use OR filter
    const { data, error } = await supabase
      .from("bounties")
      .select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
      .or(conditions.join(","))
      .order("created_at", { ascending: false });

    if (error) throwDbError(error);

    return (data || []).map((b: any) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      prize: b.prize,
      creatorAddress: b.creator_address,
      userId: b.user_id,
      status: b.status,
      createdAt: new Date(b.created_at).getTime(),
      submissions: (b.submissions || []).map((s: any) => ({
        id: s.id,
        hunterAddress: s.hunter_address,
        content: s.content,
        contact: s.contact,
        timestamp: new Date(s.created_at).getTime(),
        userId: s.user_id,
      })),
    }));
  },

  // Get participated bounties by user ID OR any of their wallet addresses
  getParticipatedByUser: async (userId?: string, addresses?: string[]) => {
    // Build conditions for submissions query
    const conditions: string[] = [];
    if (userId) {
      conditions.push(`user_id.eq.${userId}`);
    }
    if (addresses && addresses.length > 0) {
      const normalizedAddresses = addresses.map(normalizeAddress).filter(Boolean);
      if (normalizedAddresses.length > 0) {
        conditions.push(`hunter_address.in.(${normalizedAddresses.join(",")})`);
      }
    }

    if (conditions.length === 0) {
      return [];
    }

    // First get all submission bounty_ids for this user
    const supabase = getSupabaseAdminClient();
    const { data: submissions, error: subError } = await supabase
      .from("submissions")
      .select("bounty_id")
      .or(conditions.join(","));

    if (subError) throw subError;
    if (!submissions || submissions.length === 0) return [];

    const bountyIds = Array.from(new Set(submissions.map((s: any) => s.bounty_id)));

    // Then get all those bounties
    const { data, error } = await supabase
      .from("bounties")
      .select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
      .in("id", bountyIds)
      .order("created_at", { ascending: false });

    if (error) throwDbError(error);

    return (data || []).map((b: any) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      prize: b.prize,
      creatorAddress: b.creator_address,
      userId: b.user_id,
      status: b.status,
      createdAt: new Date(b.created_at).getTime(),
      submissions: (b.submissions || []).map((s: any) => ({
        id: s.id,
        hunterAddress: s.hunter_address,
        content: s.content,
        contact: s.contact,
        timestamp: new Date(s.created_at).getTime(),
        userId: s.user_id,
      })),
    }));
  },

  // Legacy functions for backwards compatibility
  getBountiesByCreator: async (creatorAddress: string) => {
    return db.getBountiesByUser(undefined, [creatorAddress]);
  },

  getParticipatedBounties: async (hunterAddress: string) => {
    return db.getParticipatedByUser(undefined, [hunterAddress]);
  },
};
```

*(db.ts is 321 lines; the abbreviated code above is the full content — the trailing three lines of the file are the two legacy passthrough functions shown at the end. For byte-exact fidelity re-read the file.)*

---

## 11. app/lib/supabase-guard.ts

```ts
/**
 * Structured Supabase error handling.
 *
 * Supabase/Postgres errors can be opaque ("relation does not exist"). We
 * decorate the underlying error with a stable `code` and a human `hint` so API
 * routes can return a consistent { error, code, hint? } shape.
 *
 * Error codes surfaced:
 *  - "SUPABASE_MIGRATIONS_REQUIRED" (Postgres 42P01: missing table) — hint
 *    tells the dev to run the SQL scripts in supabase/README.md.
 *  - "SUPABASE_CONNECTION" — network / auth failure.
 *  - "SUPABASE_QUERY" — everything else. hint preserved when present.
 */

const IS_PROD = process.env.NODE_ENV === "production";

interface Decorated {
  code: string;
  hint?: string;
}

function isPostgresRelationError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42P01"
  );
}

/** Decorates a supabase error with { code, hint }. Returns the same error ref. */
export function decorateSupabaseError(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return error;
  const target = error as Record<string, unknown> & Decorated;

  if (isPostgresRelationError(error)) {
    target.code = "SUPABASE_MIGRATIONS_REQUIRED";
    // Full hint only in non-production; prod surfaces the short message.
    target.hint = IS_PROD
      ? "Database not configured."
      : "A required database table is missing. Run the migration scripts in supabase/README.md (SQL editor).";
    return error;
  }

  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    target.code = (error as { code: string }).code;
    return error;
  }

  // Distinguish auth/connection failures (invalid project URL, revoked key…)
  const message = error instanceof Error ? error.message : String(error);
  const connectionish =
    /fetch failed|ECONNREFUSED|network|invalid api key|Invalid API key|424/i.test(message);
  target.code = connectionish ? "SUPABASE_CONNECTION" : "SUPABASE_QUERY";
  target.hint = connectionish
    ? "Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (project Settings → API)."
    : undefined;

  return error;
}
```

---

## 12. app/lib/blockchain/config.ts

```ts
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
```

*(Abbreviated tail: the file ends with the `getSplTokenList` function above.)*

---

## 13. app/lib/env.ts

```ts
/**
 * Strict environment-variable guard.
 *
 * Import this module on the SERVER SIDE ONLY (API routes, middleware,
 * instrumentation.ts).  It validates required env vars at startup and
 * throws a descriptive MissingEnvError when any are missing.
 *
 * Client-safe helpers are exported separately (no secrets).
 */

/* -------------------------------------------------------------------------- */
/*  MissingEnvError — thrown when required env vars are absent                 */
/* -------------------------------------------------------------------------- */

export class MissingEnvError extends Error {
  public readonly missingKeys: string[];
  constructor(keys: string[]) {
    super(
      `Missing required environment variable${keys.length > 1 ? "s" : ""}: ${keys.join(", ")}. ` +
        "Set them in .env.local (see .env.example for details).",
    );
    this.name = "MissingEnvError";
    this.missingKeys = keys;
  }
}

/* -------------------------------------------------------------------------- */
/*  Private: key definitions                                                  */
/* -------------------------------------------------------------------------- */

const SERVER_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_GEMINI_API_KEY",
] as const;

const PUBLIC_KEYS = [
  "NEXT_PUBLIC_PRIVY_APP_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_PLATFORM_WALLET",
] as const;

/**
 * Optional keys that are read at runtime; documented here so we can
 * log helpful warnings if they are absent.
 */
const OPTIONAL_KEYS = [
  "MONAD_RPC_URL", // defaults to public testnet RPC
  "NEXT_PUBLIC_PRIZE_CURRENCY", // defaults to "MON"
  "EVM_RPC_URL",
  "EVM_CHAIN_ID",
  "SOLANA_RPC_URL",
  "BTC_NETWORK",
] as const;

/* -------------------------------------------------------------------------- */
/*  Public: validate all env vars (call once at server startup)                */
/* -------------------------------------------------------------------------- */

let _validated = false;

/**
 * Validates that all required environment variables are set.
 * Throws `MissingEnvError` if any are missing.
 * Subsequent calls are no-ops (idempotent).
 */
export function validateEnv(): void {
  if (_validated) return;

  const missing: string[] = [];

  for (const key of SERVER_KEYS) {
    if (!process.env[key]) missing.push(key);
  }
  for (const key of PUBLIC_KEYS) {
    if (!process.env[key]) missing.push(key);
  }

  if (missing.length > 0) {
    throw new MissingEnvError(missing);
  }

  _validated = true;
}

/* -------------------------------------------------------------------------- */
/*  Typed accessors                                                           */
/* -------------------------------------------------------------------------- */

export function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new MissingEnvError([key]);
  return val;
}

export function getEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}
```

---

## 14. instrumentation.ts

```ts
import { validateEnv } from "@/app/lib/env";

/**
 * Next.js server instrumentation — runs once at server startup.
 * Fails fast when required env vars are missing, instead of
 * surfacing cryptic errors mid-request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      validateEnv();
    } catch (err) {
      console.error(
        `[env] ${(err as Error).message}\n` +
          "See .env.example for the full list of required variables.",
      );
      // Rethrow so the server refuses to boot with a broken config.
      throw err;
    }
  }
}
```

---

## 15. next.config.mjs

```js
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  // Note: This is only an example. If you use Pages Router,
  // use something else that works, such as "service-worker/index.ts".
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

export default withSerwist({
  // Your Next.js config
  transpilePackages: ["geist"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
});
```

**⚠️ Note:** `next.config.mjs` has `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true` — the production build does NOT block on TS or ESLint errors.

---

## 16. tailwind.config.ts

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Dark-only app — every value is already tuned for the dark surface,
  // so we never toggle a `dark:` variant.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Dark-only neutral scale — 4 steps (bg / elevated / border / text).
        bg: {
          DEFAULT: "#09090B", // page background
          elevated: "#18181B", // cards, nav
          overlay: "#27272A", // hover, wells
        },
        fg: {
          DEFAULT: "#FAFAFA", // primary text
          muted: "#A1A1AA", // secondary text
          faint: "#52525B", // tertiary text (used small, AA ≥ 4.5:1)
        },
        line: {
          DEFAULT: "#2A2A2D", // default border
          strong: "#3F3F46",
        },
        // Single accent: MonQuest green.
        accent: {
          DEFAULT: "#16A34A", // green-600
          hover: "#15803D", // green-700
          soft: "rgba(22, 163, 74, 0.12)",
        },
        // Semantic — all AA-tested against #09090B.
        success: "#4ADE80",
        warning: "#FBBF24",
        danger: "#F87171",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "6px",
        md: "10px",
      },
      maxWidth: {
        content: "1120px",
      },
      fontSize: {
        stat: ["14px", "1.25"], // tabular figures for stats
      },
      boxShadow: {
        pop: "0 10px 40px -10px rgba(0,0,0,0.5)",
        modal: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "slide-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 250ms ease-out both",
        "slide-up": "slide-up 250ms ease-out both",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
```

---

## 17. tsconfig.json

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext", "webworker"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    },
    "types": ["@serwist/next/typings"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "public/sw.js", "contracts", "solana-program"]
}
```

Import alias: `@/*` → project root. So `@/app/lib/db` == `app/lib/db`.