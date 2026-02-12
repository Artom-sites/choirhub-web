"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import PrivacyText from "@/components/legal/PrivacyText";

export default function PrivacyPage() {
    const router = useRouter();

    const handleBack = () => {
        router.push('/?view=account');
    };

    return (
        <div className="min-h-screen bg-background text-text-secondary px-6 pb-6 md:px-12 md:pb-12 font-sans pt-[env(safe-area-inset-top)]">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="border-b border-border pb-6 pt-6">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Назад</span>
                    </button>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">Політика конфіденційності</h1>
                </header>

                <div className="prose prose-invert max-w-none">
                    <PrivacyText />
                </div>
            </div>
        </div>
    );
}
