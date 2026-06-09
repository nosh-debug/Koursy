import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Search, Sparkles, BookOpen, FileText, Download, Lock, Check, UserPlus, ArrowLeft, Play, Calendar, X } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { db } from '../lib/firebase-supabase-adapter';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, orderBy } from '../lib/firebase-supabase-adapter';
import { Course } from '../types';

interface CommunityTabProps {
  courses?: Course[];
  onUpdateCourses?: (courses: Course[]) => void;
}

export default function CommunityTab({ courses, onUpdateCourses }: CommunityTabProps) {
  const [sharedCourses, setSharedCourses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTarget, setSearchTarget] = useState<'all' | 'name' | 'description'>('all');
  const [follows, setFollows] = useState<{ followerId: string; followedId: string }[]>([]);
  const [guestFollowing, setGuestFollowing] = useState<string[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, 'like' | 'dislike'>>({});
  const [sortBy, setSortBy] = useState<'most-recent' | 'most-liked'>('most-recent');
  const [creatorSortBy, setCreatorSortBy] = useState<'most-recent' | 'most-liked'>('most-recent');
  const { user } = useFirebase();
  const [profiles, setProfiles] = useState<Record<string, { displayName?: string; photoURL?: string }>>({});

  // Navigation state for viewing creator details
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [selectedCreatorName, setSelectedCreatorName] = useState<string>('');
  const [selectedCreatorPhoto, setSelectedCreatorPhoto] = useState<string>('');

  // Modal previewing course contents before importing
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);

  // Sync real-time profiles from users_profiles collection with Firestore
  useEffect(() => {
    const q = query(collection(db, 'users_profiles'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mapping: Record<string, { displayName?: string; photoURL?: string }> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.uid) {
          mapping[data.uid] = {
            displayName: data.displayName,
            photoURL: data.photoURL
          };
        }
      });
      setProfiles(mapping);
    }, (error) => {
      console.error("Error syncing users_profiles:", error);
    });
    return () => unsubscribe();
  }, []);

  // Sync real-time Shared Courses with Firestore
  useEffect(() => {
    const q = query(collection(db, 'shared_courses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSharedCourses(docsList);
    }, (error) => {
      console.error("Error synchronizing community shared courses:", error);
    });
    return () => unsubscribe();
  }, []);

  // Listen to the entire follows collection to get 100% accurate, fast, real-time metrics & toggles
  useEffect(() => {
    // Sync guest local storage following state
    const guestFollowingStr = localStorage.getItem('guest_following_ids');
    if (guestFollowingStr) {
      try {
        setGuestFollowing(JSON.parse(guestFollowingStr));
      } catch {
        setGuestFollowing([]);
      }
    }

    const q = query(collection(db, 'follows'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        followerId: doc.data().followerId || '',
        followedId: doc.data().followedId || '',
      }));
      setFollows(docs);
    }, (error) => {
      console.error("Error subscribing to follows list:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync real-time User Votes for feedback mapping
  useEffect(() => {
    if (!user || sharedCourses.length === 0) {
      setUserVotes({});
      return;
    }

    const unsubscribes = sharedCourses.map(course => {
      const voteRef = doc(db, 'shared_courses', course.id, 'votes', user.uid);
      return onSnapshot(voteRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserVotes(prev => ({ ...prev, [course.id]: data.vote }));
        } else {
          setUserVotes(prev => {
            const copy = { ...prev };
            delete copy[course.id];
            return copy;
          });
        }
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, sharedCourses]);

  // Handle follow creator
  const handleFollowCreator = async (creatorId: string) => {
    if (!user) {
      // Local Guest storage follow state fallback
      const guestFollowingStr = localStorage.getItem('guest_following_ids');
      let arr: string[] = [];
      if (guestFollowingStr) {
        try { arr = JSON.parse(guestFollowingStr); } catch {}
      }
      if (!arr.includes(creatorId)) {
        arr.push(creatorId);
        localStorage.setItem('guest_following_ids', JSON.stringify(arr));
        setGuestFollowing(arr);
      }
      return;
    }

    try {
      const followRef = doc(db, 'follows', `${user.uid}_${creatorId}`);
      await setDoc(followRef, {
        followerId: user.uid,
        followedId: creatorId,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating following link:", error);
    }
  };

  // Handle unfollow creator
  const handleUnfollowCreator = async (creatorId: string) => {
    if (!user) {
      // Local Guest storage unfollow fallback state
      const guestFollowingStr = localStorage.getItem('guest_following_ids');
      if (guestFollowingStr) {
        try {
          const arr = JSON.parse(guestFollowingStr).filter((id: string) => id !== creatorId);
          localStorage.setItem('guest_following_ids', JSON.stringify(arr));
          setGuestFollowing(arr);
        } catch {}
      }
      return;
    }

    try {
      const followRef = doc(db, 'follows', `${user.uid}_${creatorId}`);
      await deleteDoc(followRef);
    } catch (error) {
      console.error("Error breaking following link:", error);
    }
  };

  // Handle voting (like/dislike)
  const handleVoteCourse = async (courseId: string, voteType: 'like' | 'dislike') => {
    if (!user) {
      alert("Please sign in to vote on courses.");
      return;
    }

    const course = sharedCourses.find(c => c.id === courseId);
    if (!course) return;

    const currentVote = userVotes[courseId];
    const voteRef = doc(db, 'shared_courses', courseId, 'votes', user.uid);
    const courseRef = doc(db, 'shared_courses', courseId);

    let newLikes = course.likesCount || 0;
    let newDislikes = course.dislikesCount || 0;

    try {
      if (currentVote === voteType) {
        // Remove vote
        if (voteType === 'like') {
          newLikes = Math.max(0, newLikes - 1);
        } else {
          newDislikes = Math.max(0, newDislikes - 1);
        }
        await deleteDoc(voteRef);
      } else {
        // Change vote or set new vote
        if (currentVote) {
          // Switch vote
          if (voteType === 'like') {
            newLikes += 1;
            newDislikes = Math.max(0, newDislikes - 1);
          } else {
            newLikes = Math.max(0, newLikes - 1);
            newDislikes += 1;
          }
        } else {
          // New vote
          if (voteType === 'like') {
            newLikes += 1;
          } else {
            newDislikes += 1;
          }
        }
        await setDoc(voteRef, {
          userId: user.uid,
          vote: voteType
        });
      }

      // Update counters in database
      await setDoc(courseRef, {
        likesCount: newLikes,
        dislikesCount: newDislikes
      }, { merge: true });

    } catch (error) {
      console.error("Error setting course vote:", error);
    }
  };

  // Import course into active library path
  const handleImportCourse = async (course: any) => {
    if (courses && courses.some(c => c.id === course.id)) {
      alert("This course is already in your library!");
      return;
    }

    try {
      if (user) {
        const userCourseRef = doc(db, 'users', user.uid, 'courses', course.id);
        await setDoc(userCourseRef, {
          id: course.id,
          name: course.courseName,
          description: course.description || '',
          videos: course.videos,
          importedAt: new Date().toISOString()
        });
      }

      // Populate default tasks for full gamified completion
      const formatted: Course = {
        id: course.id,
        name: course.courseName,
        description: course.description || '',
        createdAt: course.createdAt || new Date().toISOString(),
        videos: course.videos.map((v: any, index: number) => ({
          id: v.id || `v-${Date.now()}-${index}`,
          title: v.title,
          link: v.link || '',
          completed: false,
          notes: `Personal notes on lecturing chapter ${v.title}.`,
          tasks: [
            { id: `t-${Date.now()}-${index}-1`, text: 'Study lecture notes & watch full stream', completed: false },
            { id: `t-${Date.now()}-${index}-2`, text: 'Solve example codes & exercises', completed: false },
            { id: `t-${Date.now()}-${index}-3`, text: 'Draft video summary notes', completed: false },
          ]
        }))
      };

      if (onUpdateCourses && courses) {
        onUpdateCourses([...courses, formatted]);
      } else {
        const local = localStorage.getItem('koursy_courses');
        let parsed = [];
        if (local) {
          try { parsed = JSON.parse(local); } catch {}
        }
        parsed.push(formatted);
        localStorage.setItem('koursy_courses', JSON.stringify(parsed));
      }
      
      alert(`'${course.courseName}' has been successfully added to your Study library!`);
      setSelectedCourse(null);
    } catch (error) {
      console.error("Error importing shared course:", error);
      alert('Failed to import course.');
    }
  };

  // Help parse relative creation timestamp for sorting
  const getCourseTimestamp = (course: any): number => {
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
    return 0; // Legacy or original courses
  };

  const formatCourseDate = (course: any): string => {
    const ts = getCourseTimestamp(course);
    if (ts > 0) {
      return new Date(ts).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    return "Preset Template";
  };

  // Filter based on search query
  const filteredCourses = sharedCourses.filter(course => {
    if (!searchQuery.toLowerCase().trim()) return true;
    const trimmed = searchQuery.toLowerCase().trim();
    const matchesName = course.courseName.toLowerCase().includes(trimmed);
    const matchesDesc = course.description && course.description.toLowerCase().includes(trimmed);
    if (searchTarget === 'name') return matchesName;
    if (searchTarget === 'description') return matchesDesc;
    return matchesName || matchesDesc;
  });

  // Sort by selected parameter
  const sortedCourses = [...filteredCourses].sort((a, b) => {
    if (sortBy === 'most-recent') {
      return getCourseTimestamp(b) - getCourseTimestamp(a);
    } else {
      return (b.likesCount || 0) - (a.likesCount || 0);
    }
  });

  // Support custom avatar generator
  const getCreatorAvatar = (photoUrl: string | undefined | null, creatorId: string, creatorName: string) => {
    let activePhotoUrl = photoUrl;
    
    // 1. Look up from users_profiles collection mapping first (real-time sync)
    if (profiles[creatorId]?.photoURL) {
      activePhotoUrl = profiles[creatorId].photoURL;
    }
    // 2. If it is the current user, fallback to the live context user photo in case profile state transitions
    else if (user && creatorId === user.uid && user.photoURL) {
      activePhotoUrl = user.photoURL;
    }

    if (activePhotoUrl && activePhotoUrl.trim() !== '' && (activePhotoUrl.startsWith('http') || activePhotoUrl.startsWith('data:'))) {
      return activePhotoUrl;
    }
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(creatorName || creatorId || 'Learner')}`;
  };

  // Support custom name selector
  const getCreatorDisplayName = (creatorId: string, defaultName: string) => {
    if (profiles[creatorId]?.displayName) {
      return profiles[creatorId].displayName!;
    }
    if (user && creatorId === user.uid && user.displayName) {
      return user.displayName;
    }
    return defaultName || 'Learner';
  };

  // Render profile sub-page when selectedCreatorId is active
  if (selectedCreatorId) {
    const creatorCourses = sharedCourses.filter(c => c.creatorId === selectedCreatorId);
    const isFollowing = user 
      ? follows.some(f => f.followerId === user.uid && f.followedId === selectedCreatorId)
      : guestFollowing.includes(selectedCreatorId);
    const isSelf = user && selectedCreatorId === user.uid;
    const selectedCreatorFollowersCount = follows.filter(f => f.followedId === selectedCreatorId).length;
    const resolvedCreatorName = getCreatorDisplayName(selectedCreatorId, selectedCreatorName);

    // Real-time dynamic course sorting based on toggle selection
    const sortedCreatorCourses = [...creatorCourses].sort((a, b) => {
      if (creatorSortBy === 'most-recent') {
        return getCourseTimestamp(b) - getCourseTimestamp(a);
      } else {
        return (b.likesCount || 0) - (a.likesCount || 0);
      }
    });

    return (
      <div className="p-6 h-full overflow-y-auto w-full max-w-5xl mx-auto space-y-8 animate-fadeIn font-sans pb-16">
        <button 
          onClick={() => setSelectedCreatorId(null)}
          className="flex items-center gap-2 text-xs font-black text-gray-400 hover:text-gray-650 dark:hover:text-white uppercase tracking-widest cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>

        <div className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start justify-between gap-6 relative overflow-hidden shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-6 z-10 text-center md:text-left">
            <img 
              src={getCreatorAvatar(selectedCreatorPhoto, selectedCreatorId, selectedCreatorName)} 
              alt={resolvedCreatorName} 
              className="w-20 h-20 rounded-full border-4 border-[var(--theme-primary)] object-cover bg-gray-50 dark:bg-slate-800 shadow-md"
              referrerPolicy="no-referrer"
            />
            
            <div className="space-y-1.5">
              <h3 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none text-left">
                {resolvedCreatorName}
              </h3>
              <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest text-left">
                Creator Profile
              </p>
              
              <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-[#18252d] border border-gray-150 dark:border-[#202f36] rounded-xl text-[11px] font-black text-gray-600 dark:text-gray-400 w-fit">
                <span className="text-[var(--theme-primary)]">✦</span>
                <span className="text-gray-900 dark:text-white">{selectedCreatorFollowersCount}</span> Followers
              </div>
            </div>
          </div>

          {!isSelf && (
            <button
              onClick={() => isFollowing ? handleUnfollowCreator(selectedCreatorId) : handleFollowCreator(selectedCreatorId)}
              className={`px-6 py-3 rounded-2xl font-black text-xs tracking-wider uppercase transition-all flex items-center gap-2 active:scale-95 cursor-pointer z-10 group/profile-follow ${
                isFollowing 
                  ? 'bg-gray-100 hover:bg-red-50 hover:text-red-600 dark:bg-[#1c2a30] dark:hover:bg-red-950/20 dark:hover:text-red-400 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-transparent hover:border-red-200/50 dark:hover:border-red-900/30' 
                  : 'bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)] text-white shadow-md'
              }`}
            >
              {isFollowing ? (
                <>
                  <Check className="w-4 h-4 text-green-500 group-hover/profile-follow:hidden" />
                  <X className="w-4 h-4 text-red-500 hidden group-hover/profile-follow:inline" />
                  <span className="group-hover/profile-follow:hidden">Following</span>
                  <span className="hidden group-hover/profile-follow:inline">Unfollow</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Follow Creator</span>
                </>
              )}
            </button>
          )}

          {/* Decorative aura */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-[var(--theme-primary-transparent)] rounded-full blur-[56px] opacity-40 translate-x-12 -translate-y-12 pointer-events-none" />
        </div>

        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 dark:border-[#202f36] pb-3">
            <h4 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-wider">
              Uploaded Courses by {resolvedCreatorName} ({creatorCourses.length})
            </h4>
            
            {creatorCourses.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCreatorSortBy('most-recent')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    creatorSortBy === 'most-recent'
                      ? 'bg-[var(--theme-primary-transparent)] border-[var(--theme-primary)] text-[var(--theme-primary)] animate-scaleIn'
                      : 'bg-white dark:bg-[#131f24] border-gray-200 dark:border-[#202f36] text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>📅 Most Recent</span>
                </button>

                <button
                  onClick={() => setCreatorSortBy('most-liked')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    creatorSortBy === 'most-liked'
                      ? 'bg-[var(--theme-primary-transparent)] border-[var(--theme-primary)] text-[var(--theme-primary)] animate-scaleIn'
                      : 'bg-white dark:bg-[#131f24] border-gray-200 dark:border-[#202f36] text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>🔥 Most Liked</span>
                </button>
              </div>
            )}
          </div>
          
          {creatorCourses.length === 0 ? (
            <div className="text-center bg-gray-50 dark:bg-[#131f24] dark:border-[#202f36] p-12 rounded-3xl border-2 border-dashed text-gray-455">
              No public playlists available.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {sortedCreatorCourses.map(course => {
                const isOwnCourse = user && course.creatorId === user.uid;
                const isFollowingCreator = isOwnCourse || (user
                  ? follows.some(f => f.followerId === user.uid && f.followedId === course.creatorId)
                  : guestFollowing.includes(course.creatorId));
                const isLocked = course.requiresFollowing === true && !isFollowingCreator;

                return (
                  <div 
                    key={course.id}
                    onClick={() => {
                      if (isLocked) {
                        handleFollowCreator(course.creatorId);
                      } else {
                        setSelectedCourse(course);
                      }
                    }}
                    className={`p-6 rounded-3xl border-2 transition-all h-56 flex flex-col justify-between shadow-sm relative overflow-hidden cursor-pointer hover:border-[var(--theme-primary)] hover:shadow-md ${
                      isLocked 
                        ? 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/30' 
                        : 'bg-white dark:bg-[#131f24] border-gray-200 dark:border-[#202f36]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <img 
                            src={getCreatorAvatar(course.creatorPhotoURL, course.creatorId, course.creatorName)} 
                            alt={getCreatorDisplayName(course.creatorId, course.creatorName)} 
                            className="w-5 h-5 rounded-full object-cover border border-gray-150"
                            referrerPolicy="no-referrer"
                          />
                          <p className="text-[10px] font-black text-gray-400">
                            By {getCreatorDisplayName(course.creatorId, course.creatorName)}
                          </p>
                        </div>
                        
                        {course.requiresFollowing && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded text-[8px] font-black tracking-widest uppercase">
                            <Lock className="w-2.5 h-2.5" />
                            Lock
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-black text-gray-800 dark:text-white line-clamp-2 uppercase tracking-tight py-1 leading-tight">
                        {course.courseName}
                      </h3>
                      
                      <div className="flex items-center gap-1 mb-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                        <Calendar className="w-2.5 h-2.5 text-gray-300" />
                        <span>Created: {formatCourseDate(course)}</span>
                      </div>
                      
                      {!isLocked ? (
                        <p className="text-xs text-gray-500 line-clamp-2 font-bold leading-relaxed">
                          {course.description || "No description."}
                        </p>
                      ) : (
                        <div className="mt-1 text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-[10px] font-black bg-amber-500/5 p-1.5 rounded-lg">
                          <Lock className="w-3 h-3 flex-shrink-0" />
                          <span>Follow to gain access!</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-[#202f36] pt-3 mt-auto">
                      <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleVoteCourse(course.id, 'like')}
                          className={`flex items-center gap-1 text-[11px] font-black ${userVotes[course.id] === 'like' ? 'text-green-500 scale-105' : 'text-gray-400 hover:text-green-500'}`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>{course.likesCount || 0}</span>
                        </button>
                        <button 
                          onClick={() => handleVoteCourse(course.id, 'dislike')}
                          className={`flex items-center gap-1 text-[11px] font-black ${userVotes[course.id] === 'dislike' ? 'text-red-500 scale-105' : 'text-gray-400 hover:text-red-500'}`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>{course.dislikesCount || 0}</span>
                        </button>
                      </div>

                      {isLocked ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowCreator(course.creatorId);
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-[9px] tracking-wider uppercase rounded-lg cursor-pointer"
                        >
                          Follow
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImportCourse(course);
                          }}
                          className="p-1.5 rounded-full bg-gray-50 dark:bg-[#1f2d36] text-[var(--theme-primary)] hover:bg-[var(--theme-primary)] hover:text-white transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto w-full max-w-5xl mx-auto space-y-8 animate-fadeIn font-sans pb-16">
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-widest">Community Hub</h2>
        <p className="text-xs text-gray-500 font-bold max-w-xl">
          Learn from custom study tracks built by developers worldwide. Support content creators, lock in guides, and vote for the best curriculum.
        </p>
      </div>
      
      {/* Search and Sort Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 dark:bg-[#131f24] p-4 rounded-3xl border border-gray-150 dark:border-[#202f36]">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#18252d] border-2 border-gray-200 dark:border-[#2b3c45] rounded-full text-xs font-bold outline-none focus:border-[var(--theme-primary)] transition-colors text-gray-800 dark:text-white"
          />
        </div>

        {/* Filter / Sort Criteria Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mr-1">Sort & Filter Feed:</span>
          
          <button
            onClick={() => setSortBy('most-recent')}
            className={`flex items-center gap-1 px-3.5 py-2 rounded-full border-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              sortBy === 'most-recent'
                ? 'bg-[var(--theme-primary-transparent)] border-[var(--theme-primary)] text-[var(--theme-primary)]'
                : 'bg-white dark:bg-[#18252d] border-gray-200 dark:border-[#202f36] text-gray-500 hover:border-gray-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>📅 Most Recent</span>
          </button>

          <button
            onClick={() => setSortBy('most-liked')}
            className={`flex items-center gap-1 px-3.5 py-2 rounded-full border-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              sortBy === 'most-liked'
                ? 'bg-[var(--theme-primary-transparent)] border-[var(--theme-primary)] text-[var(--theme-primary)]'
                : 'bg-white dark:bg-[#18252d] border-gray-200 dark:border-[#202f36] text-gray-500 hover:border-gray-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>🔥 Most Liked</span>
          </button>
        </div>
      </div>
      
      {/* Shared Courses Cards Grid */}
      {sortedCourses.length === 0 ? (
        <div className="bg-white dark:bg-[#131f24] border-2 border-dashed border-gray-200 dark:border-[#202f36] rounded-3xl p-16 text-center space-y-4">
          <div className="w-16 h-16 bg-gray-50 dark:bg-[#18252d] border border-gray-150 dark:border-[#202f36] rounded-2xl flex items-center justify-center mx-auto text-2xl">
            🧐
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-gray-700 dark:text-white uppercase tracking-wider">No playlists found</h4>
            <p className="text-xs text-gray-400 font-bold max-w-sm mx-auto">
              We couldn't locate any matching courses. Try adjusting your filter terms or upload your own to start sharing!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {sortedCourses.map(course => {
            const isOwnCourse = user && course.creatorId === user.uid;
            const isFollowingCreator = isOwnCourse || (user
              ? follows.some(f => f.followerId === user.uid && f.followedId === course.creatorId)
              : guestFollowing.includes(course.creatorId));
            const isLocked = course.requiresFollowing === true && !isFollowingCreator;
            const liveFollowersCount = follows.filter(f => f.followedId === course.creatorId).length;

            return (
              <div 
                key={course.id}
                onClick={() => {
                  if (isLocked) {
                    handleFollowCreator(course.creatorId);
                  } else {
                    setSelectedCourse(course);
                  }
                }}
                className={`p-6 rounded-3xl border-2 transition-all h-56 flex flex-col justify-between shadow-sm relative overflow-hidden cursor-pointer hover:border-[var(--theme-primary)] hover:shadow-md ${
                  isLocked 
                    ? 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/30' 
                    : 'bg-white dark:bg-[#131f24] border-gray-200 dark:border-[#202f36]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    {/* Clickable Profile Avatar group */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCreatorId(course.creatorId);
                        setSelectedCreatorName(getCreatorDisplayName(course.creatorId, course.creatorName));
                        setSelectedCreatorPhoto(profiles[course.creatorId]?.photoURL || course.creatorPhotoURL || '');
                      }}
                      className="flex items-center gap-2 group/creator cursor-pointer"
                    >
                      <img 
                        src={getCreatorAvatar(course.creatorPhotoURL, course.creatorId, course.creatorName)} 
                        alt={getCreatorDisplayName(course.creatorId, course.creatorName)} 
                        className="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-[#2b3c45] shadow-sm transform group-hover/creator:scale-110 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex flex-col">
                        <p className="text-[11px] font-black text-gray-400 dark:text-slate-500 group-hover/creator:text-[var(--theme-primary)] transition-colors leading-tight">
                          By {getCreatorDisplayName(course.creatorId, course.creatorName)} {isOwnCourse && " (You)"}
                        </p>
                        <span className="text-[9px] font-extrabold text-gray-450 dark:text-slate-650 mt-0.5 leading-none">
                          👤 {liveFollowersCount} {liveFollowersCount === 1 ? 'follower' : 'followers'}
                        </span>
                      </div>
                    </div>
                    
                    {!isOwnCourse && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isFollowingCreator) {
                            handleUnfollowCreator(course.creatorId);
                          } else {
                            handleFollowCreator(course.creatorId);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95 cursor-pointer border group/feed-follow ${
                          isFollowingCreator 
                            ? 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-red-550/10 hover:text-red-655 hover:border-red-500/30' 
                            : 'bg-[var(--theme-primary-transparent)] text-[var(--theme-primary)] border-[var(--theme-primary)] hover:bg-[var(--theme-primary)] hover:text-white'
                        }`}
                      >
                        {isFollowingCreator ? (
                          <>
                            <Check className="w-2.5 h-2.5 text-green-500 group-hover/feed-follow:hidden" />
                            <X className="w-2.5 h-2.5 text-red-500 hidden group-hover/feed-follow:inline animate-fadeIn" />
                            <span className="group-hover/feed-follow:hidden">Following</span>
                            <span className="hidden group-hover/feed-follow:inline animate-fadeIn text-red-600 dark:text-red-450">Unfollow</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-2.5 h-2.5" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
 
                  <h3 className="text-base font-black text-gray-800 dark:text-white line-clamp-2 uppercase tracking-tight leading-tight">
                    {course.courseName}
                  </h3>
                  
                  <div className="flex items-center gap-1.5 mt-1 mb-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    <Calendar className="w-3 h-3 text-gray-350 dark:text-gray-650" />
                    <span>Created: {formatCourseDate(course)}</span>
                  </div>
                  
                  {!isLocked ? (
                    <p className="text-xs text-gray-500 line-clamp-2 font-bold leading-relaxed">
                      {course.description || "No description provided."}
                    </p>
                  ) : (
                    <div className="mt-2 text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-xs font-black bg-amber-500/5 p-2 rounded-xl border border-amber-200/20">
                      <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Follow {getCreatorDisplayName(course.creatorId, course.creatorName)} to unlock!</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between border-t border-gray-100 dark:border-[#202f36] pt-3.5 mt-auto">
                  {/* Voting component with click capture prevention */}
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => handleVoteCourse(course.id, 'like')}
                      className={`flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                        userVotes[course.id] === 'like' 
                          ? 'text-green-600 dark:text-green-400 font-extrabold scale-105' 
                          : 'text-gray-400 hover:text-green-600'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>{course.likesCount || 0}</span>
                    </button>
                    <button 
                      onClick={() => handleVoteCourse(course.id, 'dislike')}
                      className={`flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                        userVotes[course.id] === 'dislike' 
                          ? 'text-red-500 font-extrabold scale-105' 
                          : 'text-gray-400 hover:text-red-500'
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span>{course.dislikesCount || 0}</span>
                    </button>
                  </div>
 
                  {isLocked ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollowCreator(course.creatorId);
                      }}
                      className="flex items-center gap-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] tracking-wider uppercase rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Follow</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold text-gray-400 dark:text-slate-500 uppercase flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-gray-300" />
                        {course.videos?.length || 0} Lectures
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Course Preview and Import Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm shadow-2xl animate-fadeIn">
          <div className="bg-white dark:bg-[#131f24] rounded-3xl border-2 border-gray-200 dark:border-[#202f36] w-full max-w-xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedCourse(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1c2a30] transition-colors cursor-pointer"
            >
              <XIcon className="w-5 h-5 text-gray-400 hover:text-gray-700" />
            </button>

            <div className="space-y-2">
              <span className="text-[10px] font-black text-[var(--theme-primary)] bg-[var(--theme-primary-transparent)] px-2.5 py-1 rounded-md uppercase tracking-wider">
                Course Preview
              </span>
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">
                {selectedCourse.courseName}
              </h3>
              <p className="text-xs text-gray-400 font-extrabold uppercase tracking-widest">
                By {getCreatorDisplayName(selectedCourse.creatorId, selectedCourse.creatorName)} • Shared: {formatCourseDate(selectedCourse)}
              </p>
            </div>

            {selectedCourse.description && (
              <div className="bg-gray-50 dark:bg-[#18252d] p-4 rounded-2xl border border-gray-150 dark:border-[#2a3c45]">
                <p className="text-xs text-gray-600 dark:text-gray-300 font-bold leading-relaxed">
                  {selectedCourse.description}
                </p>
              </div>
            )}

            {/* Lecture Playlist */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest col-span-full">Chapters ({selectedCourse.videos?.length || 0})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedCourse.videos?.map((video: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/75 dark:bg-[#1c2a30] border border-gray-150 dark:border-[#2b3c45] text-xs">
                    <div className="flex items-center gap-2 font-bold text-gray-700 dark:text-gray-300">
                      <Play className="w-3.5 h-3.5 text-[var(--theme-primary)] flex-shrink-0" />
                      <span className="line-clamp-1">{video.title}</span>
                    </div>
                    {video.link && (
                      <span className="text-[9px] font-black bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded uppercase">Video URL</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button 
                onClick={() => handleImportCourse(selectedCourse)}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)] text-white font-black text-xs tracking-wider uppercase rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Add to My Courses</span>
              </button>
              
              <button 
                onClick={() => setSelectedCourse(null)}
                className="w-full py-3 bg-gray-100 dark:bg-[#1c2a30] hover:bg-gray-200 dark:hover:bg-[#253941] text-gray-700 dark:text-gray-300 font-black text-xs tracking-wider uppercase rounded-2xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline fallback for Lucide missing X symbol to be 100% self contained
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
