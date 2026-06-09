import React, { useState, useEffect, useRef } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Check, Sparkles, Youtube, CheckCircle2, Award, Clock, FileText, Plus, Trash2, Upload, FileVideo, Maximize2, Subtitles, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { Course, Video, Task, UserStats, CompletionFootage } from '../types';
import { addStudySession, saveCourses, FootageDB } from '../storage';
import { base64ToBlobUrl } from '../lib/base64Utils';
import { auth } from '../lib/firebase-supabase-adapter';
import { saveFootageToDb, fetchFootageFromDb } from '../lib/firestoreUtils';
import { compressImage } from '../lib/compressionUtils';

interface TodayFocusProps {
  activeCourse: Course | null;
  selectedVideo: Video | null;
  setSelectedVideo: (video: Video | null) => void;
  onSessionComplete: (updatedStats: UserStats) => void;
  onUpdateCourses: (courses: Course[]) => void;
  stats: UserStats;
}

export default function TodayFocus({
  activeCourse,
  selectedVideo,
  setSelectedVideo,
  onSessionComplete,
  onUpdateCourses,
  stats
}: TodayFocusProps) {
  // Focus clock state
  const [seconds, setSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [sessionXpEarned, setSessionXpEarned] = useState(0);
  
  // Custom checklist input
  const [newTodoText, setNewTodoText] = useState('');
  
  // Active video tracking state
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  
  // Real-time video player length & position states
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [showNoYouDidnt, setShowNoYouDidnt] = useState(false);

  // Synchronize watched progress locally & to cloud database
  const saveWatchedProgress = useRef<(time: number, duration: number) => void>(() => {});
  
  useEffect(() => {
    saveWatchedProgress.current = (time: number, duration: number) => {
      if (!activeCourse || !currentVideo || duration <= 0) return;
      
      const updatedCourses = JSON.parse(localStorage.getItem('duono_courses') || '[]') as Course[];
      const targetCourse = updatedCourses.find(c => c.id === activeCourse.id);
      if (!targetCourse) return;
      
      const targetVideo = targetCourse.videos.find(v => v.id === currentVideo.id);
      if (!targetVideo) return;
      
      // Update watch duration & current position if changed noticeably
      if (Math.abs((targetVideo.watchTime || 0) - time) > 1.5 || targetVideo.watchDuration !== duration) {
        targetVideo.watchDuration = duration;
        targetVideo.watchTime = time;
        
        localStorage.setItem('duono_courses', JSON.stringify(updatedCourses));
        onUpdateCourses(updatedCourses);
      }
    };
  }, [activeCourse?.id, currentVideo?.id, onUpdateCourses]);

  // Save progress when switching videos/lessons or unmounting
  useEffect(() => {
    return () => {
      const player = (window as any).player;
      if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
        try {
          const curr = player.getCurrentTime();
          const dur = player.getDuration();
          if (typeof curr === 'number' && typeof dur === 'number' && dur > 0) {
            saveWatchedProgress.current?.(curr, dur);
          }
        } catch (err) {}
      }
    };
  }, [currentVideo?.id]);

  // Reset player watch logs when changing lessons
  useEffect(() => {
    setVideoDuration(0);
    setVideoCurrentTime(0);
    setShowNoYouDidnt(false);
  }, [currentVideo?.id]);

  // Track YouTube Player interactive duration & position
  useEffect(() => {
    let lastSavedTime = 0;
    const checkPlayer = () => {
      const player = (window as any).player;
      if (player && typeof player.getCurrentTime === 'function') {
        try {
          const curr = player.getCurrentTime();
          if (typeof curr === 'number') {
            setVideoCurrentTime(curr);
          }
          let dur = 0;
          if (typeof player.getDuration === 'function') {
            const d = player.getDuration();
            if (typeof d === 'number' && d > 0) {
              setVideoDuration(d);
              dur = d;
            }
          }
          
          if (typeof curr === 'number' && dur > 0) {
            const now = Date.now();
            if (now - lastSavedTime > 4000) {
              lastSavedTime = now;
              saveWatchedProgress.current?.(curr, dur);
            }
          }
        } catch (e) {
          // Guard against safe player interactions
        }
      }
    };

    // Poll player values every 800ms
    const interval = setInterval(checkPlayer, 800);
    return () => clearInterval(interval);
  }, [currentVideo?.id]);

  // Jump/seek states for chapters
  const [activeStartSeconds, setActiveStartSeconds] = useState<number | null>(null);

  // Polling for automated timing
  const prevTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = setInterval(() => {
      const player = (window as any).player;
      if (player && typeof player.getCurrentTime === 'function') {
        const currentTime = player.getCurrentTime();
        const prevTime = prevTimeRef.current;
        
        // Threshold to ignore small jumps (< 2s)
        if (Math.abs(currentTime - prevTime) < 2) {
          prevTimeRef.current = currentTime;
          return;
        }

        // Seeking detected
        if (currentTime < prevTime - 2) {
          // Rewind: subtract time
          const diff = Math.floor(prevTime - currentTime);
          setSeconds(prev => Math.max(0, prev - diff));
        } else if (currentTime > prevTime + 2) {
          // Fast-forward: do nothing (do not add time)
        }
        
        prevTimeRef.current = currentTime;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Reset starting second jump point when switching active video
  useEffect(() => {
    setActiveStartSeconds(null);
  }, [currentVideo]);

  // Player state change handler
  const onPlayerStateChange: (event: any) => void = (event) => {
    // 1: PLAYING
    // 2: PAUSED
    // 3: BUFFERING
    if (event.data === 1) {
      setIsTimerRunning(true);
    } else if (event.data === 2 || event.data === 3) {
      setIsTimerRunning(false);
      
      const player = (window as any).player;
      if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
        try {
          const curr = player.getCurrentTime();
          const dur = player.getDuration();
          if (typeof curr === 'number' && typeof dur === 'number' && dur > 0) {
            saveWatchedProgress.current?.(curr, dur);
          }
        } catch (err) {}
      }
    }
  };

  // Convert "MM:SS" or "HH:MM:SS" into seconds for YouTube deep links
  const convertTimestampToSeconds = (ts: string): number => {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
  };

  // Toggle chapter completed checkpoint state
  const handleToggleChapterCompleteness = (chapterId: string) => {
    if (!activeCourse || !currentVideo) return;

    const updatedCourses = JSON.parse(localStorage.getItem('duono_courses') || '[]') as Course[];
    const targetCourse = updatedCourses.find(c => c.id === activeCourse.id);
    if (!targetCourse) return;

    const targetVideo = targetCourse.videos.find(v => v.id === currentVideo.id);
    if (!targetVideo) return;

    if (!targetVideo.chapters) return;

    const chIndex = targetVideo.chapters.findIndex(c => c.id === chapterId);
    if (chIndex === -1) return;

    targetVideo.chapters[chIndex].completed = !targetVideo.chapters[chIndex].completed;

    // Save changes to localStorage
    saveCourses(updatedCourses);
    onUpdateCourses(updatedCourses);

    // Update active video state inline
    setCurrentVideo({ ...currentVideo, chapters: targetVideo.chapters });
  };

  // Completed Celebration Modal
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationDetails, setCelebrationDetails] = useState<{
    videoTitle: string;
    xpEarned: number;
    secondsSpent: number;
    unlockedBadges: any[];
    isCourseCompleted?: boolean;
    courseName?: string;
  } | null>(null);

  // Timer Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Completion Footage upload states & handlers
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [footageFiles, setFootageFiles] = useState<CompletionFootage[]>([]);
  const [showFootageUploadBox, setShowFootageUploadBox] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize footage files state on switching videos (lessons)
  useEffect(() => {
    let isSubscribed = true;
    const fetchFootages = async () => {
      if (!currentVideo) {
        if (isSubscribed) {
          setFootageFiles([]);
          setShowFootageUploadBox(false);
        }
        return;
      }
      
      let footagesToSet: CompletionFootage[] = [];
      const user = auth.currentUser;
      const isCloudSyncEnabled = localStorage.getItem('cloud_sync_enabled') === 'true';
      
      if (currentVideo.completionFootages && currentVideo.completionFootages.length > 0) {
        // Fetch URLs from IndexedDB for each footage
        footagesToSet = await Promise.all(
          currentVideo.completionFootages.map(async (f) => {
            if (f.url && f.url.startsWith('blob:')) return f; // Already loaded URL (if any temp blobs exist)
            
            let idbUrl = await FootageDB.get(f.id);
            if (!idbUrl && user) {
              idbUrl = await fetchFootageFromDb(user.uid, f.id);
            }
            
            let finalUrl = idbUrl || f.url || '';
            // For video to play, it should be a blob
            if (f.isVideo && finalUrl.startsWith('data:')) {
              finalUrl = await base64ToBlobUrl(finalUrl);
            }
            return { ...f, url: finalUrl }; 
          })
        );
      } else if (currentVideo.completionFootageUrl) {
        let finalUrl = currentVideo.completionFootageUrl;
        if (currentVideo.completionFootageIsVideo && finalUrl.startsWith('data:')) {
           finalUrl = await base64ToBlobUrl(finalUrl);
        }
        footagesToSet = [{
          id: 'legacy-footage',
          name: currentVideo.completionFootageName || 'Uploaded Footage',
          size: currentVideo.completionFootageSize || '',
          url: finalUrl,
          isVideo: currentVideo.completionFootageIsVideo || false,
        }];
      }
      
      if (isSubscribed) {
        setFootageFiles(footagesToSet);
        setShowFootageUploadBox(false);
      }
    };
    
    fetchFootages();
    return () => { isSubscribed = false; };
  }, [currentVideo?.id, currentVideo?.completionFootageUrl, currentVideo?.completionFootages]);

  const saveAndSyncFootages = (updatedList: CompletionFootage[]) => {
    if (activeCourse && currentVideo) {
      const updatedCourses = JSON.parse(localStorage.getItem('duono_courses') || '[]') as Course[];
      const targetCourse = updatedCourses.find(c => c.id === activeCourse.id);
      if (targetCourse) {
        const targetVideo = targetCourse.videos.find(v => v.id === currentVideo.id);
        if (targetVideo) {
          targetVideo.completionFootages = updatedList.map(f => ({ ...f, url: '' })); // Strip URL from localStorage quota
          // Synchronize legacy individual variables as fallback (first item)
          if (updatedList.length > 0) {
            targetVideo.completionFootageUrl = ''; // MUST BE STRIPPED as well!
            targetVideo.completionFootageName = updatedList[0].name;
            targetVideo.completionFootageSize = updatedList[0].size;
            targetVideo.completionFootageIsVideo = updatedList[0].isVideo;
          } else {
            delete targetVideo.completionFootageUrl;
            delete targetVideo.completionFootageName;
            delete targetVideo.completionFootageSize;
            delete targetVideo.completionFootageIsVideo;
          }
          saveCourses(updatedCourses);
          onUpdateCourses(updatedCourses);

          // Update active video React state
          setCurrentVideo({
            ...currentVideo,
            completionFootages: updatedList,
            completionFootageUrl: updatedList.length > 0 ? updatedList[0].url : undefined,
            completionFootageName: updatedList.length > 0 ? updatedList[0].name : undefined,
            completionFootageSize: updatedList.length > 0 ? updatedList[0].size : undefined,
            completionFootageIsVideo: updatedList.length > 0 ? updatedList[0].isVideo : undefined,
          });
        }
      }
    }
  };

  const handleDeleteFootage = (footageId: string) => {
    const updated = footageFiles.filter(f => f.id !== footageId);
    setFootageFiles(updated);
    saveAndSyncFootages(updated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    simulateUpload(file);
  };

  const simulateUpload = (file: File) => {
    if (footageFiles.length >= 3) {
      alert("⚠️ You can upload a maximum of 3 completion footages per lesson.");
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      alert("⚠️ Large file detected. For reliable persistent storage, please upload files under 2.5 MB (such as cropped screenshots or short clips).");
    }

    setUploadProgress(10);
    const nameLower = file.name.toLowerCase();
    const isVid = file.type.startsWith('video/') || 
                  nameLower.endsWith('.mp4') || 
                  nameLower.endsWith('.mov') || 
                  nameLower.endsWith('.webm') || 
                  nameLower.endsWith('.mkv') || 
                  nameLower.endsWith('.m4v') || 
                  nameLower.endsWith('.avi') || 
                  nameLower.endsWith('.rec') || 
                  nameLower.endsWith('.ogg') ||
                  file.type.includes('video') || 
                  (!file.type.startsWith('image/') && !nameLower.endsWith('.png') && !nameLower.endsWith('.jpg') && !nameLower.endsWith('.jpeg') && !nameLower.endsWith('.gif') && !nameLower.endsWith('.svg') && !nameLower.endsWith('.webp'));
    
    // Read the file as a persistent Base64 Data URL and compress if image
    let processBase64 = async (): Promise<string | null> => {
      if (!isVid) {
         try {
           return await compressImage(file, 800, 0.6); // Compress heavy images
         } catch(e) {
           console.error('Compression failed', e);
         }
      }
      return new Promise((resolve, reject) => {
         const reader = new FileReader();
         reader.onloadend = () => resolve(reader.result as string);
         reader.onerror = () => reject(new Error('File read failed'));
         reader.readAsDataURL(file);
      });
    };

    processBase64().then(async (base64Data) => {
      if (!base64Data) {
        alert("Failed to process file.");
        setUploadProgress(null);
        return;
      }
      const newId = `footage-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      try {
        await FootageDB.set(newId, base64Data);
      } catch (err) {
        console.error("Failed to save to IndexedDB:", err);
      }

      // Sync to Firebase directly regardless
      const user = auth.currentUser;
      if (user) {
        saveFootageToDb(user.uid, newId, base64Data).catch(err => console.error("Firebase footage sync error:", err));
      }
      
      let progress = 10;
      const interval = setInterval(async () => {
        progress += 15;
        if (progress >= 100) {
          clearInterval(interval);
          setUploadProgress(null);
          const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
          
          let displayUrl = base64Data;
          if (isVid) {
            displayUrl = await base64ToBlobUrl(base64Data);
          }
          
          const newFootage: CompletionFootage = {
            id: newId,
            name: file.name,
            size: `${sizeMB} MB`,
            url: displayUrl, // Create blob immediately for videos to prevent black screen!
            isVideo: isVid,
          };
          const updated = [...footageFiles, newFootage];
          setFootageFiles(updated);
          saveAndSyncFootages(updated);
        } else {
          setUploadProgress(progress);
        }
      }, 150);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      simulateUpload(file);
    }
  };

  const prevActiveCourseIdRef = useRef<string | null>(null);
  const prevSelectedVideoIdRef = useRef<string | null>(null);

  // Select first incomplete video from active course if none is selected
  useEffect(() => {
    if (showCelebration) return;

    if (activeCourse) {
      const courseIdChanged = prevActiveCourseIdRef.current !== activeCourse.id;
      const selectedVideoChanged = prevSelectedVideoIdRef.current !== (selectedVideo?.id || null);

      prevActiveCourseIdRef.current = activeCourse.id;
      prevSelectedVideoIdRef.current = selectedVideo?.id || null;

      if (selectedVideo) {
        const freshVideo = activeCourse.videos.find(v => v.id === selectedVideo.id);
        setCurrentVideo(freshVideo || selectedVideo);
      } else {
        const currentVideoBelongsToCourse = currentVideo && activeCourse.videos.some(v => v.id === currentVideo.id);

        if (!currentVideo || courseIdChanged || !currentVideoBelongsToCourse) {
          const firstIncomplete = activeCourse.videos.find(v => !v.completed);
          if (firstIncomplete) {
            setCurrentVideo(firstIncomplete);
          } else if (activeCourse.videos.length > 0) {
            // Fallback to first video if all are complete
            setCurrentVideo(activeCourse.videos[0]);
          }
        } else {
          // Sync currentVideo details with the latest version from activeCourse
          const freshVideo = activeCourse.videos.find(v => v.id === currentVideo.id);
          if (freshVideo) {
            setCurrentVideo(freshVideo);
          }
        }
      }
    } else {
      setCurrentVideo(null);
      prevActiveCourseIdRef.current = null;
      prevSelectedVideoIdRef.current = null;
    }
  }, [activeCourse, selectedVideo, showCelebration]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Set up timer ticker
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => {
          const newSeconds = prev + 1;
          // Grant 1 XP for every 20 seconds focused during session (accelerated gamification for better user feedback)
          if (newSeconds % 20 === 0) {
            setSessionXpEarned(x => x + 1);
          }
          return newSeconds;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  if (!activeCourse || !currentVideo) {
    return (
      <div className="flex-1 bg-[#F7F7F7] dark:bg-[#0c141a] flex flex-col items-center justify-center p-8 select-none">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-[var(--theme-primary-transparent)] border-2 border-[var(--theme-primary)] rounded-3xl flex items-center justify-center mx-auto text-[var(--theme-primary)] animate-pulse">
            <Clock className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800 dark:text-slate-100 tracking-tight">Focus Room Idle</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
              Please choose a course and start a lesson from the Learning Path node menu to open the interactive Focus Room.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Extract YouTube IDs from URL
  const getYoutubeIds = (url: string) => {
    if (!url) return { videoId: null, playlistId: null };
    const cleanUrl = url.trim();

    const playlistMatch = cleanUrl.match(/[?&]list=([^#\&\?]+)/);
    const playlistId = playlistMatch ? playlistMatch[1] : null;

    let videoId: string | null = null;
    const regExps = [
      /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/i,
      /youtube\.com\/watch\/.*v=([a-zA-Z0-9_-]{11})/i,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/i,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/i,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
      /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i
    ];

    for (const rx of regExps) {
      const match = cleanUrl.match(rx);
      if (match && match[1]) {
        videoId = match[1];
        break;
      }
    }
    if (!videoId) {
      const vMatch = cleanUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
      if (vMatch) videoId = vMatch[1];
    }
    if (!videoId) {
      const fallbackMatch = cleanUrl.match(/(?:\/|v=|vi=|embed\/)([a-zA-Z0-9_-]{11})(?:[?&]|$)/i);
      if (fallbackMatch) videoId = fallbackMatch[1];
    }

    return { videoId, playlistId };
  };

  const { videoId, playlistId } = getYoutubeIds(currentVideo.link || '');
  const embedUrl = playlistId 
    ? `https://www.youtube.com/embed/videoseries?list=${playlistId}`
    : videoId 
      ? `https://www.youtube.com/embed/${videoId}` 
      : null;

  // Format digital watch readout "MM:SS" or "HH:MM:SS"
  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (num: number) => String(num).padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Toggle tasks checkoff
  const handleToggleTask = (taskId: string) => {
    if (!activeCourse) return;

    const updatedCourses = JSON.parse(localStorage.getItem('duono_courses') || '[]') as Course[];
    const targetCourse = updatedCourses.find(c => c.id === activeCourse.id);
    if (!targetCourse) return;

    const targetVideo = targetCourse.videos.find(v => v.id === currentVideo.id);
    if (!targetVideo) return;

    const targetTask = targetVideo.tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    targetTask.completed = !targetTask.completed;

    saveCourses(updatedCourses);
    onUpdateCourses(updatedCourses);
    
    // Update active video state inline
    setCurrentVideo({ ...currentVideo, tasks: targetVideo.tasks });
  };

  // Append customized Dynamic Session Task
  const handleAddSessionTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim() || !activeCourse) return;

    const updatedCourses = JSON.parse(localStorage.getItem('duono_courses') || '[]') as Course[];
    const targetCourse = updatedCourses.find(c => c.id === activeCourse.id);
    if (!targetCourse) return;

    const targetVideo = targetCourse.videos.find(v => v.id === currentVideo.id);
    if (!targetVideo) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      text: newTodoText.trim(),
      completed: false,
    };

    targetVideo.tasks.push(newTask);

    saveCourses(updatedCourses);
    onUpdateCourses(updatedCourses);
    
    setCurrentVideo({ ...currentVideo, tasks: targetVideo.tasks });
    setNewTodoText('');
  };

  // Delete customized task
  const handleDeleteTask = (taskId: string) => {
    if (!activeCourse) return;

    const updatedCourses = JSON.parse(localStorage.getItem('duono_courses') || '[]') as Course[];
    const targetCourse = updatedCourses.find(c => c.id === activeCourse.id);
    if (!targetCourse) return;

    const targetVideo = targetCourse.videos.find(v => v.id === currentVideo.id);
    if (!targetVideo) return;

    targetVideo.tasks = targetVideo.tasks.filter(t => t.id !== taskId);

    saveCourses(updatedCourses);
    onUpdateCourses(updatedCourses);

    setCurrentVideo({ ...currentVideo, tasks: targetVideo.tasks });
  };

  // Complete lesson session and award points!
  const handleMarkVideoDone = (bypassGuard = false) => {
    if (!activeCourse || !currentVideo) return;

    // Validation Guard: If video exists and duration is recorded, verify if they watched at least 92% of the video length
    const isEmbedVideo = !!(currentVideo.link);
    let durationOfVideo = videoDuration;
    let currentWatchedTime = videoCurrentTime;

    const player = (window as any).player;
    if (player && typeof player.getDuration === 'function') {
      try {
        const d = player.getDuration();
        if (typeof d === 'number' && d > 0) durationOfVideo = d;
      } catch (err) {}
    }
    if (player && typeof player.getCurrentTime === 'function') {
      try {
        const curr = player.getCurrentTime();
        if (typeof curr === 'number' && !bypassGuard) currentWatchedTime = curr;
      } catch (err) {}
    }

    if (!bypassGuard && isEmbedVideo && durationOfVideo > 0 && currentWatchedTime < durationOfVideo * 0.92) {
      // Stop timer and show "No, you didn't" humorous alert modal
      setIsTimerRunning(false);
      setShowNoYouDidnt(true);
      return;
    }

    // Stop timer
    setIsTimerRunning(false);

    // Calculate XP: Flat completion bonus (+15 XP) + incremental session XP (1 XP per 20s accumulated during focus session)
    const baseCompletionXp = 15;
    const finalXpEarned = baseCompletionXp + sessionXpEarned;

    // Save Video Completed State
    const updatedCourses = JSON.parse(localStorage.getItem('duono_courses') || '[]') as Course[];
    const targetCourse = updatedCourses.find(c => c.id === activeCourse.id);
    if (!targetCourse) return;

    const targetVideo = targetCourse.videos.find(v => v.id === currentVideo.id);
    if (!targetVideo) return;

    const previouslyCompleted = targetVideo.completed;
    targetVideo.completed = true;

    // Determine if user completes the ENTIRE course now
    const courseWasAlreadyCompletedBefore = targetCourse.videos.every(v => v.id === currentVideo.id ? previouslyCompleted : v.completed);
    const isNowCompletingEntireCourse = !courseWasAlreadyCompletedBefore && targetCourse.videos.every(v => v.completed);

    // Ensure footage files list is saved in targetVideo
    targetVideo.completionFootages = footageFiles.map(f => ({ ...f, url: '' })); // Strip URL from localStorage quota
    if (footageFiles.length > 0) {
      targetVideo.completionFootageUrl = ''; // Clean legacy too
      targetVideo.completionFootageName = footageFiles[0].name;
      targetVideo.completionFootageSize = footageFiles[0].size;
      targetVideo.completionFootageIsVideo = footageFiles[0].isVideo;
    } else {
      delete targetVideo.completionFootageUrl;
      delete targetVideo.completionFootageName;
      delete targetVideo.completionFootageSize;
      delete targetVideo.completionFootageIsVideo;
    }

    // Also auto-complete all items in its checklist if completing the video
    targetVideo.tasks.forEach(t => t.completed = true);

    saveCourses(updatedCourses);
    onUpdateCourses(updatedCourses);

    // Award base XP
    let xpToAward = previouslyCompleted ? 5 : finalXpEarned;
    if (isNowCompletingEntireCourse) {
      xpToAward += 250; // Huge bonus (+250 XP) for completing the entire course!
    }

    // Award XP and complete local session
    const { stats: newStats } = addStudySession(
      activeCourse.id,
      activeCourse.name,
      currentVideo.id,
      currentVideo.title,
      seconds,
      xpToAward
    );

    // Prepare details for Duolingo style motivational popup!
    setCelebrationDetails({
      videoTitle: currentVideo.title,
      xpEarned: xpToAward,
      secondsSpent: seconds,
      unlockedBadges: [],
      isCourseCompleted: isNowCompletingEntireCourse,
      courseName: activeCourse.name
    });
    
    setShowCelebration(true);

    // Notify App shell
    onSessionComplete(newStats);

    // Reset session timer calculations
    setSeconds(0);
    setSessionXpEarned(0);
  };

  // Close celebration popup and route back to Path view
  const finishCelebration = () => {
    setShowCelebration(false);
    setCelebrationDetails(null);

    if (activeCourse && currentVideo) {
      const currentIndex = activeCourse.videos.findIndex(v => v.id === currentVideo.id);
      const nextVid = currentIndex !== -1 && currentIndex + 1 < activeCourse.videos.length
        ? activeCourse.videos[currentIndex + 1]
        : null;

      if (nextVid) {
        setSelectedVideo(nextVid);
      } else {
        setSelectedVideo(null);
      }
    } else {
      setSelectedVideo(null);
    }
  };

  // Sub-task completeness ratios
  const totalTasks = currentVideo.tasks.length;
  const completedTasks = currentVideo.tasks.filter(t => t.completed).length;
  const taskPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Next sections and up next calculation
  const currentIndex = activeCourse ? activeCourse.videos.findIndex(v => v.id === currentVideo.id) : -1;
  const upcomingVideos = activeCourse && currentIndex !== -1
    ? activeCourse.videos.slice(currentIndex + 1)
    : [];

  return (
    <div className="flex-1 bg-[#F7F7F7] dark:bg-[#0c141a] flex flex-col h-full overflow-hidden font-sans relative transition-colors">
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col lg:flex-row gap-6 scrollbar-thin">
        
        {/* LEFT: Core Lecture Media & Stopwatch Clock */}
        <div className="flex-1 space-y-6 flex flex-col min-w-0">
          
          {/* Embedded YouTube Player or Video Placeholder */}
          <div className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-[32px] p-5 shadow-sm space-y-4 select-none">
            {/* Embed Video Box with YouTube component */}
            {videoId || playlistId ? (
              <div id="video-container" className="w-full aspect-video rounded-2xl overflow-hidden border border-gray-200 dark:border-[#202f36] bg-black relative">
                <YouTube
                  videoId={videoId || undefined}
                  onReady={(event) => {
                    const player = event.target;
                    (window as any).player = player;
                    if (currentVideo && currentVideo.watchTime && currentVideo.watchTime > 2 && !currentVideo.completed && activeStartSeconds === null) {
                      try {
                        player.seekTo(currentVideo.watchTime, true);
                      } catch (err) {}
                    }
                  }}
                  opts={{
                    width: '100%',
                    height: '100%',
                    playerVars: {
                      autoplay: activeStartSeconds !== null ? 1 : 0,
                      start: activeStartSeconds || undefined,
                      modestbranding: 1,
                      rel: 0,
                      listType: playlistId ? 'playlist' : undefined,
                      list: playlistId || undefined,
                    },
                  }}
                  onStateChange={onPlayerStateChange}
                  className="w-full h-full"
                />
              </div>
            ) : (
              <div className="w-full aspect-video rounded-2xl bg-gray-100 dark:bg-[#18252d] border-2 border-dashed border-gray-200 dark:border-[#202f36] flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="p-3.5 bg-gray-200 dark:bg-[#202f36] text-gray-500 dark:text-slate-400 rounded-full">
                  <Youtube className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-700 dark:text-gray-200 text-sm">No Embedded Link Found</h4>
                  <p className="text-xs text-gray-400 dark:text-slate-500 max-w-sm mt-1">
                    You can watch your course notes or paste a link using YouTube course formats.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 tracking-wider">ACTIVE LESSON</span>
              <h3 className="text-lg font-black text-gray-700 dark:text-gray-200 tracking-tight leading-snug">{currentVideo.title}</h3>
            </div>

            {/* Real-time Video Playback Timeline Tracker */}
            {currentVideo.link && videoDuration > 0 && (
              <div id="video-length-tracker" className="bg-gray-50 dark:bg-[#18252d]/40 rounded-2xl p-3.5 border border-gray-150 dark:border-[#202f36] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center space-x-2.5 shrink-0">
                  <div className="p-1.5 bg-[var(--theme-primary-transparent)] text-[var(--theme-primary)] rounded-xl">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 tracking-widest block leading-none">VIDEO RUNTIME</span>
                    <span className="text-xs font-mono font-black text-gray-700 dark:text-slate-200 block mt-0.5">
                      {formatTime(Math.floor(videoCurrentTime))} / {formatTime(Math.floor(videoDuration))}
                    </span>
                  </div>
                </div>

                {/* Progress bar representing actual position */}
                <div className="flex-1 min-w-0 flex items-center space-x-3">
                  <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 relative overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 rounded-full ${videoCurrentTime >= videoDuration * 0.92 ? 'bg-emerald-500' : 'bg-[var(--theme-primary)]'}`}
                      style={{ width: `${Math.min(100, (videoCurrentTime / videoDuration) * 100)}%` }}
                    />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-mono font-black text-gray-750 dark:text-slate-300 leading-none">
                      {Math.round((videoCurrentTime / videoDuration) * 100)}%
                    </span>
                    <span className="text-[8px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                      {videoCurrentTime >= videoDuration * 0.92 ? 'GOAL MET' : 'WATCH 92%'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Video Chapters / Segments display */}
            {currentVideo.chapters && currentVideo.chapters.length > 0 && (
              <div className="border-t border-gray-200 dark:border-[#202f36] pt-4 mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest uppercase flex items-center space-x-1.5">
                    <span>📚 COURSE SEGMENTS</span>
                    <span className="text-[8px] font-black bg-[var(--theme-primary-transparent)] text-[var(--theme-primary)] px-2 py-0.5 rounded-full">
                      {currentVideo.chapters.filter(ch => ch.completed).length} / {currentVideo.chapters.length} DONE
                    </span>
                  </p>
                  <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase">Click title to jump video</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {currentVideo.chapters.map((ch) => {
                    const isChapterDone = ch.completed;
                    return (
                      <div 
                        key={ch.id} 
                        className={`group border rounded-xl p-2.5 flex items-center justify-between transition-all hover:border-[var(--theme-primary)] bg-gray-50/50 dark:bg-[#18252d]/40 hover:bg-sky-50/10 dark:hover:bg-[#202f36]/40 cursor-pointer
                          ${isChapterDone ? 'border-green-200 dark:border-green-950/40 bg-emerald-50/5 dark:bg-[#101e18]/20' : 'border-gray-200 dark:border-[#202f36]'}`}
                      >
                        <div 
                          onClick={() => {
                            const secs = convertTimestampToSeconds(ch.timestamp);
                            setActiveStartSeconds(secs);
                            setIsTimerRunning(true); // Start studying automatically
                          }}
                          className="flex items-center space-x-2 min-w-0 flex-1"
                        >
                          <span className="text-[9px] font-black font-mono tracking-wide text-white bg-[#FF9600] group-hover:bg-[var(--theme-primary)] px-1.5 py-0.5 rounded transition-all shrink-0">
                            {ch.timestamp}
                          </span>
                          <span className={`text-[11px] font-extrabold truncate leading-none 
                            ${isChapterDone ? 'text-gray-400 line-through font-medium dark:text-slate-500' : 'text-gray-700 dark:text-slate-200'}`}
                          >
                            {ch.title}
                          </span>
                        </div>
                        
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleChapterCompleteness(ch.id);
                          }}
                          className={`p-1 rounded-lg border cursor-pointer hover:scale-105 transition-all shrink-0 ml-2
                            ${isChapterDone 
                              ? 'bg-[var(--theme-primary)] border-[var(--theme-primary)] text-white' 
                              : 'border-gray-200 dark:border-[#35454e] text-gray-300 dark:text-slate-500 hover:text-gray-400'}`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* RIGHT: Action & Stats Sidebar */}
        <div className="w-full lg:w-96 flex flex-col justify-between space-y-6 select-none bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-[32px] p-6 shadow-sm lg:self-start transition-all">
          <div className="space-y-5 flex-1 pr-1">
            
            {/* Session Stats Section */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest uppercase">STUDY LOG</h4>
              <div className="border border-gray-200 dark:border-[#202f36] rounded-2xl p-4 bg-[var(--theme-primary-transparent)] flex items-center space-x-3.5 animate-fadeIn">
                <div className="p-2.5 bg-[var(--theme-primary)] rounded-xl text-white">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 leading-none">TIME SPENT</p>
                  <p className="text-xl font-black text-gray-800 dark:text-slate-100 mt-1 font-mono">{formatTime(seconds)}</p>
                </div>
              </div>
            </div>

            {/* Completion Footage Upload Box */}
            <div className="space-y-4 border-t border-gray-100 dark:border-[#202f36] pt-4 mt-6">
              <div className="flex items-center justify-between mb-1">
                <div className="space-y-0.5">
                  <h4 className="text-[10px] font-black text-gray-405 dark:text-slate-500 tracking-widest uppercase mb-0">COMPLETION FOOTAGE</h4>
                  <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500">{footageFiles.length}/3 uploaded</p>
                </div>
                {footageFiles.length < 3 && (
                  showFootageUploadBox ? (
                    <button
                      type="button"
                      onClick={() => setShowFootageUploadBox(false)}
                      className="py-1 px-3 text-[10px] font-black text-rose-500 hover:text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-[#1f1519] border border-rose-100 dark:border-rose-950/30 rounded-xl transition-all cursor-pointer uppercase flex items-center space-x-1"
                    >
                      <span>CANCEL</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowFootageUploadBox(true)}
                      className="py-1 px-3 text-[10px] font-black text-[var(--theme-primary)] bg-[var(--theme-primary-transparent)] border border-[var(--theme-primary-transparent)] rounded-xl transition-all cursor-pointer uppercase flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>ADD FOOTAGE</span>
                    </button>
                  )
                )}
              </div>

              {/* Uploaded items list */}
              {footageFiles.length > 0 && (
                <div className="space-y-3">
                  {footageFiles.map((file, idx) => (
                    <div key={file.id || idx} className="bg-neutral-50 dark:bg-[#1a262d] border border-gray-250 dark:border-[#35454e] rounded-2xl p-2 space-y-2 animate-fadeIn relative">
                      {/* Media preview */}
                      {file.url ? (
                        file.isVideo ? (
                          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-gray-150 dark:border-[#202f36]">
                            <video 
                              src={file.url} 
                              controls
                              playsInline
                              preload="metadata"
                              muted={idx > 0}
                              className="w-full h-full object-contain bg-black"
                            />
                          </div>
                        ) : (
                          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#fafafa] dark:bg-slate-800 border border-gray-150 dark:border-[#202f36]">
                            <img 
                              src={file.url} 
                              alt={`Footage ${idx + 1}`} 
                              className="w-full h-full object-contain bg-black"
                            />
                          </div>
                        )
                      ) : null}

                      <div className="flex items-center justify-between px-1">
                        <div className="text-left truncate min-w-0 pr-2">
                          <p className="text-[11px] font-black text-gray-750 dark:text-slate-200 truncate leading-tight">{file.name || `Footage #${idx + 1}`}</p>
                          <p className="text-[9px] font-extrabold text-[var(--theme-primary)] uppercase tracking-wide mt-0.5">{file.size || 'N/A'} • FILE #{idx + 1}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteFootage(file.id)}
                          className="py-1 px-2.5 text-[9px] font-black text-red-500 hover:text-red-650 dark:text-red-400 bg-red-50/50 hover:bg-red-100/30 dark:bg-red-950/15 dark:hover:bg-red-950/25 rounded-lg border-2 border-red-150 dark:border-red-950/20 transition-all cursor-pointer uppercase shrink-0"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Drop / browse zone */}
              {footageFiles.length < 3 && (showFootageUploadBox || uploadProgress !== null) && (
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 rounded-[24px] transition-all text-center overflow-hidden
                    ${uploadProgress !== null 
                      ? 'border-dashed border-sky-350 bg-sky-50/5 p-6' 
                      : 'border-dashed border-gray-250 dark:border-[#202f36] hover:border-gray-300 dark:hover:border-[#35454e] bg-gray-50/20 dark:bg-[#18252d]/40 p-6'}`}
                >
                  {uploadProgress !== null ? (
                    <div className="space-y-3 py-4">
                      <div className="w-8 h-8 rounded-full border-3 border-sky-500 border-t-transparent animate-spin mx-auto" />
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-sky-500 uppercase tracking-wider">Uploading...</p>
                        <div className="w-full bg-gray-100 dark:bg-[#202f36] rounded-full h-1.5 overflow-hidden">
                          <div className="bg-sky-500 h-full transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer py-4 space-y-2 select-none"
                    >
                      <div className="w-10 h-10 bg-gray-150 dark:bg-[#202f36] rounded-full flex items-center justify-center mx-auto text-gray-400 hover:scale-105 transition-transform duration-200">
                        <Upload className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-700 dark:text-slate-300">Drag & drop footage here</p>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 mt-1 uppercase">or click to browse local files</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="video/*,image/*"
                className="hidden"
              />
              {footageFiles.length > 0 && showFootageUploadBox && (
                <button
                  type="button"
                  onClick={() => {
                    saveAndSyncFootages(footageFiles);
                    setShowFootageUploadBox(false);
                    alert("Footage saved successfully to lesson node!");
                  }}
                  className="w-full mt-2 py-3 bg-[var(--theme-primary)] hover:brightness-110 text-white font-black text-[11px] rounded-xl tracking-widest transition-all cursor-pointer uppercase flex items-center justify-center space-x-2"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>SAVE FOOTAGES TO LESSON NODE</span>
                </button>
              )}
            </div>

            {/* Next Sections up */}
            <div className="space-y-2 border-t border-gray-100 dark:border-[#202f36] pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest uppercase">SYLLABUS TRACK</h4>
                {upcomingVideos.length > 0 && (
                  <span className="text-[9px] font-black text-[var(--theme-primary)] bg-[var(--theme-primary-transparent)] px-1.5 py-0.5 rounded">
                    {upcomingVideos.length} remaining
                  </span>
                )}
              </div>
              
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
                {/* Current Active Video */}
                {currentVideo && (
                  <div className="border-2 border-[var(--theme-primary)] rounded-xl p-2.5 bg-[var(--theme-primary-transparent)] space-y-1 relative ring-2 ring-[var(--theme-primary-transparent)]">
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="text-[11px] font-black text-[var(--theme-primary)] leading-snug line-clamp-2 pr-16">
                        {currentVideo.title}
                      </p>
                      <span className="text-[8px] font-black tracking-wider text-white bg-[var(--theme-primary)] px-1.5 py-0.5 rounded uppercase shrink-0">
                        ACTIVE - LECTURE {currentIndex + 1}
                      </span>
                    </div>
                    <p className="text-[9px] font-extrabold text-[var(--theme-primary)] uppercase tracking-wide">
                      ⚡ CURRENTLY STUDYING
                    </p>
                  </div>
                )}

                {upcomingVideos.length > 0 ? (
                  upcomingVideos.map((vid, idx) => {
                    const lectureNum = currentIndex + 2 + idx;
                    return (
                      <div key={vid.id || idx} className="border border-gray-205 dark:border-[#202f36] rounded-xl p-2.5 bg-gray-50/50 dark:bg-[#18252d]/45 hover:bg-gray-50 dark:hover:bg-[#202f36] transition-all space-y-1 relative group opacity-75 hover:opacity-100">
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="text-[11px] font-black text-gray-650 dark:text-slate-300 leading-snug group-hover:text-[var(--theme-primary)] transition-colors line-clamp-2 pr-12">
                            {vid.title}
                          </p>
                          <span className="text-[8px] font-black tracking-wider text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#202f36] px-1.5 py-0.5 rounded uppercase shrink-0">
                            LECTURE {lectureNum}
                          </span>
                        </div>
                        <p className="text-[9px] font-semibold text-gray-400 dark:text-slate-500 uppercase">
                          {vid.link ? '📺 Video Stream' : '📖 Lesson Chapter'}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="border border-dashed border-gray-200 dark:border-[#202f36] rounded-xl p-3 text-center bg-gray-50/30 dark:bg-[#18252d]/25">
                    <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase">🏆 FINAL LESSON REACHED</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Complete Lesson Node Banner Button */}
          <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-[#202f36] shrink-0">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeCourse && currentIndex > 0) {
                    setSelectedVideo(activeCourse.videos[currentIndex - 1]);
                    setSeconds(0);
                    setSessionXpEarned(0);
                  }
                }}
                disabled={currentIndex <= 0}
                className="flex-1 py-3 border-2 border-gray-200 dark:border-[#202f36] hover:bg-gray-100 dark:hover:bg-[#18252d] disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-300 dark:hover:border-[#35454e] font-black text-xs text-gray-500 dark:text-slate-400 rounded-2xl tracking-wider transition-all cursor-pointer uppercase"
              >
                PREVIOUS
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeCourse && currentIndex < activeCourse.videos.length - 1) {
                    setSelectedVideo(activeCourse.videos[currentIndex + 1]);
                    setSeconds(0);
                    setSessionXpEarned(0);
                  }
                }}
                disabled={!activeCourse || currentIndex >= activeCourse.videos.length - 1}
                className="flex-1 py-3 border-2 border-gray-200 dark:border-[#202f36] hover:bg-gray-100 dark:hover:bg-[#18252d] disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-300 dark:hover:border-[#35454e] font-black text-xs text-gray-500 dark:text-slate-400 rounded-2xl tracking-wider transition-all cursor-pointer uppercase"
              >
                NEXT
              </button>
            </div>

            <button
              onClick={() => handleMarkVideoDone()}
              className="w-full py-4 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] hover:translate-y-0.5 active:translate-y-1 active:border-b-transparent text-white font-black tracking-widest text-xs rounded-2xl transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer select-none uppercase"
            >
              <CheckCircle2 className="w-5 h-5 stroke-[3]" />
              <span>MARK LESSON COMPLETED</span>
            </button>
          </div>
        </div>

      </div>

      {/* DUOLINGO STYLE SUCCESS CONGRATULATION POPUP */}
      <AnimatePresence>
        {showCelebration && celebrationDetails && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-[36px] max-w-md w-full p-8 text-center space-y-6 shadow-2xl relative select-none"
            >
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 relative">
                {/* Visual success animated ring */}
                <div className={`w-24 h-24 ${celebrationDetails.isCourseCompleted ? 'bg-yellow-500/10 border-4 border-yellow-500 text-yellow-500' : 'bg-[var(--theme-primary-transparent)] border-4 border-[var(--theme-primary)]'} rounded-full flex items-center justify-center mx-auto animate-fadeIn`}>
                  {celebrationDetails.isCourseCompleted ? (
                    <Award className="w-12 h-12 fill-yellow-500 animate-bounce" />
                  ) : (
                    <Sparkles className="w-12 h-12 fill-[var(--theme-primary)]" />
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className={`text-2xl font-black ${celebrationDetails.isCourseCompleted ? 'text-yellow-600 dark:text-yellow-400' : 'text-[var(--theme-primary)]'} tracking-wider uppercase`}>
                  {celebrationDetails.isCourseCompleted ? "🏆 COURSE MASTERED! 🏆" : "EXCELLENT JOB!"}
                </h3>
                <p className="text-sm font-black text-gray-600 dark:text-slate-300 leading-tight">
                  {celebrationDetails.isCourseCompleted 
                    ? `You have finished all lessons in ${celebrationDetails.courseName || 'the course'}!` 
                    : "You Completed the study lesson:"
                  }
                </p>
                {!celebrationDetails.isCourseCompleted && (
                  <div className="bg-gray-50 dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] font-extrabold text-[#3C3C3C] dark:text-white px-4 py-2 rounded-2xl text-xs inline-block line-clamp-1">
                    {celebrationDetails.videoTitle}
                  </div>
                )}
              </div>

              {/* Award stats */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="border border-gray-200 dark:border-[#202f36] rounded-3xl p-4 bg-[#F7F7F7] dark:bg-[#18252d]/60 flex flex-col items-center justify-center space-y-1">
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-extrabold tracking-wider uppercase">Focus Spent</p>
                  <div className="flex items-center justify-center space-x-1">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-black text-emerald-500">{formatTime(celebrationDetails.secondsSpent)}</span>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-[#202f36] rounded-3xl p-4 bg-[#F7F7F7] dark:bg-[#18252d]/60 flex flex-col items-center justify-center space-y-1">
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-extrabold tracking-wider uppercase">XP Earned</p>
                  <div className="flex items-center justify-center space-x-1">
                    <Sparkles className="w-4 h-4 text-orange-500 fill-orange-500" />
                    <span className="text-sm font-black text-orange-500">+{celebrationDetails.xpEarned} XP</span>
                  </div>
                </div>
              </div>

              {celebrationDetails.isCourseCompleted && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3.5 rounded-2xl text-xs font-bold text-yellow-700 dark:text-yellow-400 leading-normal">
                  🥇 Includes <span className="font-black">+250 XP Graduation Bonus</span> for completing the syllabus!
                </div>
              )}

              <button
                onClick={finishCelebration}
                className="w-full py-4 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] text-white font-black text-sm rounded-2xl tracking-widest hover:brightness-105 active:translate-y-0.5 active:translate-y-1 active:border-b-transparent transition-all cursor-pointer shadow-md uppercase"
              >
                {activeCourse && activeCourse.videos.findIndex(v => v.id === currentVideo.id) + 1 < activeCourse.videos.length
                  ? "CONTINUE TO THE NEXT LESSON"
                  : "RETURN TO LEARNING PATH"
                }
              </button>
              <button
                onClick={() => {
                  setShowCelebration(false);
                  setCelebrationDetails(null);
                }}
                className="w-full py-3 bg-gray-100 dark:bg-[#202f36] text-gray-500 dark:text-slate-400 font-bold text-xs rounded-2xl tracking-widest hover:bg-gray-200 dark:hover:bg-[#263740] transition-all cursor-pointer uppercase mt-3"
              >
                NOT DONE YET, KEEP WATCHING
              </button>
            </motion.div>
          </div>
        )}

        {/* DUOLINGO STYLE NO, YOU DIDN'T WARNER POPUP */}
        {showNoYouDidnt && (
          <div className="fixed inset-0 bg-black/55 dark:bg-black/80 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="bg-white dark:bg-[#131f24] border-3 border-rose-200 dark:border-rose-950/40 rounded-[36px] max-w-md w-full p-8 text-center space-y-6 shadow-2xl relative select-none"
            >
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 relative">
                <div className="w-24 h-24 bg-rose-50 dark:bg-rose-950/30 border-4 border-rose-500 rounded-full flex items-center justify-center mx-auto text-rose-500 animate-[bounce_2s_infinite]">
                  <ShieldAlert className="w-12 h-12 stroke-[2.5]" />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-3xl font-black text-rose-600 dark:text-rose-450 tracking-wide uppercase">
                  No, you didn't.
                </h3>
                <p className="text-sm font-bold text-gray-650 dark:text-slate-350 leading-relaxed max-w-sm mx-auto">
                  Nice try! But you haven't watched the entire lesson contents yet. Keep watching to unlock completeness!
                </p>
                <div className="bg-gray-50 dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] font-extrabold text-[#3C3C3C] dark:text-white px-4 py-2 rounded-2xl text-xs inline-block line-clamp-1 max-w-full">
                  {currentVideo.title}
                </div>
              </div>

              {/* Progress visual */}
              <div className="bg-neutral-50 dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] rounded-3xl p-5 space-y-3.5 text-left">
                <div className="flex justify-between items-center text-xs font-black text-gray-550 dark:text-slate-400">
                  <span className="uppercase tracking-wider">YOUR PLAYBACK POSITION</span>
                  <span className="font-mono text-rose-505 font-black text-rose-500">
                    {videoDuration > 0 ? Math.round((videoCurrentTime / videoDuration) * 100) : 0}%
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-rose-500 transition-all duration-300" 
                    style={{ width: `${videoDuration > 0 ? Math.min(100, (videoCurrentTime / videoDuration) * 100) : 0}%` }} 
                  />
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-emerald-500" 
                    style={{ left: '92%' }} 
                    title="Required Watched Threshold: 92%"
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-gray-400 dark:text-slate-500 font-bold">
                  <span>Watched: {formatTime(Math.floor(videoCurrentTime))}</span>
                  <span>Goal: 92% ({formatTime(Math.floor(videoDuration * 0.92))})</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    setShowNoYouDidnt(false);
                    // Automatically trigger play state for comfortable resume
                    const player = (window as any).player;
                    if (player && typeof player.playVideo === 'function') {
                      try {
                        player.playVideo();
                      } catch (err) {}
                    }
                  }}
                  className="w-full py-4 bg-rose-500 border-b-4 border-rose-700 text-white font-black text-xs rounded-2xl tracking-widest hover:brightness-105 active:translate-y-0.5 active:translate-y-1 active:border-b-transparent transition-all cursor-pointer shadow-md uppercase"
                >
                  GO BACK AND WATCH IT ALL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNoYouDidnt(false);
                    handleMarkVideoDone(true);
                  }}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-[#18252d] dark:hover:bg-[#202f36] text-gray-700 dark:text-slate-300 font-extrabold text-xs rounded-2xl tracking-widest border border-gray-200 dark:border-[#202f36] transition-all cursor-pointer shadow-sm uppercase"
                >
                  Skip & Leave Anyway
                </button>
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-none">
                  Validation: Powered by Duono Watch-Dog 🐕
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
