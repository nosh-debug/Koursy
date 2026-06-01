import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Upload, Eye, EyeOff, Globe, BookOpen, Plus, Shield, Check, X, LogIn, ThumbsUp, Calendar, Star } from 'lucide-react';
import { Course, UserStats } from '../types';
import { useFirebase } from '../context/FirebaseContext';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, deleteDoc, collection, query, where, onSnapshot } from 'firebase/firestore';

interface ProfileTabProps {
  courses: Course[];
  stats: UserStats;
  onUpdateCourses: (courses: Course[]) => void;
  onOpenAuthModal: () => void;
  onUpdateStats?: (stats: UserStats) => void;
}

export default function ProfileTab({
  courses,
  stats,
  onUpdateCourses,
  onOpenAuthModal,
  onUpdateStats,
}: ProfileTabProps) {
  const { user } = useFirebase();
  const [showUploadPicker, setShowUploadPicker] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Followers and Following count are derived in real-time from the 'follows' Firestore collection
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [likesMap, setLikesMap] = useState<Record<string, { likesCount: number; dislikesCount: number }>>({});
  const [sortBy, setSortBy] = useState<'most-liked' | 'least-liked' | 'most-recent' | 'least-recent'>('most-recent');

  useEffect(() => {
    if (!user) {
      setLikesMap({});
      return;
    }

    const q = query(collection(db, 'shared_courses'), where('creatorId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mapping: Record<string, { likesCount: number; dislikesCount: number }> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        mapping[docSnap.id] = {
          likesCount: data.likesCount || 0,
          dislikesCount: data.dislikesCount || 0
        };
      });
      setLikesMap(mapping);
    }, (error) => {
      console.error("Error loading creator courses stats: ", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Try to parse ID or use createdAt date to get a numeric timestamp for sorting
  const getCourseTimestamp = (course: Course): number => {
    if (course.createdAt) {
      try {
        return new Date(course.createdAt).getTime();
      } catch {
        // fallback
      }
    }
    const parts = course.id.split('-');
    const lastPart = parts[parts.length - 1];
    if (lastPart && /^\d+$/.test(lastPart)) {
      const ts = parseInt(lastPart, 10);
      if (ts > 946684800000 && ts < 4102444800000) {
        return ts;
      }
    }
    return 0; // Preset or legacy courses
  };

  const getProfileCourseCreatedDate = (course: Course): string => {
    if (course.createdAt) {
      try {
        return new Date(course.createdAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        // fallback
      }
    }
    const ts = getCourseTimestamp(course);
    if (ts > 0) {
      return new Date(ts).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    return "Preset Course";
  };

  useEffect(() => {
    if (!user) {
      setFollowersCount(0);
      setFollowingCount(0);
      return;
    }

    // Real-time followers count based on follows table where followedId is active user
    const followersQuery = query(collection(db, 'follows'), where('followedId', '==', user.uid));
    const unsubscribeFollowers = onSnapshot(followersQuery, (snapshot) => {
      setFollowersCount(snapshot.size);
    }, (error) => {
      console.error("Error loading profile followers count:", error);
    });

    // Real-time following count based on follows table where followerId is active user
    const followingQuery = query(collection(db, 'follows'), where('followerId', '==', user.uid));
    const unsubscribeFollowing = onSnapshot(followingQuery, (snapshot) => {
      setFollowingCount(snapshot.size);
    }, (error) => {
      console.error("Error loading profile following count:", error);
    });

    return () => {
      unsubscribeFollowers();
      unsubscribeFollowing();
    };
  }, [user]);

  // Fetch only courses created by the user that are currently flagged as public/uploaded
  const publicCourses = courses.filter((c) => c.isPublic === true);
  // Private courses that are available to be uploaded
  const privateCourses = courses.filter((c) => !c.isPublic);

  const sortedPublicCourses = [...publicCourses].sort((a, b) => {
    const likesA = likesMap[a.id]?.likesCount || 0;
    const likesB = likesMap[b.id]?.likesCount || 0;
    const tsA = getCourseTimestamp(a);
    const tsB = getCourseTimestamp(b);

    if (sortBy === 'most-liked') {
      return likesB - likesA;
    } else if (sortBy === 'least-liked') {
      return likesA - likesB;
    } else if (sortBy === 'most-recent') {
      return tsB - tsA;
    } else {
      return tsA - tsB;
    }
  });

  // Publish a course to the community shared courses collection
  const handlePublishCourse = async (course: Course) => {
    if (publicCourses.length >= 5) {
      alert("You have reached the limit of 5 public courses.");
      return;
    }
    if (!user) {
      onOpenAuthModal();
      return;
    }

    setIsProcessing(course.id);
    try {
      // 1. Write the sharing data structure to Firestore `shared_courses` collection
      const sharedRef = doc(db, 'shared_courses', course.id);
      await setDoc(sharedRef, {
        id: course.id,
        creatorId: user.uid,
        creatorName: user.displayName || user.email?.split('@')[0] || 'Learner',
        creatorPhotoURL: user.photoURL || '',
        courseName: course.name,
        description: course.description || '',
        likesCount: 0,
        dislikesCount: 0,
        requiresFollowing: false, // Default to public when first published
        videos: course.videos.map(v => ({ title: v.title, link: v.link || '' }))
      });

      // 2. Set isPublic boolean to true in active local & cloud copy
      const updatedCoursesList = courses.map((c) => {
        if (c.id === course.id) {
          return { ...c, isPublic: true, requiresFollowing: false };
        }
        return c;
      });

      onUpdateCourses(updatedCoursesList);

      // Retrieve/verify community pioneer bonus flag securely from the read-only achievement ledger
      let claimBonus = false;
      const ledgerRef = doc(db, 'users_achievements', user.uid);
      const ledgerSnap = await getDoc(ledgerRef);
      if (!ledgerSnap.exists() || !ledgerSnap.data()?.hasPostedToCommunity) {
        claimBonus = true;
        // Mark achievement immediately in central ledger
        await setDoc(ledgerRef, { hasPostedToCommunity: true }, { merge: true });
      }

      if (onUpdateStats) {
        if (claimBonus) {
          const updatedStats = {
            ...stats,
            xp: (stats.xp || 0) + 150,
            hasPostedToCommunity: true
          };
          onUpdateStats(updatedStats);
          alert("✨ Community Pioneer! You have earned a +150 XP bonus for publishing to the community for the first time!");
        } else if (!stats.hasPostedToCommunity) {
          // If already claimed on server ledger, keep the local profile in sync without re-awarding XP
          const updatedStats = {
            ...stats,
            hasPostedToCommunity: true
          };
          onUpdateStats(updatedStats);
        }
      }
    } catch (error) {
      console.error("Error uploading course:", error);
    } finally {
      setIsProcessing(null);
    }
  };

  // Toggle course privacy (requiresFollowing boolean value)
  const handleToggleCoursePrivacy = async (course: Course, requiresFollow: boolean) => {
    setIsProcessing(course.id);
    try {
      if (user) {
        // 1. Update the document requiresFollowing flag in shared_courses
        const sharedRef = doc(db, 'shared_courses', course.id);
        await setDoc(sharedRef, {
          requiresFollowing: requiresFollow
        }, { merge: true });
      }

      // 2. Set the requiresFollowing local status (works in guest mode too!)
      const updatedCoursesList = courses.map((c) => {
        if (c.id === course.id) {
          return { ...c, requiresFollowing: requiresFollow };
        }
        return c;
      });

      onUpdateCourses(updatedCoursesList);
    } catch (error) {
      console.error("Error toggling course privacy:", error);
    } finally {
      setIsProcessing(null);
    }
  };

  // Withdraw course from community (Unpublish / Make Private)
  const handleWithdrawCourse = async (course: Course) => {
    setIsProcessing(course.id);
    try {
      if (user) {
        // 1. Delete course from shared_courses
        const sharedRef = doc(db, 'shared_courses', course.id);
        await deleteDoc(sharedRef);
      }

      // 2. Toggle local status setting isPublic to false and requiresFollowing to false
      const updatedCoursesList = courses.map((c) => {
        if (c.id === course.id) {
          return { ...c, isPublic: false, requiresFollowing: false };
        }
        return c;
      });

      onUpdateCourses(updatedCoursesList);
    } catch (error) {
      console.error("Error withdrawing course from community:", error);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto w-full max-w-4xl mx-auto space-y-8 animate-fadeIn font-sans scrollbar-thin" id="profile-container">
      
      {/* Profile Info Card - level, xp, streak completely removed per guidelines */}
      <div className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10 w-full">
          
          {/* Avatar frame */}
          <div className="relative">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile Avatar"
                className="w-24 h-24 rounded-2xl object-cover border-4 border-[var(--theme-primary-transparent)] shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-[var(--theme-primary)] text-white flex items-center justify-center font-black text-3xl shadow-md uppercase">
                {user?.displayName ? user.displayName[0] : (user?.email ? user.email[0] : 'K')}
              </div>
            )}
          </div>

          {/* Core metadata details */}
          <div className="flex-1 text-center md:text-left space-y-2">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-center md:justify-start gap-2">
                <h2 className="text-2xl font-black tracking-tight text-gray-800 dark:text-white uppercase leading-none">
                  {user?.displayName || (user?.email ? user.email.split('@')[0] : 'Test Learner')}
                </h2>
                {stats.subscription === 'plus' && (
                  <span className="w-fit bg-amber-400/10 text-amber-500 text-[9px] font-black tracking-widest px-2.5 py-1 rounded-lg uppercase flex items-center gap-1 border border-amber-500/20 leading-none">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Test Plus
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mt-1.5">
                {user?.email || 'Guest Mode (Sync disabled)'}
              </p>
            </div>

            {/* Followers, Following stats pills - Clicking is disabled, fully database authoritative */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <div className="px-4 py-2 bg-gray-50 dark:bg-[#18252d] border-2 border-gray-150 dark:border-[#202f36] rounded-2xl flex items-center gap-2 text-xs font-extrabold text-gray-700 dark:text-gray-300">
                <span className="text-[var(--theme-primary)]">✦</span>
                <span id="followers-count-number" className="font-black text-gray-900 dark:text-white">{followersCount}</span> Followers
              </div>

              <div className="px-4 py-2 bg-gray-50 dark:bg-[#18252d] border-2 border-gray-150 dark:border-[#202f36] rounded-2xl flex items-center gap-2 text-xs font-extrabold text-gray-700 dark:text-gray-300">
                <span>⚡</span>
                <span className="font-black text-gray-900 dark:text-white">{followingCount}</span> Following
              </div>
            </div>
          </div>
        </div>

        {/* Decorative background aura */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-[var(--theme-primary-transparent)] rounded-full blur-[72px] pointer-events-none opacity-40 translate-x-20 -translate-y-20" />
      </div>

      {/* Guest Warning */}
      {!user && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-900/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider text-sm flex items-center justify-center sm:justify-start gap-2">
              <Shield className="w-5 h-5 flex-shrink-0" />
              Sync Your Study Track
            </h4>
            <p className="text-xs font-bold text-amber-700 dark:text-amber-500/90 leading-relaxed max-w-xl">
              You are currently using device-only local guest mode. Sign in to cloud-sync your progress, track followers, and upload your custom playlist courses to the Community!
            </p>
          </div>
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs tracking-wider uppercase rounded-2xl active:scale-95 transition-all shadow-md cursor-pointer whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" />
            Sign In Now
          </button>
        </div>
      )}

      {/* Uploaded Courses List Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-xl font-black tracking-tight text-gray-800 dark:text-white uppercase">
              Uploaded Courses ({publicCourses.length})
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-bold">
              Courses you published and shared as community-wide resources.
            </p>
          </div>

          {user && (
            <button
              onClick={() => setShowUploadPicker(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-750 text-white border-b-4 border-green-800 rounded-2xl font-black text-xs tracking-wider uppercase active:translate-y-0.5 active:border-b-2 transition-all cursor-pointer"
              id="upload-more-courses-btn"
            >
              <Upload className="w-4 h-4" />
              Upload Course
            </button>
          )}
        </div>

        {/* Community Share Permanence Notice */}
        <div className="bg-amber-500/5 dark:bg-amber-950/25 border border-amber-500/20 px-4 py-3.5 rounded-2xl flex items-start gap-3">
          <span className="text-base shrink-0 select-none">⚠️</span>
          <div className="space-y-0.5">
            <h5 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">Sharing Permanent Notice</h5>
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-500 leading-relaxed">
              Once a course template is published to the Community Hub, it is permanent and cannot be deleted or taken down. You can restrict its visibility to followers only if you wish to limit access.
            </p>
          </div>
        </div>

        {publicCourses.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-2 bg-gray-50 dark:bg-[#18252d] p-3 rounded-2xl border border-gray-150 dark:border-[#202f36]">
            <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mr-2">Filter & Sort Uploaded Courses:</span>
            {[
              { id: 'most-recent', label: '📅 Most Recent' },
              { id: 'least-recent', label: '⏳ Least Recent' },
              { id: 'most-liked', label: '🔥 Most Liked' },
              { id: 'least-liked', label: '❄️ Least Liked' }
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setSortBy(option.id as any)}
                className={`px-3 py-1.5 rounded-full border-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  sortBy === option.id
                    ? 'bg-[var(--theme-primary-transparent)] border-[var(--theme-primary)] text-[var(--theme-primary)] font-black'
                    : 'bg-white dark:bg-[#131f24] border-gray-200 dark:border-[#202f36] text-gray-500 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {publicCourses.length === 0 ? (
          <div className="bg-white dark:bg-[#131f24] border-2 border-dashed border-gray-200 dark:border-[#202f36] rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-50 dark:bg-[#18252d] border-2 border-gray-150 dark:border-[#202f36] rounded-2xl flex items-center justify-center mx-auto text-2xl">
              📚
            </div>
            <div className="space-y-1">
              <p className="text-base font-black text-gray-700 dark:text-gray-300">
                No uploaded courses yet
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 max-w-md mx-auto leading-relaxed">
                Click {user ? '"Upload Course"' : '"Sign In"'} to take single-player courses you established and publish them to let other active builders sync, review, and solve chapters.
              </p>
            </div>
            {user && privateCourses.length > 0 && (
              <button
                onClick={() => setShowUploadPicker(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--theme-primary-transparent)] hover:bg-[var(--theme-primary)] hover:text-white border-2 border-[var(--theme-primary)] text-[var(--theme-primary)] text-xs font-black tracking-wider uppercase rounded-2xl transition-all cursor-pointer"
              >
                <span>Select from private courses ({privateCourses.length})</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="public-courses-grid">
            {sortedPublicCourses.map((course) => {
              const isPrivateMode = course.requiresFollowing === true;
              return (
                <div 
                  key={course.id} 
                  className="bg-white dark:bg-[#131f24] rounded-3xl border-2 border-gray-200 dark:border-[#202f36] p-6 flex flex-col justify-between space-y-4 shadow-sm relative group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      {isPrivateMode ? (
                        <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 rounded-lg text-[9px] font-black tracking-widest uppercase flex items-center gap-1">
                          <EyeOff className="w-3 h-3" />
                          Private (Followers only)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/30 rounded-lg text-[9px] font-black tracking-widest uppercase flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          Public on Community
                        </span>
                      )}
                      
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        {course.videos.length} Lectures
                      </span>
                    </div>
                    
                    <h4 className="text-lg font-black text-gray-800 dark:text-white uppercase leading-tight pt-1">
                      {course.name}
                    </h4>

                    {/* Stats bar (likes, date) */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-extrabold text-[#35454e] dark:text-gray-400 leading-none">
                      <span className="flex items-center gap-1 bg-gray-50 dark:bg-[#1c2930] px-2.5 py-1.5 rounded-lg border border-gray-150 dark:border-[#2b3c45]">
                        <ThumbsUp className="w-3 h-3 text-[var(--theme-primary)]" />
                        <span>{likesMap[course.id]?.likesCount || 0} Likes</span>
                      </span>
                      <span className="flex items-center gap-1 bg-gray-50 dark:bg-[#1c2930] px-2.5 py-1.5 rounded-lg border border-gray-150 dark:border-[#2b3c45]">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>Created: {getProfileCourseCreatedDate(course)}</span>
                      </span>
                    </div>
                    
                    {course.description && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-bold line-clamp-2 leading-relaxed pt-1">
                        {course.description}
                      </p>
                    )}
                  </div>

                  <div className="border-t-2 border-gray-100 dark:border-[#202f36] pt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[10px] font-extrabold text-gray-400">
                      <span>ID: {course.id.replace('course-', '')}</span>
                      <span className="text-amber-600 dark:text-amber-400 uppercase tracking-wider font-black flex items-center gap-1">
                        🔒 Permanent Community Share
                      </span>
                    </div>
                    
                    <button
                      onClick={() => handleToggleCoursePrivacy(course, !isPrivateMode)}
                      disabled={isProcessing === course.id}
                      className={`w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all border cursor-pointer disabled:opacity-50 ${
                        isPrivateMode 
                          ? 'bg-green-50 dark:bg-green-950/10 hover:bg-green-500 text-green-600 hover:text-white border-green-200 dark:border-green-900/30' 
                          : 'bg-amber-50 dark:bg-amber-950/10 hover:bg-amber-500 text-amber-600 hover:text-white border-amber-200 dark:border-amber-900/30'
                      }`}
                    >
                      {isPrivateMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>
                        {isProcessing === course.id 
                          ? "Syncing..." 
                          : (isPrivateMode ? "Set Public to All" : "Restrict to Followers Only")
                        }
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload/Publish Picker Modal Backdrop & View */}
      <AnimatePresence>
        {showUploadPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUploadPicker(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm shadow-2xl"
            />

            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-white dark:bg-[#131f24] rounded-3xl border-2 border-gray-200 dark:border-[#202f36] w-full max-w-lg p-6 relative z-10 space-y-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#202f36] pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-green-50 dark:bg-green-950/35 text-green-600 dark:text-green-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-850 dark:text-white uppercase tracking-tight text-lg">
                      Upload Courses
                    </h3>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase">
                      Select which of your private templates to share
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUploadPicker(false)}
                  className="p-1.5 hover:bg-gray-150 dark:hover:bg-[#202f36] rounded-full text-gray-400 hover:text-gray-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {privateCourses.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-sm font-black text-gray-500 dark:text-slate-400">
                      All your courses are already public!
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed max-w-xs mx-auto">
                      Any course you compile inside the primary "Courses" workspace will show up here to upload easily.
                    </p>
                  </div>
                ) : (
                  privateCourses.map((course) => (
                    <div 
                      key={course.id} 
                      className="p-4 bg-gray-50 dark:bg-[#18252d] hover:bg-gray-100/60 dark:hover:bg-[#1a2b34] rounded-2xl border-2 border-gray-150 dark:border-[#202f36] transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <h4 className="font-extrabold text-sm text-gray-800 dark:text-white truncate uppercase">
                          {course.name}
                        </h4>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">
                          {course.videos.length} Lectures • {course.description ? "Has Syllabus" : "No Description"}
                        </p>
                      </div>

                      <button
                        onClick={async () => {
                          await handlePublishCourse(course);
                          // Keep modal open so they can easily upload more, but if none left, they will see it
                        }}
                        disabled={isProcessing === course.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border-b-2 border-green-800 active:translate-y-0.5 active:border-b-0 disabled:opacity-50 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isProcessing === course.id ? "Uploading..." : "Publish"}</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-gray-50 dark:bg-[#18252d] -mx-6 -mb-6 p-4 border-t border-gray-100 dark:border-[#202f36] flex justify-end">
                <button
                  onClick={() => setShowUploadPicker(false)}
                  className="px-4 py-2 hover:bg-gray-200 dark:hover:bg-[#202f36] text-gray-500 dark:text-slate-300 rounded-xl text-xs font-black tracking-wider uppercase transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
