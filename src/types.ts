export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  timestamp: string; // e.g. "05:30" or "01:20:00"
  completed: boolean;
}

export interface CompletionFootage {
  id: string;
  url: string;
  name: string;
  size: string;
  isVideo?: boolean;
}

export interface Video {
  id: string;
  title: string;
  link?: string;
  notes?: string;
  tasks: Task[];
  completed: boolean;
  dueDate?: string;
  chapters?: Chapter[];
  completionFootageUrl?: string; // Bubble footage
  completionFootageName?: string;
  completionFootageSize?: string;
  completionFootageIsVideo?: boolean;
  completionFootages?: CompletionFootage[];
  manuallyUnlocked?: boolean;
  watchDuration?: number;
  watchTime?: number;
}

export interface Course {
  id: string;
  name: string;
  description: string;
  videos: Video[];
  isPublic?: boolean;
  requiresFollowing?: boolean;
  createdAt?: string;
}

export interface StudyHistoryItem {
  id: string;
  date: string; // YYYY-MM-DD
  courseId: string;
  courseName: string;
  videoId: string;
  videoTitle: string;
  focusSeconds: number;
  xpEarned: number;
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lastStudyDate: string | null; // YYYY-MM-DD
  activeCourseId: string | null;
  totalFocusSeconds: number;
  history: StudyHistoryItem[];
  subscription?: 'free' | 'plus'; // Premium subscription tier
  hearts?: number; // Skip-day protection hearts
  hasPostedToCommunity?: boolean; // Tracking first time community publication bonus
}
