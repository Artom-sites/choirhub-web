"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit, startAfter, where, DocumentSnapshot, startAt, endAt } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Music, Users, Loader2, FolderOpen, Plus, Eye, FileText, Sparkles, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PDFViewer from "./PDFViewer";
import { useAuth } from "@/contexts/AuthContext";
import SubmitSongModal from "./SubmitSongModal";
import { getPendingSongs, approveSong, rejectSong, PendingSong } from "@/lib/db";

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
    createdAt?: any;
}

interface MSCCatalogProps {
    onAddSong?: (song: MSCSong) => void;
}

const MAIN_CATEGORIES = [
    { id: "new", label: "Новинки 🔥", icon: Sparkles },
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
    const { user, userData } = useAuth();
    const [songs, setSongs] = useState<MSCSong[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMainCategory, setSelectedMainCategory] = useState("all");
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
    const [subCategories, setSubCategories] = useState<string[]>([]);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [previewSong, setPreviewSong] = useState<MSCSong | null>(null);

    // Submission & Moderation
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [pendingSongs, setPendingSongs] = useState<PendingSong[]>([]);
    const [isModerationMode, setIsModerationMode] = useState(false);

    // Check if user is Admin/Moderator (Exclusive)
    const isModerator = userData?.email === "artemdula0@gmail.com";
    // Allow Regents and Heads to submit
    const canSubmit = userData?.role === 'head' || userData?.role === 'regent';

    // Load songs
    useEffect(() => {
        if (isModerationMode) {
            loadPending();
        } else {
            const delayDebounceString = setTimeout(() => {
                loadSongs(true);
            }, 500);
            return () => clearTimeout(delayDebounceString);
        }
    }, [selectedMainCategory, selectedSubCategory, searchQuery, isModerationMode]);

    // Load subcategories when main category changes
    useEffect(() => {
        if (selectedMainCategory !== 'new' && !isModerationMode) {
            loadSubCategories();
        } else {
            setSubCategories([]);
        }
    }, [selectedMainCategory, isModerationMode]);

    const loadPending = async () => {
        setLoading(true);
        const list = await getPendingSongs();
        setPendingSongs(list);
        setLoading(false);
    };

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

            const sortedCats = Array.from(cats).sort((a, b) => {
                const nameA = getTranslatedCategory(a);
                const nameB = getTranslatedCategory(b);
                const indexA = SUBCATEGORY_PRIORITY.indexOf(nameA);
                const indexB = SUBCATEGORY_PRIORITY.indexOf(nameB);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
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
            let q;
            const term = searchQuery.toUpperCase();

            // ============ NEW CATEGORY LOGIC ============
            if (selectedMainCategory === "new" && !searchQuery) {
                if (reset) {
                    q = query(
                        collection(db, "mscCatalog"),
                        orderBy("createdAt", "desc"),
                        limit(PAGE_SIZE)
                    );
                } else if (lastDoc) {
                    q = query(
                        collection(db, "mscCatalog"),
                        orderBy("createdAt", "desc"),
                        startAfter(lastDoc),
                        limit(PAGE_SIZE)
                    );
                }
            }
            // ============ SEARCH LOGIC ============
            else if (searchQuery.trim()) {
                if (selectedSubCategory) {
                    q = query(
                        collection(db, "mscCatalog"),
                        where("category", "==", selectedSubCategory),
                        orderBy("sortTitle"),
                        startAt(term),
                        endAt(term + '\uf8ff'),
                        limit(PAGE_SIZE)
                    );
                } else if (selectedMainCategory !== "all" && selectedMainCategory !== "new") {
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
            }
            // ============ BROWSE LOGIC ============
            else {
                if (selectedSubCategory) {
                    q = query(
                        collection(db, "mscCatalog"),
                        where("category", "==", selectedSubCategory),
                        where("sortTitle", ">=", "\u0400"),
                        orderBy("sortTitle"),
                        limit(PAGE_SIZE)
                    );
                } else if (selectedMainCategory !== "all" && selectedMainCategory !== "new") {
                    q = query(
                        collection(db, "mscCatalog"),
                        where("mainCategory", "==", selectedMainCategory),
                        where("sortTitle", ">=", "\u0400"),
                        orderBy("sortTitle"),
                        limit(PAGE_SIZE)
                    );
                } else {
                    q = query(
                        collection(db, "mscCatalog"),
                        where("sortTitle", ">=", "\u0400"),
                        orderBy("sortTitle"),
                        limit(PAGE_SIZE)
                    );
                }
            }

            // Pagination for standard browse
            if (!reset && lastDoc && selectedMainCategory !== "new" && q) {
                q = query(q, startAfter(lastDoc));
            }

            if (!q) return;

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

    const handleAddSong = (song: MSCSong) => {
        if (onAddSong) {
            onAddSong(song);
        }
    };

    const handleApprove = async (ps: PendingSong) => {
        if (!confirm(`Схвалити пісню "${ps.title}"?`)) return;
        try {
            await approveSong(ps, user!.uid);
            setPendingSongs(prev => prev.filter(s => s.id !== ps.id));
        } catch (e) {
            alert("Помилка при схваленні");
        }
    };

    const handleReject = async (ps: PendingSong) => {
        const reason = prompt("Причина відхилення:");
        if (!reason) return;
        try {
            await rejectSong(ps.id!, user!.uid, reason);
            setPendingSongs(prev => prev.filter(s => s.id !== ps.id));
        } catch (e) {
            alert("Помилка при відхиленні");
        }
    };

    const songsToRender = isModerationMode ? pendingSongs : songs;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg pb-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Каталог МХО</h2>
                    <div className="flex items-center gap-2">
                        {canSubmit && (
                            <button
                                onClick={() => setShowSubmitModal(true)}
                                className="p-2 bg-primary/20 text-primary rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-primary/30 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="hidden sm:inline">Запропонувати</span>
                            </button>
                        )}
                        {isModerator && (
                            <button
                                onClick={() => {
                                    setIsModerationMode(!isModerationMode);
                                    setSelectedMainCategory('all');
                                }}
                                className={`p-2 rounded-xl transition-colors ${isModerationMode ? 'bg-orange-500 text-white' : 'bg-surface text-text-secondary hover:text-text-primary'}`}
                                title="Модерація"
                            >
                                <ShieldAlert className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {!isModerationMode && (
                    <>
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

                        <div className="flex items-center justify-end mb-4">
                            <span className="text-sm text-text-secondary">
                                {songsToRender.length} пісень
                            </span>
                        </div>

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

                        {subCategories.length > 0 && selectedMainCategory !== 'new' && (
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
                    </>
                )}

                {isModerationMode && (
                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl mb-4">
                        <h3 className="font-bold text-orange-400 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5" />
                            Панель Модератора
                        </h3>
                        <p className="text-sm text-text-secondary mt-1">
                            Перевіряйте заявки користувачів. Схвалені пісні потраплять у "Всі" та "Новинки".
                        </p>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-accent" />
                    </div>
                ) : songsToRender.length === 0 ? (
                    <div className="text-center py-12 text-text-secondary">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{isModerationMode ? "Немає заявок на розгляд" : "Пісень не знайдено"}</p>
                    </div>
                ) : (
                    <>
                        <AnimatePresence mode="popLayout">
                            {isModerationMode ? (
                                pendingSongs.map((song) => (
                                    <motion.div
                                        key={song.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="bg-surface rounded-2xl p-4"
                                    >
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-6 h-6 text-purple-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-white truncate">{song.title}</h3>
                                                <p className="text-sm text-text-secondary">{song.composer} • {song.category}</p>
                                                <p className="text-xs text-text-secondary mt-1 opacity-70">
                                                    Від: {song.submittedByName} ({new Date(song.submittedAt).toLocaleDateString()})
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const preview: MSCSong = {
                                                        id: song.id!,
                                                        title: song.title,
                                                        composer: song.composer,
                                                        mainCategory: 'Pending',
                                                        category: song.category,
                                                        folderUrl: '',
                                                        folderId: '',
                                                        pdfUrl: song.parts?.[0]?.pdfUrl,
                                                        hasPdf: true
                                                    };
                                                    setPreviewSong(preview);
                                                }}
                                                className="flex-1 py-1.5 bg-surface-highlight rounded-lg text-sm font-medium hover:bg-white/10 text-white"
                                            >
                                                Переглянути
                                            </button>
                                            <button
                                                onClick={() => handleReject(song)}
                                                className="flex-1 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20"
                                            >
                                                Відхилити
                                            </button>
                                            <button
                                                onClick={() => handleApprove(song)}
                                                className="flex-1 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/20"
                                            >
                                                Схвалити
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                filteredSongs.map((song, index) => (
                                    <motion.div
                                        key={song.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ delay: index * 0.02 }}
                                        className="bg-surface rounded-2xl p-4 flex items-center gap-4"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                                            {song.pdfUrl ? (
                                                <FileText className="w-6 h-6 text-accent" />
                                            ) : (
                                                <Music className="w-6 h-6 text-text-secondary" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-white truncate">{song.title}</h3>
                                            {song.composer && (
                                                <p className="text-sm text-text-secondary truncate">{song.composer}</p>
                                            )}
                                            {(() => {
                                                const badge = getInstrumentBadge(song.title, song.pdfUrl);
                                                return badge ? (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${badge.color}`}>
                                                        {badge.emoji} {badge.label}
                                                    </span>
                                                ) : (
                                                    <p className="text-xs text-text-secondary/60 truncate">
                                                        {song.category} {song.createdAt && selectedMainCategory === 'new' && '🆕'}
                                                    </p>
                                                );
                                            })()}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {song.pdfUrl && (
                                                <button
                                                    onClick={() => setPreviewSong(song)}
                                                    className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                                                    title="Переглянути PDF"
                                                >
                                                    <Eye className="w-5 h-5 text-blue-400" />
                                                </button>
                                            )}

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
                                ))
                            )}
                        </AnimatePresence>

                        {!isModerationMode && hasMore && !searchQuery && selectedMainCategory !== 'new' && (
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

            <AnimatePresence>
                {previewSong && previewSong.pdfUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 flex flex-col"
                    >
                        <div className="flex-1 overflow-hidden">
                            <PDFViewer
                                url={previewSong.pdfUrl}
                                title={previewSong.title}
                                onDelete={() => { }}
                                onClose={() => setPreviewSong(null)}
                                onAddAction={(onAddSong && !isModerationMode) ? () => {
                                    handleAddSong(previewSong);
                                    setPreviewSong(null);
                                } : undefined}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {showSubmitModal && (
                <SubmitSongModal
                    onClose={() => setShowSubmitModal(false)}
                    onSuccess={() => {
                        alert("Заявка надіслана! Вона з'явиться після перевірки модератором.");
                    }}
                />
            )}
        </div>
    );
}
