import React from 'react';
import { User } from 'firebase/auth';
import { UserProfileData } from '../utils/firebase';
import { User as UserIcon, RefreshCw, Sun, Moon, LogIn } from 'lucide-react';

export type NavTab = 'HOME' | 'TASKS' | 'NOTES' | 'MATERIALS' | 'FRIENDS';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentUser: User | null;
  profile: UserProfileData | null;
  onOpenAccountModal: () => void;
  onSignInWithGoogle: () => void;
  syncStatus: 'synced' | 'syncing' | 'offline';
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const TABS: NavTab[] = ['HOME', 'TASKS', 'NOTES', 'MATERIALS', 'FRIENDS'];

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  profile,
  onOpenAccountModal,
  onSignInWithGoogle,
  syncStatus,
  theme,
  onToggleTheme,
}) => {
  const displayIdentifier = currentUser
    ? profile?.handle
      ? `@${profile.handle}`
      : `ID: ${currentUser.uid.slice(0, 6)}...`
    : 'Local Profile';

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-6 lg:px-12 py-3">
      <div className="mx-auto max-w-5xl glass-panel flex items-center justify-between px-4 sm:px-5 py-2.5 rounded-2xl">
        {/* Left: Brand & User ID Identifier */}
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <span className="font-black text-lg tracking-tight text-stone-900 dark:text-white font-sans">
              zayhan
            </span>
          </div>

          <div className="h-3 w-[1px] bg-stone-300 dark:bg-white/10 hidden sm:block" />

          {/* User ID / Identity Display */}
          <button
            onClick={currentUser ? onOpenAccountModal : undefined}
            className={`flex items-center gap-1.5 text-[11px] font-mono text-stone-600 dark:text-zinc-400 ${
              currentUser ? 'hover:text-stone-900 dark:hover:text-zinc-200 cursor-pointer transition-colors' : ''
            }`}
            title={currentUser ? `User ID: @${profile?.handle || currentUser.uid} - Click to edit` : 'Local Browser Session'}
          >
            <span>{displayIdentifier}</span>
            {syncStatus === 'syncing' && (
              <RefreshCw className="w-3 h-3 animate-spin text-stone-500 dark:text-zinc-400" />
            )}
          </button>
        </div>

        {/* Center: Desktop Nav Tabs */}
        <nav
          className="hidden md:flex items-center gap-6"
          role="tablist"
          aria-label="Main Navigation"
        >
          {TABS.map((tab) => {
            const isActive = currentTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectTab(tab)}
                className={`relative py-1 text-xs font-mono tracking-wider uppercase transition-colors cursor-pointer ${
                  isActive
                    ? 'text-stone-950 dark:text-white font-semibold'
                    : 'text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab}
                {isActive && (
                  <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-stone-900 dark:bg-white rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Theme Toggle + User Name / Sign In */}
        <div className="flex items-center gap-2.5">
          {/* Colorless Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-stone-600 dark:text-zinc-400 hover:text-stone-950 dark:hover:text-white transition-colors cursor-pointer text-xs font-mono"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5" />
                <span className="text-[11px]">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-stone-700" />
                <span className="text-[11px] text-stone-800 font-medium">Dark</span>
              </>
            )}
          </button>

          {currentUser ? (
            <button
              onClick={onOpenAccountModal}
              className="flex items-center gap-2 p-1.5 pl-2.5 pr-2 rounded-xl bg-stone-900/5 dark:bg-white/5 hover:bg-stone-900/10 dark:hover:bg-white/15 border border-stone-300 dark:border-white/5 transition-colors cursor-pointer text-xs"
              title="Account settings"
            >
              <span className="font-mono text-[11px] text-stone-800 dark:text-zinc-200 max-w-[100px] truncate">
                {profile?.displayName || currentUser.displayName || 'User'}
              </span>
              <div className="w-5 h-5 rounded-full bg-stone-900/10 dark:bg-white/10 flex items-center justify-center text-stone-700 dark:text-zinc-300">
                <UserIcon className="w-3 h-3" />
              </div>
            </button>
          ) : (
            <button
              onClick={onSignInWithGoogle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 text-stone-100 hover:bg-stone-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
            >
              <LogIn className="w-3 h-3" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden mt-2 mx-auto max-w-5xl">
        <nav
          className="glass-panel flex items-center justify-between px-2 py-1.5 rounded-xl overflow-x-auto"
          role="tablist"
        >
          {TABS.map((tab) => {
            const isActive = currentTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectTab(tab)}
                className={`flex-1 min-h-[36px] px-2 py-1 text-[11px] font-mono tracking-wider uppercase text-center whitespace-nowrap rounded-lg transition-colors ${
                  isActive
                    ? 'bg-stone-900 text-stone-100 dark:bg-white/10 dark:text-white font-medium'
                    : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
