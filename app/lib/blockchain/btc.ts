import * as ecc from "@bitcoinerlab/secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import { payments, Psbt, initEccLib, type Network } from "bitcoinjs-lib";
import { ECPairFactory, type ECPairAPI, type ECPairInterface } from "ecpair";
import type { ChainBalances, TokenBalance, TransferRequest } from "./types";

initEccLib(ecc);
const ECPair: ECPairAPI = ECPairFactory(ecc);

/**
 * Bitcoin service.
 *
 * Bitcoin reads (balance / UTXOs / transactions) go through a public
 * block-explorer REST API (Blockstream by default — no keys needed).
 *
 * Bitcoin *sends* for scripts/server-side use an x-only/compressed key that is
 * derived from a WIF private key (`BTC_PRIVATE_KEY_WIF`), signing a native
 * SegWit (P2WPKH) transaction locally. For browser wallets the same transaction
 * is exposed as an unsigned PSBT that a Bitcoin wallet (e.g. Unisat / Xverse)
 * can sign — the `buildBtcPsbt` helper below returns exactly that.
 */

export interface BtcNetworkConfig {
  apiBase: string;
  network: Network;
  label: "mainnet" | "testnet";
}

export function getBtcNetworkConfig(): BtcNetworkConfig {
  const testnet = (process.env.BTC_NETWORK || "mainnet").toLowerCase() === "testnet";
  return {
    apiBase: process.env.BTC_API_BASE || (testnet ? "https://blockstream.info/testnet/api" : "https://blockstream.info/api"),
    network: testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin,
    label: testnet ? "testnet" : "mainnet",
  };
}

export function validateBtcAddress(address: string, network?: Network): void {
  bitcoin.address.toOutputScript(address, network ?? getBtcNetworkConfig().network);
}

function satoshisToBtc(sats: number): string {
  return (sats / 1e8).toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export async function getBtcBalance(address: string): Promise<TokenBalance> {
  const { apiBase, network, label } = getBtcNetworkConfig();
  validateBtcAddress(address, network);
  const res = await fetch(`${apiBase}/address/${address}`);
  if (!res.ok) throw new Error(`BTC API error ${res.status} for address ${address}`);
  const data = await res.json();
  const confirmed = (data.chain_stats?.funded_txo_sum ?? 0) - (data.chain_stats?.spent_txo_sum ?? 0);
  const unconfirmed = (data.mempool_stats?.funded_txo_sum ?? 0) - (data.mempool_stats?.spent_txo_sum ?? 0);
  const totalSats = confirmed + unconfirmed;
  return {
    symbol: "BTC",
    name: `Bitcoin (${label})`,
    decimals: 8,
    raw: totalSats.toString(),
    balance: satoshisToBtc(confirmed) + (unconfirmed !== 0 ? ` (+${satoshisToBtc(unconfirmed)} unconfirmed)` : ""),
    native: true,
  };
}

export interface BtcUtxo {
  txid: string;
  vout: number;
  value: number;
  confirmed: boolean;
}

export async function getBtcUtxos(address: string): Promise<BtcUtxo[]> {
  const { apiBase, network } = getBtcNetworkConfig();
  validateBtcAddress(address, network);
  const res = await fetch(`${apiBase}/address/${address}/utxo`);
  if (!res.ok) throw new Error(`BTC API error ${res.status} while fetching UTXOs`);
  const list = await res.json();
  return list.map((u: { txid: string; vout: number; value: number; status: { confirmed: boolean } }) => ({
    txid: u.txid,
    vout: u.vout,
    value: u.value,
    confirmed: u.status?.confirmed ?? false,
  }));
}

export interface BtcAddressInfo {
  balanceConfirmedSats: number;
  balanceUnconfirmedSats: number;
  txCount: number;
}

export async function getBtcAddressInfo(address: string): Promise<BtcAddressInfo> {
  const { apiBase, network } = getBtcNetworkConfig();
  validateBtcAddress(address, network);
  const res = await fetch(`${apiBase}/address/${address}`);
  if (!res.ok) throw new Error(`BTC API error ${res.status} for address ${address}`);
  const data = await res.json();
  return {
    balanceConfirmedSats: (data.chain_stats?.funded_txo_sum ?? 0) - (data.chain_stats?.spent_txo_sum ?? 0),
    balanceUnconfirmedSats: (data.mempool_stats?.funded_txo_sum ?? 0) - (data.mempool_stats?.spent_txo_sum ?? 0),
    txCount: data.chain_stats?.tx_count ?? 0,
  };
}

export async function getBtcWalletBalances(address: string): Promise<ChainBalances> {
  const native = await getBtcBalance(address);
  return {
    chain: "btc",
    address,
    network: getBtcNetworkConfig().label,
    native,
    tokens: [],
    updatedAt: Date.now(),
  };
}

export function btcToSats(btc: string): number {
  const parsed = Number(btc);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid BTC amount: ${btc}`);
  return Math.round(parsed * 1e8);
}

/** Broadcast a signed raw transaction hex and return the txid. */
export async function broadcastBtc(rawHex: string): Promise<string> {
  const { apiBase } = getBtcNetworkConfig();
  const res = await fetch(`${apiBase}/tx`, { method: "POST", body: rawHex });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`BTC broadcast failed (${res.status}): ${body}`);
  }
  return (await res.text()).trim();
}

export interface BtcUtxoInput {
  txid: string;
  vout: number;
  value: number;
}

/**
 * Build (and optionally sign) a P2WPKH transaction.
 * Returns { psbt (base64), signedHex (if signed), feeSats }.
 */
export async function buildBtcPsbt(request: {
  utxos: BtcUtxoInput[];
  to: string;
  amountSats: number;
  changeAddress: string;
  feeRateSatsPerByte?: number;
  network?: Network;
  signer?: ECPairInterface;
}): Promise<{ psbtBase64: string; signedHex: string | null; feeSats: number }> {
  const network = request.network ?? getBtcNetworkConfig().network;
  const signer = request.signer;
  const script = signer ? payments.p2wpkh({ pubkey: signer.publicKey, network }).output : null;

  // Greedy UTXO selection with a rough fee estimate (68 B/in, 31 B/out).
  const feeRate = request.feeRateSatsPerByte ?? 10;
  const estFee = Math.ceil((request.utxos.length * 68 + 2 * 31 + 10) * feeRate);
  let selected: BtcUtxoInput[] = [];
  let sum = 0;
  for (const u of request.utxos) {
    selected.push(u);
    sum += u.value;
    if (sum >= request.amountSats + estFee) break;
  }
  if (sum < request.amountSats + estFee) {
    throw new Error(`Insufficient funds: need ${request.amountSats + estFee} sats, have ${sum} sats.`);
  }
  const changeSats = sum - request.amountSats - estFee;
  const feeSats = sum - request.amountSats - changeSats;

  const psbt = new Psbt({ network });
  for (const u of selected) {
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      ...(script ? { witnessUtxo: { script, value: u.value } } : {}),
    });
  }
  psbt.addOutput({ address: request.to, value: request.amountSats });
  if (changeSats > 0) {
    psbt.addOutput({ address: request.changeAddress, value: changeSats });
  }

  let signedHex: string | null = null;
  if (signer) {
    selected.forEach((_, i) => psbt.signInput(i, signer));
    selected.forEach((_, i) => psbt.finalizeInput(i));
    signedHex = psbt.extractTransaction().toHex();
  }

  return { psbtBase64: psbt.toBase64(), signedHex, feeSats };
}

export interface BtcSendRequest extends TransferRequest {
  /** source WIF private key (defaults to BTC_PRIVATE_KEY_WIF env) */
  wif?: string;
  feeRateSatsPerByte?: number;
}

/** Send BTC from a P2WPKH WIF key through the block explorer API. */
export async function sendBtc(request: BtcSendRequest): Promise<{ hash: string; psbt?: string }> {
  const wif = request.wif || process.env.BTC_PRIVATE_KEY_WIF;
  if (!wif) {
    throw new Error("sendBtc: missing WIF key. Pass `wif` or set BTC_PRIVATE_KEY_WIF.");
  }
  const config = getBtcNetworkConfig();
  const signer = ECPair.fromWIF(wif, config.network);
  validateBtcAddress(request.to, config.network);
  const sourceAddress = payments.p2wpkh({ pubkey: signer.publicKey, network: config.network }).address!;
  const utxos = (await getBtcUtxos(sourceAddress)).filter((u) => u.confirmed);
  const { signedHex } = await buildBtcPsbt({
    utxos,
    to: request.to,
    amountSats: btcToSats(request.amount),
    changeAddress: sourceAddress,
    feeRateSatsPerByte: request.feeRateSatsPerByte,
    network: config.network,
    signer,
  });
  if (!signedHex) throw new Error("sendBtc: failed to sign transaction.");
  const txid = await broadcastBtc(signedHex!);
  return { hash: txid };
}