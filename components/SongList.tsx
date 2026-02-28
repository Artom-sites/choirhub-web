"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Search, FileText, Music2, ChevronRight, Filter, Plus, Eye, User, Loader2, Trash2, MoreVertical, Library, X, RefreshCw } from "lucide-react";
import { SimpleSong } from "@/types";
import { CATEGORIES, Category } from "@/lib/themes";
import { AnimatePresence, motion } from "framer-motion";
import { Virtuoso, TableVirtuoso } from 'react-virtuoso';
import Fuse from 'fuse.js';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addSong, uploadSongPdf, deleteSong, addKnownConductor, updateSong, softDeleteLocalSong, restoreLocalSong } from "@/lib/db";
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
import SongSkeleton from "./SongSkeleton";
import { hapticLight, hapticSuccess } from "../hooks/useHaptics";

interface SongListProps {
    canAddSongs: boolean;
    choirType?: 'msc' | 'standard';
    regents: string[];
    knownConductors: string[];
    knownCategories: string[];
    knownPianists: string[];
    onRefresh?: () => void;
    showAddModal?: boolean;
    setShowAddModal?: (show: boolean) => void;
    isOverlayOpen?: boolean;
}

export default function SongList({
    canAddSongs,
    choirType,
    regents,
    knownConductors,
    knownCategories,
    isOverlayOpen,
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

    const [localShowAddModal, setLocalShowAddModal] = useState(false);
    const showAddModal = propsShowAddModal ?? localShowAddModal;
    const setShowAddModal = propsSetShowAddModal ?? setLocalShowAddModal;
    const [showAddOptions, setShowAddOptions] = useState(false);
    const [showTrashBin, setShowTrashBin] = useState(false);
    const [editingSong, setEditingSong] = useState<SimpleSong | null>(null);
    const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error"; actionLabel?: string; onAction?: () => void } | null>(null);
    const [isNative, setIsNative] = useState(false);

    useEffect(() => {
        setIsNative(Capacitor.isNativePlatform());
    }, []);

    const effectiveCanAdd = canAddSongs;

    const [subTab, setSubTab] = useState<'repertoire' | 'catalog'>('repertoire');
    const [viewingSong, setViewingSong] = useState<SimpleSong | null>(null);
    const [pendingArchiveQuery, setPendingArchiveQuery] = useState("");
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [lastAddedSongId, setLastAddedSongId] = useState<string | null>(null);
    const [showOpenSongConfirm, setShowOpenSongConfirm] = useState(false);

    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window !== 'undefined') return window.innerWidth < 768;
        return true;
    });

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const onFocus = () => refreshRepertoire();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [refreshRepertoire]);

    const fuse = useMemo(() => new Fuse(songs, {
        keys: ['title', 'conductor'],
        threshold: 0.3,
        distance: 100,
        ignoreLocation: true,
        minMatchCharLength: 2,
    }), [songs]);

    const filteredSongs = useMemo(() => {
        let results = songs;
        if (search.trim()) {
            results = fuse.search(search).map(r => r.item);
        }
        if (selectedCategory !== "All") {
            results = results.filter(s => s.category === selectedCategory);
        }
        if (selectedConductor !== "All") {
            results = results.filter(s => s.conductor === selectedConductor);
        }
        return results;
    }, [songs, search, selectedCategory, selectedConductor, fuse]);

    const uniqueConductors = Array.from(new Set(songs.map(s => s.conductor).filter(Boolean))).sort();
    const songsWithPdf = songs.filter(s => s.hasPdf).length;

    const handleSongClick = (song: SimpleSong) => {
        if (song.hasPdf || effectiveCanAdd) {
            router.push(`/song?id=${song.id}`);
        }
    };

    const handleAddSong = async (song: Omit<SimpleSong, 'id' | 'addedBy' | 'addedAt'>, pdfFile?: File): Promise<void> => {
        if (!userData?.choirId) return;
        const normalizedTitle = song.title.trim().toLowerCase();
        const duplicate = songs.find((s: SimpleSong) => s.title.trim().toLowerCase() === normalizedTitle);
        if (duplicate) throw new Error(`Пісня "${duplicate.title}" вже існує в репертуарі`);

        const allKnown = [...regents, ...knownConductors];
        if (song.conductor && !allKnown.includes(song.conductor)) {
            try { await addKnownConductor(userData.choirId, song.conductor); } catch (e) { console.error(e); }
        }

        const newSongId = await addSong(userData.choirId, { ...song, addedAt: new Date().toISOString() });
        if (pdfFile) {
            try { await uploadSongPdf(userData.choirId, newSongId, pdfFile); } catch (e) { console.error(e); alert("Пісню створено, але PDF не завантажився."); }
        }
        await refreshRepertoire();
        if (onRefresh) onRefresh();
        setShowAddModal(false);
        setShowArchiveModal(false);
    };

    const handleLinkArchive = async (globalSong: any) => {
        if (!userData?.choirId) return;

        // Duplicate detection
        const normalizedTitle = globalSong.title.trim().toLowerCase();
        const duplicate = songs.find(s => s.title.trim().toLowerCase() === normalizedTitle);
        if (duplicate) {
            setToast({ message: `"${duplicate.title}" вже є в репертуарі`, type: "error" });
            return;
        }

        try {
            const newId = await addSong(userData.choirId, {
                title: globalSong.title,
                category: 'Інші' as Category,
                conductor: '',
                addedAt: new Date().toISOString(),
                hasPdf: !!globalSong.pdfUrl,
                pdfUrl: globalSong.pdfUrl,
                parts: globalSong.parts,
            });
            await refreshRepertoire();
            if (onRefresh) onRefresh();
            hapticSuccess();
            setShowArchiveModal(false);
            setLastAddedSongId(newId);
            setShowOpenSongConfirm(true);
        } catch (e) {
            console.error(e);
            setToast({ message: "Помилка додавання з архіву", type: "error" });
        }
    };

    const handleEditClick = (e: React.MouseEvent, song: SimpleSong) => {
        e.preventDefault(); e.stopPropagation();
        router.push(`/song?id=${song.id}&edit=1`);
    };

    const handleEditSave = async (updates: Partial<SimpleSong>) => {
        if (!userData?.choirId || !editingSong) return;
        try {
            await updateSong(userData.choirId, editingSong.id, updates);
            setToast({ message: "Зміни збережено", type: "success" });
            setEditingSong(null);
            await refreshRepertoire();
            if (onRefresh) onRefresh();
        } catch (e) { console.error(e); alert("Помилка оновлення"); }
    };

    const initiateDelete = (e: React.MouseEvent | null, id: string) => {
        if (e) e.stopPropagation();
        setDeletingSongId(id);
    };

    const confirmDelete = async () => {
        if (!userData?.choirId || !deletingSongId) return;
        try {
            await softDeleteLocalSong(userData.choirId, deletingSongId, userData.id || "unknown");
            const deletedId = deletingSongId;
            setToast({
                message: "Пісню переміщено до кошика",
                type: "success",
                actionLabel: "Скасувати",
                onAction: async () => {
                    try {
                        await restoreLocalSong(userData.choirId!, deletedId);
                        await refreshRepertoire();
                        if (onRefresh) onRefresh();
                    } catch (e) { console.error("Undo failed:", e); }
                }
            });
            await refreshRepertoire();
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error(e);
            setToast({ message: "Помилка при видаленні", type: "error" });
        } finally { setDeletingSongId(null); }
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-white/20" /></div>;
    }

    return (
        <div className="max-w-5xl mx-auto px-4 pb-32 pt-4 space-y-5">
            {/* Sub-Tab Switcher */}
            <div className="flex bg-surface rounded-xl p-0.5 border border-border">
                <button
                    onClick={() => setSubTab('repertoire')}
                    className={`flex-1 py-2.5 rounded-[10px] text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${subTab === 'repertoire'
                        ? 'bg-primary text-background'
                        : 'text-text-secondary'
                        }`}
                >
                    <Music2 className="w-4 h-4" />
                    Репертуар
                </button>
                {choirType !== 'standard' && (
                    <button
                        onClick={() => setSubTab('catalog')}
                        className={`flex-1 py-2.5 rounded-[10px] text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${subTab === 'catalog'
                            ? 'bg-primary text-background'
                            : 'text-text-secondary'
                            }`}
                    >
                        <Library className="w-4 h-4" />
                        Архів МХО
                    </button>
                )}
            </div>

            {/* Catalog View */}
            {choirType !== 'standard' && (
                <div className={subTab === 'catalog' ? 'block h-full' : 'hidden'}>
                    <GlobalArchive
                        isOverlayOpen={isOverlayOpen}
                        onAddSong={canAddSongs ? async (globalSong) => {
                            if (!userData?.choirId) return;
                            try {
                                const pdfUrl = globalSong.parts?.[0]?.pdfUrl || '';
                                await addSong(userData.choirId, {
                                    title: globalSong.title,
                                    category: 'Інші' as Category,
                                    conductor: '',
                                    addedAt: new Date().toISOString(),
                                    pdfUrl: pdfUrl,
                                    hasPdf: !!pdfUrl,
                                    parts: globalSong.parts,
                                });
                                await refreshRepertoire();
                                if (onRefresh) onRefresh();
                            } catch (e) { console.error(e); }
                        } : undefined}
                    />
                </div>
            )}

            {/* Repertoire Content */}
            <div className={subTab === 'repertoire' ? 'block' : 'hidden'}>
                {/* Stats Card */}
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
                        <div className="flex items-center gap-1">
                            <button
                                onClick={async () => {
                                    if (onRefresh) onRefresh();
                                    await refreshRepertoire();
                                }}
                                className={`p-2 rounded-full hover:bg-surface-highlight transition-colors text-text-secondary ${loading || isSyncing ? 'opacity-50 cursor-not-allowed' : 'hover:text-primary'}`}
                                title="Оновити список"
                                disabled={loading || isSyncing}
                            >
                                <RefreshCw className={`w-5 h-5 ${loading || isSyncing ? 'animate-spin' : ''}`} />
                            </button>
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
                </div>

                {/* Search & Filter - Sticky */}
                <div className="sticky z-20 -mx-4 px-4 pt-3 pb-3 mt-2 bg-background/95 backdrop-blur-xl border-b border-border" style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}>
                    <div className="flex gap-2">
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

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                    height: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
                                    opacity: { duration: 0.2, delay: 0.05 }
                                }}
                                className="overflow-hidden mt-2"
                            >
                                <div className="bg-surface rounded-2xl p-4 space-y-4 border border-border/50 shadow-sm">
                                    <div>
                                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Тематика</p>
                                        <div className="flex flex-wrap gap-2">
                                            <button onClick={() => setSelectedCategory("All")} className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${selectedCategory === "All" ? "bg-primary text-background border-primary" : "bg-surface-highlight text-text-secondary border-transparent hover:border-border"}`}>Всі</button>
                                            {Array.from(new Set([...CATEGORIES, ...(knownCategories || [])])).map(cat => (
                                                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${selectedCategory === cat ? "bg-primary text-background border-primary" : "bg-surface-highlight text-text-secondary border-transparent hover:border-border"}`}>{cat}</button>
                                            ))}
                                        </div>
                                    </div>
                                    {uniqueConductors.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Регент</p>
                                            <div className="flex flex-wrap gap-2">
                                                <button onClick={() => setSelectedConductor("All")} className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${selectedConductor === "All" ? "bg-primary text-background border-primary" : "bg-surface-highlight text-text-secondary border-transparent hover:border-border"}`}>Всі</button>
                                                {uniqueConductors.map(c => (
                                                    <button key={c} onClick={() => setSelectedConductor(c || "")} className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${selectedConductor === c ? "bg-primary text-background border-primary" : "bg-surface-highlight text-text-secondary border-transparent hover:border-border"}`}>{c}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Song List */}
                <div>
                    {loading ? (
                        <div className="mt-2">
                            <SongSkeleton count={8} />
                        </div>
                    ) : filteredSongs.length === 0 ? (
                        <div className="text-center py-24 opacity-40">
                            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
                                <Music2 className="w-8 h-8 text-text-secondary" />
                            </div>
                            <p className="text-text-secondary">Пісень не знайдено</p>
                        </div>
                    ) : (
                        <>
                            {isMobile === false && (
                                <div className="flex flex-col h-full">
                                    <div className="grid grid-cols-[1fr_180px_180px_60px] gap-4 py-3 pl-0 pr-4 border-b border-border bg-background text-xs font-bold text-text-secondary uppercase tracking-wider">
                                        <div>Назва</div><div>Категорія</div><div>Диригент</div><div></div>
                                    </div>
                                    <Virtuoso
                                        useWindowScroll
                                        initialItemCount={20}
                                        data={filteredSongs}
                                        itemContent={(index, song) => {
                                            if (!song) return null;
                                            return (
                                                <SwipeableCard key={song.id} disabled={!effectiveCanAdd} onDelete={() => initiateDelete(null, song.id)} className="border-b border-border/30" contentClassName="bg-background" disableFullSwipe={true}>
                                                    <div className="grid grid-cols-[1fr_180px_180px_60px] gap-4 py-3 pl-0 pr-4 hover:bg-surface items-center cursor-pointer transition-colors relative z-10" onClick={() => handleSongClick(song)}>
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-text-primary">
                                                                {song.hasPdf ? <Eye className="w-4 h-4 text-background" /> : <FileText className="w-4 h-4 text-background" />}
                                                            </div>
                                                            <p className="font-semibold text-text-primary truncate">{song.title}</p>
                                                        </div>
                                                        <div className="truncate"><span className="text-sm text-text-secondary">{song.category}</span></div>
                                                        <div className="truncate">
                                                            {song.conductor ? <div className="flex items-center gap-1.5 text-sm text-primary font-medium"><User className="w-3.5 h-3.5" /><span>{song.conductor}</span></div> : <span className="text-sm text-text-secondary/50">—</span>}
                                                        </div>
                                                        <div className="flex justify-end">
                                                            {effectiveCanAdd && <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditClick(e, song); }} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors" title="Детальніше"><MoreVertical className="w-5 h-5" /></button>}
                                                        </div>
                                                    </div>
                                                </SwipeableCard>
                                            );
                                        }}
                                    />
                                </div>
                            )}

                            {isMobile === true && (
                                <div>
                                    <Virtuoso
                                        useWindowScroll
                                        initialItemCount={20}
                                        data={filteredSongs}
                                        itemContent={(index, song) => {
                                            if (!song) return <div style={{ height: 60 }} />;
                                            return (
                                                <SwipeableCard key={song.id} disabled={!effectiveCanAdd} onDelete={() => initiateDelete(null, song.id)} className="border-b border-border/30" contentClassName="bg-background" backgroundClassName="rounded-2xl" disableFullSwipe={!Capacitor.isNativePlatform()}>
                                                    <div onClick={() => handleSongClick(song)} className="flex items-center gap-3 py-3 px-0 bg-background cursor-pointer relative z-10">
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-text-primary">
                                                            {song.hasPdf ? <Eye className="w-5 h-5 text-background" /> : <FileText className="w-5 h-5 text-background" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-text-primary truncate">{song.title}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                {song.conductor && <span className="text-xs text-primary font-medium flex items-center gap-1"><User className="w-3 h-3" />{song.conductor}</span>}
                                                                {song.conductor && <span className="text-xs text-text-secondary">•</span>}
                                                                <span className="text-xs text-text-secondary">{song.category}</span>
                                                            </div>
                                                        </div>
                                                        {effectiveCanAdd && <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditClick(e, song); }} className="p-2 rounded-lg text-text-secondary hover:text-text-primary active:scale-95 transition-transform" title="Детальніше"><MoreVertical className="w-5 h-5" /></button>}
                                                    </div>
                                                </SwipeableCard>
                                            )
                                        }}
                                    />
                                </div>
                            )}
                            {choirType !== 'standard' && subTab === 'catalog' && (
                                <div className="absolute inset-0 bg-background overflow-hidden">
                                    <GlobalArchive onAddSong={handleAddSong} isOverlayOpen={isOverlayOpen} initialSearchQuery={pendingArchiveQuery} />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showAddModal && (
                <AddSongModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdd={handleAddSong} regents={regents} knownConductors={knownConductors} knownCategories={knownCategories} knownPianists={knownPianists} onSearchArchive={choirType !== 'standard' ? (query) => { setPendingArchiveQuery(query); setShowAddModal(false); setShowArchiveModal(true); } : undefined} />
            )}

            {/* Archive Search Modal from Add Song */}
            {choirType !== 'standard' && showArchiveModal && (
                <div className="fixed inset-0 z-[200] bg-background flex flex-col">
                    <div className="flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-white/10 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                        <h2 className="text-lg font-bold text-text-primary">Знайти в архіві</h2>
                        <button
                            onClick={() => setShowArchiveModal(false)}
                            className="p-2 hover:bg-surface-highlight rounded-full text-text-secondary hover:text-text-primary transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-8">
                        <GlobalArchive onAddSong={handleLinkArchive} initialSearchQuery={pendingArchiveQuery} isOverlayOpen={true} />
                    </div>
                </div>
            )}

            {editingSong && (
                <EditSongModal key={editingSong.id} isOpen={!!editingSong} onClose={() => setEditingSong(null)} onSave={handleEditSave} initialData={editingSong} regents={regents} knownConductors={knownConductors} knownCategories={knownCategories} knownPianists={knownPianists} />
            )}
            {showTrashBin && (
                <TrashBin choirId={userData?.choirId || ""} onClose={() => setShowTrashBin(false)} initialFilter="song" onRestore={() => refreshRepertoire()} />
            )}
            <ConfirmationModal isOpen={!!deletingSongId} onClose={() => setDeletingSongId(null)} onConfirm={confirmDelete} title="Видалити пісню?" message="Цю пісню буде видалено з репертуару назавжди." confirmLabel="Видалити" isDestructive />
            <ConfirmationModal
                isOpen={showOpenSongConfirm}
                onClose={() => { setShowOpenSongConfirm(false); setLastAddedSongId(null); }}
                onConfirm={() => {
                    setShowOpenSongConfirm(false);
                    if (lastAddedSongId) {
                        router.push(`/song?id=${lastAddedSongId}`);
                        setLastAddedSongId(null);
                    }
                }}
                title="Пісню додано!"
                message="Пісню успішно додано до репертуару. Відкрити її зараз?"
                confirmLabel="Відкрити"
            />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} duration={toast.onAction ? 5000 : 3000} actionLabel={toast.actionLabel} onAction={toast.onAction} />}

            {/* Floating Add Button */}
            {canAddSongs && subTab === 'repertoire' && setShowAddModal && !showAddModal && !isOverlayOpen && (
                <button onClick={() => setShowAddModal(true)} className="fixed w-14 h-14 bg-primary text-background rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-[60] right-4" style={{ bottom: 'var(--fab-bottom)' }} title="Додати пісню">
                    <Plus className="w-7 h-7" />
                </button>
            )}
        </div>
    );
}
