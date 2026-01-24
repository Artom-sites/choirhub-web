"use client";

import { useEffect, useState } from "react";
import { Service, ServiceSong, SimpleSong, Choir, ChoirMember } from "@/types";
import { getSongs, addSongToService, removeSongFromService, getChoir, updateService, setServiceAttendance } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, Eye, X, Plus, Users, UserX, Check, HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface ServiceViewProps {
    service: Service;
    onBack: () => void;
    canEdit: boolean;
}

export default function ServiceView({ service, onBack, canEdit }: ServiceViewProps) {
    const router = useRouter();
    const { userData, user } = useAuth();

    // Local state for optimistic updates
    const [currentService, setCurrentService] = useState<Service>(service);
    const [availableSongs, setAvailableSongs] = useState<SimpleSong[]>([]);
    const [showAddSong, setShowAddSong] = useState(false);
    const [showAttendance, setShowAttendance] = useState(false);
    const [search, setSearch] = useState("");
    const [votingLoading, setVotingLoading] = useState(false);

    // Choir members for attendance
    const [choirMembers, setChoirMembers] = useState<ChoirMember[]>([]);
    const [absentMembers, setAbsentMembers] = useState<string[]>(service.absentMembers || []);
    const [membersLoading, setMembersLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            setMembersLoading(true);
            if (userData?.choirId) {
                // Fetch in parallel
                const [songs, choir] = await Promise.all([
                    getSongs(userData.choirId),
                    getChoir(userData.choirId)
                ]);

                setAvailableSongs(songs);
                if (choir?.members) {
                    setChoirMembers(choir.members);
                }
            }
            setMembersLoading(false);
        }
        fetchData();
    }, [userData?.choirId]);

    const handleVote = async (status: 'present' | 'absent') => {
        if (!userData?.choirId || !user?.uid) return;
        setVotingLoading(true);
        try {
            await setServiceAttendance(userData.choirId, currentService.id, user.uid, status);

            // Update local state
            const uid = user.uid;
            let newConfirmed = currentService.confirmedMembers || [];
            let newAbsent = currentService.absentMembers || [];

            if (status === 'present') {
                newConfirmed = [...newConfirmed, uid].filter((v, i, a) => a.indexOf(v) === i);
                newAbsent = newAbsent.filter(id => id !== uid);
            } else {
                newAbsent = [...newAbsent, uid].filter((v, i, a) => a.indexOf(v) === i);
                newConfirmed = newConfirmed.filter(id => id !== uid);
            }

            setCurrentService({ ...currentService, confirmedMembers: newConfirmed, absentMembers: newAbsent });
        } catch (e) { console.error(e); }
        finally { setVotingLoading(false); }
    };

    const isUpcoming = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(dateStr) >= today;
    };

    const getMyStatus = () => {
        if (!user?.uid) return 'unknown';
        if (currentService.confirmedMembers?.includes(user?.uid)) return 'present';
        if (currentService.absentMembers?.includes(user?.uid)) return 'absent';
        return 'unknown';
    };

    // ... existing handlers ...

    const handleAddSong = async (song: SimpleSong) => {
        if (!userData?.choirId) return;

        const newServiceSong: ServiceSong = {
            songId: song.id,
            songTitle: song.title
        };

        // Optimistic update
        const updatedSongs = [...currentService.songs, newServiceSong];
        setCurrentService({ ...currentService, songs: updatedSongs });
        setShowAddSong(false);
        setSearch("");

        // DB Update
        await addSongToService(userData.choirId, currentService.id, newServiceSong);
    };

    const handleRemoveSong = async (index: number) => {
        if (!userData?.choirId) return;

        const updatedSongs = [...currentService.songs];
        updatedSongs.splice(index, 1);

        // Optimistic update
        setCurrentService({ ...currentService, songs: updatedSongs });

        // DB Update
        await removeSongFromService(userData.choirId, currentService.id, updatedSongs);
    };

    const handleViewPdf = (songId: string) => {
        router.push(`/song/${songId}`);
    };

    const toggleAbsent = (memberId: string) => {
        setAbsentMembers(prev =>
            prev.includes(memberId)
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    const handleSaveAttendance = async () => {
        if (!userData?.choirId) return;

        // Update DB
        await updateService(userData.choirId, currentService.id, { absentMembers });

        // Update local state
        setCurrentService({ ...currentService, absentMembers });
        setShowAttendance(false);
    };

    const filteredSongs = availableSongs.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) &&
        !currentService.songs.some(existing => existing.songId === s.id)
    );

    const absentCount = absentMembers.length;
    const presentCount = choirMembers.length - absentCount;
    const myStatus = getMyStatus();
    const isFuture = isUpcoming(currentService.date);

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 px-4 py-4 flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-1 text-text-secondary hover:text-white transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                    Назад
                </button>

                <div className="text-center">
                    <h2 className="text-white font-bold">{currentService.title}</h2>
                    <p className="text-xs text-text-secondary">
                        {new Date(currentService.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}
                    </p>
                </div>

                <div className="w-16"></div>
            </div>

            <div className="max-w-md mx-auto px-4 py-6">

                {/* Voting Section */}
                {isFuture && (
                    <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                        <p className="text-sm font-bold text-white mb-3">Ви будете на цьому служінні?</p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={() => handleVote('present')}
                                disabled={votingLoading}
                                className={`flex-1 py-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${myStatus === 'present'
                                    ? 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20'
                                    : 'bg-white/5 text-text-secondary border-white/5 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <Check className="w-5 h-5" />
                                {myStatus === 'present' ? 'Я буду' : 'Буду'}
                            </button>

                            <button
                                onClick={() => handleVote('absent')}
                                disabled={votingLoading}
                                className={`flex-1 py-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${myStatus === 'absent'
                                    ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                                    : 'bg-white/5 text-text-secondary border-white/5 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <X className="w-5 h-5" />
                                {myStatus === 'absent' ? 'Не буду' : 'Не буду'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Attendance Summary Card */}
                {membersLoading ? (
                    <div className="w-full mb-6 p-4 rounded-2xl border border-white/5 bg-white/5 h-[76px] animate-pulse flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/10" />
                        <div className="space-y-2 flex-1">
                            <div className="h-4 w-32 bg-white/10 rounded" />
                            <div className="h-3 w-24 bg-white/10 rounded" />
                        </div>
                    </div>
                ) : choirMembers.length > 0 && (
                    <button
                        onClick={() => canEdit && setShowAttendance(true)}
                        className={`w-full mb-6 p-4 rounded-2xl border flex items-center justify-between transition-all ${absentCount > 0
                            ? 'bg-orange-500/10 border-orange-500/30'
                            : 'bg-green-500/10 border-green-500/30'
                            } ${canEdit ? 'hover:bg-white/5 cursor-pointer' : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${absentCount > 0 ? 'bg-orange-500/20' : 'bg-green-500/20'
                                }`}>
                                {absentCount > 0 ? (
                                    <UserX className="w-5 h-5 text-orange-400" />
                                ) : (
                                    <Users className="w-5 h-5 text-green-400" />
                                )}
                            </div>
                            <div className="text-left">
                                <p className="text-white font-bold text-sm">
                                    {absentCount > 0 ? `Відсутні: ${absentCount}` : 'Усі присутні'}
                                </p>
                                <p className="text-xs text-text-secondary">
                                    {presentCount} з {choirMembers.length} учасників
                                </p>
                            </div>
                        </div>
                        {canEdit && (
                            <span className="text-xs text-text-secondary">Редагувати →</span>
                        )}
                    </button>
                )}

                {/* Songs List */}
                <div className="space-y-4">
                    {currentService.songs.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl">
                            <p className="text-text-secondary mb-4">Список пісень порожній</p>
                            {canEdit && (
                                <button
                                    onClick={() => setShowAddSong(true)}
                                    className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors text-sm"
                                >
                                    Додати пісню
                                </button>
                            )}
                        </div>
                    ) : (
                        currentService.songs.map((song, index) => {
                            const originalSong = availableSongs.find(s => s.id === song.songId);
                            const hasPdf = originalSong?.hasPdf;

                            return (
                                <div key={`${song.songId}-${index}`} className="flex items-center gap-3 bg-surface border border-white/5 p-4 rounded-xl group">
                                    <span className="text-text-secondary font-mono text-sm w-6 text-center">{index + 1}</span>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-bold truncate">{song.songTitle}</h3>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {hasPdf && (
                                            <button
                                                onClick={() => handleViewPdf(song.songId)}
                                                className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        )}

                                        {canEdit && (
                                            <button
                                                onClick={() => handleRemoveSong(index)}
                                                className="p-2 text-text-secondary hover:text-red-500 hover:bg-white/5 rounded-lg transition-colors"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Add Song Button */}
                {canEdit && (
                    <button
                        onClick={() => setShowAddSong(true)}
                        className="w-full mt-6 py-4 border border-dashed border-white/10 rounded-xl text-text-secondary hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Додати пісню до списку
                    </button>
                )}
            </div>

            {/* Add Song Sheet */}
            {showAddSong && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col pt-10 animate-in slide-in-from-bottom duration-300">
                    <div className="bg-[#18181b] flex-1 rounded-t-3xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center">
                            <h3 className="text-white font-bold">Оберіть пісню</h3>
                            <button onClick={() => setShowAddSong(false)} className="p-2 bg-white/5 rounded-full">
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-white/5">
                            <input
                                type="text"
                                placeholder="Пошук..."
                                className="w-full px-4 py-3 bg-black/20 rounded-xl text-white border border-white/5 focus:outline-none focus:border-white/20"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {filteredSongs.map(song => (
                                <button
                                    key={song.id}
                                    onClick={() => handleAddSong(song)}
                                    className="w-full text-left p-4 bg-surface hover:bg-white/5 rounded-xl border border-white/5 flex justify-between items-center group"
                                >
                                    <span className="text-white font-medium">{song.title}</span>
                                    <Plus className="w-5 h-5 text-white/20 group-hover:text-green-500" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Attendance Sheet */}
            {showAttendance && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col pt-10 animate-in slide-in-from-bottom duration-300">
                    <div className="bg-[#18181b] flex-1 rounded-t-3xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center">
                            <h3 className="text-white font-bold">Відмітити присутність</h3>
                            <button onClick={() => setShowAttendance(false)} className="p-2 bg-white/5 rounded-full">
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-white/5 text-sm text-text-secondary">
                            Натисніть на учасника, щоб відмітити як <span className="text-orange-400">відсутнього</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {choirMembers.map(member => {
                                const isAbsent = absentMembers.includes(member.id);
                                return (
                                    <button
                                        key={member.id}
                                        onClick={() => toggleAbsent(member.id)}
                                        className={`w-full text-left p-4 rounded-xl border flex justify-between items-center transition-all ${isAbsent
                                            ? 'bg-orange-500/10 border-orange-500/30'
                                            : 'bg-surface border-white/5 hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isAbsent ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-white'
                                                }`}>
                                                {member.name?.[0]?.toUpperCase()}
                                            </div>
                                            <span className={`font-medium ${isAbsent ? 'text-orange-400' : 'text-white'}`}>
                                                {member.name}
                                            </span>
                                        </div>
                                        {isAbsent ? (
                                            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">Відсутній</span>
                                        ) : (
                                            <Check className="w-5 h-5 text-green-500" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-4 border-t border-white/5">
                            <button
                                onClick={handleSaveAttendance}
                                className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors"
                            >
                                Зберегти ({choirMembers.length - absentMembers.length} присутні)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
