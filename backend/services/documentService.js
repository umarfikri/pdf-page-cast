import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKEND_DIR = path.join(__dirname, "..");
// Per-job converted assets (figure PNGs), served at /api/files/<jobId>/<name>
export const OUTPUT_DIR = path.join(BACKEND_DIR, "output");

export const CONVERTER_URL = process.env.CONVERTER_URL || "http://localhost:8000";
const CONVERT_TIMEOUT_MS = 5 * 60 * 1000;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Check if the uploaded file is a valid PDF
export function isPdfFile(file) {
  if (!file) return false;
  const name = file.originalname ? file.originalname.toLowerCase() : "";
  const mime = file.mimetype || "";

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return true;
  }

  // Check magic bytes %PDF
  if (file.buffer && file.buffer.length >= 4) {
    const magic = file.buffer.toString("utf8", 0, 4);
    if (magic === "%PDF") return true;
  }

  return false;
}

/**
 * Check that the Python converter service (Docling + pdfplumber) is reachable
 */
export async function checkConverterStatus() {
  try {
    const response = await fetch(`${CONVERTER_URL}/health`, { signal: AbortSignal.timeout(5000) });
    const body = await response.json();
    return { available: response.ok, url: CONVERTER_URL, ...body };
  } catch (err) {
    return {
      available: false,
      url: CONVERTER_URL,
      error: err.message,
      help: "Start the converter with `docker compose up -d converter` from the project root.",
    };
  }
}

/**
 * Convert a PDF into Tiptap-ready HTML via the converter service
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} originalname - Original filename
 * @param {string} jobId - Job id, used as the folder for this job's figure images
 * @returns {Promise<Object>}
 */
export async function convertPdfToHtml(buffer, originalname = "document.pdf", jobId) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "application/pdf" }), originalname);

  console.log(`[Converter] Sending ${originalname} to ${CONVERTER_URL}/convert`);

  const response = await fetch(`${CONVERTER_URL}/convert`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(CONVERT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Converter responded with HTTP ${response.status}`);
  }

  const { html, assets = [], pages, pageSizes, baseStyle } = await response.json();

  // Save figure images and point <img src> at the static route
  const jobDir = path.join(OUTPUT_DIR, jobId);
  await fs.promises.mkdir(jobDir, { recursive: true });

  let tiptapHtml = html;
  for (const asset of assets) {
    const name = path.basename(asset.name);
    await fs.promises.writeFile(path.join(jobDir, name), Buffer.from(asset.base64, "base64"));
    tiptapHtml = tiptapHtml.replaceAll(`src="${asset.name}"`, `src="/api/files/${jobId}/${name}"`);
  }

  console.log(`[Converter] Converted ${originalname}: ${pages} page(s), ${assets.length} figure(s)`);

  return {
    success: true,
    data: tiptapHtml,
    html: tiptapHtml,
    baseStyle,
    pageSizes,
    pages,
    filename: originalname,
    convertedAt: new Date().toISOString(),
  };
}
