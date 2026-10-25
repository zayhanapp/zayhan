/**
 * Daily Opening Streak & Friends Management
 *
 * Rules:
 * 1. The first qualifying visit starts a streak of 1.
 * 2. Another visit on the same calendar day does not increase it.
 * 3. Visiting on the immediate next calendar day increases current streak by 1.
 * 4. Missing one or more calendar days resets current streak to 1 on next visit.
 * 5. Longest streak is updated whenever current streak exceeds it.
 * 6. Uses local timezone calendar date (YYYY-MM-DD) to prevent multi-visit inflation.
 */

export interface UserStreakProfile {
  username: string;
  currentStreak: number;
  longestStreak: number;
  lastVisitDate: string; // "YYYY-MM-DD"
  totalVisits: number;
}

export interface MoodLogEntry {
  id: string;
  userId: string;
  authorName: string;
  authorHandle?: string;
  mood: 'Great' | 'Good' | 'Okay' | 'Low' | 'Stressed';
  emoji: string;
  note?: string;
  timestamp: number;
}

export interface FriendEntry {
  id: string;
  username: string;
  handle?: string;
  currentStreak: number;
  longestStreak: number;
  lastVisitDate: string;
  addedAt: number;
  sharedNote?: string;
  sharedNoteAuthor?: string;
  sharedNoteUpdatedAt?: number;
  sharedDocs?: any[];
  moodLogs?: MoodLogEntry[];
}

const PROFILE_KEY = 'liquid_glass_streak_profile';
const FRIENDS_KEY = 'liquid_glass_friends_list';

// Helper to get formatted local date string: YYYY-MM-DD
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calculate the number of calendar days between two "YYYY-MM-DD" dates
export function daysDifference(priorDateStr: string, currentDateStr: string): number {
  if (!priorDateStr) return Infinity;
  const [y1, m1, d1] = priorDateStr.split('-').map(Number);
  const [y2, m2, d2] = currentDateStr.split('-').map(Number);

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / msPerDay);
}

// Record an actual app visit and calculate streak according to calendar rules
export function recordDailyVisit(): UserStreakProfile {
  const today = getLocalDateString(new Date());

  let profile: UserStreakProfile;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      profile = JSON.parse(raw);
    } else {
      profile = {
        username: 'Operator',
        currentStreak: 0,
        longestStreak: 0,
        lastVisitDate: '',
        totalVisits: 0,
      };
    }
  } catch (e) {
    profile = {
      username: 'Operator',
      currentStreak: 0,
      longestStreak: 0,
      lastVisitDate: '',
      totalVisits: 0,
    };
  }

  // Determine streak update
  if (!profile.lastVisitDate) {
    // Rule 1: First qualifying visit
    profile.currentStreak = 1;
    profile.longestStreak = 1;
    profile.lastVisitDate = today;
    profile.totalVisits = 1;
  } else {
    const diff = daysDifference(profile.lastVisitDate, today);

    if (diff === 0) {
      // Rule 2: Same calendar day -> do not increase streak
      // Visit already counted for today
    } else if (diff === 1) {
      // Rule 3: Following calendar day -> increment streak
      profile.currentStreak += 1;
      if (profile.currentStreak > profile.longestStreak) {
        profile.longestStreak = profile.currentStreak;
      }
      profile.lastVisitDate = today;
      profile.totalVisits += 1;
    } else if (diff > 1) {
      // Rule 4: Missed a calendar day -> reset streak to 1
      profile.currentStreak = 1;
      profile.lastVisitDate = today;
      profile.totalVisits += 1;
    }
  }

  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to persist streak profile', e);
  }

  return profile;
}

export function getStreakProfile(): UserStreakProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return recordDailyVisit();
}

export function updateUsername(newUsername: string): UserStreakProfile {
  const profile = getStreakProfile();
  profile.username = newUsername.trim() || 'Operator';
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {}
  return profile;
}

export function getFriendsList(): FriendEntry[] {
  try {
    const raw = localStorage.getItem(FRIENDS_KEY);
    if (raw) {
      const parsed: FriendEntry[] = JSON.parse(raw);
      // Filter out any previous mock seeds
      const cleaned = parsed.filter(
        (f) =>
          f.username !== 'Elena_V' &&
          f.username !== 'Marcus_K' &&
          f.username !== 'Chen_Research' &&
          f.username !== 'Sarah_T'
      );
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(FRIENDS_KEY, JSON.stringify(cleaned));
      }
      return cleaned;
    }
  } catch (e) {}

  return [];
}

export function addVerifiedFriend(data: {
  id?: string;
  username: string;
  handle?: string;
  currentStreak?: number;
  longestStreak?: number;
}): FriendEntry[] {
  const current = getFriendsList();
  const cleanHandle = (data.handle || data.username).toLowerCase().replace(/^@/, '');
  if (current.some((f) => (f.handle || f.username).toLowerCase() === cleanHandle)) {
    return current;
  }
  const newFriend: FriendEntry = {
    id: data.id || `friend-${Date.now()}`,
    username: data.username,
    handle: cleanHandle,
    currentStreak: data.currentStreak || 1,
    longestStreak: data.longestStreak || 1,
    lastVisitDate: getLocalDateString(new Date()),
    addedAt: Date.now(),
  };
  const updated = [...current, newFriend];
  try {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export function addFriend(username: string): FriendEntry[] {
  const trimmed = username.trim().replace(/^@/, '');
  if (!trimmed) return getFriendsList();

  const current = getFriendsList();
  // Prevent duplicate usernames
  if (current.some((f) => f.username.toLowerCase() === trimmed.toLowerCase())) {
    return current;
  }

  const newFriend: FriendEntry = {
    id: `friend-${Date.now()}`,
    username: trimmed,
    handle: trimmed.toLowerCase(),
    currentStreak: 1, // New connection begins with streak 1
    longestStreak: 1,
    lastVisitDate: getLocalDateString(new Date()),
    addedAt: Date.now(),
  };

  const updated = [...current, newFriend];
  try {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export function removeFriend(id: string): FriendEntry[] {
  const current = getFriendsList();
  const updated = current.filter((f) => f.id !== id);
  try {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export function updateLocalFriendSharedNote(
  friendId: string,
  noteText: string,
  authorName: string
): FriendEntry[] {
  const current = getFriendsList();
  const updated = current.map((f) => {
    if (f.id === friendId) {
      return {
        ...f,
        sharedNote: noteText,
        sharedNoteAuthor: authorName,
        sharedNoteUpdatedAt: Date.now(),
      };
    }
    return f;
  });
  try {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export function addLocalFriendSharedDoc(
  friendId: string,
  docItem: any
): FriendEntry[] {
  const current = getFriendsList();
  const updated = current.map((f) => {
    if (f.id === friendId) {
      const existing = f.sharedDocs || [];
      return {
        ...f,
        sharedDocs: [docItem, ...existing.filter((d: any) => d.id !== docItem.id)],
      };
    }
    return f;
  });
  try {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export function addLocalFriendMoodLog(
  friendId: string,
  entry: MoodLogEntry
): FriendEntry[] {
  const current = getFriendsList();
  const updated = current.map((f) => {
    if (f.id === friendId) {
      const existing = f.moodLogs || [];
      return {
        ...f,
        moodLogs: [entry, ...existing],
      };
    }
    return f;
  });
  try {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}


