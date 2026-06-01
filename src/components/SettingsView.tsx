import React, { useState, useCallback } from 'react';
import { Sun, Moon, Trash2, AlertTriangle, User as UserIcon, Mail, Lock, Check, X, Crop, Eye, EyeOff, Star, Clock, Calendar } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import Cropper from 'react-easy-crop';
import { UserStats } from '../types';

interface SettingsViewProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  colorTheme: 'blue' | 'pink' | 'green' | 'orange';
  setColorTheme: (colorTheme: 'blue' | 'pink' | 'green' | 'orange') => void;
  onDeleteAccount: () => Promise<void>;
  cloudSyncEnabled: boolean;
  onToggleCloudSync: (enabled: boolean) => void;
  onOpenAuth?: () => void;
  stats?: UserStats;
  setTab?: (tab: 'home' | 'courses' | 'today' | 'settings' | 'community' | 'profile' | 'stats' | 'upgrade') => void;
}

export default function SettingsView({
  theme,
  setTheme,
  colorTheme,
  setColorTheme,
  onDeleteAccount,
  cloudSyncEnabled,
  onToggleCloudSync,
  onOpenAuth,
  stats,
  setTab,
}: SettingsViewProps) {
  const { user, updateUserEmail, updateUserPassword, updateUserProfile, logout } = useFirebase();

  const uniqueClockedInDays = React.useMemo(() => {
    if (!stats || !stats.history) return [];
    const datesSet = new Set<string>();
    stats.history.forEach(item => {
      if (item.date) datesSet.add(item.date);
    });
    return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  }, [stats]);

  const historyByDate = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    if (stats && stats.history) {
      stats.history.forEach(item => {
        if (!item.date) return;
        if (!map[item.date]) {
          map[item.date] = [];
        }
        map[item.date].push(item);
      });
    }
    return map;
  }, [stats]);

  const monthlyCalendars = React.useMemo(() => {
    const list: { year: number; month: number; monthName: string; key: string; activeDates: Set<string> }[] = [];
    const keysSet = new Set<string>();

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    if (stats && stats.history) {
      stats.history.forEach(item => {
        if (!item.date) return;
        const [yStr, mStr] = item.date.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10) - 1;
        if (isNaN(y) || isNaN(m)) return;

        const key = `${y}-${m}`;
        if (!keysSet.has(key)) {
          keysSet.add(key);
          list.push({
            year: y,
            month: m,
            monthName: monthNames[m],
            key,
            activeDates: new Set<string>()
          });
        }
      });
    }

    list.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    if (stats && stats.history) {
      stats.history.forEach(item => {
        if (!item.date) return;
        const [yStr, mStr] = item.date.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10) - 1;
        const key = `${y}-${m}`;
        const found = list.find(l => l.key === key);
        if (found) {
          found.activeDates.add(item.date);
        }
      });
    }

    return list;
  }, [stats]);

  const getDaysInMonthArray = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const days = [];
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      const paddedDay = String(i).padStart(2, '0');
      const paddedMonth = String(month + 1).padStart(2, '0');
      const dateStr = `${year}-${paddedMonth}-${paddedDay}`;
      days.push({
        dayNum: i,
        dateStr,
      });
    }
    return days;
  };

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhotoURL, setNewPhotoURL] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;
        ctx.drawImage(
          img,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );
        
        let size = 96;
        let quality = 0.7;
        let dataUrl = '';
        const tryCompress = () => {
          const outCanvas = document.createElement('canvas');
          outCanvas.width = size;
          outCanvas.height = size;
          const outCtx = outCanvas.getContext('2d');
          if (outCtx) {
            outCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, size, size);
          }
          dataUrl = outCanvas.toDataURL('image/jpeg', quality);
          // Limit to very small sizes to fit standard URL constraints
          if (dataUrl.length > 2000 && size > 32) {
             size -= 16;
             quality = Math.max(0.1, quality - 0.15);
             tryCompress();
          } else if (dataUrl.length > 3000) {
             setMessage({ type: 'error', text: 'Image cannot be compressed enough to fit limit. Try a different image or use a URL.' });
             setImageToCrop(null);
          } else {
             setNewPhotoURL(dataUrl);
             setImageToCrop(null);
          }
        };
        tryCompress();
      };
      img.src = imageToCrop;
    } catch (e) {
      console.error(e);
      setImageToCrop(null);
    }
  };

  const handleDeleteClick = async () => {
    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      setTimeout(() => setShowConfirmDelete(false), 5000);
      return;
    }
    try {
      await onDeleteAccount();
    } catch (err: any) {
      let errMsg = err?.message || String(err);
      if (err?.code === 'auth/requires-recent-login' || errMsg.includes('requires-recent-login') || errMsg.includes('recent-login')) {
        errMsg = 'Security requirement: Deleting your account requires a recent login. Please sign out, sign back in, and immediately retry.';
      } else {
        errMsg = `Error deleting account: ${errMsg}`;
      }
      setMessage({ type: 'error', text: errMsg });
      setTimeout(() => setMessage(null), 10000);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail) {
      setMessage({ type: 'error', text: 'Email cannot be empty.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    try {
      await updateUserEmail(newEmail);
      setIsEditingEmail(false);
      setNewEmail('');
      setMessage({ type: 'success', text: 'Email updated successfully!' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setIsEditingEmail(false);
      let errMsg = err.message || 'Failed to update email. You may need to log in again.';
      if (errMsg.includes('recent authentication') || errMsg.includes('requires-recent-login')) {
        errMsg = 'Security requirement: Please log out and log back in to change your email.';
      }
      setMessage({ type: 'error', text: errMsg });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      setMessage({ type: 'error', text: 'Password cannot be empty.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    try {
      await updateUserPassword(newPassword);
      setIsEditingPassword(false);
      localStorage.setItem('password_length', newPassword.length.toString());
      setNewPassword('');
       setMessage({ type: 'success', text: 'Password updated successfully!' });
       setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setIsEditingPassword(false);
      let errMsg = err.message || 'Failed to update password. You may need to log in again.';
      if (errMsg.includes('recent authentication') || errMsg.includes('requires-recent-login')) {
        errMsg = 'Security requirement: Please log out and log back in to change your password.';
      }
      setMessage({ type: 'error', text: errMsg });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleUpdateProfile = async () => {
     try {
       await updateUserProfile(newName || null, newPhotoURL || null);
       setIsEditingProfile(false);
       setMessage({ type: 'success', text: 'Profile updated successfully!' });
       setTimeout(() => setMessage(null), 5000);
     } catch (err: any) {
       setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
     }
  };

  const handleLogoutClick = () => {
    if (!showConfirmLogout) {
      setShowConfirmLogout(true);
      setTimeout(() => setShowConfirmLogout(false), 5000);
      return;
    }
    logout();
  };

  return (
    <div className="flex-1 bg-[#F7F7F7] dark:bg-[#0c141a] p-6 md:p-8 overflow-y-auto h-full relative select-none font-sans scrollbar-thin animate-fadeIn">
      <div className="max-w-2xl mx-auto space-y-8 pb-32">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200/50 dark:border-[#202f36] pb-3">
          <div>
            <h2 className="text-lg font-black text-gray-800 dark:text-slate-100 tracking-tight">Settings Workspace</h2>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              Personalize your study experience & account credentials
            </p>
          </div>
        </div>

        {message && (
          <div className={`p-3.5 rounded-xl flex items-center gap-3 font-semibold text-xs border ${
            message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200/40 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200/40 dark:border-red-900/30'
          }`}>
            <span className="flex-1">{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-current opacity-70 hover:opacity-100 uppercase text-[10px] tracking-wider cursor-pointer font-bold">Dismiss</button>
          </div>
        )}

        {/* Profile Card */}
        {user && (
          <div className="bg-white dark:bg-[#131f24] border border-gray-250/60 dark:border-[#202f36] rounded-2xl p-5 shadow-xs space-y-4">
             <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-1">
                <h3 className="flex items-center space-x-2 font-black text-gray-800 dark:text-gray-200 text-lg">
                  <UserIcon className="w-5 h-5 text-[var(--theme-primary)]" />
                  <span>Public Profile</span>
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 font-bold">
                  Update your display name and profile picture.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Display Name */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-50 dark:bg-[#18252d] border border-gray-100 dark:border-[#202f36] rounded-2xl">
                <div className="flex items-center space-x-3">
                   <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-gray-400 bg-gray-200 dark:bg-[#202f36] overflow-hidden shrink-0">
                     {user?.photoURL ? (
                        <button 
                          onClick={() => setViewingPhoto(user.photoURL!)} 
                          className="w-full h-full p-0 m-0 border-none outline-none cursor-pointer focus:ring-2 focus:ring-[var(--theme-primary)]"
                          title="View Profile Picture"
                        >
                          <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                        </button>
                     ) : <UserIcon className="w-6 h-6" />}
                   </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Display Name</p>
                    {isEditingProfile ? (
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={user?.displayName || 'New Name'}
                        className="mt-1 w-full bg-white dark:bg-[#131f24] border-2 border-[var(--theme-primary)] rounded-lg px-3 py-1.5 text-sm outline-none font-medium text-gray-700 dark:text-slate-200"
                      />
                    ) : (
                      <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{user?.displayName || 'Anonymous Student'}</p>
                    )}
                  </div>
                </div>
              </div>

               {/* Photo URL or Upload */}
              {isEditingProfile && (
                 <div className="flex flex-col gap-4 p-4 bg-gray-50 dark:bg-[#18252d] border border-gray-100 dark:border-[#202f36] rounded-2xl">
                   <div className="flex-1">
                      <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest pl-1 mb-1">Avatar Image URL</p>
                      <input
                        type="url"
                        value={newPhotoURL}
                        onChange={(e) => setNewPhotoURL(e.target.value)}
                        placeholder="https://example.com/avatar.png"
                        className="w-full bg-white dark:bg-[#131f24] border-2 border-[var(--theme-primary)] rounded-lg px-3 py-1.5 text-sm outline-none font-medium text-gray-700 dark:text-slate-200"
                      />
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">OR</span>
                     <div className="flex-1 border-t border-gray-200 dark:border-[#35454e]"></div>
                   </div>
                   <div className="flex-1">
                      <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest pl-1 mb-1">Upload Image</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5242880) { // 5MB limit before compression
                              setMessage({ type: 'error', text: 'Image too large (max 5MB)' });
                              e.target.value = '';
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setImageToCrop(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full text-sm text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-[var(--theme-primary)] file:text-white hover:file:bg-[var(--theme-secondary)] file:cursor-pointer transition-all"
                      />
                   </div>
                 </div>
              )}

              <div className="flex justify-end pt-2">
                  {isEditingProfile ? (
                    <div className="flex gap-2">
                       <button onClick={() => setIsEditingProfile(false)} className="text-xs font-bold px-3 py-1.5 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 uppercase cursor-pointer">Cancel</button>
                       <button onClick={handleUpdateProfile} className="text-xs font-black px-3 py-1.5 bg-[var(--theme-primary)] text-white rounded-lg hover:bg-[var(--theme-secondary)] uppercase transition-colors flex items-center gap-1 cursor-pointer"><Check className="w-3 h-3"/> Save Profile</button>
                    </div>
                  ) : (
                    <button onClick={() => { setIsEditingProfile(true); setNewName(user?.displayName || ''); setNewPhotoURL(user?.photoURL || ''); }} className="text-xs font-black px-4 py-2 bg-white dark:bg-[#202f36] border border-gray-200 dark:border-[#35454e] text-gray-600 dark:text-slate-300 rounded-xl hover:bg-gray-50 dark:hover:bg-[#35454e] uppercase transition-colors shadow-sm cursor-pointer">Edit Profile</button>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* Account Setting Option Card */}
        {user ? (
          <div className="bg-white dark:bg-[#131f24] border border-neutral-250/60 dark:border-[#202f36] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="flex items-center space-x-1.5 font-bold text-neutral-850 dark:text-neutral-200 text-sm">
                  <Lock className="w-4 h-4 text-[var(--theme-primary)]" />
                  <span>Account Credentials</span>
                </h3>
                <p className="text-[10px] text-neutral-450 dark:text-slate-400 font-semibold">
                  Manage locked email address and secure password key.
                </p>
              </div>
              {user && (
                <button
                  onClick={handleLogoutClick}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg border uppercase transition-colors shadow-xs cursor-pointer whitespace-nowrap
                    ${showConfirmLogout 
                      ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300 font-black animate-pulse'
                      : 'bg-white dark:bg-[#202f36] border-neutral-200 dark:border-[#35454e] text-neutral-600 dark:text-slate-350 hover:bg-neutral-50 dark:hover:bg-[#35454e]'
                    }
                  `}
                >
                  {showConfirmLogout ? 'Sure? Logout' : 'Log Out'}
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 bg-neutral-50 dark:bg-[#18252d] border border-neutral-200/30 dark:border-[#202f36]/60 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white dark:bg-[#202f36] rounded-xl text-gray-400 dark:text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Email Address</p>
                    {isEditingEmail ? (
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder={user?.email || 'New Email'}
                        className="mt-1 w-full bg-white dark:bg-[#131f24] border-2 border-[var(--theme-primary)] rounded-lg px-3 py-1.5 text-sm outline-none font-medium text-gray-700 dark:text-slate-200"
                      />
                    ) : (
                      <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{user?.email || 'No email attached'}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  {isEditingEmail ? (
                    <div className="flex gap-1.5">
                       <button onClick={() => setIsEditingEmail(false)} className="text-[10px] font-bold px-2 py-1 text-gray-450 hover:text-gray-650 uppercase cursor-pointer">Cancel</button>
                       <button onClick={handleUpdateEmail} className="text-[10px] font-black px-2.5 py-1 bg-[var(--theme-primary)] text-white rounded-lg uppercase cursor-pointer">Save</button>
                    </div>
                  ) : (
                    <button onClick={() => { setIsEditingEmail(true); setNewEmail(user?.email || ''); }} className="text-[10px] font-black px-2.5 py-1 bg-white dark:bg-[#202f36] border border-neutral-200 dark:border-[#35454e] text-neutral-600 dark:text-slate-350 rounded-lg hover:bg-neutral-50 dark:hover:bg-[#35454e] uppercase transition-colors cursor-pointer">Change</button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 bg-neutral-50 dark:bg-[#18252d] border border-neutral-200/30 dark:border-[#202f36]/60 rounded-xl">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-white dark:bg-[#202f36] rounded-lg text-neutral-400">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-neutral-400 dark:text-slate-500 uppercase tracking-widest">Password Key</p>
                    {isEditingPassword ? (
                      <div className="relative mt-0.5">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New Password"
                          className="w-full bg-white dark:bg-[#131f24] border border-[var(--theme-primary)] rounded-lg pl-2 pr-8 py-1 text-xs outline-none font-bold text-neutral-800 dark:text-slate-100"
                        />
                        <div 
                          className="absolute inset-y-0 right-0 pr-2 flex items-center cursor-pointer text-gray-400"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-neutral-700 dark:text-slate-200 font-mono tracking-widest">
                        {'•'.repeat(parseInt(localStorage.getItem('password_length') || '8', 10))}
                      </p>
                    )}
                  </div>
                </div>
                
                <div>
                  {isEditingPassword ? (
                    <div className="flex gap-1.5">
                       <button onClick={() => setIsEditingPassword(false)} className="text-[10px] font-bold px-2 py-1 text-neutral-400 hover:text-neutral-600 uppercase cursor-pointer">Cancel</button>
                       <button onClick={handleUpdatePassword} className="text-[10px] font-black px-2.5 py-1 bg-[var(--theme-primary)] text-white rounded-lg uppercase cursor-pointer">Save</button>
                    </div>
                  ) : (
                    <button onClick={() => { setIsEditingPassword(true); setNewPassword(''); }} className="text-[10px] font-black px-2.5 py-1 bg-white dark:bg-[#202f36] border border-neutral-200 dark:border-[#35454e] text-neutral-600 dark:text-slate-350 rounded-lg hover:bg-neutral-50 dark:hover:bg-[#35454e] uppercase transition-colors cursor-pointer">Change</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : !user ? (
          /* Guest Study Mode Sync teaser card */
          <div className="bg-white dark:bg-[#131f24] border border-neutral-250/60 dark:border-[#202f36] rounded-2xl p-5 space-y-3.5 shadow-xs text-center sm:text-left">
            <h3 className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">Cloud Data Persistence</h3>
            <p className="text-[10px] text-neutral-450 dark:text-slate-400 font-semibold leading-relaxed">
              You are currently studying on <span className="text-theme-primary font-bold">Guest Local Mode</span>. Learning paths, logged hours, and streaks remain local. Sign in or initialize a student account to map sessions seamlessly into the cloud databases.
            </p>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="py-1.5 px-3.5 bg-theme-primary hover:bg-theme-secondary text-white font-bold text-[10px] tracking-wide rounded-lg uppercase transition-colors cursor-pointer"
                id="settings-login-teaser-btn"
              >
                Sign In / Sign Up
              </button>
            )}
          </div>
        ) : null}

        {/* Active Subscription status block */}
        {user && stats && (
          <div className="filter blur-md pointer-events-none opacity-50 space-y-4">
            <div className="bg-white dark:bg-[#131f24] border border-neutral-250/60 dark:border-[#202f36] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="font-bold text-neutral-850 dark:text-neutral-200 text-sm flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Membership Subscription</span>
                </h3>
                <p className="text-[10px] text-neutral-450 dark:text-slate-400 font-semibold">
                  Verify your active Test student account tier and billing multipliers.
                </p>
              </div>

              {stats.subscription === 'plus' ? (
                <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 border border-amber-300/40">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Plus Member
                </span>
              ) : (
                <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full uppercase tracking-wider border border-neutral-200 dark:border-neutral-700">
                  Standard tier
                </span>
              )}
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#18252d]/45 border border-neutral-250/30 dark:border-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-350 leading-relaxed flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                {stats.subscription === 'plus' ? (
                  <>
                    <h4 className="font-extrabold text-amber-500 text-xs">2X STUDY REWARDS ACTIVE</h4>
                    <p className="text-[10px] text-neutral-400 dark:text-slate-450">XP multipliers, customized badges, and instant prioritized cloud database sync are enabled.</p>
                  </>
                ) : (
                  <>
                    <h4 className="font-bold text-neutral-700 dark:text-neutral-300 text-xs">ACTIVATE PLUS MULTIPLIER</h4>
                    <p className="text-[10px] text-neutral-400 dark:text-slate-400">Upgrade to double focus session reward multipliers, secure prioritised cloud backups, and receive gold ledger badges.</p>
                  </>
                )}
              </div>

              {setTab && (
                <button
                  onClick={() => setTab('upgrade')}
                  className="self-start sm:self-auto text-[10px] font-black px-3.5 py-2 rounded-lg uppercase tracking-wider cursor-pointer font-sans shrink-0 transition-colors bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-xs border-none"
                >
                  {stats.subscription === 'plus' ? 'View Perks' : 'Upgrade Plan'}
                </button>
              )}
            </div>
          </div>
          </div>
        )}

        {/* Course Focus Statistics Dashboard Card */}
        {user && stats && (
          <div className="bg-white dark:bg-[#131f24] border border-neutral-250/60 dark:border-[#202f36] rounded-2xl p-5 shadow-xs space-y-5 select-none" id="settings-focus-stats-dashboard">
            <div className="space-y-0.5 text-left">
              <h3 className="flex items-center space-x-1.5 font-bold text-neutral-850 dark:text-neutral-200 text-sm">
                <Clock className="w-4 h-4 text-emerald-500" />
                <span>Focus & Syllabus Analytics</span>
              </h3>
              <p className="text-[10px] text-neutral-450 dark:text-slate-400 font-semibold">
                Review your total time spent on all subjects and lessons metrics synced in the cloud.
              </p>
            </div>

            {/* Grid of Key stats */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-3.5 bg-neutral-50 dark:bg-[#18252d]/65 border border-neutral-200/35 dark:border-[#202f36]/70 rounded-xl text-left">
                <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-0.5">Logged Hours</p>
                <p className="text-base font-black text-[var(--theme-primary)]">
                  {(() => {
                    const totalSecs = stats.totalFocusSeconds || 0;
                    const hrs = Math.floor(totalSecs / 3600);
                    const mins = Math.floor((totalSecs % 3600) / 60);
                    if (hrs > 0) return `${hrs}h ${mins}m`;
                    return `${mins}m`;
                  })()}
                </p>
              </div>

              <div className="p-3.5 bg-neutral-50 dark:bg-[#18252d]/65 border border-neutral-200/35 dark:border-[#202f36]/70 rounded-xl text-left">
                <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-0.5">Study Iterations</p>
                <p className="text-base font-black text-emerald-500">
                  {stats.history ? stats.history.length : 0} Sessions
                </p>
              </div>
            </div>

            {/* Course Breakdown list */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-[11px] font-extrabold text-neutral-400 dark:text-slate-500 uppercase tracking-tight">
                <span>Course Breakdown</span>
                <span>Time Spent</span>
              </div>

              {(() => {
                // Group focus times per course from history
                const courseMap: Record<string, { name: string; seconds: number }> = {};
                if (stats.history) {
                  stats.history.forEach(item => {
                    const cId = item.courseId || 'unknown';
                    if (!courseMap[cId]) {
                      courseMap[cId] = { name: item.courseName || 'General course', seconds: 0 };
                    }
                    courseMap[cId].seconds += item.focusSeconds || 0;
                  });
                }

                const list = Object.entries(courseMap).map(([id, data]) => ({
                  id,
                  ...data
                })).sort((a, b) => b.seconds - a.seconds);

                if (list.length === 0) {
                  return (
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 py-3 text-center font-bold">
                      No course focus logs tracking has been recorded yet. Start training on a course!
                    </p>
                  );
                }

                const maxSeconds = Math.max(...list.map(l => l.seconds), 1);

                return (
                  <div className="space-y-3">
                    {list.map(item => {
                      const percent = Math.round((item.seconds / maxSeconds) * 100);
                      const displayTime = (() => {
                        const hrs = Math.floor(item.seconds / 3600);
                        const mins = Math.floor((item.seconds % 3600) / 60);
                        if (hrs > 0) return `${hrs}h ${mins}m`;
                        return `${mins}m`;
                      })();

                      return (
                        <div key={item.id} className="space-y-1.5 p-3.5 bg-gray-50/50 dark:bg-[#18252d]/40 rounded-2xl border border-gray-100/50 dark:border-[#202f36]/40 text-left">
                          <div className="flex gap-4 justify-between items-center text-xs text-gray-800 dark:text-slate-300">
                            <span className="font-extrabold truncate">{item.name}</span>
                            <span className="font-mono font-black text-[var(--theme-primary)] shrink-0">{displayTime}</span>
                          </div>
                          
                          <div className="w-full bg-gray-100 dark:bg-[#202f36] rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-[var(--theme-primary)]" 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-[#202f36]" />

            {/* Attendance Calendar block */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left">
                <div>
                  <h4 className="flex items-center space-x-2 font-black text-gray-800 dark:text-gray-200 text-sm">
                    <Calendar className="w-5 h-5 text-emerald-500" />
                    <span>Clocked-In Calendar Registry</span>
                  </h4>
                  <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold">
                    Daily check-ins showing active focus sessions over months and years.
                  </p>
                </div>
                <div className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-wider w-fit shrink-0">
                  Checked In: {uniqueClockedInDays.length} {uniqueClockedInDays.length === 1 ? 'Day' : 'Days'}
                </div>
              </div>

              {monthlyCalendars.length === 0 ? (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 py-3 text-center font-bold">
                  No focus sessions logged over any year or month yet. Get to study classes to paint your custom calendar!
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {monthlyCalendars.map((cal) => {
                    const days = getDaysInMonthArray(cal.year, cal.month);
                    const weekdaysAbbr = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

                    return (
                      <div key={cal.key} className="space-y-3 p-4 bg-gray-50/50 dark:bg-[#18252d]/40 rounded-2xl border border-gray-100/50 dark:border-[#202f36]/40 text-left">
                        {/* Calendar month/year header */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-neutral-700 dark:text-slate-200 tracking-tight">
                            {cal.monthName} {cal.year}
                          </span>
                          <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                            {cal.activeDates.size} days active
                          </span>
                        </div>

                        {/* Week days layout */}
                        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] font-black text-neutral-400 dark:text-slate-500 select-none pb-1.5 border-b border-neutral-100/35 dark:border-neutral-850/15">
                          {weekdaysAbbr.map((d, i) => (
                            <div key={i}>{d}</div>
                          ))}
                        </div>

                        {/* Calendar grid cells */}
                        <div className="grid grid-cols-7 gap-1.5">
                          {days.map((day, idx) => {
                            if (!day) return <div key={idx} className="aspect-square bg-transparent rounded-lg" />;

                            const isActive = cal.activeDates.has(day.dateStr);
                            const details = historyByDate[day.dateStr] || [];
                            const totalSecsOnDay = details.reduce((acc, current) => acc + (current.focusSeconds || 0), 0);
                            const totalHrs = Math.floor(totalSecsOnDay / 3600);
                            const totalMins = Math.floor((totalSecsOnDay % 3600) / 60);
                            const displayDuration = totalHrs > 0 ? `${totalHrs}h ${totalMins}m` : `${totalMins}m`;
                            const xpOnDay = details.reduce((acc, current) => acc + (current.xpEarned || 0), 0);

                            return (
                              <div 
                                key={idx} 
                                className="relative group aspect-square flex flex-col items-center justify-center"
                              >
                                {/* Circle Day */}
                                <div 
                                  className={`w-full h-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-black font-mono transition-all border ${
                                    isActive 
                                      ? 'bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/85 text-white shadow-sm border-[var(--theme-primary)] scale-105 cursor-pointer' 
                                      : 'bg-white dark:bg-[#131f24] hover:bg-neutral-100 dark:hover:bg-[#18252d] text-neutral-500 dark:text-neutral-350 border-neutral-200/55 dark:border-[#202f36]/40'
                                  }`}
                                >
                                  {day.dayNum}
                                </div>

                                {/* Custom HTML Tooltip container */}
                                <div className="absolute bottom-[115%] hidden group-hover:flex flex-col bg-neutral-900 text-white rounded-lg p-2.5 shadow-xl text-[9px] font-sans border border-neutral-750/50 w-40 z-50 pointer-events-none transition-all leading-relaxed left-1/2 -translate-x-1/2">
                                  <div className="font-extrabold pb-1 border-b border-neutral-800 text-slate-100 uppercase tracking-widest flex items-center justify-between">
                                    <span>{day.dateStr}</span>
                                    {isActive && <span className="text-emerald-400 font-extrabold text-[8px]">CLOCKED IN</span>}
                                  </div>
                                  {isActive ? (
                                    <div className="space-y-1 mt-1 text-left">
                                      <p className="text-neutral-300 font-extrabold truncate">Lessons: {details.length}</p>
                                      <p className="text-neutral-400 font-bold">Focus: <span className="font-mono text-amber-400">{displayDuration}</span></p>
                                      <p className="text-neutral-400 font-bold">Earned: <span className="font-mono text-emerald-400">+{xpOnDay} XP</span></p>
                                    </div>
                                  ) : (
                                    <p className="text-neutral-400 mt-1 italic font-bold">No logs for this date.</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Setting Option Card - App Theme */}
          <div className="bg-white dark:bg-[#131f24] border border-neutral-250/60 dark:border-[#202f36] rounded-2xl p-5 shadow-xs space-y-5">
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">Workspace Appearance</h3>
                <p className="text-[10px] text-neutral-400 dark:text-[#a0aab8] font-semibold max-w-sm">
                  Toggle reading contrast themes for focus comfort.
                </p>
              </div>

              {/* Aesthetic Isometric Selector Buttons */}
              <div className="flex items-center bg-neutral-150/80 dark:bg-[#18252d]/80 p-1 rounded-xl border border-neutral-250/40 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center space-x-1.5 py-1.5 px-3 rounded-lg font-bold text-[10px] tracking-wide transition-all cursor-pointer select-none uppercase shrink-0
                    ${theme === 'light'
                      ? 'bg-white text-neutral-800 shadow-xs border border-neutral-100'
                      : 'text-neutral-450 dark:text-slate-400 hover:text-neutral-750 dark:hover:text-slate-200'
                    }`}
                  id="settings-theme-light-btn"
                >
                <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-100" />
                <span>LIGHT</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center space-x-1.5 py-1.5 px-3 rounded-lg font-bold text-[10px] tracking-wide transition-all cursor-pointer select-none uppercase shrink-0
                  ${theme === 'dark'
                    ? 'bg-[#202f36] text-white shadow-xs border border-[#131f24]'
                    : 'text-neutral-450 dark:text-slate-400 hover:text-neutral-750 dark:hover:text-slate-200'
                  }`}
                id="settings-theme-dark-btn"
              >
                <Moon className="w-3.5 h-3.5 text-sky-400 fill-sky-950" />
                <span>DARK</span>
              </button>
            </div>
          </div>
          
          <div className="border-t border-neutral-150 dark:border-neutral-800" />

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">Theme Highlight Accent</h3>
              <p className="text-[10px] text-neutral-450 dark:text-slate-400 font-semibold max-w-sm">
                Personalize progress meters and active dashboard elements.
              </p>
            </div>
            
            <div className="flex flex-col items-start sm:items-end gap-1.5 animate-fadeIn">
              <div className="flex items-center gap-1.5">
                {(['blue', 'pink', 'green', 'orange'] as const).map(c => {
                  const colors = {
                      blue: { bg: 'bg-[#1CB0F6]', hex: '#1CB0F6', name: 'Electric Blue' },
                      pink: { bg: 'bg-[#FF4B8B]', hex: '#FF4B8B', name: 'Spicy Pink' },
                      green: { bg: 'bg-[#2B7A0B]', hex: '#2B7A0B', name: 'Forest Green' },
                      orange: { bg: 'bg-[#FF9600]', hex: '#FF9600', name: 'Sandy Orange' },
                  };
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorTheme(c)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 
                        ${colorTheme === c ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#131f24] ring-gray-400 dark:ring-gray-600 scale-105' : 'hover:scale-105 opacity-85'} 
                        ${colors[c].bg}`}
                      title={colors[c].name}
                    >
                      {colorTheme === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  );
                })}
              </div>
              <span className="text-[9.5px] font-black text-[var(--theme-primary)] uppercase tracking-widest mt-0.5">
                {colorTheme === 'blue' ? 'Electric Blue' :
                 colorTheme === 'pink' ? 'Spicy Pink' :
                 colorTheme === 'green' ? 'Forest Green' : 'Sandy Orange'} Highlight
              </span>
            </div>
          </div>

        </div>

        {/* Cloud Sync Option Card */}
        {user && (
          <div className="bg-white dark:bg-[#131f24] border border-neutral-250/60 dark:border-[#202f36] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">Cloud Synchronization</h3>
                <p className="text-[10px] text-neutral-450 dark:text-slate-400 font-semibold max-w-sm">
                  Keep backups active to sync customized curriculum states cleanly over multiple client instances.
                </p>
              </div>

              <div className="flex items-center bg-neutral-100 dark:bg-[#18252d] p-1 rounded-xl border border-neutral-250/30 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => onToggleCloudSync(false)}
                  className={`flex items-center space-x-1.5 py-1.5 px-3 rounded-lg font-bold text-[10px] tracking-wide transition-all cursor-pointer select-none uppercase
                    ${!cloudSyncEnabled
                      ? 'bg-white text-neutral-800 dark:bg-[#202f36] dark:text-white shadow-xs border border-neutral-200 dark:border-[#131f24]'
                      : 'text-neutral-450 dark:text-slate-400 hover:text-neutral-750'
                    }`}
                  id="settings-sync-off-btn"
                >
                  <span>OFF</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleCloudSync(true)}
                  className={`flex items-center space-x-1.5 py-1.5 px-3 rounded-lg font-bold text-[10px] tracking-wide transition-all cursor-pointer select-none uppercase
                    ${cloudSyncEnabled
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-neutral-450 dark:text-slate-400 hover:text-neutral-750'
                    }`}
                  id="settings-sync-on-btn"
                >
                  <Check className="w-3 h-3 text-white" />
                  <span>ON</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone Option Card */}
        {user && (
          <div className="bg-red-50/10 dark:bg-red-950/5 border border-red-200/50 dark:border-red-950/30 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-1.5 text-red-500">
                  <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                  <h3 className="font-bold text-sm">Danger Zone</h3>
                </div>
                <p className="text-[10px] text-neutral-450 dark:text-slate-450 font-semibold max-w-sm">
                  Permanently delete account information, cloud states, and study logs. This action is irreversible.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDeleteClick}
                className={`py-2 px-4 rounded-lg font-bold text-[10px] tracking-wider transition-all cursor-pointer select-none uppercase shadow-xs flex items-center space-x-1 px-3 border
                  ${showConfirmDelete
                    ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white animate-pulse'
                    : 'bg-transparent border-red-200 dark:border-red-950 text-red-500 hover:bg-red-500 hover:text-white'
                  }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{showConfirmDelete ? 'SURE? CLICK AGAIN' : 'DELETE ACCOUNT'}</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Cropper Modal */}
      {imageToCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#131f24] rounded-3xl p-6 w-full max-w-md shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-lg text-gray-800 dark:text-gray-200">Crop Avatar</h3>
              <button onClick={() => setImageToCrop(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-[#202f36] rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-bold">Recommended size: 256x256 max (Image will be heavily compressed to fit storage limit)</p>
            <div className="relative w-full h-[300px] bg-gray-100 dark:bg-black rounded-2xl overflow-hidden mb-6">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex gap-3 justify-end items-center">
               <button onClick={() => setImageToCrop(null)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 uppercase cursor-pointer">Cancel</button>
               <button onClick={handleCropSave} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--theme-primary)] text-white rounded-xl text-xs font-black hover:bg-[var(--theme-secondary)] transition-colors uppercase cursor-pointer"><Crop className="w-4 h-4"/> Crop & Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fadeIn" onClick={() => setViewingPhoto(null)}>
          <div className="relative max-w-2xl max-h-screen">
            <button
              onClick={() => setViewingPhoto(null)}
              className="absolute -top-4 -right-4 md:-top-6 md:-right-6 p-2 bg-white dark:bg-[#202f36] text-black dark:text-white rounded-full shadow-lg hover:bg-gray-200 dark:hover:bg-[#35454e] transition-colors cursor-pointer z-[70]"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={viewingPhoto} 
              alt="Profile Full Size" 
              className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl object-contain bg-white dark:bg-[#131f24]" 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
