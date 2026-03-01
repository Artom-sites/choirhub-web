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
    const authMode = searchParams.get('auth');

    // UI State
    const [view, setView] = useState<'welcome' | 'join' | 'create' | 'email_auth' | 'reset_password'>(
        authMode === 'email' ? 'email_auth' : 'welcome'
    );

    // Form State (Moved to top to avoid hook violation)
    const [choirName, setChoirName] = useState("");
    const [choirType, setChoirType] = useState<'msc' | 'standard' | null>(null);
    const [inviteCode, setInviteCode] = useState("");
    const [joinLastName, setJoinLastName] = useState("");
    const [joinFirstName, setJoinFirstName] = useState("");
    const [formLoading, setFormLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [appleLoading, setAppleLoading] = useState(false);
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
                router.push(`/app?joinCode=${urlCode}`);
            } else {
                router.push("/app");
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
        setGoogleLoading(true);
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
            setGoogleLoading(false);
            setFormLoading(false);
        }
    };

    const handleAppleLogin = async () => {
        setAppleLoading(true);
        setFormLoading(true);
        setError("");
        try {
            await signInWithApple();
        } catch (err: any) {
            console.error(err);
            // 1001 is the specific error code for user cancellation on iOS Apple Sign In
            const isCanceled =
                err.message?.includes("canceled") ||
                err.errorMessage?.includes("canceled") ||
                err.message?.includes("error 1001") ||
                (err.code === "1001");

            if (isCanceled) {
                console.warn("Sign-in canceled by user");
            } else {
                alert("Apple Login Error: " + (err.message || JSON.stringify(err)));
            }
        } finally {
            setAppleLoading(false);
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

            router.push("/app");
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
        if (!joinLastName.trim() || !joinFirstName.trim()) {
            setError("Введіть прізвище та ім'я");
            return;
        }

        setFormLoading(true);
        setError("");

        // Save name to user profile BEFORE joining
        const fullName = `${joinLastName.trim()} ${joinFirstName.trim()}`;
        try {
            await createUser(user.uid, { name: fullName });
        } catch (e) {
            console.warn("Failed to save name before join:", e);
        }

        try {
            const result = await joinChoir(inviteCode);
            console.log("Joined:", result);

            const unlinked = result?.unlinkedMembers || [];

            // Auto-matching logic
            if (unlinked.length > 0 && result?.choirId) {
                // Normalize names for comparison (lowercase, single spaces only)
                const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
                const enteredNameNorm = normalize(`${joinLastName} ${joinFirstName}`);
                const enteredNameReversed = normalize(`${joinFirstName} ${joinLastName}`);

                // Find a member whose name closely matches the entered one
                const matchedMember = unlinked.find((m: any) => {
                    if (!m.name) return false;
                    const mName = normalize(m.name);
                    return mName === enteredNameNorm || mName === enteredNameReversed;
                });

                if (matchedMember) {
                    // Strong match found! Show modal but ONLY with this single member.
                    setClaimMembers([matchedMember]);
                    setClaimChoirId(result.choirId);
                    setSelectedClaimId(matchedMember.id);
                    setShowClaimModal(true);
                } else {
                    // No match -> they are a brand new member, skip claim modal.
                    await refreshProfile();
                    router.push("/app");
                }
            } else {
                await refreshProfile();
                router.push("/app");
            }
        } catch (err: any) {
            console.error(err);
            const msg = err.message || "Помилка приєднання";
            if (msg.includes("Invalid invite code")) {
                setError("Невірний код");
            } else if (msg.includes("Already a member")) {
                alert("Ви вже є учасником цього хору");
                if (err.details?.unlinkedMembers) {
                    setClaimMembers(err.details.unlinkedMembers);
                    setClaimChoirId(err.details.choirId);
                    setShowClaimModal(true);
                } else {
                    router.push("/app");
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
            router.push("/app");
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
            router.push("/app");
        } catch (e: any) {
            console.error("Save Name Error:", e);
            alert("Помилка збереження імені");
        } finally {
            setSavingName(false);
        }
    };

    if (!user && view !== 'email_auth' && view !== 'reset_password') {
        return (
            <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
                <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
                    <div className="w-20 h-20 rounded-[18px] overflow-hidden mb-5 shadow-lg">
                        <img src="/apple-touch-icon.png" alt="MyChoir" className="w-full h-full object-cover" />
                    </div>
                    <h1 className="text-3xl font-bold text-text-primary mb-1">MyChoir</h1>
                    <p className="text-text-secondary text-sm mb-8">Ваш хоровий асистент</p>

                    <div className="w-full space-y-3">
                        {/* Email/Password Fields */}
                        {isRegistering && (
                            <input
                                value={authName}
                                onChange={(e) => setAuthName(e.target.value)}
                                className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                placeholder="Ваше ім'я"
                                autoCapitalize="words"
                            />
                        )}
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                            placeholder="Email"
                            autoCapitalize="off"
                            autoCorrect="off"
                        />
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleEmailAuth(); }}
                                className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all pr-12"
                                placeholder="Пароль"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-text-secondary hover:text-text-primary transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        {error && (
                            <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg text-left">{error}</p>
                        )}

                        {!isRegistering && (
                            <div className="flex justify-end">
                                <button
                                    onClick={() => { setView('reset_password'); setError(''); setResetSent(false); }}
                                    className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    Забули пароль?
                                </button>
                            </div>
                        )}

                        <button
                            onClick={handleEmailAuth}
                            disabled={formLoading || !email || !password}
                            className="w-full py-4 bg-text-primary text-background font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-40"
                        >
                            {formLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? "Зареєструватися" : "Увійти")}
                        </button>

                        {/* Divider */}
                        <div className="flex items-center gap-3 py-1">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-xs text-text-secondary">або</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        {/* Social Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handleGoogleLogin}
                                disabled={formLoading}
                                className="py-3.5 bg-surface border border-border rounded-xl flex items-center justify-center gap-2 hover:bg-surface-highlight transition-colors disabled:opacity-50"
                            >
                                {googleLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-text-primary" />
                                ) : (
                                    <svg className="w-5 h-5 text-text-primary" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                                    </svg>
                                )}
                                <span className="font-semibold text-text-primary text-sm">Google</span>
                            </button>

                            <button
                                onClick={handleAppleLogin}
                                disabled={formLoading}
                                className="py-3.5 bg-black text-white rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-900 transition-colors disabled:opacity-50 border border-white/10"
                            >
                                {appleLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Apple className="w-5 h-5" />
                                )}
                                <span className="font-semibold text-sm">Apple</span>
                            </button>
                        </div>

                        {/* Toggle Register/Login */}
                        <div className="pt-2">
                            <button
                                onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                            >
                                {isRegistering ? "Вже є акаунт? Увійти" : "Немає акаунту? Зареєструватися"}
                            </button>
                        </div>

                        {urlCode && (
                            <p className="text-xs text-green-500 mt-1">
                                Посилання на хор знайдено! Увійдіть, щоб продовжити.
                            </p>
                        )}
                    </div>
                </div>

                <footer className="w-full pt-4 pb-2 flex flex-col items-center gap-2 text-xs text-text-secondary">
                    <div className="flex gap-6">
                        <Link href="/terms" className="hover:text-text-primary transition-colors whitespace-nowrap">Умови використання</Link>
                        <Link href="/privacy" className="hover:text-text-primary transition-colors whitespace-nowrap">Політика конфіденційності</Link>
                    </div>
                    <p>© 2026 MyChoir. Всі права захищені.</p>
                </footer>
            </div>
        );
    }

    if (view === 'email_auth') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-8 shadow-xl">
                    <button onClick={() => setView('welcome')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-6 text-sm font-medium">
                        <ArrowLeft className="w-5 h-5" />
                        Назад
                    </button>
                    <h2 className="text-2xl font-bold text-text-primary mb-2">{isRegistering ? "Реєстрація" : "Вхід"}</h2>
                    <p className="text-text-secondary text-sm mb-6">Введіть дані для входу</p>

                    <div className="space-y-4">
                        {isRegistering && (
                            <input
                                value={authName}
                                onChange={(e) => setAuthName(e.target.value)}
                                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                                placeholder="Ваше ім'я"
                            />
                        )}
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                            placeholder="Email"
                        />
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-medium pr-12"
                                placeholder="Пароль"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-text-secondary hover:text-text-primary transition-colors"
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
                            className="w-full py-4 bg-primary hover:opacity-90 text-background font-bold rounded-xl mt-4 flex items-center justify-center shadow-lg transition-all disabled:opacity-50"
                        >
                            {formLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? "Зареєструватися" : "Увійти")}
                        </button>

                        <div className="flex flex-col items-center gap-4 mt-8">
                            <button
                                onClick={() => setIsRegistering(!isRegistering)}
                                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
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
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-8 shadow-xl">
                    <button onClick={() => setView('email_auth')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-6 text-sm font-medium">
                        <ArrowLeft className="w-5 h-5" />
                        Назад
                    </button>
                    <h2 className="text-2xl font-bold text-text-primary mb-2">Відновлення паролю</h2>
                    <p className="text-text-secondary text-sm mb-6">Введіть email для отримання посилання</p>

                    {resetSent ? (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-500/10 rounded-full mx-auto flex items-center justify-center">
                                <Check className="w-8 h-8 text-green-500" />
                            </div>
                            <p className="text-text-primary font-bold">Лист надіслано!</p>
                            <p className="text-text-secondary text-sm">Перевірте вашу пошту {email} та перейдіть за посиланням для скидання паролю.</p>
                            <button
                                onClick={() => { setView('email_auth'); setResetSent(false); }}
                                className="w-full py-4 bg-primary text-background rounded-xl font-bold hover:opacity-90 transition-colors"
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
                                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                                placeholder="Email"
                            />
                            {error && <p className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">{error}</p>}

                            <button
                                onClick={handlePasswordReset}
                                disabled={formLoading}
                                className="w-full py-4 bg-primary hover:opacity-90 text-background rounded-xl font-bold flex justify-center transition-colors disabled:opacity-50"
                            >
                                {formLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Надіслати лист"}
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
                        <h2 className="text-2xl font-bold text-text-primary mb-6">Приєднатися</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-2 block">Прізвище</label>
                                    <input
                                        value={joinLastName}
                                        onChange={(e) => setJoinLastName(e.target.value)}
                                        className="w-full px-4 py-3 bg-surface-highlight rounded-xl border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-text-secondary/30"
                                        placeholder="Шевченко"
                                        autoCapitalize="words"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-2 block">Ім'я</label>
                                    <input
                                        value={joinFirstName}
                                        onChange={(e) => setJoinFirstName(e.target.value)}
                                        className="w-full px-4 py-3 bg-surface-highlight rounded-xl border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-text-secondary/30"
                                        placeholder="Тарас"
                                        autoCapitalize="words"
                                    />
                                </div>
                            </div>
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
                                disabled={formLoading || !joinLastName.trim() || !joinFirstName.trim()}
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
                                Ми знайшли дуже схоже ім'я в списку хору.
                            </p>
                            <p className="text-xs text-text-secondary/60 mb-4">
                                Зв'яжіть свій акаунт із цим профілем, щоб зберегти вашу історію відвідувань та партію.
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
                                    onClick={async () => {
                                        setShowClaimModal(false);
                                        await refreshProfile();
                                        router.push("/app");
                                    }}
                                    disabled={claimLoading}
                                    className="w-full py-3 text-sm text-text-secondary hover:text-white transition-colors"
                                >
                                    Ні, я новий учасник
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
