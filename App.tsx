import React, { useState, useEffect } from 'react';
import { Navigation, NavTab } from './components/Navigation';
import { HomeClock } from './components/HomeClock';
import { TasksManager } from './components/TasksManager';
import { Scratchpad } from './components/Scratchpad';
import { MaterialsWorkspace } from './components/MaterialsWorkspace';
import { FriendsView } from './components/FriendsView';
import { AccountModal } from './components/AccountModal';
import { WelcomeModal } from './components/WelcomeModal';
import { DomainAuthorizationBanner } from './components/DomainAuthorizationBanner';
import {
  initAuth,
  signInWithGoogle,
  fetchUserProfile,
  saveUserProfile,
  checkHandleAvailability,
  UserProfileData,
  syncTasksToCloud,
  syncNotesToCloud,
  syncMaterialToCloud,
} from './utils/firebase';
import { recordDailyVisit, getLocalDateString, updateUsername } from './utils/streaks';
import { getAllMaterials } from './utils/indexedDB';
import { User } from 'firebase/auth';

const ACTIVE_TAB_STORAGE_KEY = 'liquid_glass_active_tab';
const THEME_STORAGE_KEY = 'liquid_glass_theme_mode';
const LOCAL_PROFILE_KEY = 'liquid_glass_user_profile';
const ONBOARDING_COMPLETED_KEY = 'lumina_onboarding_completed';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
      if (
        saved === 'HOME' ||
        saved === 'TASKS' ||
        saved === 'NOTES' ||
        saved === 'MATERIALS' ||
        saved === 'FRIENDS'
      ) {
        return saved as NavTab;
      }
    } catch (e) {}
    return 'HOME';
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return 'dark';
  });

  // Auth & Profile state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileData>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PROFILE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      displayName: 'User',
      handle: '',
      email: '',
      currentStreak: 1,
      longestStreak: 1,
      lastVisitDate: getLocalDateString(new Date()),
    };
  });

  // Welcome modal state: Google Sign-In is compulsory to claim and verify User ID
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState<boolean>(() => {
    try {
      const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
      const savedProfile = localStorage.getItem(LOCAL_PROFILE_KEY);
      if (completed === 'true' && savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if (parsed.handle && parsed.email) {
          return false;
        }
      }
      return true;
    } catch (e) {
      return true;
    }
  });

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [hasLocalData, setHasLocalData] = useState(true);

  // Apply theme classes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Auth listener
  useEffect(() => {
    const localVisit = recordDailyVisit();
    const unsubscribe = initAuth(
      async (user) => {
        setCurrentUser(user);
        setSyncStatus('syncing');

        // Immediate baseline profile using existing chosen handle if available
        const fallbackHandle =
          profile.handle ||
          (user.email ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') : user.uid.slice(0, 8));

        let userProfile: UserProfileData = {
          displayName: profile.displayName !== 'User' ? profile.displayName : user.displayName || 'User',
          handle: profile.handle || fallbackHandle,
          email: user.email || '',
          photoURL: user.photoURL || '',
          currentStreak: localVisit.currentStreak,
          longestStreak: localVisit.longestStreak,
          lastVisitDate: localVisit.lastVisitDate,
        };

        try {
          const remoteProfile = await fetchUserProfile(user.uid);
          const today = getLocalDateString(new Date());

          if (!remoteProfile) {
            // First time cloud profile creation - preserve locally chosen handle and name!
            await saveUserProfile(user.uid, userProfile);
          } else {
            // Use remote profile, but if remote has no handle yet, supply local handle
            userProfile = {
              ...remoteProfile,
              displayName: profile.displayName && profile.displayName !== 'User' ? profile.displayName : (remoteProfile.displayName || userProfile.displayName),
              handle: profile.handle || remoteProfile.handle || fallbackHandle,
              currentStreak: localVisit.currentStreak,
              longestStreak: Math.max(localVisit.longestStreak, remoteProfile.longestStreak || 0),
              lastVisitDate: today,
            };
            saveUserProfile(user.uid, userProfile).catch(() => {});
          }

          setProfile(userProfile);
          localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(userProfile));
          updateUsername(userProfile.displayName);
          setSyncStatus('synced');
        } catch (err) {
          console.warn('Error during profile sync:', err);
          setSyncStatus('offline');
        }
      },
      () => {
        setCurrentUser(null);
        setSyncStatus('offline');
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSelectTab = (tab: NavTab) => {
    setCurrentTab(tab);
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
    } catch (e) {}
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [unauthorizedDomainAlert, setUnauthorizedDomainAlert] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setSyncStatus('syncing');
      await signInWithGoogle();
      setSyncStatus('synced');
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        const host = err.unauthorizedDomain || (typeof window !== 'undefined' ? window.location.hostname : '');
        setUnauthorizedDomainAlert(host);
      } else if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.warn('Sign-in cancelled or failed:', err?.message || err);
      }
      setSyncStatus('offline');
    }
  };

  // Welcome onboarding completion: Google Sign-In is COMPULSORY to claim and protect User ID
  const handleCompleteOnboarding = async (data: {
    displayName: string;
    handle: string;
  }) => {
    // 1. Verify handle availability before opening popup
    const availabilityCheck = await checkHandleAvailability(data.handle);
    if (!availabilityCheck.available && !availabilityCheck.message.includes('valid')) {
      throw new Error(availabilityCheck.message);
    }

    setSyncStatus('syncing');
    const res = await signInWithGoogle();
    if (!res?.user) {
      setSyncStatus('offline');
      throw new Error('Google sign-in was not completed.');
    }

    const user = res.user;

    // Check if this Google account already had an existing profile
    const existingCloudProfile = await fetchUserProfile(user.uid);
    let finalProfile: UserProfileData;

    if (existingCloudProfile && existingCloudProfile.handle) {
      // Returning user: keep their registered handle
      finalProfile = {
        ...existingCloudProfile,
        displayName: data.displayName || existingCloudProfile.displayName || user.displayName || 'User',
      };
    } else {
      // New account: verify handle isn't taken by anyone else
      const finalCheck = await checkHandleAvailability(data.handle, user.uid);
      if (!finalCheck.available && !finalCheck.message.includes('valid')) {
        throw new Error('This User ID was just claimed by another account. Please choose another.');
      }

      finalProfile = {
        displayName: data.displayName || user.displayName || 'User',
        handle: data.handle,
        email: user.email || '',
        photoURL: user.photoURL || '',
        currentStreak: profile.currentStreak || 1,
        longestStreak: profile.longestStreak || 1,
        lastVisitDate: getLocalDateString(new Date()),
      };
      await saveUserProfile(user.uid, finalProfile);
    }

    setCurrentUser(user);
    setProfile(finalProfile);
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(finalProfile));
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    updateUsername(finalProfile.displayName);
    setSyncStatus('synced');
    setIsWelcomeModalOpen(false);
  };

  const handleProfileUpdated = (newProfile: UserProfileData) => {
    setProfile(newProfile);
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(newProfile));
    updateUsername(newProfile.displayName);
    if (currentUser) {
      saveUserProfile(currentUser.uid, newProfile).catch(() => {});
    }
  };

  // Local data migration to cloud
  const handleMigrateLocalData = async () => {
    if (!currentUser) return;
    setSyncStatus('syncing');
    try {
      // 1. Migrate tasks
      const rawTasks = localStorage.getItem('liquid_glass_tasks');
      if (rawTasks) {
        const tasks = JSON.parse(rawTasks);
        await syncTasksToCloud(
          currentUser.uid,
          tasks.map((t: any) => ({
            id: t.id,
            userId: currentUser.uid,
            text: t.text,
            completed: Boolean(t.completed),
            createdAt: t.createdAt || Date.now(),
          }))
        );
      }

      // 2. Migrate notes
      const localNotes = localStorage.getItem('liquid_glass_notes');
      if (localNotes) {
        await syncNotesToCloud(currentUser.uid, localNotes);
      }

      // 3. Migrate materials metadata
      const localMaterials = await getAllMaterials();
      for (const m of localMaterials) {
        await syncMaterialToCloud(currentUser.uid, {
          id: m.id,
          userId: currentUser.uid,
          filename: m.filename,
          fileSize: m.fileSize,
          uploadedAt: m.uploadedAt,
          studyNotes: m.studyNotes || '',
          source: (m as any).driveFileId ? 'drive' : 'local',
          driveFileId: (m as any).driveFileId || null,
        });
      }

      setSyncStatus('synced');
      setHasLocalData(false);
    } catch (err) {
      console.error('Migration failed:', err);
      setSyncStatus('offline');
      throw err;
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-300 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        currentUser={currentUser}
        profile={profile}
        onOpenAccountModal={() => setIsAccountModalOpen(true)}
        onSignInWithGoogle={handleSignIn}
        syncStatus={syncStatus}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Viewport */}
      <main className="flex-1 w-full pb-16">
        {currentTab === 'HOME' && (
          <HomeClock
            profile={profile}
            onNavigateToTab={(tab) => handleSelectTab(tab)}
          />
        )}
        {currentTab === 'TASKS' && <TasksManager />}
        {currentTab === 'NOTES' && (
          <Scratchpad
            currentUser={currentUser}
            onSignInWithGoogle={handleSignIn}
          />
        )}
        {currentTab === 'MATERIALS' && (
          <MaterialsWorkspace currentUser={currentUser} />
        )}
        {currentTab === 'FRIENDS' && (
          <FriendsView
            currentUser={currentUser}
            profile={profile}
            onProfileUpdated={handleProfileUpdated}
            onOpenSignIn={handleSignIn}
            onOpenAccountModal={() => setIsAccountModalOpen(true)}
          />
        )}
      </main>

      {/* 1-Time Initial Welcome / User ID Selection Modal */}
      <WelcomeModal
        isOpen={isWelcomeModalOpen}
        onComplete={handleCompleteOnboarding}
        initialHandle={profile.handle}
        initialName={profile.displayName !== 'User' ? profile.displayName : ''}
      />

      {/* Account / User ID Settings Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        user={currentUser}
        profile={profile}
        onProfileUpdated={handleProfileUpdated}
        onMigrateLocalData={handleMigrateLocalData}
        hasLocalData={hasLocalData}
        isFirstSignIn={false}
      />

      {/* Domain Authorization helper banner if Firebase blocks domain */}
      <DomainAuthorizationBanner
        domain={unauthorizedDomainAlert}
        onClose={() => setUnauthorizedDomainAlert(null)}
      />
    </div>
  );
}
