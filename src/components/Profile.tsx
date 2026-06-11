import React, { useState } from "react";
import { User as UserIcon, ShieldCheck, Mail, Phone, Lock, Save, AlertCircle } from "lucide-react";
import { User } from "../types";

interface ProfileProps {
  user: User;
  onRefresh: () => void;
}

export default function Profile({ user, onRefresh }: ProfileProps) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({ username, email, phone }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMsg({ type: "success", text: "Profile updated successfully." });
      onRefresh();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-[#006B4A]" />
          My Profile Settings
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          Manage your personal details and account recovery options.
        </p>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold leading-relaxed flex items-start gap-3 transition-colors ${
            msg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-red-500/10 border-red-500/20 text-red-350"
          }`}
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>{msg.text}</div>
        </div>
      )}

      <form onSubmit={handleUpdate} className="bg-[#0f131d] border border-[#212a3d] rounded-2xl p-6 w-full lg:max-w-2xl space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <UserIcon className="h-3 w-3" /> Full Name
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-bold outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Mail className="h-3 w-3" /> Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-bold outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <Phone className="h-3 w-3" /> M-Pesa Phone
          </label>
          <input
            type="text"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-[#0c0f16] border border-[#212a3d] focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-bold outline-none"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-transform duration-200 active:scale-[0.99] shadow-md shadow-indigo-950/20"
          >
            {loading ? (
              <span className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Save className="h-4.5 w-4.5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
