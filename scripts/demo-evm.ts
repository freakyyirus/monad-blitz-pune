import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EVM_LOCAL_RPC, getEvmChainForEnv } from "../app/lib/blockchain/config";
import {
  ERC20_ABI,
  getEvmBalance,
  readEvmContract,
  sendEvmTransfer,
} from "../app/lib/blockchain/evm";

/**
 * EVM demo — runs against a local anvil (`npm run chain:local`) by default, or
 * any EVM chain configured via EVM_RPC_URL / EVM_CHAIN_ID / PRIVATE_KEY.
 *
 *   npx tsx scripts/demo-evm.ts
 *   PRIVATE_KEY=0x... EVM_RPC_URL=https://... EVM_CHAIN_ID=11155111 npx tsx scripts/demo-evm.ts
 */
const ANVIL_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ANVIL_ACCOUNT_2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const SIMPLE_STORAGE_ABI = [
  {
    inputs: [],
    name: "get",
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "x", type: "int256" }],
    name: "set",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

async function main() {
  const useLocal = !process.env.EVM_RPC_URL;
  const rpcUrl = process.env.EVM_RPC_URL || EVM_LOCAL_RPC;
  const chainId = useLocal ? 31337 : Number(process.env.EVM_CHAIN_ID || 1);
  const chain = getEvmChainForEnv(rpcUrl, useLocal ? "Local Anvil" : "Ethereum", chainId);
  const privateKey = process.env.PRIVATE_KEY || ANVIL_PRIVATE_KEY;
  const account = privateKeyToAccount(privateKey.startsWith("0x") ? (privateKey as `0x${string}`) : `0x${privateKey}`);
  const recipient = process.env.RECIPIENT || ANVIL_ACCOUNT_2;

  console.log(`\n── EVM demo ──`);
  console.log(`chain   : ${chain.name} (chainId ${chain.id})`);
  console.log(`rpc     : ${rpcUrl}`);
  console.log(`signer  : ${account.address}`);
  console.log(`recipient:${recipient}`);

  const before = await getEvmBalance(account.address, { chain, rpcUrl });
  console.log(`\nbalance : ${before.balance} ${before.symbol}`);

  const amount = process.env.AMOUNT || "0.001";
  const { hash } = await sendEvmTransfer({
    chain,
    from: account.address,
    to: recipient,
    amount,
    privateKey,
  });
  console.log(`sent ${amount} ${before.symbol} → tx ${hash}`);

  const after = await getEvmBalance(account.address, { chain, rpcUrl });
  console.log(`balance : ${after.balance} ${after.symbol}`);

  // Optional contract reads from a prior `npm run contracts:deploy` on the same chain.
  const deploymentsPath = path.join(__dirname, "..", "contracts", "deployments.json");
  if (fs.existsSync(deploymentsPath)) {
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    const deployment = deployments[chainId];
    if (deployment?.simpleStorage) {
      const value = await readEvmContract(
        { address: deployment.simpleStorage, abi: SIMPLE_STORAGE_ABI as unknown as unknown[], functionName: "get", args: [], rpcUrl },
        { chain },
      );
      console.log(`SimpleStorage.${deployment.simpleStorage.slice(0, 8)}… get() = ${String(value)}`);
    }
    if (deployment?.monQuestToken) {
      const supply = await readEvmContract(
        {
          address: deployment.monQuestToken,
          abi: [
            ...ERC20_ABI,
            {
              inputs: [],
              name: "totalSupply",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            } as const,
          ],
          functionName: "totalSupply",
          args: [],
          rpcUrl,
        },
        { chain },
      );
      console.log(`MonQuestToken.${deployment.monQuestToken.slice(0, 8)}… totalSupply = ${formatEther(supply as bigint)} MQ`);
    }
  } else {
    console.log(`(no contracts/deployments.json → skip contract demo; deploy with: npm run contracts:deploy)`);
  }

  console.log("EVM demo ✓\n");
}

main().catch((error) => {
  console.error("\nEVM demo failed:", error);
  process.exit(1);
});