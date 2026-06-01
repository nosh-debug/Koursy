import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Youtube, AlertCircle, Check, Trash2, X, Plus, Sparkles, BookOpen } from 'lucide-react';
import { Course, Video, Task } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { saveCourses } from '../storage';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  onUpdateCourses: (courses: Course[]) => void;
  onSelectCourse: (courseId: string) => void;
  user: any;
}

export default function CreateCourseModal({
  isOpen,
  onClose,
  courses,
  onUpdateCourses,
  onSelectCourse,
  user,
}: CreateCourseModalProps) {
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [isPublicRequest, setIsPublicRequest] = useState(false);
  const [videoInputLines, setVideoInputLines] = useState<string[]>(['']);
  const [loaderError, setLoaderError] = useState('');
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  // Handle YouTube URL loading (supports playists and single videos)
  const handleLoadYouTubePlaylist = async (url: string) => {
    if (!url.trim()) return;
    setLoaderError('');
    setLoadingPlaylist(true);

    // Locate playlist parameter ID
    const playlistMatch = url.match(/[?&]list=([^#\&\?]+)/i);
    const playlistId = playlistMatch ? playlistMatch[1] : null;

    // Is it a single video?
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
      const match = url.match(rx);
      if (match && match[1]) {
        videoId = match[1];
        break;
      }
    }
    if (!videoId) {
      const vMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
      if (vMatch) {
        videoId = vMatch[1];
      }
    }
    if (!videoId) {
      const fallbackMatch = url.match(/(?:\/|v=|vi=|embed\/)([a-zA-Z0-9_-]{11})(?:[?&]|$)/i);
      if (fallbackMatch) {
        videoId = fallbackMatch[1];
      }
    }

    if (!playlistId && !videoId) {
      setLoaderError('Could not find a valid YouTube video ID or "?list=" playlist ID in the URL. Please verify your link.');
      setLoadingPlaylist(false);
      return;
    }

    try {
      if (playlistId) {
        const resp = await fetch(`/api/parse-playlist?id=${playlistId}`);
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch playlist items (status ${resp.status})`);
        }

        const data = await resp.json();
        const titleOnlyLines = data.videos.map((v: any) => {
          if (v.duration) {
            return `${v.title} [${v.duration}] | ${v.link}`;
          }
          return `${v.title} | ${v.link}`;
        }).join('\n');

        setVideoInputLines(titleOnlyLines.split('\n'));
        setNewCourseName(data.title || 'Imported Course');
        setNewCourseDesc('');
      } else if (videoId) {
        const resp = await fetch(`/api/parse-video?id=${videoId}`);
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch video details (status ${resp.status})`);
        }

        const data = await resp.json();
        const titleLine = `${data.title} | ${data.link}`;
        setVideoInputLines([titleLine]);
        setNewCourseName(data.title || 'Imported Class');
        setNewCourseDesc('');
      }
    } catch (err: any) {
      console.error(err);
      setLoaderError(err.message || 'An error occurred while communicating with the server playlist scraper.');
    } finally {
      setLoadingPlaylist(false);
    }
  };

  const handleCreateCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoaderError('');

    if (courses.length >= 5) {
      setLoaderError(`You have reached the maximum of 5 courses. Current: ${courses.length}`);
      return;
    }

    if (!newCourseName.trim()) {
      setLoaderError('Course name is required!');
      return;
    }

    // Parse Title | Link lines
    const parsedVideos: Video[] = [];
    const validLines = videoInputLines.filter(l => l.trim() !== '');
    if (validLines.length > 0) {
      validLines.forEach((line, index) => {
        if (!line.trim()) return;

        let title = `Video ${index + 1}`;
        let link = '';

        if (line.includes('|')) {
          const parts = line.split('|');
          const lastPart = parts[parts.length - 1].trim();
          if (lastPart.startsWith('http://') || lastPart.startsWith('https://')) {
            link = lastPart;
            title = parts.slice(0, parts.length - 1).join('|').trim();
          } else {
            title = parts[0].trim();
            link = parts[1]?.trim() || '';
          }
        } else {
          title = line.trim();
        }

        // Add standard 3 sub-tasks checklist as defaults for easy gamification
        const defaultTasks: Task[] = [
          { id: `t-${Date.now()}-${index}-1`, text: 'Study lecture notes & watch full stream', completed: false },
          { id: `t-${Date.now()}-${index}-2`, text: 'Solve example codes & exercises', completed: false },
          { id: `t-${Date.now()}-${index}-3`, text: 'Draft video summary notes', completed: false },
        ];

        parsedVideos.push({
          id: `video-${Date.now()}-${index}`,
          title,
          link,
          completed: false,
          tasks: defaultTasks,
          notes: `Personal notes and highlights for ${title}.\nUse this space to key down major takeaways!`,
        });
      });
    }

    if (parsedVideos.length === 0) {
      parsedVideos.push({
        id: `video-${Date.now()}-0`,
        title: 'Introduction Lecture',
        link: 'https://www.youtube.com/watch?v=yYmI_OBe48A',
        completed: false,
        notes: 'Introductory notes.',
        tasks: [
          { id: `t-${Date.now()}-0-1`, text: 'Watch introductory guidelines', completed: false },
        ]
      });
    }

    const newCourse: Course = {
      id: `course-${Date.now()}`,
      name: newCourseName.trim(),
      description: newCourseDesc.trim(),
      videos: parsedVideos,
      isPublic: isPublicRequest,
      createdAt: new Date().toISOString(),
    };

    if (isPublicRequest) {
      try {
        await setDoc(doc(db, 'shared_courses', newCourse.id), {
          id: newCourse.id,
          creatorId: user?.uid || 'anonymous',
          creatorName: user?.displayName || 'Anonymous',
          creatorPhotoURL: user?.photoURL || '',
          courseName: newCourse.name,
          description: newCourse.description || '',
          likesCount: 0,
          dislikesCount: 0,
          videos: newCourse.videos.map(v => ({ title: v.title, link: v.link })),
        });
      } catch (error) {
        console.error("Error publishing course:", error);
      }
    }

    const updated = [...courses, newCourse];
    onUpdateCourses(updated);
    saveCourses(updated);

    // Automatically select the newly created course & close modal
    onSelectCourse(newCourse.id);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setNewCourseName('');
    setNewCourseDesc('');
    setIsPublicRequest(false);
    setVideoInputLines(['']);
    setLoaderError('');
    const playlistInput = document.getElementById('global-playlist-url-input') as HTMLInputElement;
    if (playlistInput) playlistInput.value = '';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-[30px] p-6 max-w-lg w-full relative space-y-5 shadow-2xl font-sans"
          >
            {/* Close button */}
            <button
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="absolute top-4 right-4 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center md:text-left">
              <h3 className="text-xl font-black text-gray-800 dark:text-white tracking-tight leading-none uppercase flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[var(--theme-primary)]" />
                CREATE NEW COURSE
              </h3>
              <p className="text-xs text-neutral-400 dark:text-slate-500 font-medium mt-1">
                Draft a brand new course with custom lectures or YouTube playlist. (Limit: 5 courses)
              </p>
            </div>

            {loaderError && (
              <div className="bg-red-50/10 border border-red-200 dark:border-red-950/40 text-red-500 font-bold rounded-xl p-3.5 text-xs flex items-center space-x-2 animate-fadeIn">
                <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-500" />
                <span>{loaderError}</span>
              </div>
            )}

            {/* YouTube Loader */}
            <div className="bg-neutral-50 dark:bg-neutral-900/10 border border-neutral-200/50 dark:border-[#202f36] rounded-2xl p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <Youtube className="w-4 h-4 text-red-500 fill-red-500" />
                <span className="text-[10px] font-black text-[var(--theme-primary)] uppercase tracking-wide">YouTube Auto-Loader</span>
              </div>
              
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-extrabold uppercase leading-normal">
                Paste a Youtube playlist or individual video link to import content instantly
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  id="global-playlist-url-input"
                  disabled={loadingPlaylist}
                  placeholder="Paste video URL or playlist (?list=) link..."
                  className="flex-1 bg-white dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] text-xs px-3.5 py-2.5 rounded-xl font-medium text-gray-750 dark:text-slate-200 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                />
                <button
                  type="button"
                  disabled={loadingPlaylist}
                  onClick={() => {
                    const input = document.getElementById('global-playlist-url-input') as HTMLInputElement;
                    if (input) handleLoadYouTubePlaylist(input.value);
                  }}
                  className="py-2.5 px-4 bg-[var(--theme-primary)] hover:brightness-105 active:scale-95 text-white font-black text-xs cursor-pointer rounded-xl uppercase shrink-0 disabled:bg-gray-300 flex items-center justify-center min-w-[120px] transition-all"
                >
                  {loadingPlaylist ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "LOAD"
                  )}
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateCourseSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase">Course Name</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Advanced Calculus Path"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] focus:border-[var(--theme-primary)] focus:bg-white dark:focus:bg-[#131f24] px-3.5 py-2.5 text-xs font-bold text-gray-800 dark:text-slate-200 rounded-xl outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase">Course Description</label>
                <input
                  type="text"
                  placeholder="E.g. A comprehensive mathematical path for university study"
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] focus:border-[var(--theme-primary)] focus:bg-white dark:focus:bg-[#131f24] px-3.5 py-2.5 text-xs font-bold text-gray-800 dark:text-slate-200 rounded-xl outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="globalIsPublicToggle"
                    checked={isPublicRequest}
                    onChange={(e) => setIsPublicRequest(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                  />
                  <label htmlFor="globalIsPublicToggle" className="text-xs font-bold text-gray-700 dark:text-slate-200 cursor-pointer">
                    Publish to Community Hub
                  </label>
                </div>
                {isPublicRequest && (
                  <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl space-y-0.5 animate-fadeIn">
                    <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1">
                      ⚠️ Permanent Publication Notice
                    </p>
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 leading-normal uppercase">
                      Publishing is permanent! Once shared, it stays in the Community Hub.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase">Outline (Title | Link or Name only)</label>
                  {videoInputLines.filter(l => l.trim() !== '').length > 0 && (
                    <span className="text-[9px] font-black text-[var(--theme-primary)] uppercase tracking-wider">({videoInputLines.filter(l => l.trim() !== '').length} videos)</span>
                  )}
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin">
                  {videoInputLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-white dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-gray-400 dark:text-gray-500 font-bold text-xs shrink-0 flex items-center gap-1.5">
                        {idx + 1}. <Check className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Intro Lecture | Link"
                        value={line}
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData('text');
                          if (pasted.includes('\n')) {
                            e.preventDefault();
                            const lines = pasted.split(/\r?\n/).filter(l => l.trim() !== '');
                            const newLines = [...videoInputLines];
                            newLines.splice(idx, 1, ...lines);
                            setVideoInputLines(newLines);
                          }
                        }}
                        onChange={(e) => {
                          const newLines = [...videoInputLines];
                          newLines[idx] = e.target.value;
                          setVideoInputLines(newLines);
                        }}
                        className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 truncate"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (videoInputLines.length > 1) {
                            setVideoInputLines(videoInputLines.filter((_, i) => i !== idx));
                          } else {
                            setVideoInputLines(['']);
                          }
                        }}
                        className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t border-neutral-100 dark:border-[#202f36]">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    onClose();
                  }}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-[#202f36] hover:bg-gray-50 dark:hover:bg-[#18252d] text-gray-500 dark:text-slate-300 font-black text-xs rounded-xl tracking-wider transition-all cursor-pointer uppercase"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[var(--theme-primary)] hover:brightness-105 active:scale-95 text-white font-black text-xs rounded-xl tracking-wider transition-all shadow-sm cursor-pointer uppercase flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  CREATE
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
