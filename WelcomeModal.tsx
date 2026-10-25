import React, { useState, useEffect, useRef } from 'react';
import { Check, AlertCircle, Copy, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { checkHandleAvailability } from '../utils/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

interface WelcomeModalProps {
  isOpen: boolean;
  onComplete: (profile: { displayName: string; handle: string }) => Promise<void>;
  initialHandle?: string;
  initialName?: string;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onComplete,
  initialHandle = '',
  initialName = '',
}) => {
  const [handle, setHandle] = useState(initialHandle);
  const [displayName, setDisplayName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Availability state
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availability, setAvailability] = useState<{ available: boolean; message: string } | null>(null);

  const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced real-time Firestore check to ensure uniqueness
  useEffect(() => {
    if (!cleanHandle) {
      setAvailability(null);
      setCheckingAvailability(false);
      return;
    }

    if (cleanHandle.length < 3) {
      setAvailability({ available: false, message: 'Minimum 3 characters' });
      setCheckingAvailability(false);
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanHandle)) {
      setAvailability({ available: false, message: 'Letters, numbers, underscores only' });
      setCheckingAvailability(false);
      return;
    }

    setCheckingAvailability(true);
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await checkHandleAvailability(cleanHandle);
        setAvailability(res);
      } catch (e) {
        setAvailability({ available: true, message: 'Format valid' });
      } finally {
        setCheckingAvailability(false);
      }
    }, 300);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [cleanHandle]);

  if (!isOpen) return null;

  const isHandleValid = cleanHandle.length >= 3 && /^[a-z0-9_]+$/.test(cleanHandle);
  const nameToUse = displayName.trim() || cleanHandle;

  const handleCopyDomain = async (domain: string) => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    } catch (e) {
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    }
  };

  const handleConnectWithGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHandleValid) {
      setErrorMessage('Please enter a valid User ID (minimum 3 characters).');
      return;
    }

    if (availability && !availability.available) {
      setErrorMessage(availability.message);
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);
    setUnauthorizedDomain(null);

    try {
      await onComplete({
        displayName: nameToUse,
        handle: cleanHandle,
      });
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        const currentDomain = err.unauthorizedDomain || (typeof window !== 'undefined' ? window.location.hostname : '');
        setUnauthorizedDomain(currentDomain);
      } else {
        setErrorMessage(err?.message || 'Failed to connect with Google. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const firebaseProjectId = (firebaseConfig as any)?.projectId || 'gen-lang-client-0059849928';
  const firebaseSettingsUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-150">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl border border-white/10 max-h-[92vh] overflow-y-auto">
        {/* Minimal Header */}
        <div className="text-left space-y-1">
          <span className="font-mono text-xs text-zinc-400 uppercase tracking-widest block font-medium">
            zayhan
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
            Choose Your User ID
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans pt-0.5">
            User IDs are unique and permanently claimed with your Google Account.
          </p>
        </div>

        {/* Unauthorized Domain Notice if Firebase blocked popup */}
        {unauthorizedDomain && (
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-zinc-200 font-medium">
              <Globe className="w-4 h-4 shrink-0 text-zinc-400" />
              <span>Firebase Domain Authorization Required</span>
            </div>
            <p className="text-zinc-400 leading-relaxed text-[11px]">
              Add this domain to Authorized Domains in your Firebase Console to enable Google Sign-In:
            </p>
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black border border-white/10 font-mono text-[11px] text-zinc-200">
              <span className="truncate">{unauthorizedDomain}</span>
              <button
                type="button"
                onClick={() => handleCopyDomain(unauthorizedDomain)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white shrink-0 cursor-pointer text-xs transition-colors"
                title="Copy domain"
              >
                {copiedDomain ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedDomain ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="pt-1">
              <a
                href={firebaseSettingsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-300 hover:text-white underline transition-colors"
              >
                <span>Open Firebase Console Settings</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleConnectWithGoogle} className="space-y-4">
          {/* User ID Handle Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 font-semibold">
                User ID (Unique Handle)
              </label>
              {checkingAvailability ? (
                <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Checking...</span>
                </span>
              ) : (
                availability && (
                  <span
                    className={`text-[10px] font-mono flex items-center gap-1 ${
                      availability.available ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {availability.available ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    <span>{availability.message}</span>
                  </span>
                )
              )}
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-3.5 font-mono text-zinc-400 select-none text-sm font-semibold">@</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                  setHandle(val);
                  setErrorMessage(null);
                }}
                placeholder="your_handle"
                autoFocus
                disabled={submitting}
                className="w-full glass-input pl-8 pr-4 py-2.5 rounded-xl text-sm font-mono text-white placeholder-zinc-600 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Handle: <span className="text-zinc-300">@{cleanHandle || 'your_handle'}</span>
            </p>
          </div>

          {/* Display Name Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 font-semibold">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name (e.g. Zayan)"
              disabled={submitting}
              className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none"
            />
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Compulsory Google Sign-In Action (No local bypass) */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || (availability !== null && !availability.available) || !isHandleValid}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-40 disabled:hover:bg-white text-black font-semibold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting with Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#000000"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#000000"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#000000"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#000000"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Connect with Google</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-1">
          <p className="text-[11px] font-mono text-zinc-500">
            Google authentication verifies and protects your User ID.
          </p>
        </div>
      </div>
    </div>
  );
};
