import React, { useState, useEffect } from "react";
import { Coins, Sparkles, Copy, RefreshCw, Check, QrCode, ArrowDownCircle, Info, ExternalLink, ShieldCheck, HelpCircle, XCircle, ChevronRight, AlertCircle } from "lucide-react";
import { useCurrency } from "../context/CurrencyContext";
import { toast } from "sonner";

interface CryptoDepositProps {
  onRefresh: () => void;
  minDeposit?: number;
  maxDeposit?: number;
}

export default function CryptoDeposit({ onRefresh, minDeposit, maxDeposit }: CryptoDepositProps) {
  const { format, convertToKES, symbol, activeCurrency } = useCurrency();
  
  // Form State
  const [amount, setAmount] = useState("");
  const [cryptoCurrency, setCryptoCurrency] = useState<string>("USDTTRC20");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Invoice State
  const [activeInvoice, setActiveInvoice] = useState<{
    payAddress: string;
    payAmount: number;
    paymentId: string;
    cryptoCurrency: string;
    priceAmountUSD: number;
    txId: string;
  } | null>(null);

  // UI status helpers
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [simulatingClear, setSimulatingClear] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [cancellingInvoice, setCancellingInvoice] = useState(false);

  // Load existing active pending invoice on component mount
  useEffect(() => {
    const fetchActiveSession = async () => {
      try {
        const res = await fetch("/api/transactions/active-crypto", {
          headers: {
            "x-user-id": localStorage.getItem("hela_user_id") || "",
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.hasActive && data.paymentDetails) {
            setActiveInvoice(data.paymentDetails);
          }
        }
      } catch (e) {
        console.error("Failed to query active pending cryptocurrency session", e);
      }
    };
    
    fetchActiveSession();
  }, []);

  // Auto-polling for active invoice/payment status synchronisation
  useEffect(() => {
    if (!activeInvoice) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/transactions/${activeInvoice.txId}/check-crypto-status`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "approved") {
            toast.success(data.message || "Crypto payment verified and approved!");
            setActiveInvoice(null);
            onRefresh();
          } else if (data.status === "declined") {
            toast.error(data.message || "Payment has been marked as declined.");
            setActiveInvoice(null);
            onRefresh();
          }
        }
      } catch (err) {
        console.warn("Background billing polling sync issue:", err);
      }
    }, 12000); // Poll every 12 seconds

    return () => clearInterval(intervalId);
  }, [activeInvoice, onRefresh]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const typedAmt = Number(amount);
    if (!typedAmt || typedAmt <= 0) {
      setErrorMsg("Please enter a valid deposit amount.");
      return;
    }

    const amtKES = convertToKES(typedAmt);

    // Enforce administrative dynamic thresholds if defined
    if (minDeposit !== undefined && minDeposit !== null && minDeposit > 0) {
      if (amtKES < minDeposit) {
        setErrorMsg(`Deposit amount is below the administrative minimum of ${format(minDeposit)} (KSh ${minDeposit.toLocaleString()}).`);
        return;
      }
    } else {
      // Default fallback minimum
      if (amtKES < 100) {
        setErrorMsg(`Minimum deposit is ${format(100)} (approx 100 KSh).`);
        return;
      }
    }

    if (maxDeposit !== undefined && maxDeposit !== null && maxDeposit > 0) {
      if (amtKES > maxDeposit) {
        setErrorMsg(`Deposit amount is above the administrative maximum of ${format(maxDeposit)} (KSh ${maxDeposit.toLocaleString()}).`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/transactions/deposit-crypto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": localStorage.getItem("hela_user_id") || "",
        },
        body: JSON.stringify({
          amount: amtKES,
          cryptoCurrency: cryptoCurrency,
          note: note || "Crypto top up",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate cryptocurrency invoice.");
      }

      setActiveInvoice({
        ...data.paymentDetails,
        txId: data.transaction.id,
      });

      toast.success("Crypto checkout invoice generated successfully!");
      setAmount("");
      setNote("");
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Payment Gateway failed to respond.");
      toast.error(err.message || "Failed to generate crypto invoice.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: "address" | "amount") => {
    navigator.clipboard.writeText(text);
    if (type === "address") {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } else {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    }
    toast.success(`${type === "address" ? "Address" : "Transfer amount"} copied successfully!`);
  };

  const simulateSandboxClear = async (txId: string) => {
    setSimulatingClear(true);
    try {
      const res = await fetch(`/api/transactions/${txId}/simulate-sandbox-clear`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Simulated payment cleared!");
        setActiveInvoice(null);
        onRefresh();
      } else {
        toast.error(data.error || "Simulation clearance returned an issue.");
      }
    } catch (err: any) {
      toast.error("Failed to connect with sandbox simulator.");
    } finally {
      setSimulatingClear(false);
    }
  };

  const checkCryptoStatus = async (txId: string) => {
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/transactions/${txId}/check-crypto-status`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === "approved") {
          toast.success(data.message || "Crypto payment verified and approved!");
          setActiveInvoice(null);
          onRefresh();
        } else if (data.status === "declined") {
          toast.error(data.message || "Payment has been marked as declined.");
          setActiveInvoice(null);
          onRefresh();
        } else {
          toast.info(data.message || `Payment status check: ${data.status}`);
        }
      } else {
        toast.error(data.error || "Failed to verify transaction status with server.");
      }
    } catch (err: any) {
      toast.error("Failed to connect with payment verification service.");
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!activeInvoice) return;
    setCancellingInvoice(true);
    try {
      const res = await fetch("/api/transactions/cancel-pending-deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": localStorage.getItem("hela_user_id") || "",
        },
        body: JSON.stringify({ txId: activeInvoice.txId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Pending deposit session cancelled. Log is updated.");
        setActiveInvoice(null);
        setErrorMsg(null);
        onRefresh();
      } else {
        toast.error(data.error || "Failed to cancel pending invoice.");
      }
    } catch (e) {
      toast.error("Network communication error.");
    } finally {
      setCancellingInvoice(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Informative Error Notice */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-start gap-2.5 shadow-sm animate-fade-in">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-extrabold text-rose-900 block uppercase tracking-wider text-[10px]">Deposit Initialization Unsuccessful</span>
            <p className="font-medium text-[11px] leading-relaxed text-rose-800">{errorMsg}</p>
          </div>
        </div>
      )}

      {!activeInvoice ? (
        <form onSubmit={handleCreateInvoice} className="space-y-6">
          <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#006B4A]/10 text-[#006B4A] text-[10px] font-bold">1</span>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Configure Funding Amount</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Capital Funding Amount ({symbol}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-sm text-slate-400 font-bold">{symbol}</span>
                  <input
                    type="number"
                    placeholder="Enter amount (e.g. 50)"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-[#006B4A] focus:ring-1 focus:ring-[#006B4A]/10 rounded-xl pl-9 pr-4 py-2.5 text-xs font-black text-slate-800 outline-none transition-all"
                  />
                </div>
                {amount && (
                  <div className="bg-[#006B4A]/5 border border-[#006B4A]/10 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[11px] font-medium text-[#005a3e]">
                    <span>Converted Local Value:</span>
                    <span className="font-extrabold font-mono">≈ KSh {convertToKES(Number(amount)).toLocaleString()}</span>
                  </div>
                )}
                {minDeposit !== undefined && minDeposit !== null && minDeposit > 0 ? (
                  <div className="text-[10.5px] text-slate-400 font-medium leading-normal mt-1.5">
                    Allowed range: <span className="font-bold text-slate-700">{format(minDeposit)}</span> 
                    {maxDeposit !== undefined && maxDeposit !== null && maxDeposit > 0 ? (
                      <> to <span className="font-bold text-slate-700">{format(maxDeposit)}</span></>
                    ) : (
                      " Minimum"
                    )}
                  </div>
                ) : (
                  maxDeposit !== undefined && maxDeposit !== null && maxDeposit > 0 ? (
                    <div className="text-[10.5px] text-slate-400 font-medium leading-normal mt-1.5">
                      Maximum allowed limit: <span className="font-bold text-rose-600">{format(maxDeposit)}</span>
                    </div>
                  ) : null
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Cryptocoin Network Node *
                </label>
                <select
                  value={cryptoCurrency}
                  onChange={(e) => setCryptoCurrency(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-[#006B4A] rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none cursor-pointer transition-all hover:border-slate-350"
                >
                  <option value="USDTTRC20">USDT (TRC-20 Mainnet Node)</option>
                  <option value="BTC">BTC (Bitcoin Mainnet Network)</option>
                  <option value="ETH">ETH (Ethereum ERC-20 Mainnet)</option>
                  <option value="USDC">USDC (USD Coin Polygon Layer-2)</option>
                </select>
                <div className="text-[10px] text-slate-400 font-medium">Verify address matches correct network channel layout.</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#006B4A]/10 text-[#006B4A] text-[10px] font-bold">2</span>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Optional Reference Identity</h4>
            </div>
            
            <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                Memo Reference Note
              </label>
              <input
                type="text"
                placeholder="e.g. Crypto asset simulation top up"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-[#006B4A] rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-850 outline-none transition-all"
              />
              <span className="text-[10px] text-slate-400 block mt-1.5">For easy identification in your transaction security ledger archive.</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-xl flex justify-center items-center gap-2.5 font-extrabold text-xs transition-all duration-200 cursor-pointer shadow-md bg-[#006B4A] hover:bg-[#005238] border border-emerald-500/10 text-white hover:shadow-lg active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Coins className="h-4.5 w-4.5 text-amber-300 animate-pulse" />
                Deposit
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="bg-[#0f131d] border border-indigo-950 p-6 rounded-2xl shadow-xl space-y-6 text-slate-300 animate-fade-in relative overflow-hidden">
          {/* Accent Glow */}
          <div className="absolute right-0 top-0 -translate-y-12 translate-x-12 h-44 w-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#212a3d] pb-5 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase">
                  NOWPayments Protocol
                </span>
                <span className="text-[10.5px] font-mono text-indigo-300/80 font-bold">ID: {activeInvoice.paymentId}</span>
              </div>
              <p className="text-[10.5px] text-slate-400 font-medium mt-1">Pending payment coordinator synchronization</p>
            </div>
            
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/25 px-3 py-1 rounded-full text-[9px] uppercase font-black tracking-wider inline-flex items-center gap-1.5 animate-pulse shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span> Pending Network Confirmation
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            {/* QR block */}
            <div className="md:col-span-5 bg-[#0c0f16] p-5 rounded-2xl border border-[#212a3d] flex flex-col items-center justify-center shadow-inner space-y-3.5 shrink-0">
              <div className="p-3 bg-white rounded-xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(activeInvoice.payAddress)}`}
                  alt="Payment QR Address"
                  referrerPolicy="no-referrer"
                  className="h-32 w-32"
                />
              </div>
              <span className="text-[10px] text-indigo-450 font-extrabold uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <QrCode className="h-3.5 w-3.5 animate-pulse" /> SCAN SECURE COORDINATES
              </span>
            </div>

            {/* Address fields */}
            <div className="md:col-span-7 flex flex-col justify-between space-y-4">
              <div className="space-y-3.5">
                {/* Transfer amount */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Exact Transfer Value Required</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-black text-white bg-[#0c0f16] border border-[#212a3d] px-3.5 py-2 rounded-xl inline-block shadow-inner">
                      {activeInvoice.payAmount} {activeInvoice.cryptoCurrency}
                    </span>
                    <button
                      onClick={() => copyToClipboard(String(activeInvoice.payAmount), "amount")}
                      className="p-2.5 bg-[#161c28] hover:bg-[#20293a] text-slate-300 hover:text-white rounded-xl border border-[#212a3d] transition-all cursor-pointer flex items-center shadow-sm"
                      title="Copy transfer amount to clipboard"
                    >
                      {copiedAmount ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <span className="text-[10.5px] text-slate-400/80 font-medium block">
                    (Corresponds to target value of <strong className="text-white">${activeInvoice.priceAmountUSD} USD</strong> on ledger conversion)
                  </span>
                </div>

                {/* Destination wallet */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Deposit Wallet Address Coordinates</span>
                  <div className="flex items-center gap-2 bg-[#0c0f16] border border-[#212a3d] px-3 py-2.5 rounded-xl justify-between">
                    <span className="text-[11px] font-mono text-indigo-300 font-extrabold break-all select-all pr-1">
                      {activeInvoice.payAddress}
                    </span>
                    <button
                      onClick={() => copyToClipboard(activeInvoice.payAddress, "address")}
                      className="p-1.5 bg-[#111622] hover:bg-[#20293a] border border-[#212a3d] text-slate-300 hover:text-white rounded transition-all shrink-0 cursor-pointer"
                      title="Copy wallet destination coordinate"
                    >
                      {copiedAddress ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action modules */}
          <div className="bg-emerald-950/20 border border-emerald-500/15 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-450 font-black uppercase tracking-wider block">Live Blockchain Network Tracker</span>
              <span className="bg-emerald-550/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest flex items-center gap-1 animate-pulse">
                <span className="h-1 h-1 bg-emerald-400 rounded-full animate-ping"></span> Live Sync Active
              </span>
            </div>
            <p className="text-[11px] text-slate-350 leading-relaxed font-semibold">
              Confirm your coin transfer is initiated in your private wallet or exchange app, then click verify. Once the transaction achieves required network block confirmations, ledger balance shifts automatically. You can safely self-cancel below if you need to adjust coordinates.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => checkCryptoStatus(activeInvoice.txId)}
                disabled={checkingStatus || cancellingInvoice}
                className="px-4 py-3 bg-[#006B4A] hover:bg-[#005238] text-white font-black text-xs rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 flex-1 shadow-md"
              >
                {checkingStatus ? (
                  <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "3s" }} />
                    Verify Network Payment Status
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancelInvoice}
                disabled={cancellingInvoice || checkingStatus}
                className="px-4 py-3 bg-[#111622] hover:bg-[#1c2235] border border-[#212a3d] text-slate-300 hover:text-rose-400 font-bold text-xs rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                {cancellingInvoice ? (
                  <span className="h-3.5 w-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" />
                    Self-Cancel Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
