"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, Check, Loader2, AlertCircle } from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

interface FileUploadProps {
    choirId: string;
    songId: string;
    onUploadComplete?: (url: string) => void;
    onError?: (error: string) => void;
    maxSizeMB?: number;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

export default function FileUpload({
    choirId,
    songId,
    onUploadComplete,
    onError,
    maxSizeMB = 10,
}: FileUploadProps) {
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [progress, setProgress] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [fileName, setFileName] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFile = (file: File): string | null => {
        // Check file type
        if (file.type !== "application/pdf") {
            return "Тільки PDF файли дозволені";
        }
        // Check file size
        const maxBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxBytes) {
            return `Файл занадто великий. Максимум ${maxSizeMB} MB`;
        }
        return null;
    };

    const uploadFile = async (file: File) => {
        const validationError = validateFile(file);
        if (validationError) {
            setStatus("error");
            setErrorMessage(validationError);
            onError?.(validationError);
            return;
        }

        setFileName(file.name);
        setStatus("uploading");
        setProgress(0);

        try {
            const storageRef = ref(storage, `choirs/${choirId}/songs/${songId}/sheet.pdf`);
            const uploadTask = uploadBytesResumable(storageRef, file, {
                contentType: "application/pdf",
            });

            uploadTask.on(
                "state_changed",
                (snapshot) => {
                    const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(Math.round(prog));
                },
                (error) => {
                    console.error("Upload error:", error);
                    setStatus("error");
                    setErrorMessage("Помилка завантаження. Спробуйте ще раз.");
                    onError?.("Upload failed");
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setStatus("success");
                    onUploadComplete?.(downloadURL);
                }
            );
        } catch (error) {
            console.error("Upload error:", error);
            setStatus("error");
            setErrorMessage("Помилка завантаження");
            onError?.("Upload failed");
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files[0]);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            uploadFile(files[0]);
        }
    };

    const handleClick = () => {
        if (status === "idle" || status === "error") {
            fileInputRef.current?.click();
        }
    };

    const reset = () => {
        setStatus("idle");
        setProgress(0);
        setErrorMessage("");
        setFileName("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className="w-full">
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
            />

            <div
                onClick={handleClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
                        ? "border-blue-500 bg-blue-50"
                        : status === "error"
                            ? "border-red-300 bg-red-50"
                            : status === "success"
                                ? "border-green-300 bg-green-50"
                                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
                    }
        `}
            >
                {/* Idle State */}
                {status === "idle" && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <Upload className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-700">
                                Перетягніть PDF файл сюди
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                або натисніть для вибору
                            </p>
                        </div>
                        <p className="text-xs text-gray-400">
                            Максимальний розмір: {maxSizeMB} MB
                        </p>
                    </div>
                )}

                {/* Uploading State */}
                {status === "uploading" && (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        <div>
                            <p className="font-medium text-gray-700">{fileName}</p>
                            <p className="text-sm text-gray-500">Завантаження... {progress}%</p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Success State */}
                {status === "success" && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <Check className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="font-medium text-green-700">Успішно завантажено!</p>
                            <p className="text-sm text-gray-500">{fileName}</p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                reset();
                            }}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Завантажити інший файл
                        </button>
                    </div>
                )}

                {/* Error State */}
                {status === "error" && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="font-medium text-red-700">Помилка</p>
                            <p className="text-sm text-red-500">{errorMessage}</p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                reset();
                            }}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Спробувати знову
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
