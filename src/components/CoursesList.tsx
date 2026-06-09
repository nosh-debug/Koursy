import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Plus, Edit, Trash2, Check, Video as VideoIcon, Calendar, FileText, ArrowLeft, Star, ExternalLink, Sparkles, AlertCircle, Youtube, Search, X, Share2 } from 'lucide-react';
import { Course, Video, Task, Chapter } from '../types';
import { saveCourses } from '../storage';
import { db } from '../lib/firebase-supabase-adapter';
import { collection, doc, setDoc, deleteDoc } from '../lib/firebase-supabase-adapter';

export function getCourseCreatedDate(course: Course): string {
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
  
  // Try to parse ID
  const parts = course.id.split('-');
  const lastPart = parts[parts.length - 1];
  if (lastPart && /^\d+$/.test(lastPart)) {
    const ts = parseInt(lastPart, 10);
    if (ts > 946684800000 && ts < 4102444800000) {
      return new Date(ts).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }

  return "Preset Course";
}

interface CoursesListProps {
  courses: Course[];
  activeCourseId: string | null;
  onSelectActiveCourse: (courseId: string) => void;
  onUpdateCourses: (courses: Course[]) => void;
  setTab: (tab: 'home' | 'courses' | 'today' | 'settings' | 'community') => void;
  user: any; // Add user prop
}

export default function CoursesList({
  courses,
  activeCourseId,
  onSelectActiveCourse,
  onUpdateCourses,
  setTab,
  user // destructure user
}: CoursesListProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseToDeleteId, setCourseToDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTarget, setSearchTarget] = useState<'all' | 'name' | 'description' | 'lectures'>('all');

  // Filter courses based on user input search query and targets (name, description, or individual lecture video titles)
  const trimmedSearchQuery = searchQuery.toLowerCase().trim();
  const filteredCourses = courses.filter((course) => {
    if (!trimmedSearchQuery) return true;

    const matchesName = course.name.toLowerCase().includes(trimmedSearchQuery);
    const matchesDesc = !!(course.description && course.description.toLowerCase().includes(trimmedSearchQuery));
    const matchesLectures = course.videos.some(vid => vid.title.toLowerCase().includes(trimmedSearchQuery));

    if (searchTarget === 'name') return matchesName;
    if (searchTarget === 'description') return matchesDesc;
    if (searchTarget === 'lectures') return matchesLectures;

    // Default 'all'
    return matchesName || matchesDesc || matchesLectures;
  });

  // Inline syllabus course name/desc editing state
  const [isEditingCourseName, setIsEditingCourseName] = useState(false);
  const [editedCourseName, setEditedCourseName] = useState('');
  const [isEditingCourseDesc, setIsEditingCourseDesc] = useState(false);
  const [editedCourseDesc, setEditedCourseDesc] = useState('');
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);

  const handleDeleteAllCourses = () => {
    if (!showConfirmDeleteAll) {
      setShowConfirmDeleteAll(true);
      setTimeout(() => setShowConfirmDeleteAll(false), 4000);
      return;
    }
    onUpdateCourses([]);
    saveCourses([]);
    setShowConfirmDeleteAll(false);
  };

  const handleSaveCourseName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingCourse || !onUpdateCourses) {
      setIsEditingCourseName(false);
      return;
    }
    const trimmed = editedCourseName.trim();
    if (trimmed && trimmed !== editingCourse.name) {
      const updatedCourse = { ...editingCourse, name: trimmed };
      setEditingCourse(updatedCourse);
      const updatedList = courses.map(c => c.id === editingCourse.id ? updatedCourse : c);
      onUpdateCourses(updatedList);
      saveCourses(updatedList);
    }
    setIsEditingCourseName(false);
  };

  const handleSaveCourseDesc = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingCourse || !onUpdateCourses) {
      setIsEditingCourseDesc(false);
      return;
    }
    const trimmed = editedCourseDesc.trim();
    if (trimmed !== editingCourse.description) {
      const updatedCourse = { ...editingCourse, description: trimmed };
      setEditingCourse(updatedCourse);
      const updatedList = courses.map(c => c.id === editingCourse.id ? updatedCourse : c);
      onUpdateCourses(updatedList);
      saveCourses(updatedList);
    }
    setIsEditingCourseDesc(false);
  };
  
  // Create Course form state
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [isPublicRequest, setIsPublicRequest] = useState(false);
  const [videoInputLines, setVideoInputLines] = useState<string[]>(['']);
  
  // Custom video detail editing fields
  const [editingVideoIndex, setEditingVideoIndex] = useState<number | null>(null);
  const [videoTitleEdit, setVideoTitleEdit] = useState('');
  const [videoLinkEdit, setVideoLinkEdit] = useState('');
  const [videoDateEdit, setVideoDateEdit] = useState('');
  const [videoNotesEdit, setVideoNotesEdit] = useState('');
  
  // Custom chapters editing fields
  const [videoChaptersEdit, setVideoChaptersEdit] = useState<Chapter[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterTimestamp, setNewChapterTimestamp] = useState('');

  // Handle adding chapter to memory array
  const handleAddChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim()) return;

    const ts = newChapterTimestamp.trim() || '00:00';
    const newChapter: Chapter = {
      id: `chapter-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: newChapterTitle.trim(),
      timestamp: ts,
      completed: false
    };

    // Simple timestamp sort function
    const convertTsToSecs = (str: string) => {
      const parts = str.split(':').map(Number);
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
      return parts[0] || 0;
    };

    const sortedChapters = [...videoChaptersEdit, newChapter].sort((a, b) => {
      return convertTsToSecs(a.timestamp) - convertTsToSecs(b.timestamp);
    });

    setVideoChaptersEdit(sortedChapters);
    setNewChapterTitle('');
    setNewChapterTimestamp('');
  };

  const handleDeleteChapter = (chapterId: string) => {
    setVideoChaptersEdit(videoChaptersEdit.filter(c => c.id !== chapterId));
  };

  // Track user error in loader
  const [loaderError, setLoaderError] = useState('');
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  // Select course templates
  const handleQuickAddTemplate = (courseTemplate: Course) => {
    if (courses.length >= 5) {
      alert("You have reached the maximum of 5 courses. Please delete a course before adding a new one.");
      return;
    }
    // Generate a unique ID to prevent duplicates
    const uniqueCourse: Course = {
      ...courseTemplate,
      id: `${courseTemplate.id}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      videos: courseTemplate.videos.map(v => ({
        ...v,
        id: `${v.id}-${Date.now()}`,
        completed: false,
        tasks: v.tasks.map(t => ({ ...t, completed: false }))
      }))
    };

    const updated = [...courses, uniqueCourse];
    onUpdateCourses(updated);
    saveCourses(updated);
  };

  // Create customized user course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoaderError('');

    if (!newCourseName.trim()) {
      setLoaderError('Course name is required!');
      return;
    }

    // Parse the Title | Link lines
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

    // Default video if none parsed
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
          creatorId: user.uid,
          creatorName: user.displayName || 'Anonymous',
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

    // Reset Form
    setNewCourseName('');
    setNewCourseDesc('');
    setIsPublicRequest(false);
    setVideoInputLines(['']);
    setShowAddModal(false);
  };

  const handleDeleteCourse = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (course?.isPublic) {
      alert("You cannot delete a published course. Withdraw it from the community first.");
      return;
    }
    setCourseToDeleteId(courseId);
  };

  const confirmDeleteCourse = () => {
    if (!courseToDeleteId) return;
    const updated = courses.filter(c => c.id !== courseToDeleteId);
    onUpdateCourses(updated);
    saveCourses(updated);
    setCourseToDeleteId(null);
  };

  // Handle YouTube Playlist URL loading
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
        // Handle playlist import route
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
        // Handle individual video import route
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

  // Open Video editor sub-room
  const openVideoEditor = (videoIndex: number) => {
    if (!editingCourse) return;
    const v = editingCourse.videos[videoIndex];
    setEditingVideoIndex(videoIndex);
    setVideoTitleEdit(v.title);
    setVideoLinkEdit(v.link || '');
    setVideoDateEdit(v.dueDate || '');
    setVideoNotesEdit(v.notes || '');
    setVideoChaptersEdit(v.chapters || []);
    setNewChapterTitle('');
    setNewChapterTimestamp('');
  };

  // Save changes to video
  const saveVideoEdit = () => {
    if (!editingCourse || editingVideoIndex === null) return;

    const modifiedVideos = [...editingCourse.videos];
    modifiedVideos[editingVideoIndex] = {
      ...modifiedVideos[editingVideoIndex],
      title: videoTitleEdit.trim() || 'Untitled Lecture',
      link: videoLinkEdit.trim(),
      dueDate: videoDateEdit,
      notes: videoNotesEdit,
      chapters: videoChaptersEdit
    };

    const updatedCourse = { ...editingCourse, videos: modifiedVideos };
    setEditingCourse(updatedCourse);

    // Persist into course array list
    const updatedCoursesList = courses.map(c => c.id === editingCourse.id ? updatedCourse : c);
    onUpdateCourses(updatedCoursesList);
    saveCourses(updatedCoursesList);

    // Close video sub-editor
    setEditingVideoIndex(null);
  };

  return (
    <div className="flex-1 bg-[#F7F7F7] dark:bg-[#0c141a] p-6 md:p-8 overflow-y-auto h-full relative select-none font-sans scrollbar-thin">
      
      {/* If editing a course, show Course Planner view */}
      {editingCourse ? (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#202f36] pb-4">
            <button
              onClick={() => setEditingCourse(null)}
              className="flex items-center space-x-2 py-2 px-4 border border-gray-200 dark:border-[#202f36] hover:border-gray-300 dark:hover:border-[#35454e] rounded-2xl bg-white dark:bg-[#131f24] hover:bg-gray-50 dark:hover:bg-[#18252d] font-black text-xs text-gray-500 dark:text-slate-300 tracking-wider transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>RETURN TO COURSES</span>
            </button>
            <div className="text-right">
              <span className="text-[10px] font-black text-[#FF9600] uppercase bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded border border-orange-100 dark:border-orange-900/30">
                COURSE SYLLABUS EDIT
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-3xl p-6 shadow-sm space-y-4">
            {/* Course Name Editing */}
            {isEditingCourseName ? (
              <form onSubmit={handleSaveCourseName} className="flex items-center space-x-2">
                <span className="text-sm font-extrabold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Syllabus for:</span>
                <input
                  type="text"
                  value={editedCourseName}
                  onChange={(e) => setEditedCourseName(e.target.value)}
                  className="px-3 py-1.5 text-sm font-black border-2 border-[#FF9600] bg-white dark:bg-[#18252d] text-gray-850 dark:text-gray-100 rounded-xl focus:outline-none flex-1 max-w-md"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsEditingCourseName(false);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="p-1 px-3 bg-[#FF9600] border-b-2 border-r border-[#cc7800] active:border-b-transparent hover:translate-y-[1px] text-white text-[10px] font-black tracking-wider uppercase rounded-lg transition-all cursor-pointer shadow-sm flex-shrink-0"
                  title="Save course name"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingCourseName(false)}
                  className="p-1 px-2.5 bg-gray-200 dark:bg-[#202f36] text-gray-500 dark:text-gray-300 text-[10px] font-black tracking-wider uppercase rounded-lg hover:bg-gray-300 dark:hover:bg-[#35454e] transition-colors cursor-pointer flex-shrink-0"
                  title="Cancel renaming"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div 
                className="flex items-center space-x-2 group cursor-pointer hover:text-[#FF9600] transition-colors"
                onClick={() => {
                  setEditedCourseName(editingCourse.name);
                  setIsEditingCourseName(true);
                }}
              >
                <h2 className="text-2xl font-black text-gray-700 dark:text-gray-150 tracking-tight leading-none flex items-center gap-2 select-none">
                  <span>Syllabus for: <span className="text-[#FF9600]">{editingCourse.name}</span></span>
                  <Edit className="w-4 h-4 text-gray-400 group-hover:text-[#FF9600] transition-colors inline-block" />
                </h2>
              </div>
            )}

            {/* Course Description Editing */}
            {isEditingCourseDesc ? (
              <form onSubmit={handleSaveCourseDesc} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={editedCourseDesc}
                  onChange={(e) => setEditedCourseDesc(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold border-2 border-[#FF9600] bg-white dark:bg-[#18252d] text-gray-800 dark:text-gray-150 rounded-xl focus:outline-none flex-1 max-w-xl"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsEditingCourseDesc(false);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="p-1 px-3 bg-[#FF9600] border-b-2 border-r border-[#cc7800] active:border-b-transparent hover:translate-y-[1px] text-white text-[10px] font-black tracking-wider uppercase rounded-lg transition-all cursor-pointer shadow-sm flex-shrink-0"
                  title="Save course description"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingCourseDesc(false)}
                  className="p-1 px-2.5 bg-gray-200 dark:bg-[#202f36] text-gray-500 dark:text-gray-300 text-[10px] font-black tracking-wider uppercase rounded-lg hover:bg-gray-300 dark:hover:bg-[#35454e] transition-colors cursor-pointer flex-shrink-0"
                  title="Cancel editing description"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div 
                className="flex items-center space-x-2 group cursor-pointer hover:text-[#FF9600] transition-colors"
                onClick={() => {
                  setEditedCourseDesc(editingCourse.description || '');
                  setIsEditingCourseDesc(true);
                }}
              >
                <p className="text-xs text-gray-400 dark:text-slate-400 font-bold flex items-center gap-1.5 select-none text-left">
                  <span>{editingCourse.description || 'No description provided.'}</span>
                  <Edit className="w-3 h-3 text-gray-400 group-hover:text-[#FF9600] transition-colors inline-block flex-shrink-0" />
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Column: List of Course Videos */}
            <div className="md:col-span-1 border-2 border-gray-200 dark:border-[#202f36] bg-white dark:bg-[#131f24] rounded-3xl p-4 space-y-3 h-[500px] overflow-y-auto scrollbar-thin">
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase mb-2">LECTURE OUTLINE ({editingCourse.videos.length})</p>
              
              <div className="space-y-2">
                {editingCourse.videos.map((vid, idx) => {
                  const isActive = editingVideoIndex === idx;
                  return (
                    <button
                      key={vid.id}
                      onClick={() => openVideoEditor(idx)}
                      className={`w-full flex items-start space-x-3 text-left p-3 rounded-2xl border transition-all cursor-pointer
                        ${isActive 
                          ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40 text-orange-700 dark:text-orange-450 shadow-sm' 
                          : 'border-transparent dark:border-transparent hover:bg-gray-50 dark:hover:bg-[#18252d]'}`}
                    >
                      <div className={`p-1.5 rounded-lg mt-0.5 flex-shrink-0
                        ${vid.completed ? 'bg-[var(--theme-primary)] text-white' : 'bg-gray-100 dark:bg-[#202f36] text-gray-400 dark:text-slate-500'}`}
                      >
                        <VideoIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-extrabold line-clamp-2 leading-none text-gray-750 dark:text-slate-200">{vid.title}</p>
                        {vid.dueDate && (
                          <p className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase">Due {vid.dueDate}</p>
                        )}
                        <p className="text-[9px] font-medium text-gray-400 dark:text-slate-500 leading-none">
                          {vid.tasks.length} Checkpoints
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Active Video Editor Fields */}
            <div className="md:col-span-2 border-2 border-gray-200 dark:border-[#202f36] bg-white dark:bg-[#131f24] rounded-3xl p-6 shadow-sm">
              {editingVideoIndex !== null ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#202f36]">
                    <h3 className="font-extrabold text-gray-700 dark:text-slate-200 text-sm">EDIT LECTURE DETAILED NOTES</h3>
                    <span className="text-[10px] bg-gray-100 dark:bg-[#202f36] text-gray-500 dark:text-slate-400 font-black px-2 py-0.5 rounded-full">
                      LECTURE #{editingVideoIndex + 1}
                    </span>
                  </div>

                  {/* Edit Fields */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase">Lecture Title Name</label>
                      <input
                        type="text"
                        value={videoTitleEdit}
                        onChange={(e) => setVideoTitleEdit(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-[#18252d] border border-gray-205 dark:border-[#202f36] focus:border-[#FF9600] focus:bg-white dark:focus:bg-[#131f24] px-3.5 py-2.5 text-xs font-bold text-gray-800 dark:text-slate-200 rounded-xl outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase">YouTube Video Link</label>
                        <input
                          type="text"
                          value={videoLinkEdit}
                          placeholder="https://www.youtube.com/watch?v=..."
                          onChange={(e) => setVideoLinkEdit(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-[#18252d] border border-gray-250 dark:border-[#202f36] focus:border-[#FF9600] focus:bg-white dark:focus:bg-[#131f24] px-3.5 py-2.5 text-xs font-bold text-gray-800 dark:text-slate-200 rounded-xl outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase">Due Calendar Schedule</label>
                        <input
                          type="date"
                          value={videoDateEdit}
                          onChange={(e) => setVideoDateEdit(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-[#18252d] border border-gray-250 dark:border-[#202f36] focus:border-[#FF9600] focus:bg-white dark:focus:bg-[#131f24] px-3.5 py-2.5 text-xs font-bold text-gray-800 dark:text-slate-200 rounded-xl outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase">Markdown Lecture Notes</label>
                      <textarea
                        rows={10}
                        value={videoNotesEdit}
                        onChange={(e) => setVideoNotesEdit(e.target.value)}
                        placeholder="Key in code snippets, takeaways, or concepts..."
                        className="w-full bg-gray-50 dark:bg-[#18252d] border border-gray-250 dark:border-[#202f36] focus:border-[#FF9600] focus:bg-white dark:focus:bg-[#131f24] p-3.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-200 rounded-xl outline-none transition-all resize-none leading-relaxed"
                      />
                    </div>

                    {/* Manual Chapters Segmenter */}
                    <div className="space-y-2.5 border-t border-gray-100 dark:border-[#202f36] pt-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase">
                          Manual Video Chapters / Segments
                        </label>
                        <span className="text-[9px] font-extrabold text-[#FF9600] bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded border border-orange-100 dark:border-orange-900/30 uppercase">
                          {videoChaptersEdit.length} Segments Defined
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-normal font-medium">
                        Divide long classes (e.g. 4+ hour lectures) into micro-learning milestones. Click any segment while studying to jump to that timestamp!
                      </p>

                      {/* Add Chapter Form fields */}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <span className="text-[8px] font-bold text-gray-400 dark:text-slate-500 uppercase">Chapter Title</span>
                          <input
                            type="text"
                            placeholder="e.g. Intro to State Managers"
                            value={newChapterTitle}
                            onChange={(e) => setNewChapterTitle(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-[#18252d] border border-gray-250 dark:border-[#202f36] focus:border-[#FF9600] focus:bg-white dark:focus:bg-[#131f24] px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-200 rounded-xl outline-none h-9"
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <span className="text-[8px] font-bold text-gray-400 dark:text-slate-500 uppercase">Timestamp</span>
                          <input
                            type="text"
                            placeholder="e.g. 05:40"
                            value={newChapterTimestamp}
                            onChange={(e) => setNewChapterTimestamp(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-[#18252d] border border-gray-250 dark:border-[#202f36] focus:border-[#FF9600] focus:bg-white dark:focus:bg-[#131f24] px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-200 rounded-xl outline-none text-center h-9"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddChapter}
                          className="py-2 px-3.5 bg-[#FF9600] hover:bg-orange-600 rounded-xl text-white font-black text-xs transition-all h-9 cursor-pointer shadow-xs whitespace-nowrap uppercase"
                        >
                          + Add
                        </button>
                      </div>

                      {/* List of current chapters */}
                      {videoChaptersEdit.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 border border-gray-200 dark:border-[#202f36] rounded-xl p-2 bg-gray-50/20 dark:bg-[#18252d]/30 animate-fadeIn scrollbar-thin">
                          {videoChaptersEdit.map((ch, idx) => (
                            <div key={ch.id || idx} className="flex items-center justify-between bg-white dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] rounded-lg px-2.5 py-1.5 text-xs">
                              <div className="flex items-center space-x-2 truncate">
                                <span className="text-[8px] font-black tracking-wider text-white bg-[#FF9600] px-1.5 py-0.5 rounded font-mono shrink-0">
                                  {ch.timestamp}
                                </span>
                                <span className="font-extrabold text-gray-700 dark:text-slate-200 truncate">{ch.title}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteChapter(ch.id)}
                                className="text-red-400 hover:text-red-600 transition-colors p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="border border-dashed border-gray-200 dark:border-[#202f36] rounded-xl p-3 text-center bg-gray-50/20 dark:bg-[#18252d]/20">
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase">No segments manually added yet</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={saveVideoEdit}
                    className="w-full py-3 bg-[#FF9600] border-b-4 border-[#cc7800] active:border-b-transparent hover:translate-y-0.5 active:translate-y-1 text-white font-black text-xs tracking-widest rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    SAVE NOTES CHANGES
                  </button>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="p-4 bg-gray-100 dark:bg-[#18252d] text-gray-450 dark:text-slate-450 rounded-full">
                    <Edit className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-gray-700 dark:text-slate-200 text-sm">No Lecture Selected</h4>
                    <p className="text-xs text-gray-400 dark:text-slate-500 max-w-sm mt-1">
                      Choose any lecture video from the outlined curriculum layout to customize due Dates, study links, or Markdown reference guidelines of that video.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
          
          {/* Header section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-800 dark:text-slate-100 tracking-tight">Manage Your Courses</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500 font-extrabold tracking-wide uppercase mt-1">SELECT CORNERSTONES, DEFINE SYLLABUSES OR IMPORT YOUTUBE CURRICULUMS</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
              {courses.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAllCourses}
                  className={`px-4 py-3.5 border-2 min-w-[170px] font-black text-xs tracking-widest rounded-2xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm active:translate-y-[1px]
                    ${showConfirmDeleteAll 
                      ? 'bg-red-500 hover:bg-red-600 border-red-600 text-white animate-pulse' 
                      : 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900/30 text-red-500 hover:text-red-600'
                    }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{showConfirmDeleteAll ? 'SURE? CLICK AGAIN' : `DELETE ALL (${courses.length})`}</span>
                </button>
              )}

              <button
                onClick={() => {
                  setLoaderError('');
                  setShowAddModal(true);
                }}
                className="px-5 py-3.5 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] active:border-b-transparent hover:translate-y-[2px] active:translate-y-[4px] text-white font-black text-xs tracking-widest rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white stroke-[3]" />
                <span>NEW COURSE</span>
              </button>
            </div>
          </div>

          {/* Quick presets import area removed */}

          {/* Current Courses Grid list */}
          <div className="space-y-4 animate-fadeIn">
            <div className="flex flex-col gap-3 pb-3 border-b-2 border-gray-100 dark:border-[#202f36]">
              {/* Dynamic grid title with count indicator */}
              <h3 className="text-xs font-black text-gray-500 dark:text-slate-350 tracking-wider uppercase flex items-center gap-1.5 select-none">
                <span>YOUR SELECTION GRID</span>
                <span className="bg-gray-150 dark:bg-[#202f36] px-2 py-0.5 rounded-full text-[10px] text-gray-500 dark:text-gray-400 font-black normal-case">
                  {filteredCourses.length !== courses.length ? `${filteredCourses.length} Match` : `${courses.length} Total`}
                </span>
              </h3>
              
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                {/* Advanced search targets switcher on left */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-black text-gray-500 dark:text-slate-350 tracking-wider uppercase mr-1 select-none">SEARCH TARGET:</span>
                  {[
                    { id: 'all', label: 'All', icon: Sparkles },
                    { id: 'name', label: 'Course Title', icon: BookOpen },
                    { id: 'description', label: 'Description', icon: FileText },
                    { id: 'lectures', label: 'Lecture Videos', icon: VideoIcon },
                  ].map((target) => {
                    const isSelected = searchTarget === target.id;
                    const IconComponent = target.icon;
                    return (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => setSearchTarget(target.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-full border-2 transition-all cursor-pointer shadow-xs active:translate-y-[1px]
                          ${isSelected 
                            ? 'bg-[var(--theme-primary-transparent)] border-[var(--theme-primary)] text-[var(--theme-primary)]' 
                            : 'bg-white dark:bg-[#131f24] border-gray-200 dark:border-[#202f36] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-[#35454e]'
                          }`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                        <span>{target.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic search bar aligned inline on the right */}
                <div className="relative w-full lg:w-72 xl:w-80 flex-shrink-0 animate-fadeIn">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400 dark:text-slate-500 stroke-[2.5]" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search courses, descriptions, lectures..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] focus:border-[#58CC02] dark:focus:border-[#58CC02] text-xs font-bold text-gray-800 dark:text-gray-100 rounded-full outline-none transition-all placeholder-gray-400 dark:placeholder-slate-500 shadow-sm"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchTarget('all');
                      }}
                      className="absolute inset-y-0 right-3 flex items-center p-1 text-gray-400 hover:text-[#58CC02] dark:hover:text-[#58CC02] cursor-pointer"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {courses.length === 0 ? (
              <div className="bg-white dark:bg-[#131f24] border-2 border-dashed border-gray-200 dark:border-[#202f36] rounded-[32px] p-12 text-center flex flex-col items-center justify-center space-y-4 animate-fadeIn">
                <div className="p-4 bg-gray-50 dark:bg-[#18252d] text-gray-400 dark:text-slate-500 rounded-full border-2 border-dashed border-gray-200 dark:border-[#202f36]">
                  <BookOpen className="w-8 h-8 text-gray-400 dark:text-slate-550" />
                </div>
                <div>
                  <h4 className="font-extrabold text-[#3C3C3C] dark:text-slate-200 text-sm">Add courses to begin studying</h4>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm">
                    You don't have any courses in Test yet. Create one by clicking "NEW COURSE" above or import any YouTube playlist!
                  </p>
                </div>
                <button
                  onClick={() => {
                    setLoaderError('');
                    setShowAddModal(true);
                  }}
                  className="px-5 py-3 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] hover:translate-y-[1px] text-white text-xs font-black tracking-widest uppercase rounded-2xl transition-all cursor-pointer shadow-md active:translate-y-[2px]"
                >
                  Create Course
                </button>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="bg-white dark:bg-[#131f24] border-2 border-dashed border-gray-200 dark:border-[#202f36] rounded-[32px] p-12 text-center flex flex-col items-center justify-center space-y-4 animate-fadeIn">
                <div className="p-4 bg-gray-50 dark:bg-[#18252d] text-gray-400 dark:text-slate-500 rounded-full border-2 border-dashed border-gray-200 dark:border-[#202f36]">
                  <Search className="w-8 h-8 text-gray-400 dark:text-slate-550" />
                </div>
                <div>
                  <h4 className="font-extrabold text-[#3C3C3C] dark:text-slate-200 text-sm">No courses match your query</h4>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm">
                    We couldn't find any courses matching "{searchQuery}". Try refining your terms or clear the filter.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchTarget('all');
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-[#18252d] hover:bg-gray-200 dark:hover:bg-[#202f36] border border-gray-200 dark:border-[#202f36] text-gray-700 dark:text-slate-200 text-xs font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer shadow-xs active:translate-y-[1px]"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredCourses.map((course) => {
                  const isActive = course.id === activeCourseId;
                  const totalLecs = course.videos.length;
                  const completedLecs = course.videos.filter(v => v.completed).length;
                  const completionPercent = totalLecs > 0 ? Math.round((completedLecs / totalLecs) * 100) : 0;

                  return (
                    <div
                      key={course.id}
                      onClick={() => {
                        onSelectActiveCourse(course.id);
                        setTab('today');
                      }}
                      className={`bg-white dark:bg-[#131f24] border-2 rounded-[32px] p-6 shadow-sm flex flex-col justify-between transition-all select-none relative cursor-pointer
                        ${isActive 
                          ? 'border-[var(--theme-primary)] ring-4 ring-[var(--theme-primary-transparent)]' 
                          : 'border-gray-200 dark:border-[#202f36] hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700'}`}
                    >
                      {isActive && (
                        <span className="absolute -top-3.5 right-6 bg-[var(--theme-primary)] border-b-2 border-[var(--theme-secondary)] text-white text-[9px] font-black px-3 py-1 rounded-full tracking-widest uppercase">
                          ACTIVE STUDYING
                        </span>
                      )}

                      <div className="space-y-4 flex-1">
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-black text-[#3C3C3C] dark:text-slate-200 text-base leading-tight line-clamp-1">{course.name}</h4>
                          </div>
                          <div className="flex items-center space-x-1 py-0.5 text-[10px] font-extrabold text-gray-500 dark:text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>CREATED: {getCourseCreatedDate(course)}</span>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-slate-400 leading-relaxed font-bold line-clamp-2">{course.description}</p>
                        </div>

                        {course.isPublic && (
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-[var(--theme-primary)] py-2">
                             <Check className="w-3.5 h-3.5" />
                             <span>PUBLISHED</span>
                          </div>
                        )}

                        {/* Course progress index */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-extrabold text-gray-400 dark:text-slate-500 leading-none">
                            <span>PROGRESS: {completedLecs}/{totalLecs} LECTURES</span>
                            <span>{completionPercent}%</span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-[#202f36] rounded-full h-2 relative overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${isActive ? 'bg-[var(--theme-primary)]' : 'bg-gray-400 dark:bg-[#35454e]'}`}
                              style={{ width: `${completionPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Interaction Buttons details */}
                      <div className="flex items-center space-x-2 mt-6 border-t border-gray-100 dark:border-[#202f36] pt-5">
                        {/* USE Course */}
                        {!isActive ? (
                          <button
                            onClick={() => onSelectActiveCourse(course.id)}
                            className="flex-1 py-2.5 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] active:border-b-transparent hover:translate-y-0.5 active:translate-y-1 text-white font-black text-[10px] tracking-widest rounded-xl transition-all shadow-xs cursor-pointer uppercase"
                          >
                            USE COURSE
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              onSelectActiveCourse(course.id);
                              setTab('today');
                            }}
                            className="flex-1 py-2.5 bg-[var(--theme-primary-transparent)] border border-[var(--theme-primary-transparent)] text-[var(--theme-primary)] font-black text-[10px] tracking-widest rounded-xl text-center select-none cursor-pointer uppercase hover:brightness-110 transition-all font-black text-[10px] tracking-widest rounded-xl text-center select-none cursor-pointer uppercase"
                          >
                            ACTIVE STUDY
                          </button>
                        )}

                        {/* EDIT course */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCourse(course);
                          }}
                          title="Configure curriculum details, markdown and timings"
                          className="py-2.5 px-4 border-2 border-gray-200 dark:border-[#202f36] text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-[#35454e] font-black text-[10px] tracking-widest rounded-xl hover:bg-gray-100 dark:hover:bg-[#18252d] transition-all cursor-pointer uppercase flex items-center space-x-1"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>EDIT</span>
                        </button>

                        {/* DELETE */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCourse(course.id);
                          }}
                          title="Delete selected course"
                          className="p-2.5 rounded-xl border border-gray-200 dark:border-[#202f36] text-gray-400 dark:text-slate-500 hover:text-red-500 hover:border-red-100 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* POPUP: Create course manually or list-paste modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-[30px] p-6 max-w-lg w-full relative space-y-5 shadow-2xl"
            >
              <h3 className="text-xl font-black text-gray-800 dark:text-white tracking-tight leading-none border-b border-gray-100 dark:border-[#202f36] pb-3 uppercase">
                LOAD NEW COURSE
              </h3>

              {loaderError && (
                <div className="bg-red-50/10 border border-red-200 dark:border-red-950/40 text-red-500 font-bold rounded-xl p-3.5 text-xs flex items-center space-x-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{loaderError}</span>
                </div>
              )}

               {/* YouTube Playlist Quick URL Loader */}
              <div className="bg-blue-50/50 dark:bg-[#111d24]/50 border-2 border-gray-200 dark:border-[#202f36] rounded-2xl p-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <Youtube className="w-4 h-4 text-red-500 fill-red-500" />
                  <span className="text-[10px] font-black text-[var(--theme-primary)] uppercase tracking-wide">YouTube Auto-Loader</span>
                </div>
                
                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-extrabold leading-normal uppercase text-left">
                  Paste a Youtube playlist OR individual video URL to draft your layout instantly
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    id="playlist-url-input"
                    disabled={loadingPlaylist}
                    placeholder="Paste single video URL or playlist (?list=) link..."
                    className="flex-1 bg-white dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] text-xs px-3.5 py-2.5 rounded-xl font-medium text-gray-750 dark:text-slate-200 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  <button
                    type="button"
                    disabled={loadingPlaylist}
                    onClick={() => {
                      const input = document.getElementById('playlist-url-input') as HTMLInputElement;
                      if (input) handleLoadYouTubePlaylist(input.value);
                    }}
                    className="py-2.5 px-4 bg-[var(--theme-primary)] border-b-2 border-sky-600 rounded-xl text-white font-black text-xs cursor-pointer uppercase shrink-0 disabled:bg-gray-300 disabled:border-gray-300 flex items-center justify-center min-w-[140px]"
                  >
                    {loadingPlaylist ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "LOAD CONTENT"
                    )}
                  </button>
                </div>
              </div>

              {/* Form manually */}
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase">Course Name</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Harvard Intro to Machine Learning"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] focus:border-[var(--theme-primary)] focus:bg-white dark:focus:bg-[#131f24] px-3.5 py-2.5 text-xs font-bold text-gray-800 dark:text-slate-200 rounded-xl outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase">Course Description</label>
                  <input
                    type="text"
                    placeholder="E.g. A deep dive into machine learning fundamentals"
                    value={newCourseDesc}
                    onChange={(e) => setNewCourseDesc(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] focus:border-[var(--theme-primary)] focus:bg-white dark:focus:bg-[#131f24] px-3.5 py-2.5 text-xs font-bold text-gray-800 dark:text-slate-200 rounded-xl outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPublicToggle"
                      checked={isPublicRequest}
                      onChange={(e) => setIsPublicRequest(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                    />
                    <label htmlFor="isPublicToggle" className="text-xs font-bold text-gray-700 dark:text-slate-200 cursor-pointer">
                      Publish to Community Hub
                    </label>
                  </div>
                  {isPublicRequest && (
                    <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl space-y-0.5">
                      <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1">
                        ⚠️ Permanent Publication Notice
                      </p>
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 leading-normal">
                        Publishing is permanent! Once shared with the community, you cannot take this course down or delete it from the Community Hub. Keep this checked only if you choose to leave it shared forever.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-wider uppercase">Outline (Title | Link or Name only)</label>
                    {videoInputLines.filter(l => l.trim() !== '').length > 0 && (
                      <span className="text-[9px] font-black text-[var(--theme-primary)] uppercase tracking-wider">({videoInputLines.filter(l => l.trim() !== '').length} videos)</span>
                    )}
                  </div>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                    {videoInputLines.map((line, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-white dark:bg-[#18252d] border border-gray-200 dark:border-[#202f36] rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-gray-400 dark:text-gray-500 font-bold text-sm shrink-0 flex items-center gap-1.5">
                          {idx + 1}. <Check className="w-4 h-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. Lecture Title | Link"
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

                <div className="flex items-center space-x-3 pt-4 border-t border-gray-100 dark:border-[#202f36]">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCourseName('');
                      setNewCourseDesc('');
                      setVideoInputLines(['']);
                      setLoaderError('');
                      const playlistInput = document.getElementById('playlist-url-input') as HTMLInputElement;
                      if (playlistInput) playlistInput.value = '';
                      setShowAddModal(false);
                    }}
                    className="flex-1 py-3 border-2 border-gray-200 dark:border-[#202f36] hover:border-gray-300 dark:hover:border-[#35454e] rounded-2xl font-black text-xs text-gray-500 dark:text-slate-300 tracking-widest hover:bg-gray-100 dark:hover:bg-[#18252d] transition-all cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] text-white font-black text-xs tracking-widest rounded-2xl transition-all shadow-sm cursor-pointer uppercase"
                  >
                    CREATE COURSE
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP: Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {courseToDeleteId && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-[30px] p-6 max-w-sm w-full relative space-y-4 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-full flex items-center justify-center mx-auto border-2 border-red-100 dark:border-red-900/40">
                <Trash2 className="w-7 h-7" />
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-gray-800 dark:text-slate-100 uppercase tracking-tight">
                  Delete Course?
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium leading-relaxed">
                  Are you sure you want to delete <span className="font-bold text-gray-700 dark:text-slate-200">"{courses.find(c => c.id === courseToDeleteId)?.name || 'this course'}"</span>? All focus logs & progress stats for this track will be permanently cleared.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCourseToDeleteId(null)}
                  className="flex-1 py-3 border-2 border-gray-200 dark:border-[#202f36] hover:border-gray-300 dark:hover:border-[#35454e] rounded-2xl font-black text-xs text-gray-500 dark:text-slate-300 tracking-widest hover:bg-gray-100 dark:hover:bg-[#18252d] transition-all cursor-pointer uppercase"
                >
                  KEEP IT
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCourse}
                  className="flex-1 py-3 bg-red-500 border-b-4 border-red-700 hover:bg-red-600 hover:border-red-800 text-white font-black text-xs tracking-widest rounded-2xl transition-all shadow-sm cursor-pointer uppercase"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
