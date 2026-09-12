import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";

describe("monquest-counter", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, "..", "target", "idl", "monquest_counter.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error("Missing target/idl/monquest_counter.json — run `anchor build` first.");
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as anchor.Idl;
  const program = new Program(idl, provider) as Program;

  const [counterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter")],
    program.programId,
  );

  it("initializes and increments the counter", async () => {
    const existing = await program.account.counter.fetchNullable(counterPda);
    if (!existing) {
      await program.methods
        .initialize()
        .accounts({ counter: counterPda, authority: provider.wallet.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
    }

    await program.methods
      .increment()
      .accounts({ counter: counterPda, authority: provider.wallet.publicKey })
      .rpc();

    const state = await program.account.counter.fetch(counterPda);
    assert.equal(state.authority.toString(), provider.wallet.publicKey.toString());
    assert.isAtLeast(state.count.toNumber(), 1);
  });
});