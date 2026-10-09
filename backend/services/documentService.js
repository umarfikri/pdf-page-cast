import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOAD_DIR = path.join(__dirname, "../uploads");
export const BACKEND_DIR = path.join(__dirname, "..");
export const SOMETHING_HTML_PATH = path.join(BACKEND_DIR, "something.html");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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

export const DOCKER_IMAGE =
  process.env.PDF2HTMLEX_DOCKER_IMAGE ||
  "pdf2htmlex/pdf2htmlex:0.18.8.rc2-master-20200820-alpine-3.12.0-x86_64";

/**
 * Check pdf2htmlEX Docker status
 */
export async function checkPdf2htmlStatus() {
  try {
    const { stdout: dockerVer } = await execPromise("docker -v");
    return {
      installed: true,
      mode: "docker",
      dockerVersion: dockerVer.trim(),
      image: DOCKER_IMAGE,
      message: `Docker is detected with image: ${DOCKER_IMAGE}`,
    };
  } catch (err) {
    return {
      installed: false,
      mode: "docker",
      error: err.message,
      help: "Ensure Docker Desktop is running on your machine.",
    };
  }
}

/**
 * Convert PDF buffer to pixel-perfect HTML using pdf2htmlEX in Docker and save to something.html
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} originalname - Original filename
 * @returns {Promise<Object>}
 */
export async function convertPdfToHtml(buffer, originalname = "document.pdf") {
  const tempFileName = `input_${Date.now()}.pdf`;
  const inputPdfPath = path.join(UPLOAD_DIR, tempFileName);
  const outputFilename = "something.html";
  const finalHtmlPath = path.join(BACKEND_DIR, outputFilename);

  console.log(`[pdf2htmlEX] Writing temporary PDF: ${inputPdfPath}`);
  await fs.promises.writeFile(inputPdfPath, buffer);

  // Normalize path for docker volume mount on Windows
  const hostMountPath = path.resolve(BACKEND_DIR);

  // The Docker image entrypoint is already pdf2htmlEX, so pass options directly
  // --process-outline 0 --embed-outline 0 disables the sidebar navigation/bookmarks pane
  const dockerCmd = `docker run --rm -v "${hostMountPath}:/pdf" -w /pdf ${DOCKER_IMAGE} --embed-css 1 --embed-font 1 --embed-image 1 --embed-javascript 1 --process-outline 0 --embed-outline 0 --dest-dir /pdf "uploads/${tempFileName}" "${outputFilename}"`;

  console.log(`[pdf2htmlEX] Running Docker command: ${dockerCmd}`);

  try {
    const { stdout, stderr } = await execPromise(dockerCmd);
    if (stdout) console.log(`[pdf2htmlEX stdout]:`, stdout);
    if (stderr) console.log(`[pdf2htmlEX stderr]:`, stderr);

    if (fs.existsSync(finalHtmlPath)) {
      let htmlContent = await fs.promises.readFile(finalHtmlPath, "utf8");

      // Hide sidebar navigation via CSS and ensure all page content (.pc) displays immediately
      const noSidebarCss = `<style type="text/css">
#sidebar { display: none !important; width: 0 !important; }
#sidebar.opened + #page-container { left: 0 !important; }
#page-container { left: 0 !important; right: 0 !important; margin: 0 auto !important; }
.pc { display: block !important; }
</style>`;

      if (htmlContent.includes("</head>")) {
        htmlContent = htmlContent.replace("</head>", `${noSidebarCss}\n</head>`);
      }

      await fs.promises.writeFile(finalHtmlPath, htmlContent, "utf8");
    }

    console.log(`[pdf2htmlEX] Successfully generated pixel-perfect HTML at ${finalHtmlPath}`);
  } catch (err) {
    console.error(`[pdf2htmlEX Error]:`, err.message);
    if (!fs.existsSync(finalHtmlPath)) {
      throw new Error(`pdf2htmlEX Docker conversion failed: ${err.message}`);
    }
  } finally {
    // Clean up temporary input file
    fs.promises.unlink(inputPdfPath).catch(() => {});
  }

  return {
    success: true,
    htmlPath: finalHtmlPath,
    viewUrl: "/something",
    filename: originalname,
    convertedAt: new Date().toISOString(),
  };
}
