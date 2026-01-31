"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X, Plus, Loader2, Save, Check, ChevronDown, Trash2 } from "lucide-react";
import { SimpleSong } from "@/types";
import { CATEGORIES as OFFICIAL_THEMES_IMPORTED } from "@/lib/themes";

const OFFICIAL_THEMES = OFFICIAL_THEMES_IMPORTED;

const SECTIONS = [
    { id: "choir", label: "Хор" },
    { id: "orchestra", label: "Оркестр" },
    { id: "ensemble", label: "Ансамбль" },
];
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
}

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



    const normalizedRegents = useMemo(() => Array.from(new Set(regents.map(r => r.trim()))), [regents]);
    const uniqueKnownConductors = useMemo(() => (knownConductors || [])
        .map(c => c.trim())
        .filter(c => !normalizedRegents.some(r => r.toLowerCase() === c.toLowerCase()))
        .filter((c, index, self) => self.indexOf(c) === index), [knownConductors, normalizedRegents]);

    const allConductors = useMemo(() => [...normalizedRegents, ...uniqueKnownConductors], [normalizedRegents, uniqueKnownConductors]);

    // Use OFFICIAL_THEMES + knownCategories (filtering out sections) for the "Category" (Theme) list
    const allThemes = useMemo(() => {
        const sectionsIds = SECTIONS.map(s => s.id);
        const merged = [...OFFICIAL_THEMES, ...(knownCategories || [])];
        return Array.from(new Set(merged)).filter(t => !sectionsIds.includes(t));
    }, [knownCategories]);

    // Determine initial state logic
    const initialIsCustomTheme = initialData.theme && !allThemes.includes(initialData.theme);
    const initialIsCustomConductor = initialData.conductor && !allConductors.includes(initialData.conductor);

    // Track initial values to detect changes
    const [title, setTitle] = useState(initialData.title);

    // Section (Choir/Orchestra) - formerly Category
    const [section, setSection] = useState(initialData.category || "choir");

    // Theme (Christmas, etc.) - formerly handled variously
    const [theme, setTheme] = useState(initialIsCustomTheme ? "" : (initialData.theme || ""));
    const [customTheme, setCustomTheme] = useState(initialIsCustomTheme ? initialData.theme : "");
    const [showCustomTheme, setShowCustomTheme] = useState(!!initialIsCustomTheme);

    const [conductor, setConductor] = useState(initialIsCustomConductor ? "" : (initialData.conductor || ""));
    const [customConductor, setCustomConductor] = useState(initialIsCustomConductor ? (initialData.conductor || "") : "");
    const [showCustomInput, setShowCustomInput] = useState(!!initialIsCustomConductor);

    // New Metadata Fields
    const [composer, setComposer] = useState(initialData.composer || "");
    const [poet, setPoet] = useState(initialData.poet || "");

    const [showAllThemes, setShowAllThemes] = useState(false);

    // Conductor Dropdown State
    const [isConductorDropdownOpen, setIsConductorDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Delete Confirmation State
    const [conductorToDelete, setConductorToDelete] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Combine static and known categories


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
            // Save custom theme if used (persisted as "knownCategory" for backward compatibility)
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

            await onSave({
                title: title.trim(),
                category: section, // Choir/Orchestra
                conductor: finalConductor,
                composer: composer.trim() || undefined,
                poet: poet.trim() || undefined,
                theme: finalTheme || undefined,
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
            window.location.reload();
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


    const canManageList = userData?.role === 'head' || userData?.role === 'regent';

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-[200] animate-in fade-in duration-200">
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

                        {/* Section (Type) */}
                        <div>
                            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                Розділ (Тип)
                            </label>
                            <div className="flex bg-black/20 rounded-xl p-1 w-full gap-1">
                                {SECTIONS.map(sec => (
                                    <button
                                        key={sec.id}
                                        type="button"
                                        onClick={() => setSection(sec.id)}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${section === sec.id
                                            ? 'bg-white/20 text-white shadow-sm'
                                            : 'text-text-secondary hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {sec.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Category (Theme) */}
                        <div>
                            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                Категорія (Тематика)
                            </label>
                            {!showCustomTheme ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        {(showAllThemes ? allThemes : allThemes.slice(0, 8)).map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setTheme(t === theme ? "" : t)}
                                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${theme === t
                                                    ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                                                    : 'bg-white/5 text-text-secondary border-white/5 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setShowCustomTheme(true)}
                                            className="px-4 py-2 rounded-full text-sm font-medium transition-all bg-white/5 text-text-secondary border border-dashed border-white/20 hover:bg-white/10 hover:text-white flex items-center gap-1.5"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Своя
                                        </button>
                                    </div>

                                    {allThemes.length > 8 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAllThemes(!showAllThemes)}
                                            className="text-xs font-medium text-text-secondary hover:text-white flex items-center gap-1 transition-colors ml-1"
                                        >
                                            {showAllThemes ? (
                                                <>
                                                    <ChevronDown className="w-3 h-3 rotate-180" />
                                                    Згорнути
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-3 h-3" />
                                                    Показати всі ({allThemes.length})
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={customTheme || ""}
                                        onChange={(e) => setCustomTheme(e.target.value)}
                                        placeholder="Назва тематики"
                                        className="w-full px-4 py-3.5 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 text-white placeholder:text-text-secondary/40 transition-all font-medium"
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
                                            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl flex items-center justify-between hover:bg-white/5 transition-all group"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-medium ${conductor ? 'text-white' : 'text-text-secondary'}`}>
                                                    {conductor || "Оберіть диригента..."}
                                                </span>
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isConductorDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {isConductorDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1c1c20] border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-20 animate-in fade-in zoom-in-95 duration-100">
                                                {allConductors.map(r => (
                                                    <div
                                                        key={r}
                                                        onClick={() => {
                                                            setConductor(r);
                                                            setIsConductorDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-colors ${conductor === r ? 'bg-blue-500/10 text-blue-400' : 'text-text-secondary hover:text-white'}`}
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
                                                    className="w-full px-4 py-3 flex items-center gap-2 hover:bg-white/5 cursor-pointer text-blue-400 border-t border-white/5"
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

                        {/* Metadata Section (Composer, Poet, Theme) */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                Деталі
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                                        Композитор
                                    </label>
                                    <input
                                        type="text"
                                        value={composer}
                                        onChange={(e) => setComposer(e.target.value)}
                                        placeholder="Ім'я композитора"
                                        className="w-full px-3 py-2.5 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-white/20 text-white placeholder:text-text-secondary/40 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                                        Автор слів (Поет)
                                    </label>
                                    <input
                                        type="text"
                                        value={poet}
                                        onChange={(e) => setPoet(e.target.value)}
                                        placeholder="Ім'я поета"
                                        className="w-full px-3 py-2.5 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-white/20 text-white placeholder:text-text-secondary/40 text-sm"
                                    />
                                </div>

                            </div>
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
        </>
    );
}
