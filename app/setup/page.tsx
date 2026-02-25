"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Music2, Check, ExternalLink, User, Mail, Eye, EyeOff, UserX, AlertTriangle, ArrowLeft, LogOut, Loader2, Apple } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createUser, getChoir, updateChoirMembers, joinChoir, claimMember, createChoir } from "@/lib/db";
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
    const { user, userData, loading: authLoading, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, resetPassword, refreshProfile, isGuest, signOut } = useAuth();

    const searchParams = useSearchParams();
    const urlCode = searchParams.get('code');

    // UI State
    const [view, setView] = useState<'welcome' | 'join' | 'create' | 'email_auth' | 'reset_password'>('welcome');

    // Form State (Moved to top to avoid hook violation)
    const [choirName, setChoirName] = useState("");
    const [choirType, setChoirType] = useState<'msc' | 'standard' | null>(null);
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

    // Claim Modal State
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [claimMembers, setClaimMembers] = useState<any[]>([]);
    const [claimChoirId, setClaimChoirId] = useState<string | null>(null);
    const [claimLoading, setClaimLoading] = useState(false);
    const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
    const [showNameInput, setShowNameInput] = useState(false);
    const [customName, setCustomName] = useState("");
    const [savingName, setSavingName] = useState(false);

    // (Removed checkingProfile state - now handled by AuthContext undefined state)

    // (Removed checkingProfile effect)
    // Fix: Redirect if user has choir
    useEffect(() => {
        if (!authLoading && userData?.choirId && !showClaimModal) {
            if (urlCode) {
                router.push(`/?joinCode=${urlCode}`);
            } else {
                router.push("/");
            }
        }
    }, [authLoading, userData, router, urlCode, showClaimModal]);

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
        if (!choirType) {
            setError("Оберіть тип хору");
            return;
        }

        setFormLoading(true);
        setError("");

        try {
            await createChoir(choirName, choirType);

            // Refresh profile so userData.choirId is set before redirect
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

            // Removed early refreshProfile() to prevent premature redirect by useEffect

            // Check if there are unlinked members to claim
            const unlinked = result?.unlinkedMembers || [];
            if (unlinked.length > 0 && result?.choirId) {
                setClaimMembers(unlinked);
                setClaimChoirId(result.choirId);
                setShowClaimModal(true);
            } else {
                // Now we verify profile and redirect
                await refreshProfile();
                router.push("/");
            }
        } catch (err: any) {
            console.error(err);
            const msg = err.message || "Помилка приєднання";
            if (msg.includes("Invalid invite code")) {
                setError("Невірний код");
            } else if (msg.includes("Already a member")) {
                alert("Ви вже є учасником цього хору");
                // Check if unlinked members are returned even on error/warning
                if (err.details?.unlinkedMembers) {
                    setClaimMembers(err.details.unlinkedMembers);
                    setClaimChoirId(err.details.choirId);
                    setShowClaimModal(true);
                } else {
                    router.push("/");
                }
            } else {
                alert("Помилка приєднання: " + msg);
                setError("Помилка приєднання");
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleClaimMember = async (targetMemberId: string) => {
        if (!claimChoirId) return;
        setClaimLoading(true);
        try {
            await claimMember(claimChoirId, targetMemberId);
            await refreshProfile();
            router.push("/");
        } catch (e: any) {
            console.error("Claim error:", e);
            alert(e.message || "Помилка прив'язки");
        } finally {
            setClaimLoading(false);
        }
    };

    const handleSaveCustomName = async () => {
        if (!customName.trim() || !user || !claimChoirId) return;
        const finalName = customName.trim();

        if (!finalName.includes(" ")) {
            alert("Будь ласка, введіть 'Прізвище та Ім'я' через пробіл.");
            return;
        }

        setSavingName(true);
        try {
            // 1. Update User Profile
            await createUser(user.uid, { name: finalName });

            // 2. Update Choir Member
            // We need to fetch current members first
            const choirDocRef = doc(db, "choirs", claimChoirId);
            const choirSnap = await getDoc(choirDocRef);
            if (choirSnap.exists()) {
                const cData = choirSnap.data() as Choir;
                const updatedMembers = (cData.members || []).map(m =>
                    m.id === user.uid ? { ...m, name: finalName } : m
                );
                await updateDoc(choirDocRef, { members: updatedMembers });
            }

            await refreshProfile();
            router.push("/");
        } catch (e: any) {
            console.error("Save Name Error:", e);
            alert("Помилка збереження імені");
        } finally {
            setSavingName(false);
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

                </div>

                <div className="mt-8 flex gap-6 text-xs text-text-secondary">
                    <Link href="/terms" className="hover:text-white transition-colors">Умови використання</Link>
                    <Link href="/privacy" className="hover:text-white transition-colors">Політика конфіденційності</Link>
                </div>
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
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-2 block">Тип хору</label>
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => setChoirType('msc')}
                                        className={`w-full p-4 rounded-xl text-left transition-all border ${choirType === 'msc'
                                            ? 'bg-primary/10 border-primary'
                                            : 'bg-surface-highlight border-border hover:border-text-secondary/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${choirType === 'msc' ? 'border-primary' : 'border-text-secondary/40'}`}>
                                                {choirType === 'msc' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-text-primary text-[15px]">Хор МСЦ ЄХБ</p>
                                                <p className="text-xs text-text-secondary mt-0.5">Має доступ до Архіву МХО</p>
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChoirType('standard')}
                                        className={`w-full p-4 rounded-xl text-left transition-all border ${choirType === 'standard'
                                            ? 'bg-primary/10 border-primary'
                                            : 'bg-surface-highlight border-border hover:border-text-secondary/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${choirType === 'standard' ? 'border-primary' : 'border-text-secondary/40'}`}>
                                                {choirType === 'standard' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-text-primary text-[15px]">Звичайний хор</p>
                                                <p className="text-xs text-text-secondary mt-0.5">Тільки власний репертуар</p>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            {error && <p className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
                            <button
                                onClick={handleCreateChoir}
                                disabled={formLoading || !choirName.trim() || !choirType}
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
                {/* Claim Member Modal */}
                {showClaimModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#18181b] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-xl font-bold text-white mb-2">Це ви?</h3>
                            <p className="text-sm text-text-secondary mb-2">
                                {(() => {
                                    const matchedMember = claimMembers.find((m: any) =>
                                        user?.displayName && m.name.toLowerCase().trim() === user.displayName.toLowerCase().trim()
                                    );
                                    if (matchedMember && !selectedClaimId) {
                                        // Auto-select the matched member
                                        setTimeout(() => setSelectedClaimId(matchedMember.id), 0);
                                    }
                                    return matchedMember
                                        ? <>Ми знайшли вас у списку: <b className="text-white">{matchedMember.name}</b></>
                                        : 'Оберіть себе зі списку учасників хору.';
                                })()}
                            </p>
                            <p className="text-xs text-text-secondary/60 mb-4">
                                Це дозволить зберегти вашу історію відвідувань та партію.
                            </p>

                            <div className="space-y-2 max-h-60 overflow-y-auto mb-6 pr-2 custom-scrollbar">
                                {claimMembers.map(member => (
                                    <button
                                        key={member.id}
                                        onClick={() => setSelectedClaimId(member.id)}
                                        disabled={claimLoading}
                                        className={`w-full p-4 rounded-xl flex items-center justify-between group transition-all border ${selectedClaimId === member.id
                                            ? 'bg-primary/20 border-primary'
                                            : 'bg-white/5 hover:bg-white/10 border-transparent hover:border-white/10'
                                            }`}
                                    >
                                        <div className="text-left">
                                            <div className="font-bold text-white">{member.name}</div>
                                            <div className="text-xs text-white/50">{member.voice || "Без партії"}</div>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${selectedClaimId === member.id ? 'bg-primary text-background' : 'bg-white/10'
                                            }`}>
                                            {selectedClaimId === member.id && <Check className="w-4 h-4" />}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => selectedClaimId && handleClaimMember(selectedClaimId)}
                                    disabled={claimLoading || !selectedClaimId}
                                    className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-all flex justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {claimLoading ? (
                                        <div className="w-5 h-5 border-2 border-background/20 border-t-background rounded-full animate-spin" />
                                    ) : (
                                        "Так, це я"
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowClaimModal(false);
                                        setShowNameInput(true);
                                    }}
                                    disabled={claimLoading}
                                    className="w-full py-3 text-sm text-text-secondary hover:text-white transition-colors"
                                >
                                    Я — новий учасник
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Name Input Modal */}
                {showNameInput && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#18181b] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-xl font-bold text-white mb-2">Вкажіть ваше ім'я</h3>
                            <p className="text-sm text-text-secondary mb-6">
                                Для зручності, будь ласка, вкажіть спочатку прізвище.
                            </p>

                            <div className="space-y-4">
                                <input
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    placeholder="Прізвище Ім'я (наприклад: Шевченко Тарас)"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
                                    autoFocus
                                />

                                <button
                                    onClick={handleSaveCustomName}
                                    disabled={savingName || !customName.trim()}
                                    className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-all flex justify-center shadow-lg disabled:opacity-50"
                                >
                                    {savingName ? (
                                        <div className="w-5 h-5 border-2 border-background/20 border-t-background rounded-full animate-spin" />
                                    ) : (
                                        "Зберегти і увійти"
                                    )}
                                </button>
                            </div>
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
