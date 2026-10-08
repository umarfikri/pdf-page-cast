import React, { useState } from "react";

// Hook
import { useDocumentUpload } from "./hooks/useDocumentUpload";

// Components
import { DocumentDropzone } from "./components/DocumentDropzone";
import { DocumentPolling } from "./components/DocumentPolling";

function App() {
  const {
    file,
    status,
    jobId,
    validationResult,
    errorMessage,
    handleFileSelect,
    handleFileRemove,
    handleUpload,
    handleReset,
  } = useDocumentUpload();

  const [activePageIndex, setActivePageIndex] = useState(0);

  const activePage =
    validationResult?.pages && validationResult.pages[activePageIndex]
      ? validationResult.pages[activePageIndex]
      : validationResult?.pages?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50/40 to-sky-100/50 text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {status === "idle" && (
          <DocumentDropzone
            file={file}
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            onUpload={handleUpload}
          />
        )}

        {/* Uploading / Scanning polling state */}
        {(status === "uploading" || status === "validating") && (
          <DocumentPolling status={status} jobId={jobId} />
        )}

        {/* PDF WYSIWYG Scanned Result UI */}
        {status === "completed" && validationResult && (
          <div className="border border-sky-100 rounded-2xl p-6 bg-white/95 backdrop-blur-sm shadow-md shadow-sky-100/60 flex flex-col gap-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
                    PDF Scanned
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {validationResult.totalPages} page(s)
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mt-1 truncate max-w-md">
                  {file?.name}
                </h3>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
              >
                Upload Another PDF
              </button>
            </div>

            {/* Document metadata bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-xs border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[11px]">Total Pages</span>
                <span className="font-semibold text-slate-700">
                  {validationResult.totalPages}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Total Elements</span>
                <span className="font-semibold text-slate-700">
                  {validationResult.pages.reduce((acc, p) => acc + p.itemsCount, 0)} items
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-400 block text-[11px]">Scanned Time</span>
                <span className="font-mono text-slate-700 text-[11px]">
                  {new Date(validationResult.scannedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Page Navigation Tabs if multiple pages */}
            {validationResult.pages.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {validationResult.pages.map((p, idx) => (
                  <button
                    key={p.pageNumber}
                    type="button"
                    onClick={() => setActivePageIndex(idx)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0 ${
                      activePageIndex === idx
                        ? "bg-sky-500 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Page {p.pageNumber}
                  </button>
                ))}
              </div>
            )}

            {/* Active Page WYSIWYG Content View */}
            {activePage && (
              <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-4 space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-500 border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-700">
                    Page {activePage.pageNumber} of {validationResult.totalPages}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    Dimensions: {Math.round(activePage.width)} × {Math.round(activePage.height)} pt · {activePage.itemsCount} text items
                  </span>
                </div>

                {/* Rendered Page Text Content */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 min-h-[140px] max-h-72 overflow-y-auto shadow-inner text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                  {activePage.text.trim() ? (
                    activePage.text
                  ) : (
                    <span className="text-slate-400 italic">
                      (No extractable text found on this page)
                    </span>
                  )}
                </div>

                {/* Extracted Layout Elements breakdown */}
                {activePage.items && activePage.items.length > 0 && (
                  <details className="text-xs group">
                    <summary className="cursor-pointer text-sky-600 hover:text-sky-700 font-medium select-none py-1">
                      View {activePage.items.length} element coordinate(s) (WYSIWYG layout)
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1 bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px]">
                      {activePage.items.map((item, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center py-1 px-2 hover:bg-slate-50 rounded border-b border-slate-100 last:border-0"
                        >
                          <span className="text-slate-800 truncate max-w-[280px]">
                            {item.text}
                          </span>
                          <span className="text-slate-400 text-[10px] shrink-0">
                            x: {Math.round(item.x)}, y: {Math.round(item.y)} ({Math.round(item.width)}×{Math.round(item.height)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="border border-rose-100 rounded-2xl p-8 text-center bg-white/95 backdrop-blur-sm shadow-md shadow-rose-100/50 flex flex-col items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-full shadow-sm">
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Invalid Document</h3>
              <p className="text-xs text-rose-500 mt-1">
                {errorMessage || "An unexpected error occurred."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2 px-4 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;