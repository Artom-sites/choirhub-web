"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Loader2, Save, Check, ChevronDown, Trash2, Upload, Search } from "lucide-react";
import { SimpleSong } from "@/types";
import { CATEGORIES as OFFICIAL_THEMES_IMPORTED } from "@/lib/themes";

const OFFICIAL_THEMES = OFFICIAL_THEMES_IMPORTED;

import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { updateDoc, doc, arrayRemove } from "firebase/firestore";
import { getFirestoreLazy } from "@/lib/firebase";
import ConfirmationModal from "./ConfirmationModal";
import { Dialog } from '@capacitor/dialog';

// Helper component to render dropdowns in a portal
const DropdownPortal = ({ children }: { children: React.ReactNode }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    return createPortal(children, document.body);
};

// Hook to track the anchor element for absolute positioning in the portal
function useDropdownPosition(ref: React.RefObject<HTMLDivElement | null>, isOpen: boolean) {
    const [rect, setRect] = useState({ top: 0, left: 0, width: 0 });

    const updatePosition = useCallback(() => {
        if (ref.current && isOpen) {
            const r = ref.current.getBoundingClientRect();
            setRect({
                top: r.bottom + window.scrollY,
                left: r.left + window.scrollX,
                width: r.width,
            });
        }
    }, [ref, isOpen]);

    useEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isOpen, updatePosition]);

    return rect;
}

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
    const { t } = useTranslation();

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

    const themeDropdownRect = useDropdownPosition(themeDropdownRef, isThemeDropdownOpen);
    const conductorDropdownRect = useDropdownPosition(dropdownRef, isConductorDropdownOpen);
    const pianistDropdownRect = useDropdownPosition(pianistDropdownRef, isPianistDropdownOpen);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Element;
            if (target.closest && target.closest('.dropdown-portal')) {
                return; // Click was inside a portal dropdown, don't close it
            }
            if (dropdownRef.current && !dropdownRef.current.contains(target as Node)) {
                setIsConductorDropdownOpen(false);
            }
            if (pianistDropdownRef.current && !pianistDropdownRef.current.contains(target as Node)) {
                setIsPianistDropdownOpen(false);
            }
            if (themeDropdownRef.current && !themeDropdownRef.current.contains(target as Node)) {
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
            setError(t('edit_song.song_name_required'));
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
            await Dialog.alert({ title: t('song.error'), message: t('edit_song.save_error') });
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
                const choirRef = doc(getFirestoreLazy(), "choirs", userData.choirId);
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
            await Dialog.alert({ title: t('song.error'), message: t('edit_song.delete_error') });
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
            await Dialog.alert({ title: t('song.error'), message: t('edit_song.delete_error') });
        } finally {
            setPianistToDelete(null);
        }
    };


    const canManageList = userData?.role === 'head' || userData?.role === 'regent';

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] animate-in fade-in duration-200 px-5">
                <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                    {/* Form Wrap */}
                    <form onSubmit={handleSave} className="flex flex-col w-full">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
                            <h2 className="text-xl font-bold text-text-primary">{t('edit_song.title')}</h2>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-highlight hover:bg-border transition-colors"
                            >
                                <X className="w-4 h-4 text-text-secondary" />
                            </button>
                        </div>

                        {/* Form Fields */}
                        <div className="px-5 py-5 space-y-5 overflow-visible">

                            {/* Title Field */}
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                    {t('edit_song.song_name')} <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={t('edit_song.song_name_placeholder')}
                                    className="w-full bg-surface-highlight text-text-primary text-[16px] rounded-xl px-4 py-3 border border-border placeholder:text-text-secondary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                                />
                            </div>

                            {/* Theme / Category Field */}
                            <div ref={themeDropdownRef} className="relative z-30">
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                    {t('edit_song.category')}
                                </label>
                                {!showCustomTheme ? (
                                    <div className="relative">
                                        <div
                                            onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                                            className="w-full bg-surface-highlight text-text-primary text-[16px] rounded-xl px-4 py-3 border border-border flex items-center justify-between cursor-pointer transition-all hover:bg-surface-hover"
                                        >
                                            <span className={theme ? 'text-text-primary' : 'text-text-secondary'}>
                                                {theme ? t(`global.themes.${theme.replace(/ /g, '_').replace(/[''\u2019\u02BC]/g, '')}` as any, { defaultValue: theme }) : t('edit_song.category_placeholder')}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isThemeDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>

                                        {isThemeDropdownOpen && (
                                            <DropdownPortal>
                                                <div 
                                                    className="fixed mt-1 bg-surface-highlight rounded-xl border border-border max-h-48 overflow-y-auto z-[300] shadow-2xl dropdown-portal"
                                                    style={{
                                                        top: `${themeDropdownRect.top}px`,
                                                        left: `${themeDropdownRect.left}px`,
                                                        width: `${themeDropdownRect.width}px`
                                                    }}
                                                >
                                                    {allThemes.map(themeOption => (
                                                        <div
                                                            key={themeOption}
                                                            onClick={() => { setTheme(themeOption); setIsThemeDropdownOpen(false); }}
                                                            className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-surface border-b border-border last:border-none"
                                                        >
                                                            <span className={`text-[15px] ${theme === themeOption ? 'text-primary font-medium' : 'text-text-primary'}`}>
                                                                {t(`global.themes.${themeOption.replace(/ /g, '_').replace(/[''\u2019\u02BC]/g, '')}` as any, { defaultValue: themeOption })}
                                                            </span>
                                                            {theme === themeOption && <Check className="w-4 h-4 text-primary" />}
                                                        </div>
                                                    ))}
                                                    <div
                                                        onClick={() => { setShowCustomTheme(true); setIsThemeDropdownOpen(false); }}
                                                        className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-surface"
                                                    >
                                                        <span className="text-[15px] text-primary">{t('edit_song.other_category')}</span>
                                                    </div>
                                                </div>
                                            </DropdownPortal>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={customTheme || ""}
                                            onChange={(e) => setCustomTheme(e.target.value)}
                                            placeholder={t('edit_song.category_input')}
                                            className="flex-1 bg-surface-highlight text-text-primary text-[16px] rounded-xl px-4 py-3 border border-primary/50 placeholder:text-text-secondary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                                            autoFocus
                                        />
                                        <button type="button" onClick={() => setShowCustomTheme(false)} className="p-3 bg-surface-highlight border border-border text-text-secondary hover:text-text-primary rounded-xl transition-colors">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Conductor Field */}
                            <div ref={dropdownRef} className="relative z-20">
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                    {t('edit_song.conductor')}
                                </label>
                                {!showCustomInput ? (
                                    <div className="relative">
                                        <div
                                            onClick={() => setIsConductorDropdownOpen(!isConductorDropdownOpen)}
                                            className="w-full bg-surface-highlight text-text-primary text-[16px] rounded-xl px-4 py-3 border border-border flex items-center justify-between cursor-pointer transition-all hover:bg-surface-hover"
                                        >
                                            <span className={conductor ? 'text-text-primary' : 'text-text-secondary'}>
                                                {conductor || t('edit_song.category_placeholder')}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isConductorDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>

                                        {isConductorDropdownOpen && (
                                            <DropdownPortal>
                                                <div 
                                                    className="fixed mt-1 bg-surface-highlight rounded-xl border border-border max-h-48 overflow-y-auto z-[300] shadow-2xl dropdown-portal"
                                                    style={{
                                                        top: `${conductorDropdownRect.top}px`,
                                                        left: `${conductorDropdownRect.left}px`,
                                                        width: `${conductorDropdownRect.width}px`
                                                    }}
                                                >
                                                    {allConductors.map(r => (
                                                        <div
                                                            key={r}
                                                            onClick={() => { setConductor(r); setIsConductorDropdownOpen(false); }}
                                                            className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-surface border-b border-border last:border-none group"
                                                        >
                                                            <span className={`text-[15px] ${conductor === r ? 'text-primary font-medium' : 'text-text-primary'}`}>{r}</span>
                                                            <div className="flex items-center gap-2">
                                                                {conductor === r && <Check className="w-4 h-4 text-primary" />}
                                                                {canManageList && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleDeleteClick(r, e)}
                                                                        className="text-danger opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity p-1"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div
                                                        onClick={() => { setShowCustomInput(true); setIsConductorDropdownOpen(false); }}
                                                        className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-surface"
                                                    >
                                                        <span className="text-[15px] text-primary">{t('edit_song.other_conductor')}</span>
                                                    </div>
                                                </div>
                                            </DropdownPortal>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={customConductor}
                                            onChange={(e) => setCustomConductor(e.target.value)}
                                            placeholder={t('edit_song.conductor_placeholder')}
                                            className="flex-1 bg-surface-highlight text-text-primary text-[16px] rounded-xl px-4 py-3 border border-primary/50 placeholder:text-text-secondary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                                            autoFocus
                                        />
                                        <button type="button" onClick={() => setShowCustomInput(false)} className="p-3 bg-surface-highlight border border-border text-text-secondary hover:text-text-primary rounded-xl transition-colors">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Pianist Field */}
                            <div ref={pianistDropdownRef} className="relative z-10">
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                    {t('edit_song.pianist')}
                                </label>
                                {!showCustomPianist ? (
                                    <div className="relative">
                                        <div
                                            onClick={() => setIsPianistDropdownOpen(!isPianistDropdownOpen)}
                                            className="w-full bg-surface-highlight text-text-primary text-[16px] rounded-xl px-4 py-3 border border-border flex items-center justify-between cursor-pointer transition-all hover:bg-surface-hover"
                                        >
                                            <span className={pianist ? 'text-text-primary' : 'text-text-secondary'}>
                                                {pianist || t('edit_song.pianist_placeholder')}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isPianistDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>

                                        {isPianistDropdownOpen && (
                                            <DropdownPortal>
                                                <div 
                                                    className="fixed mt-1 bg-surface-highlight rounded-xl border border-border max-h-48 overflow-y-auto z-[300] shadow-2xl dropdown-portal"
                                                    style={{
                                                        top: `${pianistDropdownRect.top}px`,
                                                        left: `${pianistDropdownRect.left}px`,
                                                        width: `${pianistDropdownRect.width}px`
                                                    }}
                                                >
                                                    <div
                                                        onClick={() => { setPianist(""); setIsPianistDropdownOpen(false); }}
                                                        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-surface border-b border-border"
                                                    >
                                                        <span className={`text-[15px] italic ${!pianist ? 'text-primary font-medium' : 'text-text-secondary'}`}>{t('edit_song.no_pianist')}</span>
                                                        {!pianist && <Check className="w-4 h-4 text-primary" />}
                                                    </div>
                                                    {knownPianists.map(p => (
                                                        <div
                                                            key={p}
                                                            onClick={() => { setPianist(p); setIsPianistDropdownOpen(false); }}
                                                            className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-surface border-b border-border last:border-none group"
                                                        >
                                                            <span className={`text-[15px] ${pianist === p ? 'text-primary font-medium' : 'text-text-primary'}`}>{p}</span>
                                                            <div className="flex items-center gap-2">
                                                                {pianist === p && <Check className="w-4 h-4 text-primary" />}
                                                                {canManageList && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handlePianistDeleteClick(p, e)}
                                                                        className="text-danger opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity p-1"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div
                                                        onClick={() => { setShowCustomPianist(true); setIsPianistDropdownOpen(false); }}
                                                        className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-surface"
                                                    >
                                                        <span className="text-[15px] text-primary">{t('edit_song.other_pianist')}</span>
                                                    </div>
                                                </div>
                                            </DropdownPortal>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={customPianist}
                                            onChange={(e) => setCustomPianist(e.target.value)}
                                            placeholder={t('edit_song.pianist_placeholder')}
                                            className="flex-1 bg-surface-highlight text-text-primary text-[16px] rounded-xl px-4 py-3 border border-primary/50 placeholder:text-text-secondary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                                            autoFocus
                                        />
                                        {knownPianists.length > 0 && (
                                            <button type="button" onClick={() => setShowCustomPianist(false)} className="p-3 bg-surface-highlight border border-border text-text-secondary hover:text-text-primary rounded-xl transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="px-4 py-2 text-[14px] font-medium text-danger text-center bg-danger/10 rounded-xl">
                                    {error}
                                </div>
                            )}

                        </div>

                        {/* Save Button */}
                        <div className="px-5 pb-5 pt-2">
                            <button
                                type="submit"
                                disabled={loading || !title.trim()}
                                className="w-full py-3.5 bg-primary text-background rounded-xl font-bold text-[16px] flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-4.5 h-4.5" />
                                        {t('edit_song.save')}
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
                title={t('edit_song.delete_conductor_title')}
                message={`${conductorToDelete}`}
                confirmLabel={t('common.delete')}
                isDestructive
            />

            <ConfirmationModal
                isOpen={!!pianistToDelete}
                onClose={() => setPianistToDelete(null)}
                onConfirm={confirmDeletePianist}
                title={t('edit_song.delete_pianist_title')}
                message={`${pianistToDelete}`}
                confirmLabel={t('common.delete')}
                isDestructive
            />
        </>
    );
}
