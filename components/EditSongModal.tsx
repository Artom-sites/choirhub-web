"use client";

import { useState, useEffect } from "react";
import { X, Plus, Loader2, Save, Check, ChevronDown } from "lucide-react";
import { SimpleSong } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

interface EditSongModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: Partial<SimpleSong>) => Promise<void>;
    initialData: SimpleSong;
    regents: string[];
    knownConductors: string[];
    knownCategories: string[];
}

const CATEGORIES = [
    "Різдво", "Пасха", "В'їзд", "Вечеря", "Вознесіння", "Трійця", "Свято Жнив", "Інші"
];

export default function EditSongModal({
    isOpen,
    onClose,
    onSave,
    initialData,
    regents,
    knownConductors,
    knownCategories
}: EditSongModalProps) {
    const { userData } = useAuth();

    const [title, setTitle] = useState(initialData.title);
    const [category, setCategory] = useState(initialData.category);
    const [conductor, setConductor] = useState(initialData.conductor || "");

    const [customCategory, setCustomCategory] = useState("");
    const [showCustomCategory, setShowCustomCategory] = useState(false);

    const [customConductor, setCustomConductor] = useState("");
    const [showCustomInput, setShowCustomInput] = useState(false);

    const [showAllCategories, setShowAllCategories] = useState(false);
    const [showAllConductors, setShowAllConductors] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Combine static and known categories
    const allCategories = Array.from(new Set([...CATEGORIES, ...(knownCategories || [])]));
    // Combine given regents and known conductors
    const normalizedRegents = Array.from(new Set(regents.map(r => r.trim())));
    const uniqueKnownConductors = (knownConductors || [])
        .map(c => c.trim())
        .filter(c => !normalizedRegents.some(r => r.toLowerCase() === c.toLowerCase()))
        .filter((c, index, self) => self.indexOf(c) === index);

    const allConductors = [...normalizedRegents, ...uniqueKnownConductors];

    // Initialize custom inputs if current value is not in lists
    useEffect(() => {
        if (!allCategories.includes(category) && category) {
            setCustomCategory(category);
            setShowCustomCategory(true);
        }
        if (conductor && !allConductors.includes(conductor)) {
            setCustomConductor(conductor);
            setShowCustomInput(true);
        }
    }, []);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError("Введіть назву пісні");
            return;
        }

        let finalCategory = category;
        if (showCustomCategory && customCategory.trim()) {
            finalCategory = customCategory.trim();
        } else if (showCustomCategory && !customCategory.trim()) {
            setError("Введіть назву нової категорії");
            return;
        }

        let finalConductor = conductor;
        if (showCustomInput && customConductor.trim()) {
            finalConductor = customConductor.trim();
        } else if (showCustomInput && !customConductor.trim()) {
            setError("Введіть ім'я диригента");
            return;
        }

        if (!finalConductor) {
            setError("Оберіть або введіть диригента");
            return;
        }
        if (!finalCategory) {
            setError("Оберіть або введіть категорію");
            return;
        }

        setLoading(true);
        setError("");

        try {
            await onSave({
                title: title.trim(),
                category: finalCategory,
                conductor: finalConductor,
            });

            // Save custom category if used
            if (showCustomCategory && customCategory.trim() && userData?.choirId) {
                try {
                    const { addKnownCategory } = await import("@/lib/db");
                    await addKnownCategory(userData.choirId, customCategory.trim());
                } catch (e) { console.error("Failed to add custom category:", e); }
            }

            // Save custom conductor if used
            if (showCustomInput && customConductor.trim() && userData?.choirId) {
                const isKnown = allConductors.includes(customConductor.trim());
                if (!isKnown) {
                    try {
                        const { addKnownConductor } = await import("@/lib/db");
                        await addKnownConductor(userData.choirId, customConductor.trim());
                    } catch (e) { console.error("Failed to add custom conductor:", e); }
                }
            }

            onClose();
        } catch (err) {
            setError("Помилка збереження. Спробуйте ще раз.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-[#18181b] w-full h-[100dvh] sm:h-auto sm:max-h-[85vh] sm:max-w-md sm:rounded-3xl shadow-2xl overflow-auto border-x-0 sm:border border-white/10 animate-in slide-in-from-bottom duration-300 flex flex-col sm:block">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#18181b] z-10">
                    <h2 className="text-xl font-bold text-white">Редагувати пісню</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            Назва пісні *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Введіть назву..."
                            className="w-full px-4 py-3.5 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 text-white placeholder:text-text-secondary/40 transition-all font-medium"
                        />
                    </div>

                    {/* Category */}
                    <div className="relative">
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            Категорія
                        </label>
                        {!showCustomCategory && allCategories.length > 0 ? (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    {(showAllCategories ? allCategories : allCategories.slice(0, 6)).map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setCategory(cat)}
                                            className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left truncate ${category === cat
                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                                                : 'bg-black/20 text-text-secondary border border-white/10 hover:bg-white/5'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomCategory(true)}
                                        className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left bg-black/20 text-text-secondary border border-dashed border-white/20 hover:bg-white/5 flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Своя...
                                    </button>
                                </div>

                                {allCategories.length > 6 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllCategories(!showAllCategories)}
                                        className="w-full py-2 text-xs font-medium text-text-secondary hover:text-white flex items-center justify-center gap-1 transition-colors"
                                    >
                                        {showAllCategories ? (
                                            <>
                                                <ChevronDown className="w-3 h-3 rotate-180" />
                                                Згорнути
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="w-3 h-3" />
                                                Показати всі ({allCategories.length})
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    placeholder="Назва категорії"
                                    className="w-full px-4 py-3.5 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 text-white placeholder:text-text-secondary/40 transition-all font-medium"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCustomCategory(false)}
                                    className="text-xs text-blue-400 hover:text-blue-300 font-medium pl-1"
                                >
                                    Назад до списку
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Conductor */}
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            Хто диригує
                        </label>

                        {!showCustomInput && allConductors.length > 0 ? (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    {(showAllConductors ? allConductors : allConductors.slice(0, 6)).map(r => {
                                        return (
                                            <div key={r} className={`group relative flex items-stretch rounded-xl transition-all border ${conductor === r
                                                ? 'bg-blue-500/20 border-blue-500/50'
                                                : 'bg-black/20 border-white/10 hover:bg-white/5'
                                                }`}>
                                                <button
                                                    type="button"
                                                    onClick={() => setConductor(r)}
                                                    className={`flex-1 px-3 py-2.5 text-sm font-medium text-left truncate flex items-center gap-2 ${conductor === r ? 'text-blue-400' : 'text-text-secondary'}`}
                                                >
                                                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/70 font-bold shrink-0">
                                                        {r[0]?.toUpperCase()}
                                                    </div>
                                                    <span className="truncate">{r}</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomInput(true)}
                                        className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left bg-black/20 text-text-secondary border border-dashed border-white/20 hover:bg-white/5 flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Інший...
                                    </button>
                                </div>

                                {allConductors.length > 6 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllConductors(!showAllConductors)}
                                        className="w-full py-2 text-xs font-medium text-text-secondary hover:text-white flex items-center justify-center gap-1 transition-colors"
                                    >
                                        {showAllConductors ? (
                                            <>
                                                <ChevronDown className="w-3 h-3 rotate-180" />
                                                Згорнути
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="w-3 h-3" />
                                                Показати всі ({allConductors.length})
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={customConductor}
                                    onChange={(e) => setCustomConductor(e.target.value)}
                                    placeholder="Ім'я диригента"
                                    className="w-full px-4 py-3.5 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 text-white placeholder:text-text-secondary/40 transition-all font-medium"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCustomInput(false)}
                                    className="text-xs text-blue-400 hover:text-blue-300 font-medium pl-1"
                                >
                                    Назад до списку
                                </button>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm border border-red-500/20 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !title.trim()}
                        className="w-full py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base transition-all shadow-lg active:scale-[0.98] mt-6"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Збереження...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Зберегти зміни
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
