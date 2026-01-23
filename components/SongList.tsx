"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Music2, ChevronRight, Filter, Plus, Eye, User, Loader2 } from "lucide-react";
import { Category, SimpleSong } from "@/types";
import { getSongs, addSong } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import AddSongModal from "./AddSongModal";
import PDFViewer from "./PDFViewer";

interface SongListProps {
    canAddSongs: boolean;
    regents: string[];
}

const CATEGORIES: Category[] = [
    "Різдво", "Пасха", "В'їзд", "Вечеря", "Вознесіння", "Трійця", "Свято Жнив", "Інші"
];

export default function SongList({ canAddSongs, regents }: SongListProps) {
    const router = useRouter();
    const { userData } = useAuth();

    const [songs, setSongsState] = useState<SimpleSong[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");
    const [showAddModal, setShowAddModal] = useState(false);

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
        } else if (canAddSongs) {
            router.push(`/song/${song.id}`);
        } else {
            // Nothing for member to do if no PDF
        }
    };

    const handleAddSong = async (title: string, category: string, conductor: string, pdfBase64?: string) => {
        if (!userData?.choirId) return;

        // We'll upload PDF here or inside addSong if we change signature.
        // For now, let's pass it. Since addSong takes Omit<SimpleSong, "id">, we can add extra fields if needed, 
        // but SimpleSong interface has hasPdf (boolean).
        // We should probably save the PDF content somewhere. 
        // For this step, let's just create the song entry.
        // Real implementation would upload to Storage.

        // TEMPORARY: If we want to store PDF in Firestore document (careful with size limits):
        // We can add a field 'pdfData' to the song object if we update the type.
        // Or we handle it later.

        await addSong(userData.choirId, {
            title,
            category,
            conductor,
            hasPdf: !!pdfBase64,
            addedAt: new Date().toISOString(),
            // pdfData: pdfBase64 
        });

        // Refresh list
        const fetched = await getSongs(userData.choirId);
        setSongsState(fetched);
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-white/20" /></div>;
    }

    return (
        <div className="max-w-md mx-auto px-4 py-4 space-y-4 pb-24">
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

            {/* Search & Filter */}
            <div className="flex gap-3 sticky top-[72px] z-10 py-3 -mx-4 px-4 bg-[#09090b]/90 backdrop-blur-xl">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary group-focus-within:text-white transition-colors" />
                    <input
                        type="text"
                        placeholder="Пошук..."
                        className="w-full pl-11 pr-4 py-3.5 bg-surface border border-white/5 rounded-2xl text-base focus:border-white/20 focus:outline-none text-white placeholder:text-text-secondary/50 transition-all shadow-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <select
                        className="appearance-none bg-surface pl-4 pr-10 py-3.5 rounded-2xl text-base border border-white/5 focus:border-white/20 focus:outline-none text-white h-full shadow-sm transition-all cursor-pointer hover:bg-surface-highlight"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value as Category | "All")}
                    >
                        <option value="All">Всі</option>
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <Filter className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                </div>
            </div>

            {/* List */}
            <div className="space-y-3">
                {filteredSongs.length === 0 ? (
                    <div className="text-center py-24 opacity-40">
                        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                            <Music2 className="w-8 h-8 text-text-secondary" />
                        </div>
                        <p className="text-text-secondary">Пісень не знайдено</p>
                    </div>
                ) : (
                    filteredSongs.map(song => (
                        <button
                            key={song.id}
                            onClick={() => handleSongClick(song)}
                            className="w-full bg-surface hover:bg-surface-highlight border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all text-left group relative overflow-hidden active:scale-[0.99]"
                        >
                            <div className="flex items-start gap-4 relative z-10">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${song.hasPdf ? 'bg-white text-black' : 'bg-white/5 text-text-secondary'}`}>
                                    {song.hasPdf ? (
                                        <Eye className="w-6 h-6" />
                                    ) : (
                                        <FileText className="w-6 h-6" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 py-0.5">
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

                                <ChevronRight className="w-5 h-5 text-text-secondary/30 mt-3.5 group-hover:text-white group-hover:translate-x-1 transition-all" />
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Floating Add Button - White Circle */}
            {canAddSongs && (
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
            <AddSongModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddSong}
                regents={regents}
            />
        </div>
    );
}
