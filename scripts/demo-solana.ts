import "dotenv/config";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { SOLANA_DEVNET_RPC, getSolanaNetwork } from "../app/lib/blockchain/config";
import {
  getSolanaBalance,
  getSolanaConnection,
  sendSolanaTransferWithKeypair,
  solanaRequestAirdrop,
} from "../app/lib/blockchain/solana";

/**
 * Solana demo — defaults to devnet (public, free airdrops). Use `--local` or
 * set SOLANA_RPC_URL to point at `npm run chain:local`'s test-validator.
 *
 *   npx tsx scripts/demo-solana.ts
 *   SOLANA_PRIVATE_KEY=<base58> npx tsx scripts/demo-solana.ts
 */
async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || SOLANA_DEVNET_RPC;
  const network = getSolanaNetwork(rpcUrl);
  const connection = getSolanaConnection(rpcUrl);

  console.log(`\n── Solana demo ──`);
  console.log(`network : ${network} (${rpcUrl})`);

  // Signer: from env, or generated + airdropped for the demo.
  let signer: Keypair;
  let funded = false;
  if (process.env.SOLANA_PRIVATE_KEY) {
    signer = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
    funded = true;
  } else {
    signer = Keypair.generate();
    process.env.SOLANA_PRIVATE_KEY = bs58.encode(signer.secretKey);
    console.log(`airdrop : requesting 2 SOL to ${signer.publicKey.toString()}…`);
    let sig = "";
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        sig = await solanaRequestAirdrop(signer.publicKey.toString(), 2, connection);
        funded = true;
        break;
      } catch (error) {
        const status = String(error).includes("429") ? "rate-limited" : "error";
        console.log(`airdrop : attempt ${attempt} ${status} — retrying…`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    if (!sig) console.log("airdrop : skipped (devnet faucet rate-limited or unavailable)");
    else console.log(`airdrop : confirmed ${sig}`);
  }
  console.log(`signer  : ${signer.publicKey.toString()}`);

  const before = await getSolanaBalance(signer.publicKey.toString(), { connection });
  console.log(`balance : ${before.balance} ${before.symbol}`);

  if (!funded && Number(before.raw) <= 0) {
    console.log("\nbalance is 0 — skipping the send step.");
    console.log(`fund the signer above via a devnet faucet, or run with SOLANA_PRIVATE_KEY=<base58>`);
    console.log("Solana demo ✓ (read path verified)\n");
    return;
  }

  // Send onward to a second keypair owned by this same seed (no funds needed on the receiver).
  const second = Keypair.generate();
  const amount = process.env.AMOUNT || "0.01";
  const { hash } = await sendSolanaTransferWithKeypair(
    { chain: "solana", amount, to: second.publicKey.toString() },
  );
  console.log(`sent ${amount} SOL → ${second.publicKey.toString().slice(0, 12)}… tx ${hash}`);

  const after = await getSolanaBalance(signer.publicKey.toString(), { connection });
  console.log(`balance : ${after.balance} ${after.symbol}`);
  console.log("Solana demo ✓\n");
}

main().catch((error) => {
  console.error("\nSolana demo failed:", error);
  process.exit(1);
});