import { useState, useEffect, useMemo } from "react";
import type { PdfConvertResult } from "../types/document";
import { TiptapEditor } from "./TiptapEditor";

interface DocumentCompleteProps {
  file: File | null;
  validationResult: PdfConvertResult;
  onReset: () => void;
}

export function DocumentComplete({
  file,
  validationResult,
  onReset,
}: DocumentCompleteProps) {
  // Backend provides ready-to-use semantic HTML for TipTap in data/html
  const initialHtml = validationResult.data || validationResult.html || "";

  const [editableHtml, setEditableHtml] = useState<string>(initialHtml);
  const [viewMode, setViewMode] = useState<"editor" | "original" | "preview" | "code">("editor");
  const [copied, setCopied] = useState(false);
  // Show the uploaded PDF itself in the preview tab (the browser renders it natively).
  // The URL only references the File already held in state, so it isn't revoked.
  const pdfUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  // Sync if validationResult changes
  useEffect(() => {
    const backendHtml = validationResult.data || validationResult.html || "";
    setEditableHtml(backendHtml);
  }, [validationResult]);

  const isModified = editableHtml !== initialHtml;

  const handleCopy = () => {
    if (!editableHtml) return;
    navigator.clipboard.writeText(editableHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetToInitial = () => {
    setEditableHtml(initialHtml);
  };

  const handleDownload = () => {
    const filename = (validationResult.filename || file?.name || "document.pdf").replace(/\.pdf$/i, "");
    const blob = new Blob([editableHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_edited.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-sky-100 rounded-2xl p-4 sm:p-6 bg-white/95 backdrop-blur-sm shadow-md shadow-sky-100/60 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
              HTML Converted
            </span>
            {isModified && (
              <span className="inline-block px-2.5 py-0.5 text-xs font-semibold bg-sky-100 text-sky-700 rounded-full">
                Edited in TipTap
              </span>
            )}
            <span className="text-xs font-mono text-slate-400">
              {file?.size ? `${Math.round(file.size / 1024)} KB` : "PDF"}
            </span>
          </div>
          <h3 className="font-bold text-slate-800 text-lg mt-1 truncate max-w-md">
            {validationResult.filename || file?.name || "document.pdf"}
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            {copied ? "Copied to Clipboard!" : "Copy HTML"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download .html
          </button>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
            >
              Open PDF ↗
            </a>
          )}
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
          >
            Upload Another PDF
          </button>
        </div>
      </div>

      {/* Toggle View Mode: TipTap Editor vs read-only original vs PDF vs Raw Code */}
      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl text-xs border border-slate-100">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode("editor")}
            className={`px-3 py-1.5 font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === "editor"
                ? "bg-white text-sky-700 shadow-xs border border-slate-200 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            TipTap Visual Editor
          </button>

          <button
            type="button"
            onClick={() => setViewMode("original")}
            className={`px-3 py-1.5 font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === "original"
                ? "bg-white text-sky-700 shadow-xs border border-slate-200 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Original (read-only)
          </button>

          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`px-3 py-1.5 font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === "preview"
                ? "bg-white text-sky-700 shadow-xs border border-slate-200 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Original PDF
          </button>

          <button
            type="button"
            onClick={() => setViewMode("code")}
            className={`px-3 py-1.5 font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === "code"
                ? "bg-white text-sky-700 shadow-xs border border-slate-200 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            HTML Code
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
          {validationResult.convertedAt
            ? new Date(validationResult.convertedAt).toLocaleTimeString()
            : ""}
        </span>
      </div>

      {/* Content Area */}
      {viewMode === "editor" && (
        <TiptapEditor
          content={editableHtml}
          onChange={setEditableHtml}
          onResetOriginal={isModified ? handleResetToInitial : undefined}
          originalFileName={validationResult.filename || file?.name || "document.html"}
          baseStyle={validationResult.baseStyle}
        />
      )}

      {/* Read-only TipTap showing the converter's output, unaffected by edits */}
      {viewMode === "original" && (
        <TiptapEditor
          content={initialHtml}
          onChange={() => {}}
          originalFileName={validationResult.filename || file?.name || "document.html"}
          baseStyle={validationResult.baseStyle}
          editable={false}
        />
      )}

      {viewMode === "preview" && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-inner h-[650px]">
          {pdfUrl ? (
            <iframe title="Original PDF" src={pdfUrl} className="w-full h-full border-0 bg-white" />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-slate-400">
              The original PDF is no longer available.
            </div>
          )}
        </div>
      )}

      {viewMode === "code" && (
        <div className="relative border border-slate-200 rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-200 h-[650px] overflow-auto">
          <pre className="whitespace-pre-wrap break-all">{editableHtml}</pre>
        </div>
      )}
    </div>
  );
}
