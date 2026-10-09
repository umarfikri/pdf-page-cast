import React, { useState } from "react";
import type { PdfConvertResult } from "../types/document";

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
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  const htmlData = validationResult.data || validationResult.html || "";

  const handleCopy = () => {
    if (!htmlData) return;
    navigator.clipboard.writeText(htmlData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-sky-100 rounded-2xl p-6 bg-white/95 backdrop-blur-sm shadow-md shadow-sky-100/60 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
              HTML Converted
            </span>
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
            {copied ? "Copied HTML Data!" : "Copy Data"}
          </button>
          <a
            href={validationResult.viewUrl || "/something"}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
          >
            Open Fullscreen ↗
          </a>
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
          >
            Upload Another PDF
          </button>
        </div>
      </div>

      {/* Toggle View Mode: Live Preview vs Data string */}
      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl text-xs border border-slate-100">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`px-3 py-1 font-medium rounded-lg transition-colors cursor-pointer ${
              viewMode === "preview"
                ? "bg-white text-sky-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Live Preview
          </button>
          <button
            type="button"
            onClick={() => setViewMode("code")}
            className={`px-3 py-1 font-medium rounded-lg transition-colors cursor-pointer ${
              viewMode === "code"
                ? "bg-white text-sky-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Raw HTML Data ({Math.round(htmlData.length / 1024)} KB)
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
          {validationResult.convertedAt
            ? new Date(validationResult.convertedAt).toLocaleTimeString()
            : ""}
        </span>
      </div>

      {/* Content Area */}
      {viewMode === "preview" ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-inner h-[650px]">
          <iframe
            title="PDF HTML Live Render"
            srcDoc={htmlData}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      ) : (
        <div className="relative border border-slate-200 rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-200 h-[650px] overflow-auto">
          <pre className="whitespace-pre-wrap break-all">{htmlData}</pre>
        </div>
      )}
    </div>
  );
}
