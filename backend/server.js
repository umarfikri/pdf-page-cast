import express from "express";
import cors from "cors";
import documentRoutes from "./routes/documentRoutes.js";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Mount API routes
app.use("/api", documentRoutes);

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});