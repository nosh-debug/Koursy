import { supabase } from './supabase';

// ==========================================
// FIREBASE AUTHENTICATION MOCK (via Supabase)
// ==========================================

export type User = any;
export class GoogleAuthProvider {
  providerId = 'google.com';
  setCustomParameters(params: any) {}
}

export const auth = {
  currentUser: null as any,
};

export const onAuthStateChanged = (authInstance: any, callback: (user: any) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user;
    if (user) {
      authInstance.currentUser = {
        uid: user.id,
        email: user.email,
        displayName: user.user_metadata?.displayName || user.email?.split('@')[0],
        photoURL: user.user_metadata?.photoURL || '',
        emailVerified: true,
        isAnonymous: false,
        providerData: [{ providerId: 'google.com', email: user.email }]
      };
    } else {
      authInstance.currentUser = null;
    }
    callback(authInstance.currentUser);
  });
  return () => {
    subscription.unsubscribe();
  };
};

export const signInWithPopup = async (authInstance: any, provider: any) => {
  const { data, error } = await supabase.auth.signInWithOAuth({ 
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return { user: authInstance.currentUser };
};

export const getAdditionalUserInfo = (result: any) => {
  return { isNewUser: false }; // Hard to know reliably with Supabase without checking DB
};

export const signInWithEmailAndPassword = async (authInstance: any, email: string, pass: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;
  return { user: data.user };
};

export const createUserWithEmailAndPassword = async (authInstance: any, email: string, pass: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password: pass });
  if (error) throw error;
  return { user: data.user };
};

export const signOut = async (authInstance: any) => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const updateEmail = async (user: any, newEmail: string) => {
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
};

export const updatePassword = async (user: any, newPass: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPass });
  if (error) throw error;
};

export const updateProfile = async (user: any, profile: { displayName?: string, photoURL?: string }) => {
  const { error } = await supabase.auth.updateUser({ data: profile });
  if (error) throw error;
  if (profile.displayName) user.displayName = profile.displayName;
  if (profile.photoURL) user.photoURL = profile.photoURL;
};

export const sendPasswordResetEmail = async (authInstance: any, email: string, actionCodeSettings?: any) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?mode=resetPassword`,
  });
  if (error) throw error;
};

export const confirmPasswordReset = async (authInstance: any, code: string, newPass: string) => {
  // In Supabase, the user should be logged in via the link automatically, then calls updatePassword
  const { error } = await supabase.auth.updateUser({ password: newPass });
  if (error) throw error;
};

export const verifyPasswordResetCode = async (authInstance: any, code: string) => {
  return "user@example.com"; // Mock
};

export const deleteUser = async (user: any) => {
  // Need server role key to actually delete a Supabase user, OR just sign out and ignore
  await supabase.auth.signOut();
};


// ==========================================
// FIRESTORE MOCK
// ==========================================

export const db = 'SUPABASE_DB_MOCK';

export const doc = (dbInstance: any, ...paths: string[]) => {
  let table = paths[0];
  let id = paths[1] || 'default_id';
  if (paths.length === 3) {
      if (paths[0] === 'shared_courses' && paths[2] === 'votes') { table = 'shared_courses_votes'; id = paths[1]; }
  } else if (paths.length === 4) {
    if (paths[0] === 'users' && paths[2] === 'courses') { table = 'user_courses'; id = paths[3]; }
    if (paths[0] === 'users' && paths[2] === 'footages') { table = 'user_footages'; id = paths[3]; }
    if (paths[0] === 'users' && paths[2] === 'navigation') { table = 'user_navigation'; id = paths[3]; }
    if (paths[0] === 'shared_courses' && paths[2] === 'votes') { table = 'shared_courses_votes'; id = paths[3]; }
  } else if (paths.length === 5) {
      // Actually shared_courses/courseId/votes/userId
      if (paths[0] === 'shared_courses' && paths[2] === 'votes') { table = 'shared_courses_votes'; id = `${paths[1]}_${paths[4]}`; }
  }
  return { type: 'doc', table, id, paths };
};

export const collection = (dbInstance: any, ...paths: string[]) => {
  let table = paths[0];
  if (paths.length === 3) {
    if (paths[0] === 'users' && paths[2] === 'courses') table = 'user_courses';
    if (paths[0] === 'users' && paths[2] === 'footages') table = 'user_footages';
    if (paths[0] === 'users' && paths[2] === 'navigation') table = 'user_navigation';
    if (paths[0] === 'shared_courses' && paths[2] === 'votes') table = 'shared_courses_votes';
  }
  return { type: 'collection', table, paths };
};

export const collectionGroup = (dbInstance: any, groupId: string) => {
  return { type: 'collection', table: groupId, paths: [groupId] };
};

export const setDoc = async (docRef: any, data: any, options?: any) => {
  const payload = { id: docRef.id, data: data };
  // If we merge, we might need to fetch first in Postgres if we use JSONB, but Supabase UPSERT doesn't deep merge JSONB by default. For simplicity, we just save.
  const { error } = await supabase.from(docRef.table).upsert(payload);
  if (error) console.error("setDoc Error:", error);
};

export const getDoc = async (docRef: any) => {
  const { data, error } = await supabase.from(docRef.table).select('*').eq('id', docRef.id).single();
  if (error || !data) return { exists: () => false, data: () => null, id: docRef.id };
  return { exists: () => true, data: () => data.data, id: docRef.id };
};

export const getDocFromServer = getDoc;

export const deleteDoc = async (docRef: any) => {
  const { error } = await supabase.from(docRef.table).delete().eq('id', docRef.id);
  if (error) console.error("deleteDoc Error:", error);
};

export const query = (colRef: any, ...constraints: any[]) => {
  return { ...colRef, constraints };
};

export const where = (fieldPath: string, opStr: string, value: any) => {
  return { type: 'where', fieldPath, opStr, value };
};

export const orderBy = (fieldPath: string, directionStr: string = 'asc') => {
  return { type: 'orderBy', fieldPath, directionStr };
};

export const limit = (limitAmount: number) => {
  return { type: 'limit', limitAmount };
};

export const getDocs = async (queryRef: any) => {
  let query = supabase.from(queryRef.table).select('*');
  if (queryRef.constraints) {
    for (const c of queryRef.constraints) {
      if (c.type === 'where') {
        const path = c.fieldPath.includes('.') ? c.fieldPath.split('.').join('->>') : c.fieldPath;
        // In our schema, everything is inside 'data' jsonb except id.
        const pgField = path === 'id' ? 'id' : `data->>${path}`;
        if (c.opStr === '==') query = query.eq(pgField, c.value);
        if (c.opStr === '>') query = query.gt(pgField, c.value);
        if (c.opStr === '<') query = query.lt(pgField, c.value);
        if (c.opStr === '>=') query = query.gte(pgField, c.value);
        if (c.opStr === '<=') query = query.lte(pgField, c.value);
        if (c.opStr === 'array-contains') query = query.contains('data', JSON.stringify({ [path]: [c.value] }));
      } else if (c.type === 'orderBy') {
         query = query.order(c.fieldPath === 'id' ? 'id' : 'data', { ascending: c.directionStr === 'asc' });
      } else if (c.type === 'limit') {
         query = query.limit(c.limitAmount);
      }
    }
  }
  const { data, error } = await query;
  if (error) { console.error("getDocs Error:", error); return { docs: [], forEach: () => {} }; }
  
  const docs = (data || []).map((row: any) => ({
    id: row.id,
    ref: { table: queryRef.table, id: row.id },
    data: () => row.data,
    exists: () => true
  }));
  return {
    docs,
    forEach: (cb: any) => docs.forEach(cb)
  };
};

export const getCountFromServer = async (queryRef: any) => {
  let query = supabase.from(queryRef.table).select('*', { count: 'exact', head: true });
  // apply constraints like above if needed, but not heavily used here
  const { count, error } = await query;
  if (error) console.error("getCount Error:", error);
  return { data: () => ({ count: count || 0 }) };
};

export const onSnapshot = (queryRef: any, callback: (snap: any) => void, errorCallback?: (error: any) => void) => {
  // Initial fetch
  getDocs(queryRef).then(callback).catch(err => {
    if (errorCallback) errorCallback(err);
  });

  // Set up realtime channel
  const channel = supabase.channel(`public:${queryRef.table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: queryRef.table }, payload => {
      // Very naive: re-fetch everything and trigger callback when something changes
      getDocs(queryRef).then(callback).catch(err => {
        if (errorCallback) errorCallback(err);
      });
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};


// ==========================================
// FIREBASE STORAGE MOCK
// ==========================================
export const storage = 'SUPABASE_STORAGE_MOCK';

export const ref = (storageInstance: any, path: string) => {
  return { path };
};

export const uploadString = async (storageRef: any, dataString: string, format: string) => {
  // assumes base64 data url
  const base64Data = dataString.split(',')[1];
  if (!base64Data) return;
  const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const { error } = await supabase.storage.from('footages').upload(storageRef.path, buffer, { upsert: true });
  if (error) console.error("Storage uploadString Error:", error);
};

export const getDownloadURL = async (storageRef: any) => {
  const { data } = supabase.storage.from('footages').getPublicUrl(storageRef.path);
  return data.publicUrl;
};

export const listAll = async (storageRef: any) => {
  const path = storageRef.path.endsWith('/') ? storageRef.path : storageRef.path + '/';
  const { data, error } = await supabase.storage.from('footages').list(path);
  if (error) console.error("Storage listAll Error:", error);
  const items = (data || []).map((file: any) => ({
    path: `${path}${file.name}`
  }));
  return { items };
};

export const deleteObject = async (storageRef: any) => {
  const { error } = await supabase.storage.from('footages').remove([storageRef.path]);
  if (error) console.error("Storage deleteObject Error:", error);
};
