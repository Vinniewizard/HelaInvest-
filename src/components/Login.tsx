import React, { useState } from "react";
import { Coins, LogIn, Lock, AlertCircle, ArrowRight, Activity, Wallet } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  onNavigateToRegister: () => void;
}

export default function Login({ onLoginSuccess, onNavigateToRegister }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter your credentials.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Incorrect login details.");
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-[#e8f5e9] via-[#f1f8e9] to-[#fffde7]">
      {/* Navbar area */}
      <div className="w-full h-20 px-8 flex items-center justify-between bg-white shadow-sm">
        <div className="text-xl font-bold tracking-tight text-[#006B4A]">HelaVest</div>
        <div className="flex items-center gap-4">
          <button className="text-sm font-semibold text-slate-800 hover:text-[#006B4A] transition-colors cursor-pointer">Login</button>
          <button 
            onClick={onNavigateToRegister}
            className="text-sm font-semibold text-white bg-[#006B4A] hover:bg-[#00573A] px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Create account
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-xl overflow-hidden p-8 sm:p-10 relative">
          
          <div className="mb-8 text-left">
            {(() => {
              const isAdminPath = typeof window !== "undefined" && window.location.pathname.startsWith("/secure-admin");
              return (
                <>
                  <span className={`text-[10px] font-black tracking-wider uppercase mb-2 block ${isAdminPath ? "text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block" : "text-amber-600"}`}>
                    {isAdminPath ? "Administrative Access Gateway" : "Secure Access"}
                  </span>
                  <h2 className="text-3xl font-black text-slate-950 tracking-tight">
                    {isAdminPath ? "Admin Core Entry" : "Welcome back"}
                  </h2>
                  {isAdminPath && (
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed mt-2.5">
                      Authentication required. Please authenticate below using your authorized <strong className="text-rose-750 font-black">GADMIN</strong> credentials.
                    </p>
                  )}
                </>
              );
            })()}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start gap-2 mb-6">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-600">
                Phone Number or Email address:
              </label>
              <input
                type="text"
                placeholder="e.g. 0712345678 or email@example.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-[#eef2f6] rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006B4A] transition-all font-medium text-sm border border-transparent"
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-600">
                Password:
              </label>
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#eef2f6] rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006B4A] transition-all font-medium text-sm border border-transparent"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#006B4A] hover:bg-[#00573A] text-white font-bold text-sm py-4 rounded-lg cursor-pointer flex items-center justify-center transition-all transform active:scale-[0.98] mt-6 shadow-md shadow-[#006B4A]/20"
            >
              {loading ? (
                <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                "Login"
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500">
              New here?{" "}
              <button
                onClick={onNavigateToRegister}
                className="text-[#006B4A] hover:text-[#00573A] font-semibold cursor-pointer transition-colors"
              >
                Create your account
              </button>
            </p>
          </div>
        </div>
      </div>
      
      {/* WhatsApp float */}
      <div className="fixed bottom-6 right-6">
        <a href="https://chat.whatsapp.com/GebCk8EB9i259AOMQaIpmH" target="_blank" rel="noreferrer" className="block bg-[#25D366] p-4 rounded-full shadow-lg shadow-green-500/30 hover:scale-110 transition-transform">
          <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
             <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.898-4.45 9.898-9.898 0-2.64-1.026-5.119-2.894-6.985-1.87-1.868-4.349-2.895-6.99-2.895-5.448 0-9.897 4.45-9.897 9.898 0 2.128.597 4.195 1.731 6.014l-.066.11-1.127 4.103 4.22-.109.064-.061c.063-.061 1.259-.628 1.259-.628zm8.932-5.751c-.482-.242-2.85-1.408-3.292-1.57-.442-.162-.764-.242-1.085.242-.32.484-1.246 1.57-1.526 1.892-.281.32-.562.364-1.045.122-2.128-1.065-3.692-2.835-4.482-3.791-.257-.31-.027-.478.214-.719.222-.222.483-.564.724-.846.242-.282.322-.484.483-.807.161-.322.08-.605-.04-.847-.122-.242-1.085-2.618-1.488-3.585-.391-.937-.788-.81-1.085-.825l-.924-.015c-.322 0-.845.121-1.288.605-.443.484-1.69 1.653-1.69 4.032 0 2.378 1.732 4.675 1.973 4.997.242.322 3.411 5.21c2.19 2.223 2.186 2.221 2.204 2.628.017.382-.416 1.135-.85 1.517-.504.444-1.134.697-1.802.733-1.996.108-5.751-2.023-8.082-4.498zm-1.895-4.053c-.021-.065.044-.221.161-.403.116-.182.261-.363.383-.524.24-.316.32-.484.524-.807.039-.062.062-.124.085-.186.027-.085.051-.186-.067-.428-.119-.242-1.033-2.502-1.4-3.41-.303-.748-.616-1.29-.98-1.29-.364 0-.806 0-1.25.04a2.228 2.228 0 0 0-1.571.747c-.504.545-2.016 1.976-2.016 4.8 0 2.825 2.057 5.568 2.339 5.952.282.383 4.032 6.452 9.94 8.793 2.457.962 4.148 1.25 5.512 1.077 1.484-.19 4.036-1.654 4.598-3.267.563-1.614.563-2.985.395-3.267-.168-.282-.613-.444-1.259-.766l-4.106-2.058c-.645-.323-1.116-.484-1.5-.04-2.825 3.268-3.35 3.913-4.036 3.913-.686 0-1.372-.343-2.664-1.01-1.85-.947-3.414-2.316-4.908-4.223z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}

