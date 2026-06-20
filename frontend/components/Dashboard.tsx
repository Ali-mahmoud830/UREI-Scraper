"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { Play, Square, Download, Activity, Phone, DollarSign, MapPin, ExternalLink, Search, ChevronDown, Check, Bell, X, AlertCircle, Zap, Database, TrendingUp, ShieldCheck, RadioReceiver, LayoutDashboard, Upload, Settings, BarChart3, History } from "lucide-react";
import DataCharts from "./DataCharts";
import LeadFeed from "./LeadFeed";
import ScraperControls from "./ScraperControls";
import { supabase } from "../lib/supabase";
import CommandCenterLayout from "./CommandCenterLayout";
import AnimatedStatCard from "./AnimatedStatCard";
import PropertyUploadForm from "./PropertyUploadForm";
import { useTranslation } from "react-i18next";

type Lead = {
  phone: string;
  price: string;
  location: string;
  url: string;
  status: string;
  intent?: string;
  timestamp?: string;
  session_id?: number;
};

import { getApiUrl } from "../lib/apiClient";

// Python backend API used solely for orchestrating Playwright scraping workers and redeeming licenses.
const API_BASE = getApiUrl();

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

/**
 * Global Dashboard Component for PropPulse Elite.
 *
 * Core Stateful Controller that manages Supabase Realtime synchronization,
 * dynamic search parameter tracking, and component orchestration for the Data Hub.
 * Directly integrates generative AI components to appraise incoming lead structures.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"dashboard" | "admin" | "upload" | "feed">("dashboard");
  const [isScraping, setIsScraping] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchCity, setSearchCity] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [propertyType, setPropertyType] = useState("both"); // Sale vs Rent
  const [propertyCategory, setPropertyCategory] = useState("all"); // Apartment, Villa, Warehouse
  const [timeFilter, setTimeFilter] = useState("all");
  const [targetAudience, setTargetAudience] = useState("sellers");
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState({ total_leads: 0, verified_phones: 0, avg_price: 0 });
  const [selectedSites, setSelectedSites] = useState<string[]>(["all"]);
  const [isSiteMenuOpen, setIsSiteMenuOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiMode, setIsAiMode] = useState(false);
  const [activePolls, setActivePolls] = useState(0);

  // Smart Alerts State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
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
        const res = await fetch(`/api/proxy/alerts?user_email=${encodeURIComponent(email)}`);
        const json = await res.json();
        if (json.status === "success") setSavedAlerts(json.alerts || []);
      } catch (e) {
        console.error("Failed to fetch alerts", e);
      }
    };

    const checkAuthStatus = async () => {
      try {
        const res = await fetch(`/api/auth/status`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setAuthStatus({
              user: {
                email: data.user.email,
                tier: data.user.tier,
                expires_at: data.user.expires_at,
                total_searches: data.user.total_searches ?? 0,
                search_limit: data.user.search_limit ?? null,
                role: data.user.role
              },
              trial_enabled: true,
              free_limit: data.free_limit || 50
            });
            if (data.user.email) fetchAlerts(data.user.email);
            return;
          }
        }

        const { data: configRows } = await supabase.from('admin_config').select('*');
        const trialEnabled = configRows?.find(r => r.key === 'TRIAL_ENABLED')?.value === 'true';
        const freeLimit = parseInt(configRows?.find(r => r.key === 'FREE_RESULT_LIMIT')?.value || '50');
        setAuthStatus({ user: null, trial_enabled: trialEnabled, free_limit: freeLimit });
      } catch (e) { console.error("Auth check failed", e); }
    };
    checkAuthStatus();
    // Expose so toggleScraper can call it after starting a session
    (window as any).__refreshAuthStatus = checkAuthStatus;

    const handleClickOutside = (event: MouseEvent) => {
      if (siteMenuRef.current && !siteMenuRef.current.contains(event.target as Node)) {
        setIsSiteMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [userSessionIds, setUserSessionIds] = useState<number[]>([]);

  useEffect(() => {
    // Fetch user-scoped sessions from secure API (multi-tenant isolation)
    const fetchData = async () => {
      try {
        const res = await fetch("/api/proxy/sessions", { cache: 'no-store' });
        const json = await res.json();
        const sessions = json.sessions || [];
        setSearchHistory(sessions);
        // Extract session IDs owned by this user for leads filtering
        setUserSessionIds(sessions.map((s: any) => s.id));

        // Compute user-scoped stats from their own sessions
        const sessionIds = sessions.map((s: any) => s.id);
        if (sessionIds.length > 0) {
          const { data: sessionLeadsData } = await supabase
            .from('session_leads')
            .select('lead_id')
            .in('session_id', sessionIds);

          const leadIds = Array.from(new Set((sessionLeadsData || []).map((r: any) => r.lead_id)));
          const totalLeads = leadIds.length;

          let sum = 0;
          let validPrices = 0;
          let cityAggregation: Record<string, { count: number, priceSum: number }> = {};

          if (leadIds.length > 0) {
            const { data: priceData } = await supabase
              .from('leads')
              .select('price, location')
              .in('id', leadIds)
              .neq('price', 'Buyer Target')
              .not('price', 'is', null);

            priceData?.forEach(row => {
              const m = String(row.price).replace(/[^\d]/g, '');
              if (m) {
                const p = parseInt(m);
                sum += p;
                validPrices++;

                const loc = row.location || 'Unknown';
                // Simplify location label for the chart
                const shortLoc = loc.split(',')[0].trim();
                if (!cityAggregation[shortLoc]) cityAggregation[shortLoc] = { count: 0, priceSum: 0 };
                cityAggregation[shortLoc].count += 1;
                cityAggregation[shortLoc].priceSum += p;
              }
            });
          }

          setGlobalStats({
            total_leads: totalLeads,
            verified_phones: totalLeads,
            avg_price: validPrices > 0 ? sum / validPrices : 0
          });

          // Generate top 10 cities for the chart
          const chartData = Object.keys(cityAggregation).map(city => ({
            name: city,
            originalLoc: city,
            avg_price: cityAggregation[city].priceSum / cityAggregation[city].count,
            count: cityAggregation[city].count
          })).sort((a, b) => b.count - a.count).slice(0, 10);

          setAnalyticsData(chartData);
        } else {
          setGlobalStats({ total_leads: 0, verified_phones: 0, avg_price: 0 });
          setAnalyticsData([]);
        }
      } catch (e) {
        console.error("Failed to fetch sessions", e);
      }
    };

    fetchData();
    // Reduce polling frequency significantly (30s) to prevent DB overload (Server 500 Disconnects)
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [authStatus]);

  // Auto-detect session completion: poll current session lead count while scraping
  useEffect(() => {
    if (!isScraping || !currentSessionId) return;
    const searchLimit = authStatus.user?.search_limit ?? 50;

    const checkCompletion = () => {
      const currentSession = searchHistory.find((s: any) => s.id === currentSessionId);
      if (currentSession && currentSession.lead_count >= searchLimit) {
        setIsScraping(false);
        if (activePolls === 0) {
          toast.success(t('dashboard.sessionComplete'));
        }
        if ((window as any).__refreshAuthStatus) (window as any).__refreshAuthStatus();
      }
    };

    // Rely on the searchHistory updates from the primary fetchData loop instead of making new HTTP requests
    checkCompletion();
  }, [isScraping, currentSessionId, authStatus, searchHistory]);

  useEffect(() => {
    // Authenticated Realtime Streaming — Zero Latency Pagination
    const displayLimit = authStatus.user ? 50 : (authStatus.free_limit || 5);
    let latestTimestamp: string | null = null;
    
    const fetchInitialLeads = async () => {
      const scopedSessionId = currentSessionId;
      const scopedSessionIds = scopedSessionId ? [scopedSessionId] : userSessionIds;

      if (!scopedSessionId && (!authStatus.user || scopedSessionIds.length === 0)) {
        setLeads([]);
        return;
      }

      let query = supabase.from('leads').select('*').order('timestamp', { ascending: false }).limit(displayLimit);
      
      if (scopedSessionIds.length > 0) {
        query = query.in('session_id', scopedSessionIds);
      }

      const { data, error } = await query;

      if (error) { console.error('Initial leads fetch error:', error); return; }
      if (data && data.length > 0) {
        latestTimestamp = data[0].timestamp;
        setLeads(data);
      }
    };

    fetchInitialLeads();

    // Zero-Latency WebSocket Subscription — listen on leads directly (handles both INSERT and UPDATE for upserts)
    const channel = supabase.channel('realtime_leads_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const newLead = payload.new as Lead;
          const scopedSessionIds = currentSessionId ? [currentSessionId] : userSessionIds;
          
          if (newLead.session_id && scopedSessionIds.includes(newLead.session_id)) {
            setLeads(prev => {
              const exists = prev.some(l => l.phone === newLead.phone);
              if (exists) {
                return prev.map(l => l.phone === newLead.phone ? newLead : l);
              }
              const merged = [newLead, ...prev];
              return authStatus.user ? merged : merged.slice(0, displayLimit);
            });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentSessionId, authStatus, userSessionIds]);


  useEffect(() => {
    // Local Analytics Generator — scoped to user's own sessions
    const generateAnalytics = async () => {
      const scopedSessionIds = currentSessionId ? [currentSessionId] : userSessionIds;
      if (authStatus.user && scopedSessionIds.length === 0) {
        setAnalyticsData([]);
        return;
      }

      let query = supabase.from('leads').select('location, price').limit(500).order('timestamp', { ascending: false });
      if (currentSessionId) {
        query = query.eq('session_id', currentSessionId);
      } else if (scopedSessionIds.length > 0) {
        query = query.in('session_id', scopedSessionIds);
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
  }, [currentSessionId, userSessionIds, authStatus]);

  const [isToggleLoading, setIsToggleLoading] = useState(false);

  const toggleScraper = async () => {
    if (isToggleLoading) return;

    // Professional Authenticated Guard (Blocks Trial Mode from silent fail)
    if (!authStatus.user) {
      toast.error(
        (t) => (
          <div className="flex flex-col gap-2 p-1">
            <span className="font-bold text-rose-400 text-base">🚫 Authentication Required</span>
            <span className="text-sm text-slate-300 font-medium leading-relaxed">You must be logged into an active Elite tier account to initiate a persistent live scraping sequence.</span>
            <button
              className="mt-3 bg-indigo-600 text-white text-sm font-bold px-3 py-2.5 rounded-lg w-full hover:bg-indigo-500 transition shadow-[0_0_15px_rgba(79,70,229,0.3)]"
              onClick={() => { toast.dismiss(t.id); window.location.href = '/'; }}
            >
              Sign In To Continue
            </button>
          </div>
        ),
        { duration: 8000, style: { minWidth: '320px', backgroundColor: '#0A0F1C', border: '1px solid rgba(244,63,94,0.3)' } }
      );
      return;
    }

    // Enforce client-side search limit for daily/weekly users
    const { total_searches = 0, search_limit = null } = authStatus.user || {};
    if (search_limit !== null && total_searches >= search_limit) {
      toast.error(
        (t) => (
          <div className="flex flex-col gap-2 p-1">
            <span className="font-bold text-amber-400 text-base">🚫 Search Limit Reached</span>
            <span className="text-sm text-slate-300 font-medium leading-relaxed">
              You have used {total_searches}/{search_limit} of your searches. Upgrade your plan to continue scraping.
            </span>
            <button
              className="mt-3 bg-amber-600 text-white text-sm font-bold px-3 py-2.5 rounded-lg w-full hover:bg-amber-500 transition"
              onClick={() => toast.dismiss(t.id)}
            >
              Contact Admin to Upgrade
            </button>
          </div>
        ),
        { duration: 10000, style: { minWidth: '320px', backgroundColor: '#0A0F1C', border: '1px solid rgba(245,158,11,0.3)' } }
      );
      return;
    }

    setIsToggleLoading(true);

    // Optimistic UI state prediction
    const wasScraping = isScraping;
    setIsScraping(!wasScraping);

    try {
      if (wasScraping) {
        await fetch(`/api/proxy/scraper/stop`, { method: "POST", headers: { "Content-Type": "application/json" } });
      } else {
        setLeads([]);
        setAnalyticsData([]);
        setVisibleCount(50);
        const res = await fetch(`/api/proxy/scraper/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            city: searchCity.join(", "),
            property_type: propertyType,
            time_filter: timeFilter,
            sites: selectedSites,
            target_audience: targetAudience,
            min_price: minPrice || null,
            max_price: maxPrice || null,
            ai_prompt: isAiMode ? aiPrompt : "",
            property_category: propertyCategory
          })
        });
        const data = await res.json();

        if (res.ok && data.status === "success" && data.session_id) {
          setCurrentSessionId(data.session_id);
          toast.success("Scraper engine started!");
          // Immediately refresh usage count after incrementing total_searches
          if ((window as any).__refreshAuthStatus) (window as any).__refreshAuthStatus();
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
      const res = await fetch(`/api/proxy/alerts/save`, {
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
      const res = await fetch(`/api/proxy/ai/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const downloadData = (fmt: "excel" | "csv", sessionId?: number) => {
    if (!authStatus.user) {
      toast.error(`⚠️ ${fmt.toUpperCase()} export is an Elite feature. Upgrade your plan to download datasets.`, { duration: 5000 });
      return;
    }
    // window.location.href can't set Authorization headers, so we pass the
    // session token as a query parameter (the backend accepts ?token=...).
    const sessionToken = document.cookie
      .split('; ')
      .find(r => r.startsWith('session_key='))
      ?.split('=')?.[1] ?? '';
    const tokenParam = sessionToken ? `&token=${encodeURIComponent(sessionToken)}` : '';
    const sid = sessionId ?? currentSessionId;
    if (sid) {
      window.location.href = `/api/proxy/export/${sid}?fmt=${fmt}${tokenParam}`;
    } else {
      window.location.href = `/api/proxy/export?fmt=${fmt}${tokenParam}`;
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
    <CommandCenterLayout>
      <div className="space-y-6">
        <ScraperControls
          authStatus={authStatus}
          searchCity={searchCity}
          setSearchCity={setSearchCity}
          selectedSites={selectedSites}
          isSiteMenuOpen={isSiteMenuOpen}
          setIsSiteMenuOpen={setIsSiteMenuOpen}
          handleSiteToggle={handleSiteToggle}
          targetAudience={targetAudience}
          setTargetAudience={setTargetAudience}
          propertyType={propertyType}
          setPropertyType={setPropertyType}
          propertyCategory={propertyCategory}
          setPropertyCategory={setPropertyCategory}
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          isAiMode={isAiMode}
          setIsAiMode={setIsAiMode}
          minPrice={minPrice}
          setMinPrice={setMinPrice}
          maxPrice={maxPrice}
          setMaxPrice={setMaxPrice}
          isScraping={isScraping}
          isToggleLoading={isToggleLoading}
          toggleScraper={toggleScraper}
          setIsAlertModalOpen={setIsAlertModalOpen}
          savedAlerts={savedAlerts}
          downloadData={downloadData}
          AVAILABLE_SITES={AVAILABLE_SITES}
          CountdownTimer={CountdownTimer}
          siteMenuRef={siteMenuRef}
        />

        {/* Premium Metric Cards - Global */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            <AnimatedStatCard
                title={t('dashboard.totalLeads')}
                value={globalStats.total_leads.toLocaleString() || 0}
                unit="UNITS"
                icon={<Activity size={24} />}
                subtitle="Live DB Sync"
                themeColor="emerald"
            />
            <AnimatedStatCard
                title="Extracted Mobiles"
                value={globalStats.verified_phones.toLocaleString() || 0}
                unit="CONTACTS"
                icon={<Phone size={24} />}
                subtitle="Validated"
                themeColor="cyan"
                delay={0.1}
            />
            <AnimatedStatCard
                title={t('dashboard.avgPrice')}
                value={(globalStats.avg_price / 1000000).toFixed(1) + "M"}
                unit="EGP"
                icon={<DollarSign size={24} />}
                subtitle="Market Avg"
                themeColor="purple"
                delay={0.2}
            />
            {authStatus.user && (() => {
                const used = authStatus.user.total_searches ?? 0;
                // Fallback to 50 if the API returned null for an older token
                const limit = authStatus.user.search_limit ?? 50;
                const remaining = Math.max(0, limit - used);
                const atLimit = used >= limit;
                return (
                    <AnimatedStatCard
                        title="Searches Used"
                        value={`${used}/${limit}`}
                        unit={atLimit ? "⚠ LIMIT HIT" : "USED"}
                        icon={<Search size={24} />}
                        subtitle={`${remaining} remaining`}
                        themeColor={atLimit ? "purple" : "emerald"}
                        delay={0.3}
                    />
                );
            })()}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
          {/* Analytics Hub */}
          <div className="lg:col-span-2 glass-card p-6 min-h-[400px] flex flex-col relative overflow-hidden">
              <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
                  <BarChart3 size={20} className="text-indigo-400" />
                  {t('dashboard.charts.leadsByDay')}
              </h3>
              <DataCharts analyticsData={analyticsData} />
          </div>

          {/* Live Stream Feed synchronized via Supabase Realtime */}
          <LeadFeed
            leads={leads}
            visibleCount={visibleCount}
            authStatus={authStatus}
            setVisibleCount={setVisibleCount}
            getSourceBadge={getSourceBadge}
            getPriceHealth={getPriceHealth}
            handleAiValuation={handleAiValuation}
            isScraping={isScraping}
          />
        </div>

        {/* Supabase Populated Search History Section */}
        <div className="mt-12 pt-8 border-t border-emerald-500/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
              <History size={24} className="text-emerald-400" /> {t('dashboard.recentActivity')}
            </h2>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(147,51,234,0.3)]"
            >
              + Upload Multi-Floor Property
            </button>
          </div>
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
                      onClick={() => downloadData('excel', session.id)}
                      className="py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} /> Excel
                    </button>
                    <button
                      onClick={() => downloadData('csv', session.id)}
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
                      value={searchCity.join(", ")}
                      onChange={e => setSearchCity(e.target.value.split(", "))}
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

        {/* Upload Modal Overlay */}
        <AnimatePresence>
          {isUploadModalOpen && (
            <PropertyUploadForm 
              onClose={() => setIsUploadModalOpen(false)} 
              onSuccess={() => {
                // Refresh data if needed
              }} 
            />
          )}
        </AnimatePresence>
      </div>
    </CommandCenterLayout>
  );
}
