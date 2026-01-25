"use client";

import { useMemo } from "react";
import { Service, Choir, Category } from "@/types";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { ArrowLeft, Users, Mic2, Calendar, TrendingUp, Music } from "lucide-react";
import { motion } from "framer-motion";

interface StatisticsViewProps {
    choir: Choir;
    services: Service[];
    onBack: () => void;
}

export default function StatisticsView({ choir, services, onBack }: StatisticsViewProps) {
    // 1. Voice Distribution Data
    const voiceData = useMemo(() => {
        const counts = { Soprano: 0, Alto: 0, Tenor: 0, Bass: 0, Unassigned: 0 };
        (choir.members || []).forEach(m => {
            if (m.voice && counts[m.voice] !== undefined) {
                counts[m.voice]++;
            } else {
                counts.Unassigned++;
            }
        });

        return [
            { name: 'Сопрано', value: counts.Soprano, color: '#f472b6' }, // Pink
            { name: 'Альт', value: counts.Alto, color: '#c084fc' }, // Purple
            { name: 'Тенор', value: counts.Tenor, color: '#60a5fa' }, // Blue
            { name: 'Бас', value: counts.Bass, color: '#4ade80' }, // Green
            { name: 'Не вказано', value: counts.Unassigned, color: '#94a3b8' } // Slate
        ].filter(d => d.value > 0);
    }, [choir.members]);

    // 2. Attendance Trend Data (Last 10 services)
    const attendanceData = useMemo(() => {
        if (!services.length) return [];

        // Sort by date ascending
        const sorted = [...services].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const recent = sorted.slice(-10); // Last 10

        const totalMembers = (choir.members || []).length;
        if (totalMembers === 0) return [];

        return recent.map(s => {
            const absentCount = (s.absentMembers || []).length;
            const presentCount = Math.max(0, totalMembers - absentCount);
            const percentage = Math.round((presentCount / totalMembers) * 100);

            return {
                date: new Date(s.date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }),
                percentage,
                present: presentCount,
                total: totalMembers
            };
        });
    }, [services, choir.members]);

    // 3. Most Performed Songs
    const songFrequencyData = useMemo(() => {
        const songCounts: Record<string, { title: string; count: number }> = {};
        services.forEach(s => {
            s.songs.forEach(song => {
                const title = song.songTitle || song.songId;
                if (!songCounts[song.songId]) {
                    songCounts[song.songId] = { title, count: 0 };
                }
                songCounts[song.songId].count++;
            });
        });

        // Convert to array and sort by count descending
        return Object.values(songCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10
    }, [services]);

    const averageAttendance = useMemo(() => {
        if (!attendanceData.length) return 0;
        const sum = attendanceData.reduce((acc, curr) => acc + curr.percentage, 0);
        return Math.round(sum / attendanceData.length);
    }, [attendanceData]);

    return (
        <div className="min-h-screen bg-[#09090b] text-white">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-text-secondary" />
                </button>
                <h1 className="font-bold text-lg">Статистика хору</h1>
            </div>

            <div className="p-4 space-y-6 pb-24 max-w-lg mx-auto">

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface border border-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold text-text-secondary uppercase">Учасників</span>
                        </div>
                        <p className="text-2xl font-bold">{(choir.members || []).length}</p>
                    </div>
                    <div className="bg-surface border border-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                            <span className="text-xs font-bold text-text-secondary uppercase">Середня явки</span>
                        </div>
                        <p className="text-2xl font-bold">{averageAttendance}%</p>
                    </div>
                </div>

                {/* Voice Balance Chart */}
                <div className="bg-surface border border-white/5 rounded-3xl p-6">
                    <h3 className="font-bold mb-6 flex items-center gap-2">
                        <Mic2 className="w-5 h-5 text-purple-400" />
                        Баланс голосів
                    </h3>
                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={voiceData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {voiceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '12px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <span className="text-3xl font-bold text-white">{(choir.members || []).length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Attendance Chart */}
                <div className="bg-surface border border-white/5 rounded-3xl p-6">
                    <h3 className="font-bold mb-6 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-orange-400" />
                        Динаміка відвідуваності
                    </h3>
                    <div className="h-64 w-full -ml-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={attendanceData}>
                                <defs>
                                    <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#666"
                                    tick={{ fill: '#666', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#666"
                                    tick={{ fill: '#666', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    unit="%"
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '12px', color: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="percentage"
                                    stroke="#f97316"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorPv)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-text-secondary text-center mt-2">Останні 10 служінь</p>
                </div>

                {/* Most Performed Songs */}
                {songFrequencyData.length > 0 && (
                    <div className="bg-surface border border-white/5 rounded-3xl p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <Music className="w-5 h-5 text-pink-400" />
                            Найпопулярніші пісні
                        </h3>
                        <div className="space-y-3">
                            {songFrequencyData.map((song, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <span className="text-xs text-text-secondary w-5 font-mono">{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-white truncate">{song.title}</span>
                                            <span className="text-xs text-text-secondary ml-2">{song.count}×</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                                                style={{ width: `${(song.count / songFrequencyData[0].count) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
