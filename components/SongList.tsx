"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Dialog } from '@capacitor/dialog';
import { Search, FileText, Music2, ChevronRight, Filter, Plus, Eye, User, Loader2, Trash2, MoreVertical, Library, X } from "lucide-react";
import { SimpleSong } from "@/types";
import { CATEGORIES, OFFICIAL_THEMES, Category } from "@/lib/themes";
import { AnimatePresence, motion } from "framer-motion";
import { Virtuoso, TableVirtuoso, VirtuosoHandle } from 'react-virtuoso';
import Fuse from 'fuse.js';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { getFirestoreLazy } from "@/lib/firebase";
import { addSong, uploadSongPdf, uploadSongParts, deleteSong, addKnownConductor, updateSong, softDeleteLocalSong, restoreLocalSong } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { useRepertoire } from "@/contexts/RepertoireContext";
import { useTranslation } from "@/contexts/TranslationContext";
import AddSongModal from "./AddSongModal";
import EditSongModal from "./EditSongModal";
import PDFViewer from "./PDFViewer";
import ConfirmationModal from "./ConfirmationModal";
import GlobalArchive, { CATEGORIES as ARCHIVE_CATEGORIES, SUBCATEGORIES as ARCHIVE_SUBCATEGORIES } from "./GlobalArchive";
import TrashBin from "./TrashBin";
import Toast from "./Toast";
import SwipeableCard, { SwipeableCardRef } from "./SwipeableCard";
import GlassPageHeader from "./GlassPageHeader";
import SongSkeleton from "./SongSkeleton";
import { PencilKitAnnotator } from "@/plugins/PencilKitAnnotator";
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
    showSearchOverlay?: boolean;
    setShowSearchOverlay?: (show: boolean) => void;
    isActiveTab?: boolean;
}

export default function SongList({
    canAddSongs,
    choirType,
    regents,
    knownConductors,
    knownCategories,
    knownPianists,
    isOverlayOpen,
    onRefresh,
    showAddModal: propsShowAddModal,
    setShowAddModal: propsSetShowAddModal,
    showSearchOverlay,
    setShowSearchOverlay,
    isActiveTab = true
}: SongListProps) {
    const router = useRouter();
    const { userData } = useAuth();
    const { t } = useTranslation();
    const { songs: rawSongs, loading, refreshRepertoire } = useRepertoire();
    const songs = rawSongs || [];

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
    const cardRefs = useRef<Record<string, SwipeableCardRef | null>>({});

    const cancelDelete = () => {
        if (deletingSongId && cardRefs.current[deletingSongId]) {
            cardRefs.current[deletingSongId]?.reset();
        }
        setDeletingSongId(null);
    };

    const [toast, setToast] = useState<{ message: string; type: "success" | "error"; actionLabel?: string; onAction?: () => void } | null>(null);
    const [isNative, setIsNative] = useState(false);
    const editClickGuardRef = useRef(false);

    useEffect(() => {
        setIsNative(Capacitor.isNativePlatform());
    }, []);

    const effectiveCanAdd = canAddSongs;

    const [subTab, setSubTab] = useState<'repertoire' | 'catalog'>('repertoire');
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [archiveCategory, setArchiveCategory] = useState("all");
    const [archiveSubCategory, setArchiveSubCategory] = useState<string | null>(null);
    const [archiveLanguage, setArchiveLanguage] = useState<'all' | 'ukr' | 'rus' | 'eng'>('all');
    const [archiveTheme, setArchiveTheme] = useState<string | null>(null);

    // Listen to main nav double tap to scroll to top (for Repertoire list)
    useEffect(() => {
        const handleNavDoubleTap = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.tab === 'songs' && subTab === 'repertoire' && virtuosoRef.current) {
                // Scroll Virtuoso specifically to index 0 smoothly
                virtuosoRef.current.scrollToIndex({ index: 0, behavior: 'smooth' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
        window.addEventListener('nav-tab-double-click', handleNavDoubleTap);
        return () => window.removeEventListener('nav-tab-double-click', handleNavDoubleTap);
    }, [subTab]);
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

    const fuse = useMemo(() => new Fuse(songs || [], {
        keys: ['title', 'conductor'],
        threshold: 0.3,
        distance: 100,
        ignoreLocation: true,
        minMatchCharLength: 2,
    }), [songs]);

    const uniqueConductors = Array.from(new Set((songs || []).map(s => s.conductor).filter(Boolean))).sort();

    // Native SubHeader Sync
    useEffect(() => {
        if (!isNative) return;
        
        try {
            const payload = {
                isVisible: isActiveTab,
                tabs: choirType !== 'standard' ? [t('songs.list.tab_repertoire'), t('songs.list.tab_archive')] : [],
                activeTab: subTab === 'repertoire' ? 0 : 1,
                searchInput: {
                    value: search,
                    placeholder: t('songs.list.search_placeholder'),
                    autoFocus: false
                },
                filterMenu: subTab === 'repertoire' ? [
                    [
                        { id: 'theme:All', label: t('songs.list.filter_all'), isActive: selectedCategory === 'All' },
                        ...Array.from(new Set([...CATEGORIES, ...(knownCategories || [])])).map(cat => ({
                            id: `theme:${cat}`,
                            label: t(`global.themes.${cat.replace(/ /g, '_').replace(/[''\u2019\u02BC]/g, '')}` as any, { defaultValue: cat }),
                            isActive: selectedCategory === cat
                        }))
                    ],
                    ...(uniqueConductors.length > 0 ? [
                        uniqueConductors.map(c => ({
                            id: `conductor:${c || ''}`,
                            label: c || '',
                            isActive: selectedConductor === c
                        }))
                    ] : [])
                ] : [
                    [
                        ...ARCHIVE_CATEGORIES.map(cat => ({
                            id: `arch_cat:${cat.id}`,
                            label: cat.label,
                            isActive: archiveCategory === cat.id,
                            children: ARCHIVE_SUBCATEGORIES[cat.id]?.map(sub => ({
                                id: `arch_sub:${sub.id}`,
                                label: sub.label,
                                isActive: archiveSubCategory === sub.id,
                            }))
                        }))
                    ],
                    [
                        {
                            id: 'arch_theme_dropdown',
                            label: t('global.themes_label' as any, { defaultValue: 'Тематика' }),
                            isActive: !!archiveTheme,
                            children: [
                                { id: 'arch_theme:all', label: t('songs.list.filter_all'), isActive: !archiveTheme },
                                ...OFFICIAL_THEMES.filter(thm => thm !== 'Інші').sort((a, b) => a.localeCompare(b)).map(theme => ({
                                    id: `arch_theme:${theme}`,
                                    label: t(`global.themes.${theme.replace(/ /g, '_').replace(/['\u2019\u02BC]/g, '')}` as any, { defaultValue: theme }),
                                    isActive: archiveTheme === theme,
                                })),
                                { id: 'arch_theme:Інші', label: t('global.themes.Інші' as any, { defaultValue: 'Інші' }), isActive: archiveTheme === 'Інші' }
                            ]
                        }
                    ],
                    [
                        {
                            id: 'arch_lang_dropdown',
                            label: t('global.language' as any, { defaultValue: 'Мова' }),
                            isActive: archiveLanguage !== 'all',
                            children: [
                                { id: 'arch_lang:all', label: t('songs.list.filter_all'), isActive: archiveLanguage === 'all' },
                                { id: 'arch_lang:ukr', label: t('songs.list.lang_ukr'), isActive: archiveLanguage === 'ukr' },
                                { id: 'arch_lang:rus', label: t('songs.list.lang_rus'), isActive: archiveLanguage === 'rus' },
                                { id: 'arch_lang:eng', label: t('songs.list.lang_eng'), isActive: archiveLanguage === 'eng' },
                            ]
                        }
                    ]
                ]
            };
            (window as any).webkit?.messageHandlers?.subHeaderSync?.postMessage(payload);
        } catch (e) {
            console.warn("subHeaderSync error", e);
        }
        
    }, [isNative, isActiveTab, subTab, search, selectedCategory, selectedConductor, uniqueConductors, choirType, knownCategories, archiveCategory, archiveSubCategory, archiveLanguage, archiveTheme]);

    useEffect(() => {
        if (!isNative) return;
        
        (window as any).__nativeSubHeaderTabClick = (index: number) => {
            setSubTab(index === 0 ? 'repertoire' : 'catalog');
        };
        (window as any).__nativeSubHeaderSearchChange = (val: string) => {
            setSearch(val);
        };
        (window as any).__nativeSubHeaderFilterMenuSelect = (itemId: string) => {
            if (itemId.startsWith('theme:')) {
                const cat = itemId.slice(6);
                setSelectedCategory(cat === selectedCategory ? 'All' : cat as any);
                setSelectedConductor('All');
            } else if (itemId.startsWith('conductor:')) {
                const c = itemId.slice(10);
                setSelectedConductor(selectedConductor === c ? 'All' : c);
            } else if (itemId.startsWith('arch_cat:')) {
                const catId = itemId.slice(9);
                setArchiveCategory(catId);
                setArchiveSubCategory(null);
            } else if (itemId.startsWith('arch_sub:')) {
                const subId = itemId.slice(9);
                setArchiveSubCategory(archiveSubCategory === subId ? null : subId);
            } else if (itemId.startsWith('arch_lang:')) {
                const lang = itemId.slice(10) as 'ukr' | 'rus' | 'eng';
                setArchiveLanguage(archiveLanguage === lang ? 'all' : lang);
            } else if (itemId === 'arch_lang_dropdown') {
                setArchiveLanguage('all');
            } else if (itemId.startsWith('arch_theme:')) {
                const themeId = itemId.slice(11);
                setArchiveTheme(themeId === 'all' ? null : themeId === archiveTheme ? null : themeId);
            } else if (itemId === 'arch_theme_dropdown') {
                setArchiveTheme(null);
            }
        };

        return () => {
            delete (window as any).__nativeSubHeaderTabClick;
            delete (window as any).__nativeSubHeaderSearchChange;
            delete (window as any).__nativeSubHeaderFilterMenuSelect;
            
            try {
                (window as any).webkit?.messageHandlers?.subHeaderSync?.postMessage({ isVisible: false });
            } catch (e) {}
        };
    }, [isNative, selectedCategory, selectedConductor, archiveTheme, archiveLanguage, archiveSubCategory]);

    const filteredSongs = useMemo(() => {
        let results = songs;
        if (search.trim()) {
            const query = search.trim().toLowerCase();
            const fuseResults = fuse.search(search).map(r => r.item);

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
        }
        if (selectedCategory !== "All") {
            results = results.filter(s => s.category === selectedCategory);
        }
        if (selectedConductor !== "All") {
            results = results.filter(s => s.conductor === selectedConductor);
        }
        return results;
    }, [songs, search, selectedCategory, selectedConductor, fuse]);

    const songsWithPdf = (songs || []).filter(s => s.hasPdf).length;

    const handleSongClick = (song: SimpleSong) => {
        // Guard: skip if three-dots (edit) button was just tapped
        if (editClickGuardRef.current) {
            editClickGuardRef.current = false;
            return;
        }
        if (song.hasPdf || effectiveCanAdd) {
            // Background cache: silently cache the PDF for offline access
            if (song.hasPdf) {
                (async () => {
                    try {
                        const { isCached: checkCached, savePdf } = await import('@/lib/offlineDb');
                        const alreadyCached = await checkCached(song.id);
                        if (!alreadyCached) {
                            const pdfUrl = song.parts?.[0]?.pdfUrl || song.pdfUrl;
                            if (pdfUrl) {
                                const partsData = (song.parts && song.parts.length > 0)
                                    ? song.parts.map((p: any) => ({ name: p.name || 'Part', pdfUrl: p.pdfUrl }))
                                    : [{ name: t('songs.list.main_part'), pdfUrl }];
                                const validParts = partsData.filter(p => !!p.pdfUrl);
                                if (validParts.length > 0) {
                                    console.log(`[OfflineCache] Caching "${song.title}" from repertoire...`);
                                    const resolvedParts = await Promise.all(
                                        validParts.map(async (part) => {
                                            const resp = await fetch(part.pdfUrl as string);
                                            const blob = await resp.blob();
                                            const base64 = await new Promise<string>((resolve, reject) => {
                                                const reader = new FileReader();
                                                reader.onloadend = () => resolve(reader.result as string);
                                                reader.onerror = reject;
                                                reader.readAsDataURL(blob);
                                            });
                                            return { name: part.name, pdfBase64: base64 };
                                        })
                                    );
                                    await savePdf(song.id, 'repertoire', song.title, resolvedParts);
                                    console.log(`[OfflineCache] Cached "${song.title}" for offline access`);
                                    // Enforce size limit
                                    const { enforceLimit } = await import('@/lib/offlineDb');
                                    await enforceLimit();
                                }
                            }
                        }
                    } catch (e) {
                        // Silent fail — caching is best-effort
                        console.warn('[OfflineCache] Background cache failed:', e);
                    }
                })();
            }

            // iOS native: open native PDF viewer (works both online and offline)
            if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' && song.hasPdf) {
                (async () => {
                    try {
                        // Try IndexedDB cache first (works offline)
                        const { getPdfParts } = await import('@/lib/offlineDb');
                        const cachedParts = await getPdfParts(song.id);

                        let partsData: { name: string; pdfUrl: string }[];

                        if (cachedParts && cachedParts.length > 0) {
                            // Use cached base64 data — works offline
                            partsData = cachedParts.map(p => ({ name: p.name || t('songs.list.main_part'), pdfUrl: p.pdfBase64 }));
                        } else {
                            // Use remote URLs — requires internet
                            const pdfUrl = song.parts?.[0]?.pdfUrl || song.pdfUrl;
                            if (!pdfUrl) {
                                router.push(`/song?id=${song.id}`);
                                return;
                            }
                            partsData = (song.parts && song.parts.length > 0)
                                ? song.parts.map((p: any) => ({ name: p.name || 'Part', pdfUrl: p.pdfUrl }))
                                : [{ name: t('songs.list.main_part'), pdfUrl }];
                        }

                        await PencilKitAnnotator.openNativePdfViewer({
                            parts: partsData,
                            initialPartIndex: 0,
                            songId: song.id,
                            userUid: userData?.id || 'anonymous',
                            title: song.title,
                        });
                    } catch (e) {
                        console.error('[NativePdf] Error:', e);
                    }
                })();
                return;
            }
            router.push(`/song?id=${song.id}`);
        }
    };

    const handleAddSong = async (song: Omit<SimpleSong, 'id' | 'addedBy' | 'addedAt'>, pdfFiles?: { name: string; file: File }[]): Promise<void> => {
        if (!userData?.choirId) return;
        const normalizedTitle = song.title.trim().toLowerCase();
        const duplicate = songs.find((s: SimpleSong) => s.title.trim().toLowerCase() === normalizedTitle);
        if (duplicate) throw new Error(`${t('songs.list.song')} "${duplicate.title}" ${t('songs.list.already_exists')}`);

        const allKnown = [...regents, ...knownConductors];
        if (song.conductor && !allKnown.includes(song.conductor)) {
            try { await addKnownConductor(userData.choirId, song.conductor); } catch (e) { console.error(e); }
        }

        const newSongId = await addSong(userData.choirId, { ...song, addedAt: new Date().toISOString() });
        if (pdfFiles && pdfFiles.length > 0) {
            try {
                if (pdfFiles.length === 1) {
                    await uploadSongPdf(userData.choirId, newSongId, pdfFiles[0].file);
                } else {
                    await uploadSongParts(userData.choirId, newSongId, pdfFiles);
                }
            } catch (e) { console.error(e); await Dialog.alert({ title: t('songs.list.error_title'), message: t('songs.list.pdf_error') }); }
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
        const duplicate = songs.find((s: SimpleSong) => s.title.trim().toLowerCase() === normalizedTitle);
        if (duplicate) {
            const { value } = await Dialog.confirm({
                title: t('songs.list.duplicate_title'),
                message: `${t('songs.list.song')} "${duplicate.title}" ${t('songs.list.duplicate_confirm')}`,
                okButtonTitle: t('songs.list.add_btn'),
                cancelButtonTitle: t('songs.list.cancel_btn')
            });
            if (!value) return; // User cancelled
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
            setToast({ message: t('songs.list.error_archive_add'), type: "error" });
        }
    };

    const handleEditClick = (e: React.MouseEvent, song: SimpleSong) => {
        e.preventDefault(); e.stopPropagation();
        editClickGuardRef.current = true;
        // Reset guard after a tick in case handleSongClick doesn't fire
        setTimeout(() => { editClickGuardRef.current = false; }, 100);
        router.push(`/song?id=${song.id}&info=1`);
    };

    const handleEditSave = async (updates: Partial<SimpleSong>) => {
        if (!userData?.choirId || !editingSong) return;
        try {
            await updateSong(userData.choirId, editingSong.id, updates);
            setToast({ message: t('songs.list.success_save'), type: "success" });
            setEditingSong(null);
            await refreshRepertoire();
            if (onRefresh) onRefresh();
        } catch (e) { console.error(e); await Dialog.alert({ title: t('songs.list.error_title'), message: t('songs.list.error_update') }); }
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
                message: t('songs.list.moved_to_trash'),
                type: "success",
                actionLabel: t('songs.list.undo_btn'),
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
            setToast({ message: t('songs.list.error_delete'), type: "error" });
        } finally { setDeletingSongId(null); }
    };

    if (loading) {
        return <div className="flex justify-center py-20 opacity-0"></div>;
    }

    return (
        <div className={`max-w-5xl mx-auto px-4 pb-32 ${isNative ? 'pt-0' : 'pt-4'} space-y-3`}>
            {/* Sub-Tab Switcher (Web Only) */}
            {!isNative && choirType !== 'standard' && (
                <div className="flex bg-surface/50 backdrop-blur-xl border border-border rounded-xl p-0.5 mb-6">
                    <button
                        onClick={() => setSubTab('repertoire')}
                        className={`flex-1 py-2.5 rounded-[10px] text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${subTab === 'repertoire'
                            ? 'bg-primary text-background'
                            : 'text-text-secondary'
                            }`}
                    >
                        <Music2 className="w-4 h-4" />
                        {t('songs.list.tab_repertoire')}
                    </button>
                    <button
                        onClick={() => setSubTab('catalog')}
                        className={`flex-1 py-2.5 rounded-[10px] text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${subTab === 'catalog'
                            ? 'bg-primary text-background'
                            : 'text-text-secondary'
                            }`}
                    >
                        <Library className="w-4 h-4" />
                        {t('songs.list.tab_archive')}
                    </button>
                </div>
            )}

            {/* Catalog View */}
            {choirType !== 'standard' && (
                <div data-subtab="catalog" className={subTab === 'catalog' ? 'block h-full' : 'hidden'}>
                    {/* Extra padding on native so archive clears the SubHeader */}
                    {isNative && <div className="h-12" />}
                    <GlobalArchive
                        isOverlayOpen={isOverlayOpen}
                        showSearchOverlay={showSearchOverlay && subTab === 'catalog'}
                        setShowSearchOverlay={setShowSearchOverlay}
                        externalSearchQuery={search}
                        externalCategory={archiveCategory}
                        externalSubCategory={archiveSubCategory}
                        externalLanguage={archiveLanguage}
                        externalTheme={archiveTheme}
                        onAddSong={canAddSongs ? async (globalSong) => {
                            if (!userData?.choirId) return;

                            // Duplicate detection
                            const normalizedTitle = globalSong.title.trim().toLowerCase();
                            const duplicate = songs.find((s: SimpleSong) => s.title.trim().toLowerCase() === normalizedTitle);
                            if (duplicate) {
                                const { value } = await Dialog.confirm({
                                    title: t('songs.list.duplicate_title'),
                                    message: `${t('songs.list.song')} "${duplicate.title}" ${t('songs.list.duplicate_confirm')}`,
                                    okButtonTitle: t('songs.list.add_btn'),
                                    cancelButtonTitle: t('songs.list.cancel_btn')
                                });
                                if (!value) return; // User cancelled
                            }

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
                                setToast({ message: `"${globalSong.title}" ${t('songs.list.added_from_archive')}`, type: "success" });
                                await refreshRepertoire();
                                if (onRefresh) onRefresh();
                            } catch (e) {
                                console.error(e);
                                setToast({ message: t('songs.list.error_archive_add'), type: "error" });
                            }
                        } : undefined}
                    />
                </div>
            )}

            {/* Repertoire Content */}
            <div className={subTab === 'repertoire' ? 'block' : 'hidden'}>
                {/* Extra padding on native so content clears the SubHeader */}
                {isNative && <div className="h-12" />}
                
                {/* Stats Card */}
                <div className="bg-surface/50 backdrop-blur-xl border border-border rounded-2xl p-5 mb-2 mt-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-black/5 dark:bg-white/10 rounded-full flex items-center justify-center text-text-primary">
                                <Music2 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold">{t('songs.repertoire')}</p>
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
                                title={t('songs.list.trash_tooltip')}
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Search Overlay using NativeGlassInner */}
                <AnimatePresence>
                    {!isNative && showSearchOverlay && subTab === 'repertoire' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="fixed inset-0 z-[65] bg-background flex flex-col"
                            data-native-inner="true"
                        >
                            <GlassPageHeader
                                title={t('songs.list.search_title')}
                                searchInput={{
                                    value: search,
                                    onChange: setSearch,
                                    placeholder: t('songs.list.search_placeholder2'),
                                    autoFocus: true
                                }}
                                onBack={() => {
                                    setShowSearchOverlay?.(false);
                                    setSearch("");
                                    setSelectedCategory("All");
                                    setSelectedConductor("All");
                                }}
                                filterMenu={[
                                    {
                                        items: [
                                            { id: 'theme:All', label: t('songs.list.filter_all'), isActive: selectedCategory === 'All' },
                                            ...Array.from(new Set([...CATEGORIES, ...(knownCategories || [])])).map(cat => ({
                                                id: `theme:${cat}`,
                                                label: t(`global.themes.${cat.replace(/ /g, '_').replace(/[''\u2019\u02BC]/g, '')}` as any, { defaultValue: cat }),
                                                isActive: selectedCategory === cat
                                            }))
                                        ]
                                    },
                                    ...(uniqueConductors.length > 0 ? [{
                                        items: uniqueConductors.map(c => ({
                                            id: `conductor:${c || ''}`,
                                            label: c || '',
                                            isActive: selectedConductor === c
                                        }))
                                    }] : [])
                                ]}
                                onFilterMenuSelect={(itemId) => {
                                    if (itemId.startsWith('theme:')) {
                                        const cat = itemId.slice(6);
                                        setSelectedCategory(cat === selectedCategory ? 'All' : cat as any);
                                        setSelectedConductor('All');
                                    } else if (itemId.startsWith('conductor:')) {
                                        const c = itemId.slice(10);
                                        setSelectedConductor(selectedConductor === c ? 'All' : c);
                                    }
                                }}
                            />

                            {/* Scrollable Results */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="px-4 pb-8">
                                    {filteredSongs.length === 0 ? (
                                        <div className="text-center py-24 opacity-40">
                                            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Music2 className="w-8 h-8 text-text-secondary" />
                                            </div>
                                            <p className="text-text-secondary">{search ? t('songs.list.empty_search') : t('songs.list.start_typing')}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-0">
                                            <p className="text-xs text-text-secondary my-2">{filteredSongs.length} {filteredSongs.length === 1 ? t('songs.list.songs_count_single') : t('songs.list.songs_count_plural')}</p>
                                            {filteredSongs.map(song => (
                                                <div
                                                    key={song.id}
                                                    onClick={() => {
                                                        setShowSearchOverlay?.(false);
                                                        setSearch("");
                                                        setSelectedCategory("All");
                                                        setSelectedConductor("All");
                                                        handleSongClick(song);
                                                    }}
                                                    className="flex items-center gap-3 py-3 border-b border-border/30 cursor-pointer active:bg-surface-highlight/50 transition-colors"
                                                >
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-text-primary">
                                                        {song.hasPdf ? <Eye className="w-5 h-5 text-background" /> : <FileText className="w-5 h-5 text-background" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-text-primary truncate">{song.title}</p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {song.conductor && <span className="text-xs text-primary font-medium flex items-center gap-1"><User className="w-3 h-3" />{song.conductor}</span>}
                                                            {song.conductor && <span className="text-xs text-text-secondary">•</span>}
                                                            <span className="text-xs text-text-secondary">{t(`global.themes.${song.category.replace(/ /g, '_').replace(/[''\u2019\u02BC]/g, '')}` as any, { defaultValue: song.category })}</span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-text-secondary/40 flex-shrink-0" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div>
                    {/* Extra padding on native for songs list below stats card */}
                    {isNative && <div className="h-2" />}
                    
                    {loading ? (
                        <div className="mt-2 opacity-0 py-20"></div>
                    ) : filteredSongs.length === 0 ? (
                        <div className="text-center py-24 opacity-40">
                            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
                                <Music2 className="w-8 h-8 text-text-secondary" />
                            </div>
                            <p className="text-text-secondary">{t('songs.not_found')}</p>
                        </div>
                    ) : (
                        <>
                            {isMobile === false && (
                                <div className="flex flex-col h-full">
                                    <div className="grid grid-cols-[1fr_180px_180px_60px] gap-4 py-3 pl-0 pr-4 border-b border-border bg-background text-xs font-bold text-text-secondary uppercase tracking-wider">
                                        <div>{t('songs.list.col_name')}</div><div>{t('songs.list.col_category')}</div><div>{t('songs.list.col_conductor')}</div><div></div>
                                    </div>
                                    <Virtuoso
                                        ref={virtuosoRef}
                                        useWindowScroll
                                        initialItemCount={20}
                                        data={filteredSongs}
                                        itemContent={(index, song) => {
                                            if (!song) return null;
                                            return (
                                                <div style={{ minHeight: '40px' }}>
                                                    <SwipeableCard ref={(el) => { cardRefs.current[song.id] = el }} key={song.id} disabled={!effectiveCanAdd} onDelete={() => initiateDelete(null, song.id)} className="border-b border-border/30" contentClassName="bg-background" disableFullSwipe={true}>
                                                        <div className="grid grid-cols-[1fr_180px_180px_60px] gap-4 py-3 pl-0 pr-4 hover:bg-surface items-center cursor-pointer transition-colors relative z-10" onClick={() => handleSongClick(song)}>
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-text-primary">
                                                                    {song.hasPdf ? <Eye className="w-4 h-4 text-background" /> : <FileText className="w-4 h-4 text-background" />}
                                                                </div>
                                                                <p className="font-semibold text-text-primary truncate">{song.title}</p>
                                                            </div>
                                                            <div className="truncate"><span className="text-sm text-text-secondary">{t(`global.themes.${song.category.replace(/ /g, '_').replace(/[''\u2019\u02BC]/g, '')}` as any, { defaultValue: song.category })}</span></div>
                                                            <div className="truncate">
                                                                {song.conductor ? <div className="flex items-center gap-1.5 text-sm text-primary font-medium"><User className="w-3.5 h-3.5" /><span>{song.conductor}</span></div> : <span className="text-sm text-text-secondary/50">—</span>}
                                                            </div>
                                                            <div className="flex justify-end">
                                                                {effectiveCanAdd && <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditClick(e, song); }} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors" title={t('songs.list.more_info')}><MoreVertical className="w-5 h-5" /></button>}
                                                            </div>
                                                        </div>
                                                    </SwipeableCard>
                                                </div>
                                            );
                                        }}
                                    />
                                </div>
                            )}

                            {isMobile === true && (
                                <div>
                                    <Virtuoso
                                        ref={virtuosoRef}
                                        useWindowScroll
                                        initialItemCount={20}
                                        data={filteredSongs}
                                        itemContent={(index, song) => {
                                            if (!song) return <div style={{ height: 60 }} />;
                                            return (
                                                <div style={{ minHeight: '60px' }}>
                                                    <SwipeableCard ref={(el) => { cardRefs.current[song.id] = el }} key={song.id} disabled={!effectiveCanAdd} onDelete={() => initiateDelete(null, song.id)} className="border-b border-border/30" contentClassName="bg-background" backgroundClassName="rounded-2xl" disableFullSwipe={!Capacitor.isNativePlatform()}>
                                                        <div onClick={() => handleSongClick(song)} className="flex items-center gap-3 py-3 px-0 bg-background cursor-pointer relative z-10">
                                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-text-primary">
                                                                {song.hasPdf ? <Eye className="w-5 h-5 text-background" /> : <FileText className="w-5 h-5 text-background" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-semibold text-text-primary truncate">{song.title}</p>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    {song.conductor && <span className="text-xs text-primary font-medium flex items-center gap-1"><User className="w-3 h-3" />{song.conductor}</span>}
                                                                    {song.conductor && <span className="text-xs text-text-secondary">•</span>}
                                                                    <span className="text-xs text-text-secondary">{t(`global.themes.${song.category.replace(/ /g, '_').replace(/[''\u2019\u02BC]/g, '')}` as any, { defaultValue: song.category })}</span>
                                                                </div>
                                                            </div>
                                                            {effectiveCanAdd && <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditClick(e, song); }} className="p-2 rounded-lg text-text-secondary hover:text-text-primary active:scale-95 transition-transform" title={t('songs.list.more_info')}><MoreVertical className="w-5 h-5" /></button>}
                                                        </div>
                                                    </SwipeableCard>
                                                </div>
                                            )
                                        }}
                                    />
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
                <div className="fixed inset-0 z-[200] bg-background flex flex-col" data-native-inner="true">
                    <GlassPageHeader title={t('songs.list.archive_search_title')} onBack={() => setShowArchiveModal(false)} />
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
            <ConfirmationModal isOpen={!!deletingSongId} onClose={cancelDelete} onConfirm={confirmDelete} title={t('songs.list.delete_title')} message={t('songs.list.delete_desc')} confirmLabel={t('songs.list.delete_btn')} isDestructive />
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
                title={t('songs.list.added_title')}
                message={t('songs.list.added_desc')}
                confirmLabel={t('songs.list.open_btn')}
            />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} duration={toast.onAction ? 5000 : 3000} actionLabel={toast.actionLabel} onAction={toast.onAction} />}

            {/* Floating Add Button */}
            {canAddSongs && subTab === 'repertoire' && setShowAddModal && !showAddModal && !isOverlayOpen && (
                <button onClick={() => setShowAddModal(true)} className="app-fab fixed w-14 h-14 bg-primary text-background rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-[60] right-4" style={{ bottom: 'var(--fab-bottom)' }} title={t('songs.list.add_song_tooltip')}>
                    <Plus className="w-7 h-7" />
                </button>
            )}
        </div>
    );
}
