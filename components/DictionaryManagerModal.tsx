"use client";

import { useEffect, useState } from "react";
import { X, Trash2, Search, Loader2 } from "lucide-react";
import { Dialog as CapDialog } from "@capacitor/dialog";
import { Capacitor } from "@capacitor/core";

interface DictionaryManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: string[];
    onDelete: (item: string) => Promise<void>;
}

export default function DictionaryManagerModal({
    isOpen,
    onClose,
    title,
    items,
    onDelete
}: DictionaryManagerModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [deletingItem, setDeletingItem] = useState<string | null>(null);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            setSearchQuery(""); // Reset search on open
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const filteredItems = items.filter(item =>
        item.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => a.localeCompare(b, 'uk-UA'));

    const handleDelete = async (item: string) => {
        // Confirm deletion
        if (Capacitor.isNativePlatform()) {
            const { value } = await CapDialog.confirm({
                title: 'Видалити пункт?',
                message: `Видаляємо "${item}" зі словника?`,
                okButtonTitle: 'Видалити',
                cancelButtonTitle: 'Скасувати'
            });
            if (!value) return;
        } else {
            if (!window.confirm(`Видаляємо "${item}" зі словника?`)) return;
        }

        setDeletingItem(item);
        try {
            await onDelete(item);
        } catch (error) {
            console.error("Failed to delete item from dictionary:", error);
        } finally {
            setDeletingItem(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
            <div
                className="bg-surface w-full sm:max-w-md h-[80vh] sm:h-[600px] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 pointer-events-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-surface/95 backdrop-blur-md z-10">
                    <h3 className="text-lg font-bold text-text-primary px-2">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-highlight rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-border bg-surface-highlight/30">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                        <input
                            type="text"
                            placeholder="Пошук..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-surface border border-border/80 text-text-primary text-[15px] rounded-xl pl-9 pr-4 py-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                        />
                    </div>
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-3">
                            <div className="w-12 h-12 rounded-full bg-surface-highlight flex items-center justify-center">
                                <Search className="w-5 h-5" />
                            </div>
                            <p className="text-sm font-medium">Словник порожній</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <p className="text-center text-sm text-text-secondary py-8 font-medium">Нічого не знайдено за запитом "{searchQuery}"</p>
                    ) : (
                        <div className="space-y-2">
                            {filteredItems.map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-3 bg-surface-highlight/40 hover:bg-surface-highlight border border-border/40 hover:border-border/80 rounded-2xl transition-all"
                                >
                                    <span className="text-[15px] font-medium text-text-primary pl-1 truncate">
                                        {item}
                                    </span>

                                    <button
                                        onClick={() => handleDelete(item)}
                                        disabled={deletingItem === item}
                                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all flex-shrink-0 ${deletingItem === item
                                                ? 'bg-surface-highlight text-text-secondary cursor-not-allowed'
                                                : 'text-red-400 hover:text-white hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/20'
                                            }`}
                                        title="Видалити"
                                    >
                                        {deletingItem === item ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
