import React, { useState, useEffect } from "react";
import { Wallet, ArrowDownCircle, ArrowUpCircle, History, Coins, ListTodo, ShieldAlert, CheckCircle2, XCircle, Clock, Sparkles, Copy, RefreshCw, Check, QrCode, Smartphone, Info, Shield, CheckCircle, ChevronRight } from "lucide-react";
import { Transaction, WalletBalance } from "../types";
import { useCurrency } from "../context/CurrencyContext";
import { toast } from "sonner";
import CryptoDeposit from "./CryptoDeposit";

interface WalletProps {
  balance: WalletBalance | null;
  transactions: Transaction[];
  phone: string;
  onDeposit: (amount: number, phone: string, note: string) => Promise<any>;
  onWithdraw: (amount: number, phone: string, note: string, cryptoAddress?: string, cryptoCurrency?: string) => Promise<any>;
  onRefresh: () => void;
  activeSubTab?: "deposit" | "withdraw" | "history";
  setActiveSubTab?: (tab: "deposit" | "withdraw" | "history") => void;
}

export default function WalletComponent({
  balance,
  transactions,
  phone,
  onDeposit,
  onWithdraw,
  onRefresh,
  activeSubTab: propActiveSubTab,
  setActiveSubTab: propSetActiveSubTab,
}: WalletProps) {
  const { format, convertToKES, convertFromKES, symbol, activeCurrency } = useCurrency();
  const [localActiveSubTab, setLocalActiveSubTab] = useState<"deposit" | "withdraw" | "history">("deposit");

  const activeSubTab = propActiveSubTab ?? localActiveSubTab;
  const setActiveSubTab = propSetActiveSubTab ?? setLocalActiveSubTab;

  // Gateway Settings cached dynamically
  const [paymentSettings, setPaymentSettings] = useState({
    mpesa_enabled: true,
    crypto_enabled: true,
    nowpayments_sandbox: false,
    min_deposit: undefined as number | undefined,
    max_deposit: undefined as number | undefined
  });

  const [depositMethod, setDepositMethod] = useState<"mpesa" | "crypto">("mpesa");

  // Deposit Form
  const [depAmount, setDepAmount] = useState("");
  const [depPhone, setDepPhone] = useState(phone);
  const [depNote, setDepNote] = useState("");
  const [depLoading, setDepLoading] = useState(false);

  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [cancellingTxId, setCancellingTxId] = useState<string | null>(null);

  const handleCancelPendingDeposit = async (txId: string) => {
    setCancellingTxId(txId);
    try {
      const res = await fetch("/api/transactions/cancel-pending-deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": localStorage.getItem("hela_user_id") || "",
        },
        body: JSON.stringify({ txId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Pending deposit cancelled successfully.");
        setFormMsg(null);
        onRefresh();
      } else {
        toast.error(data.error || "Failed to cancel pending deposit.");
      }
    } catch (e) {
      toast.error("Network communication error.");
    } finally {
      setCancellingTxId(null);
    }
  };

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

    // Enforce dynamic administrative limits if set
    if (paymentSettings.min_deposit !== undefined && paymentSettings.min_deposit !== null && paymentSettings.min_deposit > 0) {
      if (amtKES < paymentSettings.min_deposit) {
        setFormMsg({
          type: "error",
          text: `Selected deposit is below the administrative limit of ${format(paymentSettings.min_deposit)} (KSh ${paymentSettings.min_deposit.toLocaleString()}).`
        });
        return;
      }
    } else {
      // Default fallback minimum
      if (amtKES < 100) {
        setFormMsg({ type: "error", text: `Minimum deposit is ${format(100)} (${activeCurrency === 'KES' ? '' : 'approx '}100 KSh).` });
        return;
      }
    }

    if (paymentSettings.max_deposit !== undefined && paymentSettings.max_deposit !== null && paymentSettings.max_deposit > 0) {
      if (amtKES > paymentSettings.max_deposit) {
        setFormMsg({
          type: "error",
          text: `Selected deposit exceeds the administrative maximum of ${format(paymentSettings.max_deposit)} (KSh ${paymentSettings.max_deposit.toLocaleString()}).`
        });
        return;
      }
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

  // Withdrawal Form
  const [withAmount, setWithAmount] = useState("");
  const [withPhone, setWithPhone] = useState(phone);
  const [withNote, setWithNote] = useState("");
  const [withLoading, setWithLoading] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<"mpesa" | "crypto">("mpesa");
  const [withCryptoCurrency, setWithCryptoCurrency] = useState<string>("USDTTRC20");
  const [withCryptoAddress, setWithCryptoAddress] = useState("");

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
      const res = await onWithdraw(
        amtKES,
        targetDestination,
        targetNoteText,
        withdrawMethod === "crypto" ? withCryptoAddress : undefined,
        withdrawMethod === "crypto" ? withCryptoCurrency : undefined
      );
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

  return (
    <div className="space-y-8">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#eafaf1] p-2.5 rounded-xl border border-emerald-100">
              <Wallet className="h-6 w-6 text-[#006B4A]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#006B4A] tracking-tight">
                Account & Ledger Management
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Fund your live trading simulator or request secure payouts.
              </p>
            </div>
          </div>
        </div>

        {/* Available balance summary in account header */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col items-start min-w-[200px] w-full md:w-auto relative overflow-hidden shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">AVAILABLE BALANCE</span>
          <span className="text-2xl font-black text-[#006B4A] tracking-tight mt-1">
            {balance ? format(balance.available_balance) : "..."}
          </span>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <Coins className="h-20 w-20 text-[#006B4A]" />
          </div>
        </div>
      </div>

      {formMsg && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold leading-relaxed flex items-start gap-3 transition-all ${
            formMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>{formMsg.text}</div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="bg-white border border-slate-200 p-1 rounded-xl flex shadow-sm">
        <button
          onClick={() => {
            setActiveSubTab("deposit");
            setFormMsg(null);
          }}
          className={`flex-1 py-3 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === "deposit"
              ? "bg-[#006B4A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <ArrowDownCircle className="h-4 w-4" />
          Deposit Capital
        </button>

        <button
          onClick={() => {
            setActiveSubTab("withdraw");
            setFormMsg(null);
          }}
          className={`flex-1 py-3 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === "withdraw"
              ? "bg-rose-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
          }`}
        >
          <ArrowUpCircle className="h-4 w-4" />
          Request Payout
        </button>

        <button
          onClick={() => {
            setActiveSubTab("history");
            setFormMsg(null);
          }}
          className={`flex-1 py-3 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === "history"
              ? "bg-slate-800 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <History className="h-4 w-4" />
          Security Ledger
        </button>
      </div>

      {/* Deposit Layout */}
      {activeSubTab === "deposit" && (
        <div className="space-y-6">
          {(() => {
            const activePendingDeposit = transactions.find(
              (t) => t.transaction_type === "deposit" && t.status === "pending"
            );
            if (!activePendingDeposit) return null;

            return (
              <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl space-y-3.5 shadow-sm animate-fade-in text-slate-800">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="flex items-start gap-3">
                    <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-700 shrink-0">
                      <Clock className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                        Active Pending Deposit Lockout Protection
                      </h4>
                      <p className="text-[11px] text-amber-800 font-medium leading-relaxed mt-1.5">
                        You have an unresolved deposit transaction for <strong className="text-amber-950 font-extrabold">{format(activePendingDeposit.amount)}</strong> initiated on{" "}
                        <span className="font-mono text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded font-bold">
                          {new Date(activePendingDeposit.created_at).toLocaleDateString()}{" "}
                          {new Date(activePendingDeposit.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>{" "}
                        ({activePendingDeposit.phone || "Universal core channel"}).
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCancelPendingDeposit(activePendingDeposit.id)}
                    disabled={!!cancellingTxId}
                    className="bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 font-extrabold text-[10px] text-amber-950 uppercase tracking-wide px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {cancellingTxId === activePendingDeposit.id ? (
                      <span className="h-3.5 w-3.5 border-2 border-amber-900 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-amber-800" />
                        Decline & Release Lock
                      </>
                    )}
                  </button>
                </div>

                <div className="text-[10px] text-amber-800/80 leading-relaxed font-semibold pl-11 border-t border-amber-500/10 pt-2 flex items-center justify-between gap-4">
                  <span>
                    ⚠️ Only one pending deposit transaction may exist on the server to prevent duplicates. Declining this lock clears the pending ledger entry, letting you start fresh immediately!
                  </span>
                  {activePendingDeposit.phone?.includes("Crypto") && (
                    <button
                      type="button"
                      onClick={() => setDepositMethod("crypto")}
                      className="text-[10px] text-[#006B4A] hover:underline font-extrabold uppercase tracking-wider flex items-center gap-0.5 transition-all shrink-0"
                    >
                      View QR Address <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Method chooser */}
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <h4 className="text-sm font-bold text-slate-800">Choose Deposit Route</h4>
              <p className="text-xs text-slate-500 font-medium">Select your preferred payment channel gateway</p>
            </div>

            <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200/80 w-full sm:w-auto">
              <button
                onClick={() => {
                  if (paymentSettings.mpesa_enabled) {
                    setDepositMethod("mpesa");
                    setFormMsg(null);
                  } else {
                    toast.error("M-Pesa deposits are currently deactivated by the administrator.");
                  }
                }}
                className={`py-2 px-4 rounded-md text-xs font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial cursor-pointer ${
                  !paymentSettings.mpesa_enabled
                    ? "opacity-40 cursor-not-allowed text-slate-400"
                    : depositMethod === "mpesa"
                    ? "bg-white text-emerald-800 shadow-sm font-extrabold"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                M-Pesa Mobile
              </button>

              <button
                onClick={() => {
                  if (paymentSettings.crypto_enabled) {
                    setDepositMethod("crypto");
                    setFormMsg(null);
                  } else {
                    toast.error("Cryptocurrency deposits are deactivated by administrator.");
                  }
                }}
                className={`py-2 px-4 rounded-md text-xs font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial cursor-pointer ${
                  !paymentSettings.crypto_enabled
                    ? "opacity-40 cursor-not-allowed text-slate-400"
                    : depositMethod === "crypto"
                    ? "bg-white text-indigo-700 shadow-sm font-extrabold"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                NOWPayments Crypto
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Guide segment */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-extrabold text-[#006B4A] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4.5 w-4.5" />
                  {depositMethod === "mpesa" ? "M-Pesa Express Deposit" : "Global Cryptocurreny Portal"}
                </h3>

                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {depositMethod === "mpesa"
                    ? "Supply your active Safaricom mobile phone details. The payment gateway initiates an instant M-Pesa STK PIN entry box immediately on your handset."
                    : "A secure unique NOWPayments blockchain checkout layout will be initialized. Safely dispatch token transfers directly to the verified network coordinates."}
                </p>

                <div className="border-t border-slate-100 pt-4 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold">Minimum Capital:</span>
                    <span className="text-[#006B4A] font-extrabold">
                      {paymentSettings.min_deposit !== undefined && paymentSettings.min_deposit !== null && paymentSettings.min_deposit > 0 ? (
                        `${format(paymentSettings.min_deposit)} (~${paymentSettings.min_deposit.toLocaleString()} KSh)`
                      ) : (
                        `${format(100)} (~100 KSh)`
                      )}
                    </span>
                  </div>
                  {paymentSettings.max_deposit !== undefined && paymentSettings.max_deposit !== null && paymentSettings.max_deposit > 0 && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-semibold">Maximum Cap:</span>
                      <span className="text-rose-600 font-extrabold">
                        {format(paymentSettings.max_deposit)} (~{paymentSettings.max_deposit.toLocaleString()} KSh)
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold">Processing Fee:</span>
                    <span className="text-emerald-600 font-extrabold">0% FREE</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold">Exchange Rate:</span>
                    <span className="font-mono text-slate-700 font-semibold">1 USD = 130 KES</span>
                  </div>
                </div>

                <div className="bg-[#f0f9f6] border border-[#d2edd5] p-3.5 rounded-xl flex items-start gap-2.5">
                  <ShieldAndAlertIcon className="h-4 w-4 text-[#006B4A] shrink-0 mt-0.5" />
                  <span className="text-[10.5px] text-[#005a3e] font-semibold leading-relaxed">
                    Once payment reaches blockchain confirmation or mobile success, balance shifts automatically. Safely monitor status right below.
                  </span>
                </div>
              </div>
            </div>

            {/* Form variant */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              {depositMethod === "mpesa" ? (
                <form onSubmit={handleDepositSubmit} className="space-y-5">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Deposit Capital Amount ({symbol}) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-3 text-sm text-slate-400 font-bold">{symbol}</span>
                        <input
                          type="number"
                          placeholder="e.g. 100"
                          required
                          min="1"
                          value={depAmount}
                          onChange={(e) => setDepAmount(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-[#006B4A] focus:bg-white rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 font-bold outline-none transition-all"
                        />
                      </div>
                      {depAmount && (
                        <span className="text-[10.5px] text-[#006B4A] font-semibold mt-1.5 block">
                          Mapped to KSh {convertToKES(Number(depAmount)).toLocaleString()} transaction base value
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#006B4A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5" /> M-Pesa Phone Number *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 0712345678"
                        required
                        maxLength={10}
                        pattern="\d{10}"
                        title="Phone number must be exactly 10 digits starting with 07/01"
                        value={depPhone}
                        onChange={(e) => setDepPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#006B4A] focus:bg-white rounded-xl px-4 py-2.5 text-xs text-slate-800 font-mono font-bold outline-none transition-all"
                      />
                      <span className="text-[9.5px] text-slate-400 block mt-1">Provide the phone linked to your M-Pesa client app</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Memo reference Note
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Trading topup / Deposit"
                        value={depNote}
                        onChange={(e) => setDepNote(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#006B4A] focus:bg-white rounded-xl px-4 py-2.5 text-xs font-medium text-slate-800 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={depLoading || !depPhone || !depAmount}
                    className={`w-full py-3 px-6 rounded-xl font-bold text-xs flex justify-center items-center gap-2 cursor-pointer shadow-md transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                      !depPhone || !depAmount
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/50"
                        : "bg-[#006B4A] text-white hover:bg-[#005238]"
                    }`}
                  >
                    {depLoading ? (
                      <span className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-emerald-300" />
                        Trigger STK Push Notification
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center leading-normal">
                    This M-Pesa transaction is processed live. Standard carrier fees and regulations apply. Please keep your device unlocked to receive the prompt.
                  </p>
                </form>
              ) : (
                <CryptoDeposit 
                  onRefresh={onRefresh} 
                  minDeposit={paymentSettings.min_deposit}
                  maxDeposit={paymentSettings.max_deposit}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal layout */}
      {activeSubTab === "withdraw" && (
        <div className="space-y-6">
          {/* Channel selections */}
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <h4 className="text-sm font-bold text-slate-800">Select Payout Destination</h4>
              <p className="text-xs text-slate-500 font-medium">Select where to disburse trading earnings</p>
            </div>

            <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200/80 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setWithdrawMethod("mpesa")}
                className={`py-2 px-4 rounded-md text-xs font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial cursor-pointer ${
                  withdrawMethod === "mpesa"
                    ? "bg-white text-emerald-800 shadow-sm font-extrabold"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                M-Pesa Payout
              </button>

              <button
                type="button"
                onClick={() => setWithdrawMethod("crypto")}
                className={`py-2 px-4 rounded-md text-xs font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial cursor-pointer ${
                  withdrawMethod === "crypto"
                    ? "bg-white text-rose-700 shadow-sm font-extrabold"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Crypto Address
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Guide summary card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-extrabold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpCircle className="h-4.5 w-4.5" />
                  Payout Processing Audit
                </h3>

                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Withdrawal requests undergo real-time ledger auditing. Upon administrative validation, cash is discharged to the target mobile operator or crypto address.
                </p>

                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-rose-800 uppercase font-bold tracking-widest">WITHDRAWABLE AMOUNT</span>
                  <span className="text-2xl font-black text-rose-700 mt-1 font-mono tracking-tight">
                    {balance ? format(balance.available_balance) : "..."}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold">Minimum request:</span>
                    <span className="text-slate-700 font-bold">{format(50)} (~50 KSh)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold">Auditing times:</span>
                    <span className="text-slate-700 font-bold">Standard 10-15 Min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold">Network Mining gas:</span>
                    <span className="text-slate-700 font-mono font-semibold">0% FREE</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form segment */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Withdrawn Amount ({symbol}) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-xs text-slate-400 font-bold">{symbol}</span>
                      <input
                        type="number"
                        placeholder="e.g. 20"
                        required
                        min="1"
                        value={withAmount}
                        onChange={(e) => setWithAmount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                      />
                    </div>
                    {withAmount && (
                      <span className="text-[10px] text-rose-600 font-semibold mt-1.5 block">
                        Est. KSh {convertToKES(Number(withAmount)).toLocaleString()} base
                      </span>
                    )}
                  </div>

                  {withdrawMethod === "mpesa" ? (
                    <div>
                      <label className="block text-[10px] font-bold text-[#006B4A] uppercase tracking-wider mb-2">
                        Receiver Phone Number *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 0712345678"
                        required={withdrawMethod === "mpesa"}
                        value={withPhone}
                        onChange={(e) => setWithPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#006B4A] rounded-xl px-4 py-2.5 text-xs text-slate-800 font-mono font-bold outline-none transition-all"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Receive Coin *
                      </label>
                      <select
                        value={withCryptoCurrency}
                        onChange={(e) => setWithCryptoCurrency(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-bold outline-none cursor-pointer transition-all"
                      >
                        <option value="USDTTRC20">USDT (TRC-20)</option>
                        <option value="BTC">BTC (Bitcoin Mainnet)</option>
                        <option value="ETH">ETH (Ethereum ERC-20)</option>
                        <option value="USDC">USDC (USD Coin Polygon)</option>
                      </select>
                    </div>
                  )}
                </div>

                {withdrawMethod === "crypto" && (
                  <div>
                    <label className="block text-[10px] font-bold text-[#006B4A] uppercase tracking-wider mb-2">
                      Recipient Crypto Wallet Address *
                    </label>
                    <input
                      type="text"
                      placeholder="Enter target TRC-20, ERC-20, or BTC wallet address"
                      required={withdrawMethod === "crypto"}
                      value={withCryptoAddress}
                      onChange={(e) => setWithCryptoAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#006B4A] rounded-xl px-4 py-2.5 text-xs text-slate-800 font-mono outline-none transition-all"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Memo description Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Live withdrawal payload / profits"
                    value={withNote}
                    onChange={(e) => setWithNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#006B4A] rounded-xl px-4 py-2.5 text-xs text-slate-800 font-medium outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={withLoading}
                  className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] w-full justify-center shadow-md"
                >
                  {withLoading ? (
                    <span className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <ArrowUpCircle className="h-4.5 w-4.5 text-rose-200" />
                      Initiate Payout Transfer
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* History Layout (Security Ledger) */}
      {activeSubTab === "history" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 border-b border-slate-100 p-4 shrink-0">
            <h3 className="text-xs font-extrabold text-[#006B4A] uppercase tracking-wider flex items-center gap-1.5">
              <History className="h-4 w-4" />
              Real-Time Security Audit Log
            </h3>
          </div>

          {transactions.length === 0 ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-full mb-3">
                <History className="h-8 w-8 text-slate-400" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Chronology index empty</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                No ledger balance movements reported on your account workspace yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-[9px] font-bold uppercase tracking-wider border-b border-slate-150">
                    <th className="p-4 font-bold">Chronology timestamp</th>
                    <th className="p-4 font-bold">Ledger Type</th>
                    <th className="p-4 font-bold">Transfer reference</th>
                    <th className="p-4 font-bold">Audit Status</th>
                    <th className="p-4 font-bold text-right">Raw Capital Value ({activeCurrency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    // Badge styles
                    let badgeClass = "bg-amber-50 text-amber-800 border-amber-200";
                    let StatusIcon = Clock;
                    if (tx.status === "approved") {
                      badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200";
                      StatusIcon = CheckCircle;
                    } else if (tx.status === "declined") {
                      badgeClass = "bg-rose-50 text-rose-800 border-rose-250";
                      StatusIcon = XCircle;
                    }

                    // Ledger signs
                    let sign = "";
                    let amountClass = "text-slate-700";
                    let TypeIcon = Coins;
                    if (tx.transaction_type === "deposit") {
                      sign = "+";
                      amountClass = "text-emerald-700 font-black";
                      TypeIcon = ArrowDownCircle;
                    } else if (tx.transaction_type === "commission") {
                      sign = "+";
                      amountClass = "text-emerald-700 font-bold";
                      TypeIcon = Coins;
                    } else if (tx.transaction_type === "payout") {
                      sign = "+";
                      amountClass = "text-[#006B4A] font-black";
                      TypeIcon = CheckCircle2;
                    } else if (tx.transaction_type === "withdrawal") {
                      sign = "-";
                      amountClass = "text-rose-600 font-extrabold";
                      TypeIcon = ArrowUpCircle;
                    } else if (tx.transaction_type === "investment") {
                      sign = "-";
                      amountClass = "text-slate-500 font-semibold";
                      TypeIcon = ListTodo;
                    }

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                          {new Date(tx.created_at).toLocaleDateString()}{" "}
                          <span className="text-[10px] text-slate-400">
                            {new Date(tx.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="text-xs font-bold text-slate-700 capitalize flex items-center gap-1.5">
                            <TypeIcon className="h-4 w-4 text-slate-400 shrink-0" />
                            {tx.transaction_type === "commission" ? "Referral Bonus" : tx.transaction_type}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 max-w-[200px] truncate font-medium">
                          <span className="text-slate-700 font-bold block text-xs">{tx.note || "HelaVest Transfer"}</span>
                          {tx.phone && (
                            <span className="text-[9.5px] text-slate-400 font-mono block mt-0.5">
                              {tx.phone.includes("Crypto") ? "Gateway" : "Phone"}: {tx.phone}
                            </span>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[9px] uppercase font-bold tracking-wider inline-flex items-center gap-1 ${badgeClass}`}
                          >
                            <StatusIcon className="h-3 w-3 shrink-0" />
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <span className={`font-mono text-xs font-extrabold ${amountClass}`}>
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

// Minimal placeholder-free local icons
function ShieldAndAlertIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
      />
    </svg>
  );
}
