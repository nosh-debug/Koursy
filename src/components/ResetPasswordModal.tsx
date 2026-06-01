import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../lib/firebase';
import TestLogo from './TestLogo';

interface ResetPasswordModalProps {
  oobCode: string;
  onClose: () => void;
}

export default function ResetPasswordModal({ oobCode, onClose }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Verify the password reset code is valid
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setIsValidToken(true);
        setUserEmail(email);
      })
      .catch((e) => {
        setIsValidToken(false);
        setError("The reset code is invalid or has expired.");
      });
  }, [oobCode]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        // Clear the URL params
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-[#F7F7F7] dark:bg-[#0c141a] transition-colors font-sans w-full">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white dark:bg-[#131f24] rounded-[32px] max-w-md w-full p-8 border-2 border-gray-100 dark:border-[#202f36] shadow-2xl overflow-hidden relative"
        >
          <div className="text-center mb-8 flex flex-col items-center">
            <TestLogo className="w-12 h-12 mb-4" />
            <h2 className="text-2xl font-black text-gray-800 dark:text-slate-100 tracking-tight uppercase">
              Reset Password
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 font-medium">
              {userEmail ? `Enter a new password for ${userEmail}` : 'Enter your new password below.'}
            </p>
            {error && (
              <div className="mt-4 p-3 w-full flex items-start text-left bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-900/30">
                <span className="flex-1">{error}</span>
              </div>
            )}
            {success && (
              <div className="mt-4 p-3 w-full flex items-center text-left bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm font-bold rounded-xl border border-green-100 dark:border-green-900/30 space-x-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">Password updated successfully! You can now log in.</span>
              </div>
            )}
          </div>

          {isValidToken === null ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isValidToken && !success ? (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password (min. 6 characters)"
                  required
                  disabled={loading}
                  className="w-full pl-11 pr-12 py-3 bg-gray-50 dark:bg-[#18252d] border-2 border-gray-200 dark:border-[#202f36] rounded-2xl focus:border-[var(--theme-primary)] focus:ring-0 transition-colors text-gray-700 dark:text-slate-200 font-medium placeholder-gray-400 disabled:opacity-50"
                  autoComplete="new-password"
                />
                <div 
                  className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] hover:translate-y-[2px] active:translate-y-[4px] active:border-b-transparent disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:translate-y-0 text-white font-black rounded-2xl tracking-widest text-sm transition-all shadow-sm cursor-pointer uppercase flex items-center justify-center space-x-2"
              >
                {!loading && <Save className="w-5 h-5" />}
                <span>{loading ? 'Saving...' : 'Update Password'}</span>
              </button>
            </form>
          ) : !isValidToken ? (
            <div className="text-center">
              <button
                onClick={() => {
                  onClose();
                  window.history.replaceState({}, document.title, window.location.pathname);
                }}
                className="py-3 px-6 bg-gray-100 hover:bg-gray-200 dark:bg-[#18252d] dark:hover:bg-[#202f36] text-gray-700 dark:text-slate-300 font-bold rounded-xl transition-colors cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          ) : null}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
