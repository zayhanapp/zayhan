import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

// Google Drive scope
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope(DRIVE_SCOPE);

const DRIVE_TOKEN_KEY = 'lumina_drive_token';

// Cache token in memory and sessionStorage
let cachedAccessToken: string | null = null;
try {
  cachedAccessToken = sessionStorage.getItem(DRIVE_TOKEN_KEY);
} catch (e) {}

let isSigningIn = false;

// Remove any undefined keys to prevent Firestore crashes
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// Error logger that does not throw fatal exceptions
export function logFirestoreError(operation: string, path: string, err: any) {
  console.warn(`Firestore [${operation}] at ${path}:`, err?.message || err);
}

// Auth State Listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      try {
        sessionStorage.removeItem(DRIVE_TOKEN_KEY);
      } catch (e) {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string | null } | null> => {
  if (isSigningIn) {
    console.warn('Sign-in popup is already active.');
    return null;
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;

    if (cachedAccessToken) {
      try {
        sessionStorage.setItem(DRIVE_TOKEN_KEY, cachedAccessToken);
      } catch (e) {}
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error?.code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      error.unauthorizedDomain = currentHost;
      console.warn(
        `Firebase Auth: Domain "${currentHost}" is not in the Firebase Authorized Domains list. Please add it in Firebase Console > Authentication > Settings > Authorized domains.`
      );
    } else if (
      error?.code !== 'auth/popup-closed-by-user' &&
      error?.code !== 'auth/cancelled-popup-request'
    ) {
      console.warn('Sign in error:', error?.message || error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  if (!cachedAccessToken) {
    try {
      cachedAccessToken = sessionStorage.getItem(DRIVE_TOKEN_KEY);
    } catch (e) {}
  }
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      sessionStorage.setItem(DRIVE_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(DRIVE_TOKEN_KEY);
    }
  } catch (e) {}
};

export const logoutUser = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem(DRIVE_TOKEN_KEY);
  } catch (e) {}
};

// User Profile Models
export interface UserProfileData {
  displayName: string;
  handle?: string;
  email: string;
  photoURL?: string;
  currentStreak: number;
  longestStreak: number;
  lastVisitDate: string;
  createdAt?: string;
  updatedAt?: string;
}

// Fetch user profile from Firestore with offline fallback
export const fetchUserProfile = async (uid: string): Promise<UserProfileData | null> => {
  const userDocRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as UserProfileData;
    }
    return null;
  } catch (err: any) {
    logFirestoreError('getDoc', `users/${uid}`, err);
    return null;
  }
};

// Create or update user profile with merge
export const saveUserProfile = async (
  uid: string,
  data: Partial<UserProfileData>
): Promise<void> => {
  const userDocRef = doc(db, 'users', uid);
  const cleanData = sanitizeForFirestore({
    ...data,
    updatedAt: new Date().toISOString(),
  });

  try {
    await setDoc(userDocRef, cleanData, { merge: true });
  } catch (err: any) {
    logFirestoreError('setDoc', `users/${uid}`, err);
  }
};

// Tasks Cloud Sync
export interface CloudTask {
  id: string;
  userId: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export const syncTasksToCloud = async (uid: string, tasks: CloudTask[]): Promise<void> => {
  try {
    for (const t of tasks) {
      const taskRef = doc(db, 'users', uid, 'tasks', t.id);
      await setDoc(
        taskRef,
        sanitizeForFirestore({
          id: t.id,
          userId: uid,
          text: t.text,
          completed: t.completed,
          createdAt: t.createdAt,
        }),
        { merge: true }
      );
    }
  } catch (err: any) {
    logFirestoreError('syncTasks', `users/${uid}/tasks`, err);
  }
};

export const fetchTasksFromCloud = async (uid: string): Promise<CloudTask[]> => {
  try {
    const tasksCol = collection(db, 'users', uid, 'tasks');
    const snap = await getDocs(tasksCol);
    return snap.docs.map((d) => d.data() as CloudTask);
  } catch (err: any) {
    logFirestoreError('fetchTasks', `users/${uid}/tasks`, err);
    return [];
  }
};

export const deleteCloudTask = async (uid: string, taskId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'users', uid, 'tasks', taskId));
  } catch (err: any) {
    logFirestoreError('deleteTask', `users/${uid}/tasks/${taskId}`, err);
  }
};

// Notes Cloud Sync
export const syncNotesToCloud = async (uid: string, content: string): Promise<number> => {
  const timestamp = Date.now();
  try {
    const noteRef = doc(db, 'users', uid, 'notes', 'scratchpad');
    await setDoc(
      noteRef,
      sanitizeForFirestore({
        userId: uid,
        content,
        updatedAt: timestamp,
      }),
      { merge: true }
    );
    return timestamp;
  } catch (err: any) {
    logFirestoreError('syncNotes', `users/${uid}/notes`, err);
    throw err;
  }
};

export const fetchNotesFromCloud = async (uid: string): Promise<string | null> => {
  try {
    const noteRef = doc(db, 'users', uid, 'notes', 'scratchpad');
    const snap = await getDoc(noteRef);
    if (snap.exists()) {
      return snap.data().content || '';
    }
    return null;
  } catch (err: any) {
    logFirestoreError('fetchNotes', `users/${uid}/notes`, err);
    return null;
  }
};

export const fetchNoteDataFromCloud = async (
  uid: string
): Promise<{ content: string; updatedAt: number } | null> => {
  try {
    const noteRef = doc(db, 'users', uid, 'notes', 'scratchpad');
    const snap = await getDoc(noteRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        content: data.content || '',
        updatedAt: data.updatedAt || Date.now(),
      };
    }
    return null;
  } catch (err: any) {
    logFirestoreError('fetchNotes', `users/${uid}/notes`, err);
    return null;
  }
};

export const checkHandleAvailability = async (
  handle: string,
  excludeUid?: string
): Promise<{ available: boolean; message: string }> => {
  const clean = handle.trim().toLowerCase().replace(/^@/, '');
  if (!clean || clean.length < 3) {
    return { available: false, message: 'User ID must be at least 3 characters' };
  }
  if (!/^[a-z0-9_]+$/.test(clean)) {
    return { available: false, message: 'Use only letters, numbers, and underscores' };
  }
  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('handle', '==', clean));
    const snap = await getDocs(q);
    const taken = snap.docs.some((d) => d.id !== excludeUid);
    if (taken) {
      return { available: false, message: 'User ID is already claimed' };
    }
    return { available: true, message: 'User ID is available' };
  } catch (err) {
    return { available: true, message: 'User ID format valid' };
  }
};

// Materials Cloud Sync
export interface CloudMaterialMeta {
  id: string;
  userId: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;
  connectionString?: string;
  studyNotes: string;
  source: 'local' | 'drive';
  driveFileId?: string | null;
}

export const syncMaterialToCloud = async (uid: string, item: CloudMaterialMeta): Promise<void> => {
  try {
    const matRef = doc(db, 'users', uid, 'materials', item.id);
    const cleanItem = sanitizeForFirestore({
      id: item.id,
      userId: uid,
      filename: item.filename,
      fileSize: item.fileSize,
      uploadedAt: item.uploadedAt,
      studyNotes: item.studyNotes || '',
      source: item.source,
      driveFileId: item.driveFileId || null,
      connectionString: item.connectionString || '',
    });
    await setDoc(matRef, cleanItem, { merge: true });
  } catch (err: any) {
    logFirestoreError('syncMaterial', `users/${uid}/materials/${item.id}`, err);
    throw err;
  }
};

export const fetchMaterialsFromCloud = async (uid: string): Promise<CloudMaterialMeta[]> => {
  try {
    const col = collection(db, 'users', uid, 'materials');
    const snap = await getDocs(col);
    return snap.docs.map((d) => d.data() as CloudMaterialMeta);
  } catch (err: any) {
    logFirestoreError('fetchMaterials', `users/${uid}/materials`, err);
    return [];
  }
};

// Cloud Friendships
export interface SharedDocItem {
  id: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;
  source: 'local' | 'drive';
  sharedBy: string;
  sharedByName: string;
  sharedAt: number;
  driveFileId?: string | null;
  pdfDataUrl?: string;
  studyNotes?: string;
}

export interface CloudMoodLog {
  id: string;
  userId: string;
  authorName: string;
  authorHandle?: string;
  mood: 'Great' | 'Good' | 'Okay' | 'Low' | 'Stressed';
  emoji: string;
  note?: string;
  timestamp: number;
}

export interface CloudFriendship {
  id: string;
  user1Id: string;
  user2Id: string;
  user1Username: string;
  user2Username: string;
  user1Handle?: string;
  user2Handle?: string;
  status: 'pending' | 'accepted' | 'declined';
  senderId: string;
  createdAt: number;
  sharedNote?: string;
  sharedNoteAuthor?: string;
  sharedNoteUpdatedAt?: number;
  sharedDocs?: SharedDocItem[];
  moodLogs?: CloudMoodLog[];
}

export const sendCloudFriendRequest = async (
  currentUser: { uid: string; displayName: string; handle?: string },
  targetUser: { uid: string; displayName: string; handle?: string }
): Promise<void> => {
  const friendshipId = [currentUser.uid, targetUser.uid].sort().join('_');
  const ref = doc(db, 'friends', friendshipId);
  try {
    await setDoc(
      ref,
      sanitizeForFirestore({
        id: friendshipId,
        user1Id: currentUser.uid,
        user2Id: targetUser.uid,
        user1Username: currentUser.displayName,
        user2Username: targetUser.displayName,
        user1Handle: currentUser.handle || '',
        user2Handle: targetUser.handle || '',
        status: 'pending',
        senderId: currentUser.uid,
        createdAt: Date.now(),
      }),
      { merge: true }
    );
  } catch (err: any) {
    logFirestoreError('sendFriendRequest', `friends/${friendshipId}`, err);
  }
};

export const respondToFriendRequest = async (
  friendshipId: string,
  accept: boolean
): Promise<void> => {
  const ref = doc(db, 'friends', friendshipId);
  try {
    if (accept) {
      await setDoc(ref, { status: 'accepted' }, { merge: true });
    } else {
      await deleteDoc(ref);
    }
  } catch (err: any) {
    logFirestoreError('respondFriendRequest', `friends/${friendshipId}`, err);
  }
};

export const fetchCloudFriendships = async (uid: string): Promise<CloudFriendship[]> => {
  try {
    const col = collection(db, 'friends');
    const q1 = query(col, where('user1Id', '==', uid));
    const q2 = query(col, where('user2Id', '==', uid));

    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const map = new Map<string, CloudFriendship>();
    s1.docs.forEach((d) => map.set(d.id, d.data() as CloudFriendship));
    s2.docs.forEach((d) => map.set(d.id, d.data() as CloudFriendship));

    return Array.from(map.values());
  } catch (err: any) {
    logFirestoreError('fetchFriendships', 'friends', err);
    return [];
  }
};

export const subscribeToFriendship = (
  friendshipId: string,
  onUpdate: (f: CloudFriendship) => void
) => {
  const ref = doc(db, 'friends', friendshipId);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as CloudFriendship);
      }
    },
    (err) => {
      logFirestoreError('subscribeFriendship', `friends/${friendshipId}`, err);
    }
  );
};

export const updateSharedNoteOnCloud = async (
  friendshipId: string,
  noteText: string,
  authorName: string
): Promise<void> => {
  const ref = doc(db, 'friends', friendshipId);
  try {
    await setDoc(
      ref,
      sanitizeForFirestore({
        sharedNote: noteText,
        sharedNoteAuthor: authorName,
        sharedNoteUpdatedAt: Date.now(),
      }),
      { merge: true }
    );
  } catch (err: any) {
    logFirestoreError('updateSharedNote', `friends/${friendshipId}`, err);
    throw err;
  }
};

export const shareDocWithFriendOnCloud = async (
  friendshipId: string,
  docItem: SharedDocItem
): Promise<void> => {
  const ref = doc(db, 'friends', friendshipId);
  try {
    const snap = await getDoc(ref);
    const existingDocs: SharedDocItem[] = snap.exists() ? (snap.data().sharedDocs || []) : [];
    const updatedDocs = [docItem, ...existingDocs.filter((d) => d.id !== docItem.id)];
    await setDoc(
      ref,
      sanitizeForFirestore({
        sharedDocs: updatedDocs,
      }),
      { merge: true }
    );
  } catch (err: any) {
    logFirestoreError('shareDocWithFriend', `friends/${friendshipId}`, err);
    throw err;
  }
};

export const addCloudMoodLog = async (
  friendshipId: string,
  entry: CloudMoodLog
): Promise<void> => {
  const ref = doc(db, 'friends', friendshipId);
  try {
    const snap = await getDoc(ref);
    const existing: CloudMoodLog[] = snap.exists() ? (snap.data().moodLogs || []) : [];
    const updated = [entry, ...existing];
    await setDoc(
      ref,
      sanitizeForFirestore({
        moodLogs: updated,
      }),
      { merge: true }
    );
  } catch (err: any) {
    logFirestoreError('addCloudMoodLog', `friends/${friendshipId}`, err);
    throw err;
  }
};


export const searchUsersByUsername = async (
  searchName: string
): Promise<{ uid: string; displayName: string; handle?: string; currentStreak: number; longestStreak: number }[]> => {
  try {
    const usersCol = collection(db, 'users');
    const snap = await getDocs(usersCol);
    const q = searchName.trim().toLowerCase().replace(/^@/, '');
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          displayName: data.displayName || 'Anonymous',
          handle: data.handle || '',
          currentStreak: data.currentStreak || 0,
          longestStreak: data.longestStreak || 0,
        };
      })
      .filter((u) => {
        const nameMatch = u.displayName.toLowerCase().includes(q);
        const handleMatch = u.handle ? u.handle.toLowerCase().includes(q) : false;
        const uidMatch = u.uid.toLowerCase().includes(q);
        return nameMatch || handleMatch || uidMatch;
      });
  } catch (err: any) {
    logFirestoreError('searchUsers', 'users', err);
    return [];
  }
};

export const findUserByHandle = async (
  handle: string
): Promise<{ uid: string; displayName: string; handle: string; currentStreak: number; longestStreak: number } | null> => {
  const clean = handle.trim().toLowerCase().replace(/^@/, '');
  if (!clean) return null;
  try {
    const usersCol = collection(db, 'users');
    const qHandle = query(usersCol, where('handle', '==', clean));
    const snap = await getDocs(qHandle);
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      return {
        uid: snap.docs[0].id,
        displayName: docData.displayName || clean,
        handle: docData.handle || clean,
        currentStreak: docData.currentStreak || 1,
        longestStreak: docData.longestStreak || 1,
      };
    }
    // Also try case-insensitive check over users
    const allUsersSnap = await getDocs(usersCol);
    for (const d of allUsersSnap.docs) {
      const data = d.data();
      if (
        (data.handle && data.handle.toLowerCase() === clean) ||
        (data.displayName && data.displayName.toLowerCase() === clean) ||
        d.id.toLowerCase() === clean
      ) {
        return {
          uid: d.id,
          displayName: data.displayName || clean,
          handle: data.handle || clean,
          currentStreak: data.currentStreak || 1,
          longestStreak: data.longestStreak || 1,
        };
      }
    }
    return null;
  } catch (err: any) {
    logFirestoreError('findUserByHandle', `users(handle=${clean})`, err);
    return null;
  }
};

