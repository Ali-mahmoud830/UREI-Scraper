"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import toast from "react-hot-toast";

export default function LandingPage() {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if already authenticated via HttpOnly cookie
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/status");
        const data = await res.json();
        if (data.user) {
          router.push("/dashboard");
        }
      } catch (e) { }
    };
    checkAuth();
  }, [router]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return toast.error("Please enter a valid license token");

    setIsLoading(true);
    try {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        toast.success("License Activated Successfully!");
        router.push("/dashboard");
      } else {
        toast.error(data.detail || data.message || "Invalid token");
      }
    } catch (error) {
      toast.error("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-black text-white">
      <div className="max-w-md w-full text-center space-y-8">

        <div className="space-y-4">
          <div className="mx-auto bg-indigo-500/10 w-24 h-24 rounded-3xl flex items-center justify-center border border-indigo-500/20 shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]">
            <ShieldCheck className="w-12 h-12 text-indigo-400" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">
            PropPulse <span className="text-indigo-400">Elite</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Uncover Real Estate Leads in Seconds.
          </p>
        </div>

        <form onSubmit={handleRedeem} className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="space-y-2 text-left">
            <label className="text-sm font-medium text-gray-400 ml-1">License Key</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                className="w-full bg-black/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all uppercase tracking-widest font-mono text-center"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {isLoading ? "Verifying..." : "Redeem License"}
            {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="pt-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-2 mx-auto transition-colors"
          >
            <Zap className="w-4 h-4 text-emerald-500" />
            Continue with Free Trial
          </button>
        </div>

      </div>
    </main>
  );
}
