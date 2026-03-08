"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { X, Plus, Loader2, Save, Check, ChevronDown, Trash2, Upload, Search } from "lucide-react";
import { SimpleSong } from "@/types";
import { CATEGORIES as OFFICIAL_THEMES_IMPORTED } from "@/lib/themes";

const OFFICIAL_THEMES = OFFICIAL_THEMES_IMPORTED;

import { useAuth } from "@/contexts/AuthContext";
import { updateDoc, doc, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ConfirmationModal from "./ConfirmationModal";
import { Dialog } from '@capacitor/dialog';

interface EditSongModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: Partial<SimpleSong>, pdfFile?: File) => Promise<void>;
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

    const normalizedRegents = useMemo(() => Array.from(new Set(
        (regents || [])
            .filter(r => typeof r === 'string' && r)
            .map(r => r.trim())
    )), [regents]);

    const uniqueKnownConductors = useMemo(() => (knownConductors || [])
        .filter(c => typeof c === 'string' && c)
        .map(c => c.trim())
        .filter(c => !normalizedRegents.some(r => r.toLowerCase() === c.toLowerCase()))
        .filter((c, index, self) => self.indexOf(c) === index), [knownConductors, normalizedRegents]);

    const allConductors = useMemo(() => [...normalizedRegents, ...uniqueKnownConductors], [normalizedRegents, uniqueKnownConductors]);

    // Use OFFICIAL_THEMES + knownCategories for the "Category" (Theme) list
    const allThemes = useMemo(() => {
        const merged = [...OFFICIAL_THEMES, ...(knownCategories || []).filter(c => typeof c === 'string' && c)];
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

    // Lock body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);


    if (!isOpen) return null;

    const handleSave = async (e: React.FormEvent | React.MouseEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError("Введіть назву пісні");
            return;
        }

        setLoading(true);
        setError("");

        try {
            // Logic to determine final values
            let finalCategory = theme;
            if (showCustomTheme && customTheme.trim()) {
                finalCategory = customTheme.trim();
            }

            let finalConductor = conductor;
            if (showCustomInput && customConductor.trim()) {
                finalConductor = customConductor.trim();
            }

            let finalPianist = pianist;
            if (showCustomPianist && customPianist.trim()) {
                finalPianist = customPianist.trim();
            }

            // Save custom category/theme
            if (showCustomTheme && customTheme.trim() && userData?.choirId) {
                // Note: We might need to save this as a known category if not exists
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

            // Save custom pianist
            if (showCustomPianist && customPianist.trim() && userData?.choirId) {
                if (!knownPianists.includes(finalPianist)) {
                    try {
                        const { addKnownPianist } = await import("@/lib/db");
                        await addKnownPianist(userData.choirId, finalPianist);
                    } catch (e) { console.error("Failed to add custom pianist:", e); }
                }
            }

            await onSave({
                title: title.trim(),
                category: finalCategory,
                conductor: finalConductor,
                pianist: finalPianist || undefined,
            });

            onClose();
        } catch (err: any) {
            console.error(err);
            await Dialog.alert({ title: "Помилка", message: "Помилка збереження" });
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
            await Dialog.alert({ title: "Помилка", message: "Помилка видалення" });
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
            await Dialog.alert({ title: "Помилка", message: "Помилка видалення" });
        } finally {
            setPianistToDelete(null);
        }
    };


    const canManageList = userData?.role === 'head' || userData?.role === 'regent';

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] animate-in fade-in duration-200 px-5">
                <div className="bg-[#1C1C1E] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                    {/* Form Wrap */}
                    <form onSubmit={handleSave} className="flex flex-col w-full">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
                            <h2 className="text-xl font-bold text-white">Редагувати пісню</h2>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>

                        {/* Form Fields */}
                        <div className="px-5 py-5 space-y-5 max-h-[60vh] overflow-y-auto">

                            {/* Title Field */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                    Назва пісні <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Введіть назву"
                                    className="w-full bg-[#2C2C2E] text-white text-[16px] rounded-xl px-4 py-3 border-none placeholder:text-gray-500 focus:ring-0 focus:outline-none"
                                />
                            </div>

                            {/* Theme / Category Field */}
                            <div ref={themeDropdownRef}>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                    Категорія (тематика)
                                </label>
                                {!showCustomTheme ? (
                                    <div className="relative">
                                        <div
                                            onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                                            className="w-full bg-[#2C2C2E] text-white text-[16px] rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer"
                                        >
                                            <span className={theme ? 'text-white' : 'text-gray-500'}>
                                                {theme || "Оберіть..."}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isThemeDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>

                                        {isThemeDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-[#2C2C2E] rounded-xl border border-white/10 max-h-48 overflow-y-auto z-10 shadow-xl">
                                                {allThemes.map(t => (
                                                    <div
                                                        key={t}
                                                        onClick={() => { setTheme(t); setIsThemeDropdownOpen(false); }}
                                                        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/5 border-b border-white/5 last:border-none"
                                                    >
                                                        <span className={`text-[15px] ${theme === t ? 'text-blue-400 font-medium' : 'text-white'}`}>{t}</span>
                                                        {theme === t && <Check className="w-4 h-4 text-blue-400" />}
                                                    </div>
                                                ))}
                                                <div
                                                    onClick={() => { setShowCustomTheme(true); setIsThemeDropdownOpen(false); }}
                                                    className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-white/5"
                                                >
                                                    <span className="text-[15px] text-blue-400">Інша тематика...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={customTheme || ""}
                                            onChange={(e) => setCustomTheme(e.target.value)}
                                            placeholder="Введіть тематику..."
                                            className="flex-1 bg-[#2C2C2E] text-white text-[16px] rounded-xl px-4 py-3 border-none placeholder:text-gray-500 focus:ring-0 focus:outline-none"
                                            autoFocus
                                        />
                                        <button type="button" onClick={() => setShowCustomTheme(false)} className="p-2 text-gray-400 hover:text-white transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Conductor Field */}
                            <div ref={dropdownRef}>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                    Хто диригує
                                </label>
                                {!showCustomInput ? (
                                    <div className="relative">
                                        <div
                                            onClick={() => setIsConductorDropdownOpen(!isConductorDropdownOpen)}
                                            className="w-full bg-[#2C2C2E] text-white text-[16px] rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer"
                                        >
                                            <span className={conductor ? 'text-white' : 'text-gray-500'}>
                                                {conductor || "Оберіть..."}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isConductorDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>

                                        {isConductorDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-[#2C2C2E] rounded-xl border border-white/10 max-h-48 overflow-y-auto z-10 shadow-xl">
                                                {allConductors.map(r => (
                                                    <div
                                                        key={r}
                                                        onClick={() => { setConductor(r); setIsConductorDropdownOpen(false); }}
                                                        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/5 border-b border-white/5 last:border-none group"
                                                    >
                                                        <span className={`text-[15px] ${conductor === r ? 'text-blue-400 font-medium' : 'text-white'}`}>{r}</span>
                                                        <div className="flex items-center gap-2">
                                                            {conductor === r && <Check className="w-4 h-4 text-blue-400" />}
                                                            {canManageList && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handleDeleteClick(r, e)}
                                                                    className="text-red-400 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity p-1"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                <div
                                                    onClick={() => { setShowCustomInput(true); setIsConductorDropdownOpen(false); }}
                                                    className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-white/5"
                                                >
                                                    <span className="text-[15px] text-blue-400">Інший диригент...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={customConductor}
                                            onChange={(e) => setCustomConductor(e.target.value)}
                                            placeholder="Введіть ім'я..."
                                            className="flex-1 bg-[#2C2C2E] text-white text-[16px] rounded-xl px-4 py-3 border-none placeholder:text-gray-500 focus:ring-0 focus:outline-none"
                                            autoFocus
                                        />
                                        <button type="button" onClick={() => setShowCustomInput(false)} className="p-2 text-gray-400 hover:text-white transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Pianist Field */}
                            <div ref={pianistDropdownRef}>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                    Піаніст
                                </label>
                                {!showCustomPianist ? (
                                    <div className="relative">
                                        <div
                                            onClick={() => setIsPianistDropdownOpen(!isPianistDropdownOpen)}
                                            className="w-full bg-[#2C2C2E] text-white text-[16px] rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer"
                                        >
                                            <span className={pianist ? 'text-white' : 'text-gray-500'}>
                                                {pianist || "Оберіть піаніста (опціонально)..."}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isPianistDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>

                                        {isPianistDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-[#2C2C2E] rounded-xl border border-white/10 max-h-48 overflow-y-auto z-10 shadow-xl">
                                                <div
                                                    onClick={() => { setPianist(""); setIsPianistDropdownOpen(false); }}
                                                    className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/5 border-b border-white/5"
                                                >
                                                    <span className={`text-[15px] italic ${!pianist ? 'text-blue-400 font-medium' : 'text-gray-400'}`}>Немає</span>
                                                    {!pianist && <Check className="w-4 h-4 text-blue-400" />}
                                                </div>
                                                {knownPianists.map(p => (
                                                    <div
                                                        key={p}
                                                        onClick={() => { setPianist(p); setIsPianistDropdownOpen(false); }}
                                                        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/5 border-b border-white/5 last:border-none group"
                                                    >
                                                        <span className={`text-[15px] ${pianist === p ? 'text-blue-400 font-medium' : 'text-white'}`}>{p}</span>
                                                        <div className="flex items-center gap-2">
                                                            {pianist === p && <Check className="w-4 h-4 text-blue-400" />}
                                                            {canManageList && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handlePianistDeleteClick(p, e)}
                                                                    className="text-red-400 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity p-1"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                <div
                                                    onClick={() => { setShowCustomPianist(true); setIsPianistDropdownOpen(false); }}
                                                    className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-white/5"
                                                >
                                                    <span className="text-[15px] text-blue-400">Інший піаніст...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={customPianist}
                                            onChange={(e) => setCustomPianist(e.target.value)}
                                            placeholder="Введіть ім'я..."
                                            className="flex-1 bg-[#2C2C2E] text-white text-[16px] rounded-xl px-4 py-3 border-none placeholder:text-gray-500 focus:ring-0 focus:outline-none"
                                            autoFocus
                                        />
                                        {knownPianists.length > 0 && (
                                            <button type="button" onClick={() => setShowCustomPianist(false)} className="p-2 text-gray-400 hover:text-white transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="px-4 py-2 text-[14px] font-medium text-red-400 text-center bg-red-500/10 rounded-xl">
                                    {error}
                                </div>
                            )}

                        </div>

                        {/* Save Button */}
                        <div className="px-5 pb-5 pt-2">
                            <button
                                type="submit"
                                disabled={loading || !title.trim()}
                                className="w-full py-3.5 bg-white text-black rounded-xl font-semibold text-[16px] flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-4.5 h-4.5" />
                                        Зберегти зміни
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

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
