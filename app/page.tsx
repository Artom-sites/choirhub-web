"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Preloader from "@/components/Preloader";
import { Music2, ArrowRight } from "lucide-react";
import InstallPrompt from "@/components/InstallPrompt";

export default function LandingPage() {
    const { user, userData, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (user && userData?.choirId) {
                // If logged in, go straight to the app
                router.replace("/app");
            }
        }
    }, [user, userData, loading, router]);

    if (loading) {
        return <Preloader />;
    }

    return (
        <main className="min-h-[100dvh] bg-background text-text-primary flex flex-col font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            {/* Header */}
            <header className="flex items-center justify-between p-6 w-full max-w-5xl mx-auto">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
                        <img src="/apple-touch-icon.png" alt="MyChoir Logo" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">MyChoir</span>
                </div>
                <button
                    onClick={() => router.push("/setup")}
                    className="flex items-center gap-2 bg-primary text-background px-4 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors"
                >
                    Увійти
                    <ArrowRight className="w-4 h-4" />
                </button>
            </header>

            {/* Hero Section */}
            <section className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto w-full">
                <div className="w-24 h-24 flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-primary/20 rounded-3xl overflow-hidden">
                    <img src="/apple-touch-icon.png" alt="MyChoir Logo" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-balance">
                    Додаток для організації хорового служіння
                </h1>
                <p className="text-lg md:text-xl text-text-secondary mb-10 max-w-2xl text-balance">
                    MyChoir — це платформа для управління репертуаром, розкладом служінь, відвідуваністю та нотами вашого хору.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                    <button
                        onClick={() => router.push("/setup")}
                        className="bg-primary text-background px-8 py-4 rounded-2xl font-bold text-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
                    >
                        Почати користування
                    </button>
                </div>
            </section>

            <InstallPrompt />

            {/* Footer */}
            <footer className="w-full border-t border-border p-6 mt-auto">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-text-secondary">
                    <p>© 2026 MyChoir. Всі права захищені.</p>
                    <div className="flex gap-6">
                        <button onClick={() => router.push("/privacy")} className="hover:text-text-primary transition-colors">
                            Політика конфіденційності
                        </button>
                        <button onClick={() => router.push("/terms")} className="hover:text-text-primary transition-colors">
                            Умови використання
                        </button>
                    </div>
                </div>
            </footer>
        </main>
    );
}
