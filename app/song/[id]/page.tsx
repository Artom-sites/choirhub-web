"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getSong, updateSong, uploadSongPdf } from "@/lib/db";
import { SimpleSong } from "@/types";
import PDFViewer from "@/components/PDFViewer";
import { ArrowLeft, FileText, Upload, Loader2, Check, AlertCircle } from "lucide-react";

export default function SongPage() {
    const params = useParams();
    const router = useRouter();
    const { userData } = useAuth();
    const songId = params.id as string;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [song, setSong] = useState<SimpleSong | null>(null);
    const [loading, setLoading] = useState(true);
    const [showViewer, setShowViewer] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        async function loadSong() {
            if (!userData?.choirId || !songId) return;

            setLoading(true);
            const fetched = await getSong(userData.choirId, songId);
            setSong(fetched);
            // Auto-open PDF if available
            if (fetched?.hasPdf && (fetched.pdfUrl || fetched.pdfData)) {
                setShowViewer(true);
            }
            setLoading(false);
        }

        loadSong();
    }, [userData?.choirId, songId]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userData?.choirId || !song) return;

        // Validate file
        if (file.type !== "application/pdf") {
            setUploadStatus('error');
            setErrorMessage("Тільки PDF файли дозволені");
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setUploadStatus('error');
            setErrorMessage("Файл занадто великий (макс. 50 MB)");
            return;
        }

        setUploading(true);
        setUploadStatus('idle');

        try {
            // Upload directly to Storage (accepts File)
            const url = await uploadSongPdf(userData.choirId, songId, file);

            setSong(prev => prev ? { ...prev, hasPdf: true, pdfUrl: url, pdfData: undefined } : null);
            setUploadStatus('success');

            // Auto-show viewer on successful upload
            setShowViewer(true);
        } catch (err) {
            console.error("Upload error:", err);
            setUploadStatus('error');
            setErrorMessage("Помилка завантаження файлу");
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
        );
    }

    if (!song) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center flex-col gap-4">
                <p className="text-text-secondary">Пісню не знайдено</p>
                <button
                    onClick={() => router.back()}
                    className="text-white hover:underline"
                >
                    Назад
                </button>
            </div>
        );
    }

    // Show PDF Viewer
    if (showViewer && (song.pdfUrl || song.pdfData)) {
        return (
            <div className="h-screen bg-[#09090b]">
                <PDFViewer
                    url={song.pdfUrl || song.pdfData!}
                    title={song.title}
                    onClose={() => router.back()}
                />
            </div>
        );
    }

    const canEdit = userData?.role === 'head' || userData?.role === 'regent';

    return (
        <div className="min-h-screen bg-[#09090b] text-white">
            {/* Header */}
            <header className="bg-surface/50 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-text-secondary" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="font-bold text-lg leading-tight truncate">{song.title}</h1>
                    <p className="text-xs text-text-secondary font-medium tracking-wide uppercase">{song.category}</p>
                </div>
            </header>

            {/* Content */}
            <div className="p-4 flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
                <div className="w-full max-w-md bg-surface/30 border border-white/5 rounded-3xl p-8 backdrop-blur-sm">
                    {song.hasPdf && (song.pdfUrl || song.pdfData) ? (
                        // PDF exists
                        <div className="text-center">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                                <FileText className="w-10 h-10 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">
                                PDF доступний
                            </h2>
                            <p className="text-text-secondary text-sm mb-8">
                                Ноти завантажено та готово до перегляду
                            </p>

                            <button
                                onClick={() => setShowViewer(true)}
                                className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors mb-4 shadow-lg shadow-white/5"
                            >
                                Відкрити ноти
                            </button>

                            {canEdit && (
                                <div className="mt-8 pt-6 border-t border-white/5">
                                    <p className="text-xs text-text-secondary mb-3 uppercase tracking-wider font-semibold">Оновити файл</p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="w-full py-3 border border-white/10 rounded-xl text-text-secondary hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                                    >
                                        {uploading ? "Завантаження..." : "Завантажити інший PDF"}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        // No PDF
                        <div className="text-center">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                                <FileText className="w-10 h-10 text-text-secondary/50" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">
                                Немає нот
                            </h2>
                            <p className="text-text-secondary text-sm mb-8">
                                Для цієї пісні ще не завантажено PDF файл
                            </p>

                            {canEdit ? (
                                <>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />

                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="w-full py-4 bg-white/10 border border-white/10 rounded-xl text-white font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-3 group"
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Завантаження...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                                                Завантажити PDF
                                            </>
                                        )}
                                    </button>

                                    <p className="text-xs text-text-secondary/50 mt-4">
                                        Максимальний розмір: 50 MB
                                    </p>

                                    {uploadStatus === 'success' && (
                                        <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400">
                                            <Check className="w-5 h-5" />
                                            <span className="font-medium text-sm">Файл успішно завантажено</span>
                                        </div>
                                    )}

                                    {uploadStatus === 'error' && (
                                        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-left">
                                            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                            <span className="font-medium text-sm">{errorMessage}</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-text-secondary">Зверніться до регента, щоб додати ноти</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
