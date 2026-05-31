import React, { useMemo, useState, useEffect } from "react";
import { Users, Copy, CheckCircle2, Link as LinkIcon, Gift, TrendingUp as TrendingUpIcon, Clock } from "lucide-react";
import { ReferralRecord, User, Investment } from "../types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ReferralsProps {
  user: User;
  referrals: ReferralRecord[];
  investments: Investment[];
  onRefresh: () => void;
}

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
    <span className="font-mono bg-[#1e293b]/50 px-2 py-1 rounded text-orange-400 space-x-1 border border-orange-500/20">
      <span>{timeLeft.d}d</span>
      <span>{String(timeLeft.h).padStart(2, '0')}h</span>
      <span>{String(timeLeft.m).padStart(2, '0')}m</span>
      <span>{String(timeLeft.s).padStart(2, '0')}s</span>
    </span>
  );
}

export default function Referrals({ user, referrals, investments, onRefresh }: ReferralsProps) {
  const [copied, setCopied] = React.useState(false);

  const referralLink = `${window.location.origin}/?ref=${user.referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalBonus = referrals.reduce((sum, r) => sum + r.bonus, 0);

  const chartData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    
    referrals.forEach(ref => {
      const d = new Date(ref.created_at);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dataMap[dateKey] = (dataMap[dateKey] || 0) + ref.bonus;
    });
    
    return Object.entries(dataMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bonus]) => {
        const d = new Date(date);
        return {
          date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          bonus
        };
      });
  }, [referrals]);

  return (
    <div className="space-y-6">
      <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 justify-between">
        <div className="flex-1 space-y-3">
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-400" />
            Vip Referral Program
          </h2>
          <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
            Invite your friends and earn instant cash bonuses when they subscribe to our investment plans. 
            You get an 8% commission on their first seed capital!
          </p>
        </div>
        
        <div className="bg-[#0c0f16] border border-[#212a3d] p-4 rounded-xl text-center min-w-[200px]">
          <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-1">Total Earned</span>
          <span className="text-2xl font-mono font-black text-emerald-400">KSh {totalBonus.toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border border-[#212a3d] bg-[#0c0f16] rounded-2xl p-6 flex flex-col justify-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-indigo-400" /> Invitation Link
          </h3>
          <p className="text-xs text-slate-500 mb-4">Share this link to grow your network and earn passive income.</p>
          <div className="flex items-center gap-3 bg-[#0f131d] border border-[#212a3d] p-3 rounded-xl overflow-hidden">
            <input 
              type="text" 
              readOnly 
              value={referralLink}
              className="bg-transparent border-none text-slate-300 font-mono text-xs w-full focus:outline-none"
            />
            <button 
              onClick={handleCopy}
              className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 p-2 rounded-lg transition-colors cursor-pointer flex-shrink-0"
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 bg-[#0f131d] border border-[#212a3d] rounded-2xl p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <TrendingUpIcon className="h-4 w-4 text-emerald-400" /> Performance Overview
            </h3>
          </div>
          
          <div className="h-48 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#212a3d" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `KSh ${val}`} />
                  <Tooltip 
                    cursor={{ fill: '#121824' }}
                    contentStyle={{ backgroundColor: '#0c0f16', border: '1px solid #212a3d', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#34d399', fontWeight: 'bold' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                    formatter={(value: number) => [`KSh ${value.toLocaleString()}`, 'Bonus']}
                  />
                  <Bar dataKey="bonus" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 border border-dashed border-[#212a3d] rounded-xl bg-[#0c0f16]">
                <TrendingUpIcon className="h-8 w-8 text-slate-600 mb-2 opacity-50" />
                <span className="text-xs font-bold text-slate-400">No data available</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-[#0c0f16] border-b border-[#212a3d]/70 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Gift className="h-4 w-4 text-indigo-400" /> My Network ({referrals.length})
          </h3>
          <button onClick={onRefresh} className="text-[10px] uppercase font-bold tracking-wider text-slate-500 hover:text-white transition-colors cursor-pointer">
            Refresh
          </button>
        </div>

        {referrals.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <Users className="h-10 w-10 text-slate-600 mb-2" />
            <h4 className="text-sm font-bold text-slate-350">No referrals yet</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Copy your link and share it to start earning passive income!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0c0f16] text-slate-400 text-[9px] font-bold uppercase tracking-wider border-b border-[#212a3d]">
                  <th className="p-4 font-semibold">Date / Time</th>
                  <th className="p-4 font-semibold">Invited User</th>
                  <th className="p-4 font-semibold text-right">Bonus Earned (KSh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#212a3d]/50">
                {referrals.map((ref) => (
                  <tr key={ref.id} className="hover:bg-[#121824]/40 transition-colors">
                     <td className="p-4 font-medium font-mono text-slate-450 whitespace-nowrap">
                        {new Date(ref.created_at).toLocaleDateString()}{" "}
                        <span className="text-[10px] text-slate-500">
                          {new Date(ref.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-bold text-slate-200 capitalize flex items-center gap-1.5">
                          {ref.referred_username}
                        </span>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          +{ref.bonus.toLocaleString()}
                        </span>
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* ACTIVE SESSIONS / PLANS WITH COUNTDOWN */}
      <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-[#0c0f16] border-b border-[#212a3d]/70 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-400" /> Active Network Sessions
          </h3>
        </div>

        {investments.filter(inv => inv.status === 'active').length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <Clock className="h-10 w-10 text-slate-600 mb-2" />
            <h4 className="text-sm font-bold text-slate-350">No active sessions</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Your active investment plans will appear here with live countdowns.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0c0f16] text-slate-400 text-[9px] font-bold uppercase tracking-wider border-b border-[#212a3d]">
                  <th className="p-4 font-semibold">Plan ID</th>
                  <th className="p-4 font-semibold">Package Type</th>
                  <th className="p-4 font-semibold">Capital Entry</th>
                  <th className="p-4 font-semibold text-right">Time Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#212a3d]/50">
                {investments.filter(inv => inv.status === 'active').map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#121824]/40 transition-colors">
                      <td className="p-4 font-mono font-medium text-slate-500 text-[10px] whitespace-nowrap">
                        {inv.id.toUpperCase()}
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-bold text-slate-200 capitalize flex items-center gap-1.5">
                          {inv.planName}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap font-mono font-bold text-slate-300">
                        KSh {inv.amount.toLocaleString()}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <LiveCountdown maturesAt={inv.matures_at} />
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
