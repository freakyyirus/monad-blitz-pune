import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Interacts with the deployed example contracts.
 *
 * Usage:  npx hardhat run scripts/interact.ts --network anvil
 *
 * Expects a previous `deploy.ts` run for the same chainId.
 */
async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(`No deployments.json found. Run deploy.ts first on chainId ${chainId}.`);
  }
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const deployment = deployments[chainId];
  if (!deployment) {
    throw new Error(`No deployment found for chainId ${chainId} in deployments.json.`);
  }
  console.log(`\nInteracting with deployment on ${network.name} (chainId ${chainId})\n`);

  /* ---- SimpleStorage ---- */
  const storage = await ethers.getContractAt("SimpleStorage", deployment.simpleStorage);
  console.log("SimpleStorage:");
  console.log(`  current value = ${await storage.get()}`);
  const tx = await storage.set(12345);
  await tx.wait();
  console.log(`  after set(12345) = ${await storage.get()}`);
  console.log(`  lastUpdater      = ${await storage.lastUpdater()}\n`);

  /* ---- MonQuestToken ---- */
  const token = await ethers.getContractAt("MonQuestToken", deployment.monQuestToken);
  console.log("MonQuestToken:");
  const totalSupply = await token.totalSupply();
  console.log(`  totalSupply   = ${ethers.formatUnits(totalSupply, 18)} MQ`);
  console.log(`  signer balance= ${ethers.formatUnits(await token.balanceOf(signer.address), 18)} MQ`);

  // Mint 100 MQ to a random recipient
  const recipient = ethers.Wallet.createRandom().address;
  const mintTx = await token.mint(recipient, ethers.parseUnits("100", 18));
  await mintTx.wait();
  console.log(`  minted 100 MQ to ${recipient}`);
  console.log(`  recipient balance = ${ethers.formatUnits(await token.balanceOf(recipient), 18)} MQ`);
  console.log(`  totalSupply after = ${ethers.formatUnits(await token.totalSupply(), 18)} MQ\n`);

  console.log("Done ✓");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});