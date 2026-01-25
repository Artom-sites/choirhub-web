"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus, Loader2, Upload, Check, ChevronDown, Trash2 } from "lucide-react";
import { SimpleSong } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { updateDoc, doc, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";


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

    const [showAllCategories, setShowAllCategories] = useState(false);
    const [showAllConductors, setShowAllConductors] = useState(false);

    // Combine static and known categories
    const allCategories = Array.from(new Set([...CATEGORIES, ...(knownCategories || [])]));
    // Combine given regents and known conductors
    // Flatten and normalize regents
    const normalizedRegents = Array.from(new Set(regents.map(r => r.trim())));

    // Filter knownConductors to remove duplicates that are already in regents, case-insensitive
    const uniqueKnownConductors = (knownConductors || [])
        .map(c => c.trim())
        .filter(c => !normalizedRegents.some(r => r.toLowerCase() === c.toLowerCase()))
        .filter((c, index, self) => self.indexOf(c) === index); // Dedupe self

    // Combined list for display
    // const allConductors = [...normalizedRegents, ...uniqueKnownConductors]; // We'll keep them separate for UI distinction if needed, or merge. 
    // User wants "clean selection", so merging is fine but we need to know which ones can be deleted (knownConductors).
    const allConductors = [...normalizedRegents, ...uniqueKnownConductors];

    useEffect(() => {
        if (allConductors.length > 0 && !conductor) {
            setConductor(allConductors[0]);
        } else if (allConductors.length === 0 && !showCustomInput) {
            setShowCustomInput(true);
        }
    }, [allConductors, conductor, showCustomInput]);

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

            handleClose();
        } catch (err) {
            setError("Помилка додавання. Спробуйте ще раз.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setTitle("");
        setCategory(allCategories[0] || "Інші");
        setConductor(allConductors[0] || "");
        setCustomConductor("");
        setShowCustomInput(allConductors.length === 0);
        setPdfFile(null);
        setError("");
        onClose();
    };

    // Helper to delete conductor/regent from list
    const handleDeleteConductor = async (name: string) => {
        if (!userData?.choirId) return;
        if (!confirm(`Видалити "${name}" зі списку диригентів?`)) return;

        try {
            const { removeKnownConductor } = await import("@/lib/db");

            // Try removing from knownConductors first
            if (uniqueKnownConductors.includes(name)) {
                await removeKnownConductor(userData.choirId, name);
            }
            // If strictly in regents list (old legacy name)
            else if (regents.includes(name)) {
                // We need to manually remove from 'regents' array
                const choirRef = doc(db, "choirs", userData.choirId);
                await updateDoc(choirRef, {
                    regents: arrayRemove(name)
                });
            }

            // Force reload to refresh props
            window.location.reload();
        } catch (e) {
            console.error("Failed to delete conductor:", e);
            alert("Помилка видалення");
        }
    };

    const canManageList = userData?.role === 'head' || userData?.role === 'regent';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-[#18181b] w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl shadow-2xl overflow-auto border-x-0 sm:border border-white/10 animate-in slide-in-from-bottom duration-300 flex flex-col sm:block">
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
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            Категорія
                        </label>
                        {!showCustomCategory && allCategories.length > 0 ? (
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {(showAllCategories ? allCategories : allCategories.slice(0, 8)).map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setCategory(cat)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${category === cat
                                                ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                                                : 'bg-white/5 text-text-secondary border-white/5 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomCategory(true)}
                                        className="px-4 py-2 rounded-full text-sm font-medium transition-all bg-white/5 text-text-secondary border border-dashed border-white/20 hover:bg-white/10 hover:text-white flex items-center gap-1.5"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Своя
                                    </button>
                                </div>

                                {allCategories.length > 8 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllCategories(!showAllCategories)}
                                        className="text-xs font-medium text-text-secondary hover:text-white flex items-center gap-1 transition-colors ml-1"
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
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {(showAllConductors ? allConductors : allConductors.slice(0, 8)).map(r => {
                                        return (
                                            <div key={r} className={`group relative inline-flex items-center gap-1 pr-1 rounded-full border transition-all ${conductor === r
                                                ? 'bg-white border-white text-black shadow-lg shadow-white/10'
                                                : 'bg-white/5 border-white/5 text-text-secondary hover:bg-white/10'
                                                }`}>
                                                <button
                                                    type="button"
                                                    onClick={() => setConductor(r)}
                                                    className="pl-3 pr-2 py-2 text-sm font-medium flex items-center gap-2"
                                                >
                                                    <span>{r}</span>
                                                </button>

                                                {canManageList && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteConductor(r);
                                                        }}
                                                        className={`w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors ${conductor === r ? 'text-black/50 hover:text-red-500' : 'text-white/30 hover:text-red-400'}`}
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomInput(true)}
                                        className="px-4 py-2 rounded-full text-sm font-medium transition-all bg-white/5 text-text-secondary border border-dashed border-white/20 hover:bg-white/10 hover:text-white flex items-center gap-1.5"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Інший
                                    </button>
                                </div>

                                {allConductors.length > 8 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllConductors(!showAllConductors)}
                                        className="text-xs font-medium text-text-secondary hover:text-white flex items-center gap-1 transition-colors ml-1"
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
