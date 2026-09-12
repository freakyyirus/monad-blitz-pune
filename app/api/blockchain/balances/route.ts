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