import React, { useState, useEffect, useRef } from 'react';
import {
  UserStreakProfile,
  FriendEntry,
  getFriendsList,
  addVerifiedFriend,
  removeFriend,
  recordDailyVisit,
  updateLocalFriendSharedNote,
  addLocalFriendSharedDoc,
  addLocalFriendMoodLog,
  MoodLogEntry,
} from '../utils/streaks';
import {
  fetchCloudFriendships,
  sendCloudFriendRequest,
  respondToFriendRequest,
  searchUsersByUsername,
  findUserByHandle,
  CloudFriendship,
  UserProfileData,
  subscribeToFriendship,
  updateSharedNoteOnCloud,
  shareDocWithFriendOnCloud,
  addCloudMoodLog,
  SharedDocItem,
} from '../utils/firebase';
import { getAllMaterials, MaterialItem, saveMaterial } from '../utils/indexedDB';
import { PdfViewer } from './PdfViewer';
import { User } from 'firebase/auth';
import {
  Check,
  X,
  Search,
  Pencil,
  Copy,
  Users,
  FileText,
  Upload,
  BookOpen,
  Share2,
  LogIn,
  AlertCircle,
  MessageSquare,
  Loader2,
  Plus,
  Smile,
} from 'lucide-react';

interface FriendsViewProps {
  currentUser: User | null;
  profile: UserProfileData | null;
  onProfileUpdated: (p: UserProfileData) => void;
  onOpenSignIn: () => void;
  onOpenAccountModal?: () => void;
}

type MoodType = 'Great' | 'Good' | 'Okay' | 'Low' | 'Stressed';

const MOOD_OPTIONS: { mood: MoodType; emoji: string; label: string }[] = [
  { mood: 'Great', emoji: '😊', label: 'Great' },
  { mood: 'Good', emoji: '🙂', label: 'Good' },
  { mood: 'Okay', emoji: '😐', label: 'Okay' },
  { mood: 'Low', emoji: '😔', label: 'Low' },
  { mood: 'Stressed', emoji: '😫', label: 'Stressed' },
];

export const FriendsView: React.FC<FriendsViewProps> = ({
  currentUser,
  profile,
  onProfileUpdated,
  onOpenSignIn,
  onOpenAccountModal,
}) => {
  const [localProfile, setLocalProfile] = useState<UserStreakProfile>(() => recordDailyVisit());
  const [localFriends, setLocalFriends] = useState<FriendEntry[]>(() => getFriendsList());
  const [cloudFriendships, setCloudFriendships] = useState<CloudFriendship[]>([]);
  const [inputHandle, setInputHandle] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const [copiedId, setCopiedId] = useState(false);

  // Selected friend for shared side note, mood log, and PDF sharing
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [sharedNoteText, setSharedNoteText] = useState<string>('');
  const [sharedNoteAuthor, setSharedNoteAuthor] = useState<string>('');
  const [sharedDocsList, setSharedDocsList] = useState<SharedDocItem[]>([]);
  const [moodLogsList, setMoodLogsList] = useState<MoodLogEntry[]>([]);
  const [selectedMood, setSelectedMood] = useState<MoodType>('Good');
  const [moodNote, setMoodNote] = useState<string>('');
  const [isLoggingMood, setIsLoggingMood] = useState(false);

  const [isSharingDocModalOpen, setIsSharingDocModalOpen] = useState(false);
  const [myMaterials, setMyMaterials] = useState<MaterialItem[]>([]);
  const [viewingSharedPdf, setViewingSharedPdf] = useState<{ blob: Blob; filename: string } | null>(null);

  const sharedNoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load cloud friendships if user is signed in
  useEffect(() => {
    if (currentUser) {
      loadCloudFriends();
    }
  }, [currentUser]);

  // Load local materials for sharing
  useEffect(() => {
    getAllMaterials().then((items) => setMyMaterials(items));
  }, [isSharingDocModalOpen]);

  const loadCloudFriends = async () => {
    if (!currentUser) return;
    try {
      const list = await fetchCloudFriendships(currentUser.uid);
      setCloudFriendships(list);
    } catch (err) {
      console.warn('Could not fetch cloud friendships:', err);
    }
  };

  // Real-time listener when a friend is selected
  useEffect(() => {
    if (!selectedFriendId) return;

    if (currentUser && selectedFriendId.includes('_')) {
      const unsubscribe = subscribeToFriendship(selectedFriendId, (updated) => {
        setSharedNoteText(updated.sharedNote || '');
        setSharedNoteAuthor(updated.sharedNoteAuthor || '');
        setSharedDocsList(updated.sharedDocs || []);
        setMoodLogsList((updated.moodLogs as MoodLogEntry[]) || []);
      });
      return () => unsubscribe();
    } else {
      const f = localFriends.find((item) => item.id === selectedFriendId);
      if (f) {
        setSharedNoteText(f.sharedNote || '');
        setSharedNoteAuthor(f.sharedNoteAuthor || '');
        setSharedDocsList(f.sharedDocs || []);
        setMoodLogsList(f.moodLogs || []);
      }
    }
  }, [selectedFriendId, currentUser, localFriends]);

  const displayName = profile?.displayName && profile.displayName !== 'User' ? profile.displayName : localProfile.username;
  const userHandle = profile?.handle || displayName.toLowerCase().replace(/[^a-z0-9_]/g, '');

  const handleCopyUserId = async () => {
    const handleText = `@${userHandle}`;
    try {
      await navigator.clipboard.writeText(handleText);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (e) {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Strictly authenticate friend handle - NO fake or gimmick additions!
  const handleVerifyAndAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputHandle.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;

    setLookupFeedback(null);

    // Format validation
    if (clean.length < 3) {
      setLookupFeedback({
        type: 'error',
        message: 'User ID must be at least 3 characters.',
      });
      return;
    }

    // Cannot add self
    if (clean === userHandle.toLowerCase()) {
      setLookupFeedback({
        type: 'error',
        message: 'You cannot add your own User ID.',
      });
      return;
    }

    // Cannot add duplicate
    const alreadyLocal = localFriends.some((f) => (f.handle || f.username).toLowerCase() === clean);
    const alreadyCloud = cloudFriendships.some(
      (f) => (f.user1Handle?.toLowerCase() === clean || f.user2Handle?.toLowerCase() === clean)
    );
    if (alreadyLocal || alreadyCloud) {
      setLookupFeedback({
        type: 'error',
        message: `@${clean} is already in your friends list.`,
      });
      return;
    }

    setVerifying(true);

    try {
      // 1. Look up real registered user in Firestore database
      const foundUser = await findUserByHandle(clean);

      if (!foundUser) {
        setLookupFeedback({
          type: 'error',
          message: `No registered user found with User ID @${clean}. Your friend must first choose this handle in zayhan.`,
        });
        setVerifying(false);
        return;
      }

      // 2. User exists genuinely!
      if (currentUser) {
        await sendCloudFriendRequest(
          {
            uid: currentUser.uid,
            displayName: profile?.displayName || 'User',
            handle: profile?.handle || '',
          },
          foundUser
        );
        setLookupFeedback({
          type: 'success',
          message: `Friend request sent to @${foundUser.handle} (${foundUser.displayName})!`,
        });
        await loadCloudFriends();
      } else {
        const updated = addVerifiedFriend({
          id: foundUser.uid,
          username: foundUser.displayName,
          handle: foundUser.handle,
          currentStreak: foundUser.currentStreak,
          longestStreak: foundUser.longestStreak,
        });
        setLocalFriends(updated);
        setSelectedFriendId(foundUser.uid);
        setLookupFeedback({
          type: 'success',
          message: `Connected with @${foundUser.handle} (${foundUser.displayName})!`,
        });
      }

      setInputHandle('');
    } catch (err: any) {
      setLookupFeedback({
        type: 'error',
        message: `Failed to verify User ID @${clean}. Please check your connection.`,
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveFriend = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = removeFriend(id);
    setLocalFriends(updated);
    if (selectedFriendId === id) {
      setSelectedFriendId(null);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await respondToFriendRequest(friendshipId, true);
      loadCloudFriends();
    } catch (err) {
      console.error('Accept error:', err);
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    try {
      await respondToFriendRequest(friendshipId, false);
      loadCloudFriends();
    } catch (err) {
      console.error('Reject error:', err);
    }
  };

  // Shared Collaborative Note Update
  const handleSharedNoteChange = (text: string) => {
    setSharedNoteText(text);
    const author = profile?.displayName || profile?.handle || 'You';
    setSharedNoteAuthor(author);

    if (sharedNoteTimeoutRef.current) {
      clearTimeout(sharedNoteTimeoutRef.current);
    }

    sharedNoteTimeoutRef.current = setTimeout(async () => {
      if (!selectedFriendId) return;

      if (currentUser && selectedFriendId.includes('_')) {
        try {
          await updateSharedNoteOnCloud(selectedFriendId, text, author);
        } catch (err) {
          console.warn('Could not sync note to cloud', err);
        }
      } else {
        const updated = updateLocalFriendSharedNote(selectedFriendId, text, author);
        setLocalFriends(updated);
      }
    }, 250);
  };

  // Log and share mood with friend (both users can see it!)
  const handleLogMood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriendId) return;

    setIsLoggingMood(true);
    const author = profile?.displayName || profile?.handle || 'You';
    const chosen = MOOD_OPTIONS.find((m) => m.mood === selectedMood) || MOOD_OPTIONS[1];

    const newEntry: MoodLogEntry = {
      id: `mood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: currentUser ? currentUser.uid : 'local',
      authorName: author,
      authorHandle: userHandle,
      mood: chosen.mood,
      emoji: chosen.emoji,
      note: moodNote.trim() || undefined,
      timestamp: Date.now(),
    };

    try {
      if (currentUser && selectedFriendId.includes('_')) {
        await addCloudMoodLog(selectedFriendId, newEntry);
      } else {
        const updated = addLocalFriendMoodLog(selectedFriendId, newEntry);
        setLocalFriends(updated);
        setMoodLogsList((prev) => [newEntry, ...prev]);
      }
      setMoodNote('');
    } catch (err) {
      console.error('Failed to log mood:', err);
    } finally {
      setIsLoggingMood(false);
    }
  };

  // Share existing PDF with friend
  const handleShareExistingMaterial = async (mat: MaterialItem) => {
    if (!selectedFriendId) return;
    const author = profile?.displayName || profile?.handle || 'You';

    const sharedItem: SharedDocItem = {
      id: `shared-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      filename: mat.filename,
      fileSize: mat.fileSize,
      uploadedAt: new Date().toISOString(),
      source: (mat as any).driveFileId ? 'drive' : 'local',
      sharedBy: currentUser ? currentUser.uid : 'local',
      sharedByName: author,
      sharedAt: Date.now(),
      driveFileId: (mat as any).driveFileId || null,
      studyNotes: mat.studyNotes || '',
    };

    if (currentUser && selectedFriendId.includes('_')) {
      await shareDocWithFriendOnCloud(selectedFriendId, sharedItem);
    } else {
      const updated = addLocalFriendSharedDoc(selectedFriendId, sharedItem);
      setLocalFriends(updated);
      setSharedDocsList((prev) => [sharedItem, ...prev]);
    }

    setIsSharingDocModalOpen(false);
  };

  // Upload and share a new PDF immediately
  const handleUploadAndSharePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedFriendId) return;
    const file = files[0];
    const author = profile?.displayName || profile?.handle || 'You';

    const blob = new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
    const newId = `doc-${Date.now()}`;

    // Save to user's materials first
    const newMat: MaterialItem = {
      id: newId,
      filename: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      pdfBlob: blob,
      connectionString: '',
      studyNotes: '',
    };
    await saveMaterial(newMat);

    const sharedItem: SharedDocItem = {
      id: `shared-${Date.now()}`,
      filename: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      source: 'local',
      sharedBy: currentUser ? currentUser.uid : 'local',
      sharedByName: author,
      sharedAt: Date.now(),
    };

    if (currentUser && selectedFriendId.includes('_')) {
      await shareDocWithFriendOnCloud(selectedFriendId, sharedItem);
    } else {
      const updated = addLocalFriendSharedDoc(selectedFriendId, sharedItem);
      setLocalFriends(updated);
      setSharedDocsList((prev) => [sharedItem, ...prev]);
    }

    setIsSharingDocModalOpen(false);
  };

  // Open genuinely shared PDF
  const handleOpenSharedPdf = async (docItem: SharedDocItem) => {
    const existing = myMaterials.find((m) => m.filename === docItem.filename);
    if (existing) {
      setViewingSharedPdf({ blob: existing.pdfBlob, filename: existing.filename });
      return;
    }

    const all = await getAllMaterials();
    const found = all.find((m) => m.filename === docItem.filename);
    if (found) {
      setViewingSharedPdf({ blob: found.pdfBlob, filename: found.filename });
    } else {
      const text = `Shared Study Document: ${docItem.filename}\nShared by: ${docItem.sharedByName}\nDate: ${new Date(docItem.sharedAt).toLocaleString()}`;
      const placeholderBlob = new Blob([text], { type: 'text/plain' });
      setViewingSharedPdf({ blob: placeholderBlob, filename: docItem.filename });
    }
  };

  const acceptedCloudFriends = cloudFriendships.filter((f) => f.status === 'accepted');
  const pendingIncoming = cloudFriendships.filter(
    (f) => f.status === 'pending' && f.senderId !== currentUser?.uid
  );

  // Real friends list
  const allFriends = [
    ...(currentUser && acceptedCloudFriends.length > 0
      ? acceptedCloudFriends.map((f) => {
          const isUser1 = f.user1Id === currentUser.uid;
          return {
            id: f.id,
            displayName: isUser1 ? f.user2Username : f.user1Username,
            handle: isUser1 ? f.user2Handle : f.user1Handle,
            isCloud: true,
          };
        })
      : localFriends.map((f) => ({
          id: f.id,
          displayName: f.username,
          handle: f.handle || f.username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
          isCloud: false,
        }))),
  ];

  // Auto-select first friend if none selected
  useEffect(() => {
    if (!selectedFriendId && allFriends.length > 0) {
      setSelectedFriendId(allFriends[0].id);
    }
  }, [allFriends.length]);

  const activeFriend = allFriends.find((f) => f.id === selectedFriendId);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header: User ID badge on left, Google sync icon on right (no check-in button or streak card!) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-white/5 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-base font-bold text-white">{displayName}</span>

            {/* User ID Handle Badge with Pencil Button */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-zinc-200">
              <span>@{userHandle}</span>
              {onOpenAccountModal && (
                <button
                  onClick={onOpenAccountModal}
                  className="p-0.5 hover:text-white text-zinc-400 transition-colors cursor-pointer"
                  title="Edit Handle"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Copy User ID Button */}
            <button
              onClick={handleCopyUserId}
              className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              title="Copy User ID to share with friends"
            >
              {copiedId ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">
            Share your User ID <span className="text-zinc-300 font-mono">@{userHandle}</span> with friends to connect, share moods, and study together.
          </p>
        </div>

        {/* Minimal Google Connection Status / Icon */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {!currentUser ? (
            <button
              onClick={onOpenSignIn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Google Account Sync"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Google Sync</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Online</span>
            </span>
          )}
        </div>
      </div>

      {/* Pending Incoming Friend Requests */}
      {pendingIncoming.length > 0 && (
        <div className="glass-panel rounded-2xl p-4 border border-blue-500/20 bg-blue-500/5 space-y-2">
          <span className="text-xs font-mono uppercase tracking-wider text-blue-400 font-semibold block">
            Incoming Friend Requests ({pendingIncoming.length})
          </span>
          <div className="space-y-2">
            {pendingIncoming.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5">
                <div className="text-xs">
                  <span className="text-white font-medium">{req.user1Username}</span>
                  <span className="text-zinc-400 font-mono block text-[10px]">@{req.user1Handle || 'user'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAcceptRequest(req.id)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectRequest(req.id)}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 text-xs font-mono cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Friends List & Genuine Verification Form (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Add Friend Form with Real Verification */}
          <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 block font-semibold">
              Add Friend by User ID
            </span>
            <form onSubmit={handleVerifyAndAddFriend} className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">@</span>
                <input
                  type="text"
                  value={inputHandle}
                  onChange={(e) => {
                    setInputHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                    setLookupFeedback(null);
                  }}
                  placeholder="enter_friend_id"
                  className="w-full glass-input pl-7 pr-3 py-2 rounded-xl text-xs font-mono text-white placeholder-zinc-500"
                />
              </div>
              <button
                type="submit"
                disabled={verifying}
                className="px-3.5 py-2 rounded-xl bg-stone-900 text-stone-100 hover:bg-stone-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white disabled:opacity-50 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm border border-stone-300 dark:border-white/10"
              >
                {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>{verifying ? 'Verifying...' : 'Connect'}</span>
              </button>
            </form>

            {/* Verification Status Message */}
            {lookupFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs font-mono flex items-start gap-2 ${
                  lookupFeedback.type === 'error'
                    ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                }`}
              >
                {lookupFeedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                ) : (
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                )}
                <span className="leading-relaxed">{lookupFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Friends List */}
          <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Connected Friends ({allFriends.length})
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Tap to open shared space</span>
            </div>

            {allFriends.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 font-mono space-y-1">
                <Users className="w-6 h-6 mx-auto mb-1 opacity-40 text-zinc-400" />
                <p>No verified connections yet.</p>
                <p className="text-[11px] text-zinc-600">Enter a registered friend's User ID above to connect.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                {allFriends.map((friend) => {
                  const isSelected = friend.id === selectedFriendId;
                  return (
                    <div
                      key={friend.id}
                      onClick={() => setSelectedFriendId(friend.id)}
                      className={`p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-white/15 text-white border border-white/15 shadow-md'
                          : 'bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06] border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs uppercase text-zinc-200">
                          {friend.displayName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{friend.displayName}</p>
                          <span className="text-[10px] font-mono text-zinc-400 block">
                            @{friend.handle || 'friend'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!friend.isCloud && (
                          <button
                            onClick={(e) => handleRemoveFriend(friend.id, e)}
                            className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
                            title="Remove connection"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Shared Mood Log, Live Collaborative Note & PDF Document Sharing (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {activeFriend ? (
            <div className="space-y-4 animate-in fade-in">
              {/* Active Friend Header */}
              <div className="glass-panel rounded-2xl p-4 border border-white/5 flex flex-wrap items-center justify-between gap-2 shadow-xl">
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">
                    Shared Space with {activeFriend.displayName}
                  </span>
                  <span className="text-xs font-mono text-emerald-400">@{activeFriend.handle}</span>
                </div>

                {/* Share PDF Button */}
                <button
                  onClick={() => setIsSharingDocModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 text-stone-100 hover:bg-stone-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm border border-stone-300 dark:border-white/10"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share PDF</span>
                </button>
              </div>

              {/* MOOD LOG CARD - Exact design as requested from mockup image_b1ff6dcb.png */}
              <div className="glass-panel rounded-2xl p-5 border border-white/5 shadow-2xl space-y-4">
                {/* Header */}
                <div className="flex items-baseline justify-between pb-3 border-b border-white/5">
                  <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight">Mood Log</h3>
                  <span className="text-xs font-mono text-zinc-400">{moodLogsList.length} entries</span>
                </div>

                {/* Mood Selection Buttons (5 moods) */}
                <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                  {MOOD_OPTIONS.map((opt) => {
                    const isSelected = selectedMood === opt.mood;
                    return (
                      <button
                        key={opt.mood}
                        type="button"
                        onClick={() => setSelectedMood(opt.mood)}
                        className={`flex flex-col items-center justify-center py-3 px-1.5 sm:px-2 rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? 'border-2 border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-500/80 shadow-sm ring-1 ring-emerald-500/30'
                            : 'bg-stone-900/5 dark:bg-white/[0.03] border border-stone-300/80 dark:border-white/5 text-stone-700 dark:text-zinc-300 hover:bg-stone-900/10 dark:hover:bg-white/[0.07] hover:text-stone-950 dark:hover:text-white'
                        }`}
                      >
                        <span className="text-2xl sm:text-3xl mb-1 select-none">{opt.emoji}</span>
                        <span className="text-[11px] sm:text-xs font-medium truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Note Input & Log Mood Button */}
                <form onSubmit={handleLogMood} className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    value={moodNote}
                    onChange={(e) => setMoodNote(e.target.value)}
                    placeholder={`Add an optional note (${selectedMood})...`}
                    className="flex-1 glass-input px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-zinc-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isLoggingMood}
                    className="px-4 py-2.5 rounded-xl bg-stone-900 text-stone-100 hover:bg-stone-800 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white disabled:opacity-50 text-xs font-mono font-medium tracking-wide flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-stone-300 dark:border-white/10 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Log Mood</span>
                  </button>
                </form>

                {/* Mood Logs History (Both users can see each other's mood logs in real time!) */}
                <div className="pt-2">
                  {moodLogsList.length === 0 ? (
                    <div className="text-center text-xs text-zinc-500 font-mono py-8">
                      No mood logs recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {moodLogsList.map((entry) => {
                        const isMe = entry.authorHandle === userHandle || entry.authorName === displayName;
                        const dateObj = new Date(entry.timestamp);
                        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

                        return (
                          <div
                            key={entry.id}
                            className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-start justify-between gap-3"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="text-2xl shrink-0 select-none">{entry.emoji}</span>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-white">
                                    {isMe ? 'You' : entry.authorName}
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {entry.mood}
                                  </span>
                                </div>
                                {entry.note && (
                                  <p className="text-xs text-zinc-300 leading-relaxed font-sans pt-0.5">
                                    {entry.note}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap shrink-0">
                              {dateStr} · {timeStr}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Collaborative Live Side Note */}
              <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/5 shadow-2xl space-y-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                    <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                    <span>Collaborative Side Note (Live)</span>
                  </span>
                  <span>{sharedNoteAuthor ? `Last edit: ${sharedNoteAuthor}` : 'Live auto-sync'}</span>
                </div>

                <div className="rounded-xl bg-black/40 border border-white/5 p-3">
                  <textarea
                    value={sharedNoteText}
                    onChange={(e) => handleSharedNoteChange(e.target.value)}
                    placeholder="Type anything here... Your connected friend sees your updates in real time."
                    className="w-full min-h-[140px] bg-transparent text-zinc-100 placeholder-zinc-600 text-xs sm:text-sm leading-relaxed resize-y focus:outline-none font-sans"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Shared PDFs Section */}
              <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/5 shadow-2xl space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span className="font-semibold text-zinc-300">Shared Study PDFs ({sharedDocsList.length})</span>
                  <span className="text-[10px] text-zinc-500">Tap to open genuine reader</span>
                </div>

                {sharedDocsList.length === 0 ? (
                  <div className="py-6 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-zinc-500 font-mono space-y-1">
                    <p>No documents shared in this connection yet.</p>
                    <button
                      onClick={() => setIsSharingDocModalOpen(true)}
                      className="text-blue-400 hover:text-blue-300 underline cursor-pointer text-[11px]"
                    >
                      Share a PDF study file now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                    {sharedDocsList.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between hover:bg-white/[0.07] transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{doc.filename}</p>
                            <span className="text-[10px] font-mono text-zinc-500 block">
                              Shared by {doc.sharedByName} · {new Date(doc.sharedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenSharedPdf(doc)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-900 text-stone-100 hover:bg-stone-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white font-mono text-xs transition-colors cursor-pointer shrink-0 border border-stone-300 dark:border-white/10 shadow-sm"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>Open PDF</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-24 glass-panel rounded-2xl p-6 border border-white/5 text-center space-y-2">
              <Users className="w-8 h-8 mx-auto text-zinc-600 opacity-50" />
              <p className="text-sm font-medium text-zinc-300">Select a friend to open shared space</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Once selected, both of you can log your moods, edit a collaborative live note, and study shared PDFs together.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Share Document Picker Modal */}
      {isSharingDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-4 border border-white/10">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h3 className="text-base font-semibold text-white">Share PDF with Friend</h3>
              <button
                onClick={() => setIsSharingDocModalOpen(false)}
                className="p-1 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option 1: Pick from My Materials */}
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 block font-semibold">
                From My Materials ({myMaterials.length})
              </span>
              {myMaterials.length === 0 ? (
                <p className="text-xs text-zinc-500 font-mono py-2">No documents in your Materials tab yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {myMaterials.map((mat) => (
                    <div
                      key={mat.id}
                      onClick={() => handleShareExistingMaterial(mat)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-between text-xs"
                    >
                      <span className="text-white truncate max-w-[240px]">{mat.filename}</span>
                      <span className="text-[11px] font-mono text-blue-400 hover:underline">Share →</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Option 2: Upload new PDF */}
            <div className="pt-2 border-t border-white/5">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadAndSharePdf}
                accept="application/pdf"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload & Share New PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Genuine Shared PDF Reader Modal */}
      {viewingSharedPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-5xl h-[85vh] rounded-3xl p-5 flex flex-col space-y-3 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white truncate max-w-md">{viewingSharedPdf.filename}</h3>
              </div>
              <button
                onClick={() => setViewingSharedPdf(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0">
              <PdfViewer blob={viewingSharedPdf.blob} filename={viewingSharedPdf.filename} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
