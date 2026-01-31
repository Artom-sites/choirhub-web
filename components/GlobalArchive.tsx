"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GlobalSong, SongPart } from "@/types";
import { extractInstrument } from "@/lib/utils";
import { OFFICIAL_THEMES } from "@/lib/themes";
import { Search, Music, Users, User, Loader2, FolderOpen, Plus, Eye, FileText, ChevronDown, Filter, X, LayoutGrid, Music2, Mic2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PDFViewer from "./PDFViewer";
import ConfirmationModal from "./ConfirmationModal";
import ArchiveLoader from "./ArchiveLoader";  // Musical note + waves loader for archive
import Fuse from "fuse.js";

interface GlobalArchiveProps {
    onAddSong?: (song: GlobalSong) => void;
}

const CATEGORIES = [
    { id: "all", label: "Всі", icon: LayoutGrid },
    { id: "choir", label: "Хор", icon: Users },
    { id: "orchestra", label: "Оркестр", icon: Music2 },
    { id: "ensemble", label: "Ансамбль", icon: Mic2 },
];

const SUBCATEGORIES: Record<string, { id: string; label: string }[]> = {
    choir: [
        { id: "mixed", label: "Змішаний" },
        { id: "youth", label: "Молодіжний" },
        { id: "male", label: "Чоловічий" },
        { id: "female", label: "Жіночий" },
        { id: "children", label: "Дитячий" },
    ],
    orchestra: [
        { id: "symphonic", label: "Симфонічний" },
        { id: "chamber", label: "Камерний" },
        { id: "wind", label: "Духовий" },
        { id: "folk", label: "Народний" },
    ],
    ensemble: [
        { id: "brass", label: "Духовий" },
        { id: "folk", label: "Народних інструментів" },
        { id: "guitar", label: "Гітарний" },
    ],
};

// Helper to get Ukrainian label for subcategory
const getSubcategoryLabel = (category: string | undefined, subcategoryId: string | undefined): string | null => {
    if (!subcategoryId || !category) return null;
    const subs = SUBCATEGORIES[category];
    if (!subs) return subcategoryId; // fallback to ID
    const found = subs.find(s => s.id === subcategoryId);
    return found ? found.label : subcategoryId;
};

const PAGE_SIZE = 50;  // Songs per page for display

// Normalize title for sorting
const normalizeForSort = (text: string): string => {
    return text.replace(/^["""«»''„"'\s]+/, '').toLowerCase();
};

// Check if text starts with Cyrillic character (ignoring punctuation)
const isCyrillic = (text: string): boolean => {
    const cleanText = text.replace(/^["""«»''„"'\s\d\.,!?-]+/, '');
    return /^[\u0400-\u04FF]/.test(cleanText);
};

// Fuse.js options
const fuseOptions = {
    keys: [
        { name: "title", weight: 0.5 },
        // { name: "composer", weight: 0.3 }, // Hidden from UI and search
        { name: "keywords", weight: 0.2 }
    ],
    threshold: 0.3,
    distance: 100,
    ignoreLocation: true,
    minMatchCharLength: 2,
};

export default function GlobalArchive({ onAddSong }: GlobalArchiveProps) {
    const [songs, setSongs] = useState<GlobalSong[]>([]);
    const [filteredSongs, setFilteredSongs] = useState<GlobalSong[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
    const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState<'all' | 'cyrillic' | 'latin'>('all');
    const [availableThemes, setAvailableThemes] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [previewSong, setPreviewSong] = useState<GlobalSong | null>(null);
    const [previewPartIndex, setPreviewPartIndex] = useState(0);
    const [fuseInstance, setFuseInstance] = useState<Fuse<GlobalSong> | null>(null);

    // NEW: State for filter panel visibility
    const [showFilters, setShowFilters] = useState(false);

    // NEW: Add Options Modal State
    const [showAddOptions, setShowAddOptions] = useState(false);

    // Confirmation State
    const [songToAdd, setSongToAdd] = useState<GlobalSong | null>(null);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Load ALL songs from Firestore using onSnapshot for instant cache feedback
    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, "global_songs"), orderBy("title"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`Fetched ${snapshot.docs.length} documents from global_songs (Source: ${snapshot.metadata.fromCache ? 'Cache' : 'Server'})`);

            const allSongs: GlobalSong[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalSong));
            const sortedSongs = allSongs.sort((a, b) =>
                normalizeForSort(a.title).localeCompare(normalizeForSort(b.title), 'uk')
            );

            setSongs(sortedSongs);
            setFuseInstance(new Fuse(sortedSongs, fuseOptions));

            const themes = new Set<string>();
            sortedSongs.forEach(song => {
                if (song.theme) themes.add(song.theme);
            });
            setAvailableThemes(Array.from(themes).sort());
            setLoading(false);
        }, (error) => {
            console.error("Error loading songs:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Reset to page 1 when filters/search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCategory, selectedSubCategory, selectedTheme, selectedLanguage]);

    // Filter songs locally
    useEffect(() => {
        let results = songs;

        if (selectedCategory !== 'all') {
            results = results.filter(s => s.category === selectedCategory);
        }

        if (selectedSubCategory) {
            results = results.filter(s => s.subcategory === selectedSubCategory);
        }

        if (selectedLanguage === 'cyrillic') {
            results = results.filter(s => isCyrillic(s.title));
        } else if (selectedLanguage === 'latin') {
            results = results.filter(s => !isCyrillic(s.title));
        }

        if (selectedTheme) {
            results = results.filter(s => s.theme === selectedTheme);
        }

        if (searchQuery.trim() && fuseInstance) {
            const fuseResults = fuseInstance.search(searchQuery, { limit: 100 });
            const searchIds = new Set(fuseResults.map(r => r.item.id));
            results = results.filter(s => searchIds.has(s.id));
        }

        setFilteredSongs(results);
    }, [searchQuery, songs, fuseInstance, selectedCategory, selectedSubCategory, selectedTheme, selectedLanguage]);

    // Calculate pagination
    const totalPages = Math.ceil(filteredSongs.length / PAGE_SIZE);
    const paginatedSongs = filteredSongs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handleAddSong = (song: GlobalSong) => {
        if (onAddSong) {
            setSongToAdd(song);
        }
    };

    const confirmAddSong = () => {
        if (songToAdd && onAddSong) {
            onAddSong(songToAdd);
            setToastMessage(`"${songToAdd.title}" додано до репертуару`);
            setTimeout(() => setToastMessage(null), 3000);
            setSongToAdd(null);
        }
    };

    // Add specific part only (creates a modified song with just that part)
    const handleAddPart = (song: GlobalSong, partIndex: number) => {
        if (onAddSong) {
            const singlePartSong: GlobalSong = {
                ...song,
                parts: [song.parts[partIndex]],
            };
            onAddSong(singlePartSong);
        }
        setShowAddOptions(false);
        setPreviewSong(null);
    };

    // Handler for the Add button click - shows modal if multiple parts
    const handleAddClick = () => {
        if (!previewSong) return;

        if (previewSong.parts.length > 1) {
            setShowAddOptions(true);
        } else {
            handleAddSong(previewSong);
            setPreviewSong(null);
        }
    };

    // Calculate active filter count
    const activeFiltersCount =
        (selectedLanguage !== 'all' ? 1 : 0) +
        (selectedTheme ? 1 : 0) +
        (selectedSubCategory ? 1 : 0);

    return (
        <div className="flex flex-col h-full">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg pb-4">
                <h2 className="text-xl font-bold mb-4">Архів МХО</h2>

                {/* Search Bar with Filter Toggle */}
                <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                        <input
                            type="text"
                            placeholder="Пошук пісні..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-surface rounded-2xl text-white placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 rounded-2xl flex items-center gap-2 transition-all ${showFilters || activeFiltersCount > 0
                            ? "bg-white text-black"
                            : "bg-surface text-text-secondary hover:text-white"
                            }`}
                    >
                        <Filter className="w-5 h-5" />
                        {activeFiltersCount > 0 && <span className="bg-black/20 px-1.5 rounded-full text-xs">{activeFiltersCount}</span>}
                    </button>
                </div>

                {/* Collapsible Filter Panel */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-surface rounded-2xl p-4 mb-4 space-y-4 border border-white/5">
                                {/* Row 1: Language */}
                                <div>
                                    <p className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-2">Мова</p>
                                    <div className="flex bg-black/20 rounded-xl p-1 w-fit">
                                        <button onClick={() => setSelectedLanguage('all')} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedLanguage === 'all' ? 'bg-white/20 text-white' : 'text-text-secondary'}`}>Всі</button>
                                        <button onClick={() => setSelectedLanguage('cyrillic')} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedLanguage === 'cyrillic' ? 'bg-white/20 text-white' : 'text-text-secondary'}`}>АБВ</button>
                                        <button onClick={() => setSelectedLanguage('latin')} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedLanguage === 'latin' ? 'bg-white/20 text-white' : 'text-text-secondary'}`}>ABC</button>
                                    </div>
                                </div>

                                {/* Row 2: Main Category */}
                                <div className="border-b border-white/5 pb-4">
                                    <p className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-2">Категорія</p>
                                    <div className="flex flex-wrap gap-2">
                                        {CATEGORIES.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    setSelectedCategory(cat.id);
                                                    setSelectedSubCategory(null);
                                                }}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all border ${selectedCategory === cat.id
                                                    ? "bg-white text-black border-white font-semibold"
                                                    : "bg-transparent text-text-secondary border-white/10 hover:border-white/30"
                                                    }`}
                                            >
                                                <cat.icon className="w-4 h-4" />
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Row 2: Subcategories */}
                                {selectedCategory !== "all" && SUBCATEGORIES[selectedCategory] && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-text-secondary uppercase font-bold tracking-wider">Склад</p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => setSelectedSubCategory(null)}
                                                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${!selectedSubCategory
                                                    ? "bg-white text-black border-white"
                                                    : "bg-transparent text-text-secondary border-white/10 hover:border-white/30"
                                                    }`}
                                            >
                                                Всі
                                            </button>
                                            {SUBCATEGORIES[selectedCategory].map(sub => (
                                                <button
                                                    key={sub.id}
                                                    onClick={() => setSelectedSubCategory(selectedSubCategory === sub.id ? null : sub.id)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${selectedSubCategory === sub.id
                                                        ? "bg-white text-black border-white"
                                                        : "bg-transparent text-text-secondary border-white/10 hover:border-white/30"
                                                        }`}
                                                >
                                                    {sub.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Row 3: Themes - horizontal scroll on mobile */}
                                <div className="space-y-2">
                                    <p className="text-xs text-text-secondary uppercase font-bold tracking-wider">Тематика</p>
                                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                                        <button
                                            onClick={() => setSelectedTheme(null)}
                                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs border transition-all ${!selectedTheme
                                                ? "bg-white text-black border-white"
                                                : "bg-transparent text-text-secondary border-white/10 hover:border-white/30"
                                                }`}
                                        >
                                            Всі теми
                                        </button>
                                        {OFFICIAL_THEMES.map(theme => (
                                            <button
                                                key={theme}
                                                onClick={() => setSelectedTheme(selectedTheme === theme ? null : theme)}
                                                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs border transition-all ${selectedTheme === theme
                                                    ? "bg-white text-black border-white"
                                                    : "bg-transparent text-text-secondary border-white/10 hover:border-white/30"
                                                    }`}
                                            >
                                                {theme}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Song count */}
                <div className="flex items-center justify-between mb-2 px-2">
                    <span className="text-sm text-text-secondary">
                        {searchQuery || activeFiltersCount > 0 ? (
                            <>Знайдено: <strong className="text-white">{filteredSongs.length}</strong> з {songs.length}</>
                        ) : (
                            <>Всього: <strong className="text-white">{songs.length}</strong> пісень</>
                        )}
                    </span>
                    {activeFiltersCount > 0 && (
                        <button
                            onClick={() => {
                                setSelectedLanguage('all');
                                setSelectedTheme(null);
                                setSelectedSubCategory(null);
                                setSelectedCategory('all');
                            }}
                            className="text-xs text-accent hover:underline flex items-center gap-1"
                        >
                            <X className="w-3 h-3" /> Скинути фільтри
                        </button>
                    )}
                </div>
            </div>

            {/* Song List */}
            <div className="flex-1 overflow-y-auto space-y-2">
                {/* ... (Existing List Logic) ... */}
                {loading ? (
                    <ArchiveLoader />
                ) : filteredSongs.length === 0 ? (
                    <div className="text-center py-12 text-text-secondary">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Пісень не знайдено</p>
                    </div>
                ) : (
                    <>
                        <AnimatePresence mode="popLayout">
                            {paginatedSongs.map((song, index) => (
                                <motion.div
                                    key={song.id || song.sourceId}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ delay: Math.min(index * 0.02, 0.5) }}
                                    className="bg-surface rounded-2xl p-4 flex items-center gap-4 border border-white/5 hover:border-white/10 transition-colors"
                                >
                                    {/* Icon */}
                                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                                        {song.parts && song.parts.length > 0 ? (
                                            <FileText className="w-6 h-6 text-white" />
                                        ) : (
                                            <Music className="w-6 h-6 text-gray-400" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-white truncate">{song.title}</h3>
                                        <div className="flex flex-wrap gap-1.5 items-center mt-1">
                                            {/* Hide composer for now as it causes confusion with Regent
                                            {song.composer && (
                                                <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-white/5 px-2 py-1 rounded-lg border border-white/5 truncate max-w-[150px]">
                                                    <User className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">{song.composer}</span>
                                                </div>
                                            )} 
                                            */}
                                            {song.subcategory && (
                                                <span className="text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">
                                                    {getSubcategoryLabel(song.category, song.subcategory)}
                                                </span>
                                            )}
                                            {song.theme && (
                                                <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded border border-white/20">
                                                    {song.theme}
                                                </span>
                                            )}
                                            {song.parts && song.parts.length > 1 && (
                                                <span className="text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">
                                                    {song.parts.length} партій
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {song.parts && song.parts.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    setPreviewSong(song);
                                                    setPreviewPartIndex(0);
                                                }}
                                                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                                            >
                                                <Eye className="w-5 h-5 text-white" />
                                            </button>
                                        )}
                                        {onAddSong && (
                                            <button
                                                onClick={() => handleAddSong(song)}
                                                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                                            >
                                                <Plus className="w-5 h-5 text-white" />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 py-4 flex-wrap">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg bg-surface text-text-secondary hover:bg-surface-highlight disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    ←
                                </button>
                                {(() => {
                                    const pages = [];
                                    const siblingCount = 2;

                                    // Always show first
                                    pages.push(1);

                                    if (currentPage - siblingCount > 2) {
                                        pages.push('...');
                                    }

                                    // Siblings
                                    const start = Math.max(2, currentPage - siblingCount);
                                    const end = Math.min(totalPages - 1, currentPage + siblingCount);

                                    for (let i = start; i <= end; i++) {
                                        pages.push(i);
                                    }

                                    if (currentPage + siblingCount < totalPages - 1) {
                                        pages.push('...');
                                    }

                                    // Always show last if > 1
                                    if (totalPages > 1) {
                                        pages.push(totalPages);
                                    }

                                    return pages.map((page, index) => {
                                        if (page === '...') {
                                            return <span key={`ellipsis-${index}`} className="px-2 text-text-secondary select-none">...</span>;
                                        }
                                        const pageNum = page as number;
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-9 h-9 rounded-lg transition-colors font-medium ${currentPage === pageNum
                                                    ? 'bg-white text-black'
                                                    : 'bg-surface text-text-secondary hover:bg-surface-highlight'
                                                    }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    });
                                })()}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg bg-surface text-text-secondary hover:bg-surface-highlight disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* PDF Preview Modal */}
            <AnimatePresence>
                {previewSong && previewSong.parts && previewSong.parts.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-white flex flex-col"
                    >
                        {/* Header - fixed at top */}
                        <div className="bg-white border-b border-gray-200 z-40">
                            {/* Row 1: Close button, title, add button */}
                            <div className="flex items-center justify-between px-4 py-3">
                                <button
                                    onClick={() => setPreviewSong(null)}
                                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-600" />
                                </button>

                                <h3 className="text-sm font-medium text-gray-900 truncate flex-1 text-center mx-4">
                                    {previewSong.title}
                                </h3>

                                {/* Always show + button if onAddSong exists, or show placeholder */}
                                {onAddSong ? (
                                    <button
                                        onClick={handleAddClick}
                                        className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
                                    >
                                        <Plus className="w-5 h-5 text-gray-700" />
                                    </button>
                                ) : (
                                    <div className="w-10" /> /* Spacer */
                                )}
                            </div>

                            {/* Row 2: Part tabs - only if multiple parts */}
                            {previewSong.parts.length > 1 && (
                                <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                                    {previewSong.parts.map((part, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setPreviewPartIndex(idx)}
                                            className={`px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-medium ${idx === previewPartIndex
                                                ? "bg-gray-900 text-white"
                                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                }`}
                                        >
                                            {extractInstrument(part.name || `Партія ${idx + 1}`, previewSong.title)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* PDF Content */}
                        <div className="flex-1 overflow-hidden">
                            <PDFViewer
                                url={`/api/pdf-proxy?url=${encodeURIComponent(previewSong.parts[previewPartIndex].pdfUrl)}`}
                                title={previewSong.title}
                                onClose={() => setPreviewSong(null)}
                            />
                        </div>

                        {/* Add Options Modal */}
                        <AnimatePresence>
                            {showAddOptions && previewSong && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-black/80 flex items-center justify-center z-60"
                                    onClick={() => setShowAddOptions(false)}
                                >
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.9, opacity: 0 }}
                                        className="bg-surface rounded-2xl p-5 mx-4 max-w-md w-full shadow-2xl border border-white/10"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <h3 className="text-lg font-bold text-white mb-2">Додати до репертуару</h3>
                                        <p className="text-text-secondary text-sm mb-5">
                                            Оберіть що додати:
                                        </p>
                                        <div className="flex flex-col gap-3">
                                            <button
                                                onClick={() => handleAddPart(previewSong, previewPartIndex)}
                                                className="w-full py-4 px-4 bg-accent/20 border border-accent text-white font-semibold rounded-xl hover:bg-accent/30 transition-colors text-left"
                                            >
                                                <div className="text-xs opacity-70 mb-1">Тільки поточна партія:</div>
                                                <div className="truncate text-accent">{extractInstrument(previewSong.parts[previewPartIndex]?.name || 'Поточна партія', previewSong.title)}</div>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleAddSong(previewSong);
                                                    setShowAddOptions(false);
                                                    setPreviewSong(null);
                                                }}
                                                className="w-full py-4 px-4 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors text-left"
                                            >
                                                <div className="text-xs opacity-70 mb-1">Вся партитура:</div>
                                                <div>Усі {previewSong.parts.length} партій</div>
                                            </button>
                                            <button
                                                onClick={() => setShowAddOptions(false)}
                                                className="w-full py-2 text-text-secondary hover:text-white transition-colors text-sm mt-2"
                                            >
                                                Скасувати
                                            </button>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast Notification */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-24 left-4 right-4 z-[60] flex justify-center pointer-events-none"
                    >
                        <div className="bg-white text-black px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-[90%] text-center">
                            {toastMessage}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!songToAdd}
                onClose={() => setSongToAdd(null)}
                onConfirm={confirmAddSong}
                title="Додати пісню?"
                message={`Ви дійсно хочете додати "${songToAdd?.title}" до списку?`}
                confirmLabel="Додати"
                cancelLabel="Скасувати"
            />
        </div>
    );
}
