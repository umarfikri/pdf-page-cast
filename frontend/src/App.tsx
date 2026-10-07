import React, { useState, useRef, useEffect } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

interface ValidationResult {
  documentType: string;
  category: string;
  format: string;
  description: string;
  isValid: boolean;
  validatedAt: string;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "validating" | "completed" | "error"
  >("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus("idle");
      setValidationResult(null);
      setErrorMessage(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus("idle");
      setValidationResult(null);
      setErrorMessage(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setStatus("idle");
    setJobId(null);
    setValidationResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startPolling = (id: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/validation-status/${id}`
        );
        if (!res.ok) {
          throw new Error("Failed to check validation status");
        }
        const data = await res.json();

        if (data.status === "completed" && data.result) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setValidationResult(data.result);
          setStatus("completed");
        } else if (data.status === "failed") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setErrorMessage(data.error || "Validation failed");
          setStatus("error");
        }
      } catch (err: any) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setErrorMessage(err.message || "Error during status polling");
        setStatus("error");
      }
    }, 1000);
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to upload document");
      }

      const data = await res.json();
      setJobId(data.jobId);
      setStatus("validating");
      startPolling(data.jobId);
    } catch (err: any) {
      setErrorMessage(
        err.message || "Could not connect to backend server"
      );
      setStatus("error");
    }
  };

  const handleReset = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setFile(null);
    setStatus("idle");
    setJobId(null);
    setValidationResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50/40 to-sky-100/50 text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {status === "idle" && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 bg-white/90 backdrop-blur-xs shadow-md shadow-sky-100/60 hover:shadow-lg hover:shadow-sky-100 ${
              isDragging
                ? "border-sky-500 bg-sky-50/80 scale-[1.01]"
                : "border-sky-200 hover:border-sky-300"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
            />

            {!file ? (
              // Upload box initial state
              <div className="flex flex-col items-center gap-3">
                <div className="p-3.5 bg-sky-100/80 rounded-full text-sky-600 shadow-xs">
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
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-xs text-sky-600/80 font-medium mt-1">
                    PDF, DOC, DOCX, TXT, or CSV
                  </p>
                </div>
              </div>
            ) : (
              // File selected state
              <div
                className="flex flex-col items-center gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3.5 bg-sky-100 text-sky-600 rounded-full shadow-xs">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-800 truncate max-w-xs">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                {/* Upload and Remove buttons */}
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="px-3.5 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    Upload & Validate
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Uploading / Validating polling state */}
        {(status === "uploading" || status === "validating") && (
          <div className="border border-sky-100 rounded-2xl p-8 text-center bg-white/95 backdrop-blur-xs shadow-md shadow-sky-100/60 flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-sky-100 border-t-sky-500 rounded-full animate-spin"></div>
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                {status === "uploading"
                  ? "Uploading document..."
                  : "Validating document..."}
              </p>
              <p className="text-xs text-sky-600 font-medium mt-1">
                Polling backend for validation results
              </p>
            </div>
            {jobId && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                Job ID: {jobId}
              </span>
            )}
          </div>
        )}

        {/* Validation Completed state */}
        {status === "completed" && validationResult && (
          <div className="border border-sky-100 rounded-2xl p-8 text-center bg-white/95 backdrop-blur-xs shadow-md shadow-sky-100/60 flex flex-col items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full shadow-xs">
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
              className="mt-2 w-full py-2 px-4 text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Upload Another Document
            </button>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="border border-rose-100 rounded-2xl p-8 text-center bg-white/95 backdrop-blur-xs shadow-md shadow-rose-100/50 flex flex-col items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-full shadow-xs">
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