import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import documentRoutes from "./routes/documentRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Mount API routes
app.use("/api", documentRoutes);

app.get("/something", (req, res) => {
  res.sendFile(path.join(__dirname, "something.html"));
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});