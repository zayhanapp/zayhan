import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  RefreshCw,
  FileText,
} from 'lucide-react';

// Setup worker using reliable CDN matching pdfjsLib version
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('PDF.js worker setup note:', e);
  }
}

interface PdfViewerProps {
  blob: Blob;
  filename: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ blob, filename }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Maintain safe blob object URL for external viewing if needed
  useEffect(() => {
    let url: string | null = null;
    try {
      url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (e) {
      console.error('Failed to create object URL for PDF', e);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [blob]);

  // Load PDF Document via Canvas Reader
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);
    setCurrentPage(1);

    const loadPdf = async () => {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        if (isCancelled) return;

        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('PDF.js canvas loading warning:', err);
          setError(err?.message || 'Could not load PDF document.');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [blob]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
          console.warn('Page render error:', err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.6));
  };

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#FAF5ED] dark:bg-black/60 rounded-2xl overflow-hidden border border-[#D5C8B4] dark:border-white/5 shadow-xl">
      {/* Top minimal control bar: Theme-aware contrast */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#F3ECE2] dark:bg-zinc-950/80 border-b border-[#D5C8B4] dark:border-white/5 text-xs text-stone-700 dark:text-zinc-300">
        {/* Left: Document info & Page navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-stone-900 dark:text-white max-w-[180px] sm:max-w-xs truncate">
            <FileText className="w-4 h-4 text-stone-500 dark:text-zinc-400 shrink-0" />
            <span className="truncate">{filename}</span>
          </div>

          {/* Page navigation controls */}
          <div className="flex items-center gap-1 font-mono text-[11px] bg-stone-900/5 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-stone-300 dark:border-white/5">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || loading}
              aria-label="Previous Page"
              className="p-1 rounded hover:bg-stone-900/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer text-stone-800 dark:text-white"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 tabular-nums text-stone-700 dark:text-zinc-400">
              {loading ? '...' : `${currentPage} / ${numPages || 1}`}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= numPages || loading}
              aria-label="Next Page"
              className="p-1 rounded hover:bg-stone-900/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer text-stone-800 dark:text-white"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Zoom controls & External Tab */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 font-mono text-[11px] text-stone-700 dark:text-zinc-400 bg-stone-900/5 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-stone-300 dark:border-white/5">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.6 || loading}
              aria-label="Zoom Out"
              className="p-1 rounded hover:bg-stone-900/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors cursor-pointer text-stone-800 dark:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center font-semibold">{Math.round(scale * 100)}%</span>
            <button
              onClick={handleZoomIn}
              disabled={scale >= 3.0 || loading}
              aria-label="Zoom In"
              className="p-1 rounded hover:bg-stone-900/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors cursor-pointer text-stone-800 dark:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-[1px] h-3.5 bg-stone-300 dark:bg-white/10" />

          <button
            onClick={handleOpenInNewTab}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-900/5 dark:bg-white/5 hover:bg-stone-900/10 dark:hover:bg-white/15 text-stone-800 dark:text-zinc-200 border border-stone-300 dark:border-white/5 transition-colors cursor-pointer text-xs font-mono"
            title="Open raw PDF in a new browser tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Tab</span>
          </button>
        </div>
      </div>

      {/* Main viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#EFE8DC] dark:bg-zinc-950/40 relative min-h-[440px]"
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-600 dark:text-zinc-400 text-xs font-mono">
            <RefreshCw className="w-5 h-5 animate-spin text-stone-700 dark:text-zinc-300" />
            <span>Rendering PDF page...</span>
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-stone-600 dark:text-zinc-400 text-xs max-w-sm">
            <FileText className="w-8 h-8 text-stone-400 dark:text-zinc-500 opacity-60" />
            <p className="text-stone-900 dark:text-zinc-200 font-medium">Could not display document</p>
            <p className="text-stone-500 dark:text-zinc-500 text-[11px]">{error}</p>
            <button
              onClick={handleOpenInNewTab}
              className="px-3 py-1.5 rounded-lg bg-stone-900 text-stone-100 dark:bg-white dark:text-black font-medium transition-colors cursor-pointer text-xs"
            >
              Open in New Tab
            </button>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className={`shadow-2xl rounded-lg transition-opacity duration-200 bg-white max-w-full ${
              loading ? 'opacity-0' : 'opacity-100'
            }`}
          />
        )}
      </div>
    </div>
  );
};
