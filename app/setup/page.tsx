"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Music2, Check, ExternalLink, User, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createUser, getChoir, updateChoirMembers } from "@/lib/db";
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
import { getAuth, signInAnonymously, updateProfile, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";

function SetupPageContent() {
    const router = useRouter();
    const { user, userData, loading: authLoading, signInWithGoogle, signInWithEmail, signUpWithEmail, refreshProfile } = useAuth();

    const searchParams = useSearchParams();
    const urlCode = searchParams.get('code');

    // UI State
    const [view, setView] = useState<'welcome' | 'join' | 'create' | 'email_auth' | 'phone_auth'>('welcome');

    // Form State
    const [choirName, setChoirName] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [guestName, setGuestName] = useState("");
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState("");

    // Email Auth State
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [authName, setAuthName] = useState("");

    // Phone Auth State
    const [phoneNumber, setPhoneNumber] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [phoneStep, setPhoneStep] = useState<'number' | 'code'>('number');

    useEffect(() => {
        if (!authLoading && userData?.choirId) {
            if (urlCode) {
                router.push(`/?joinCode=${urlCode}`);
            } else {
                router.push("/");
            }
        }
    }, [authLoading, userData, router, urlCode]);

    useEffect(() => {
        if (urlCode && !userData?.choirId) {
            setInviteCode(urlCode);
            setView('join');
        }
    }, [urlCode, userData]);

    const handleGoogleLogin = async () => {
        try {
            await signInWithGoogle();
        } catch (err) {
            console.error(err);
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

    const handleGuestLogin = async () => {
        if (!guestName.trim()) {
            setError("Введіть ваше ім'я");
            return;
        }
        setFormLoading(true);
        try {
            const auth = getAuth();
            const userCredential = await signInAnonymously(auth);

            await updateProfile(userCredential.user, {
                displayName: guestName.trim()
            });

            setView('welcome');
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/admin-restricted-operation' || err.code === 'auth/operation-not-allowed') {
                setError("Вхід гостя не увімкнено в Firebase Console. Увімкніть 'Anonymous' в Sign-in method.");
            } else {
                setError("Помилка входу");
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleSendOTP = async () => {
        if (!phoneNumber || phoneNumber.length < 10) {
            setError("Введіть правильний номер телефону");
            return;
        }

        setFormLoading(true);
        setError("");

        try {
            const auth = getAuth();

            // Format phone number (add +380 if not present)
            let formattedPhone = phoneNumber.trim();
            if (!formattedPhone.startsWith('+')) {
                if (formattedPhone.startsWith('0')) {
                    formattedPhone = '+38' + formattedPhone;
                } else if (formattedPhone.startsWith('380')) {
                    formattedPhone = '+' + formattedPhone;
                } else {
                    formattedPhone = '+380' + formattedPhone;
                }
            }

            // Create invisible reCAPTCHA
            const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
            });

            const result = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
            setConfirmationResult(result);
            setPhoneStep('code');
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-phone-number') {
                setError("Невірний формат номера");
            } else if (err.code === 'auth/too-many-requests') {
                setError("Забагато спроб. Спробуйте пізніше.");
            } else {
                setError("Помилка відправки SMS: " + err.message);
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            setError("Введіть 6-значний код");
            return;
        }
        if (!confirmationResult) {
            setError("Помилка верифікації. Спробуйте знову.");
            return;
        }

        setFormLoading(true);
        setError("");

        try {
            await confirmationResult.confirm(verificationCode);
            // Auth state will change automatically
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-verification-code') {
                setError("Невірний код підтвердження");
            } else {
                setError("Помилка підтвердження: " + err.message);
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
                name: user.displayName || guestName || "Користувач",
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
        } catch (err) {
            console.error(err);
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
            const codeUpper = inviteCode.toUpperCase();
            const qMember = query(firestoreCollection(db, "choirs"), where("memberCode", "==", codeUpper));
            const qRegent = query(firestoreCollection(db, "choirs"), where("regentCode", "==", codeUpper));

            const [snapMember, snapRegent] = await Promise.all([getDocs(qMember), getDocs(qRegent)]);

            let foundChoirId = "";
            let role: 'member' | 'regent' = 'member';
            let foundChoirName = "";
            let permissions: string[] | undefined = undefined;

            if (!snapRegent.empty) {
                foundChoirId = snapRegent.docs[0].id;
                role = 'regent';
                foundChoirName = snapRegent.docs[0].data().name;
            } else if (!snapMember.empty) {
                foundChoirId = snapMember.docs[0].id;
                role = 'member';
                foundChoirName = snapMember.docs[0].data().name;
            } else {
                // Check all choirs for adminCodes
                const allChoirsSnap = await getDocs(firestoreCollection(db, "choirs"));
                for (const choirDoc of allChoirsSnap.docs) {
                    const choirData = choirDoc.data();
                    const adminCodes = choirData.adminCodes || [];
                    const matchingCode = adminCodes.find((ac: any) => ac.code === codeUpper);
                    if (matchingCode) {
                        foundChoirId = choirDoc.id;
                        foundChoirName = choirData.name;
                        role = 'member'; // Admins appear as members
                        permissions = matchingCode.permissions;
                        break;
                    }
                }

                if (!foundChoirId) {
                    setError("Код не знайдено");
                    setFormLoading(false);
                    return;
                }
            }

            const memberData: any = {
                id: user.uid,
                name: user.displayName || guestName || "Користувач",
                role: role
            };
            if (permissions && permissions.length > 0) {
                memberData.permissions = permissions;
            }

            const choirRef = doc(db, "choirs", foundChoirId);
            await updateDoc(choirRef, {
                members: arrayUnion(memberData)
            });

            const userData: any = {
                id: user.uid,
                name: user.displayName || guestName || "Користувач",
                email: user.email || undefined,
                choirId: foundChoirId,
                choirName: foundChoirName,
                role: role,
                memberships: arrayUnion({
                    choirId: foundChoirId,
                    choirName: foundChoirName,
                    role: role
                }) as any
            };
            if (permissions && permissions.length > 0) {
                userData.permissions = permissions;
            }

            await createUser(user.uid, userData);

            await refreshProfile();
            router.push("/");
        } catch (err) {
            console.error(err);
            setError("Помилка приєднання");
        } finally {
            setFormLoading(false);
        }
    };

    if (authLoading) return <div className="h-screen flex items-center justify-center bg-black text-white"><Loader2 className="animate-spin" /></div>;

    if (!user && view !== 'email_auth' && view !== 'phone_auth') {
        return (
            <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-surface rounded-3xl flex items-center justify-center mb-8 border border-white/10 shadow-2xl">
                    <Music2 className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">MyChoir</h1>
                <p className="text-text-secondary mb-12">Ваш хоровий асистент</p>

                <div className="w-full max-w-sm space-y-3">
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-colors"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                        </svg>
                        Увійти через Google
                    </button>

                    <button
                        onClick={() => { setView('email_auth'); setIsRegistering(false); setEmail(""); setPassword(""); setAuthName(""); setError(""); }}
                        className="w-full py-4 bg-surface text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition-colors border border-white/5"
                    >
                        <Mail className="w-5 h-5" />
                        Увійти через пошту
                    </button>

                    <button
                        onClick={() => { setView('phone_auth'); setPhoneNumber(""); setVerificationCode(""); setPhoneStep('number'); setError(""); }}
                        className="w-full py-4 bg-surface text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition-colors border border-white/5"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Увійти за номером
                    </button>

                    {urlCode && (
                        <p className="text-xs text-green-400 mt-2">
                            Посилання на хор знайдено! Увійдіть, щоб продовжити.
                        </p>
                    )}
                </div>

                <p className="text-xs text-text-secondary mt-6 max-w-xs">
                    Синхронізація працює в обох випадках
                </p>
            </div>
        );
    }

    if (view === 'email_auth') {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-surface border border-white/5 rounded-3xl p-8">
                    <button onClick={() => setView('welcome')} className="text-text-secondary text-sm mb-6">← Назад</button>
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
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-black/20 rounded-xl border border-white/10 text-white focus:outline-none focus:border-white/30"
                            placeholder="Пароль"
                        />
                        {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">{error}</p>}

                        <button
                            onClick={handleEmailAuth}
                            disabled={formLoading}
                            className="w-full py-4 bg-white text-black rounded-xl font-bold mt-4 hover:bg-gray-200 transition-colors flex justify-center"
                        >
                            {formLoading ? <Loader2 className="animate-spin" /> : (isRegistering ? "Зареєструватися" : "Увійти")}
                        </button>

                        <div className="text-center mt-4">
                            <button
                                onClick={() => setIsRegistering(!isRegistering)}
                                className="text-text-secondary text-sm underline hover:text-white"
                            >
                                {isRegistering ? "Вже є акаунт? Увійти" : "Немає акаунту? Реєстрація"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'phone_auth') {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
                <div id="recaptcha-container"></div>
                <div className="w-full max-w-md bg-surface border border-white/5 rounded-3xl p-8">
                    <button onClick={() => { setView('welcome'); setPhoneStep('number'); }} className="text-text-secondary text-sm mb-6">← Назад</button>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {phoneStep === 'number' ? "Вхід за номером" : "Підтвердження"}
                    </h2>
                    <p className="text-text-secondary text-sm mb-6">
                        {phoneStep === 'number'
                            ? "Введіть ваш номер телефону"
                            : "Введіть код з SMS"}
                    </p>

                    <div className="space-y-4">
                        {phoneStep === 'number' ? (
                            <>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full px-4 py-3 bg-black/20 rounded-xl border border-white/10 text-white focus:outline-none focus:border-white/30 text-center text-lg font-mono"
                                    placeholder="+380 XX XXX XX XX"
                                    autoFocus
                                />
                                <p className="text-xs text-text-secondary text-center">
                                    Можна вводити з 0 або без коду країни
                                </p>
                            </>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    maxLength={6}
                                    className="w-full px-4 py-4 bg-black/20 rounded-xl border border-white/10 text-white focus:outline-none focus:border-white/30 text-center text-2xl font-mono tracking-[0.5em]"
                                    placeholder="000000"
                                    autoFocus
                                />
                                <button
                                    onClick={() => { setPhoneStep('number'); setVerificationCode(""); }}
                                    className="text-text-secondary text-sm underline hover:text-white block mx-auto"
                                >
                                    Змінити номер
                                </button>
                            </>
                        )}

                        {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">{error}</p>}

                        <button
                            onClick={phoneStep === 'number' ? handleSendOTP : handleVerifyOTP}
                            disabled={formLoading}
                            className="w-full py-4 bg-white text-black rounded-xl font-bold mt-4 hover:bg-gray-200 transition-colors flex justify-center"
                        >
                            {formLoading ? <Loader2 className="animate-spin" /> : (phoneStep === 'number' ? "Надіслати SMS" : "Підтвердити")}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Authenticated but no profile configured
    return (
        <div className="min-h-screen bg-[#09090b] p-6 flex items-center justify-center">
            <div className="w-full max-w-md bg-surface border border-white/5 rounded-3xl p-8">
                {view === 'welcome' && (
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-white/5 rounded-full mx-auto flex items-center justify-center mb-4 text-2xl font-bold text-white">
                            {user?.displayName ? user.displayName[0] : <User />}
                        </div>
                        <h2 className="text-2xl font-bold text-white">Привіт, {user?.displayName || "Гість"}!</h2>
                        <p className="text-text-secondary">
                            {urlCode ? "Приєднайтеся до хору за запрошенням" : "У вас ще немає хору. Що зробимо?"}
                        </p>

                        <div className="grid gap-3 pt-4">
                            {!urlCode && (
                                <button
                                    onClick={() => setView('create')}
                                    className="py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                >
                                    Створити новий хор
                                </button>
                            )}
                            <button
                                onClick={() => setView('join')}
                                className={`py-4 rounded-xl font-medium transition-colors ${urlCode
                                    ? 'bg-white text-black font-bold hover:bg-gray-200'
                                    : 'bg-white/5 text-white hover:bg-white/10 border border-white/5'
                                    }`}
                            >
                                Приєднатися {urlCode ? '' : 'за кодом'}
                            </button>
                        </div>
                    </div>
                )}

                {view === 'create' && (
                    <div>
                        <button onClick={() => setView('welcome')} className="text-text-secondary text-sm mb-6">← Назад</button>
                        <h2 className="text-2xl font-bold text-white mb-6">Створення хору</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-2 block">Назва хору</label>
                                <input
                                    value={choirName}
                                    onChange={(e) => setChoirName(e.target.value)}
                                    className="w-full px-4 py-3 bg-black/20 rounded-xl border border-white/10 text-white focus:outline-none focus:border-white/30"
                                    placeholder="Наприклад: Молодіжний Хор"
                                />
                            </div>
                            <button
                                onClick={handleCreateChoir}
                                disabled={formLoading}
                                className="w-full py-4 bg-white text-black rounded-xl font-bold mt-4 hover:bg-gray-200 transition-colors flex justify-center"
                            >
                                {formLoading ? <Loader2 className="animate-spin" /> : "Створити"}
                            </button>
                        </div>
                    </div>
                )}

                {view === 'join' && (
                    <div>
                        <button onClick={() => setView('welcome')} className="text-text-secondary text-sm mb-6">← Назад</button>
                        <h2 className="text-2xl font-bold text-white mb-6">Введіть код</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-2 block">Код запрошення</label>
                                <input
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    className="w-full px-4 py-3 bg-black/20 rounded-xl border border-white/10 text-white focus:outline-none focus:border-white/30 text-center text-xl font-mono tracking-widest uppercase"
                                    placeholder="XXXXXX"
                                />
                            </div>
                            {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">{error}</p>}
                            <button
                                onClick={handleJoinChoir}
                                disabled={formLoading}
                                className="w-full py-4 bg-white text-black rounded-xl font-bold mt-4 hover:bg-gray-200 transition-colors flex justify-center"
                            >
                                {formLoading ? <Loader2 className="animate-spin" /> : "Приєднатися"}
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
        <Suspense fallback={
            <div className="h-screen flex items-center justify-center bg-black text-white">
                <Loader2 className="animate-spin" />
            </div>
        }>
            <SetupPageContent />
        </Suspense>
    );
}
