import { Course, UserStats, StudyHistoryItem } from './types';
import { PRESET_COURSES } from './presets';

const STORAGE_KEYS = {
  COURSES: 'duono_courses',
  STATS: 'duono_stats',
};

// Check if string date matches today's YYYY-MM-DD
export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function loadCourses(): Course[] {
  const raw = localStorage.getItem(STORAGE_KEYS.COURSES);
  if (!raw) {
    saveCourses(PRESET_COURSES);
    return JSON.parse(JSON.stringify(PRESET_COURSES));
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse courses, resetting to presets', e);
    saveCourses(PRESET_COURSES);
    return JSON.parse(JSON.stringify(PRESET_COURSES));
  }
}

export function saveCourses(courses: Course[]) {
  // Keep only the most recent 5
  const limitedCourses = courses.slice(-5);
  localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(limitedCourses));
}

const DEFAULT_STATS: UserStats = {
  xp: 0,
  level: 1,
  streak: 0,
  lastStudyDate: null,
  activeCourseId: 'cs50x',
  totalFocusSeconds: 0,
  history: [],
  hearts: 1,
  hasPostedToCommunity: false,
};

export function loadStats(): UserStats {
  const raw = localStorage.getItem(STORAGE_KEYS.STATS);
  let stats: UserStats;
  if (!raw) {
    stats = { ...DEFAULT_STATS };
    saveStats(stats);
    return stats;
  }
  try {
    stats = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse stats, resetting', e);
    stats = { ...DEFAULT_STATS };
    saveStats(stats);
    return stats;
  }

  // Upgrade legacy state
  if (stats.hearts === undefined) {
    stats.hearts = 1;
    saveStats(stats);
  }

  if (stats.hasPostedToCommunity === undefined) {
    stats.hasPostedToCommunity = false;
    saveStats(stats);
  }

  // Check if streak was broken (last study was before yesterday)
  if (stats.lastStudyDate && stats.streak > 0) {
    const today = getTodayString();
    
    // Calculate days between today and lastStudyDate
    const lastDate = new Date(stats.lastStudyDate);
    const todayDate = new Date(today);
    const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1) {
      const missedDays = diffDays - 1;
      const heartsAvailable = stats.hearts || 0;
      
      if (heartsAvailable >= missedDays) {
        // Use hearts to shield the days and keep streak alive!
        stats.hearts = heartsAvailable - missedDays;
        stats.lastStudyDate = getYesterdayString(); // Move the lockposts forward
      } else {
        // Streak broken!
        stats.streak = 0;
        stats.hearts = 0; // Consume all hearts
      }
      saveStats(stats);
    }
  }

  return stats;
}

export function saveStats(stats: UserStats) {
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}

// Function to handle incremental updates (like adding focus time, completing a video)
export const FootageDB = {
  dbName: 'DuonoFootagesDB',
  storeName: 'footages',
  
  init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = (e: any) => resolve(e.target.result);
      request.onerror = (e: any) => reject(e.target.error);
    });
  },

  async set(key: string, value: string): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = (e: any) => reject(e.target.error);
      });
    } catch(err) {
      console.error('Idb error:', err);
    }
  },

  async get(key: string): Promise<string | null> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = (e: any) => resolve(e.target.result || null);
        req.onerror = (e: any) => reject(e.target.error);
      });
    } catch(err) {
      console.error('Idb error:', err);
      return null;
    }
  }
};

export function addStudySession(

  courseId: string,
  courseName: string,
  videoId: string,
  videoTitle: string,
  seconds: number,
  xpEarnt: number
): { stats: UserStats } {
  const stats = loadStats();
  const today = getTodayString();
  const yesterday = getYesterdayString();

  // 1. Update Streak
  if (stats.lastStudyDate === null) {
    stats.streak = 1;
  } else if (stats.lastStudyDate === yesterday) {
    stats.streak += 1;
  } else if (stats.lastStudyDate !== today) {
    // If not yesterday and not today (some other past date), reset streak to 1
    stats.streak = 1;
  }
  // If last study date was already today, streak remains unchanged.
  stats.lastStudyDate = today;

  // 2. Add focus seconds and XP
  stats.totalFocusSeconds += seconds;
  stats.xp += xpEarnt;

  // 3. Level-up calculation (every 100 XP is a level)
  const newLevel = Math.floor(stats.xp / 100) + 1;
  if (newLevel > stats.level) {
    stats.level = newLevel;
  }

  // 4. Record details in history
  const historyItem: StudyHistoryItem = {
    id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date: today,
    courseId,
    courseName,
    videoId,
    videoTitle,
    focusSeconds: seconds,
    xpEarned: xpEarnt,
  };
  stats.history.unshift(historyItem);

  saveStats(stats);
  return { stats };
}
