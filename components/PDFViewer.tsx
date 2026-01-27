"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
    X,
    Loader2,
    ZoomIn,
    ZoomOut,
    Download
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
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [workerReady, setWorkerReady] = useState(false);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

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
        setError("Не вдалося завантажити PDF файл");
        setIsLoading(false);
    }, []);

    const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

    const handleDownload = async () => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = title ? `${title}.pdf` : 'song.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Download failed:', error);
            // Fallback: open in new tab
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
        <div className="flex flex-col h-full bg-[#09090b] relative z-50">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <button
                    onClick={onClose}
                    className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors pointer-events-auto border border-white/10"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Download Button */}
                <button
                    onClick={handleDownload}
                    className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors pointer-events-auto border border-white/10"
                    title="Завантажити PDF"
                >
                    <Download className="w-6 h-6" />
                </button>
            </header>

            {/* Content (Scrollable) */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto bg-[#09090b] custom-scrollbar"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                <div className="min-h-full flex flex-col items-center pt-14 pb-20 px-0">
                    {isLoading && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-20 px-4">
                            <p className="text-red-400 mb-4">{error}</p>
                            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white text-black rounded-xl">
                                Спробувати знову
                            </button>
                        </div>
                    )}

                    <Document
                        file={url}
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
                </div>
            </div>
        </div>
    );
}
