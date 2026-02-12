"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getChoir, createUser, updateChoirMembers, getServices, uploadChoirIcon, mergeMembers, updateChoir, deleteUserAccount, deleteAdminCode, getChoirNotifications, getChoirUsers } from "@/lib/db";
import { Service, Choir, UserMembership, ChoirMember, Permission, AdminCode } from "@/types";
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
  PlusCircle, UserPlus, X, Trash2, Camera, BarChart2, Link2, Pencil, FileText, Heart, Bell, BellOff, Sun, Moon, Monitor
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SendNotificationModal from "@/components/SendNotificationModal";
import { collection as firestoreCollection, addDoc, getDocs, getDoc, where, query, doc, updateDoc, arrayUnion, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFcmToken } from "@/hooks/useFcmToken";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useBackgroundCache } from "@/hooks/useBackgroundCache";


function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, loading: authLoading, signOut, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  // Global FCM Token Sync
  useFcmToken();

  // Register Service Worker for offline support
  useServiceWorker();

  // Background cache upcoming service PDFs on app start
  useBackgroundCache();

  // ------------------------------------------------------------------
  //  STATE DEFINITIONS
  // ------------------------------------------------------------------

  // App Readiness
  const [isAppReady, setIsAppReady] = useState(false);

  // Tab Animation Variants
  const tabVariants = {
    initial: { opacity: 0, y: 10, scale: 0.99 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.99 },
    transition: { duration: 0.2, ease: "easeInOut" }
  };

  // Data
  const [choir, setChoir] = useState<Choir | null>(null);
  const [services, setServices] = useState<Service[]>([]);
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
  const [viewingMemberStats, setViewingMemberStats] = useState<ChoirMember | null>(null);
  const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [showChoirSettings, setShowChoirSettings] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSendNotificationModal, setShowSendNotificationModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Manager/Admin States
  const [managerMode, setManagerMode] = useState<'list' | 'create' | 'join'>('list');
  const [newChoirName, setNewChoirName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [managerLoading, setManagerLoading] = useState(false);
  const [managerError, setManagerError] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deletingAdminCode, setDeletingAdminCode] = useState<string | null>(null);
  const [newAdminLabel, setNewAdminLabel] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [creatingAdminCode, setCreatingAdminCode] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [editChoirName, setEditChoirName] = useState("");
  const [savingChoirSettings, setSavingChoirSettings] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

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
  useEffect(() => {
    if (!activeTabRaw) {
      const stored = localStorage.getItem('activeTab');
      if (stored === 'songs' || stored === 'members') {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('tab', stored);
        router.replace(`/?${newParams.toString()}`, { scroll: false });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for view=account query param (e.g. returning from Privacy/Terms)
  useEffect(() => {
    if (searchParams.get('view') === 'account') {
      setShowAccount(true);
      // Optional: Clear the param so it doesn't reopen on refresh,
      // but keeping it might be better for "persistence" behavior.
      // For now, let's keep it simple.
    }
  }, [searchParams]);

  const setActiveTab = (tab: 'home' | 'songs' | 'members') => {
    localStorage.setItem('activeTab', tab);
    const newParams = new URLSearchParams(searchParams.toString());
    if (tab === 'home') {
      newParams.delete('tab');
      localStorage.setItem('activeTab', 'home');
    } else {
      newParams.set('tab', tab);
    }
    router.replace(`/?${newParams.toString()}`, { scroll: false });
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
  const renderMemberCard = (member: ChoirMember, index: number = 0) => {
    const absences = getAbsenceCount(member.id);
    return (
      <motion.div
        layout
        key={member.id}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.4) }}
        className="p-4 bg-surface card-shadow rounded-2xl flex items-center justify-between group hover:bg-surface-highlight transition-colors"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewingMemberStats(member)}
            className="w-10 h-10 rounded-full bg-surface-highlight flex items-center justify-center text-text-primary font-bold text-sm relative hover:ring-2 hover:ring-primary/50 transition-all active:scale-95"
          >
            {member.name?.[0]?.toUpperCase() || "?"}
            {absences > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {absences}
              </span>
            )}
            {member.hasAccount && (
              <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-0.5 rounded-full border-2 border-surface" title="App User">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            )}
          </button>

          <div
            onClick={() => {
              if (canEdit) {
                setEditingMember(member);
                setShowEditMemberModal(true);
              }
            }}
            className={canEdit ? 'cursor-pointer' : ''}
          >
            <div className="text-text-primary font-bold flex items-center gap-2 mb-1">
              {member.name}
              {getVoiceBadge(member.voice)}
              {member.hasAccount && <span className="text-[10px] bg-blue-500/10 text-blue-400 mb-0.5 px-1.5 rounded-sm flex items-center gap-1">📱 APP</span>}
            </div>
            <div className="flex items-center gap-2">
              {getRoleBadge(member.role)}
              {absences > 0 && (
                <span className="text-[10px] text-orange-400">
                  {absences} {absences === 1 ? 'пропуск' : absences < 5 ? 'пропуски' : 'пропусків'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewingMemberStats(member)}
            className="text-text-secondary/50 hover:text-primary transition-colors p-2 hover:bg-surface rounded-lg"
          >
            <BarChart2 className="w-4 h-4" />
          </button>

          {canEdit && (
            <button
              onClick={() => {
                setEditingMember(member);
                setShowEditMemberModal(true);
              }}
              className="text-text-secondary/50 group-hover:text-text-primary transition-colors p-2 hover:bg-surface rounded-lg"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  // ------------------------------------------------------------------
  //  CORE APP INITIALIZATION
  // ------------------------------------------------------------------
  useEffect(() => {
    // 1. Wait for Auth Context
    if (authLoading) return;

    // 2. Unauthenticated -> Redirect to Setup
    if (!user || !userData?.choirId) {
      router.replace("/setup");
      return;
    }

    // 3. Authenticated -> Load Data
    const choirId = userData.choirId;

    let servicesLoaded = false;
    let choirLoaded = false;

    const checkReady = () => {
      console.log('Checks:', { servicesLoaded, choirLoaded });
      if (servicesLoaded && choirLoaded) {
        console.log('App Ready!');
        setIsAppReady(true);
      }
    };

    const qServices = query(firestoreCollection(db, `choirs/${choirId}/services`));
    const unsubServices = onSnapshot(qServices, (snapshot) => {
      const fetchedServices = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Service))
        .filter(s => !s.deletedAt);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = fetchedServices.filter(s => new Date(s.date) >= today)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const past = fetchedServices.filter(s => new Date(s.date) < today)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const sortedServices = [...upcoming, ...past];
      setServices(sortedServices);

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
    });

    return () => {
      unsubServices();
      unsubChoir();
    };

  }, [authLoading, user, userData?.choirId, router]);

  // URL Sync Effect (Service ID, Join Code)
  useEffect(() => {
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
        router.replace(`/?${newParams.toString()}`, { scroll: false });

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
        }
      }
    }
  }, [searchParams, services, choir, router]);

  // Load registered users when "App Users" filter is active
  useEffect(() => {
    if (memberFilter === 'real' && userData?.choirId) {
      setLoadingRegisteredUsers(true);
      getChoirUsers(userData.choirId).then(users => {
        setRegisteredUsers(users);
        setLoadingRegisteredUsers(false);
      }).catch(() => {
        setLoadingRegisteredUsers(false);
      });
    }
  }, [memberFilter, userData?.choirId]);

  // Sync selectedService REVERTED due to infinite preloader bug. 
  // We will re-implement safer sync later.

  // Handle Service Selection with URL sync
  const handleSelectService = (service: Service | null) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (service) {
      newParams.set('serviceId', service.id);
      router.push(`/?${newParams.toString()}`, { scroll: false });
      // State update will happen via useEffect or we can set it eagerly
      setSelectedService(service);
    } else {
      newParams.delete('serviceId');
      // If we are "going back", we might want router.back() if history length > 1, 
      // but replacing is safer to just clear the param if clicked "Back" button in UI.
      // However, if user clicks browser back, searchParams changes automatically.
      // If user clicks UI back button, we should remove param.
      router.back(); // This mimics browser back, which typically removes the last pushed state
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/setup");
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
    window.location.reload();
  };

  const handleCreateChoir = async () => {
    if (!user || !newChoirName.trim()) return;
    setManagerLoading(true);
    try {
      const memberCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const regentCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const choirData = {
        name: newChoirName.trim(),
        memberCode,
        regentCode,
        createdAt: new Date().toISOString(),
        regents: [userData?.name || "Head"],
        members: [{
          id: user.uid,
          name: userData?.name || "Користувач",
          role: 'head'
        }]
      };

      const choirRef = await addDoc(firestoreCollection(db, "choirs"), choirData);

      await createUser(user.uid, {
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
      window.location.reload();

    } catch (e) {
      console.error(e);
      setManagerError("Помилка створення");
    } finally {
      setManagerLoading(false);
    }
  };

  const handleJoinChoir = async () => {
    if (!user || !joinCode || joinCode.length !== 6) return;
    setManagerLoading(true);
    try {
      const codeUpper = joinCode.toUpperCase();
      const qMember = query(firestoreCollection(db, "choirs"), where("memberCode", "==", codeUpper));
      const qRegent = query(firestoreCollection(db, "choirs"), where("regentCode", "==", codeUpper));

      const [snapMember, snapRegent] = await Promise.all([getDocs(qMember), getDocs(qRegent)]);

      let foundChoirId = "";
      let role: 'member' | 'regent' = 'member';
      let foundChoirName = "";
      let permissions: Permission[] | undefined = undefined;

      if (!snapRegent.empty) {
        foundChoirId = snapRegent.docs[0].id;
        role = 'regent';
        foundChoirName = snapRegent.docs[0].data().name;
      } else if (!snapMember.empty) {
        foundChoirId = snapMember.docs[0].id;
        role = 'member';
        foundChoirName = snapMember.docs[0].data().name;
      } else {
        // Check adminCodes in all choirs
        const allChoirsSnap = await getDocs(firestoreCollection(db, "choirs"));
        for (const choirDoc of allChoirsSnap.docs) {
          const choirData = choirDoc.data();
          const adminCodes = choirData.adminCodes || [];
          const matchingCode = adminCodes.find((ac: any) => ac.code === codeUpper);
          if (matchingCode) {
            foundChoirId = choirDoc.id;
            foundChoirName = choirData.name;
            role = 'member';
            permissions = matchingCode.permissions;
            break;
          }
        }

        if (!foundChoirId) {
          setManagerError("Код не знайдено");
          setManagerLoading(false);
          return;
        }
      }

      const isAlreadyMember = userData?.memberships?.some(m => m.choirId === foundChoirId);
      const currentMembership = userData?.memberships?.find(m => m.choirId === foundChoirId);

      // If already a member, check if we should upgrade role or add permissions
      if (isAlreadyMember) {
        // Check if this is a role upgrade (member -> regent)
        const isRoleUpgrade = role === 'regent' && currentMembership?.role !== 'regent' && currentMembership?.role !== 'head';

        if (isRoleUpgrade || (permissions && permissions.length > 0)) {
          const userRef = doc(db, "users", user.uid);
          const choirRef = doc(db, "choirs", foundChoirId);

          // Build update for user document
          const userUpdate: any = {};
          if (isRoleUpgrade) {
            userUpdate.role = 'regent';
            // Update membership in the memberships array
            const updatedMemberships = userData?.memberships?.map(m =>
              m.choirId === foundChoirId ? { ...m, role: 'regent' } : m
            ) || [];
            userUpdate.memberships = updatedMemberships;
          }
          if (permissions && permissions.length > 0) {
            const existingPermissions = userData?.permissions || [];
            userUpdate.permissions = [...new Set([...existingPermissions, ...permissions])];
          }
          await updateDoc(userRef, userUpdate);

          // Also update in choir.members
          const choirSnap = await getDoc(choirRef);
          if (choirSnap.exists()) {
            const choirData = choirSnap.data();
            const updatedMembers = choirData.members?.map((m: any) => {
              if (m.id === user.uid) {
                const updates: any = {};
                if (isRoleUpgrade) updates.role = 'regent';
                if (permissions && permissions.length > 0) {
                  const memberPermissions = m.permissions || [];
                  updates.permissions = [...new Set([...memberPermissions, ...permissions])];
                }
                return { ...m, ...updates };
              }
              return m;
            }) || [];
            await updateDoc(choirRef, { members: updatedMembers });
          }

          await refreshProfile();
          window.location.reload();
        } else {
          setManagerError("Ви вже є учасником цього хору");
          setManagerLoading(false);
          return;
        }
      } else {
        // New member - add them
        const memberData: any = {
          id: user.uid,
          name: userData?.name || "Користувач",
          role: role
        };
        if (permissions && permissions.length > 0) {
          memberData.permissions = permissions;
        }

        const choirRef = doc(db, "choirs", foundChoirId);
        await updateDoc(choirRef, {
          members: arrayUnion(memberData)
        });

        const userDataToSave: any = {
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
          userDataToSave.permissions = permissions;
        }

        await createUser(user.uid, userDataToSave);

        await refreshProfile();
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
      setManagerError("Помилка приєднання");
    } finally {
      setManagerLoading(false);
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
    const oldName = userData?.name;
    setSavingName(true);
    try {
      // 1. Update User Profile
      await createUser(user.uid, { name: finalName });
      await refreshProfile();

      // 2. Update Choir Data if applicable
      if (userData?.choirId && choir) {
        const updatedMembers = (choir.members || []).map(m =>
          m.id === user.uid ? { ...m, name: finalName } : m
        );

        let updatedRegents = [...(choir.regents || [])];
        if (oldName && updatedRegents.includes(oldName)) {
          updatedRegents = updatedRegents.map(r => r === oldName ? finalName : r);
        }

        // Also update knownConductors if present?
        // Risky without IDs, but let's assume unique names or user intent.
        // Actually, let's leave knownConductors alone to avoid side effects on other people with same name,
        // unless we are sure. The user specifically mentioned "first regent" which is likely from `regents`.

        const choirRef = doc(db, "choirs", userData.choirId);
        await updateDoc(choirRef, {
          members: updatedMembers,
          regents: updatedRegents
        });
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

    const existingIndex = (choir.members || []).findIndex(m => m.id === member.id);
    const updatedMembers = [...(choir.members || [])];

    if (existingIndex >= 0) {
      updatedMembers[existingIndex] = member;
    } else {
      updatedMembers.push(member);
    }

    try {
      await updateChoirMembers(userData.choirId, updatedMembers);
      setChoir({ ...choir, members: updatedMembers });
      setShowEditMemberModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMerge = async (targetMemberId: string) => {
    if (!choir || !userData?.choirId || !mergingMember) return;

    try {
      await mergeMembers(userData.choirId, mergingMember.id, targetMemberId);

      // Update local state by removing the merged member
      const updatedMembers = (choir.members || []).filter(m => m.id !== mergingMember.id);
      setChoir({ ...choir, members: updatedMembers });

      setMergingMember(null);
      // Optionally reload services to refresh attendance counts, but not strictly necessary for UI list
      // await fetchChoirData(); // Listener handles updates 
    } catch (e) {
      console.error(e);
      alert("Не вдалося об'єднати учасників");
    }
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
      // 1. Clean up Firestore
      await deleteUserAccount(user.uid);
      // 2. Delete Auth User
      await user.delete();
      // Navigation handles itself (auth state change)
    } catch (error) {
      console.error("Delete Account Error:", error);
      // If requires re-login (common for sensitive actions)
      setManagerError("Для видалення потрібно перезайти в акаунт");
    }
  };

  // Count absences for a member across all services
  const getAbsenceCount = (memberId: string): number => {
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
  // This is the SINGLE barrier that prevents flash of default state.
  // We only render the Dashboard if isAppReady is true.
  // Otherwise, we show the splash screen.
  if (!isAppReady) {
    return <Preloader />;
  }


  // Show Statistics
  if (showStats && choir) {
    return (
      <StatisticsView
        choir={choir}
        services={services}
        onBack={() => setShowStats(false)}
      />
    );
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
        />
      </main>
    );
  }

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; className: string }> = {
      head: { label: "Регент", className: "bg-primary/10 text-primary border border-primary/20" },
      regent: { label: "Регент", className: "bg-primary/10 text-primary border border-primary/20" },
      member: { label: "Хорист", className: "bg-surface-highlight text-text-secondary border border-border" },
    };
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

  return (
    <main className="min-h-screen bg-background pb-24 selection:bg-white/30">
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
                      <button
                        key={m.choirId}
                        onClick={() => handleSwitchChoir(m)}
                        className="w-full p-4 rounded-2xl bg-surface-highlight border border-border hover:bg-surface-highlight/80 flex items-center justify-between transition-all"
                      >
                        <div className="text-left">
                          <p className="text-text-primary font-bold">{m.choirName}</p>
                          <p className="text-xs text-text-secondary uppercase">{m.role === 'head' ? 'Регент' : m.role === 'regent' ? 'Регент' : 'Хорист'}</p>
                        </div>
                        <Repeat className="w-4 h-4 text-text-secondary" />
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <button onClick={() => setManagerMode('create')} className="p-3 bg-primary text-background rounded-xl text-sm font-bold hover:opacity-90">
                      Створити
                    </button>
                    <button onClick={() => setManagerMode('join')} className="p-3 bg-surface-highlight text-text-primary rounded-xl text-sm font-bold hover:bg-surface-highlight/80 border border-border">
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
                  <button
                    onClick={handleCreateChoir}
                    disabled={managerLoading}
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
                    disabled={managerLoading}
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

      {/* Member Stats Modal */}
      {viewingMemberStats && (
        <MemberStatsModal
          member={viewingMemberStats}
          services={services}
          onClose={() => setViewingMemberStats(null)}
        />
      )}

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
            <div className="p-4 border-b border-border pt-[calc(1rem+env(safe-area-inset-top))]" style={{ background: 'var(--surface)' }}>
              <button
                onClick={() => setShowAccount(false)}
                className="flex items-center gap-2 text-text-primary font-medium hover:text-text-secondary transition-colors py-1"
              >
                <ChevronLeft className="w-5 h-5" />
                Назад
              </button>
            </div>

            <div className="max-w-md mx-auto w-full h-full flex flex-col p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold text-text-primary tracking-tight">Акаунт</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowNotificationModal(true)}
                    className="p-2 rounded-full hover:bg-surface-highlight transition-colors relative"
                    title="Сповіщення"
                  >
                    {unreadNotifications > 0 ? (
                      <>
                        <Bell className="w-5 h-5 text-text-secondary" />
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
                      </>
                    ) : (
                      <Bell className="w-5 h-5 text-text-secondary" />
                    )}
                  </button>
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

                      <div className="space-y-3">
                        <button
                          onClick={() => copyCode(`https://${window.location.host}/setup?code=${choir.memberCode}`)}
                          className="w-full flex items-center justify-between py-2 group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-text-secondary text-sm">Хористи</span>
                            <code className="text-lg font-mono font-bold text-text-primary">{choir.memberCode}</code>
                          </div>
                          {copiedCode === `https://${window.location.host}/setup?code=${choir.memberCode}`
                            ? <Check className="w-4 h-4 text-success" />
                            : <Link2 className="w-4 h-4 text-text-secondary group-hover:text-accent transition-colors" />}
                        </button>

                        <button
                          onClick={() => copyCode(`https://${window.location.host}/setup?code=${choir.regentCode}`)}
                          className="w-full flex items-center justify-between py-2 group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-text-secondary text-sm">Регенти</span>
                            <code className="text-lg font-mono font-bold text-text-primary">{choir.regentCode}</code>
                          </div>
                          {copiedCode === `https://${window.location.host}/setup?code=${choir.regentCode}`
                            ? <Check className="w-4 h-4 text-success" />
                            : <Link2 className="w-4 h-4 text-text-secondary group-hover:text-accent transition-colors" />}
                        </button>

                        {/* Admin Codes - inline */}
                        {choir.adminCodes && choir.adminCodes.length > 0 && choir.adminCodes.map((ac, idx) => (
                          <SwipeableCard
                            key={idx}
                            onDelete={() => setDeletingAdminCode(ac.code)}
                            disabled={false}
                          >
                            <button
                              onClick={() => copyCode(`https://${window.location.host}/setup?code=${ac.code}`)}
                              className="w-full flex items-center justify-between py-2 group"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-text-secondary text-sm">{ac.label || 'Адмін'}</span>
                                <code className="text-sm font-mono font-bold text-text-primary">{ac.code}</code>
                              </div>
                              {copiedCode === `https://${window.location.host}/setup?code=${ac.code}`
                                ? <Check className="w-4 h-4 text-success" />
                                : <Link2 className="w-4 h-4 text-text-secondary group-hover:text-accent transition-colors" />}
                            </button>
                          </SwipeableCard>
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
                  <span>Служба підтримки</span>
                </a>

                <button
                  onClick={() => setShowLegalModal(true)}
                  className="w-full py-4 text-left text-lg font-medium text-text-primary hover:text-primary border-t border-border transition-all flex items-center gap-4 group"
                >
                  <Shield className="w-5 h-5 text-text-secondary" />
                  <span>Політика конфіденційності</span>
                </button>

                <button
                  onClick={() => setShowHelpModal(true)}
                  className="w-full py-4 text-left text-lg font-medium text-text-primary hover:text-primary border-t border-border transition-all flex items-center gap-4 group"
                >
                  <FileText className="w-5 h-5 text-text-secondary" />
                  <span>Умови використання</span>
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
      <header className="bg-surface/80 backdrop-blur-2xl sticky top-0 z-30 border-b border-border shadow-[0_4px_20px_rgba(0,0,0,0.06)] pt-[env(safe-area-inset-top)] transition-all">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
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

          {/* Center: Theme Toggle (flex centered) */}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center bg-surface-highlight border border-border rounded-full p-0.5">
              <button
                onClick={() => setTheme('light')}
                className={`p-2 rounded-full transition-all duration-200 ${theme === 'light' ? 'bg-primary text-background shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                title="Світла тема"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-2 rounded-full transition-all duration-200 ${theme === 'dark' ? 'bg-primary text-background shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                title="Темна тема"
              >
                <Moon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`p-2 rounded-full transition-all duration-200 ${theme === 'system' ? 'bg-primary text-background shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                title="Як на пристрої"
              >
                <Monitor className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Account Button */}
          <button
            onClick={() => setShowAccount(true)}
            className="w-10 h-10 shrink-0 rounded-full border border-border hover:border-accent/50 transition-colors overflow-hidden"
          >
            <div className="w-full h-full bg-primary text-background flex items-center justify-center font-bold text-sm">
              <span>{userData?.name?.[0]?.toUpperCase() || "U"}</span>
            </div>
          </button>
        </div>
      </header>

      {/* Tab Content */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={tabVariants}
            >
              <ServiceList onSelectService={handleSelectService} canEdit={canEdit} services={services} />
            </motion.div>
          )}

          {activeTab === 'songs' && (
            <motion.div
              key="songs"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={tabVariants}
            >
              <SongList
                canAddSongs={canAddSongs}
                regents={choir?.regents || []}
                knownConductors={choir?.knownConductors || []}
                knownCategories={choir?.knownCategories || []}
                knownPianists={choir?.knownPianists || []}
              />
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div
              key="members"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={tabVariants}
            >
              <div className="max-w-md mx-auto p-4 pb-32">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-text-primary">Учасники</h2>
                    <button
                      onClick={() => setShowStats(true)}
                      className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <BarChart2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {(canEdit || userData?.permissions?.includes('notify_members')) && (
                      <button
                        onClick={() => setShowSendNotificationModal(true)}
                        className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                        title="Надіслати сповіщення"
                      >
                        <Bell className="w-5 h-5" />
                      </button>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => { setEditingMember(null); setShowEditMemberModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        Додати
                      </button>
                    )}
                  </div>
                </div>

                {/* Filters */}
                <div className="flex overflow-x-auto gap-2 scrollbar-hide -mx-4 px-4 pb-1 mb-6">
                  {['Всі', 'Soprano', 'Alto', 'Tenor', 'Bass', ...(canEdit ? ['Real Users'] : [])].map(filter => {
                    return (
                      <button
                        key={filter}
                        onClick={() => setMemberFilter(filter === 'Всі' ? '' : filter === 'Real Users' ? 'real' : filter)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${(memberFilter === (filter === 'Всі' ? '' : filter === 'Real Users' ? 'real' : filter))
                          ? 'bg-primary text-background'
                          : 'bg-surface text-text-secondary shadow-sm border border-border'
                          }`}
                      >
                        {filter === 'Real Users' ? '📱 App Users' : filter}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-6">
                  {memberFilter === 'real' ? (
                    // Show registered app users from Firebase
                    loadingRegisteredUsers ? (
                      <div className="text-center py-12 text-text-secondary">
                        <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin opacity-50" />
                        <p>Завантаження...</p>
                      </div>
                    ) : registeredUsers.length === 0 ? (
                      <div className="text-center py-12 text-text-secondary">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Немає зареєстрованих користувачів</p>
                        <p className="text-sm mt-2">Користувачі з'являться тут після входу через Google або email</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {registeredUsers.map(appUser => (
                          <div
                            key={appUser.id}
                            className="p-4 bg-surface card-shadow rounded-2xl flex items-center justify-between group hover:bg-surface-highlight transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                                {appUser.name?.[0]?.toUpperCase() || appUser.email?.[0]?.toUpperCase() || "?"}
                              </div>
                              <div>
                                <div className="text-text-primary font-bold flex items-center gap-2 mb-1">
                                  {appUser.name || 'Без імені'}
                                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 rounded-sm">📱 APP</span>
                                  {appUser.role && (
                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded-sm uppercase">{appUser.role}</span>
                                  )}
                                </div>
                                <div className="text-text-secondary text-xs">
                                  {canEdit && appUser.email}
                                  {appUser.voice && <span className="ml-2 text-primary">{appUser.voice}</span>}
                                </div>
                              </div>
                            </div>

                            {canEdit && (
                              <button
                                onClick={() => setUserToDelete(appUser)}
                                className="text-text-secondary/50 hover:text-danger transition-colors p-2 hover:bg-danger/10 rounded-lg"
                                title="Видалити користувача"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  ) : (choir?.members || []).length === 0 ? (
                    <div className="text-center py-12 text-text-secondary">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Немає учасників</p>
                      {canEdit && <p className="text-sm mt-2">Додайте учасників, щоб відстежувати відвідуваність</p>}
                    </div>
                  ) : (
                    (() => {
                      const filtered = (choir?.members || []).filter(m => {
                        if (!memberFilter) return true;
                        return m.voice === memberFilter;
                      });

                      // User requested flat list for "All" (no grouping)
                      // Sorting: Alphabetical by name
                      const sortedMembers = [...filtered].sort((a, b) =>
                        (a.name || '').localeCompare(b.name || '', 'uk')
                      );

                      if (sortedMembers.length === 0) {
                        return <div className="text-center py-8 text-text-secondary">Нікого не знайдено</div>;
                      }

                      return (
                        <div className="space-y-2">
                          <AnimatePresence mode="popLayout">
                            {sortedMembers.map((member, index) => renderMemberCard(member, index))}
                          </AnimatePresence>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Stats summary */}
                {services.length > 0 && (choir?.members || []).length > 0 && !memberFilter && (
                  <div className="mt-8 p-4 bg-surface card-shadow rounded-2xl">
                    <p className="text-text-primary text-sm font-bold mb-2">📊 Статистика</p>
                    <p className="text-text-secondary text-sm">
                      Всього служінь: {services.length} • Учасників: {choir?.members?.length || 0}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div >

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl px-4 pb-safe pt-2 z-50 border-t border-border">
        <div className="max-w-md mx-auto flex justify-around items-center h-16 relative">

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
                className={`flex flex-col items-center gap-1 flex-1 p-2 transition-colors ${isActive ? 'text-primary' : 'text-text-secondary'}`}
              >
                <tab.icon className={`w-6 h-6 transition-all duration-200 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className={`text-[10px] uppercase tracking-wide transition-all duration-200 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
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
                      placeholder="Введіть нове ім'я"
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
              await deleteUserAccount(userToDelete.id);
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

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />

      {/* Account sub-modals (portaled to document.body) */}
      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        onOpenPrivacy={() => {
          setShowLegalModal(false);
          router.push('/privacy');
        }}
        onOpenTerms={() => {
          setShowLegalModal(false);
          router.push('/terms');
        }}
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
