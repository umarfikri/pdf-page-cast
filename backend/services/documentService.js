import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

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

// Extract WYSIWYG data (pages, text elements, positions, dimensions) from PDF buffer
export async function parsePdfWysiwyg(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const doc = await parser.load();
    const numPages = doc.numPages;
    const pages = [];
    let fullText = "";

    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      const items = textContent.items.map((item) => ({
        text: item.str,
        x: item.transform ? Math.round(item.transform[4] * 100) / 100 : 0,
        y: item.transform ? Math.round(item.transform[5] * 100) / 100 : 0,
        width: Math.round((item.width || 0) * 100) / 100,
        height: Math.round((item.height || 0) * 100) / 100,
        fontName: item.fontName || null,
        hasEOL: item.hasEOL || false,
      }));

      const pageText = items.map((it) => it.text).join(" ");
      fullText += (fullText ? "\n\n" : "") + pageText;

      pages.push({
        pageNumber: i,
        width: viewport.width,
        height: viewport.height,
        text: pageText,
        itemsCount: items.length,
        items: items,
      });
    }

    const info = await parser.getInfo();

    return {
      isPdf: true,
      totalPages: numPages,
      fullText: fullText,
      pages: pages,
      metadata: info?.info || null,
      scannedAt: new Date().toISOString(),
    };
  } finally {
    await parser.destroy();
  }
}
