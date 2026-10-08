import { isPdfFile, parsePdfWysiwyg } from "../services/documentService.js";

// In-memory store for validation jobs
const jobs = new Map();

// POST /api/upload
export const uploadDocument = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Strict PDF validation
  if (!isPdfFile(req.file)) {
    return res.status(400).json({
      error: "Uploaded file is not a PDF. Only PDF documents are supported.",
    });
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const fileBuffer = req.file.buffer;

  jobs.set(jobId, {
    status: "processing",
    filename: req.file.originalname,
    size: req.file.size,
    uploadedAt: new Date().toISOString(),
    result: null,
    error: null,
  });

  // Asynchronous background scanning of PDF WYSIWYG data
  setTimeout(async () => {
    const job = jobs.get(jobId);
    if (!job) return;

    try {
      const wysiwygData = await parsePdfWysiwyg(fileBuffer);
      job.status = "completed";
      job.result = wysiwygData;
    } catch (err) {
      job.status = "failed";
      job.error = err.message || "Failed to scan PDF document";
    }
  }, 1500);

  res.json({
    jobId,
    status: "processing",
    message: "PDF received. Scanning document data in progress.",
  });
};

// GET /api/validation-status/:jobId
export const getValidationStatus = (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Validation job not found" });
  }

  res.json(job);
};

// GET /api/hello
export const getHello = (req, res) => {
  res.json({
    message: "Hello from Express!",
  });
};
