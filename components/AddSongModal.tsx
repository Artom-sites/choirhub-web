"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus, Loader2, Upload, Check, ChevronDown, Trash2, User, Library, Search, FileText } from "lucide-react";
import { SimpleSong } from "@/types";
import { CATEGORIES } from "@/lib/themes";
import { useAuth } from "@/contexts/AuthContext";
import { updateDoc, doc, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ConfirmationModal from "./ConfirmationModal";
import { Dialog } from '@capacitor/dialog';

// ... imports

interface AddSongModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (song: Omit<SimpleSong, 'id' | 'addedBy' | 'addedAt'>, pdfFiles?: { name: string; file: File }[]) => Promise<void>;
    regents: string[];
    knownConductors: string[];
    knownCategories: string[];
    knownPianists: string[];
    onSearchArchive?: (query: string) => void;
}

export default function AddSongModal({ isOpen, onClose, onAdd, regents, knownConductors, knownCategories, knownPianists, onSearchArchive }: AddSongModalProps) {
    const { userData } = useAuth();

    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("Інші");
    const [showCustomCategory, setShowCustomCategory] = useState(false);
    const [customCategory, setCustomCategory] = useState("");
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);

    const [conductor, setConductor] = useState("");
    const [customConductor, setCustomConductor] = useState("");
    const [showCustomInput, setShowCustomInput] = useState(false);

    // Pianist State
    const [pianist, setPianist] = useState("");
    const [customPianist, setCustomPianist] = useState("");
    const [showCustomPianist, setShowCustomPianist] = useState(false);
    const [isPianistDropdownOpen, setIsPianistDropdownOpen] = useState(false);
    const pianistDropdownRef = useRef<HTMLDivElement>(null);

    const [pdfFiles, setPdfFiles] = useState<{ name: string; file: File }[]>([]);
    const [loading, setLoading] = useState(false);
    const addFileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState(""); // State for error messages

    // Conductor Dropdown State
    const [isConductorDropdownOpen, setIsConductorDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Delete Confirmation State
    const [conductorToDelete, setConductorToDelete] = useState<string | null>(null);
    const [pianistToDelete, setPianistToDelete] = useState<string | null>(null);

    // ... existing useEffects ...

    // Computed values
    const allCategories = Array.from(new Set([...(knownCategories || []), ...CATEGORIES]));
    // Combine known conductors and regents
    const allConductors = Array.from(new Set([...(knownConductors || []), ...(regents || [])]));

    const canManageList = userData?.permissions?.includes('manage_services') || userData?.role === 'head' || userData?.role === 'regent';

    // Close dropdowns on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsConductorDropdownOpen(false);
            }
            if (pianistDropdownRef.current && !pianistDropdownRef.current.contains(event.target as Node)) {
                setIsPianistDropdownOpen(false);
            }
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
                setIsCategoryDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    // ... existing handleSubmit ... but needs updates ...

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

        setLoading(true);
        setError("");

        try {
            // Save custom category
            if (showCustomCategory && customCategory.trim() && userData?.choirId) {
                try {
                    const { addKnownCategory } = await import("@/lib/db");
                    await addKnownCategory(userData.choirId, customCategory.trim());
                } catch (e) { console.error("Failed to add custom category:", e); }
            }

            // Save custom conductor
            if (showCustomInput && customConductor.trim() && userData?.choirId) {
                const isKnown = allConductors.includes(customConductor.trim());
                if (!isKnown) {
                    try {
                        const { addKnownConductor } = await import("@/lib/db");
                        await addKnownConductor(userData.choirId, customConductor.trim());
                    } catch (e) { console.error("Failed to add custom conductor:", e); }
                }
            }

            // Handle pianist
            let finalPianist = pianist;
            if (showCustomPianist && customPianist.trim()) {
                finalPianist = customPianist.trim();
                if (userData?.choirId && !knownPianists.includes(finalPianist)) {
                    try {
                        const { addKnownPianist } = await import("@/lib/db");
                        await addKnownPianist(userData.choirId, finalPianist);
                    } catch (e) { console.error("Failed to add custom pianist:", e); }
                }
            }

            await onAdd({
                title: title.trim(),
                category: finalCategory,
                conductor: finalConductor,
                pianist: finalPianist || undefined,
                hasPdf: pdfFiles.length > 0,
            }, pdfFiles.length > 0 ? pdfFiles : undefined);

            handleClose();
        } catch (err: any) {
            setError(err.message || "Помилка додавання. Спробуйте ще раз.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setTitle("");
        setCategory("Інші");
        setConductor(allConductors[0] || "");
        setPianist("");
        setCustomConductor("");
        setCustomPianist("");
        setCustomCategory("");
        setShowCustomInput(allConductors.length === 0);
        setShowCustomPianist(false);
        setShowCustomCategory(false);
        setPdfFiles([]);
        setError("");
        onClose();
    };

    const handleConductorDeleteClick = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setConductorToDelete(name);
    };


    const confirmDeleteConductor = async () => {
        if (!conductorToDelete || !userData?.choirId) return;

        try {
            const { removeKnownConductor } = await import("@/lib/db");
            await removeKnownConductor(userData.choirId, conductorToDelete);
            // Clear conductor selection if deleted
            if (conductor === conductorToDelete) {
                setConductor("");
            }
        } catch (e) {
            console.error("Failed to delete conductor:", e);
            await Dialog.alert({ title: "Помилка", message: "Помилка видалення" });
        } finally {
            setConductorToDelete(null);
        }
    };

    const handlePianistDeleteClick = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPianistToDelete(name);
    };

    const confirmDeletePianist = async () => {
        if (!pianistToDelete || !userData?.choirId) return;

        try {
            const { removeKnownPianist } = await import("@/lib/db");
            await removeKnownPianist(userData.choirId, pianistToDelete);
            // Clear pianist selection if deleted
            if (pianist === pianistToDelete) {
                setPianist("");
            }
        } catch (e) {
            console.error("Failed to delete pianist:", e);
            await Dialog.alert({ title: "Помилка", message: "Помилка видалення" });
        } finally {
            setPianistToDelete(null);
        }
    };

    // ... existing delete logic ...

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-[60] animate-in fade-in duration-200">
                <div className="bg-surface w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl shadow-2xl overflow-hidden border-x-0 sm:border border-border animate-in slide-in-from-bottom duration-300 flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] border-b border-border bg-surface z-10 shrink-0">
                        <h2 className="text-xl font-bold text-text-primary">Нова пісня</h2>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-surface-highlight rounded-full transition-colors text-text-secondary hover:text-text-primary"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Form Container - Scrollable */}
                    <div className="flex-1 overflow-y-auto">
                        <form onSubmit={handleSubmit} className="p-6 space-y-6 pb-safe-offset">
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
                                    className="w-full px-4 py-3.5 bg-surface-highlight border border-border rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 text-text-primary placeholder:text-text-secondary/40 transition-all font-medium"
                                    autoFocus
                                />
                            </div>

                            {/* Category (Theme) */}
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                    Категорія (Тематика)
                                </label>
                                {
                                    !showCustomCategory ? (
                                        <div className="relative" ref={categoryDropdownRef}>
                                            <button
                                                type="button"
                                                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                                className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl flex items-center justify-between hover:bg-surface transition-all group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-medium ${category ? 'text-text-primary' : 'text-text-secondary'}`}>
                                                        {category || "Оберіть категорію..."}
                                                    </span>
                                                </div>
                                                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isCategoryDropdownOpen && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-2xl max-h-60 overflow-y-auto z-20 animate-in fade-in zoom-in-95 duration-100">
                                                    {allCategories.map(cat => (
                                                        <div
                                                            key={cat}
                                                            onClick={() => {
                                                                setCategory(cat);
                                                                setIsCategoryDropdownOpen(false);
                                                            }}
                                                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-surface-highlight cursor-pointer transition-colors ${category === cat ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                                        >
                                                            <span className="text-sm font-medium">{cat}</span>
                                                        </div>
                                                    ))}
                                                    <div
                                                        onClick={() => {
                                                            setShowCustomCategory(true);
                                                            setIsCategoryDropdownOpen(false);
                                                        }}
                                                        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-surface-highlight cursor-pointer text-primary border-t border-border"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        <span className="text-sm font-medium">Своя категорія...</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={customCategory}
                                                onChange={(e) => setCustomCategory(e.target.value)}
                                                placeholder="Назва категорії"
                                                className="w-full px-4 py-3.5 bg-surface-highlight border border-border rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 text-text-primary placeholder:text-text-secondary/40 transition-all font-medium"
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
                                    )
                                }
                            </div >

                            {/* Conductor */}
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                    Диригент *
                                </label>
                                {
                                    !showCustomInput ? (
                                        <div className="relative" ref={dropdownRef}>
                                            <button
                                                type="button"
                                                onClick={() => setIsConductorDropdownOpen(!isConductorDropdownOpen)}
                                                className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl flex items-center justify-between hover:bg-surface transition-all group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
                                                    <span className={`text-sm font-medium ${conductor ? 'text-text-primary' : 'text-text-secondary'}`}>
                                                        {conductor || "Оберіть диригента..."}
                                                    </span>
                                                </div>
                                                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isConductorDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isConductorDropdownOpen && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-2xl max-h-60 overflow-y-auto z-20 animate-in fade-in zoom-in-95 duration-100">
                                                    {allConductors.map(c => (
                                                        <div
                                                            key={c}
                                                            onClick={() => {
                                                                setConductor(c);
                                                                setIsConductorDropdownOpen(false);
                                                            }}
                                                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-surface-highlight cursor-pointer transition-colors ${conductor === c ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                                        >
                                                            <span className="text-sm font-medium">{c}</span>
                                                            {canManageList && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handleConductorDeleteClick(c, e)}
                                                                    className="p-1.5 hover:bg-red-500/20 text-text-secondary hover:text-red-400 rounded-lg transition-colors z-30"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <div
                                                        onClick={() => {
                                                            setShowCustomInput(true);
                                                            setIsConductorDropdownOpen(false);
                                                        }}
                                                        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-surface-highlight cursor-pointer text-primary border-t border-border"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        <span className="text-sm font-medium">Інший...</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={customConductor}
                                                onChange={(e) => setCustomConductor(e.target.value)}
                                                placeholder="Ім'я диригента"
                                                className="w-full px-4 py-3.5 bg-surface-highlight border border-border rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 text-text-primary placeholder:text-text-secondary/40 transition-all font-medium"
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
                                    )
                                }
                            </div>

                            {/* Pianist */}
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                    Піаніст
                                </label>

                                {!showCustomPianist ? (
                                    <div className="relative" ref={pianistDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setIsPianistDropdownOpen(!isPianistDropdownOpen)}
                                            className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl flex items-center justify-between hover:bg-surface transition-all group"
                                        >
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
                                                <span className={`text-sm font-medium ${pianist ? 'text-text-primary' : 'text-text-secondary'}`}>
                                                    {pianist || "Оберіть піаніста (опціонально)..."}
                                                </span>
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isPianistDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {isPianistDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-2xl max-h-60 overflow-y-auto z-20 animate-in fade-in zoom-in-95 duration-100">
                                                <div
                                                    onClick={() => {
                                                        setPianist("");
                                                        setIsPianistDropdownOpen(false);
                                                    }}
                                                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-surface-highlight cursor-pointer transition-colors ${!pianist ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                                >
                                                    <span className="text-sm font-medium italic">Без піаніста</span>
                                                </div>
                                                {(knownPianists || []).map(p => (
                                                    <div
                                                        key={p}
                                                        onClick={() => {
                                                            setPianist(p);
                                                            setIsPianistDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-surface-highlight cursor-pointer transition-colors ${pianist === p ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                                    >
                                                        <span className="text-sm font-medium">{p}</span>
                                                        {canManageList && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handlePianistDeleteClick(p, e)}
                                                                className="p-1.5 hover:bg-red-500/20 text-text-secondary hover:text-red-400 rounded-lg transition-colors z-30"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                <div
                                                    onClick={() => {
                                                        setShowCustomPianist(true);
                                                        setIsPianistDropdownOpen(false);
                                                    }}
                                                    className="w-full px-4 py-3 flex items-center gap-2 hover:bg-surface-highlight cursor-pointer text-primary border-t border-border"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    <span className="text-sm font-medium">Інший піаніст...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={customPianist}
                                            onChange={(e) => setCustomPianist(e.target.value)}
                                            placeholder="Ім'я піаніста"
                                            className="w-full px-4 py-3.5 bg-surface-highlight border border-border rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 text-text-primary placeholder:text-text-secondary/40 transition-all font-medium"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCustomPianist(false)}
                                            className="text-xs text-primary hover:text-primary/80 font-medium pl-1"
                                        >
                                            Назад до списку
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* PDF Files (Parts) */}
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                    PDF Файли (опціонально)
                                </label>

                                {/* Added files list */}
                                {pdfFiles.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                        {pdfFiles.map((pf, idx) => (
                                            <div key={idx} className="flex items-center gap-2 px-3 py-2.5 bg-surface-highlight rounded-xl border border-border">
                                                <FileText className="w-4 h-4 text-primary shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-text-primary truncate">{pf.name}</p>
                                                    <p className="text-xs text-text-secondary truncate">{pf.file.name} · {(pf.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setPdfFiles(prev => prev.filter((_, i) => i !== idx))}
                                                    className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <input
                                    ref={addFileInputRef}
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const defaultName = pdfFiles.length === 0 ? 'Головна' : '';
                                            const name = pdfFiles.length === 0
                                                ? defaultName
                                                : (prompt('Назва партії (напр. Сопрано, Альт):') || '').trim();
                                            if (pdfFiles.length === 0 || name) {
                                                setPdfFiles(prev => [...prev, { name: name || 'Головна', file }]);
                                            }
                                        }
                                        e.target.value = '';
                                    }}
                                />

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => addFileInputRef.current?.click()}
                                        className="flex-1 px-4 py-3.5 bg-surface-highlight border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-3 transition-all hover:border-primary/50 hover:bg-surface group"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-secondary group-hover:text-primary group-hover:scale-110 transition-all">
                                            {pdfFiles.length > 0 ? <Plus className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                                        </div>
                                        <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                                            {pdfFiles.length > 0 ? 'Ще один файл' : 'Завантажити PDF'}
                                        </span>
                                    </button>

                                    {/* Archive Search Button */}
                                    {onSearchArchive && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleClose();
                                                onSearchArchive(title);
                                            }}
                                            className="w-16 flex-shrink-0 bg-surface-highlight border border-border rounded-xl flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary/30 hover:bg-surface transition-all"
                                            title="Знайти в Архіві МХО"
                                        >
                                            <Search className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>


                            {
                                error && (
                                    <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm border border-red-500/20 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                        {error}
                                    </div>
                                )
                            }

                            <button
                                type="submit"
                                disabled={loading || !title.trim()}
                                className="w-full py-4 bg-primary hover:opacity-90 text-background font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base transition-all shadow-lg active:scale-[0.98] mt-6"
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
                        </form >
                    </div >
                </div >
            </div >

            <ConfirmationModal
                isOpen={!!conductorToDelete}
                onClose={() => setConductorToDelete(null)}
                onConfirm={confirmDeleteConductor}
                title="Видалити диригента?"
                message={`Ви дійсно хочете видалити "${conductorToDelete}" зі списку?`}
                confirmLabel="Видалити"
                isDestructive
            />

            <ConfirmationModal
                isOpen={!!pianistToDelete}
                onClose={() => setPianistToDelete(null)}
                onConfirm={confirmDeletePianist}
                title="Видалити піаніста?"
                message={`Ви дійсно хочете видалити "${pianistToDelete}" зі списку?`}
                confirmLabel="Видалити"
                isDestructive
            />
        </>
    );
}
