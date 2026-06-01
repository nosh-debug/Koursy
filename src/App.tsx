/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import HomePath from './components/HomePath';
import TestLogo from './components/TestLogo';
import TodayFocus from './components/TodayFocus';
import CoursesList from './components/CoursesList';
import SettingsView from './components/SettingsView';
import AuthModal from './components/AuthModal';
import ResetPasswordModal from './components/ResetPasswordModal';
import CreateCourseModal from './components/CreateCourseModal';
import CommunityTab from './components/CommunityTab';
import ProfileTab from './components/ProfileTab';
import LeaderboardTab from './components/LeaderboardTab';
import SubscriptionTab from './components/SubscriptionTab';
import ShopTab from './components/ShopTab';
import BugReportTab from './components/BugReportTab';
import { loadCourses, loadStats, saveStats, saveCourses } from './storage';
import { Course, UserStats, Video } from './types';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { fetchUserStatsFromDb, fetchUserCoursesFromDb, saveUserStatsToDb, bulkSyncCoursesToDb, deleteCourseFromDb, deleteUserAccountAndData } from './lib/firestoreUtils';

function AppContent() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [currentTab, setTab] = useState<'home' | 'courses' | 'today' | 'settings' | 'community' | 'profile' | 'stats' | 'upgrade' | 'shop' | 'bug_report'>('home');
  const [selectedVideoForFocus, setSelectedVideoForFocus] = useState<Video | null>(null);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });
  const [colorTheme, setColorTheme] = useState<'blue' | 'pink' | 'green' | 'orange'>(() => {
    const saved = localStorage.getItem('colorTheme');
    if (saved === 'pink' || saved === 'green' || saved === 'orange' || saved === 'blue') return saved as any;
    return 'blue';
  });
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('cloud_sync_enabled') === 'true';
  });

  const { user, loading: authLoading } = useFirebase();
  const previousUserRef = useRef<any>(user);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [resetPasswordOobCode, setResetPasswordOobCode] = useState<string | null>(null);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const mode = queryParams.get('mode');
    const oobCode = queryParams.get('oobCode');

    if (mode === 'resetPassword' && oobCode) {
      setResetPasswordOobCode(oobCode);
    }
  }, []);

  const handleToggleCloudSync = (enabled: boolean) => {
    localStorage.setItem('cloud_sync_enabled', enabled ? 'true' : 'false');
    setCloudSyncEnabled(enabled);
    if (enabled && user && stats) {
      saveUserStatsToDb(user.uid, stats).catch(err => console.error("Cloud stats sync error:", err));
      bulkSyncCoursesToDb(user.uid, courses).catch(err => console.error("Cloud courses sync error:", err));
    }
  };

  // Handle dark mode and color theme class synchronization
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.remove('theme-blue', 'theme-pink', 'theme-green', 'theme-orange');
    document.documentElement.classList.add(`theme-${colorTheme}`);
    localStorage.setItem('colorTheme', colorTheme);
  }, [colorTheme]);

  // Clean wipe and factory reset local storage & react state on explicit sign out
  useEffect(() => {
    if (previousUserRef.current !== null && user === null) {
      localStorage.removeItem('duono_courses');
      localStorage.removeItem('duono_stats');
      localStorage.removeItem('theme');
      localStorage.removeItem('colorTheme');
      localStorage.removeItem('password_length');

      setTheme('light');
      setColorTheme('blue');
      setCourses(loadCourses());
      setStats(loadStats());
      setTab('home');
    }
    previousUserRef.current = user;
  }, [user]);

  // Initialize and keep state synchronized on Auth state changes
  useEffect(() => {
    let isMounted = true;

    async function initializeAndSync() {
      if (user) {
        if (cloudSyncEnabled) {
          setIsCloudLoading(true);
          try {
            const cloudStats = await fetchUserStatsFromDb(user.uid);
            const cloudCourses = await fetchUserCoursesFromDb(user.uid);

            if (!isMounted) return;

            if (cloudStats) {
              // Restore from Firebase master copy
              setCourses(cloudCourses);
              setStats(cloudStats);
              saveCourses(cloudCourses);
              saveStats(cloudStats);
            } else {
              // First time Firebase login: Push existing LocalStorage state to the cloud
              const localStats = loadStats();
              const localCourses = loadCourses();
              setCourses(localCourses);
              setStats(localStats);
              await saveUserStatsToDb(user.uid, localStats);
              await bulkSyncCoursesToDb(user.uid, localCourses);
            }
          } catch (err) {
            console.error("Initial Firebase sync failed, falling back to LocalStorage:", err);
            if (isMounted) {
              setCourses(loadCourses());
              setStats(loadStats());
            }
          } finally {
            if (isMounted) setIsCloudLoading(false);
          }
        } else {
          // Cloud sync disabled but logged in: load local store but enforce cloud-authoritative safeguards
          setIsCloudLoading(true);
          try {
            const localStats = loadStats();
            const localCourses = loadCourses();
            const cloudStats = await fetchUserStatsFromDb(user.uid);
            
            if (!isMounted) return;

            if (cloudStats) {
              // Merge critical cloud-authoritative safeguards to prevent local state spoofing
              const mergedStats: UserStats = {
                ...localStats,
                subscription: cloudStats.subscription || 'free',
                hearts: cloudStats.hearts !== undefined ? cloudStats.hearts : localStats.hearts,
                xp: cloudStats.xp !== undefined ? cloudStats.xp : localStats.xp,
                level: cloudStats.level !== undefined ? cloudStats.level : localStats.level,
                hasPostedToCommunity: cloudStats.hasPostedToCommunity !== undefined ? cloudStats.hasPostedToCommunity : localStats.hasPostedToCommunity,
              };
              setCourses(localCourses);
              setStats(mergedStats);
              saveCourses(localCourses);
              saveStats(mergedStats);
            } else {
              setCourses(localCourses);
              setStats(localStats);
            }
          } catch (err) {
            console.error("Failed to merge cloud safeguards:", err);
            if (isMounted) {
              setCourses(loadCourses());
              setStats(loadStats());
            }
          } finally {
            if (isMounted) setIsCloudLoading(false);
          }
        }
      } else {
        // Guest mode/Local only: load local data cleanly (allows fully functional logged-out interface)
        if (isMounted) {
          setCourses(loadCourses());
          setStats(loadStats());
          setIsCloudLoading(false);
        }
      }
    }

    initializeAndSync();

    return () => {
      isMounted = false;
    };
  }, [user, cloudSyncEnabled]);

  if (!stats || authLoading || isCloudLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] dark:bg-[#0c141a] flex items-center justify-center font-sans transition-colors">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin mx-auto mr-auto" />
          <p className="text-gray-500 dark:text-gray-400 font-extrabold text-xs tracking-widest uppercase">
            {authLoading ? "Initializing Test Auth Guard..." : "Syncing Test Cloud State..."}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (resetPasswordOobCode) {
      return (
        <ResetPasswordModal 
          oobCode={resetPasswordOobCode} 
          onClose={() => setResetPasswordOobCode(null)} 
        />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black/60 font-sans">
        <AuthModal isOpen={true} onClose={() => {}} preventClose={true} />
      </div>
    );
  }

  // Active course item
  const activeCourse = courses.find((c) => c.id === stats.activeCourseId) || null;

  // Selected Active study track
  const handleSelectActiveCourse = (courseId: string) => {
    const updatedStats = { ...stats, activeCourseId: courseId } as UserStats;
    setStats(updatedStats);
    saveStats(updatedStats);
    if (user) {
      saveUserStatsToDb(user.uid, updatedStats).catch(err => {
        console.error("Firebase stats save error: ", err);
      });
    }
    setTab('home'); // Route straight back to primary path
  };

  const handleUpdateCourses = (updatedCoursesList: Course[]) => {
    // Enforce limit: Keep only the most recent 5
    const limitedCourses = updatedCoursesList.slice(-5);
    
    if (user && cloudSyncEnabled) {
      const deletedCourses = courses.filter(oldCourse => !limitedCourses.find(updated => updated.id === oldCourse.id));
      deletedCourses.forEach(c => {
        deleteCourseFromDb(user.uid, c.id).catch(console.error);
      });
    }

    setCourses(limitedCourses);
    saveCourses(limitedCourses);
    if (user && cloudSyncEnabled) {
      bulkSyncCoursesToDb(user.uid, limitedCourses).catch(err => {
        console.error("Firebase sync failed for updated courses:", err);
      });
    }
  };

  const handleSessionComplete = (newStats: UserStats) => {
    setStats(newStats);
    if (user) {
      saveUserStatsToDb(user.uid, newStats).catch(err => {
        console.error("Firebase stats save error: ", err);
      });
    }
    // Refresh course progress visual representation
    setCourses(loadCourses());
  };

  const handleUpdateStats = (newStats: UserStats) => {
    setStats(newStats);
    saveStats(newStats);
    if (user) {
      saveUserStatsToDb(user.uid, newStats).catch(err => {
        console.error("Firebase stats save error: ", err);
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (user) {
      try {
        await deleteUserAccountAndData(user.uid);
        await user.delete();
      } catch (err: any) {
        console.error("Firebase Auth/Firestore delete user error:", err);
        throw err;
      }
    }
    localStorage.removeItem('duono_courses');
    localStorage.removeItem('duono_stats');
    localStorage.removeItem('theme');
    window.location.reload();
  };

  return (
    <div className="flex flex-col lg:flex-row bg-[#F7F7F7] dark:bg-[#0c141a] h-[100dvh] lg:h-screen w-full overflow-hidden text-gray-800 dark:text-gray-100 transition-colors duration-300">
      {/* Mobile Sticky Top Header */}
      <div className="shrink-0 lg:hidden bg-white dark:bg-[#131f24] border-b-2 border-gray-200 dark:border-[#202f36] h-16 px-4 flex items-center justify-between sticky top-0 z-40 select-none">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 border border-gray-200 dark:border-[#202f36] hover:bg-gray-50 dark:hover:bg-[#18252d] rounded-xl text-gray-600 dark:text-slate-300 transition-all cursor-pointer"
          id="mobile-sidebar-open-btn"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="flex items-center space-x-2">
          <TestLogo className="w-8 h-8" />
          <span className="text-xl font-black text-[var(--theme-primary)] tracking-wider uppercase">Test</span>
        </div>

        <div className="w-10 h-10 flex items-center justify-center">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="User profile"
              className="w-8 h-8 rounded-lg object-cover border border-slate-250 dark:border-slate-700"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] text-white flex items-center justify-center font-black text-xs">
              {stats?.level || 1}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/40 dark:bg-black/60 z-40 transition-opacity duration-300"
          id="sidebar-overlay-backdrop"
        />
      )}

      {/* Left rail sidebar navigations */}
      <Sidebar
        currentTab={currentTab}
        setTab={setTab}
        stats={stats}
        activeCourse={activeCourse}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        theme={theme}
        setTheme={setTheme}
        cloudSyncEnabled={cloudSyncEnabled}
        onOpenAuthModal={() => setShowAuthModal(true)}
        courses={courses}
        onSelectCourse={handleSelectActiveCourse}
        onCreateCourseClick={() => setShowCreateCourseModal(true)}
      />

      {/* Desktop sidebar open trigger when sidebar is collapsed */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="hidden lg:flex fixed top-6 left-6 z-40 p-3 bg-white dark:bg-[#131f24] hover:bg-gray-100 dark:hover:bg-[#18252d] border-2 border-gray-200 dark:border-[#202f36] hover:border-gray-300 dark:hover:border-[#35454e] hover:scale-105 active:scale-95 text-gray-600 dark:text-slate-300 rounded-2xl shadow-md transition-all cursor-pointer"
          title="Open Navigation"
          id="desktop-sidebar-open-btn"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Main interactive layouts router */}
      <main className={`flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300 ${!isSidebarOpen ? 'lg:pl-16' : ''}`}>
        <div className="flex-1 min-h-0 relative h-full w-full">
          {currentTab === 'home' && (
            <HomePath
              activeCourse={activeCourse}
              stats={stats}
              onSelectVideoForFocus={(video) => setSelectedVideoForFocus(video)}
              setTab={setTab}
              courses={courses}
              onUpdateCourses={handleUpdateCourses}
              isSidebarOpen={isSidebarOpen}
              onUpdateSidebar={setIsSidebarOpen}
              onUpdateStats={handleUpdateStats}
            />
          )}

          {currentTab === 'today' && (
            <TodayFocus
              activeCourse={activeCourse}
              selectedVideo={selectedVideoForFocus}
              setSelectedVideo={setSelectedVideoForFocus}
              onSessionComplete={handleSessionComplete}
              onUpdateCourses={handleUpdateCourses}
              stats={stats}
            />
          )}

          {currentTab === 'courses' && (
            <CoursesList
              courses={courses}
              activeCourseId={stats.activeCourseId}
              onSelectActiveCourse={handleSelectActiveCourse}
              onUpdateCourses={handleUpdateCourses}
              setTab={setTab}
              user={user}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              theme={theme}
              setTheme={setTheme}
              colorTheme={colorTheme}
              setColorTheme={setColorTheme}
              onDeleteAccount={handleDeleteAccount}
              cloudSyncEnabled={cloudSyncEnabled}
              onToggleCloudSync={handleToggleCloudSync}
              onOpenAuth={() => setShowAuthModal(true)}
              stats={stats}
              setTab={setTab}
            />
          )}

          {currentTab === 'community' && (
            <CommunityTab 
              courses={courses}
              onUpdateCourses={handleUpdateCourses}
            />
          )}

          {currentTab === 'profile' && (
            <ProfileTab
              courses={courses}
              stats={stats}
              onUpdateCourses={handleUpdateCourses}
              onOpenAuthModal={() => setShowAuthModal(true)}
              onUpdateStats={handleUpdateStats}
            />
          )}

          {currentTab === 'stats' && (
            <LeaderboardTab 
              stats={stats} 
              onOpenAuthModal={() => setShowAuthModal(true)} 
              onUpdateStats={handleUpdateStats}
            />
          )}

          {currentTab === 'upgrade' && (
            <SubscriptionTab 
              stats={stats}
              onUpdateStats={handleUpdateStats}
              setTab={setTab}
            />
          )}

          {currentTab === 'bug_report' && (
            <BugReportTab />
          )}

          {currentTab === 'shop' && stats && (
            <ShopTab
              stats={stats}
              onUpdateStats={handleUpdateStats}
              setTab={setTab}
              colorTheme={colorTheme}
              setColorTheme={setColorTheme}
            />
          )}
        </div>
      </main>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <CreateCourseModal 
        isOpen={showCreateCourseModal} 
        onClose={() => setShowCreateCourseModal(false)} 
        courses={courses}
        onUpdateCourses={handleUpdateCourses}
        onSelectCourse={handleSelectActiveCourse}
        user={user}
      />
    </div>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <AppContent />
    </FirebaseProvider>
  );
}
