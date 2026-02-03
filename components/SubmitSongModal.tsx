"use client";

import { useState, useRef, useEffect } from "react";
import { X, Upload, Loader2, Check, ChevronDown } from "lucide-react";
import { PendingSong } from "@/types";
import { submitSong } from "@/lib/db";
import { uploadFileToR2 } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";
import { OFFICIAL_THEMES } from "@/lib/themes";

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

const CATEGORIES = [
    "Змішаний хор",
    "Чоловічий хор",
    "Жіночий хор",
    "Дитячий хор",
    "Молодіжний хор",
    "Загальний спів",
    "Оркестр",
    "Інше"
];

// Custom Dropdown Component
interface DropdownProps {
    value: string;
    options: string[];
    onChange: (value: string) => void;
    placeholder?: string;
    allowEmpty?: boolean;
}

function CustomDropdown({ value, options, onChange, placeholder = "Обрати...", allowEmpty = false }: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 bg-surface-highlight rounded-xl text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
                <span className={value ? "text-text-primary" : "text-text-secondary"}>
                    {value || placeholder}
                </span>
                <ChevronDown className={`w-5 h-5 text-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-surface border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
                    {allowEmpty && (
                        <button
                            type="button"
                            onClick={() => { onChange(""); setIsOpen(false); }}
                            className={`w-full px-4 py-2.5 text-left hover:bg-surface-highlight transition-colors text-text-secondary ${!value ? "bg-surface-highlight" : ""}`}
                        >
                            {placeholder}
                        </button>
                    )}
                    {options.map(opt => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => { onChange(opt); setIsOpen(false); }}
                            className={`w-full px-4 py-2.5 text-left hover:bg-surface-highlight transition-colors ${value === opt ? "bg-primary/10 text-primary font-medium" : "text-text-primary"}`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function SubmitSongModal({ onClose, onSuccess }: Props) {
    const { user, userData } = useAuth();
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const [form, setForm] = useState({
        title: "",
        composer: "",
        poet: "",
        category: CATEGORIES[0],
        theme: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !file) return;

        setLoading(true);
        let songId: string | null = null;

        try {
            // Step 1: Create pending song record in Firestore
            // Build data object, only including non-empty fields
            const pendingData: Record<string, any> = {
                title: form.title,
                category: form.category,
                keywords: [form.title, form.composer, form.poet, form.theme].filter(Boolean).map(s => s.toLowerCase()),
                parts: [],
                submittedBy: user.uid,
                submittedByName: userData?.name || user.displayName || "Unknown",
            };

            // Add optional fields only if they have values
            if (form.composer) pendingData.composer = form.composer;
            if (form.poet) pendingData.poet = form.poet;
            if (form.theme) pendingData.theme = form.theme;
            if (userData?.choirId) pendingData.submittedChoirId = userData.choirId;

            try {
                songId = await submitSong(pendingData);
            } catch (err: any) {
                console.error("Firestore create error:", err);
                alert("Помилка: не вдалося створити запис. Перевірте інтернет-з'єднання.");
                return;
            }

            // Step 2: Upload PDF to R2
            let downloadUrl: string;
            try {
                const fileExt = file.name.split('.').pop() || 'pdf';
                const storageKey = `pending/${songId}/${Date.now()}.${fileExt}`;
                downloadUrl = await uploadFileToR2(storageKey, file);
            } catch (err: any) {
                console.error("R2 upload error:", err);
                alert("Помилка завантаження файлу. Сховище може бути недоступне.");
                return;
            }

            // Step 3: Update doc with file URL
            try {
                const { doc, updateDoc } = await import("firebase/firestore");
                const { db } = await import("@/lib/firebase");

                await updateDoc(doc(db, "pending_songs", songId), {
                    parts: [{
                        name: "Партитура",
                        pdfUrl: downloadUrl
                    }]
                });
            } catch (err: any) {
                console.error("Firestore update error:", err);
                alert("Помилка: файл завантажено, але не вдалося оновити запис.");
                return;
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Unexpected error:", error);
            alert(`Неочікувана помилка: ${error.message || "Спробуйте ще раз"}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-surface w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-text-primary">Запропонувати пісню</h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface-highlight rounded-full transition-colors">
                        <X className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Song Title */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Назва твору *</label>
                        <input
                            required
                            type="text"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            className="w-full px-4 py-3 bg-surface-highlight rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Наприклад: Отче наш"
                        />
                    </div>

                    {/* Composer & Poet */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Композитор</label>
                            <input
                                type="text"
                                value={form.composer}
                                onChange={e => setForm({ ...form, composer: e.target.value })}
                                className="w-full px-4 py-3 bg-surface-highlight rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="М. Леонтович"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Автор тексту</label>
                            <input
                                type="text"
                                value={form.poet}
                                onChange={e => setForm({ ...form, poet: e.target.value })}
                                className="w-full px-4 py-3 bg-surface-highlight rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Т. Шевченко"
                            />
                        </div>
                    </div>

                    {/* Category & Theme Dropdowns */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Категорія</label>
                            <CustomDropdown
                                value={form.category}
                                options={CATEGORIES}
                                onChange={val => setForm({ ...form, category: val })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Тема</label>
                            <CustomDropdown
                                value={form.theme}
                                options={OFFICIAL_THEMES.filter(t => t !== "Інші")}
                                onChange={val => setForm({ ...form, theme: val })}
                                placeholder="Не вказано"
                                allowEmpty
                            />
                        </div>
                    </div>

                    {/* PDF Upload */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">PDF Файл *</label>
                        <div className="relative">
                            <input
                                required
                                type="file"
                                accept=".pdf"
                                onChange={e => setFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className={`w-full px-4 py-4 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 transition-colors ${file ? 'border-primary bg-primary/10' : 'border-border hover:border-text-secondary'}`}>
                                {file ? (
                                    <>
                                        <Check className="w-5 h-5 text-primary" />
                                        <span className="text-text-primary font-medium truncate max-w-[200px]">{file.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5 text-text-secondary" />
                                        <span className="text-text-secondary">Оберіть PDF файл</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 text-xs text-text-secondary text-center">
                        Пісня з'явиться в каталозі "Новинки" після перевірки модератором.
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !file || !form.title}
                        className="w-full py-3 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Надіслати"}
                    </button>
                </form>
            </div>
        </div>
    );
}
