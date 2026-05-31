import React, { useState, useEffect } from "react";
import { ShieldCheck, Users, Wallet, ListTodo, Plus, Check, X, ToggleLeft, ToggleRight, Sparkles, Server } from "lucide-react";
import { Transaction, Investment, Plan } from "../types";

interface AdminHubProps {
  onRefresh: () => void;
}

interface AdminUserSummary {
  id: string;
  username: string;
  email: string;
  phone: string;
  referralCode: string;
  referredBy?: string;
  isAdmin: boolean;
  balance: number;
}

export default function AdminHub({ onRefresh }: AdminHubProps) {
  const [activeAdminTab, setActiveAdminTab] = useState<"users" | "transactions" | "investments" | "plans">("transactions");

  // State data loaded directly
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Messages and loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Plan Form State
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanAmount, setNewPlanAmount] = useState("");
  const [newPlanReturn, setNewPlanReturn] = useState("");
  const [newPlanDays, setNewPlanDays] = useState("");
  const [newPlanDesc, setNewPlanDesc] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const loadAdminState = async () => {
    try {
      const h_id = localStorage.getItem("hela_user_id") || "";
      const opt = { headers: { "x-user-id": h_id } };

      const [usersRes, txsRes, invRes, plansRes] = await Promise.all([
        fetch("/api/admin/users", opt),
        fetch("/api/admin/transactions", opt),
        fetch("/api/admin/investments", opt),
        fetch("/api/plans"),
      ]);

      const uData = await usersRes.json();
      const tData = await txsRes.json();
      const iData = await invRes.json();
      const pData = await plansRes.json();

      if (uData.users) setUsers(uData.users);
      if (tData.transactions) setTxs(tData.transactions);
      if (iData.investments) setInvestments(iData.investments);
      if (pData.plans) setPlans(pData.plans);
    } catch (err) {
      console.error("Failed to load admin logs", err);
    }
  };

  useEffect(() => {
    loadAdminState();
  }, []);

  const handleTxApprove = async (id: string) => {
    setActionLoading(id);
    setMsg(null);
    try {
      const response = await fetch(`/api/admin/transactions/${id}/approve`, {
        method: "POST",
        headers: { "x-user-id": localStorage.getItem("hela_user_id") || "" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMsg({ type: "success", text: "Transaction successfully verified and approved." });
      await loadAdminState();
      onRefresh();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to approve transaction." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTxDecline = async (id: string) => {
    setActionLoading(id);
    setMsg(null);
    try {
      const response = await fetch(`/api/admin/transactions/${id}/decline`, {
        method: "POST",
        headers: { "x-user-id": localStorage.getItem("hela_user_id") || "" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMsg({ type: "success", text: "Transaction request declined." });
      await loadAdminState();
      onRefresh();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to decline." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvComplete = async (id: string) => {
    setActionLoading(id);
    setMsg(null);
    try {
      const response = await fetch(`/api/admin/investments/${id}/complete`, {
        method: "POST",
        headers: { "x-user-id": localStorage.getItem("hela_user_id") || "" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMsg({ type: "success", text: "Trade forced to maturity successfully! Payout credited to user." });
      await loadAdminState();
      onRefresh();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to trigger." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvCancel = async (id: string) => {
    setActionLoading(id);
    setMsg(null);
    try {
      const response = await fetch(`/api/admin/investments/${id}/cancel`, {
        method: "POST",
        headers: { "x-user-id": localStorage.getItem("hela_user_id") || "" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMsg({ type: "success", text: "Trade cancelled. User's seed capital refunded to their account ledger." });
      await loadAdminState();
      onRefresh();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to cancel." });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePlanToggle = async (id: string) => {
    setActionLoading(id);
    setMsg(null);
    try {
      const response = await fetch(`/api/admin/plans/${id}/toggle`, {
        method: "POST",
        headers: { "x-user-id": localStorage.getItem("hela_user_id") || "" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      await loadAdminState();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed key toggle." });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!newPlanName || !newPlanAmount || !newPlanReturn || !newPlanDays) {
      setMsg({ type: "error", text: "Please enter all structural inputs." });
      return;
    }

    try {
      const url = editingPlanId ? `/api/admin/plans/${editingPlanId}/edit` : "/api/admin/plans/create";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": localStorage.getItem("hela_user_id") || "",
        },
        body: JSON.stringify({
          name: newPlanName,
          amount: Number(newPlanAmount),
          return_amount: Number(newPlanReturn),
          duration_days: Number(newPlanDays),
          description: newPlanDesc,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMsg({ type: "success", text: `Package ${newPlanName} successfully ${editingPlanId ? "updated" : "seeded"} in Marketplace!` });
      resetPlanForm();
      await loadAdminState();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || `Failed to ${editingPlanId ? "update" : "create"} package plan.` });
    }
  };

  const handleEditPlanClick = (p: Plan) => {
    setEditingPlanId(p.id);
    setNewPlanName(p.name);
    setNewPlanAmount(p.amount.toString());
    setNewPlanReturn(p.return_amount.toString());
    setNewPlanDays(p.duration_days.toString());
    setNewPlanDesc(p.description || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetPlanForm = () => {
    setEditingPlanId(null);
    setNewPlanName("");
    setNewPlanAmount("");
    setNewPlanReturn("");
    setNewPlanDays("");
    setNewPlanDesc("");
  };

  const handleDeletePlan = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete the package "${name}"?`)) return;
    setActionLoading(id);
    setMsg(null);
    try {
      const response = await fetch(`/api/admin/plans/${id}/delete`, {
        method: "POST",
        headers: { "x-user-id": localStorage.getItem("hela_user_id") || "" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMsg({ type: "success", text: "Package successfully deleted." });
      if (editingPlanId === id) resetPlanForm();
      await loadAdminState();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to delete plan." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDatabaseReset = async () => {
    if (!window.confirm("Restore entire sandbox database to pre-seeded clean defaults? All custom registrations will clear.")) return;
    try {
      const response = await fetch("/api/admin/reset", {
        method: "POST",
      });
      await loadAdminState();
      onRefresh();
      setMsg({ type: "success", text: "Database safely reset." });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="bg-red-500/5 border border-red-500/20 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
            <ShieldCheck className="h-5 text-red-400 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
              HelaVest Administrator Command Console
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Validate pending member deposits/withdrawals, reset state data, or manage yield packages.
            </p>
          </div>
        </div>

        <button
          onClick={handleDatabaseReset}
          className="bg-red-950/20 hover:bg-red-900/30 text-rose-300 font-bold border border-red-550/30 font-mono text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
        >
          Reset Sandbox Database
        </button>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl border text-xs leading-relaxed font-semibold flex items-center gap-3 ${
            msg.type === "success"
              ? "bg-[#0b251a] border-emerald-500/10 text-emerald-300"
              : "bg-red-500/10 border-red-500/20 text-red-300"
          }`}
        >
          <span>{msg.text}</span>
        </div>
      )}

      {/* Selector Subtabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#212a3d] pb-0.5 pt-1">
        {[
          { id: "transactions", label: "Financial Approvals Queue", icon: Wallet },
          { id: "investments", label: "Active Trade Controller", icon: ListTodo },
          { id: "users", label: "Registrations & Balances", icon: Users },
          { id: "plans", label: "Yield Packages & Seeding", icon: Server },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeAdminTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveAdminTab(tab.id as any);
                setMsg(null);
              }}
              className={`pb-3 px-2.5 text-xs font-bold tracking-wider relative transition-colors cursor-pointer flex items-center gap-2 ${
                isActive ? "text-red-400 font-black" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-450 rounded-full"></div>}
            </button>
          );
        })}
      </div>

      {/* Tab contents */}

      {/* Financial Queue */}
      {activeAdminTab === "transactions" && (
        <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl overflow-hidden">
          <div className="p-4 bg-[#0c0f16] border-b border-[#212a3d]/70">
            <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Pending and Complete Ledger Requests
            </h3>
          </div>

          {txs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">No transaction requests in ledger history.</div>
          ) : (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#0c0f16] text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-[#212a3d]">
                    <th className="p-4 font-semibold">User</th>
                    <th className="p-4 font-semibold">Transfer Type</th>
                    <th className="p-4 font-semibold">Phone (M-Pesa)</th>
                    <th className="p-4 font-semibold">Amount</th>
                    <th className="p-4 font-semibold">Satus</th>
                    <th className="p-4 font-semibold text-right">Verification Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#212a3d]/50">
                  {txs.map((tx) => {
                    const isPending = tx.status === "pending";
                    return (
                      <tr key={tx.id} className="hover:bg-[#121824]/30 font-medium">
                        <td className="p-4 flex flex-col gap-0.5">
                          <span className="font-bold text-slate-200">{tx.username}</span>
                          <span className="text-[10px] text-slate-500 font-mono">ID: {tx.user_id}</span>
                        </td>
                        <td className="p-4">
                          <span className="capitalize font-bold text-slate-200">{tx.transaction_type}</span>
                          <span className="block text-[10px] text-slate-500 max-w-[150px] truncate">{tx.note}</span>
                        </td>
                        <td className="p-4 font-mono text-slate-400">{tx.phone || "None"}</td>
                        <td className="p-4 font-mono font-bold text-slate-200">KSh {tx.amount.toLocaleString()}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${
                              tx.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : tx.status === "declined"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {isPending ? (
                            <div className="inline-flex gap-1.5 justify-end">
                              <button
                                onClick={() => handleTxApprove(tx.id)}
                                disabled={actionLoading !== null}
                                className="bg-[#0b251a] hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 text-[10px] font-extrabold uppercase px-2.5 py-1.5 rounded-lg border border-emerald-500/20 cursor-pointer flex items-center gap-1 transition-all"
                              >
                                <Check className="h-3 w-3" /> Approve
                              </button>
                              <button
                                onClick={() => handleTxDecline(tx.id)}
                                disabled={actionLoading !== null}
                                className="bg-red-500/10 hover:bg-red-600 hover:text-white text-rose-400 text-[10px] font-extrabold uppercase px-2.5 py-1.5 rounded-lg border border-red-500/20 cursor-pointer flex items-center gap-1 transition-all"
                              >
                                <X className="h-3 w-3" /> Decline
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[10px] italic">Processed</span>
                          )}
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

      {/* Active Trades Controller */}
      {activeAdminTab === "investments" && (
        <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl overflow-hidden">
          <div className="p-4 bg-[#0c0f16] border-b border-[#212a3d]/70">
            <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Simulated Server Active Trades
            </h3>
          </div>

          {investments.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">No investment logs in history.</div>
          ) : (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#0c0f16] text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-[#212a3d]">
                    <th className="p-4 font-semibold">User</th>
                    <th className="p-4 font-semibold">Tier Plan</th>
                    <th className="p-4 font-semibold">Capital Principal</th>
                    <th className="p-4 font-semibold">Maturity Return</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Force Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#212a3d]/50">
                  {investments.map((inv) => {
                    const isActive = inv.status === "active";
                    return (
                      <tr key={inv.id} className="hover:bg-[#121824]/30 font-medium">
                        <td className="p-4 font-bold text-slate-200">{inv.username}</td>
                        <td className="p-4 font-bold text-slate-200">
                          {inv.planName}
                          <span className="block text-[10px] text-slate-500 font-mono font-medium">
                            Matures: {new Date(inv.matures_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-400">KSh {inv.amount.toLocaleString()}</td>
                        <td className="p-4 font-mono font-bold text-emerald-400">KSh {inv.return_amount.toLocaleString()}</td>
                        <td className="p-4 text-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${
                              inv.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/10"
                                : inv.status === "cancelled"
                                ? "bg-rose-500/10 text-rose-450 border-rose-500/15"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/15"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {isActive ? (
                            <div className="inline-flex gap-1 justify-end">
                              <button
                                onClick={() => handleInvComplete(inv.id)}
                                disabled={actionLoading !== null}
                                className="bg-[#0b251a] hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg border border-emerald-500/20 cursor-pointer flex items-center gap-1 transition-all"
                              >
                                Complete Early
                              </button>
                              <button
                                onClick={() => handleInvCancel(inv.id)}
                                disabled={actionLoading !== null}
                                className="bg-red-500/10 hover:bg-red-600 hover:text-white text-rose-400 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg border border-red-500/15 cursor-pointer flex items-center gap-1 transition-all"
                              >
                                Cancel & Refund
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[10px] italic">No active actions</span>
                          )}
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

      {/* Registrations & Balances */}
      {activeAdminTab === "users" && (
        <div className="bg-[#0f131d] border border-[#212a3d] rounded-2xl overflow-hidden">
          <div className="p-4 bg-[#0c0f16] border-b border-[#212a3d]/70">
            <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Enrolled Members database logs
            </h3>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#0c0f16] text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-[#212a3d]">
                  <th className="p-4 font-semibold">Username</th>
                  <th className="p-4 font-semibold">Email</th>
                  <th className="p-4 font-semibold">Phone</th>
                  <th className="p-4 font-semibold">Referral Code</th>
                  <th className="p-4 font-semibold text-right">Wallet Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#212a3d]/50 text-slate-300 font-medium">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#121824]/30">
                    <td className="p-4 font-bold text-slate-200">
                      {u.username}{" "}
                      {u.isAdmin && (
                        <span className="bg-red-500/15 border border-red-500/20 text-red-400 text-[9px] px-1.5 py-0.2 rounded font-mono ml-1 font-bold">
                          ADMIN
                        </span>
                      )}
                    </td>
                    <td className="p-4">{u.email}</td>
                    <td className="p-4 font-mono">{u.phone}</td>
                    <td className="p-4 font-mono font-bold text-slate-400">
                      {u.referralCode}
                      {u.referredBy && <span className="block text-[9px] text-slate-500 normale">Referred by ID: {u.referredBy}</span>}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-450">KSh {u.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Yield Packages Manager & Creation */}
      {activeAdminTab === "plans" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Seeder form */}
          <form onSubmit={handlePlanSubmit} className="lg:col-span-5 bg-[#0f131d] border border-[#212a3d] rounded-2xl p-6 space-y-4 font-medium">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-tight flex items-center gap-1.5">
                  <Plus className="h-4.5 w-4.5 text-red-450" />
                  {editingPlanId ? "Edit Package" : "Seed New Package"}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {editingPlanId ? "Update package parameters." : "Deploy active dynamic items instantly to the marketplace cards."}
                </p>
              </div>
              {editingPlanId && (
                <button type="button" onClick={resetPlanForm} className="text-xs text-red-400 hover:text-red-300 font-bold ml-2">Cancel</button>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan Display Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Diamond (VIP)"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/40 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-bold outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Price Capital (KSh) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 50000"
                  value={newPlanAmount}
                  onChange={(e) => setNewPlanAmount(e.target.value)}
                  className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/40 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-bold outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Return Payout (KSh) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 100000"
                  value={newPlanReturn}
                  onChange={(e) => setNewPlanReturn(e.target.value)}
                  className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/40 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-bold outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duration Cycle (Days) *</label>
              <input
                type="number"
                required
                placeholder="e.g. 14"
                value={newPlanDays}
                onChange={(e) => setNewPlanDays(e.target.value)}
                className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/40 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-bold outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
              <input
                type="text"
                placeholder="Short descriptive tagline"
                value={newPlanDesc}
                onChange={(e) => setNewPlanDesc(e.target.value)}
                className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-red-500/40 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-medium outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-red-500 hover:bg-red-400 text-[#0c0f16] font-bold text-xs flex items-center justify-center gap-2 transition-transform duration-200 cursor-pointer active:scale-[0.99] shadow-md shadow-red-950/20"
            >
              <Plus className="h-4 w-4" />
              {editingPlanId ? "Update Yield Package" : "Build Yield Package"}
            </button>
          </form>

          {/* Configuration List (7 cols) */}
          <div className="lg:col-span-7 bg-[#0f131d] border border-[#212a3d] rounded-2xl overflow-hidden text-xs">
            <div className="p-4 bg-[#0c0f16] border-b border-[#212a3d]/70">
              <h3 className="text-xs font-extrabold text-slate-350 uppercase tracking-wider">
                Existing marketplace packages
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-medium">
                <thead>
                  <tr className="bg-[#0c0f16] text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-[#212a3d]">
                    <th className="p-4 font-semibold whitespace-nowrap">Tier Plan</th>
                    <th className="p-4 font-semibold whitespace-nowrap">Capital Required</th>
                    <th className="p-4 font-semibold whitespace-nowrap">Return Payout</th>
                    <th className="p-4 font-semibold whitespace-nowrap">Cycle</th>
                    <th className="p-4 font-semibold text-right whitespace-nowrap">Visibility Action</th>
                    <th className="p-4 font-semibold text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#212a3d]/50 text-slate-300">
                  {plans.map((p) => (
                    <tr key={p.id} className="hover:bg-[#121824]/30">
                      <td className="p-4 font-bold text-slate-200 whitespace-nowrap">{p.name}</td>
                      <td className="p-4 font-mono font-bold text-slate-400 whitespace-nowrap">KSh {p.amount.toLocaleString()}</td>
                      <td className="p-4 font-mono font-bold text-emerald-450 whitespace-nowrap">KSh {p.return_amount.toLocaleString()}</td>
                      <td className="p-4 font-mono font-bold text-slate-200 whitespace-nowrap">{p.duration_days} Days</td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handlePlanToggle(p.id)}
                          disabled={actionLoading !== null}
                          className={`inline-flex items-center gap-1 text-[9px] uppercase font-mono font-black border tracking-wider rounded-lg px-2 py-1 cursor-pointer transition-colors ${
                            p.active
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800"
                          }`}
                        >
                          {p.active ? "Visible" : "Hidden"}
                        </button>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditPlanClick(p)}
                          className="bg-slate-700 hover:bg-slate-600 text-white text-[9px] uppercase px-2 py-1 rounded-lg cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePlan(p.id, p.name)}
                          disabled={actionLoading !== null}
                          className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] uppercase px-2 py-1 rounded-lg cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
