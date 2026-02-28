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
            <section className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto w-full relative z-10">
                {/* Decorative background blur */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/20 blur-[100px] rounded-full -z-10 opacity-50 pointer-events-none"></div>

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20">
                    <Music2 className="w-4 h-4" />
                    <span>Для хористів та регентів</span>
                </div>

                <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 tracking-tight text-balance leading-tight">
                    Хорове служіння <br className="hidden sm:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">
                        на новому рівні
                    </span>
                </h1>

                <p className="text-lg md:text-xl text-text-secondary mb-12 max-w-2xl text-balance leading-relaxed">
                    MyChoir — це сучасна платформа для управління репертуаром, розкладом служінь, відвідуваністю та швидким доступом до нот.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center items-center mb-16">
                    <button
                        onClick={() => router.push("/setup")}
                        className="bg-primary text-background px-8 py-4 rounded-2xl font-bold text-lg hover:bg-primary/90 transition-all shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 w-full sm:w-auto flex items-center justify-center gap-2"
                    >
                        Почати користування
                        <ArrowRight className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => router.push("/setup")}
                        className="bg-surface text-text-primary border border-border px-8 py-4 rounded-2xl font-bold text-lg hover:bg-surface-highlight transition-all w-full sm:w-auto"
                    >
                        Увійти
                    </button>
                </div>

                {/* Feature Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left">
                    {[
                        { title: "Репертуар", desc: "Усі пісні, ноти та партитури в одному зручному місці." },
                        { title: "Відвідуваність", desc: "Швидка статистика та відмітки присутності на репетиціях." },
                        { title: "Служіння", desc: "Розклад та списки пісень на найближчі служіння." }
                    ].map((feature, i) => (
                        <div key={i} className="p-6 rounded-2xl bg-surface border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="font-bold text-lg mb-2 text-text-primary">{feature.title}</h3>
                            <p className="text-text-secondary text-sm">{feature.desc}</p>
                        </div>
                    ))}
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
