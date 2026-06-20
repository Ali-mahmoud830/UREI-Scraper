import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, Check, Play, Square, Bell, Download, X } from "lucide-react";

interface ScraperControlsProps {
    authStatus: any;
    searchCity: string[];
    setSearchCity: (v: string[]) => void;
    selectedSites: string[];
    isSiteMenuOpen: boolean;
    setIsSiteMenuOpen: (v: boolean) => void;
    handleSiteToggle: (siteId: string) => void;
    targetAudience: string;
    setTargetAudience: (v: string) => void;
    propertyType: string;
    setPropertyType: (v: string) => void;
    propertyCategory: string;
    setPropertyCategory: (v: string) => void;
    aiPrompt: string;
    setAiPrompt: (v: string) => void;
    isAiMode: boolean;
    setIsAiMode: (v: boolean) => void;
    minPrice: string;
    setMinPrice: (v: string) => void;
    maxPrice: string;
    setMaxPrice: (v: string) => void;
    isScraping: boolean;
    isToggleLoading: boolean;
    toggleScraper: () => void;
    setIsAlertModalOpen: (v: boolean) => void;
    savedAlerts: any[];
    downloadData: (fmt: "excel" | "csv") => void;
    AVAILABLE_SITES: any[];
    CountdownTimer: React.FC<{ expiresAt: string }>;
    siteMenuRef: React.RefObject<HTMLDivElement>;
}

export default function ScraperControls({
    authStatus, searchCity, setSearchCity, selectedSites, isSiteMenuOpen, setIsSiteMenuOpen,
    handleSiteToggle, targetAudience, setTargetAudience, propertyType, setPropertyType,
    propertyCategory, setPropertyCategory,
    aiPrompt, setAiPrompt, isAiMode, setIsAiMode,
    minPrice, setMinPrice, maxPrice, setMaxPrice, isScraping, isToggleLoading, toggleScraper,
    setIsAlertModalOpen, savedAlerts, downloadData, AVAILABLE_SITES, CountdownTimer, siteMenuRef
}: ScraperControlsProps) {
    const { total_searches = 0, search_limit = null } = authStatus.user || {};
    const isLimitReached = search_limit !== null && total_searches >= search_limit;
    const isStartDisabled = isToggleLoading || (!isScraping && isLimitReached);

    return (
        <header className="flex flex-col items-start gap-4 pb-4 border-b border-emerald-500/20">
            <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        {authStatus.user && authStatus.user.tier ? `PropPulse Elite (${authStatus.user.tier.charAt(0).toUpperCase() + authStatus.user.tier.slice(1).toLowerCase()})` : "PropPulse Elite (Trial)"}
                    </h1>
                    {authStatus.user && authStatus.user.expires_at ? (
                        <CountdownTimer expiresAt={authStatus.user.expires_at} />
                    ) : (
                        <p className="text-sm text-gray-400 mt-1">Universal Real Estate Intelligence (Realtime)</p>
                    )}
                </div>
                
                <div className="flex items-center gap-3 bg-surface/50 p-2 rounded-lg border border-purple-500/20">
                    <span className="text-sm font-semibold text-purple-300">AI Semantic Engine</span>
                    <button
                        onClick={() => setIsAiMode(!isAiMode)}
                        disabled={isScraping}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#0A0F1C] ${isAiMode ? 'bg-purple-600' : 'bg-gray-600'} disabled:opacity-50`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAiMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            <div className="w-full flex flex-col gap-3 relative z-10">
                {isAiMode ? (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="w-full mb-2"
                    >
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                disabled={isScraping}
                                placeholder='e.g., "Search for all listings tagged with Building for rent or Commercial property in Downtown, Dokki, Giza, or Zamalek with total area > 3000 sqm or floors > 5."'
                                className="relative w-full h-24 bg-[#0A0F1C] text-purple-100 placeholder-purple-300/40 border border-purple-500/50 rounded-lg p-4 text-sm focus:outline-none focus:border-purple-400 resize-none z-10"
                            />
                        </div>
                    </motion.div>
                ) : (
                    <>
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <div className="relative flex-[2] bg-surface/80 border border-emerald-500/30 rounded px-2 py-1.5 flex flex-wrap gap-2 items-center focus-within:border-emerald-400">
                        <Search size={16} className="text-gray-400 ml-1" />
                        {searchCity.map((city, idx) => (
                            <span key={idx} className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-full flex items-center gap-1 font-semibold border border-emerald-500/20">
                                {city}
                                <X size={12} className="cursor-pointer hover:text-white" onClick={() => setSearchCity(searchCity.filter((_, i) => i !== idx))} />
                            </span>
                        ))}
                        <input
                            type="text"
                            placeholder={searchCity.length === 0 ? "Type city & press Enter..." : "Add city..."}
                            disabled={isScraping}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                    setSearchCity([...searchCity, e.currentTarget.value.trim()]);
                                    e.currentTarget.value = '';
                                }
                            }}
                            className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none disabled:opacity-50 min-w-[120px] pb-0.5"
                        />
                    </div>

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
                                                    className={`w-full text-left flex items-center justify-between px-3 py-2 text-sm rounded transition-colors ${isSelected ? "bg-emerald-500/10 text-emerald-400" : "text-gray-300 hover:bg-white/5"}`}
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
                    
                    <select
                        value={propertyCategory}
                        onChange={(e) => setPropertyCategory(e.target.value)}
                        disabled={isScraping}
                        className="flex-1 bg-surface/80 border border-emerald-500/30 rounded py-2 px-3 text-sm text-cyan-300 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
                    >
                        <option value="all">All Types</option>
                        <option value="apartment">Apartments</option>
                        <option value="villa">Villas</option>
                        <option value="warehouse">Warehouses</option>
                        <option value="hotel">Hotels</option>
                        <option value="land">Lands</option>
                        <option value="commercial">Commercial</option>
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
                </div>
                    </>
                )}
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-4 w-full">
                <button
                    onClick={toggleScraper}
                    disabled={isStartDisabled}
                    title={isLimitReached && !isScraping ? `Search limit reached (${total_searches}/${search_limit}). Contact admin to upgrade.` : undefined}
                    className={`glass-card px-4 py-2 flex items-center justify-center gap-2 font-medium transition-all min-w-[200px] shadow-[0_0_15px_rgba(16,185,129,0.3)] ${
                        isStartDisabled && !isScraping
                            ? "bg-amber-500/10 text-amber-500/60 border-amber-500/20 cursor-not-allowed opacity-60"
                            : isToggleLoading
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
                    ) : isLimitReached ? (
                        <span className="text-base">🚫</span>
                    ) : (
                        <Play size={18} />
                    )}
                    {isToggleLoading
                        ? "Processing..."
                        : isScraping
                            ? "Stop Scraper"
                            : isLimitReached
                                ? `Limit Reached (${total_searches}/${search_limit})`
                                : "Start Scraping Engine"}
                </button>

                <button
                    onClick={() => setIsAlertModalOpen(true)}
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
    );
}
