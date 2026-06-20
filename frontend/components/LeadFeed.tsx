import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building,Activity, ExternalLink, Zap } from "lucide-react";

interface LeadFeedProps {
    leads: any[];
    visibleCount: number;
    authStatus: any;
    setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
    getSourceBadge: (url: string) => { name: string; color: string };
    getPriceHealth: (price: string | null, location: string) => { label: string; color: string } | null;
    handleAiValuation: (lead: any) => void;
    isScraping: boolean;
}

export default function LeadFeed({
    leads, visibleCount, authStatus, setVisibleCount, getSourceBadge, getPriceHealth, handleAiValuation, isScraping
}: LeadFeedProps) {
    return (
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
                                className={`p-3 border rounded-lg flex flex-col gap-1 transition-all shadow-md ${isBlurred ? 'blur-sm opacity-50 select-none pointer-events-none bg-surface/60 border-emerald-500/10' : lead.floor_breakdown?.length > 0 ? 'bg-purple-900/10 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-surface/60 border-emerald-500/10'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className={`font-mono text-sm tracking-wider ${lead.floor_breakdown?.length > 0 ? 'text-purple-400' : 'text-emerald-400'}`}>{lead.phone || "Manual Entry"}</span>
                                    <span className={`text-xs px-2 py-0.5 border rounded-full ${lead.floor_breakdown?.length > 0 ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 font-bold' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                        {lead.floor_breakdown?.length > 0 ? '👑 Penthouse / Multi-Floor' : 'Valid DB Push'}
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
                                {lead.floor_breakdown && Array.isArray(lead.floor_breakdown) && lead.floor_breakdown.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-purple-500/20 bg-purple-500/5 p-2 rounded-lg">
                                        <p className="text-[10px] uppercase tracking-wider text-purple-400 mb-2 font-bold flex items-center gap-1">
                                            <Building size={12} /> Dynamic Floor Breakdown
                                        </p>
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {lead.floor_breakdown.map((floor: any, idx: number) => (
                                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/20 border border-purple-500/10 px-3 py-1.5 rounded-md text-xs">
                                                    <span className="text-purple-100 font-bold w-full sm:w-1/4 truncate mb-1 sm:mb-0">{floor.level}</span>
                                                    <span className="text-emerald-400/90 font-mono w-full sm:w-1/4 sm:text-center">{floor.area_sqm ? `${floor.area_sqm} sqm` : '-'}</span>
                                                    <span className="text-gray-300 w-full sm:w-1/4 sm:text-center truncate">{floor.rooms ? `${floor.rooms} Rooms` : '-'}</span>
                                                    <span className="text-purple-300/80 w-full sm:w-1/4 sm:text-right truncate" title={Array.isArray(floor.features) ? floor.features.join(', ') : floor.features}>
                                                        {Array.isArray(floor.features) ? floor.features.join(', ') : (floor.features || '-')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
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
                        {isScraping ? (
                            <>
                                <div className="w-8 h-8 flex border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                Waiting for Supabase insertions...
                            </>
                        ) : (
                            <div className="text-center">
                                <Activity size={32} className="mx-auto text-gray-600 mb-2" />
                                <p className="text-gray-400 font-medium text-base">No Matching Commercial Assets Found</p>
                                <p className="text-gray-500 text-xs mt-1">Try broadening your search criteria or categories.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
