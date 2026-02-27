"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BackButton() {
    const router = useRouter();

    return (
        <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
        >
            <ArrowLeft className="w-5 h-5" />
            <span>Назад</span>
        </button>
    );
}
