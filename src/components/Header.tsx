import React from "react";
import { Coins, LogOut, ShieldCheck, User, TrendingUp, Wallet, ListTodo, Users } from "lucide-react";
import { User as UserType, WalletBalance } from "../types";

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
  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-[#006B4A]">
            HelaVest
          </span>
          {isAdminMode && (
            <span className="bg-amber-100 text-amber-700 text-[9px] uppercase font-bold px-2 py-0.5 rounded ml-2 border border-amber-200">
              Admin
            </span>
          )}
        </div>

        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center justify-end px-4 gap-6 font-semibold">
           <button onClick={() => setCurrentTab("dashboard")} className={`text-sm cursor-pointer transition-colors ${currentTab === "dashboard" ? "text-[#006B4A]" : "text-slate-600 hover:text-slate-900"}`}>Dashboard</button>
           <button onClick={onLogout} className="text-sm text-slate-600 hover:text-red-600 transition-colors cursor-pointer">Logout</button>
        </div>
        
        <button
          onClick={onLogout}
          title="Log Out"
          className="sm:hidden p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation sub-header for inner pages (unless Admin Mode) */}
      {!isAdminMode && (
        <div className="w-full bg-[#f8faf9] border-b border-slate-200 overflow-x-auto hide-scrollbar">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-1 sm:gap-2">
            {[
              { id: "dashboard", label: "Terminal", icon: null },
              { id: "wallet", label: "Cashier", icon: null },
              { id: "referrals", label: "Network", icon: null },
              { id: "trades", label: "History", icon: null },
            ].map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-white text-[#006B4A] shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/80"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
            
            {user.isAdmin && (
              <button
                onClick={() => {
                  setIsAdminMode(true);
                  setCurrentTab("admin");
                }}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer text-amber-600 hover:bg-amber-50 ml-auto`}
              >
                Go to Admin
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
