"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Music2, Check, ExternalLink, User, Mail, Eye, EyeOff, UserX, AlertTriangle, ArrowLeft, LogOut, Loader2, Apple } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createUser, getChoir, updateChoirMembers, joinChoir } from "@/lib/db";
import { Choir, UserData } from "@/types";
import {
    collection as firestoreCollection,
    addDoc,
    getDoc,
    getDocs,
    doc,
    updateDoc,
    arrayUnion,
    query,
    where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Preloader from "@/components/Preloader";

function SetupPageContent() {
    const router = useRouter();
    const { user, userData, loading: authLoading, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, signInAsGuest, resetPassword, refreshProfile, isGuest, signOut } = useAuth();

    const searchParams = useSearchParams();
    const urlCode = searchParams.get('code');

    // UI State
    const [view, setView] = useState<'welcome' | 'join' | 'create' | 'email_auth' | 'reset_password'>('welcome');
    const [showGuestWarning, setShowGuestWarning] = useState(false);
    // Form State (Moved to top to avoid hook violation)
    const [choirName, setChoirName] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState("");
    const [resetSent, setResetSent] = useState(false);

    // Email Auth State
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [authName, setAuthName] = useState("");

    // (Removed checkingProfile state - now handled by AuthContext undefined state)

    // (Removed checkingProfile effect)
    // Fix: Redirect if user has choir
    useEffect(() => {
        if (!authLoading && userData?.choirId) {
            if (urlCode) {
                router.push(`/?joinCode=${urlCode}`);
            } else {
                router.push("/");
            }
        }
    }, [authLoading, userData, router, urlCode]);

    // Fix: Auto-switch to join view if invite code is present
    useEffect(() => {
        if (urlCode && !userData?.choirId) {
            setInviteCode(urlCode);
            setView('join');
        }
    }, [urlCode, userData]);

    // Fix: Reset view to welcome if user authenticates while in email_auth/reset views
    useEffect(() => {
        if (user && !userData?.choirId && (view === 'email_auth' || view === 'reset_password')) {
            setView('welcome');
        }
    }, [user, userData, view]);

    // Prevent flash of content if user is already in a choir or profile is still loading
    // We remove (user && !userData) because that is the state of a NEW user who needs to see this page.
    // Prevent flash: Wait while auth is loading OR profile is loading (undefined)
    if (authLoading || userData === undefined || (user && userData?.choirId)) {
        return <Preloader />;
    }






    const handleGoogleLogin = async () => {
        setFormLoading(true);
        setError("");
        try {
            await signInWithGoogle();
        } catch (err: any) {
            console.error(err);
            // Don't alert if user canceled, it's annoying
            if (err.message?.includes("canceled") || err.errorMessage?.includes("canceled")) {
                console.warn("Sign-in canceled by user");
            } else {
                alert("Google Login Error: " + (err.message || JSON.stringify(err)));
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleAppleLogin = async () => {
        setFormLoading(true);
        setError("");
        try {
            await signInWithApple();
        } catch (err: any) {
            console.error(err);
            if (err.message?.includes("canceled") || err.errorMessage?.includes("canceled")) {
                console.warn("Sign-in canceled by user");
            } else {
                alert("Apple Login Error: " + (err.message || JSON.stringify(err)));
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        try {
            setShowGuestWarning(false);
            await signInAsGuest();
        } catch (err: any) {
            console.error(err);
            alert("Guest Login Error: " + (err.message || JSON.stringify(err)));
        }
    };

    const handleEmailAuth = async () => {
        if (!email || !password) {
            setError("Заповніть всі поля");
            return;
        }
        if (isRegistering && !authName) {
            setError("Введіть ваше ім'я");
            return;
        }

        setFormLoading(true);
        setError("");

        try {
            if (isRegistering) {
                await signUpWithEmail(email, password, authName);
            } else {
                await signInWithEmail(email, password);
            }
            // View will react to user change
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                setError("Невірний email або пароль");
            } else if (err.code === 'auth/email-already-in-use') {
                setError("Цей email вже використовується");
            } else if (err.code === 'auth/weak-password') {
                setError("Пароль занадто простий (мінімум 6 символів)");
            } else {
                setError("Помилка авторизації: " + err.message);
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!email) {
            setError("Введіть email");
            return;
        }

        setFormLoading(true);
        setError("");

        try {
            await resetPassword(email);
            setResetSent(true);
        } catch (err: any) {
            if (err.code === 'auth/user-not-found') {
                setError("Користувача з таким email не знайдено");
            } else if (err.code === 'auth/invalid-email') {
                setError("Невірний формат email");
            } else {
                setError("Помилка: " + err.message);
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleCreateChoir = async () => {
        if (!user) return;

        if (!choirName.trim()) {
            setError("Введіть назву хору");
            return;
        }

        setFormLoading(true);
        setError("");

        try {
            const memberCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const regentCode = Math.random().toString(36).substring(2, 8).toUpperCase();

            const choirData = {
                name: choirName.trim(),
                memberCode,
                regentCode,
                createdAt: new Date().toISOString(),
                regents: [user.displayName || "Head"],
                members: [{
                    id: user.uid,
                    name: user.displayName || "Користувач",
                    role: 'head'
                }]
            };

            const choirRef = await addDoc(firestoreCollection(db, "choirs"), choirData);

            await createUser(user.uid, {
                id: user.uid,
                name: user.displayName || "Користувач",
                email: user.email || undefined,
                choirId: choirRef.id,
                choirName: choirData.name,
                role: 'head',
                memberships: arrayUnion({
                    choirId: choirRef.id,
                    choirName: choirData.name,
                    role: 'head'
                }) as any
            });

            await refreshProfile();
            router.push("/");
        } catch (err: any) {
            console.error(err);
            alert("Помилка створення: " + (err.message || JSON.stringify(err)));
            setError("Помилка створення. Спробуйте ще раз.");
        } finally {
            setFormLoading(false);
        }
    };

    const handleJoinChoir = async () => {
        if (!user) return;

        if (inviteCode.length !== 6) {
            setError("Код має бути 6 символів");
            return;
        }

        setFormLoading(true);
        setError("");

        try {
            const result = await joinChoir(inviteCode);
            console.log("Joined:", result);

            await refreshProfile();
            router.push("/");
        } catch (err: any) {
            console.error(err);
            // Firebase functions error structure: err.details or err.message
            const msg = err.message || "Помилка приєднання";
            if (msg.includes("Invalid invite code")) {
                setError("Невірний код");
            } else if (msg.includes("Already a member")) {
                alert("Ви вже є учасником цього хору");
                router.push("/");
            } else {
                alert("Помилка приєднання: " + msg);
                setError("Помилка приєднання");
            }
        } finally {
            setFormLoading(false);
        }
    };

    if (!user && view !== 'email_auth' && view !== 'reset_password') {
        return (
            <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-[#18181b] rounded-3xl flex items-center justify-center mb-8 border border-white/10 shadow-2xl">
                    <Music2 className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">MyChoir</h1>
                <p className="text-[#a1a1aa] mb-12">Ваш хоровий асистент</p>

                <div className="w-full max-w-sm space-y-3">
                    <button
                        onClick={handleGoogleLogin}
                        disabled={formLoading}
                        className="w-full py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        {formLoading && view === 'welcome' ? (
                            <Loader2 className="w-5 h-5 animate-spin text-black" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                            </svg>
                        )}
                        {formLoading && view === 'welcome' ? 'Завантаження...' : 'Увійти через Google'}
                    </button>

                    {/* Apple Sign-In — hidden until Apple Developer account is activated
                    <button
                        onClick={handleAppleLogin}
                        disabled={formLoading}
                        className="w-full py-4 bg-black text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-zinc-900 transition-colors disabled:opacity-50 border border-white/10"
                    >
                        {formLoading && view === 'welcome' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Apple className="w-5 h-5" />
                        )}
                        {formLoading && view === 'welcome' ? 'Завантаження...' : 'Увійти через Apple'}
                    </button>
                    */}

                    <button
                        onClick={() => { setView('email_auth'); setIsRegistering(false); setEmail(""); setPassword(""); setAuthName(""); setError(""); }}
                        disabled={formLoading}
                        className="w-full py-4 bg-[#18181b] text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-[#27272a] transition-colors border border-white/10 disabled:opacity-50"
                    >
                        <Mail className="w-5 h-5" />
                        Увійти через пошту
                    </button>

                    {urlCode && (
                        <p className="text-xs text-green-400 mt-2">
                            Посилання на хор знайдено! Увійдіть, щоб продовжити.
                        </p>
                    )}

                    <div className="relative flex items-center gap-4 mt-6">
                        <div className="flex-1 h-px bg-white/10"></div>
                        <span className="text-xs text-white/40">або</span>
                        <div className="flex-1 h-px bg-white/10"></div>
                    </div>

                    <button
                        onClick={() => setShowGuestWarning(true)}
                        disabled={formLoading}
                        className="w-full py-3 text-white/60 text-sm font-medium hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <UserX className="w-4 h-4" />
                        Увійти як гість
                    </button>
                </div>



                <div className="mt-8 flex gap-6 text-xs text-text-secondary">
                    <Link href="/terms" className="hover:text-white transition-colors">Умови використання</Link>
                    <Link href="/privacy" className="hover:text-white transition-colors">Політика конфіденційності</Link>
                </div>

                {/* Guest Warning Modal */}
                {showGuestWarning && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
                        <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                </div>
                                <h3 className="text-white font-bold text-lg">Гостьовий вхід</h3>
                            </div>

                            <div className="space-y-3 text-sm text-white/70 mb-6">
                                <p>⚠️ <strong className="text-white">Дані не зберігаються</strong> між сесіями</p>
                                <p>⚠️ <strong className="text-white">Немає синхронізації</strong> між пристроями</p>
                                <p>⚠️ При виході з акаунту <strong className="text-white">все буде втрачено</strong></p>
                            </div>

                            <p className="text-xs text-white/50 mb-6">
                                Рекомендуємо увійти через Google або email для повного досвіду
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowGuestWarning(false)}
                                    className="flex-1 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-colors"
                                >
                                    Скасувати
                                </button>
                                <button
                                    onClick={handleGuestLogin}
                                    className="flex-1 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Продовжити
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (view === 'email_auth') {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-surface border border-white/5 rounded-3xl p-8">
                    <button onClick={() => setView('welcome')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-6 text-sm font-medium">
                        <ArrowLeft className="w-5 h-5" />
                        Назад
                    </button>
                    <h2 className="text-2xl font-bold text-white mb-2">{isRegistering ? "Реєстрація" : "Вхід"}</h2>
                    <p className="text-text-secondary text-sm mb-6">Введіть дані для входу</p>

                    <div className="space-y-4">
                        {isRegistering && (
                            <input
                                value={authName}
                                onChange={(e) => setAuthName(e.target.value)}
                                className="w-full px-4 py-3 bg-black/20 rounded-xl border border-white/10 text-white focus:outline-none focus:border-white/30"
                                placeholder="Ваше ім'я"
                            />
                        )}
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-black/20 rounded-xl border border-white/10 text-white focus:outline-none focus:border-white/30"
                            placeholder="Email"
                        />
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-black/20 rounded-xl border border-white/10 text-white focus:outline-none focus:border-white/30 pr-12"
                                placeholder="Пароль"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-text-secondary hover:text-white transition-colors"
                            >
                                {showPassword ? (
                                    <EyeOff className="w-5 h-5" />
                                ) : (
                                    <Eye className="w-5 h-5" />
                                )}
                            </button>

                        </div>

                        {error && (
                            <div className="flex justify-end mt-1 mb-2">
                                <button
                                    onClick={() => { setView('reset_password'); setError(''); setResetSent(false); }}
                                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                >
                                    Забули пароль?
                                </button>
                            </div>
                        )}
                        {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">{error}</p>}

                        <button
                            onClick={handleEmailAuth}
                            disabled={formLoading}
                            className="w-full py-4 bg-text-primary text-background rounded-2xl font-bold mt-4 hover:opacity-90 transition-all flex justify-center shadow-lg"
                        >
                            {formLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : (isRegistering ? "Зареєструватися" : "Увійти")}
                        </button>

                        <div className="flex flex-col items-center gap-4 mt-8">
                            <button
                                onClick={() => setIsRegistering(!isRegistering)}
                                className="text-sm font-medium text-white hover:text-gray-300 transition-colors"
                            >
                                {isRegistering ? "Увійти" : "Реєстрація"}
                            </button>

                        </div>
                    </div>
                </div>
            </div >

        );
    }

    if (view === 'reset_password') {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-surface border border-white/5 rounded-3xl p-8">
                    <button onClick={() => setView('email_auth')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-6 text-sm font-medium">
                        <ArrowLeft className="w-5 h-5" />
                        Назад
                    </button>
                    <h2 className="text-2xl font-bold text-white mb-2">Відновлення паролю</h2>
                    <p className="text-text-secondary text-sm mb-6">Введіть email для отримання посилання</p>

                    {resetSent ? (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full mx-auto flex items-center justify-center">
                                <Check className="w-8 h-8 text-green-400" />
                            </div>
                            <p className="text-white font-medium">Лист надіслано!</p>
                            <p className="text-text-secondary text-sm">Перевірте вашу пошту {email} та перейдіть за посиланням для скидання паролю.</p>
                            <button
                                onClick={() => { setView('email_auth'); setResetSent(false); }}
                                className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors"
                            >
                                Повернутися до входу
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-black/20 rounded-xl border border-white/10 text-white focus:outline-none focus:border-white/30"
                                placeholder="Email"
                            />
                            {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">{error}</p>}

                            <button
                                onClick={handlePasswordReset}
                                disabled={formLoading}
                                className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors flex justify-center"
                            >
                                {formLoading ? <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : "Надіслати лист"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Authenticated but no profile configured
    return (
        <div className="min-h-screen bg-background p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex items-center justify-center transition-colors duration-300">
            <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-8 shadow-xl">
                {view === 'welcome' && (
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-surface-highlight rounded-full mx-auto flex items-center justify-center mb-4 text-2xl font-bold text-text-primary shadow-sm border border-border">
                            {user?.displayName ? user.displayName[0] : <User className="w-8 h-8 text-text-secondary" />}
                        </div>
                        <h2 className="text-2xl font-bold text-text-primary">Привіт, {user?.displayName || "Гість"}!</h2>
                        <p className="text-text-secondary">
                            {urlCode ? "Приєднайтеся до хору за запрошенням" : "У вас ще немає хору. Що зробимо?"}
                        </p>

                        <div className="grid gap-3 pt-4">
                            {!urlCode && !isGuest && (
                                <button
                                    onClick={() => { setView('create'); setError(""); }}
                                    className="py-4 bg-primary text-background rounded-xl font-bold hover:opacity-90 transition-all shadow-md"
                                >
                                    Створити новий хор
                                </button>
                            )}
                            <button
                                onClick={() => { setView('join'); setError(""); }}
                                className={`py-4 rounded-xl font-medium transition-colors border ${urlCode
                                    ? 'bg-primary text-background font-bold hover:opacity-90 shadow-md border-transparent'
                                    : 'bg-surface hover:bg-surface-highlight text-text-primary border-border'
                                    }`}
                            >
                                Приєднатися {urlCode ? '' : 'за кодом'}
                            </button>
                        </div>

                        <button
                            onClick={() => signOut()}
                            className="mt-6 text-sm text-text-secondary hover:text-red-400 transition-colors flex items-center gap-2 mx-auto py-2 px-4 rounded-lg hover:bg-white/5"
                        >
                            <LogOut className="w-4 h-4" />
                            Вийти з акаунту
                        </button>
                    </div>
                )}

                {view === 'create' && (
                    <div>
                        <button onClick={() => { setView('welcome'); setError(""); }} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-6 text-sm font-medium">
                            <ArrowLeft className="w-5 h-5" />
                            Назад
                        </button>
                        <h2 className="text-2xl font-bold text-text-primary mb-6">Створення хору</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-2 block">Назва хору</label>
                                <input
                                    value={choirName}
                                    onChange={(e) => setChoirName(e.target.value)}
                                    className="w-full px-4 py-3 bg-surface-highlight rounded-xl border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-secondary/50"
                                    placeholder="Наприклад: Молодіжний Хор"
                                />
                            </div>
                            {error && <p className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
                            <button
                                onClick={handleCreateChoir}
                                disabled={formLoading}
                                className="w-full py-4 bg-primary text-background rounded-xl font-bold mt-4 hover:opacity-90 transition-all flex justify-center shadow-lg disabled:opacity-50"
                            >
                                {formLoading ? <div className="w-5 h-5 border-2 border-background/20 border-t-background rounded-full animate-spin" /> : "Створити"}
                            </button>
                        </div>
                    </div>
                )}

                {view === 'join' && (
                    <div>
                        <button onClick={() => { setView('welcome'); setError(""); }} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-6 text-sm font-medium">
                            <ArrowLeft className="w-5 h-5" />
                            Назад
                        </button>
                        <h2 className="text-2xl font-bold text-text-primary mb-6">Введіть код</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-2 block">Код запрошення</label>
                                <input
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    className="w-full px-4 py-3 bg-surface-highlight rounded-xl border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-center text-xl font-mono tracking-widest uppercase placeholder:text-text-secondary/30"
                                    placeholder="XXXXXX"
                                />
                            </div>
                            {error && <p className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
                            <button
                                onClick={handleJoinChoir}
                                disabled={formLoading}
                                className="w-full py-4 bg-primary text-background rounded-xl font-bold mt-4 hover:opacity-90 transition-all flex justify-center shadow-lg disabled:opacity-50"
                            >
                                {formLoading ? <div className="w-5 h-5 border-2 border-background/20 border-t-background rounded-full animate-spin" /> : "Приєднатися"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SetupPage() {
    return (
        <Suspense fallback={<Preloader />}>
            <SetupPageContent />
        </Suspense>
    );
}
