import * as fs from "fs";
import * as path from "path";
import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import bs58 from "bs58";
import { Program } from "@coral-xyz/anchor";

/** Fixed program id (must match `declare_id!` in the Rust crate). */
export const PROGRAM_ID = new PublicKey("4bEizfTQRQDRVptCzft1kAPvRprrzk3VJunj15ZYemjg");

/**
 * Client-side IDL walkthrough for the MonQuest counter program.
 *
 * Prerequisites:
 *   1. Rust + `anchor-cli` installed  (see ../README.md)
 *   2. `anchor build` executed so `target/idl/monquest_counter.json` exists
 *   3. `anchor deploy` against localnet or devnet
 *   4. Either SOLANA_PRIVATE_KEY (base58) in the environment, or a funded
 *      `wallet.json` keypair next to this package (Anchor provider wallet).
 *
 * Usage:  npm run client
 */
async function main() {
  /* 1. Load program id + IDL */
  const idlPath = path.join(__dirname, "..", "target", "idl", "monquest_counter.json");
  if (!fs.existsSync(idlPath)) {
    console.error(
      "IDL not found. Run `anchor build` first so target/idl/monquest_counter.json exists " +
      "(requires the Rust toolchain, see solana-program/README.md).",
    );
    process.exit(1);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as anchor.Idl;

  /* 2. Connect + fund */
  const cluster = process.env.SOLANA_RPC_URL || anchor.AnchorProvider.env().connection?.rpcEndpoint || "http://127.0.0.1:8899";
  const connection = new Connection(cluster, "confirmed");
  console.log(`Cluster      : ${connection.rpcEndpoint}`);

  let wallet: anchor.Wallet;
  const secret = process.env.SOLANA_PRIVATE_KEY;
  if (secret) {
    wallet = new anchor.Wallet(Keypair.fromSecretKey(bs58.decode(secret)));
  } else if (fs.existsSync(path.join(__dirname, "..", "wallet.json"))) {
    const secretKey = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "wallet.json"), "utf8"));
    wallet = new anchor.Wallet(Keypair.fromSecretKey(new Uint8Array(secretKey)));
  } else {
    console.error("No wallet found. Set SOLANA_PRIVATE_KEY or create wallet.json.");
    process.exit(1);
  }
  console.log(`Wallet       : ${wallet.publicKey.toBase58()}`);

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = new Program(idl, PROGRAM_ID, provider);
  console.log(`Program      : ${PROGRAM_ID.toBase58()}`);

  /* 3. Derive the counter PDA */
  const [counterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter")],
    program.programId,
  );
  console.log(`Counter PDA  : ${counterPda.toBase58()}`);

  const funded = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet SOL   : ${(funded / LAMPORTS_PER_SOL).toFixed(6)}`);
  if (funded < LAMPORTS_PER_SOL) {
    console.warn("  Wallet has less than 1 SOL — run `solana airdrop 1` (localnet/devnet).");
  }

  /* 4. Initialize if needed */
  const counterAccount = await program.account.counter.fetchNullable(counterPda);
  if (!counterAccount) {
    console.log("\nInitializing counter...");
    const tx = await program.methods.initialize().accounts({
      counter: counterPda,
      authority: wallet.publicKey,
    }).rpc();
    console.log(`  tx          : ${tx}`);
  } else {
    console.log("\nCounter already initialized (skipping initialize).");
  }

  /* 5. Increment three times */
  console.log("\nIncrementing x3...");
  for (let i = 0; i < 3; i++) {
    const tx = await program.methods.increment().accounts({
      counter: counterPda,
      authority: wallet.publicKey,
    }).rpc();
    console.log(`  increment #${i + 1}: ${tx}`);
  }

  /* 6. Read the final state through the IDL */
  const state = await program.account.counter.fetch(counterPda);
  console.log(`\nFinal counter.value = ${state.count.toString()}`);
  console.log(`      counter.authority = ${state.authority.toBase58()}`);
  console.log("\nDone ✓");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});