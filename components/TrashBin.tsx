"use client";

import { useState, useEffect } from "react";
import { Service } from "@/types";
import { getDeletedServices, restoreService, permanentlyDeleteService } from "@/lib/db";
import { Trash2, RotateCcw, X, Clock, AlertTriangle } from "lucide-react";
import ConfirmationModal from "./ConfirmationModal";

interface TrashBinProps {
    choirId: string;
    onClose: () => void;
    onRestore: () => void; // Callback to refresh service list after restore
}

export default function TrashBin({ choirId, onClose, onRestore }: TrashBinProps) {
    const [deletedServices, setDeletedServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const DAYS_TO_KEEP = 7;

    useEffect(() => {
        async function loadDeleted() {
            setLoading(true);
            const services = await getDeletedServices(choirId);

            // Filter out services older than DAYS_TO_KEEP and sort by deletedAt descending
            const now = new Date();
            const cutoffDate = new Date(now.getTime() - DAYS_TO_KEEP * 24 * 60 * 60 * 1000);

            const recentlyDeleted = services
                .filter(s => s.deletedAt && new Date(s.deletedAt) > cutoffDate)
                .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());

            setDeletedServices(recentlyDeleted);

            // Auto-purge old services
            const oldServices = services.filter(s => s.deletedAt && new Date(s.deletedAt) <= cutoffDate);
            for (const s of oldServices) {
                await permanentlyDeleteService(choirId, s.id);
            }

            setLoading(false);
        }
        loadDeleted();
    }, [choirId]);

    const handleRestore = async (serviceId: string) => {
        setActionLoading(serviceId);
        try {
            await restoreService(choirId, serviceId);
            setDeletedServices(prev => prev.filter(s => s.id !== serviceId));
            onRestore();
        } catch (e) {
            console.error(e);
        }
        setActionLoading(null);
    };

    const handlePermanentDelete = async (serviceId: string) => {
        setActionLoading(serviceId);
        try {
            await permanentlyDeleteService(choirId, serviceId);
            setDeletedServices(prev => prev.filter(s => s.id !== serviceId));
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
                    ) : deletedServices.length === 0 ? (
                        <div className="text-center py-12">
                            <Trash2 className="w-12 h-12 mx-auto mb-4 text-text-secondary opacity-50" />
                            <p className="text-white font-medium">Корзина порожня</p>
                            <p className="text-sm text-text-secondary mt-1">
                                Видалені служіння зберігаються тут {DAYS_TO_KEEP} днів
                            </p>
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-text-secondary text-center mb-4">
                                Служіння автоматично видаляються через {DAYS_TO_KEEP} днів
                            </p>
                            {deletedServices.map(service => {
                                const daysLeft = getDaysRemaining(service.deletedAt!);
                                const isExpiring = daysLeft <= 1;

                                return (
                                    <div
                                        key={service.id}
                                        className="bg-surface border border-white/5 rounded-2xl p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-white font-medium truncate">
                                                    {service.title}
                                                </h3>
                                                <p className="text-sm text-text-secondary">
                                                    {new Date(service.date).toLocaleDateString('uk-UA', {
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric'
                                                    })}
                                                    {service.time && ` о ${service.time}`}
                                                </p>
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
                                                    onClick={() => handleRestore(service.id)}
                                                    disabled={actionLoading === service.id}
                                                    className="p-3 bg-green-500/10 text-green-400 rounded-xl hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                                    title="Відновити"
                                                >
                                                    <RotateCcw className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(service.id)}
                                                    disabled={actionLoading === service.id}
                                                    className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                    title="Видалити назавжди"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                        {service.songs.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-white/5">
                                                <p className="text-xs text-text-secondary">
                                                    {service.songs.length} {service.songs.length === 1 ? 'пісня' : service.songs.length < 5 ? 'пісні' : 'пісень'}
                                                </p>
                                            </div>
                                        )}
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
                message="Це служіння буде видалено без можливості відновлення."
                confirmLabel="Видалити"
                isDestructive
                onConfirm={() => confirmDelete && handlePermanentDelete(confirmDelete)}
                onClose={() => setConfirmDelete(null)}
            />
        </div>
    );
}
