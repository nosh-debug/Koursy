import { doc, setDoc, getDoc, getDocFromServer, collection, getDocs, deleteDoc, query, where, collectionGroup } from 'firebase/firestore';
import { db, auth, storage } from './firebase';
import { ref, uploadString, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { Course, UserStats } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: Test connection under test connection doc on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// Load current user stats from Firestore or fall back
export async function fetchUserStatsFromDb(userId: string): Promise<UserStats | null> {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserStats;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null; // unreachable due to throw
  }
}

// Save user stats
export async function saveUserStatsToDb(userId: string, stats: UserStats): Promise<void> {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, stats);

    // Sync state properties into users_profiles so they can be read dynamically on a global leaderboard
    await setDoc(doc(db, 'users_profiles', userId), {
      xp: stats.xp || 0,
      level: stats.level || 1,
      streak: stats.streak || 0,
      totalFocusSeconds: stats.totalFocusSeconds || 0,
      subscription: stats.subscription || 'free'
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Load courses from Firestore
export async function fetchUserCoursesFromDb(userId: string): Promise<Course[]> {
  const path = `users/${userId}/courses`;
  try {
    const colRef = collection(db, 'users', userId, 'courses');
    const querySnapshot = await getDocs(colRef);
    const loadedList: Course[] = [];
    querySnapshot.forEach((docSnap) => {
      loadedList.push(docSnap.data() as Course);
    });
    return loadedList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return []; // unreachable due to throw
  }
}

// Save a single course
export async function saveCourseToDb(userId: string, course: Course): Promise<void> {
  const path = `users/${userId}/courses/${course.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'courses', course.id);
    await setDoc(docRef, course);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Bulk sync courses to DB
export async function bulkSyncCoursesToDb(userId: string, courses: Course[]): Promise<void> {
  const path = `users/${userId}/courses`;
  try {
    for (const c of courses) {
      const docRef = doc(db, 'users', userId, 'courses', c.id);
      await setDoc(docRef, c);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Delete course from DB
export async function deleteCourseFromDb(userId: string, courseId: string): Promise<void> {
  const path = `users/${userId}/courses/${courseId}`;
  try {
    const docRef = doc(db, 'users', userId, 'courses', courseId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Delete all user data and then delete the auth account
export async function deleteUserAccountAndData(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    // 1. Delete users collection subcollections (courses, footages, navigation)
    const subcollections = ['courses', 'footages', 'navigation'];
    for (const sub of subcollections) {
      const colRef = collection(db, 'users', userId, sub);
      const querySnapshot = await getDocs(colRef);
      for (const docSnap of querySnapshot.docs) {
        await deleteDoc(docSnap.ref);
      }
    }
    
    // 2. Delete public courses and their votes
    const sharedCoursesCol = collection(db, 'shared_courses');
    const qShared = query(sharedCoursesCol, where('creatorId', '==', userId));
    const sharedSnapshot = await getDocs(qShared);
    for (const docSnap of sharedSnapshot.docs) {
      // Best effort to clear votes on this course before deleting
      try {
        const votesCol = collection(db, 'shared_courses', docSnap.id, 'votes');
        const votesSnap = await getDocs(votesCol);
        for (const voteSnap of votesSnap.docs) {
          await deleteDoc(voteSnap.ref);
        }
      } catch (e) {
        console.warn("Could not retrieve votes for course", docSnap.id, e);
      }
      await deleteDoc(docSnap.ref);
    }

    // 3. Delete user's votes on other shared_courses
    // We fetch all shared courses where they might have voted, since we don't have indexes for collectionGroup
    // which requires manual setup in Firebase Console. Doing a broad loop is safer client side.
    const allCoursesSnap = await getDocs(sharedCoursesCol);
    for (const courseDocSnap of allCoursesSnap.docs) {
      const voteDocRef = doc(db, 'shared_courses', courseDocSnap.id, 'votes', userId);
      try {
        await deleteDoc(voteDocRef); // Best effort, deleteDoc on non-existent doc is a no-op
      } catch (e) {}
    }

    // 4. Delete follows
    const followsCol = collection(db, 'follows');
    const allFollowsSnap = await getDocs(followsCol);
    for (const followSnap of allFollowsSnap.docs) {
      const data = followSnap.data();
      if (data.followerId === userId || data.followedId === userId) {
        await deleteDoc(followSnap.ref);
      }
    }

    // 5. Delete bug reports by this user
    const bugReportsCol = collection(db, 'bug_reports');
    const allBugsSnap = await getDocs(bugReportsCol);
    for (const bugSnap of allBugsSnap.docs) {
      if (bugSnap.id.startsWith(`${userId}_`)) {
        await deleteDoc(bugSnap.ref);
      }
    }

    // 6. Delete top-level profile and achievements
    const profileRef = doc(db, 'users_profiles', userId);
    await deleteDoc(profileRef);
    
    const achievementsRef = doc(db, 'users_achievements', userId);
    await deleteDoc(achievementsRef);
    
    // 7. Delete Firebase Storage files (footages)
    try {
      const storageFolderRef = ref(storage, `users/${userId}/footages`);
      const res = await listAll(storageFolderRef);
      for (const itemRef of res.items) {
        await deleteObject(itemRef);
      }
    } catch (e) {
      console.warn("Storage deletion error or folder not found:", e);
    }
    
    // 8. Finally delete the main user doc
    const docRef = doc(db, 'users', userId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Critical footage sync to Firebase (Now via Firebase Cloud Storage for massive files)
export async function saveFootageToDb(userId: string, footageId: string, urlStr: string): Promise<void> {
  try {
    // If it's a data URL, upload to Firebase Storage
    if (urlStr.startsWith('data:')) {
      const storageRef = ref(storage, `users/${userId}/footages/${footageId}`);
      await uploadString(storageRef, urlStr, 'data_url');
      const downloadURL = await getDownloadURL(storageRef);
      
      // Store the resulting download url in firestore metadata
      const docRef = doc(db, 'users', userId, 'footages', footageId);
      await setDoc(docRef, { url: downloadURL, updatedAt: new Date().toISOString() });
    } else {
      // If it's not a data URL (e.g. an existing download url), we just preserve its metadata
      const docRef = doc(db, 'users', userId, 'footages', footageId);
      await setDoc(docRef, { url: urlStr, updatedAt: new Date().toISOString() });
    }
  } catch (error: any) {
    console.error("Footage Firebase Storage sync error:", error);
  }
}

export async function fetchFootageFromDb(userId: string, footageId: string): Promise<string | null> {
  try {
    const docRef = doc(db, 'users', userId, 'footages', footageId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().url || null;
    }
    return null;
  } catch (error) {
    console.error("Footage DB fetch error:", error);
    return null;
  }
}
