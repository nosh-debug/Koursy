import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useFirebase } from '../context/FirebaseContext';
import { UserStats } from '../types';
import { Trophy, Flame, Award, Clock, Sparkles, LogIn, TrendingUp, Compass, Star, Shield } from 'lucide-react';

interface LeaderboardTabProps {
  stats: UserStats;
  onOpenAuthModal?: () => void;
  onUpdateStats?: (stats: UserStats) => void;
}

interface RankedUser {
  uid: string;
  displayName: string;
  photoURL: string;
  xp: number;
  level: number;
  streak: number;
  totalFocusSeconds: number;
  subscription?: 'free' | 'plus';
}

export default function LeaderboardTab({ stats, onOpenAuthModal, onUpdateStats }: LeaderboardTabProps) {
  const { user } = useFirebase();
  const [rankedUsers, setRankedUsers] = useState<RankedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rankingCriterion, setRankingCriterion] = useState<'xp' | 'focus'>('xp');

  // Sync users_profiles collection ranking in real-time
  useEffect(() => {
    const q = query(
      collection(db, 'users_profiles'),
      orderBy('xp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList: RankedUser[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.uid) {
          usersList.push({
            uid: data.uid,
            displayName: data.displayName || 'Learner',
            photoURL: data.photoURL || '',
            xp: data.xp || 0,
            level: data.level || 1,
            streak: data.streak || 0,
            totalFocusSeconds: data.totalFocusSeconds || 0,
            subscription: data.subscription || 'free'
          });
        }
      });
      // Sort in-memory fallback just in case ordering is still indexing
      usersList.sort((a, b) => b.xp - a.xp);
      setRankedUsers(usersList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading leaderboard users:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Format focus duration
  const formatFocusTime = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds <= 0) return '0m';
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const sortedUsers = useMemo(() => {
    return [...rankedUsers].sort((a, b) => {
      if (rankingCriterion === 'focus') {
        return b.totalFocusSeconds - a.totalFocusSeconds;
      }
      return b.xp - a.xp;
    });
  }, [rankedUsers, rankingCriterion]);

  // Find user's rank
  const myRankIndex = sortedUsers.findIndex(u => u.uid === user?.uid);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : null;

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-4 md:p-6 font-sans animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] p-6 md:p-8 rounded-3xl text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 z-10">
          <span className="bg-white/20 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
            Season Standings
          </span>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight flex items-center gap-2">
            <Trophy className="w-8 md:w-10 h-8 md:h-10 text-yellow-300 animate-pulse" />
            Class Leaderboard
          </h2>
          <p className="text-xs md:text-sm text-blue-50 font-medium max-w-md">
            Rank up by completing training objectives, maintaining streaks, and logging focus hours!
          </p>
        </div>

        {/* Dynamic Rank badge for logged-in user */}
        {user && myRank && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center gap-4 border border-white/20 z-10 self-start md:self-auto">
            <div className="w-12 h-12 bg-yellow-400 text-slate-900 rounded-full flex items-center justify-center font-black text-xl shadow-md">
              #{myRank}
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-blue-200 uppercase tracking-widest leading-none">Your Rank</p>
              <h4 className="text-lg font-black uppercase tracking-tight mt-1">{user.displayName || 'Learner'}</h4>
              <p className="text-xs text-white/80 font-bold">{stats.xp} Total XP</p>
            </div>
          </div>
        )}

        {/* Decorative elements */}
        <div className="absolute right-0 bottom-0 w-48 h-48 bg-white/5 rounded-full translate-x-12 translate-y-12 blur-2xl pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Leaderboard Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-3xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-gray-150 dark:border-[#202f36] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-none">
                  Rank standboard • Top Learners ({sortedUsers.length})
                </h3>
                <div className="flex items-center gap-1 text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase w-fit leading-none mt-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Live updates</span>
                </div>
              </div>

              {/* Standing Rank metric Filter toggler */}
              <div className="flex bg-neutral-100 dark:bg-[#18252d] p-1 rounded-xl border border-neutral-200 dark:border-[#202f36] select-none self-start md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setRankingCriterion('xp')}
                  className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                    rankingCriterion === 'xp'
                      ? 'bg-white dark:bg-[#202f36] text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-400 dark:text-slate-500 hover:text-neutral-600 dark:hover:text-slate-300'
                  }`}
                >
                  XP Gain
                </button>
                <button
                  type="button"
                  onClick={() => setRankingCriterion('focus')}
                  className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                    rankingCriterion === 'focus'
                      ? 'bg-white dark:bg-[#202f36] text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-400 dark:text-slate-500 hover:text-neutral-600 dark:hover:text-slate-300'
                  }`}
                >
                  Focus Hours
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Syncing Leaderboard positions...</p>
              </div>
            ) : sortedUsers.length === 0 ? (
              <div className="p-16 text-center space-y-4 text-gray-455">
                <Compass className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="text-sm font-black uppercase tracking-widest">No profiles found</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Be the first one to claim number #1 on the leaderboard board by completing focus lessons!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-[#1c2a30]">
                {sortedUsers.map((rankedUser, i) => {
                  const rank = i + 1;
                  const isThirdOrBetter = rank <= 3;
                  const isCurrentUser = rankedUser.uid === user?.uid;

                  return (
                    <div 
                      key={rankedUser.uid}
                      className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                        isCurrentUser 
                          ? 'bg-amber-50/20 dark:bg-amber-950/10 border-l-4 border-amber-400' 
                          : 'hover:bg-gray-50/50 dark:hover:bg-[#18252d]/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Rank Badge */}
                        <div className="w-8 flex-shrink-0 text-center font-black">
                          {rank === 1 ? (
                            <span className="text-2xl" title="1st Place">🥇</span>
                          ) : rank === 2 ? (
                            <span className="text-2xl" title="2nd Place">🥈</span>
                          ) : rank === 3 ? (
                            <span className="text-2xl" title="3rd Place">🥉</span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-slate-600">#{rank}</span>
                          )}
                        </div>

                        {/* Avatar */}
                        {rankedUser.photoURL ? (
                          <img 
                            src={rankedUser.photoURL} 
                            alt={rankedUser.displayName} 
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-[#2b3c45]"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#1c2a30] border-2 border-gray-200 dark:border-[#2b3c45] flex items-center justify-center font-black text-xs text-slate-500">
                            {rankedUser.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        {/* User Details */}
                        <div className="space-y-0.5">
                          <h4 className="font-black text-sm text-gray-800 dark:text-white leading-tight flex items-center gap-1.5 uppercase">
                            <span>{rankedUser.displayName}</span>
                            {rankedUser.subscription === 'plus' && (
                              <span className="bg-amber-400/10 text-amber-500 text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-amber-500/20">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> Plus
                              </span>
                            )}
                            {isCurrentUser && (
                              <span className="bg-amber-400 text-slate-900 text-[8px] font-black tracking-widest px-1.5 py-0.2 rounded uppercase">
                                You
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center gap-2.5 text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">
                            {rankedUser.streak > 0 ? (
                              <span className="flex items-center text-orange-500 gap-0.5">
                                <Flame className="w-3 h-3 text-orange-500 fill-orange-500 animate-pulse" />
                                {rankedUser.streak}d streak
                              </span>
                            ) : (
                              <span className="text-gray-405 dark:text-slate-500">0d streak</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* XP & Focus info */}
                      <div className="text-right">
                        <div className="font-mono text-xs font-black text-[var(--theme-primary)] flex items-center justify-end gap-1">
                          <span>{rankedUser.xp}</span>
                          <span className="text-[9px] font-extrabold text-gray-400 dark:text-slate-500">XP</span>
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[9px] text-gray-400 font-extrabold uppercase mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-gray-300" />
                          <span>{formatFocusTime(rankedUser.totalFocusSeconds)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prompt to Authenticate for local guests */}
          {!user && (
            <div className="p-6 bg-amber-500/10 border-2 border-amber-500/20 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center md:text-left">
                <h4 className="font-black text-sm text-amber-800 dark:text-amber-400 uppercase tracking-wider">Unranked Local Profile</h4>
                <p className="text-xs font-medium text-amber-700/80 dark:text-amber-500/80 max-w-md">
                  You are viewing the leaderboard as a local guest. Synchronize your progress with a free account to rank publicly!
                </p>
              </div>
              <button 
                onClick={onOpenAuthModal}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase px-5 py-3 rounded-2xl tracking-wider cursor-pointer active:scale-95 transition-all w-fit flex-shrink-0"
              >
                <LogIn className="w-4 h-4" />
                <span>Connect Account</span>
              </button>
            </div>
          )}
        </div>

        {/* Right 1 Col: Dynamic Personal Stats Card */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
              My Personal stats
            </h3>

            {/* Rank Stat Pill */}
            {user && stats.subscription && stats.subscription !== 'free' && (
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Account Status</span>
                </div>
                <span className="text-xs font-black uppercase text-amber-500 tracking-wider">
                  ⭐ Test Plus
                </span>
              </div>
            )}

            {/* Rank Stat Pill */}
            {user && myRank && (
              <div className="flex items-center justify-between p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Current Rank</span>
                </div>
                <span className="text-lg font-black text-yellow-500">#{myRank}</span>
              </div>
            )}

            {/* XP Pill */}
            <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-blue-500" />
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Earned XP</span>
              </div>
              <span className="text-lg font-black text-blue-500">{stats.xp} XP</span>
            </div>

            {/* Streak Pill */}
            <div className="flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
              <div className="flex items-center gap-2.5">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Day Streak</span>
              </div>
              <span className="text-lg font-black text-orange-500">{stats.streak} Days</span>
            </div>

            {/* Focus Pill */}
            <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-emerald-500" />
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Focus Hours</span>
              </div>
              <span className="text-lg font-black text-emerald-500">{formatFocusTime(stats.totalFocusSeconds)}</span>
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
