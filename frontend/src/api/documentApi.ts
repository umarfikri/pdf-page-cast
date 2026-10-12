import type { UploadResponse, ValidationStatusResponse } from "../types/document";

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.error || "Failed to upload document");
  }

  console.log(JSON.stringify(response.json))
  return response.json();
}

export async function checkValidationStatus(
  jobId: string
): Promise<ValidationStatusResponse> {
  const response = await fetch(
    `/api/validation-status/${encodeURIComponent(jobId)}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.error || "Failed to check validation status");
  }
  console.log(JSON.stringify(response.json))

  return response.json();
}

export async function getHello(): Promise<{ message: string }> {
  const response = await fetch("/api/hello");

  if (!response.ok) {
    throw new Error("Failed to fetch hello message");
  }

  return response.json();
}
