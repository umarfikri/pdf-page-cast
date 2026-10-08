import express from "express";
import multer from "multer";
import {
  uploadDocument,
  getValidationStatus,
  checkPdf2htmlExStatus,
  getHello,
} from "../controllers/documentController.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/hello", getHello);
router.get("/check-pdf2htmlex", checkPdf2htmlExStatus);
router.post("/upload", upload.single("file"), uploadDocument);
router.get("/validation-status/:jobId", getValidationStatus);

export default router;
