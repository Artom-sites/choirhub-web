"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X, Plus, Loader2, Save, Check, ChevronDown, Trash2 } from "lucide-react";
import { SimpleSong } from "@/types";
import { CATEGORIES as OFFICIAL_THEMES_IMPORTED } from "@/lib/themes";

const OFFICIAL_THEMES = OFFICIAL_THEMES_IMPORTED;

import { useAuth } from "@/contexts/AuthContext";
import { updateDoc, doc, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ConfirmationModal from "./ConfirmationModal";

interface EditSongModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: Partial<SimpleSong>) => Promise<void>;
    initialData: SimpleSong;
    regents: string[];
    knownConductors: string[];
    knownCategories: string[];
    knownPianists: string[];
}

export default function EditSongModal({
    isOpen,
    onClose,
    onSave,
    initialData,
    regents,
    knownConductors,
    knownCategories,
    knownPianists
}: EditSongModalProps) {
    const { userData } = useAuth();

    const normalizedRegents = useMemo(() => Array.from(new Set(regents.map(r => r.trim()))), [regents]);
    const uniqueKnownConductors = useMemo(() => (knownConductors || [])
        .map(c => c.trim())
        .filter(c => !normalizedRegents.some(r => r.toLowerCase() === c.toLowerCase()))
        .filter((c, index, self) => self.indexOf(c) === index), [knownConductors, normalizedRegents]);

    const allConductors = useMemo(() => [...normalizedRegents, ...uniqueKnownConductors], [normalizedRegents, uniqueKnownConductors]);

    // Use OFFICIAL_THEMES + knownCategories for the "Category" (Theme) list
    const allThemes = useMemo(() => {
        const merged = [...OFFICIAL_THEMES, ...(knownCategories || [])];
        return Array.from(new Set(merged));
    }, [knownCategories]);

    // Determine initial state logic
    // We treat 'category' as the Theme (like in AddSongModal).
    // If 'category' is not in standard list, it's a custom theme.
    // Fallback to 'theme' property if exists (legacy data), otherwise use 'category'.
    const initialThemeValue = initialData.category || initialData.theme || "Інші";
    const initialIsCustomTheme = initialThemeValue && !allThemes.includes(initialThemeValue);

    const initialIsCustomConductor = initialData.conductor && !allConductors.includes(initialData.conductor);

    // Track initial values to detect changes
    const [title, setTitle] = useState(initialData.title);

    // Theme (Christmas, etc.) - mapped to 'category' field
    const [theme, setTheme] = useState(initialIsCustomTheme ? "" : initialThemeValue);
    const [customTheme, setCustomTheme] = useState(initialIsCustomTheme ? initialThemeValue : "");
    const [showCustomTheme, setShowCustomTheme] = useState(!!initialIsCustomTheme);

    const [conductor, setConductor] = useState(initialIsCustomConductor ? "" : (initialData.conductor || ""));
    const [customConductor, setCustomConductor] = useState(initialIsCustomConductor ? (initialData.conductor || "") : "");
    const [showCustomInput, setShowCustomInput] = useState(!!initialIsCustomConductor);

    // Pianist field
    const initialIsCustomPianist = initialData.pianist && !knownPianists.includes(initialData.pianist);
    const [pianist, setPianist] = useState(initialIsCustomPianist ? "" : (initialData.pianist || ""));
    const [customPianist, setCustomPianist] = useState(initialIsCustomPianist ? (initialData.pianist || "") : "");
    const [showCustomPianist, setShowCustomPianist] = useState(!!initialIsCustomPianist);
    const [isPianistDropdownOpen, setIsPianistDropdownOpen] = useState(false);
    const pianistDropdownRef = useRef<HTMLDivElement>(null);

    const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
    const themeDropdownRef = useRef<HTMLDivElement>(null);

    // Conductor Dropdown State
    const [isConductorDropdownOpen, setIsConductorDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Delete Confirmation State
    const [conductorToDelete, setConductorToDelete] = useState<string | null>(null);
    const [pianistToDelete, setPianistToDelete] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsConductorDropdownOpen(false);
            }
            if (pianistDropdownRef.current && !pianistDropdownRef.current.contains(event.target as Node)) {
                setIsPianistDropdownOpen(false);
            }
            if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
                setIsThemeDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError("Введіть назву пісні");
            return;
        }

        let finalTheme = theme;
        if (showCustomTheme && customTheme?.trim()) {
            finalTheme = customTheme.trim();
        } else if (showCustomTheme && !customTheme?.trim()) {
            setError("Введіть назву нової тематики");
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

        setLoading(true);
        setError("");

        try {
            // Save custom theme if used (persisted as "knownCategory")
            if (showCustomTheme && customTheme?.trim() && userData?.choirId) {
                try {
                    const { addKnownCategory } = await import("@/lib/db");
                    await addKnownCategory(userData.choirId, customTheme.trim());
                } catch (e) { console.error("Failed to add custom theme:", e); }
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

            // Handle pianist
            let finalPianist = pianist;
            if (showCustomPianist && customPianist.trim()) {
                finalPianist = customPianist.trim();
                // Save custom pianist
                if (userData?.choirId && !knownPianists.includes(finalPianist)) {
                    try {
                        const { addKnownPianist } = await import("@/lib/db");
                        await addKnownPianist(userData.choirId, finalPianist);
                    } catch (e) { console.error("Failed to add custom pianist:", e); }
                }
            }

            await onSave({
                title: title.trim(),
                category: finalTheme, // Save Theme as Category
                conductor: finalConductor,
                pianist: finalPianist || undefined,
                // theme: finalTheme, // Redundant if we map to category, but keeping it clean
            });

            onClose();
        } catch (err) {
            setError("Помилка збереження. Спробуйте ще раз.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const confirmDeleteConductor = async () => {
        if (!conductorToDelete || !userData?.choirId) return;

        try {
            const { removeKnownConductor } = await import("@/lib/db");

            if (uniqueKnownConductors.includes(conductorToDelete)) {
                await removeKnownConductor(userData.choirId, conductorToDelete);
            }
            else if (regents.includes(conductorToDelete)) {
                const choirRef = doc(db, "choirs", userData.choirId);
                await updateDoc(choirRef, {
                    regents: arrayRemove(conductorToDelete)
                });
            }
            // Clear conductor selection if deleted
            if (conductor === conductorToDelete) {
                setConductor("");
            }
            onClose();
        } catch (e) {
            console.error("Failed to delete conductor:", e);
            alert("Помилка видалення");
        } finally {
            setConductorToDelete(null);
        }
    };

    const handleDeleteClick = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setConductorToDelete(name);
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
            onClose();
        } catch (e) {
            console.error("Failed to delete pianist:", e);
            alert("Помилка видалення");
        } finally {
            setPianistToDelete(null);
        }
    };


    const canManageList = userData?.role === 'head' || userData?.role === 'regent';

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-[200] animate-in fade-in duration-200">
                <div className="bg-surface w-full h-[100dvh] sm:h-auto sm:max-h-[85vh] sm:max-w-md sm:rounded-3xl shadow-2xl overflow-auto border-x-0 sm:border border-border animate-in slide-in-from-bottom duration-300 flex flex-col sm:block">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-surface z-10">
                        <h2 className="text-xl font-bold text-text-primary">Редагувати пісню</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-surface-highlight rounded-full transition-colors text-text-secondary hover:text-text-primary"
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
                                className="w-full px-4 py-3.5 bg-surface-highlight border border-border rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-text-primary placeholder:text-text-secondary/40 transition-all font-medium"
                            />
                        </div>

                        {/* Category (Theme) - NOW FIRST */}
                        <div>
                            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                Категорія (Тематика)
                            </label>
                            {!showCustomTheme ? (
                                <div className="relative" ref={themeDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                                        className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl flex items-center justify-between hover:bg-surface transition-all group"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-medium ${theme ? 'text-text-primary' : 'text-text-secondary'}`}>
                                                {theme || "Оберіть тематику..."}
                                            </span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isThemeDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isThemeDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-2xl max-h-60 overflow-y-auto z-20 animate-in fade-in zoom-in-95 duration-100">
                                            {allThemes.map(t => (
                                                <div
                                                    key={t}
                                                    onClick={() => {
                                                        setTheme(t);
                                                        setIsThemeDropdownOpen(false);
                                                    }}
                                                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-surface-highlight cursor-pointer transition-colors ${theme === t ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                                >
                                                    <span className="text-sm font-medium">{t}</span>
                                                </div>
                                            ))}
                                            <div
                                                onClick={() => {
                                                    setShowCustomTheme(true);
                                                    setIsThemeDropdownOpen(false);
                                                }}
                                                className="w-full px-4 py-3 flex items-center gap-2 hover:bg-surface-highlight cursor-pointer text-primary border-t border-border"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span className="text-sm font-medium">Інша тематика...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={customTheme || ""}
                                        onChange={(e) => setCustomTheme(e.target.value)}
                                        placeholder="Назва тематики"
                                        className="w-full px-4 py-3.5 bg-surface-highlight border border-border rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-text-primary placeholder:text-text-secondary/40 transition-all font-medium"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomTheme(false)}
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
                                <div className="space-y-4">
                                    {/* Dropdown for All Conductors */}
                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setIsConductorDropdownOpen(!isConductorDropdownOpen)}
                                            className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl flex items-center justify-between hover:bg-surface transition-all group"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-medium ${conductor ? 'text-text-primary' : 'text-text-secondary'}`}>
                                                    {conductor || "Оберіть диригента..."}
                                                </span>
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isConductorDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {isConductorDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-2xl max-h-60 overflow-y-auto z-20 animate-in fade-in zoom-in-95 duration-100">
                                                {allConductors.map(r => (
                                                    <div
                                                        key={r}
                                                        onClick={() => {
                                                            setConductor(r);
                                                            setIsConductorDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-surface-highlight cursor-pointer transition-colors ${conductor === r ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                                    >
                                                        <span className="text-sm font-medium">{r}</span>
                                                        {canManageList && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDeleteClick(r, e)}
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
                                                    <span className="text-sm font-medium">Інший диригент...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={customConductor}
                                        onChange={(e) => setCustomConductor(e.target.value)}
                                        placeholder="Ім'я диригента"
                                        className="w-full px-4 py-3.5 bg-surface-highlight border border-border rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-text-primary placeholder:text-text-secondary/40 transition-all font-medium"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomInput(false)}
                                        className="text-xs text-primary hover:text-primary/80 font-medium pl-1"
                                    >
                                        Назад до списку
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Pianist Section */}
                        <div>
                            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                Піаніст
                            </label>

                            {!showCustomPianist && knownPianists.length > 0 ? (
                                <div className="relative" ref={pianistDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setIsPianistDropdownOpen(!isPianistDropdownOpen)}
                                        className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl flex items-center justify-between hover:bg-surface transition-all group"
                                    >
                                        <div className="flex items-center gap-2">
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
                                            {knownPianists.map(p => (
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
                                        className="w-full px-4 py-3.5 bg-surface-highlight border border-border rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-text-primary placeholder:text-text-secondary/40 transition-all font-medium"
                                        autoFocus
                                    />
                                    {knownPianists.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowCustomPianist(false)}
                                            className="text-xs text-primary hover:text-primary/80 font-medium pl-1"
                                        >
                                            Назад до списку
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>


                        {error && (
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
                                    Збереження...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Зберегти зміни
                                </>
                            )}
                        </button>
                    </form >
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
