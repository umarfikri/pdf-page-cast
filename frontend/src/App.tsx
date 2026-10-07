import React, { useState, useRef } from "react";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
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
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50/40 to-sky-100/50 text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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
            accept=".pdf,.doc,.docx,.txt"
          />

          {!file ? (
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
                  PDF, DOC, DOCX, or TXT
                </p>
              </div>
            </div>
          ) : (
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
                  onClick={() => alert(`Uploading ${file.name}...`)}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Upload
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;