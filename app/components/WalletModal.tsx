"use client";

import { useState } from "react";
import { Wallet, ExternalLink, Copy, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  onConnectExternal?: () => void;
  onExport?: () => void;
  isEmbedded?: boolean;
}

export function WalletModal({
  isOpen,
  onClose,
  walletAddress,
  onConnectExternal,
  onExport,
  isEmbedded = false,
}: WalletModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="relative w-full max-w-md card-elevated rounded-3xl p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-500">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Your Wallet</h2>
            <p className="text-sm text-gray-500">
              {isEmbedded ? "Embedded Wallet" : "Connected Wallet"}
            </p>
          </div>
        </div>

        {/* Wallet Address */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-1 text-xs font-medium text-gray-400">Address</p>
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-sm text-gray-900">{truncatedAddress}</p>
            <button
              onClick={copyAddress}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Funding Instructions */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            💡 To create bounties or pay winners, you need MON tokens.
          </p>
          <p className="mt-1 text-xs text-amber-600">
            Send MON to your wallet address above, or use the Monad testnet faucet.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <a
            href={`https://testnet.monadexplorer.com/address/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-md no-underline"
          >
            <ExternalLink className="h-4 w-4" />
            View on Explorer
          </a>

          {isEmbedded && onExport && (
            <button
              onClick={onExport}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-md"
            >
              Export Private Key
            </button>
          )}

          {onConnectExternal && (
            <button
              onClick={onConnectExternal}
              className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm"
            >
              <Wallet className="h-4 w-4" />
              Connect MetaMask Instead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ConnectWalletPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
  title?: string;
  description?: string;
  isLoading?: boolean;
}

export function ConnectWalletPrompt({
  isOpen,
  onClose,
  onConnect,
  title = "Wallet Required",
  description = "You need a wallet to perform this action. Connect your wallet to continue.",
  isLoading = false,
}: ConnectWalletPromptProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="relative w-full max-w-md card-elevated rounded-3xl p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 rounded-2xl bg-amber-50 p-4">
            <Wallet className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="mt-2 text-sm text-gray-500">{description}</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onConnect}
            disabled={isLoading}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            {isLoading ? "Connecting..." : "Connect Wallet"}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
