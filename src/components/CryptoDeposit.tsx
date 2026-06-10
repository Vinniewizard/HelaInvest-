import React, { useState } from "react";
import { Coins, Sparkles, Copy, RefreshCw, Check, QrCode, ArrowDownCircle, Info, ExternalLink, ShieldCheck } from "lucide-react";
import { useCurrency } from "../context/CurrencyContext";
import { toast } from "sonner";

interface CryptoDepositProps {
  onRefresh: () => void;
}

export default function CryptoDeposit({ onRefresh }: CryptoDepositProps) {
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

  // UI state for clipboard feedback
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [simulatingClear, setSimulatingClear] = useState(false);

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

      toast.success("Crypto checkout invoice generated!");
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

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-semibold rounded-xl flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {!activeInvoice ? (
        <form onSubmit={handleCreateInvoice} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                Funding Target Capital Amount ({symbol}) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs text-slate-500 font-bold">{symbol}</span>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-[#006B4A]/60 rounded-xl pl-8 pr-4 py-2.5 text-xs font-bold text-slate-250 outline-none transition-colors"
                />
              </div>
              {amount && (
                <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                  ≈ KSh {convertToKES(Number(amount)).toLocaleString()} Base Node Value
                </span>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                Select Native Cryptocoin Network *
              </label>
              <select
                value={cryptoCurrency}
                onChange={(e) => setCryptoCurrency(e.target.value)}
                className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-[#006B4A]/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-250 outline-none cursor-pointer transition-colors"
              >
                <option value="USDTTRC20">USDT (TRC-20 Mainnet)</option>
                <option value="BTC">BTC (Bitcoin network)</option>
                <option value="ETH">ETH (Ethereum ERC-20)</option>
                <option value="USDC">USDC (USD Coin Polygon/ERC20)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
              Memo Reference Note
            </label>
            <input
              type="text"
              placeholder="e.g. Crypto asset top up"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-[#006B4A]/60 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-250 outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !amount}
            className={`w-full py-3 px-6 rounded-xl flex justify-center items-center gap-2 font-bold text-xs transition-transform duration-200 cursor-pointer shadow-md ${
              !amount ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-[#006B4A] hover:bg-[#005238] text-white active:scale-[0.99]"
            }`}
          >
            {loading ? (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Coins className="h-4.5 w-4.5 text-amber-400" />
                Initialize Crypto Invoice Funding Route
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="bg-[#0c0f16]/90 border border-indigo-500/20 p-6 rounded-2xl space-y-6">
          <div className="flex justify-between items-start border-b border-[#212a3d] pb-4">
            <div>
              <span className="text-xs font-bold text-indigo-400 block uppercase tracking-wider">Checkout Payment Details</span>
              <span className="text-[10px] text-slate-500 font-mono">Invoice ID: {activeInvoice.paymentId}</span>
            </div>
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] uppercase font-bold animate-pulse">
              Waiting for Crypto Payer Transfer
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* QR Code */}
            <div className="bg-white p-3 rounded-xl shrink-0 border border-slate-200">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(activeInvoice.payAddress)}`}
                alt="Payment QR target Address"
                referrerPolicy="no-referrer"
                className="h-32 w-32"
              />
            </div>

            {/* Transfer credentials info */}
            <div className="space-y-4 w-full">
              {/* Transfer amount */}
              <div>
                <span className="block text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Required Transfer Amount</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-mono font-black text-white">
                    {activeInvoice.payAmount} {activeInvoice.cryptoCurrency}
                  </span>
                  <button
                    onClick={() => copyToClipboard(String(activeInvoice.payAmount), "amount")}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Copy transfer amount"
                  >
                    {copiedAmount ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 font-medium italic block mt-0.5">
                  (Estimated conversion ≈ ${activeInvoice.priceAmountUSD} USD net ledger value)
                </span>
              </div>

              {/* Target wallet address */}
              <div>
                <span className="block text-[9px] text-slate-500 uppercase font-extrabold tracking-wider">Recipient Smart Wallet Address</span>
                <div className="flex items-center gap-2 mt-1 bg-slate-900 border border-[#212a3d] p-2.5 rounded-xl">
                  <span className="text-[10.5px] font-mono text-emerald-400 break-all select-all font-bold">
                    {activeInvoice.payAddress}
                  </span>
                  <button
                    onClick={() => copyToClipboard(activeInvoice.payAddress, "address")}
                    className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white shrink-0 transition-colors cursor-pointer"
                    title="Copy smart wallet destination address"
                  >
                    {copiedAddress ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Simulated Network Block Clearer */}
          <div className="bg-slate-950 border border-[#212a3d] p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold block">Sandbox Simulated Blockchain Network</span>
              <span className="text-[9px] text-[#006B4A] font-extrabold uppercase flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-[#006B4A]" /> Fast-Clear Active
              </span>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
              We detect you are accessing our sandbox environment. To bypass real-world digital asset mining, you can execute a simulated block clearance to settle your account ledger instantly!
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => simulateSandboxClear(activeInvoice.txId)}
                disabled={simulatingClear}
                className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-300 font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 w-full flex-1"
              >
                {simulatingClear ? (
                  <span className="h-3.5 w-3.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "8s" }} />
                    Verify Payment: Settle Simulated Balance Instantly
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveInvoice(null);
                  setErrorMsg(null);
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 font-bold text-xs rounded-lg cursor-pointer transition-colors"
              >
                Cancel Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
