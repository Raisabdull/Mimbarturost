import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security Headers
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = req.headers['x-gemini-api-key'] as string;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(401).json({ error: 'Masukkan Gemini API key Anda terlebih dahulu.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const { themeName, style, segmentation, topics } = req.body;

    if (!themeName || !style) {
      return res.status(400).json({ error: "Tema dan gaya bahasa harus diisi." });
    }

    const prompt = `Buatkan materi ceramah/khutbah/kajian Islam yang sangat mendalam dan berbobot dengan tema: "${themeName}".
Gaya Bahasa/Penyampaian: ${style}.
Target Audiens/Segmentasi: ${segmentation || "Umum"}.
Sub-topik/Fokus pembahasan: ${topics || "Tidak ada spesifikasi khusus, buatkan yang paling relevan"}.`;

    const systemInstruction = `Kamu adalah seorang ulama kharismatik, cendekiawan muslim, pakar sejarah Islam, dan ahli tafsir-hadis yang memiliki pemahaman mendalam tentang kitab-kitab turats (klasik).
Tugasmu adalah menyusun materi ceramah/kajian yang sangat terstruktur, ilmiah, dan berbobot dengan merujuk langsung pada sumber-sumber otentik (Al-Qur'an, Hadis riwayat terpercaya, Atsar sahabat, dan qaul/perkataan ulama salaf dari kitab turats).`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        themeName: { type: Type.STRING, description: "Judul tema ceramah yang menarik" },
        style: { type: Type.STRING, description: "Gaya bahasa penyampaian" },
        expandedKeywords: {
          type: Type.OBJECT,
          properties: {
            indonesian: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Kata kunci relevan dalam bahasa Indonesia" },
            arabic: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Istilah kunci dalam bahasa Arab (turats)" }
          },
          required: ["indonesian", "arabic"]
        },
        summary: { type: Type.STRING, description: "Ringkasan eksekutif ceramah (maksimal 3 kalimat)" },
        points: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Sistematika poin-poin utama ceramah (alur logika)"
        },
        verses: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              reference: { type: Type.STRING, description: "Nama surah dan nomor ayat (contoh: QS. Al-Baqarah: 183)" },
              text: { type: Type.STRING, description: "Teks Arab ayat Al-Qur'an (harakat lengkap)" },
              translation: { type: Type.STRING, description: "Terjemahan bahasa Indonesia" },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Kata kunci dari ayat tersebut" },
              explanation: { type: Type.STRING, description: "Tafsir ringkas atau asbabun nuzul relevan" }
            },
            required: ["reference", "text", "translation", "keywords", "explanation"]
          },
          description: "Minimal 3 ayat Al-Qur'an yang relevan dengan tema"
        },
        hadiths: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "Matan hadis berbahasa Arab (harakat lengkap)" },
              translation: { type: Type.STRING, description: "Terjemahan Indonesia" },
              source: { type: Type.STRING, description: "Perawi/Kitab Hadis (contoh: HR. Bukhari, Muslim)" },
              number: { type: Type.STRING, description: "Nomor hadis jika diketahui" },
              status: { type: Type.STRING, description: "Derajat hadis: Shahih / Hasan / Dhaif / Perlu Verifikasi" },
              relevance: { type: Type.STRING, description: "Kaitan langsung hadis dengan tema" },
              explanation: { type: Type.STRING, description: "Syarah singkat atau penjelasan maknanya" }
            },
            required: ["text", "translation", "source", "status", "relevance"]
          },
          description: "Minimal 3 hadis yang sangat relevan"
        },
        atsars: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              figure: { type: Type.STRING, description: "Nama sahabat atau tabi'in" },
              text: { type: Type.STRING, description: "Kutipan teks Arab atau perkataannya" },
              translation: { type: Type.STRING, description: "Terjemahan Indonesia" },
              source: { type: Type.STRING, description: "Nama kitab rujukan turats" },
              relevance: { type: Type.STRING, description: "Relevansi dengan tema" }
            },
            required: ["figure", "text", "translation", "source", "relevance"]
          },
          description: "Minimal 2 atsar dari Sahabat atau Tabi'in"
        },
        qauls: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              field: { type: Type.STRING, description: "Bidang ilmu: Tafsir / Hadis / Tazkiyah/Adab / Fikih/Ushul" },
              book: { type: Type.STRING, description: "Nama kitab turats spesifik" },
              author: { type: Type.STRING, description: "Nama ulama penyusun" },
              text: { type: Type.STRING, description: "Kutipan teks Arab perkataan ulama" },
              translation: { type: Type.STRING, description: "Terjemahan Indonesia" },
              relevance: { type: Type.STRING, description: "Relevansi penjelasan ulama tersebut dengan sub-tema" }
            },
            required: ["field", "book", "author", "text", "translation", "relevance"]
          },
          description: "Minimal 3 kutipan ulama dari kitab-kitab turats terkenal"
        },
        scientificCaution: {
          type: Type.STRING,
          description: "Peringatan ilmiah penting tentang kehati-hatian mengutip, derajat sanad hadis, atau nasihat verifikasi bagi penceramah"
        },
        draft: {
          type: Type.STRING,
          description: "Draft naskah ceramah lengkap yang siap dibacakan, ditulis dengan bahasa Indonesia yang sangat persuasif, mengalir, indah, dan menyertakan pembuka (mukaddimah), pembahasan poin-poin dalil di atas secara menyatu, serta penutup doa. Gunakan gaya bahasa/audiens yang dipilih secara penuh."
        }
      },
      required: [
        "themeName", "style", "expandedKeywords", "summary", "points",
        "verses", "hadiths", "atsars", "qauls", "scientificCaution", "draft"
      ]
    };

    const candidateModels = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    
    let lastError: any = null;
    let successResponse = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.2,
          },
        });
        successResponse = response;
        break;
      } catch (err: any) {
        lastError = err;
        const errStr = (JSON.stringify(err) + " " + (err.message || "")).toLowerCase();
        
        if (
          errStr.includes("api_key_invalid") || 
          errStr.includes("api key not valid") || 
          errStr.includes("invalid api key") ||
          errStr.includes("401") ||
          err.status === 401
        ) {
          // Immediately fail on invalid API key
          return res.status(401).json({ error: "API key tidak valid atau tidak memiliki akses ke Gemini API." });
        }
        
        if (errStr.includes("429") || errStr.includes("quota") || errStr.includes("exhausted")) {
           return res.status(429).json({ error: "Kuota Gemini API Anda telah habis atau batas permintaan sedang tercapai. Periksa penggunaan API pada akun Google Anda." });
        }
        
        if (
          err.status === "NOT_FOUND" ||
          errStr.includes("404") ||
          errStr.includes("not found")
        ) {
          continue; // Try next model
        }
        
        // Let other errors pass to next model or final catch
      }
    }

    if (!successResponse) {
        throw lastError;
    }

    const text = successResponse.text;
    if (!text) {
      throw new Error("Gagal menghasilkan konten dari AI.");
    }

    const parsedData = JSON.parse(text.trim());
    return res.status(200).json(parsedData);

  } catch (error: any) {
    let errorMsg = "Layanan Gemini belum dapat memproses permintaan. Silakan coba kembali beberapa saat lagi.";
    let statusCode = 500;
    const errLower = (error.message || "").toLowerCase();

    if (
      errLower.includes("api key") ||
      errLower.includes("api_key_invalid") ||
      errLower.includes("not valid") ||
      error.status === 400 ||
      error.status === 401
    ) {
      statusCode = 401;
      errorMsg = "API key tidak valid atau tidak memiliki akses ke Gemini API.";
    } else if (errLower.includes("429") || errLower.includes("quota") || errLower.includes("exhausted")) {
       statusCode = 429;
       errorMsg = "Kuota Gemini API Anda telah habis atau batas permintaan sedang tercapai. Periksa penggunaan API pada akun Google Anda.";
    } else if (errLower.includes("fetch") || errLower.includes("network")) {
       statusCode = 502;
       errorMsg = "Koneksi ke layanan AI gagal. Periksa internet Anda dan coba kembali.";
    }

    return res.status(statusCode).json({ error: errorMsg });
  }
}
