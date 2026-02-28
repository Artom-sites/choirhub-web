"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { distance } from "fastest-levenshtein";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getChoir, createUser, updateChoirMembers, getServices, uploadChoirIcon, mergeMembers, updateChoir, deleteMyAccount, adminDeleteUser, deleteAdminCode, getChoirNotifications, getChoirUsers, joinChoir, updateMember, claimMember, leaveChoir } from "@/lib/db";
import { updateAttendanceCache } from "@/lib/attendanceCache";
import { Capacitor } from "@capacitor/core";
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
import InstallPrompt from "@/components/InstallPrompt";


import ThemeSettings from "@/components/ThemeSettings";
import LegalModal from "@/components/LegalModal";
import SupportModal from "@/components/SupportModal";
import HelpModal from "@/components/HelpModal";
import NotificationsModal from "@/components/NotificationsModal";
import DeleteAccountModal from "@/components/DeleteAccountModal";
import ConfirmationModal from "@/components/ConfirmationModal";
import {
  Music2, Loader2, Copy, Check, HelpCircle, Mail, Shield,
  LogOut, ChevronLeft, ChevronRight, Home, User, Users, Repeat,
  PlusCircle, Plus, UserPlus, X, Trash2, Camera, BarChart2, Link2, Pencil, FileText, Heart, Bell, BellOff, Sun, Moon, Monitor, Scale, Smartphone, RefreshCw, Search, ArrowUpDown, Palette
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NotificationPrompt from "@/components/NotificationPrompt";
import SendNotificationModal from "@/components/SendNotificationModal";
import { collection as firestoreCollection, addDoc, getDocs, getDoc, where, query, doc, updateDoc, arrayUnion, onSnapshot, orderBy, limit, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useFcmToken } from "@/hooks/useFcmToken";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useBackgroundCache } from "@/hooks/useBackgroundCache";


function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, loading: authLoading, signOut, refreshProfile, isGuest } = useAuth();
  const { theme, setTheme } = useTheme();

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
  const [showPreloader, setShowPreloader] = useState(true);
  const [preloaderFading, setPreloaderFading] = useState(false);
  const preloaderMinReady = useRef(false);
  const preloaderStartTime = useRef(Date.now());


  // Min/Max Timing: hide preloader only when BOTH conditions are met
  useEffect(() => {
    if (!isAppReady) return;

    const elapsed = Date.now() - preloaderStartTime.current;
    const remaining = Math.max(0, 1200 - elapsed); // Min 1200ms

    const hide = async () => {
      setPreloaderFading(true); // Start fade-out
      setTimeout(() => setShowPreloader(false), 400); // Remove after fade

      // Hide the native solid dark splash screen now that React is drawn
      if (Capacitor.isNativePlatform()) {
        try {
          await SplashScreen.hide();
        } catch (e) { }
      }
    };

    if (remaining > 0) {
      const timer = setTimeout(hide, remaining);
      return () => clearTimeout(timer);
    } else {
      hide();
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

  // UI States & Modals
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showChoirManager, setShowChoirManager] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<ChoirMember | null>(null);
  const [mergingMember, setMergingMember] = useState<ChoirMember | null>(null);
  const [linkingAppUser, setLinkingAppUser] = useState<any | null>(null);
  const [viewingMemberStats, setViewingMemberStats] = useState<ChoirMember | null>(null);
  const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [showChoirSettings, setShowChoirSettings] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalInitialView, setLegalInitialView] = useState<'main' | 'privacy' | 'terms'>('main');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSendNotificationModal, setShowSendNotificationModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);

  // Manager/Admin States
  const [managerMode, setManagerMode] = useState<'list' | 'create' | 'join'>('list');
  const [newChoirName, setNewChoirName] = useState("");
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
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [editChoirName, setEditChoirName] = useState("");
  const [savingChoirSettings, setSavingChoirSettings] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [choirToLeave, setChoirToLeave] = useState<{ id: string, name: string } | null>(null);

  const iconInputRef = useRef<HTMLInputElement>(null);

  const AVAILABLE_PERMISSIONS: { key: Permission; label: string }[] = [
    { key: 'add_songs', label: 'Додавати пісні' },
    { key: 'edit_attendance', label: 'Відмічати відсутніх' },
    { key: 'edit_credits', label: 'Записувати диригента/піаніста' },
    { key: 'view_stats', label: 'Бачити статистику' },
    { key: 'manage_services', label: 'Створювати/видаляти служіння' },
    { key: 'notify_members', label: 'Надсилати сповіщення' },
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
    if (!joinLastName.trim() || !joinFirstName.trim()) {
      setManagerError("Введіть прізвище та ім'я");
      return;
    }
    setClaimLoading(true);
    setManagerError("");

    const fullName = `${joinLastName.trim()} ${joinFirstName.trim()}`;
    try {
      // 1. Save name to user profile
      await createUser(user.uid, { name: fullName });

      // 2. Fetch choir to find unlinked members
      const choirDocRef = doc(db, "choirs", userData.choirId);
      const choirSnap = await getDoc(choirDocRef);
      if (!choirSnap.exists()) throw new Error("Choir not found");
      const cData = choirSnap.data();
      const currentMembers = cData.members || [];
      const unlinked = currentMembers.filter((m: any) => !m.hasAccount && m.name);

      // Auto-matching logic
      if (unlinked.length > 0) {
        const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
        const enteredNameNorm = normalize(fullName);
        const enteredNameReversed = normalize(`${joinFirstName.trim()} ${joinLastName.trim()}`);

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

      // No match -> Update their own auto-created stub with the new name
      await updateMember(userData.choirId, user.uid, { name: fullName });

      await refreshProfile();
      setShowFinishAppRegistration(false);
    } catch (e: any) {
      console.error(e);
      setManagerError(e.message || "Помилка збереження");
    } finally {
      setClaimLoading(false);
    }
  };

  // ------------------------------------------------------------------
  //  EFFECTS & NAVIGATION
  // ------------------------------------------------------------------

  // Notifications Check
  useEffect(() => {
    if (userData?.choirId) {
      getChoirNotifications(userData.choirId).then(notifs => {
        if (userData.id) {
          const unread = notifs.filter((n: any) => !n.readBy?.includes(userData.id));
          setUnreadNotifications(unread.length);
        }
      });
    }
  }, [userData?.choirId, userData?.id, showNotificationModal]);

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

  // Handle Android back gesture
  useEffect(() => {
    if (showAccount) {
      window.history.pushState({ modal: 'account' }, '');
      const handlePopState = () => setShowAccount(false);
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [showAccount]);

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
            member.voice ? member.voice[0] : (member.name?.[0]?.toUpperCase() || '?')
          )}
        </div>

        {/* Name & info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-text-primary truncate">{member.name}</span>
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
    if (authLoading || userData === undefined) return;

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
      // console.log('Checks:', { servicesLoaded, choirLoaded });
      if (servicesLoaded && choirLoaded) {
        // console.log('App Ready!');
        setIsAppReady(true);
      }
    };

    // Calculate 7 days ago for "Active Window"
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]; // Compare as YYYY-MM-DD string if needed, or ISO

    // We use ISO string date in DB usually? Type says string. 
    // Assuming date format is YYYY-MM-DD or ISO. 
    // If it's YYYY-MM-DD, ISO string comparison works for > date.

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
      where("date", ">=", sevenDaysAgoStr),
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
      alert("Не вдалося покинути хор");
    }
  };

  const handleSwitchChoir = async (membership: UserMembership) => {
    if (!user) return;
    setIsAppReady(false);

    await createUser(user.uid, {
      choirId: membership.choirId,
      choirName: membership.choirName,
      role: membership.role
    });

    await refreshProfile();
    setShowChoirManager(false);
    window.location.reload(); // Restored to ensure full context reset
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
      setShowChoirManager(false);
      window.location.reload(); // Force reload to ensure all contexts pick up the new choir
    } catch (e: any) {
      console.error("Error creating choir:", e);
      setManagerError("Помилка створення хору: " + (e.message || "Невідома помилка"));
    } finally {
      setManagerLoading(false);
    }
  };



  const handleJoinChoir = async () => {
    if (!user || !joinCode || joinCode.length !== 6) return;
    if (!joinLastName.trim() || !joinFirstName.trim()) {
      setManagerError("Введіть прізвище та ім'я");
      return;
    }
    setManagerLoading(true);

    // Save name to user profile BEFORE joining
    const fullName = `${joinLastName.trim()} ${joinFirstName.trim()}`;
    try {
      await createUser(user.uid, { name: fullName });
    } catch (e) {
      console.warn("Failed to save name before join:", e);
    }

    try {
      const result = await joinChoir(joinCode);
      console.log("Joined result:", result);
      await refreshProfile();

      const unlinked = result?.unlinkedMembers || [];
      console.log("Unlinked members found:", unlinked.length, unlinked);

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
          const distNormal = distance(mName, enteredNameNorm);
          const distReversed = distance(mName, enteredNameReversed);
          return distNormal <= 2 || distReversed <= 2;
        });

        if (matchedMember) {
          console.log("Showing claim modal for matched member:", matchedMember.name);
          setClaimMembers([matchedMember]);
          setClaimChoirId(result.choirId);
          setSelectedClaimId(matchedMember.id);
          setShowChoirManager(false);
          setShowClaimModal(true);
        } else {
          console.log("No name match. Auto-creating self-stub -> closing manager");
          await updateMember(result.choirId, user.uid, { name: fullName });
          setShowChoirManager(false);
        }
      } else if (result?.choirId) {
        console.log("No unlinked members found. Auto-creating self-stub -> closing manager");
        await updateMember(result.choirId, user.uid, { name: fullName });
        setShowChoirManager(false);
      } else {
        setShowChoirManager(false);
      }
    } catch (e: any) {
      console.error(e);
      const msg = e.message || "Помилка приєднання";
      if (msg.includes("Invalid invite code")) {
        setManagerError("Невірний код");
      } else if (msg.includes("Already a member")) {
        setManagerError("Ви вже є учасником цього хору");
      } else {
        setManagerError("Помилка приєднання");
      }
    } finally {
      setManagerLoading(false);
    }
  };

  const handleClaimMember = async (targetMemberId: string) => {
    if (!claimChoirId) return;
    setClaimLoading(true);
    try {
      const result = await claimMember(claimChoirId, targetMemberId);
      console.log("Claimed:", result);
      await refreshProfile();
      setShowClaimModal(false);
      setClaimMembers([]);
      setClaimChoirId(null);
    } catch (e: any) {
      console.error("Claim error:", e);
      const msg = e.message || "";
      if (msg.includes("already has an account") || msg.includes("already claimed")) {
        alert("Цей профіль вже прив'язаний до іншого акаунту. Зверніться до регента для переприв'язки.");
      } else if (msg.includes("already linked")) {
        alert("Ваш акаунт вже прив'язаний до іншого учасника.");
      } else {
        alert("Помилка прив'язки: " + msg);
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
    if (!newName.trim() || !user) return;
    const finalName = newName.trim();

    if (!finalName.includes(" ")) {
      alert("Будь ласка, введіть 'Прізвище та Ім'я' через пробіл (наприклад: Шевченко Тарас).");
      return;
    }
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
        const oldName = userData?.name;
        if (oldName && choir.regents?.includes(oldName)) {
          const updatedRegents = choir.regents.map((r: string) => r === oldName ? finalName : r);
          try {
            const choirRef = doc(db, "choirs", userData.choirId);
            await updateDoc(choirRef, { regents: updatedRegents });
          } catch (e) {
            console.error("Failed to update regents array:", e);
          }
        }
      }

      // await fetchChoirData(); // Listener handles updates
      setShowEditName(false);
      setNewName("");
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
        voice: member.voice,
        role: member.role,
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
        const cleanMember = { ...member };
        delete (cleanMember as any).isDuplicate;
        updatedMembers.push(cleanMember);
        await updateChoirMembers(userData.choirId, updatedMembers);
        setChoir({ ...choir, members: updatedMembers });
      }

      setShowEditMemberModal(false);
    } catch (e) {
      console.error(e);
      setManagerError("Помилка збереження");
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
          if (m.id === targetMemberId && fromMember?.hasAccount && !m.hasAccount) {
            return {
              ...m,
              hasAccount: true,
              linkedUserIds: [...(m.linkedUserIds || []), fromMember.id]
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
      alert("Не вдалося об'єднати учасників");
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
      alert("Не вдалося прив'язати користувача");
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
    // Don't allow removing yourself or the head
    if (memberId === user?.uid) return;

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
      // Navigation handles itself (auth state change)
    } catch (error: any) {
      console.error("Delete Account Error:", error);
      setManagerError(error.message || "Сталася помилка при видаленні акаунту");
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
  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData?.choirId || !canEdit) return;

    try {
      const url = await uploadChoirIcon(userData.choirId, file);
      setChoir(prev => prev ? { ...prev, icon: url } : null);
    } catch (err) {
      console.error("Failed to update icon:", err);
    }
  };

  // ------------------------------------------------------------------
  //  APP READY CHECK
  // ------------------------------------------------------------------
  // Preloader overlay (renders on top, fades out when ready)
  // This replaces the old early-return pattern for smoother transition.
  const preloaderOverlay = showPreloader ? (
    <div
      className={`fixed inset-0 z-[9999] transition-opacity duration-400 ${preloaderFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
    >
      <Preloader />
    </div>
  ) : null;

  // If data isn't ready yet, show preloader as full-screen (no content behind)
  if (!isAppReady) {
    return <>{preloaderOverlay || <Preloader />}</>;
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
      head: { label: "Регент", className: "bg-primary/10 text-primary border border-primary/20" },
      regent: { label: "Регент", className: "bg-primary/10 text-primary border border-primary/20" },
      member: { label: "Хорист", className: "bg-surface-highlight text-text-secondary border border-border" },
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

  if (authLoading) return <Preloader />;

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

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
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
                  <h3 className="text-lg font-bold text-white">Вийти з акаунту?</h3>
                  <p className="text-[#a1a1aa] text-sm mt-1">
                    Для повторного входу знадобиться увійти через Google.
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-3 border border-white/10 rounded-xl text-white hover:bg-[#27272a] transition-colors font-medium text-sm"
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-100 transition-colors text-sm"
                  >
                    Вийти
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
                <h3 className="text-lg font-bold text-text-primary">Налаштування хору</h3>
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
                  onClick={() => iconInputRef.current?.click()}
                  className="w-24 h-24 bg-surface-highlight rounded-2xl flex items-center justify-center border border-border overflow-hidden relative group cursor-pointer hover:border-primary/30 transition-colors"
                >
                  {choir?.icon ? (
                    <img src={choir.icon} alt="Choir" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl text-text-primary font-bold">{choir?.name?.[0]?.toUpperCase() || "C"}</span>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </button>
                <p className="text-text-secondary text-xs mt-2">Натисніть, щоб змінити фото</p>
              </div>

              {/* Choir Name */}
              <div className="mb-6">
                <label className="text-text-secondary text-sm mb-2 block">Назва хору</label>
                <input
                  type="text"
                  value={editChoirName}
                  onChange={(e) => setEditChoirName(e.target.value)}
                  placeholder="Назва хору"
                  className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary/50"
                />
              </div>

              {/* Save Button */}
              <button
                onClick={async () => {
                  if (!userData?.choirId || !editChoirName.trim()) return;
                  setSavingChoirSettings(true);
                  try {
                    await updateChoir(userData.choirId, { name: editChoirName.trim() });
                    setChoir(prev => prev ? { ...prev, name: editChoirName.trim() } : null);
                    setShowChoirSettings(false);
                  } catch (err) {
                    console.error("Failed to update choir:", err);
                  } finally {
                    setSavingChoirSettings(false);
                  }
                }}
                disabled={savingChoirSettings || !editChoirName.trim()}
                className="w-full py-3 bg-primary text-background rounded-xl font-bold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingChoirSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                Зберегти
              </button>
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
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface card-shadow w-full max-w-sm p-6 rounded-3xl shadow-2xl overflow-hidden relative"
            >
              <button onClick={() => { setShowChoirManager(false); setShowAccount(true); setManagerMode('list'); setManagerError(""); }} className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>

              {managerMode === 'list' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-text-primary text-center mb-6">Мої хори</h3>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    <div className="p-4 rounded-2xl bg-success/10 border border-success/30 flex items-center justify-between">
                      <div>
                        <p className="text-text-primary font-bold">{userData?.choirName}</p>
                        <p className="text-xs text-success font-medium tracking-wide">ПОТОЧНИЙ</p>
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
                            <p className="text-xs text-text-secondary uppercase">{m.role === 'head' ? 'Регент' : m.role === 'regent' ? 'Регент' : 'Хорист'}</p>
                          </div>
                          <Repeat className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
                        </button>
                        <button
                          onClick={() => setChoirToLeave({ id: m.choirId, name: m.choirName })}
                          className="p-4 rounded-2xl bg-surface-highlight border border-border hover:bg-red-500/10 hover:border-red-500/30 flex items-center justify-center transition-all group/delete"
                          title="Покинути хор"
                        >
                          <LogOut className="w-5 h-5 text-text-secondary group-hover/delete:text-red-500 transition-colors" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <button onClick={() => setManagerMode('create')} className="p-3 bg-primary text-background rounded-xl text-sm font-bold hover:opacity-90">
                      Створити
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
                      Приєднатись
                    </button>
                  </div>
                </div>
              )}

              {managerMode === 'create' && (
                <div className="space-y-4">
                  <button onClick={() => setManagerMode('list')} className="text-xs text-text-secondary hover:text-text-primary mb-2">← Назад</button>
                  <h3 className="text-xl font-bold text-text-primary">Новий хор</h3>
                  <input
                    value={newChoirName}
                    onChange={e => setNewChoirName(e.target.value)}
                    placeholder="Назва хору"
                    className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl placeholder:text-text-secondary"
                  />
                  <div className="space-y-2">
                    <p className="text-xs text-text-secondary uppercase font-bold tracking-wider">Тип хору</p>
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
                          <p className="font-bold text-text-primary">Хор МСЦ ЄХБ</p>
                          <p className="text-xs text-text-secondary">Має доступ до Архіву МХО</p>
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
                          <p className="font-bold text-text-primary">Звичайний хор</p>
                          <p className="text-xs text-text-secondary">Тільки власний репертуар</p>
                        </div>
                      </div>
                    </button>
                  </div>
                  <button
                    onClick={handleCreateChoir}
                    disabled={managerLoading || !newChoirName.trim() || !newChoirType}
                    className="w-full p-3 bg-primary text-background rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {managerLoading ? <Loader2 className="animate-spin mx-auto" /> : "Створити"}
                  </button>
                </div>
              )}

              {managerMode === 'join' && (
                <div className="space-y-4">
                  <button onClick={() => { setManagerMode('list'); setManagerError(""); }} className="text-xs text-text-secondary hover:text-text-primary mb-2">← Назад</button>
                  <h3 className="text-xl font-bold text-text-primary">Приєднатись</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-text-secondary uppercase font-bold tracking-wider mb-1 block">Прізвище</label>
                      <input
                        value={joinLastName}
                        onChange={e => setJoinLastName(e.target.value)}
                        placeholder="Шевченко"
                        className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl placeholder:text-text-secondary"
                        autoCapitalize="words"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-secondary uppercase font-bold tracking-wider mb-1 block">Ім'я</label>
                      <input
                        value={joinFirstName}
                        onChange={e => setJoinFirstName(e.target.value)}
                        placeholder="Тарас"
                        className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl placeholder:text-text-secondary"
                        autoCapitalize="words"
                      />
                    </div>
                  </div>
                  <input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Код (6 символів)"
                    maxLength={6}
                    className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl text-center font-mono uppercase tracking-widest placeholder:text-text-secondary"
                  />
                  {managerError && <p className="text-red-400 text-xs">{managerError}</p>}
                  <button
                    onClick={handleJoinChoir}
                    disabled={managerLoading || !joinLastName.trim() || !joinFirstName.trim()}
                    className="w-full p-3 bg-primary text-background rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {managerLoading ? <Loader2 className="animate-spin mx-auto" /> : "Додатись"}
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
          onDelete={handleRemoveMember}
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
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface card-shadow w-full max-w-sm p-6 rounded-3xl shadow-2xl overflow-hidden relative"
            >
              <h3 className="text-xl font-bold text-text-primary mb-2">Це ви?</h3>
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
                        <span className="ml-2 text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded-md">вже має акаунт</span>
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
                  {claimLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Так, це я"}
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4"
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

              <h3 className="text-xl font-bold text-text-primary mb-2">Завершення реєстрації</h3>
              <p className="text-sm text-text-secondary mb-6">
                Будь ласка, введіть ваше Прізвище та Ім'я для повноцінної роботи додатка.
              </p>

              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary ml-1">Прізвище</label>
                    <input
                      value={joinLastName}
                      onChange={e => setJoinLastName(e.target.value)}
                      placeholder="Наприклад: Шевченко"
                      className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl placeholder:text-text-secondary"
                      autoCapitalize="words"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary ml-1">Ім'я</label>
                    <input
                      value={joinFirstName}
                      onChange={e => setJoinFirstName(e.target.value)}
                      placeholder="Наприклад: Тарас"
                      className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl placeholder:text-text-secondary"
                      autoCapitalize="words"
                    />
                  </div>
                </div>

                {managerError && <p className="text-red-400 text-xs">{managerError}</p>}

                <button
                  onClick={handleFinishAppRegistration}
                  disabled={claimLoading || !joinLastName.trim() || !joinFirstName.trim()}
                  className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-all flex justify-center shadow-lg disabled:opacity-50"
                >
                  {claimLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Продовжити"}
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
            className="fixed inset-0 z-[60] flex flex-col bg-background"
            style={{ background: 'var(--background)' }}
          >
            <div className="p-4 border-b border-border pt-[calc(1rem_+_env(safe-area-inset-top))]" style={{ background: 'var(--surface)' }}>
              <button
                onClick={() => setShowAccount(false)}
                className="flex items-center gap-2 text-text-primary font-medium hover:text-text-secondary transition-colors py-1"
              >
                <ChevronLeft className="w-5 h-5" />
                Назад
              </button>
            </div>

            <div className="max-w-xl mx-auto w-full h-full flex flex-col p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold text-text-primary tracking-tight">Акаунт</h2>

                {/* Compact Theme Toggle */}
                <div className="flex items-center bg-surface border border-border rounded-full p-0.5 shadow-sm mt-[-4px]">
                  {[
                    { id: 'light', icon: Sun, label: 'Світла' },
                    { id: 'dark', icon: Moon, label: 'Темна' },
                    { id: 'system', icon: Monitor, label: 'Авто' },
                  ].map((t) => {
                    const isActive = theme === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id as 'light' | 'dark' | 'system')}
                        className={`p-2 rounded-full transition-all duration-200 ${isActive
                          ? 'bg-primary text-background shadow-sm'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-highlight'
                          }`}
                        title={t.label}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-6 flex-1">
                {/* Profile Card */}
                <div className="bg-surface rounded-2xl p-6 flex items-center gap-5 card-shadow">
                  <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center text-xl font-bold shadow-lg overflow-hidden">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{userData?.name?.[0]?.toUpperCase() || "U"}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-text-primary">{userData?.name}</h3>
                      <button
                        onClick={() => { setNewName(userData?.name || ""); setShowEditName(true); }}
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

                {/* Management Block (Choir & Codes) */}
                <div className="bg-surface rounded-2xl p-4 card-shadow">
                  {/* Change Choir Button */}
                  <button
                    onClick={() => { setShowAccount(false); setShowChoirManager(true); }}
                    className="w-full flex items-center justify-between py-2 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                        <Repeat className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-text-primary font-bold text-sm">Змінити хор</p>
                        <p className="text-xs text-text-secondary group-hover:text-text-primary/80">Додати або перемкнути</p>
                      </div>
                    </div>
                    <PlusCircle className="w-5 h-5 text-text-secondary group-hover:text-text-primary" />
                  </button>

                  {/* Codes for admin */}
                  {(userData?.role === 'head' || userData?.role === 'regent') && choir && (
                    <div className="pt-4 border-t border-border mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm text-text-secondary">Коди доступу</h3>
                        <button
                          onClick={() => setShowAdminCodeModal(true)}
                          className="text-xs text-accent hover:underline flex items-center gap-1"
                        >
                          <PlusCircle className="w-3 h-3" />
                          Додати
                        </button>
                      </div>

                      <div className="bg-surface-highlight rounded-xl overflow-hidden">
                        {/* Member Code */}
                        <div className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                          <span className="text-text-primary text-base">Хористи</span>
                          <div className="flex items-center gap-3">
                            <code className="text-base font-mono font-medium text-text-primary">{choir.memberCode}</code>
                            <button
                              onClick={() => copyCode(`https://${window.location.host}/?code=${choir.memberCode}`)}
                              className="text-text-secondary hover:text-accent transition-colors"
                            >
                              {copiedCode === `https://${window.location.host}/?code=${choir.memberCode}`
                                ? <Check className="w-5 h-5 text-success" />
                                : <Copy className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Regent Code */}
                        <div className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                          <span className="text-text-primary text-base">Регенти</span>
                          <div className="flex items-center gap-3">
                            <code className="text-base font-mono font-medium text-text-primary">{choir.regentCode}</code>
                            <button
                              onClick={() => copyCode(`https://${window.location.host}/?code=${choir.regentCode}`)}
                              className="text-text-secondary hover:text-accent transition-colors"
                            >
                              {copiedCode === `https://${window.location.host}/?code=${choir.regentCode}`
                                ? <Check className="w-5 h-5 text-success" />
                                : <Copy className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Admin Codes */}
                        {choir.adminCodes && choir.adminCodes.length > 0 && choir.adminCodes.map((ac, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                            <span className="text-text-primary text-base">{ac.label || 'Адмін'}</span>
                            <div className="flex items-center gap-3">
                              <code className="text-base font-mono font-medium text-text-primary">{ac.code}</code>
                              <button
                                onClick={() => copyCode(`https://${window.location.host}/?code=${ac.code}`)}
                                className="text-text-secondary hover:text-accent transition-colors"
                              >
                                {copiedCode === `https://${window.location.host}/?code=${ac.code}`
                                  ? <Check className="w-5 h-5 text-success" />
                                  : <Copy className="w-5 h-5" />}
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
                      </div>
                    </div>
                  )}


                </div>
              </div>




              {/* Про застосунок Section */}
              <div className="mt-8">
                <p className="text-sm text-text-secondary mb-4">Про застосунок</p>

                <a
                  href="mailto:artom.devv@gmail.com?subject=ChoirHub%20Підтримка"
                  className="w-full py-4 text-left text-lg font-medium text-text-primary hover:text-primary border-t border-border transition-all flex items-center gap-4 group"
                >
                  <Mail className="w-5 h-5 text-text-secondary" />
                  <span>Підтримка та зворотний зв'язок</span>
                </a>

                <button
                  onClick={() => { setLegalInitialView('main'); setShowLegalModal(true); }}
                  className="w-full py-4 text-left text-lg font-medium text-text-primary hover:text-primary border-t border-border transition-all flex items-center gap-4 group"
                >
                  <Scale className="w-5 h-5 text-text-secondary" />
                  <span>Джерела та контент</span>
                </button>

                <button
                  onClick={() => setShowHelpModal(true)}
                  className="w-full py-4 text-left text-lg font-medium text-text-primary hover:text-primary border-t border-border transition-all flex items-center gap-4 group"
                >
                  <HelpCircle className="w-5 h-5 text-text-secondary" />
                  <span>Довідка та FAQ</span>
                </button>

                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full py-4 text-left text-lg font-medium text-text-secondary hover:text-text-primary border-t border-border transition-all flex items-center gap-4 group"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Вийти з акаунту</span>
                </button>
              </div>

              {/* Підтримати - окремий виділений блок */}
              <button
                onClick={() => setShowSupportModal(true)}
                className="w-full mt-8 py-4 px-5 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-400/30 rounded-2xl text-left transition-all hover:from-pink-500/20 hover:to-purple-500/20 flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <span className="text-lg font-medium text-pink-400">Підтримати проєкт</span>
                  <p className="text-xs text-text-secondary mt-0.5">Допоможіть розвивати застосунок</p>
                </div>
              </button>

              {/* Delete Account Button */}
              <div className="mt-8 pt-4 border-t border-border">
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full py-3 text-danger hover:bg-danger/10 rounded-xl text-sm transition-all"
                >
                  Видалити акаунт
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-3xl border-b border-border shadow-sm pt-safe transition-all flex flex-col">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 w-full">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Logo - clickable to change icon (for regent/head only) */}
            <input
              type="file"
              ref={iconInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleIconUpload}
            />
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
                <img src={choir.icon} alt="Choir" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl text-text-primary font-bold">{choir?.name?.[0]?.toUpperCase() || "C"}</span>
              )}
              {canEdit && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
            <div>
              <h1 className="text-lg font-bold text-text-primary leading-tight">
                {choir?.name || "ChoirHub"}
              </h1>
            </div>
          </div>

          <div className="flex-1"></div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notification Bell */}
            <button
              onClick={() => setShowNotificationModal(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-highlight transition-colors relative"
              title="Сповіщення"
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
                <span>{userData?.name?.[0]?.toUpperCase() || "U"}</span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <div className="relative pt-[calc(4rem_+_env(safe-area-inset-top))] pb-32 md:pb-24">
        {/* Under Construction Banner - Just a normal block in the flow */}
        {!isNative && (
          <div className="bg-orange-500/10 border-b border-amber-500/20 py-2 px-4 text-center">
            <p className="text-[11px] font-medium text-orange-400">
              🚧 Додаток в розробці — вибачте за можливі незручності
            </p>
          </div>
        )}
        {/* Self-service claim banner for unlinked users */}
        {isUserUnlinked && (
          <div className="mx-4 mt-3 mb-2">
            <button
              onClick={openClaimFromBanner}
              className="w-full p-4 bg-primary/10 border border-primary/30 rounded-2xl flex items-center gap-3 text-left hover:bg-primary/15 transition-colors active:scale-[0.99]"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-text-primary">Завершіть реєстрацію</p>
                <p className="text-xs text-text-secondary mt-0.5">Будь ласка, введіть ваше прізвище та ім'я для повноцінної роботи додатка</p>
              </div>
              <ChevronRight className="w-5 h-5 text-text-secondary flex-shrink-0" />
            </button>
          </div>
        )}

        {activeTab === 'home' && (
          <ServiceList
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
          />
        </div>

        {activeTab === 'members' && (
          <div className="max-w-5xl mx-auto px-4 pb-32">
            {/* Header + Filters — sticky */}
            <div className="sticky top-[calc(4rem_+_env(safe-area-inset-top))] z-40 bg-background/95 backdrop-blur-md -mx-4 px-4 pt-3 pb-1 border-b border-border">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-text-primary">Учасники</h2>
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
                  {(canEdit || userData?.permissions?.includes('notify_members')) && (
                    <button
                      onClick={() => setShowSendNotificationModal(true)}
                      className="w-9 h-9 bg-surface border border-border rounded-xl flex items-center justify-center text-text-secondary hover:text-primary transition-colors"
                      title="Надіслати сповіщення"
                    >
                      <Bell className="w-4 h-4" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => { setEditingMember(null); setShowEditMemberModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:opacity-90 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Додати
                    </button>
                  )}
                </div>
              </div>

              {/* Voice Filters */}
              <div className="flex overflow-x-auto gap-1.5 scrollbar-hide -mx-4 px-4 pb-2">
                {[
                  { key: '', label: 'Всі' },
                  { key: 'Soprano', label: 'Сопрано' },
                  { key: 'Alto', label: 'Альт' },
                  { key: 'Tenor', label: 'Тенор' },
                  { key: 'Bass', label: 'Бас' },
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
              </div>
            </div>

            <div className="mt-4">
              {(choir?.members || []).length === 0 ? (
                <div className="text-center py-12 text-text-secondary">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Немає учасників</p>
                  {canEdit && <p className="text-sm mt-2">Додайте учасників, щоб відстежувати відвідуваність</p>}
                </div>
              ) : (
                ((() => {
                  // Deduplicate by ID to prevent React key errors from corrupted DB state
                  const dedupedMembers = Array.from(new Map((choir?.members || []).map(m => [m.id, m])).values());

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
                    return <div className="text-center py-8 text-text-secondary">Нікого не знайдено</div>;
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
                        <div className="text-center py-8 text-text-secondary">Нікого не знайдено</div>
                      )}

                      {/* Нові користувачі — unlinked app users (visible to all members) */}
                      {unlinkedUsers.length > 0 && (
                        <div className="mt-6">
                          <div className="flex items-center gap-2 mb-3">
                            <Smartphone className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Нові користувачі</span>
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
      <nav className="app-nav fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl z-50 border-t border-border">
        {/* 56px content zone */}
        <div
          className="max-w-5xl mx-auto grid grid-cols-3 px-4"
          style={{ height: 'var(--nav-height)' }}
        >
          {[
            { id: 'home', label: 'Служіння', icon: Home },
            { id: 'songs', label: 'Пісні', icon: Music2 },
            { id: 'members', label: 'Учасники', icon: Users }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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
        <div style={{ height: 'env(safe-area-inset-bottom)', background: 'inherit' }} />
      </nav>
      {/* Admin Code Creation Modal */}
      <AnimatePresence>
        {
          showAdminCodeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface card-shadow w-full max-w-sm p-6 rounded-3xl shadow-2xl"
              >
                <div className="space-y-5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-text-primary">Створити адмін-код</h3>
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
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
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
                  <h3 className="text-xl font-bold text-text-primary">Змінити ім'я</h3>
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
                      Ваше ім'я
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Прізвище Ім'я (наприклад: Шевченко Тарас)"
                      className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl focus:outline-none focus:border-primary/50 text-text-primary placeholder:text-text-secondary"
                      autoFocus
                    />
                  </div>

                  <button
                    onClick={handleSaveName}
                    disabled={savingName || !newName.trim()}
                    className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingName ? <Loader2 className="animate-spin" /> : "Зберегти"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence>

      <SendNotificationModal
        isOpen={showSendNotificationModal}
        onClose={() => setShowSendNotificationModal(false)}
      />

      {/* Merge Member Modal */}
      {
        mergingMember && (
          <MergeMemberModal
            isOpen={!!mergingMember}
            onClose={() => setMergingMember(null)}
            onMerge={handleMerge}
            sourceMember={mergingMember}
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

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        canDelete={canEdit || (userData?.permissions?.includes('notify_members') ?? false)}
        services={services}
        permissionStatus={permissionStatus}
        requestPermission={() => requestPermission("NotificationsModal")}
        unsubscribe={() => unsubscribe("NotificationsModal")}
        isSupported={isSupported}
        isGranted={isGranted}
        isPreferenceEnabled={isPreferenceEnabled}
        fcmLoading={fcmLoading}
      />

      {/* Account sub-modals (portaled to document.body) */}
      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        initialView={legalInitialView}
      />
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
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

    </main >
  );
}



export default function HomePage() {
  return (
    <Suspense fallback={<Preloader />}>
      <HomePageContent />
    </Suspense>
  );
}
