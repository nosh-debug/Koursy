import React, { useState, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Clock, ShieldAlert, Sparkles, Check, Lock, Play, Milestone, CalendarDays, FileVideo, Video as VideoIcon, Heart, ChevronDown, ChevronUp, ChevronRight, RefreshCw, Plus, Minus, Maximize2, Minimize2, Compass } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';

class CanvasErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Canvas caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ backgroundColor: 'red', color: 'white', padding: 8, height: '100%', width: '100%', overflow: 'auto' }}>
          ERROR: {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
}

import * as THREE from 'three';
import { Course, UserStats, Video } from '../types';
import { FootageDB } from '../storage';
import { base64ToBlobUrl } from '../lib/base64Utils';
import { auth } from '../lib/firebase';
import { fetchFootageFromDb } from '../lib/firestoreUtils';
import FocusDetailModal from './FocusDetailModal';

interface HomePathProps {
  activeCourse: Course | null;
  stats: UserStats;
  onSelectVideoForFocus: (video: Video) => void;
  setTab: (tab: 'home' | 'courses' | 'today' | 'settings' | 'community' | 'profile' | 'stats' | 'upgrade' | 'shop') => void;
  courses?: Course[];
  onUpdateCourses?: (courses: Course[]) => void;
  isSidebarOpen?: boolean;
  onUpdateSidebar?: (open: boolean) => void;
  onUpdateStats?: (stats: UserStats) => void;
}

interface FloatingIslandProps { 
  isCompleted: boolean; 
  isCurrent: boolean; 
  isUnlocked: boolean; 
  index: number;
  video?: Video;
  globalRotX?: number;
  globalRotY?: number;
  islandScale?: number;
  cameraDistance?: number;
}

interface ThreeDIslandProps {
  isCompleted: boolean;
  isCurrent: boolean;
  isUnlocked: boolean;
  index: number;
  islandScale?: number;
}

function ThreeDIsland({ isCompleted, isCurrent, isUnlocked, index, islandScale = 1.4 }: ThreeDIslandProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Continuous slow yaw rotation + elegant slow up/down floating amplitude
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.15;
      groupRef.current.position.y = Math.sin(state.clock.getElapsedTime() + index) * 0.12;
    }
  });

  return (
    <group ref={groupRef} scale={[1.34, 1.34, 1.34]}>
      {/* 
        TIERED FLOATING ISLAND STRUCTURE 
        (Closed, watertight, textured 3D solid contours with absolute zero bottom holes)
      */}
      
      {/* Tier 1: Top Grass Layer */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[2.0, 2.0, 0.4, 8]} />
        <meshStandardMaterial color={isUnlocked ? "#84cc16" : "#64748b"} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Tier 2: Mid-Soil Layer */}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[2.0, 1.4, 0.5, 8]} />
        <meshStandardMaterial color={isUnlocked ? "#5c1d06" : "#475569"} roughness={0.85} metalness={0.0} />
      </mesh>

      {/* Tier 3: Rocks Stack */}
      <mesh position={[0, -0.85, 0]}>
        <cylinderGeometry args={[1.4, 0.8, 0.5, 8]} />
        <meshStandardMaterial color={isUnlocked ? "#3f3f46" : "#334155"} roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Tier 4: Jagged bottom cone point */}
      <mesh position={[0, -1.4, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.8, 0.7, 8]} />
        <meshStandardMaterial color={isUnlocked ? "#18181b" : "#1e293b"} roughness={0.95} metalness={0.2} />
      </mesh>

      {/* Tree 1: Back Left */}
      <group position={[-0.9, 0.2, -0.9]}>
        {/* Trunk */}
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.6, 5]} />
          <meshStandardMaterial color="#78350f" roughness={0.9} />
        </mesh>
        {/* Leaves Lower cone */}
        <mesh position={[0, 0.8, 0]}>
          <coneGeometry args={[0.5, 0.7, 5]} />
          <meshStandardMaterial color="#15803d" roughness={0.6} />
        </mesh>
        {/* Leaves Upper cone */}
        <mesh position={[0, 1.25, 0]}>
          <coneGeometry args={[0.3, 0.5, 5]} />
          <meshStandardMaterial color="#22c55e" roughness={0.5} />
        </mesh>
      </group>

      {/* Tree 2: Back Right */}
      <group position={[0.9, 0.2, -0.7]}>
        {/* Trunk */}
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.5, 5]} />
          <meshStandardMaterial color="#78350f" roughness={0.9} />
        </mesh>
        {/* Leaves Lower cone */}
        <mesh position={[0, 0.65, 0]}>
          <coneGeometry args={[0.4, 0.6, 5]} />
          <meshStandardMaterial color="#14532d" roughness={0.6} />
        </mesh>
        {/* Leaves Upper cone */}
        <mesh position={[0, 1.0, 0]}>
          <coneGeometry args={[0.25, 0.4, 5]} />
          <meshStandardMaterial color="#16a34a" roughness={0.5} />
        </mesh>
      </group>

      {/* Academy Tower */}
      <group position={[0, 0.2, 0]}>
        {/* Main Body */}
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 1.2, 8]} />
          <meshStandardMaterial color={isUnlocked ? "#3b82f6" : "#64748b"} roughness={0.5} metalness={0.2} />
        </mesh>
        {/* Upper Rim */}
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.48, 0.48, 0.15, 8]} />
          <meshStandardMaterial color={isUnlocked ? "#1e3a8a" : "#475569"} roughness={0.6} metalness={0.3} />
        </mesh>
        {/* Roof Cone */}
        <mesh position={[0, 1.6, 0]}>
          <coneGeometry args={[0.38, 0.65, 8]} />
          <meshStandardMaterial color={isCompleted ? "#fbbf24" : isCurrent ? "#38bdf8" : "#cbd5e1"} roughness={0.4} metalness={0.4} />
        </mesh>
        {/* Flag Pole (Completed indicator) */}
        <mesh position={[0, 2.1, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.5, 4]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
        
        {isCompleted && (
          /* Flag element */
          <mesh position={[0.2, 2.22, 0]}>
            <boxGeometry args={[0.4, 0.2, 0.01]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.2} metalness={0.5} />
          </mesh>
        )}

        {isCurrent && !isCompleted && (
          /* Beacon light gold/cyan glowing star */
          <mesh position={[0, 2.38, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        )}
      </group>

      {/* Completed Mini Target Board standard */}
      {isCompleted && (
        <group position={[0.8, 0.2, 0.8]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.6, 4]} />
            <meshStandardMaterial color="#b45309" />
          </mesh>
          <mesh position={[0.12, 0.5, 0]}>
            <boxGeometry args={[0.25, 0.2, 0.01]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.3} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function FloatingIsland({ 
  isCompleted, 
  isCurrent, 
  isUnlocked, 
  index, 
  video,
  globalRotX,
  globalRotY,
  islandScale = 1.4,
  cameraDistance = 7.2
}: FloatingIslandProps) {
  const [cloudsFootageList, setCloudsFootageList] = useState<{ id: string; url: string; isVideo?: boolean }[]>([]);

  React.useEffect(() => {
    let isSubscribed = true;
    if (!isCompleted || !video) return;

    const loadFootages = async () => {
      const items = [];
      const user = auth.currentUser;
      if (video.completionFootages && video.completionFootages.length > 0) {
        for (const f of video.completionFootages) {
          let url = f.url;
          if (!url || (!url.startsWith('blob:') && !url.startsWith('data:'))) {
            let dbUrl = await FootageDB.get(f.id);
            if (!dbUrl && user) {
              dbUrl = await fetchFootageFromDb(user.uid, f.id);
            }
            if (dbUrl) {
              url = dbUrl;
            }
          }
          if (f.isVideo && url && url.startsWith('data:')) {
            url = await base64ToBlobUrl(url);
          }
          if (url) {
            items.push({ id: f.id, url, isVideo: f.isVideo });
          }
        }
      } else if (video.completionFootageUrl) {
        let url = video.completionFootageUrl;
        if (video.completionFootageIsVideo && url && url.startsWith('data:')) {
          url = await base64ToBlobUrl(url);
        }
        if (url) {
          items.push({ id: 'legacy-' + video.id, url, isVideo: video.completionFootageIsVideo });
        }
      }
      if (isSubscribed) {
        setCloudsFootageList(items);
      }
    };

    loadFootages();
    return () => { isSubscribed = false; };
  }, [isCompleted, video?.id, video?.completionFootages, video?.completionFootageUrl]);

  const stateClass = !isUnlocked
    ? 'grayscale opacity-55'
    : !isCompleted
      ? 'grayscale-[20%] saturate-[95%]'
      : 'saturate-[115%]';

  // Proportional scale ratio to prevent 3D boundary clipping when the island is scaled up.
  // We keep the camera's perspective frustum perfectly scaled to the physical size of the island.
  const actualCameraDistance = cameraDistance;

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center select-none ${stateClass}`}>
      <div className="w-full h-full flex items-center justify-center relative pointer-events-auto">
        <div className={`absolute inset-0 transition-all duration-500 ${!isUnlocked ? 'blur-2xl opacity-50 scale-110 pointer-events-none' : ''}`}>
          <CanvasErrorBoundary>
            <Canvas 
              camera={{ position: [0, 1.2, actualCameraDistance], fov: 45 }}
              style={{ width: '100%', height: '100%' }}
              className="bg-transparent"
              dpr={[1, 1.5]}
              gl={{ preserveDrawingBuffer: true }}
            >
              <ambientLight intensity={1.5} />
              <directionalLight position={[4, 8, 4]} intensity={2.0} />
              <pointLight position={[-4, 4, -4]} intensity={1.2} color="#60a5fa" />
              <spotLight position={[0, 4, 0]} intensity={4} distance={6} angle={0.6} penumbra={1} color="#fef08a" />

              <ThreeDIsland 
                isCompleted={isCompleted} 
                isCurrent={isCurrent} 
                isUnlocked={isUnlocked} 
                index={index} 
                islandScale={islandScale}
              />

              <OrbitControls 
                enableZoom={false} 
                enablePan={false} 
                minPolarAngle={Math.PI / 4} 
                maxPolarAngle={Math.PI / 2.1} 
              />
            </Canvas>
          </CanvasErrorBoundary>
        </div>

        {!isUnlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 drop-shadow-xl">
             <div className="bg-slate-900/60 transition-all p-5 rounded-[1.25rem] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10 mb-2 mt-4 hover:scale-105">
               <Lock className="w-8 h-8 text-white/90 drop-shadow-xl" />
             </div>
             <span className="font-sans font-black text-[11px] text-slate-800 dark:text-slate-200 tracking-widest uppercase mt-3 py-1 px-3 bg-white/20 dark:bg-black/20 rounded-full backdrop-blur-sm shadow-sm border border-white/10">Locked Module {index + 1}</span>
          </div>
        )}

        {isUnlocked && (
          <div className="absolute top-[28%] font-mono text-4xl sm:text-5xl font-black text-white/40 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] select-none pointer-events-none mix-blend-overlay z-10">
            {index + 1}
          </div>
        )}

        {/* Cloud footage floating elements if available */}
        {cloudsFootageList.map((footage, idx) => {
          const angle = (idx / cloudsFootageList.length) * Math.PI * 2;
          const dist = 5.5; // Wider orbit around the 3D island
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist;

          return (
            <div 
              key={footage.id}
              className="absolute w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-white/80 dark:border-slate-700/80 shadow-md bg-black/5 overflow-hidden backdrop-blur-sm z-20 opacity-90 transition-transform duration-[3000ms] ease-in-out hover:scale-125"
              style={{
                transform: `translate(${x}rem, ${y}rem)`
              }}
            >
              {footage.isVideo ? (
                <video src={footage.url} className="w-full h-full object-cover" muted playsInline loop autoPlay />
              ) : (
                <img src={footage.url} className="w-full h-full object-cover" alt="Memory footprint" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HomePath({ activeCourse, stats, onSelectVideoForFocus, setTab, courses, onUpdateCourses, isSidebarOpen = true, onUpdateSidebar, onUpdateStats }: HomePathProps) {
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('koursy_right_sidebar_width');
    return saved ? parseInt(saved, 10) : 256;
  });
  const [isRightResizing, setIsRightResizing] = useState(false);

  const handleRightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsRightResizing(true);
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX;
      const difference = currentX - startX;
      const newWidth = Math.max(180, Math.min(450, startWidth - difference));
      setRightSidebarWidth(newWidth);
      localStorage.setItem('koursy_right_sidebar_width', String(newWidth));
    };

    const handleMouseUp = () => {
      setIsRightResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const [feedback, setFeedback] = useState<{ isOpen: boolean; message: string } | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [retryConfirmation, setRetryConfirmation] = useState<Video | null>(null);
  const [advanceConfirmation, setAdvanceConfirmation] = useState<Video | null>(null);
  const [activeFootageVideo, setActiveFootageVideo] = useState<Video | null>(null);
  const [selectedFootageIndex, setSelectedFootageIndex] = useState(0);
  const [showRestartConfirmation, setShowRestartConfirmation] = useState(false);
  const [showSavedFootages, setShowSavedFootages] = useState(false);
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [fetchedFootages, setFetchedFootages] = useState<{ id: string; url: string; name: string; size: string; isVideo?: boolean }[]>([]);


  // Global 3D Celestial Skybox Space variables
  const [globalRotX, setGlobalRotX] = useState(15);
  const [globalRotY, setGlobalRotY] = useState(-15);
  const [isMouseOrbitEnabled, setIsMouseOrbitEnabled] = useState(false);

  // User customizable island sizing/camera zoom state saved to localstorage with self-healing validation to prevent NaN/invalid values from corrupting 3D render loops
  const [islandScale, setIslandScale] = useState(() => {
    try {
      const saved = localStorage.getItem('koursy_island_scale');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.5 && val <= 5.0) {
          return val;
        }
      }
    } catch (e) {
      console.error("Failed to parse koursy_island_scale", e);
    }
    return 1.4;
  });

  const [cameraDistance, setCameraDistance] = useState(() => {
    try {
      const saved = localStorage.getItem('koursy_camera_distance');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 3.0 && val <= 18.0) {
          return val;
        }
      }
    } catch (e) {
      console.error("Failed to parse koursy_camera_distance", e);
    }
    return 7.2;
  });

  React.useEffect(() => {
    if (typeof islandScale === 'number' && !isNaN(islandScale)) {
      localStorage.setItem('koursy_island_scale', String(islandScale));
    } else {
      setIslandScale(1.4);
    }
  }, [islandScale]);

  React.useEffect(() => {
    if (typeof cameraDistance === 'number' && !isNaN(cameraDistance)) {
      localStorage.setItem('koursy_camera_distance', String(cameraDistance));
    } else {
      setCameraDistance(7.2);
    }
  }, [cameraDistance]);

  // Dragging states on the page backdrop / celestial canvas
  const isGlobalDragging = useRef(false);
  const globalStartPos = useRef({ x: 0, y: 0 });
  const globalStartAngles = useRef({ x: 0, y: 0 });

  const handleGlobalMouseDown = (e: React.MouseEvent) => {
    // Left-click and drag on the sky backdrop can rotate if enabled
  };

  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (!isMouseOrbitEnabled) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    // Calculate cursor position relative to the center of the scroll container
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = (e.clientX - centerX) / (rect.width / 2);
    const dy = (e.clientY - centerY) / (rect.height / 2);

    // Horizontal orbit (-45deg to 45deg) and vertical orbit/pitch (-30deg to 30deg)
    setGlobalRotY(dx * 45);
    setGlobalRotX(dy * -30);
  };

  const handleGlobalMouseUp = () => {};

  // Swipe compatibility for mobile devices
  const handleGlobalTouchMove = (e: React.TouchEvent) => {
    if (!isMouseOrbitEnabled) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const container = scrollContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = (touch.clientX - centerX) / (rect.width / 2);
      const dy = (touch.clientY - centerY) / (rect.height / 2);

      setGlobalRotY(dx * 45);
      setGlobalRotX(dy * -30);
    }
  };

  React.useEffect(() => {
    let isSubscribed = true;
    const fetchFootagesFromDB = async () => {
      if (!activeFootageVideo) {
        if (isSubscribed) setFetchedFootages([]);
        return;
      }

      const footagesList: { id: string; url: string; name: string; size: string; isVideo?: boolean }[] = [];
      const user = auth.currentUser;
      const isCloudSyncEnabled = localStorage.getItem('cloud_sync_enabled') === 'true';
      
      if (activeFootageVideo.completionFootages && activeFootageVideo.completionFootages.length > 0) {
        for (const f of activeFootageVideo.completionFootages) {
          let url = f.url;
          if (!url || (!url.startsWith('blob:') && !url.startsWith('data:'))) {
            let dbUrl = await FootageDB.get(f.id);
            if (!dbUrl && user) {
              dbUrl = await fetchFootageFromDb(user.uid, f.id);
            }
            if (dbUrl) {
              url = dbUrl;
            }
          }
          if (f.isVideo && url && url.startsWith('data:')) {
            url = await base64ToBlobUrl(url);
          }
          footagesList.push({ id: f.id, url: url || f.url || '', name: f.name || 'Footage', size: f.size || 'N/A', isVideo: f.isVideo });
        }
      } else if (activeFootageVideo.completionFootageUrl) {
        let url = activeFootageVideo.completionFootageUrl;
        if (activeFootageVideo.completionFootageIsVideo && url && url.startsWith('data:')) {
          url = await base64ToBlobUrl(url);
        }
        footagesList.push({
          id: 'legacy-footage-' + activeFootageVideo.id,
          url: url,
          name: activeFootageVideo.completionFootageName || 'Uploaded Footage',
          size: activeFootageVideo.completionFootageSize || 'N/A',
          isVideo: activeFootageVideo.completionFootageIsVideo
        });
      }

      if (isSubscribed) {
        setFetchedFootages(footagesList);
      }
    };
    fetchFootagesFromDB();
    return () => { isSubscribed = false; };
  }, [activeFootageVideo]);

  const handleOpenFootage = (video: Video) => {
    setSelectedFootageIndex(0);
    setActiveFootageVideo(video);
  };

  // Collapsible streak panel and test helpers
  const [isStreakExpanded, setIsStreakExpanded] = useState(true);
  const [timeUntilMidnight, setTimeUntilMidnight] = useState("");

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilMidnight(`${hours}h ${minutes}m`);
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  // Helper helper to format YYYY-MM-DD
  const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getYesterdayString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getLast7Days = () => {
    const days = [];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const didStudy = stats.history ? stats.history.some(h => h.date === dateStr) : false;
      days.push({
        displayName: weekdays[d.getDay()],
        dateStr,
        didStudy,
        isToday: i === 0,
      });
    }
    return days;
  };

  const handleBuyHeart = () => {
    if (!onUpdateStats) return;
    if (stats.xp < 50) {
      setFeedback({ isOpen: true, message: "Not enough XP! You need at least 50 XP to acquire a Heart shield." });
      return;
    }
    const updatedStats: UserStats = {
      ...stats,
      xp: stats.xp - 50,
      hearts: Math.min((stats.hearts || 0) + 1, 5)
    };
    onUpdateStats(updatedStats);
  };

  const handleClaimFreeHeart = () => {
    if (!onUpdateStats) return;
    if ((stats.hearts || 0) >= 5) {
      setFeedback({ isOpen: true, message: "You already have the maximum number of safeguard hearts (5)." });
      return;
    }
    const updatedStats: UserStats = {
      ...stats,
      hearts: Math.min((stats.hearts || 0) + 1, 5)
    };
    onUpdateStats(updatedStats);
  };

  const handleSimulateStudyDay = () => {
    if (!onUpdateStats) return;
    const count = stats.streak + 1;
    const todayStr = getTodayString();
    
    let newHistory = stats.history ? [...stats.history] : [];
    const exists = newHistory.some(h => h.date === todayStr);
    if (!exists) {
      newHistory.unshift({
        id: `hist-sim-${Date.now()}`,
        date: todayStr,
        courseId: activeCourse?.id || 'sim',
        courseName: activeCourse?.name || 'Simulated Course',
        videoId: 'sim-lecture',
        videoTitle: 'Simulated Lecture Study',
        focusSeconds: 600,
        xpEarned: 15
      });
    }

    const updatedStats: UserStats = {
      ...stats,
      streak: count,
      lastStudyDate: todayStr,
      history: newHistory,
      xp: stats.xp + 15
    };
    onUpdateStats(updatedStats);
  };

  const handleSimulateMissedDay = () => {
    if (!onUpdateStats) return;
    const d = new Date();
    d.setDate(d.getDate() - 3); // 3 days ago
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const updatedStats: UserStats = {
      ...stats,
      lastStudyDate: dateStr
    };
    onUpdateStats(updatedStats);
    alert(`⏳ Simulated: Last study date set to ${dateStr} (3 days ago).\nYour streak is critically endangered! Press "Validate & Refresh Streak" to trigger protection or see a break!`);
  };

  const handleSkipOrCheckStreak = () => {
    if (!onUpdateStats) return;
    const today = getTodayString();
    const yesterday = getYesterdayString();
    
    let updatedStats = { ...stats };
    if (updatedStats.lastStudyDate && updatedStats.streak > 0) {
      if (updatedStats.lastStudyDate !== today && updatedStats.lastStudyDate !== yesterday) {
        if (updatedStats.hearts && updatedStats.hearts > 0) {
          updatedStats.hearts -= 1;
          updatedStats.lastStudyDate = yesterday;
          setFeedback({ isOpen: true, message: "❤️ A Skip-Day Heart was consumed! Your streak has been kept alive!" });
        } else {
          updatedStats.streak = 0;
          setFeedback({ isOpen: true, message: "💔 Oh no! Your streak has broken because you didn't study yesterday and had no Hearts left." });
        }
      } else {
        setFeedback({ isOpen: true, message: `✅ Streak is healthy! Last study date was ${updatedStats.lastStudyDate}.` });
      }
    } else {
      setFeedback({ isOpen: true, message: "No active streak yet! Study or simulate a study day to start a streak." });
    }
    onUpdateStats(updatedStats);
  };

  const handleResetStreak = () => {
    if (!onUpdateStats) return;
    const updatedStats: UserStats = {
      ...stats,
      streak: 0,
      lastStudyDate: null
    };
    onUpdateStats(updatedStats);
    setFeedback({ isOpen: true, message: "🔥 Streak reset to 0!" });
  };

  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  const handleToggleBothSidebars = () => {
    // If either side is open, retract both simultaneously
    const eitherOpen = isSidebarOpen || isDashboardOpen;
    const targetState = !eitherOpen;
    
    if (onUpdateSidebar) {
      onUpdateSidebar(targetState);
    }
    setIsDashboardOpen(targetState);
  };

  // Scroll and dynamic active state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Helper to format focus seconds into human readable time
  const formatFocusTime = (seconds: number) => {
    if (seconds === 0) return '0 minutes';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) {
      return `${h}h ${m}m`;
    }
    return `${m} mins`;
  };

  if (!activeCourse) {
    return (
      <div className="flex-1 bg-[#F7F7F7] dark:bg-[#0c141a] flex flex-col items-center justify-center p-8 select-none transition-colors">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-[var(--theme-primary-transparent)] border-2 border-[var(--theme-primary)] rounded-3xl flex items-center justify-center mx-auto text-[var(--theme-primary)]">
            <Milestone className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight">No Active Course Loaded</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Before you can start your gamified learning path, you need to select or create a course in the courses page.
            </p>
          </div>
          <button
            onClick={() => setTab('courses')}
            className="px-6 py-3.5 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] active:border-b-transparent hover:translate-y-[2px] hover:brightness-105 active:translate-y-[4px] text-white font-black rounded-2xl tracking-widest text-sm transition-all shadow-md cursor-pointer uppercase"
          >
            GO TO COURSES
          </button>
        </div>
      </div>
    );
  }

  // Calculate overall course progress percentage
  const totalVideos = activeCourse.videos.length;
  const completedVideos = activeCourse.videos.filter(v => v.completed).length;
  const progressPercent = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

  // Find the current active lesson index (first uncompleted video that is also not manually unlocked)
  const currentUncompletedIndex = activeCourse.videos.findIndex(v => !v.completed && !v.manuallyUnlocked);
  const activeVideoIndex = currentUncompletedIndex === -1 ? totalVideos : currentUncompletedIndex;

  // Check if a video is unlocked
  const isVideoUnlocked = (index: number) => {
    const video = activeCourse.videos[index];
    if (video.completed || video.manuallyUnlocked) {
      return true;
    }
    if (index === 0) return true;
    const prevVideo = activeCourse.videos[index - 1];
    if (prevVideo.completed || prevVideo.manuallyUnlocked) {
      return true;
    }
    return index <= activeVideoIndex;
  };

  // Align islands straight on the vertical path
  const getZigZagPosition = (index: number) => {
    return 'translate-x-0';
  };

  // Handle scroll to update headers active modules and floating style state
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPos = container.scrollTop;
    setIsScrolled(scrollPos > 15);
  };

  return (
    <div className="flex-1 bg-[#F7F7F7] dark:bg-[#0c141a] flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden transition-colors relative">
      {/* LEFT: Core Learning Path with onScroll observer */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onMouseDown={handleGlobalMouseDown}
        onMouseMove={handleGlobalMouseMove}
        onTouchMove={handleGlobalTouchMove}
        onMouseUp={handleGlobalMouseUp}
        onMouseLeave={handleGlobalMouseUp}
        className={`flex-1 overflow-y-visible md:overflow-y-auto relative px-4 md:px-16 py-4 flex flex-col items-center scrollbar-thin overflow-x-hidden md:overflow-x-visible transition-colors duration-300 cursor-default ${(!isSidebarOpen && !isDashboardOpen) ? 'lg:pr-16' : ''}`}
        title="Celestial Skyscape Domain: Orbit universe backdrop by moving your mouse around!"
      >
        {/* Course Banner Card - FIXED STICKY TOP FLOATER */}
        <div className="sticky top-0 z-40 w-full flex justify-center py-4 pointer-events-none mb-4">
          <div 
            className={`w-full max-w-xl bg-white/95 dark:bg-[#131f24]/95 backdrop-blur-md border-2 border-gray-200 dark:border-[#202f36] rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between pointer-events-auto transition-all duration-300
              ${isScrolled 
                ? 'shadow-[0_16px_36px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.4)] border-[var(--theme-primary)]/40 scale-[0.98]' 
                : 'shadow-sm border-gray-200 dark:border-[#202f36]'
              }`}
          >
            <div className="space-y-1 text-center sm:text-left mb-3 sm:mb-0 max-w-[75%] select-none">
              <span className="text-[10px] font-black tracking-widest text-[var(--theme-primary)] uppercase">
                Active Course
              </span>
              <h2 className="text-sm sm:text-base font-black text-gray-855 dark:text-gray-100 tracking-tight line-clamp-1">
                {activeCourse.name}
              </h2>
            </div>
            
            {/* Progress Tracker (Circular XP Meter) */}
            <div className="flex items-center space-x-2.5 shrink-0 select-none">
              <span className="text-[10px] sm:text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest font-mono">Progress:</span>
              <div className="relative w-11 h-11 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200 dark:text-slate-700"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="transparent"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[var(--theme-primary)]"
                    strokeDasharray={`${progressPercent}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-[10px] font-black text-gray-700 dark:text-gray-200">{progressPercent}%</span>
              </div>
            </div>
          </div>
        </div>



        {/* The Winding Learning Nodes */}
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center relative py-12 select-none">
          {/* Connecting line behind lessons */}
          <div className="absolute top-0 bottom-12 w-2 border-l-4 border-dashed border-gray-300 dark:border-slate-700 left-[50%] -translate-x-1/2 z-0 opacity-70" />
  
          {/* Lessons rendered sequentially */}
          <div className="relative w-full flex flex-col items-center z-10 space-y-40 transition-all duration-500 ease-in-out">
            {activeCourse.videos.map((video, index) => {
               if (index > activeVideoIndex + 1) return null; // Don't let the user scroll past the next module entirely!
               const isCompleted = video.completed;
               const isCurrent = index === activeVideoIndex;
               const isUnlocked = isVideoUnlocked(index);
               
               return (
                 <div
                   key={video.id}
                   className={`relative flex flex-col items-center z-10 transition-all duration-300`}
                 >
                   {/* Node Button wrapper */}
                   <div className="relative">
                     {/* Pulsing ring for the active current node */}
                     {isCurrent && (
                       <div className="hidden" />
                     )}
   
                     {/* 3D Floating Island game node */}
                     <div
                       role="button"
                        style={{
                          width: `${Math.round(245 * (islandScale / 1.4))}px`,
                          height: `${Math.round(265 * (islandScale / 1.4))}px`,
                          maxHeight: '1050px',
                          maxWidth: '1050px'
                        }}
                       tabIndex={0}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' || e.key === ' ') {
                           e.preventDefault();
                           if (isUnlocked) {
                             setSelectedVideo(video);
                           } else {
                             setAdvanceConfirmation(video);
                           }
                         }
                       }}
                       onClick={() => {
                          if (isUnlocked) {
                            setSelectedVideo(video);
                          } else {
                            setAdvanceConfirmation(video);
                          }
                        }}
                       className={`
                         flex items-center justify-center transition-all duration-300 cursor-pointer relative z-10
                         hover:-translate-y-2 active:translate-y-1 focus:outline-none
                         ${!isUnlocked ? 'cursor-not-allowed' : ''}`}
                     >
                       {((video.completionFootages && video.completionFootages.length > 0) || video.completionFootageUrl) && (
                         <div 
                           onClick={(e) => {
                             e.stopPropagation();
                             handleOpenFootage(video);
                           }}
                           className={`absolute -top-1 -right-1 ${!isSidebarOpen ? 'w-16 h-16' : 'w-13 h-13'} bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] rounded-full border-2 border-white dark:border-[#131f24] flex items-center justify-center z-30 cursor-pointer shadow-md transform hover:scale-110 transition-all pointer-events-auto`}
                           title="Click to view course completion footage"
                         >
                             <FileVideo className={`${!isSidebarOpen ? 'w-9 h-9' : 'w-7 h-7'} text-white`} />
                         </div>
                       )}
                       
                       <FloatingIsland 
                         isCompleted={isCompleted} 
                         isCurrent={isCurrent} 
                         isUnlocked={isUnlocked} 
                         index={index} 
                         video={video}
                         globalRotX={globalRotX}
                         globalRotY={globalRotY}
                         islandScale={islandScale}
                         cameraDistance={cameraDistance}
                       />
                     </div>
                   </div>
 
                   {/* Mini Title text beneath node */}
                   <div className="text-center mt-7 max-w-[240px] px-1 select-none transition-all duration-500 ease-in-out">
                     <p className={`font-black leading-tight line-clamp-2 text-[14px] sm:text-[16px]
                       ${isCurrent ? 'text-[var(--theme-primary)] font-extrabold' : isCompleted ? 'text-gray-650 dark:text-slate-350' : 'text-gray-400 dark:text-gray-500'}`}
                     >
                       {video.title.replace(/^Lecture \d+\s*-\s*/, '')}
                     </p>
                     {video.dueDate && !isCompleted && (
                       <span className="inline-block mt-1.5 text-[9px] font-bold text-red-500 uppercase bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-950/40 rounded px-1.5 py-0.5">
                         Due: {video.dueDate}
                       </span>
                     )}
                   </div>
                 </div>
               );
             })}
           </div>
         </div>
        </div>



      {/* RIGHT: Stats and Achievements (Bento Dashboard Bar) */}
      <div 
        className={`w-full md:w-[length:var(--right-sidebar-width)] bg-[#FAFAFA] dark:bg-[#0c1317] p-4 flex flex-col h-auto md:h-full overflow-y-auto space-y-4 select-none scrollbar-thin border-l border-neutral-200/50 dark:border-[#1d2a30] relative
          ${!isDashboardOpen ? 'hidden md:flex md:!w-0 md:!p-0 md:!border-l-0 md:overflow-hidden' : ''}
          ${isRightResizing ? 'transition-none select-none cursor-col-resize pb-4' : 'transition-[width,padding,margin] duration-300'}
        `}
        style={{ '--right-sidebar-width': `${rightSidebarWidth}px` } as React.CSSProperties}
      >
        {/* Resize Handler on the Left edge */}
        {isDashboardOpen && (
          <div
            onMouseDown={handleRightMouseDown}
            className="hidden md:block absolute top-0 bottom-0 left-0 w-1.5 cursor-col-resize z-50 select-none group/resize"
            title="Drag to resize study dashboard"
          >
            {/* Visual Hover Line Indicator */}
            <div className="absolute inset-y-0 left-0 w-[3px] bg-transparent group-hover/resize:bg-[var(--theme-primary)]/45 group-active/resize:bg-[var(--theme-primary)] transition-colors duration-150" />
          </div>
        )}
        
        {/* Right Dashboard Header matching Left brand */}
        <div className="flex items-center justify-between select-none px-1 py-1 shrink-0">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsDashboardOpen(false)}
              className="p-1.5 hover:bg-neutral-200/40 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
              title="Collapse Dashboard"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="text-left">
              <h1 className="text-sm font-black text-neutral-850 dark:text-neutral-150 tracking-wide uppercase leading-none">Study</h1>
              <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 tracking-widest uppercase leading-none mt-1 block">Dashboard</span>
            </div>
          </div>
        </div>

        {/* Dashboard Menu List matching Sidebar nav exactly */}
        <div className="space-y-4 flex-1 min-w-0">
          
          <div className="px-1 select-none">
            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider uppercase">Statistics</span>
          </div>

          <nav className="space-y-1 md:space-y-2 min-w-0">
            {/* Cumulative Focus Time */}
            <button 
              onClick={() => setShowFocusModal(true)}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 select-none min-w-0 hover:bg-neutral-150/60 dark:hover:bg-neutral-850/40 text-left cursor-pointer"
            >
              <div className="p-1.5 bg-sky-500/10 dark:bg-sky-500/15 rounded-lg text-sky-500 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 text-left font-sans">
                <p className="text-[13px] font-bold text-neutral-850 dark:text-neutral-150 leading-snug truncate">
                  {formatFocusTime(stats.totalFocusSeconds)}
                </p>
                <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase leading-none mt-0.5 animate-bounce">Focus Time</p>
              </div>
            </button>

            {/* Lessons Progress */}
            <div className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 select-none min-w-0 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/30">
              <div className="p-1.5 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-lg text-emerald-500 shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-bold text-neutral-850 dark:text-neutral-150 leading-snug truncate">
                  {completedVideos}/{totalVideos}
                </p>
                <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase leading-none mt-0.5 font-bold">Completed</p>
              </div>
            </div>

            {/* Completion Footage Stat */}
            <button 
              onClick={() => setShowSavedFootages(true)}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors duration-200 select-none text-left hover:bg-neutral-150/60 dark:hover:bg-neutral-850/40 cursor-pointer"
            >
              <div className="p-1.5 bg-purple-500/10 dark:bg-purple-500/15 rounded-lg text-purple-500 shrink-0">
                <VideoIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-neutral-850 dark:text-neutral-150 leading-snug truncate">
                  {activeCourse.videos.filter(v => v.completionFootageUrl || (v.completionFootages && v.completionFootages.length > 0)).length} Saved
                </p>
                <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase leading-none mt-0.5">Saved Footages</p>
              </div>
            </button>
          </nav>

          <div className="px-1 select-none pt-2">
            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider uppercase">STREAK & HEARTS</span>
          </div>

          <div className="space-y-3.5 pl-1.5">
            {/* Streak Widget */}
            <div className="flex flex-col gap-1.5 p-1 rounded-2xl bg-transparent select-none">
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-orange-500/10 dark:bg-orange-500/15 rounded-lg text-orange-500 shrink-0 animate-pulse">
                  <Flame className="w-4 h-4 fill-orange-500" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-bold text-neutral-850 dark:text-neutral-150 leading-snug">
                    {stats.streak} Days
                  </p>
                  <p className={`text-[9px] font-bold uppercase leading-none mt-0.5 truncate ${
                    timeUntilMidnight.startsWith("0h") ? "text-red-500 animate-pulse" : "text-neutral-400 dark:text-neutral-500"
                  }`}>
                    STREAK • {timeUntilMidnight}
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5 mt-1.5">
                <button 
                  onClick={handleSkipOrCheckStreak} 
                  className="flex-1 py-1.5 px-2 text-[10px] font-bold text-stone-500 dark:text-stone-400 border border-neutral-200 dark:border-neutral-850/60 bg-neutral-50/50 dark:bg-neutral-800/10 hover:bg-neutral-100 dark:hover:bg-neutral-800/40 rounded-xl transition-all cursor-pointer flex items-center justify-center uppercase select-none hover:scale-[1.01] active:scale-[0.99]"
                >
                  Skip Day
                </button>
                <button 
                  onClick={handleResetStreak} 
                  className="flex-1 py-1.5 px-2 text-[10px] font-bold text-stone-500 dark:text-stone-400 border border-neutral-200 dark:border-neutral-850/60 bg-neutral-50/50 dark:bg-neutral-800/10 hover:bg-neutral-100 dark:hover:bg-neutral-800/40 rounded-xl transition-all cursor-pointer flex items-center justify-center uppercase select-none hover:scale-[1.01] active:scale-[0.99]"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Hearts Widget */}
            <div className="flex flex-col gap-1.5 p-1 rounded-2xl bg-transparent select-none pt-1">
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-rose-500/10 dark:bg-rose-500/15 rounded-lg text-rose-500 shrink-0">
                  <Heart className="w-4 h-4 fill-rose-500" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-bold text-neutral-850 dark:text-neutral-150 leading-snug">
                    {Math.min(stats.hearts || 0, 5)} Hearts
                  </p>
                  <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase leading-none mt-0.5">
                    HEARTS BANK
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5 mt-1.5">
                <button 
                  onClick={handleBuyHeart} 
                  className="flex-1 py-1.5 px-2 text-[10px] font-bold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] rounded-xl transition-all cursor-pointer flex items-center justify-center uppercase select-none hover:scale-[1.01] active:scale-[0.99] font-sans"
                >
                  Buy (50 XP)
                </button>
                <button 
                  onClick={handleClaimFreeHeart} 
                  className="flex-1 py-1.5 px-2 text-[10px] font-bold text-stone-500 dark:text-stone-400 border border-neutral-200 dark:border-neutral-850/60 bg-neutral-50/50 dark:bg-neutral-800/10 hover:bg-neutral-100 dark:hover:bg-neutral-800/40 rounded-xl transition-all cursor-pointer flex items-center justify-center uppercase select-none hover:scale-[1.01] active:scale-[0.99]"
                >
                  Refill
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Restart Course Button Section */}
        <div className="pt-4 border-t border-neutral-200/50 dark:border-[#1d2a30] mt-auto shrink-0 select-none">
          <button
            onClick={() => setShowRestartConfirmation(true)}
            className="w-full py-2 bg-red-500/15 text-red-650 dark:text-red-400 font-bold text-[10px] rounded-xl hover:bg-red-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer uppercase tracking-wider"
            title="Restart course and reset your progress"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Restart Course</span>
          </button>
        </div>

      </div>

      {/* Desktop dashboard open trigger when dashboard is collapsed */}
      {!isDashboardOpen && (
        <button
          onClick={() => setIsDashboardOpen(true)}
          className="hidden md:flex fixed top-6 right-6 z-40 p-3 bg-neutral-50 dark:bg-[#0c1317] hover:bg-neutral-100 dark:hover:bg-neutral-800/80 border-2 border-neutral-200/50 dark:border-[#1d2a30] hover:scale-105 active:scale-95 text-neutral-500 dark:text-neutral-400 rounded-2xl shadow-md transition-all cursor-pointer"
          title="Open Dashboard"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
      )}

      {/* Mobile dashboard open trigger when dashboard is collapsed */}
      {!isDashboardOpen && (
        <button
          onClick={() => setIsDashboardOpen(true)}
          className="md:hidden fixed bottom-6 right-6 z-45 flex items-center space-x-1.5 px-4 py-3 bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] active:scale-95 text-white font-extrabold text-[11px] uppercase tracking-widest rounded-full shadow-lg transition-all cursor-pointer"
          title="Open Study stats"
        >
          <Flame className="w-4 h-4 fill-white" />
          <span>Study stats</span>
        </button>
      )}

      {/* Floating 3D Precision Workspace Control Dock - Minimal Redesign */}
      <div 
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 select-none bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-2xl shadow-md p-1.5 flex items-center transition-all duration-300 pointer-events-auto"
        style={{
          transform: `translateX(calc(-50% - ${isDashboardOpen ? rightSidebarWidth / 2 : 0}px))`
        }}
      >
        <button
          onClick={() => setIslandScale(Math.max(0.5, parseFloat((islandScale - 0.1).toFixed(2))))}
          className="p-2.5 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#18252d] cursor-pointer transition-colors hidden sm:flex items-center justify-center"
          title="Decrease Size"
        >
          <Minus className="w-5 h-5" />
        </button>

        <button
          onClick={() => setIslandScale(Math.min(5.0, parseFloat((islandScale + 0.1).toFixed(2))))}
          className="p-2.5 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#18252d] cursor-pointer transition-colors hidden sm:flex items-center justify-center"
          title="Increase Size"
        >
          <Plus className="w-5 h-5" />
        </button>

        <div className="w-[2px] h-6 bg-gray-200 dark:bg-[#202f36] mx-1.5 rounded hidden sm:block"></div>

        <button 
          onClick={() => {
            setIslandScale(1.4);
            setCameraDistance(7.2);
          }}
          className="p-2.5 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#18252d] cursor-pointer transition-colors flex items-center justify-center"
          title="Normal View (Reset Zoom & Size)"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        <div className="w-[2px] h-6 bg-gray-200 dark:bg-[#202f36] mx-1.5 rounded"></div>

        {/* The Toggle Sidebars button seamlessly integrated into the dock */}
        <button
          onClick={handleToggleBothSidebars}
          className="p-2.5 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#18252d] cursor-pointer transition-colors flex items-center justify-center"
          title={isSidebarOpen || isDashboardOpen ? "Collapse both sidebars" : "Expand both sidebars"}
        >
          {isSidebarOpen || isDashboardOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-minimize-2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" x2="21" y1="10" y2="3"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-maximize-2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
          )}
        </button>
      </div>

      {/* Saved Footages Dialog Modal Overlay */}
        <AnimatePresence>
          {showSavedFootages && (
            <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto border-none">
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-3xl p-6 w-full max-w-lg shadow-xl relative space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">Saved Footages</h3>
                  <button onClick={() => setShowSavedFootages(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold cursor-pointer">×</button>
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  {activeCourse.videos
                    .filter(v => (v.completionFootageUrl && v.completionFootageUrl.trim() !== '') || (Array.isArray(v.completionFootages) && v.completionFootages.length > 0))
                    .map(video => (
                      <div key={video.id} className="border-b border-gray-100 dark:border-[#202f36] pb-2">
                        <p className="font-semibold text-gray-700 dark:text-slate-200 text-sm">{video.title}</p>
                        <button onClick={() => { setShowSavedFootages(false); handleOpenFootage(video); }} className="text-[var(--theme-primary)] text-xs font-bold hover:underline cursor-pointer">View Footage</button>
                      </div>
                    ))}
                  {activeCourse.videos.filter(v => (v.completionFootageUrl && v.completionFootageUrl.trim() !== '') || (Array.isArray(v.completionFootages) && v.completionFootages.length > 0)).length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">No saved footages yet.</p>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      {/* Lesson Details Dialog Modal Overlay */}
      <AnimatePresence>
        {feedback && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto border-none">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-3xl p-6 w-full max-w-sm shadow-xl relative space-y-4 text-center"
            >
              <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">Notice</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{feedback.message}</p>
              <button
                onClick={() => setFeedback(null)}
                className="w-full py-3 bg-[var(--theme-primary)] text-white font-black text-xs rounded-2xl tracking-widest cursor-pointer"
              >
                GOT IT
              </button>
            </motion.div>
          </div>
        )}

        {showRestartConfirmation && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto border-none">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-3xl p-6 w-full max-w-sm shadow-xl relative space-y-6 text-center select-none"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900/40 rounded-full flex items-center justify-center mx-auto text-red-500">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 leading-snug tracking-tight">
                  Restart this course?
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  This will reset all your lesson checkmarks, manual unlocks, and completion footage history for "{activeCourse!.name}". Are you sure you want to start over?
                </p>
              </div>
              <div className="flex items-center space-x-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRestartConfirmation(false)}
                  className="flex-1 py-3 border-2 border-gray-200 dark:border-[#202f36] font-black text-xs text-gray-500 dark:text-slate-400 rounded-2xl tracking-widest hover:bg-gray-100 dark:hover:bg-[#18252d] transition-all cursor-pointer uppercase text-center"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (courses && onUpdateCourses) {
                      const updatedCourses = courses.map(course => {
                        if (course.id === activeCourse!.id) {
                          const videos = course.videos.map(v => ({
                            ...v,
                            completed: false,
                            manuallyUnlocked: false,
                            completionFootageUrl: null,
                            completionFootageName: null,
                            completionFootageSize: null,
                            completionFootageIsVideo: null,
                            completionFootages: null,
                          }));
                          return { ...course, videos };
                        }
                        return course;
                      });
                      onUpdateCourses(updatedCourses);
                    }
                    if (onUpdateStats) {
                      const updatedStats = {
                        ...stats,
                        xp: 0,
                        level: 1,
                        streak: 0,
                        totalFocusSeconds: 0,
                        history: [],
                        lastStudyDate: null
                      };
                      onUpdateStats(updatedStats);
                      alert("⚠️ Course progress has been reset. All stats, focus time, and your day streak have been restarted from zero.");
                    }
                    setShowRestartConfirmation(false);
                  }}
                  className="flex-1 py-3 bg-red-500 border-b-4 border-red-700 active:border-b-transparent text-white font-black text-xs rounded-2xl tracking-widest transition-all shadow-sm cursor-pointer uppercase text-center hover:translate-y-0.5 active:translate-y-1"
                >
                  YES, RESTART
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {retryConfirmation && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto border-none">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-3xl p-6 w-full max-w-sm shadow-xl relative space-y-6 text-center"
            >
              <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 leading-snug tracking-tight">
                Retry this lesson?
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                You have already completed "{retryConfirmation.title}". Are you sure you want to retry it?
              </p>
              <div className="flex items-center space-x-3.5">
                <button
                  onClick={() => setRetryConfirmation(null)}
                  className="flex-1 py-3 border-2 border-gray-200 dark:border-[#202f36] font-black text-sm text-gray-500 dark:text-slate-400 rounded-2xl tracking-widest hover:bg-gray-100 dark:hover:bg-[#18252d] transition-all cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => {
                    onSelectVideoForFocus(retryConfirmation);
                    setRetryConfirmation(null);
                    setTab('today');
                  }}
                  className="flex-1 py-3 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] text-white font-black text-sm rounded-2xl tracking-widest transition-all shadow-sm cursor-pointer"
                >
                  YES, RETRY
                </button>
              </div>
            </motion.div>
          </div>
        )}


        {selectedVideo && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto border-none">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-3xl p-6 w-full max-w-lg shadow-xl relative space-y-6"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute right-4 top-4 p-1.5 text-gray-450 hover:text-gray-750 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#18252d] rounded-xl transition-all cursor-pointer"
              >
                <Lock className="w-5 h-5 rotate-180 text-gray-550 dark:text-slate-450 hover:text-gray-805 dark:hover:text-gray-200" />
              </button>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-black tracking-widest px-3 py-1 rounded-full border
                    ${selectedVideo.completed 
                      ? 'bg-[var(--theme-primary-transparent)] border-[var(--theme-primary-transparent)] text-[var(--theme-primary)]' 
                      : 'bg-blue-50 dark:bg-[#111d24] border-blue-200 dark:border-[#202f36] text-[var(--theme-primary)]'}`}
                  >
                    {selectedVideo.completed ? 'COMPLETED' : 'UPCOMING'}
                  </span>
                  
                  {selectedVideo.dueDate && (
                    <div className="flex items-center space-x-1.5 text-[10px] uppercase font-bold text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 px-2.5 py-0.5 rounded-full">
                      <CalendarDays className="w-3 h-3" />
                      <span>Due: {selectedVideo.dueDate}</span>
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-black text-gray-850 dark:text-gray-100 leading-snug tracking-tight pb-2">
                  {selectedVideo.title}
                </h3>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3.5">
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="flex-1 py-3 border-2 border-gray-200 dark:border-[#202f36] hover:border-gray-300 dark:hover:border-[#35454e] font-black text-sm text-gray-500 dark:text-slate-400 rounded-2xl tracking-widest hover:bg-gray-100 dark:hover:bg-[#18252d] active:translate-y-0.5 transition-all cursor-pointer text-center"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => {
                    onSelectVideoForFocus(selectedVideo);
                    setSelectedVideo(null);
                    setTab('today');
                  }}
                  className="flex-1 py-3 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] active:border-b-transparent hover:translate-y-0.5 active:translate-y-1 text-white font-black text-sm rounded-2xl tracking-widest transition-all shadow-sm flex items-center justify-center space-x-2 cursor-pointer text-center"
                >
                  <Play className="w-4 h-4 fill-current stroke-[3]" />
                  <span>{selectedVideo.completed ? 'REPLAY LESSON' : 'START FOCUS'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {advanceConfirmation && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto border-none">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-3xl p-6 w-full max-w-sm shadow-xl relative space-y-6 text-center select-none"
            >
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-900/40 rounded-full flex items-center justify-center mx-auto text-[#1cb0f6]">
                <Milestone className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 leading-snug tracking-tight">
                  Advance to this lesson?
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs">
                  You haven't unlocked "{advanceConfirmation.title}" yet. Would you like to advance directly to this module?
                </p>
              </div>
              <div className="flex items-center space-x-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAdvanceConfirmation(null)}
                  className="flex-1 py-3 border-2 border-gray-200 dark:border-[#202f36] font-black text-xs text-gray-500 dark:text-slate-400 rounded-2xl tracking-widest hover:bg-gray-100 dark:hover:bg-[#18252d] transition-all cursor-pointer uppercase text-center"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeCourse && courses && onUpdateCourses) {
                      const updatedCourses = courses.map(course => {
                        if (course.id === activeCourse.id) {
                          const videos = course.videos.map(v => {
                            if (v.id === advanceConfirmation.id) {
                              return { ...v, manuallyUnlocked: true };
                            }
                            return v;
                          });
                          return { ...course, videos };
                        }
                        return course;
                      });
                      
                      onUpdateCourses(updatedCourses);
                      
                      // Find target newly updated video inside fresh course representation
                      const updatedCourse = updatedCourses.find(c => c.id === activeCourse.id);
                      if (updatedCourse) {
                        const updatedVideo = updatedCourse.videos.find(v => v.id === advanceConfirmation.id);
                        if (updatedVideo) {
                           onSelectVideoForFocus(updatedVideo);
                           setTab('today');
                        }
                      }
                    }
                    setAdvanceConfirmation(null);
                  }}
                  className="flex-1 py-3 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] text-white font-black text-xs rounded-2xl tracking-widest transition-all shadow-sm cursor-pointer uppercase text-center hover:translate-y-0.5 active:translate-y-1 active:border-b-transparent"
                >
                  YES, ADVANCE
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {activeFootageVideo && (() => {
          const allFootages = fetchedFootages;
          const activeFootage = allFootages[selectedFootageIndex] || allFootages[0];

          return (
            <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto border-none">
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                className="bg-white dark:bg-[#131f24] border-2 border-gray-200 dark:border-[#202f36] rounded-[32px] p-6 w-full max-w-lg shadow-2xl relative space-y-4"
              >
                {/* Close Button */}
                <button
                  onClick={() => setActiveFootageVideo(null)}
                  className="absolute right-4 top-4 p-1.5 text-gray-450 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#18252d] rounded-xl transition-all cursor-pointer"
                >
                  <span className="text-xl font-bold font-sans">×</span>
                </button>

                <div className="space-y-1.5 pr-8 select-none">
                  <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest uppercase">
                    COMPLETION FOOTAGES ({allFootages.length})
                  </span>
                  <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 leading-snug tracking-tight">
                    {activeFootageVideo.title}
                  </h3>
                </div>

                {/* Multiple Footage Selectors/Tab Indicators */}
                {allFootages.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 justify-start">
                    {allFootages.map((foot, idx) => (
                      <button
                        key={foot.id || idx}
                        onClick={() => setSelectedFootageIndex(idx)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border-2 shrink-0 cursor-pointer
                          ${selectedFootageIndex === idx
                            ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)]'
                            : 'bg-white dark:bg-[#131f24] hover:bg-gray-50 dark:hover:bg-[#18252d] text-gray-500 dark:text-slate-400 border-gray-150 dark:border-[#202f36]'}`}
                      >
                        File {idx + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* Footage Media Container */}
                {activeFootage ? (
                  <>
                    <div className="border border-gray-200 dark:border-[#202f36] rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center relative group">
                      {activeFootage.isVideo ? (
                        <video
                          key={activeFootage.url}
                          src={activeFootage.url}
                          controls
                          playsInline
                          preload="metadata"
                          muted={false}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <img
                          src={activeFootage.url}
                          alt="Lesson Completion Footage"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-400 dark:text-slate-500 select-none">
                      <span className="truncate max-w-[70%]" title={activeFootage.name}>File: {activeFootage.name}</span>
                      <span>Size: {activeFootage.size}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-gray-400">No footage available.</div>
                )}

                <button
                  onClick={() => setActiveFootageVideo(null)}
                  className="w-full py-3 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] text-white font-black text-sm rounded-2xl tracking-widest transition-all shadow-sm active:translate-y-0.5 cursor-pointer uppercase"
                >
                  CLOSE PREVIEW
                </button>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <FocusDetailModal 
        isOpen={showFocusModal} 
        onClose={() => setShowFocusModal(false)} 
        stats={stats} 
        activeCourse={activeCourse} 
        courses={courses || []} 
      />

    </div>
  );
}
