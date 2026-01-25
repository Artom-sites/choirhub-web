"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus, Loader2, Upload, Check, UserPlus, ChevronDown } from "lucide-react";
import { SimpleSong } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

interface AddSongModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (song: Omit<SimpleSong, 'id' | 'addedBy' | 'addedAt'>, pdfFile?: File) => Promise<void>;
    regents: string[];
    knownConductors: string[];
    knownCategories: string[];
}

const CATEGORIES = [
    "Різдво", "Пасха", "В'їзд", "Вечеря", "Вознесіння", "Трійця", "Свято Жнив", "Інші"
];

export default function AddSongModal({ isOpen, onClose, onAdd, regents, knownConductors, knownCategories }: AddSongModalProps) {
    const { userData } = useAuth();

    const [title, setTitle] = useState("");
    const [category, setCategory] = useState(""); // Initialize as empty, will be set by useEffect
    const [conductor, setConductor] = useState(""); // Initialize as empty, will be set by useEffect
    const [customConductor, setCustomConductor] = useState("");
    const [showCustomInput, setShowCustomInput] = useState(false);

    const [showCustomCategory, setShowCustomCategory] = useState(false);
    const [customCategory, setCustomCategory] = useState("");

    // Combine static and known categories
    const allCategories = Array.from(new Set([...CATEGORIES, ...(knownCategories || [])]));
    // Combine given regents and known conductors
    const allConductors = Array.from(new Set([...regents, ...(knownConductors || [])]));

    useEffect(() => {
        if (allConductors.length > 0 && !conductor) {
            setConductor(allConductors[0]);
        }
        if (allConductors.length === 0) {
            setShowCustomInput(true);
        }
    }, [allConductors, conductor]);

    // Set default category if not set
    useEffect(() => {
        if (!category && allCategories.length > 0) {
            setCategory(allCategories[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allCategories]);

    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            setError("Тільки PDF файли дозволені");
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setError("Файл занадто великий (макс. 50 MB)");
            return;
        }

        setPdfFile(file);
        setError("");
        // No Base64 conversion needed for direct upload
    };

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
            await onAdd({
                title: title.trim(),
                category: finalCategory,
                conductor: finalConductor,
                hasPdf: !!pdfFile,
            }, pdfFile || undefined);

            // Save custom category if used
            if (showCustomCategory && customCategory.trim() && userData?.choirId) { // Use userData.id for choirId if it's the user's choir
                try {
                    const { addKnownCategory } = await import("@/lib/db"); // Assuming this path is correct
                    await addKnownCategory(userData.choirId, customCategory.trim()); // Assuming choirId is user.id or similar
                } catch (e) { console.error("Failed to add custom category:", e); }
            }

            // Reset form
            setTitle("");
            setCategory(allCategories[0] || "");
            setCustomCategory("");
            setShowCustomCategory(false);
            setConductor(allConductors[0] || "");
            setCustomConductor("");
            setShowCustomInput(allConductors.length === 0);
            setPdfFile(null);
            onClose();
        } catch (err) {
            setError("Помилка додавання. Спробуйте ще раз.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setTitle("");
        setCategory("Інші");
        setConductor(allConductors[0] || "");
        setCustomConductor("");
        setShowCustomInput(allConductors.length === 0);
        setPdfFile(null);
        setError("");
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-[#18181b] w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-auto border border-white/10 animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#18181b] z-10">
                    <h2 className="text-xl font-bold text-white">Нова пісня</h2>
                    <button
                        onClick={handleClose}
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
                            autoFocus
                        />
                    </div>

                    {/* Category */}
                    <div className="relative">
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            Категорія
                        </label>
                        {!showCustomCategory && allCategories.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pr-1">
                                {allCategories.map(cat => (
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
                            <div className="space-y-3">
                                {/* Custom Button List */}
                                <div className="bg-black/20 border border-white/10 rounded-2xl p-1.5 space-y-1 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                    {allConductors.map(r => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setConductor(r)}
                                            className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${conductor === r
                                                ? 'bg-white/10 border border-white/20'
                                                : 'hover:bg-white/5 border border-transparent'
                                                }`}
                                        >
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${conductor === r
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white/10 text-text-secondary'
                                                }`}>
                                                {r.charAt(0).toUpperCase()}
                                            </div>
                                            <span className={`font-medium ${conductor === r ? 'text-white' : 'text-text-secondary'}`}>
                                                {r}
                                            </span>
                                            {conductor === r && (
                                                <Check className="w-4 h-4 text-blue-400 ml-auto" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCustomInput(true)}
                                    className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-all pl-2 font-medium"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    Вписати іншого
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={customConductor}
                                    onChange={(e) => setCustomConductor(e.target.value)}
                                    placeholder="Ім'я диригента"
                                    className="w-full px-4 py-3.5 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 text-white placeholder:text-text-secondary/40 transition-all font-medium"
                                />
                                {allConductors.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomInput(false)}
                                        className="text-xs text-text-secondary hover:text-white transition-colors pl-1 font-medium"
                                    >
                                        ← Обрати зі списку
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PDF Upload */}
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            PDF файл
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {pdfFile ? (
                            <div className="flex items-center gap-4 p-4 border border-white/10 bg-white/5 rounded-2xl relative group">
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 text-white">
                                    <Check className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate text-white">{pdfFile.name}</p>
                                    <p className="text-xs text-text-secondary">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPdfFile(null);
                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-xl transition-colors text-text-secondary hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-8 border border-dashed border-white/10 bg-white/5 rounded-2xl hover:bg-white/10 hover:border-white/30 transition-all flex flex-col items-center justify-center gap-3 group"
                            >
                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                    <Upload className="w-5 h-5 text-text-secondary group-hover:text-white" />
                                </div>
                                <span className="font-medium text-sm text-text-secondary group-hover:text-white">Натисніть щоб обрати PDF</span>
                            </button>
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
                                Додавання...
                            </>
                        ) : (
                            <>
                                <Plus className="w-5 h-5" />
                                Додати пісню
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
