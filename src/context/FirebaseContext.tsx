import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateEmail, updatePassword, updateProfile, sendPasswordResetEmail, deleteUser, getAdditionalUserInfo } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, deleteDoc, getDocs, collection, getCountFromServer } from 'firebase/firestore';
import { testConnection } from '../lib/firestoreUtils';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateUserEmail: (newEmail: string) => Promise<void>;
  updateUserPassword: (newPass: string) => Promise<void>;
  updateUserProfile: (displayName: string | null, photoURL: string | null) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Connection testing on startup
  useEffect(() => {
    testConnection();
  }, []);

  // Listen for Authentication Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        setDoc(doc(db, 'users_profiles', currentUser.uid), {
          uid: currentUser.uid,
          displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Learner',
          photoURL: currentUser.photoURL || ''
        }, { merge: true }).catch(err => console.error("Error syncing profile on auth state change:", err));
      }
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = React.useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const details = getAdditionalUserInfo(result);
      if (details?.isNewUser) {
        const profilesCol = collection(db, 'users_profiles');
        const snapshot = await getCountFromServer(profilesCol);
        // It might count the currently signed in user if the onAuthStateChanged fired, but let's be safe
        if (snapshot.data().count > 50) { // Using > 50 because this new user's profile might have just been created by onAuthStateChanged concurrently
          // Limit reached!
          if (auth.currentUser) {
            await auth.currentUser.delete();
          }
          await signOut(auth);
          throw new Error("Maximum user limit of 50 reached.");
        }
      }
    } catch (err) {
      console.error("OAuth Login Pop-up Error: ", err);
      throw err;
    }
  }, []);

  const loginWithEmail = React.useCallback(async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  }, []);

  const registerWithEmail = React.useCallback(async (email: string, pass: string) => {
    // Check user limit
    const profilesCol = collection(db, 'users_profiles');
    const snapshot = await getCountFromServer(profilesCol);
    if (snapshot.data().count >= 50) {
      throw new Error("Maximum user limit of 50 reached.");
    }
    
    await createUserWithEmailAndPassword(auth, email, pass);
  }, []);

  const deleteAccount = React.useCallback(async () => {
    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      
      // Delete user data
      await deleteDoc(doc(db, 'users_profiles', uid));
      await deleteDoc(doc(db, 'users', uid)); // This only deletes the main user doc, but we should also delete courses if cascading is not possible
      
      // Delete Firebase Auth user
      await deleteUser(auth.currentUser);
    }
  }, []);

  const resetPassword = React.useCallback(async (email: string) => {
    const actionCodeSettings = {
      url: `${window.location.origin}/?mode=resetPassword`,
      handleCodeInApp: false
    };
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
  }, []);

  const updateUserEmail = React.useCallback(async (newEmail: string) => {
    if (auth.currentUser) {
      await updateEmail(auth.currentUser, newEmail);
      setUser({ ...auth.currentUser });
    }
  }, []);

  const updateUserPassword = React.useCallback(async (newPass: string) => {
    if (auth.currentUser) {
      await updatePassword(auth.currentUser, newPass);
    }
  }, []);

  const updateUserProfile = React.useCallback(async (displayName: string | null, photoURL: string | null) => {
    if (auth.currentUser) {
      const updates: any = {};
      if (displayName !== null) updates.displayName = displayName;
      if (photoURL !== null) updates.photoURL = photoURL;
      
      if (Object.keys(updates).length > 0) {
          await updateProfile(auth.currentUser, updates);
          
          try {
            await setDoc(doc(db, 'users_profiles', auth.currentUser.uid), {
              uid: auth.currentUser.uid,
              displayName: auth.currentUser.displayName || 'Learner',
              photoURL: auth.currentUser.photoURL || ''
            }, { merge: true });
          } catch (e) {
            console.error("Error setting users_profiles on update:", e);
          }

          // Force a state update to trigger re-renders
          setUser({ ...auth.currentUser });
      }
    }
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign-out Error: ", err);
    }
  }, []);

  const value = React.useMemo(() => ({ 
    user, 
    loading, 
    loginWithGoogle, 
    loginWithEmail, 
    registerWithEmail,
    deleteAccount,
    updateUserEmail, 
    updateUserPassword, 
    updateUserProfile, 
    resetPassword,
    logout 
  }), [user, loading, loginWithGoogle, loginWithEmail, registerWithEmail, deleteAccount, updateUserEmail, updateUserPassword, updateUserProfile, resetPassword, logout]);

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used inside a FirebaseProvider');
  }
  return context;
}
