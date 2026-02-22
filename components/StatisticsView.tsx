"use client";

import { useMemo, useState, useEffect } from "react";
import { Choir } from "@/types";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ArrowLeft, Users, Mic2, Calendar, TrendingUp, Music, X, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types matching the summary document from Cloud Function ───

interface AttendanceTrendEntry {
    date: string;
    percentage: number;
    present: number;
    total: number;
}

interface SongEntry {
    title: string;
    songId: string;
    count: number;
}

interface StatsSummary {
    totalServices: number;
    averageAttendance: number;
    attendanceTrend: AttendanceTrendEntry[];
    topSongs: SongEntry[];
    allSongs: SongEntry[];
    updatedAt: any;
}

// ─── Component ───

interface StatisticsViewProps {
    choir: Choir;
    onBack: () => void;
}

export default function StatisticsView({ choir, onBack }: StatisticsViewProps) {
    const [stats, setStats] = useState<StatsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Real-time listener on the pre-computed summary doc (1 read, then live updates)
    useEffect(() => {
        if (!choir.id) return;

        const summaryRef = doc(db, `choirs/${choir.id}/stats/summary`);

        const unsub = onSnapshot(
            summaryRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setStats(snapshot.data() as StatsSummary);
                    setError(null);
                } else {
                    // Summary doesn't exist yet (backfill hasn't run, or choir is new)
                    setStats(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error("[StatisticsView] onSnapshot error:", err);
                setError("Помилка завантаження статистики");
                setLoading(false);
            }
        );

        return () => unsub();
    }, [choir.id]);

    // Voice distribution — computed client-side from choir.members (always fresh)
    const voiceData = useMemo(() => {
        const counts: Record<string, number> = { Soprano: 0, Alto: 0, Tenor: 0, Bass: 0, Unassigned: 0 };
        (choir.members || []).forEach(m => {
            if (m.voice && counts[m.voice] !== undefined) {
                counts[m.voice]++;
            } else {
                counts.Unassigned++;
            }
        });

        return [
            { name: 'Сопрано', value: counts.Soprano, color: '#f472b6' },
            { name: 'Альт', value: counts.Alto, color: '#c084fc' },
            { name: 'Тенор', value: counts.Tenor, color: '#60a5fa' },
            { name: 'Бас', value: counts.Bass, color: '#4ade80' },
            { name: 'Не вказано', value: counts.Unassigned, color: '#94a3b8' }
        ].filter(d => d.value > 0);
    }, [choir.members]);

    // Format attendance trend dates for display
    const attendanceData = useMemo(() => {
        if (!stats?.attendanceTrend) return [];
        return stats.attendanceTrend.map(entry => ({
            ...entry,
            date: new Date(entry.date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }),
        }));
    }, [stats?.attendanceTrend]);

    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [showAllSongs, setShowAllSongs] = useState(false);
    const onPieEnter = (_: any, index: number) => setActiveIndex(index);
    const onPieLeave = () => setActiveIndex(null);

    return (
        <div className="min-h-screen bg-background text-text-primary">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-surface border-b border-border px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-surface-highlight rounded-xl transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-text-secondary" />
                </button>
                <h1 className="font-bold text-lg text-text-primary">Статистика хору</h1>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-12 mt-12">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                    <p className="text-text-secondary font-medium">Завантаження статистики...</p>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center p-12 mt-12">
                    <AlertCircle className="w-8 h-8 text-red-400 mb-4" />
                    <p className="text-text-secondary font-medium">{error}</p>
                </div>
            ) : !stats ? (
                <div className="flex flex-col items-center justify-center p-12 mt-12">
                    <Calendar className="w-8 h-8 text-text-secondary mb-4" />
                    <p className="text-text-secondary font-medium">Статистика ще не створена</p>
                    <p className="text-text-secondary text-sm mt-1">Додайте служіння, щоб побачити дані</p>
                </div>
            ) : (
                <div className="p-4 space-y-6 pb-24 max-w-lg mx-auto">

                    {/* Summary Cards */}
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
                            <p className="text-2xl font-bold">{stats.averageAttendance}%</p>
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
                                    <div className="flex flex-col items-center justify-center -mt-1">
                                        <span className="text-sm font-medium text-text-secondary leading-none mb-1">Всього</span>
                                        <span className="text-4xl font-bold text-text-primary leading-none">{(choir.members || []).length}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Attendance Chart */}
                    {attendanceData.length > 0 && (
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
                    )}

                    {/* Most Performed Songs */}
                    {stats.topSongs.length > 0 && (
                        <div className="bg-surface border border-border rounded-3xl p-6">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <Music className="w-5 h-5 text-pink-400" />
                                Найпопулярніші пісні
                            </h3>
                            <div className="space-y-3">
                                {stats.topSongs.slice(0, 10).map((song, idx) => (
                                    <div key={song.songId} className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary w-5 font-mono">{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-text-primary truncate">{song.title}</span>
                                                <span className="text-xs text-text-secondary ml-2">{song.count}×</span>
                                            </div>
                                            <div className="h-1.5 bg-surface-highlight rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                                                    style={{ width: `${(song.count / stats.topSongs[0].count) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {stats.allSongs.length > 10 && (
                                <button
                                    onClick={() => setShowAllSongs(true)}
                                    className="w-full mt-4 py-3 bg-surface-highlight hover:bg-surface-highlight/80 rounded-xl text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-2"
                                >
                                    Показати все ({stats.allSongs.length})
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Show All Songs Modal */}
            {showAllSongs && stats && (
                <div className="fixed inset-0 z-[70] bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
                    <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
                        <button onClick={() => setShowAllSongs(false)} className="p-2 hover:bg-surface-highlight rounded-xl">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="font-bold text-lg">Статистика по пісням ({stats.allSongs.length})</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 pb-safe">
                        <div className="space-y-2 max-w-lg mx-auto">
                            {stats.allSongs.map((song, idx) => (
                                <div key={song.songId} className="flex items-center gap-3 bg-surface border border-border p-3 rounded-xl">
                                    <span className="text-xs text-text-secondary w-6 text-center font-mono">{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-text-primary truncate">{song.title}</span>
                                            <span className="text-sm text-pink-400 font-bold ml-2">{song.count}×</span>
                                        </div>
                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                                            <div
                                                className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                                                style={{ width: `${(song.count / stats.allSongs[0].count) * 100}%` }}
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
