"use client";

import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from '@capacitor/status-bar';
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getSong, updateSong, uploadSongPdf, uploadSongParts, deleteSongPart, deleteSong, getChoir } from "@/lib/db";
import { getCachedSongs } from "@/lib/offlineDataCache";
import { getPdfParts, getCachedSong } from "@/lib/offlineDb";
import { SimpleSong } from "@/types";
import PDFViewer from "@/components/PDFViewer";
import EditSongModal from "@/components/EditSongModal";
import { ArrowLeft, FileText, Upload, Loader2, Check, AlertCircle, Trash2, ExternalLink, Pencil, User, Download, X, Search, WifiOff, Plus, ChevronDown } from "lucide-react";
import { Dialog } from '@capacitor/dialog';
import { extractInstrument, getFileNameFromUrl, isGenericPartName } from "@/lib/utils";
import { CATEGORIES as OFFICIAL_THEMES } from "@/lib/themes";
import { PencilKitAnnotator } from "@/plugins/PencilKitAnnotator";

import ConfirmationModal from "@/components/ConfirmationModal";
import Toast from "@/components/Toast";
import Preloader from "@/components/Preloader";
import GlobalArchive from "@/components/GlobalArchive";
import { GlobalSong } from "@/types";
import { useStatusBar } from "@/hooks/useStatusBar";
import DictionaryManagerModal from "@/components/DictionaryManagerModal";

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
    const [addingPart, setAddingPart] = useState(false);
    const [newPartName, setNewPartName] = useState("");
    const addPartInputRef = useRef<HTMLInputElement>(null);
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

    // Aggregate Data for Dropdowns
    const normalizedRegents = useMemo(() => Array.from(new Set(
        (choirData.regents || [])
            .filter((r: string) => typeof r === 'string' && r)
            .map((r: string) => r.trim())
    )), [choirData.regents]);

    const uniqueKnownConductors = useMemo(() => (choirData.knownConductors || [])
        .filter((c: string) => typeof c === 'string' && c)
        .map((c: string) => c.trim())
        .filter((c: string) => !normalizedRegents.some(r => r.toLowerCase() === c.toLowerCase()))
        .filter((c: string, index: number, self: string[]) => self.indexOf(c) === index), [choirData.knownConductors, normalizedRegents]);

    const allConductors = useMemo(() => [...normalizedRegents, ...uniqueKnownConductors], [normalizedRegents, uniqueKnownConductors]);

    const allThemes = useMemo(() => {
        const merged = [...OFFICIAL_THEMES, ...(choirData.knownCategories || []).filter((c: string) => typeof c === 'string' && c)];
        return Array.from(new Set(merged));
    }, [choirData.knownCategories]);

    const knownPianists = useMemo(() => choirData.knownPianists || [], [choirData.knownPianists]);

    // Annotation State
    const [isAnnotating, setIsAnnotating] = useState(false);

    // Part Rename State
    const [renamingPartId, setRenamingPartId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");

    // Inline Metadata Edit State
    const [editingField, setEditingField] = useState<'title' | 'category' | 'conductor' | 'pianist' | null>(null);
    const [editValue, setEditValue] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showCustomInput, setShowCustomInput] = useState(false);

    // Dictionary Manager State
    const [manageListType, setManageListType] = useState<'conductor' | 'pianist' | 'category' | null>(null);

    // Hint State
    const [hintDismissed, setHintDismissed] = useState(false);
    useEffect(() => {
        if (localStorage.getItem('hideInlineEditHint') === 'true') {
            setHintDismissed(true);
        }
    }, []);

    const dismissHint = () => {
        setHintDismissed(true);
        localStorage.setItem('hideInlineEditHint', 'true');
    };

    // iOS detection
    const [isIOS, setIsIOS] = useState(false);
    useEffect(() => {
        setIsIOS(Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios');
    }, []);

    useEffect(() => {
        if (searchParams.get('archive') === '1') {
            setShowArchiveModal(true);
        }
        if (searchParams.get('edit') === '1' && song) {
            setShowEditModal(true);
        }
    }, [searchParams, song]);

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
        // Skip fast-path when edit=1 is set (three-dots → song info)
        const isEditing = searchParams.get('edit') === '1';
        const isCheckingArchive = searchParams.get('archive') === '1';
        const isInfoView = searchParams.get('info') === '1';
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' && songId && userData?.choirId && !isEditing && !isCheckingArchive && !isInfoView) {
            const openNativeViewer = async () => {
                let partsData: { name: string; pdfUrl: string }[] | null = null;
                let songTitle: string | undefined;

                // 1. Try localStorage song cache (has remote URLs)
                const cached = getCachedSongs(userData!.choirId!);
                if (cached) {
                    const cachedSong = cached.find((s: any) => s.id === songId);
                    if (cachedSong) {
                        songTitle = cachedSong.title;
                        const pdfUrl = cachedSong.parts?.[0]?.pdfUrl || cachedSong.pdfUrl;
                        if (pdfUrl && !isTelegramLink(pdfUrl)) {
                            partsData = (cachedSong.parts && cachedSong.parts.length > 0)
                                ? cachedSong.parts.map((p: any) => ({ name: p.name || 'Part', pdfUrl: p.pdfUrl }))
                                : [{ name: 'Головна', pdfUrl }];
                        }
                    }
                }

                // 2. If offline or no remote URLs, try IndexedDB cache (has base64)
                if (!partsData || !navigator.onLine) {
                    try {
                        const { getPdfParts } = await import('@/lib/offlineDb');
                        const offlineParts = await getPdfParts(songId!);
                        if (offlineParts && offlineParts.length > 0) {
                            partsData = offlineParts.map(p => ({ name: p.name || 'Головна', pdfUrl: p.pdfBase64 }));
                        }
                    } catch (e) {
                        console.warn('[NativePdf] IndexedDB cache check failed:', e);
                    }
                }

                if (!partsData) return false; // No data available, fall through to loadSong

                try {
                    const result = await PencilKitAnnotator.openNativePdfViewer({
                        parts: partsData,
                        initialPartIndex: 0,
                        songId: songId!,
                        userUid: userData?.id || 'anonymous',
                        title: songTitle,
                    });

                    router.back();
                } catch (e) {
                    console.error('[NativePdf] Error:', e);
                    setLoading(false);
                }
                return true;
            };

            openNativeViewer().then(handled => {
                if (handled) return;
                // Fall through to loadSong below
                loadSong();
            });
            return;
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
                        pdfData: cachedSong.parts?.[0]?.pdfBase64,
                        category: 'Збережено офлайн',
                    };
                    setIsOfflineMode(true);
                }
            }

            // If we have a fetched song (either from DB or constructed from cache), attach PDF data if available
            if (fetched) {
                if (offlineData) {
                    fetched.pdfData = offlineData.parts?.[0]?.pdfBase64;
                    fetched.hasPdf = true;
                } else {
                    // Fallback to offlineDb parts directly if full song cache wasn't used
                    const cachedParts = await getPdfParts(songId);
                    if (cachedParts && cachedParts.length > 0) {
                        const matchedPart = cachedParts.find(p => p.pdfBase64 && p.pdfBase64.startsWith('data:')) || cachedParts[0];
                        if (matchedPart && matchedPart.pdfBase64) {
                            fetched.pdfData = matchedPart.pdfBase64;
                            fetched.hasPdf = true;
                        }
                    }
                }
            }

            setSong(fetched);
            // Auto-open PDF if available AND valid PDF (not Telegram link) AND we are NOT opening the archive or edit modals
            const isCheckingArchive = searchParams.get('archive') === '1';
            const isEditing = searchParams.get('edit') === '1';
            const isInfoView = searchParams.get('info') === '1';

            if (fetched?.hasPdf && (fetched.pdfUrl || fetched.pdfData) && !isCheckingArchive && !isEditing && !isInfoView) {
                if (!isTelegramLink(fetched.pdfUrl || "")) {
                    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
                        const partsData = (fetched.parts && fetched.parts.length > 0)
                            ? fetched.parts.map(p => ({ name: p.name || 'Part', pdfUrl: p.pdfUrl }))
                            : [{ name: 'Головна', pdfUrl: fetched.pdfUrl || fetched.pdfData! }];

                        PencilKitAnnotator.openNativePdfViewer({
                            parts: partsData,
                            initialPartIndex: 0,
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

        // Validate file — iOS file picker may return empty or wrong type for PDFs
        const isPdf = file.type === 'application/pdf' || (file instanceof File && file.name.toLowerCase().endsWith('.pdf'));
        if (!isPdf) {
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

            const updatedSong = { ...song, hasPdf: true, pdfUrl: url, pdfData: undefined };
            setSong(updatedSong);
            setUploadStatus('success');

            // Auto-show viewer on successful upload
            if (isIOS) {
                // Open PencilKit native viewer on iOS
                const partsData = (updatedSong.parts && updatedSong.parts.length > 0)
                    ? updatedSong.parts.map(p => ({ name: p.name || 'Part', pdfUrl: p.pdfUrl }))
                    : [{ name: 'Головна', pdfUrl: url }];
                PencilKitAnnotator.openNativePdfViewer({
                    parts: partsData,
                    initialPartIndex: 0,
                    songId: songId!,
                    userUid: userData?.id || 'anonymous',
                    title: updatedSong.title,
                }).then(() => {
                    router.back();
                }).catch(e => {
                    console.error('[NativePdf] Error:', e);
                });
            } else {
                setShowViewer(true);
            }
        } catch (err) {
            console.error("Upload error:", err);
            setUploadStatus('error');
            setErrorMessage("Помилка завантаження файлу");
        } finally {
            setUploading(false);
        }
    };

    const handleAddPartFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userData?.choirId || !song || !songId) return;

        // Reset input so same file can be re-selected
        e.target.value = '';

        // iOS file picker may return empty or wrong type for PDFs
        const isPdf = file.type === 'application/pdf' || (file instanceof File && file.name.toLowerCase().endsWith('.pdf'));
        if (!isPdf) {
            await Dialog.alert({ title: "Помилка", message: "Тільки PDF файли дозволені" });
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            await Dialog.alert({ title: "Помилка", message: "Файл занадто великий (макс. 50 MB)" });
            return;
        }

        setUploading(true);
        try {
            const updatedParts = await uploadSongParts(
                userData.choirId, songId,
                [{ name: newPartName.trim(), file }]
            );
            setSong(prev => prev ? { ...prev, hasPdf: true, parts: updatedParts, pdfUrl: updatedParts[0]?.pdfUrl } : null);
            setAddingPart(false);
            setNewPartName("");
            setToast({ message: "Файл додано", type: "success" });
        } catch (err) {
            console.error("Add part error:", err);
            setToast({ message: "Помилка додавання файлу", type: "error" });
        } finally {
            setUploading(false);
        }
    };

    const handleDeletePart = async (partId: string) => {
        if (!userData?.choirId || !songId || !song) return;

        const { value: confirmed } = await Dialog.confirm({
            title: "Видалити файл?",
            message: "Ви впевнені, що хочете видалити цю частину?",
            okButtonTitle: "Видалити",
            cancelButtonTitle: "Скасувати"
        });

        if (!confirmed) return;

        setUploading(true);
        try {
            await deleteSongPart(userData.choirId, songId, partId);
            setSong(prev => {
                if (!prev || !prev.parts) return prev;
                const updated = prev.parts.filter(p => p.id !== partId);
                return { ...prev, parts: updated, pdfUrl: updated[0]?.pdfUrl };
            });
            setToast({ message: "Файл видалено", type: "success" });
        } catch (err: any) {
            console.error("Delete part error:", err);
            const msg = err?.message === "Cannot delete last part" ? "Не можна видалити останній файл" : "Помилка видалення";
            setToast({ message: msg, type: "error" });
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
        // On native, the native PDF viewer covers the screen — render nothing.
        if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) return null;
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

    // Show PDF Viewer
    if (showViewer && ((song.parts && song.parts.length > 0) || song.pdfUrl || song.pdfData) && !isTg) {
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
                                <p className="text-xs text-gray-500 font-medium whitespace-none truncate px-1" style={{ maxWidth: "200px" }}>
                                    {(() => {
                                        const nameToCheck = song.parts[currentPartIndex].name || "";
                                        const shouldUseFilename = !nameToCheck || isGenericPartName(nameToCheck);
                                        const sourceString = shouldUseFilename ? getFileNameFromUrl(song.parts[currentPartIndex].pdfUrl || "") : nameToCheck;
                                        return extractInstrument(sourceString || `Part ${currentPartIndex + 1}`, song.title);
                                    })()}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    if (isIOS) {
                                        const partsData = (song.parts && song.parts.length > 0)
                                            ? song.parts.map(p => ({ name: p.name || 'Part', pdfUrl: p.pdfUrl }))
                                            : [{ name: 'Головна', pdfUrl: song.pdfUrl || song.pdfData! }];

                                        PencilKitAnnotator.openNativePdfViewer({
                                            parts: partsData,
                                            initialPartIndex: currentPartIndex,
                                            songId: songId as string,
                                            userUid: userData?.id || 'anonymous',
                                            title: song.title,
                                        }).catch(e => {
                                            console.error('[NativePdf] Error:', e);
                                        });
                                    } else {
                                        setIsAnnotating(!isAnnotating);
                                    }
                                }}
                                className={`p-2 rounded-full transition-colors ${isAnnotating && !isIOS ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
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
                        songId={currentPartIndex === 0 ? songId as string : undefined}
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

    // ─── Part Rename Handler ───

    const handleRenamePart = async (partId: string, newName: string) => {
        if (!userData?.choirId || !songId || !song?.parts) return;
        const trimmed = newName.trim();
        if (!trimmed) return;

        const updatedParts = song.parts.map(p =>
            p.id === partId ? { ...p, name: trimmed } : p
        );

        try {
            await updateSong(userData.choirId, songId, { parts: updatedParts });
            setSong(prev => prev ? { ...prev, parts: updatedParts } : null);
            setToast({ message: "Назву оновлено", type: "success" });
        } catch (err) {
            console.error("Rename part error:", err);
            setToast({ message: "Помилка перейменування", type: "error" });
        } finally {
            setRenamingPartId(null);
            setRenameValue("");
        }
    };

    // ─── Metadata Inline Edit Handler ───
    const handleSaveField = async (field: keyof SimpleSong, valueToSave?: string) => {
        if (!userData?.choirId || !songId || !song) return;

        const trimmed = (valueToSave !== undefined ? valueToSave : editValue).trim();
        const finalValue = trimmed === "" ? "" : trimmed; // Can be empty string if user clears optional fields

        try {
            // Save custom conductor
            if (showCustomInput && finalValue && field === 'conductor') {
                const isKnown = allConductors.includes(finalValue);
                if (!isKnown) {
                    const { addKnownConductor } = await import("@/lib/db");
                    await addKnownConductor(userData.choirId, finalValue);
                    setChoirData(prev => ({ ...prev, knownConductors: [...prev.knownConductors, finalValue] }));
                }
            }

            // Save custom pianist
            if (showCustomInput && finalValue && field === 'pianist') {
                const isKnown = knownPianists.includes(finalValue);
                if (!isKnown) {
                    const { addKnownPianist } = await import("@/lib/db");
                    await addKnownPianist(userData.choirId, finalValue);
                    setChoirData(prev => ({ ...prev, knownPianists: [...prev.knownPianists, finalValue] }));
                }
            }

            // Save custom category
            if (showCustomInput && finalValue && field === 'category') {
                const isKnown = allThemes.includes(finalValue);
                if (!isKnown) {
                    const { addKnownCategory } = await import("@/lib/db");
                    await addKnownCategory(userData.choirId, finalValue);
                    setChoirData(prev => ({ ...prev, knownCategories: [...(prev.knownCategories || []), finalValue] }));
                }
            }

            await updateSong(userData.choirId, songId, { [field]: finalValue });
            setSong(prev => prev ? { ...prev, [field]: finalValue } : null);
            setToast({ message: "Збережено", type: "success" });
        } catch (err) {
            console.error("Update field error:", err);
            setToast({ message: "Помилка збереження", type: "error" });
        } finally {
            setEditingField(null);
            setEditValue("");
            setIsDropdownOpen(false);
            setShowCustomInput(false);
        }
    };

    const handleDeleteFieldItem = async (type: 'conductor' | 'pianist', item: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!userData?.choirId) return;

        const { value: confirm } = await Dialog.confirm({
            title: "Видалити",
            message: `Видаляємо "${item}" зі списку?`,
            okButtonTitle: "Видалити",
            cancelButtonTitle: "Скасувати"
        });

        if (confirm) {
            try {
                if (type === 'conductor') {
                    const { removeKnownConductor } = await import("@/lib/db");
                    if (uniqueKnownConductors.includes(item)) {
                        await removeKnownConductor(userData.choirId, item);
                    } else if (choirData.regents.includes(item)) {
                        const { doc, updateDoc, arrayRemove } = await import("firebase/firestore");
                        const { db } = await import("@/lib/firebase");
                        const choirRef = doc(db, "choirs", userData.choirId);
                        await updateDoc(choirRef, { regents: arrayRemove(item) });
                    }
                    setChoirData(prev => ({
                        ...prev,
                        knownConductors: prev.knownConductors.filter(c => c !== item),
                        regents: prev.regents.filter(c => c !== item)
                    }));

                    // If we're deleting the currently selected item globally, clear it from the song
                    if (song?.conductor === item) await handleSaveField('conductor', '');
                } else if (type === 'pianist') {
                    const { removeKnownPianist } = await import("@/lib/db");
                    await removeKnownPianist(userData.choirId, item);
                    setChoirData(prev => ({
                        ...prev,
                        knownPianists: prev.knownPianists.filter(p => p !== item)
                    }));
                    if (song?.pianist === item) await handleSaveField('pianist', '');
                } else if (type === 'category') {
                    const { removeKnownCategory } = await import("@/lib/db");
                    await removeKnownCategory(userData.choirId, item);
                    setChoirData(prev => ({
                        ...prev,
                        knownCategories: (prev.knownCategories || []).filter(c => c !== item)
                    }));
                }
                setToast({ message: "Вилучено зі словника", type: "success" });
            } catch (err) {
                console.error("Delete item error:", err);
                setToast({ message: "Помилка видалення", type: "error" });
            }
        }
    };


    return (
        <div className="min-h-screen bg-background text-text-primary flex flex-col">
            {/* ─── Header ─── */}
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
                            onClick={handleDelete}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </header>

            {/* ─── Content ─── */}
            <div className="flex-1 overflow-y-auto px-4 py-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">

                {/* ── Song Info Section (Inline Editable) ── */}
                <div className="mb-6 bg-surface border border-border rounded-2xl p-4">
                    {/* TITLE */}
                    <div className="mb-4">
                        {editingField === 'title' ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="flex-1 bg-surface-highlight text-text-primary text-xl font-bold rounded-lg px-3 py-2 border border-primary/30 focus:outline-none focus:border-primary"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveField('title');
                                        if (e.key === 'Escape') { setEditingField(null); setEditValue(""); }
                                    }}
                                />
                                <button onClick={() => handleSaveField('title')} className="p-2 text-primary hover:bg-primary/10 rounded-lg"><Check className="w-5 h-5" /></button>
                                <button onClick={() => { setEditingField(null); setEditValue(""); }} className="p-2 text-text-secondary hover:bg-surface-highlight rounded-lg"><X className="w-5 h-5" /></button>
                            </div>
                        ) : (
                            <div
                                className={`flex items-start justify-between gap-3 ${canEdit ? 'cursor-pointer group' : ''}`}
                                onClick={canEdit ? () => { setEditingField('title'); setEditValue(song.title); } : undefined}
                            >
                                <h2 className="text-xl font-bold text-text-primary leading-tight flex-1 group-hover:text-primary transition-colors">{song.title}</h2>
                                {canEdit && <Pencil className="w-4 h-4 text-text-secondary/30 group-hover:text-primary shrink-0 mt-1 transition-colors" />}
                            </div>
                        )}
                    </div>

                    {/* METADATA TAGS */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* CATEGORY */}
                        {editingField === 'category' ? (
                            <div className="flex items-center gap-1 w-full sm:w-auto mt-2 sm:mt-0 relative">
                                {!showCustomInput ? (
                                    <select
                                        value={editValue}
                                        onChange={(e) => {
                                            if (e.target.value === '__ADD_NEW__') {
                                                setShowCustomInput(true);
                                                setEditValue('');
                                            } else if (e.target.value === '__MANAGE__') {
                                                setManageListType('category');
                                                setEditingField(null);
                                            } else {
                                                setEditValue(e.target.value);
                                                handleSaveField('category', e.target.value);
                                            }
                                        }}
                                        autoFocus
                                        className="bg-surface-highlight text-xs font-bold uppercase tracking-wider text-primary rounded-full px-4 py-2 border border-primary/30 outline-none cursor-pointer"
                                        onBlur={() => setEditingField(null)}
                                    >
                                        <option value="" disabled>Оберіть...</option>
                                        {allThemes.map((t: string) => <option key={t} value={t}>{t}</option>)}
                                        <option value="__ADD_NEW__">➕ Додати нову...</option>
                                        <option value="__MANAGE__">✏️ Редагувати список...</option>
                                    </select>
                                ) : (
                                    <div className="flex items-center gap-1 w-full sm:w-auto">
                                        <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus placeholder="Нова категорія" className="bg-surface-highlight text-xs font-bold uppercase tracking-wider text-primary rounded-full px-3 py-1.5 border border-primary/30 outline-none w-32" onKeyDown={(e) => { if (e.key === 'Enter') handleSaveField('category'); if (e.key === 'Escape') { setEditingField(null); setShowCustomInput(false); } }} />
                                        <button onClick={() => handleSaveField('category')} className="p-1 text-primary"><Check className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <span
                                onClick={canEdit ? () => { setEditingField('category'); setEditValue(song.category); setShowCustomInput(false); dismissHint(); } : undefined}
                                className={`text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-bold uppercase tracking-wider ${canEdit ? 'cursor-pointer hover:bg-primary/20 transition-colors' : ''}`}
                            >
                                {song.category}
                            </span>
                        )}

                        {/* CONDUCTOR */}
                        {editingField === 'conductor' ? (
                            <div className="flex items-center gap-1 w-full sm:w-auto mt-2 sm:mt-0 relative">
                                {!showCustomInput ? (
                                    <>
                                        <select
                                            value={editValue}
                                            onChange={(e) => {
                                                if (e.target.value === '__ADD_NEW__') {
                                                    setShowCustomInput(true);
                                                    setEditValue('');
                                                } else if (e.target.value === '__MANAGE__') {
                                                    setManageListType('conductor');
                                                    setEditingField(null);
                                                } else {
                                                    setEditValue(e.target.value);
                                                    handleSaveField('conductor', e.target.value);
                                                }
                                            }}
                                            autoFocus
                                            className="bg-surface-highlight text-xs text-text-primary rounded-full px-4 py-2 border border-primary/30 outline-none cursor-pointer"
                                            onBlur={() => setEditingField(null)}
                                        >
                                            <option value="">Оберіть...</option>
                                            {allConductors.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                            <option value="__ADD_NEW__">➕ Новий регент...</option>
                                            <option value="__MANAGE__">✏️ Редагувати список...</option>
                                        </select>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-1 w-full sm:w-auto mt-2 sm:mt-0">
                                        <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus placeholder="Новий регент" className="bg-surface-highlight text-xs text-text-primary rounded-full px-3 py-1.5 border border-primary/30 outline-none w-32" onKeyDown={(e) => { if (e.key === 'Enter') handleSaveField('conductor'); if (e.key === 'Escape') { setEditingField(null); setShowCustomInput(false); } }} />
                                        <button onClick={() => handleSaveField('conductor')} className="p-1 text-primary"><Check className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            (song.conductor || canEdit) && (
                                <span
                                    onClick={canEdit ? () => { setEditingField('conductor'); setEditValue(song.conductor || ""); setShowCustomInput(false); dismissHint(); } : undefined}
                                    className={`text-xs px-3 py-1.5 rounded-full bg-surface-highlight border border-border text-text-secondary flex items-center gap-1 ${canEdit ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''} ${!song.conductor ? 'opacity-50 border-dashed' : ''}`}
                                    title="Регент"
                                >
                                    <User className="w-3 h-3" /> {song.conductor || '+ Регент'}
                                </span>
                            )
                        )}

                        {/* PIANIST */}
                        {editingField === 'pianist' ? (
                            <div className="flex items-center gap-1 w-full sm:w-auto mt-2 sm:mt-0 relative">
                                {!showCustomInput ? (
                                    <>
                                        <select
                                            value={editValue}
                                            onChange={(e) => {
                                                if (e.target.value === '__ADD_NEW__') {
                                                    setShowCustomInput(true);
                                                    setEditValue('');
                                                } else if (e.target.value === '__MANAGE__') {
                                                    setManageListType('pianist');
                                                    setEditingField(null);
                                                } else {
                                                    setEditValue(e.target.value);
                                                    handleSaveField('pianist', e.target.value);
                                                }
                                            }}
                                            autoFocus
                                            className="bg-surface-highlight text-xs text-text-primary rounded-full px-4 py-2 border border-primary/30 outline-none cursor-pointer"
                                            onBlur={() => setEditingField(null)}
                                        >
                                            <option value="">Немає (або оберіть...)</option>
                                            {knownPianists.map((p: string) => <option key={p} value={p}>{p}</option>)}
                                            <option value="__ADD_NEW__">➕ Новий піаніст...</option>
                                            <option value="__MANAGE__">✏️ Редагувати список...</option>
                                        </select>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-1 w-full sm:w-auto mt-2 sm:mt-0">
                                        <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus placeholder="Новий піаніст" className="bg-surface-highlight text-xs text-text-primary rounded-full px-3 py-1.5 border border-primary/30 outline-none w-32" onKeyDown={(e) => { if (e.key === 'Enter') handleSaveField('pianist'); if (e.key === 'Escape') { setEditingField(null); setShowCustomInput(false); } }} />
                                        <button onClick={() => handleSaveField('pianist')} className="p-1 text-primary"><Check className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            (song.pianist || canEdit) && (
                                <span
                                    onClick={canEdit ? () => { setEditingField('pianist'); setEditValue(song.pianist || ""); setShowCustomInput(false); dismissHint(); } : undefined}
                                    className={`text-xs px-3 py-1.5 rounded-full bg-surface-highlight border border-border text-text-secondary flex items-center gap-1 ${canEdit ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''} ${!song.pianist ? 'opacity-50 border-dashed' : ''}`}
                                    title="Піаніст"
                                >
                                    <User className="w-3 h-3" /> {song.pianist || '+ Піаніст'}
                                </span>
                            )
                        )}
                    </div>

                    {canEdit && !editingField && !hintDismissed && (
                        <p className="text-[10px] text-text-secondary/40 mt-3 flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> Натискайте на поля для швидкого редагування
                        </p>
                    )}
                </div>

                {/* ── PDF Actions Section ── */}
                {song.hasPdf && (song.pdfUrl || song.pdfData) ? (
                    <div className="space-y-6">
                        {isTg ? (
                            <a
                                href={song.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-4 bg-[#2AABEE] text-white rounded-2xl font-bold hover:bg-[#2AABEE]/90 transition-colors shadow-lg shadow-[#2AABEE]/20 flex items-center justify-center gap-2"
                            >
                                <ExternalLink className="w-5 h-5" />
                                Відкрити в Telegram
                            </a>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        if (isIOS) {
                                            const partsData = (song.parts && song.parts.length > 0)
                                                ? song.parts.map(p => ({ name: p.name || 'Part', pdfUrl: p.pdfUrl }))
                                                : [{ name: 'Головна', pdfUrl: song.pdfUrl || song.pdfData! }];

                                            PencilKitAnnotator.openNativePdfViewer({
                                                parts: partsData,
                                                initialPartIndex: currentPartIndex,
                                                songId: songId!,
                                                userUid: userData?.id || 'anonymous',
                                                title: song.title,
                                            }).catch(e => {
                                                console.error('[NativePdf] Error:', e);
                                            });
                                        } else {
                                            setShowViewer(true);
                                        }
                                    }}
                                    className="flex-1 py-4 bg-primary text-background rounded-2xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-base"
                                >
                                    <FileText className="w-5 h-5" />
                                    Відкрити ноти
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="w-14 py-4 bg-surface border border-border text-text-primary rounded-2xl font-bold hover:bg-surface-highlight transition-colors flex items-center justify-center"
                                    title="Завантажити PDF"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {/* ── Parts (Партитури) Section ── */}
                        {(canEdit || (song.parts && song.parts.length > 1)) && (
                            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                                    <p className="text-xs text-text-secondary uppercase tracking-wider font-bold">Партитури</p>
                                    <span className="text-[10px] text-text-secondary/50 bg-surface-highlight px-2 py-0.5 rounded-full">{song.parts?.length || 1} файл(ів)</span>
                                </div>

                                {/* Parts List */}
                                {song.parts && song.parts.length > 0 && (
                                    <div className="divide-y divide-border">
                                        {song.parts.map((part, index) => {
                                            const displayName = (() => {
                                                const nameToCheck = part.name || "";
                                                const shouldUseFilename = !nameToCheck || isGenericPartName(nameToCheck);
                                                const sourceString = shouldUseFilename ? getFileNameFromUrl(part.pdfUrl || "") : nameToCheck;
                                                return extractInstrument(sourceString || `Part ${index + 1}`, song.title);
                                            })();

                                            const isRenaming = renamingPartId === part.id;

                                            return (
                                                <div key={part.id || index} className="flex items-center gap-3 px-4 py-3 group">
                                                    <div className="w-8 h-8 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
                                                        <FileText className="w-4 h-4 text-primary" />
                                                    </div>

                                                    {isRenaming ? (
                                                        <div className="flex-1 flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={renameValue}
                                                                onChange={(e) => setRenameValue(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleRenamePart(part.id!, renameValue);
                                                                    if (e.key === 'Escape') { setRenamingPartId(null); setRenameValue(""); }
                                                                }}
                                                                placeholder="Нова назва..."
                                                                className="flex-1 px-2 py-1 bg-surface-highlight border border-primary/30 rounded-lg text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-primary"
                                                                autoFocus
                                                            />
                                                            <button
                                                                onClick={() => handleRenamePart(part.id!, renameValue)}
                                                                className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => { setRenamingPartId(null); setRenameValue(""); }}
                                                                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="flex-1 text-sm font-medium text-text-primary truncate">
                                                                {displayName}
                                                            </span>
                                                            {canEdit && part.id && (
                                                                <div className="flex items-center gap-0.5">
                                                                    <button
                                                                        onClick={() => {
                                                                            setRenamingPartId(part.id!);
                                                                            setRenameValue(displayName);
                                                                        }}
                                                                        className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                                        title="Перейменувати"
                                                                    >
                                                                        <Pencil className="w-4 h-4" />
                                                                    </button>
                                                                    {song.parts!.length > 1 && (
                                                                        <button
                                                                            onClick={() => handleDeletePart(part.id!)}
                                                                            disabled={uploading}
                                                                            className="p-2 text-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                            title="Видалити"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Add Part Section */}
                                {canEdit && (
                                    <div className="px-4 py-3 border-t border-border">
                                        <input
                                            ref={addPartInputRef}
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            onChange={handleAddPartFileSelect}
                                            className="hidden"
                                        />

                                        {addingPart ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={newPartName}
                                                    onChange={(e) => setNewPartName(e.target.value)}
                                                    placeholder="Назва (напр. Сопрано, Скрипка 1...)"
                                                    className="w-full px-3 py-2.5 bg-surface-highlight border border-border rounded-xl text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-primary/50"
                                                    autoFocus
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => addPartInputRef.current?.click()}
                                                        disabled={uploading || !newPartName.trim()}
                                                        className="flex-1 py-2.5 bg-primary text-background rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                    >
                                                        {uploading ? (
                                                            <><Loader2 className="w-4 h-4 animate-spin" /> Завантаження...</>
                                                        ) : (
                                                            <><Upload className="w-4 h-4" /> Обрати PDF</>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => { setAddingPart(false); setNewPartName(""); }}
                                                        className="px-4 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:text-text-primary transition-colors"
                                                    >
                                                        Скасувати
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setAddingPart(true)}
                                                    disabled={uploading}
                                                    className="flex-1 py-2.5 border border-dashed border-border rounded-xl text-text-secondary hover:text-primary hover:border-primary/30 transition-colors text-sm font-medium flex items-center justify-center gap-1.5"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Додати файл
                                                </button>
                                                {choirData.choirType !== 'standard' && (
                                                    <button
                                                        onClick={() => setShowArchiveModal(true)}
                                                        className="w-12 h-[42px] shrink-0 border border-border rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-highlight transition-colors"
                                                        title="Знайти в архіві"
                                                    >
                                                        <Search className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    // ── No PDF ──
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                        <div className="w-20 h-20 bg-surface-highlight rounded-full flex items-center justify-center mb-6 border border-border">
                            <FileText className="w-10 h-10 text-text-secondary/30" />
                        </div>
                        <h2 className="text-xl font-bold text-text-primary mb-2">
                            Немає нот
                        </h2>
                        <p className="text-text-secondary text-sm mb-8 max-w-xs">
                            Для цієї пісні ще не завантажено PDF файл
                        </p>

                        {canEdit ? (
                            <div className="w-full max-w-sm">
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
                                        className="flex-1 py-4 bg-primary text-background rounded-2xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
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
                                            className="w-14 h-[56px] shrink-0 border-2 border-primary/20 rounded-2xl flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                                            title="Знайти в архіві"
                                        >
                                            <Search className="w-6 h-6" />
                                        </button>
                                    )}
                                </div>

                                <p className="text-xs text-text-secondary/50 mb-4">
                                    Максимальний розмір: 50 MB
                                </p>

                                {uploadStatus === 'success' && (
                                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400">
                                        <Check className="w-5 h-5" />
                                        <span className="font-medium text-sm">Файл успішно завантажено</span>
                                    </div>
                                )}

                                {uploadStatus === 'error' && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-left">
                                        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                        <span className="font-medium text-sm">{errorMessage}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-text-secondary">Зверніться до регента, щоб додати ноти</p>
                        )}
                    </div>
                )}
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
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-background/80 backdrop-blur-md sticky top-0 z-10 pt-[calc(1rem+env(safe-area-inset-top))]">
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

            {/* Dictionary Manager Modal */}
            <DictionaryManagerModal
                isOpen={manageListType !== null}
                onClose={() => setManageListType(null)}
                title={
                    manageListType === 'conductor' ? 'Словник регентів' :
                        manageListType === 'pianist' ? 'Словник піаністів' :
                            'Словник категорій'
                }
                items={
                    manageListType === 'conductor' ? allConductors || [] :
                        manageListType === 'pianist' ? knownPianists || [] :
                            (choirData?.knownCategories || [])
                }
                onDelete={async (item) => {
                    const e = { stopPropagation: () => { } } as any;
                    await handleDeleteFieldItem(manageListType as any, item, e);
                }}
            />
        </div>
    );
}

export default function SongPage() {
    const isIOSNative = typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

    return (
        <Suspense fallback={isIOSNative ? null : <Preloader />}>
            <SongContent />
        </Suspense>
    );
}
