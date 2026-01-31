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
    Check
} from "lucide-react";
import { getPdfFromCache, savePdfToCache } from "../lib/cache";

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(
    () => import("react-pdf").then((mod) => mod.Document),
    { ssr: false }
);
const Page = dynamic(
    () => import("react-pdf").then((mod) => mod.Page),
    { ssr: false }
);

interface PDFViewerProps {
    url: string;
    title?: string;
    onClose?: () => void;
    onAddAction?: () => void;  // Optional: replaces Download button with Add button
}

export default function PDFViewer({ url, title, onClose, onAddAction }: PDFViewerProps) {
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

    // Cache / Load Logic
    useEffect(() => {
        let active = true;

        const loadPdf = async () => {
            if (!url) return;
            setIsLoading(true);

            try {
                // 1. Try Cache
                const cachedBlob = await getPdfFromCache(url);

                if (cachedBlob) {
                    if (active) {
                        const objectUrl = URL.createObjectURL(cachedBlob);
                        setPdfSource(objectUrl);
                        setIsCached(true);
                        setShowIndicator(true);
                        console.log("Loaded from offline cache");
                    }
                } else {
                    // 2. Live & Cache
                    if (active) setPdfSource(url); // Use URL immediately

                    // Background fetch to cache
                    fetch(url)
                        .then(res => {
                            if (!res.ok) throw new Error("Fetch failed");
                            return res.blob();
                        })
                        .then(blob => {
                            savePdfToCache(url, blob);
                            if (active) {
                                setIsCached(true);
                                setShowIndicator(true);
                            }
                        })
                        .catch(err => console.error("Background cache failed:", err));
                }
            } catch (err) {
                console.error("PDF Load Error:", err);
                if (active) setError("Помилка завантаження");
            }
        };

        loadPdf();

        return () => {
            active = false;
        };
    }, [url]);

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
            <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 pointer-events-none ${showIndicator ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <div className="bg-green-500/90 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 backdrop-blur-md">
                    <Check className="w-3 h-3" />
                    Збережено офлайн
                </div>
            </div>

            {/* Content (Scrollable) */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto bg-white scrollbar-hide"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                <div className="min-h-full flex flex-col items-center py-2 px-0">
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
                            {Array.from(new Array(numPages), (el, index) => (
                                <div key={`page_${index + 1}`} className="shadow-2xl w-full">
                                    <Page
                                        pageNumber={index + 1}
                                        width={containerWidth ? containerWidth : undefined}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        className="bg-white overflow-hidden w-full"
                                        loading={
                                            <div className="w-full aspect-[1/1.4] bg-white/5 animate-pulse" />
                                        }
                                    />
                                    {/* Page separator/number overlay could be here if needed */}
                                </div>
                            ))}
                        </Document>
                    )}
                </div>
            </div>
        </div>
    );
}
