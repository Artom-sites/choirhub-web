"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import {
    getAuth,
    onAuthStateChanged,
    signInWithRedirect,
    getRedirectResult,
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
    OAuthProvider
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { app } from "@/lib/firebase";
import { getUserProfile, createUser, getChoir } from "@/lib/db";
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const auth = getAuth(app);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<UserData | null | undefined>(undefined); // Start as undefined
    const [loading, setLoading] = useState(true);
    const googleLoginLock = useRef(false);

    const [fcmToken, setFcmToken] = useState<string | null>(null);

    useEffect(() => {
        // Handle Redirect Result explicitly
        const handleRedirect = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result?.user) {
                    console.log("Redirect login successful:", result.user.email);
                    // onAuthStateChanged will pick this up, but we can verify here
                }
            } catch (error) {
                console.error("Redirect auth error:", error);
            }
        };
        handleRedirect();

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
                await signInWithPopup(auth, provider);
            } else {
                const result = await FirebaseAuthentication.signInWithGoogle();
                const credential = GoogleAuthProvider.credential(result.credential?.idToken);
                await signInWithCredential(auth, credential);
            }
        } catch (error: any) {
            console.error("Error signing in with Google:", error);
            if (error.code === 'auth/popup-closed-by-user' || error.errorMessage?.includes("canceled")) {
                console.warn("User closed the Google login popup or browser blocked it.");
            }
            throw error;
        } finally {
            googleLoginLock.current = false;
        }
    };

    const signInWithApple = async () => {
        try {
            if (Capacitor.getPlatform() === 'web') {
                const provider = new OAuthProvider('apple.com');
                await signInWithPopup(auth, provider);
            } else {
                const result = await FirebaseAuthentication.signInWithApple();
                const credential = new OAuthProvider('apple.com').credential({
                    idToken: result.credential?.idToken,
                    accessToken: result.credential?.accessToken,
                });
                await signInWithCredential(auth, credential);
            }
        } catch (error: any) {
            console.error("Error signing in with Apple:", error);
            if (error.code === 'auth/popup-closed-by-user' || error.errorMessage?.includes("canceled")) {
                console.warn("User closed the Apple login popup.");
            }
            throw error;
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
        } catch (error) {
            console.error("Error signing up with Email:", error);
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
            setFcmToken // Exposed for useFcmToken hook
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
