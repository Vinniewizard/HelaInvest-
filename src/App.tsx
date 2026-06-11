import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShieldAlert, AlertCircle, RefreshCw, Info } from "lucide-react";
import { Toaster, toast } from "sonner";

import { User, WalletBalance, DashboardStats, Transaction, Investment, ReferralRecord, Plan } from "./types";
import Header from "./components/Header";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import Invest from "./components/Invest";
import Trades from "./components/Trades";
import WalletComponent from "./components/Wallet";
import AdminHub from "./components/AdminHub";
import Referrals from "./components/Referrals";
import Profile from "./components/Profile";

export default function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [appInitialized, setAppInitialized] = useState(false);

  // Layout states
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [walletSubTab, setWalletSubTab] = useState<"deposit" | "withdraw" | "history">("deposit");

  // App metrics state
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const prevTxRef = useRef<Transaction[]>([]);
  const prevInvRef = useRef<Investment[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load all user metrics securely from back-end Express API routes
  const loadAllUserData = useCallback(async (userId: string, silent = false) => {
    if (!silent) setLoading(true);
    setErrorMsg(null);
    try {
      const authHeaders = { "x-user-id": userId };

      const [balRes, statsRes, txRes, invRes, refRes, plansRes] = await Promise.all([
        fetch("/api/user/balance", { headers: authHeaders }),
        fetch("/api/user/stats", { headers: authHeaders }),
        fetch("/api/transactions", { headers: authHeaders }),
        fetch("/api/investments", { headers: authHeaders }),
        fetch("/api/referrals", { headers: authHeaders }),
        fetch("/api/plans"),
      ]);

      if (!balRes.ok || !statsRes.ok) {
        throw new Error("Unable to synchronize ledger items. Server might be restarting.");
      }

      const balData = await balRes.json();
      const statsData = await statsRes.json();
      const txData = await txRes.json();
      const invData = await invRes.json();
      const refData = await refRes.json();
      const plansData = await plansRes.json();

      if (balData.balance) setBalance(balData.balance);
      if (statsData.stats) setStats(statsData.stats);
      if (txData.transactions) {
        if (silent && prevTxRef.current.length > 0) {
          txData.transactions.forEach((tx: Transaction) => {
            const oldTx = prevTxRef.current.find(t => t.id === tx.id);
            if (oldTx && oldTx.status === "pending" && tx.status === "approved") {
              toast.success(`Your ${tx.transaction_type} of KSh ${tx.amount.toLocaleString()} was approved!`);
            } else if (oldTx && oldTx.status === "pending" && tx.status === "declined") {
              toast.error(`Your ${tx.transaction_type} of KSh ${tx.amount.toLocaleString()} was declined.`);
            }
          });
        }
        setTransactions(txData.transactions);
        prevTxRef.current = txData.transactions;
      }
      
      if (invData.investments) {
        if (silent && prevInvRef.current.length > 0) {
          invData.investments.forEach((inv: Investment) => {
            const oldInv = prevInvRef.current.find(i => i.id === inv.id);
            if (oldInv && oldInv.status === "active" && inv.status === "completed") {
              toast.success(`Your investment of KSh ${inv.amount.toLocaleString()} just completed!`);
            }
          });
        }
        setInvestments(invData.investments);
        prevInvRef.current = invData.investments;
      }

      if (refData.referrals) setReferrals(refData.referrals);
      if (plansData.plans) setPlans(plansData.plans);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load account assets.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Automatic Polling
  useEffect(() => {
    if (currentUser && appInitialized) {
      const interval = setInterval(() => {
        loadAllUserData(currentUser.id, true);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [currentUser, appInitialized, loadAllUserData]);

  // Check login on startup
  const checkSession = useCallback(async () => {
    const savedUserId = localStorage.getItem("hela_user_id");
    if (!savedUserId) {
      setAppInitialized(true);
      return;
    }

    try {
      const response = await fetch("/api/auth/me", {
        headers: { "x-user-id": savedUserId },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        if (window.location.pathname.startsWith('/secure-admin') && data.user.isAdmin) {
          setIsAdminMode(true);
          setCurrentTab("admin");
        }
        await loadAllUserData(data.user.id);
      } else {
        localStorage.removeItem("hela_user_id");
      }
    } catch (err) {
      console.error("Session lookup aborted.", err);
    } finally {
      setAppInitialized(false);
      // Extra latency offset prevents flickering frame
      setTimeout(() => setAppInitialized(true), 250);
    }
  }, [loadAllUserData]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Unified STATE <-> URL Synchronization to completely eliminate race conditions and keep Admin interface always accessible
  useEffect(() => {
    if (!currentUser) return;
    const path = window.location.pathname;
    const isCurrentlyOnAdminPath = path.startsWith("/secure-admin");

    if (currentUser.isAdmin) {
      if (isCurrentlyOnAdminPath) {
        // Force admin mode state matching the URL
        if (!isAdminMode) {
          setIsAdminMode(true);
        }
        if (currentTab !== "admin") {
          setCurrentTab("admin");
        }
      } else {
        // They are on standard path, synchronize browser URL if state has changed
        if (isAdminMode) {
          window.history.pushState(null, "", "/secure-admin/");
        }
      }
    } else {
      // Non-admin user tries to access admin path - redirect them!
      if (isCurrentlyOnAdminPath) {
        window.history.replaceState(null, "", "/");
        setIsAdminMode(false);
        if (currentTab === "admin") {
          setCurrentTab("dashboard");
        }
        toast.error("Access Denied: You do not have administrator permissions.");
      }
    }
  }, [currentUser, isAdminMode, currentTab]);

  // URL -> STATE: Listen for browser history traversal events (Back / Forward)
  useEffect(() => {
    if (!currentUser) return;

    const handlePopstate = () => {
      const path = window.location.pathname;
      const onAdminPath = path.startsWith("/secure-admin");
      
      if (onAdminPath) {
        if (currentUser.isAdmin) {
          setIsAdminMode(true);
          setCurrentTab("admin");
        }
      } else {
        setIsAdminMode(false);
        if (currentTab === "admin") {
          setCurrentTab("dashboard");
        }
      }
    };

    window.addEventListener("popstate", handlePopstate);
    return () => {
      window.removeEventListener("popstate", handlePopstate);
    };
  }, [currentUser, currentTab]);

  // Key combination Alt + A to toggle Admin Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Robust key check for 'a' or 'A' with Alt modifier
      if (e.altKey && (e.key === "a" || e.key === "A" || e.code === "KeyA")) {
        e.preventDefault();
        
        if (currentUser) {
          if (currentUser.isAdmin) {
            setIsAdminMode((prev) => {
              const nextMode = !prev;
              if (nextMode) {
                setCurrentTab("admin");
                window.history.pushState(null, "", "/secure-admin/");
                toast.success("HelaVest Secure Admin Interface Opened");
              } else {
                setCurrentTab("dashboard");
                window.history.pushState(null, "", "/");
                toast.info("Switched to Standard User Terminal Interface");
              }
              return nextMode;
            });
          } else {
            toast.error("Forbidden: Your account does not have administrative privileges.");
          }
        } else {
          toast.error("Access Denied: Please sign in first.");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentUser]);

  const handleLoginSuccess = async (user: User) => {
    localStorage.setItem("hela_user_id", user.id);
    setCurrentUser(user);
    if (window.location.pathname.startsWith('/secure-admin') && user.isAdmin) {
      setIsAdminMode(true);
      setCurrentTab("admin");
    } else {
      setIsAdminMode(false);
      setCurrentTab("dashboard");
    }
    await loadAllUserData(user.id);
  };

  const handleLogout = () => {
    localStorage.removeItem("hela_user_id");
    setCurrentUser(null);
    setBalance(null);
    setStats(null);
    setTransactions([]);
    setInvestments([]);
    setReferrals([]);
    setIsAdminMode(false);
    setCurrentTab("dashboard");
    window.history.pushState(null, "", "/");
  };

  const handleDeposit = async (amount: number, phone: string, note: string, isCrypto?: boolean, cryptoCurrency?: string) => {
    if (!currentUser) return;
    try {
      const apiKey = (import.meta as any).env.VITE_NOWPAYMENTS_API_KEY || "";
      const baseUrl = (import.meta as any).env.VITE_NOWPAYMENTS_BASE_URL || "https://api.nowpayments.io/v1";

      if (isCrypto && cryptoCurrency) {
        if (apiKey) {
          const amountUSD = Number((amount / 130).toFixed(2));
          console.log(`[NOWPayments Direct Client] Creating payment for $${amountUSD} USD`);
          const res = await fetch(`${baseUrl}/payment`, {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              price_amount: amountUSD,
              price_currency: "usd",
              pay_amount: null,
              pay_currency: cryptoCurrency.toLowerCase(),
              order_id: "tx-cli-" + Math.random().toString(36).substr(2, 9),
              order_description: `Direct Crypto Deposit for ${currentUser.username}`
            })
          });
          if (res.ok) {
            const data = await res.json();
            const localTxRes = await fetch("/api/transactions/deposit-crypto", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-user-id": currentUser.id,
              },
              body: JSON.stringify({ amount, cryptoCurrency, note: note || "Crypto deposit (Direct NOWPayments)", customDetails: data }),
            });
            return await localTxRes.json();
          }
        }

        // Backend Proxy Route
        const response = await fetch("/api/transactions/deposit-crypto", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": currentUser.id,
          },
          body: JSON.stringify({ amount, cryptoCurrency, note }),
        });
        const data = await response.json();
        return data;
      }

      // Default to Standard M-Pesa deposit
      const response = await fetch("/api/transactions/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id,
        },
        body: JSON.stringify({ amount, phone, note }),
      });
      const data = await response.json();
      return data;
    } catch (err) {
      console.error(err);
      return { error: "Failed to dispatch top-up." };
    }
  };

  const handleWithdrawal = async (amount: number, phone: string, note: string, cryptoAddress?: string, cryptoCurrency?: string) => {
    if (!currentUser) return;
    try {
      const apiKey = (import.meta as any).env.VITE_NOWPAYMENTS_API_KEY || "";
      const baseUrl = (import.meta as any).env.VITE_NOWPAYMENTS_BASE_URL || "https://api.nowpayments.io/v1";

      if (cryptoAddress && cryptoCurrency && apiKey) {
        const amountUSD = Number((amount / 130).toFixed(2));
        console.log(`[NOWPayments Direct Payout] Initiating direct payout for $${amountUSD} USD to ${cryptoAddress}`);
        const res = await fetch(`${baseUrl}/payout`, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            withdrawals: [
              {
                address: cryptoAddress,
                amount: amountUSD,
                currency: cryptoCurrency.toLowerCase()
              }
            ]
          })
        });
        if (res.ok) {
          const data = await res.json();
          const localTxRes = await fetch("/api/transactions/withdraw", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": currentUser.id,
            },
            body: JSON.stringify({
              amount,
              phone,
              note: note || "Crypto payout client-execution",
              crypto_address: cryptoAddress,
              crypto_currency: cryptoCurrency,
              payment_id: data.id || data.payout_id
            }),
          });
          return await localTxRes.json();
        }
      }

      // Secure Backend Route Proxy
      const response = await fetch("/api/transactions/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id,
        },
        body: JSON.stringify({ amount, phone, note, crypto_address: cryptoAddress, crypto_currency: cryptoCurrency }),
      });
      const data = await response.json();
      return data;
    } catch (err) {
      console.error(err);
      return { error: "Failed to dispatch cash-out." };
    }
  };

  const handleInvest = async (planId: string) => {
    if (!currentUser) return;
    try {
      const response = await fetch("/api/investments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id,
        },
        body: JSON.stringify({ planId }),
      });
      const data = await response.json();
      if (data.success) {
        await loadAllUserData(currentUser.id);
      }
      return data;
    } catch (errOrError) {
      console.error(errOrError);
      return { error: "Investment transaction failed." };
    }
  };

  // Helper trigger to load stats
  const triggerRefresh = () => {
    if (currentUser) {
      loadAllUserData(currentUser.id);
    }
  };

  if (!appInitialized) {
    return (
      <div className="min-h-screen bg-[#07090e] dark:bg-[#070903] flex flex-col items-center justify-center p-6 text-slate-400 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#f3f4f6] animate-pulse">
            Configuring HelaVest Terminal...
          </span>
        </div>
      </div>
    );
  }

  // Logout/Login screens
  if (!currentUser) {
    return isRegistering ? (
      <Register
        onRegisterSuccess={handleLoginSuccess}
        onNavigateToLogin={() => setIsRegistering(false)}
      />
    ) : (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => setIsRegistering(true)}
      />
    );
  }

  const isCurrentlyAdminPath = typeof window !== "undefined" && window.location.pathname.startsWith("/secure-admin");

  if (isCurrentlyAdminPath && !currentUser.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
        <Toaster theme="light" position="top-right" />
        <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Accent glow */}
          <div className="absolute top-0 right-0 h-32 w-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-14 w-14 bg-rose-500/10 rounded-full border border-rose-500/20 flex items-center justify-center">
              <ShieldAlert className="h-7 w-7 text-rose-500 animate-pulse" />
            </div>
            
            <div className="space-y-1.5">
              <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wide inline-block animate-pulse">
                Authentication Conflict
              </span>
              <h2 className="text-xl font-black text-white">Access Denied</h2>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              You are currently authenticated with the standard client profile <strong className="text-slate-200">"{currentUser.username}"</strong>, but the URL path <code className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[10.5px] text-pink-400">/secure-admin/</code> requires dedicated administrative authorization.
            </p>
          </div>

          <div className="bg-slate-900/50 flex flex-col gap-3 rounded-xl border border-slate-800 p-4">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-indigo-400" /> Resolution Action:
            </h5>
            <ul className="text-[11px] text-slate-350 space-y-2 list-disc list-inside font-semibold leading-relaxed">
              <li>Log out to switch to <strong className="text-amber-400 font-black">GADMIN</strong> credentials.</li>
              <li>Or return directly to your safe standard client platform.</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 hover:shadow-lg text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center border-none"
            >
              Logout & Connect Admin Portal
            </button>
            <button
              onClick={() => {
                window.history.pushState(null, "", "/");
                setIsAdminMode(false);
                setCurrentTab("dashboard");
              }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-800 text-center"
            >
              Return to Standard Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f8f6] flex flex-col font-sans">
      <Toaster theme="light" position="top-right" />
      {/* Header component */}
      <Header
        user={currentUser}
        balance={balance}
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          setAppInitialized(true);
        }}
        isAdminMode={isAdminMode}
        setIsAdminMode={setIsAdminMode}
        onLogout={handleLogout}
      />

      {/* App body page */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert segment */}
        {errorMsg && (
          <div className="bg-red-50/80 border border-red-200 p-4 rounded-xl flex items-start justify-between gap-4 font-medium text-xs text-red-800 mb-6">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div>{errorMsg}</div>
            </div>
            <button
              onClick={triggerRefresh}
              className="p-1 px-3 border border-red-300 hover:bg-red-100 text-red-600 rounded-lg cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Global Loading Overlay Banner */}
        {loading && !errorMsg && (
          <div className="bg-[#e8f5e9] border border-[#006B4A]/20 p-3.5 rounded-xl flex items-center justify-between text-xs text-[#006B4A] font-semibold mb-6">
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4.5 w-4.5 animate-spin" />
              Synchronizing with HelaVest state...
            </span>
            <span className="text-[10px] text-slate-500 font-mono">UTC: {new Date().toISOString().slice(0,19).replace("T"," ")}</span>
          </div>
        )}

        {/* Interactive screens switcher wrapped in motion framework */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab + (isAdminMode ? "-admin" : "-user")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {isAdminMode && currentUser.isAdmin ? (
              <AdminHub onRefresh={triggerRefresh} />
            ) : currentTab === "dashboard" && stats ? (
              <Dashboard
                user={currentUser}
                stats={stats}
                referrals={referrals}
                plans={plans}
                balance={balance}
                onInvest={handleInvest}
                onSwitchTab={(tab, subTab) => {
                  setCurrentTab(tab);
                  if (subTab) {
                    setWalletSubTab(subTab);
                  }
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onRefresh={triggerRefresh}
              />
            ) : currentTab === "trades" ? (
              <Trades
                investments={investments}
                balance={balance}
                onRefresh={triggerRefresh}
              />
            ) : currentTab === "wallet" ? (
              <WalletComponent
                balance={balance}
                transactions={transactions}
                phone={currentUser.phone}
                onDeposit={handleDeposit}
                onWithdraw={handleWithdrawal}
                onRefresh={triggerRefresh}
                activeSubTab={walletSubTab}
                setActiveSubTab={setWalletSubTab}
              />
            ) : currentTab === "referrals" ? (
              <Referrals
                 user={currentUser}
                 referrals={referrals}
                 investments={investments}
                 onRefresh={triggerRefresh}
              />
            ) : currentTab === "profile" ? (
              <Profile
                 user={currentUser}
                 onRefresh={triggerRefresh}
              />
            ) : (
              <div className="min-h-[400px] flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                <ShieldAlert className="h-10 w-10 text-slate-400 mb-2 animate-bounce" />
                <h4 className="text-sm font-bold text-slate-700">Page syncing...</h4>
                <p className="text-[10px] text-slate-500 max-w-sm mt-1">
                  Loading financial statistics. If this takes longer than expected, click the manual sync button.
                </p>
                <button
                  onClick={triggerRefresh}
                  className="mt-4 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Manual Sync
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer component */}
      <footer className="w-full bg-[#1A2234] text-white py-12 mt-auto">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
           <div>
             <h3 className="text-xl font-bold mb-4">HelaVest</h3>
             <p className="text-sm text-slate-400">Professional investment platform for consistent capital growth and secure financial management.</p>
           </div>
           <div>
             <h4 className="font-bold mb-4">Quick Links</h4>
             <ul className="text-sm text-slate-400 space-y-2">
                <li><button onClick={() => setCurrentTab("dashboard")} className="hover:text-white transition-colors cursor-pointer">Dashboard</button></li>
                <li><button onClick={handleLogout} className="hover:text-white transition-colors cursor-pointer">Logout</button></li>
             </ul>
           </div>
           <div>
              <h4 className="font-bold mb-4">Join Our Community</h4>
              <a href="https://chat.whatsapp.com/GebCk8EB9i259AOMQaIpmH" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#252c41] hover:bg-[#2d354a] border border-[#353e56] px-4 py-2.5 rounded-lg text-sm transition-colors cursor-pointer">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.898-4.45 9.898-9.898 0-2.64-1.026-5.119-2.894-6.985-1.87-1.868-4.349-2.895-6.99-2.895-5.448 0-9.897 4.45-9.897 9.898 0 2.128.597 4.195 1.731 6.014l-.066.11-1.127 4.103 4.22-.109.064-.061c.063-.061 1.259-.628 1.259-.628zm8.932-5.751c-.482-.242-2.85-1.408-3.292-1.57-.442-.162-.764-.242-1.085.242-.32.484-1.246 1.57-1.526 1.892-.281.32-.562.364-1.045.122-2.128-1.065-3.692-2.835-4.482-3.791-.257-.31-.027-.478.214-.719.222-.222.483-.564.724-.846.242-.282.322-.484.483-.807.161-.322.08-.605-.04-.847-.122-.242-1.085-2.618-1.488-3.585-.391-.937-.788-.81-1.085-.825l-.924-.015c-.322 0-.845.121-1.288.605-.443.484-1.69 1.653-1.69 4.032 0 2.378 1.732 4.675 1.973 4.997.242.322 3.411 5.21c2.19 2.223 2.186 2.221 2.204 2.628.017.382-.416 1.135-.85 1.517-.504.444-1.134.697-1.802.733-1.996.108-5.751-2.023-8.082-4.498zm-1.895-4.053c-.021-.065.044-.221.161-.403.116-.182.261-.363.383-.524.24-.316.32-.484.524-.807.039-.062.062-.124.085-.186.027-.085.051-.186-.067-.428-.119-.242-1.033-2.502-1.4-3.41-.303-.748-.616-1.29-.98-1.29-.364 0-.806 0-1.25.04a2.228 2.228 0 0 0-1.571.747c-.504.545-2.016 1.976-2.016 4.8 0 2.825 2.057 5.568 2.339 5.952.282.383 4.032 6.452 9.94 8.793 2.457.962 4.148 1.25 5.512 1.077 1.484-.19 4.036-1.654 4.598-3.267.563-1.614.563-2.985.395-3.267-.168-.282-.613-.444-1.259-.766l-4.106-2.058c-.645-.323-1.116-.484-1.5-.04-2.825 3.268-3.35 3.913-4.036 3.913-.686 0-1.372-.343-2.664-1.01-1.85-.947-3.414-2.316-4.908-4.223z"/></svg>
                WhatsApp
              </a>
           </div>
        </div>
        <div className="w-full border-t border-slate-700/50 pt-8 mt-4 text-center">
           <p className="text-xs text-slate-500">© 2026 HelaVest. All rights reserved.</p>
        </div>
      </footer>
      
      {/* WhatsApp float */}
      <div className="fixed bottom-6 right-6 z-50">
        <a href="https://chat.whatsapp.com/GebCk8EB9i259AOMQaIpmH" target="_blank" rel="noreferrer" className="block bg-[#25D366] p-4 rounded-full shadow-lg shadow-green-500/30 hover:scale-110 transition-transform">
          <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
             <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.898-4.45 9.898-9.898 0-2.64-1.026-5.119-2.894-6.985-1.87-1.868-4.349-2.895-6.99-2.895-5.448 0-9.897 4.45-9.897 9.898 0 2.128.597 4.195 1.731 6.014l-.066.11-1.127 4.103 4.22-.109.064-.061c.063-.061 1.259-.628 1.259-.628zm8.932-5.751c-.482-.242-2.85-1.408-3.292-1.57-.442-.162-.764-.242-1.085.242-.32.484-1.246 1.57-1.526 1.892-.281.32-.562.364-1.045.122-2.128-1.065-3.692-2.835-4.482-3.791-.257-.31-.027-.478.214-.719.222-.222.483-.564.724-.846.242-.282.322-.484.483-.807.161-.322.08-.605-.04-.847-.122-.242-1.085-2.618-1.488-3.585-.391-.937-.788-.81-1.085-.825l-.924-.015c-.322 0-.845.121-1.288.605-.443.484-1.69 1.653-1.69 4.032 0 2.378 1.732 4.675 1.973 4.997.242.322 3.411 5.21c2.19 2.223 2.186 2.221 2.204 2.628.017.382-.416 1.135-.85 1.517-.504.444-1.134.697-1.802.733-1.996.108-5.751-2.023-8.082-4.498zm-1.895-4.053c-.021-.065.044-.221.161-.403.116-.182.261-.363.383-.524.24-.316.32-.484.524-.807.039-.062.062-.124.085-.186.027-.085.051-.186-.067-.428-.119-.242-1.033-2.502-1.4-3.41-.303-.748-.616-1.29-.98-1.29-.364 0-.806 0-1.25.04a2.228 2.228 0 0 0-1.571.747c-.504.545-2.016 1.976-2.016 4.8 0 2.825 2.057 5.568 2.339 5.952.282.383 4.032 6.452 9.94 8.793 2.457.962 4.148 1.25 5.512 1.077 1.484-.19 4.036-1.654 4.598-3.267.563-1.614.563-2.985.395-3.267-.168-.282-.613-.444-1.259-.766l-4.106-2.058c-.645-.323-1.116-.484-1.5-.04-2.825 3.268-3.35 3.913-4.036 3.913-.686 0-1.372-.343-2.664-1.01-1.85-.947-3.414-2.316-4.908-4.223z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}
