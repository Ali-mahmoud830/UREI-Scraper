import React from "react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { MapPin, BarChart2 } from "lucide-react";

interface DataChartsProps {
    analyticsData: any[];
}

export default function DataCharts({ analyticsData }: DataChartsProps) {
    const hasData = analyticsData && analyticsData.length > 0;

    return (
        <div className="lg:col-span-2 glass-card p-6">
            <h2 className="text-lg font-medium mb-6 flex items-center gap-2">
                <MapPin size={18} className="text-emerald-400" />
                Live Price Trends (Local Computation from DB)
            </h2>
            <div className="h-[300px] w-full">
                {!hasData ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-500">
                        <BarChart2 size={40} className="opacity-30" />
                        <p className="text-sm">Run a search to populate the price trend chart.</p>
                    </div>
                ) : (
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
                )}
            </div>
        </div>
    );
}

