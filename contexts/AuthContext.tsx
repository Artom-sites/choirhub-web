"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import {
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    signInAnonymously,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    signOut as firebaseSignOut,
    User as FirebaseUser,
    signInWithCredential,
    OAuthProvider,
    browserPopupRedirectResolver,
    linkWithCredential,
    fetchSignInMethodsForEmail,
    AuthCredential
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { app, auth } from "@/lib/firebase";
import { getUserProfile, createUser, getChoir } from "@/lib/db";
import { getFunctions, httpsCallable } from "firebase/functions";
import { UserData } from "@/types";

interface AuthContextType {
    user: FirebaseUser | null;
    userData: UserData | null | undefined; // undefined = loading, null = no profile
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithApple: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
    signInAsGuest: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    isGuest: boolean;
    setFcmToken: (token: string | null) => void;
    updateActiveChoir: (choirId: string) => Promise<void>;
    pendingCredential: AuthCredential | null;
    existingMethod: string | null;
    clearPendingCredential: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<UserData | null | undefined>(undefined); // Start as undefined
    const [loading, setLoading] = useState(true);
    const googleLoginLock = useRef(false);
    const appleLoginLock = useRef(false);
    const skipAutoCreate = useRef(false);

    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const [pendingCredential, setPendingCredential] = useState<AuthCredential | null>(null);
    const [existingMethod, setExistingMethod] = useState<string | null>(null);

    useEffect(() => {

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log("Auth State Changed:", firebaseUser ? `User ${firebaseUser.uid}` : "No User");
            setUser(firebaseUser);

            if (firebaseUser) {
                try {
                    // Reset to undefined to indicate loading profile
                    setUserData(undefined);
                    console.log("Loading profile for:", firebaseUser.uid);
                    const profile = await getUserProfile(firebaseUser.uid);

                    if (profile) {
                        setUserData(profile);
                    } else if (skipAutoCreate.current) {
                        // Account linking in progress — DO NOT create a new users/{uid}
                        console.log("[Auth] skipAutoCreate is set — not creating profile for:", firebaseUser.uid);
                        skipAutoCreate.current = false;
                        setUserData(null);
                    } else if (!firebaseUser.isAnonymous) {
                        // Auto-create profile for Google/Apple/Email users on first login
                        console.log("Creating profile for new user:", firebaseUser.uid);
                        const newProfile = {
                            id: firebaseUser.uid,
                            email: firebaseUser.email || "",
                            name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
                            photoURL: firebaseUser.photoURL || "",
                            createdAt: new Date().toISOString()
                        };
                        await createUser(firebaseUser.uid, newProfile);
                        setUserData(newProfile as any);
                    } else {
                        setUserData(null);
                    }
                } catch (error) {
                    console.error("Error loading user profile:", error);
                    setUserData(null);
                }
            } else {
                setUserData(null);
                setFcmToken(null); // Clear token on auth state clear
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Helper to handle account-exists-with-different-credential
    const handleAccountLinkingError = async (error: any) => {
        if (error.code === 'auth/account-exists-with-different-credential') {
            const email = error.customData?.email;
            const pendingCred = error.credential;

            // Apple relay emails are unique per app — email-based linking won't work
            if (email?.endsWith('@privaterelay.appleid.com')) {
                console.warn("[Auth] Apple relay email detected — skipping linking flow");
                const { Dialog } = await import("@capacitor/dialog");
                await Dialog.alert({
                    title: "Приватний Apple Email",
                    message: "Оскільки ви використали приватну адресу під час реєстрації, система не змогла автоматично розпізнати попередні акаунти."
                });
                return;
            }

            if (pendingCred && email) {
                // Prevent auto-creation of users/{uid} when user re-logs with existing provider
                skipAutoCreate.current = true;
                setPendingCredential(pendingCred);
                try {
                    const methods = await fetchSignInMethodsForEmail(auth, email);
                    const method = methods[0]; // e.g., 'google.com' or 'apple.com'
                    setExistingMethod(method);

                    let providerName = 'іншим методом';
                    if (method === 'google.com') providerName = 'Google';
                    else if (method === 'apple.com') providerName = 'Apple';
                    else if (method === 'password') providerName = 'Email/Пароль';

                    const { Dialog } = await import("@capacitor/dialog");
                    await Dialog.alert({
                        title: "Акаунт вже існує",
                        message: `Ви вже заходили в систему через ${providerName} з цією поштою (${email}). Будь ласка, увійдіть спочатку через ${providerName}, і ми автоматично додамо цей спосіб входу.`
                    });
                } catch (e) {
                    console.error("Error fetching methods:", e);
                    // fetchSignInMethodsForEmail can fail due to email enumeration protection
                    // Still show a generic dialog
                    const { Dialog } = await import("@capacitor/dialog");
                    await Dialog.alert({
                        title: "Акаунт вже існує",
                        message: `Акаунт з цією поштою (${email}) вже існує. Увійдіть через попередній метод (Google, Apple, або Email), і ми автоматично додамо новий спосіб входу.`
                    });
                }
            }
        }
    };

    // Auto-link after successful login with existing provider
    useEffect(() => {
        if (user && pendingCredential) {
            console.log("[Auth] Attempting to link pending credential to current user...");
            linkWithCredential(user, pendingCredential)
                .then(async () => {
                    console.log("[Auth] Successfully linked account!");
                    setPendingCredential(null);
                    setExistingMethod(null);
                    // Reload existing profile — don't create a new one
                    await user.getIdToken(true);
                    await loadUserProfile(user.uid);
                })
                .catch((error) => {
                    if (error.code === 'auth/credential-already-in-use') {
                        console.warn("[Auth] Credential already linked to another account.");
                    } else if (error.code === 'auth/provider-already-linked') {
                        console.warn("[Auth] Provider already linked to this account.");
                    } else {
                        console.error("[Auth] Error linking credential:", error);
                    }
                    setPendingCredential(null);
                    setExistingMethod(null);
                });
        }
    }, [user, pendingCredential]);

    const loadUserProfile = async (uid: string) => {
        const profile = await getUserProfile(uid);
        console.log("Loaded profile:", profile);
        if (profile) {
            setUserData(profile);
        } else {
            console.warn("No user profile found for UID:", uid);
            setUserData(null);
        }
    };

    const signInWithGoogle = async () => {
        if (googleLoginLock.current) {
            console.warn("Google Sign-In is already in progress...");
            return;
        }
        googleLoginLock.current = true;
        try {
            if (Capacitor.getPlatform() === 'web') {
                const provider = new GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                await signInWithPopup(auth, provider, browserPopupRedirectResolver);
            } else {
                const result = await FirebaseAuthentication.signInWithGoogle();
                const credential = GoogleAuthProvider.credential(result.credential?.idToken);
                await signInWithCredential(auth, credential);
            }
        } catch (error: any) {
            console.error("Error signing in with Google:", error);
            if (error.code === 'auth/popup-closed-by-user' || error.errorMessage?.includes("canceled")) {
                console.warn("User closed the Google login popup or browser blocked it.");
            } else if (error.code === 'auth/account-exists-with-different-credential') {
                await handleAccountLinkingError(error);
            }
            throw error;
        } finally {
            googleLoginLock.current = false;
        }
    };

    const signInWithApple = async () => {
        if (appleLoginLock.current) {
            console.warn("Apple Sign-In is already in progress...");
            return;
        }
        appleLoginLock.current = true;
        try {
            // One-time warning about Private Relay / Hide My Email
            const { Preferences } = await import('@capacitor/preferences');
            const { value: hasSeenWarning } = await Preferences.get({ key: 'apple_relay_warning_seen' });

            if (!hasSeenWarning) {
                const { Dialog } = await import('@capacitor/dialog');
                const { value } = await Dialog.confirm({
                    title: "Порада щодо Apple ID",
                    message: "Якщо ви вже раніше входили іншим методом і ваші пошти однакові, то НЕ використовуйте підміну пошти для того, щоб зберегти та синхронізувати інформацію.",
                    okButtonTitle: "Зрозуміло",
                    cancelButtonTitle: "Скасувати"
                });

                if (!value) {
                    appleLoginLock.current = false;
                    return; // User cancelled before even triggering the sheet
                }

                // Mark as seen so they aren't bothered again on this device
                await Preferences.set({ key: 'apple_relay_warning_seen', value: 'true' });
            }

            if (Capacitor.getPlatform() === 'web') {
                const provider = new OAuthProvider('apple.com');
                await signInWithPopup(auth, provider, browserPopupRedirectResolver);
            } else {
                // skipNativeAuth: true means the plugin does NOT sign in with Firebase natively.
                // It only triggers Apple's native Sign-In UI and returns the credential.
                // We MUST call signInWithCredential ourselves so the JS Firebase SDK
                // updates its auth state (triggering onAuthStateChanged → navigation).
                const result = await FirebaseAuthentication.signInWithApple();
                const credential = new OAuthProvider('apple.com').credential({
                    idToken: result.credential?.idToken,
                    rawNonce: result.credential?.nonce,
                });
                await signInWithCredential(auth, credential);
            }
        } catch (error: any) {
            // 1. Detect Apple Sign-In cancellation natively and in web
            const errorString = String(error.errorMessage || error.message || error).toLowerCase();
            const isCanceled =
                error.code === 'auth/popup-closed-by-user' ||
                error.code === 1000 ||
                error.code === '1000' ||
                errorString.includes("canceled") ||
                errorString.includes("cancelled") ||
                errorString.includes("authorizationerror error 1000"); // Typical Capacitor/Apple format

            if (isCanceled) {
                console.warn("[Auth] User cancelled Apple Sign-In. Ignoring gracefully.");
                // 2. Do NOT throw the error. Simply return silently to prevent caller's Dialog.alert
                return;
            }

            // 3. If it's a REAL error (network, invalid nonce, Firebase issue), log and throw
            console.error("[Auth] Real error signing in with Apple:", error);
            if (error.code === 'auth/account-exists-with-different-credential') {
                await handleAccountLinkingError(error);
            }
            throw error;
        } finally {
            appleLoginLock.current = false;
        }
    };

    const signInWithEmail = async (email: string, password: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Error signing in with Email:", error);
            throw error;
        }
    };

    const signUpWithEmail = async (email: string, password: string, name: string) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // Create initial profile in Firestore
            await createUser(userCredential.user.uid, {
                id: userCredential.user.uid,
                email: email,
                name: name,
                createdAt: new Date().toISOString()
            });

            await updateProfile(userCredential.user, {
                displayName: name
            });

            // Reload user data to ensure context updates
            await loadUserProfile(userCredential.user.uid);
        } catch (error: any) {
            console.error("Error signing up with Email:", error);
            if (error.code === 'auth/email-already-in-use') {
                try {
                    const methods = await fetchSignInMethodsForEmail(auth, email);
                    if (methods.length > 0) {
                        const method = methods[0];
                        let providerName = 'іншим методом';
                        if (method === 'google.com') providerName = 'Google';
                        else if (method === 'apple.com') providerName = 'Apple';

                        const { Dialog } = await import("@capacitor/dialog");
                        await Dialog.alert({
                            title: "Акаунт вже існує",
                            message: `Ця пошта вже зареєстрована через ${providerName}. Будь ласка, увійдіть через ${providerName}.`
                        });
                    }
                } catch (e) {
                    console.error("Error fetching methods in signup:", e);
                }
            }
            throw error;
        }
    };

    const signInAsGuest = async () => {
        try {
            await signInAnonymously(auth);
            console.log("Signed in as guest");
        } catch (error) {
            console.error("Error signing in as guest:", error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            // Detach FCM token if exists
            if (user?.uid && fcmToken) {
                try {
                    const { doc, updateDoc, arrayRemove, getFirestore } = await import("firebase/firestore");
                    const db = getFirestore(app);
                    const userRef = doc(db, "users", user.uid);

                    console.log("[Auth] Detaching FCM token:", fcmToken);
                    await updateDoc(userRef, {
                        fcmTokens: arrayRemove(fcmToken)
                    });
                } catch (err) {
                    // Non-blocking error (e.g., offline or permission)
                    console.warn("[Auth] Failed to detach FCM token:", err);
                }
            }

            await firebaseSignOut(auth);
            setUserData(null);
            setFcmToken(null);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const resetPassword = async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error) {
            console.error("Error sending password reset email:", error);
            throw error;
        }
    };

    const updateActiveChoir = async (choirId: string) => {
        if (!user || !userData) return;
        const membership = (userData.memberships || []).find((m: any) => m.choirId === choirId);
        if (!membership) throw new Error("User is not a member of this choir");

        try {
            const { doc, updateDoc, getFirestore } = await import("firebase/firestore");
            const db = getFirestore(app);
            await updateDoc(doc(db, "users", user.uid), {
                choirId: membership.choirId,
                choirName: membership.choirName,
                role: membership.role,
                updatedAt: new Date().toISOString()
            });

            // Reload user data to ensure context updates
            await loadUserProfile(user.uid);

            // Force claims refresh
            await user.getIdToken(true);
        } catch (error) {
            console.error("Error updating active choir:", error);
            throw error;
        }
    };


    return (
        <AuthContext.Provider value={{
            user,
            userData,
            loading,
            signInWithGoogle,
            signInWithApple,
            signInWithEmail,
            signUpWithEmail,
            signInAsGuest,
            resetPassword,
            signOut,
            refreshProfile: async () => {
                if (user) {
                    console.log("[Auth] Forcing token refresh to pick up custom claims...");
                    await user.getIdToken(true); // Force refresh
                    await loadUserProfile(user.uid);
                }
            },
            isGuest: user?.isAnonymous ?? false,
            setFcmToken, // Exposed for useFcmToken hook
            updateActiveChoir,
            pendingCredential,
            existingMethod,
            clearPendingCredential: () => {
                setPendingCredential(null);
                setExistingMethod(null);
            },
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
