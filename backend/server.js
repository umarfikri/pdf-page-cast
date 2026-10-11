import express from "express";
import cors from "cors";
import documentRoutes from "./routes/documentRoutes.js";
import { OUTPUT_DIR } from "./services/documentService.js";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Converted figure images, one folder per job
app.use("/api/files", express.static(OUTPUT_DIR));

// Mount API routes
app.use("/api", documentRoutes);

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
