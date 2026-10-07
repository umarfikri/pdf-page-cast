import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

// In-memory store for validation jobs
const jobs = new Map();

// Helper to determine document type from filename / mimetype
function detectDocumentType(file) {
  const name = file.originalname.toLowerCase();
  const mime = file.mimetype;

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return {
      type: "PDF Document",
      category: "PDF",
      format: "PDF",
      description: "Portable Document Format",
    };
  }
  if (
    mime === "application/msword" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  ) {
    return {
      type: "Microsoft Word Document",
      category: "Word Document",
      format: name.endsWith(".docx") ? "DOCX" : "DOC",
      description: "Editable Word Processing Document",
    };
  }
  if (
    mime.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md")
  ) {
    return {
      type: "Text Document",
      category: "Plain Text",
      format: "TXT",
      description: "Unformatted Plain Text File",
    };
  }
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".csv")
  ) {
    return {
      type: "Spreadsheet Document",
      category: "Spreadsheet",
      format: name.endsWith(".csv") ? "CSV" : "XLSX",
      description: "Tabular Data Document",
    };
  }
  return {
    type: "Generic Document",
    category: "Other Document",
    format: name.split(".").pop()?.toUpperCase() || "UNKNOWN",
    description: "Standard Digital File",
  };
}

app.get("/api/hello", (req, res) => {
  res.json({
    message: "Hello from Express!",
  });
});

// Upload document endpoint: starts asynchronous validation job
app.post("/api/upload", upload.single("file"), (req, res) => {
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
});

// Polling endpoint: get validation status by jobId
app.get("/api/validation-status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Validation job not found" });
  }

  res.json(job);
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});