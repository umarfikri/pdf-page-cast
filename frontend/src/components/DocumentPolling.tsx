

interface DocumentPollingProps {
  status: "uploading" | "validating";
  jobId: string | null;
}

export function DocumentPolling({ status, jobId }: DocumentPollingProps) {
  return (
    <div className="border border-sky-100 rounded-2xl p-8 text-center bg-white/95 backdrop-blur-sm shadow-md shadow-sky-100/60 flex flex-col items-center gap-4">
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
  );
}
