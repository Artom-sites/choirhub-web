"use client";

import { useEffect, useState } from "react";
import { Service, ServiceSong, SimpleSong, Choir, ChoirMember } from "@/types";
import { getSongs, addSongToService, removeSongFromService, getChoir, updateService, setServiceAttendance } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, Eye, X, Plus, Users, UserX, Check, Calendar, Music, UserCheck, AlertCircle } from "lucide-react";
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

    const handleAddSong = async (song: SimpleSong) => {
        if (!userData?.choirId) return;

        const newServiceSong: ServiceSong = {
            songId: song.id,
            songTitle: song.title
        };

        const updatedSongs = [...currentService.songs, newServiceSong];
        setCurrentService({ ...currentService, songs: updatedSongs });
        setShowAddSong(false);
        setSearch("");

        await addSongToService(userData.choirId, currentService.id, newServiceSong);
    };

    const handleRemoveSong = async (index: number) => {
        if (!userData?.choirId) return;

        const updatedSongs = [...currentService.songs];
        updatedSongs.splice(index, 1);

        setCurrentService({ ...currentService, songs: updatedSongs });
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
        await updateService(userData.choirId, currentService.id, { absentMembers });
        setCurrentService({ ...currentService, absentMembers });
        setShowAttendance(false);
    };

    const filteredSongs = availableSongs.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) &&
        !currentService.songs.some(existing => existing.songId === s.id)
    );

    const absentCount = absentMembers.length;
    const presentMembers = choirMembers.filter(m => !absentMembers.includes(m.id));
    const presentCount = presentMembers.length;
    const myStatus = getMyStatus();
    const isFuture = isUpcoming(currentService.date);

    // Get avatars for preview
    const previewAttendees = membersLoading ? [] : presentMembers.slice(0, 4);
    const extraAttendees = presentCount > 4 ? presentCount - 4 : 0;

    return (
        <div className="pb-32 bg-background min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 pt-12 pb-4 flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 text-text-secondary hover:text-white rounded-full hover:bg-white/5 transition-colors"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-white leading-tight">{currentService.title}</h1>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 py-6 space-y-6">

                {/* Date Badge */}
                <div className="flex items-center gap-3 text-text-secondary bg-surface/50 p-3 rounded-2xl border border-white/5">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-text-secondary/70">Дата</p>
                        <p className="text-white font-medium">
                            {new Date(currentService.date).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                </div>

                {/* Voting Section */}
                {isFuture && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-text-secondary px-1 uppercase tracking-wide">Ваша участь</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleVote('present')}
                                disabled={votingLoading}
                                className={`relative overflow-hidden p-4 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-3 ${myStatus === 'present'
                                    ? 'bg-green-500/20 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]'
                                    : 'bg-surface border-white/5 hover:border-white/20'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${myStatus === 'present' ? 'bg-green-500 text-black' : 'bg-white/5 text-text-secondary'
                                    }`}>
                                    <Check className="w-6 h-6" strokeWidth={3} />
                                </div>
                                <span className={`font-bold ${myStatus === 'present' ? 'text-green-400' : 'text-text-secondary'}`}>
                                    Я буду
                                </span>
                            </button>

                            <button
                                onClick={() => handleVote('absent')}
                                disabled={votingLoading}
                                className={`relative overflow-hidden p-4 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-3 ${myStatus === 'absent'
                                    ? 'bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                                    : 'bg-surface border-white/5 hover:border-white/20'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${myStatus === 'absent' ? 'bg-red-500 text-white' : 'bg-white/5 text-text-secondary'
                                    }`}>
                                    <X className="w-6 h-6" strokeWidth={3} />
                                </div>
                                <span className={`font-bold ${myStatus === 'absent' ? 'text-red-400' : 'text-text-secondary'}`}>
                                    Не буду
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Attendees Section */}
                <div onClick={() => canEdit && setShowAttendance(true)} className={`p-5 bg-surface border border-white/5 rounded-3xl space-y-4 ${canEdit ? 'cursor-pointer hover:border-white/20 transition-colors' : ''}`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-white font-bold">
                            <Users className="w-5 h-5 text-indigo-400" />
                            <span>Учасники</span>
                        </div>
                        {canEdit && <span className="text-xs text-text-secondary bg-white/5 px-2 py-1 rounded-full">Редагувати</span>}
                    </div>

                    {!membersLoading ? (
                        <div className="flex items-center justify-between">
                            <div className="flex -space-x-3">
                                {previewAttendees.map((member) => (
                                    <div key={member.id} className="w-10 h-10 rounded-full border-2 border-[#18181b] bg-indigo-500/90 flex items-center justify-center text-xs font-bold text-white">
                                        {member.name?.[0]?.toUpperCase()}
                                    </div>
                                ))}
                                {extraAttendees > 0 && (
                                    <div className="w-10 h-10 rounded-full border-2 border-[#18181b] bg-surface-highlight flex items-center justify-center text-xs font-bold text-white">
                                        +{extraAttendees}
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-white">{presentCount}</p>
                                <p className="text-xs text-text-secondary">підтвердили</p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-10 w-full animate-pulse bg-white/5 rounded-xl" />
                    )}

                    {absentCount > 0 && (
                        <div className="flex items-center gap-2 text-xs text-orange-400/80 bg-orange-500/10 p-2 rounded-lg">
                            <AlertCircle className="w-4 h-4" />
                            <span>{absentCount} не зможуть бути</span>
                        </div>
                    )}
                </div>

                {/* Songs Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide px-1">Програма ({currentService.songs.length})</h3>
                        {canEdit && (
                            <button
                                onClick={() => setShowAddSong(true)}
                                className="text-xs bg-white text-black font-bold px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" />
                                Додати
                            </button>
                        )}
                    </div>

                    {currentService.songs.length === 0 ? (
                        <div className="text-center py-10 bg-surface border border-white/5 rounded-3xl flex flex-col items-center justify-center gap-3">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-text-secondary">
                                <Music className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-white font-medium">Список порожній</p>
                                <p className="text-sm text-text-secondary">Додайте пісні до цього служіння</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {currentService.songs.map((song, index) => {
                                const originalSong = availableSongs.find(s => s.id === song.songId);
                                const hasPdf = originalSong?.hasPdf;

                                return (
                                    <div key={`${song.songId}-${index}`} className="flex items-center gap-4 bg-surface hover:bg-surface-highlight border border-white/5 p-4 rounded-2xl group transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-mono text-text-secondary">
                                            {index + 1}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-medium truncate text-lg">{song.songTitle}</h3>
                                            {hasPdf && <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md inline-block mt-1">PDF</span>}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {hasPdf && (
                                                <button
                                                    onClick={() => handleViewPdf(song.songId)}
                                                    className="p-3 text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </button>
                                            )}

                                            {canEdit && (
                                                <button
                                                    onClick={() => handleRemoveSong(index)}
                                                    className="p-3 text-red-400 bg-red-500/5 hover:bg-red-500/10 rounded-xl transition-colors"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Add Song Button (Bottom) */}
                {canEdit && currentService.songs.length > 0 && (
                    <button
                        onClick={() => setShowAddSong(true)}
                        className="w-full py-4 border border-dashed border-white/10 rounded-3xl text-text-secondary hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Додати ще пісню
                    </button>
                )}
            </div>

            {/* Modals remain mostly simple, just style updates */}
            {/* Add Song Sheet */}
            {showAddSong && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col pt-24 animate-in slide-in-from-bottom duration-300">
                    <div className="bg-[#09090b] flex-1 rounded-t-[32px] overflow-hidden flex flex-col ring-1 ring-white/10">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-surface">
                            <h3 className="text-xl font-bold text-white">Додати пісню</h3>
                            <button onClick={() => setShowAddSong(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                                <X className="w-6 h-6 text-white" />
                            </button>
                        </div>

                        <div className="p-4 bg-surface border-b border-white/5">
                            <input
                                type="text"
                                placeholder="Пошук пісні..."
                                className="w-full px-5 py-4 bg-black/40 rounded-2xl text-white border border-white/5 focus:outline-none focus:border-white/20 text-lg placeholder:text-white/20"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-black/20">
                            {filteredSongs.map(song => (
                                <button
                                    key={song.id}
                                    onClick={() => handleAddSong(song)}
                                    className="w-full text-left p-4 bg-surface hover:bg-white/10 rounded-2xl border border-white/5 flex justify-between items-center group transition-all"
                                >
                                    <span className="text-white font-medium text-lg">{song.title}</span>
                                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-green-500 group-hover:text-black transition-colors">
                                        <Plus className="w-6 h-6" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Attendance Sheet */}
            {showAttendance && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col pt-24 animate-in slide-in-from-bottom duration-300">
                    <div className="bg-[#09090b] flex-1 rounded-t-[32px] overflow-hidden flex flex-col ring-1 ring-white/10">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-surface">
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold text-white">Учасники</h3>
                                <p className="text-xs text-text-secondary">Натисніть щоб змінити статус</p>
                            </div>
                            <button onClick={() => setShowAttendance(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                                <X className="w-6 h-6 text-white" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-black/20">
                            {choirMembers.map(member => {
                                const isAbsent = absentMembers.includes(member.id);
                                return (
                                    <button
                                        key={member.id}
                                        onClick={() => toggleAbsent(member.id)}
                                        className={`w-full text-left p-4 rounded-2xl border flex justify-between items-center transition-all ${isAbsent
                                            ? 'bg-red-500/10 border-red-500/30'
                                            : 'bg-surface border-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${isAbsent ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'
                                                }`}>
                                                {member.name?.[0]?.toUpperCase()}
                                            </div>
                                            <span className={`font-medium text-lg ${isAbsent ? 'text-red-400' : 'text-white'}`}>
                                                {member.name}
                                            </span>
                                        </div>
                                        {isAbsent ? (
                                            <span className="text-xs font-bold bg-red-500 text-white px-3 py-1 rounded-full">Відсутній</span>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                                <Check className="w-5 h-5 text-green-500" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-6 bg-surface border-t border-white/5 safe-area-bottom">
                            <button
                                onClick={handleSaveAttendance}
                                className="w-full py-4 bg-white text-black rounded-2xl font-bold text-lg hover:bg-gray-200 transition-colors shadow-lg"
                            >
                                Зберегти зміни
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
