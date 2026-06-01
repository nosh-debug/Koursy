import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogIn, Mail, Lock, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  preventClose?: boolean;
}

export default function AuthModal({ isOpen, onClose, preventClose = false }: AuthModalProps) {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword } = useFirebase();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetMessage('');
    try {
      if (isForgotPassword) {
        if (!email) {
          setError('Please enter your email to reset password.');
          return;
        }
        await resetPassword(email);
        setResetMessage('Password reset link sent to your email.');
      } else if (isLogin) {
        await loginWithEmail(email, password);
        localStorage.setItem('password_length', password.length.toString());
        onClose();
      } else {
        await registerWithEmail(email, password);
        localStorage.setItem('password_length', password.length.toString());
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-white dark:bg-[#131f24] rounded-[32px] max-w-md w-full p-8 border-2 border-gray-100 dark:border-[#202f36] shadow-2xl overflow-hidden relative"
          >
            {!preventClose && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors bg-gray-50 dark:bg-[#18252d] rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-gray-800 dark:text-slate-100 tracking-tight uppercase">
                {isForgotPassword ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Create Account')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 font-medium">
                {isForgotPassword ? 'Enter your email to receive a reset link' : (isLogin ? 'Sign in to sync your progress' : 'Join to start learning')}
              </p>
              {error && (
                <div className="mt-4 p-3 flex items-start text-left bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-900/30">
                  <span className="flex-1">{error}</span>
                </div>
              )}
              {resetMessage && (
                <div className="mt-4 p-3 flex items-start text-left bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-bold rounded-xl border border-green-100 dark:border-green-900/30">
                  <span className="flex-1">{resetMessage}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-[#18252d] border-2 border-gray-200 dark:border-[#202f36] rounded-2xl focus:border-[var(--theme-primary)] focus:ring-0 transition-colors text-gray-700 dark:text-slate-200 font-medium placeholder-gray-400"
                  />
                </div>

                {!isForgotPassword && (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      className="w-full pl-11 pr-12 py-3 bg-gray-50 dark:bg-[#18252d] border-2 border-gray-200 dark:border-[#202f36] rounded-2xl focus:border-[var(--theme-primary)] focus:ring-0 transition-colors text-gray-700 dark:text-slate-200 font-medium placeholder-gray-400"
                    />
                    <div 
                      className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </div>
                  </div>
                )}
                
                {isLogin && !isForgotPassword && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setError(null); setResetMessage(''); }}
                      className="text-xs font-bold text-[var(--theme-primary)] hover:text-[var(--theme-secondary)] transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[var(--theme-primary)] border-b-4 border-[var(--theme-secondary)] hover:translate-y-[2px] active:translate-y-[4px] active:border-b-transparent text-white font-black rounded-2xl tracking-widest text-sm transition-all shadow-sm cursor-pointer uppercase flex items-center justify-center space-x-2"
              >
                {isForgotPassword ? <Mail className="w-5 h-5" /> : (isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />)}
                <span>{isForgotPassword ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Sign Up')}</span>
              </button>
            </form>

            {!isForgotPassword && (
              <>
                <div className="mt-6 flex items-center justify-center space-x-4">
                  <div className="h-px bg-gray-200 dark:bg-[#202f36] flex-1"></div>
                  <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">OR</span>
                  <div className="h-px bg-gray-200 dark:bg-[#202f36] flex-1"></div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleGoogleLogin}
                    type="button"
                    className="w-full py-3.5 bg-white dark:bg-[#18252d] border-2 border-gray-200 dark:border-[#202f36] hover:bg-gray-50 dark:hover:bg-[#202f36] text-gray-700 dark:text-slate-200 font-black rounded-2xl tracking-widest text-sm transition-all shadow-sm cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>
              </>
            )}

            <div className="mt-6 text-center">
              {isForgotPassword ? (
                <button
                  onClick={() => { setIsForgotPassword(false); setIsLogin(true); setError(null); setResetMessage(''); }}
                  className="text-xs font-bold text-[var(--theme-primary)] hover:text-[var(--theme-secondary)] transition-colors cursor-pointer"
                >
                  Back to Sign in
                </button>
              ) : (
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-xs font-bold text-[var(--theme-primary)] hover:text-[var(--theme-secondary)] transition-colors cursor-pointer"
                >
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
