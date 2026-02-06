"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getSong, updateSong, uploadSongPdf, deleteSong, getChoir } from "@/lib/db";
import { getPdf } from "@/lib/offlineDb";
import { SimpleSong } from "@/types";
import PDFViewer from "@/components/PDFViewer";
import EditSongModal from "@/components/EditSongModal";
import { ArrowLeft, FileText, Upload, Loader2, Check, AlertCircle, Trash2, ExternalLink, Pencil, User, Download, X, Search } from "lucide-react";
import { extractInstrument } from "@/lib/utils";

import ConfirmationModal from "@/components/ConfirmationModal";
import Toast from "@/components/Toast";
import ArchiveLoader from "@/components/ArchiveLoader";
import GlobalArchive from "@/components/GlobalArchive";
import { GlobalSong } from "@/types";

// Helper to extract instrument name for tabs
// extractInstrument moved to @/lib/utils

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
    const [currentPartIndex, setCurrentPartIndex] = useState(0);

    // Interaction State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [choirData, setChoirData] = useState<{
        regents: string[];
        knownConductors: string[];
        knownCategories: string[];
    }>({ regents: [], knownConductors: [], knownCategories: [] });

    // Archive Modal State
    const [showArchiveModal, setShowArchiveModal] = useState(false);

    // Annotation State
    const [isAnnotating, setIsAnnotating] = useState(false);

    const handleLinkArchive = async (globalSong: GlobalSong) => {
        if (!song || !userData?.choirId) return;

        // Get PDF URL from first part (usually main part)
        const pdfUrl = globalSong.parts?.[0]?.pdfUrl;

        if (!pdfUrl) {
            setToast({ message: "У цій пісні з архіву немає PDF", type: "error" });
            return;
        }

        try {
            setUploading(true);
            await updateSong(userData.choirId, song.id, {
                hasPdf: true,
                pdfUrl: pdfUrl,
                // Also update metadata if missing in current song
                composer: song.composer || globalSong.composer,
                poet: song.poet,
            });

            setToast({ message: "PDF успішно прикріплено", type: "success" });
            setShowArchiveModal(false);

            // Reload page to refresh data
            window.location.reload();
        } catch (error) {
            console.error(error);
            setToast({ message: "Помилка при оновленні", type: "error" });
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        async function loadSong() {
            if (!userData?.choirId || !songId) return;

            setLoading(true);
            const fetched = await getSong(userData.choirId, songId);

            // Try to load PDF from offline cache
            const cachedPdf = await getPdf(songId);
            if (cachedPdf && fetched) {
                fetched.pdfData = cachedPdf;
                fetched.hasPdf = true;
            }

            setSong(fetched);
            // Auto-open PDF if available AND valid PDF (not Telegram link)
            if (fetched?.hasPdf && (fetched.pdfUrl || fetched.pdfData)) {
                if (!isTelegramLink(fetched.pdfUrl || "")) {
                    setShowViewer(true);
                }
            }
            setLoading(false);

            // Load choir data for editing
            if (userData.role === 'head' || userData.role === 'regent') {
                const choir = await getChoir(userData.choirId);
                if (choir) {
                    setChoirData({
                        regents: choir.regents || [],
                        knownConductors: choir.knownConductors || [],
                        knownCategories: choir.knownCategories || []
                    });
                }
            }
        }

        loadSong();
    }, [userData?.choirId, songId, userData?.role]);

    const isTelegramLink = (url?: string) => {
        if (!url) return false;
        return url.includes('t.me/') || url.includes('telegram.me/');
    };

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

    const handleUpdateSong = async (updates: Partial<SimpleSong>) => {
        if (!userData?.choirId || !songId) return;

        try {
            await updateSong(userData.choirId, songId, updates);
            setSong(prev => prev ? { ...prev, ...updates } : null);
            setShowEditModal(false);
            setToast({ message: "Пісню оновлено", type: "success" });
        } catch (error) {
            console.error("Failed to update song:", error);
            setToast({ message: "Помилка оновлення пісні", type: "error" });
        }
    };

    const handleDelete = () => {
        // Just trigger the modal
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!userData?.choirId || !songId) return;
        try {
            await deleteSong(userData.choirId, songId);
            router.push("/");
        } catch (error) {
            console.error("Error deleting song:", error);
            setToast({ message: "Помилка видалення", type: "error" });
        }
    };


    const handleDownload = async () => {
        if (!song) return;

        try {
            let blob: Blob;
            const filename = `${song.title}.pdf`;

            if (song.pdfData) {
                // Base64 data - convert to blob
                const byteCharacters = atob(song.pdfData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                blob = new Blob([byteArray], { type: 'application/pdf' });
            } else if (song.pdfUrl) {
                // Fetch from URL
                const response = await fetch(song.pdfUrl);
                blob = await response.blob();
            } else {
                return;
            }

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            // Fallback: open in new tab
            if (song.pdfUrl) {
                window.open(song.pdfUrl, '_blank');
            }
        }
    };

    if (loading) {
        return <ArchiveLoader />;
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

    // Check if link is Telegram
    const isTg = isTelegramLink(song.pdfUrl);

    // Show PDF Viewer (Only if NOT telegram link)
    if (showViewer && ((song.parts && song.parts.length > 0) || song.pdfUrl || song.pdfData) && !isTg) {
        const hasParts = song.parts && song.parts.length > 1;
        const currentPdfUrl = (song.parts && song.parts.length > 0)
            ? song.parts[currentPartIndex].pdfUrl
            : (song.pdfUrl || song.pdfData!);

        return (
            <div className="h-screen bg-white flex flex-col">
                {/* PDF Header */}
                <div className="bg-white border-b border-gray-200 shadow-sm z-10">
                    <div className="px-4 py-3 flex items-center justify-between">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-700" />
                        </button>

                        <div className="flex-1 mx-4 min-w-0 flex flex-col items-center">
                            <h1 className="font-bold text-gray-900 truncate w-full text-center">
                                {song.title}
                            </h1>
                            {hasParts && song.parts && (
                                <p className="text-xs text-gray-500 font-medium">
                                    {song.parts[currentPartIndex].name}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsAnnotating(!isAnnotating)}
                                className={`p-2 rounded-full transition-colors ${isAnnotating ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                                title="Малювати на PDF"
                            >
                                <Pencil className="w-6 h-6" />
                            </button>
                            <button
                                onClick={handleDownload}
                                className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
                                title="Завантажити PDF"
                            >
                                <Download className="w-6 h-6 text-gray-700" />
                            </button>
                        </div>
                    </div>

                    {/* Parts Tabs (if multiple) */}
                    {hasParts && song.parts && (
                        <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                            {song.parts.map((part, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentPartIndex(index)}
                                    className={`px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-medium ${currentPartIndex === index
                                        ? "bg-gray-900 text-white shadow-sm"
                                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                        }`}
                                >
                                    {extractInstrument(part.name || `Партія ${index + 1}`, song.title)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* PDF Content */}
                <div className="flex-1 overflow-hidden relative">
                    <PDFViewer
                        key={`${song.id}-${currentPartIndex}`} // Force re-render on part change
                        url={currentPdfUrl && currentPdfUrl.includes('mscmusic.org')
                            ? `/api/pdf-proxy?url=${encodeURIComponent(currentPdfUrl)}`
                            : currentPdfUrl
                        }
                        title={song.title}
                        onClose={() => router.back()}
                        isAnnotating={isAnnotating}
                        onAnnotatingChange={setIsAnnotating}
                    />
                </div>
            </div>
        );
    }

    const canEdit = userData?.role === 'head' || userData?.role === 'regent';

    return (
        <div className="min-h-screen bg-background text-text-primary">
            {/* Header */}
            <header className="bg-surface/50 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-surface-highlight rounded-xl transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-text-secondary" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="font-bold text-lg leading-tight truncate">{song.title}</h1>
                    <div className="flex items-center gap-2 overflow-hidden text-xs text-text-secondary font-medium tracking-wide">
                        <span className="uppercase">{song.category}</span>
                        {song.conductor && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-text-secondary/30 shrink-0" />
                                <span className="truncate flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {song.conductor}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                {canEdit && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowEditModal(true)}
                            className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors"
                        >
                            <Pencil className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleDelete}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </header>

            {/* Content */}
            <div className="p-4 flex flex-col items-center justify-center min-h-[calc(100vh-64px)] pb-10">
                <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-6 sm:p-8 card-shadow">
                    {/* Song Metadata Card for Mobile clarity */}
                    <div className="mb-8 text-center">
                        <h2 className="text-2xl font-bold text-text-primary mb-2 leading-tight">{song.title}</h2>
                        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-text-secondary mb-4">
                            <span className="px-3 py-1 rounded-full bg-surface-highlight border border-border">
                                {song.category}
                            </span>
                            {song.conductor && (
                                <span className="px-3 py-1 rounded-full bg-surface-highlight border border-border flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" />
                                    {song.conductor}
                                </span>
                            )}
                        </div>

                        {canEdit && (
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-sm font-medium text-primary transition-colors mb-2"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                                Редагувати дані
                            </button>
                        )}
                    </div>

                    {song.hasPdf && (song.pdfUrl || song.pdfData) ? (
                        // PDF exists
                        <div className="text-center">
                            <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-success/20">
                                <FileText className="w-10 h-10 text-success" />
                            </div>

                            {isTg ? (
                                <>
                                    <h2 className="text-xl font-bold text-text-primary mb-2">
                                        Файл у Telegram
                                    </h2>
                                    <p className="text-text-secondary text-sm mb-8">
                                        Ця пісня була перенесена з Телеграму. Файл доступний за посиланням.
                                    </p>
                                    <a
                                        href={song.pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-4 bg-[#2AABEE] text-white rounded-xl font-bold hover:bg-[#2AABEE]/90 transition-colors mb-4 shadow-lg shadow-[#2AABEE]/20 flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink className="w-5 h-5" />
                                        Відкрити в Telegram
                                    </a>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-xl font-bold text-text-primary mb-2">
                                        PDF доступний
                                    </h2>
                                    <p className="text-text-secondary text-sm mb-8">
                                        Ноти завантажено та готово до перегляду
                                    </p>

                                    <div className="flex gap-3 mb-4">
                                        <button
                                            onClick={() => setShowViewer(true)}
                                            className="flex-1 py-4 bg-primary text-background rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                                        >
                                            Відкрити ноти
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="px-6 py-4 bg-surface-highlight border border-border text-text-primary rounded-xl font-bold hover:bg-surface transition-colors flex items-center justify-center"
                                            title="Завантажити PDF"
                                        >
                                            <Download className="w-5 h-5" />
                                        </button>
                                    </div>
                                </>
                            )}

                            {canEdit && (
                                <div className="mt-8 pt-6 border-t border-border">
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
                                        className="w-full py-3 border border-border rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-highlight transition-colors text-sm font-medium"
                                    >
                                        {uploading ? "Завантаження..." : "Завантажити інший PDF"}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        // No PDF
                        <div className="text-center">
                            <div className="w-20 h-20 bg-surface-highlight rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                                <FileText className="w-10 h-10 text-text-secondary/50" />
                            </div>
                            <h2 className="text-xl font-bold text-text-primary mb-2">
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
                                        className="w-full py-4 bg-primary/10 border border-primary/20 rounded-xl text-primary font-bold hover:bg-primary/20 transition-all flex items-center justify-center gap-3 group"
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

                                    <p className="text-xs text-text-secondary/50 mt-4 mb-4">
                                        Максимальний розмір: 50 MB
                                    </p>

                                    <div className="relative my-6">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-border"></div>
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-background px-2 text-text-secondary">Або</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowArchiveModal(true)}
                                        disabled={uploading}
                                        className="w-full py-4 bg-surface-highlight border border-border rounded-xl text-text-primary font-bold hover:bg-surface transition-all flex items-center justify-center gap-3"
                                    >
                                        <Search className="w-5 h-5 text-accent" />
                                        Знайти в архіві
                                    </button>

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

            {showEditModal && song && (
                <EditSongModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    onSave={handleUpdateSong}
                    initialData={song}
                    regents={choirData.regents}
                    knownConductors={choirData.knownConductors}
                    knownCategories={choirData.knownCategories}
                />
            )}

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title="Видалити пісню?"
                message="Ви впевнені, що хочете видалити цю пісню? Цю дію неможливо скасувати."
                confirmLabel="Видалити"
                isDestructive={true}
            />

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            {/* Archive Search Modal */}
            {showArchiveModal && (
                <div className="fixed inset-0 z-[60] bg-background flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                        <h2 className="text-lg font-bold">Знайти в архіві</h2>
                        <button
                            onClick={() => setShowArchiveModal(false)}
                            className="p-2 hover:bg-white/10 rounded-full"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <GlobalArchive onAddSong={handleLinkArchive} />
                    </div>
                </div>
            )}
        </div>
    );
}
