"use client";

import { useState } from "react";
import { X, Upload, Loader2, Check, Music } from "lucide-react";
import { PendingSong } from "@/types";
import { submitSong } from "@/lib/db";
import { uploadFileToR2 } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";

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

export default function SubmitSongModal({ onClose, onSuccess }: Props) {
    const { user, userData } = useAuth();
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const [form, setForm] = useState({
        title: "",
        composer: "",
        category: CATEGORIES[0],
        theme: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !file) return;

        setLoading(true);
        try {
            // 1. Create pending record first to get ID (or we can just upload first with random ID)
            // Ideally we want atomic operation, but Firestore + Storage is hard.
            // Let's create doc first.

            // Actually, let's prepare the object
            const pendingData: Omit<PendingSong, "id" | "status" | "submittedAt"> = {
                title: form.title,
                composer: form.composer,
                category: form.category,
                theme: form.theme,
                keywords: [form.title, form.composer, form.theme].filter(Boolean).map(s => s.toLowerCase()),
                parts: [], // will fill after upload
                submittedBy: user.uid,
                submittedByName: userData?.name || user.displayName || "Unknown",
                submittedChoirId: userData?.choirId,

            };

            const songId = await submitSong(pendingData);

            // 2. Upload file
            const fileExt = file.name.split('.').pop() || 'pdf';
            const storageKey = `pending/${songId}/${Date.now()}.${fileExt}`;
            const downloadUrl = await uploadFileToR2(storageKey, file);

            // 3. Update doc with file URL
            // We need a clear way to update, accessing db directly here or adding an update function
            // For simplicity/speed, I'll rely on submitSong returning ID and then running an update
            // Wait, I should probably update submitSong to handle this or generic update

            // Let's import updateDoc/doc/db here or add updatePendingSong to db.ts
            // Actually, let's just make submitSong accept parts if we want, but we need connection

            // QUICK FIX: I will use a direct update here via db import, or better, add updatePendingSong to db.ts
            // Improvised: import { doc, updateDoc } from "firebase/firestore"; import { db } from "@/lib/firebase";
            const { doc, updateDoc } = await import("firebase/firestore");
            const { db } = await import("@/lib/firebase");

            await updateDoc(doc(db, "pending_songs", songId), {
                parts: [{
                    name: "Партитура",
                    pdfUrl: downloadUrl
                }]
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error submitting song:", error);
            alert("Помилка при подачі заявки");
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
                className="bg-surface w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl animate-in zoom-in-95"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-text-primary">Запропонувати пісню</h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface-highlight rounded-full transition-colors">
                        <X className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
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

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Композитор / Автор</label>
                        <input
                            type="text"
                            value={form.composer}
                            onChange={e => setForm({ ...form, composer: e.target.value })}
                            className="w-full px-4 py-3 bg-surface-highlight rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Наприклад: М. Леонтович"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Категорія</label>
                            <select
                                value={form.category}
                                onChange={e => setForm({ ...form, category: e.target.value })}
                                className="w-full px-4 py-3 bg-surface-highlight rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Тема (опц.)</label>
                            <input
                                type="text"
                                value={form.theme}
                                onChange={e => setForm({ ...form, theme: e.target.value })}
                                className="w-full px-4 py-3 bg-surface-highlight rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Різдво, Пасха..."
                            />
                        </div>
                    </div>

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
                        className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Надіслати"}
                    </button>
                </form>
            </div>
        </div>
    );
}
