import { VercelRequest, VercelResponse } from "@vercel/node";
import HTMLtoDOCX from "html-to-docx";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { html, themeName } = req.body;

    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }

    const fileBuffer = await HTMLtoDOCX(html, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Bahan_Ceramah_${(themeName || "Materi").replace(/\s+/g, "_")}.docx"`
    );
    return res.send(fileBuffer);
  } catch (error: any) {
    console.error("Error generating DOCX:", error);
    return res.status(500).json({ error: "Gagal membuat dokumen Word" });
  }
}
