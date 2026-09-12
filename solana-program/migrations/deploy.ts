import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

/**
 * Anchor migration: initializes the counter program state.
 *
 * This mirrors what `anchor deploy` + a first `initialize` call does.
 * Run via: `anchor migrate` (after `anchor build`).
 */
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = new Program(require("../target/idl/monquest_counter.json") as anchor.Idl, provider) as Program;

const [counterPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("counter")],
  program.programId,
);

async function main() {
  const existing = await program.account.counter.fetchNullable(counterPda);
  if (existing) {
    console.log(`Counter already initialized at ${counterPda.toBase58()} — skipping.`);
    return;
  }
  const tx = await program.methods
    .initialize()
    .accounts({ counter: counterPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`Initialized counter at ${counterPda.toBase58()} (tx ${tx})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});