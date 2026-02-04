"use client";

import { useMemo, useState } from "react";
import { Service, Choir, Category } from "@/types";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { ArrowLeft, Users, Mic2, Calendar, TrendingUp, Music, X, ChevronRight } from "lucide-react";
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

    const averageAttendance = useMemo(() => {
        if (attendanceData.length === 0) return 0;
        const sum = attendanceData.reduce((acc, curr) => acc + curr.percentage, 0);
        return Math.round(sum / attendanceData.length);
    }, [attendanceData]);

    // 3. Most Performed Songs
    const allSongFrequencyData = useMemo(() => {
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
            .sort((a, b) => b.count - a.count);
    }, [services]);

    const songFrequencyData = allSongFrequencyData.slice(0, 10); // Top 10 for preview

    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [showAllSongs, setShowAllSongs] = useState(false);
    const onPieEnter = (_: any, index: number) => setActiveIndex(index);
    const onPieLeave = () => setActiveIndex(null);

    return (
        <div className="min-h-screen bg-background text-text-primary">
            {/* ... Header ... */}
            <div className="sticky top-0 z-30 bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-surface-highlight rounded-xl transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-text-secondary" />
                </button>
                <h1 className="font-bold text-lg text-text-primary">Статистика хору</h1>
            </div>

            <div className="p-4 space-y-6 pb-24 max-w-lg mx-auto">

                {/* Summary Cards ... */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface border border-border rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold text-text-secondary uppercase">Учасників</span>
                        </div>
                        <p className="text-2xl font-bold">{(choir.members || []).length}</p>
                    </div>
                    <div className="bg-surface border border-border rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                            <span className="text-xs font-bold text-text-secondary uppercase">Середня явки</span>
                        </div>
                        <p className="text-2xl font-bold">{averageAttendance}%</p>
                    </div>
                </div>

                {/* Voice Balance Chart */}
                <div className="bg-surface border border-border rounded-3xl p-6">
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
                                    onClick={onPieEnter}
                                    onMouseEnter={onPieEnter}
                                    onMouseLeave={onPieLeave}
                                >
                                    {voiceData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color}
                                            stroke="none"
                                            className="outline-none focus:outline-none cursor-pointer hover:opacity-80 transition-opacity"
                                            style={{ outline: 'none' }}
                                        />
                                    ))}
                                </Pie>

                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                            {activeIndex !== null && voiceData[activeIndex] ? (
                                <>
                                    <span className="text-sm font-medium text-text-secondary mb-1">{voiceData[activeIndex].name}</span>
                                    <span className="text-4xl font-bold text-text-primary">{voiceData[activeIndex].value}</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-sm font-medium text-text-secondary mb-1">Всього</span>
                                    <span className="text-4xl font-bold text-text-primary">{(choir.members || []).length}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Attendance Chart */}
                <div className="bg-surface border border-border rounded-3xl p-6">
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
                                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--text-primary)' }}
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
                    <div className="bg-surface border border-border rounded-3xl p-6">
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
                                            <span className="text-sm font-medium text-text-primary truncate">{song.title}</span>
                                            <span className="text-xs text-text-secondary ml-2">{song.count}×</span>
                                        </div>
                                        <div className="h-1.5 bg-surface-highlight rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                                                style={{ width: `${(song.count / songFrequencyData[0].count) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {allSongFrequencyData.length > 10 && (
                            <button
                                onClick={() => setShowAllSongs(true)}
                                className="w-full mt-4 py-3 bg-surface-highlight hover:bg-surface-highlight/80 rounded-xl text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-2"
                            >
                                Показати все ({allSongFrequencyData.length})
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Show All Songs Modal */}
            {showAllSongs && (
                <div className="fixed inset-0 z-[70] bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
                    <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
                        <button onClick={() => setShowAllSongs(false)} className="p-2 hover:bg-surface-highlight rounded-xl">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="font-bold text-lg">Статистика по пісням ({allSongFrequencyData.length})</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 pb-safe">
                        <div className="space-y-2 max-w-lg mx-auto">
                            {allSongFrequencyData.map((song, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-surface border border-border p-3 rounded-xl">
                                    <span className="text-xs text-text-secondary w-6 text-center font-mono">{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-text-primary truncate">{song.title}</span>
                                            <span className="text-sm text-pink-400 font-bold ml-2">{song.count}×</span>
                                        </div>
                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                                            <div
                                                className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                                                style={{ width: `${(song.count / allSongFrequencyData[0].count) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
