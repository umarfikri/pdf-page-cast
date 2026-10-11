

// Hook
import { useDocumentUpload } from "./hooks/useDocumentUpload";

// Components
import { DocumentDropzone } from "./components/DocumentDropzone";
import { DocumentPolling } from "./components/DocumentPolling";
import { DocumentComplete } from "./components/DocumentComplete";

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
      <div className={`w-full transition-all duration-300 ${status === "completed" ? "max-w-6xl py-6" : "max-w-4xl"}`}>
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

        {/* Converted HTML Result UI */}
        {status === "completed" && validationResult && (
          <DocumentComplete
            file={file}
            validationResult={validationResult}
            onReset={handleReset}
          />
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