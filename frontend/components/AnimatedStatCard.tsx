import React from "react";
import { motion } from "framer-motion";

interface AnimatedStatCardProps {
    title: string;
    value: string | number;
    unit: string;
    icon: React.ReactNode;
    subtitle: string;
    themeColor: "emerald" | "cyan" | "purple";
    delay?: number;
}

const themeStyles = {
    emerald: {
        bgGlow: "bg-emerald-500/10",
        borderHover: "hover:border-emerald-500/40",
        iconGradient: "from-emerald-500/20 to-emerald-500/5",
        iconBorder: "border-emerald-500/20",
        iconShadow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
        textPrimary: "text-emerald-400",
        badgeBg: "bg-emerald-500/10",
        badgeBorder: "border-emerald-500/20",
    },
    cyan: {
        bgGlow: "bg-cyan-500/10",
        borderHover: "hover:border-cyan-500/40",
        iconGradient: "from-cyan-500/20 to-cyan-500/5",
        iconBorder: "border-cyan-500/20",
        iconShadow: "shadow-[0_0_15px_rgba(34,211,238,0.15)]",
        textPrimary: "text-cyan-400",
        badgeBg: "bg-cyan-500/10",
        badgeBorder: "border-cyan-500/20",
    },
    purple: {
        bgGlow: "bg-purple-500/10",
        borderHover: "hover:border-purple-500/40",
        iconGradient: "from-purple-500/20 to-purple-500/5",
        iconBorder: "border-purple-500/20",
        iconShadow: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
        textPrimary: "text-purple-400",
        badgeBg: "bg-purple-500/10",
        badgeBorder: "border-purple-500/20",
    }
};

export default function AnimatedStatCard({ title, value, unit, icon, subtitle, themeColor, delay = 0 }: AnimatedStatCardProps) {
    const styles = themeStyles[themeColor];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: "spring", stiffness: 100 }}
            whileHover={{ y: -5, scale: 1.02 }}
            className={`glass-card relative overflow-hidden p-6 flex flex-col justify-between group ${styles.borderHover} transition-all duration-300 shadow-xl cursor-default`}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 ${styles.bgGlow} rounded-full blur-2xl -mr-10 -mt-10 transition-transform duration-700 group-hover:scale-150`} />

            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 bg-gradient-to-br ${styles.iconGradient} rounded-xl border ${styles.iconBorder} backdrop-blur-sm ${styles.iconShadow} relative z-10`}>
                    {React.cloneElement(icon as React.ReactElement, { className: styles.textPrimary })}
                </div>
                <span className={`text-[10px] uppercase tracking-wider ${styles.textPrimary}/80 font-semibold ${styles.badgeBg} px-2 py-1 rounded-full border ${styles.badgeBorder} relative z-10 flex items-center gap-1.5`}>
                    {themeColor === 'emerald' && <div className={`w-1.5 h-1.5 rounded-full ${styles.textPrimary.replace('text', 'bg')} animate-pulse`} />}
                    {subtitle}
                </span>
            </div>

            <div className="relative z-10">
                <p className="text-gray-400 text-sm font-medium mb-1 tracking-wide">{title}</p>
                <div className="flex items-baseline gap-2">
                    <motion.p
                        key={String(value)}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-4xl font-extrabold text-white tracking-tight"
                    >
                        {value}
                    </motion.p>
                    <span className={`text-xs ${styles.textPrimary} font-medium tracking-wide`}>{unit}</span>
                </div>
            </div>
        </motion.div>
    );
}
