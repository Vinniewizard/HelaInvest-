import React, { useState, useEffect } from "react";
import { ListTodo, TrendingUp, Sparkles, Clock, CheckCircle2, XCircle, ArrowUpRight, HelpCircle, FastForward } from "lucide-react";
import { Investment, InvestmentStatus, WalletBalance } from "../types";
import { useCurrency } from "../context/CurrencyContext";

function LiveCountdown({ maturesAt }: { maturesAt: string }) {
  const [timeLeft, setTimeLeft] = useState<{d: number; h: number; m: number; s: number}>({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const calcTime = () => {
      const now = Date.now();
      const target = new Date(maturesAt).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }

      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
        m: Math.floor((diff / 1000 / 60) % 60),
        s: Math.floor((diff / 1000) % 60)
      });
    };

    calcTime();
    const int = setInterval(calcTime, 1000);
    return () => clearInterval(int);
  }, [maturesAt]);

  if (timeLeft.d === 0 && timeLeft.h === 0 && timeLeft.m === 0 && timeLeft.s === 0) {
    return <span className="text-emerald-400 font-bold animate-pulse">Ready/Matured</span>;
  }

  return (
    <span className="font-mono text-orange-400 space-x-0.5">
      <span>{timeLeft.d}d</span>
      <span className="text-slate-500">:</span>
      <span>{String(timeLeft.h).padStart(2, '0')}h</span>
      <span className="text-slate-500">:</span>
      <span>{String(timeLeft.m).padStart(2, '0')}m</span>
      <span className="text-slate-500">:</span>
      <span>{String(timeLeft.s).padStart(2, '0')}s</span>
    </span>
  );
}

interface TradesProps {
  investments: Investment[];
  balance: WalletBalance | null;
  onRefresh: () => void;
}

export default function Trades({ investments, balance, onRefresh }: TradesProps) {
  const [filter, setFilter] = useState<"all" | InvestmentStatus>("all");
  const [fastForwarding, setFastForwarding] = useState<number | null>(null);
  const [simulationResult, setSimulationResult] = useState<string | null>(null);
  const { format } = useCurrency();

  // Filtered investments
  const filteredInvestments = investments.filter((inv) =>
    filter === "all" ? true : inv.status === filter
  );

  // Trigger fast-forward endpoint
  const handleFastForward = async (days: number) => {
    setFastForwarding(days);
    setSimulationResult(null);
    try {
      const response = await fetch("/api/simulate/fast-forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSimulationResult(data.message || `Successfully shifted space timeline forward by ${days} days!`);
      // Update app stats
      setTimeout(() => {
        onRefresh();
      }, 1000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setFastForwarding(null);
    }
  };

  // Helper: calculate progress on client side to show live countdown logic
  const getProgressInfo = (inv: Investment) => {
    const createdTime = new Date(inv.created_at).getTime();
    const maturesTime = new Date(inv.matures_at).getTime();
    const nowTime = Date.now();

    const totalDuration = maturesTime - createdTime;
    if (totalDuration <= 0) return { percent: 100, daysLeft: 0, isMatured: true };

    const elapsed = nowTime - createdTime;
    const percent = Math.max(0, Math.min(100, Math.round((elapsed / totalDuration) * 100)));
    const remainingMs = maturesTime - nowTime;
    const daysLeft = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    return {
      percent,
      daysLeft,
      isMatured: nowTime >= maturesTime,
    };
  };

  return (
    <div className="space-y-6">
      {/* Simulation Master Control Strips (Super Premium Experience) */}
      <div className="bg-slate-900/50 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-emerald-400 uppercase tracking-tight flex items-center gap-1.5">
              <FastForward className="h-4 w-4" />
              Timeline Simulation Controls (HelaVest SandBox)
            </h3>
            <p className="text-xs text-slate-400 max-w-xl font-medium leading-relaxed">
              These developer controls allow you to shift the system calendar days into the future. Instantly trigger trade lifecycle maturity, payout disbursements, and bonus referral conversions to verify app features.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {[1, 3, 5, 10].map((days) => (
              <button
                key={days}
                onClick={() => handleFastForward(days)}
                disabled={fastForwarding !== null}
                className="bg-[#1e293b] hover:bg-emerald-500 hover:text-slate-950 border border-slate-700 hover:border-emerald-400 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all duration-200 cursor-pointer text-nowrap"
              >
                {fastForwarding === days ? (
                  <span className="h-3.5 w-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <FastForward className="h-3 w-3 shrink-0" />
                )}
                +{days} Day{days > 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </div>

        {simulationResult && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-300 font-semibold leading-relaxed flex items-center gap-2 animate-pulse">
            <Sparkles className="h-4.5 w-4.5 shrink-0" />
            <span>{simulationResult}</span>
          </div>
        )}
      </div>

      {/* Main page title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-[#006B4A]" />
            Active and Historical Trades
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Monitor real-time progress parameters, yields, and countdowns.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 bg-[#0c0f16] border border-[#212a3d] p-1 rounded-xl self-start md:self-auto">
          {[
            { id: "all", label: "All Packages" },
            { id: "active", label: "Active" },
            { id: "completed", label: "Completed" },
            { id: "cancelled", label: "Cancelled" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-colors cursor-pointer ${
                filter === tab.id
                  ? "bg-[#182030] text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List / Grid of investments */}
      {filteredInvestments.length === 0 ? (
        <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <Clock className="h-10 w-10 text-slate-600 mb-2" />
          <h4 className="text-sm font-bold text-slate-300">No trades match this filter</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
            There are no trades to display. Navigate to the marketplace to launch your first yield-bearing plan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInvestments.map((inv) => {
            const { percent, daysLeft, isMatured } = getProgressInfo(inv);

            // Badge coloring
            let badgeClass = "bg-blue-500/10 border-blue-500/20 text-blue-400";
            let StatusIcon = Clock;
            if (inv.status === "completed") {
              badgeClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
              StatusIcon = CheckCircle2;
            } else if (inv.status === "cancelled") {
              badgeClass = "bg-red-500/10 border-red-500/20 text-red-400";
              StatusIcon = XCircle;
            }

            return (
              <div
                key={inv.id}
                className="bg-[#0f131d] border border-[#212a3d] rounded-2xl p-5 space-y-4 shadow-sm relative overflow-hidden"
              >
                {/* Header info */}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">{inv.planName}</h3>
                    <span className="text-[9px] text-slate-500 font-mono">ID: {inv.id}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${badgeClass}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {inv.status}
                  </span>
                </div>

                {/* Capital & Return details */}
                <div className="bg-[#0c0f16]/85 border border-[#212a3d]/50 rounded-xl p-3.5 grid grid-cols-3 gap-2 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">Principal Capital</span>
                    <span className="font-bold text-slate-300 font-mono">{format(inv.amount)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 items-center">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">Net Profit</span>
                    <span className="font-bold text-emerald-400 font-mono">+{format(inv.profit)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 items-end">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">Exp. Return</span>
                    <span className="font-extrabold text-white font-mono">{format(inv.return_amount)}</span>
                  </div>
                </div>

                {/* Progress bar area */}
                {inv.status === "active" ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                      <span className="flex items-center gap-1 text-blue-400">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {percent}% Progress
                      </span>
                      <span>
                        <LiveCountdown maturesAt={inv.matures_at} />
                      </span>
                    </div>
                    {/* Progress Track */}
                    <div className="w-full bg-[#182030] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono font-medium pt-0.5">
                      <span>Started: {new Date(inv.created_at).toLocaleDateString()}</span>
                      <span>Matures: {new Date(inv.matures_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span>Activated: {new Date(inv.created_at).toLocaleDateString()}</span>
                    <span>
                      {inv.status === "completed" ? "Matured" : "Cancelled"}:{" "}
                      {new Date(inv.matures_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
