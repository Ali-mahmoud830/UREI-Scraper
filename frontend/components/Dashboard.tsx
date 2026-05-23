"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { Play, Square, Download, Activity, Phone, DollarSign, MapPin, ExternalLink, Search, ChevronDown, Check, Bell, X, AlertCircle, Zap } from "lucide-react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "../lib/supabase";

type Lead = {
  phone: string;
  price: string;
  location: string;
  url: string;
  status: string;
  intent?: string;
  timestamp?: string;
};

// Python backend API used solely for orchestrating Playwright scraping workers and redeeming licenses.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://ali-mahmoud-830-urei-scraper-api.hf.space";

const AVAILABLE_SITES = [
  { id: "all", label: "All Sites" },
  { id: "dubizzle", label: "Dubizzle" },
  { id: "propertyfinder", label: "Property Finder" },
  { id: "aqarmap", label: "Aqarmap" },
  { id: "bayut", label: "Bayut Egypt" },
  { id: "semsarmasr", label: "Semsar Masr" },
  { id: "shofaqar", label: "Shofaqar" },
  { id: "realestate", label: "Real Estate Egypt" },
  { id: "facebook", label: "Facebook Groups (Google)" }
];

const CountdownTimer = ({ expiresAt }: { expiresAt: string }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTime = () => {
      const expiry = new Date(expiresAt.endsWith('Z') ? expiresAt : expiresAt + 'Z').getTime();
      const diff = expiry - new Date().getTime();
      if (diff <= 0) return "Subscription Expired";
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return `${days} Days, ${hours} Hours remaining`;
    };
    setTimeLeft(calculateTime());
    const timer = setInterval(() => setTimeLeft(calculateTime()), 60000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-2 mt-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full w-fit">
      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
      <span className="text-xs font-semibold text-emerald-400 tracking-wide uppercase">{timeLeft}</span>
    </div>
  );
};

export default function Dashboard() {
  const [isScraping, setIsScraping] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchCity, setSearchCity] = useState("");
  const [propertyType, setPropertyType] = useState("both");
  const [timeFilter, setTimeFilter] = useState("all");
  const [targetAudience, setTargetAudience] = useState("sellers");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState({ total_leads: 0, verified_phones: 0, avg_price: 0 });
  const [selectedSites, setSelectedSites] = useState<string[]>(["all"]);
  const [isSiteMenuOpen, setIsSiteMenuOpen] = useState(false);

  // Smart Alerts State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [savedAlerts, setSavedAlerts] = useState<any[]>([]);
  const [alertForm, setAlertForm] = useState({ min_price: "", max_price: "" });
  const [isSavingAlert, setIsSavingAlert] = useState(false);
  const [authStatus, setAuthStatus] = useState<any>({ user: null, trial_enabled: true, free_limit: 5 });
  const siteMenuRef = useRef<HTMLDivElement>(null);

  const getPriceHealth = (leadPrice: string | null, leadLocation: string) => {
    if (!authStatus.user) return null; // CMA Requires Monthly/Pro Tier
    if (!leadPrice || leadPrice === 'Buyer Target') return null;
    const numPrice = Number(String(leadPrice).replace(/[^\d]/g, ''));
    if (!numPrice || isNaN(numPrice)) return null;

    const locData = analyticsData.find(a => a.originalLoc === leadLocation);
    let cmaAvg = locData?.avg_price;

    if (!cmaAvg || cmaAvg <= 0) {
      cmaAvg = globalStats.avg_price; // Fallback to global CMA
    }

    if (cmaAvg > 0) {
      if (numPrice <= cmaAvg * 0.85) return { label: 'Below Market', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      if (numPrice >= cmaAvg * 1.15) return { label: 'Overpriced', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
      return { label: 'Fair Price', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    }
    return null;
  };

  useEffect(() => {
    // Check Auth Status locally + fallback API verification
    const fetchAlerts = async (email: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/alerts?user_email=${encodeURIComponent(email)}`);
        const json = await res.json();
        if (json.status === "success") setSavedAlerts(json.alerts || []);
      } catch (e) {
        console.error("Failed to fetch alerts", e);
      }
    };

    const checkAuthStatus = async () => {
      const token = localStorage.getItem("session_key");
      try {
        if (token) {
          // Correct approach: call the backend which decodes the JWT and returns the real user tier.
          // DO NOT query Supabase directly with the JWT — the DB stores the raw session key, not the JWT string.
          const res = await fetch(`${API_BASE}/api/auth/status`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              setAuthStatus({
                user: { email: data.user.email, tier: data.user.tier, expires_at: data.user.expires_at },
                trial_enabled: true,
                free_limit: data.free_limit || 50
              });
              if (data.user.email) fetchAlerts(data.user.email);
              return;
            }
          } else {
            // Token invalid/expired — clear it so the user isn't stuck in a broken state
            if (res.status === 401 || res.status === 403) {
              localStorage.removeItem("session_key");
            }
          }
        }

        const { data: configRows } = await supabase.from('admin_config').select('*');
        const trialEnabled = configRows?.find(r => r.key === 'TRIAL_ENABLED')?.value === 'true';
        const freeLimit = parseInt(configRows?.find(r => r.key === 'FREE_RESULT_LIMIT')?.value || '50');
        setAuthStatus({ user: null, trial_enabled: trialEnabled, free_limit: freeLimit });
      } catch (e) { console.error("Auth check failed", e); }
    };
    checkAuthStatus();

    const handleClickOutside = (event: MouseEvent) => {
      if (siteMenuRef.current && !siteMenuRef.current.contains(event.target as Node)) {
        setIsSiteMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Supabase Polling Subscriptions (Bypasses Python backend)
    const fetchData = async () => {
      // Fetch History with real lead counts (single batch query, no N+1)
      const { data: sessions } = await supabase
        .from('search_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (sessions && sessions.length > 0) {
        // Batch fetch all session_leads for the sessions we have
        const sessionIds = sessions.map((s: any) => s.id);
        const { data: sessionLeadsData } = await supabase
          .from('session_leads')
          .select('session_id')
          .in('session_id', sessionIds);

        // Count per session locally
        const countMap: Record<number, number> = {};
        sessionLeadsData?.forEach((row: any) => {
          countMap[row.session_id] = (countMap[row.session_id] || 0) + 1;
        });

        const sessionsWithCounts = sessions.map((s: any) => ({
          ...s,
          lead_count: countMap[s.id] ?? 0
        }));
        setSearchHistory(sessionsWithCounts);
      } else if (sessions) {
        setSearchHistory(sessions);
      }


      // Fetch Global Stats rapidly
      const { count: leadCount } = await supabase.from('leads').select('*', { count: 'exact', head: true });
      const { data: priceData } = await supabase.from('leads').select('price').neq('price', 'Buyer Target').not('price', 'is', null).limit(100);

      let sum = 0;
      let validPrices = 0;
      priceData?.forEach(row => {
        const m = String(row.price).replace(/[^\d]/g, '');
        if (m) { sum += parseInt(m); validPrices++; }
      });
      const avg = validPrices > 0 ? sum / validPrices : 0;

      setGlobalStats({
        total_leads: leadCount || 0,
        verified_phones: leadCount || 0,
        avg_price: avg
      });
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Polling-based live feed — works without Supabase Replication being enabled.
    // Every 3 seconds we query leads newer than the latest timestamp we've seen.
    const displayLimit = authStatus.user ? 50 : (authStatus.free_limit || 5);
    let latestTimestamp: string | null = null;

    const fetchLeads = async (initial = false) => {
      let query = supabase
        .from('leads')
        .select('*')
        .order('timestamp', { ascending: false });

      if (currentSessionId) {
        query = query.eq('session_id', currentSessionId);
      }

      if (!initial && latestTimestamp) {
        // Only fetch rows newer than what we've already seen
        query = query.gt('timestamp', latestTimestamp);
      } else {
        // Initial load: bring in most recent rows up to displayLimit
        query = query.limit(displayLimit);
      }

      const { data, error } = await query;
      if (error) { console.error('Leads fetch error:', error); return; }
      if (!data || data.length === 0) return;

      // Update cursor to the most recent timestamp
      const newest = data[0]?.timestamp;
      if (newest) latestTimestamp = newest;

      if (initial) {
        setLeads(data);
      } else {
        setLeads(prev => {
          const merged = [...data, ...prev];
          return authStatus.user ? merged : merged.slice(0, displayLimit);
        });
      }
    };

    // Run immediately on mount/sessionId change
    fetchLeads(true);

    // Poll every 3 seconds for new inserts
    const pollInterval = setInterval(() => fetchLeads(false), 3000);

    return () => { clearInterval(pollInterval); };
  }, [currentSessionId, authStatus]);


  useEffect(() => {
    // Local Analytics Generator based on top 500 leads
    const generateAnalytics = async () => {
      let query = supabase.from('leads').select('location, price').limit(500).order('timestamp', { ascending: false });
      if (currentSessionId) {
        query = query.eq('session_id', currentSessionId);
      }
      const { data } = await query;

      if (data) {
        const locMap: Record<string, { count: number; sum: number; numPrices: number }> = {};
        data.forEach(r => {
          const loc = r.location;
          if (!loc) return;

          const pr_str = String(r.price).replace(/[^\d]/g, '');
          const pr = pr_str ? parseInt(pr_str) : 0;

          if (!locMap[loc]) locMap[loc] = { count: 0, sum: 0, numPrices: 0 };
          locMap[loc].count++;
          if (pr > 0) {
            locMap[loc].sum += pr;
            locMap[loc].numPrices++;
          }
        });
        const formatted = Object.keys(locMap)
          .map(k => ({
            name: k.substring(0, 15) + '...',
            originalLoc: k,
            count: locMap[k].count,
            avg_price: locMap[k].numPrices > 0 ? (locMap[k].sum / locMap[k].numPrices) : 0
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setAnalyticsData(formatted);
      }
    };
    generateAnalytics();
    const inv = setInterval(generateAnalytics, 15000);
    return () => clearInterval(inv);
  }, [currentSessionId]);

  const [isToggleLoading, setIsToggleLoading] = useState(false);

  const toggleScraper = async () => {
    if (isToggleLoading) return;
    setIsToggleLoading(true);

    // Optimistic UI state prediction
    const wasScraping = isScraping;
    setIsScraping(!wasScraping);

    try {
      if (wasScraping) {
        await fetch(`${API_BASE}/api/scraper/stop`, { method: "POST" });
      } else {
        setLeads([]);
        setAnalyticsData([]);
        setVisibleCount(50);
        const token = localStorage.getItem("session_key");
        const res = await fetch(`${API_BASE}/api/scraper/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          body: JSON.stringify({
            city: searchCity,
            property_type: propertyType,
            time_filter: timeFilter,
            sites: selectedSites,
            target_audience: targetAudience,
            min_price: minPrice || null,
            max_price: maxPrice || null,
            ai_prompt: isAiMode ? aiPrompt : ""
          })
        });
        const data = await res.json();

        if (res.ok && data.status === "success" && data.session_id) {
          setCurrentSessionId(data.session_id);
          toast.success("Scraper engine started!");
        } else {
          // Revert optimistic state logic on failure
          setIsScraping(false);
          // 429 = trial limit reached
          const msg = data.detail || data.message || "Failed to start scraper";
          if (res.status === 429) {
            toast(
              (t) => (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-red-400">🚫 Daily Limit Reached</span>
                  <span className="text-sm">{msg}</span>
                  <button
                    className="mt-2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg w-full hover:bg-indigo-500 transition"
                    onClick={() => { toast.dismiss(t.id); window.location.href = '/'; }}
                  >
                    Upgrade to Elite
                  </button>
                </div>
              ),
              { duration: 10000, style: { minWidth: '280px' } }
            );
          } else {
            toast.error(msg);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setIsScraping(wasScraping); // Revert optimistic state
      toast.error("Network error connecting to orchestrator API");
    } finally {
      setIsToggleLoading(false);
    }
  };

  const saveAlert = async () => {
    if (!authStatus.user) {
      toast.error("Please login to completely utilize Smart Alerts.");
      return;
    }
    setIsSavingAlert(true);
    try {
      const payload = {
        user_email: authStatus.user.email,
        city: searchCity,
        min_price: parseInt(alertForm.min_price) || 0,
        max_price: parseInt(alertForm.max_price) || 0,
        property_type: propertyType,
        target_audience: targetAudience
      };
      const res = await fetch(`${API_BASE}/api/alerts/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === "success" && data.alert) {
        toast.success("Smart Alert Saved! We'll monitor incoming properties.");
        setSavedAlerts([data.alert, ...savedAlerts]);
        setIsAlertModalOpen(false);
      } else {
        toast.error("Failed to save alert.");
      }
    } catch (e) {
      toast.error("Network error.");
    } finally {
      setIsSavingAlert(false);
    }
  };

  const handleAiValuation = async (lead: Lead) => {
    try {
      const toastId = toast.loading("Analyzing property metrics via Gemini NLP...");
      const token = localStorage.getItem("session_key") || "";
      const res = await fetch(`${API_BASE}/api/ai/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          description: "Pending full description extraction", // Lead doesn't have deep description in current array constraints
          price: String(lead.price),
          location: lead.location || "Unknown"
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-bold text-purple-400 text-sm">AI Investment Score: {data.score}/10</span>
            <span className="text-xs text-gray-200 leading-snug">{data.analysis}</span>
          </div>,
          { id: toastId, duration: 8000 }
        );
      } else {
        toast.error(`AI Analysis Failed: ${data.detail}`, { id: toastId });
      }
    } catch (e) {
      toast.error("AI Network disconnected.", { duration: 3000 });
    }
  };

  const downloadData = (fmt: "excel" | "csv") => {
    if (!authStatus.user) {
      toast.error(`⚠️ ${fmt.toUpperCase()} export is an Elite feature. Upgrade your plan to download datasets.`, { duration: 5000 });
      return;
    }
    const token = localStorage.getItem("session_key") || "";
    if (currentSessionId) {
      window.location.href = `${API_BASE}/api/export/${currentSessionId}?fmt=${fmt}&token=${token}`;
    } else {
      window.location.href = `${API_BASE}/api/export?fmt=${fmt}&token=${token}`;
    }
  };

  const getSourceBadge = (url: string) => {
    if (!url) return { name: "WEBSITE", color: "text-gray-400 bg-gray-500/10 border-gray-500/20" };
    if (url.includes("dubizzle")) return { name: "OLX/DUBIZZLE", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
    if (url.includes("aqarmap")) return { name: "AQARMAP", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" };
    if (url.includes("propertyfinder")) return { name: "PROPERTYFINDER", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
    if (url.includes("bayut")) return { name: "BAYUT", color: "text-green-400 bg-green-500/10 border-green-500/20" };
    if (url.includes("semsarmasr")) return { name: "SEMSARMASR", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" };
    if (url.includes("shofaqar")) return { name: "SHOFAQAR", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" };
    if (url.includes("realestate")) return { name: "REALESTATE", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" };
    if (url.includes("facebook") || url.includes("google")) return { name: "FACEBOOK", color: "text-blue-500 bg-blue-600/10 border-blue-600/20" };
    return { name: "WEBSITE", color: "text-gray-400 bg-gray-500/10 border-gray-500/20" };
  };

  const handleSiteToggle = (siteId: string) => {
    if (siteId === "all") {
      setSelectedSites(["all"]);
      return;
    }
    let newSites = selectedSites.includes("all") ? [] : [...selectedSites];
    if (newSites.includes(siteId)) {
      newSites = newSites.filter(s => s !== siteId);
    } else {
      newSites.push(siteId);
    }
    if (newSites.length === 0 || newSites.length >= AVAILABLE_SITES.length - 1) {
      setSelectedSites(["all"]);
    } else {
      setSelectedSites(newSites);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col items-start gap-4 pb-4 border-b border-emerald-500/20">
        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              {authStatus.user ? `PropPulse Elite (${authStatus.user.tier})` : "PropPulse Elite (Trial)"}
            </h1>
            {authStatus.user && authStatus.user.expires_at ? (
              <CountdownTimer expiresAt={authStatus.user.expires_at} />
            ) : (
              <p className="text-sm text-gray-400 mt-1">Universal Real Estate Intelligence (Realtime)</p>
            )}
          </div>
        </div>

        {/* Adaptive Search Bar & Filters */}
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Search Method</label>
              <button 
                onClick={() => setIsAiMode(!isAiMode)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all duration-300 ${isAiMode ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-surface border border-gray-700 text-gray-400 hover:text-white'}`}
              >
                {isAiMode ? "✨ AI Prompt Mode Active" : "Manual Filters"}
              </button>
            </div>
            
            {isAiMode ? (
              <div className="relative w-full">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={isScraping}
                  placeholder="e.g. Search for all listings tagged with 'Building for rent' or 'Commercial property' in Downtown, Dokki, Giza, or Zamalek with total area > 3000 sqm or floors > 5."
                  className="w-full bg-[#0a0b0c] border border-purple-500/50 rounded-lg py-3 px-4 text-sm text-purple-100 placeholder-purple-400/30 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 disabled:opacity-50 min-h-[80px] shadow-[inset_0_0_20px_rgba(168,85,247,0.05)] resize-y"
                />
              </div>
            ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <div className="relative flex-[2]">
                  <input
                    type="text"
                    placeholder="Search City (e.g. التجمع الخامس)..."
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    disabled={isScraping}
                    className="w-full bg-surface/80 border border-emerald-500/30 rounded py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-400 disabled:opacity-50"
                  />
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>

            {/* Site Selector Dropdown */}
            <div className="relative flex-1 sm:max-w-[200px]" ref={siteMenuRef}>
              <button
                type="button"
                onClick={() => setIsSiteMenuOpen(!isSiteMenuOpen)}
                disabled={isScraping}
                className="w-full flex items-center justify-between gap-2 bg-surface/80 border border-emerald-500/30 rounded py-2 px-3 text-sm text-gray-300 focus:outline-none hover:border-emerald-400 disabled:opacity-50"
              >
                <span className="truncate max-w-[120px]">
                  {selectedSites.includes("all") ? "All Sites" : `${selectedSites.length} Selected`}
                </span>
                <ChevronDown size={14} className={`transition-transform ${isSiteMenuOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {isSiteMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full right-0 mt-2 w-56 bg-[#0f1011] border border-emerald-500/30 rounded flex flex-col shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-2 border-b border-emerald-500/20 bg-emerald-500/5">
                      <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">Target Sites</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                      {AVAILABLE_SITES.map((site) => {
                        const isSelected = selectedSites.includes("all") || selectedSites.includes(site.id);
                        return (
                          <button
                            key={site.id}
                            onClick={() => handleSiteToggle(site.id)}
                            className={`w-full text-left flex items-center justify-between px-3 py-2 text-sm rounded transition-colors ${isSelected ? "bg-emerald-500/10 text-emerald-400" : "text-gray-300 hover:bg-white/5"
                              }`}
                          >
                            {site.label}
                            {isSelected && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Row: Selectors & Prices */}
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              disabled={isScraping}
              className="flex-1 bg-surface/80 border border-purple-500/30 rounded py-2 px-3 text-sm text-purple-300 focus:outline-none focus:border-purple-400 disabled:opacity-50 font-medium"
            >
              <option value="sellers">Target: Sellers</option>
              <option value="buyers">Target: Buyers</option>
            </select>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              disabled={isScraping}
              className="flex-1 bg-surface/80 border border-emerald-500/30 rounded py-2 px-3 text-sm text-gray-300 focus:outline-none focus:border-emerald-400 disabled:opacity-50"
            >
              <option value="both">Sale & Rent {propertyType === 'both' && '✓'}</option>
              <option value="sale">For Sale {propertyType === 'sale' && '✓'}</option>
              <option value="rent">For Rent {propertyType === 'rent' && '✓'}</option>
            </select>

            <div className="flex flex-1 gap-2 min-w-[200px]">
              <input
                type="number"
                placeholder="Min Price (EGP)"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                disabled={isScraping}
                className="w-1/2 bg-surface/80 border border-emerald-500/30 rounded py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-400 disabled:opacity-50 placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="Max Price (EGP)"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                disabled={isScraping}
                className="w-1/2 bg-surface/80 border border-emerald-500/30 rounded py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-400 disabled:opacity-50 placeholder-gray-500"
              />
            </div>
            {/* End Bottom Row */}
            </>
            )}
        </div>

        {/* Control Panel */}
        <div className="flex flex-wrap gap-2 sm:gap-4 w-full">
          <button
            onClick={toggleScraper}
            disabled={isToggleLoading}
            className={`glass-card px-4 py-2 flex items-center justify-center gap-2 font-medium transition-all min-w-[200px] shadow-[0_0_15px_rgba(16,185,129,0.3)] ${isToggleLoading
              ? "bg-gray-600/30 text-gray-400 border-gray-600/30 cursor-not-allowed"
              : isScraping
                ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
              }`}
          >
            {isToggleLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            ) : isScraping ? (
              <Square size={18} />
            ) : (
              <Play size={18} />
            )}
            {isToggleLoading ? "Processing..." : isScraping ? "Stop Scraper" : "Start Scraping Engine"}
          </button>

          <button
            onClick={() => {
              if (authStatus.user?.tier !== 'pro') {
                toast.error("⚠️ Smart Alerts & Webhooks require the Elite PRO subscription.", { duration: 5000 });
                return;
              }
              setIsAlertModalOpen(true);
            }}
            className="glass-card px-4 py-2 flex items-center justify-center gap-2 font-medium transition-all shadow-lg text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <Bell size={18} />
            Smart Alerts
            {savedAlerts.length > 0 && (
              <span className="bg-emerald-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">{savedAlerts.length}</span>
            )}
          </button>

          <button
            onClick={() => downloadData("excel")}
            className="glass-card px-4 py-2 flex items-center gap-2 font-medium bg-surface/50 hover:bg-surface/80 text-white transition-all whitespace-nowrap"
          >
            <Download size={18} className="text-emerald-400" />
            Excel
          </button>

          <button
            onClick={() => downloadData("csv")}
            className="glass-card px-4 py-2 flex items-center gap-2 font-medium bg-surface/50 hover:bg-surface/80 text-white transition-all whitespace-nowrap"
          >
            <Download size={18} className="text-cyan-400" />
            CSV
          </button>
        </div>
      </header>

      {/* Premium Metric Cards - Global */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 blur-3xl -z-10 rounded-full" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card relative overflow-hidden p-6 flex flex-col justify-between group hover:border-emerald-500/40 transition-all duration-500 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-xl border border-emerald-500/20 backdrop-blur-sm shadow-[0_0_15px_rgba(16,185,129,0.15)] relative z-10">
              <Activity className="text-emerald-400" size={24} />
            </div>
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-400/80 font-semibold bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 relative z-10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live DB Sync
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-gray-400 text-sm font-medium mb-1 tracking-wide">Total Leads In Database</p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-extrabold text-white tracking-tight">{globalStats.total_leads.toLocaleString() || 0}</p>
              <span className="text-xs text-emerald-400 font-medium tracking-wide">UNITS</span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card relative overflow-hidden p-6 flex flex-col justify-between group hover:border-cyan-500/40 transition-all duration-500 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 rounded-xl border border-cyan-500/20 backdrop-blur-sm shadow-[0_0_15px_rgba(34,211,238,0.15)] relative z-10">
              <Phone className="text-cyan-400" size={24} />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-cyan-400/80 font-semibold bg-cyan-500/10 px-2 py-1 rounded-full border border-cyan-500/20 relative z-10">
              Validated
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-gray-400 text-sm font-medium mb-1 tracking-wide">Extracted Mobiles</p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-extrabold text-white tracking-tight">{globalStats.verified_phones.toLocaleString() || 0}</p>
              <span className="text-xs text-cyan-400 font-medium tracking-wide">CONTACTS</span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card relative overflow-hidden p-6 flex flex-col justify-between group hover:border-purple-500/40 transition-all duration-500 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-xl border border-purple-500/20 backdrop-blur-sm shadow-[0_0_15px_rgba(168,85,247,0.15)] relative z-10">
              <DollarSign className="text-purple-400" size={24} />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-purple-400/80 font-semibold bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/20 relative z-10">
              Market Avg
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-gray-400 text-sm font-medium mb-1 tracking-wide">Live Global Average</p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-extrabold text-white tracking-tight">{(globalStats.avg_price / 1000000).toFixed(1)}<span className="text-2xl ml-1">M</span></p>
              <span className="text-xs text-purple-400 font-medium tracking-wide">EGP</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytics Hub */}
        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="text-lg font-medium mb-6 flex items-center gap-2">
            <MapPin size={18} className="text-emerald-400" />
            Live Price Trends (Local Computation from DB)
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} />
                <YAxis yAxisId="right" orientation="right" stroke="#34d399" tick={{ fill: '#34d399' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f1011', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px' }}
                  itemStyle={{ color: '#e5e7eb' }}
                  formatter={(value: any, name: string) => name === "Avg Price" ? [`${Number(value).toLocaleString()} EGP`, name] : [value, name]}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="avg_price" name="Avg Price" fill="#34d399" radius={[4, 4, 0, 0]} barSize={40} />
                <Line yAxisId="right" type="monotone" dataKey="count" name="Units Found" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: '#22d3ee' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Stream Feed synchronized via Supabase Realtime */}
        <div className="glass-card p-6 flex flex-col h-[400px] overflow-hidden">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Activity size={18} className="text-emerald-400 animate-pulse" />
            Supabase Realtime Stream
          </h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 relative">
            <AnimatePresence>
              {leads.slice(0, visibleCount).map((lead, i) => {
                const isBlurred = !authStatus.user && i >= (authStatus.free_limit || 5);
                return (
                  <motion.div
                    key={lead.phone + i}
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-3 bg-surface/60 border border-emerald-500/10 rounded-lg flex flex-col gap-1 transition-all shadow-md ${isBlurred ? 'blur-sm opacity-50 select-none pointer-events-none' : ''}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-emerald-400 text-sm tracking-wider">{lead.phone}</span>
                      <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                        Valid DB Push
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400 mt-1">
                      <span className="truncate max-w-[120px]" title={lead.location}>{lead.location || 'Unknown Location'}</span>
                      <div className="flex gap-2 items-center flex-wrap justify-end">
                        <span className={`text-[9px] px-1.5 py-0.5 border rounded-sm font-semibold tracking-wider ${getSourceBadge(lead.url).color}`}>
                          {getSourceBadge(lead.url).name}
                        </span>
                        {getPriceHealth(lead.price, lead.location) && (
                          <span className={`text-[9px] px-1.5 py-0.5 border rounded-sm font-bold tracking-wider ${getPriceHealth(lead.price, lead.location)?.color}`}>
                            {getPriceHealth(lead.price, lead.location)?.label}
                          </span>
                        )}
                        <span className={`font-semibold ${lead.price === 'Buyer Target' ? 'text-purple-400' : 'text-gray-300'}`}>
                          {lead.price === 'Buyer Target' ? 'BUYER LEAD' : (lead.price && !isNaN(Number(lead.price)) && Number(lead.price) > 0 ? `${Number(lead.price).toLocaleString()} EGP` : 'N/A')}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-emerald-500/10 flex justify-between items-center">
                      {authStatus.user?.tier === 'pro' ? (
                        <button
                          onClick={() => handleAiValuation(lead)}
                          className="text-[10px] uppercase tracking-wider text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20"
                        >
                          <Zap size={10} /> Get AI Score
                        </button>
                      ) : (
                        <div />
                      )}
                      <a href={lead.url} target="_blank" rel="noreferrer" className="text-[10px] uppercase tracking-wider text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                        View Ad <ExternalLink size={10} />
                      </a>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {leads.length > visibleCount && authStatus.user && (
              <button
                onClick={() => setVisibleCount(v => v + 50)}
                className="w-full mt-4 py-2 border border-emerald-500/30 text-emerald-400 text-xs uppercase tracking-wider font-bold rounded hover:bg-emerald-500/10 transition-colors"
              >
                Load Next 50 Records ({leads.length - visibleCount} hidden)
              </button>
            )}

            {!authStatus.user && leads.length >= (authStatus.free_limit || 5) && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="bg-indigo-900/90 border border-indigo-500 p-6 rounded-2xl shadow-2xl backdrop-blur-md text-center pointer-events-auto mt-20">
                  <h3 className="text-white font-bold text-lg mb-2">Trial Limit Reached</h3>
                  <p className="text-indigo-200 text-sm mb-4">You've hit your free lead limit.<br />Unlock unlimited scraping with Elite.</p>
                  <button onClick={() => window.location.href = '/'} className="bg-white hover:bg-indigo-100 text-black px-6 py-2.5 rounded-lg font-bold text-sm transition-colors w-full">
                    Upgrade to Elite
                  </button>
                </div>
              </div>
            )}

            {leads.length === 0 && (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm flex-col gap-2">
                <div className="w-8 h-8 flex border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                Waiting for Supabase insertions...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supabase Populated Search History Section */}
      <div className="mt-12 pt-8 border-t border-emerald-500/20">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-6 flex items-center gap-3">
          <Search size={24} className="text-emerald-400" /> Database Search Sessions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {searchHistory.map((session: any) => (
            <div key={session.id} className="glass-card p-5 flex flex-col gap-3 relative overflow-hidden group hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-300">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <MapPin size={48} className="text-emerald-400" />
              </div>

              <div className="flex justify-between items-start z-10">
                <div>
                  <h3 className="font-bold text-lg text-white mb-1 truncate max-w-[160px]" title={session.city || "Default Areas"}>
                    {session.city || "Default Feed"}
                  </h3>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {new Date(session.created_at + 'Z').toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 border rounded text-[10px] uppercase tracking-wider font-semibold ${session.target_audience === 'buyers' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                    {session.target_audience === 'buyers' ? 'Target: Buyers' : 'Target: Sellers'}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-500/10 border border-gray-500/20 rounded text-[9px] text-gray-400 uppercase tracking-wider font-semibold">
                    {session.property_type === 'both' ? 'Rent & Sale' : session.property_type}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2 z-10">
                <div className="bg-surface/50 rounded p-2 border border-white/5">
                  <p className="text-[10px] text-gray-400 uppercase">Leads Counted</p>
                  {authStatus.user ? (
                    <p className="text-sm font-bold text-cyan-400">{session.lead_count ?? 0}</p>
                  ) : (
                    <p className="text-sm font-bold text-indigo-400 flex items-center gap-1">
                      <span className="text-indigo-400">🔒</span> Elite
                    </p>
                  )}
                </div>
                <div className="bg-surface/50 rounded p-2 border border-white/5">
                  <p className="text-[10px] text-gray-400 uppercase">Time Filter</p>
                  <p className="text-sm font-bold text-purple-400 capitalize">{session.time_filter}</p>
                </div>
              </div>

              {authStatus.user ? (
                <div className="grid grid-cols-2 gap-2 mt-3 z-10 w-full">
                  <button
                    onClick={() => window.location.href = `${API_BASE}/api/export/${session.id}?fmt=excel&token=${localStorage.getItem("session_key") || ""}`}
                    className="py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Download size={14} /> Excel
                  </button>
                  <button
                    onClick={() => window.location.href = `${API_BASE}/api/export/${session.id}?fmt=csv&token=${localStorage.getItem("session_key") || ""}`}
                    className="py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Download size={14} /> CSV
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => window.location.href = '/'}
                  className="mt-3 w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 z-10"
                >
                  🔒 Elite Only — Upgrade
                </button>
              )}
            </div>
          ))}
          {searchHistory.length === 0 && (
            <div className="col-span-full">
              <div className="glass-card p-12 flex flex-col items-center justify-center text-gray-500 text-sm italic border-dashed border-gray-700 bg-surface/30">
                <Search size={48} className="mb-4 opacity-30 text-emerald-400" />
                <p className="text-lg text-gray-300">No database sessions indexed yet.</p>
                <p className="mt-1">Perform a new deep search to push leads to Supabase and populate records.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Smart Alerts Modal Overlay */}
      <AnimatePresence>
        {isAlertModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0f1011] border border-emerald-500/30 rounded-2xl p-6 shadow-2xl max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                  <Bell className="text-emerald-400" /> Create Smart Alert
                </h2>
                <button onClick={() => setIsAlertModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-100 flex items-start gap-3">
                  <AlertCircle size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                  <p>Get notified instantly when the scraper detects a property matching your exact boundaries.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Min Price (EGP)</label>
                    <input
                      type="number"
                      value={alertForm.min_price}
                      onChange={e => setAlertForm({ ...alertForm, min_price: e.target.value })}
                      className="w-full bg-[#16181a] border border-emerald-500/20 rounded p-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="e.g. 500000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Max Price (EGP)</label>
                    <input
                      type="number"
                      value={alertForm.max_price}
                      onChange={e => setAlertForm({ ...alertForm, max_price: e.target.value })}
                      className="w-full bg-[#16181a] border border-emerald-500/20 rounded p-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="e.g. 5000000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Target Location</label>
                  <input
                    type="text"
                    value={searchCity}
                    onChange={e => setSearchCity(e.target.value)}
                    className="w-full bg-[#16181a] border border-emerald-500/20 rounded p-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="Auto-injected from your active search..."
                  />
                  <p className="text-[10px] text-gray-500 mt-1">If blank, it will trigger for any location scraped.</p>
                </div>
              </div>

              <button
                onClick={saveAlert}
                disabled={isSavingAlert}
                className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${isSavingAlert ? 'bg-emerald-600/50 text-gray-300 pointer-events-none' : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                  }`}
              >
                {isSavingAlert ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : <Bell size={16} />}
                {isSavingAlert ? 'Saving...' : 'Deploy Smart Alert'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
