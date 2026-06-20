"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

/**
 * PropPulse Elite: Global Command Center Glassmorphic Layout.
 *
 * This wrapper component establishes the premium "Dark Mode" aesthetic
 * requested for the PropPulse Elite tier. It handles the dynamic background
 * glows, sticky glass navbar, and global z-indexing for the main dashboard content.
 * 
 * @param {Object} props - React props.
 * @param {React.ReactNode} props.children - Dashboard sections and content cards.
 */
export default function CommandCenterLayout({ children }: { children: React.ReactNode }) {
    const { t, i18n } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const toggleLanguage = () => {
        const newLang = i18n.language.startsWith('en') ? 'ar' : 'en';
        i18n.changeLanguage(newLang);
    };

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
            {/* Dynamic Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Top Header */}
            <header className="sticky top-0 z-50 w-full glass-card border-b border-white/5 bg-surface/80">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                            <span className="font-bold text-white text-lg">P</span>
                        </div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            PropPulse <span className="text-indigo-400">Elite</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-6 text-sm font-medium text-gray-400">
                        <span className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                            System Online
                        </span>
                        
                        {mounted && (
                            <button 
                                onClick={toggleLanguage}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors border border-white/10"
                            >
                                <Globe size={16} />
                                <span>{t('nav.lang')}</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
                {children}
            </main>
        </div>
    );
}
