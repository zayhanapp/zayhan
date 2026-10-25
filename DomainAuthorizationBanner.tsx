import React, { useState } from 'react';
import { Globe, Copy, Check, X, ExternalLink } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface DomainAuthorizationBannerProps {
  domain: string | null;
  onClose: () => void;
}

export const DomainAuthorizationBanner: React.FC<DomainAuthorizationBannerProps> = ({
  domain,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!domain) return null;

  const projectId = (firebaseConfig as any)?.projectId || 'gen-lang-client-0287632164';
  const consoleSettingsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 glass-panel rounded-2xl p-4 border border-amber-500/30 shadow-2xl bg-zinc-950/90 text-xs space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-300 font-medium">
          <Globe className="w-4 h-4 shrink-0" />
          <span>Authorize Domain for Google Sign-In</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-zinc-300 text-[11px] leading-relaxed">
        Firebase requires this domain to be added to your Authorized Domains list before Google Sign-In can work:
      </p>

      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] text-zinc-200">
        <span className="truncate">{domain}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white shrink-0 cursor-pointer transition-colors"
          title="Copy domain"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1 text-[11px]">
        <a
          href={consoleSettingsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-amber-400 hover:text-amber-300 transition-colors"
        >
          <span>Firebase Console</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          onClick={onClose}
          className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono transition-colors cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
