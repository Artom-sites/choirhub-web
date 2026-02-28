"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from '@capacitor/status-bar';
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getSong, updateSong, uploadSongPdf, deleteSong, getChoir } from "@/lib/db";
import { getCachedSongs } from "@/lib/offlineDataCache";
import { getPdf, getCachedSong } from "@/lib/offlineDb";
import { SimpleSong } from "@/types";
import PDFViewer from "@/components/PDFViewer";
import EditSongModal from "@/components/EditSongModal";
import { ArrowLeft, FileText, Upload, Loader2, Check, AlertCircle, Trash2, ExternalLink, Pencil, User, Download, X, Search, WifiOff } from "lucide-react";
import { extractInstrument, getFileNameFromUrl, isGenericPartName } from "@/lib/utils";
import { PencilKitAnnotator } from "@/plugins/PencilKitAnnotator";

import ConfirmationModal from "@/components/ConfirmationModal";
import Toast from "@/components/Toast";
import Preloader from "@/components/Preloader";
import GlobalArchive from "@/components/GlobalArchive";
import { GlobalSong } from "@/types";
import { useStatusBar } from "@/hooks/useStatusBar";

function SongContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const songId = searchParams.get('id');
    const { userData } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfHeaderRef = useRef<HTMLDivElement>(null);

    const [song, setSong] = useState<SimpleSong | null>(null);
    const [loading, setLoading] = useState(true);
    const [showViewer, setShowViewer] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState("");
    const [currentPartIndex, setCurrentPartIndex] = useState(0);
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    // Interaction State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [choirData, setChoirData] = useState<{
        regents: string[];
        knownConductors: string[];
        knownCategories: string[];
        knownPianists: string[];
        choirType?: 'msc' | 'standard';
    }>({ regents: [], knownConductors: [], knownCategories: [], knownPianists: [] });

    // Archive Modal State
    const [showArchiveModal, setShowArchiveModal] = useState(searchParams.get('archive') === '1');

    // Annotation State
    const [isAnnotating, setIsAnnotating] = useState(false);

    // iOS detection
    const [isIOS, setIsIOS] = useState(false);
    useEffect(() => {
        setIsIOS(Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios');
    }, []);

    useEffect(() => {
        if (searchParams.get('archive') === '1') {
            setShowArchiveModal(true);
        }
    }, [searchParams]);

    // Status Bar control for PDF viewer (white background needs dark icons)
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const setStatusBarStyle = async () => {
            try {
                if (showViewer) {
                    // PDF viewer has white background - need dark icons
                    await StatusBar.setStyle({ style: Style.Light });
                    await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
                } else {
                    // Restore to theme-based style
                    const theme = document.documentElement.getAttribute('data-theme');
                    if (theme === 'dark') {
                        await StatusBar.setStyle({ style: Style.Dark });
                        await StatusBar.setBackgroundColor({ color: '#09090b' });
                    } else {
                        await StatusBar.setStyle({ style: Style.Light });
                        await StatusBar.setBackgroundColor({ color: '#F1F5F9' });
                    }
                }
            } catch (e) {
                console.error('[StatusBar] Error:', e);
            }
        };

        setStatusBarStyle();
    }, [showViewer]);

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

            // Update song state directly instead of reloading page
            setSong(prev => prev ? {
                ...prev,
                hasPdf: true,
                pdfUrl: pdfUrl,
                composer: prev.composer || globalSong.composer,
                parts: globalSong.parts,
            } : null);
        } catch (error) {
            console.error(error);
            setToast({ message: "Помилка при оновленні", type: "error" });
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        // iOS fast-path: open native viewer IMMEDIATELY from cached data
        if (isIOS && songId && userData?.choirId) {
            const cached = getCachedSongs(userData.choirId);
            if (cached) {
                const cachedSong = cached.find((s: any) => s.id === songId);
                if (cachedSong) {
                    const pdfUrl = cachedSong.parts?.[0]?.pdfUrl || cachedSong.pdfUrl;
                    if (pdfUrl && !pdfUrl.includes('t.me/') && !pdfUrl.includes('telegram.me/')) {
                        PencilKitAnnotator.openNativePdfViewer({
                            pdfUrl,
                            songId,
                            userUid: userData?.id || 'anonymous',
                            title: cachedSong.title,
                        }).then(() => {
                            router.back();
                        }).catch(e => {
                            console.error('[NativePdf] Error:', e);
                            setLoading(false);
                        });
                        return; // Skip loadSong entirely on iOS
                    }
                }
            }
        }

        async function loadSong() {
            if (!songId) return;

            setLoading(true);
            let fetched: SimpleSong | null = null;
            let offlineData = null;

            try {
                if (userData?.choirId) {
                    fetched = await getSong(userData.choirId, songId);
                }
            } catch (e) {
                console.warn("Failed to fetch song from Firestore (likely offline):", e);
            }

            // Try to load from offline cache
            // First check if we have full song data cached
            const cachedSong = await getCachedSong(songId);
            if (cachedSong) {
                offlineData = cachedSong;
                // If network fetch failed, use cached data
                if (!fetched) {
                    fetched = {
                        id: cachedSong.id,
                        title: cachedSong.title,
                        hasPdf: true,
                        pdfData: cachedSong.pdfBase64,
                        category: 'Збережено офлайн',
                    };
                    setIsOfflineMode(true);
                }
            }

            // If we have a fetched song (either from DB or constructed from cache), attach PDF data if available
            if (fetched) {
                if (offlineData) {
                    fetched.pdfData = offlineData.pdfBase64;
                    fetched.hasPdf = true;
                } else {
                    // Fallback to legacy getPdf if needed
                    const cachedPdf = await getPdf(songId);
                    if (cachedPdf) {
                        fetched.pdfData = cachedPdf;
                        fetched.hasPdf = true;
                    }
                }
            }

            setSong(fetched);
            // Auto-open PDF if available AND valid PDF (not Telegram link) AND we are NOT opening the archive or edit modals
            const isCheckingArchive = searchParams.get('archive') === '1';
            const isEditing = searchParams.get('edit') === '1';

            if (fetched?.hasPdf && (fetched.pdfUrl || fetched.pdfData) && !isCheckingArchive && !isEditing) {
                if (!isTelegramLink(fetched.pdfUrl || "")) {
                    if (isIOS) {
                        // iOS fallback: if fast-path didn't trigger (no cache)
                        const url = (fetched.parts && fetched.parts.length > 0)
                            ? fetched.parts[0].pdfUrl
                            : (fetched.pdfUrl || fetched.pdfData!);
                        PencilKitAnnotator.openNativePdfViewer({
                            pdfUrl: url,
                            songId: songId!,
                            userUid: userData?.id || 'anonymous',
                            title: fetched.title,
                        }).then(() => {
                            router.back();
                        }).catch(e => {
                            console.error('[NativePdf] Error:', e);
                            setLoading(false);
                        });
                        return; // Don't setLoading(false) — keep preloader showing
                    } else {
                        setShowViewer(true);
                    }
                }
            }
            setLoading(false);

            // Load choir data for editing
            if (userData?.role === 'head' || userData?.role === 'regent') {
                if (userData?.choirId) {
                    const choir = await getChoir(userData.choirId);
                    if (choir) {
                        setChoirData({
                            regents: choir.regents || [],
                            knownConductors: choir.knownConductors || [],
                            knownCategories: choir.knownCategories || [],
                            knownPianists: choir.knownPianists || [],
                            choirType: choir.choirType
                        });
                    }
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
        if (!file || !userData?.choirId || !song || !songId) return;

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
            setToast({ message: "Дані пісні оновлено", type: "success" });

        } catch (error) {
            console.error("Failed to update song:", error);
            setToast({ message: "Помилка оновлення", type: "error" });
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
        // On iOS, show blank white screen (native viewer opens on top immediately)
        if (isIOS) {
            return <div className="min-h-screen bg-white" />;
        }
        return <Preloader />;
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

    // Show PDF Viewer (Web/Android only — iOS uses native viewer)
    if (!isIOS && showViewer && ((song.parts && song.parts.length > 0) || song.pdfUrl || song.pdfData) && !isTg) {
        const hasParts = song.parts && song.parts.length > 1;
        const originalPdfUrl = (song.parts && song.parts.length > 0)
            ? song.parts[currentPartIndex].pdfUrl
            : (song.pdfUrl || song.pdfData!);
        // Use annotated PDF
        const currentPdfUrl = originalPdfUrl;

        return (
            <div className="h-screen bg-white flex flex-col">
                {/* PDF Header */}
                <div ref={pdfHeaderRef} className="bg-white border-b border-gray-200 shadow-sm z-10 pt-[env(safe-area-inset-top)]">
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
                                    {(() => {
                                        const nameToCheck = part.name || "";
                                        const shouldUseFilename = !nameToCheck || isGenericPartName(nameToCheck);
                                        const sourceString = shouldUseFilename ? getFileNameFromUrl(part.pdfUrl || "") : nameToCheck;
                                        return extractInstrument(sourceString || `Part ${index + 1}`, song.title);
                                    })()}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* PDF Content */}
                <div className="flex-1 overflow-hidden relative">
                    <PDFViewer
                        url={(() => {
                            // Always use direct URL for static export compatibility
                            return currentPdfUrl;
                        })()}
                        songId={songId as string}
                        title={song.title}
                        onClose={() => router.back()}
                        isAnnotating={isAnnotating && !(Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios')}
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
            <header className="bg-surface/50 backdrop-blur-xl border-b border-border px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center gap-3 sticky top-0 z-10">
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
                                <span className="truncate flex items-center gap-1" title="Регент">
                                    <User className="w-3 h-3" />
                                    {song.conductor}
                                </span>
                            </>
                        )}
                        {song.pianist && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-text-secondary/30 shrink-0" />
                                <span className="truncate flex items-center gap-1" title="Піаніст">
                                    <User className="w-3 h-3" />
                                    {song.pianist}
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
                                <span className="px-3 py-1 rounded-full bg-surface-highlight border border-border flex items-center gap-1.5" title="Регент">
                                    <User className="w-3.5 h-3.5" />
                                    {song.conductor}
                                </span>
                            )}
                            {song.pianist && (
                                <span className="px-3 py-1 rounded-full bg-surface-highlight border border-border flex items-center gap-1.5" title="Піаніст">
                                    <User className="w-3.5 h-3.5" />
                                    {song.pianist}
                                </span>
                            )}
                        </div>
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
                                            onClick={() => {
                                                if (isIOS) {
                                                    const url = (song.parts && song.parts.length > 0)
                                                        ? song.parts[currentPartIndex].pdfUrl
                                                        : (song.pdfUrl || song.pdfData!);
                                                    PencilKitAnnotator.openNativePdfViewer({
                                                        pdfUrl: url,
                                                        songId: songId!,
                                                        userUid: userData?.id || 'anonymous',
                                                        title: song.title,
                                                    }).catch(e => console.error('[NativePdf] Error:', e));
                                                } else {
                                                    setShowViewer(true);
                                                }
                                            }}
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
                                    <div className="flex gap-2 relative">
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
                                            className="flex-1 py-3 border border-border rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-highlight transition-colors text-sm font-medium"
                                        >
                                            {uploading ? "Завантаження..." : "Завантажити інший PDF"}
                                        </button>
                                        {choirData.choirType !== 'standard' && (
                                            <button
                                                onClick={() => setShowArchiveModal(true)}
                                                className="w-12 h-[50px] shrink-0 border border-border rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-highlight transition-colors"
                                                title="Знайти в архіві"
                                            >
                                                <Search className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
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
                                    <div className="flex gap-3 mb-4">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            className="flex-1 py-4 bg-primary text-background rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                        >
                                            {uploading ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Upload className="w-5 h-5" />
                                            )}
                                            Завантажити PDF
                                        </button>
                                        {choirData.choirType !== 'standard' && (
                                            <button
                                                onClick={() => setShowArchiveModal(true)}
                                                className="w-14 h-[56px] shrink-0 border-2 border-primary/20 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                                                title="Знайти в архіві"
                                            >
                                                <Search className="w-6 h-6" />
                                            </button>
                                        )}
                                    </div>

                                    <p className="text-xs text-text-secondary/50 mt-4 mb-4">
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

            {showEditModal && song && (
                <EditSongModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    onSave={handleUpdateSong}
                    initialData={song}
                    regents={choirData.regents}
                    knownConductors={choirData.knownConductors}
                    knownCategories={choirData.knownCategories}
                    knownPianists={choirData.knownPianists}
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
            {choirData.choirType !== 'standard' && showArchiveModal && (
                <div className="fixed inset-0 z-[200] bg-background flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                        <h2 className="text-lg font-bold">Знайти в архіві</h2>
                        <button
                            onClick={() => setShowArchiveModal(false)}
                            className="p-2 hover:bg-white/10 rounded-full"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-8">
                        <GlobalArchive onAddSong={handleLinkArchive} initialSearchQuery={song?.title || ""} isOverlayOpen={true} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SongPage() {
    return (
        <Suspense fallback={<Preloader />}>
            <SongContent />
        </Suspense>
    );
}
