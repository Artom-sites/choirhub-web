"use client";
// Updated to force recompile and fix stale cache

import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from '@capacitor/status-bar';
import { collection, getDocs, query, orderBy, limit, startAfter, startAt, endAt, QueryDocumentSnapshot, where } from "firebase/firestore";
import { getFirestoreLazy } from "@/lib/firebase";
import { GlobalSong, SongPart } from "@/types";
import { extractInstrument } from "@/lib/utils";
import { OFFICIAL_THEMES } from "@/lib/themes";
import { Search, Music, Users, User, Loader2, FolderOpen, Plus, Eye, FileText, ChevronDown, ChevronRight, Filter, X, LayoutGrid, Music2, Mic2, Sparkles, ShieldAlert, Check, Library, RefreshCw, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PDFViewer from "./PDFViewer";
import { PencilKitAnnotator } from "@/plugins/PencilKitAnnotator";
import { useTranslation } from "@/contexts/TranslationContext";
import ConfirmationModal from "./ConfirmationModal";
import Preloader from "./Preloader";
import Fuse from "fuse.js";
import { useAuth } from "@/contexts/AuthContext";
import SubmitSongModal from "./SubmitSongModal";
import { getPendingSongs, approveSong, rejectSong, getGlobalSong } from "@/lib/db";
import { PendingSong } from "@/types";
import { ConfirmModal, AlertModal, InputModal } from "./ui/Modal";
import { hapticLight, hapticSuccess } from "../hooks/useHaptics";
import GlassPageHeader from "./GlassPageHeader";

interface GlobalArchiveProps {
    onAddSong?: (song: GlobalSong) => void;
    isOverlayOpen?: boolean;
    initialSearchQuery?: string;
    showSearchOverlay?: boolean;
    setShowSearchOverlay?: (show: boolean) => void;
    externalSearchQuery?: string;
    externalCategory?: string;
    externalSubCategory?: string | null;
    externalLanguage?: 'all' | 'ukr' | 'rus' | 'eng' | 'ger' | 'rom';
}

export const CATEGORIES = [
    { id: "new", label: "Новинки 🔥", icon: Sparkles },
    { id: "all", label: "Всі", icon: LayoutGrid },
    { id: "choir", label: "Хор", icon: Users },
    { id: "orchestra", label: "Оркестр", icon: Music2 },
    { id: "ensemble", label: "Ансамбль", icon: Mic2 },
];

export const SUBCATEGORIES: Record<string, { id: string; label: string }[]> = {
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

const getSubcategoryLabel = (category: string | undefined, subcategoryId: string | undefined, t: any): string | null => {
    if (!subcategoryId || !category) return null;
    const subs = SUBCATEGORIES[category];
    if (!subs) return subcategoryId;
    const found = subs.find(s => s.id === subcategoryId);
    return found ? t(`global.subcategories.${subcategoryId}`, { defaultValue: found.label }) : subcategoryId;
};

const PAGE_SIZE = 2000;

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

export default function GlobalArchive({ onAddSong, isOverlayOpen, initialSearchQuery = "", showSearchOverlay, setShowSearchOverlay, externalSearchQuery, externalCategory, externalSubCategory, externalLanguage }: GlobalArchiveProps) {
    const { user, userData } = useAuth();
    const { t } = useTranslation();
    const [songs, setSongs] = useState<GlobalSong[]>([]);
    const [filteredSongs, setFilteredSongs] = useState<GlobalSong[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(externalSearchQuery !== undefined ? externalSearchQuery : initialSearchQuery);
    const [selectedCategory, setSelectedCategory] = useState(externalCategory || "all");
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(externalSubCategory || null);
    const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState<'all' | 'ukr' | 'rus' | 'eng' | 'ger' | 'rom'>(externalLanguage || 'all');
    const [availableThemes, setAvailableThemes] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewSong, setPreviewSong] = useState<GlobalSong | null>(null);
    const [previewPartIndex, setPreviewPartIndex] = useState(0);
    const [fuseInstance, setFuseInstance] = useState<Fuse<GlobalSong> | null>(null);

    // Sync external props to internal state
    useEffect(() => { if (externalSearchQuery !== undefined) setSearchQuery(externalSearchQuery); }, [externalSearchQuery]);
    useEffect(() => { if (externalCategory !== undefined) setSelectedCategory(externalCategory); }, [externalCategory]);
    useEffect(() => { if (externalSubCategory !== undefined) setSelectedSubCategory(externalSubCategory); }, [externalSubCategory]);
    useEffect(() => { if (externalLanguage !== undefined) setSelectedLanguage(externalLanguage); }, [externalLanguage]);

    // Pagination State
    const [hasMore, setHasMore] = useState(true);
    const [isSearchingServer, setIsSearchingServer] = useState(false);
    const observer = useRef<IntersectionObserver | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [showFilters, setShowFilters] = useState(false);
    const [showExtendedFilters, setShowExtendedFilters] = useState(false);
    const [isNative, setIsNative] = useState(false);
    const [showAddOptions, setShowAddOptions] = useState(false);
    const [songToAdd, setSongToAdd] = useState<GlobalSong | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        setIsNative(Capacitor.isNativePlatform());
    }, []);

    // Listen to main nav double tap to scroll to top
    useEffect(() => {
        const handleNavDoubleTap = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.tab === 'songs' && scrollContainerRef.current) {
                // If Archive is active and we tap Songs, scroll to top
                scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
        window.addEventListener('nav-tab-double-click', handleNavDoubleTap);
        return () => window.removeEventListener('nav-tab-double-click', handleNavDoubleTap);
    }, []);

    // ============================================
    // ADVANCED LANGUAGE DETECTION PIPELINE
    // ============================================

    const EXACT_TITLE_MAP: Record<string, 'ukr' | 'rus'> = {
        "слава богу": "rus",
        "христос воскрес": "rus",
        "о, благодать": "rus",
        "слава в вышних богу": "rus",
        "слава в вишніх богу": "ukr",
        "алилуя": "ukr",
        "аллилуйя": "rus",
        "осана": "ukr",
        "осанна": "rus",
    };

    const UKR_STRONG_STEMS = ["прийш", "житт", "серце", "пісн", "святий", "гріх", "віра", "наді", "спасін"];
    const RUS_STRONG_STEMS = ["пришл", "жизн", "сердце", "песн", "святой", "грех", "вера", "надеж", "спасен", "спасение"];

    const UKR_WORDS = ["хай", "нехай", "щоб", "боже", "христа", "як", "так", "його", "мого", "твого", "свого"];
    const RUS_WORDS = ["ибо", "пусть", "чтоб", "боже", "христа", "как", "так", "его", "моего", "твоего", "своего"];

    const UKR_SUFFIXES = ["ість", "ення", "ання", "іння", "ття", "ого"];
    const RUS_SUFFIXES = ["ость", "ение", "ание", "ого", "ему"];

    function detectTitleLanguage(rawTitle: string, debug = false): 'ukr' | 'rus' | 'eng' | 'ger' | 'rom' | 'other' {
        const title = rawTitle.toLowerCase().trim();
        const cleanTitle = title.replace(/[^\wа-яіїєґăâîșțäöüß]/gi, ' ');
        const words = cleanTitle.split(/\s+/).filter(w => w.length > 0);

        const logDebug = (detected: string, ukrScore: number | string, rusScore: number | string, reason: string) => {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[Lang] "${rawTitle}" -> ${detected} -> UKR:${ukrScore} RUS:${rusScore} -> ${reason}`);
            }
        };

        // 1. Exact override dictionary
        if (EXACT_TITLE_MAP[title]) {
            logDebug(EXACT_TITLE_MAP[title], '-', '-', 'Exact map');
            return EXACT_TITLE_MAP[title];
        }

        // 2. Strong unique letters (highest priority)
        const hasRom = /[ăâîșț]/.test(title);
        if (hasRom) return 'rom';

        const hasGer = /[äöüß]/.test(title);
        if (hasGer) return 'ger';

        const hasUkr = /[іїєґ]/.test(title);
        if (hasUkr) {
            logDebug('ukr', '-', '-', 'Unique letters');
            return 'ukr';
        }

        const hasRus = /[ыэъё]/.test(title);
        if (hasRus) {
            logDebug('rus', '-', '-', 'Unique letters');
            return 'rus';
        }

        const isEng = /^[a-z]+$/.test(cleanTitle.replace(/\s+/g, ''));
        if (isEng) return 'eng';

        // Must be neutral Cyrillic now
        const hasCyrillic = /[а-я]/i.test(cleanTitle);
        if (!hasCyrillic) return 'other';

        // 3. Strong Stems (Trumps generic scoring)
        for (const word of words) {
            for (const stem of UKR_STRONG_STEMS) {
                if (word.startsWith(stem)) {
                    logDebug('ukr', '-', '-', `Strong stem: ${stem}`);
                    return 'ukr';
                }
            }
            for (const stem of RUS_STRONG_STEMS) {
                if (word.startsWith(stem)) {
                    logDebug('rus', '-', '-', `Strong stem: ${stem}`);
                    return 'rus';
                }
            }
        }

        // 4 & 5. Keyword and Suffix scoring
        let ukrScore = 0;
        let rusScore = 0;
        let matchReasons: string[] = [];

        for (const word of words) {
            // Exact words
            if (UKR_WORDS.includes(word)) { ukrScore += 2; matchReasons.push(`Word UKR:${word}`); }
            if (RUS_WORDS.includes(word)) { rusScore += 2; matchReasons.push(`Word RUS:${word}`); }

            // Suffixes
            for (const suffix of UKR_SUFFIXES) {
                if (word.endsWith(suffix) && word.length > suffix.length + 1) { ukrScore += 1; matchReasons.push(`Suffix UKR:-${suffix}`); }
            }
            for (const suffix of RUS_SUFFIXES) {
                if (word.endsWith(suffix) && word.length > suffix.length + 1) { rusScore += 1; matchReasons.push(`Suffix RUS:-${suffix}`); }
            }
        }

        // 6. Final decision
        if (ukrScore > rusScore) {
            logDebug('ukr', ukrScore, rusScore, matchReasons.join(', ') || 'Scoring win');
            return 'ukr';
        }
        if (rusScore > ukrScore) {
            logDebug('rus', ukrScore, rusScore, matchReasons.join(', ') || 'Scoring win');
            return 'rus';
        }

        // Domain-specific fallback for MSC archive
        logDebug('rus', ukrScore, rusScore, 'Fallback');
        return 'rus';
    }

    // Check if user is Admin/Moderator (Exclusive to artemdula0@gmail.com)
    const isModerator = userData?.email === "artemdula0@gmail.com";
    // Allow Regents and Heads to submit
    const canSubmit = userData?.role === 'head' || userData?.role === 'regent';

    // Submission & Moderation
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [pendingSongs, setPendingSongs] = useState<PendingSong[]>([]);
    const [isModerationMode, setIsModerationMode] = useState(false);
    const [moderationLoading, setModerationLoading] = useState(false);

    // Native FAB tap → open submit modal when on archive tab
    useEffect(() => {
        const handler = () => {
            if (canSubmit && !isModerationMode) {
                setShowSubmitModal(true);
            }
        };
        window.addEventListener('nativeFABPressed:archive', handler);
        return () => window.removeEventListener('nativeFABPressed:archive', handler);
    }, [canSubmit, isModerationMode]);

    // Force native overlay re-check when SubmitSongModal closes
    useEffect(() => {
        if (!showSubmitModal) {
            // Small delay to let React finish DOM updates
            const t = setTimeout(() => {
                window.dispatchEvent(new CustomEvent('forceCheckOverlays'));
            }, 100);
            return () => clearTimeout(t);
        }
    }, [showSubmitModal]);

    // Custom Modal State
    const [approveModal, setApproveModal] = useState<{ isOpen: boolean; song: PendingSong | null; loading: boolean }>({ isOpen: false, song: null, loading: false });
    const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; song: PendingSong | null; loading: boolean }>({ isOpen: false, song: null, loading: false });
    const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' }>({ isOpen: false, title: '', message: '', variant: 'info' });
    const [rebuildIndexModal, setRebuildIndexModal] = useState<{ isOpen: boolean; loading: boolean }>({ isOpen: false, loading: false });

    // Status Bar control for PDF preview (white background needs dark icons)
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const setStatusBarStyle = async () => {
            try {
                if (previewSong) {
                    // PDF preview has white background - need dark icons
                    await StatusBar.setStyle({ style: Style.Light });
                    await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
                } else {
                    // Restore to theme-based style
                    const theme = document.documentElement.getAttribute('data-theme');
                    if (theme === 'dark') {
                        await StatusBar.setStyle({ style: Style.Dark });
                        await StatusBar.setBackgroundColor({ color: '#09090b' });
                    } else {
                        await StatusBar.setStyle({ style: Style.Light });
                        await StatusBar.setBackgroundColor({ color: '#F1F5F9' });
                    }
                }
            } catch (e) {
                console.error('[StatusBar] Error:', e);
            }
        };

        setStatusBarStyle();
    }, [previewSong]);

    // (isModerator and canSubmit declared above, before the FAB useEffect)

    // Total songs count for display
    const [totalSongsCount, setTotalSongsCount] = useState<number>(0);

    const CACHE_KEY = 'globalArchiveSongsCache';
    const CACHE_TIMESTAMP_KEY = 'globalArchiveCacheTime';
    const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

    // Load from localStorage cache (for offline)
    const loadFromCache = (): GlobalSong[] | null => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            const cacheTime = localStorage.getItem(CACHE_TIMESTAMP_KEY);
            if (cached && cacheTime) {
                const age = Date.now() - parseInt(cacheTime);
                if (age < CACHE_MAX_AGE) {
                    return JSON.parse(cached);
                }
            }
        } catch (e) { /* silent */ }
        return null;
    };

    // Save to localStorage cache
    const saveToCache = (data: GlobalSong[]) => {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        } catch (e) { /* silent */ }
    };

    // Setup Fuse search
    const setupFuse = (data: GlobalSong[]) => {
        const options = {
            keys: [
                { name: "title", weight: 0.5 },
                { name: "keywords", weight: 0.2 },
                { name: "category", weight: 0.1 },
                { name: "theme", weight: 0.1 }
            ],
            threshold: 0.3,
            distance: 100,
            ignoreLocation: true,
            minMatchCharLength: 2
        };
        setFuseInstance(new Fuse(data, options));
    };

    // Process songs: deduplicate and sort
    const processSongs = (data: GlobalSong[]): GlobalSong[] => {
        const uniqueSongs = Array.from(new Map(data.map(s => [s.id, s])).values());
        return uniqueSongs.sort((a, b) => {
            const aCyr = isCyrillic(a.title);
            const bCyr = isCyrillic(b.title);
            if (aCyr && !bCyr) return -1;
            if (!aCyr && bCyr) return 1;
            return normalizeForSort(a.title).localeCompare(normalizeForSort(b.title), 'uk');
        });
    };

    // Load ALL data from R2 Static Index (Zero Firestore Reads!)
    const loadFromR2 = async (): Promise<GlobalSong[] | null> => {
        try {
            const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
            if (!publicUrl) return null;
            const indexUrl = `${publicUrl}/global_songs_index.json`;
            const res = await fetch(indexUrl + '?t=' + Date.now());
            if (!res.ok) throw new Error("Index not found");
            const text = await res.text();
            if (!text || !text.trim().startsWith('[')) throw new Error("Invalid index format");
            const data: GlobalSong[] = JSON.parse(text);

            const sortedSongs = processSongs(data);
            setSongs(sortedSongs);
            setTotalSongsCount(sortedSongs.length);
            setHasMore(false);
            setupFuse(sortedSongs);
            saveToCache(sortedSongs);
            console.log(`✅ Loaded ${sortedSongs.length} songs from R2 (0 Firestore reads)`);
            return sortedSongs;
        } catch (e) {
            console.warn("Failed to load from R2:", e);
            return null;
        }
    };

    // Fallback: Load from Firestore (only if R2 and cache fail)
    const loadFromFirestore = async () => {
        try {
            console.log("⚠️ Fallback: Fetching ALL docs from Firestore...");
            // Fetch ALL songs to ensure correct sorting (Cyrillic first) and complete list
            // This is more expensive but required for parity with Web/R2 version
            const q = query(collection(getFirestoreLazy(), "global_songs"));

            const snapshot = await getDocs(q);
            console.log(`⚠️ Fallback: Fetched ${snapshot.docs.length} docs from Firestore`);

            const newSongs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalSong));
            const sortedSongs = processSongs(newSongs);

            setSongs(sortedSongs);
            setTotalSongsCount(sortedSongs.length);
            setupFuse(sortedSongs);
            setHasMore(false); // We loaded everything

            // Cache distinct fallback result too
            saveToCache(sortedSongs);

        } catch (error) {
            console.error("Error fetching from Firestore:", error);
        }
    };

    // Effect: Initial Load - Cache -> R2 -> Firestore
    const processedRef = useRef(false);

    useEffect(() => {
        const init = async () => {
            if (processedRef.current) return;
            processedRef.current = true;

            setLoading(true);

            // 1. Try cache first (instant offline support)
            const cached = loadFromCache();
            if (cached && cached.length > 0) {
                const sortedCached = processSongs(cached);
                setSongs(sortedCached);
                setTotalSongsCount(sortedCached.length);
                setupFuse(sortedCached);
                setHasMore(false);
                setLoading(false);
                console.log(`📦 Loaded ${sortedCached.length} songs from cache`);

                // Refresh from R2 in background
                loadFromR2().then((r2Data) => {
                    if (r2Data) {
                        loadDelta(r2Data);
                    }
                }).catch(console.error);
                return;
            }

            // 2. Try R2
            const r2Data = await loadFromR2();
            if (r2Data) {
                await loadDelta(r2Data);
            } else {
                // 3. Fallback to Firestore
                await loadFromFirestore();
            }
            setLoading(false);
        };

        init();
    }, []);

    // 4. Delta Sync (Fetch only new updates from Firestore)
    const loadDelta = async (baseSongs: GlobalSong[]) => {
        if (baseSongs.length === 0) return;

        try {
            // Find max updated time
            let maxTime = 0;
            if (baseSongs.length > 0) {
                console.log("🔍 Sample updatedAt:", baseSongs[0].updatedAt, "Type:", typeof baseSongs[0].updatedAt);
            }
            baseSongs.forEach(s => {
                const t = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
                if (t > maxTime) maxTime = t;
            });

            if (maxTime === 0) {
                console.warn("⚠️ Delta Sync Skipped: No valid updatedAt found in base songs.");
                return;
            }

            const lastUpdate = new Date(maxTime);
            console.log(`🔄 Delta Sync: Checking for updates since ${lastUpdate.toISOString()}...`);

            const q = query(
                collection(getFirestoreLazy(), "global_songs"),
                where("updatedAt", ">", lastUpdate)
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                console.log("✅ Delta Sync: No new updates found.");
            } else {
                console.log(`🚀 Found ${snapshot.size} new updates! Merging...`);
                const newSongs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalSong));

                // Merge
                const currentMap = new Map(baseSongs.map(s => [s.id, s]));
                newSongs.forEach(s => currentMap.set(s.id, s));

                const merged = Array.from(currentMap.values());
                const sorted = processSongs(merged);

                setSongs(sorted);
                setTotalSongsCount(sorted.length);
                setupFuse(sorted);
                saveToCache(sorted);
            }
        } catch (e) {
            console.error("Delta sync failed", e);
        }
    };

    // Effect: Debounced Search - purely local with Fuse.js
    useEffect(() => {
        // Search is handled in the main filtering effect below
        // This effect is no longer needed for server search since we load all from R2
    }, [searchQuery, fuseInstance]);

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
            // Filter songs created in the last 30 days
            const thirtyDaysAgo = Date.now() / 1000 - (30 * 24 * 60 * 60);
            results = results.filter(s => {
                const createdAt = (s.createdAt as any)?.seconds || 0;
                return createdAt >= thirtyDaysAgo;
            });
            // Sort by createdAt desc (newest first)
            results = [...results].sort((a, b) => {
                const tA = (a.createdAt as any)?.seconds || 0;
                const tB = (b.createdAt as any)?.seconds || 0;
                return tB - tA;
            });
        } else if (selectedCategory !== 'all') {
            // Pagination handles initial load, but local filters still apply to LOADED songs
            // Ideally we should query by category on server, but for now we filter locally
            results = results.filter(s => s.category === selectedCategory);
            // Default alphabetic sort is already applied
        }

        if (selectedSubCategory) {
            results = results.filter(s => s.subcategory === selectedSubCategory);
        }

        if (selectedLanguage !== 'all') {
            results = results.filter(s => {
                return detectTitleLanguage(s.title) === selectedLanguage;
            });
        }

        if (selectedTheme) {
            results = results.filter(s => s.theme === selectedTheme);
        }

        if (searchQuery.trim() && fuseInstance) {
            const query = searchQuery.trim().toLowerCase();
            // Fuse search on STATIC INDEX (all songs)
            const fuseResults = fuseInstance.search(searchQuery, { limit: 200 }).map(r => r.item);

            // Tier 1: Title starts with the search term
            const startsWithMatches = songs
                .filter(s => s.title.toLowerCase().startsWith(query))
                .sort((a, b) => a.title.localeCompare(b.title, 'uk'));
            const startsWithIds = new Set(startsWithMatches.map(s => s.id));

            // Tier 2: Title contains the search term (but doesn't start with it)
            const containsMatches = songs
                .filter(s => !startsWithIds.has(s.id) && s.title.toLowerCase().includes(query))
                .sort((a, b) => a.title.localeCompare(b.title, 'uk'));
            const containsIds = new Set(containsMatches.map(s => s.id));

            // Tier 3: Other fuzzy matches from Fuse.js
            const fuzzyMatches = fuseResults.filter(s => !startsWithIds.has(s.id) && !containsIds.has(s.id));

            results = [...startsWithMatches, ...containsMatches, ...fuzzyMatches];

            // Apply other filters to these search results
            if (selectedCategory === 'new') {
                // Sort by date? Static index might not have dates. 
                // Just return results as is.
            } else if (selectedCategory !== 'all') {
                results = results.filter(s => s.category === selectedCategory);
            }
            if (selectedSubCategory) results = results.filter(s => s.subcategory === selectedSubCategory);
            if (selectedTheme) results = results.filter(s => s.theme === selectedTheme);
            // Language
            if (selectedLanguage !== 'all') {
                results = results.filter(s => {
                    return detectTitleLanguage(s.title) === selectedLanguage;
                });
            }

            // Bypass the normal "results = songs" logic at start of effect
            // because "songs" only has the loaded page.
            setFilteredSongs(results);
            return; // EXIT EARLY
        }

        // Sort: Cyrillic first, then Latin, alphabetically within each group
        if (selectedCategory !== 'new') {
            results = [...results].sort((a, b) => {
                const aCyr = isCyrillic(a.title);
                const bCyr = isCyrillic(b.title);
                if (aCyr && !bCyr) return -1;
                if (!aCyr && bCyr) return 1;
                return normalizeForSort(a.title).localeCompare(normalizeForSort(b.title), 'uk');
            });
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

    useEffect(() => {
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;

        const listener = PencilKitAnnotator.addListener('onArchiveAdd', async (info: { songId: string; partIndex?: number }) => {
            const songToFind = filteredSongs.find(s => s.id === info.songId || s.sourceId === info.songId);
            if (songToFind && onAddSong) {
                hapticLight();

                let finalSong = songToFind;
                if ((!songToFind.parts || songToFind.parts.length === 0) && songToFind.id) {
                    try {
                        const full = await getGlobalSong(songToFind.id);
                        if (full) finalSong = full;
                    } catch (e) {
                        console.error("Failed to fetch full song details", e);
                    }
                }

                if (info.partIndex !== undefined && finalSong.parts && finalSong.parts.length > info.partIndex) {
                    const singlePartSong: GlobalSong = {
                        ...finalSong,
                        parts: [finalSong.parts[info.partIndex]],
                    };
                    onAddSong(singlePartSong);
                } else {
                    onAddSong(finalSong);
                }

                hapticSuccess();
            }
        });

        return () => {
            listener.then(l => l.remove());
        };
    }, [filteredSongs]);

    const handlePreviewClick = async (song: GlobalSong) => {
        let finalSong = song;

        if (song.id && (
            (!song.parts && song.partsCount && song.partsCount > 0) ||
            (song.parts && song.parts.length < (song.partsCount || 0))
        )) {
            setIsPreviewLoading(true);
            try {
                const full = await getGlobalSong(song.id);
                if (full) {
                    finalSong = full;
                }
            } catch (e) {
                console.error("Failed to fetch full song for preview", e);
            } finally {
                setIsPreviewLoading(false);
            }
        }

        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' && (finalSong.pdfUrl || (finalSong.parts && finalSong.parts.length > 0))) {
            const partsData = (finalSong.parts && finalSong.parts.length > 0)
                ? finalSong.parts.map(p => ({ name: p.name || 'Part', pdfUrl: p.pdfUrl }))
                : [{ name: 'Головна', pdfUrl: finalSong.pdfUrl || '' }];

            PencilKitAnnotator.openNativePdfViewer({
                parts: partsData,
                initialPartIndex: 0,
                songId: finalSong.id || finalSong.sourceId || 'archive-song',
                userUid: user?.uid || 'anonymous',
                title: finalSong.title,
                isArchive: !!onAddSong
            }).catch(e => console.error('[NativePdf] Error:', e));
        } else {
            setPreviewSong(finalSong);
            setPreviewPartIndex(0);
        }
    };

    const handleAddSongWrapper = (song: GlobalSong) => {
        if (onAddSong) {
            hapticLight();
            setSongToAdd(song);
        }
    };

    const confirmAddSong = async () => {
        if (songToAdd && onAddSong) {
            let finalSong = songToAdd;
            // Fetch full details if adding from index (where parts might be missing)
            if ((!songToAdd.parts || songToAdd.parts.length === 0) && songToAdd.id) {
                try {
                    const full = await getGlobalSong(songToAdd.id);
                    if (full) finalSong = full;
                } catch (e) {
                    console.error("Failed to fetch full song details", e);
                }
            }

            onAddSong(finalSong);
            setToastMessage(`"${finalSong.title}" додано до репертуару`);
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
            const newGlobalId = await approveSong(approveModal.song, user!.uid);
            
            // Construct the resolved global song locally
            const approvedSong: GlobalSong = {
                ...approveModal.song,
                id: newGlobalId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                sortTitle: approveModal.song.title.toUpperCase(),
            } as GlobalSong;

            // 1. Optimistic UI update: Deduplicate, sort, cache, and update search index
            setSongs(prev => {
                const newSongsList = processSongs([...prev, approvedSong]);
                saveToCache(newSongsList);
                setupFuse(newSongsList);
                setTotalSongsCount(newSongsList.length);
                return newSongsList;
            });

            // 2. Clear pending state
            setPendingSongs(prev => prev.filter(s => s.id !== approveModal.song!.id));
            setApproveModal({ isOpen: false, song: null, loading: false });

            // 3. Trigger Background R2 Index Update
            try {
                fetch('/api/search-index', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'add', song: approvedSong })
                }).catch(() => console.warn('Background search-index rebuild failed silently')); 
                // Don't await, let it run in background so UI isn't blocked
            } catch (ignore) { }

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
        <div className="flex flex-col h-full mt-4">
            {/* Stats Header Card - Matching Repertoire Style */}
            <div className="bg-surface/50 backdrop-blur-xl border border-border rounded-2xl p-5 mb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black/5 dark:bg-white/10 rounded-full flex items-center justify-center text-text-primary">
                            <Library className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold">{t('archive.header')}</p>
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-bold text-text-primary tracking-tight">
                                    {searchQuery || activeFiltersCount > 0
                                    ? `${filteredSongs.length}`
                                    : t('services.item.songsCount', { count: totalSongsCount })}
                                </p>
                                {loading && (
                                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isModerator && (
                            <button
                                onClick={() => {
                                    setIsModerationMode(!isModerationMode);
                                    if (!isModerationMode) setSelectedCategory('all');
                                }}
                                className={`p-2 rounded-full transition-colors ${isModerationMode ? 'bg-orange-500 text-white' : 'hover:bg-surface-highlight text-text-secondary hover:text-text-primary'}`}
                                title="Модерація"
                            >
                                <ShieldAlert className="w-5 h-5" />
                            </button>
                        )}
                        {isModerator && (
                            <button
                                onClick={() => setRebuildIndexModal({ isOpen: true, loading: false })}
                                className="p-2 rounded-full hover:bg-surface-highlight text-text-secondary hover:text-text-primary transition-colors"
                                title="Оновити індекс пошуку (Rebuild)"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {!isModerationMode ? (
                <>
                    {/* Native Search Overlay */}
                    <AnimatePresence>
                        {showSearchOverlay && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="fixed inset-0 z-[65] bg-background flex flex-col"
                                data-native-inner="true"
                            >
                                <GlassPageHeader
                                    isActive={true}
                                    onBack={() => {
                                        setShowSearchOverlay?.(false);
                                        setSearchQuery("");
                                        setSelectedCategory("all");
                                        setSelectedLanguage("all");
                                        setSelectedSubCategory(null);
                                        setSelectedTheme(null);
                                    }}
                                    searchInput={{
                                        placeholder: t('search.archive_placeholder'),
                                        value: searchQuery,
                                        onChange: setSearchQuery,
                                        autoFocus: true
                                    }}
                                    filterMenu={[
                                        {
                                            items: CATEGORIES.map(cat => ({
                                                id: `cat:${cat.id}`,
                                                label: t(`global.categories.${cat.id}` as any),
                                                isActive: selectedCategory === cat.id,
                                                children: SUBCATEGORIES[cat.id]?.map(sub => ({
                                                    id: `sub:${sub.id}`,
                                                    label: t(`global.subcategories.${sub.id}` as any, { defaultValue: sub.label }),
                                                    isActive: selectedSubCategory === sub.id,
                                                }))
                                            }))
                                        },
                                        {
                                            items: [
                                                { id: 'lang:all', label: t('global.categories.all'), isActive: selectedLanguage === 'all' },
                                                { id: 'lang:ukr', label: `🇺🇦 ${t('global.lang_ukr')}`, isActive: selectedLanguage === 'ukr' },
                                                { id: 'lang:rus', label: `🇷🇺 ${t('global.lang_rus')}`, isActive: selectedLanguage === 'rus' },
                                                { id: 'lang:eng', label: `🌍 ${t('global.lang_eng')}`, isActive: selectedLanguage === 'eng' },
                                            ]
                                        },
                                        {
                                            items: [
                                                { id: 'theme:all', label: t('global.categories.all'), isActive: !selectedTheme },
                                                ...OFFICIAL_THEMES.filter(thm => thm !== "Інші").sort((a,b) => a.localeCompare(b)).map(theme => ({
                                                    id: `theme:${theme}`,
                                                    label: t(`global.themes.${theme.replace(/ /g, '_').replace(/[''\u2019\u02BC]/g, '')}` as any, { defaultValue: theme }),
                                                    isActive: selectedTheme === theme,
                                                })),
                                                { id: `theme:Інші`, label: t(`global.themes.Інші` as any, { defaultValue: 'Інші' }), isActive: selectedTheme === 'Інші' }
                                            ]
                                        }
                                    ]}
                                    onFilterMenuSelect={(itemId) => {
                                        if (itemId.startsWith('cat:')) {
                                            const catId = itemId.slice(4);
                                            setSelectedCategory(catId);
                                            setSelectedSubCategory(null);
                                        } else if (itemId.startsWith('sub:')) {
                                            const subId = itemId.slice(4);
                                            setSelectedSubCategory(selectedSubCategory === subId ? null : subId);
                                        } else if (itemId.startsWith('lang:')) {
                                            const lang = itemId.slice(5) as 'ukr' | 'rus' | 'eng';
                                            setSelectedLanguage(selectedLanguage === lang ? 'all' : lang);
                                        } else if (itemId.startsWith('theme:')) {
                                            const themeId = itemId.slice(6);
                                            setSelectedTheme(themeId === 'all' ? null : themeId === selectedTheme ? null : themeId);
                                        }
                                    }}
                                />

                                {/* Results Area (Flexible height) */}
                                <div className="flex-1 overflow-y-auto">
                                    <div className="px-4 pb-8">
                                        {filteredSongs.length === 0 ? (
                                            <div className="text-center py-24 opacity-40">
                                                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Library className="w-8 h-8 text-text-secondary" />
                                                </div>
                                                <p className="text-text-secondary">{t('search.not_found')}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-0 mt-2">
                                                <p className="text-xs text-text-secondary my-2">{t('services.item.songsCount', { count: filteredSongs.length })}</p>
                                                {filteredSongs.slice(0, 50).map(song => (
                                                    <div
                                                        key={`search-${song.id}`}
                                                        onClick={() => {
                                                            setShowSearchOverlay?.(false);
                                                            setPreviewSong(song);
                                                            setPreviewPartIndex(0);
                                                        }}
                                                        className="flex items-center gap-3 py-3 border-b border-border/30 cursor-pointer active:bg-surface-highlight/50 transition-colors"
                                                    >
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-text-primary/10">
                                                            <Music className="w-5 h-5 text-text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-semibold text-text-primary truncate">{song.title}</h3>
                                                            <p className="text-xs text-text-secondary truncate mt-0.5">
                                                                {song.composer && <span className="text-xs font-medium text-primary mr-1"><User className="inline-block w-3 h-3 mr-0.5" />{song.composer}</span>}
                                                                {song.language?.toUpperCase() || ''} • {song.category} {getSubcategoryLabel(song.category, song.subcategory, t) ? `(${getSubcategoryLabel(song.category, song.subcategory, t)})` : ''}
                                                            </p>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-text-secondary/40 flex-shrink-0" />
                                                    </div>
                                                ))}
                                                {filteredSongs.length > 50 && (
                                                    <p className="text-center text-xs text-text-secondary py-4 tracking-wider uppercase">{t('songs.shown_first_50')}</p>
                                                )}
                                            </div>
                                        )}
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

            {/* List */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
                {loading || moderationLoading ? (
                    <Preloader inline />
                ) : isModerationMode ? (
                    pendingSongs.length === 0 ? (
                        <div className="text-center py-12 text-text-secondary">
                            <p>{t('archive.no_requests')}</p>
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
                                        <button onClick={() => handleRejectClick(song)} className="flex-1 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium">{t('archive.reject')}</button>
                                        <button onClick={() => handleApproveClick(song)} className="flex-1 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-medium">{t('archive.approve')}</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : filteredSongs.length === 0 ? (
                    <div className="text-center py-12 text-text-secondary">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{t('songs.not_found')}</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop: Table View */}
                        <table className="w-full hidden md:table table-fixed">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-3 pl-0 pr-4 text-xs font-bold text-text-secondary uppercase tracking-wider">{t('songs.title_col')}</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-text-secondary uppercase tracking-wider w-[120px]">{t('songs.category_col')}</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-text-secondary uppercase tracking-wider w-[120px]">{t('songs.topic_col')}</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-text-secondary uppercase tracking-wider w-[60px]">{t('songs.parts_col')}</th>
                                    {onAddSong && (
                                        <th className="text-right py-3 px-4 text-xs font-bold text-text-secondary uppercase tracking-wider w-16"></th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleSongs.map((song) => (
                                    <tr
                                        key={song.id || song.sourceId}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handlePreviewClick(song);
                                        }}
                                        className="border-b border-border/50 hover:bg-surface-highlight cursor-pointer transition-colors group"
                                    >
                                        <td className="py-3 pl-0 pr-4 max-w-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-text-primary">
                                                    {(song.pdfUrl || (song.partsCount && song.partsCount > 0) || (song.parts && song.parts.length > 0)) ? (
                                                        <Eye className="w-4 h-4 text-background" />
                                                    ) : (
                                                        <Music className="w-4 h-4 text-background" />
                                                    )}
                                                </div>
                                                <p className="font-semibold text-text-primary truncate">{song.title}</p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm text-text-secondary">
                                                {song.subcategory ? getSubcategoryLabel(song.category, song.subcategory, t) : song.category}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            {song.theme ? (
                                                <span className="text-sm text-text-secondary">
                                                    {t(`global.themes.${song.theme.replace(/ /g, '_').replace(/[''\u2019\u02BC]/g, '')}` as any, { defaultValue: song.theme })}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-text-secondary/50">—</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm text-text-secondary">
                                                {(song.partsCount || song.parts?.length || 0) > 0 ? `${song.partsCount || song.parts?.length}` : '—'}
                                            </span>
                                        </td>
                                        {onAddSong && (
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddSongWrapper(song);
                                                    }}
                                                    className="p-2 rounded-lg text-text-secondary hover:text-primary transition-colors"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Mobile: List View */}
                        <div className="md:hidden">
                            {visibleSongs.map((song) => (
                                <div
                                    key={song.id || song.sourceId}
                                    className="flex items-center gap-3 py-3 border-b border-border/30 cursor-pointer active:bg-surface-highlight transition-colors group"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handlePreviewClick(song);
                                    }}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-text-primary flex items-center justify-center flex-shrink-0">
                                        {(song.pdfUrl || (song.partsCount && song.partsCount > 0) || (song.parts && song.parts.length > 0)) ? (
                                            <Eye className="w-5 h-5 text-background" />
                                        ) : (
                                            <Music className="w-5 h-5 text-background" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-text-primary truncate">{song.title}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {song.subcategory && (
                                                <span className="text-xs text-text-secondary">
                                                    {getSubcategoryLabel(song.category, song.subcategory, t)}
                                                </span>
                                            )}
                                            {song.subcategory && song.theme && <span className="text-xs text-text-secondary">•</span>}
                                            {song.theme && (
                                                <span className="text-xs text-text-secondary">
                                                    {t(`global.themes.${song.theme.replace(/ /g, '_').replace(/[''\u2019\u02BC]/g, '')}` as any, { defaultValue: song.theme })}
                                                </span>
                                            )}
                                            {((song.partsCount && song.partsCount > 1) || (song.parts && song.parts.length > 1)) && (
                                                <>
                                                    <span className="text-xs text-text-secondary">•</span>
                                                    <span className="text-xs text-text-secondary">
                                                        {song.partsCount || song.parts?.length} {t('songs.parts_col', { defaultValue: 'партій', count: song.partsCount || song.parts?.length })}
                                                    </span>
                                                </>

                                            )}
                                        </div>
                                    </div>

                                    {/* Add to repertoire button */}
                                    {onAddSong && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddSongWrapper(song);
                                            }}
                                            className="p-2 rounded-lg text-text-secondary hover:text-primary transition-colors flex-shrink-0"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Infinite Scroll Trigger */}
                        {filteredSongs.length > displayedCount && (
                            <div ref={loaderRef} className="py-8 flex justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals and Overlays */}
            <AnimatePresence>
                {previewSong && (
                    <motion.div
                        key="preview-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-white flex flex-col"
                    >
                        <div className="bg-white border-b border-gray-200 z-40 pt-[env(safe-area-inset-top)]">
                            <div className="flex items-center justify-between px-4 py-3">
                                <button onClick={() => setPreviewSong(null)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                                    <X className="w-5 h-5 text-gray-600" />
                                </button>
                                <h3 className="text-sm font-medium text-gray-900 truncate flex-1 text-center mx-4">
                                    {previewSong.title}
                                    {isPreviewLoading && <Loader2 className="inline w-4 h-4 ml-2 animate-spin" />}
                                </h3>
                                {onAddSong ? (
                                    <button onClick={handleAddClick} className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors">
                                        <Plus className="w-5 h-5 text-gray-700" />
                                    </button>
                                ) : <div className="w-10" />}
                            </div>

                            {((previewSong.partsCount && previewSong.partsCount > 1) || (previewSong.parts && previewSong.parts.length > 1)) && (
                                <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                                    {previewSong.parts ? previewSong.parts.map((part, idx) => {
                                        let label = extractInstrument(part.name || `Партія ${idx + 1}`, previewSong.title);
                                        // If label is "Загальна" or generic, use index to differentiate if multiple parts exist
                                        // Actually simplest way: if multiple parts have same label, append index.
                                        // We can't easily check all labels here inside map without pre-calculation.
                                        // Let's just say if label is "Загальна", show "Партія N".
                                        if (label === "Загальна") label = `Партія ${idx + 1}`;

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setPreviewPartIndex(idx)}
                                                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-medium ${idx === previewPartIndex ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    }) : null}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-hidden">
                            <PDFViewer
                                url={previewSong.parts && previewSong.parts[previewPartIndex]
                                    ? previewSong.parts[previewPartIndex].pdfUrl
                                    : previewSong.pdfUrl || ''}
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
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-lg font-bold text-text-primary">{t('songs.add_to_repertoire')}</h3>
                                            <button
                                                onClick={() => setShowAddOptions(false)}
                                                className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-highlight transition-colors"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <p className="text-text-secondary text-sm mb-5">{t('songs.choose_what_to_add')}</p>
                                        <div className="flex flex-col gap-3">
                                            <button onClick={() => handleAddPart(previewSong, previewPartIndex)} className="w-full py-4 px-4 bg-accent/20 border border-accent text-text-primary font-semibold rounded-xl hover:bg-accent/30 transition-colors text-left">
                                                <div className="text-xs opacity-70 mb-1">{t('songs.only_current_part')}</div>
                                                <div className="truncate text-accent">{extractInstrument(previewSong.parts[previewPartIndex]?.name || 'Поточна партія', previewSong.title)}</div>
                                            </button>
                                            <button onClick={() => { handleAddSongWrapper(previewSong); setShowAddOptions(false); setPreviewSong(null); }} className="w-full py-4 px-4 bg-surface-highlight border border-border text-text-primary font-semibold rounded-xl hover:bg-surface-highlight/80 transition-colors text-left">
                                                <div className="text-xs opacity-70 mb-1">{t('songs.full_song')}</div>
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
                title={t('archive.add_song_title')}
                message={t('archive.add_song_message', { title: songToAdd?.title || '' })}
                confirmLabel={t('global.actions.add')}
            />

            {
                showSubmitModal && (
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
                )
            }

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

            <ConfirmModal
                isOpen={rebuildIndexModal.isOpen}
                onClose={() => setRebuildIndexModal({ isOpen: false, loading: false })}
                onConfirm={async () => {
                    setRebuildIndexModal({ isOpen: true, loading: true });
                    try {
                        setToastMessage("Оновлення індексу...");
                        const res = await fetch('/api/search-index', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'rebuild' })
                        });
                        if (!res.ok) throw new Error("API Error");
                        setToastMessage(Capacitor.isNativePlatform() ? "Індекс оновлено! Перезапустіть додаток." : "Індекс оновлено! Перезавантажте сторінку.");
                        setTimeout(() => setToastMessage(null), 5000);
                        loadFromR2();
                    } catch (e) {
                        setToastMessage("Помилка оновлення індексу");
                        setTimeout(() => setToastMessage(null), 5000);
                    } finally {
                        setRebuildIndexModal({ isOpen: false, loading: false });
                    }
                }}
                title="Оновити пошуковий індекс?"
                message={`Це може зайняти деякий час. Після оновлення потрібно буде ${Capacitor.isNativePlatform() ? 'перезапустити додаток' : 'перезавантажити сторінку'}.`}
                confirmText="Оновити"
                variant="warning"
                loading={rebuildIndexModal.loading}
            />

            {
                toastMessage && (
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
                )
            }
            {
                canSubmit && !isModerationMode && !showSubmitModal && !isOverlayOpen && (
                    <button
                        onClick={() => setShowSubmitModal(true)}
                        className="app-fab fixed w-14 h-14 bg-primary text-background rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 right-4"
                        style={{ bottom: 'var(--fab-bottom)' }}
                        title={t('submit_song.title')}
                    >
                        <Plus className="w-7 h-7" />
                    </button>
                )
            }
        </div >
    );
}
// Timestamp: 1770139122
