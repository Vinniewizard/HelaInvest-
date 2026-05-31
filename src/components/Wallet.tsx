import React, { useState } from "react";
import { Wallet, ArrowDownCircle, ArrowUpCircle, History, Coins, ListTodo, ShieldAlert, CheckCircle2, XCircle, Clock, Sparkles } from "lucide-react";
import { Transaction, WalletBalance } from "../types";

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
  const [activeSubTab, setActiveSubTab] = useState<"deposit" | "withdraw" | "history">("deposit");

  // Deposit Form
  const [depAmount, setDepAmount] = useState("");
  const [depPhone, setDepPhone] = useState(phone);
  const [depNote, setDepNote] = useState("");
  const [depLoading, setDepLoading] = useState(false);

  // Withdrawal Form
  const [withAmount, setWithAmount] = useState("");
  const [withPhone, setWithPhone] = useState(phone);
  const [withNote, setWithNote] = useState("");
  const [withLoading, setWithLoading] = useState(false);

  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const amt = Number(depAmount);
    if (!amt || amt <= 0) {
      setFormMsg({ type: "error", text: "Please enter a valid deposit amount." });
      return;
    }

    if (!depPhone) {
      setFormMsg({ type: "error", text: "Please enter a phone number to trigger the top-up." });
      return;
    }

    setDepLoading(true);
    try {
      const res = await onDeposit(amt, depPhone, depNote);
      if (res && res.error) {
        setFormMsg({ type: "error", text: res.error });
      } else {
        setFormMsg({
          type: "success",
          text: res?.message || `Deposit request for KSh ${amt.toLocaleString()} submitted successfully! Please trigger administrative approval in the Admin Hub.`,
        });
        setDepAmount("");
        setDepNote("");
        onRefresh();
      }
    } catch (err: any) {
      setFormMsg({ type: "error", text: err.message || "Failed to trigger top-up." });
    } finally {
      setDepLoading(false);
    }
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const amt = Number(withAmount);
    if (!amt || amt <= 0) {
      setFormMsg({ type: "error", text: "Please enter a valid withdrawal amount." });
      return;
    }

    if (!withPhone) {
      setFormMsg({ type: "error", text: "Please provide a valid cash-out phone number." });
      return;
    }

    if (balance && amt > balance.available_balance) {
      setFormMsg({ type: "error", text: "Withdrawal amount exceeds your available balance." });
      return;
    }

    setWithLoading(true);
    try {
      const res = await onWithdraw(amt, withPhone, withNote);
      if (res && res.error) {
        setFormMsg({ type: "error", text: res.error });
      } else {
        setFormMsg({
          type: "success",
          text: `Withdrawal request for KSh ${amt.toLocaleString()} captured! Standard administrator review holds pending approval.`,
        });
        setWithAmount("");
        setWithNote("");
        onRefresh();
      }
    } catch (err: any) {
      setFormMsg({ type: "error", text: err.message || "Failed to submit cash-out." });
    } finally {
      setWithLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Wallet className="h-5 w-5 text-emerald-400" />
          Hela Wallet & Transaction Manager
        </h2>
        <p className="text-xs text-slate-400">
          Fund your digital investment simulator or cash-out earnings cleanly. All transfers follow local M-Pesa standard processing loops.
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
          Deposit Funds (M-Pesa)
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
        <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative overflow-hidden">
          {/* M-Pesa Info Strip */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-[#0c0f16]/90 border border-emerald-500/10 p-5 rounded-2xl space-y-3.5 leading-relaxed font-semibold">
              <h3 className="text-xs font-extrabold uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                M-PESA SIMULATION STAGE
              </h3>
              <p className="text-[11px] text-slate-400">
                To emulate standard Safaricom STK Push mechanisms, fill out the trigger form on the right. 
              </p>
              <div className="border-t border-[#212a3d] pt-3 flex flex-col gap-1.5 text-[10px] text-slate-500 font-mono">
                <p>• Minimun Deposit: <span className="text-white font-bold">KSh 100</span></p>
                <p>• Charge Rates: <span className="text-emerald-400 font-bold">0% FREE</span></p>
                <p>• Step 1: Submit deposit form</p>
                <p>• Step 2: Open <span className="text-emerald-400 font-bold">Admin Hub</span> tab to "Approve" request simulating verified fund arrival!</p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <form onSubmit={handleDepositSubmit} className="md:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Deposit Amount (KSh) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  required
                  min="100"
                  value={depAmount}
                  onChange={(e) => setDepAmount(e.target.value)}
                  className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-200 outline-none"
                />
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
                  className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-200 outline-none"
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
                className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-200 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={depLoading || !depPhone || !depAmount}
              className={`px-6 py-3 w-full rounded-xl flex justify-center items-center gap-2 font-bold text-xs transition-transform duration-200 cursor-pointer shadow-md ${!depPhone || !depAmount ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-[0.99] shadow-emerald-950/20"}`}
            >
              {depLoading ? (
                <span className="h-4.5 w-4.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Initiate STK Push Deposit
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-500">Wait for the M-Pesa prompt on your phone and enter your PIN, then an Admin will confirm it.</p>
          </form>
        </div>
      )}

      {activeSubTab === "withdraw" && (
        <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative overflow-hidden">
          {/* Withdrawal limits and warning details */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-[#0c0f16]/90 border border-slate-800 p-5 rounded-2xl space-y-3.5 leading-relaxed font-semibold">
              <h3 className="text-xs font-extrabold uppercase text-red-400 tracking-wider flex items-center gap-1">
                <ArrowUpCircle className="h-4.5 w-4.5" />
                CASH OUT DETAILS
              </h3>
              <p className="text-[11px] text-slate-400">
                You can cash-out your available balance to M-Pesa. Standard verification audits require manager approval before release.
              </p>
              <div className="bg-slate-900 border border-[#212a3d] p-3 rounded-xl text-center">
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wide">Available Cash balance</span>
                <span className="text-base font-black text-rose-400 font-mono mt-1 block">
                  KSh {balance ? balance.available_balance.toLocaleString() : "0"}
                </span>
              </div>
            </div>
          </div>

          {/* Form fields */}
          <form onSubmit={handleWithdrawalSubmit} className="md:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Withdrawn Amount (KSh) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  required
                  min="50"
                  value={withAmount}
                  onChange={(e) => setWithAmount(e.target.value)}
                  className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/50 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  M-Pesa Phone Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0712345678"
                  required
                  value={withPhone}
                  onChange={(e) => setWithPhone(e.target.value)}
                  className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/50 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-200 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                Optional Memo Note
              </label>
              <input
                type="text"
                placeholder="e.g. School fees / Personal payout"
                value={withNote}
                onChange={(e) => setWithNote(e.target.value)}
                className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/50 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-200 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={withLoading}
              className="px-6 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition-transform duration-200 active:scale-[0.99]"
            >
              {withLoading ? (
                <span className="h-4.5 w-4.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <ArrowUpCircle className="h-4.5 w-4.5" />
                  Initiate KSh Withdrawal
                </>
              )}
            </button>
          </form>
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
                    <th className="p-4 font-semibold text-right">Amount (KSh)</th>
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
                        <td className="p-4 font-medium font-mono text-slate-450 whitespace-nowrap">
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
                          {tx.phone && <span className="block text-[10px] text-slate-500 font-mono">Mobile: {tx.phone}</span>}
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
                            {sign}KSh {tx.amount.toLocaleString()}
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
