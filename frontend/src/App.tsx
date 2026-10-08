import React from "react";

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50/40 to-sky-100/50 text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {status === "idle" && (
          <DocumentDropzone
            file={file}
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            onUpload={handleUpload}
          />
        )}

        {/* Uploading / Validating polling state */}
        {(status === "uploading" || status === "validating") && (
          <DocumentPolling status={status} jobId={jobId} />
        )}

        {/* Validation Completed state */}
        {status === "completed" && validationResult && (
          <div className="border border-sky-100 rounded-2xl p-8 text-center bg-white/95 backdrop-blur-sm shadow-md shadow-sky-100/60 flex flex-col items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full shadow-sm">
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <span className="inline-block px-3 py-1 text-xs font-semibold bg-sky-100 text-sky-700 rounded-full mb-2">
                {validationResult.documentType}
              </span>
              <h3 className="font-bold text-slate-800 text-lg">
                Validation Result
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {validationResult.description}
              </p>
            </div>

            <div className="w-full bg-slate-50 rounded-xl p-4 text-left text-xs text-slate-600 space-y-1.5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-400">File Name:</span>
                <span className="font-medium text-slate-700 truncate max-w-[200px]">
                  {file?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="font-medium text-slate-700">
                  {validationResult.category}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Format:</span>
                <span className="font-medium text-slate-700">
                  {validationResult.format}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-medium text-emerald-600">
                  Valid Document
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="mt-2 w-full py-2 px-4 text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Upload Another Document
            </button>
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
              <h3 className="font-semibold text-slate-800">Upload Failed</h3>
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