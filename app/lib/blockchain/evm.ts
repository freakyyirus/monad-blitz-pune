import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  parseEther,
  type Account,
  type Address,
  type PublicClient,
  type Chain as ViemChain,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getAddress } from "viem";
import { getEvmChain, getEvmRpcUrl } from "./config";
import type {
  ChainBalances,
  EvmTokenRef,
  ReadContractRequest,
  TokenBalance,
  TransferRequest,
  WriteContractRequest,
} from "./types";

/** Minimal ERC-20 ABI covering balance reads and transfers. */
export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const ERC20_TRANSFER_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

let publicClientCache: PublicClient | null = null;

export function getEvmPublicClient(chain?: ViemChain): PublicClient {
  const activeChain = chain ?? getEvmChain();
  if (!publicClientCache || activeChain.id !== publicClientCache.chain?.id) {
    publicClientCache = createPublicClient({
      chain: activeChain,
      transport: http(activeChain.rpcUrls.default.http[0] ?? getEvmRpcUrl()),
    });
  }
  return publicClientCache;
}

/** Build a wallet client from a node private key (rights scripts / server-side signing). */
export function getEvmWalletClient(
  chain?: ViemChain,
  privateKey?: string,
  rpcUrl?: string,
): WalletClient<Transport, ViemChain, Account> | null {
  const key = privateKey || process.env.PRIVATE_KEY;
  if (!key) return null;
  const normalizeKey = key.startsWith("0x") ? key : `0x${key}`;
  const account = privateKeyToAccount(normalizeKey as `0x${string}`);
  const endpoint = rpcUrl || chain?.rpcUrls.default.http[0] || getEvmRpcUrl();
  return createWalletClient<Transport, ViemChain, Account>({
    account,
    chain: chain ?? getEvmChain(),
    transport: http(endpoint),
  });
}

/** Normalize a user supplied address, throwing if invalid. */
export function normalizeEvmAddress(address: string): Address {
  return getAddress(address);
}

function fromRaw(raw: bigint, decimals: number): string {
  return formatUnits(raw, decimals);
}

export async function getEvmBalance(
  address: string,
  opts?: { chain?: ViemChain; rpcUrl?: string },
): Promise<TokenBalance> {
  if (opts?.rpcUrl) publicClientCache = createPublicClient({
    chain: opts.chain ?? getEvmChain(),
    transport: http(opts.rpcUrl),
  });
  const client = getEvmPublicClient(opts?.chain);
  const normalized = normalizeEvmAddress(address);
  const raw = await client.getBalance({ address: normalized });
  const chain = opts?.chain ?? getEvmChain();
  const decimals = chain.nativeCurrency.decimals;
  return {
    symbol: chain.nativeCurrency.symbol,
    name: chain.nativeCurrency.name,
    decimals,
    raw: raw.toString(),
    balance: fromRaw(raw, decimals),
    native: true,
  };
}

async function readTokenMetadata(client: PublicClient, token: EvmTokenRef) {
  const address = normalizeEvmAddress(token.address) as `0x${string}`;
  let decimals = token.decimals;
  let symbol = token.symbol;
  let name = token.name;
  try {
    const [d, s, n] = await Promise.all([
      decimals === undefined ? (client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>) : Promise.resolve(decimals),
      symbol === undefined ? (client.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>) : Promise.resolve(symbol),
      name === undefined ? (client.readContract({ address, abi: ERC20_ABI, functionName: "name" }) as Promise<string>) : Promise.resolve(name),
    ]);
    decimals = d;
    symbol = s;
    name = n;
  } catch {
    decimals = decimals ?? 18;
    symbol = symbol ?? "TOKEN";
    name = name ?? "Unknown Token";
  }
  return { address, decimals, symbol, name };
}

export async function getEvmTokenBalances(
  address: string,
  tokens: EvmTokenRef[] = [],
  opts?: { chain?: ViemChain; rpcUrl?: string },
): Promise<TokenBalance[]> {
  if (tokens.length === 0) return [];
  if (opts?.rpcUrl) publicClientCache = createPublicClient({
    chain: opts.chain ?? getEvmChain(),
    transport: http(opts.rpcUrl),
  });
  const client = getEvmPublicClient(opts?.chain);
  const normalized = normalizeEvmAddress(address);

  const results: TokenBalance[] = [];
  for (const token of tokens) {
    try {
      const meta = await readTokenMetadata(client, token);
      const raw = (await client.readContract({
        address: meta.address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [normalized],
      })) as bigint;
      results.push({
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        raw: raw.toString(),
        balance: fromRaw(raw, meta.decimals),
        native: false,
        contract: meta.address,
      });
    } catch (error) {
      console.warn(`getEvmTokenBalances: skipped ${token.address}`, error);
    }
  }
  return results;
}

export async function getEvmWalletBalances(
  address: string,
  tokens: EvmTokenRef[] = [],
  opts?: { chain?: ViemChain; rpcUrl?: string },
): Promise<ChainBalances> {
  const [native, tokenList] = await Promise.all([
    getEvmBalance(address, opts),
    getEvmTokenBalances(address, tokens, opts),
  ]);
  return {
    chain: "evm",
    address: normalizeEvmAddress(address),
    network: (opts?.chain ?? getEvmChain()).name,
    native,
    tokens: tokenList,
    updatedAt: Date.now(),
  };
}

export interface EvmTransferInput extends Omit<TransferRequest, "chain"> {
  /** Active viem chain (defaults to the app chain from the environment). */
  chain?: ViemChain;
  /** EIP-1193 provider (e.g. Privy/MetaMask). */
  provider?: unknown;
  /** Fallback: sign with a private key (scripts/server). */
  privateKey?: string;
  rpcUrl?: string;
  from?: string;
}

type ProviderWalletClient = WalletClient<Transport, ViemChain, undefined>;

/** Resolve the active account from an injected/embedded EIP-1193 provider. */
async function getProviderAccount(walletClient: ProviderWalletClient, preferred?: string): Promise<Address> {
  if (preferred) return normalizeEvmAddress(preferred);
  try {
    const accounts = await walletClient.getAddresses();
    if (accounts[0]) return accounts[0];
  } catch {
    /* fall through to eth_requestAccounts */
  }
  const requested = (await walletClient.request({
    method: "eth_requestAccounts",
  })) as string[];
  const first = requested?.[0];
  if (!first) throw new Error("Wallet returned no accounts.");
  return normalizeEvmAddress(first);
}

/**
 * Send an EVM transfer.
 * - If `provider` is provided, signs via the injected/embedded wallet (browser).
 * - Otherwise falls back to `privateKey` (or `PRIVATE_KEY` env) for scripts/server.
 */
export async function sendEvmTransfer(request: EvmTransferInput): Promise<{ hash: `0x${string}` }> {
  const chain = request.chain ?? getEvmChain();
  const to = normalizeEvmAddress(request.to) as `0x${string}`;
  const value = parseEther(String(request.amount).trim());

  if (request.provider) {
    const walletClient: ProviderWalletClient = createWalletClient<Transport, ViemChain, undefined>({
      chain,
      transport: custom(request.provider as never),
    });
    const from = await getProviderAccount(walletClient, request.from);
    const hash = await walletClient.sendTransaction({
      account: from,
      chain,
      to,
      value,
    });
    return { hash };
  }

  const walletClient = getEvmWalletClient(chain, request.privateKey, request.rpcUrl);
  if (!walletClient) {
    throw new Error(
      "sendEvmTransfer: no signer available. Pass a provider, a privateKey, or set PRIVATE_KEY.",
    );
  }
  const hash = await walletClient.sendTransaction({
    account: walletClient.account,
    chain,
    to,
    value,
  });
  return { hash };
}

/** Read from any EVM contract (view call). */
export async function readEvmContract<Args extends readonly unknown[] = readonly unknown[]>(
  request: ReadContractRequest<Args>,
  opts?: { chain?: ViemChain },
): Promise<unknown> {
  if (request.rpcUrl) {
    const activeChain = opts?.chain ?? getEvmChain();
    publicClientCache = createPublicClient({ chain: activeChain, transport: http(request.rpcUrl) });
  }
  const client = getEvmPublicClient(opts?.chain);
  return client.readContract({
    address: normalizeEvmAddress(request.address) as `0x${string}`,
    abi: request.abi,
    functionName: request.functionName,
    args: request.args as never,
  });
}

export interface EvmWriteContractInput<Args extends readonly unknown[] = readonly unknown[]> extends WriteContractRequest<Args> {
  chain?: ViemChain;
  provider?: unknown;
  from?: string;
  privateKey?: string;
  rpcUrl?: string;
}

/** Write to an EVM contract via wallet (provider) or private key. */
export async function writeEvmContract<Args extends readonly unknown[] = readonly unknown[]>(
  request: EvmWriteContractInput<Args>,
): Promise<{ hash: `0x${string}` }> {
  const chain = request.chain ?? getEvmChain();
  const address = normalizeEvmAddress(request.address) as `0x${string}`;

  const args = request.args as never;
  if (request.provider) {
    const walletClient: ProviderWalletClient = createWalletClient<Transport, ViemChain, undefined>({
      chain,
      transport: custom(request.provider as never),
    });
    const hash = await walletClient.writeContract({
      account: await getProviderAccount(walletClient, request.from),
      chain,
      address,
      abi: request.abi,
      functionName: request.functionName,
      args,
      value: request.value ? BigInt(request.value) : undefined,
    });
    return { hash };
  }

  const walletClient = getEvmWalletClient(chain, request.privateKey, request.rpcUrl);
  if (!walletClient) {
    throw new Error("writeEvmContract: no signer available (pass provider or privateKey).");
  }
  const hash = await walletClient.writeContract({
    chain,
    address,
    abi: request.abi,
    functionName: request.functionName,
    args,
    value: request.value ? BigInt(request.value) : undefined,
  });
  return { hash };
}