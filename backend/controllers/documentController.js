import {
  isPdfFile,
  convertPdfToHtml,
  checkPdf2htmlStatus,
} from "../services/documentService.js";

// In-memory store for validation/conversion jobs
const jobs = new Map();

// GET /api/check-pdf2htmlex
export const checkPdf2htmlExStatus = async (req, res) => {
  const result = await checkPdf2htmlStatus();
  res.json(result);
};

// POST /api/upload
export const uploadDocument = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  console.log(`[Upload] Received file: ${req.file.originalname} (${req.file.size} bytes)`);

  // Strict PDF validation
  if (!isPdfFile(req.file)) {
    return res.status(400).json({
      error: "Uploaded file is not a PDF. Only PDF documents are supported.",
    });
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const fileBuffer = req.file.buffer;
  const originalname = req.file.originalname;

  jobs.set(jobId, {
    jobId,
    status: "processing",
    filename: originalname,
    size: req.file.size,
    uploadedAt: new Date().toISOString(),
    result: null,
    error: null,
  });

  // Asynchronous background conversion using pdf2htmlEX Docker into something.html
  (async () => {
    const job = jobs.get(jobId);
    if (!job) return;

    try {
      console.log(`[Upload] Starting pdf2htmlEX conversion for ${jobId}...`);
      const result = await convertPdfToHtml(fileBuffer, originalname);
      job.status = "completed";
      job.result = result;
      console.log(`[Upload] Job ${jobId} completed! View output at http://localhost:5000/something`);
    } catch (err) {
      console.error(`[Upload] Job ${jobId} failed:`, err.message);
      job.status = "failed";
      job.error = err.message || "Failed to convert PDF document with pdf2htmlEX";
    }
  })();

  res.json({
    jobId,
    status: "processing",
    message: "PDF received. Converting to HTML with pdf2htmlEX in progress.",
  });
};

// GET /api/validation-status/:jobId
export const getValidationStatus = (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(job);
};

// GET /api/hello
export const getHello = (req, res) => {
  res.json({
    message: "Hello from Express!",
  });
};
