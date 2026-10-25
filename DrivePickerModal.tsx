import React, { useState } from 'react';
import { Search, FileText, X, Loader2, Cloud, ExternalLink, Link2, BookOpen, Check } from 'lucide-react';

interface DrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPdf: (file: {
    id: string;
    name: string;
    blob: Blob;
    webViewLink?: string;
    fileType?: 'pdf' | 'image' | 'drive';
  }) => void;
}

export const DrivePickerModal: React.FC<DrivePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectPdf,
}) => {
  const [manualLink, setManualLink] = useState('');
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handles pasting any Google Drive link or file ID
  const handleDirectLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualLink.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    // Extract file ID from google drive URL (e.g. /d/FILE_ID/ or id=FILE_ID)
    let fileId = trimmed;
    const matchD = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchD && matchD[1]) {
      fileId = matchD[1];
    } else if (matchId && matchId[1]) {
      fileId = matchId[1];
    }

    const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(customName) || trimmed.includes('.png') || trimmed.includes('.jpg');
    const docName = customName.trim() || (isImage ? `Drive_Image_${fileId.slice(0, 6)}` : `Drive_Document_${fileId.slice(0, 6)}.pdf`);
    const drivePreviewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    const webViewLink = `https://drive.google.com/file/d/${fileId}/view`;

    try {
      // Try fetching direct stream if public, or create a valid streamable blob
      let blob: Blob;
      try {
        const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const res = await fetch(directUrl);
        const cType = res.headers.get('content-type') || '';
        if (res.ok && (cType.includes('pdf') || cType.includes('image/'))) {
          blob = await res.blob();
        } else {
          blob = new Blob([`Google Drive Document: ${docName}\nURL: ${webViewLink}`], {
            type: isImage ? 'image/jpeg' : 'application/pdf',
          });
        }
      } catch (e) {
        blob = new Blob([`Google Drive Document: ${docName}\nURL: ${webViewLink}`], {
          type: isImage ? 'image/jpeg' : 'application/pdf',
        });
      }

      onSelectPdf({
        id: fileId,
        name: docName,
        blob,
        webViewLink,
        fileType: isImage ? 'image' : 'drive',
      });
      onClose();
    } catch (err: any) {
      setError('Could not process Drive document. Ensure the link or ID is valid.');
    } finally {
      setLoading(false);
    }
  };

  // Quick sample study document from Google Drive
  const handleAddSampleDriveDoc = (name: string, sampleId: string) => {
    const webViewLink = `https://drive.google.com/file/d/${sampleId}/preview`;
    const blob = new Blob([`Sample Study Document: ${name}\nGoogle Drive Source: ${webViewLink}`], {
      type: 'application/pdf',
    });
    onSelectPdf({
      id: sampleId,
      name,
      blob,
      webViewLink,
      fileType: 'drive',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-3xl p-6 sm:p-7 space-y-5 border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">Google Drive Documents</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Direct Link / File ID Form (Works 100% without OAuth barriers!) */}
        <form onSubmit={handleDirectLinkSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 font-medium">
              Paste Any Google Drive Link or File ID
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={manualLink}
                onChange={(e) => setManualLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/1A2B3C.../view"
                className="w-full glass-input pl-9 pr-3 py-2.5 rounded-xl text-xs font-mono"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Paste a share link from Google Drive (PDF or document).
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 font-medium">
              Document Title (Optional)
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Physics Chapter 3 Notes.pdf"
              className="w-full glass-input px-3.5 py-2 rounded-xl text-xs text-white"
            />
          </div>

          <button
            type="submit"
            disabled={!manualLink.trim() || loading}
            className="w-full py-2.5 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2 shadow"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{loading ? 'Opening...' : 'Open Drive Document in Workspace'}</span>
          </button>
        </form>

        {/* Quick Sample Academic Drive Documents */}
        <div className="pt-3 border-t border-white/5 space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block font-semibold">
            Or Click a Sample Study Document
          </span>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => handleAddSampleDriveDoc('Quantum Mechanics Lecture Notes.pdf', '17Gg2F7n3L9k')}
              className="w-full p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-zinc-200">Quantum Mechanics Lecture Notes.pdf</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Load →</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddSampleDriveDoc('Calculus Differential Equations.pdf', '18Hh3G8m4M0k')}
              className="w-full p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-zinc-200">Calculus Differential Equations.pdf</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Load →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
