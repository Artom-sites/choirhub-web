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
            {/* Header / Top Nav */}
            <header className="flex items-center justify-between p-6 w-full max-w-5xl mx-auto">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
                        <img src="/apple-touch-icon.png" alt="MyChoir Logo" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">MyChoir</span>
                </div>
            </header>

            {/* Hero Section */}
            <section className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto w-full -mt-20">
                <div className="w-24 h-24 flex items-center justify-center mb-8 shadow-md rounded-[22px] overflow-hidden">
                    <img src="/apple-touch-icon.png" alt="MyChoir Logo" className="w-full h-full object-cover" />
                </div>

                <h1 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-text-primary">
                    MyChoir
                </h1>

                <p className="text-lg md:text-xl text-text-secondary mb-10 text-balance leading-relaxed">
                    Додаток для організації хорового служіння.<br />Управління репертуаром, розкладом та нотами.
                </p>

                <button
                    onClick={() => router.push("/setup")}
                    className="bg-primary text-background px-10 py-4 rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors w-full sm:w-auto"
                >
                    Увійти в систему
                </button>
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
