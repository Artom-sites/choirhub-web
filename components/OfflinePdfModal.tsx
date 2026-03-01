"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
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
    const [activePartIndex, setActivePartIndex] = useState(0);

    // Reset active part when song changes
    useEffect(() => {
        setActivePartIndex(0);
    }, [song?.id]);

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

    // Build parts list
    const parts = (song.parts && song.parts.length > 0)
        ? song.parts
        : [{ name: "Головна", pdfUrl: song.pdfUrl || "" }];

    const hasTabs = parts.length > 1;
    const currentPdfUrl = parts[activePartIndex]?.pdfUrl || "";

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
                        className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 bg-[#18181b]/95 border-b border-white/10 shrink-0"
                    >
                        <button
                            onClick={onClose}
                            className="flex items-center gap-1 text-white/80 hover:text-white transition-colors min-w-[60px]"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-sm">Назад</span>
                        </button>

                        <h2 className="text-white font-semibold text-base truncate max-w-[60%] text-center">
                            {song.title}
                        </h2>

                        <div className="min-w-[60px]" />
                    </motion.div>

                    {/* Part Tabs */}
                    {hasTabs && (
                        <div className="bg-[#18181b]/95 border-b border-white/10 shrink-0">
                            <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
                                {parts.map((part, index) => {
                                    const name = part.name?.replace(/\.pdf$/i, "") || `Part ${index + 1}`;
                                    const isActive = index === activePartIndex;
                                    return (
                                        <button
                                            key={index}
                                            onClick={() => setActivePartIndex(index)}
                                            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${isActive
                                                    ? "bg-white text-black"
                                                    : "bg-white/10 text-white/60 hover:bg-white/15"
                                                }`}
                                        >
                                            {name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* PDF Content */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="flex-1 overflow-hidden"
                    >
                        <div className="h-full w-full">
                            <PDFViewer
                                url={currentPdfUrl}
                                songId={song.id}
                                title={song.title}
                                key={`${song.id}-${activePartIndex}`}
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
