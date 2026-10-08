import { detectDocumentType } from "../services/documentService.js";

// In-memory store for validation jobs
const jobs = new Map();

// POST /api/upload
export const uploadDocument = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const detected = detectDocumentType(req.file);

  jobs.set(jobId, {
    status: "processing",
    filename: req.file.originalname,
    size: req.file.size,
    uploadedAt: new Date().toISOString(),
    result: null,
  });

  // Simulate background validation process (takes ~3 seconds)
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = "completed";
      job.result = {
        documentType: detected.type,
        category: detected.category,
        format: detected.format,
        description: detected.description,
        isValid: true,
        validatedAt: new Date().toISOString(),
      };
    }
  }, 3000);

  res.json({
    jobId,
    status: "processing",
    message: "Document received. Validation in progress.",
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
