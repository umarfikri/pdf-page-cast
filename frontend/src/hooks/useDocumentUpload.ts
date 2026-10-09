import { useState, useRef, useEffect } from "react";
import type { PdfConvertResult, UploadStatus } from "../types/document";
import { uploadDocument, checkValidationStatus } from "../api/documentApi";

export function useDocumentUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [validationResult, setValidationResult] =
    useState<PdfConvertResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    // Client-side quick check
    const isPdf =
      selectedFile.type === "application/pdf" ||
      selectedFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setFile(null);
      setStatus("error");
      setErrorMessage("Selected file is not a PDF. Only PDF documents are supported.");
      return;
    }

    setFile(selectedFile);
    setStatus("idle");
    setValidationResult(null);
    setErrorMessage(null);
  };

  const handleFileRemove = () => {
    setFile(null);
    setStatus("idle");
    setJobId(null);
    setValidationResult(null);
    setErrorMessage(null);
  };

  const startPolling = (id: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const data = await checkValidationStatus(id);

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
          setErrorMessage(data.error || "Failed to scan PDF document");
          setStatus("error");
        }
      } catch (err: any) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setErrorMessage(err.message || "Error during scanning status polling");
        setStatus("error");
      }
    }, 1000);
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setErrorMessage(null);

    try {
      const data = await uploadDocument(file);
      setJobId(data.jobId);
      setStatus("validating");
      startPolling(data.jobId);
    } catch (err: any) {
      setErrorMessage(
        err.message || "Failed to upload document"
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
  };

  return {
    file,
    status,
    jobId,
    validationResult,
    errorMessage,
    handleFileSelect,
    handleFileRemove,
    handleUpload,
    handleReset,
  };
}
