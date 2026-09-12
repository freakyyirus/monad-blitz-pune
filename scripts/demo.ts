import "dotenv/config";

/**
 * MonQuest multi-chain demo.
 *
 *   npm run demo            # EVM (local anvil, if running) + Solana (devnet)
 *   npm run demo -- --local # both demos pointed at `npm run chain:local`
 *
 * Notes:
 *  - The EVM demo defaults to a local anvil (no funds needed). Without one
 *    running, set EVM_RPC_URL/EVM_CHAIN_ID/PRIVATE_KEY to any funded chain.
 *  - The Solana demo defaults to public devnet and airdrops its own SOL.
 *  - Bitcoin has a read-only demo path via the /api/blockchain/balances route
 *    and `sendBtc` for WIF-keyed server-side sends (see README).
 */
async function main() {
  const local = process.argv.includes("--local");
  console.log(`\n█ MonQuest multi-chain demo — ${local ? "LOCAL validators" : "defaults (anvil optional, Solana devnet)"}\n`);

  if (local) {
    process.env.EVM_RPC_URL ||= "http://127.0.0.1:8545";
    process.env.EVM_CHAIN_ID ||= "31337";
    process.env.SOLANA_RPC_URL ||= "http://127.0.0.1:8899";
  }

  await import("./demo-evm");
  await import("./demo-solana");
  console.log("All demos ✓");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});