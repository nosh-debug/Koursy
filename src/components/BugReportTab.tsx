import React, { useState } from 'react';
import { AlertTriangle, Send, CheckCircle } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function BugReportTab() {
  const { user } = useFirebase();
  const [description, setDescription] = useState('');
  const [userEmail, setUserEmail] = useState(user?.email || '');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!description.trim()) return;

    // Limit check: 1 report per day
    const lastDate = localStorage.getItem('lastBugReportDate');
    const today = new Date().toDateString();
    if (lastDate === today) {
      setErrorMessage("You can only report one bug per day.");
      return;
    }

    setStatus('submitting');
    
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('description', description);
    formData.append('userEmail', userEmail);
    if (file) {
      formData.append('footage', file);
    }
    
    try {
      // Send to server
      const response = await fetch('/api/report-bug', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Submission failed');

      // Also save to firestore as requested
      const now = new Date();
      const todayId = `${user.uid}_${now.getUTCFullYear()}_${now.getUTCMonth() + 1}_${now.getUTCDate()}`;

      await setDoc(doc(db, 'bug_reports', todayId), {
        description,
        userEmail,
        timestamp: new Date()
      });

      localStorage.setItem('lastBugReportDate', today);
      setStatus('success');
      setDescription('');
      setUserEmail(user?.email || '');
      setFile(null);
    } catch (err) {
      console.error("Error reporting bug:", err);
      setErrorMessage("Failed to report bug. Please try again later.");
      setStatus('idle');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
        <CheckCircle className="w-16 h-16 text-emerald-500" />
        <h2 className="text-2xl font-black text-neutral-800 dark:text-neutral-100">Bug Reported!</h2>
        <p className="text-neutral-500 dark:text-neutral-400">Thank you for helping us improve!</p>
        <button 
          onClick={() => setStatus('idle')}
          className="mt-4 px-6 py-2 bg-neutral-800 text-white rounded-xl font-bold text-sm hover:bg-neutral-900 transition-colors"
        >
          Report Another
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto h-full w-full relative">
      <div className="max-w-xl mx-auto p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3 text-amber-500">
        <AlertTriangle className="w-8 h-8" />
        <h2 className="text-2xl font-black text-neutral-800 dark:text-neutral-100">Report a Bug</h2>
      </div>
      
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Found something not working correctly? Please describe the issue in detail, and our team will investigate it. You can report one bug per day.
      </p>

      {errorMessage && (
        <div className="p-4 bg-red-100 text-red-700 text-sm rounded-xl border border-red-200">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          placeholder="Your email address"
          className="w-full p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-[var(--theme-primary)] transition-all"
          required
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue here..."
          className="w-full h-40 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-[var(--theme-primary)] transition-all resize-none"
          required
        />
        <input
          type="file"
          onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
          className="w-full text-sm text-neutral-600 dark:text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[var(--theme-primary)] file:text-white"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] text-white rounded-xl font-black text-sm tracking-wide uppercase transition-all shadow-sm active:translate-y-[1px]"
        >
          {status === 'submitting' ? 'Submitting...' : <><Send className="w-4 h-4" /> Submit Report</>}
        </button>
      </form>
      </div>
    </div>
  );
}
