"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import PDFViewer from "@/components/PDFViewer";
import { ArrowLeft, FileText, Upload, Loader2, Check, AlertCircle } from "lucide-react";

// Simple song type for local storage
interface SimpleSong {
    id: string;
    title: string;
    category: string;
    pdfUrl?: string;
}

const SONGS_STORAGE_KEY = "choirhub_songs";
const PDF_STORAGE_KEY = "choirhub_pdfs";

function loadSongsFromStorage(): SimpleSong[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(SONGS_STORAGE_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            return [];
        }
    }
    // Return default songs
    return [
        { id: "1", title: "В цей день славний співаю", category: "Інші" },
        { id: "2", title: "Тиха ніч", category: "Різдво" },
        { id: "3", title: "Христос Воскрес!", category: "Пасха" },
        { id: "4", title: "О, благодать", category: "Інші" },
        { id: "5", title: "Радість нам ся з'явила", category: "Різдво" },
    ];
}

function saveSongsToStorage(songs: SimpleSong[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(songs));
}

// Store PDF as base64 in localStorage
function storePdfLocally(songId: string, file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            try {
                const pdfs = JSON.parse(localStorage.getItem(PDF_STORAGE_KEY) || "{}");
                pdfs[songId] = base64;
                localStorage.setItem(PDF_STORAGE_KEY, JSON.stringify(pdfs));
                resolve(base64);
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getPdfFromStorage(songId: string): string | null {
    if (typeof window === "undefined") return null;
    try {
        const pdfs = JSON.parse(localStorage.getItem(PDF_STORAGE_KEY) || "{}");
        return pdfs[songId] || null;
    } catch {
        return null;
    }
}

export default function SongPage() {
    const params = useParams();
    const router = useRouter();
    const songId = params.id as string;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [song, setSong] = useState<SimpleSong | null>(null);
    const [pdfData, setPdfData] = useState<string | null>(null);
    const [showViewer, setShowViewer] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        const songs = loadSongsFromStorage();
        const foundSong = songs.find(s => s.id === songId);
        if (foundSong) {
            setSong(foundSong);
            // Check for stored PDF
            const storedPdf = getPdfFromStorage(songId);
            if (storedPdf) {
                setPdfData(storedPdf);
            }
        }
    }, [songId]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        if (file.type !== "application/pdf") {
            setUploadStatus('error');
            setErrorMessage("Тільки PDF файли дозволені");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setUploadStatus('error');
            setErrorMessage("Файл занадто великий (макс. 10 MB)");
            return;
        }

        setUploading(true);
        setUploadStatus('idle');

        try {
            const base64 = await storePdfLocally(songId, file);
            setPdfData(base64);

            // Update song record
            const songs = loadSongsFromStorage();
            const updatedSongs = songs.map(s =>
                s.id === songId ? { ...s, pdfUrl: `local:${songId}` } : s
            );
            saveSongsToStorage(updatedSongs);
            setSong(prev => prev ? { ...prev, pdfUrl: `local:${songId}` } : null);

            setUploadStatus('success');
        } catch (err) {
            console.error("Upload error:", err);
            setUploadStatus('error');
            setErrorMessage("Помилка збереження файлу");
        } finally {
            setUploading(false);
        }
    };

    if (!song) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">Пісню не знайдено</p>
            </div>
        );
    }

    // Show PDF Viewer
    if (showViewer && pdfData) {
        return (
            <div className="h-screen">
                <PDFViewer
                    url={pdfData}
                    title={song.title}
                    onClose={() => setShowViewer(false)}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="font-semibold text-gray-900">{song.title}</h1>
                    <p className="text-sm text-gray-500">{song.category}</p>
                </div>
            </header>

            {/* Content */}
            <div className="p-4">
                <div className="max-w-md mx-auto">
                    {pdfData ? (
                        // PDF exists
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-lg font-medium text-gray-700 mb-2">
                                PDF завантажено
                            </h2>
                            <p className="text-gray-500 text-sm mb-6">
                                Ноти готові до перегляду
                            </p>

                            <button
                                onClick={() => setShowViewer(true)}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors mb-3"
                            >
                                Переглянути PDF
                            </button>

                            <div className="mt-6 pt-6 border-t">
                                <p className="text-sm text-gray-500 mb-3">Замінити файл:</p>
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
                                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-gray-400 transition-colors"
                                >
                                    {uploading ? "Завантаження..." : "Обрати інший файл"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        // No PDF
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-8 h-8 text-gray-400" />
                            </div>
                            <h2 className="text-lg font-medium text-gray-700 mb-2">
                                Немає PDF файлу
                            </h2>
                            <p className="text-gray-500 text-sm mb-6">
                                Для цієї пісні ще не завантажено ноти
                            </p>

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
                                className="w-full py-4 border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl text-blue-600 font-medium hover:bg-blue-100 hover:border-blue-400 transition-colors flex items-center justify-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Завантаження...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5" />
                                        Завантажити PDF
                                    </>
                                )}
                            </button>

                            <p className="text-xs text-gray-400 mt-2">
                                Максимальний розмір: 10 MB
                            </p>

                            {uploadStatus === 'success' && (
                                <div className="mt-4 p-3 bg-green-50 rounded-lg flex items-center gap-2 text-green-700">
                                    <Check className="w-5 h-5" />
                                    Файл успішно завантажено
                                </div>
                            )}

                            {uploadStatus === 'error' && (
                                <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-red-700">
                                    <AlertCircle className="w-5 h-5" />
                                    {errorMessage}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
