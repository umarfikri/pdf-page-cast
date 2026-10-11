// The PDF's most common body text style; spans in the HTML only carry styles that differ from it
export interface BaseStyle {
  fontFamily?: string | null;
  fontSize?: string | null;
  color?: string | null;
}

export interface PdfConvertResult {
  success: boolean;
  data: string; // The ready-to-use semantic HTML string for TipTap
  html: string; // The ready-to-use semantic HTML string for TipTap
  baseStyle?: BaseStyle;
  pages?: number;
  pageSizes?: { page: number; width: number; height: number }[];
  filename?: string;
  convertedAt?: string;
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
  jobId: string;
  status: "processing" | "completed" | "failed";
  result?: PdfConvertResult;
  error?: string;
}
