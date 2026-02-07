"use client";

import { useEffect } from "react";
import { X, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PDFViewer from "./PDFViewer";

interface OfflinePdfModalProps {
    isOpen: boolean;
    onClose: () => void;
    song: {
        id: string;
        title: string;
        pdfUrl?: string;
        parts?: Array<{ name?: string; pdfUrl?: string }>;
    } | null;
}

export default function OfflinePdfModal({ isOpen, onClose, song }: OfflinePdfModalProps) {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    if (!song) return null;

    // Get PDF URL - prefer main pdfUrl, fallback to first part
    const pdfUrl = song.pdfUrl || song.parts?.[0]?.pdfUrl || "";

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) onClose();
                    }}
                >
                    {/* Header */}
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center justify-between px-4 py-3 bg-[#18181b]/95 border-b border-white/10 shrink-0"
                    >
                        <button
                            onClick={onClose}
                            className="flex items-center gap-1 text-white/80 hover:text-white transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-sm">Назад</span>
                        </button>

                        <h2 className="text-white font-semibold text-base truncate max-w-[60%] text-center">
                            {song.title}
                        </h2>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5 text-white/80" />
                        </button>
                    </motion.div>

                    {/* PDF Content */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="flex-1 overflow-hidden"
                    >
                        <div className="h-full w-full">
                            <PDFViewer
                                url={pdfUrl}
                                songId={song.id}
                                title={song.title}
                            />
                        </div>
                    </motion.div>

                    {/* Offline indicator */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full">
                        <span className="text-xs text-blue-400 font-medium">
                            📴 Офлайн режим
                        </span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
