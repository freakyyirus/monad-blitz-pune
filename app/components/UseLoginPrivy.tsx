"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useCreateWallet, useLogin, usePrivy, useSendTransaction, WalletWithMetadata } from "@privy-io/react-auth";
import { createPublicClient, http, formatEther } from "viem";
import { monadTestnet } from "viem/chains";
import { QRCodeSVG } from "qrcode.react";

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

export default function UseLoginPrivy() {
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const { ready, user, logout } = usePrivy();

  const { createWallet: createEthereumWallet } = useCreateWallet();

  const { sendTransaction } = useSendTransaction();

  const ethereumEmbeddedWallets = useMemo<WalletWithMetadata[]>(
    () =>
      (user?.linkedAccounts.filter(
        (account) =>
          account.type === "wallet" &&
          account.walletClientType === "privy" &&
          account.chainType === "ethereum"
      ) as WalletWithMetadata[]) ?? [],
    [user]
  );

  const hasEthereumWallet = ethereumEmbeddedWallets.length > 0;
  const walletAddress = ethereumEmbeddedWallets[0]?.address;

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) return;
    
    setBalanceLoading(true);
    setBalanceError(false);
    
    try {
      const balanceWei = await publicClient.getBalance({
        address: walletAddress as `0x${string}`,
      });
      const balanceEth = formatEther(balanceWei);
      setBalance(balanceEth);
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalanceError(true);
    } finally {
      setBalanceLoading(false);
    }
  }, [walletAddress]);

  const copyToClipboard = useCallback(async () => {
    if (!walletAddress) return;
    
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      fetchBalance();
    }
  }, [walletAddress, fetchBalance]);

  const handleCreateWallet = useCallback(async () => {
    setIsCreating(true);
    try {
      await createEthereumWallet();
    } catch (error) {
      console.error("Error creating wallet:", error);
    } finally {
      setIsCreating(false);
    }
  }, [createEthereumWallet]);

  const onSendTransaction = async () => {
    if (!userAddress) return;
    
    setTransactionStatus('pending');
    setTransactionHash(null);
    
    try {
      const result = await sendTransaction({
        to: userAddress,
        value: 1000000000000000,
      });
      
      setTransactionHash(result.hash);
      setTransactionStatus('success');
      
      // Refresh balance after successful transaction
      setTimeout(() => {
        fetchBalance();
      }, 3000);
    } catch (error) {
      console.error("Transaction failed:", error);
      setTransactionStatus('error');
    }
  };

  const { login } = useLogin();

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Privy Wallet</h1>
          <p className="text-lg text-zinc-400">Connect and manage your embedded wallet</p>
        </div>

        {/* Action Buttons Section */}
        <div className="space-y-8">
          <div className="flex flex-wrap gap-4 justify-center">
            <button 
              onClick={() => login()}
              disabled={!!user}
              className={`font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md ${
                user 
                  ? 'bg-white/5 text-zinc-500 cursor-not-allowed border border-white/5' 
                  : 'bg-white text-black hover:bg-zinc-200 border border-transparent'
              }`}
            >
              {user ? "Logged In" : "Login"}
            </button>
            <button 
              onClick={logout}
              disabled={!user}
              className={`font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md ${
                !user 
                  ? 'bg-white/5 text-zinc-500 cursor-not-allowed border border-white/5' 
                  : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30'
              }`}
            >
              {!user ? "Logged Out" : "Logout"}
            </button>
            <button 
              onClick={handleCreateWallet} 
              disabled={!user || isCreating || hasEthereumWallet}
              className={`font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md ${
                hasEthereumWallet 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20 cursor-default' 
                  : !user
                    ? 'bg-white/5 text-zinc-500 cursor-not-allowed border border-white/5'
                    : isCreating 
                      ? 'bg-white/5 text-zinc-500 cursor-not-allowed border border-white/5' 
                      : 'bg-purple-500 hover:bg-purple-600 text-white border border-transparent'
              }`}
            >
              {hasEthereumWallet ? "✓ Wallet Exists" : !user ? "Login to Create Wallet" : isCreating ? "Creating..." : "Create Wallet"}
            </button>
          </div>

          {/* Wallet Information Section */}
          {hasEthereumWallet && (
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <span className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center mr-3 text-lg">
                  💳
                </span>
                Embedded Wallet
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Address</label>
                  <div className="bg-black/50 border border-white/10 rounded-lg p-4 flex items-center justify-between gap-3">
                    <span className="font-mono text-sm text-white break-all">
                      {walletAddress}
                    </span>
                    <button
                      onClick={copyToClipboard}
                      className="flex-shrink-0 p-2 rounded-md bg-white/10 hover:bg-white/20 text-zinc-300 transition-colors duration-200"
                      title={copied ? "Copied!" : "Copy address"}
                    >
                      {copied ? "✓" : "📋"}
                    </button>
                  </div>
                  
                  {/* QR Code Section */}
                  <div className="mt-4 flex flex-col items-center">
                    <div className="bg-white p-4 rounded-xl shadow-md">
                      <QRCodeSVG
                        value={walletAddress || ""}
                        size={200}
                        level="H"
                        includeMargin={true}
                        className="w-full h-full"
                      />
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">
                      Scan to send funds to this wallet
                    </p>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-zinc-400">Balance</label>
                    <button
                      onClick={fetchBalance}
                      disabled={balanceLoading}
                      title="Refresh balance"
                      className={`p-2 rounded-lg transition-colors duration-200 ${
                        balanceLoading 
                          ? 'bg-white/5 text-zinc-500 cursor-not-allowed' 
                          : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className={balanceLoading ? 'animate-spin' : ''}>
                        {balanceLoading ? "⟳" : "↻"}
                      </span>
                    </button>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <span className="text-2xl font-bold text-white">
                      {balanceLoading ? (
                        <span className="text-zinc-500">Loading...</span>
                      ) : balanceError ? (
                        <span className="text-red-400">Error loading balance</span>
                      ) : (
                        `${parseFloat(balance || "0").toFixed(4)} MON`
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Section */}
          {user && (
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <span className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center mr-3 text-lg">
                  💸
                </span>
                Send Transaction
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Recipient Address
                  </label>
                  <input
                    value={userAddress || ""}
                    onChange={(e) => setUserAddress(e.target.value)}
                    placeholder="Enter recipient address"
                    className="w-full px-4 py-3 border border-white/10 bg-black/50 text-white placeholder-zinc-500 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 font-mono text-sm"
                  />
                </div>
                
                <button
                  onClick={onSendTransaction}
                  disabled={!hasEthereumWallet || !userAddress || transactionStatus === 'pending'}
                  className={`w-full font-semibold py-3 px-6 rounded-xl transition-all duration-200 ${
                    !hasEthereumWallet || !userAddress || transactionStatus === 'pending'
                      ? 'bg-white/5 text-zinc-500 cursor-not-allowed border border-white/5' 
                      : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 hover:border-green-500/30'
                  }`}
                >
                  {!hasEthereumWallet ? "Please create a wallet first" : 
                   transactionStatus === 'pending' ? "Sending..." : 
                   "Send 0.001 MON"}
                </button>

                {/* Transaction Status */}
                {transactionStatus !== 'idle' && (
                  <div className="mt-4 space-y-2">
                    {transactionStatus === 'pending' && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                        <div className="flex items-center">
                          <div className="animate-spin mr-3 w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                          <span className="text-yellow-400 font-medium">Transaction pending...</span>
                        </div>
                      </div>
                    )}
                    
                    {transactionStatus === 'success' && transactionHash && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <span className="text-green-400 font-medium mr-2">✅ Transaction successful!</span>
                          </div>
                          <div className="flex items-center justify-between bg-black/30 rounded-lg p-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-green-400 mb-1">Transaction Hash:</p>
                              <p className="text-xs font-mono text-green-300 break-all">{transactionHash}</p>
                            </div>
                          </div>
                          <a
                            href={`https://testnet.monadscan.com/tx/${transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                          >
                            View on MonadScan
                            <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {transactionStatus === 'error' && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                        <div className="flex items-center">
                          <span className="text-red-400 font-medium">❌ Transaction failed. Please try again.</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User Information Section */}
          {user && (
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <span className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center mr-3 text-lg">
                  👤
                </span>
                User Information
              </h3>
              <div className="bg-black/50 rounded-lg p-4 overflow-x-auto border border-white/10">
                <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
