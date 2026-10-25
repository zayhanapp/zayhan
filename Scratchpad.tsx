import React, { useState, useEffect, useRef } from 'react';
import { Trash2, FileText, Check, Clock } from 'lucide-react';
import { getAllMaterials, MaterialItem, updateMaterialNotes } from '../utils/indexedDB';

const NOTES_STORAGE_KEY = 'liquid_glass_notes';

interface ScratchpadProps {
  currentUser?: any;
  onSignInWithGoogle?: () => void;
}

export const Scratchpad: React.FC<ScratchpadProps> = () => {
  const [activeTab, setActiveTab] = useState<'scratchpad' | 'studyNotes'>('scratchpad');
  const [content, setContent] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(NOTES_STORAGE_KEY);
      if (saved !== null) return saved;
    } catch (e) {
      console.error('Failed to load notes', e);
    }
    return '';
  });

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [studyNoteContent, setStudyNoteContent] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load materials from IndexedDB
  useEffect(() => {
    getAllMaterials().then((items) => {
      setMaterials(items);
      if (items.length > 0 && !selectedMaterialId) {
        setSelectedMaterialId(items[0].id);
        setStudyNoteContent(items[0].studyNotes || '');
      }
    });
  }, [activeTab]);

  // Handle local text editing - auto saves locally instantly
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(NOTES_STORAGE_KEY, val);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save notes', err);
      }
    }, 250);
  };

  // Study notes editor
  const handleStudyNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setStudyNoteContent(val);
    setSaveStatus('saving');

    if (!selectedMaterialId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateMaterialNotes(selectedMaterialId, val, '');
        setMaterials((prev) =>
          prev.map((m) => (m.id === selectedMaterialId ? { ...m, studyNotes: val } : m))
        );
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save study notes', err);
      }
    }, 250);
  };

  const handleConfirmClear = () => {
    setContent('');
    try {
      localStorage.setItem(NOTES_STORAGE_KEY, '');
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to clear notes', err);
    }
    setShowClearConfirm(false);
  };

  const charCount = activeTab === 'scratchpad' ? content.length : studyNoteContent.length;
  const wordCount =
    activeTab === 'scratchpad'
      ? content.trim().length === 0
        ? 0
        : content.trim().split(/\s+/).length
      : studyNoteContent.trim().length === 0
      ? 0
      : studyNoteContent.trim().split(/\s+/).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
            Notes
          </h1>
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-stone-900/5 dark:bg-white/5 border border-stone-300/80 dark:border-white/5">
            <button
              onClick={() => setActiveTab('scratchpad')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-mono ${
                activeTab === 'scratchpad' ? 'bg-stone-900 text-stone-100 dark:bg-white/15 dark:text-white font-medium shadow-sm' : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              Scratchpad
            </button>
            <button
              onClick={() => setActiveTab('studyNotes')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-mono ${
                activeTab === 'studyNotes' ? 'bg-stone-900 text-stone-100 dark:bg-white/15 dark:text-white font-medium shadow-sm' : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              Document Notes ({materials.length})
            </button>
          </div>
        </div>

        {/* Word / Char count, Save status & Clear */}
        <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
          <span className="flex items-center gap-1 text-emerald-400">
            <Check className="w-3 h-3" />
            <span>{saveStatus === 'saving' ? 'Saving...' : 'Auto-saved'}</span>
          </span>
          <span>·</span>
          <span>{wordCount} words</span>
          <span>·</span>
          <span>{charCount} chars</span>
          {activeTab === 'scratchpad' && (
            <>
              <span>·</span>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === 'scratchpad' ? (
        /* Scratchpad View - Clean, zero instruction bloat */
        <div className="glass-panel rounded-2xl p-4 sm:p-6 border border-white/5 shadow-2xl">
          <textarea
            value={content}
            onChange={handleTextChange}
            placeholder="Start typing your notes..."
            className="w-full min-h-[580px] p-2 bg-transparent text-zinc-200 placeholder-zinc-600 text-sm sm:text-base leading-relaxed resize-y focus:outline-none font-sans"
            spellCheck={false}
          />
        </div>
      ) : (
        /* Document Study Notes View */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-4 glass-panel rounded-2xl p-3 space-y-1.5 max-h-[580px] overflow-y-auto border border-white/5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block pb-1 border-b border-white/5 font-semibold">
              Study Documents
            </span>
            {materials.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">No documents in Materials.</p>
            ) : (
              materials.map((m) => {
                const isSelected = m.id === selectedMaterialId;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMaterialId(m.id);
                      setStudyNoteContent(m.studyNotes || '');
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected ? 'bg-white/10 text-white font-medium' : 'bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs truncate">{m.filename}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="md:col-span-8 glass-panel rounded-2xl p-4 flex flex-col min-h-[580px] border border-white/5">
            <div className="pb-2 mb-2 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs text-zinc-200 font-medium truncate">
                {materials.find((m) => m.id === selectedMaterialId)?.filename || 'Select Document'}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Auto-saved to document</span>
            </div>
            <textarea
              value={studyNoteContent}
              onChange={handleStudyNoteChange}
              placeholder="Study notes for this document..."
              disabled={!selectedMaterialId}
              className="w-full flex-1 p-2 bg-transparent text-zinc-200 placeholder-zinc-600 text-sm leading-relaxed resize-none focus:outline-none font-sans"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* Confirmation Modal to Clear */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-sm p-6 rounded-2xl space-y-4 border border-white/10">
            <h3 className="text-base font-medium text-white">Clear scratchpad?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This will remove all text from your local notes.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="px-3 py-1.5 rounded-lg text-xs font-mono bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
