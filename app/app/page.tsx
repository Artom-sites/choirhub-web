"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { distance } from "fastest-levenshtein";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { getChoir, createUser, updateChoirMembers, getServices, uploadChoirIcon, mergeMembers, updateChoir, deleteMyAccount, adminDeleteUser, deleteAdminCode, getChoirNotifications, getChoirUsers, joinChoir, updateMember, claimMember, leaveChoir } from "@/lib/db";
import { updateAttendanceCache } from "@/lib/attendanceCache";
import { getFirstNameInitial } from "@/lib/utils";
import { App } from '@capacitor/app';
import { Capacitor } from "@capacitor/core";
import { Dialog } from '@capacitor/dialog';
import { SplashScreen } from "@capacitor/splash-screen";
import { Service, Choir, UserMembership, UserData, ChoirMember, Permission, AdminCode, StatsSummary } from "@/types";
import SongList from "@/components/SongList";
import SwipeableCard from "@/components/SwipeableCard";
import ServiceList from "@/components/ServiceList";
import Preloader from "@/components/Preloader";
import ServiceView from "@/components/ServiceView";
import StatisticsView from "@/components/StatisticsView"; // New
import EditMemberModal from "@/components/EditMemberModal"; // New
import MergeMemberModal from "@/components/MergeMemberModal"; // New
import MemberStatsModal from "@/components/MemberStatsModal";
import NotificationSettings from "@/components/NotificationSettings";
import InstallPrompt from "@/components/InstallPrompt";
import GlassPageHeader from "@/components/GlassPageHeader";


import ThemeSettings from "@/components/ThemeSettings";
import LegalModal from "@/components/LegalModal";
import SupportModal from "@/components/SupportModal";
import HelpModal from "@/components/HelpModal";
import DeleteAccountModal from "@/components/DeleteAccountModal";
import ConfirmationModal from "@/components/ConfirmationModal";
import {
  Music2, Loader2, Copy, Check, HelpCircle, Mail, Shield,
  LogOut, ChevronLeft, ChevronRight, House, User, Users, Repeat,
  PlusCircle, Plus, UserPlus, UserX, X, Trash2, Camera, BarChart2, Link2, Pencil, FileText, Heart, Bell, BellOff, Sun, Moon, Monitor, Scale, Smartphone, RefreshCw, Search, ArrowUpDown, Palette, HardDrive, AlertTriangle, Calendar, Music, Globe
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NotificationPrompt from "@/components/NotificationPrompt";
import { collection as firestoreCollection, addDoc, getDocs, getDoc, where, query, doc, updateDoc, arrayUnion, onSnapshot, orderBy, limit, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirestoreLazy, getFunctionsLazy } from "@/lib/firebase";
const db = getFirestoreLazy();
const functions = getFunctionsLazy();
import { useFcmToken } from "@/hooks/useFcmToken";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useBackgroundCache } from "@/hooks/useBackgroundCache";


const FilledHouseIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.5 L2 11 h3 v9 a1 1 0 001 1 h4 v-7 h4 v7 h4 a1 1 0 001-1 v-9 h3 L12 2.5z" />
  </svg>
);

function HomePageContent() {
  const router = useRouter();

  const searchParams = useSearchParams();
  const { user, userData, loading: authLoading, signOut, refreshProfile, isGuest, updateActiveChoir, linkWithGoogle, linkWithApple } = useAuth();
  
  // Track canEdit state in a ref to prevent stale closures in global native callbacks
  const canEditRef = useRef(false);
  canEditRef.current = userData?.role === 'head' || userData?.role === 'regent';
  
  const { theme, setTheme } = useTheme();
  const { t, language, changeLanguage } = useTranslation();

  // Handle push notification tap routing globally
  useEffect(() => {
    const processRoute = async (payloadRaw: any) => {
      try {
        const payload = typeof payloadRaw === 'string' ? JSON.parse(payloadRaw) : payloadRaw;
        const targetRoute = payload.route || '/notifications';
        const targetChoirId = payload.choirId;

        // Switch active choir if a valid choirId was provided via push payload
        if (targetChoirId && userData) {
          const isMember = (userData.memberships || []).some((m: any) => m.choirId === targetChoirId);
          if (isMember && userData.choirId !== targetChoirId) {
            console.log(`[AppRouter] Switching active choir context for push tap to: ${targetChoirId}`);
            // This is async but we don't necessarily need to block UI, 
            // though blocking would ensure data represents new choir before render.
            await updateActiveChoir(targetChoirId);
          }
        }

        try {
          router.push(targetRoute);
        } catch (err) {
          window.location.href = targetRoute;
        }
      } catch (e) {
        // Fallback for old strings
        const fallbackRoute = typeof payloadRaw === 'string' ? payloadRaw : '/notifications';
        try {
          router.push(fallbackRoute);
        } catch (err) {
          window.location.href = fallbackRoute;
        }
      }
    };

    // 1. Check if app started from a push tap
    setTimeout(() => {
      const pendingRoute = localStorage.getItem('pendingNotificationRoute');
      if (pendingRoute && userData) {
        console.log("[AppRouter] Found pending notification route:", pendingRoute);
        localStorage.removeItem('pendingNotificationRoute');
        processRoute(pendingRoute);
      }
    }, 100);

    // 2. Listen for push tap while app is open
    const handlePushRoute = (e: any) => {
      if (e.detail && userData) {
        console.log("[AppRouter] Push route event received:", e.detail);
        localStorage.removeItem('pendingNotificationRoute'); // clear if exists
        processRoute(e.detail);
      }
    };

    window.addEventListener('app-push-route', handlePushRoute);
    return () => window.removeEventListener('app-push-route', handlePushRoute);
  }, [router, userData, updateActiveChoir]);

  // Global FCM Token Sync
  const {
    permissionStatus,
    loading: fcmLoading,
    requestPermission,
    unsubscribe,
    isSupported,
    isGranted,
    isPreferenceEnabled,
  } = useFcmToken();

  // Register Service Worker for offline support
  useServiceWorker();

  // Background cache upcoming service PDFs on app start
  useBackgroundCache();

  // ------------------------------------------------------------------
  //  STATE DEFINITIONS
  // ------------------------------------------------------------------

  // App Readiness
  const [isAppReady, setIsAppReady] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [isSwitchingChoir, setIsSwitchingChoir] = useState(false);
  const preloaderMinReady = useRef(false);
  const preloaderStartTime = useRef(Date.now());


  // Log when app data is fully ready and hide native splash screen
  useEffect(() => {
    if (!isAppReady) return;
    if (Capacitor.isNativePlatform()) {
      requestAnimationFrame(() => {
        SplashScreen.hide().catch(() => {});
      });
    }
  }, [isAppReady]);

  // Detect native platform after mount (Capacitor not available at SSG build time)
  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Tab Animation Variants
  const tabVariants = {
    initial: { opacity: 0, y: 10, scale: 0.99 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.99 },
    transition: { duration: 0.2, ease: "easeInOut" }
  };

  // Data
  const [choir, setChoir] = useState<Choir | null>(null);

  const loadHistory = async () => {
    if (loadingHistory || allHistoryLoaded || !userData?.choirId) return;
    setLoadingHistory(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      let q = query(
        firestoreCollection(db, `choirs/${userData.choirId}/services`),
        where("date", "<", sevenDaysAgoStr),
        orderBy("date", "desc"),
        limit(20)
      );

      if (lastVisibleHistory) {
        q = query(q, startAfter(lastVisibleHistory));
      }

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const newServices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
        // Persist attendance data to cache
        if (userData?.choirId) updateAttendanceCache(userData.choirId, newServices);
        setPastServices(prev => {
          // Deduplicate just in case
          const existingIds = new Set(prev.map(s => s.id));
          const uniqueNew = newServices.filter(s => !existingIds.has(s.id));
          return [...prev, ...uniqueNew];
        });
        setLastVisibleHistory(snapshot.docs[snapshot.docs.length - 1]);
        if (snapshot.docs.length < 20) setAllHistoryLoaded(true);
      } else {
        setAllHistoryLoaded(true);
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };
  // Data States
  const [activeServices, setActiveServices] = useState<{ upcoming: Service[], recentPast: Service[] }>({ upcoming: [], recentPast: [] });

  // Widget Voting Sync State Refs
  const voteSyncRefs = useRef({ 
    choirId: userData?.choirId, 
    isPolling: false,
    hasInitialRun: false 
  });
  
  // Update volatile dependencies linearly on render
  useEffect(() => {
    voteSyncRefs.current.choirId = userData?.choirId;
  }, [userData?.choirId]);

  // Widget Voting Sync Effect
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const syncPendingVotes = async () => {
      if (voteSyncRefs.current.isPolling) return;
      voteSyncRefs.current.isPolling = true;

      try {
        const { default: WidgetData } = await import('@/plugins/WidgetDataPlugin');
        const { votes } = await WidgetData.getPendingVotes();
        if (votes && votes.length > 0) {
          console.log("[WidgetSync] Found pending votes from widget:", votes.length);
          const { setServiceAttendance } = await import('@/lib/db');
          const auth = (await import('@/lib/firebase')).getAuthLazy();
          const userId = auth?.currentUser?.uid;
          
          const currentChoirId = voteSyncRefs.current.choirId;
          if (!userId || !currentChoirId) return;

          const m = await import('@/lib/widgetSync');
          m.suspendWidgetSync(5000); 

          for (const vote of votes) {
            try {
              // Widget sends "confirmed"/"absent", setServiceAttendance expects "present"/"absent"
              const dbAction: 'present' | 'absent' = (vote.action === 'confirmed' || vote.action === 'present') ? 'present' : 'absent';
              const widgetStatus: 'confirmed' | 'absent' = dbAction === 'present' ? 'confirmed' : 'absent';
              console.log(`[WidgetSync] Syncing vote for service ${vote.serviceId}: widget=${vote.action} → db=${dbAction} → track=${widgetStatus}`);
              // Route vote to the choir that actually owns this service (from last widget payload)
              const voteChoirId = m.lastPayloadServiceMap[vote.serviceId] || currentChoirId;
              console.log(`[WidgetSync:Vote] Target choirId=${voteChoirId} (from ${m.lastPayloadServiceMap[vote.serviceId] ? 'payload-map' : 'active-choir'}), serviceId=${vote.serviceId}, action=${dbAction}`);
              await setServiceAttendance(voteChoirId, vote.serviceId, userId, dbAction);
              console.log(`[WidgetSync:Vote] Write succeeded for service ${vote.serviceId} (Global update complete).`);
              m.trackVotedService(vote.serviceId, widgetStatus);
            } catch (err) {
              console.error(`[WidgetSync] Failed to sync vote for service ${vote.serviceId}`, err);
            }
          }
        }
      } catch (e) {
        console.error("[WidgetSync] Error polling pending votes:", e);
      } finally {
        voteSyncRefs.current.isPolling = false;
      }
    };

    // Sync on initial load
    if (!voteSyncRefs.current.hasInitialRun) {
      voteSyncRefs.current.hasInitialRun = true;
      syncPendingVotes();
    }

    // Sync when app comes to foreground
    const handleAppState = App.addListener('appStateChange', (state) => {
      if (state.isActive) {
        syncPendingVotes();
      }
    });

    return () => {
      handleAppState.then(sub => sub.remove());
    };
  }, []);

  const [pastServices, setPastServices] = useState<Service[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [lastVisibleHistory, setLastVisibleHistory] = useState<QueryDocumentSnapshot | null>(null);
  const [allHistoryLoaded, setAllHistoryLoaded] = useState(false);
  const [globalStats, setGlobalStats] = useState<StatsSummary | null>(null);

  // Derived Services List (Active + Loaded History)
  // Combine all services and sort descending (newest first) for History view, 
  // but usually UI separates Upcoming and Past.
  // We'll mimic the original 'services' array which contained everything.
  const services = [...activeServices.upcoming, ...activeServices.recentPast, ...pastServices];

  // Old simple state removed:
  // const [services, setServices] = useState<Service[]>([]); // REPLACED
  const setServices = (s: Service[]) => {
    // Shim to prevent crashes if I missed any setServices calls.
    // But we should try to avoid calling this.
  };
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [loadingRegisteredUsers, setLoadingRegisteredUsers] = useState(false);

  // Cache management
  const [cacheSize, setCacheSize] = useState<{ count: number; sizeBytes: number }>({ count: 0, sizeBytes: 0 });
  const [cacheLimit, setCacheLimitState] = useState('100');
  const [cacheRetention, setCacheRetentionState] = useState('30');
  const [cacheClearLoading, setCacheClearLoading] = useState(false);

  // UI States & Modals
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showChoirManager, setShowChoirManager] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<ChoirMember | null>(null);
  const [mergingMember, setMergingMember] = useState<ChoirMember | null>(null);
  const [linkingAppUser, setLinkingAppUser] = useState<any | null>(null);
  const [viewingMemberStats, setViewingMemberStats] = useState<ChoirMember | null>(null);
  const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
  const [showAllAdminCodes, setShowAllAdminCodes] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [showChoirSettings, setShowChoirSettings] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalInitialView, setLegalInitialView] = useState<'main' | 'privacy' | 'terms'>('main');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);

  // Manager/Admin States
  const [managerMode, setManagerMode] = useState<'list' | 'create' | 'join'>('list');
  const [newChoirName, setNewChoirName] = useState("");
  const [namePromptReason, setNamePromptReason] = useState<'create' | 'join' | 'claim' | null>(null);
  const [dismissedProfileBanner, setDismissedProfileBanner] = useState(false);
  const [newChoirType, setNewChoirType] = useState<'msc' | 'standard' | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinLastName, setJoinLastName] = useState("");
  const [joinFirstName, setJoinFirstName] = useState("");
  const [managerLoading, setManagerLoading] = useState(false);
  const [managerError, setManagerError] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Claim Member modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showFinishAppRegistration, setShowFinishAppRegistration] = useState(false);
  const [claimMembers, setClaimMembers] = useState<{ id: string, name: string, voice: string }[]>([]);
  const [claimChoirId, setClaimChoirId] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [deletingAdminCode, setDeletingAdminCode] = useState<string | null>(null);
  const [newAdminLabel, setNewAdminLabel] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [creatingAdminCode, setCreatingAdminCode] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [editChoirName, setEditChoirName] = useState("");
  const [savingChoirSettings, setSavingChoirSettings] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [choirToLeave, setChoirToLeave] = useState<{ id: string, name: string } | null>(null);

  const iconInputRef = useRef<HTMLInputElement>(null);

  const AVAILABLE_PERMISSIONS: { key: Permission; label: string }[] = [
    { key: 'add_songs', label: t('permissions.add_songs') },
    { key: 'edit_attendance', label: t('permissions.edit_attendance') },
    { key: 'edit_credits', label: t('permissions.edit_credits') },
    { key: 'view_stats', label: t('permissions.view_stats') },
    { key: 'manage_services', label: t('permissions.manage_services') },
    { key: 'notify_members', label: t('permissions.notify_members') },
  ];

  // ------------------------------------------------------------------
  //  SELF-SERVICE PROFILE CLAIMING
  // ------------------------------------------------------------------
  // Detect if the current user's auto-created member entry has not been
  // claimed/linked to a real choir member profile yet.
  const isUserUnlinked = (() => {
    if (!user || !choir?.members) return false;
    // Check if the user's UID is linked to ANY member via accountUid or linkedUserIds
    const isLinkedAnywhere = choir.members.some((m: any) =>
      m.accountUid === user.uid || (m.linkedUserIds || []).includes(user.uid)
    );
    if (isLinkedAnywhere) return false;
    // If not linked anywhere, check if they have an auto-created stub entry
    const myEntry = choir.members.find((m: any) => m.id === user.uid);
    // No member entry at all — user exists in users collection but not in choir.members
    if (!myEntry) return true;
    // Has a voiceless stub without a proper First/Last name (no space)
    if (myEntry.hasAccount && !myEntry.voice && (!myEntry.name || !myEntry.name.trim().includes(' '))) return true;
    return false;
  })();

  const openClaimFromBanner = () => {
    if (!choir?.members || !userData?.choirId) return;
    // We now just ask them to type their name and run auto-match
    // instead of showing a list of users.
    setShowFinishAppRegistration(true);
  };

  const handleFinishAppRegistration = async () => {
    if (!user || !userData?.choirId) return;
    setClaimLoading(true);
    setManagerError("");

    const hasNameInput = joinLastName.trim() || joinFirstName.trim();
    const providedName = hasNameInput ? [joinLastName.trim(), joinFirstName.trim()].filter(Boolean).join(" ") : (userData?.name || "");

    try {
      // 1. Save name to user profile if provided
      if (hasNameInput) {
        await createUser(user.uid, { name: providedName });
      }

      // 2. Fetch choir to find unlinked members
      const choirDocRef = doc(db, "choirs", userData.choirId);
      const choirSnap = await getDoc(choirDocRef);
      if (!choirSnap.exists()) throw new Error("Choir not found");
      const cData = choirSnap.data();
      const currentMembers = cData.members || [];
      const unlinked = currentMembers.filter((m: any) => !m.hasAccount && m.name);

      // Auto-matching logic
      if (unlinked.length > 0 && providedName && providedName !== "User") {
        const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
        const enteredNameNorm = normalize(providedName);
        const enteredNameReversed = normalize(providedName.split(' ').reverse().join(' '));

        const matchedMember = unlinked.find((m: any) => {
          if (!m.name) return false;
          const mName = normalize(m.name);
          // Allow up to 2 typos for a match
          const distNormal = distance(mName, enteredNameNorm);
          const distReversed = distance(mName, enteredNameReversed);
          return distNormal <= 2 || distReversed <= 2;
        });

        if (matchedMember) {
          setClaimMembers([matchedMember]);
          setClaimChoirId(userData.choirId);
          setSelectedClaimId(matchedMember.id);
          setShowFinishAppRegistration(false);
          setShowClaimModal(true);
          setClaimLoading(false);
          return;
        }
      }

      // No match -> Update their own auto-created stub with the new name if provided
      if (hasNameInput) {
        await updateMember(userData.choirId, user.uid, { name: providedName });
      }

      await refreshProfile();
      setShowFinishAppRegistration(false);
    } catch (e: any) {
      console.error(e);
      setManagerError(e.message || t("manager.error_save"));
    } finally {
      setClaimLoading(false);
    }
  };

  // ------------------------------------------------------------------
  //  EFFECTS & NAVIGATION
  // ------------------------------------------------------------------

  // Notifications Check — real-time listener
  useEffect(() => {
    if (!userData?.choirId || !userData?.id) return;

    const q = query(
      firestoreCollection(db, `choirs/${userData.choirId}/notifications`),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const unread = snapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.readBy?.includes(userData.id);
      });
      setUnreadNotifications(unread.length);
    }, (error) => {
      console.error("[Notifications] onSnapshot error:", error);
    });

    return () => unsub();
  }, [userData?.choirId, userData?.id]);

  // Tab Navigation
  const activeTabRaw = searchParams.get('tab');
  const activeTab = (activeTabRaw === 'songs' || activeTabRaw === 'members') ? activeTabRaw : 'home';

  // Restore tab from localStorage when returning from another page (e.g. /privacy, /terms)
  // (Tab restoration removed - always start on Home/Services)
  // useEffect(() => { ... }, []);

  // No longer needed: view=account was used for Privacy/Terms return navigation
  // Privacy and Terms are now shown inline within LegalModal

  const setActiveTab = (tab: 'home' | 'songs' | 'members') => {
    // localStorage.setItem('activeTab', tab); // Removed persistence
    const newParams = new URLSearchParams(searchParams.toString());
    if (tab === 'home') {
      newParams.delete('tab');
      // localStorage.setItem('activeTab', 'home');
    } else {
      newParams.set('tab', tab);
    }
    router.replace(`/app?${newParams.toString()}`, { scroll: false });
  };

  const [memberFilter, setMemberFilter] = useState('');

  // --- Native Header Integration ---
  useEffect(() => {
    if (!isNative) return;
    try {
      const payload = {
        title: choir?.name || "MyChoir",
        avatarLetter: userData?.name ? getFirstNameInitial(userData.name) : "U",
        unreadCount: unreadNotifications,
        showSearch: false, // Search is now in the sub-header
        theme: theme,
        logoUrl: choir?.icon || ""
      };
      (window as any).webkit?.messageHandlers?.headerSync?.postMessage(payload);
    } catch (e) {
      console.warn("Failed to sync header to native", e);
    }
  }, [choir?.name, userData?.name, unreadNotifications, isNative, activeTab, theme]);

    useEffect(() => {
    // Expose direct functions on window so Swift can call them by name.
    // This is more reliable than CustomEvent dispatch since there's no
    // listener registration timing issue.
    (window as any).__nativeHeaderAvatarClick = () => setShowAccount(true);
    (window as any).__nativeHeaderBellClick = () => router.push('/notifications');
    (window as any).__nativeHeaderTitleClick = () => setShowChoirManager(true);
    (window as any).__nativeHeaderLogoClick = () => {
      if (canEditRef.current) {
        setEditChoirName(choir?.name || ''); 
        setShowChoirSettings(true); 
      }
    };
    (window as any).__nativeHeaderSearchClick = () => setShowSearchOverlay(true);

    return () => {
      delete (window as any).__nativeHeaderAvatarClick;
      delete (window as any).__nativeHeaderBellClick;
      delete (window as any).__nativeHeaderTitleClick;
      delete (window as any).__nativeHeaderLogoClick;
      delete (window as any).__nativeHeaderSearchClick;
    };
  }, [router, choir?.name]);
  // ---------------------------------

  // Native FAB tap → open correct modal based on active tab and sub-tab
  useEffect(() => {
    const handler = () => {
      if (activeTab === 'home') {
        setShowAddServiceModal(true);
      } else if (activeTab === 'songs') {
        // Check if user is on the archive (catalog) sub-tab or repertoire sub-tab
        // The archive sub-tab has GlobalArchive which listens for its own event
        const isOnArchiveTab = document.querySelector('[data-subtab="catalog"]')?.classList.contains('block');
        if (isOnArchiveTab) {
          // Let GlobalArchive handle this
          window.dispatchEvent(new CustomEvent('nativeFABPressed:archive'));
        } else {
          setShowAddSongModal(true);
        }
      } else if (activeTab === 'members') {
        setEditingMember(null);
        setShowEditMemberModal(true);
      }
    };
    window.addEventListener('nativeFABPressed', handler);
    return () => window.removeEventListener('nativeFABPressed', handler);
  }, [activeTab]);

  // Handle Android back gesture explicitly for Account Modal
  useEffect(() => {
    if (showAccount) {
      window.history.pushState({ modal: 'account' }, '');
      const handlePopState = (e: PopStateEvent) => {
        if (e.state?.modal === 'account') return; // We popped back to account, don't close it
        setShowAccount(false);
      };
      window.addEventListener('popstate', handlePopState);

      // Load cache stats
      (async () => {
        try {
          const { getCacheSize, getCacheLimit, getCacheRetention } = await import('@/lib/offlineDb');
          const size = await getCacheSize();
          setCacheSize(size);
          setCacheLimitState(getCacheLimit());
          setCacheRetentionState(getCacheRetention());
        } catch (e) { console.warn('Cache stats load error:', e); }
      })();

      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [showAccount]);

  // Handle Android back gesture for Legal Modal
  useEffect(() => {
    if (showLegalModal) {
      window.history.pushState({ modal: 'legal' }, '');
      const handlePopState = (e: PopStateEvent) => {
        if (e.state?.modal === 'legal') return;
        setShowLegalModal(false);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [showLegalModal]);

  // Handle Android back gesture for Help Modal
  useEffect(() => {
    if (showHelpModal) {
      window.history.pushState({ modal: 'help' }, '');
      const handlePopState = (e: PopStateEvent) => {
        if (e.state?.modal === 'help') return;
        setShowHelpModal(false);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [showHelpModal]);

  // Handle Android back gesture for Support Modal
  useEffect(() => {
    if (showSupportModal) {
      window.history.pushState({ modal: 'support' }, '');
      const handlePopState = (e: PopStateEvent) => {
        if (e.state?.modal === 'support') return;
        setShowSupportModal(false);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [showSupportModal]);

  // Member Card Renderer
  const [memberSearch, setMemberSearch] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const membersContainerRef = useRef<HTMLDivElement>(null);

  const voiceColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    Soprano: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/25', dot: '#f472b6' },
    Alto: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/25', dot: '#c084fc' },
    Tenor: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/25', dot: '#60a5fa' },
    Bass: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/25', dot: '#4ade80' },
  };

  const renderMemberCard = (member: ChoirMember, index: number = 0) => {
    const absences = getAbsenceCount(member.id);
    const memberStat = globalStats?.memberStats?.[member.id];
    const attendanceRate = memberStat?.attendanceRate ?? 100;
    const vc = voiceColors[member.voice || ''];

    return (
      <motion.div
        layout
        key={member.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15, delay: index * 0.02 }}
        className="flex items-center gap-3 px-3 py-2.5 bg-surface rounded-xl hover:bg-surface-highlight transition-colors group cursor-pointer"
        onClick={() => setViewingMemberStats(member)}
      >
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs relative flex-shrink-0 ${vc ? `${vc.bg} ${vc.text}` : 'bg-surface-highlight text-text-secondary'
          }`}>
          {member.photoURL ? (
            <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover rounded-full" />
          ) : (
            member.voice ? member.voice[0].toUpperCase() : getFirstNameInitial(member.name)
          )}
        </div>

        {/* Name & info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-semibold text-text-primary truncate min-w-[50px]">{member.name}</span>
            {/* Role badge */}
            {(() => {
              const label = member.roleLabel || (member.role === 'head' ? t('global.roles.head') : member.role === 'regent' ? t('global.roles.regent') : null);
              if (!label) return null;
              
              let colorClass = "bg-indigo-500/15 text-indigo-400 border-indigo-500/20";
              const lowerLabel = member.roleLabel ? member.roleLabel.toLowerCase() : '';
              
              if (member.role === 'head' || lowerLabel.includes('керівник')) {
                colorClass = "bg-orange-500/15 text-orange-400 border-orange-500/20";
              } else if (member.role === 'regent' || lowerLabel.includes('регент')) {
                colorClass = "bg-purple-500/15 text-purple-400 border-purple-500/20";
              } else if (lowerLabel.includes('акомпаніатор')) {
                colorClass = "bg-blue-500/15 text-blue-400 border-blue-500/20";
              }

              return (
                <span className={`inline-block text-[9px] font-medium px-1.5 py-[2px] rounded border flex-shrink-0 leading-none ${colorClass}`}>
                  {label}
                </span>
              );
            })()}
            {/* "Я" badge */}
            {(member.id === user?.uid || member.accountUid === user?.uid) && (
              <span className="text-[9px] font-bold px-1.5 py-[2px] rounded flex-shrink-0 leading-none bg-accent/15 text-accent border border-accent/20">{t('account.me_badge')}</span>
            )}
            {member.hasAccount && <Smartphone className="w-3 h-3 text-blue-400 flex-shrink-0" />}
          </div>
          {/* Mini attendance bar */}
          {memberStat && memberStat.servicesWithRecord > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 bg-surface-highlight rounded-full overflow-hidden max-w-[80px]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${attendanceRate}%`,
                    backgroundColor: attendanceRate >= 80 ? '#4ade80' : attendanceRate >= 50 ? '#fbbf24' : '#f87171'
                  }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-text-secondary">{attendanceRate}%</span>
            </div>
          )}
        </div>

        {/* Absences badge */}
        {absences > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 rounded-lg flex-shrink-0">
            <span className="text-[11px] font-bold text-orange-400 tabular-nums">{absences}</span>
          </div>
        )}

        {/* Edit button - only for admins */}
        {canEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingMember(member);
              setShowEditMemberModal(true);
            }}
            className="text-text-secondary/30 group-hover:text-text-secondary transition-colors p-1.5 hover:bg-surface rounded-lg flex-shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    );
  };

  // ------------------------------------------------------------------
  //  CORE APP INITIALIZATION
  // ------------------------------------------------------------------
  useEffect(() => {
    // 1. Wait for Auth Context or Profile Loading
    if (authLoading || userData === undefined) {
      return;
    }

    // 2. Unauthenticated -> Redirect to Setup
    if (!user || !userData?.choirId) {
      setIsAppReady(true); // Dismiss preloader before redirect
      const currentParams = searchParams.toString();
      router.replace(currentParams ? `/?${currentParams}` : "/");
      return;
    }

    // RESET STATE ON CHOIR ID CHANGE
    // This prevents "leaking" old choir data while new data loads
    const currentChoirId = userData.choirId;
    if (choir?.id && choir.id !== currentChoirId) {
      setChoir(null);
      setActiveServices({ upcoming: [], recentPast: [] });
      setPastServices([]);
      setLastVisibleHistory(null);
      setAllHistoryLoaded(false);
      // Clear any other choir-specific state here
    }

    // 3. Authenticated -> Load Data
    const choirId = userData.choirId;


    let servicesLoaded = false;
    let choirLoaded = false;

    const checkReady = () => {
      if (servicesLoaded && choirLoaded) {
        setIsAppReady(true);
        setIsSwitchingChoir(false);
      }
    };

    // Calculate 90 days ago for "Active Window"
    // Expanded from 7→90 days so MemberStatsModal can compute
    // 14/30/90-day attendance stats from the same realtime data
    // without additional Firestore reads (~25-30 docs for 2x/week rehearsals).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(today.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

    // ACTIVE WINDOW LISTENER (Realtime)

    // INSTANT LOAD: Attempt to load from cache first
    const CACHE_KEY = `services_active_v1_${choirId}`;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setActiveServices(parsed);
        // If we have cache, we don't need to wait for network to show UI
        servicesLoaded = true;
        checkReady();
      }
    } catch (e) { console.warn("Failed to load services cache", e); }

    const qServices = query(
      firestoreCollection(db, `choirs/${choirId}/services`),
      where("date", ">=", ninetyDaysAgoStr),
      orderBy("date", "asc")
    );

    const unsubServices = onSnapshot(qServices, (snapshot) => {
      const fetchedActiveServices = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Service))
        .filter(s => !s.deletedAt);

      // We still sort them into Upcoming and Recent Past
      const upcoming = fetchedActiveServices.filter(s => new Date(s.date) >= today)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const recentPast = fetchedActiveServices.filter(s => new Date(s.date) < today)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Update Active Services State
      const newState = { upcoming, recentPast };
      setActiveServices(newState);

      // Sync widget data from ALL user's choirs (initial load + realtime)
      import('@/lib/widgetSync').then(m => {
        m.resumeWidgetSync(); // Always resume if snapshot fired (assured fresh data)
        m.syncWidgetAllChoirs(
          [...upcoming, ...recentPast],
          null, // DO NOT pass the async 'choir' state object to avoid stale names during switch
          userData?.memberships || [],
          choirId // Pass the strictly derived choirId from the snapshot scope
        );
      }).catch(console.error);

      // Update Cache
      localStorage.setItem(CACHE_KEY, JSON.stringify(newState));

      // Update the main 'services' list used by UI (merged)
      // This might cause a loop if we depend on 'services'. 
      // Instead, we should use a derived state or effect.
      // For now, let's update simple state.

      servicesLoaded = true;
      checkReady();

      // Persist attendance data to cache
      if (choirId) updateAttendanceCache(choirId, fetchedActiveServices);
    }, (error) => {
      console.error("Error fetching services:", error);
      servicesLoaded = true;
      checkReady();
    });

    const unsubChoir = onSnapshot(doc(db, "choirs", choirId), (docSnap) => {
      if (docSnap.exists()) {
        const fetchedChoir = { id: docSnap.id, ...docSnap.data() } as Choir;
        setChoir(fetchedChoir);
      }
      choirLoaded = true;
      checkReady();
    }, (error) => {
      console.error("Error fetching choir:", error);
      choirLoaded = true;
      checkReady();
    });

    // Subscribe to pre-calculated stats summary for O(1) performance
    const unsubStats = onSnapshot(doc(db, `choirs/${choirId}/stats/summary`), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalStats(docSnap.data() as StatsSummary);
      }
    }, (error) => {
      console.error("Error fetching global stats:", error);
    });

    return () => {
      unsubServices();
      unsubChoir();
      unsubStats();
    };

  }, [authLoading, user, userData?.choirId, router]);

  // URL Sync Effect (Service ID, Join Code)
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    // Skip URL sync while we're in the middle of a programmatic navigation
    if (isNavigatingRef.current) return;

    // Only run if app is ready OR we have data (for service ID syncing)
    if (services.length > 0) {
      const serviceIdParam = searchParams.get('serviceId');
      if (serviceIdParam) {
        const foundService = services.find(s => s.id === serviceIdParam);
        if (foundService) setSelectedService(foundService);
      } else {
        setSelectedService(null);
      }
    }

    if (choir) {
      const joinCodeParam = searchParams.get('joinCode');
      if (joinCodeParam) {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete('joinCode');
        router.replace(`/app?${newParams.toString()}`, { scroll: false });

        const codeUpper = joinCodeParam.toUpperCase();
        const alreadyInChoir = (
          choir.memberCode === codeUpper ||
          choir.regentCode === codeUpper ||
          choir.adminCodes?.some(ac => ac.code === codeUpper)
        );

        if (!alreadyInChoir) {
          setShowAccount(false);
          setShowChoirManager(true);
          setManagerMode('join');
          setJoinCode(joinCodeParam);
          // Auto-fill name from profile
          if (userData?.name && userData.name.includes(' ')) {
            const parts = userData.name.split(' ');
            setJoinLastName(parts[0]);
            setJoinFirstName(parts.slice(1).join(' '));
          }
        }
      }
    }
  }, [searchParams, services, choir, router]);

  // Load registered users when Members tab is active (for "Нові користувачі" section)
  useEffect(() => {
    if (activeTab === 'members' && choir?.id) {
      setLoadingRegisteredUsers(true);
      getChoirUsers(choir.id).then(users => {
        // Client-side sort to avoid needing composite index
        const sorted = users.sort((a, b) => {
          const timeA = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        // Deduplicate by ID to prevent UI crashes if DB has duplicated records
        const deduped = Array.from(new Map(sorted.map(u => [u.id, u])).values());

        setRegisteredUsers(deduped);
      }).catch((err) => {
        console.error("Error fetching users:", err);
      }).finally(() => {
        setLoadingRegisteredUsers(false);
      });
    }
  }, [activeTab, choir?.id]);

  // Sync selectedService REVERTED due to infinite preloader bug. 
  // We will re-implement safer sync later.

  // Handle Service Selection with URL sync
  const handleSelectService = (service: Service | null) => {
    const newParams = new URLSearchParams(searchParams.toString());

    // Eagerly set state first to make UI feel instant
    setSelectedService(service);

    // Prevent URL sync effect from interfering during navigation
    isNavigatingRef.current = true;

    try {
      if (service) {
        newParams.set('serviceId', service.id);
        const url = `/app?${newParams.toString()}`;
        router.push(url, { scroll: false });
      } else {
        newParams.delete('serviceId');
        if (searchParams.get('serviceId')) {
          router.back();
        }
      }
    } catch (error) {
      console.error("[Navigation] Push failed (likely offline):", error);
    }

    // Allow URL sync to resume after a short delay for the navigation to settle
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 300);
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };


  const handleLeaveChoir = async () => {
    if (!choirToLeave) return;
    try {
      await leaveChoir(choirToLeave.id);
      // Refresh profile to update memberships
      if (user) await refreshProfile();
      setChoirToLeave(null);
    } catch (e) {
      console.error("Error leaving choir:", e);
      await Dialog.alert({ title: t("common.error"), message: t("manager.error_leave_choir") });
    }
  };

  const handleSwitchChoir = async (membership: UserMembership) => {
    if (!user) return;
    setIsSwitchingChoir(true);

    await createUser(user.uid, {
      choirId: membership.choirId,
      choirName: membership.choirName,
      role: membership.role
    });

    // Optimistically clear sessionStorage archive state so edit buttons show correctly
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('showArchive');
    }

    await refreshProfile();
    setShowAccount(false);
    setShowChoirManager(false);
    router.replace('/app');
  };

  const handleCreateChoir = async () => {
    if (!user || !newChoirName.trim() || !newChoirType) return;
    setManagerLoading(true);
    try {
      // Use Atomic Cloud Function (same as Setup Page)
      const { createChoir } = await import("@/lib/db");
      await createChoir(newChoirName.trim(), newChoirType);

      // Safety delay for auth claim propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      await refreshProfile();
      setShowAccount(false);
      setShowChoirManager(false);
      // Show name entry modal so admin can set proper "Прізвище Ім'я"
      setJoinLastName('');
      setJoinFirstName('');
      setShowFinishAppRegistration(true);
      router.replace('/app');
    } catch (e: any) {
      console.error("Error creating choir:", e);
      setManagerError(t("manager.error_create_choir_prefix") + " " + (e.message || t("manager.error_unknown")));
    } finally {
      setManagerLoading(false);
    }
  };



  const handleJoinChoir = async () => {
    if (!user || !joinCode || joinCode.length !== 6) return;
    setManagerLoading(true);

    const hasNameInput = joinLastName.trim() || joinFirstName.trim();

    if (hasNameInput) {
      // Save name to user profile BEFORE joining
      const fullName = [joinLastName.trim(), joinFirstName.trim()].filter(Boolean).join(" ");
      try {
        await createUser(user.uid, { name: fullName });
      } catch (e) {
        console.warn("Failed to save name before join:", e);
      }
    }

    try {
      const result = await joinChoir(joinCode);
      console.log("Joined result:", result);
      await refreshProfile();

      // If already a member, just switch to that choir
      if (result?.message === "Already a member" && result?.choirId) {
        await createUser(user.uid, { choirId: result.choirId });
        await refreshProfile();
        setShowAccount(false);
        setShowChoirManager(false);
        setJoinCode(""); setJoinLastName(""); setJoinFirstName("");
        router.replace('/app');
        return;
      }

      // Use allMembers (includes linked members) for name matching
      const allMembers = result?.allMembers || [];
      console.log("All members:", allMembers.length);

      // Backend already switched active choir — just need to handle member matching & reload

      if (allMembers.length > 0 && result?.choirId) {
        const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
        const providedName = hasNameInput ? [joinLastName.trim(), joinFirstName.trim()].filter(Boolean).join(" ") : (userData?.name || "");

        let matchedMember = null;
        if (providedName && providedName !== "User") {
          const enteredNameNorm = normalize(providedName);
          const enteredNameReversed = normalize(providedName.split(' ').reverse().join(' '));

          matchedMember = allMembers.find((m: any) => {
            if (!m.name) return false;
            const mName = normalize(m.name);
            const distNormal = distance(mName, enteredNameNorm);
            const distReversed = distance(mName, enteredNameReversed);
            return distNormal <= 2 || distReversed <= 2;
          });
        }

        if (matchedMember) {
          console.log("Showing claim modal for:", matchedMember.name);
          setClaimMembers([matchedMember]);
          setClaimChoirId(result.choirId);
          setSelectedClaimId(matchedMember.id);
          setShowAccount(false);
          setShowChoirManager(false);
          setShowClaimModal(true);
        } else {
          if (hasNameInput) {
            await updateMember(result.choirId, user.uid, { name: [joinLastName.trim(), joinFirstName.trim()].filter(Boolean).join(" ") });
          }
          setShowAccount(false);
          setShowChoirManager(false);
          router.replace('/app');
        }
      } else if (result?.choirId) {
        if (hasNameInput) {
          await updateMember(result.choirId, user.uid, { name: [joinLastName.trim(), joinFirstName.trim()].filter(Boolean).join(" ") });
        }
        setShowAccount(false);
        setShowChoirManager(false);
        router.replace('/app');
      } else {
        setShowAccount(false);
        setShowChoirManager(false);
      }
    } catch (e: any) {
      console.error(e);
      const msg = e.message || t("manager.error_join");
      if (msg.includes("Invalid invite code")) {
        setManagerError(t("manager.error_invalid_code"));
      } else if (msg.includes("Already a member")) {
        setManagerError(t("manager.error_already_member"));
      } else {
        setManagerError(t("manager.error_join"));
      }
    } finally {
      setManagerLoading(false);
    }
  };

  const handleClaimMember = async (targetMemberId: string) => {
    if (!claimChoirId || !user) return;
    setClaimLoading(true);
    try {
      const result = await claimMember(claimChoirId, targetMemberId);
      console.log("Claimed:", result);

      // Switch active choir to the claimed one and reload
      await createUser(user.uid, { choirId: claimChoirId });
      await refreshProfile();

      // Clear form state
      setShowClaimModal(false);
      setClaimMembers([]);
      setJoinCode("");
      setJoinLastName("");
      setJoinFirstName("");
      setManagerError("");

      setClaimChoirId(null);
      router.replace('/app');
    } catch (e: any) {
      console.error("Claim error:", e);
      const msg = e.message || "";
      if (msg.includes("already has an account") || msg.includes("already claimed")) {
        await Dialog.alert({ title: t("common.error"), message: t("manager.error_already_linked_to_other") });
      } else if (msg.includes("already linked")) {
        await Dialog.alert({ title: t("common.error"), message: t("manager.error_account_already_linked") });
      } else {
        await Dialog.alert({ title: t("common.error"), message: t("manager.error_link_prefix") + " " + msg });
      }
    } finally {
      setClaimLoading(false);
    }
  };

  const createAdminCode = async () => {
    if (!choir || !userData?.choirId || selectedPermissions.length === 0) return;

    setCreatingAdminCode(true);
    try {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newAdminCode: AdminCode = {
        code: newCode,
        permissions: selectedPermissions,
        label: newAdminLabel.trim() || undefined,
      };

      const updatedAdminCodes = [...(choir.adminCodes || []), newAdminCode];

      const choirRef = doc(db, "choirs", userData.choirId);
      await updateDoc(choirRef, { adminCodes: updatedAdminCodes });

      setChoir({ ...choir, adminCodes: updatedAdminCodes });
      setShowAdminCodeModal(false);
      setNewAdminLabel("");
      setSelectedPermissions([]);

      // Copy new code to clipboard
      copyCode(newCode);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingAdminCode(false);
    }
  };

  const togglePermission = (perm: Permission) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSaveName = async () => {
    if (!newFirstName.trim() || !newLastName.trim() || !user) return;
    const finalName = `${newLastName.trim()} ${newFirstName.trim()}`;
    const oldName = userData?.name;
    setSavingName(true);
    try {
      // 1. Update User Profile
      await createUser(user.uid, { name: finalName });
      await refreshProfile();

      // 2. Update Choir Data if applicable
      if (userData?.choirId && choir) {
        // Safely update my own name in the members array via Cloud Function
        await updateMember(userData.choirId, user.uid, { name: finalName });

        // If I am a regent, update the regents list (requires admin)
        if (oldName && choir.regents?.includes(oldName)) {
          const updatedRegents = choir.regents.map((r: string) => r === oldName ? finalName : r);
          try {
            const { doc, updateDoc } = await import("firebase/firestore");
            const choirRef = doc(db, "choirs", userData.choirId);
            await updateDoc(choirRef, { regents: updatedRegents });
          } catch (e) {
            console.error("Failed to update regents array:", e);
          }
        }
      }

      await refreshProfile();
      setShowEditName(false);
      setNewFirstName("");
      setNewLastName("");
    } catch (err) {
      console.error("Failed to update name:", err);
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveMember = async (member: ChoirMember) => {
    if (!choir || !userData?.choirId) return;

    try {
      // Updates: name, voice, role...
      // member object contains updated fields.
      // We extract what we want to update.
      const updates: Record<string, any> = {
        name: member.name,
        role: member.role,
        roleLabel: member.roleLabel || null,
        voice: member.voice || null,
        isDuplicate: false // Always clear isDuplicate when admin explicitly saves
      };

      // Generate a deduplicated list of current members (just in case)
      const dedupedCurrent = Array.from(new Map((choir.members || []).map(m => [m.id, m])).values());
      const existingIndex = dedupedCurrent.findIndex(m => m.id === member.id);

      let updatedMembers = [...dedupedCurrent];

      if (existingIndex >= 0) {
        // Updating existing member — clear isDuplicate so it becomes visible
        const updated = { ...updatedMembers[existingIndex], ...member };
        delete (updated as any).isDuplicate;
        updatedMembers[existingIndex] = updated;
        await updateMember(userData.choirId, member.id, updates);
        setChoir({ ...choir, members: updatedMembers });
      } else {
        // Adding new manual member — ensure no isDuplicate flag
        const cleanMember: Record<string, any> = { ...member };
        delete cleanMember.isDuplicate;
        if (cleanMember.voice === undefined) {
          delete cleanMember.voice;
        }
        updatedMembers.push(cleanMember as ChoirMember);
        await updateChoirMembers(userData.choirId, updatedMembers);
        setChoir({ ...choir, members: updatedMembers });
      }

      setShowEditMemberModal(false);
    } catch (e) {
      console.error(e);
      setManagerError(t("manager.error_save"));
    }
  };

  const handleMerge = async (targetMemberId: string) => {
    if (!choir || !userData?.choirId || !mergingMember) return;

    try {
      await mergeMembers(userData.choirId, mergingMember.id, targetMemberId);

      // Update local state: remove source, transfer account data to target
      const fromMember = (choir.members || []).find(m => m.id === mergingMember.id);
      const updatedMembers = (choir.members || [])
        .filter(m => m.id !== mergingMember.id)
        .map(m => {
          if (m.id === targetMemberId && fromMember?.hasAccount) {
            return {
              ...m,
              hasAccount: true,
              accountUid: (m as any).accountUid || m.id,
              linkedUserIds: [...(m.linkedUserIds || []), ...new Set([fromMember.id, (fromMember as any).accountUid].filter(Boolean))]
            };
          }
          return m;
        });
      setChoir({ ...choir, members: updatedMembers });

      setMergingMember(null);
      // Optionally reload services to refresh attendance counts, but not strictly necessary for UI list
      // await fetchChoirData(); // Listener handles updates 
    } catch (e) {
      console.error(e);
      await Dialog.alert({ title: t("common.error"), message: t("manager.error_merge_members") });
    }
  };

  const handleLinkAppUser = async (targetMemberId: string) => {
    if (!choir || !userData?.choirId || !linkingAppUser) return;

    try {
      const targetMember = (choir.members || []).find(m => m.id === targetMemberId);

      if (targetMember?.hasAccount) {
        // Member already linked to another account — migrate attendance
        // and save this UID to linkedUserIds on the member
        await mergeMembers(userData.choirId, linkingAppUser.id, targetMemberId);

        // Persist linked UID on the member record
        const updatedMembers = (choir.members || []).map(m => {
          if (m.id === targetMemberId) {
            const existing = m.linkedUserIds || [];
            if (!existing.includes(linkingAppUser.id)) {
              return { ...m, linkedUserIds: [...existing, linkingAppUser.id] };
            }
          }
          return m;
        });
        await updateChoirMembers(userData.choirId, updatedMembers);
        setChoir({ ...choir, members: updatedMembers });
      } else {
        // First link — update the member's ID to this app user's UID
        const updatedMembers = (choir.members || []).map(m => {
          if (m.id === targetMemberId) {
            return { ...m, id: linkingAppUser.id, hasAccount: true };
          }
          return m;
        });

        // Remove any duplicate entry with the same UID
        const deduped = updatedMembers.filter((m, i) => {
          return updatedMembers.findIndex(x => x.id === m.id) === i;
        });

        await updateChoirMembers(userData.choirId, deduped);

        // Migrate attendance from old member ID to new UID
        await mergeMembers(userData.choirId, targetMemberId, linkingAppUser.id);

        setChoir({ ...choir, members: deduped });
      }

      setLinkingAppUser(null);
    } catch (e) {
      console.error(e);
      await Dialog.alert({ title: t("common.error"), message: t("manager.error_link_user") });
    }
  };

  const handleLinkAsNewMember = async (sourceMember: ChoirMember) => {
    if (!choir || !userData?.choirId || !linkingAppUser) return;

    // By opening EditMemberModal, we force the user to type Name & Surname.
    // When saved, handleSaveMember natively prevents duplicates and pushes cleanly.
    setEditingMember({
      id: linkingAppUser.id,
      name: linkingAppUser.name || "",
      role: 'member',
      hasAccount: true
    });
    setLinkingAppUser(null);
    setShowEditMemberModal(true);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!choir || !userData?.choirId) return;
    const memberToRemove = choir.members?.find(m => m.id === memberId);

    // Don't allow removing yourself
    if (memberId === user?.uid || (memberToRemove?.linkedUserIds || []).includes(user?.uid || "") || (memberToRemove as any)?.accountUid === user?.uid) {
      console.warn("User attempted to remove themselves.");
      return;
    }

    const updatedMembers = (choir.members || []).filter(m => m.id !== memberId);

    try {
      await updateChoirMembers(userData.choirId, updatedMembers);
      setChoir({ ...choir, members: updatedMembers });
      setShowEditMemberModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      // Cloud Function handles both Firestore cleanup and Auth deletion
      await deleteMyAccount();
      // Explicitly redirect and clean up state
      setShowDeleteModal(false);
      try {
        router.push("/");
      } catch (e) {
        window.location.href = "/";
      }
    } catch (error: any) {
      console.error("Delete Account Error:", error);
      setManagerError(error.message || t("manager.error_delete_account"));
    }
  };

  // Count absences for a member across all services using new O(1) stats summary
  const getAbsenceCount = (memberId: string): number => {
    // If stats are available from backend, use them for accurate historical data
    if (globalStats?.memberStats?.[memberId]) {
      return globalStats.memberStats[memberId].absentCount;
    }
    // Fallback to active services if stats aren't generated yet
    return services.filter(s => s.absentMembers?.includes(memberId)).length;
  };

  // Check if user can edit - either by role OR specific permissions from admin codes
  const hasManagePermission = userData?.permissions?.some(p =>
    ['add_songs', 'edit_attendance', 'edit_credits', 'manage_services'].includes(p)
  ) ?? false;
  // Bug fix: canEdit should strictly mean full admin (Head/Regent). 
  // Custom permissions are handled via canAddSongs, etc.
  const canEdit = userData?.role === 'head' || userData?.role === 'regent';

  // More granular permissions
  const canAddSongs = canEdit || (userData?.permissions?.includes('add_songs') ?? false);
  const canEditAttendance = canEdit || (userData?.permissions?.includes('edit_attendance') ?? false);
  const canEditCredits = canEdit || (userData?.permissions?.includes('edit_credits') ?? false);
  const canManageServices = canEdit || (userData?.permissions?.includes('manage_services') ?? false);

  // Handle choir icon upload
  const handleIconUpload = async () => {
    if (!userData?.choirId || !canEdit) return;

    try {
      let file: File | null = null;

      if (Capacitor.isNativePlatform()) {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

        const image = await Camera.getPhoto({
          quality: 80,
          allowEditing: true,
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos
        });

        if (image.webPath) {
          console.log('[Icon Upload] Got image webPath:', image.webPath);
          setUploadingIcon(true);
          const response = await fetch(image.webPath);
          const blob = await response.blob();
          console.log('[Icon Upload] Blob size:', blob.size, 'type:', blob.type);
          file = new File([blob], "icon.jpg", { type: "image/jpeg" });
        }
      } else {
        // Fallback for web: dynamically create and click an input
        file = await new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = (e: any) => resolve(e.target.files?.[0] || null);
          input.click();
        });
      }

      if (!file) { setUploadingIcon(false); return; }

      setUploadingIcon(true);
      console.log('[Icon Upload] Uploading file, size:', file.size);
      const url = await uploadChoirIcon(userData.choirId, file);
      console.log('[Icon Upload] Upload complete, URL:', url);
      // Add cache-busting param so the browser doesn't serve the old cached image
      const cacheBustedUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
      setChoir(prev => prev ? { ...prev, icon: cacheBustedUrl } : null);
    } catch (err) {
      console.error("[Icon Upload] Failed:", err);
    } finally {
      setUploadingIcon(false);
    }
  };

  // Sync Native FAB Visibility
  useEffect(() => {
    if (!isNative || typeof window === 'undefined') return;
    try {
      if ((window as any).webkit?.messageHandlers?.fabVisibility) {
        // Only regents and heads should see the native FAB
        (window as any).webkit.messageHandlers.fabVisibility.postMessage(canEdit ? 'show' : 'hide');
      }
    } catch (e) {
      console.warn("Error sending fabVisibility message", e);
    }
  }, [isNative, canEdit, activeTab]);

  // As requested, return null immediately for fastest possible transition without a skeleton
  if (!isAppReady) {
    return null;
  }


  // Show Statistics
  if (showStats && choir) {
    return (
      <StatisticsView
        choir={choir}
        onBack={() => setShowStats(false)}
      />
    );
  }

  // Temporary helper to fix permissions


  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; className: string }> = {
      head: { label: t("global.roles.regent"), className: "bg-primary/10 text-primary border border-primary/20" },
      regent: { label: t("global.roles.regent"), className: "bg-primary/10 text-primary border border-primary/20" },
      member: { label: t("global.roles.member"), className: "bg-surface-highlight text-text-secondary border border-border" },
    };
    if (role === 'member') return null;
    const config = roleConfig[role] || roleConfig.member;
    return (
      <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getVoiceBadge = (voice?: string) => {
    if (!voice) return null;
    const config: Record<string, string> = {
      Soprano: "text-pink-400 border-pink-500/20",
      Alto: "text-purple-400 border-purple-500/20",
      Tenor: "text-blue-400 border-blue-500/20",
      Bass: "text-green-400 border-green-500/20",
    };

    const style = config[voice] || "text-gray-400 border-white/10";
    const label = voice === 'Soprano' ? 'S' : voice === 'Alto' ? 'A' : voice === 'Tenor' ? 'T' : 'B';

    return (
      <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${style}`}>
        {label}
      </div>
    );
  };

  if (authLoading) {
    // Return null entirely on native to avoid any flash of the web preloader. 
    // The native Capacitor Splash Screen is covering the screen during this time.
    if (Capacitor.isNativePlatform() || (typeof window !== 'undefined' && window.location.protocol === 'capacitor:')) {
      return null;
    }
    return <Preloader />;
  }

  // If viewing a specific service, render ServiceView full screen
  if (selectedService) {
    return (
      <main className="min-h-screen bg-background selection:bg-white/30">
        <ServiceView
          service={selectedService}
          onBack={() => handleSelectService(null)}
          canEdit={canEdit}
          canEditCredits={canEditCredits}
          canEditAttendance={canEditAttendance}
          choir={choir}
          isNativeApp={isNative}
        />
      </main>
    );
  }

  return (
    <main className={`min-h-screen font-[family-name:var(--font-geist-sans)] 
            ${isGuest ? 'guest-mode' : ''} selection:bg-teal-500/30`}>




      <InstallPrompt />

      {/* Choir Switching Overlay */}
      <AnimatePresence>
        {isSwitchingChoir && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          >
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h2 className="text-xl font-bold text-text-primary mb-2">{t('account.switching_choir')}</h2>
            <p className="text-sm text-text-secondary text-center">{t('account.please_wait')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { e.stopPropagation(); setShowLogoutConfirm(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#18181b] w-full max-w-xs p-6 rounded-3xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 bg-[#27272a] rounded-full flex items-center justify-center">
                  <LogOut className="w-6 h-6 text-[#a1a1aa]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t('account.logout_confirm')}</h3>
                  <p className="text-[#a1a1aa] text-sm mt-1">
                    {t("account.logout_warning")}
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-3 border border-white/10 rounded-xl text-white hover:bg-[#27272a] transition-colors font-medium text-sm"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-100 transition-colors text-sm"
                  >
                    {t("account.logout")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Choir Settings Modal */}
      <AnimatePresence>
        {showChoirSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface card-shadow w-full max-w-sm p-6 rounded-3xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-text-primary">{t('account.choir_settings')}</h3>
                <button
                  onClick={() => setShowChoirSettings(false)}
                  className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-highlight rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Choir Icon */}
              <div className="flex flex-col items-center mb-6">
                <button
                  onClick={handleIconUpload}
                  disabled={uploadingIcon}
                  className="w-24 h-24 bg-surface-highlight rounded-2xl flex items-center justify-center border border-border overflow-hidden relative group cursor-pointer hover:border-primary/30 transition-colors"
                >
                  {choir?.icon ? (
                    <img src={choir.icon} alt="Choir" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl text-text-primary font-bold">{choir?.name?.[0]?.toUpperCase() || "C"}</span>
                  )}
                  {uploadingIcon ? (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-7 h-7 text-white animate-spin" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  )}
                </button>
                <p className="text-text-secondary text-xs mt-2">{uploadingIcon ? t('common.loading') : t('account.change_photo')}</p>
                {choir?.icon && !uploadingIcon && (
                  <button
                    onClick={async () => {
                      if (!userData?.choirId) return;
                      const confirmed = await Dialog.confirm({
                        title: t('account.delete_photo_title'),
                        message: t('account.delete_photo_confirm'),
                        okButtonTitle: t('common.delete'),
                        cancelButtonTitle: t('common.cancel')
                      });
                      if (!confirmed.value) return;

                      try {
                        // Cast to any to bypass Partial<Choir> strict typing for null
                        await updateChoir(userData.choirId, { icon: null } as any);
                        setChoir(prev => prev ? { ...prev, icon: undefined } : null);
                      } catch (err) {
                        console.error("Failed to delete choir icon:", err);
                      }
                    }}
                    className="mt-3 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("account.delete_photo")}
                  </button>
                )}
              </div>

              {/* Choir Name */}
              <div className="mb-6">
                <label className="text-text-secondary text-sm mb-2 block">{t('account.choir_name')}</label>
                <input
                  type="text"
                  value={editChoirName}
                  onChange={(e) => setEditChoirName(e.target.value)}
                  placeholder={t("account.choir_name")}
                  className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary/50"
                />
              </div>

              {/* Save Button */}
              <div className="mt-8 pt-2 border-t border-border/10">
                <button
                  onClick={async () => {
                    if (!userData?.choirId || !editChoirName.trim()) return;
                    setSavingChoirSettings(true);
                    try {
                      await updateChoir(userData.choirId, { name: editChoirName.trim() });
                      
                      if (user?.uid) {
                        const { doc, getDoc, updateDoc, getFirestore } = await import("firebase/firestore");
                        const { app } = await import("@/lib/firebase");
                        const db = getFirestore(app);
                        const userRef = doc(db, "users", user.uid);
                        const userDocSize = await getDoc(userRef);

                        if (userDocSize.exists()) {
                          const data = userDocSize.data();
                          const profileUpdates: any = {};

                          if (data.choirId === userData.choirId) {
                            profileUpdates.choirName = editChoirName.trim();
                          }

                          if (Object.keys(profileUpdates).length > 0) {
                            await updateDoc(userRef, profileUpdates);
                            console.log("[Choir Settings] Synced choirName to profile");
                          }
                        }
                      }

                      // Force immediate local update for both header and sidebar
                      setChoir(prev => prev ? { ...prev, name: editChoirName.trim() } : null);
                      await refreshProfile();
                      
                      setShowChoirSettings(false);
                    } catch (err) {
                      console.error("Failed to update choir:", err);
                    } finally {
                      setSavingChoirSettings(false);
                    }
                  }}
                  disabled={savingChoirSettings || !editChoirName.trim()}
                  className="w-full py-4 bg-primary text-background rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {savingChoirSettings && <Loader2 className="w-5 h-5 animate-spin" />}
                  {t("common.save_changes")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Choir Manager Modal */}
      <AnimatePresence>
        {showChoirManager && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 100 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface card-shadow w-full max-w-sm p-6 rounded-3xl shadow-2xl overflow-hidden relative"
            >
              <button onClick={() => { setShowChoirManager(false); setManagerMode('list'); setManagerError(""); }} className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>

              {managerMode === 'list' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-text-primary text-center mb-6">{t('account.my_choirs')}</h3>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    <div className="p-4 rounded-2xl bg-success/10 border border-success/30 flex items-center justify-between">
                      <div>
                        <p className="text-text-primary font-bold">{userData?.choirName}</p>
                        <p className="text-xs text-success font-medium tracking-wide">{t('account.current')}</p>
                      </div>
                      <Check className="w-5 h-5 text-success" />
                    </div>

                    {userData?.memberships?.filter(m => m.choirId !== userData.choirId).map(m => (
                      <div key={m.choirId} className="flex gap-2">
                        <button
                          onClick={() => handleSwitchChoir(m)}
                          className="flex-1 p-4 rounded-2xl bg-surface-highlight border border-border hover:bg-surface-highlight/80 flex items-center justify-between transition-all group"
                        >
                          <div className="text-left">
                            <p className="text-text-primary font-bold">{m.choirName}</p>
                            <p className="text-xs text-text-secondary uppercase">{m.role === 'head' ? t('global.roles.regent') : m.role === 'regent' ? t('global.roles.regent') : t('global.roles.member')}</p>
                          </div>
                          <Repeat className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
                        </button>
                        <button
                          onClick={() => setChoirToLeave({ id: m.choirId, name: m.choirName })}
                          className="p-4 rounded-2xl bg-surface-highlight border border-border hover:bg-red-500/10 hover:border-red-500/30 flex items-center justify-center transition-all group/delete"
                          title={t("account.leave_choir")}
                        >
                          <LogOut className="w-5 h-5 text-text-secondary group-hover/delete:text-red-500 transition-colors" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <button onClick={() => setManagerMode('create')} className="p-3 bg-primary text-background rounded-xl text-sm font-bold hover:opacity-90">
                      {t("manager.create")}
                    </button>
                    <button onClick={() => {
                      setManagerMode('join');
                      // Auto-fill name from profile if available
                      if (userData?.name && userData.name.includes(' ')) {
                        const parts = userData.name.split(' ');
                        setJoinLastName(parts[0]);
                        setJoinFirstName(parts.slice(1).join(' '));
                      }
                    }} className="p-3 bg-surface-highlight text-text-primary rounded-xl text-sm font-bold hover:bg-surface-highlight/80 border border-border">
                      {t("manager.join")}
                    </button>
                  </div>
                </div>
              )}

              {managerMode === 'create' && (
                <div className="space-y-4">
                  <button onClick={() => setManagerMode('list')} className="text-xs text-text-secondary hover:text-text-primary mb-2">{t("common.back_arrow")}</button>
                  <h3 className="text-xl font-bold text-text-primary">{t('account.new_choir')}</h3>
                  <input
                    value={newChoirName}
                    onChange={e => setNewChoirName(e.target.value)}
                    placeholder={t("account.choir_name")}
                    className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl placeholder:text-text-secondary"
                  />
                  <div className="space-y-2">
                    <p className="text-xs text-text-secondary uppercase font-bold tracking-wider">{t('account.choir_type')}</p>
                    <button
                      type="button"
                      onClick={() => setNewChoirType('msc')}
                      className={`w-full p-3 rounded-xl text-left transition-all border text-sm ${newChoirType === 'msc' ? 'bg-primary/10 border-primary' : 'bg-surface-highlight border-border'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${newChoirType === 'msc' ? 'border-primary' : 'border-text-secondary/40'}`}>
                          {newChoirType === 'msc' && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <p className="font-bold text-text-primary">{t('account.choir_msc')}</p>
                          <p className="text-xs text-text-secondary">{t('account.choir_msc_desc')}</p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewChoirType('standard')}
                      className={`w-full p-3 rounded-xl text-left transition-all border text-sm ${newChoirType === 'standard' ? 'bg-primary/10 border-primary' : 'bg-surface-highlight border-border'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${newChoirType === 'standard' ? 'border-primary' : 'border-text-secondary/40'}`}>
                          {newChoirType === 'standard' && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <p className="font-bold text-text-primary">{t('account.choir_regular')}</p>
                          <p className="text-xs text-text-secondary">{t('account.choir_regular_desc')}</p>
                        </div>
                      </div>
                    </button>
                  </div>
                  <button
                    onClick={handleCreateChoir}
                    disabled={managerLoading || !newChoirName.trim() || !newChoirType}
                    className="w-full p-3 bg-primary text-background rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {managerLoading ? <Loader2 className="animate-spin mx-auto" /> : t("manager.create")}
                  </button>
                </div>
              )}

              {managerMode === 'join' && (
                <div className="space-y-4">
                  <button onClick={() => { setManagerMode('list'); setManagerError(""); }} className="text-xs text-text-secondary hover:text-text-primary mb-2">{t("common.back_arrow")}</button>
                  <h3 className="text-xl font-bold text-text-primary">{t('account.join')}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-text-secondary uppercase font-bold tracking-wider mb-1 block">{t('account.last_name')}</label>
                      <input
                        value={joinLastName}
                        onChange={e => setJoinLastName(e.target.value)}
                        placeholder={t("manager.last_name_optional")}
                        className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl placeholder:text-text-secondary"
                        autoCapitalize="words"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-secondary uppercase font-bold tracking-wider mb-1 block">{t('account.first_name')}</label>
                      <input
                        value={joinFirstName}
                        onChange={e => setJoinFirstName(e.target.value)}
                        placeholder={t("manager.first_name_optional")}
                        className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl placeholder:text-text-secondary"
                        autoCapitalize="words"
                      />
                    </div>
                  </div>
                  <input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder={t("manager.code_placeholder")}
                    maxLength={6}
                    className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl text-center font-mono uppercase tracking-widest placeholder:text-text-secondary"
                  />
                  {managerError && <p className="text-red-400 text-xs">{managerError}</p>}
                  <button
                    onClick={handleJoinChoir}
                    disabled={managerLoading || joinCode.length !== 6}
                    className="w-full p-3 bg-primary text-background rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {managerLoading ? <Loader2 className="animate-spin mx-auto" /> : t('global.actions.join')}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit/Add Member Modal */}
      {/* Edit/Add Member Modal */}
      {showEditMemberModal && (
        <EditMemberModal
          isOpen={showEditMemberModal}
          onClose={() => setShowEditMemberModal(false)}
          member={editingMember}
          onSave={handleSaveMember}
          onDelete={(editingMember?.id === user?.uid || (editingMember?.linkedUserIds || []).includes(user?.uid || "") || (editingMember as any)?.accountUid === user?.uid) ? undefined : handleRemoveMember}
          onMergeClick={(member) => {
            setEditingMember(null);
            setShowEditMemberModal(false);
            setMergingMember(member);
          }}
        />
      )}

      {/* Merge Member Modal */}
      {mergingMember && choir?.members && (
        <MergeMemberModal
          isOpen={!!mergingMember}
          onClose={() => setMergingMember(null)}
          sourceMember={mergingMember}
          allMembers={choir.members}
          onMerge={handleMerge}
        />
      )}

      {/* Link App User Modal */}
      {linkingAppUser && choir?.members && (
        <MergeMemberModal
          isOpen={!!linkingAppUser}
          onClose={() => setLinkingAppUser(null)}
          sourceMember={{ id: linkingAppUser.id, name: linkingAppUser.name || 'App User', role: 'member' } as ChoirMember}
          allMembers={choir.members}
          onMerge={handleLinkAppUser}
          onCreateNew={handleLinkAsNewMember}
          mode="link"
        />
      )}

      {/* Member Stats Modal */}
      {viewingMemberStats && (
        <MemberStatsModal
          member={viewingMemberStats}
          services={services} // Legacy, but kept for compatibility
          choirId={userData?.choirId || ''}
          globalStats={globalStats} // Pass new generic stats structure
          onClose={() => setViewingMemberStats(null)}
        />
      )}

      {/* Claim Member Modal */}
      <AnimatePresence>
        {showClaimModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface card-shadow w-full max-w-sm p-6 rounded-3xl shadow-2xl overflow-hidden relative"
            >
              <h3 className="text-xl font-bold text-text-primary mb-2">{t('account.is_this_you')}</h3>
              <p className="text-sm text-text-secondary mb-2">
                Ми знайшли дуже схоже ім'я в списку хору.
              </p>
              <p className="text-xs text-text-secondary/60 mb-4">
                Зв'яжіть свій акаунт із цим профілем, щоб зберегти вашу історію відвідувань та партію.
              </p>

              <div className="max-h-64 overflow-y-auto space-y-2 mb-4 pr-1 custom-scrollbar">
                {claimMembers.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedClaimId(m.id)}
                    disabled={claimLoading}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${selectedClaimId === m.id
                      ? 'bg-primary/20 border-primary'
                      : 'bg-surface-highlight border-transparent hover:bg-primary/10'
                      }`}
                  >
                    <div>
                      <span className="text-text-primary font-medium">{m.name}</span>
                      {m.voice && (
                        <span className="ml-2 text-xs text-text-secondary">({m.voice})</span>
                      )}
                      {m.hasAccount && (
                        <span className="ml-2 text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded-md">{t('account.already_linked')}</span>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${selectedClaimId === m.id ? 'bg-primary text-background' : 'bg-white/10'
                      }`}>
                      {selectedClaimId === m.id && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                ))}
              </div>

              {/* Note about already-claimed members */}
              {claimMembers.some((m: any) => m.hasAccount) && (
                <p className="text-[11px] text-text-secondary mb-3 px-1 leading-relaxed">
                  Якщо ваше ім'я позначене «вже має акаунт», зверніться до регента для переприв'язки.
                </p>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => selectedClaimId && handleClaimMember(selectedClaimId)}
                  disabled={claimLoading || !selectedClaimId}
                  className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-all flex justify-center shadow-lg disabled:opacity-50"
                >
                  {claimLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t("account.claim_yes")}
                </button>
                <button
                  onClick={() => {
                    setShowClaimModal(false);
                    setClaimMembers([]);
                    setClaimChoirId(null);
                    setSelectedClaimId(null);
                  }}
                  disabled={claimLoading}
                  className="w-full py-3 text-sm text-text-secondary hover:text-text-primary border border-border bg-surface-highlight hover:bg-white/5 rounded-xl transition-colors"
                >
                  Ні, я новий учасник
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Finish Registration Modal */}
      <AnimatePresence>
        {showFinishAppRegistration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface card-shadow border border-white/10 w-full max-w-sm p-6 rounded-3xl shadow-2xl relative"
            >
              <button
                onClick={() => setShowFinishAppRegistration(false)}
                className="absolute right-4 top-4 p-2 text-text-secondary hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors"
                disabled={claimLoading}
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl font-bold text-text-primary mb-2">{t('account.your_profile')}</h3>
              <p className="text-sm text-text-secondary mb-6">
                Якщо хочете, додайте ваше ім'я — це допоможе регенту впізнати вас у хорі. Поля необов'язкові та можна пропустити.
              </p>

              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary ml-1">{t('account.last_name')}</label>
                    <input
                      value={joinLastName}
                      onChange={e => setJoinLastName(e.target.value)}
                      placeholder="Прізвище (необов'язково)"
                      className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl placeholder:text-text-secondary"
                      autoCapitalize="words"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary ml-1">{t('account.first_name')}</label>
                    <input
                      value={joinFirstName}
                      onChange={e => setJoinFirstName(e.target.value)}
                      placeholder="Ім'я (необов'язково)"
                      className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl placeholder:text-text-secondary"
                      autoCapitalize="words"
                    />
                  </div>
                </div>

                {managerError && <p className="text-red-400 text-xs">{managerError}</p>}

                <button
                  onClick={handleFinishAppRegistration}
                  disabled={claimLoading}
                  className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-all flex justify-center shadow-lg disabled:opacity-50"
                >
                  {claimLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t("common.continue")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account Overlay */}
      <AnimatePresence>
        {showAccount && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-background overflow-y-auto"
            style={{ background: 'var(--background)', zIndex: 90 }}
            data-native-inner="true"
          >
            <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
              <div className="pointer-events-auto">
                <GlassPageHeader
                  title={t('layout.account')}
                  onBack={() => setShowAccount(false)}
                  isActive={showAccount}
                  rightSegmented={{
                    items: ["sun.max", "moon", "desktopcomputer"],
                    active: theme === "light" ? 0 : theme === "dark" ? 1 : 2,
                    onChange: (index) => {
                      if (index === 0) setTheme("light");
                      else if (index === 1) setTheme("dark");
                      else setTheme("system");
                    }
                  }}
                />
              </div>
            </div>

            <div className="md:max-w-3xl lg:max-w-4xl mx-auto w-full min-h-full flex flex-col p-6 pb-safe pt-[calc(56px+env(safe-area-inset-top)+24px)]">
              <div className="space-y-6 flex-1">
                {/* Profile Card */}
                <div className="bg-surface rounded-2xl p-6 flex items-center gap-5 card-shadow">
                  <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center text-xl font-bold shadow-lg overflow-hidden">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{getFirstNameInitial(userData?.name) || "U"}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-text-primary">{userData?.name}</h3>
                      <button
                        onClick={() => {
                          const parts = userData?.name?.split(" ") || [];
                          setNewLastName(parts[0] || "");
                          setNewFirstName(parts.slice(1).join(" ") || "");
                          setShowEditName(true);
                        }}
                        className="p-1.5 rounded-full hover:bg-surface-highlight transition-colors text-text-secondary hover:text-text-primary"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-text-secondary">{user?.email}</p>
                    <p className="text-xs text-text-secondary/50 mt-0.5">{userData?.choirName}</p>
                    <div className="mt-2">{getRoleBadge(userData?.role || 'member')}</div>
                  </div>
                </div>

                {/* Profile Banner */}
                {!dismissedProfileBanner && isUserUnlinked && (
                  <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 relative">
                    <button
                      onClick={() => setDismissedProfileBanner(true)}
                      className="absolute top-2 right-2 p-1.5 text-text-secondary hover:text-text-primary rounded-full hover:bg-white/5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="flex-1 pr-6">
                      <h4 className="font-bold text-text-primary mb-1 text-sm">{t('account.whats_your_name')}</h4>
                      <p className="text-xs text-text-secondary leading-relaxed mb-3">
                        Додайте ім'я, щоб регенти бачили вас у статистиці відвідувань.
                      </p>
                      <button
                        onClick={openClaimFromBanner}
                        className="py-2 px-4 bg-primary text-background text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
                      >
                        {t('account.set_name')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Old Language Settings Removed */}


              {/* -- SETTINGS LIST (FLAT LAYOUT) -- */}
              <div className="mt-8 flex flex-col">
                
                {/* 1. General Settings */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 px-2">{t('account.settings' as any, { defaultValue: 'Налаштування' })}</h3>
                  <div className="flex flex-col border-t border-border">
                    {/* Language Settings */}
                    <button 
                      onClick={() => setShowLanguagePicker(true)}
                      className="w-full flex items-center justify-between py-4 px-2 hover:bg-white/5 transition-colors border-b border-border group"
                    >
                      <div className="flex items-center gap-4">
                        <Globe className="w-5 h-5 text-text-secondary" />
                        <div className="text-left flex flex-col items-start">
                          <p className="text-text-primary font-medium text-base">{t('account.language')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base text-text-secondary">
                          {language === 'uk' ? 'Українська' : language === 'ru' ? 'Русский' : language === 'en' ? 'English' : language === 'de' ? 'Deutsch' : ''}
                        </span>
                        <ChevronRight className="w-5 h-5 text-text-secondary/50 group-hover:text-text-primary transition-colors" />
                      </div>
                    </button>

                    {/* Notification Settings — inline toggle */}
                    <div className="w-full flex items-center justify-between py-4 px-2 border-b border-border">
                      <div className="flex items-center gap-4">
                        <Bell className={`w-5 h-5 ${isGranted ? 'text-green-500' : 'text-text-secondary'}`} />
                        <div className="text-left flex flex-col items-start">
                          <p className="text-text-primary font-medium text-base">Сповіщення</p>
                          {permissionStatus === 'denied' && (
                            <p className="text-xs text-amber-500">Заблоковано в налаштуваннях</p>
                          )}
                        </div>
                      </div>
                      <button
                          role="switch"
                          aria-checked={isGranted}
                          disabled={fcmLoading || (!isGranted && permissionStatus === 'denied')}
                          onClick={() => {
                            if (isGranted) unsubscribe("AccountSettings");
                            else requestPermission("AccountSettings");
                          }}
                          className={`relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${
                            isGranted ? 'bg-green-500' : 'bg-[#787880]/30'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-[27px] w-[27px] transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              isGranted ? 'translate-x-[22px]' : 'translate-x-[2px]'
                            }`}
                          />
                        </button>
                    </div>
      
                    {/* Language Picker Modal */}
                    {showLanguagePicker && (
                      <div className="relative z-[150]">
                        <div 
                          className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity flex items-center justify-center p-4" 
                          onClick={() => setShowLanguagePicker(false)}
                          data-native-inner="true"
                        >
                          <div 
                            className="bg-surface w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between p-6 pb-4">
                              <h3 className="text-[22px] font-bold text-text-primary tracking-tight">{t('account.language')}</h3>
                              <button 
                                onClick={() => setShowLanguagePicker(false)}
                                className="w-8 h-8 flex items-center justify-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-full transition-colors text-text-secondary hover:text-text-primary"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="px-6 pb-6 space-y-3">
                              {([
                                { code: 'uk', flag: '🇺🇦', label: 'Українська' },
                                { code: 'en', flag: '🇬🇧', label: 'English' },
                                { code: 'ru', flag: '🇷🇺', label: 'Русский' },
                                { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
                              ] as { code: 'uk' | 'en' | 'ru' | 'de'; flag: string; label: string }[]).map(({ code, flag, label }) => {
                                const isActive = language === code;
                                return (
                                  <button
                                    key={code}
                                    onClick={() => {
                                      changeLanguage(code);
                                      setShowLanguagePicker(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-200 active:scale-[0.98] border ${
                                      isActive
                                        ? 'bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/10 text-text-primary'
                                        : 'bg-transparent border-border hover:bg-black/5 dark:hover:bg-white/5 text-text-secondary hover:text-text-primary'
                                    }`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <span className="text-[22px] leading-none">{flag}</span>
                                      <span className={`text-[17px] ${isActive ? 'font-bold' : 'font-semibold'}`}>{label}</span>
                                    </div>
                                    {isActive && (
                                      <div className="w-6 h-6 rounded-full bg-[#1c1c1e] dark:bg-white flex items-center justify-center shadow-sm">
                                        <Check className="w-4 h-4 text-white dark:text-[#1c1c1e]" strokeWidth={3} />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2a. Choir */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 px-2">Хор</h3>
                  <div className="flex flex-col border-t border-border">
                    <button
                      onClick={() => { setManagerMode('list'); setJoinCode(''); setJoinLastName(''); setJoinFirstName(''); setManagerError(''); setShowChoirManager(true); }}
                      className="w-full flex items-center justify-between py-4 px-2 hover:bg-white/5 transition-colors border-b border-border group"
                    >
                      <div className="flex items-center gap-4">
                        <Repeat className="w-5 h-5 text-accent" />
                        <div className="text-left flex flex-col items-start">
                          <p className="text-text-primary font-medium text-base">{t('account.change_choir')}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-secondary/50 group-hover:text-text-primary transition-colors" />
                    </button>
                  </div>
                </div>

                {/* 2b. Access Codes - Admin only */}
                {(userData?.role === 'head' || userData?.role === 'regent') && choir && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-2 px-2">
                      <h3 className="text-sm font-semibold text-text-secondary">Коди доступу</h3>
                      <button
                        onClick={() => setShowAdminCodeModal(true)}
                        className="text-xs font-medium text-accent hover:opacity-80 flex items-center gap-1 transition-opacity uppercase tracking-wider"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        {t('global.actions.add') || 'Додати'}
                      </button>
                    </div>
                    <div className="flex flex-col border-t border-border">
                      <div className="flex items-center justify-between py-4 px-2 border-b border-border hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4">
                          <Users className="w-5 h-5 text-text-secondary" />
                          <span className="text-text-primary font-medium text-base">{t('account.members_code')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-text-secondary font-mono">{choir.memberCode}</span>
                          <button
                            onClick={() => copyCode(`https://mychoir.vercel.app/?code=${choir.memberCode}`)}
                            className="text-text-secondary hover:text-accent transition-colors"
                          >
                            {copiedCode === `https://mychoir.vercel.app/?code=${choir.memberCode}`
                              ? <Check className="w-5 h-5 text-success" />
                              : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-4 px-2 border-b border-border hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4">
                          <Music className="w-5 h-5 text-text-secondary" />
                          <span className="text-text-primary font-medium text-base">{t('account.regents_code')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-text-secondary font-mono">{choir.regentCode}</span>
                          <button
                            onClick={() => copyCode(`https://mychoir.vercel.app/?code=${choir.regentCode}`)}
                            className="text-text-secondary hover:text-accent transition-colors"
                          >
                            {copiedCode === `https://mychoir.vercel.app/?code=${choir.regentCode}`
                              ? <Check className="w-5 h-5 text-success" />
                              : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {choir.adminCodes && choir.adminCodes.length > 0 && (
                        <>
                          {/* Toggle row */}
                          <button
                            onClick={() => setShowAllAdminCodes(v => !v)}
                            className="w-full flex items-center justify-between py-3.5 px-2 hover:bg-white/5 transition-colors border-b border-border text-text-secondary group"
                          >
                            <span className="text-sm font-medium">
                              {showAllAdminCodes
                                ? 'Сховати кастомні ролі'
                                : `Кастомні ролі (${choir.adminCodes.length})`}
                            </span>
                            <ChevronRight
                              className={`w-4 h-4 text-text-secondary/50 transition-transform duration-200 ${
                                showAllAdminCodes ? 'rotate-90' : ''
                              }`}
                            />
                          </button>

                          {/* Collapsible custom codes */}
                          {showAllAdminCodes && choir.adminCodes.map((ac, idx) => (
                            <div key={idx} className="flex items-center justify-between py-4 px-2 border-b border-border hover:bg-white/5 transition-colors">
                              <div className="flex items-center gap-4">
                                <UserX className="w-5 h-5 text-text-secondary" />
                                <span className="text-text-primary font-medium text-base">{ac.label || t('account.admin_role')}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-text-secondary font-mono">{ac.code}</span>
                                <button
                                  onClick={() => copyCode(`https://mychoir.vercel.app/?code=${ac.code}`)}
                                  className="text-text-secondary hover:text-accent transition-colors"
                                >
                                  {copiedCode === `https://mychoir.vercel.app/?code=${ac.code}`
                                    ? <Check className="w-5 h-5 text-success" />
                                    : <Copy className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => setDeletingAdminCode(ac.code)}
                                  className="text-text-secondary/50 hover:text-danger transition-colors ml-1"
                                  title="Видалити"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Cache Management - only Native */}
                {isNative && (
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-text-secondary mb-2 px-2">{t('account.offline_cache')}</h3>
                    <div className="flex flex-col border-t border-border">
                      <div className="py-4 px-2 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-4 text-left">
                          <HardDrive className="w-5 h-5 text-text-secondary" />
                          <div className="flex flex-col items-start">
                            <span className="text-text-primary font-medium text-base">Кешовані пісні</span>
                            <span className="text-sm text-text-secondary">
                              {cacheSize.count} {t('songs.list.songs_count_plural')} • {cacheSize.sizeBytes < 1024 * 1024
                                ? `${(cacheSize.sizeBytes / 1024).toFixed(0)} КБ`
                                : `${(cacheSize.sizeBytes / 1024 / 1024).toFixed(1)} МБ`}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            setCacheClearLoading(true);
                            try {
                              const { clearAllCache, getCacheSize: getSize } = await import('@/lib/offlineDb');
                              await clearAllCache();
                              const newSize = await getSize();
                              setCacheSize(newSize);
                            } catch (e) {
                              console.error('Clear cache error:', e);
                            } finally {
                              setCacheClearLoading(false);
                            }
                          }}
                          disabled={cacheClearLoading || cacheSize.count === 0}
                          className="px-4 py-2 text-sm font-medium text-danger bg-danger/10 rounded-xl hover:bg-danger/20 transition-colors disabled:opacity-30 flex items-center gap-2"
                        >
                          {cacheClearLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Очистити
                        </button>
                      </div>

                      <div className="py-4 px-2 border-b border-border space-y-5">
                        {/* Limit slider */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-text-primary">{t('account.max_limit')}</span>
                            <span className="text-sm text-text-secondary">
                              {(() => {
                                if (cacheLimit === 'unlimited') return t('account.unlimited');
                                if (cacheLimit === '1gb') return t('account.cache_1gb');
                                if (cacheLimit === '500mb') return t('account.cache_500mb');
                                if (cacheLimit === '50mb') return t('account.cache_50mb');
                                const n = parseInt(cacheLimit, 10);
                                return !isNaN(n) ? `${n} МБ` : '100 МБ';
                              })()}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="50"
                            max="1050"
                            step="50"
                            value={(() => {
                              if (cacheLimit === 'unlimited') return 1050;
                              if (cacheLimit === '1gb') return 1000;
                              if (cacheLimit === '500mb') return 500;
                              if (cacheLimit === '50mb') return 50;
                              const n = parseInt(cacheLimit, 10);
                              return !isNaN(n) ? n : 100;
                            })()}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              const newLimit = val > 1000 ? 'unlimited' : String(val);
                              setCacheLimitState(newLimit);
                            }}
                            onPointerUp={async (e) => {
                              const val = parseInt((e.target as HTMLInputElement).value, 10);
                              const newLimit = val > 1000 ? 'unlimited' : String(val);
                              const { setCacheLimit: setLimit, enforceLimit: enforce, getCacheSize: getSize } = await import('@/lib/offlineDb');
                              setLimit(newLimit);
                              await enforce();
                              const newSize = await getSize();
                              setCacheSize(newSize);
                            }}
                            style={{
                              background: (() => {
                                const val = (() => {
                                  if (cacheLimit === 'unlimited') return 1050;
                                  if (cacheLimit === '1gb') return 1000;
                                  if (cacheLimit === '500mb') return 500;
                                  if (cacheLimit === '50mb') return 50;
                                  const n = parseInt(cacheLimit, 10);
                                  return !isNaN(n) ? n : 100;
                                })();
                                const pct = ((val - 50) / (1050 - 50)) * 100;
                                return `linear-gradient(to right, var(--primary) ${pct}%, var(--surface-highlight) ${pct}%)`;
                              })()
                            }}
                            className="w-full accent-primary h-2 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* Retention slider */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-text-primary">{t('account.auto_delete')}</span>
                            <span className="text-sm text-text-secondary">
                              {(() => {
                                if (cacheRetention === 'never') return t('account.never');
                                if (cacheRetention === '7d') return t('common.days_7');
                                if (cacheRetention === '30d') return t('common.days_30');
                                if (cacheRetention === '90d') return t('common.days_90');
                                const n = parseInt(cacheRetention, 10);
                                return !isNaN(n) ? `${n} днів` : t('common.days_30');
                              })()}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="185"
                            step="1"
                            value={(() => {
                              if (cacheRetention === 'never') return 185;
                              if (cacheRetention === '7d') return 7;
                              if (cacheRetention === '30d') return 30;
                              if (cacheRetention === '90d') return 90;
                              const n = parseInt(cacheRetention, 10);
                              return !isNaN(n) ? n : 30;
                            })()}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              const newRet = val > 180 ? 'never' : String(val);
                              setCacheRetentionState(newRet);
                            }}
                            onPointerUp={async (e) => {
                              const val = parseInt((e.target as HTMLInputElement).value, 10);
                              const newRet = val > 180 ? 'never' : String(val);
                              const { setCacheRetention: setRet, enforceLimit: enforce, getCacheSize: getSize } = await import('@/lib/offlineDb');
                              setRet(newRet);
                              await enforce();
                              const newSize = await getSize();
                              setCacheSize(newSize);
                            }}
                            style={{
                              background: (() => {
                                const val = (() => {
                                  if (cacheRetention === 'never') return 185;
                                  if (cacheRetention === '7d') return 7;
                                  if (cacheRetention === '30d') return 30;
                                  if (cacheRetention === '90d') return 90;
                                  const n = parseInt(cacheRetention, 10);
                                  return !isNaN(n) ? n : 30;
                                })();
                                const pct = ((val - 1) / (185 - 1)) * 100;
                                return `linear-gradient(to right, var(--primary) ${pct}%, var(--surface-highlight) ${pct}%)`;
                              })()
                            }}
                            className="w-full accent-primary h-2 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                {/* 4. About & System */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 px-2">{t('account.about') || 'Про застосунок'}</h3>
                  <div className="flex flex-col border-t border-border">
                    <button
                      onClick={async () => {
                        const { Dialog } = await import('@capacitor/dialog');
                        const { value } = await Dialog.confirm({
                          title: t('account.contact_title'),
                          message: t('account.contact_msg'),
                          okButtonTitle: t('common.open'),
                          cancelButtonTitle: t('common.cancel'),
                        });
                        if (value) {
                          window.location.href = 'mailto:artom.devv@gmail.com?subject=ChoirHub%20Підтримка';
                        }
                      }}
                      className="w-full flex items-center justify-between py-4 px-2 hover:bg-white/5 transition-colors border-b border-border group"
                    >
                      <div className="flex items-center gap-4">
                        <Mail className="w-5 h-5 text-text-secondary" />
                        <span className="text-text-primary font-medium text-base">{t('account.support')}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-secondary/50 group-hover:text-text-primary transition-colors" />
                    </button>

                    <button
                      onClick={() => { setLegalInitialView('main'); setShowLegalModal(true); }}
                      className="w-full flex items-center justify-between py-4 px-2 hover:bg-white/5 transition-colors border-b border-border group"
                    >
                      <div className="flex items-center gap-4">
                        <Scale className="w-5 h-5 text-text-secondary" />
                        <span className="text-text-primary font-medium text-base">{t('account.legal')}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-secondary/50 group-hover:text-text-primary transition-colors" />
                    </button>

                    <button
                      onClick={() => setShowHelpModal(true)}
                      className="w-full flex items-center justify-between py-4 px-2 hover:bg-white/5 transition-colors border-b border-border group"
                    >
                      <div className="flex items-center gap-4">
                        <HelpCircle className="w-5 h-5 text-text-secondary" />
                        <span className="text-text-primary font-medium text-base">{t('account.faq')}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-secondary/50 group-hover:text-text-primary transition-colors" />
                    </button>

                    <button
                      onClick={() => setShowLogoutConfirm(true)}
                      className="w-full flex items-center gap-4 py-4 px-2 hover:bg-white/5 transition-colors border-b border-border text-text-secondary hover:text-text-primary group"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium text-base">{t('account.logout')}</span>
                    </button>
                    
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full flex items-center justify-between py-4 px-2 hover:bg-danger/5 transition-colors text-danger"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-base">{t("account.delete_account")}</span>
                      </div>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-md border-b border-border shadow-sm pt-safe transition-all flex flex-col">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 w-full">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Logo - clickable to change icon (for regent/head only) */}
            <button
              onClick={() => {
                if (canEdit) {
                  setEditChoirName(choir?.name || "");
                  setShowChoirSettings(true);
                }
              }}
              className={`w-10 h-10 bg-surface-highlight rounded-xl flex items-center justify-center border border-border overflow-hidden relative group ${canEdit ? 'cursor-pointer hover:border-accent/30' : ''}`}
            >
              {choir?.icon ? (
                <img src={choir?.icon} alt="Choir" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl text-text-primary font-bold">{choir?.name?.[0]?.toUpperCase() || "C"}</span>
              )}
              {canEdit && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
            <div
              onClick={() => setShowChoirManager(true)}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <h1 className="text-lg font-bold text-text-primary leading-tight">
                {choir?.name || "ChoirHub"}
              </h1>
            </div>
          </div>

          <div className="flex-1"></div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Button (Web Only - Repertoire Tab) */}
            {!isNative && activeTab === 'songs' && (
              <button
                onClick={() => setShowSearchOverlay(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-highlight transition-colors text-text-secondary hover:text-text-primary"
                title={t('search.placeholder')}
              >
                <Search className="w-5 h-5" />
              </button>
            )}

            {/* Notification Bell */}
            <button
              onClick={() => router.push('/notifications')}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-highlight transition-colors relative"
              title={t("notif.title")}
            >
              {unreadNotifications > 0 ? (
                <>
                  <Bell className="w-5 h-5 text-text-primary" />
                  <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
                </>
              ) : (
                <Bell className="w-5 h-5 text-text-secondary hover:text-text-primary" />
              )}
            </button>

            {/* Account Button */}
            <button
              onClick={() => setShowAccount(true)}
              className="w-10 h-10 shrink-0 rounded-full border border-border hover:border-accent/50 transition-colors overflow-hidden"
            >
              <div className="w-full h-full bg-primary text-background flex items-center justify-center font-bold text-sm">
                <span>{getFirstNameInitial(userData?.name) || "U"}</span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <div className="relative pt-[calc(4rem_+_env(safe-area-inset-top))] pb-32 md:pb-24">
        {/* Under Construction Banner removed */}



        {activeTab === 'home' && (
          <ServiceList
            key={userData?.choirId}
            onSelectService={handleSelectService}
            canEdit={canEdit}
            services={services}
            showCreateModal={showAddServiceModal}
            setShowCreateModal={setShowAddServiceModal}
            onLoadHistory={loadHistory}
            loadingHistory={loadingHistory}
            allHistoryLoaded={allHistoryLoaded}
          />
        )}

        <div style={{ display: activeTab === 'songs' ? 'block' : 'none' }}>
          <SongList
            canAddSongs={canAddSongs}
            choirType={choir?.choirType}
            regents={choir?.regents || []}
            knownConductors={choir?.knownConductors || []}
            knownCategories={choir?.knownCategories || []}
            knownPianists={choir?.knownPianists || []}
            showAddModal={showAddSongModal}
            setShowAddModal={setShowAddSongModal}
            isOverlayOpen={showAccount || showChoirManager || showAddServiceModal}
            showSearchOverlay={showSearchOverlay}
            setShowSearchOverlay={setShowSearchOverlay}
            isActiveTab={activeTab === 'songs'}
          />
        </div>

        {activeTab === 'members' && (
          <div className="max-w-5xl mx-auto px-4 pb-32">
            {/* Header + Filters */}
            <div className="-mx-4 px-4 pt-3 pb-1 mb-2">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-text-primary">{t('members.title')}</h2>
                  <span className="text-xs text-text-secondary bg-surface-highlight px-2 py-0.5 rounded-lg font-semibold tabular-nums">
                    {(choir?.members || []).filter((m: any) => !m.isDuplicate).length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowStats(true)}
                    className="w-9 h-9 bg-surface border border-border rounded-xl flex items-center justify-center text-text-secondary hover:text-primary transition-colors"
                  >
                    <BarChart2 className="w-4 h-4" />
                  </button>
                  {canEdit && !isNative && (
                    <button
                      onClick={() => { setEditingMember(null); setShowEditMemberModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:opacity-90 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {t('global.actions.add')}
                    </button>
                  )}
                </div>
              </div>

              {/* Voice Filters */}
              <div className="flex overflow-x-auto gap-1.5 scrollbar-hide -mx-4 px-4 pb-2">
                {[
                  { key: '', label: t('global.voices.all') },
                  { key: 'Soprano', label: t('global.voices.soprano') },
                  { key: 'Alto', label: t('global.voices.alto') },
                  { key: 'Tenor', label: t('global.voices.tenor') },
                  { key: 'Bass', label: t('global.voices.bass') },
                ].map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => setMemberFilter(filter.key)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${memberFilter === filter.key
                      ? 'bg-primary text-background border-primary'
                      : 'bg-surface text-text-secondary border-border'
                      }`}
                  >
                    {filter.label}
                  </button>
                ))}
                {/* Spacer to fix WebKit ignoring right padding on overflow-x-auto flex containers */}
                <div className="w-4 shrink-0" />
              </div>
            </div>

            <div className="mt-4">
              {(choir?.members || []).length === 0 ? (
                <div className="text-center py-12 text-text-secondary">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('members.no_members')}</p>
                  {canEdit && <p className="text-sm mt-2">Додайте учасників, щоб відстежувати відвідуваність</p>}
                </div>
              ) : (
                ((() => {
                  // Deduplicate by ID to prevent React key errors from corrupted DB state
                  const dedupedMembers = Array.from(new Map((choir?.members || []).map(m => [m.id || (m as any).uid || JSON.stringify(m), m])).values());

                  // Determine which UIDs are linked to a REAL roster entry
                  const linkedUids = new Set<string>();
                  dedupedMembers.forEach((m: any) => {
                    if (m.isDuplicate) return;
                    // accountUid and linkedUserIds always count as linked
                    if (m.accountUid) linkedUids.add(m.accountUid);
                    (m.linkedUserIds || []).forEach((uid: string) => linkedUids.add(uid));
                    // Only count the member's own ID as "linked" if admin-created/assigned
                    // voice = admin assigned a part; manual_ = admin created entry
                    const isAdminEntry = m.voice || (typeof m.id === 'string' && m.id.startsWith('manual_'));
                    if (isAdminEntry) {
                      linkedUids.add(m.id);
                    }
                  });

                  // Roster = any non-duplicate member in the array.
                  // We used to hide voiceless entries with accounts to avoid auto-stub clutter,
                  // but now users self-register explicitly so they should be visible.
                  const isRosterMember = (m: any) => {
                    if (m.isDuplicate) return false;
                    return true;
                  };

                  const rosterMembers = dedupedMembers.filter(m => {
                    if (!isRosterMember(m)) return false;
                    if (memberFilter && m.voice !== memberFilter) return false;
                    return true;
                  });

                  const sortedMembers = [...rosterMembers].sort((a, b) => {
                    const aHasVoice = !!a.voice;
                    const bHasVoice = !!b.voice;
                    if (aHasVoice && !bHasVoice) return -1;
                    if (!aHasVoice && bHasVoice) return 1;
                    return (a.name || '').localeCompare(b.name || '', 'uk');
                  });

                  if (sortedMembers.length === 0 && !canEdit) {
                    return <div className="text-center py-8 text-text-secondary">{t('search.no_one_found')}</div>;
                  }

                  // Build alphabet from actual member names
                  const usedLetters = new Set(sortedMembers.map(m => (m.name || '?')[0].toUpperCase()));
                  const alphabet = Array.from(usedLetters).sort((a, b) => a.localeCompare(b, 'uk'));

                  const scrollToLetter = (letter: string) => {
                    setActiveLetter(letter);
                    const el = membersContainerRef.current?.querySelector(`[data-letter="${letter}"]`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  };

                  const handleAlphabetTouch = (e: React.TouchEvent) => {
                    const touch = e.touches[0];
                    const el = document.elementFromPoint(touch.clientX, touch.clientY);
                    const letter = el?.getAttribute('data-alpha');
                    if (letter) scrollToLetter(letter);
                  };

                  // Unlinked app users: registered users who are NOT in the roster at all
                  const unlinkedUsers = registeredUsers.filter(appUser => {
                    // If this user's UID is in linkedUids, they're linked
                    if (linkedUids.has(appUser.id)) return false;
                    // If the user already has a member entry in the roster, they're established
                    const hasRosterEntry = dedupedMembers.some(m => m.id === appUser.id && !(m as any).isDuplicate);
                    if (hasRosterEntry) return false;
                    return true;
                  });

                  return (
                    <>
                      {sortedMembers.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          <AnimatePresence mode="popLayout">
                            {sortedMembers.map((member, index) => renderMemberCard(member, index))}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-text-secondary">{t('search.no_one_found')}</div>
                      )}

                      {/* Нові користувачі — unlinked app users (visible to all members) */}
                      {unlinkedUsers.length > 0 && (
                        <div className="mt-6">
                          <div className="flex items-center gap-2 mb-3">
                            <Smartphone className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t('members.new_users')}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded-full font-bold">{unlinkedUsers.length}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                            {unlinkedUsers.map(appUser => (
                              <div
                                key={appUser.id}
                                className="px-3 py-2.5 bg-surface rounded-xl flex items-center justify-between group hover:bg-surface-highlight transition-colors"
                              >
                                <div
                                  className={`flex items-center gap-3 ${canEdit ? 'cursor-pointer hover:opacity-80' : ''} transition-opacity`}
                                  onClick={() => canEdit && setLinkingAppUser(appUser)}
                                >
                                  <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-400 font-bold text-xs">
                                    {appUser.name?.[0]?.toUpperCase() || appUser.email?.[0]?.toUpperCase() || '?'}
                                  </div>
                                  <div>
                                    <div className="text-text-primary text-[13px] font-semibold flex items-center gap-1.5">
                                      {appUser.name || 'Без імені'}
                                      <Smartphone className="w-3 h-3 text-blue-400" />
                                    </div>
                                  </div>
                                </div>
                                {canEdit && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setLinkingAppUser(appUser)}
                                      className="text-text-secondary/50 hover:text-accent transition-colors p-1.5 hover:bg-accent/10 rounded-lg"
                                      title="Об'єднати з учасником хору"
                                    >
                                      <Link2 className="w-3.5 h-3.5" />
                                    </button>
                                    {user?.uid !== appUser.id && (
                                      <button
                                        onClick={() => setUserToDelete(appUser)}
                                        className="text-text-secondary/50 hover:text-danger transition-colors p-1.5 hover:bg-danger/10 rounded-lg"
                                        title="Видалити користувача"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })())
              )}
            </div>
          </div>
        )}
      </div >

      {/* Global FAB */}
      {
        !showAccount && !showChoirManager && !showAddSongModal && !showAddServiceModal && (activeTab === 'home' && canEdit) && (
          <button
            onClick={() => setShowAddServiceModal(true)}
            className="app-fab fixed w-14 h-14 p-0 bg-primary text-background rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-[60] right-4"
            style={{
              bottom: 'var(--fab-bottom)'
            }}
            title="Додати служіння"
          >
            <Plus className="w-7 h-7 flex-shrink-0 m-auto inline-block" />
          </button>
        )
      }

      {/* Bottom Nav */}
      <nav className="app-nav fixed bottom-0 left-0 right-0 bg-surface z-50 border-t border-border">
        {/* 56px content zone */}
        <div
          className="max-w-5xl mx-auto grid grid-cols-3 px-4"
          style={{ height: 'var(--nav-height)' }}
        >
          {[
            { id: 'home', label: t('layout.tabs.services'), icon: FilledHouseIcon },
            { id: 'songs', label: t('layout.tabs.songs'), icon: Music2 },
            { id: 'members', label: t('layout.tabs.members'), icon: Users }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isActive) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    setActiveTab(tab.id as any);
                  }
                }}
                className={`grid place-items-center transition-colors ${isActive ? 'text-primary' : 'text-text-secondary'}`}
              >
                <div className="flex flex-col items-center">
                  <tab.icon className={`w-[26px] h-[26px] block transition-all duration-200 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                  <span className={`text-[10px] leading-none uppercase tracking-wide block transition-all duration-200 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {tab.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Safe-area spacer — separate block */}
        <div style={{ height: 'env(safe-area-inset-bottom)', background: 'var(--surface)' }} />
      </nav>
      {/* Admin Code Creation Modal */}
      <AnimatePresence>
        {
          showAdminCodeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface card-shadow w-full max-w-sm p-6 rounded-3xl shadow-2xl"
              >
                <div className="space-y-5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-text-primary">{t('account.create_admin_code')}</h3>
                    <button onClick={() => setShowAdminCodeModal(false)} className="p-1 hover:bg-surface-highlight rounded-full">
                      <X className="w-5 h-5 text-text-secondary" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      Назва ролі (опціонально)
                    </label>
                    <input
                      type="text"
                      value={newAdminLabel}
                      onChange={(e) => setNewAdminLabel(e.target.value)}
                      placeholder="напр. Секретар"
                      className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      Дозволи
                    </label>
                    <div className="space-y-2">
                      {AVAILABLE_PERMISSIONS.map(perm => (
                        <button
                          key={perm.key}
                          onClick={() => togglePermission(perm.key)}
                          className={`w-full p-3 rounded-xl border text-left text-sm transition-all ${selectedPermissions.includes(perm.key)
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-text-primary'
                            : 'bg-surface-highlight border-border text-text-secondary hover:border-primary/30'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedPermissions.includes(perm.key) ? 'bg-indigo-500 border-indigo-500' : 'border-border'
                              }`}>
                              {selectedPermissions.includes(perm.key) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            {perm.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={createAdminCode}
                    disabled={selectedPermissions.length === 0 || creatingAdminCode}
                    className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {creatingAdminCode ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Створити код'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence>
      {/* Edit Name Modal */}
      <AnimatePresence>
        {
          showEditName && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setShowEditName(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface w-full max-w-sm rounded-3xl border border-border p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-text-primary">{t('account.change_name')}</h3>
                  <button
                    onClick={() => setShowEditName(false)}
                    className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      {t('account.last_name')}
                    </label>
                    <input
                      type="text"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="Прізвище (напр. Шевченко)"
                      className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl focus:outline-none focus:border-primary/50 text-text-primary placeholder:text-text-secondary"
                      autoFocus
                      autoCapitalize="words"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      {t('account.first_name')}
                    </label>
                    <input
                      type="text"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="Ім'я (напр. Тарас)"
                      className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl focus:outline-none focus:border-primary/50 text-text-primary placeholder:text-text-secondary"
                      autoCapitalize="words"
                    />
                  </div>
                </div>

                <div className="mt-8 pt-2 border-t border-border/10">
                  <button
                    onClick={handleSaveName}
                    disabled={savingName || !newFirstName.trim() || !newLastName.trim()}
                    className="w-full py-4 bg-primary text-background font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {savingName ? <Loader2 className="animate-spin w-5 h-5" /> : t("account.save_name")}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence>

      {/* Merge Member Modal */}
      {
        mergingMember && (
          <MergeMemberModal
            isOpen={!!mergingMember}
            onClose={() => setMergingMember(null)}
            onMerge={handleMerge}
            sourceMember={mergingMember!}
            allMembers={choir?.members || []}
          />
        )
      }

      {/* Delete Admin Code Confirmation */}
      <ConfirmationModal
        isOpen={!!deletingAdminCode}
        onClose={() => setDeletingAdminCode(null)}
        onConfirm={async () => {
          if (userData?.choirId && deletingAdminCode) {
            await deleteAdminCode(userData.choirId, deletingAdminCode);
            const updated = await getChoir(userData.choirId);
            if (updated) setChoir(updated);
          }
          setDeletingAdminCode(null);
        }}
        title="Видалити адмін-код?"
        message="Цей адмін-код буде видалено. Користувачі з цим кодом не зможуть долучитися."
        confirmLabel="Видалити"
        isDestructive
      />

      {/* Delete App User Confirmation */}
      <ConfirmationModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={async () => {
          if (userToDelete?.id) {
            try {
              await adminDeleteUser(userToDelete.id);
              setRegisteredUsers(prev => prev.filter(u => u.id !== userToDelete.id));
            } catch (e) {
              console.error("Error deleting user:", e);
            }
          }
          setUserToDelete(null);
        }}
        title="Видалити користувача?"
        message={`Акаунт "${userToDelete?.name || userToDelete?.email}" буде видалено назавжди. Ця дія незворотня.`}
        confirmLabel="Видалити"
        isDestructive
      />

      {/* Notifications Permission Prompt */}
      <NotificationPrompt />

      {/* Account sub-modals (portaled to document.body) */}
      <LegalModal
        isOpen={showLegalModal}
        onClose={() => window.history.back()}
        initialView={legalInitialView}
      />
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => window.history.back()}
      />
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => window.history.back()}
      />
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />


      {/* Leave Choir Confirmation */}
      <ConfirmationModal
        isOpen={!!choirToLeave}
        onClose={() => setChoirToLeave(null)}
        onConfirm={handleLeaveChoir}
        title="Покинути хор?"
        message={
          <span>
            Ви впевнені, що хочете покинути хор{" "}
            <span className="font-bold text-red-500">"{choirToLeave?.name}"</span>?
            <br className="mb-2" />
            <span className="opacity-80 text-sm">
              Якщо ви єдиний адміністратор, хор може залишитися без керування.
            </span>
          </span>
        }
        confirmLabel="Покинути"
        isDestructive
      />

      {/* ── Web App Bottom Navigation ── */}
      {!isNative && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-2">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center justify-center w-20 h-full gap-1 transition-colors ${
                activeTab === 'home' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Calendar className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-medium leading-none">{t('tabs.services')}</span>
            </button>

            <button
              onClick={() => setActiveTab('songs')}
              className={`flex flex-col items-center justify-center w-20 h-full gap-1 transition-colors ${
                activeTab === 'songs' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Music className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-medium leading-none">{t('tabs.songs')}</span>
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`flex flex-col items-center justify-center w-20 h-full gap-1 transition-colors ${
                activeTab === 'members' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-medium leading-none">{t('tabs.choir')}</span>
            </button>
          </div>
        </div>
      )}

    </main >
  );
}



export default function HomePage() {
  return (
    <Suspense fallback={typeof window !== 'undefined' && Capacitor.isNativePlatform() ? null : <Preloader />}>
      <HomePageContent />
    </Suspense>
  );
}
