"use client";

import { useEffect, useState, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import type { Bounty } from "@/app/lib/db";
import { Loader2, CheckCircle, ExternalLink, Wallet, ArrowLeft, Sparkles, X } from "lucide-react";
import { parseEther } from "viem";
import { MarkdownEditor, MarkdownViewer } from "@/app/components/MarkdownEditor";
import { ConnectWalletPrompt } from "@/app/components/WalletModal";
import Link from "next/link";

export default function BountyDetailPage({ params }: { params: { id: string } }) {
  const { authenticated, login, user, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [loading, setLoading] = useState(true);

  // AI Review State
  const [isReviewing, setIsReviewing] = useState(false);
  const [isReviewDone, setIsReviewDone] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiThinking, setAiThinking] = useState("");
  const aiPanelRef = useRef<HTMLDivElement>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submissionContent, setSubmissionContent] = useState("");
  const [contactInfo, setContactInfo] = useState("");

  // Payout State
  const [paying, setPaying] = useState<string | null>(null);

  // Wallet prompt state
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);
  const [walletPromptAction, setWalletPromptAction] = useState<"submit" | "pay" | null>(null);
  const [pendingPayment, setPendingPayment] = useState<{ submissionId: string; winnerAddress: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const getAllUserAddresses = (): string[] => {
    const addresses: Set<string> = new Set();
    if (user?.wallet?.address) {
      addresses.add(user.wallet.address.toLowerCase());
    }
    wallets.forEach(w => {
      if (w.address) {
        addresses.add(w.address.toLowerCase());
      }
    });
    return Array.from(addresses);
  };

  const allUserAddresses = getAllUserAddresses();
  const wallet = wallets.find(w => w.walletClientType !== "privy") || wallets[0];

  const isCreator = bounty && (
    (bounty.userId && bounty.userId === user?.id) ||
    allUserAddresses.some(addr => addr === bounty.creatorAddress?.toLowerCase())
  );

  const submissionAddress = user?.wallet?.address || wallet?.address;

  useEffect(() => {
    fetch("/api/bounties")
      .then((res) => res.json())
      .then((data: Bounty[]) => {
        const found = data.find((b) => b.id === params.id);
        setBounty(found || null);
        setLoading(false);
      });
  }, [params.id]);

  useEffect(() => {
    if (aiPanelRef.current) {
      aiPanelRef.current.scrollTop = aiPanelRef.current.scrollHeight;
    }
  }, [aiThinking]);

  const handleAiReview = async () => {
    if (!bounty) return;
    setIsReviewing(true);
    setIsReviewDone(false);
    setShowAiPanel(true);
    setAiThinking("");

    try {
      const response = await fetch("/api/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id }),
      });

      if (!response.ok) throw new Error("AI Review failed");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        setAiThinking((prev) => prev + text);
      }

      const res = await fetch("/api/bounties");
      const data = await res.json();
      const found = data.find((b: Bounty) => b.id === params.id);
      if (found) setBounty(found);

      setIsReviewDone(true);

    } catch (error) {
      console.error("AI Review error:", error);
      setAiThinking((prev) => prev + "\n\n[Error: Failed to complete review]");
    } finally {
      setIsReviewing(false);
    }
  };

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      await connectWallet();
      setShowWalletPrompt(false);

      if (walletPromptAction === "pay" && pendingPayment) {
        setTimeout(() => {
          handlePayWinner(pendingPayment.submissionId, pendingPayment.winnerAddress);
        }, 500);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    } finally {
      setIsConnecting(false);
      setWalletPromptAction(null);
      setPendingPayment(null);
    }
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authenticated) return login();

    const hunterAddress = submissionAddress;
    if (!hunterAddress) {
      setWalletPromptAction("submit");
      setShowWalletPrompt(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bountyId: bounty?.id,
          hunterAddress: hunterAddress,
          content: submissionContent,
          contact: contactInfo,
          userId: user?.id,
        }),
      });

      if (res.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayWinner = async (submissionId: string, winnerAddress: string) => {
    const payingWallet = wallets.find(w => w.walletClientType !== "privy") || wallets[0];

    if (!payingWallet) {
      setWalletPromptAction("pay");
      setPendingPayment({ submissionId, winnerAddress });
      setShowWalletPrompt(true);
      return;
    }
    setPaying(submissionId);

    try {
      const provider = await payingWallet.getEthereumProvider();

      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x279F" }],
        });
      } catch (switchError: any) {
        console.log("Chain switch error (may be ok):", switchError.message);
      }

      await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: payingWallet.address,
            to: winnerAddress,
            value: `0x${parseEther(bounty!.prize).toString(16)}`,
          },
        ],
      });

      await fetch("/api/bounties/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bountyId: bounty?.id,
          submissionId: submissionId
        }),
      });

      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Payment failed or rejected.");
    } finally {
      setPaying(null);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!bounty) return (
    <div className="flex min-h-screen items-center justify-center bg-white text-gray-900">
      Bounty not found
    </div>
  );

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6">
        <Link href="/bounties" className="mb-8 inline-flex items-center text-[10px] font-bold text-primary/40 hover:text-primary uppercase tracking-widest no-underline transition-colors">
          <ArrowLeft className="mr-2 h-3 w-3" />
          Registry / Browse Directives
        </Link>

        {/* Header Card */}
        <div className="mb-12 border border-brand-border bg-white p-10">
          <div className="mb-10 flex items-center justify-between">
            <span
              className={`border px-3 py-1 text-[10px] font-bold tracking-[0.15em] uppercase ${bounty.status === "OPEN"
                ? "border-accent-success/20 bg-accent-success/5 text-accent-success"
                : "border-brand-border bg-brand-paper text-primary/40"
                }`}
            >
              Protocol Status: {bounty.status}
            </span>
            <div className="flex items-center gap-4">
              {isCreator && bounty.status === "OPEN" && bounty.submissions.length > 0 && (
                <button
                  onClick={handleAiReview}
                  disabled={isReviewing}
                  className="flex items-center gap-2 border border-primary/10 bg-brand-paper px-4 py-2 text-[10px] font-bold text-primary uppercase tracking-widest transition-all hover:bg-white disabled:opacity-50"
                >
                  {isReviewing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Execute AI Audit
                </button>
              )}
              <span className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                Registered {new Date(bounty.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <h1 className="mb-8 text-5xl font-medium tracking-tighter text-primary leading-tight">
            {bounty.title}
          </h1>

          <div className="mb-12 border-l-2 border-brand-border pl-8 py-2">
            <MarkdownViewer content={bounty.description} className="prose-sm text-primary/70 leading-relaxed font-medium" />
          </div>

          <div className="flex items-center justify-between pt-10 border-t border-brand-border">
            <div>
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-1">Settlement Asset</p>
              <p className="text-3xl font-semibold text-primary tracking-tighter">
                {bounty.prize} <span className="text-primary/40">MON</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-1">Contract Principal</p>
              <p className="font-mono text-xs font-medium text-primary/60">
                {bounty.creatorAddress}
              </p>
            </div>
          </div>
        </div>

        {/* Submissions List */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-semibold text-primary tracking-tight">
              Registry Submissions
            </h2>
            <span className="text-xs font-bold text-primary/30">{bounty.submissions.length} Found</span>
          </div>

          <div className="space-y-4">
            {bounty.submissions.map((sub) => {
              const isWinner = bounty.winnerSubmissionId === sub.id;
              return (
                <div
                  key={sub.id}
                  className={`relative border p-10 transition-all ${isWinner
                    ? "border-accent-success bg-accent-success/5"
                    : sub.isAiSelected
                      ? "border-primary/20 bg-brand-paper"
                      : "border-brand-border bg-white"
                    }`}
                >
                  {isWinner && (
                    <div className="absolute -top-3 left-8 flex items-center gap-1 border border-accent-success bg-white px-3 py-1 text-[10px] font-bold text-accent-success tracking-[0.2em] uppercase">
                      <CheckCircle className="h-3 w-3" />
                      Verified Winner
                    </div>
                  )}
                  {!isWinner && sub.isAiSelected && (
                    <div className="absolute -top-3 left-8 flex items-center gap-1 border border-primary/20 bg-white px-3 py-1 text-[10px] font-bold text-primary tracking-[0.2em] uppercase">
                      <Sparkles className="h-3 w-3" />
                      Audit Preferred
                    </div>
                  )}

                  <div className="mb-6 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-medium text-primary/40">
                      IDENT // {sub.hunterAddress}
                    </span>
                    <span className="text-[10px] font-bold text-primary/20 uppercase tracking-widest">
                      {new Date(sub.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  <MarkdownViewer content={sub.content} className="mb-8 text-sm font-medium text-primary/70 leading-relaxed" />

                  {sub.contact && (
                    <p className="mb-6 text-[10px] font-bold text-primary/30 uppercase tracking-[0.1em]">
                      Registry Contact: <span className="text-primary/60">{sub.contact}</span>
                    </p>
                  )}

                  {sub.aiFeedback && (
                    <div className="mb-8 border border-primary/10 bg-brand-paper/50 p-6">
                      <p className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <Sparkles className="h-3 w-3" /> Machine Analysis
                      </p>
                      <p className="text-xs font-medium text-primary/60 italic leading-relaxed">
                        &quot;{sub.aiFeedback}&quot;
                      </p>
                    </div>
                  )}

                  {isCreator && bounty.status === "OPEN" && (
                    <button
                      onClick={() => handlePayWinner(sub.id, sub.hunterAddress)}
                      disabled={!!paying}
                      className="flex items-center gap-3 border border-accent-success bg-accent-success text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      {paying === sub.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                      Authorize Settlement
                    </button>
                  )}
                </div>
              );
            })}
            {bounty.submissions.length === 0 && (
              <div className="border border-brand-border bg-brand-paper/50 p-12 text-center">
                <p className="text-xs font-medium text-primary/30 tracking-tight uppercase">No records found in directive registry.</p>
              </div>
            )}
          </div>
        </div>

        {/* Submission Form */}
        {!isCreator && bounty.status === "OPEN" && (
          <div className="border border-brand-border bg-white p-10">
            <h3 className="mb-8 text-lg font-semibold text-primary tracking-tight">
              Fulfillment Submission
            </h3>
            {!authenticated ? (
              <button
                onClick={login}
                className="btn-primary"
              >
                Authenticate to Proceed
              </button>
            ) : (
              <form onSubmit={handleSubmitWork} className="space-y-8">
                <div>
                  <MarkdownEditor
                    label="Technical Documentation / Proof of Fulfillment"
                    value={submissionContent}
                    onChange={setSubmissionContent}
                    placeholder="Provide detailed documentation of the completed task..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-2">
                    Direct Contact String (Optional)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-brand-border bg-brand-paper/30 px-4 py-4 text-xs font-semibold text-primary placeholder-primary/20 focus:border-primary focus:outline-none transition-all"
                    placeholder="Email, PGP, or handle"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Register Fulfillment"
                  )}
                </button>

                {submissionAddress && (
                  <p className="text-center text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                    <Wallet className="mr-2 inline h-3 w-3" />
                    Hunter ID: {submissionAddress.slice(0, 10)}...{submissionAddress.slice(-8)}
                    {user?.wallet?.address === submissionAddress && " (embedded)"}
                  </p>
                )}
              </form>
            )}
          </div>
        )}

        {/* AI Review Panel */}
        {showAiPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-2xl card rounded-2xl p-6 border border-purple-100">
              <button
                onClick={() => setShowAiPanel(false)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-6 flex items-center gap-3">
                <div className={`rounded-2xl p-3 ${isReviewDone ? "bg-accent-success/10 text-accent-success" : "bg-purple-50 text-purple-500"}`}>
                  {isReviewDone ? <CheckCircle className="h-6 w-6" /> : <Sparkles className={`h-6 w-6 ${isReviewing ? "animate-pulse" : ""}`} />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {isReviewing ? "AI Judge Analysis" : isReviewDone ? "Analysis Complete" : "AI Judge"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {isReviewing ? "Analyzing submissions with Gemini 1.5 Flash..." : isReviewDone ? "Submissions scored and top picks flagged." : "Preparing AI..."}
                  </p>
                </div>
              </div>

              <div
                ref={aiPanelRef}
                className={`relative h-[400px] w-full ${isReviewDone && !isReviewing ? "overflow-hidden" : "overflow-y-auto"} rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700`}
              >
                {/* Done Animation Overlay */}
                {isReviewDone && !isReviewing && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm animate-in fade-in duration-700">
                    <div className="flex flex-col items-center bg-white py-8 px-10 rounded-2xl shadow-xl border border-accent-success/20 animate-in zoom-in-95 duration-500 ease-out">
                      <div className="mb-4">
                        {/* Animated Razorpay-style Checkmark */}
                        <svg className="w-16 h-16 rounded-full block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                          <circle className="animate-tick-circle" cx="26" cy="26" r="25" fill="none" />
                          <path className="animate-tick-check" fill="none" stroke="#4caf50" strokeWidth="4" strokeMiterlimit="10" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Audit Finished</h3>
                      <p className="text-sm font-medium text-gray-500 text-center max-w-[220px]">Top submissions have been annotated below.</p>
                      <button
                        onClick={() => setShowAiPanel(false)}
                        className="mt-6 border border-accent-success/20 bg-accent-success/10 text-accent-success font-bold text-xs uppercase tracking-widest px-6 py-2 rounded-full hover:bg-accent-success hover:text-white transition-all delay-1000 animate-in fade-in duration-500 fill-mode-both"
                      >
                        View Results
                      </button>
                    </div>
                  </div>
                )}

                {aiThinking ? (
                  <div className="prose prose-sm max-w-none text-gray-700 font-sans">
                    <MarkdownViewer content={aiThinking} />
                  </div>
                ) : (
                  <div className="flex h-full flex-col justify-center gap-4 px-10">
                    <div className="flex items-center gap-4 animate-pulse">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200"></div>
                      <div className="h-4 w-full max-w-[200px] rounded-md bg-gray-200"></div>
                    </div>
                    <div className="space-y-3 animate-pulse mt-4">
                      <div className="h-3 w-full rounded bg-gray-200"></div>
                      <div className="h-3 w-4/5 rounded bg-gray-200"></div>
                      <div className="h-3 w-[60%] rounded bg-gray-200"></div>
                    </div>
                    <div className="space-y-3 animate-pulse mt-6">
                      <div className="h-3 w-[90%] rounded bg-gray-200"></div>
                      <div className="h-3 w-[70%] rounded bg-gray-200"></div>
                    </div>
                    <div className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/30 animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                      Scanning Registry Submissions...
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowAiPanel(false)}
                  disabled={isReviewing}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {isReviewing ? "Analyzing..." : "Close & View Results"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Connection Prompt */}
        <ConnectWalletPrompt
          isOpen={showWalletPrompt}
          onClose={() => {
            setShowWalletPrompt(false);
            setWalletPromptAction(null);
            setPendingPayment(null);
          }}
          onConnect={handleConnectWallet}
          isLoading={isConnecting}
          title={walletPromptAction === "pay" ? "Connect Wallet to Pay" : "Connect Wallet"}
          description={
            walletPromptAction === "pay"
              ? "You need to connect a wallet with MON tokens to pay the winner."
              : "Connect your wallet to submit work. Prize winnings will be sent to your connected wallet."
          }
        />
      </div>
    </div>
  );
}
