"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth, verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { app } from "@/lib/firebase";
import { Loader2, Check, AlertTriangle, Eye, EyeOff, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Preloader from "@/components/Preloader";

function AuthActionContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');
    const auth = getAuth(app);

    // State
    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!oobCode) {
            setLoading(false);
            return;
        }

        // Verify the reset code
        if (mode === 'resetPassword') {
            verifyPasswordResetCode(auth, oobCode)
                .then((email) => {
                    setEmail(email);
                    setLoading(false);
                })
                .catch((error) => {
                    console.error("Invalid Code:", error);
                    setError("Посилання неактуальне або вже використане.");
                    setLoading(false);
                });
        } else {
            // Handle other modes (verifyEmail, recoverEmail) if needed
            setLoading(false);
        }
    }, [oobCode, mode, auth]);

    const handleResetPassword = async () => {
        if (newPassword.length < 6) {
            setError("Пароль має бути мінімум 6 символів");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Паролі не співпадають");
            return;
        }
        if (!oobCode) return;

        setSubmitting(true);
        setError("");

        try {
            await confirmPasswordReset(auth, oobCode, newPassword);
            setSuccess(true);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Помилка зміни паролю");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <Preloader />;
    }

    if (!oobCode || (mode !== 'resetPassword' && mode !== 'verifyEmail')) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-surface border border-white/10 rounded-3xl p-8">
                    <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Невірне посилання</h2>
                    <p className="text-text-secondary mb-6">Параметри відновлення відсутні.</p>
                    <Link href="/" className="block w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">
                        На головну
                    </Link>
                </div>
            </div>
        );
    }

    if (error && !email && !submitting) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-surface border border-white/10 rounded-3xl p-8">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Помилка</h2>
                    <p className="text-text-secondary mb-6">{error}</p>
                    <Link href="/" className="block w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">
                        Спробувати знову
                    </Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-surface border border-white/10 rounded-3xl p-8">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full mx-auto flex items-center justify-center mb-6">
                        <Check className="w-8 h-8 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Пароль змінено!</h2>
                    <p className="text-text-secondary mb-8">Тепер ви можете увійти з новим паролем.</p>
                    <Link href="/" className="block w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">
                        Увійти
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-surface border border-white/5 rounded-3xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-6 h-6 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Новий пароль</h2>
                    <p className="text-text-secondary text-sm mt-2">для {email}</p>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-4 bg-black/20 rounded-xl border border-white/10 text-white focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                            placeholder="Новий пароль (мін. 6 символів)"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-text-secondary hover:text-white transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>

                    <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-4 bg-black/20 rounded-xl border border-white/10 text-white focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                        placeholder="Підтвердіть пароль"
                    />

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    <button
                        onClick={handleResetPassword}
                        disabled={submitting}
                        className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors flex justify-center mt-6 shadow-lg disabled:opacity-50"
                    >
                        {submitting ? <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : "Зберегти пароль"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AuthActionPage() {
    return (
        <Suspense fallback={<Preloader />}>
            <AuthActionContent />
        </Suspense>
    );
}
