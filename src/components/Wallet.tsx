import React, { useState, useEffect } from "react";
import { Wallet, ArrowDownCircle, ArrowUpCircle, History, Coins, ListTodo, ShieldAlert, CheckCircle2, XCircle, Clock, Sparkles, Copy, RefreshCw, Check, QrCode } from "lucide-react";
import { Transaction, WalletBalance } from "../types";
import { useCurrency } from "../context/CurrencyContext";
import { toast } from "sonner";
import CryptoDeposit from "./CryptoDeposit";

interface WalletProps {
  balance: WalletBalance | null;
  transactions: Transaction[];
  phone: string;
  onDeposit: (amount: number, phone: string, note: string) => Promise<any>;
  onWithdraw: (amount: number, phone: string, note: string) => Promise<any>;
  onRefresh: () => void;
}

export default function WalletComponent({
  balance,
  transactions,
  phone,
  onDeposit,
  onWithdraw,
  onRefresh,
}: WalletProps) {
  const { format, convertToKES, convertFromKES, symbol, activeCurrency } = useCurrency();
  const [activeSubTab, setActiveSubTab] = useState<"deposit" | "withdraw" | "history">("deposit");

  // Gateway Settings cached dynamically
  const [paymentSettings, setPaymentSettings] = useState({
    mpesa_enabled: true,
    crypto_enabled: true,
    nowpayments_sandbox: true
  });

  const [depositMethod, setDepositMethod] = useState<"mpesa" | "crypto">("mpesa");

  // Deposit Form
  const [depAmount, setDepAmount] = useState("");
  const [depPhone, setDepPhone] = useState(phone);
  const [depNote, setDepNote] = useState("");
  const [depLoading, setDepLoading] = useState(false);

  // Crypto specific
  const [cryptoCurrency, setCryptoCurrency] = useState<string>("USDTTRC20");
  const [activeCryptoInvoice, setActiveCryptoInvoice] = useState<{
    payAddress: string;
    payAmount: number;
    paymentId: string;
    cryptoCurrency: string;
    priceAmountUSD: number;
    txId: string;
  } | null>(null);
  const [simulatingClear, setSimulatingClear] = useState(false);

  // Withdrawal Form
  const [withAmount, setWithAmount] = useState("");
  const [withPhone, setWithPhone] = useState(phone);
  const [withNote, setWithNote] = useState("");
  const [withLoading, setWithLoading] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<"mpesa" | "crypto">("mpesa");
  const [withCryptoCurrency, setWithCryptoCurrency] = useState<string>("USDTTRC20");
  const [withCryptoAddress, setWithCryptoAddress] = useState("");

  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load backend payment settings on component activation
  useEffect(() => {
    fetch("/api/payment-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.paymentSettings) {
          setPaymentSettings(data.paymentSettings);
          // Set default available tab based on enabled settings
          if (!data.paymentSettings.mpesa_enabled && data.paymentSettings.crypto_enabled) {
            setDepositMethod("crypto");
          } else {
            setDepositMethod("mpesa");
          }
        }
      })
      .catch((err) => console.error("Error reading gateway status settings:", err));
  }, []);

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const typedAmt = Number(depAmount);
    if (!typedAmt || typedAmt <= 0) {
      setFormMsg({ type: "error", text: "Please enter a valid deposit amount." });
      return;
    }

    const amtKES = convertToKES(typedAmt);

    if (amtKES < 100) {
      setFormMsg({ type: "error", text: `Minimum deposit is ${format(100)} (${activeCurrency === 'KES' ? '' : 'approx '}100 KSh).` });
      return;
    }

    if (!depPhone) {
      setFormMsg({ type: "error", text: "Please enter a phone number to trigger the M-Pesa push." });
      return;
    }

    setDepLoading(true);
    try {
      const res = await onDeposit(amtKES, depPhone, depNote);
      if (res && res.error) {
        setFormMsg({ type: "error", text: res.error });
      } else {
        setFormMsg({
          type: "success",
          text: res?.message || `Deposit request for ${format(amtKES)} submitted successfully! Please trigger administrative approval in the Admin Hub.`,
        });
        setDepAmount("");
        setDepNote("");
        onRefresh();
      }
    } catch (err: any) {
      setFormMsg({ type: "error", text: err.message || "Failed to trigger M-Pesa push." });
    } finally {
      setDepLoading(false);
    }
  };

  const handleCryptoDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    setActiveCryptoInvoice(null);

    const typedAmt = Number(depAmount);
    if (!typedAmt || typedAmt <= 0) {
      setFormMsg({ type: "error", text: "Please enter a valid deposit amount." });
      return;
    }

    const amtKES = convertToKES(typedAmt);

    if (amtKES < 100) {
      setFormMsg({ type: "error", text: `Minimum deposit is ${format(100)} (approx 100 KSh).` });
      return;
    }

    setDepLoading(true);
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
          note: depNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate cryptocurrency invoice.");
      }

      setActiveCryptoInvoice({
        ...data.paymentDetails,
        txId: data.transaction.id,
      });

      setFormMsg({
        type: "success",
        text: `Crypto checkout invoice generated successfully! Please execute payment transfers corresponding to details below.`,
      });
      setDepAmount("");
      setDepNote("");
      onRefresh();
    } catch (err: any) {
      setFormMsg({ type: "error", text: err.message || "Payment Gateway failed to respond." });
    } finally {
      setDepLoading(false);
    }
  };

  const simulateSandboxClear = async (txId: string) => {
    setSimulatingClear(true);
    try {
      const res = await fetch(`/api/transactions/${txId}/simulate-sandbox-clear`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Blockchain transaction successfully cleared!");
        setActiveCryptoInvoice(null);
        setFormMsg({
          type: "success",
          text: "🎉 Cryptopayment approved and credited immediately under sandbox fast-clear simulation! Check your terminal balance.",
        });
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

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const typedAmt = Number(withAmount);
    if (!typedAmt || typedAmt <= 0) {
      setFormMsg({ type: "error", text: "Please enter a valid withdrawal amount." });
      return;
    }

    const amtKES = convertToKES(typedAmt);

    if (balance && amtKES > balance.available_balance) {
      setFormMsg({ type: "error", text: "Withdrawal amount exceeds your available balance." });
      return;
    }

    if (amtKES < 50) {
      setFormMsg({ type: "error", text: `Minimum withdraw is ${format(50)} (approx 50 KSh).` });
      return;
    }

    let targetDestination = withPhone;
    let targetNoteText = withNote;

    if (withdrawMethod === "crypto") {
      if (!withCryptoAddress) {
        setFormMsg({ type: "error", text: "Please provide a valid cryptocurrency wallet receive address." });
        return;
      }
      targetDestination = `Crypto (${withCryptoCurrency.toUpperCase()})`;
      targetNoteText = withNote || `Crypto withdrawal payout of ${withCryptoCurrency.toUpperCase()} to address: ${withCryptoAddress}`;
    } else {
      if (!withPhone) {
        setFormMsg({ type: "error", text: "Please provide a valid cash-out phone number." });
        return;
      }
    }

    setWithLoading(true);
    try {
      const res = await onWithdraw(amtKES, targetDestination, targetNoteText);
      if (res && res.error) {
        setFormMsg({ type: "error", text: res.error });
      } else {
        setFormMsg({
          type: "success",
          text: `Withdrawal request for ${format(amtKES)} captured successfully! Standard administrator audit applies pending final disbursement.`,
        });
        setWithAmount("");
        setWithNote("");
        setWithCryptoAddress("");
        onRefresh();
      }
    } catch (err: any) {
      setFormMsg({ type: "error", text: err.message || "Failed to submit cash-out." });
    } finally {
      setWithLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Deposit address copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Wallet className="h-5 w-5 text-emerald-400" />
          Hela Wallet & Transaction Manager
        </h2>
        <p className="text-xs text-slate-400">
          Fund your digital investment simulator or cash-out earnings cleanly. The system supports live local M-Pesa pushes & global cryptocurrency transfers.
        </p>
      </div>

      {formMsg && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold leading-relaxed flex items-start gap-3 transition-colors ${
            formMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-red-500/10 border-red-500/20 text-red-350"
          }`}
        >
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <div>{formMsg.text}</div>
        </div>
      )}

      {/* Selector tab bar */}
      <div className="border-b border-[#212a3d] flex gap-2 pt-1">
        <button
          onClick={() => {
            setActiveSubTab("deposit");
            setFormMsg(null);
          }}
          className={`pb-3 px-1 text-xs font-bold tracking-wider relative transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "deposit" ? "text-emerald-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ArrowDownCircle className="h-4.5 w-4.5" />
          Deposit Funds
          {activeSubTab === "deposit" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full"></div>}
        </button>

        <button
          onClick={() => {
            setActiveSubTab("withdraw");
            setFormMsg(null);
          }}
          className={`pb-3 px-1 text-xs font-bold tracking-wider relative transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "withdraw" ? "text-red-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ArrowUpCircle className="h-4.5 w-4.5" />
          Withdraw Earnings
          {activeSubTab === "withdraw" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400 rounded-full"></div>}
        </button>

        <button
          onClick={() => {
            setActiveSubTab("history");
            setFormMsg(null);
          }}
          className={`pb-3 px-1 text-xs font-bold tracking-wider relative transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "history" ? "text-teal-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <History className="h-4.5 w-4.5" />
          Transaction Ledger
          {activeSubTab === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400 rounded-full"></div>}
        </button>
      </div>

      {/* Forms Area / Tab content switcher */}
      {activeSubTab === "deposit" && (
        <div className="space-y-6">
          {/* Payment Gateway Toggle Switch in Client (Visible only when both are enabled) */}
          <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="text-left">
              <span className="text-xs font-bold text-slate-200 block">Select Deposition Source Channel</span>
              <span className="text-[10px] text-slate-400">Choose between immediate Safaricom STK Push or Instant Crypto Invoice</span>
            </div>
            <div className="flex gap-2 p-1 bg-[#0c0f16] border border-[#212a3d] rounded-xl w-full sm:w-auto">
              <button
                onClick={() => {
                  if (paymentSettings.mpesa_enabled) {
                    setDepositMethod("mpesa");
                    setActiveCryptoInvoice(null);
                    setFormMsg(null);
                  } else {
                    toast.error("M-Pesa deposits are currently disabled by the administrator.");
                  }
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex-1 sm:flex-initial transition-all whitespace-nowrap cursor-pointer ${
                  !paymentSettings.mpesa_enabled
                    ? "opacity-30 cursor-not-allowed text-slate-500"
                    : depositMethod === "mpesa"
                    ? "bg-[#006B4A] text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-250 hover:bg-slate-800/40"
                }`}
              >
                M-Pesa (Mobile)
              </button>
              <button
                onClick={() => {
                  if (paymentSettings.crypto_enabled) {
                    setDepositMethod("crypto");
                    setActiveCryptoInvoice(null);
                    setFormMsg(null);
                  } else {
                    toast.error("Cryptocurrency deposits are currently deactivated by the administrator.");
                  }
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex-1 sm:flex-initial transition-all whitespace-nowrap cursor-pointer ${
                  !paymentSettings.crypto_enabled
                    ? "opacity-30 cursor-not-allowed text-slate-500"
                    : depositMethod === "crypto"
                    ? "bg-slate-800 text-emerald-400 shadow-sm border border-emerald-500/10"
                    : "text-slate-400 hover:text-slate-250 hover:bg-slate-800/40"
                }`}
              >
                Crypto (PAYNOW / NOWPayments)
              </button>
            </div>
          </div>

          <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative overflow-hidden">
            {/* Info Strip (M-Pesa variant) */}
            {depositMethod === "mpesa" && (
              <div className="md:col-span-5 space-y-4">
                <div className="bg-[#0c0f16]/90 border border-emerald-500/10 p-5 rounded-2xl space-y-3.5 leading-relaxed font-semibold">
                  <h3 className="text-xs font-extrabold uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                    <Sparkles className="h-4 w-4" />
                    M-PESA DEPOSIT WINDOW
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    To acquire digital credit on your account, supply your mobile transaction phone number. 
                  </p>
                  <div className="border-t border-[#212a3d] pt-3 flex flex-col gap-1.5 text-[10px] text-slate-500 font-mono">
                    <p>• Minimum Deposit: <span className="text-white font-bold">{format(100)}</span></p>
                    <p>• Charge Rates: <span className="text-emerald-400 font-bold">0% FREE</span></p>
                    <p>• Approval: <span className="text-slate-300">Requires review in Admin Hub tab to clear simulation ledger!</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* Info Strip (Crypto variant) */}
            {depositMethod === "crypto" && (
              <div className="md:col-span-4 space-y-4">
                <div className="bg-[#0c0f16]/90 border border-[#212a3d] p-5 rounded-2xl space-y-3.5 leading-relaxed font-semibold">
                  <h3 className="text-xs font-extrabold uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                    <Coins className="h-4 w-4" />
                    NOWPAYMENTS ENGINE
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Pay securely using global cryptocurrencies. Choose your currency network and a distinct invoice prompt address will be generated.
                  </p>
                  <div className="border-t border-[#212a3d] pt-3 flex flex-col gap-1.5 text-[10px] text-slate-500 font-mono">
                    <p>• Exchange base: <span className="text-white">1 USD = 130 KES</span></p>
                    <p>• Minimum Deposit: <span className="text-indigo-400 font-bold">{format(100)}</span></p>
                    <p>• Network Fee: <span className="text-emerald-500 font-black">0% FREE</span></p>
                    <p>• Target URL: <span className="text-slate-400 underline">account.nowpayments.io</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* Form Fields for M-Pesa */}
            {depositMethod === "mpesa" && (
              <form onSubmit={handleDepositSubmit} className="md:col-span-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                      Deposit Amount ({symbol}) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 font-bold">{symbol}</span>
                      <input
                        type="number"
                        placeholder="e.g. 50"
                        required
                        min="1"
                        value={depAmount}
                        onChange={(e) => setDepAmount(e.target.value)}
                        className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-[#006B4A]/60 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-slate-200 outline-none"
                      />
                    </div>
                    {depAmount && (
                      <span className="text-[10.5px] text-slate-500 font-mono mt-1.5 block">
                        Equivalent to KSh {convertToKES(Number(depAmount)).toLocaleString()} base
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                      M-Pesa Phone Number *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 0712345678"
                      required
                      maxLength={10}
                      pattern="\d{10}"
                      title="Phone number must be exactly 10 digits"
                      value={depPhone}
                      onChange={(e) => setDepPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-[#006B4A]/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-200 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                    Optional Memo Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Personal Topup / Investment seed"
                    value={depNote}
                    onChange={(e) => setDepNote(e.target.value)}
                    className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-[#006B4A]/60 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-200 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={depLoading || !depPhone || !depAmount}
                  className={`px-6 py-3 w-full rounded-xl flex justify-center items-center gap-2 font-bold text-xs transition-transform duration-200 cursor-pointer shadow-md ${!depPhone || !depAmount ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-[#006B4A] hover:bg-[#005238] text-white active:scale-[0.99]"}`}
                >
                  {depLoading ? (
                    <span className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Initiate STK Push Deposit
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center text-slate-500">Wait for the simulated M-Pesa prompt and input PIN, then navigate to Admin Hub to approve.</p>
              </form>
            )}

            {/* Form Fields for Crypto (Using new modular component!) */}
            {depositMethod === "crypto" && (
              <div className="md:col-span-8">
                <CryptoDeposit onRefresh={onRefresh} />
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === "withdraw" && (
        <div className="space-y-6">
          {/* Withdrawal Mode Selection Slider */}
          <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="text-left font-sans">
              <span className="text-xs font-bold text-slate-200 block">Select Withdrawal Payout Channel</span>
              <span className="text-[10px] text-slate-400">Choose between mobile fiat disbursement or cryptocurrency destination transfer</span>
            </div>
            <div className="flex gap-2 p-1 bg-[#0c0f16] border border-[#212a3d] rounded-xl w-full sm:w-auto font-sans">
              <button
                type="button"
                onClick={() => setWithdrawMethod("mpesa")}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex-1 sm:flex-initial transition-all whitespace-nowrap cursor-pointer ${
                  withdrawMethod === "mpesa"
                    ? "bg-[#006B4A] text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-250 hover:bg-slate-800/40"
                }`}
              >
                M-Pesa (Mobile Cashout)
              </button>
              <button
                type="button"
                onClick={() => setWithdrawMethod("crypto")}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex-1 sm:flex-initial transition-all whitespace-nowrap cursor-pointer ${
                  withdrawMethod === "crypto"
                    ? "bg-slate-850 text-red-400 shadow-sm border border-red-500/10"
                    : "text-slate-400 hover:text-slate-250 hover:bg-slate-800/40"
                }`}
              >
                Crypto (NOWPayments Mode)
              </button>
            </div>
          </div>

          <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative overflow-hidden">
            {/* Withdrawal limits and warning details */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-[#0c0f16]/90 border border-slate-800 p-5 rounded-2xl space-y-3.5 leading-relaxed font-semibold">
                <h3 className="text-xs font-extrabold uppercase text-red-400 tracking-wider flex items-center gap-1">
                  <ArrowUpCircle className="h-4.5 w-4.5" />
                  CASH OUT DETAILS
                </h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {withdrawMethod === "crypto" 
                    ? "Retrieve your earnings straight to your custom cryptocurrency wallet. Conversion rates are mapped automatically to base network coordinates." 
                    : "Standard mobile money clearance. Transactions will be processed and pushed directly onto your registered phone code."}
                </p>
                <div className="bg-slate-900 border border-[#212a3d] p-3 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wide">Available Cash balance</span>
                  <span className="text-base font-black text-rose-400 font-mono mt-1 block">
                    {balance ? format(balance.available_balance) : "0"}
                  </span>
                </div>
                {withdrawMethod === "crypto" && (
                  <div className="text-[10px] text-slate-500 font-mono leading-relaxed pt-2 border-t border-[#212a3d]/50">
                    <span>Note: Fast sandbox approvals instantly honor trade operations without real cryptocurrency gas fees or mining delays.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Form fields */}
            <form onSubmit={handleWithdrawalSubmit} className="md:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Withdrawn Amount ({symbol}) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 font-bold">{symbol}</span>
                    <input
                      type="number"
                      placeholder="e.g. 15"
                      required
                      min="1"
                      value={withAmount}
                      onChange={(e) => setWithAmount(e.target.value)}
                      className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/50 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-slate-200 outline-none"
                    />
                  </div>
                  {withAmount && (
                    <span className="text-[10.5px] text-rose-400 font-mono mt-1.5 block">
                      Equivalent to KSh {convertToKES(Number(withAmount)).toLocaleString()} base
                    </span>
                  )}
                </div>

                {withdrawMethod === "mpesa" ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      M-Pesa Phone Number *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 0712345678"
                      required={withdrawMethod === "mpesa"}
                      value={withPhone}
                      onChange={(e) => setWithPhone(e.target.value)}
                      className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/50 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-200 outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Target Crypto Coin *
                    </label>
                    <select
                      value={withCryptoCurrency}
                      onChange={(e) => setWithCryptoCurrency(e.target.value)}
                      className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/50 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-200 outline-none cursor-pointer"
                    >
                      <option value="USDTTRC20">USDT (TRC-20 Network)</option>
                      <option value="BTC">BTC (Bitcoin Mainnet)</option>
                      <option value="ETH">ETH (Ethereum ERC-20)</option>
                      <option value="USDC">USDC (USD Coin)</option>
                    </select>
                  </div>
                )}
              </div>

              {withdrawMethod === "crypto" && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Recipient Crypto Wallet Destination Address *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter TRC-20, ERC-20, or BTC wallet address"
                    required={withdrawMethod === "crypto"}
                    value={withCryptoAddress}
                    onChange={(e) => setWithCryptoAddress(e.target.value)}
                    className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/50 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-mono outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Optional Memo Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Portfolio withdrawal payout"
                  value={withNote}
                  onChange={(e) => setWithNote(e.target.value)}
                  className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/50 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-200 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={withLoading}
                className="px-6 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition-transform duration-200 active:scale-[0.99] w-full justify-center"
              >
                {withLoading ? (
                  <span className="h-4.5 w-4.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <ArrowUpCircle className="h-4.5 w-4.5" />
                    Initiate {withdrawMethod === "crypto" ? "Crypto" : "Wallet"} Withdrawal
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeSubTab === "history" && (
        <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl overflow-hidden shadow-sm">
          {transactions.length === 0 ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
              <History className="h-10 w-10 text-slate-600 mb-2" />
              <h4 className="text-sm font-bold text-slate-350">Chronology is empty</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                No financial history matches your session ledger yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0c0f16] text-slate-400 text-[9px] font-bold uppercase tracking-wider border-b border-[#212a3d]">
                    <th className="p-4 font-semibold">Date / Time</th>
                    <th className="p-4 font-semibold">Type</th>
                    <th className="p-4 font-semibold">Description</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Amount ({activeCurrency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#212a3d]/50">
                  {transactions.map((tx) => {
                    // Badge styles
                    let badgeClass = "bg-yellow-500/10 text-yellow-400 border-yellow-500/15";
                    let StatusIcon = Clock;
                    if (tx.status === "approved") {
                      badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                      StatusIcon = CheckCircle2;
                    } else if (tx.status === "declined") {
                      badgeClass = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                      StatusIcon = XCircle;
                    }

                    // Ledger icons / color prefixes
                    let sign = "";
                    let amountClass = "text-slate-300";
                    let TypeIcon = Coins;
                    if (tx.transaction_type === "deposit") {
                      sign = "+";
                      amountClass = "text-emerald-400 font-extrabold";
                      TypeIcon = ArrowDownCircle;
                    } else if (tx.transaction_type === "commission") {
                      sign = "+";
                      amountClass = "text-emerald-400 font-extrabold";
                      TypeIcon = Coins;
                    } else if (tx.transaction_type === "payout") {
                      sign = "+";
                      amountClass = "text-emerald-400 font-extrabold";
                      TypeIcon = CheckCircle2;
                    } else if (tx.transaction_type === "withdrawal") {
                      sign = "-";
                      amountClass = "text-rose-400 font-bold";
                      TypeIcon = ArrowUpCircle;
                    } else if (tx.transaction_type === "investment") {
                      sign = "-";
                      amountClass = "text-slate-300 font-semibold";
                      TypeIcon = ListTodo;
                    }

                    return (
                      <tr key={tx.id} className="hover:bg-[#121824]/40 transition-colors">
                        <td className="p-4 font-medium font-mono text-slate-400 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleDateString()}{" "}
                          <span className="text-[10px] text-slate-500">
                            {new Date(tx.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="text-xs font-bold text-slate-200 capitalize flex items-center gap-1.5">
                            <TypeIcon className="h-4 w-4 text-slate-400 shrink-0" />
                            {tx.transaction_type === "commission" ? "Referral Bonus" : tx.transaction_type}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 max-w-[200px] truncate">
                          <span className="font-medium text-slate-300">{tx.note || "HelaVest Transfer"}</span>
                          {tx.phone && <span className="block text-[10px] text-slate-500 font-mono">{tx.phone.includes('Crypto') ? 'Invoice' : 'Mobile'}: {tx.phone}</span>}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span
                             className={`px-2 py-0.5 rounded-full border text-[10px] uppercase font-bold tracking-wider inline-flex items-center gap-1 ${badgeClass}`}
                          >
                            <StatusIcon className="h-3 w-3 shrink-0" />
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <span className={`font-mono text-xs font-bold ${amountClass}`}>
                            {sign}{format(tx.amount)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
