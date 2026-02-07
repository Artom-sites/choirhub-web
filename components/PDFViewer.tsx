"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
    X,
    Loader2,
    ZoomIn,
    ZoomOut,
    Download,
    Plus,
    WifiOff,
    Check,

    FileSignature
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { getPdfFromCache, savePdfToCache } from "../lib/cache";
import { getPdf as getOfflinePdf } from "../lib/offlineDb";
import AnnotationToolbar, { ToolType, EraserSize } from "./AnnotationToolbar";
import AnnotationCanvas from "./AnnotationCanvas";
import { usePinchZoom } from "../hooks/usePinchZoom";

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(
    () => import("react-pdf").then((mod) => mod.Document),
    { ssr: false }
) as any;
const Page = dynamic(
    () => import("react-pdf").then((mod) => mod.Page),
    { ssr: false }
) as any;

interface PDFViewerProps {
    url: string;
    songId?: string;  // For IndexedDB offline cache lookup
    title?: string;
    onClose?: () => void;
    onAddAction?: () => void;
    // Optional: external annotation control
    isAnnotating?: boolean;
    onAnnotatingChange?: (value: boolean) => void;
}

export default function PDFViewer({ url, songId, title, onClose, onAddAction, isAnnotating: externalIsAnnotating, onAnnotatingChange }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [workerReady, setWorkerReady] = useState(false);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isCached, setIsCached] = useState(false);
    const [pdfSource, setPdfSource] = useState<string | null>(null);
    const [showIndicator, setShowIndicator] = useState(false);

    // Annotation State (use external if provided)
    const [internalIsAnnotating, setInternalIsAnnotating] = useState(false);
    const isAnnotating = externalIsAnnotating !== undefined ? externalIsAnnotating : internalIsAnnotating;
    const setIsAnnotating = onAnnotatingChange || setInternalIsAnnotating;
    const [activeTool, setActiveTool] = useState<ToolType>('pen');
    const [eraserSize, setEraserSize] = useState<EraserSize>('medium');
    const [color, setColor] = useState('#000000'); // Default black
    const [pageDimensions, setPageDimensions] = useState<Record<number, { width: number, height: number }>>({});
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
    const [triggerClear, setTriggerClear] = useState(0);
    const [triggerUndo, setTriggerUndo] = useState(0);
    const [triggerRedo, setTriggerRedo] = useState(0);

    // Pinch-to-zoom for annotation mode
    const pinchZoom = usePinchZoom({
        minScale: 1,
        maxScale: 4,
        enabled: isAnnotating
    });

    // Stable callback for history changes
    const handleHistoryChange = useCallback((canUndo: boolean, canRedo: boolean) => {
        setHistoryState({ canUndo, canRedo });
    }, []);

    // Cache / Load Logic
    useEffect(() => {
        let active = true;

        const loadPdf = async () => {
            if (!url && !songId) return;
            setIsLoading(true);
            setError(null);

            try {
                // 1. First check IndexedDB offline cache (by songId)
                if (songId) {
                    const offlinePdf = await getOfflinePdf(songId);
                    if (offlinePdf && active) {
                        console.log('[PDFViewer] Loaded from IndexedDB offline cache');
                        setPdfSource(offlinePdf); // This is a data URI
                        setIsCached(true);
                        setShowIndicator(true);
                        return;
                    }
                }

                // 2. Check URL-based cache (cache.ts)
                if (url && !url.startsWith('data:')) {
                    const cachedBlob = await getPdfFromCache(url);
                    if (cachedBlob && active) {
                        const objectUrl = URL.createObjectURL(cachedBlob);
                        setPdfSource(objectUrl);
                        setIsCached(true);
                        setShowIndicator(true);
                        console.log('[PDFViewer] Loaded from URL cache');
                        return;
                    }
                }

                // 3. If URL is data URI, use directly
                if (url && url.startsWith('data:')) {
                    if (active) {
                        setPdfSource(url);
                        setIsCached(true);
                        console.log('[PDFViewer] Using data URI directly');
                    }
                    return;
                }

                // 4. Try network fetch
                if (url && active) {
                    if (!navigator.onLine) {
                        setError('Немає інтернету і файл не збережено офлайн');
                        return;
                    }

                    setPdfSource(url); // Use URL immediately

                    // Background fetch to cache
                    fetch(url)
                        .then(res => {
                            if (!res.ok) throw new Error('Fetch failed');
                            return res.blob();
                        })
                        .then(blob => {
                            savePdfToCache(url, blob);
                            if (active) {
                                setIsCached(true);
                                setShowIndicator(true);
                            }
                        })
                        .catch(err => console.error('[PDFViewer] Background cache failed:', err));
                } else if (!url) {
                    setError('Немає URL для завантаження PDF');
                }
            } catch (err) {
                console.error('[PDFViewer] PDF Load Error:', err);
                if (active) setError('Помилка завантаження');
            }
        };

        loadPdf();

        return () => {
            active = false;
        };
    }, [url, songId]);

    // Auto-hide indicator
    useEffect(() => {
        if (showIndicator) {
            const timer = setTimeout(() => setShowIndicator(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showIndicator]);

    useEffect(() => {
        const setupWorker = async () => {
            try {
                const pdfjs = await import("react-pdf");
                const version = pdfjs.pdfjs.version;
                if (!version) throw new Error("PDF.js version not found");

                pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
                setWorkerReady(true);
            } catch (e) {
                console.error("PDF Worker setup failed:", e);
                setError("Помилка ініціалізації PDF переглядача");
            }
        };
        setupWorker();
    }, []);

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth - 20); // Margin
            }
        };
        // Initial delay
        setTimeout(updateWidth, 100);
        window.addEventListener("resize", updateWidth);
        return () => window.removeEventListener("resize", updateWidth);
    }, []);

    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setIsLoading(false);
        setError(null);
    }, []);

    const onDocumentLoadError = useCallback(() => {
        setError("Не вдалося завантажити PDF");
        if (!navigator.onLine && !isCached) {
            setError("Немає інтернету і файл не збережено");
        }
        setIsLoading(false);
    }, [isCached]);

    const onPageLoadSuccess = (page: any) => {
        // Calculate aspect ratio to determine height based on containerWidth
        const viewport = page.getViewport({ scale: 1 });
        const aspectRatio = viewport.width / viewport.height;
        // height = width / aspectRatio
        // We use the containerWidth as the source of truth for rendered width
        if (containerWidth) {
            setPageDimensions(prev => ({
                ...prev,
                [page.pageNumber]: {
                    width: containerWidth,
                    height: containerWidth / aspectRatio
                }
            }));
        }
    };

    const handleDownload = async () => {
        if (!pdfSource) return;
        try {
            const a = document.createElement('a');
            a.href = pdfSource;
            a.download = title ? `${title}.pdf` : 'song.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        }
    };

    if (!workerReady) {
        return (
            <div className="flex flex-col h-full bg-background items-center justify-center">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white relative">


            {/* Offline Indicator */}
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 transition-all duration-500 pointer-events-none ${showIndicator ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <div className="bg-green-500/90 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 backdrop-blur-md">
                    <Check className="w-3 h-3" />
                    Збережено офлайн
                </div>
            </div>

            {/* Content (Scrollable with pinch-zoom support) */}
            <div
                ref={containerRef}
                className={`flex-1 overflow-auto bg-white scrollbar-hide ${isAnnotating ? 'touch-pan-y' : ''}`}
                style={{ WebkitOverflowScrolling: 'touch' }}
                {...(isAnnotating ? pinchZoom.handlers : {})}
            >
                <div
                    className="min-h-full flex flex-col items-center py-2 px-0 pb-32"
                    style={isAnnotating ? pinchZoom.style : undefined}
                >
                    {isLoading && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-20 px-4">
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <WifiOff className="w-8 h-8 text-red-400" />
                            </div>
                            <p className="text-red-400 mb-4">{error}</p>
                            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-black text-white rounded-xl">
                                Спробувати знову
                            </button>
                        </div>
                    )}

                    {pdfSource && (
                        <Document
                            file={pdfSource}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={null}
                            className="flex flex-col w-full"
                        >
                            {Array.from(new Array(numPages), (el, index) => {
                                const pageNum = index + 1;
                                const dims = pageDimensions[pageNum];

                                return (
                                    <div key={`page_${pageNum}`} className="w-full relative">
                                        <Page
                                            pageNumber={pageNum}
                                            width={containerWidth ? containerWidth : undefined}
                                            onLoadSuccess={onPageLoadSuccess}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            className="bg-white overflow-hidden w-full"
                                            loading={
                                                <div className="w-full aspect-[1/1.4] bg-white/5 animate-pulse" />
                                            }
                                        />
                                        {isAnnotating && dims && (
                                            <div className="absolute inset-0 z-20">
                                                <AnnotationCanvas
                                                    pageNumber={pageNum}
                                                    pdfUrl={url}
                                                    width={dims.width}
                                                    height={dims.height}
                                                    activeTool={activeTool}
                                                    color={color}
                                                    eraserSize={eraserSize}
                                                    onHistoryChange={handleHistoryChange}
                                                    triggerClear={triggerClear}
                                                    triggerUndo={triggerUndo}
                                                    triggerRedo={triggerRedo}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </Document>
                    )}
                </div>
            </div>

            {/* Annotation Toolbar */}
            <AnimatePresence>
                {isAnnotating && (
                    <AnnotationToolbar
                        activeTool={activeTool}
                        onToolChange={setActiveTool}
                        color={color}
                        onColorChange={setColor}
                        eraserSize={eraserSize}
                        onEraserSizeChange={setEraserSize}
                        onUndo={() => setTriggerUndo(p => p + 1)}
                        onRedo={() => setTriggerRedo(p => p + 1)}
                        onClear={() => setTriggerClear(p => p + 1)}
                        canUndo={historyState.canUndo}
                        canRedo={historyState.canRedo}
                        onClose={() => setIsAnnotating(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
