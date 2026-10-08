export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string | null;
  hasEOL: boolean;
}

export interface PdfPageData {
  pageNumber: number;
  width: number;
  height: number;
  text: string;
  itemsCount: number;
  items: PdfTextItem[];
}

export interface PdfWysiwygResult {
  isPdf: boolean;
  totalPages: number;
  fullText: string;
  pages: PdfPageData[];
  metadata: Record<string, any> | null;
  scannedAt: string;
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
  result?: PdfWysiwygResult;
  error?: string;
}
