import React, { useState } from "react";
import { Coins, Sparkles, Copy, RefreshCw, Check, QrCode, ArrowDownCircle, Info, ExternalLink, ShieldCheck, HelpCircle } from "lucide-react";
import { useCurrency } from "../context/CurrencyContext";
import { toast } from "sonner";

interface CryptoDepositProps {
  onRefresh: () => void;
}

export default function CryptoDeposit({ onRefresh }: CryptoDepositProps) {
  const { format, convertToKES, symbol, activeCurrency } = useCurrency();
  
  // Form State
  const [amount, setAmount] = useState("");
  const [cryptoCurrency, setCryptoCurrency] = useState<string>("USDTTRC25");
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

  // UI state for clipboard feedback
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [simulatingClear, setSimulatingClear] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Set default currency correct TRC20 code
  React.useEffect(() => {
    setCryptoCurrency("USDTTRC20");
  }, []);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActiveInvoice(null);

    const typedAmt = Number(amount);
    if (!typedAmt || typedAmt <= 0) {
      setErrorMsg("Please enter a valid deposit amount.");
      return;
    }

    const amtKES = convertToKES(typedAmt);

    if (amtKES < 100) {
      setErrorMsg(`Minimum deposit is ${format(100)} (approx 100 KSh).`);
      return;
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

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <span className="text-base text-red-500">⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {!activeInvoice ? (
        <form onSubmit={handleCreateInvoice} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-[#006B4A] uppercase tracking-wider mb-2">
                Capital Funding Amount ({symbol}) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-sm text-slate-400 font-bold">{symbol}</span>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#006B4A] rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                />
              </div>
              {amount && (
                <span className="text-[10px] text-slate-500 font-mono mt-1 w-full block leading-none">
                  ≈ KSh {convertToKES(Number(amount)).toLocaleString()} Base Node Value
                </span>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                Cryptocoin Network *
              </label>
              <select
                value={cryptoCurrency}
                onChange={(e) => setCryptoCurrency(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#006B4A] rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none cursor-pointer transition-all"
              >
                <option value="USDTTRC20">USDT (TRC-20 Mainnet Node)</option>
                <option value="BTC">BTC (Bitcoin network)</option>
                <option value="ETH">ETH (Ethereum ERC-20)</option>
                <option value="USDC">USDC (USD Coin ERC20/Poly)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
              Memo Reference Note
            </label>
            <input
              type="text"
              placeholder="e.g. Crypto asset top up"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-[#006B4A] rounded-xl px-4 py-2.5 text-xs font-medium text-slate-800 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !amount}
            className={`w-full py-3 px-6 rounded-xl flex justify-center items-center gap-2 font-bold text-xs transition-transform duration-200 cursor-pointer shadow-md ${
              !amount
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/50"
                : "bg-[#006B4A] hover:bg-[#005238] text-white active:scale-[0.99]"
            }`}
          >
            {loading ? (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Coins className="h-4.5 w-4.5 text-amber-400" />
                Initialize Crypto Invoice Gateway
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
            <div>
              <span className="text-xs font-bold text-indigo-700 block uppercase tracking-wider">NOWPayments Secure Invoice</span>
              <span className="text-[10px] text-slate-500 font-mono">ID: {activeInvoice.paymentId}</span>
            </div>
            <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-[9px] uppercase font-extrabold tracking-wide inline-flex items-center gap-1 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span> Waiting for Network Transfer
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* QR Code */}
            <div className="bg-slate-50 p-4 rounded-2xl shrink-0 border border-slate-200 flex flex-col items-center justify-center shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(activeInvoice.payAddress)}`}
                alt="Payment QR Address"
                referrerPolicy="no-referrer"
                className="h-32 w-32 rounded-lg"
              />
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-2.5 flex items-center gap-1">
                <QrCode className="h-3 w-3" /> Scan with Wallet App
              </span>
            </div>

            {/* Transfer credentials info */}
            <div className="space-y-4 w-full">
              {/* Transfer amount */}
              <div className="space-y-1">
                <span className="block text-[9.5px] text-slate-400 uppercase font-extrabold tracking-wider">Exact Transfer Required</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono font-black text-slate-800 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 inline-block">
                    {activeInvoice.payAmount} {activeInvoice.cryptoCurrency}
                  </span>
                  <button
                    onClick={() => copyToClipboard(String(activeInvoice.payAmount), "amount")}
                    className="p-2 py-2.5 hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 transition-all cursor-pointer flex items-center"
                    title="Copy transfer amount"
                  >
                    {copiedAmount ? <Check className="h-3.5 w-3.5 text-[#006B4A]" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 font-medium italic block">
                  (Estimated net ledger value ≈ ${activeInvoice.priceAmountUSD} USD)
                </span>
              </div>

              {/* Target wallet address */}
              <div className="space-y-1">
                <span className="block text-[9.5px] text-slate-400 uppercase font-extrabold tracking-wider">Smart Payout Wallet Address Coordinates</span>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <span className="text-[10.5px] font-mono text-indigo-700 break-all select-all font-bold">
                    {activeInvoice.payAddress}
                  </span>
                  <button
                    onClick={() => copyToClipboard(activeInvoice.payAddress, "address")}
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-indigo-900 shrink-0 transition-all cursor-pointer"
                    title="Copy smart wallet destination address"
                  >
                    {copiedAddress ? <Check className="h-3.5 w-3.5 text-[#006B4A]" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sandbox check and Live verification tools */}
          {activeInvoice.paymentId.startsWith("nw-") ? (
            <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-xl space-y-3.5 leading-normal">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-indigo-800 font-extrabold block uppercase tracking-wider">Sandbox Fast-Clear Terminal</span>
                <span className="text-[9px] bg-indigo-100 border border-indigo-200 text-indigo-800 px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#006B4A]" /> Bypass Settle Mode
                </span>
              </div>
              <p className="text-[10.5px] text-indigo-950 font-medium leading-relaxed">
                You are accessing our verified sandbox environment. Bypass real-world digital asset mining times to instantly credit your simulation account!
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => simulateSandboxClear(activeInvoice.txId)}
                  disabled={simulatingClear}
                  className="px-4 py-2.5 bg-[#006B4A] hover:bg-[#005238] text-white font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 flex-1"
                >
                  {simulatingClear ? (
                    <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "8s" }} />
                      Instant Sandbox Clearance Setup
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveInvoice(null);
                    setErrorMsg(null);
                  }}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center justify-center"
                >
                  Cancel Invoice
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl space-y-3.5 leading-normal">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">Live Blockchain Network Verification</span>
                <span className="text-[9px] text-[#006B4A] font-extrabold uppercase flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#006B4A] animate-ping"></span> Real-Time Monitor
                </span>
              </div>
              <p className="text-[10.5px] leading-relaxed text-emerald-950 font-medium">
                Once successfully authorized on your cryptocurrency exchange/wallet portfolio, trigger live audit validation below to sync state immediately.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => checkCryptoStatus(activeInvoice.txId)}
                  disabled={checkingStatus}
                  className="px-4 py-2.5 bg-[#006B4A] hover:bg-[#005238] text-white font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 flex-1"
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
                  onClick={() => {
                    setActiveInvoice(null);
                    setErrorMsg(null);
                  }}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center justify-center"
                >
                  Cancel Invoice
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
