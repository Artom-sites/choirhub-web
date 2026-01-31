"use client";

import { useState, useEffect } from "react";
import { Service, SimpleSong } from "@/types";
import {
    getDeletedServices, restoreService, permanentlyDeleteService,
    getDeletedSongs, restoreLocalSong, permanentDeleteLocalSong
} from "@/lib/db";
import { Trash2, RotateCcw, X, Clock, AlertTriangle, Music, Calendar } from "lucide-react";
import ConfirmationModal from "./ConfirmationModal";

interface TrashBinProps {
    choirId: string;
    onClose: () => void;
    onRestore: () => void; // Callback to refresh service list after restore
}

type TrashItem =
    | { type: 'service'; data: Service }
    | { type: 'song'; data: SimpleSong };

export default function TrashBin({ choirId, onClose, onRestore }: TrashBinProps) {
    const [deletedItems, setDeletedItems] = useState<TrashItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'service' | 'song' } | null>(null);

    const DAYS_TO_KEEP = 7;

    useEffect(() => {
        async function loadDeleted() {
            setLoading(true);
            const [services, songs] = await Promise.all([
                getDeletedServices(choirId),
                getDeletedSongs(choirId)
            ]);

            const now = new Date();
            const cutoffDate = new Date(now.getTime() - DAYS_TO_KEEP * 24 * 60 * 60 * 1000);

            const validItems: TrashItem[] = [];

            // Process Services
            for (const s of services) {
                if (s.deletedAt && new Date(s.deletedAt) > cutoffDate) {
                    validItems.push({ type: 'service', data: s });
                } else if (s.deletedAt) {
                    await permanentlyDeleteService(choirId, s.id);
                }
            }

            // Process Songs
            for (const s of songs) {
                if (s.deletedAt && new Date(s.deletedAt) > cutoffDate) {
                    validItems.push({ type: 'song', data: s });
                } else if (s.deletedAt) {
                    await permanentDeleteLocalSong(choirId, s.id);
                }
            }

            // Sort by deletedAt desc
            validItems.sort((a, b) =>
                new Date(b.data.deletedAt!).getTime() - new Date(a.data.deletedAt!).getTime()
            );

            setDeletedItems(validItems);
            setLoading(false);
        }
        loadDeleted();
    }, [choirId]);

    const handleRestore = async (id: string, type: 'service' | 'song') => {
        setActionLoading(id);
        try {
            if (type === 'service') {
                await restoreService(choirId, id);
            } else {
                await restoreLocalSong(choirId, id);
            }
            setDeletedItems(prev => prev.filter(item => item.data.id !== id));
            onRestore();
        } catch (e) {
            console.error(e);
        }
        setActionLoading(null);
    };

    const handlePermanentDelete = async (id: string, type: 'service' | 'song') => {
        setActionLoading(id);
        try {
            if (type === 'service') {
                await permanentlyDeleteService(choirId, id);
            } else {
                await permanentDeleteLocalSong(choirId, id);
            }
            setDeletedItems(prev => prev.filter(item => item.data.id !== id));
        } catch (e) {
            console.error(e);
        }
        setActionLoading(null);
        setConfirmDelete(null);
    };

    const getDaysRemaining = (deletedAt: string) => {
        const deletedDate = new Date(deletedAt);
        const expiryDate = new Date(deletedDate.getTime() + DAYS_TO_KEEP * 24 * 60 * 60 * 1000);
        const now = new Date();
        const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return Math.max(0, daysRemaining);
    };

    return (
        <div className="fixed inset-0 z-[70] bg-[#09090b] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl">
                    <X className="w-5 h-5" />
                </button>
                <Trash2 className="w-5 h-5 text-red-400" />
                <h2 className="font-bold text-lg">Корзина</h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-safe">
                <div className="max-w-lg mx-auto space-y-3">
                    {loading ? (
                        <div className="text-center py-12 text-text-secondary">
                            Завантаження...
                        </div>
                    ) : deletedItems.length === 0 ? (
                        <div className="text-center py-12">
                            <Trash2 className="w-12 h-12 mx-auto mb-4 text-text-secondary opacity-50" />
                            <p className="text-white font-medium">Корзина порожня</p>
                            <p className="text-sm text-text-secondary mt-1">
                                Видалені елементи зберігаються тут {DAYS_TO_KEEP} днів
                            </p>
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-text-secondary text-center mb-4">
                                Елементи автоматично видаляються через {DAYS_TO_KEEP} днів
                            </p>
                            {deletedItems.map(item => {
                                const daysLeft = getDaysRemaining(item.data.deletedAt!);
                                const isExpiring = daysLeft <= 1;
                                const isService = item.type === 'service';
                                const data = item.data;
                                return (
                                    <div
                                        key={data.id}
                                        className="bg-surface border border-white/5 rounded-2xl p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {isService ? (
                                                        <span className="bg-blue-500/10 text-blue-400 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                                                            <Calendar className="w-3 h-3" /> Служіння
                                                        </span>
                                                    ) : (
                                                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                                                            <Music className="w-3 h-3" /> Пісня
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-white font-medium truncate">
                                                    {data.title}
                                                </h3>
                                                {isService && 'date' in data && (
                                                    <p className="text-sm text-text-secondary">
                                                        {new Date(data.date).toLocaleDateString('uk-UA', {
                                                            day: 'numeric',
                                                            month: 'long',
                                                            year: 'numeric'
                                                        })}
                                                        {data.time && ` о ${data.time}`}
                                                    </p>
                                                )}
                                                <div className={`flex items-center gap-1 mt-2 text-xs ${isExpiring ? 'text-orange-400' : 'text-text-secondary'}`}>
                                                    <Clock className="w-3 h-3" />
                                                    {daysLeft === 0
                                                        ? "Буде видалено сьогодні"
                                                        : `Залишилось ${daysLeft} дн.`
                                                    }
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleRestore(data.id, item.type)}
                                                    disabled={actionLoading === data.id}
                                                    className="p-3 bg-green-500/10 text-green-400 rounded-xl hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                                    title="Відновити"
                                                >
                                                    <RotateCcw className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete({ id: data.id, type: item.type })}
                                                    disabled={actionLoading === data.id}
                                                    className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                    title="Видалити назавжди"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                        {
                                            isService && 'songs' in data && data.songs.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-white/5">
                                                    <p className="text-xs text-text-secondary">
                                                        {data.songs.length} {data.songs.length === 1 ? 'пісня' : data.songs.length < 5 ? 'пісні' : 'пісень'}
                                                    </p>
                                                </div>
                                            )
                                        }
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!confirmDelete}
                title="Видалити назавжди?"
                message="Цей елемент буде видалено без можливості відновлення."
                confirmLabel="Видалити"
                isDestructive
                onConfirm={() => confirmDelete && handlePermanentDelete(confirmDelete.id, confirmDelete.type)}
                onClose={() => setConfirmDelete(null)}
            />
        </div >
    );
}
