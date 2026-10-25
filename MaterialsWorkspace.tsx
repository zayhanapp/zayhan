import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  Search,
  Cloud,
  ArrowLeft,
  BookOpen,
  Folder,
  HardDrive,
  Pencil,
  Check,
  X,
  ExternalLink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  MaterialItem,
  getAllMaterials,
  saveMaterial,
  deleteMaterial,
  updateMaterialNotes,
  renameMaterial,
} from '../utils/indexedDB';
import { PdfViewer } from './PdfViewer';
import { DrivePickerModal } from './DrivePickerModal';
import { syncMaterialToCloud } from '../utils/firebase';
import { User } from 'firebase/auth';

interface MaterialsWorkspaceProps {
  currentUser?: User | null;
}

type FolderFilter = 'all' | 'local' | 'drive' | 'images';

export const MaterialsWorkspace: React.FC<MaterialsWorkspaceProps> = ({ currentUser }) => {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);

  // Folder filter: 'all' | 'local' | 'drive' | 'images'
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reader state
  const [currentNotes, setCurrentNotes] = useState<string>('');
  const [notesSaveStatus, setNotesSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [isNotesOpen, setIsNotesOpen] = useState(true);

  // Modals & Renaming state
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load materials from IndexedDB
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        const items = await getAllMaterials();
        if (isMounted) {
          setMaterials(items);
        }
      } catch (err) {
        console.error('Failed to load materials from IndexedDB', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const openDocument = (item: MaterialItem) => {
    setActiveMaterialId(item.id);
    setCurrentNotes(item.studyNotes || '');
    setNotesSaveStatus('saved');
    setImageZoom(1);
  };

  const closeDocument = () => {
    setActiveMaterialId(null);
  };

  // Safe image preview object URL lifecycle
  const activeDoc = materials.find((m) => m.id === activeMaterialId);
  useEffect(() => {
    if (activeDoc && (activeDoc.fileType === 'image' || activeDoc.filename.match(/\.(png|jpe?g|webp|gif|svg)$/i))) {
      let url = '';
      try {
        url = URL.createObjectURL(activeDoc.pdfBlob);
        setImagePreviewUrl(url);
      } catch (e) {
        console.warn('Could not generate image URL', e);
      }
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    } else {
      setImagePreviewUrl(null);
    }
  }, [activeDoc?.id, activeDoc?.pdfBlob]);

  // Upload: Accepts both PDFs and Images (.png, .jpg, .jpeg, .webp, .svg, etc.)
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || file.name.match(/\.(png|jpe?g|webp|gif|svg)$/i);

    if (!isPdf && !isImage) {
      setUploadError('Please select a valid PDF document or Image (PNG, JPG, WebP, SVG).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const newId = `mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg') });

      const newMaterial: MaterialItem = {
        id: newId,
        filename: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        pdfBlob: fileBlob,
        connectionString: '',
        studyNotes: '',
        fileType: isImage ? 'image' : 'pdf',
      };

      await saveMaterial(newMaterial);
      setMaterials((prev) => [newMaterial, ...prev]);
      openDocument(newMaterial);

      if (currentUser) {
        syncMaterialToCloud(currentUser.uid, {
          id: newId,
          userId: currentUser.uid,
          filename: file.name,
          fileSize: file.size,
          uploadedAt: newMaterial.uploadedAt,
          studyNotes: '',
          source: 'local',
        }).catch((e) => console.warn('Could not sync to cloud yet', e));
      }
    } catch (err) {
      console.error('Failed to save uploaded document:', err);
      setUploadError('Failed to store document in local storage.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Google Drive Document selected
  const handleDrivePdfSelected = async (file: {
    id: string;
    name: string;
    blob: Blob;
    webViewLink?: string;
    fileType?: 'pdf' | 'image' | 'drive';
  }) => {
    try {
      const newId = `drive-${file.id}`;
      const newMaterial: MaterialItem = {
        id: newId,
        filename: file.name,
        fileSize: file.blob.size || 1024,
        uploadedAt: new Date().toISOString(),
        pdfBlob: file.blob,
        connectionString: '',
        studyNotes: '',
        driveFileId: file.id,
        fileType: file.fileType || 'drive',
        previewUrl: file.webViewLink,
      };

      await saveMaterial(newMaterial);
      setMaterials((prev) => [newMaterial, ...prev.filter((m) => m.id !== newId)]);
      openDocument(newMaterial);
    } catch (err) {
      console.error('Failed to save Drive document:', err);
      setUploadError('Failed to save Drive document locally.');
    }
  };

  // Rename document
  const handleStartRename = (item: MaterialItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDocId(item.id);
    setEditingName(item.filename);
  };

  const handleSaveRename = async (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingDocId(null);
      return;
    }

    try {
      await renameMaterial(id, trimmed);
      setMaterials((prev) =>
        prev.map((m) => (m.id === id ? { ...m, filename: trimmed } : m))
      );
    } catch (err) {
      console.error('Failed to rename material', err);
    } finally {
      setEditingDocId(null);
    }
  };

  // Delete document
  const handleDeleteDoc = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deleteMaterial(id);
      const updated = materials.filter((m) => m.id !== id);
      setMaterials(updated);
      if (id === activeMaterialId) {
        setActiveMaterialId(null);
        setCurrentNotes('');
      }
    } catch (err) {
      console.error('Failed to delete material', err);
    }
  };

  // Debounced study notes update
  const handleNotesChange = (val: string) => {
    setCurrentNotes(val);
    setNotesSaveStatus('saving');

    if (!activeMaterialId) return;

    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }

    notesTimeoutRef.current = setTimeout(async () => {
      try {
        await updateMaterialNotes(activeMaterialId, val, '');
        setMaterials((prev) =>
          prev.map((m) => (m.id === activeMaterialId ? { ...m, studyNotes: val } : m))
        );
        setNotesSaveStatus('saved');
      } catch (err) {
        console.error('Failed to update notes in IndexedDB', err);
      }
    }, 250);
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Categorization
  const localDocs = materials.filter((m) => !m.driveFileId && m.fileType !== 'image');
  const driveDocs = materials.filter((m) => Boolean(m.driveFileId) || m.fileType === 'drive');
  const imageDocs = materials.filter((m) => m.fileType === 'image');

  const filteredMaterials = materials
    .filter((m) => {
      if (folderFilter === 'local') return !m.driveFileId && m.fileType !== 'image';
      if (folderFilter === 'drive') return Boolean(m.driveFileId) || m.fileType === 'drive';
      if (folderFilter === 'images') return m.fileType === 'image';
      return true;
    })
    .filter((m) => {
      const q = searchQuery.trim().toLowerCase();
      return !q || m.filename.toLowerCase().includes(q) || (m.studyNotes || '').toLowerCase().includes(q);
    });

  // ----------------------------------------------------
  // VIEW 2: GENUINE STUDY VIEWER (PDF / IMAGE / DRIVE)
  // ----------------------------------------------------
  if (activeDoc) {
    const isImage = activeDoc.fileType === 'image' || activeDoc.filename.match(/\.(png|jpe?g|webp|gif|svg)$/i);
    const imageUrl = imagePreviewUrl;
    const isDriveEmbed = activeDoc.fileType === 'drive' && activeDoc.previewUrl;

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3 animate-in fade-in duration-200">
        {/* Top Reader Navigation Bar */}
        <div className="glass-panel rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 border border-white/5 shadow-xl">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={closeDocument}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer shrink-0"
              title="Return to files folder"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Files</span>
            </button>

            {/* Editable document name directly in viewer! */}
            {editingDocId === activeDoc.id ? (
              <form onSubmit={(e) => handleSaveRename(activeDoc.id, e)} className="flex items-center gap-2">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="glass-input px-2.5 py-1 rounded-lg text-xs font-medium text-white max-w-xs"
                  autoFocus
                />
                <button
                  type="submit"
                  className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDocId(null)}
                  className="p-1 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                  {activeDoc.filename}
                </h2>
                <button
                  onClick={(e) => handleStartRename(activeDoc, e)}
                  className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Rename document"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNotesOpen(!isNotesOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs transition-colors cursor-pointer ${
                isNotesOpen ? 'bg-white/20 text-white font-medium' : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Study Notes</span>
            </button>

            <button
              onClick={(e) => handleDeleteDoc(activeDoc.id, e)}
              className="p-1.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
              title="Delete Document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Reader & Notes Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-h-[680px]">
          {/* Main Viewer (PDF, Image, or Drive Preview) */}
          <div className={`${isNotesOpen ? 'lg:col-span-8' : 'lg:col-span-12'} h-[720px] transition-all`}>
            {isImage && imageUrl ? (
              /* Genuine Image Viewer with Zoom Controls */
              <div className="flex flex-col h-full w-full bg-black/60 rounded-2xl overflow-hidden border border-white/5">
                <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/80 border-b border-white/5 text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span>Image Document Viewer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setImageZoom((prev) => Math.max(prev - 0.25, 0.5))}
                      className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-xs text-zinc-400 w-12 text-center">
                      {Math.round(imageZoom * 100)}%
                    </span>
                    <button
                      onClick={() => setImageZoom((prev) => Math.min(prev + 0.25, 3))}
                      className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-zinc-950/40">
                  <img
                    src={imageUrl}
                    alt={activeDoc.filename}
                    style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center center' }}
                    className="max-h-[640px] max-w-full rounded-xl object-contain shadow-2xl transition-transform duration-150"
                  />
                </div>
              </div>
            ) : isDriveEmbed ? (
              /* Genuine Embedded Google Drive Preview */
              <div className="flex flex-col h-full w-full bg-black/60 rounded-2xl overflow-hidden border border-white/5">
                <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/80 border-b border-white/5 text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-blue-400" />
                    <span>Google Drive Document</span>
                  </div>
                  <a
                    href={activeDoc.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-mono text-xs"
                  >
                    <span>Open in Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <iframe
                  src={activeDoc.previewUrl}
                  className="w-full flex-1 border-0 rounded-b-2xl bg-white"
                  title={activeDoc.filename}
                />
              </div>
            ) : (
              /* Genuine PDF Viewer */
              <PdfViewer blob={activeDoc.pdfBlob} filename={activeDoc.filename} />
            )}
          </div>

          {/* Side Study Notes Drawer */}
          {isNotesOpen && (
            <div className="lg:col-span-4 glass-panel rounded-2xl p-4 flex flex-col h-[720px] space-y-3 border border-white/5">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold">
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                  <span>Document Study Notes</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  {notesSaveStatus === 'saving' ? 'Saving...' : 'Auto-saved'}
                </span>
              </div>

              <textarea
                value={currentNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Take notes while studying this document... Notes stay linked directly to this document."
                className="w-full flex-1 p-3 rounded-xl bg-transparent text-zinc-200 placeholder-zinc-600 text-sm leading-relaxed resize-none focus:outline-none font-sans"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 1: MINIMIZED FOLDER & FILE CARDS
  // ----------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Materials</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Study library for PDFs, lecture documents, and images with linked notes.
          </p>
        </div>

        {/* Clear Action Buttons: Upload (PDF & Images) & Google Drive */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadFile}
            accept="application/pdf,image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 text-stone-100 hover:bg-stone-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer shadow-sm border border-stone-300 dark:border-white/10"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File (PDF/Image)</span>
          </button>
          <button
            onClick={() => setIsDriveModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900/5 hover:bg-stone-900/10 dark:bg-white/10 dark:hover:bg-white/20 text-stone-800 dark:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer border border-stone-300 dark:border-white/10"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            <span>Google Drive</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="px-4 py-2.5 rounded-xl text-xs bg-red-950/40 text-red-200 border border-red-500/20">
          {uploadError}
        </div>
      )}

      {/* Folders Filter Tabs & Search */}
      <div className="glass-panel rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border border-white/5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFolderFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
              folderFilter === 'all'
                ? 'bg-stone-900 text-stone-100 dark:bg-white/15 dark:text-white font-semibold shadow-sm'
                : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-900/5 dark:hover:bg-white/5'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>All Files ({materials.length})</span>
          </button>

          <button
            onClick={() => setFolderFilter('local')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
              folderFilter === 'local'
                ? 'bg-stone-900 text-stone-100 dark:bg-white/15 dark:text-white font-semibold shadow-sm'
                : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-900/5 dark:hover:bg-white/5'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>PDFs ({localDocs.length})</span>
          </button>

          <button
            onClick={() => setFolderFilter('images')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
              folderFilter === 'images'
                ? 'bg-stone-900 text-stone-100 dark:bg-white/15 dark:text-white font-semibold shadow-sm'
                : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-900/5 dark:hover:bg-white/5'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Images ({imageDocs.length})</span>
          </button>

          <button
            onClick={() => setFolderFilter('drive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
              folderFilter === 'drive'
                ? 'bg-stone-900 text-stone-100 dark:bg-white/15 dark:text-white font-semibold shadow-sm'
                : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-900/5 dark:hover:bg-white/5'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Google Drive ({driveDocs.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents or notes..."
            className="w-full glass-input pl-8 pr-3 py-1.5 rounded-xl text-xs"
          />
        </div>
      </div>

      {/* Minimized Document Cards ("file file file") */}
      {filteredMaterials.length === 0 ? (
        <div className="py-20 text-center glass-panel rounded-3xl space-y-3 border border-white/5">
          <Folder className="w-10 h-10 mx-auto text-zinc-600 opacity-50" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-300">
              {searchQuery ? 'No documents match your search' : 'No documents in this folder yet'}
            </p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Upload PDF documents or images, or paste a Google Drive link.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs transition-colors cursor-pointer"
            >
              Upload PDF or Image
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredMaterials.map((file) => {
            const isImage = file.fileType === 'image' || file.filename.match(/\.(png|jpe?g|webp|gif|svg)$/i);
            const isDrive = Boolean(file.driveFileId) || file.fileType === 'drive';
            const hasNotes = Boolean(file.studyNotes && file.studyNotes.trim().length > 0);

            return (
              <div
                key={file.id}
                onClick={() => openDocument(file)}
                className="group glass-panel rounded-2xl p-4 flex flex-col justify-between hover:bg-white/[0.06] transition-all cursor-pointer border border-white/5 hover:border-white/15 space-y-3 shadow-lg"
              >
                {/* Top card row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/5 group-hover:bg-white/10 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors shrink-0">
                      {isDrive ? (
                        <Cloud className="w-4 h-4 text-blue-400" />
                      ) : isImage ? (
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-zinc-300" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {editingDocId === file.id ? (
                        <form
                          onSubmit={(e) => handleSaveRename(file.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1"
                        >
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="glass-input px-2 py-0.5 rounded text-xs text-white w-full"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="p-1 rounded bg-emerald-500/20 text-emerald-400"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-1 group/title">
                          <p className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                            {file.filename}
                          </p>
                          <button
                            onClick={(e) => handleStartRename(file, e)}
                            className="opacity-80 sm:opacity-0 sm:group-hover/title:opacity-100 p-1 text-zinc-400 hover:text-white transition-opacity cursor-pointer"
                            title="Rename"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <span className="text-[10px] font-mono text-zinc-500 block">
                        {formatBytes(file.fileSize)} · {isDrive ? 'Drive' : isImage ? 'Image' : 'PDF'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteDoc(file.id, e)}
                    className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/10 transition-all cursor-pointer"
                    title="Delete file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Bottom card row */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] font-mono">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] ${
                      hasNotes ? 'bg-white/10 text-zinc-200' : 'bg-white/[0.02] text-zinc-500'
                    }`}
                  >
                    {hasNotes ? 'Has Notes' : 'No Notes'}
                  </span>

                  <span className="text-zinc-400 group-hover:text-white font-medium flex items-center gap-1 transition-colors">
                    <span>Open</span>
                    <span className="text-xs font-sans">→</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Google Drive Link & File Picker Modal */}
      <DrivePickerModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        onSelectPdf={handleDrivePdfSelected}
      />
    </div>
  );
};
