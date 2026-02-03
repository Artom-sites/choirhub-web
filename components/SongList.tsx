"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Music2, ChevronRight, Filter, Plus, Eye, User, Loader2, Trash2, Pencil, MoreVertical, Library, X } from "lucide-react";
import { SimpleSong } from "@/types";
import { CATEGORIES, Category } from "@/lib/themes";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSongs, addSong, uploadSongPdf, deleteSong, addKnownConductor, updateSong, softDeleteLocalSong } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import AddSongModal from "./AddSongModal";
import EditSongModal from "./EditSongModal";
import PDFViewer from "./PDFViewer";
import ConfirmationModal from "./ConfirmationModal";
import GlobalArchive from "./GlobalArchive";
import TrashBin from "./TrashBin";
import Toast from "./Toast";
import SwipeableCard from "./SwipeableCard";

interface SongListProps {
    canAddSongs: boolean;
    regents: string[];
    knownConductors: string[];
    knownCategories: string[];
    onRefresh?: () => void;
}

export default function SongList({ canAddSongs, regents, knownConductors, knownCategories, onRefresh }: SongListProps) {
    const router = useRouter();
    const { userData } = useAuth();



    const [songs, setSongsState] = useState<SimpleSong[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");
    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showTrashBin, setShowTrashBin] = useState(false);
    const [editingSong, setEditingSong] = useState<SimpleSong | null>(null);
    const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Sub-tab state: 'repertoire' or 'catalog'
    const [subTab, setSubTab] = useState<'repertoire' | 'catalog'>('repertoire');

    // PDF Viewer state
    const [viewingSong, setViewingSong] = useState<SimpleSong | null>(null);


    useEffect(() => {
        if (!userData?.choirId) return;

        setLoading(true);
        const q = query(
            collection(db, `choirs/${userData.choirId}/songs`),
            orderBy("title")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`Fetched ${snapshot.docs.length} songs (Source: ${snapshot.metadata.fromCache ? 'Cache' : 'Server'})`);

            const fetchedSongs: SimpleSong[] = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as SimpleSong))
                .filter(song => !song.deletedAt); // Filter out soft-deleted songs

            setSongsState(fetchedSongs);
            setLoading(false);
        }, (error) => {
            console.error("Error subscribing to songs:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userData?.choirId]);

    // Close menu on click outside


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
        // Check for duplicate title
        const normalizedTitle = song.title.trim().toLowerCase();
        const duplicate = songs.find((s: SimpleSong) => s.title.trim().toLowerCase() === normalizedTitle);
        if (duplicate) {
            throw new Error(`Пісня "${duplicate.title}" вже існує в репертуарі`);
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

        // 3. Refresh list - No manual refresh needed with onSnapshot
        // But we wait briefly to let onSnapshot catch the new addition (local write is instant usually)
        if (onRefresh) onRefresh();

        // Just close modal, the listener handles the UI
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
            // Optimistic update - Not strictly needed as listener will update, but good for immediate feedback
            // setSongsState(prev => prev.map(s => s.id === editingSong.id ? { ...s, ...updates } : s));
            setEditingSong(null);
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error("Failed to update song:", e);
            alert("Помилка оновлення");
        }
    };

    const initiateDelete = (e: React.MouseEvent | null, id: string) => {
        if (e) e.stopPropagation();
        setDeletingSongId(id);
    };

    const confirmDelete = async () => {
        if (!userData?.choirId || !deletingSongId) return;

        try {
            // Optimistic - listener will handle it technically, but local optimistic update is fine too
            // setSongsState(prev => prev.filter(s => s.id !== deletingSongId));
            await softDeleteLocalSong(userData.choirId, deletingSongId, userData.id || "unknown");
            setToast({ message: "Пісню видалено", type: "success" });
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error("Failed to delete song", e);
            setToast({ message: "Помилка при видаленні", type: "error" });
        } finally {
            setDeletingSongId(null);
        }
    };

    const effectiveCanAdd = canAddSongs;

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-white/20" /></div>;
    }

    return (
        <div className="max-w-5xl mx-auto px-4 pt-6 space-y-5 pb-32">
            {/* Sub-Tab Switcher */}
            <div className="flex bg-surface rounded-xl p-1 card-shadow">
                <button
                    onClick={() => setSubTab('repertoire')}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${subTab === 'repertoire'
                        ? 'bg-primary text-background'
                        : 'text-text-secondary hover:text-text-primary'
                        }`}
                >
                    <Music2 className="w-4 h-4" />
                    Репертуар
                </button>
                <button
                    onClick={() => setSubTab('catalog')}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${subTab === 'catalog'
                        ? 'bg-primary text-background'
                        : 'text-text-secondary hover:text-text-primary'
                        }`}
                >
                    <Library className="w-4 h-4" />
                    Архів МХО
                </button>
            </div>


            {/* Catalog View */}
            {subTab === 'catalog' ? (
                <GlobalArchive
                    onAddSong={async (globalSong) => {
                        // Add song from global archive to choir repertoire
                        if (!userData?.choirId) return;
                        try {
                            // Get PDF URL from first part if available
                            const pdfUrl = globalSong.parts?.[0]?.pdfUrl || '';

                            await addSong(userData.choirId, {
                                title: globalSong.title,
                                category: 'Інші' as Category,
                                conductor: '', // Don't use composer as conductor
                                addedAt: new Date().toISOString(),
                                pdfUrl: pdfUrl,
                                hasPdf: !!pdfUrl,
                                parts: globalSong.parts, // Save all parts
                            });
                            // Refresh songs list - listener handles
                            if (onRefresh) onRefresh();
                        } catch (e) {
                            console.error(e);
                        }
                    }}
                />
            ) : (
                <>
                    {/* Stats Card - iOS Style */}
                    <div className="bg-surface rounded-2xl p-5 card-shadow">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 glass-frost-circle rounded-full flex items-center justify-center text-zinc-700">
                                    <Music2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Репертуар</p>
                                    <p className="text-2xl font-bold text-text-primary tracking-tight">{songs.length} пісень</p>
                                </div>
                            </div>
                            {canAddSongs && (
                                <button
                                    onClick={() => setShowTrashBin(true)}
                                    className="p-2 rounded-full hover:bg-surface-highlight transition-colors text-text-secondary hover:text-danger"
                                    title="Кошик"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Search & Filter - iOS Style */}
                    <div className="sticky top-[64px] z-20 -mx-4 px-4 pt-3 pb-4 bg-background/95 backdrop-blur-xl border-b border-border shadow-sm">
                        <div className="space-y-4">
                            {/* Search Bar */}
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                                <input
                                    type="text"
                                    placeholder="Пошук..."
                                    className="w-full pl-11 pr-10 py-3 bg-surface rounded-xl text-base focus:outline-none text-text-primary placeholder:text-text-secondary/50 transition-all inner-shadow"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary hover:bg-surface-highlight rounded-full transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Filter Chips */}
                            <div className="flex overflow-x-auto gap-2 scrollbar-hide -mx-4 px-4 pb-1">
                                <button
                                    onClick={() => setSelectedCategory("All")}
                                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === "All"
                                        ? "bg-primary text-background shadow-md"
                                        : "bg-surface text-text-secondary shadow-sm border border-border"
                                        }`}
                                >
                                    Всі
                                </button>
                                {Array.from(new Set([...CATEGORIES, ...(knownCategories || [])])).map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat
                                            ? "bg-primary text-background shadow-md"
                                            : "bg-surface text-text-secondary shadow-sm border border-border"
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSongs.length === 0 ? (
                            <div className="col-span-full text-center py-24 opacity-40">
                                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 card-shadow">
                                    <Music2 className="w-8 h-8 text-text-secondary" />
                                </div>
                                <p className="text-text-secondary">Пісень не знайдено</p>
                            </div>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {filteredSongs.map((song, index) => (
                                    <SwipeableCard
                                        key={song.id}
                                        onDelete={() => initiateDelete(null, song.id)}
                                        disabled={!effectiveCanAdd}
                                        className="h-full rounded-2xl"
                                    >
                                        <div
                                            onClick={() => handleSongClick(song)}
                                            role="button"
                                            tabIndex={0}
                                            className="w-full bg-surface card-shadow hover:bg-surface rounded-2xl p-4 transition-all text-left group relative active:scale-[0.99] h-full flex flex-col cursor-pointer"
                                        >
                                            <div className="flex items-start gap-4 relative z-10 h-full">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors glass-frost-circle text-zinc-700`}>
                                                    {song.hasPdf ? (
                                                        <Eye className="w-6 h-6" />
                                                    ) : (
                                                        <FileText className="w-6 h-6" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0 py-0.5 flex flex-col h-full justify-between">
                                                    <h3 className="font-semibold text-lg text-text-primary truncate mb-1.5 group-hover:text-text-primary transition-colors">
                                                        {song.title}
                                                    </h3>

                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-medium text-text-secondary bg-background px-2 py-1 rounded-lg">
                                                            {song.category}
                                                        </span>

                                                        {song.conductor && (
                                                            <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-background px-2 py-1 rounded-lg">
                                                                <User className="w-3 h-3" />
                                                                <span>{song.conductor}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>


                                                <div className="flex items-center gap-1 mt-3.5 relative">
                                                    {effectiveCanAdd && (
                                                        <div className="flex items-center gap-1 z-20" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleEditClick(e, song);
                                                                }}
                                                                className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-highlight transition-colors"
                                                                title="Редагувати"
                                                            >
                                                                <Pencil className="w-5 h-5" />
                                                            </button>
                                                            {/* Delete is now via Swipe */}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </SwipeableCard>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>

                    {/* Floating Add Button */}
                    {effectiveCanAdd && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-background rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
                            title="Додати пісню"
                        >
                            <Plus className="w-7 h-7" />
                        </button>
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

                    {/* Edit Song Modal */}
                    {editingSong && (
                        <EditSongModal
                            key={editingSong.id}
                            isOpen={!!editingSong}
                            onClose={() => setEditingSong(null)}
                            onSave={handleEditSave}
                            initialData={editingSong}
                            regents={regents}
                            knownConductors={knownConductors}
                            knownCategories={knownCategories}
                        />
                    )}

                    {/* Trash Bin Modal */}
                    {showTrashBin && (
                        <>
                            <TrashBin
                                choirId={userData?.choirId || ""}
                                onClose={() => setShowTrashBin(false)}
                                initialFilter="song"
                                onRestore={() => {
                                    // No manual fetch logic needed with onSnapshot
                                    // if (userData?.choirId) {
                                    //     getSongs(userData.choirId).then(setSongsState);
                                    // }
                                }}
                            />
                        </>
                    )}

                    {/* Confirmation Modal */}
                    <ConfirmationModal
                        isOpen={!!deletingSongId}
                        onClose={() => setDeletingSongId(null)}
                        onConfirm={confirmDelete}
                        title="Видалити пісню?"
                        message="Цю пісню буде видалено з репертуару назавжди."
                        confirmLabel="Видалити"
                        isDestructive
                    />
                </>
            )
            }


            {
                toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )
            }
        </div >
    );
}
