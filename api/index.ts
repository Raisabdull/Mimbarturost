/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Function to get GoogleGenAI instance using custom key or env var
function getAiClient(customApiKey?: string): GoogleGenAI {
  const keyToUse = customApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!keyToUse) {
    throw new Error("API Key Google AI Studio belum diatur. Silakan masukkan API Key Anda di Pengaturan API Key (tombol di pojok kanan atas).");
  }
  return new GoogleGenAI({
    apiKey: keyToUse,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Middleware to normalize Netlify & Vercel function path routing
app.use((req, res, next) => {
  let url = req.url || "/";
  if (url.startsWith("/.netlify/functions/api")) {
    url = url.replace("/.netlify/functions/api", "");
  }
  if (url.startsWith("/api") && url.length > 4) {
    // Keep both /api/generate-ceramah and /generate-ceramah available
  }
  if (!url || url === "") url = "/";
  req.url = url;
  next();
});

// API to generate sermon material (supports Netlify, Vercel, and local dev)
app.post(
  [
    "/api/generate-ceramah",
    "/generate-ceramah",
    "/.netlify/functions/api/generate-ceramah",
    "/.netlify/functions/api/api/generate-ceramah"
  ],

  async (req, res) => {
    try {
      const body = req.body || {};
      const { theme, style } = body;
      const userApiKey = body.userApiKey;
      const headerApiKey = req.headers ? (req.headers["x-api-key"] as string | undefined) : undefined;
      const apiKeyToUse = (typeof userApiKey === "string" && userApiKey.trim()) 
        ? userApiKey.trim() 
        : ((typeof headerApiKey === "string" && headerApiKey.trim()) ? headerApiKey.trim() : undefined);

      if (!theme) {
        return res.status(400).json({ error: "Tema ceramah harus diisi." });
      }

      const ai = getAiClient(apiKeyToUse);

      const systemInstruction = `Anda adalah seorang Senior Ulama Akademisi dan Ahli Metodologi Dakwah yang menguasai Kitab-Kitab Turats klasik (Tafsir, Hadis, Fikih, Tazkiyatun Nufus). 
Tugas Anda adalah membantu seorang dai atau ustadz menyusun kerangka dan materi ceramah yang akurat, sistematis, dan kaya akan kutipan teks Arab asli beserta sumber kitabnya yang valid.

Batas & Aturan Ketat:
1. JANGAN PERNAH MENGARANG atau MEMALSUKAN dalil (hadis, ayat, atau qaul ulama). Jika referensi nomor atau bab tidak pasti, tandai dengan "Perlu verifikasi" atau berikan nama bab/kitab besarnya yang umum secara akurat.
2. Setiap ayat, hadis, atsar, and qaul ulama WAJIB menyertakan teks Arab asli dan terjemahannya dalam Bahasa Indonesia yang benar dan indah.
3. Kategori status hadis harus jelas: 'Shahih', 'Hasan', 'Dhaif', atau 'Perlu Verifikasi'. Jangan gunakan hadis dhaif ekstrim atau maudhu' (palsu).
4. Sediakan 'Catatan Kehati-hatian Ilmiah' (scientificCaution) yang mengingatkan penceramah tentang kedalaman ilmu, derajat hadis, atau perbedaan pendapat fikhiah jika ada pada tema terkait.
5. Anda harus mengelompokkan qaul ulama ke dalam bidangnya masing-masing secara akurat.
6. Buat draf naskah ceramah (draft) yang utuh sesuai dengan gaya bahasa/audiens yang dipilih pengguna:
   - "Formal akademik": Menggunakan argumen logis, bahasa baku, runut, ilmiah, dan sistematika penulisan karya ilmiah.
   - "Bahasa masjid umum": Sangat menyentuh hati (tazkiyah), komunikatif, menggunakan analogi sehari-hari, berfokus pada amal shalih.
   - "Bahasa majelis taklim ibu-ibu": Fokus pada keharmonisan keluarga, mendidik anak, kehidupan praktis, menggunakan nada yang lembut dan sabar.
   - "Bahasa anak muda": Gaul tapi santun (menyapa dengan 'teman-teman', 'sahabat muda', dll), mengaitkan dengan isu kesehatan mental, masa depan, hubungan, dan tren terkini tanpa kehilangan kesakralan dalil.
   - "Bahasa khutbah Jumat": Naskah khutbah Jumat lengkap dan siap dibacakan, terdiri dari khutbah pertama dan kedua.
     Prinsip wajib khutbah Jumat:
     1) Memenuhi rukun khutbah (hamdalah, syahadat, shalawat, wasiat takwa, ayat Al-Qur’an di salah satu khutbah, dan doa ampunan kaum muslimin di khutbah kedua).
     2) Dalil Al-Qur’an wajib disebutkan lengkap dengan nama surah dan ayat (contoh: QS. Al-Baqarah: 183).
     3) Hadits disampaikan dengan redaksi makna (tanpa nomor jika tidak yakin seratus persen).
     4) Nada penyampaian harus tenang, bijak, merangkul, dan tidak menghakimi jamaah.
     5) Menggunakan bahasa lisan yang menyentuh hati, tenang, berwibawa, dan membumi.
     Struktur naskah (draft) untuk Khutbah Jumat wajib dipisahkan dengan pemisah baris yang jelas dan harus runut mengikuti elemen berikut:
     * Judul Khutbah
     * Tujuan Khutbah
     * Ringkasan Poin Utama (Gunakan bullet list)
     * Naskah Khutbah Pertama (Lengkap dengan pembuka hamdalah, syahadat, shalawat, wasiat takwa, isi materi & dalil)
     * Transisi Duduk Di Antara Dua Khutbah (Instruksi singkat bagi khatib)
     * Naskah Khutbah Kedua (Lengkap dengan hamdalah, shalawat, wasiat takwa, dan wasiat penutup)
     * Doa Penutup (Doa ampunan berbahasa Arab lengkap dengan harakat untuk umat Islam)
     * Catatan Singkat untuk Khatib (Tips praktis intonasi & penekanan)
     
     Aturan Pemisahan Alinea (Sangat Penting):
     Setiap bagian dan antar-alinea (paragraf) naskah ceramah atau naskah khutbah apa pun WAJIB dipisahkan dengan JEDA YANG JELAS menggunakan baris baru ganda (\n\n) yang sesungguhnya di dalam string. JANGAN PERNAH menyatukan paragraf-paragraf yang berbeda menjadi satu blok teks panjang atau menyisipkan karakter literal escape backslash seperti "\\n\\n" secara teks mentah dalam output, melainkan gunakan pemisah baris ganda yang riil agar paragraf terpisah secara alami dan rapi.
   - "Bahasa kultum 7 menit": Padat, ringkas, langsung ke poin utama dengan 1 ayat dan 1 hadis kunci, bahasa yang cepat dipahami.
   - "Bahasa ceramah 30 menit": Pembahasan mendalam, terperinci, mengeksplorasi latar belakang masalah, asbabun nuzul/wurud jika ada, dan penjabaran qaul ulama yang luas.
   - "Bahasa dosen/kajian kampus": Bahasa analitis, mengintegrasikan sains atau sosiologi modern dengan nilai turats, memicu pemikiran kritis.`;

      const prompt = `Buatlah draf bahan ceramah lengkap berdasarkan parameter berikut:
Tema Ceramah: "${theme}"
Gaya Bahasa/Audiens: "${style || "Bahasa masjid umum"}"

Berikan respon dalam format JSON yang valid dan lengkap sesuai skema yang diminta, jangan ada yang kosong.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          themeName: { type: Type.STRING },
          style: { type: Type.STRING },
          expandedKeywords: {
            type: Type.OBJECT,
            properties: {
              indonesian: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Perluasan kata kunci bahasa Indonesia yang relevan dengan tema (minimal 5 kata)"
              },
              arabic: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Perluasan kata kunci bahasa Arab yang tepat dan umum di kitab turats (minimal 5 kata, contoh: الصber, Şukr)"
              }
            },
            required: ["indonesian", "arabic"]
          },
          summary: { 
            type: Type.STRING,
            description: "Ringkasan esensi tema secara filosofis dan teologis (1 paragraf mendalam)"
          },
          points: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Poin-poin atau sub-materi utama ceramah (minimal 5 poin)"
          },
          verses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "Teks Arab ayat Al-Qur'an lengkap dengan harakat" },
                translation: { type: Type.STRING, description: "Terjemahan Indonesia resmi Kemenag" },
                reference: { type: Type.STRING, description: "Nama Surah dan Nomor Ayat (contoh: QS. Al-Baqarah: 153)" },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Kata kunci yang cocok" },
                relevance: { type: Type.STRING, description: "Mengapa ayat ini relevan dengan tema" },
                tafsir: { type: Type.STRING, description: "Penjelasan ringkas dari kitab tafsir klasik terkenal" },
                tafsirRef: { type: Type.STRING, description: "Rujukan kitab tafsir (contoh: Tafsir Ibn Katsir atau Tafsir Al-Qurthubi)" }
              },
              required: ["text", "translation", "reference", "keywords", "relevance", "tafsir", "tafsirRef"]
            },
            description: "Minimal 3 ayat Al-Qur'an yang sangat relevan"
          },
          hadiths: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "Teks Arab hadis lengkap dengan harakat" },
                translation: { type: Type.STRING, description: "Terjemahan Indonesia yang akurat" },
                source: { type: Type.STRING, description: "Kitab sumber utama (contoh: Shahih Bukhari, Shahih Muslim, Sunan Abi Dawud)" },
                number: { type: Type.STRING, description: "Nomor hadis atau nama bab jika nomor tidak pasti" },
                status: { type: Type.STRING, description: "Kategori kekuatan hadis: Shahih / Hasan / Dhaif / Perlu Verifikasi" },
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
                figure: { type: Type.STRING, description: "Nama sahabat atau tabi'in (contoh: Umar bin Khattab, Hasan Al-Bashri)" },
                text: { type: Type.STRING, description: "Kutipan teks Arab atau perkataannya" },
                translation: { type: Type.STRING, description: "Terjemahan Indonesia" },
                source: { type: Type.STRING, description: "Nama kitab rujukan turats (contoh: Hilyatul Auliya, Siyar A'lam An-Nubala)" },
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
                book: { type: Type.STRING, description: "Nama kitab turats spesifik (contoh: Ihya Ulumiddin, Madarijus Salikin, Fathul Bari)" },
                author: { type: Type.STRING, description: "Nama ulama penyusun (contoh: Imam Al-Ghazali, Ibnul Qayyim, Ibnu Hajar)" },
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

      // Multi-model fallback sequence for maximum reliability ("Sapu Jagat")
      const candidateModels = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];

      const generateWithRetry = async (retries = 2, initialDelay = 1500) => {
        let lastError: any = null;

        for (const modelName of candidateModels) {
          let delay = initialDelay;
          for (let attempt = 1; attempt <= retries; attempt++) {
            try {
              console.log(`Menghubungi Gemini API dengan model ${modelName} (Percobaan ${attempt}/${retries})...`);
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
              return response;
            } catch (err: any) {
              lastError = err;
              console.error(`Gagal dengan model ${modelName} pada percobaan ${attempt}:`, err.message || err);

              const errStr = (JSON.stringify(err) + " " + (err.message || "")).toLowerCase();
              
              // If model not found / 404 / deprecated / not available, immediately switch model
              if (
                err.status === "NOT_FOUND" ||
                errStr.includes("404") ||
                errStr.includes("not found") ||
                errStr.includes("tidak lagi tersedia") ||
                errStr.includes("deprecated")
              ) {
                console.warn(`Model ${modelName} tidak tersedia (404/Deprecated). Beralih ke model berikutnya...`);
                break; // Break inner loop to try next model in candidateModels
              }

              const isTransient =
                err.status === "UNAVAILABLE" ||
                errStr.includes("503") ||
                errStr.includes("high demand") ||
                errStr.includes("overloaded") ||
                errStr.includes("spikes in demand") ||
                errStr.includes("temporary") ||
                errStr.includes("429") ||
                errStr.includes("resource_exhausted");

              if (attempt === retries || !isTransient) {
                break; // try next candidate model
              }

              console.log(`Mengalami kendala sementara (${modelName}). Menunggu ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              delay *= 1.5;
            }
          }
        }
        throw lastError;
      };

      const isServerless =
        Boolean(process.env.IS_SERVERLESS) ||
        Boolean(process.env.NETLIFY) ||
        Boolean(process.env.VERCEL);

      const maxRetries = isServerless ? 2 : 3;
      const initialDelay = isServerless ? 1000 : 2000;

      const result = await generateWithRetry(maxRetries, initialDelay);

      const text = result.text;
      if (!text) {
        throw new Error("Gagal menghasilkan konten dari AI.");
      }

      const parsedData = JSON.parse(text.trim());
      res.json(parsedData);
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      let errorMsg = error.message || "Terjadi kesalahan internal pada server.";
      let statusCode = 500;

      const errLower = errorMsg.toLowerCase();
      if (
        errLower.includes("api key") ||
        errLower.includes("api_key_invalid") ||
        errLower.includes("not valid") ||
        error.status === 400 ||
        error.status === 401
      ) {
        statusCode = 401;
        if (errLower.includes("api_key_invalid") || errLower.includes("not valid") || errLower.includes("invalid")) {
          errorMsg = "API Key Google AI Studio yang dimasukkan tidak valid. Silakan periksa kembali di Pengaturan API Key (tombol di kanan atas).";
        }
      }

      res.status(statusCode).json({ error: errorMsg });
    }
  }
);

// Fallback JSON 404 handler for unmatched /api routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: `Endpoint API (${req.originalUrl || req.url}) tidak ditemukan.` });
});

// Serve static assets or configure Vite/Vercel (only in local non-serverless environment)
async function startServer() {
  const isServerless =
    Boolean(process.env.IS_SERVERLESS) ||
    Boolean(process.env.NETLIFY) ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.LAMBDA_TASK_ROOT);

  if (!isServerless) {
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
}

startServer();

export default app;

