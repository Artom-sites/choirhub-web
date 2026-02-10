"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
    signInWithCredential
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { app } from "@/lib/firebase";
import { getUserProfile, createUser, getChoir } from "@/lib/db";
import { UserData } from "@/types";

interface AuthContextType {
    user: FirebaseUser | null;
    userData: UserData | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
    signInAsGuest: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const auth = getAuth(app);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

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
            setUser(firebaseUser);

            if (firebaseUser) {
                await loadUserProfile(firebaseUser.uid);
            } else {

                setUserData(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const loadUserProfile = async (uid: string) => {
        const profile = await getUserProfile(uid);
        if (profile) {
            setUserData(profile);
        }
    };

    const signInWithGoogle = async () => {
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
        } catch (error) {
            console.error("Error signing in with Google:", error);
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
            await updateProfile(userCredential.user, {
                displayName: name
            });
            // Profile entry creation happens optionally here or in the setup page, 
            // but createUser trigger auth state change so we are good.
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
            await firebaseSignOut(auth);
            setUserData(null);
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
            signInWithEmail,
            signUpWithEmail,
            signInAsGuest,
            resetPassword,
            signOut,
            refreshProfile: async () => {
                if (user) await loadUserProfile(user.uid);
            },
            isGuest: user?.isAnonymous ?? false
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
