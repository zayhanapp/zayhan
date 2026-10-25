import React, { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import { UserProfileData } from '../utils/firebase';
import { recordDailyVisit, getStreakProfile } from '../utils/streaks';

interface HomeClockProps {
  profile: UserProfileData | null;
  onNavigateToTab?: (tab: 'TASKS' | 'NOTES' | 'MATERIALS' | 'FRIENDS') => void;
}

export const HomeClock: React.FC<HomeClockProps> = ({ profile }) => {
  const [time, setTime] = useState<Date>(new Date());
  const [localStreak, setLocalStreak] = useState<number>(() => {
    const p = recordDailyVisit();
    return p.currentStreak || 1;
  });

  useEffect(() => {
    const updated = recordDailyVisit();
    setLocalStreak(updated.currentStreak || 1);
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format 12-Hour Clock without seconds: e.g. "02:30 PM"
  const rawHours = time.getHours();
  const ampm = rawHours >= 12 ? 'PM' : 'AM';
  const displayHours = rawHours % 12 || 12;
  const formattedHours = String(displayHours).padStart(2, '0');
  const formattedMinutes = String(time.getMinutes()).padStart(2, '0');
  const clockString = `${formattedHours}:${formattedMinutes} ${ampm}`;

  // Format Date: e.g. "25 Oct 2026"
  const dayNumber = time.getDate();
  const monthShort = time.toLocaleDateString(undefined, { month: 'short' });
  const yearNumber = time.getFullYear();
  const dateString = `${dayNumber} ${monthShort} ${yearNumber}`;
  const weekdayName = time.toLocaleDateString(undefined, { weekday: 'long' });

  // Get active username without hardcoded placeholder
  const username =
    profile?.displayName && profile.displayName !== 'User'
      ? profile.displayName
      : profile?.handle
      ? `@${profile.handle}`
      : 'User';

  const currentStreak = profile?.currentStreak ?? localStreak ?? 1;

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-12 py-12 sm:py-20 flex flex-col items-start text-left select-none">
      {/* Small transparent and simple daily streak badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900/5 dark:bg-black/60 border border-stone-300 dark:border-white/10 text-xs font-mono text-stone-700 dark:text-zinc-300 backdrop-blur-md mb-8 shadow-sm">
        <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
        <span className="font-semibold text-stone-900 dark:text-white tracking-wide">{currentStreak}d</span>
        <span className="text-stone-500 dark:text-zinc-500 text-[11px]">streak</span>
      </div>

      {/* 1. Welcome {username} */}
      <h2 className="text-lg sm:text-xl font-normal tracking-wide text-stone-600 dark:text-zinc-400 font-sans">
        Welcome {username}
      </h2>

      {/* 2. Date: e.g. 25 Oct 2026 */}
      <p className="text-base sm:text-lg font-light tracking-wide text-stone-600 dark:text-zinc-400 font-sans mt-3">
        {dateString}
      </p>

      {/* 3. Weekday: smaller, balanced font */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-stone-900 dark:text-white leading-tight my-2 font-sans">
        {weekdayName}
      </h1>

      {/* 4. Time: e.g. 02:30 PM (No seconds, clean & elegant) */}
      <div className="text-2xl sm:text-3xl md:text-4xl font-light tracking-wide text-stone-800 dark:text-zinc-200 font-sans mt-1">
        {clockString}
      </div>
    </div>
  );
};
