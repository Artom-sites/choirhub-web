"use client";

import { useState, useEffect } from "react";
import { X, Search, Music, BookOpen, HandHeart, Hand, Mic, Users2, MoreHorizontal, FileText } from "lucide-react";
import { ProgramItem, ProgramItemType, SimpleSong } from "@/types";
import { useRepertoire } from "@/contexts/RepertoireContext";

interface AddProgramItemModalProps {
    onAdd: (item: Omit<ProgramItem, 'id' | 'order'>) => void;
    onClose: () => void;
}

const ITEM_TYPES: { type: ProgramItemType; label: string; icon: React.ReactNode; color: string }[] = [
    { type: 'choir', label: 'Хор', icon: <Music className="w-4 h-4" />, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    { type: 'congregation', label: 'Заг. спів', icon: <Users2 className="w-4 h-4" />, color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
    { type: 'verse', label: 'Вірш', icon: <BookOpen className="w-4 h-4" />, color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
    { type: 'prayer', label: 'Молитва', icon: <Hand className="w-4 h-4" />, color: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
    { type: 'sermon', label: 'Проповідь', icon: <BookOpen className="w-4 h-4" />, color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    { type: 'solo', label: 'Соло', icon: <Mic className="w-4 h-4" />, color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
    { type: 'ensemble', label: 'Ансамбль', icon: <Users2 className="w-4 h-4" />, color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    { type: 'other', label: 'Інше', icon: <MoreHorizontal className="w-4 h-4" />, color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
];

export default function AddProgramItemModal({ onAdd, onClose }: AddProgramItemModalProps) {
    const [selectedType, setSelectedType] = useState<ProgramItemType>('choir');
    const [title, setTitle] = useState("");
    const [performer, setPerformer] = useState("");
    const [linkedSong, setLinkedSong] = useState<SimpleSong | null>(null);
    const [showSongPicker, setShowSongPicker] = useState(false);
    const [songSearch, setSongSearch] = useState("");
    const { songs } = useRepertoire();

    // When type is 'choir' and a song is selected, auto-fill title
    useEffect(() => {
        if (linkedSong) {
            setTitle(linkedSong.title);
        }
    }, [linkedSong]);

    const filteredSongs = songs.filter(s =>
        s.title.toLowerCase().includes(songSearch.toLowerCase())
    );

    const typeConfig = ITEM_TYPES.find(t => t.type === selectedType)!;

    const handleSubmit = () => {
        const payload: Omit<ProgramItem, 'id' | 'order'> = {
            type: selectedType,
            title: title.trim() || typeConfig.label,
        };

        const cleanedPerformer = performer.trim();
        if (cleanedPerformer) payload.performer = cleanedPerformer;
        if (linkedSong?.id) payload.songId = linkedSong.id;
        if (linkedSong?.title) payload.songTitle = linkedSong.title;
        if (linkedSong?.conductor) payload.conductor = linkedSong.conductor;
        if (linkedSong?.pianist) payload.pianist = linkedSong.pianist;

        onAdd(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="w-full max-w-lg bg-surface border-t border-border rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-text-primary">Додати пункт</h2>
                    <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-highlight transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Song Picker Sub-view */}
                {showSongPicker ? (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input
                                autoFocus
                                value={songSearch}
                                onChange={e => setSongSearch(e.target.value)}
                                placeholder="Пошук пісні..."
                                className="w-full pl-10 pr-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                            {filteredSongs.slice(0, 30).map(song => (
                                <button
                                    key={song.id}
                                    onClick={() => {
                                        setLinkedSong(song);
                                        setShowSongPicker(false);
                                    }}
                                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-surface-highlight transition-colors flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                        <Music className="w-4 h-4 text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-text-primary truncate">{song.title}</p>
                                        {song.category && <p className="text-xs text-text-secondary">{song.category}</p>}
                                    </div>
                                </button>
                            ))}
                            {filteredSongs.length === 0 && (
                                <p className="text-center text-sm text-text-secondary py-6">Нічого не знайдено</p>
                            )}
                        </div>
                        <button
                            onClick={() => setShowSongPicker(false)}
                            className="w-full py-3 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                        >
                            Скасувати
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Type Chips */}
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center sm:justify-start">
                            {ITEM_TYPES.map(({ type, label, icon, color }) => (
                                <button
                                    key={type}
                                    onClick={() => {
                                        setSelectedType(type);
                                        // Clear linked song if switching away from choir/congregation
                                        if (type !== 'choir' && type !== 'congregation') setLinkedSong(null);
                                    }}
                                    className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-[10px] sm:rounded-xl text-[11px] sm:text-xs font-bold border transition-all whitespace-nowrap ${selectedType === type ? color : 'bg-surface-highlight/50 text-text-secondary border-transparent'
                                        }`}
                                >
                                    {icon}
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Title Input */}
                        <div>
                            <input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder={selectedType === 'choir' || selectedType === 'congregation' ? "Назва пісні" : selectedType === 'verse' ? "Назва або автор вірша" : "Опис пункту"}
                                className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                            />
                        </div>

                        {/* Performer Input */}
                        <div>
                            <input
                                value={performer}
                                onChange={e => setPerformer(e.target.value)}
                                placeholder="Хто виконує (необов'язково)"
                                className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                            />
                        </div>

                        {/* Link Song Button (for choir type ONLY) */}
                        {selectedType === 'choir' && (
                            <div>
                                {linkedSong ? (
                                    <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                        <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                        <span className="text-sm font-medium text-text-primary flex-1 truncate">{linkedSong.title}</span>
                                        <button onClick={() => setLinkedSong(null)} className="text-text-secondary hover:text-text-primary">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowSongPicker(true)}
                                        className="w-full py-3 border border-dashed border-border rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-highlight/50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Music className="w-4 h-4" />
                                        Прикріпити пісню з репертуару
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Додати
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
