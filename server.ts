import express from "express";
import path from "path";
import generateCeramahHandler from "./api/generate-ceramah";
import validateKeyHandler from "./api/validate-key";
import exportDocxHandler from "./api/export-docx";

const app = express();
const PORT = 3000;

app.use(express.json());

// Mock Vercel Request/Response for Express
function createVercelHandler(handler: any) {
  return async (req: express.Request, res: express.Response) => {
    try {
      await handler(req as any, res as any);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
}

app.post("/api/generate-ceramah", createVercelHandler(generateCeramahHandler));
app.post("/api/validate-key", createVercelHandler(validateKeyHandler));
app.post("/api/export-docx", createVercelHandler(exportDocxHandler));

app.use("/api/*", (req, res) => {
  res.status(404).json({ error: `Endpoint API (${req.originalUrl}) tidak ditemukan.` });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
