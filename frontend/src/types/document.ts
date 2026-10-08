export interface ValidationResult {
  documentType: string;
  category: string;
  format: string;
  description: string;
  isValid: boolean;
  validatedAt: string;
}

export type UploadStatus =
  | "idle"
  | "uploading"
  | "validating"
  | "completed"
  | "error";

export interface UploadResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface ValidationStatusResponse {
  status: "processing" | "completed" | "failed";
  filename?: string;
  size?: number;
  uploadedAt?: string;
  result?: ValidationResult;
  error?: string;
}
