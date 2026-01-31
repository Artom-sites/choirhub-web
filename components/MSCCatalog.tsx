"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy, limit, startAfter, where, DocumentSnapshot, startAt, endAt } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Music, Users, Loader2, FolderOpen, Plus, Eye, X, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PDFViewer from "./PDFViewer";

interface MSCSong {
    id: string;
    title: string;
    composer?: string;
    subtitle?: string;
    mainCategory: string;
    category: string;
    folderUrl: string;
    folderId: string;
    pdfUrl?: string;  // R2 PDF URL
    hasPdf?: boolean;
    isCyrillic?: boolean;
}

interface MSCCatalogProps {
    onAddSong?: (song: MSCSong) => void;
}

const MAIN_CATEGORIES = [
    { id: "all", label: "Всі", icon: Music },
    { id: "Хор", label: "Хор", icon: Users },
    { id: "Ансамбли", label: "Ансамблі", icon: Users },
    { id: "Орекстры", label: "Оркестри", icon: Music },
];

const PAGE_SIZE = 50;

// Instrument badge mapping
const INSTRUMENT_BADGES: { pattern: RegExp; label: string; emoji: string; color: string }[] = [
    { pattern: /piano/i, label: "Фортепіано", emoji: "🎹", color: "bg-amber-500/20 text-amber-400" },
    { pattern: /violin|скрипк/i, label: "Скрипка", emoji: "🎻", color: "bg-orange-500/20 text-orange-400" },
    { pattern: /viola|альт/i, label: "Альт", emoji: "🎻", color: "bg-orange-500/20 text-orange-400" },
    { pattern: /cello|віолончел/i, label: "Віолончель", emoji: "🎻", color: "bg-orange-500/20 text-orange-400" },
    { pattern: /bass|контрабас|бас/i, label: "Бас", emoji: "🎸", color: "bg-red-500/20 text-red-400" },
    { pattern: /flute|флейт/i, label: "Флейта", emoji: "🎵", color: "bg-sky-500/20 text-sky-400" },
    { pattern: /clarinet|кларнет/i, label: "Кларнет", emoji: "🎵", color: "bg-indigo-500/20 text-indigo-400" },
    { pattern: /oboe|гобой/i, label: "Гобой", emoji: "🎵", color: "bg-indigo-500/20 text-indigo-400" },
    { pattern: /trumpet|труб/i, label: "Труба", emoji: "🎺", color: "bg-yellow-500/20 text-yellow-400" },
    { pattern: /trombone|тромбон/i, label: "Тромбон", emoji: "🎺", color: "bg-yellow-500/20 text-yellow-400" },
    { pattern: /horn|валторн/i, label: "Валторна", emoji: "🎺", color: "bg-yellow-500/20 text-yellow-400" },
    { pattern: /guitar|гітар/i, label: "Гітара", emoji: "🎸", color: "bg-emerald-500/20 text-emerald-400" },
    { pattern: /choir|хор/i, label: "Хор", emoji: "🎤", color: "bg-purple-500/20 text-purple-400" },
    { pattern: /full.?score|партитур/i, label: "Партитура", emoji: "📜", color: "bg-blue-500/20 text-blue-400" },
    { pattern: /vocal|вокал|голос/i, label: "Вокал", emoji: "🎤", color: "bg-pink-500/20 text-pink-400" },
    { pattern: /drum|барабан|ударн/i, label: "Ударні", emoji: "🥁", color: "bg-stone-500/20 text-stone-400" },
    { pattern: /organ|орган/i, label: "Орган", emoji: "⛪", color: "bg-violet-500/20 text-violet-400" },
];

function getInstrumentBadge(title: string, pdfUrl?: string): { label: string; emoji: string; color: string } | null {
    // Check both title and pdfUrl for instrument patterns
    const textToCheck = `${title} ${pdfUrl || ""}`;

    for (const badge of INSTRUMENT_BADGES) {
        if (badge.pattern.test(textToCheck)) {
            return { label: badge.label, emoji: badge.emoji, color: badge.color };
        }
    }
    return null;
}

// Category Translations and Sorting Order
const CATEGORY_TRANSLATIONS: Record<string, string> = {
    "Смешанный хор": "Змішаний хор",
    "Мужской хор": "Чоловічий хор",
    "Женский хор": "Жіночий хор",
    "Детский хор": "Дитячий хор",
    "Детский хор (младшый)": "Дитячий хор (молодший)",
    "Детский хор (старший)": "Дитячий хор (старший)",
    "Общее пение": "Загальний спів",
    "Квартеты": "Квартети",
    "Трио": "Тріо",
    "Дуэты": "Дуети",
    "Соло": "Соло",
    "Группа прославления": "Група прославлення",
    "Струнный оркестр": "Струнний оркестр",
    "Духовой оркестр": "Духовий оркестр",
    "Симфонический оркестр": "Симфонічний оркестр",
    "Камерный ансамбль": "Камерний ансамбль",
    "Гитарный ансамбль": "Гітарний ансамбль"
};

const SUBCATEGORY_PRIORITY = [
    "Змішаний хор",
    "Смешанный хор", // Fallback
    "Чоловічий хор",
    "Жіночий хор",
    "Молодіжний хор",
    "Дитячий хор",
    "Загальний спів",
    "Група прославлення"
];

function getTranslatedCategory(cat: string): string {
    return CATEGORY_TRANSLATIONS[cat] || cat;
}

export default function MSCCatalog({ onAddSong }: MSCCatalogProps) {
    const [songs, setSongs] = useState<MSCSong[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMainCategory, setSelectedMainCategory] = useState("all");
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
    const [subCategories, setSubCategories] = useState<string[]>([]);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [previewSong, setPreviewSong] = useState<MSCSong | null>(null);

    // Load songs
    useEffect(() => {
        const delayDebounceString = setTimeout(() => {
            loadSongs(true);
        }, 500); // 500ms debounce

        return () => clearTimeout(delayDebounceString);
    }, [selectedMainCategory, selectedSubCategory, searchQuery]);

    // Load subcategories when main category changes
    useEffect(() => {
        loadSubCategories();
    }, [selectedMainCategory]);

    const loadSubCategories = async () => {
        if (selectedMainCategory === "all") {
            setSubCategories([]);
            return;
        }

        try {
            const q = query(
                collection(db, "mscCatalog"),
                where("mainCategory", "==", selectedMainCategory)
            );
            const snapshot = await getDocs(q);
            const cats = new Set<string>();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.category) cats.add(data.category);
            });

            // Sort categories: Priority first, then Alphabetical
            const sortedCats = Array.from(cats).sort((a, b) => {
                const nameA = getTranslatedCategory(a);
                const nameB = getTranslatedCategory(b);

                const indexA = SUBCATEGORY_PRIORITY.indexOf(nameA);
                const indexB = SUBCATEGORY_PRIORITY.indexOf(nameB);

                // If both are in priority list, sort by index
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                // If only A is in priority, it comes first
                if (indexA !== -1) return -1;
                // If only B is in priority, it comes first
                if (indexB !== -1) return 1;

                // Otherwise sort alphabetically
                return nameA.localeCompare(nameB);
            });

            setSubCategories(sortedCats);
        } catch (error) {
            console.error("Error loading subcategories:", error);
        }
    };

    const loadSongs = async (reset: boolean = false) => {
        if (reset) {
            setLoading(true);
            setLastDoc(null);
            setHasMore(true);
        } else {
            setLoadingMore(true);
        }

        try {
            // Base query by category
            let q;

            if (searchQuery.trim()) {
                // Search Mode with Filters
                // sortTitle is UPPERCASE in DB, so we must search in Uppercase
                const term = searchQuery.toUpperCase();

                if (selectedSubCategory) {
                    q = query(
                        collection(db, "mscCatalog"),
                        where("category", "==", selectedSubCategory),
                        orderBy("sortTitle"),
                        startAt(term),
                        endAt(term + '\uf8ff'),
                        limit(PAGE_SIZE)
                    );
                } else if (selectedMainCategory !== "all") {
                    q = query(
                        collection(db, "mscCatalog"),
                        where("mainCategory", "==", selectedMainCategory),
                        orderBy("sortTitle"),
                        startAt(term),
                        endAt(term + '\uf8ff'),
                        limit(PAGE_SIZE)
                    );
                } else {
                    q = query(
                        collection(db, "mscCatalog"),
                        orderBy("sortTitle"),
                        startAt(term),
                        endAt(term + '\uf8ff'),
                        limit(PAGE_SIZE)
                    );
                }
            } else {
                // Browse Mode
                if (selectedSubCategory) {
                    q = query(
                        collection(db, "mscCatalog"),
                        where("category", "==", selectedSubCategory),
                        where("sortTitle", ">=", "\u0400"), // Only Cyrillic
                        orderBy("sortTitle"),
                        limit(PAGE_SIZE)
                    );
                } else if (selectedMainCategory !== "all") {
                    q = query(
                        collection(db, "mscCatalog"),
                        where("mainCategory", "==", selectedMainCategory),
                        where("sortTitle", ">=", "\u0400"), // Only Cyrillic
                        orderBy("sortTitle"),
                        limit(PAGE_SIZE)
                    );
                } else {
                    q = query(
                        collection(db, "mscCatalog"),
                        where("sortTitle", ">=", "\u0400"), // Only Cyrillic
                        orderBy("sortTitle"),
                        limit(PAGE_SIZE)
                    );
                }
            }

            if (!reset && lastDoc) {
                if (searchQuery.trim()) {
                    const term = searchQuery.toUpperCase();

                    if (selectedSubCategory) {
                        q = query(
                            collection(db, "mscCatalog"),
                            where("category", "==", selectedSubCategory),
                            orderBy("sortTitle"),
                            startAt(term),
                            endAt(term + '\uf8ff'),
                            startAfter(lastDoc),
                            limit(PAGE_SIZE)
                        );
                    } else if (selectedMainCategory !== "all") {
                        q = query(
                            collection(db, "mscCatalog"),
                            where("mainCategory", "==", selectedMainCategory),
                            orderBy("sortTitle"),
                            startAt(term),
                            endAt(term + '\uf8ff'),
                            startAfter(lastDoc),
                            limit(PAGE_SIZE)
                        );
                    } else {
                        q = query(
                            collection(db, "mscCatalog"),
                            orderBy("sortTitle"),
                            startAt(term),
                            endAt(term + '\uf8ff'),
                            startAfter(lastDoc),
                            limit(PAGE_SIZE)
                        );
                    }
                } else {
                    if (selectedSubCategory) {
                        q = query(
                            collection(db, "mscCatalog"),
                            where("category", "==", selectedSubCategory),
                            where("sortTitle", ">=", "\u0400"),
                            orderBy("sortTitle"),
                            startAfter(lastDoc),
                            limit(PAGE_SIZE)
                        );
                    } else if (selectedMainCategory !== "all") {
                        q = query(
                            collection(db, "mscCatalog"),
                            where("mainCategory", "==", selectedMainCategory),
                            where("sortTitle", ">=", "\u0400"),
                            orderBy("sortTitle"),
                            startAfter(lastDoc),
                            limit(PAGE_SIZE)
                        );
                    } else {
                        q = query(
                            collection(db, "mscCatalog"),
                            where("sortTitle", ">=", "\u0400"),
                            orderBy("sortTitle"),
                            startAfter(lastDoc),
                            limit(PAGE_SIZE)
                        );
                    }
                }
            }

            const snapshot = await getDocs(q);
            const newSongs: MSCSong[] = snapshot.docs
                .filter(doc => doc.id !== "_metadata")
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as MSCSong));

            if (reset) {
                setSongs(newSongs);
            } else {
                setSongs(prev => [...prev, ...newSongs]);
            }

            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMore(snapshot.docs.length === PAGE_SIZE);
        } catch (error) {
            console.error("Error loading songs:", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Client-side filtering removed as we do server-side search now
    // But we keep the variable name to minimize refactoring impact in JSX
    const filteredSongs = songs;

    const handleAddSong = (song: MSCSong) => {
        if (onAddSong) {
            onAddSong(song);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg pb-4">
                <h2 className="text-xl font-bold mb-4">Каталог МХО</h2>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                    <input
                        type="text"
                        placeholder="Пошук пісні..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-surface rounded-2xl text-white placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                </div>

                {/* Song count */}
                <div className="flex items-center justify-end mb-4">
                    <span className="text-sm text-text-secondary">
                        {songs.length} пісень
                    </span>
                </div>

                {/* Main Categories */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {MAIN_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => {
                                setSelectedMainCategory(cat.id);
                                setSelectedSubCategory(null);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${selectedMainCategory === cat.id
                                ? "bg-white/20 text-white font-semibold"
                                : "bg-surface text-text-secondary hover:bg-surface-hover"
                                }`}
                        >
                            <cat.icon className="w-4 h-4" />
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Sub Categories */}
                {subCategories.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pt-2 pb-1 scrollbar-hide">
                        <button
                            onClick={() => setSelectedSubCategory(null)}
                            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${!selectedSubCategory
                                ? "bg-white/20 text-white font-medium"
                                : "bg-surface text-text-secondary"
                                }`}
                        >
                            Всі
                        </button>
                        {subCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedSubCategory(
                                    selectedSubCategory === cat ? null : cat
                                )}
                                className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${selectedSubCategory === cat
                                    ? "bg-accent text-white font-medium"
                                    : "bg-surface text-text-secondary hover:bg-surface/80"
                                    }`}
                            >
                                {getTranslatedCategory(cat)}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Song List */}
            <div className="flex-1 overflow-y-auto space-y-2">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-accent" />
                    </div>
                ) : filteredSongs.length === 0 ? (
                    <div className="text-center py-12 text-text-secondary">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Пісень не знайдено</p>
                    </div>
                ) : (
                    <>
                        <AnimatePresence mode="popLayout">
                            {filteredSongs.map((song, index) => (
                                <motion.div
                                    key={song.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ delay: index * 0.02 }}
                                    className="bg-surface rounded-2xl p-4 flex items-center gap-4"
                                >
                                    {/* Icon */}
                                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                                        {song.pdfUrl ? (
                                            <FileText className="w-6 h-6 text-accent" />
                                        ) : (
                                            <Music className="w-6 h-6 text-text-secondary" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-white truncate">{song.title}</h3>
                                        {song.composer && (
                                            <p className="text-sm text-text-secondary truncate">{song.composer}</p>
                                        )}
                                        {/* Instrument Badge */}
                                        {(() => {
                                            const badge = getInstrumentBadge(song.title, song.pdfUrl);
                                            return badge ? (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${badge.color}`}>
                                                    {badge.emoji} {badge.label}
                                                </span>
                                            ) : (
                                                <p className="text-xs text-text-secondary/60 truncate">
                                                    {song.category}
                                                </p>
                                            );
                                        })()}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {/* Preview PDF */}
                                        {song.pdfUrl && (
                                            <button
                                                onClick={() => setPreviewSong(song)}
                                                className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                                                title="Переглянути PDF"
                                            >
                                                <Eye className="w-5 h-5 text-blue-400" />
                                            </button>
                                        )}

                                        {/* Add to repertoire */}
                                        {onAddSong && (
                                            <button
                                                onClick={() => handleAddSong(song)}
                                                className="p-2 rounded-xl bg-accent/10 hover:bg-accent/20 transition-colors"
                                                title="Додати в репертуар"
                                            >
                                                <Plus className="w-5 h-5 text-accent" />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Load More */}
                        {hasMore && !searchQuery && (
                            <button
                                onClick={() => loadSongs(false)}
                                disabled={loadingMore}
                                className="w-full py-4 text-center text-accent hover:bg-surface rounded-2xl transition-colors"
                            >
                                {loadingMore ? (
                                    <Loader2 className="w-5 h-5 mx-auto animate-spin" />
                                ) : (
                                    "Завантажити ще"
                                )}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* PDF Preview Modal */}
            <AnimatePresence>
                {previewSong && previewSong.pdfUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 flex flex-col"
                    >
                        {/* PDF Viewer with Add button instead of Download */}
                        <div className="flex-1 overflow-hidden">
                            <PDFViewer
                                url={previewSong.pdfUrl}
                                title={previewSong.title}
                                onClose={() => setPreviewSong(null)}
                                onAddAction={onAddSong ? () => {
                                    handleAddSong(previewSong);
                                    setPreviewSong(null);
                                } : undefined}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
