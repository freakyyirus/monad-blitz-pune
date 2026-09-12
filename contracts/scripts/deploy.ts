import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys the example contracts.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network anvil     # local dev (no funds needed)
 *   npx hardhat run scripts/deploy.ts --network sepolia   # testnet (set RPC_URL + PRIVATE_KEY)
 *
 * Result is written to ./deployments.json (gitignored).
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`\nDeploying with account ${deployer.address} on network ${network.name} (chainId ${network.chainId})\n`);

  // 1. SimpleStorage
  const SimpleStorage = await ethers.getContractFactory("SimpleStorage");
  const storage = await SimpleStorage.deploy(42);
  await storage.waitForDeployment();
  console.log(`SimpleStorage   deployed at ${await storage.getAddress()}  (initial value 42)`);
  console.log(`  storedValue = ${await storage.get()}\n`);

  // 2. MonQuestToken (ERC-20, initial supply 1_000_000 MQ)
  const MonQuestToken = await ethers.getContractFactory("MonQuestToken");
  const token = await MonQuestToken.deploy("MonQuest", "MQ", 18, 1_000_000);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`MonQuestToken   deployed at ${tokenAddress}`);
  console.log(`  name        = ${await token.name()}`);
  console.log(`  symbol      = ${await token.symbol()}`);
  console.log(`  decimals    = ${await token.decimals()}`);
  console.log(`  totalSupply = ${ethers.formatUnits(await token.totalSupply(), 18)} MQ`);
  console.log(`  deployer bal= ${ethers.formatUnits(await token.balanceOf(deployer.address), 18)} MQ\n`);

  // Persist deployments
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  const previous = fs.existsSync(deploymentsPath)
    ? JSON.parse(fs.readFileSync(deploymentsPath, "utf8"))
    : {};
  const entry = {
    chainId: Number(network.chainId),
    network: network.name,
    deployer: deployer.address,
    simpleStorage: await storage.getAddress(),
    monQuestToken: tokenAddress,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(deploymentsPath, JSON.stringify({ ...previous, [entry.chainId]: entry }, null, 2));
  console.log(`Saved deployment info to ${deploymentsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});