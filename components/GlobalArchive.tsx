"use client";
// Updated to force recompile and fix stale cache

import { useState, useEffect, useCallback, useRef } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GlobalSong, SongPart } from "@/types";
import { extractInstrument } from "@/lib/utils";
import { OFFICIAL_THEMES } from "@/lib/themes";
import { Search, Music, Users, User, Loader2, FolderOpen, Plus, Eye, FileText, ChevronDown, Filter, X, LayoutGrid, Music2, Mic2, Sparkles, ShieldAlert, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PDFViewer from "./PDFViewer";
import ConfirmationModal from "./ConfirmationModal";
import ArchiveLoader from "./ArchiveLoader";
import Fuse from "fuse.js";
import { useAuth } from "@/contexts/AuthContext";
import SubmitSongModal from "./SubmitSongModal";
import { getPendingSongs, approveSong, rejectSong } from "@/lib/db";
import { PendingSong } from "@/types";
import { ConfirmModal, AlertModal, InputModal } from "./ui/Modal";

interface GlobalArchiveProps {
    onAddSong?: (song: GlobalSong) => void;
}

const CATEGORIES = [
    { id: "new", label: "Новинки 🔥", icon: Sparkles },
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

const getSubcategoryLabel = (category: string | undefined, subcategoryId: string | undefined): string | null => {
    if (!subcategoryId || !category) return null;
    const subs = SUBCATEGORIES[category];
    if (!subs) return subcategoryId;
    const found = subs.find(s => s.id === subcategoryId);
    return found ? found.label : subcategoryId;
};

const PAGE_SIZE = 50;

const normalizeForSort = (text: string): string => {
    return text.replace(/^["""«»''„"'\s]+/, '').toLowerCase();
};

const isCyrillic = (text: string): boolean => {
    const cleanText = text.replace(/^["""«»''„"'\s\d\.,!?-]+/, '');
    return /^[\u0400-\u04FF]/.test(cleanText);
};

const fuseOptions = {
    keys: [
        { name: "title", weight: 0.5 },
        { name: "keywords", weight: 0.2 }
    ],
    threshold: 0.3,
    distance: 100,
    ignoreLocation: true,
    minMatchCharLength: 2,
};

export default function GlobalArchive({ onAddSong }: GlobalArchiveProps) {
    const { user, userData } = useAuth();
    const [songs, setSongs] = useState<GlobalSong[]>([]);
    const [filteredSongs, setFilteredSongs] = useState<GlobalSong[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all"); // Default to 'all' or 'new'? keep 'all' 
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
    const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState<'all' | 'cyrillic' | 'latin'>('all');
    const [availableThemes, setAvailableThemes] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [previewSong, setPreviewSong] = useState<GlobalSong | null>(null);
    const [previewPartIndex, setPreviewPartIndex] = useState(0);
    const [fuseInstance, setFuseInstance] = useState<Fuse<GlobalSong> | null>(null);

    const [showFilters, setShowFilters] = useState(false);
    const [showAddOptions, setShowAddOptions] = useState(false);
    const [songToAdd, setSongToAdd] = useState<GlobalSong | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Submission & Moderation
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [pendingSongs, setPendingSongs] = useState<PendingSong[]>([]);
    const [isModerationMode, setIsModerationMode] = useState(false);
    const [moderationLoading, setModerationLoading] = useState(false);

    // Custom Modal State
    const [approveModal, setApproveModal] = useState<{ isOpen: boolean; song: PendingSong | null; loading: boolean }>({ isOpen: false, song: null, loading: false });
    const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; song: PendingSong | null; loading: boolean }>({ isOpen: false, song: null, loading: false });
    const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' }>({ isOpen: false, title: '', message: '', variant: 'info' });

    // Check if user is Admin/Moderator (Exclusive to artemdula0@gmail.com)
    const isModerator = userData?.email === "artemdula0@gmail.com";
    // Allow Regents and Heads to submit
    const canSubmit = userData?.role === 'head' || userData?.role === 'regent';

    // Cache keys
    const CACHE_KEY = 'global_songs_cache';
    const CACHE_TIMESTAMP_KEY = 'global_songs_cache_time';
    const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

    const loadSongsFromCache = (): GlobalSong[] | null => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
            if (cached && timestamp) {
                const age = Date.now() - parseInt(timestamp);
                if (age < CACHE_DURATION) {
                    return JSON.parse(cached);
                }
            }
        } catch (e) {
            console.warn('Cache read error:', e);
        }
        return null;
    };

    const saveSongsToCache = (data: GlobalSong[]) => {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        } catch (e) {
            console.warn('Cache write error:', e);
        }
    };

    const fetchSongsFromFirestore = async () => {
        const q = query(collection(db, "global_songs"), orderBy("title"));
        const snapshot = await getDocs(q);
        console.log(`Fetched ${snapshot.docs.length} docs from Firestore`);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalSong));
    };

    const processSongs = (allSongs: GlobalSong[]) => {
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
    };

    // Force refresh function (can be called after adding a song)
    const refreshSongs = async () => {
        setLoading(true);
        try {
            const freshSongs = await fetchSongsFromFirestore();
            processSongs(freshSongs);
            saveSongsToCache(freshSongs);
        } catch (error) {
            console.error('Error refreshing songs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const loadSongs = async () => {
            setLoading(true);

            // 1. Try to load from cache first (instant)
            const cachedSongs = loadSongsFromCache();
            if (cachedSongs && cachedSongs.length > 0) {
                console.log(`Loaded ${cachedSongs.length} songs from cache`);
                processSongs(cachedSongs);
                setLoading(false);
                return; // Use cache, don't fetch from Firestore
            }

            // 2. No cache - fetch from Firestore (costs reads)
            try {
                const freshSongs = await fetchSongsFromFirestore();
                processSongs(freshSongs);
                saveSongsToCache(freshSongs);
            } catch (error) {
                console.error('Error loading songs:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSongs();
    }, []);

    // Load Pending Songs if moderation mode is ON
    useEffect(() => {
        if (isModerationMode) {
            setModerationLoading(true);
            getPendingSongs().then(list => {
                setPendingSongs(list);
                setModerationLoading(false);
            });
        }
    }, [isModerationMode]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCategory, selectedSubCategory, selectedTheme, selectedLanguage]);

    useEffect(() => {
        let results = songs;

        if (selectedCategory === 'new') {
            // Sort by createdAt desc (newest first)
            // Filter out song without createdAt if essential, or just push to bottom
            results = [...results].sort((a, b) => {
                const tA = (a.createdAt as any)?.seconds || 0;
                const tB = (b.createdAt as any)?.seconds || 0;
                return tB - tA;
            });
            // Maybe limit to top 100? No, let user scroll
        } else if (selectedCategory !== 'all') {
            results = results.filter(s => s.category === selectedCategory);
            // Default alphabetic sort is already applied
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
            if (selectedCategory === 'new') {
                // If searching in 'new', keep sort order of results? Fuse returns by relevance
                results = results.filter(s => searchIds.has(s.id));
            } else {
                // Use fuse relevance order
                results = fuseResults.map(r => r.item);
                // Re-apply other filters? Fuse searches ALL songs. We need to intersect.
                // Simpler: filter the Fuse results by current filters
                if (selectedCategory !== 'all' && selectedCategory !== 'new') {
                    results = results.filter(s => s.category === selectedCategory);
                }
                if (selectedSubCategory) results = results.filter(s => s.subcategory === selectedSubCategory);
                if (selectedTheme) results = results.filter(s => s.theme === selectedTheme);
                // Language
                if (selectedLanguage === 'cyrillic') results = results.filter(s => isCyrillic(s.title));
                else if (selectedLanguage === 'latin') results = results.filter(s => !isCyrillic(s.title));
            }
        }

        setFilteredSongs(results);
    }, [searchQuery, songs, fuseInstance, selectedCategory, selectedSubCategory, selectedTheme, selectedLanguage]);

    const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
    const loaderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setDisplayedCount(PAGE_SIZE);
    }, [searchQuery, selectedCategory]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setDisplayedCount((prev) => prev + PAGE_SIZE);
                }
            },
            { threshold: 0.1 }
        );
        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [filteredSongs]);

    const visibleSongs = filteredSongs.slice(0, displayedCount);

    const handleAddSongWrapper = (song: GlobalSong) => {
        if (onAddSong) setSongToAdd(song);
    };

    const confirmAddSong = () => {
        if (songToAdd && onAddSong) {
            onAddSong(songToAdd);
            setToastMessage(`"${songToAdd.title}" додано до репертуару`);
            setTimeout(() => setToastMessage(null), 3000);
            setSongToAdd(null);
        }
    };

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

    const handleAddClick = () => {
        if (!previewSong) return;
        if (previewSong.parts && previewSong.parts.length > 1) {
            setShowAddOptions(true);
        } else {
            handleAddSongWrapper(previewSong);
            setPreviewSong(null);
        }
    };

    const handleApproveClick = (ps: PendingSong) => {
        setApproveModal({ isOpen: true, song: ps, loading: false });
    };

    const handleApproveConfirm = async () => {
        if (!approveModal.song) return;
        setApproveModal(prev => ({ ...prev, loading: true }));
        try {
            await approveSong(approveModal.song, user!.uid);
            setPendingSongs(prev => prev.filter(s => s.id !== approveModal.song!.id));
            setApproveModal({ isOpen: false, song: null, loading: false });
            // Clear cache to show new song in archive
            localStorage.removeItem('global_songs_cache');
            localStorage.removeItem('global_songs_cache_time');
            await refreshSongs();
            setAlertModal({ isOpen: true, title: 'Успішно!', message: 'Пісню додано до архіву', variant: 'success' });
        } catch (e) {
            setApproveModal({ isOpen: false, song: null, loading: false });
            setAlertModal({ isOpen: true, title: 'Помилка', message: 'Не вдалося схвалити пісню', variant: 'error' });
        }
    };

    const handleRejectClick = (ps: PendingSong) => {
        setRejectModal({ isOpen: true, song: ps, loading: false });
    };

    const handleRejectConfirm = async (reason: string) => {
        if (!rejectModal.song || !reason.trim()) return;
        setRejectModal(prev => ({ ...prev, loading: true }));
        try {
            await rejectSong(rejectModal.song.id!, user!.uid, reason);
            setPendingSongs(prev => prev.filter(s => s.id !== rejectModal.song!.id));
            setRejectModal({ isOpen: false, song: null, loading: false });
            setAlertModal({ isOpen: true, title: 'Відхилено', message: 'Заявку відхилено', variant: 'warning' });
        } catch (e) {
            setRejectModal({ isOpen: false, song: null, loading: false });
            setAlertModal({ isOpen: true, title: 'Помилка', message: 'Не вдалося відхилити заявку', variant: 'error' });
        }
    };

    const activeFiltersCount =
        (selectedLanguage !== 'all' ? 1 : 0) +
        (selectedTheme ? 1 : 0) +
        (selectedSubCategory ? 1 : 0);

    return (
        <div className="flex flex-col h-full">
            <div className="sticky top-[64px] z-10 bg-background/95 backdrop-blur-lg pb-2 border-b border-border -mx-4 px-4">
                <div className="flex items-center justify-between pt-4 mb-4">
                    <h2 className="text-xl font-bold text-text-primary">Архів МХО</h2>
                    <div className="flex items-center gap-3">
                        {isModerator && (
                            <button
                                onClick={() => {
                                    setIsModerationMode(!isModerationMode);
                                    if (!isModerationMode) setSelectedCategory('all');
                                }}
                                className={`p-2 rounded-xl transition-colors ${isModerationMode ? 'bg-orange-500 text-white' : 'bg-surface text-text-secondary hover:text-text-primary'}`}
                                title="Модерація"
                            >
                                <ShieldAlert className="w-5 h-5" />
                            </button>
                        )}
                        {!isModerationMode && (
                            <span className="text-sm text-text-secondary whitespace-nowrap">
                                {searchQuery || activeFiltersCount > 0 ? (
                                    <>Знайдено: <strong className="text-text-primary">{filteredSongs.length}</strong></>
                                ) : (
                                    <><strong className="text-text-primary">{songs.length}</strong> пісень</>
                                )}
                            </span>
                        )}
                    </div>
                </div>

                {!isModerationMode ? (
                    <>
                        <div className="flex gap-2 mb-4">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary group-focus-within:text-text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Пошук пісні..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-10 py-3 bg-surface rounded-2xl text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary hover:bg-surface-highlight rounded-full transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`px-4 rounded-2xl flex items-center gap-2 transition-all ${showFilters || activeFiltersCount > 0
                                    ? "bg-primary text-background"
                                    : "bg-surface text-text-secondary hover:text-text-primary"
                                    }`}
                            >
                                <Filter className="w-5 h-5" />
                                {activeFiltersCount > 0 && <span className="bg-black/20 px-1.5 rounded-full text-xs">{activeFiltersCount}</span>}
                            </button>
                        </div>

                        {/* Filters Panel */}
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-surface rounded-2xl p-4 mb-4 space-y-4 border border-border">
                                        {/* Language */}
                                        <div>
                                            <p className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-2">Мова</p>
                                            <div className="flex bg-black/20 rounded-xl p-1 w-fit">
                                                <button onClick={() => setSelectedLanguage('all')} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedLanguage === 'all' ? 'bg-primary/20 text-text-primary' : 'text-text-secondary'}`}>Всі</button>
                                                <button onClick={() => setSelectedLanguage('cyrillic')} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedLanguage === 'cyrillic' ? 'bg-primary/20 text-text-primary' : 'text-text-secondary'}`}>АБВ</button>
                                                <button onClick={() => setSelectedLanguage('latin')} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedLanguage === 'latin' ? 'bg-primary/20 text-text-primary' : 'text-text-secondary'}`}>ABC</button>
                                            </div>
                                        </div>

                                        {/* Categories */}
                                        <div className="border-b border-border pb-4">
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
                                                            ? "bg-primary text-background border-primary font-semibold"
                                                            : "bg-transparent text-text-secondary border-border hover:border-border/50"
                                                            }`}
                                                    >
                                                        <cat.icon className="w-4 h-4" />
                                                        {cat.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Subcategories */}
                                        {selectedCategory !== "all" && selectedCategory !== "new" && SUBCATEGORIES[selectedCategory] && (
                                            <div className="space-y-2">
                                                <p className="text-xs text-text-secondary uppercase font-bold tracking-wider">Склад</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => setSelectedSubCategory(null)}
                                                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${!selectedSubCategory
                                                            ? "bg-primary text-background border-primary"
                                                            : "bg-transparent text-text-secondary border-border hover:border-border/50"
                                                            }`}
                                                    >
                                                        Всі
                                                    </button>
                                                    {SUBCATEGORIES[selectedCategory].map(sub => (
                                                        <button
                                                            key={sub.id}
                                                            onClick={() => setSelectedSubCategory(selectedSubCategory === sub.id ? null : sub.id)}
                                                            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${selectedSubCategory === sub.id
                                                                ? "bg-primary text-background border-primary"
                                                                : "bg-transparent text-text-secondary border-border hover:border-border/50"
                                                                }`}
                                                        >
                                                            {sub.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Themes */}
                                        <div className="space-y-2">
                                            <p className="text-xs text-text-secondary uppercase font-bold tracking-wider">Тематика</p>
                                            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                                                <button onClick={() => setSelectedTheme(null)} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs border ${!selectedTheme ? "bg-primary text-background border-primary" : "bg-transparent text-text-secondary border-border"}`}>Всі теми</button>
                                                {OFFICIAL_THEMES.map(theme => (
                                                    <button key={theme} onClick={() => setSelectedTheme(selectedTheme === theme ? null : theme)} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs border ${selectedTheme === theme ? "bg-primary text-background border-primary" : "bg-transparent text-text-secondary border-border"}`}>{theme}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                ) : (
                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl mb-4">
                        <h3 className="font-bold text-orange-400 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5" />
                            Панель Модератора
                        </h3>
                        <p className="text-sm text-text-secondary mt-1">
                            Перевіряйте заявки користувачів.
                        </p>
                    </div>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pt-4">
                {loading || moderationLoading ? (
                    <ArchiveLoader />
                ) : isModerationMode ? (
                    pendingSongs.length === 0 ? (
                        <div className="text-center py-12 text-text-secondary">
                            <p>Заявок не знайдено</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pendingSongs.map(song => (
                                <div key={song.id} className="bg-surface rounded-2xl p-4 border border-border">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                            <FileText className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-white">{song.title}</h3>
                                            <p className="text-xs text-text-secondary">{song.composer} • {song.category}</p>
                                            <p className="text-[10px] text-text-secondary/60 mt-0.5">Від: {song.submittedByName}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                // Preview Mock
                                                const preview: GlobalSong = {
                                                    ...song,
                                                    parts: song.parts || [],
                                                };
                                                setPreviewSong(preview);
                                            }}
                                            className="flex-1 py-1.5 bg-surface-highlight rounded-lg text-xs font-medium"
                                        >
                                            Переглянути
                                        </button>
                                        <button onClick={() => handleRejectClick(song)} className="flex-1 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium">Відхилити</button>
                                        <button onClick={() => handleApproveClick(song)} className="flex-1 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-medium">Схвалити</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : filteredSongs.length === 0 ? (
                    <div className="text-center py-12 text-text-secondary">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Пісень не знайдено</p>
                    </div>
                ) : (
                    <>
                        <AnimatePresence mode="popLayout">
                            {visibleSongs.map((song, index) => (
                                <motion.div
                                    key={song.id || song.sourceId}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ delay: Math.min(index * 0.02, 0.5) }}
                                    className="bg-surface rounded-2xl p-4 flex items-center gap-4 border border-border hover:border-border/50 transition-colors"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                                        {song.parts && song.parts.length > 0 ? (
                                            <FileText className="w-6 h-6 text-text-primary" />
                                        ) : (
                                            <Music className="w-6 h-6 text-text-secondary" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-text-primary truncate">{song.title}</h3>
                                        <div className="flex flex-wrap gap-1.5 items-center mt-1">
                                            {song.subcategory && (
                                                <span className="text-[10px] bg-surface-highlight text-text-secondary px-1.5 py-0.5 rounded">
                                                    {getSubcategoryLabel(song.category, song.subcategory)}
                                                </span>
                                            )}
                                            {song.theme && (
                                                <span className="text-[10px] bg-surface-highlight text-text-secondary px-1.5 py-0.5 rounded border border-border">
                                                    {song.theme}
                                                </span>
                                            )}
                                            {song.parts && song.parts.length > 1 && (
                                                <span className="text-[10px] bg-surface-highlight text-text-secondary px-1.5 py-0.5 rounded">
                                                    {song.parts.length} партій
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {song.parts && song.parts.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    setPreviewSong(song);
                                                    setPreviewPartIndex(0);
                                                }}
                                                className="p-2 rounded-xl bg-surface-highlight hover:bg-surface-highlight/80 transition-colors"
                                            >
                                                <Eye className="w-5 h-5 text-text-primary" />
                                            </button>
                                        )}
                                        {onAddSong && (
                                            <button
                                                onClick={() => handleAddSongWrapper(song)}
                                                className="p-2 rounded-xl bg-surface-highlight hover:bg-surface-highlight/80 transition-colors"
                                            >
                                                <Plus className="w-5 h-5 text-text-primary" />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {visibleSongs.length < filteredSongs.length && (
                            <div ref={loaderRef} className="py-8 flex justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals and Overlays */}
            <AnimatePresence>
                {previewSong && previewSong.parts && previewSong.parts.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-white flex flex-col"
                    >
                        <div className="bg-white border-b border-gray-200 z-40">
                            <div className="flex items-center justify-between px-4 py-3">
                                <button onClick={() => setPreviewSong(null)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                                    <X className="w-5 h-5 text-gray-600" />
                                </button>
                                <h3 className="text-sm font-medium text-gray-900 truncate flex-1 text-center mx-4">{previewSong.title}</h3>
                                {onAddSong ? (
                                    <button onClick={handleAddClick} className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors">
                                        <Plus className="w-5 h-5 text-gray-700" />
                                    </button>
                                ) : <div className="w-10" />}
                            </div>

                            {previewSong.parts.length > 1 && (
                                <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                                    {previewSong.parts.map((part, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setPreviewPartIndex(idx)}
                                            className={`px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-medium ${idx === previewPartIndex ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                                        >
                                            {extractInstrument(part.name || `Партія ${idx + 1}`, previewSong.title)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-hidden">
                            <PDFViewer
                                url={`/api/pdf-proxy?url=${encodeURIComponent(previewSong.parts[previewPartIndex].pdfUrl)}`}
                                title={previewSong.title}
                                onClose={() => setPreviewSong(null)}
                            />
                        </div>

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
                                        <p className="text-text-secondary text-sm mb-5">Оберіть що додати:</p>
                                        <div className="flex flex-col gap-3">
                                            <button onClick={() => handleAddPart(previewSong, previewPartIndex)} className="w-full py-4 px-4 bg-accent/20 border border-accent text-white font-semibold rounded-xl hover:bg-accent/30 transition-colors text-left">
                                                <div className="text-xs opacity-70 mb-1">Тільки поточна партія:</div>
                                                <div className="truncate text-accent">{extractInstrument(previewSong.parts[previewPartIndex]?.name || 'Поточна партія', previewSong.title)}</div>
                                            </button>
                                            <button onClick={() => { handleAddSongWrapper(previewSong); setShowAddOptions(false); setPreviewSong(null); }} className="w-full py-4 px-4 bg-surface-highlight border border-border text-white font-semibold rounded-xl hover:bg-surface-highlight/80 transition-colors text-left">
                                                <div className="text-xs opacity-70 mb-1">Всю пісню:</div>
                                                <div className="truncate">{previewSong.parts.length} партій</div>
                                            </button>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={!!songToAdd}
                onClose={() => setSongToAdd(null)}
                onConfirm={confirmAddSong}
                title="Додати пісню?"
                message={`Ви дійсно хочете додати "${songToAdd?.title}" до репертуару вашого хору?`}
                confirmLabel="Додати"
                cancelLabel="Скасувати"
            />

            {showSubmitModal && (
                <SubmitSongModal
                    onClose={() => setShowSubmitModal(false)}
                    onSuccess={() => {
                        // Clear cache so new songs appear on next visit
                        localStorage.removeItem('global_songs_cache');
                        localStorage.removeItem('global_songs_cache_time');
                        setAlertModal({
                            isOpen: true,
                            title: 'Успішно!',
                            message: 'Заявка надіслана! Дякуємо за внесок.',
                            variant: 'success'
                        });
                    }}
                />
            )}

            {/* Moderation Modals */}
            <ConfirmModal
                isOpen={approveModal.isOpen}
                onClose={() => setApproveModal({ ...approveModal, isOpen: false })}
                onConfirm={handleApproveConfirm}
                title="Схвалити пісню?"
                message={`Ви дійсно хочете схвалити пісню "${approveModal.song?.title}"? Вона стане доступною для всіх.`}
                confirmText="Схвалити"
                variant="success"
                loading={approveModal.loading}
            />

            <InputModal
                isOpen={rejectModal.isOpen}
                onClose={() => setRejectModal({ ...rejectModal, isOpen: false })}
                onSubmit={handleRejectConfirm}
                title="Відхилити пісню"
                message={`Вкажіть причину відхилення для пісні "${rejectModal.song?.title}":`}
                placeholder="Наприклад: Неякісний PDF, дублікат..."
                submitText="Відхилити"
                cancelText="Скасувати"
                required
                loading={rejectModal.loading}
            />

            <AlertModal
                isOpen={alertModal.isOpen}
                onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
                title={alertModal.title}
                message={alertModal.message}
                variant={alertModal.variant}
            />

            {toastMessage && (
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] bg-zinc-900/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 max-w-[90vw]"
                >
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-5 h-5 text-green-400" />
                    </div>
                    <span className="font-medium text-sm leading-snug">{toastMessage}</span>
                </motion.div>
            )}
            {/* Floating Add Button */}
            {canSubmit && !isModerationMode && (
                <button
                    onClick={() => setShowSubmitModal(true)}
                    className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-background rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
                    title="Запропонувати пісню"
                >
                    <Plus className="w-7 h-7" />
                </button>
            )}
        </div>
    );
}
// Timestamp: 1770139122
