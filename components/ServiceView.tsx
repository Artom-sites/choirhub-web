"use client";

import { useEffect, useState } from "react";
import { Service, ServiceSong, SimpleSong, Choir, ChoirMember } from "@/types";
import { getSongs, addSongToService, removeSongFromService, getChoir, updateService, setServiceAttendance, addKnownConductor, addKnownPianist } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, Eye, X, Plus, Users, UserX, Check, Calendar, Music, UserCheck, AlertCircle, Trash2, User as UserIcon } from "lucide-react";
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
    const [isEditMode, setIsEditMode] = useState(false);

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
                if (choir?.knownConductors) {
                    setKnownConductors(choir.knownConductors);
                }
                if (choir?.knownPianists) {
                    setKnownPianists(choir.knownPianists);
                }
            }
            setMembersLoading(false);
        }
        fetchData();
    }, [userData?.choirId]);

    // Song credits state
    const [knownConductors, setKnownConductors] = useState<string[]>([]);
    const [knownPianists, setKnownPianists] = useState<string[]>([]);
    const [editingSongIndex, setEditingSongIndex] = useState<number | null>(null);
    const [tempConductor, setTempConductor] = useState("");
    const [tempPianist, setTempPianist] = useState("");

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

    const isUpcoming = (dateStr: string, timeStr?: string) => {
        const now = new Date();
        const serviceDate = new Date(dateStr);

        if (timeStr) {
            // Parse time and set it on the service date
            const [hours, minutes] = timeStr.split(':').map(Number);
            serviceDate.setHours(hours, minutes, 0, 0);
            return serviceDate > now;
        } else {
            // If no time, check if date is today or future (using end of day)
            serviceDate.setHours(23, 59, 59, 999);
            return serviceDate >= now;
        }
    };

    const getMyStatus = () => {
        if (!user?.uid) return 'unknown';
        if (currentService.confirmedMembers?.includes(user?.uid)) return 'present';
        if (currentService.absentMembers?.includes(user?.uid)) return 'absent';
        return 'unknown';
    };



    const [selectedSongsToService, setSelectedSongsToService] = useState<string[]>([]);
    const [addingSongsLoading, setAddingSongsLoading] = useState(false);

    const toggleSongSelection = (songId: string) => {
        setSelectedSongsToService(prev =>
            prev.includes(songId)
                ? prev.filter(id => id !== songId)
                : [...prev, songId]
        );
    };

    const handleBatchAddSongs = async () => {
        if (!userData?.choirId || selectedSongsToService.length === 0) return;
        setAddingSongsLoading(true);

        // Find full song objects
        const songsToAdd = availableSongs.filter(s => selectedSongsToService.includes(s.id));
        const newServiceSongs: ServiceSong[] = songsToAdd.map(s => ({
            songId: s.id,
            songTitle: s.title
        }));

        const updatedSongs = [...currentService.songs, ...newServiceSongs];
        setCurrentService({ ...currentService, songs: updatedSongs });

        setShowAddSong(false);
        setSearch("");
        setSelectedSongsToService([]);
        setAddingSongsLoading(false);

        // Save to DB (One by one or strictly update array - current impl adds one by one, 
        // but ideally we should update the whole array. existing removeSongFromService updates whole array.
        // addSongToService appends to arrayUnion. We can call it in loop or update whole doc.
        // Let's use updateService to overwrite the songs array for consistency and atomicity if possible, 
        // but 'addSongToService' might be using arrayUnion.
        // Check 'removeSongFromService': it does updateDoc({songs: newSongs}).
        // So we can just use updateService to set the new list.
        try {
            await updateService(userData.choirId, currentService.id, { songs: updatedSongs });
        } catch (e) {
            console.error("Failed to batch add songs", e);
        }
    };



    const [songToDeleteIndex, setSongToDeleteIndex] = useState<number | null>(null);

    const handleRemoveSong = (index: number) => {
        setSongToDeleteIndex(index);
    };

    const confirmRemoveSong = async () => {
        if (!userData?.choirId || songToDeleteIndex === null) return;

        const updatedSongs = [...currentService.songs];
        updatedSongs.splice(songToDeleteIndex, 1);

        setCurrentService({ ...currentService, songs: updatedSongs });
        setSongToDeleteIndex(null);

        await removeSongFromService(userData.choirId, currentService.id, updatedSongs);
    };

    const handleViewPdf = (songId: string) => {
        router.push(`/song/${songId}`);
    };

    const openEditCredits = (index: number) => {
        const song = currentService.songs[index];
        setTempConductor(song.performedBy || "");
        setTempPianist(song.pianist || "");
        setEditingSongIndex(index);
    };

    const handleSaveCredits = async () => {
        if (editingSongIndex === null || !userData?.choirId) return;

        const updatedSongs = [...currentService.songs];
        updatedSongs[editingSongIndex] = {
            ...updatedSongs[editingSongIndex],
            performedBy: tempConductor || undefined,
            pianist: tempPianist || undefined,
        };

        setCurrentService({ ...currentService, songs: updatedSongs });
        setEditingSongIndex(null);

        // Save to Firestore
        await updateService(userData.choirId, currentService.id, { songs: updatedSongs });

        // Add new names to known lists (if not empty and not already in list)
        if (tempConductor && !knownConductors.includes(tempConductor)) {
            await addKnownConductor(userData.choirId, tempConductor);
            setKnownConductors(prev => [...prev, tempConductor]);
        }
        if (tempPianist && !knownPianists.includes(tempPianist)) {
            await addKnownPianist(userData.choirId, tempPianist);
            setKnownPianists(prev => [...prev, tempPianist]);
        }
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
    // Explicitly confirmed members (Only those who voted "Present")
    const confirmedMembersList = choirMembers.filter(m => currentService.confirmedMembers?.includes(m.id));
    const confirmedCount = confirmedMembersList.length;

    const myStatus = getMyStatus();
    const isFuture = isUpcoming(currentService.date, currentService.time);

    // Get avatars for preview (only explicitly confirmed)
    const previewAttendees = membersLoading ? [] : confirmedMembersList.slice(0, 4);
    const extraAttendees = confirmedCount > 4 ? confirmedCount - 4 : 0;

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

            <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

                {/* Date Badge - Compact */}
                <div className="flex items-center gap-3 text-text-secondary bg-surface/50 p-3 rounded-2xl border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-white font-medium text-sm">
                        {new Date(currentService.date).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {currentService.time && <span className="text-blue-400 ml-2">о {currentService.time}</span>}
                    </p>
                </div>

                {/* Songs Program - FIRST */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide px-1">Програма ({currentService.songs.length})</h3>
                        {canEdit && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsEditMode(!isEditMode)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isEditMode
                                        ? 'bg-red-500 text-white'
                                        : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setShowAddSong(true)}
                                    className="text-xs bg-white text-black font-bold px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    Додати
                                </button>
                            </div>
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

                                        <div className="flex-1 min-w-0" onClick={() => canEdit && openEditCredits(index)}>
                                            <h3 className="text-white font-medium truncate text-lg">{song.songTitle}</h3>
                                            {/* Credits Display */}
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {song.performedBy && (
                                                    <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                        <UserIcon className="w-3 h-3" /> {song.performedBy}
                                                    </span>
                                                )}
                                                {song.pianist && (
                                                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                        🎹 {song.pianist}
                                                    </span>
                                                )}
                                                {hasPdf && <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">PDF</span>}
                                            </div>
                                            {/* Hint to edit */}
                                            {canEdit && !song.performedBy && !song.pianist && (
                                                <p className="text-xs text-text-secondary/50 mt-1">Натисни, щоб вказати хто диригував</p>
                                            )}
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

                                            {canEdit && isEditMode && (
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

                    {/* Add Song Button (Bottom) */}
                    {canEdit && currentService.songs.length > 0 && !isEditMode && (
                        <button
                            onClick={() => setShowAddSong(true)}
                            className="w-full py-4 border border-dashed border-white/10 rounded-3xl text-text-secondary hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Додати ще пісню
                        </button>
                    )}
                </div>

                {/* Voting Section - Compact */}
                {isFuture && (
                    <div className="bg-surface border border-white/5 rounded-2xl p-4">
                        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-3">Ваша участь</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleVote('present')}
                                disabled={votingLoading}
                                className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${myStatus === 'present'
                                    ? 'bg-green-500/20 border-green-500'
                                    : 'bg-black/20 border-white/5 hover:border-white/20'
                                    }`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${myStatus === 'present' ? 'bg-green-500 text-black' : 'bg-white/10 text-text-secondary'}`}>
                                    <Check className="w-4 h-4" strokeWidth={3} />
                                </div>
                                <span className={`text-sm font-bold ${myStatus === 'present' ? 'text-green-400' : 'text-text-secondary'}`}>Буду</span>
                            </button>

                            <button
                                onClick={() => handleVote('absent')}
                                disabled={votingLoading}
                                className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${myStatus === 'absent'
                                    ? 'bg-red-500/20 border-red-500'
                                    : 'bg-black/20 border-white/5 hover:border-white/20'
                                    }`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${myStatus === 'absent' ? 'bg-red-500 text-white' : 'bg-white/10 text-text-secondary'}`}>
                                    <X className="w-4 h-4" strokeWidth={3} />
                                </div>
                                <span className={`text-sm font-bold ${myStatus === 'absent' ? 'text-red-400' : 'text-text-secondary'}`}>Не буду</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Attendees Section - Simplified (no avatars, just counts) */}
                {(canEdit || !isFuture) && (
                    <div onClick={() => canEdit && setShowAttendance(true)} className={`p-4 bg-surface border border-white/5 rounded-2xl ${canEdit ? 'cursor-pointer hover:border-white/20 transition-colors' : ''}`}>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-white font-bold">
                                <Users className="w-5 h-5 text-indigo-400" />
                                <span>Учасники</span>
                            </div>
                            {canEdit && <span className="text-xs text-text-secondary bg-white/5 px-2 py-1 rounded-full">Переглянути</span>}
                        </div>

                        {!membersLoading && (
                            <div className="flex items-center gap-4 mt-3 text-sm">
                                <div className="flex items-center gap-1">
                                    <UserCheck className="w-4 h-4 text-green-400" />
                                    <span className="text-white font-bold">{confirmedCount}</span>
                                    <span className="text-text-secondary">буде</span>
                                </div>
                                {absentCount > 0 && (
                                    <div className="flex items-center gap-1">
                                        <UserX className="w-4 h-4 text-red-400" />
                                        <span className="text-white font-bold">{absentCount}</span>
                                        <span className="text-text-secondary">не буде</span>
                                    </div>
                                )}
                                {(choirMembers.length - confirmedCount - absentCount) > 0 && (
                                    <div className="flex items-center gap-1 text-text-secondary">
                                        <span className="font-bold">{choirMembers.length - confirmedCount - absentCount}</span>
                                        <span>очікують</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals remain mostly simple, just style updates */}
            {/* Add Song Sheet - Full Screen Multiselect */}
            {showAddSong && (
                <div className="fixed inset-0 z-[60] bg-[#09090b] flex flex-col animate-in slide-in-from-bottom duration-300">
                    <div className="p-4 pt-safe border-b border-white/5 flex justify-between items-center bg-surface/50 backdrop-blur-xl sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setShowAddSong(false)} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors text-white">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <div>
                                <h3 className="text-xl font-bold text-white">Додати пісні</h3>
                                <p className="text-xs text-text-secondary">Оберіть пісні зі списку</p>
                            </div>
                        </div>
                        <div className="w-10" /> {/* Spacer for balance */}
                    </div>

                    <div className="p-4 bg-background sticky top-[73px] z-10 border-b border-white/5">
                        <input
                            type="text"
                            placeholder="Пошук пісні..."
                            className="w-full px-5 py-4 bg-surface rounded-2xl text-white border border-white/5 focus:outline-none focus:border-white/20 text-lg placeholder:text-text-secondary/50"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-32">
                        {filteredSongs.map(song => {
                            const isSelected = selectedSongsToService.includes(song.id);
                            const alreadyInService = currentService.songs.some(s => s.songId === song.id);

                            return (
                                <button
                                    key={song.id}
                                    onClick={() => !alreadyInService && toggleSongSelection(song.id)}
                                    disabled={alreadyInService}
                                    className={`w-full text-left p-4 rounded-2xl border flex justify-between items-center group transition-all ${alreadyInService
                                        ? 'bg-surface/50 border-white/5 opacity-50 cursor-not-allowed'
                                        : isSelected
                                            ? 'bg-blue-500/10 border-blue-500/50'
                                            : 'bg-surface border-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className={`font-medium text-lg leading-tight ${alreadyInService ? 'text-text-secondary' : isSelected ? 'text-blue-400' : 'text-white'}`}>{song.title}</div>
                                        {alreadyInService ? (
                                            <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                                                <Check className="w-3 h-3" />
                                                Уже додано
                                            </div>
                                        ) : song.conductor && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <UserIcon className="w-3 h-3 text-text-secondary" />
                                                <span className="text-xs text-text-secondary">{song.conductor}</span>
                                            </div>
                                        )}
                                    </div>
                                    {!alreadyInService && (
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isSelected
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-white/5 text-text-secondary group-hover:bg-white/20'
                                            }`}>
                                            {isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#09090b]/90 backdrop-blur-xl border-t border-white/5 pb-safe">
                        <button
                            onClick={handleBatchAddSongs}
                            disabled={selectedSongsToService.length === 0}
                            className="w-full py-4 bg-white text-black rounded-2xl font-bold text-lg hover:bg-gray-200 transition-colors shadow-lg disabled:opacity-50 disabled:bg-gray-600 disabled:text-gray-400 flex items-center justify-center gap-2"
                        >
                            Додати
                            {selectedSongsToService.length > 0 && (
                                <span className="bg-black text-white text-xs px-2 py-0.5 rounded-full min-w-[20px]">
                                    {selectedSongsToService.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Attendance Sheet */}
            {showAttendance && (
                <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col animate-in slide-in-from-bottom duration-300">
                    <div className="flex-1 overflow-hidden flex flex-col">
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
            {/* Confirmation Modal for Song Deletion */}
            {songToDeleteIndex !== null && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#18181b] border border-white/10 w-full max-w-xs p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center">
                                <Trash2 className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Видалити пісню?</h3>
                                <p className="text-text-secondary text-sm mt-1">
                                    "{currentService.songs[songToDeleteIndex]?.songTitle}" буде прибрано з цієї програми.
                                </p>
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <button
                                    onClick={() => setSongToDeleteIndex(null)}
                                    className="flex-1 py-3 border border-white/10 rounded-xl text-white hover:bg-white/5 transition-colors font-medium text-sm"
                                >
                                    Скасувати
                                </button>
                                <button
                                    onClick={confirmRemoveSong}
                                    className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors text-sm"
                                >
                                    Видалити
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Credits Editing Modal */}
            {editingSongIndex !== null && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#18181b] border border-white/10 w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="space-y-5">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-white">Хто виконував?</h3>
                                <button onClick={() => setEditingSongIndex(null)} className="p-1 hover:bg-white/10 rounded-full">
                                    <X className="w-5 h-5 text-text-secondary" />
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Диригент</label>
                                <input
                                    type="text"
                                    list="conductor-list"
                                    value={tempConductor}
                                    onChange={(e) => setTempConductor(e.target.value)}
                                    placeholder="Введіть або оберіть ім'я"
                                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30"
                                />
                                <datalist id="conductor-list">
                                    {knownConductors.map(name => <option key={name} value={name} />)}
                                </datalist>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Піаніст</label>
                                <input
                                    type="text"
                                    list="pianist-list"
                                    value={tempPianist}
                                    onChange={(e) => setTempPianist(e.target.value)}
                                    placeholder="Введіть або оберіть ім'я"
                                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30"
                                />
                                <datalist id="pianist-list">
                                    {knownPianists.map(name => <option key={name} value={name} />)}
                                </datalist>
                            </div>

                            <button
                                onClick={handleSaveCredits}
                                className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Зберегти
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
