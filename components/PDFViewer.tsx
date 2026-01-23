"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
    ChevronLeft,
    ChevronRight,
    X,
    Loader2,
    ZoomIn,
    ZoomOut
} from "lucide-react";

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
}

export default function PDFViewer({ url, title, onClose }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [workerReady, setWorkerReady] = useState(false);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const setupWorker = async () => {
            const pdfjs = await import("react-pdf");
            pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.pdfjs.version}/build/pdf.worker.min.mjs`;
            setWorkerReady(true);
        };
        setupWorker();
    }, []);

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                // Subtle margin to prevent edge clipping (critical for mobile)
                setContainerWidth(containerRef.current.offsetWidth - 20);
            }
        };
        // Initial delay to let layout settle
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
        setError("Не вдалося завантажити PDF файл");
        setIsLoading(false);
    }, []);

    const goToPrevPage = () => setPageNumber((p) => Math.max(1, p - 1));
    const goToNextPage = () => setPageNumber((p) => Math.min(numPages, p + 1));

    const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

    if (!workerReady) {
        return (
            <div className="flex flex-col h-full bg-background items-center justify-center">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#09090b] relative z-50">
            {/* Header - Floating overlay style */}
            <header className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <button
                    onClick={onClose}
                    className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors pointer-events-auto border border-white/10"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Zoom Controls */}
                <div className="flex items-center gap-2 pointer-events-auto">
                    <button
                        onClick={handleZoomOut}
                        className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors border border-white/10"
                    >
                        <ZoomOut className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleZoomIn}
                        className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors border border-white/10"
                    >
                        <ZoomIn className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* PDF Content */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto flex justify-center items-center bg-[#09090b]"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {isLoading && (
                    <div className="flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    </div>
                )}

                {error && (
                    <div className="text-center p-4">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white text-black rounded-xl">
                            Спробувати знову
                        </button>
                    </div>
                )}

                <div className={isLoading ? "hidden" : "p-4 min-h-full flex items-center"}>
                    <Document
                        file={url}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={null}
                        className="shadow-2xl"
                    >
                        <Page
                            pageNumber={pageNumber}
                            width={containerWidth ? (Math.min(containerWidth, 800) * scale) : undefined}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            className="bg-white shadow-lg overflow-hidden"
                            loading={null}
                        />
                    </Document>
                </div>
            </div>

            {/* Bottom Controls */}
            <footer className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
                {numPages > 1 && (
                    <div className="bg-black/60 backdrop-blur-lg border border-white/10 rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl pointer-events-auto">
                        <button
                            onClick={goToPrevPage}
                            disabled={pageNumber <= 1}
                            className="p-1 rounded-full hover:bg-white/10 disabled:opacity-30 transition-colors text-white"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>

                        <span className="text-white font-bold font-mono">
                            {pageNumber} / {numPages}
                        </span>

                        <button
                            onClick={goToNextPage}
                            disabled={pageNumber >= numPages}
                            className="p-1 rounded-full hover:bg-white/10 disabled:opacity-30 transition-colors text-white"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </div>
                )}
            </footer>
        </div>
    );
}
