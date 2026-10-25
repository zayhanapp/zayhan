import React, { useState } from 'react';
import { X, Check, CloudUpload, LogOut, ShieldCheck, User as UserIcon, Pencil, Copy } from 'lucide-react';
import { User } from 'firebase/auth';
import { UserProfileData, saveUserProfile, logoutUser } from '../utils/firebase';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  profile: UserProfileData | null;
  onProfileUpdated: (newProfile: UserProfileData) => void;
  onMigrateLocalData: () => Promise<void>;
  hasLocalData: boolean;
  isFirstSignIn?: boolean;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  user,
  profile,
  onProfileUpdated,
  onMigrateLocalData,
  hasLocalData,
  isFirstSignIn = false,
}) => {
  const defaultHandle =
    profile?.handle ||
    (profile?.displayName
      ? profile.displayName.toLowerCase().replace(/[^a-z0-9_]/g, '')
      : user?.email
      ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')
      : user?.uid?.slice(0, 8) || 'user');

  const [nameInput, setNameInput] = useState(
    profile?.displayName || user?.displayName || 'User'
  );
  const [handleInput, setHandleInput] = useState(defaultHandle);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);

  if (!isOpen || !user) return null;

  const handleCopyId = async () => {
    const textToCopy = handleInput.trim().replace(/^@/, '') || user.uid;
    try {
      await navigator.clipboard.writeText(`@${textToCopy}`);
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 2000);
    } catch (e) {
      // Fallback
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 2000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setSaving(true);
    const cleanHandle =
      handleInput.trim().toLowerCase().replace(/^@/, '') ||
      nameInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') ||
      user.uid.slice(0, 8);

    const updatedData: Partial<UserProfileData> = {
      displayName: nameInput.trim(),
      handle: cleanHandle,
      email: user.email || '',
      photoURL: user.photoURL || '',
    };

    const newProfile: UserProfileData = {
      ...(profile || {
        displayName: nameInput.trim(),
        email: user.email || '',
        currentStreak: 1,
        longestStreak: 1,
        lastVisitDate: new Date().toISOString().split('T')[0],
      }),
      displayName: nameInput.trim(),
      handle: cleanHandle,
    };

    try {
      // Save to Firestore with timeout safeguard so user is never frozen
      await Promise.race([
        saveUserProfile(user.uid, updatedData),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch (err) {
      console.warn('Profile save warning (proceeding with local update):', err);
    } finally {
      // Always notify parent and close modal immediately
      onProfileUpdated(newProfile);
      setSaving(false);
      onClose();
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      await onMigrateLocalData();
      setMigrated(true);
    } catch (err) {
      console.error('Migration failed:', err);
    } finally {
      setMigrating(false);
    }
  };

  const handleSignOut = async () => {
    await logoutUser();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <UserIcon className="w-4 h-4 text-zinc-300" />
            <h2 className="text-base font-light text-zinc-100">
              {isFirstSignIn ? 'Welcome to Lumina' : 'Account & Sync'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* First sign in explanation */}
        {isFirstSignIn && (
          <p className="text-xs text-zinc-400 leading-relaxed">
            What do you want to be called in your productivity workspace and on the friends leaderboard?
          </p>
        )}

        {/* Profile Form: Display Name & User ID Handle */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Display Name Field */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
              Your Display Name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                // Auto-suggest handle if user hasn't explicitly customized handle yet
                if (!profile?.handle) {
                  setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                }
              }}
              placeholder="Your display name"
              className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm text-white"
              autoFocus={isFirstSignIn}
            />
          </div>

          {/* User ID / Handle Field with Pencil Character */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                <Pencil className="w-3.5 h-3.5 text-zinc-300" />
                <span>User ID (Handle)</span>
              </label>
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
                title="Copy User ID to share with friends"
              >
                {copiedHandle ? (
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

            <div className="relative flex items-center">
              <span className="absolute left-3 text-zinc-500 font-mono text-xs select-none">
                @
              </span>
              <input
                type="text"
                value={handleInput}
                onChange={(e) =>
                  setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                }
                placeholder="your_handle"
                className="w-full glass-input pl-7 pr-8 py-2 rounded-xl text-xs font-mono text-zinc-200"
              />
              <div className="absolute right-2.5 text-zinc-500 pointer-events-none" title="Editable handle">
                <Pencil className="w-3 h-3" />
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 leading-normal">
              Friends can use this User ID (<span className="text-zinc-300 font-mono">@{handleInput || 'your_id'}</span>) to find and connect with you.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            {isFirstSignIn ? (
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Skip for now
              </button>
            ) : <span />}

            <button
              type="submit"
              disabled={saving || !nameInput.trim()}
              className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              {saving ? 'Saving...' : isFirstSignIn ? 'Continue' : 'Save profile'}
            </button>
          </div>
        </form>

        {/* Account Details & Cloud Backup */}
        {!isFirstSignIn && (
          <div className="pt-3 border-t border-white/5 space-y-4">
            <div className="text-xs font-mono space-y-1 text-zinc-400">
              <div className="flex justify-between">
                <span className="text-zinc-500">Google Account:</span>
                <span className="text-zinc-300 truncate max-w-[200px]">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Firebase UID:</span>
                <span className="text-zinc-500 font-mono text-[10px] truncate max-w-[150px]">{user.uid}</span>
              </div>
            </div>

            {/* Local Migration Section */}
            {hasLocalData && (
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Cloud Data Backup</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Migrate your existing local tasks, notes, and study material records to your cloud profile.
                </p>
                <button
                  type="button"
                  onClick={handleMigrate}
                  disabled={migrating || migrated}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-mono transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  {migrating ? 'Backing up...' : migrated ? 'Backup complete' : 'Back up local data now'}
                </button>
              </div>
            )}

            {/* Sign Out */}
            <div className="pt-2 flex justify-between items-center">
              <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                Firebase Auth Protected
              </span>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
