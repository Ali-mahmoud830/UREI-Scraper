"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Lock, Users, Settings, Key, Send, RefreshCw, Activity, Terminal, Zap, Shield, BarChart2, Clock } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─────────────────────────────────────────────────────────────────────
// Tier Feature Matrix
// ─────────────────────────────────────────────────────────────────────
const TIER_FEATURES: Record<string, { label: string; color: string; features: string[]; limit: string }> = {
  daily: {
    label: "Daily Pass",
    color: "text-slate-400 border-slate-600",
    features: ["Basic Listings", "50 Daily Searches"],
    limit: "50 searches/day"
  },
  weekly: {
    label: "Weekly Pass",
    color: "text-blue-400 border-blue-500/30",
    features: ["Basic Listings", "50 Daily Searches"],
    limit: "50 searches/day"
  },
  monthly: {
    label: "Pro Monthly",
    color: "text-indigo-400 border-indigo-500/30",
    features: ["Unlimited Searches", "CMA Price Health Badge", "Excel/CSV Export"],
    limit: "Unlimited"
  },
  yearly: {
    label: "Elite Yearly",
    color: "text-amber-400 border-amber-500/30",
    features: ["Everything in Monthly", "AI Investment Score", "Webhooks & Alerts", "White-Label Reports"],
    limit: "Unlimited + AI"
  },
  pro: {
    label: "PRO Elite",
    color: "text-purple-400 border-purple-500/30",
    features: ["Everything in Yearly", "Real-time WhatsApp Alerts", "Priority Support"],
    limit: "Unlimited + AI + Webhooks"
  },
  custom: {
    label: "Custom",
    color: "text-emerald-400 border-emerald-500/30",
    features: ["Configurable Duration", "Admin-Defined Access"],
    limit: "Custom"
  }
};

// ─────────────────────────────────────────────────────────────────────
// Skeleton Loader Row
// ─────────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="h-4 bg-slate-800 rounded w-32 mb-1" />
        <div className="h-3 bg-slate-800/60 rounded w-20" />
      </td>
      <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-12 mx-auto" /></td>
      <td className="px-6 py-4"><div className="h-5 bg-slate-800 rounded-full w-16" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-24" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-16 float-right" /></td>
      <td className="px-6 py-4"><div className="h-6 bg-slate-800 rounded-full w-full" /></td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Usage Progress Bar
// ─────────────────────────────────────────────────────────────────────
function UsageBar({ searches, tier }: { searches: number; tier: string }) {
  const limit = (tier === "monthly" || tier === "yearly" || tier === "pro") ? null : 50;
  if (!limit) {
    return <span className="text-[10px] text-emerald-400 font-semibold">∞ Unlimited</span>;
  }
  const pct = Math.min(100, Math.round((searches / limit) * 100));
  const color = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 tabular-nums w-10 text-right">{searches}/{limit}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [isLoading, setIsLoading] = useState(false);

  // Data
  const [users, setUsers] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [systemLogs, setSystemLogs] = useState<string[]>([]);

  // Forms
  const [newToken, setNewToken] = useState({ email: "", tier: "monthly", days: 30, max_users: 1, search_limit: 50 });
  const [isCompany, setIsCompany] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    setSystemLogs(prev => [`[${ts} UTC] ${msg}`, ...prev].slice(0, 100));
  }, []);

  const testAuth = async (pwd: string) => {
    addLog("Admin login attempt initiated...");
    try {
      const res = await fetch(`${API_BASE}/api/admin/config`, {
        headers: { "x-admin-password": pwd }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        const data = await res.json();
        setConfig(data.data);
        addLog("Admin authenticated successfully.");
        fetchUsers(pwd);
      } else {
        toast.error(t('admin.toast.error'));
        addLog("Admin login FAILED — invalid credentials.");
      }
    } catch {
      toast.error("Connection Error");
      addLog("Connection error during admin auth.");
    }
  };

  const fetchUsers = async (pwd = password) => {
    setIsLoading(true);
    addLog("Fetching active user roster from Supabase...");
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, { headers: { "x-admin-password": pwd } });
      if (res.ok) {
        const data = (await res.json()).data;
        setUsers(data);
        addLog(`Loaded ${data.length} user records.`);
      }
    } catch {
      addLog("ERROR: Failed to fetch user roster.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    testAuth(password);
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    addLog(`Minting ${newToken.tier.toUpperCase()} license for ${newToken.email}...`);
    try {
      const payload = { ...newToken };
      if (!isCompany) {
        payload.max_users = 1;
      }
      const res = await fetch(`${API_BASE}/api/admin/tokens/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          (t) => (
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-emerald-400">Token Generated!</span>
              <span className="text-sm font-mono bg-black p-2 rounded border border-slate-700 select-all">{data.token}</span>
              <span className="text-xs text-slate-400">Email sent to {newToken.email}</span>
            </div>
          ),
          { duration: 20000, style: { minWidth: '300px' } }
        );
        addLog(`SUCCESS: Token minted for ${newToken.email} — tier: ${newToken.tier}, days: ${newToken.days}`);
        setNewToken({ ...newToken, email: "" });

        // Force un-cached fetch by attaching a timestamp
        const refreshRes = await fetch(`${API_BASE}/api/admin/users?ts=${Date.now()}`, { headers: { "x-admin-password": password } });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setUsers(refreshData.data);
        }
      } else {
        toast.error(data.detail || "Error generating token");
        addLog(`ERROR: Token mint FAILED for ${newToken.email} — ${data.detail}`);
      }
    } catch {
      toast.error("Failed to generate token");
      addLog("ERROR: Network failure during token generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateConfig = async (key: string, value: any) => {
    const t = toast.loading("Updating config...");
    addLog(`Updating config: ${key} = ${value}`);
    try {
      const res = await fetch(`${API_BASE}/api/admin/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ key, value })
      });
      if (res.ok) {
        toast.success("Config updated", { id: t });
        setConfig({ ...config, [key]: value });
        addLog(`Config update SUCCESS: ${key}`);
      } else {
        toast.error("Update failed", { id: t });
        addLog(`Config update FAILED: ${key}`);
      }
    } catch {
      toast.error("Network error", { id: t });
      addLog(`Network error updating config: ${key}`);
    }
  };

  const tierInfo = TIER_FEATURES[newToken.tier] || TIER_FEATURES.monthly;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-neutral-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-6">Admin Access</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Enter Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-slate-700 rounded-xl py-3 px-4 text-center text-white focus:border-indigo-500 focus:outline-none"
            />
            <button type="submit" className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-neutral-200 transition-colors">
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">PropPulse Elite Shell</h1>
          <p className="text-slate-400 mt-1">Global Resource Management — Phase 4 RBAC</p>
        </div>
        <div className="flex flex-wrap gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          {[
            { id: "users", icon: <Users className="w-4 h-4" />, label: "Users" },
            { id: "tokens", icon: <Key className="w-4 h-4" />, label: "Tokens" },
            { id: "config", icon: <Settings className="w-4 h-4" />, label: "Config" },
            { id: "logs", icon: <Terminal className="w-4 h-4" />, label: "Logs" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">

          {/* USERS TAB */}
          {activeTab === "users" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" /> Active Users & Tokens
                </h3>
                <button onClick={() => fetchUsers()} className="text-slate-400 hover:text-white">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Email / Last Active IP</th>
                      <th className="px-6 py-4 font-medium text-center">Searches</th>
                      <th className="px-6 py-4 font-medium">Tier</th>
                      <th className="px-6 py-4 font-medium">Token</th>
                      <th className="px-6 py-4 font-medium text-right">Status</th>
                      <th className="px-6 py-4 font-medium min-w-[140px]">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {isLoading ? (
                      Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                    ) : users.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No users found. Generate a token first.</td></tr>
                    ) : (
                      users.map((u: any, i) => (
                        <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium">{u.email || "Anonymous"}</div>
                            <div className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <Activity className="w-2.5 h-2.5" /> {u.ip_address || "–"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-mono">{u.total_searches ?? 0}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${u.tier === 'yearly' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              u.tier === 'monthly' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                u.tier === 'pro' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                  'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                              {u.tier || "Trial"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-300 font-mono text-xs select-all">{u.token_code || 'N/A'}</td>
                          <td className="px-6 py-4 text-right">
                            {(u.expires_at && new Date(u.expires_at.replace("Z", "+00:00")) > new Date()) ? (
                              <span className="text-emerald-400 text-xs flex items-center justify-end gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
                              </span>
                            ) : (
                              <span className="text-rose-400 text-xs flex items-center justify-end gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Expired
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <UsageBar searches={u.total_searches ?? 0} tier={u.tier || "daily"} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CONFIG TAB */}
          {activeTab === "config" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-slate-800 pb-4">
                <Settings className="w-5 h-5 text-indigo-400" /> Global Variables
              </h3>
              <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <h4 className="font-medium text-white">Enable Free Trials</h4>
                  <p className="text-sm text-slate-500">Allow unauthenticated users to search up to the limit.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={config?.TRIAL_ENABLED === true} onChange={(e) => handleUpdateConfig("TRIAL_ENABLED", e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                </label>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex-1 pr-6">
                  <h4 className="font-medium text-white">Free Result Limit</h4>
                  <p className="text-sm text-slate-500 mb-3">Max leads per search for unauthenticated trial users. Default: 50</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min="0" max="200"
                      value={config?.FREE_RESULT_LIMIT === 0 ? "" : (config?.FREE_RESULT_LIMIT ?? 50)}
                      onChange={(e) => setConfig({ ...config, FREE_RESULT_LIMIT: e.target.value ? parseInt(e.target.value) : 0 })}
                      className="bg-black border border-slate-700 rounded-lg px-3 py-1.5 w-24 text-center focus:border-indigo-500 focus:outline-none"
                    />
                    <button onClick={() => handleUpdateConfig("FREE_RESULT_LIMIT", parseInt(config?.FREE_RESULT_LIMIT || "50"))} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors text-white">Save</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TOKENS TAB */}
          {activeTab === "tokens" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 text-center text-slate-400 h-64 flex flex-col items-center justify-center">
              <Key className="w-12 h-12 mb-4 text-slate-700" />
              <p>Use the generator on the right to mint new subscription tokens.</p>
            </div>
          )}

          {/* SYSTEM LOGS TAB */}
          {activeTab === "logs" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-amber-400" /> System Logs
                  <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">{systemLogs.length} entries</span>
                </h3>
                <button onClick={() => setSystemLogs([])} className="text-xs text-slate-500 hover:text-rose-400 transition-colors">Clear</button>
              </div>
              <div className="font-mono text-xs text-slate-400 p-4 h-80 overflow-y-auto flex flex-col gap-1 bg-black/30">
                {systemLogs.length === 0 ? (
                  <div className="text-center text-slate-600 pt-8">No logs yet. Actions will be recorded here.</div>
                ) : systemLogs.map((log, i) => (
                  <div key={i} className={`${log.includes("ERROR") ? "text-rose-400" : log.includes("SUCCESS") ? "text-emerald-400" : "text-slate-400"}`}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Token Generator */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/20 p-6 rounded-2xl shadow-xl shadow-black/50">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2"><Send className="w-5 h-5 text-indigo-400" /> Mint License Key</h3>
            <form onSubmit={handleCreateToken} className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">User Email</label>
                <input
                  type="email" required placeholder="client@company.com"
                  value={newToken.email}
                  onChange={(e) => setNewToken({ ...newToken, email: e.target.value })}
                  className="w-full bg-black/40 border border-indigo-500/30 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Subscription Tier</label>
                <div className="flex gap-2">
                  <select
                    value={newToken.tier}
                    onChange={(e) => {
                      const val = e.target.value;
                      let d = newToken.days;
                      if (val === 'daily') d = 1;
                      if (val === 'weekly') d = 7;
                      if (val === 'monthly') d = 30;
                      if (val === 'yearly') d = 365;
                      setNewToken({ ...newToken, tier: val, days: d });
                    }}
                    className="w-1/2 bg-black/40 border border-indigo-500/30 rounded-lg py-2.5 px-3 text-white focus:border-indigo-400 focus:outline-none appearance-none text-sm"
                  >
                    <option value="daily">Daily Pass</option>
                    <option value="weekly">Weekly Pass</option>
                    <option value="monthly">Pro Monthly</option>
                    <option value="yearly">Elite Yearly</option>
                    <option value="pro">PRO Elite</option>
                    <option value="custom">Custom</option>
                  </select>
                  <div className="w-1/2 relative">
                    <input
                      type="number" min="1"
                      value={newToken.days === 0 ? "" : newToken.days}
                      onChange={(e) => setNewToken({ ...newToken, tier: 'custom', days: e.target.value ? parseInt(e.target.value) : 0 })}
                      className="w-full bg-black/40 border border-indigo-500/30 rounded-lg py-2.5 pl-3 pr-10 text-white focus:border-indigo-400 focus:outline-none text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold uppercase">Days</span>
                  </div>
                </div>
              </div>

              {/* Max Searches — Always visible, admin always sets this */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart2 className="w-3 h-3" /> Max Searches Allowed
                </label>
                <input
                  type="number" min="1" required
                  value={newToken.search_limit === 0 ? "" : newToken.search_limit}
                  onChange={(e) => setNewToken({ ...newToken, search_limit: e.target.value ? parseInt(e.target.value) : 0 })}
                  className="w-full bg-black/40 border border-amber-500/40 rounded-lg py-2.5 px-3 text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 text-sm"
                />
                <p className="text-[10px] text-slate-500">The total number of scrape sessions this token can run.</p>
              </div>

              {/* Company Token Option */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white">Company Token</h4>
                    <p className="text-xs text-slate-500">Allow multiple users to share this license.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
                {isCompany && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Max Users</label>
                    <input
                      type="number" min="2"
                      value={newToken.max_users === 0 ? "" : newToken.max_users}
                      onChange={(e) => setNewToken({ ...newToken, max_users: e.target.value ? parseInt(e.target.value) : 0 })}
                      className="w-full bg-black/40 border border-indigo-500/30 rounded-lg py-2.5 px-3 text-white focus:border-indigo-400 focus:outline-none text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Feature Preview Panel */}
              <div className={`border rounded-xl p-4 space-y-2 transition-all bg-black/20 ${tierInfo.color.split(" ")[1] || "border-slate-700"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Feature Preview</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${tierInfo.color}`}>{tierInfo.label}</span>
                </div>
                {tierInfo.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <Zap className="w-3 h-3 text-emerald-400 flex-shrink-0" /> {f}
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800 mt-2">
                  <BarChart2 className="w-3 h-3" /> Search Cap: <span className="text-amber-400 font-bold">{newToken.search_limit} searches</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3 h-3" /> Duration: <span className="text-white font-semibold">{newToken.days} day{newToken.days !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {isGenerating ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Minting...</>
                ) : (
                  <><Send className="w-4 h-4" /> Generate Token</>
                )}
              </button>
              <p className="text-xs text-slate-500 text-center mt-4">
                Token generated, instantly emailed, and added to Active Users above.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
