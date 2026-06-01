import React, { useState, useEffect } from 'react';
import { Home, BookOpen, Calendar, LogIn, LogOut, ChevronLeft, Settings, Users, Pencil, Check, GripVertical, User, BarChart2, Trophy, Star, Plus, ShoppingBag, Target, Play, AlertTriangle } from 'lucide-react';
import { UserStats, Course } from '../types';
import { useFirebase } from '../context/FirebaseContext';
import TestLogo from './TestLogo';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface SidebarProps {
  currentTab: 'home' | 'courses' | 'today' | 'settings' | 'community' | 'profile' | 'stats' | 'upgrade' | 'shop' | 'bug_report';
  setTab: (tab: 'home' | 'courses' | 'today' | 'settings' | 'community' | 'profile' | 'stats' | 'upgrade' | 'shop' | 'bug_report') => void;
  onSelectCourse: (courseId: string) => void;
  stats: UserStats;
  activeCourse: Course | null;
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  cloudSyncEnabled: boolean;
  onOpenAuthModal: () => void;
  courses: Course[];
  onCreateCourseClick: () => void;
}

function SortableNavItem({ item, isActive, setTab, theme, isEditing, courses, onSelectCourse, activeCourse }: { item: any, isActive: boolean, setTab: (tab: any) => void, theme: 'light' | 'dark', isEditing: boolean, courses?: Course[], onSelectCourse?: (courseId: string) => void, activeCourse?: Course | null }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const IconComponent = item.icon;
  const [isCoursesExpanded, setIsCoursesExpanded] = useState(true);

  // Determine dynamic label for Today's Focus representing current course name
  let displayLabel = item.label;
  if (item.id === 'today') {
    displayLabel = activeCourse ? activeCourse.name : "Current Course";
  }

  return (
    <div ref={setNodeRef} style={style} className={`flex flex-col gap-1 min-w-0 ${isEditing ? 'cursor-grab' : ''}`}>
      <div className="flex items-center gap-1.5 group/nav min-w-0">
        {isEditing && (
          <div {...attributes} {...listeners} className="touch-none p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors shrink-0">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <button
          onClick={() => setTab(item.id)}
          className={`flex-1 flex items-center space-x-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all text-left duration-200 select-none min-w-0
            ${isActive 
              ? 'bg-neutral-100 dark:bg-neutral-800/85 text-neutral-900 dark:text-neutral-100 font-semibold shadow-sm' 
              : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
        >
          <IconComponent className={`w-4 h-4 transition-colors shrink-0 ${isActive ? 'text-[var(--theme-primary)]' : 'text-neutral-400 dark:text-neutral-500 group-hover/nav:text-neutral-600 dark:group-hover/nav:text-neutral-300'}`} />
          <span className="flex-1 truncate">{displayLabel}</span>
          {item.id === 'today' && (
            <div 
              className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50 animate-pulse shrink-0 ml-1.5" 
              title="Current Active Course"
            />
          )}
          {item.id === 'courses' && courses && courses.length > 0 && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsCoursesExpanded(!isCoursesExpanded);
              }}
              className="p-1 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700/60 rounded-lg transition-colors"
            >
              <ChevronLeft className={`w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 transition-transform ${isCoursesExpanded ? 'rotate-90' : '-rotate-90'}`} />
            </div>
          )}
        </button>
      </div>

      {item.id === 'courses' && isCoursesExpanded && courses && (
        <div className="ml-5 space-y-1 mt-0.5 pl-3 border-l border-neutral-100 dark:border-neutral-800/40">
          {courses.map(course => (
            <button 
              key={course.id}
              onClick={() => {
                setTab('courses');
                if (onSelectCourse) onSelectCourse(course.id);
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-normal transition-all text-left text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
              <span className="truncate flex-1">{course.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const StorefrontIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
    <path d="M2 9l3-5h14l3 5" />
    <path d="M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6" />
  </svg>
);

const DEFAULT_ORDER = ['home', 'today', 'courses', 'shop', 'community', 'settings', 'profile', 'stats', 'upgrade', 'bug_report'];

const NAV_ITEM_MAP = {
  home: { id: 'home', label: 'Learn', icon: Home, color: '#58CC02', hoverBorder: '#46A302' },
  today: { id: 'today', label: "Today's Focus", icon: Play, color: 'var(--theme-primary)', hoverBorder: 'var(--theme-secondary)' },
  courses: { id: 'courses', label: 'Courses', icon: BookOpen, color: '#FF9600', hoverBorder: '#cc7800' },
  shop: { id: 'shop', label: 'Shop', icon: StorefrontIcon, color: '#F1A80A', hoverBorder: '#ca8a04' },
  community: { id: 'community', label: 'Community Hub', icon: Users, color: '#FF4B4B', hoverBorder: '#e03a3a' },
  settings: { id: 'settings', label: 'Settings', icon: Settings, color: '#9042f5', hoverBorder: '#7d33e2' },
  profile: { id: 'profile', label: 'Profile', icon: User, color: '#1cb0f6', hoverBorder: '#1899d6' },
  stats: { id: 'stats', label: 'Leaderboard', icon: Trophy, color: '#059669', hoverBorder: '#047857' },
  upgrade: { id: 'upgrade', label: 'Coming Soon', icon: Star, color: '#d97706', hoverBorder: '#b45309' },
  bug_report: { id: 'bug_report', label: 'Report Bug', icon: AlertTriangle, color: '#f59e0b', hoverBorder: '#d97706' },
};

export default function Sidebar({ currentTab, setTab, onSelectCourse, stats, activeCourse, isOpen, onClose, theme, setTheme, cloudSyncEnabled, onOpenAuthModal, courses, onCreateCourseClick }: SidebarProps) {
  const { user, logout } = useFirebase();
  const [isEditing, setIsEditing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('koursy_left_sidebar_width');
    return saved ? parseInt(saved, 10) : 256;
  });
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX;
      const difference = currentX - startX;
      const newWidth = Math.max(180, Math.min(450, startWidth + difference));
      setSidebarWidth(newWidth);
      localStorage.setItem('koursy_left_sidebar_width', String(newWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const [navItems, setNavItems] = useState(() => {
    const savedOrder = localStorage.getItem('koursy_sidebar_order');
    if (savedOrder) {
      try {
        const parsed: string[] = JSON.parse(savedOrder);
        const items = parsed
          .map(id => NAV_ITEM_MAP[id as keyof typeof NAV_ITEM_MAP])
          .filter(Boolean);
        
        const missing = DEFAULT_ORDER.filter(id => !parsed.includes(id));
        if (missing.length > 0) {
          missing.forEach(id => {
            const item = NAV_ITEM_MAP[id as keyof typeof NAV_ITEM_MAP];
            if (item) items.push(item);
          });
        }
        return items;
      } catch (e) {
        console.error("Error parsing saved sidebar order:", e);
      }
    }
    return DEFAULT_ORDER.map(id => NAV_ITEM_MAP[id as keyof typeof NAV_ITEM_MAP]);
  });

  // Synchronize sidebar navigation order with Firestore when user is signed in
  useEffect(() => {
    if (!user) return;

    const fetchSidebarOrder = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'navigation', 'sidebar');
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data()?.order) {
          const order: string[] = snap.data().order;
          const items = order
            .map(id => NAV_ITEM_MAP[id as keyof typeof NAV_ITEM_MAP])
            .filter(Boolean);
          
          const missing = DEFAULT_ORDER.filter(id => !order.includes(id));
          if (missing.length > 0) {
            missing.forEach(id => {
              const item = NAV_ITEM_MAP[id as keyof typeof NAV_ITEM_MAP];
              if (item) items.push(item);
            });
          }
          setNavItems(items);
        }
      } catch (e) {
        console.error("Error fetching sidebar from DB:", e);
      }
    };

    fetchSidebarOrder();
  }, [user]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = navItems.findIndex((item) => item.id === active.id);
      const newIndex = navItems.findIndex((item) => item.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const updated = arrayMove(navItems, oldIndex, newIndex);
        setNavItems(updated);
        
        const orderIds = updated.map(item => item.id);
        localStorage.setItem('koursy_sidebar_order', JSON.stringify(orderIds));

        if (user) {
          const docRef = doc(db, 'users', user.uid, 'navigation', 'sidebar');
          setDoc(docRef, { order: orderIds }, { merge: true }).catch(err => {
            console.error("Error saving sidebar to DB:", err);
          });
        }
      }
    }
  }

  return (
    <div 
      className={`
        fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] lg:max-w-none lg:w-[length:var(--sidebar-width)] bg-neutral-50 dark:bg-[#151f24] border-r border-neutral-200/50 dark:border-[#1d2a30] flex flex-col justify-between h-[100dvh] lg:h-screen p-4 font-sans overflow-y-auto
        lg:sticky lg:top-0 lg:z-30 lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:!w-0 lg:!p-0 lg:!border-r-0 lg:overflow-hidden'}
        ${isResizing ? 'transition-none select-none cursor-col-resize pb-4' : 'transition-[width,transform,opacity,padding,margin] duration-300'}
      `}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* Resize Handler on the Right edge */}
      {isOpen && (
        <div
          onMouseDown={handleMouseDown}
          className="hidden lg:block absolute top-0 bottom-0 right-0 w-1.5 cursor-col-resize z-50 select-none group/resize"
          title="Drag to resize navigation sidebar"
        >
          {/* Visual Hover Line Indicator */}
          <div className="absolute inset-y-0 right-0 w-[3px] bg-transparent group-hover/resize:bg-[var(--theme-primary)]/45 group-active/resize:bg-[var(--theme-primary)] transition-colors duration-150" />
        </div>
      )}

      <div className="space-y-6">
        {/* KOURSY Brand Header */}
        <div className="flex items-center justify-between select-none px-1">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 bg-[var(--theme-primary-transparent)] dark:bg-[var(--theme-primary-transparent)] rounded-lg text-[var(--theme-primary)] shrink-0">
              <BookOpen className="w-4 h-4" />
            </span>
            <div>
              <h1 className="text-sm font-bold text-neutral-850 dark:text-neutral-150 tracking-wide uppercase leading-none">Test</h1>
              <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 tracking-widest uppercase leading-none mt-1 block">Course Path</span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={onCreateCourseClick}
              className="p-1.5 bg-neutral-100 hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-800 text-[var(--theme-primary)] hover:text-sky-600 rounded-lg transition-all cursor-pointer flex items-center justify-center font-bold"
              title="Create New Course"
              id="sidebar-create-course-btn"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg transition-all cursor-pointer flex items-center justify-center"
              title="Collapse Sidebar"
              id="sidebar-close-toggle-btn"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Buttons (Sleek Modern List) */}
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between px-1 mb-1 select-none shrink-0">
            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider uppercase">Navigation</span>
            <button 
              onClick={() => setIsEditing(!isEditing)} 
              className="text-[10px] px-2 py-0.5 font-bold text-[var(--theme-primary)] hover:bg-[var(--theme-primary-transparent)] rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
            >
              {isEditing ? <><Check className="w-3 h-3" /> Done</> : <><Pencil className="w-3 h-3" /> Edit</>}
            </button>
          </div>
          
          <nav className="space-y-1 min-w-0">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={navItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
                {navItems.map((item) => (
                  <SortableNavItem 
                    key={item.id} 
                    item={item} 
                    isActive={currentTab === item.id}
                    setTab={setTab}
                    theme={theme}
                    isEditing={isEditing}
                    courses={item.id === 'courses' ? courses : undefined}
                    onSelectCourse={onSelectCourse}
                    activeCourse={activeCourse}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </nav>
        </div>
      </div>

      {/* Bottom Profile & Plan Sidebar Controls */}
      <div className="space-y-4">
        {/* Firebase Synchronization Profile Segment */}
        <div className="border-t border-neutral-200/50 dark:border-[#1d2a30] pt-4 space-y-3 select-none">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider uppercase">Cloud Sync</span>
            {user && cloudSyncEnabled ? (
              <span className="flex items-center space-x-1 text-[9px] font-medium text-emerald-500 dark:text-emerald-400 px-1.5 py-0.5 rounded-full bg-emerald-500/10 uppercase">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                <span>ONLINE</span>
              </span>
            ) : user ? (
              <span className="flex items-center space-x-1 text-[9px] font-medium text-amber-500 px-1.5 py-0.5 rounded-full bg-amber-500/10 uppercase" title="Sync is paused in Settings">
                <span className="w-1 h-1 bg-amber-500 rounded-full" />
                <span>PAUSED</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-[9px] font-medium text-neutral-400 px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 uppercase" title="Sign in to back up course progress">
                <span className="w-1 h-1 bg-neutral-400 rounded-full" />
                <span>LOCAL</span>
              </span>
            )}
          </div>

          {user ? (
            <div 
              onClick={() => { setTab('settings'); if (window.innerWidth < 1024) onClose(); }}
              className="group/profile flex items-center justify-between gap-3 p-2 bg-neutral-50/50 hover:bg-neutral-100/80 dark:bg-neutral-900/20 dark:hover:bg-neutral-800/40 border border-neutral-200/40 dark:border-neutral-800/40 rounded-xl transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-8.5 h-8.5 rounded-full border border-neutral-200 dark:border-neutral-800 shadow-sm shrink-0 object-cover"
                  />
                ) : (
                  <div className="w-8.5 h-8.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 flex items-center justify-center font-bold text-neutral-600 dark:text-neutral-300 text-xs shrink-0">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="min-w-0 pr-1">
                  <h4 className="font-semibold text-neutral-700 dark:text-neutral-200 text-xs truncate leading-tight group-hover/profile:text-neutral-900 dark:group-hover/profile:text-white">
                    {user.displayName || 'Student'}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500 truncate leading-none">
                      {stats.subscription === 'plus' ? 'Test Plus' : 'Free Plan'}
                    </span>
                    {stats.subscription !== 'plus' && (
                      <span 
                        onClick={(e) => { e.stopPropagation(); setTab('upgrade'); if (window.innerWidth < 1024) onClose(); }}
                        className="text-[9px] font-bold text-[var(--theme-primary)] hover:underline"
                      >
                        Upgrade
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={(e) => { e.stopPropagation(); logout(); }}
                title="Sign Out"
                className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-white rounded-xl font-medium text-xs transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Sign Up</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
