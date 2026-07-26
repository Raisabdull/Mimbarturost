import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security Headers
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method Not Allowed' });
  }

  const apiKey = req.headers['x-gemini-api-key'] as string;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(401).json({ valid: false, error: 'Masukkan Gemini API key Anda terlebih dahulu.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    
    // Test the API key with a very lightweight model and prompt
    await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: "Test",
    });

    return res.status(200).json({ valid: true });
  } catch (error: any) {
    let errorMsg = "API key tidak valid atau tidak memiliki akses ke Gemini API.";
    
    const errLower = (error.message || "").toLowerCase();
    if (errLower.includes("429") || errLower.includes("quota") || errLower.includes("exhausted")) {
        // Technically, key might be valid but quota is exhausted. But for BYOK, it's unusable.
        errorMsg = "Kuota Gemini API Anda telah habis atau batas permintaan sedang tercapai. Periksa penggunaan API pada akun Google Anda.";
    } else if (errLower.includes("fetch") || errLower.includes("network")) {
        errorMsg = "Koneksi ke layanan AI gagal. Periksa internet Anda dan coba kembali.";
    }

    return res.status(401).json({ valid: false, error: errorMsg });
  }
}
