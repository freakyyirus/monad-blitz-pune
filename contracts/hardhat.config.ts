import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL || process.env.EVM_RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Well-known Anvil deterministic account #0 (funded with 10 000 ETH).
const ANVIL_DEFAULT_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function getAccounts(networks: string[]): string[] {
  if (PRIVATE_KEY) {
    return [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`];
  }
  // Default: use the first Anvil account (only safe for local development).
  return [ANVIL_DEFAULT_KEY];
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: false,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    anvil: {
      url: RPC_URL,
      chainId: Number(process.env.CHAIN_ID || 31337),
      accounts: getAccounts(["anvil"]),
    },
    // Sepolia: set RPC_URL to an Sepolia RPC + PRIVATE_KEY
    sepolia: {
      url: RPC_URL,
      chainId: 11155111,
      accounts: getAccounts(["sepolia"]),
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;