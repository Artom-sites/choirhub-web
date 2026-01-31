"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
    getAuth,
    onAuthStateChanged,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    signOut as firebaseSignOut,
    User as FirebaseUser
} from "firebase/auth";
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
    resetPassword: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const auth = getAuth(app);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Handle Redirect Result
        getRedirectResult(auth).catch((error) => {
            console.error("Redirect auth error:", error);
        });

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
        const provider = new GoogleAuthProvider();
        try {
            await signInWithRedirect(auth, provider);
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
            resetPassword,
            signOut,
            refreshProfile: async () => {
                if (user) await loadUserProfile(user.uid);
            }
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
