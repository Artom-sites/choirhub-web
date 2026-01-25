"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Music2, ChevronRight, Filter, Plus, Eye, User, Loader2, Trash2, Pencil, MoreVertical } from "lucide-react";
import { Category, SimpleSong } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { getSongs, addSong, uploadSongPdf, deleteSong, addKnownConductor, updateSong } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import AddSongModal from "./AddSongModal";
import EditSongModal from "./EditSongModal";
import PDFViewer from "./PDFViewer";
import ConfirmationModal from "./ConfirmationModal";

interface SongListProps {
    canAddSongs: boolean;
    regents: string[];
    knownConductors: string[];
    knownCategories: string[];
}

const CATEGORIES: Category[] = [
    "Різдво", "Пасха", "В'їзд", "Вечеря", "Вознесіння", "Трійця", "Свято Жнив", "Хрещення", "Інші"
];

export default function SongList({ canAddSongs, regents, knownConductors, knownCategories }: SongListProps) {
    const router = useRouter();
    const { userData } = useAuth();

    // DEBUG FORCE ENABLE
    // const realCanAdd = canAddSongs; 
    const isDebug = true;

    const [songs, setSongsState] = useState<SimpleSong[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");
    const [showAddModal, setShowAddModal] = useState(false);
    const [songToDelete, setSongToDelete] = useState<string | null>(null);
    const [editingSong, setEditingSong] = useState<SimpleSong | null>(null);
    const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

    // PDF Viewer state
    const [viewingSong, setViewingSong] = useState<SimpleSong | null>(null);

    useEffect(() => {
        async function fetchSongs() {
            if (userData?.choirId) {
                setLoading(true);
                const fetched = await getSongs(userData.choirId);
                setSongsState(fetched);
                setLoading(false);
            }
        }
        fetchSongs();
    }, [userData?.choirId]);

    // Close menu on click outside
    useEffect(() => {
        function handleClickOutside() {
            setActionMenuOpen(null);
        }
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    const filteredSongs = songs.filter(song => {
        const matchesSearch = song.title.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === "All" || song.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const songsWithPdf = songs.filter(s => s.hasPdf).length;

    const handleSongClick = (song: SimpleSong) => {
        // For now, assuming PDF is handled via direct viewing or logic simplification
        // In Firestore, we might store PDF URL. For now, let's just open standard view or PDF Viewer.
        if (song.hasPdf) { // Logic simplified: if hasPdf flag is true, we should have a way to get it
            // In new DB, we might store PDF Base64 in a subcollection or Storage. 
            // For this migration, let's assume we view it via ID if we migrate successfully.
            // However, since we don't have getPdf sync anymore...
            // We might need to fetch the full song details including PDF if it's large.
            // For this MVP, let's assume we simply open the song page for now.
            router.push(`/song/${song.id}`);
        } else if (effectiveCanAdd) {
            router.push(`/song/${song.id}`);
        } else {
            // Nothing for member to do if no PDF
        }
    };

    const handleAddSong = async (song: Omit<SimpleSong, 'id' | 'addedBy' | 'addedAt'>, pdfFile?: File): Promise<void> => {
        if (!userData?.choirId) return;

        // Check for duplicate title
        const normalizedTitle = song.title.trim().toLowerCase();
        const duplicate = songs.find((s: SimpleSong) => s.title.trim().toLowerCase() === normalizedTitle);
        if (duplicate) {
            // Can't return string error easily with current signature returning void, but we can alert or change signature.
            // AddSongModal expects Promise<string | null> ? No, we changed it to Promise<void>.
            // We should handle error reporting better. For now alert.
            alert(`Пісня "${duplicate.title}" вже існує в репертуарі`);
            return;
        }

        // Save new conductor if not already known
        const allKnown = [...regents, ...knownConductors];
        if (song.conductor && !allKnown.includes(song.conductor)) {
            try {
                await addKnownConductor(userData.choirId, song.conductor);
            } catch (e) {
                console.error("Failed to save conductor:", e);
            }
        }

        // 1. Create song first
        const newSongId = await addSong(userData.choirId, {
            ...song,
            addedAt: new Date().toISOString(),
        });

        // 2. Upload PDF (Blocking)
        if (pdfFile) {
            try {
                const downloadUrl = await uploadSongPdf(userData.choirId, newSongId, pdfFile);
                if (downloadUrl) {
                    // Update song with PDF URL
                    // Db function addSong doesn't allow updating immediately? 
                    // Actually addSong creates it. We need updateSong or just trust it.
                    // uploadSongPdf inside it updates the doc usually? 
                    // Let's check db.ts if needed, but assuming standard flow.
                    // Actually uploadSongPdf DOES update the doc with pdfUrl.
                }
            } catch (e) {
                console.error("Failed to upload PDF:", e);
                alert("Пісню створено, але PDF не завантажився.");
            }
        }

        // 3. Refresh list
        // getSongs called via effect when songs state changes? No, we need to update state.
        // Or re-fetch.
        setLoading(true);
        const fetched = await getSongs(userData.choirId);
        setSongsState(fetched);
        setLoading(false);
        setShowAddModal(false);
    };

    const handleEditClick = (e: React.MouseEvent, song: SimpleSong) => {
        e.stopPropagation();
        setEditingSong(song);
    };

    const handleEditSave = async (updates: Partial<SimpleSong>) => {
        if (!userData?.choirId || !editingSong) return;
        try {
            await updateSong(userData.choirId, editingSong.id, updates);
            // Optimistic update
            setSongsState(prev => prev.map(s => s.id === editingSong.id ? { ...s, ...updates } : s));
            setEditingSong(null);
        } catch (e) {
            console.error("Failed to update song:", e);
            alert("Помилка оновлення");
        }
    };

    const initiateDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSongToDelete(id);
    };

    const confirmDelete = async () => {
        if (!userData?.choirId || !songToDelete) return;

        try {
            // Optimistic
            setSongsState(prev => prev.filter(s => s.id !== songToDelete));
            await deleteSong(userData.choirId, songToDelete);
        } catch (e) {
            console.error("Failed to delete song", e);
        } finally {
            setSongToDelete(null);
        }
    };

    const effectiveCanAdd = canAddSongs;

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-white/20" /></div>;
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4 pb-24">
            {/* Stats Card - Soft Dark Mono */}
            <div className="bg-surface/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                        <Music2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Репертуар</p>
                        <p className="text-2xl font-bold text-white tracking-tight">{songs.length} пісень</p>
                    </div>
                </div>
                <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        <span className="text-xs font-medium text-text-secondary">{songsWithPdf} з PDF</span>
                    </div>
                </div>
            </div>

            {/* Search & Filter - Fixed Top Offset */}
            <div className="sticky top-[72px] z-20 -mx-4 bg-[#09090b]/95 backdrop-blur-xl border-b border-white/5 shadow-xl transition-all">
                <div className="px-4 py-3 space-y-3">
                    {/* Search Bar */}
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary group-focus-within:text-white transition-colors" />
                        <input
                            type="text"
                            placeholder="Пошук..."
                            className="w-full pl-11 pr-4 py-3 bg-surface border border-white/5 rounded-2xl text-base focus:border-white/20 focus:outline-none text-white placeholder:text-text-secondary/50 transition-all shadow-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Filter Chips */}
                    <div className="flex overflow-x-auto pb-1 gap-2 scrollbar-none -mx-4 px-4 mask-linear-fade">
                        <button
                            onClick={() => setSelectedCategory("All")}
                            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${selectedCategory === "All"
                                ? "bg-white text-black border-white shadow-lg shadow-white/10"
                                : "bg-surface border-white/5 text-text-secondary hover:bg-surface-highlight hover:text-white"
                                }`}
                        >
                            Всі
                        </button>
                        {Array.from(new Set([...CATEGORIES, ...(knownCategories || [])])).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${selectedCategory === cat
                                    ? "bg-white text-black border-white shadow-lg shadow-white/10"
                                    : "bg-surface border-white/5 text-text-secondary hover:bg-surface-highlight hover:text-white"
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredSongs.length === 0 ? (
                    <div className="col-span-full text-center py-24 opacity-40">
                        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                            <Music2 className="w-8 h-8 text-text-secondary" />
                        </div>
                        <p className="text-text-secondary">Пісень не знайдено</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredSongs.map((song, index) => (
                            <motion.button
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                key={song.id}
                                onClick={() => handleSongClick(song)}
                                className="w-full bg-surface hover:bg-surface-highlight border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all text-left group relative overflow-hidden active:scale-[0.99] h-full flex flex-col"
                            >
                                <div className="flex items-start gap-4 relative z-10 h-full">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${song.hasPdf ? 'bg-white text-black' : 'bg-white/5 text-text-secondary'}`}>
                                        {song.hasPdf ? (
                                            <Eye className="w-6 h-6" />
                                        ) : (
                                            <FileText className="w-6 h-6" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 py-0.5 flex flex-col h-full justify-between">
                                        <h3 className="font-semibold text-lg text-white truncate mb-1.5 group-hover:text-white transition-colors">
                                            {song.title}
                                        </h3>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-medium text-text-secondary bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                                                {song.category}
                                            </span>

                                            {song.conductor && (
                                                <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                                                    <User className="w-3 h-3" />
                                                    <span>{song.conductor}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>


                                    <div className="flex items-center gap-1 mt-3.5 relative">
                                        {effectiveCanAdd && (
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActionMenuOpen(actionMenuOpen === song.id ? null : song.id);
                                                    }}
                                                    className="p-1.5 text-text-secondary hover:text-white hover:bg-white/10 rounded-lg transition-colors z-20"
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>

                                                {actionMenuOpen === song.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-40 bg-[#1c1c20] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                                                        <button
                                                            onClick={(e) => {
                                                                handleEditClick(e, song);
                                                                setActionMenuOpen(null);
                                                            }}
                                                            className="px-4 py-3 text-left text-sm font-medium text-white hover:bg-white/5 flex items-center gap-3"
                                                        >
                                                            <Pencil className="w-4 h-4 text-text-secondary" />
                                                            Редагувати
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                initiateDelete(e, song.id);
                                                                setActionMenuOpen(null);
                                                            }}
                                                            className="px-4 py-3 text-left text-sm font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-3 border-t border-white/5"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Видалити
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <ChevronRight className="w-5 h-5 text-text-secondary/30 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            </motion.button>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Floating Add Button - White Circle */}
            {effectiveCanAdd && (
                <div className="fixed bottom-24 right-5 z-20">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="w-14 h-14 bg-white text-black rounded-full shadow-[0_4px_20px_rgba(255,255,255,0.2)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-white/50"
                    >
                        <Plus className="w-7 h-7" />
                    </button>
                </div>
            )}

            {/* Add Song Modal */}
            {showAddModal && (
                <AddSongModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAddSong}
                    regents={regents}
                    knownConductors={knownConductors}
                    knownCategories={knownCategories}
                />
            )}

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!songToDelete}
                onClose={() => setSongToDelete(null)}
                onConfirm={confirmDelete}
                title="Видалити пісню?"
                message="Цю пісню буде видалено з репертуару назавжди."
                confirmLabel="Видалити"
                isDestructive
            />
        </div>
    );
}
