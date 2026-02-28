"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Preloader from "@/components/Preloader";
import { Music2, ArrowRight } from "lucide-react";
import InstallPrompt from "@/components/InstallPrompt";

export default function LandingPage() {
    const { user, userData, loading, signInWithGoogle } = useAuth();
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
            {/* Main Content */}

            {/* Hero Section */}
            <section className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto w-full">
                <div className="w-24 h-24 flex items-center justify-center mb-8 shadow-md rounded-[22px] overflow-hidden">
                    <img src="/apple-touch-icon.png" alt="MyChoir Logo" className="w-full h-full object-cover" />
                </div>

                <h1 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-text-primary">
                    MyChoir
                </h1>

                <p className="text-lg md:text-xl text-text-secondary mb-10 text-balance leading-relaxed">
                    Додаток для організації хорового служіння.<br />Управління репертуаром, розкладом та нотами.
                </p>

                <div className="w-full max-w-sm space-y-3">
                    <button
                        onClick={async () => {
                            try {
                                await signInWithGoogle();
                            } catch (err: any) {
                                if (!err.message?.includes("canceled")) {
                                    alert("Google Login Error: " + (err.message || ""));
                                }
                            }
                        }}
                        className="w-full py-4 bg-surface border border-border text-text-primary font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-surface-highlight transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5 text-text-primary" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                        </svg>
                        Увійти через Google
                    </button>

                    <button
                        onClick={() => router.push("/setup?view=email")}
                        className="w-full py-4 bg-primary text-background font-bold rounded-xl outline-none flex items-center justify-center gap-3 hover:opacity-90 transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Консоль (Email)
                    </button>

                </div>
            </section>

            <InstallPrompt />

            {/* Footer */}
            <footer className="w-full border-t border-border p-6 mt-auto">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-text-secondary">
                    <p>© 2026 MyChoir. Всі права захищені.</p>
                    <div className="flex gap-6">
                        <button onClick={() => router.push("/privacy")} className="hover:text-text-primary transition-colors whitespace-nowrap">
                            Політика конфіденційності
                        </button>
                        <button onClick={() => router.push("/terms")} className="hover:text-text-primary transition-colors whitespace-nowrap">
                            Умови використання
                        </button>
                    </div>
                </div>
            </footer>
        </main>
    );
}
