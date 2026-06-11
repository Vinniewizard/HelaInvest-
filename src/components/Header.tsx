import React from "react";
import { Coins, LogOut, ShieldCheck, User, TrendingUp, Wallet, ListTodo, Users, Globe } from "lucide-react";
import { User as UserType, WalletBalance } from "../types";
import { useCurrency, CurrencyType } from "../context/CurrencyContext";

interface HeaderProps {
  user: UserType;
  balance: WalletBalance | null;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isAdminMode: boolean;
  setIsAdminMode: (mode: boolean) => void;
  onLogout: () => void;
}

export default function Header({
  user,
  balance,
  currentTab,
  setCurrentTab,
  isAdminMode,
  setIsAdminMode,
  onLogout,
}: HeaderProps) {
  const { activeCurrency, setCurrency, format } = useCurrency();

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-1 sm:gap-4">
        
        {/* Brand */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-shrink-0">
          <span className="text-base sm:text-xl font-black tracking-tight text-[#006B4A] truncate">
            HelaVest
          </span>
          {isAdminMode && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="bg-amber-100 text-[#d97706] text-[8px] uppercase font-bold px-1.5 py-0.5 rounded border border-amber-200">
                Admin
              </span>
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  setCurrentTab("dashboard");
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-black px-1.5 sm:px-2.5 py-1 rounded-lg border border-slate-200 transition-all flex items-center gap-0.5 cursor-pointer flex-shrink-0"
                title="Exit administrative portal view"
              >
                <ShieldCheck className="h-2.5 w-2.5 text-[#006B4A]" />
                <span className="hidden xs:inline">Exit</span>
              </button>
            </div>
          )}
        </div>
 
        {/* Multi-Currency Selection Controls */}
        <div className="group flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 px-1.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 transition-all duration-200 hover:border-[#006B4A]/30 flex-shrink-0 hover:scale-103 active:scale-97">
          <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#006B4A] group-hover:rotate-12 transition-transform duration-300 ease-out" />
          <select
            value={activeCurrency}
            onChange={(e) => setCurrency(e.target.value as CurrencyType)}
            className="bg-transparent text-[10px] sm:text-xs font-bold text-slate-700 focus:outline-none cursor-pointer pr-1"
          >
            <option value="USD">USD ($)</option>
            <option value="KES">KES (KSh)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </div>
 
        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center justify-end gap-6 font-semibold flex-shrink-0">
           {balance !== null && (
             <div className="group flex items-center gap-1.5 bg-[#f0f9f6] text-[#006B4A] border border-[#d2edd5] px-3 py-1.5 rounded-full text-xs font-bold shadow-xs transition-all duration-200 hover:scale-105 active:scale-98 cursor-pointer">
               <Coins className="h-3.5 w-3.5 text-[#006B4A] animate-pulse group-hover:rotate-12 transition-transform duration-300" />
               <span className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider hidden md:inline">A/C Bal:</span>
               <span className="text-xs font-extrabold group-hover:text-[#004D34] transition-colors">{format(balance.available_balance)}</span>
             </div>
           )}
           <button
             onClick={() => {
               setIsAdminMode(false);
               setCurrentTab("dashboard");
             }}
             className={`text-sm cursor-pointer transition-all duration-200 font-bold hover:scale-105 active:scale-95 ${!isAdminMode && currentTab === "dashboard" ? "text-[#006B4A]" : "text-slate-600 hover:text-slate-900"}`}
           >
             Dashboard
           </button>
           <button onClick={onLogout} className="text-sm font-bold text-slate-600 hover:text-red-600 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95">Logout</button>
        </div>
        
        {/* Mobile Nav Actions */}
        <div className="sm:hidden flex items-center gap-1.5 flex-shrink-0">
           {balance !== null && (
             <span className="group flex items-center gap-1 text-[10px] font-black text-[#006B4A] bg-[#f0f9f6] px-2 py-1 rounded-lg border border-[#d2edd5] transition-all duration-200 hover:scale-105">
               <Coins className="h-3 w-3 text-[#006B4A] group-hover:rotate-12 transition-transform duration-300" />
               <span>{format(balance.available_balance)}</span>
             </span>
           )}
           <button
             onClick={onLogout}
             title="Log Out"
             className="p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors cursor-pointer flex-shrink-0"
           >
             <LogOut className="h-4.5 w-4.5" />
           </button>
        </div>
      </div>

      {/* Navigation sub-header for inner pages (unless Admin Mode) */}
      {!isAdminMode && (
        <div className="w-full bg-[#f8faf9] border-b border-slate-200 overflow-x-auto hide-scrollbar">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-start md:justify-center gap-1.5 sm:gap-3">
            {[
              { id: "dashboard", label: "Terminal", icon: TrendingUp },
              { id: "wallet", label: "Account", icon: Wallet },
              { id: "referrals", label: "Network", icon: Users },
              { id: "trades", label: "History", icon: ListTodo },
              { id: "profile", label: "Profile", icon: User },
            ].map((tab) => {
              const isActive = currentTab === tab.id;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`group px-3 md:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ease-out whitespace-nowrap cursor-pointer flex items-center gap-1.5 sm:gap-2 hover:scale-104 active:scale-96 ${
                    isActive
                      ? "bg-white text-[#006B4A] shadow-xs border border-slate-200"
                      : "text-slate-500 hover:text-[#006B4A] hover:bg-white hover:shadow-xs border border-transparent hover:border-slate-100"
                  }`}
                >
                  <TabIcon className={`h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:scale-115 group-hover:rotate-3 ${isActive ? "text-[#006B4A]" : "text-slate-400 group-hover:text-[#006B4A]"}`} />
                  <span className="transition-colors duration-200">{tab.label}</span>
                </button>
              );
            })}
            
            {user.isAdmin && (
              <button
                onClick={() => {
                  setIsAdminMode(true);
                  setCurrentTab("admin");
                }}
                className={`group px-3 py-2 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 whitespace-nowrap cursor-pointer text-amber-600 hover:bg-amber-100/60 border border-amber-200/50 hover:border-amber-300 ml-auto md:ml-4 flex items-center gap-1.5 hover:scale-104 active:scale-96`}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[#d97706] transition-transform duration-300 ease-out group-hover:rotate-12 group-hover:scale-110" />
                <span>Go to Admin</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
