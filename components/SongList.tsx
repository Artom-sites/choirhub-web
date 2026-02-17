"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Search, FileText, Music2, ChevronRight, Filter, Plus, Eye, User, Loader2, Trash2, Pencil, MoreVertical, Library, X } from "lucide-react";
import { SimpleSong } from "@/types";
import { CATEGORIES, Category } from "@/lib/themes";
import { AnimatePresence, motion } from "framer-motion";
import { Virtuoso, TableVirtuoso } from 'react-virtuoso';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addSong, uploadSongPdf, deleteSong, addKnownConductor, updateSong, softDeleteLocalSong } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { useRepertoire } from "@/contexts/RepertoireContext";
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
    knownPianists: string[];
    onRefresh?: () => void;
    showAddModal?: boolean;
    setShowAddModal?: (show: boolean) => void;
}

export default function SongList({
    canAddSongs,
    regents,
    knownConductors,
    knownCategories,
    knownPianists,
    onRefresh,
    showAddModal: propsShowAddModal,
    setShowAddModal: propsSetShowAddModal
}: SongListProps) {
    const router = useRouter();
    const { userData } = useAuth();
    const { songs, loading, refreshRepertoire } = useRepertoire();

    const [isSyncing, setIsSyncing] = useState(false);
    const [search, setSearch] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");
    const [selectedConductor, setSelectedConductor] = useState<string | "All">("All");

    // Local-to-prop state mapping
    const [localShowAddModal, setLocalShowAddModal] = useState(false);
    const showAddModal = propsShowAddModal ?? localShowAddModal;
    const setShowAddModal = propsSetShowAddModal ?? setLocalShowAddModal;
    const [showAddOptions, setShowAddOptions] = useState(false);
    const [showTrashBin, setShowTrashBin] = useState(false);
    const [editingSong, setEditingSong] = useState<SimpleSong | null>(null);
    const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const effectiveCanAdd = canAddSongs;

    // Sub-tab state: 'repertoire' or 'catalog'
    const [subTab, setSubTab] = useState<'repertoire' | 'catalog'>('repertoire');

    // PDF Viewer state
    const [viewingSong, setViewingSong] = useState<SimpleSong | null>(null);

    // Screen size detection for Virtuoso
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile(); // Initial check
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);


    useEffect(() => {
        // Refresh on focus
        const onFocus = () => refreshRepertoire();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [refreshRepertoire]);

    // Close menu on click outside


    const filteredSongs = songs.filter(song => {
        const matchesSearch = song.title.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === "All" || song.category === selectedCategory;
        const matchesConductor = selectedConductor === "All" || song.conductor === selectedConductor;
        return matchesSearch && matchesCategory && matchesConductor;
    });

    const uniqueConductors = Array.from(new Set(songs.map(s => s.conductor).filter(Boolean))).sort();

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
            router.push(`/song?id=${song.id}`);
        } else if (effectiveCanAdd) {
            router.push(`/song?id=${song.id}`);
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

        // 3. Refresh list
        await refreshRepertoire();
        if (onRefresh) onRefresh();

        // Just close modal, the listener handles the UI
        setShowAddModal(false);
    };

    const handleEditClick = (e: React.MouseEvent, song: SimpleSong) => {
        e.stopPropagation();
        setEditingSong(song);
    };

    const handleEditSave = async (updates: Partial<SimpleSong>, pdfFile?: File) => {
        if (!userData?.choirId || !editingSong) return;
        try {
            await updateSong(userData.choirId, editingSong.id, updates);

            if (pdfFile) {
                try {
                    await uploadSongPdf(userData.choirId, editingSong.id, pdfFile);
                } catch (e) {
                    console.error("Failed to upload new PDF:", e);
                    alert("Дані оновлено, але не вдалося замінити файл.");
                }
            }

            // Optimistic update
            setEditingSong(null);
            await refreshRepertoire();
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
            await refreshRepertoire();
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error("Failed to delete song", e);
            setToast({ message: "Помилка при видаленні", type: "error" });
        } finally {
            setDeletingSongId(null);
        }
    };


    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-white/20" /></div>;
    }

    return (
        <div className="max-w-5xl mx-auto px-4 pt-4 space-y-5">
            {/* Sub-Tab Switcher */}
            {/* Sub-Tab Switcher */}
            <div className="flex bg-surface rounded-xl p-1 card-shadow relative isolate">
                <button
                    onClick={() => setSubTab('repertoire')}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 relative z-10 ${subTab === 'repertoire'
                        ? 'text-background'
                        : 'text-text-secondary hover:text-text-primary'
                        }`}
                >
                    {subTab === 'repertoire' && (
                        <motion.div
                            layoutId="subtab-pill"
                            className="absolute inset-0 bg-primary rounded-xl -z-10"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                    )}
                    <Music2 className="w-4 h-4" />
                    Репертуар
                </button>
                <button
                    onClick={() => setSubTab('catalog')}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 relative z-10 ${subTab === 'catalog'
                        ? 'text-background'
                        : 'text-text-secondary hover:text-text-primary'
                        }`}
                >
                    {subTab === 'catalog' && (
                        <motion.div
                            layoutId="subtab-pill"
                            className="absolute inset-0 bg-primary rounded-xl -z-10"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                    )}
                    <Library className="w-4 h-4" />
                    Архів МХО
                </button>
            </div>


            {/* Catalog View */}
            <div className={subTab === 'catalog' ? 'block h-full' : 'hidden'}>
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
                            // Refresh songs list
                            await refreshRepertoire();
                            if (onRefresh) onRefresh();
                        } catch (e) {
                            console.error(e);
                        }
                    }}
                />
            </div>

            <div
                className={subTab === 'repertoire' ? 'block' : 'hidden'}
            >
                {/* Stats Card - iOS Style */}
                {/* Stats Header - Reverted to Card Style */}
                <div className="bg-surface rounded-2xl p-5 card-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 glass-frost-circle rounded-full flex items-center justify-center text-zinc-700">
                                <Music2 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Репертуар</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-2xl font-bold text-text-primary tracking-tight">{songs.length} пісень</p>
                                    {isSyncing && (
                                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                    )}
                                </div>
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
                <div className="sticky z-20 -mx-4 px-4 pt-3 pb-3 mt-2 bg-background/95 backdrop-blur-xl border-b border-border" style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}>
                    <div className="flex gap-2">
                        {/* Search Bar */}
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input
                                type="text"
                                placeholder="Пошук..."
                                className="w-full pl-11 pr-10 py-3 bg-surface rounded-xl text-base focus:outline-none text-text-primary placeholder:text-text-secondary/50 transition-all border border-transparent"
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

                        {/* Filter Toggle Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-4 rounded-xl flex items-center gap-2 transition-all border ${showFilters
                                ? "bg-primary text-background border-primary shadow-md"
                                : "bg-surface text-text-secondary border-transparent hover:bg-surface-highlight"
                                }`}
                        >
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Filter Panel */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden mt-2"
                            >
                                <div className="bg-surface rounded-2xl p-4 space-y-4 border border-border/50 shadow-sm">

                                    {/* Categories */}
                                    <div>
                                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Тематика</p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => setSelectedCategory("All")}
                                                className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${selectedCategory === "All"
                                                    ? "bg-primary text-background border-primary"
                                                    : "bg-surface-highlight text-text-secondary border-transparent hover:border-border"
                                                    }`}
                                            >
                                                Всі
                                            </button>
                                            {Array.from(new Set([...CATEGORIES, ...(knownCategories || [])])).map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => setSelectedCategory(cat)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${selectedCategory === cat
                                                        ? "bg-primary text-background border-primary"
                                                        : "bg-surface-highlight text-text-secondary border-transparent hover:border-border"
                                                        }`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Conductors */}
                                    {uniqueConductors.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Регент</p>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => setSelectedConductor("All")}
                                                    className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${selectedConductor === "All"
                                                        ? "bg-primary text-background border-primary"
                                                        : "bg-surface-highlight text-text-secondary border-transparent hover:border-border"
                                                        }`}
                                                >
                                                    Всі
                                                </button>
                                                {uniqueConductors.map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setSelectedConductor(c || "")}
                                                        className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${selectedConductor === c
                                                            ? "bg-primary text-background border-primary"
                                                            : "bg-surface-highlight text-text-secondary border-transparent hover:border-border"
                                                            }`}
                                                    >
                                                        {c}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* List View */}
                <div>
                    {filteredSongs.length === 0 ? (
                        <div className="text-center py-24 opacity-40">
                            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 card-shadow">
                                <Music2 className="w-8 h-8 text-text-secondary" />
                            </div>
                            <p className="text-text-secondary">Пісень не знайдено</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop/Tablet: Swipeable Grid View */}
                            {isMobile === false && (
                                <div className="flex flex-col h-full">
                                    {/* Header */}
                                    <div className="grid grid-cols-[1fr_180px_180px_60px] gap-4 py-3 pl-0 pr-4 border-b border-border bg-background text-xs font-bold text-text-secondary uppercase tracking-wider">
                                        <div>Назва</div>
                                        <div>Категорія</div>
                                        <div>Диригент</div>
                                        <div></div>
                                    </div>

                                    {/* List */}
                                    <Virtuoso
                                        useWindowScroll
                                        initialItemCount={20}
                                        data={filteredSongs}
                                        itemContent={(index, song) => {
                                            if (!song) return null;
                                            return (
                                                <SwipeableCard
                                                    key={song.id}
                                                    disabled={!effectiveCanAdd}
                                                    onDelete={() => initiateDelete(null, song.id)}
                                                    className="border-b border-border/30"
                                                    contentClassName="bg-background"
                                                >
                                                    <div
                                                        className="grid grid-cols-[1fr_180px_180px_60px] gap-4 py-3 pl-0 pr-4 hover:bg-surface items-center cursor-pointer transition-colors relative z-10"
                                                        onClick={() => handleSongClick(song)}
                                                    >
                                                        {/* Title Column */}
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-text-primary">
                                                                {song.hasPdf ? (
                                                                    <Eye className="w-4 h-4 text-background" />
                                                                ) : (
                                                                    <FileText className="w-4 h-4 text-background" />
                                                                )}
                                                            </div>
                                                            <p className="font-semibold text-text-primary truncate">{song.title}</p>
                                                        </div>

                                                        {/* Category Column */}
                                                        <div className="truncate">
                                                            <span className="text-sm text-text-secondary">{song.category}</span>
                                                        </div>

                                                        {/* Conductor Column */}
                                                        <div className="truncate">
                                                            {song.conductor ? (
                                                                <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
                                                                    <User className="w-3.5 h-3.5" />
                                                                    <span>{song.conductor}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm text-text-secondary/50">—</span>
                                                            )}
                                                        </div>

                                                        {/* Actions Column */}
                                                        <div className="flex justify-end">
                                                            {effectiveCanAdd && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleEditClick(e, song);
                                                                    }}
                                                                    className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                                                                    title="Редагувати"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </SwipeableCard>
                                            );
                                        }}
                                    />
                                </div>
                            )}

                            {/* Mobile: Simple List View */}
                            {isMobile === true && (
                                <div>
                                    <Virtuoso
                                        useWindowScroll
                                        initialItemCount={20}
                                        data={filteredSongs}
                                        itemContent={(index, song) => {
                                            if (!song) return null;
                                            return (
                                                <SwipeableCard
                                                    key={song.id}
                                                    disabled={!effectiveCanAdd}
                                                    onDelete={() => initiateDelete(null, song.id)}
                                                    className="border-b border-border/30"
                                                    contentClassName="bg-transparent"
                                                >
                                                    <div
                                                        onClick={() => handleSongClick(song)}
                                                        className="flex items-center gap-3 py-3 px-0 bg-transparent cursor-pointer active:bg-surface-highlight transition-colors relative z-10"
                                                    >
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-text-primary">
                                                            {song.hasPdf ? (
                                                                <Eye className="w-5 h-5 text-background" />
                                                            ) : (
                                                                <FileText className="w-5 h-5 text-background" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-text-primary truncate">{song.title}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                {song.conductor && (
                                                                    <span className="text-xs text-primary font-medium flex items-center gap-1">
                                                                        <User className="w-3 h-3" />
                                                                        {song.conductor}
                                                                    </span>
                                                                )}
                                                                {song.conductor && <span className="text-xs text-text-secondary">•</span>}
                                                                <span className="text-xs text-text-secondary">{song.category}</span>
                                                            </div>
                                                        </div>
                                                        {effectiveCanAdd && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleEditClick(e, song);
                                                                }}
                                                                className="p-2 rounded-lg text-text-secondary hover:text-text-primary active:scale-95 transition-transform"
                                                                title="Редагувати"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </SwipeableCard>
                                            )
                                        }}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>


                {/* Add Song Modal */}
                {
                    showAddModal && (
                        <AddSongModal
                            isOpen={showAddModal}
                            onClose={() => setShowAddModal(false)}
                            onAdd={handleAddSong}
                            regents={regents}
                            knownConductors={knownConductors}
                            knownCategories={knownCategories}
                            knownPianists={knownPianists}
                        />
                    )
                }

                {/* Edit Song Modal */}
                {
                    editingSong && (
                        <EditSongModal
                            key={editingSong.id}
                            isOpen={!!editingSong}
                            onClose={() => setEditingSong(null)}
                            onSave={handleEditSave}
                            initialData={editingSong}
                            regents={regents}
                            knownConductors={knownConductors}
                            knownCategories={knownCategories}
                            knownPianists={knownPianists}
                        />
                    )
                }

                {/* Trash Bin Modal */}
                {
                    showTrashBin && (
                        <>
                            <TrashBin
                                choirId={userData?.choirId || ""}
                                onClose={() => setShowTrashBin(false)}
                                initialFilter="song"
                                onRestore={() => {
                                    refreshRepertoire();
                                }}
                            />
                        </>
                    )
                }

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
            </div>


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
