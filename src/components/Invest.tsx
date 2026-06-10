import React, { useState } from "react";
import { Coins, Flame, Gem, ShieldAlert, Sparkles, TrendingUp, HelpCircle, ArrowRight } from "lucide-react";
import { Plan, WalletBalance } from "../types";
import { useCurrency } from "../context/CurrencyContext";

interface InvestProps {
  plans: Plan[];
  balance: WalletBalance | null;
  onInvest: (planId: string) => Promise<any>;
  onSwitchTab: (tab: string) => void;
}

export default function Invest({ plans, balance, onInvest, onSwitchTab }: InvestProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { format } = useCurrency();

  // Auto-select first plan on load if none selected
  if (!selectedPlan && plans.length > 0) {
    setSelectedPlan(plans[0]);
  }

  const handleInvestSubmit = async (planId: string) => {
    setStatusMsg(null);
    setLoading(planId);

    try {
      const res = await onInvest(planId);
      if (res && res.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: `Successfully initialized ${plans.find((p) => p.id === planId)?.name}! Tracks initialized on My Trades.`,
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: "Deposit failed: " + (err.message || "Insufficient balance") });
    } finally {
      setLoading(null);
    }
  };

  const getTierIcon = (name: string) => {
    if (name.toLowerCase().includes("copper")) return Sparkles;
    if (name.toLowerCase().includes("bronze")) return TrendingUp;
    if (name.toLowerCase().includes("silver")) return Coins;
    if (name.toLowerCase().includes("gold")) return Flame;
    return Gem;
  };

  return (
    <div className="space-y-6">
      {/* Overview Intro */}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold text-white tracking-tight">Active Plan Marketplace</h2>
        <p className="text-xs text-slate-400 max-w-xl">
          Purchase structured investment packages tailored to generate daily yields. Assets automatically maturity-clear to your cash balance.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed font-semibold transition-all ${
            statusMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-red-500/10 border-red-500/20 text-red-300"
          }`}
        >
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <div>{statusMsg.text}</div>
        </div>
      )}

      {/* Main Container: Grid layout split into packages list and the live ROI calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Plans List Column (8 cols) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const Icon = getTierIcon(plan.name);
            const isSelected = selectedPlan?.id === plan.id;
            const profitVal = plan.return_amount - plan.amount;
            const roiPercent = Math.round((profitVal / plan.amount) * 100);

            return (
              <div
                key={plan.id}
                onClick={() => {
                  setSelectedPlan(plan);
                  setStatusMsg(null);
                }}
                className={`bg-[#0f131d] border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 cursor-pointer h-[190px] relative overflow-hidden group ${
                  isSelected
                    ? "border-emerald-500/50 glow-emerald"
                    : "border-[#212a3d]/80 hover:border-slate-600"
                }`}
              >
                {/* Upper row */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-400 transition-colors uppercase tracking-wider">
                      {plan.name}
                    </span>
                    <Icon
                      className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${
                        isSelected ? "text-emerald-400" : "text-slate-500"
                      }`}
                    />
                  </div>
                  <h3 className="text-xl font-extrabold text-white font-mono">
                    {format(plan.amount)}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-medium">
                    {plan.description || "Micro-finance daily compounding yield package."}
                  </p>
                </div>

                {/* Lower row */}
                <div className="flex justify-between items-end border-t border-[#212a3d]/50 pt-3 mt-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Duration</span>
                    <span className="text-xs font-bold text-slate-300 font-mono">{plan.duration_days} Days</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Estimated ROI</span>
                    <span className="text-xs font-black text-emerald-400 font-mono">+{roiPercent}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic ROI Side Calculator Widget (5 cols) */}
        <div className="lg:col-span-5 bg-[#0f131d] border border-[#212a3d] rounded-2xl p-6 space-y-5 sticky top-28">
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-tight flex items-center gap-1.5">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
              Investment Estimator
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Review payout schedules before activating selected plan.
            </p>
          </div>

          {selectedPlan ? (
            <>
              {/* Calculator Summary Card */}
              <div className="bg-[#0c0f16] border border-[#212a3d] p-4.5 rounded-xl space-y-3 font-medium">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[#212a3d]/50 text-slate-400">
                  <span>Selected Package:</span>
                  <span className="font-bold text-white uppercase tracking-wider">{selectedPlan.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs pt-1.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Capital Required</span>
                    <span className="text-sm font-bold text-slate-200 font-mono">
                      {format(selectedPlan.amount)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 items-end">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Target Payout</span>
                    <span className="text-sm font-extrabold text-emerald-400 font-mono">
                      {format(selectedPlan.return_amount)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Duration</span>
                    <span className="text-xs font-bold text-slate-200 font-mono">{selectedPlan.duration_days} Days</span>
                  </div>
                  <div className="flex flex-col gap-0.5 items-end">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Net Profit</span>
                    <span className="text-xs font-bold text-teal-400 font-mono">
                      +{format(selectedPlan.return_amount - selectedPlan.amount)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#212a3d]/50 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Daily Earnings Yield</span>
                  <span className="font-bold text-slate-300 font-mono">
                    {format(Math.round((selectedPlan.return_amount - selectedPlan.amount) / selectedPlan.duration_days))}
                    <span className="text-[10px] text-slate-500">/day</span>
                  </span>
                </div>
              </div>

              {/* Wallet check */}
              {balance && balance.available_balance < selectedPlan.amount ? (
                <div className="bg-yellow-500/10 border border-yellow-500/15 rounded-xl p-3 text-[11px] text-yellow-300 leading-relaxed flex flex-col gap-1.5">
                  <p className="font-bold flex items-center gap-1">⚠️ Low Available Wallet Balance</p>
                  <p className="text-slate-400">
                    Your available balance is <span className="font-bold text-white font-mono">{format(balance.available_balance)}</span>. You require an additional <span className="font-bold text-white font-mono">{format(selectedPlan.amount - balance.available_balance)}</span> to activate this plan.
                  </p>
                  <button
                    onClick={() => onSwitchTab("wallet")}
                    className="text-emerald-400 font-bold hover:text-emerald-300 flex items-center gap-1 self-start cursor-pointer mt-1"
                  >
                    Go to Wallet Topup
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Available Balance verified in wallet. Ready to launch transaction.</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={() => handleInvestSubmit(selectedPlan.id)}
                disabled={loading !== null || (balance !== null && balance.available_balance < selectedPlan.amount)}
                className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  loading === selectedPlan.id
                    ? "bg-[#182030] text-slate-400 border border-[#212a3d]"
                    : balance && balance.available_balance < selectedPlan.amount
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-[#212a3d]"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#0c0f16] shadow-md shadow-emerald-950/20 hover:scale-[1.01]"
                }`}
              >
                {loading === selectedPlan.id ? (
                  <span className="h-5 w-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Coins className="h-4.5 w-4.5" />
                    Activate {selectedPlan.name}
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-[#0c0f16]/50 border border-dashed border-[#20293d] rounded-xl text-slate-500 text-xs">
              <HelpCircle className="h-8 w-8 text-slate-600 mb-2" />
              Please select an investment package on the left to review metrics
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
