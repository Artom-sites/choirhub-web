"use client";

import { useEffect, useState } from "react";
import { X, RotateCcw, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { getDeletedLocalSongs, restoreLocalSong, permanentDeleteLocalSong } from "../lib/db";
import { LocalSong } from "@/types";
import ConfirmationModal from "./ConfirmationModal"; // Assuming ConfirmationModal is in the same directory or accessible
import Toast from "./Toast";

interface TrashBinModalProps {
    choirId: string;
    isOpen: boolean;
    onClose: () => void;
    onRestore: () => void; // Trigger refresh of main list
}

export default function TrashBinModal({ choirId, isOpen, onClose, onRestore }: TrashBinModalProps) {
    const [deletedSongs, setDeletedSongs] = useState<LocalSong[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [songIdToDeletePermanently, setSongIdToDeletePermanently] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadDeletedSongs();
        }
    }, [isOpen, choirId]);

    const loadDeletedSongs = async () => {
        setIsLoading(true);
        try {
            const songs = await getDeletedLocalSongs(choirId);
            setDeletedSongs(songs);
        } catch (error) {
            console.error("Failed to load trash:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (songId?: string) => {
        if (!songId) return;
        setActionLoading(songId);
        try {
            await restoreLocalSong(choirId, songId);
            setDeletedSongs(prev => prev.filter(s => s.id !== songId));
            onRestore();
        } catch (error) {
            console.error("Failed to restore:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteForeverClick = (songId: string) => {
        setSongIdToDeletePermanently(songId);
        setShowConfirmDeleteModal(true);
    };

    const confirmPermanentDelete = async () => {
        if (!songIdToDeletePermanently) return;

        setActionLoading(songIdToDeletePermanently);
        try {
            await permanentDeleteLocalSong(choirId, songIdToDeletePermanently);
            setDeletedSongs(prev => prev.filter(s => s.id !== songIdToDeletePermanently));
        } catch (error) {
            console.error("Failed to delete forever:", error);
        } finally {
            setActionLoading(null);
            setSongIdToDeletePermanently(null);
            setShowConfirmDeleteModal(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#18181b] rounded-2xl w-full max-w-lg overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2 text-red-400">
                        <Trash2 className="w-5 h-5" />
                        <h2 className="font-bold text-lg text-white">Кошик</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                        </div>
                    ) : deletedSongs.length === 0 ? (
                        <div className="text-center py-10 text-text-secondary">
                            <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Кошик порожній</p>
                        </div>
                    ) : (
                        deletedSongs.map(song => (
                            <div key={song.id} className="bg-white/5 p-3 rounded-xl flex items-center justify-between border border-white/5 hover:border-white/10 transition-all">
                                <div>
                                    <h4 className="font-medium text-white">{song.title}</h4>
                                    <p className="text-xs text-text-secondary">
                                        Видалено: {song.deletedAt ? new Date(song.deletedAt).toLocaleDateString() : '???'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => song.id && handleRestore(song.id)}
                                        disabled={!song.id || actionLoading === song.id}
                                        className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors"
                                        title="Відновити"
                                    >
                                        {actionLoading === song.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => song.id && handleDeleteForeverClick(song.id)}
                                        disabled={!song.id}
                                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                                        title="Видалити назавжди"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <ConfirmationModal
                    isOpen={showConfirmDeleteModal}
                    onClose={() => setShowConfirmDeleteModal(false)}
                    onConfirm={confirmPermanentDelete}
                    title="Видалити назавжди?"
                    message="Цю дію неможливо скасувати. Пісня зникне назавжди."
                    confirmLabel="Видалити"
                    isDestructive={true}
                />

                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}

                {/* Footer */}
                <div className="p-4 bg-white/5 text-xs text-text-secondary text-center">
                    Пісні у кошику зберігаються 30 днів (поки що безстроково 😉).
                </div>
            </div>
        </div >
    );
}
