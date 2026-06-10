import { 
  Award, 
  ChevronRight, 
  Copy, 
  CheckCircle2, 
  Link as LinkIcon, 
  Gift, 
  Users, 
  Zap, 
  Sparkles
} from "lucide-react";
import { User } from "../types";

interface DashboardSummaryProps {
  user: User;
  onCopyLink: () => void;
  copied: boolean;
  setActiveTab: (tab: string) => void;
  onOpenSimModal: () => void;
  referralLink: string;
}

export default function DashboardSummary({ 
  user, 
  onCopyLink, 
  copied, 
  setActiveTab,
  onOpenSimModal,
  referralLink
}: DashboardSummaryProps) {
  
  // Mock top performers leaderboard
  const topEarners = [
    { rank: 1, name: "David Kimutai", invites: 42, earnings: 92500, tier: "Platinum" },
    { rank: 2, name: "Stacy Atieno", invites: 31, earnings: 67000, tier: "Gold" },
    { rank: 3, name: "John Njoroge", invites: 25, earnings: 45000, tier: "Gold" },
    { rank: 4, name: "Annette Mwende", invites: 19, earnings: 38000, tier: "Silver" },
  ];

  return (
    <div className="space-y-6">
      
      {/* GRAPHIC BANNER CARD */}
      <div className="bg-gradient-to-r from-slate-950 via-[#0a0d14] to-slate-950 border border-[#212a3d] rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-2 relative z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wide">
            <Zap className="h-3 w-3 text-indigo-400" /> Auto-Settle Rewards Enabled
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
            Ascent Referral Program
          </h2>
          <p className="text-xs text-slate-400 max-w-lg">
            Track your invites, generate customized portal links, and follow real-time client registrations right from your secure desktop hub. 
          </p>
        </div>

        <button 
          onClick={() => setActiveTab("referrals")}
          className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20"
        >
          Check Network <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* THREE STEP INVITE SEQUENCE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Step 1 */}
        <div className="bg-[#0f131d] border border-[#212a3d] p-5 rounded-2xl relative overflow-hidden group">
          <div className="text-3xl font-black text-slate-800 font-mono absolute top-4 right-5 select-none opacity-40">01</div>
          <div className="space-y-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit">
              <LinkIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">Share Invite Link</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                Copy your unique affiliate link from the generator tool or custom-type your preferred link suffix.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-[#0f131d] border border-[#212a3d] p-5 rounded-2xl relative overflow-hidden group">
          <div className="text-3xl font-black text-slate-800 font-mono absolute top-4 right-5 select-none opacity-40">02</div>
          <div className="space-y-3">
            <div className="p-3 bg-[#a855f7]/10 text-[#c084fc] rounded-xl w-fit">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">Invites Register</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                Users joining via your tracking portal instantly receive promotional account credits, assigning them to your ledger.
              </p>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-[#0f131d] border border-[#212a3d] p-5 rounded-2xl relative overflow-hidden group">
          <div className="text-3xl font-black text-slate-800 font-mono absolute top-4 right-5 select-none opacity-40">03</div>
          <div className="space-y-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit">
              <Gift className="h-4.5 w-4.5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">Claim Commissions</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                Earn KSh 500 automatically on registration, increasing to KSh 2,500 once clients trade in dynamic plans.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* PORTAL COPIER BAR & LEADERBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Portal Address Box */}
        <div className="lg:col-span-1 bg-[#0f131d] border border-[#212a3d] rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" /> Share Invitation
            </h3>
            <p className="text-[11px] text-slate-400 leading-normal">
              Share the official sign-up address with clients. When they join, they're automatically tagged in your referral structure.
            </p>

            <div className="bg-[#0c0f16] border border-[#212a3d] p-3.5 rounded-xl space-y-1.5">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block font-mono">My Code ID</span>
              <span className="text-xs font-bold text-slate-300 font-mono block select-all">{user.referralCode}</span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2 bg-[#090b10] border border-[#212a3d] p-1.5 rounded-xl">
              <span className="text-[10px] font-mono text-slate-500 truncate pl-2 w-full">{referralLink}</span>
              <button 
                onClick={onCopyLink}
                className="p-2 border border-slate-700 bg-slate-800 hover:bg-slate-755 text-slate-300 rounded-lg cursor-pointer flex-shrink-0 transition-colors"
                title="Copy Link"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <button 
              onClick={onOpenSimModal}
              className="w-full text-center py-2.5 px-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl font-bold text-[11px] uppercase tracking-wide cursor-pointer transition-all"
            >
              Add Demo Invite Node
            </button>
          </div>
        </div>

        {/* Leaders Board */}
        <div className="lg:col-span-2 bg-[#0c0f16] border border-[#212a3d] rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Award className="h-4.5 w-4.5 text-indigo-400" /> Network Leaderboard
                </h3>
                <p className="text-[10px] text-slate-500">Global rankings of top affiliate brokers on Ascent networks</p>
              </div>
              <span className="text-[9px] font-extrabold uppercase bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded tracking-widest animate-pulse">
                Live Status
              </span>
            </div>

            <div className="space-y-2.5 pt-2">
              {topEarners.map((earner) => (
                <div 
                  key={earner.rank}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#212a3d]/50 bg-[#0f131d]/60 hover:bg-[#0f131d] hover:border-indigo-500/20 transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center font-mono ${
                      earner.rank === 1 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                      earner.rank === 2 ? 'bg-slate-300/15 text-slate-300 border border-slate-300/20' :
                      earner.rank === 3 ? 'bg-[#b45309]/15 text-[#f59e0b] border border-[#b45309]/20' :
                      'bg-slate-800/20 text-slate-400 border border-slate-800/10'
                    }`}>
                      {earner.rank}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{earner.name}</span>
                      <span className="text-[9px] text-slate-500 block">Invites: {earner.invites} clients</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-black text-emerald-400 block">+KSh {earner.earnings.toLocaleString()}</span>
                    <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-bold">{earner.tier} Rank</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
