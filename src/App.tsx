/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent, MouseEvent } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import {
  Search,
  BookOpen,
  Award,
  FileText,
  Download,
  Printer,
  History,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Volume2,
  VolumeX,
  Trash2,
  ChevronRight,
  Menu,
  X,
  HelpCircle,
  FileSpreadsheet,
  Info,
  KeyRound,
  ExternalLink
} from "lucide-react";
import { SermonMaterial, SermonHistoryItem } from "./types";

const SUGGESTED_THEMES = [
  { title: "Sabar dan Syukur", desc: "Dua pilar utama kedamaian & keteguhan hati seorang mukmin." },
  { title: "Adab Menuntut Ilmu", desc: "Keberkahan ilmu berawal dari adab yang mulia sebelum ilmu." },
  { title: "Birrul Walidain (Bakti Orang Tua)", desc: "Kunci meraih ridha Allah melalui pengabdian tulus." },
  { title: "Bahaya Lisan & Fitnah Ghibah", desc: "Menjaga kehormatan diri dan persaudaraan sesama muslim." },
  { title: "Sedekah & Keberkahan Rezeki", desc: "Bagaimana kedermawanan melapangkan harta dan menyucikan jiwa." }
];

const SPEECH_STYLES = [
  { id: "Bahasa masjid umum", name: "Masjid Umum", desc: "Sederhana, hangat, tazkiyah (menyentuh kalbu), & aplikatif." },
  { id: "Bahasa khutbah Jumat", name: "Khutbah Jumat", desc: "Wibawa, khidmat, dimulai rukun khutbah (puji-pujian Arab)." },
  { id: "Bahasa majelis taklim ibu-ibu", name: "Majelis Ibu-ibu", desc: "Lembut, fokus keluarga, mendidik anak, penuh teladan." },
  { id: "Bahasa anak muda", name: "Anak Muda / Remaja", desc: "Komunikatif, santai, relevan isu mental health & tren." },
  { id: "Bahasa kultum 7 menit", name: "Kultum Kilat", desc: "Padat, to-the-point, fokus pada satu ayat & hadis utama." },
  { id: "Bahasa ceramah 30 menit", name: "Kajian Panjang", desc: "Komprehensif, kupas tuntas latar belakang, tafsir luas." },
  { id: "Formal akademik", name: "Formal Akademik", desc: "Bahasa baku, ilmiah, runut teologis, cocok untuk seminar." },
  { id: "Bahasa dosen/kajian kampus", name: "Kajian Ilmiah Kampus", desc: "Analitis kritis, integrasi dalil turats dengan sains modern." }
];

const LOADING_QUOTES = [
  { quote: "Barangsiapa menempuh suatu jalan untuk mencari ilmu, maka Allah akan memudahkan baginya jalan menuju surga.", source: "HR. Muslim" },
  { quote: "Al-Ilmu qabla al-qawl wa al-amal (Ilmu itu sebelum berkata dan beramal).", source: "Imam Bukhari" },
  { quote: "Ilmu tidak akan diperoleh kecuali dengan kesabaran, kerendahan hati, dan waktu yang lapang.", source: "Ulama Salaf" },
  { quote: "Belajarlah adab sebelum kamu mempelajari suatu ilmu.", source: "Imam Malik" },
  { quote: "Sesungguhnya para ulama adalah pewaris para nabi.", source: "HR. Abu Dawud" }
];

export default function App() {
  const [themeInput, setThemeInput] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("Bahasa masjid umum");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMaterial, setCurrentMaterial] = useState<SermonMaterial | null>(null);
  const [history, setHistory] = useState<SermonHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"summary" | "quran" | "hadith" | "atsar" | "qaul" | "draft" | "caution">("summary");
  
  // UI states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // API Key States
  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
  // TTS (Text to Speech) State
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Rotate loading quotes
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setQuoteIndex((prev) => (prev + 1) % LOADING_QUOTES.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Load history & API Key from localStorage on mount
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("gemini_api_key");
      if (savedKey) {
        setApiKey(savedKey);
        setApiKeyInput(savedKey);
      }
      const stored = localStorage.getItem("turats_sermon_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
      synthRef.current = window.speechSynthesis;
    } catch (e) {
      console.error("Gagal memuat data dari penyimpanan lokal", e);
    }
  }, []);

  const handleSaveApiKey = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = apiKeyInput.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem("gemini_api_key", trimmed);
      triggerNotification("API Key berhasil disimpan!");
    } else {
      localStorage.removeItem("gemini_api_key");
      triggerNotification("API Key dihapus dari browser.");
    }
    setShowApiKeyModal(false);
  };

  // Save history to localStorage
  const saveHistoryToLocalStorage = (newHistory: SermonHistoryItem[]) => {
    try {
      localStorage.setItem("turats_sermon_history", JSON.stringify(newHistory));
    } catch (e) {
      console.error("Gagal menyimpan histori", e);
    }
  };

  const triggerNotification = (message: string) => {
    setShowNotification(message);
    setTimeout(() => {
      setShowNotification(null);
    }, 3000);
  };

  const stopTts = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsPlayingTts(false);
    }
  };

  const handleTtsPlayback = () => {
    if (!currentMaterial || !synthRef.current) return;

    if (isPlayingTts) {
      stopTts();
      return;
    }

    // Filter Arabic tags or clean text slightly for TTS
    const cleanText = currentMaterial.draft
      .replace(/[\u0600-\u06FF]/g, "") // Remove arabic characters to make Indonesian voice smooth
      .replace(/\s+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "id-ID"; // Indonesian Voice
    utterance.rate = 1.0;
    
    utterance.onend = () => {
      setIsPlayingTts(false);
    };

    utterance.onerror = () => {
      setIsPlayingTts(false);
    };

    utteranceRef.current = utterance;
    setIsPlayingTts(true);
    synthRef.current.speak(utterance);
  };

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const generateClientSide = async (theme: string, style: string, clientKey: string): Promise<SermonMaterial> => {
    if (!clientKey || !clientKey.trim()) {
      throw new Error("Layanan backend serverless sedang tidak merespons. Mohon masukkan Google AI Studio API Key Anda melalui tombol 'Kunci API' di pojok kanan atas untuk memproses kajian langsung dari browser Anda.");
    }

    const ai = new GoogleGenAI({
      apiKey: clientKey.trim(),
    });

    const systemInstruction = `Anda adalah seorang Senior Ulama Akademisi dan Ahli Metodologi Dakwah yang menguasai Kitab-Kitab Turats klasik (Tafsir, Hadis, Fikih, Tazkiyatun Nufus). 
Tugas Anda adalah membuat bahan rujukan ceramah ilmiah berdasarkan query tema.
Output HARUS berupa JSON valid sesuai schema.
Rujukan Kitab Turats yang wajib Anda gunakan (pilih minimal 3-5 kitab yang relevan):
- Tafsir: Tafsir Ath-Thabari, Tafsir Ibn Kathir, Tafsir Al-Qurthubi, Tafsir Al-Baghawi, Tafsir As-Sa'di, Tafsir Al-Munir.
- Hadis & Syarah: Sahih Al-Bukhari (Fathul Bari - Ibnu Hajar Al-Asqalani), Sahih Muslim (Al-Minhaj - An-Nawawi), Sunan Abu Dawud (Awn al-Ma'bud), Jami' at-Tirmidhi (Tuhfat al-Ahwadhi).
- Fikih & Ushul: Al-Majmu' Syarh Al-Muhadzdzab, Al-Mughni (Ibnu Qudamah), Bidayatul Mujtahid (Ibnu Rusyd), Al-Umm (Imam Asy-Syafi'i).
- Tazkiyah, Tasawuf & Akhlak: Ihya 'Ulumuddin (Imam Al-Ghazali), Madarijus Salikin (Ibnul Qayyim), Siyar A'lam An-Nubala (Adz-Dzahabi), Minhajul Qashidin (Ibnu Qudamah Al-Maqdisi).`;

    const prompt = `Buatkan draf materi ceramah/khotbah ilmiah berdasarkan tema berikut: "${theme}". 
Gaya penyampaian/audiens yang diinginkan: "${style}".
Pastikan naskah kaya akan ayat Al-Qur'an (dengan sanad/tafsir), hadis shahih (dengan nama kitab & nomor/rawi), atsar sahabat, dan qaul ulama dari kitab-kitab turats bermutu.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        themeName: { type: Type.STRING, description: "Judul resmi materi ceramah yang menarik dan islami" },
        style: { type: Type.STRING, description: "Gaya penyampaian" },
        expandedKeywords: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "4-6 kata kunci akademik terkait tema ini dalam terminologi Islam/Arab"
        },
        summary: { type: Type.STRING, description: "Ringkasan eksekutif draf ceramah dalam 2-3 kalimat" },
        points: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3-4 poin utama pembahasan yang sistematis"
        },
        verses: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              surah: { type: Type.STRING, description: "Nama Surah dan Nomor Ayat" },
              arabic: { type: Type.STRING, description: "Teks Arab ayat lengkap dengan harakat" },
              translation: { type: Type.STRING, description: "Terjemahan ayat bahasa Indonesia" },
              tafsirSummary: { type: Type.STRING, description: "Ringkasan penjelasan tafsir turats" }
            },
            required: ["surah", "arabic", "translation", "tafsirSummary"]
          },
          description: "Minimal 2 ayat Al-Qur'an utama beserta tafsirnya"
        },
        hadiths: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              rawi: { type: Type.STRING, description: "Periwayat/Kitab Hadis" },
              arabic: { type: Type.STRING, description: "Teks Arab hadis" },
              translation: { type: Type.STRING, description: "Terjemahan bahasa Indonesia" },
              status: { type: Type.STRING, description: "Kualitas hadis dan penjelasan singkat syarah" }
            },
            required: ["rawi", "arabic", "translation", "status"]
          },
          description: "Minimal 2 hadis shahih/hasan beserta syarahnya"
        },
        atsars: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              figure: { type: Type.STRING, description: "Nama Sahabat Nabi" },
              text: { type: Type.STRING, description: "Teks Arab/Matan riwayat sahabat" },
              translation: { type: Type.STRING, description: "Terjemahan Indonesia" },
              source: { type: Type.STRING, description: "Kitab rujukan" }
            },
            required: ["figure", "text", "translation", "source"]
          },
          description: "Minimal 2 atsar/riwayat dari Sahabat Nabi RA"
        },
        qauls: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              field: { type: Type.STRING, description: "Bidang ilmu" },
              book: { type: Type.STRING, description: "Nama kitab turats spesifik" },
              author: { type: Type.STRING, description: "Nama ulama penyusun" },
              text: { type: Type.STRING, description: "Kutipan teks Arab perkataan ulama" },
              translation: { type: Type.STRING, description: "Terjemahan Indonesia" },
              relevance: { type: Type.STRING, description: "Relevansi penjelasan ulama" }
            },
            required: ["field", "book", "author", "text", "translation", "relevance"]
          },
          description: "Minimal 3 kutipan ulama dari kitab-kitab turats terkenal"
        },
        scientificCaution: { 
          type: Type.STRING, 
          description: "Peringatan ilmiah penting tentang kehati-hatian mengutip" 
        },
        draft: { 
          type: Type.STRING, 
          description: "Draft naskah ceramah lengkap yang siap dibacakan" 
        }
      },
      required: [
        "themeName", "style", "expandedKeywords", "summary", "points",
        "verses", "hadiths", "atsars", "qauls", "scientificCaution", "draft"
      ]
    };

    const candidateModels = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        console.log(`[Client-Side] Menghubungi Gemini API dengan model ${modelName}...`);
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

        if (response.text) {
          return JSON.parse(response.text.trim());
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Client-Side] Gagal dengan model ${modelName}:`, err.message || err);
        // Continue to try next candidate model
      }
    }

    throw lastError || new Error("Gagal menghasilkan konten dari seluruh pilihan model Gemini API.");
  };

  const handleGenerate = async (e?: FormEvent, customTheme?: string) => {
    if (e) e.preventDefault();
    const finalTheme = customTheme || themeInput;
    if (!finalTheme.trim()) {
      setError("Silakan masukkan tema atau kata kunci ceramah.");
      return;
    }

    setIsLoading(true);
    setError(null);
    stopTts();

    const effectiveApiKey = apiKey.trim() || (((import.meta as any).env?.VITE_GEMINI_API_KEY as string) || "").trim();

    try {
      let data: (SermonMaterial & { error?: string }) | null = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for serverless endpoint

        const response = await fetch("/api/generate-ceramah", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": effectiveApiKey,
          },
          body: JSON.stringify({
            theme: finalTheme,
            style: selectedStyle,
            userApiKey: effectiveApiKey,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          data = await response.json().catch(() => null);
        }

        if (!response.ok || !data || data.error) {
          throw new Error(data?.error || `Serverless response status ${response.status}`);
        }
      } catch (serverErr: any) {
        console.warn("Backend serverless tidak merespons JSON atau timeout, beralih ke direct client generation...", serverErr);
        if (effectiveApiKey) {
          data = await generateClientSide(finalTheme, selectedStyle, effectiveApiKey);
        } else {
          setApiKeyInput(apiKey);
          setShowApiKeyModal(true);
          throw new Error("Layanan backend serverless (Netlify) tidak merespons atau melebihi batas waktu (timeout). Silakan isi Google AI Studio API Key Anda pada tombol 'Kunci API' di kanan atas untuk memproses kajian langsung dari browser (Client-Side).");
        }
      }

      if (!data) {
        throw new Error("Gagal memproses naskah ceramah.");
      }

      if (data && data.draft) {
        // Gantikan literal backslash 'n' dengan karakter baris baru sesungguhnya jika ada
        data.draft = data.draft.replace(/\\n/g, "\n");
      }
      setCurrentMaterial(data);

      setActiveTab("summary");
      
      // Save to history list
      const newItem: SermonHistoryItem = {
        id: Date.now().toString(),
        theme: data.themeName,
        style: data.style,
        timestamp: new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        material: data,
      };

      const updatedHistory = [newItem, ...history.filter(h => h.theme.toLowerCase() !== data.themeName.toLowerCase())].slice(0, 15);
      setHistory(updatedHistory);
      saveHistoryToLocalStorage(updatedHistory);
      
      if (themeInput === "") {
        setThemeInput(data.themeName);
      }
      triggerNotification("Bahan ceramah berhasil disusun!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi masalah koneksi atau kegagalan AI.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadHistory = (item: SermonHistoryItem) => {
    if (item.material && item.material.draft) {
      item.material.draft = item.material.draft.replace(/\\n/g, "\n");
    }
    setCurrentMaterial(item.material);
    setThemeInput(item.theme);
    setSelectedStyle(item.style);
    setActiveTab("summary");
    stopTts();
    setSidebarOpen(false);
    triggerNotification(`Memuat bahan: ${item.theme}`);
  };

  const handleDeleteHistoryItem = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    const filtered = history.filter((h) => h.id !== id);
    setHistory(filtered);
    saveHistoryToLocalStorage(filtered);
    triggerNotification("Histori dihapus");
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    triggerNotification(`${type} disalin ke papan klip!`);
  };

  // Export as Markdown File
  const exportMarkdown = () => {
    if (!currentMaterial) return;
    
    let md = `# Bahan Ceramah: ${currentMaterial.themeName}\n`;
    md += `*Gaya Ceramah: ${currentMaterial.style} | Disusun oleh Mimbar Turats AI*\n\n`;
    md += `## 1. Ringkasan Tema\n${currentMaterial.summary}\n\n`;
    
    md += `## 2. Poin-poin Utama\n`;
    currentMaterial.points.forEach(p => { md += `- ${p}\n`; });
    md += `\n`;
    
    md += `## 3. Dalil Al-Qur'an\n`;
    currentMaterial.verses.forEach(v => {
      md += `### ${v.reference}\n`;
      md += `\`\`\`arabic\n${v.text}\n\`\`\`\n`;
      md += `> "Artinya: ${v.translation}"\n\n`;
      md += `* **Relevansi:** ${v.relevance}\n`;
      md += `* **Tafsir (${v.tafsirRef}):** ${v.tafsir}\n\n`;
    });
    
    md += `## 4. Hadis Nabi\n`;
    currentMaterial.hadiths.forEach(h => {
      md += `### ${h.source} (No. ${h.number || '-'})\n`;
      md += `*Status: ${h.status}*\n`;
      md += `\`\`\`arabic\n${h.text}\n\`\`\`\n`;
      md += `> "Artinya: ${h.translation}"\n\n`;
      md += `* **Penjelasan:** ${h.explanation}\n\n`;
    });
    
    md += `## 5. Atsar Sahabat & Tabi'in\n`;
    currentMaterial.atsars.forEach(a => {
      md += `### Tokoh: ${a.figure} (Sumber: ${a.source})\n`;
      md += `\`\`\`arabic\n${a.text}\n\`\`\`\n`;
      md += `> "Artinya: ${a.translation}"\n\n`;
      md += `* **Relevansi:** ${a.relevance}\n\n`;
    });
    
    md += `## 6. Qaul Ulama Turats\n`;
    currentMaterial.qauls.forEach(q => {
      md += `### Ulama: ${q.author} (Kitab: ${q.book} - ${q.field})\n`;
      md += `\`\`\`arabic\n${q.text}\n\`\`\`\n`;
      md += `> "Artinya: ${q.translation}"\n\n`;
      md += `* **Relevansi:** ${q.relevance}\n\n`;
    });
    
    md += `## 7. Catatan Kehati-hatian Ilmiah\n> ⚠️ ${currentMaterial.scientificCaution}\n\n`;
    md += `## 8. Draf Naskah Ceramah Utuh\n${currentMaterial.draft}\n`;
    
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bahan_Ceramah_${currentMaterial.themeName.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerNotification("File Markdown (.md) berhasil diunduh.");
  };

  // Export as Word Document
  const exportWord = () => {
    if (!currentMaterial) return;

    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${currentMaterial.themeName}</title>
        <style>
          body { font-family: 'Georgia', 'Times New Roman', serif; line-height: 1.6; color: #1f2937; margin: 30px; }
          h1 { color: #166534; font-size: 24pt; border-bottom: 2px solid #b45309; padding-bottom: 8px; }
          .meta { color: #6b7280; font-size: 10pt; margin-bottom: 20px; font-style: italic; }
          .section-title { font-size: 16pt; font-weight: bold; color: #14532d; margin-top: 30px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
          .arabic { font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 20pt; text-align: right; direction: rtl; margin: 15px 0; line-height: 1.8; color: #111827; }
          .translation { font-style: italic; color: #374151; margin-bottom: 12px; font-size: 11pt; }
          .card { border: 1px solid #e5e7eb; padding: 15px; margin: 15px 0; background-color: #f9fafb; border-radius: 6px; }
          .caution { border-left: 4px solid #b45309; padding: 12px; background: #fffbeb; color: #78350f; font-size: 11pt; margin: 20px 0; }
          .points-list { margin: 15px 0; padding-left: 20px; }
          .points-list li { margin-bottom: 8px; font-size: 11pt; }
          .draft-box { white-space: pre-line; background: #fdfbf7; border: 1px solid #f59e0b; padding: 20px; font-size: 12pt; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>Bahan Penyusunan Ceramah: ${currentMaterial.themeName}</h1>
        <p class="meta">Gaya Ceramah: ${currentMaterial.style} | Tanggal Pembuatan: ${new Date().toLocaleDateString("id-ID")} | Disusun otomatis oleh Mimbar Turats AI</p>
        
        <div class="section-title">1. Ringkasan Tema</div>
        <p>${currentMaterial.summary}</p>

        <div class="section-title">2. Poin-poin Utama Ceramah</div>
        <ol class="points-list">
          ${currentMaterial.points?.map(p => `<li>${p}</li>`).join('') || ''}
        </ol>

        <div class="section-title">3. Dalil Al-Qur'an Terkait</div>
        ${currentMaterial.verses?.map(v => `
          <div class="card">
            <p><strong>Rujukan: ${v.reference}</strong></p>
            <p class="arabic">${v.text}</p>
            <p class="translation">"Artinya: ${v.translation}"</p>
            <p><strong>Relevansi:</strong> ${v.relevance}</p>
            <p><strong>Tafsir Ringkas (${v.tafsirRef}):</strong> ${v.tafsir}</p>
          </div>
        `).join('')}

        <div class="section-title">4. Hadis Nabi Terkait</div>
        ${currentMaterial.hadiths?.map(h => `
          <div class="card">
            <p><strong>Rujukan: ${h.source} ${h.number ? `(No. ${h.number})` : ''} - Status: ${h.status}</strong></p>
            <p class="arabic">${h.text}</p>
            <p class="translation">"Artinya: ${h.translation}"</p>
            <p><strong>Relevansi:</strong> ${h.relevance}</p>
            <p><strong>Syarah/Penjelasan:</strong> ${h.explanation}</p>
          </div>
        `).join('')}

        <div class="section-title">5. Atsar Sahabat & Tabi'in</div>
        ${currentMaterial.atsars?.map(a => `
          <div class="card">
            <p><strong>Tokoh: ${a.figure} | Rujukan Kitab: ${a.source}</strong></p>
            <p class="arabic">${a.text}</p>
            <p class="translation">"Artinya: ${a.translation}"</p>
            <p><strong>Relevansi Kutipan:</strong> ${a.relevance}</p>
          </div>
        `).join('')}

        <div class="section-title">6. Qaul Ulama Kitab Turats</div>
        ${currentMaterial.qauls?.map(q => `
          <div class="card">
            <p><strong>Ulama: ${q.author} | Kitab: ${q.book} (${q.field})</strong></p>
            <p class="arabic">${q.text}</p>
            <p class="translation">"Artinya: ${q.translation}"</p>
            <p><strong>Relevansi/Konteks:</strong> ${q.relevance}</p>
          </div>
        `).join('')}

        <div class="section-title">7. Catatan Kehati-hatian Ilmiah</div>
        <div class="caution">
          <strong>⚠️ PERINGATAN VERIFIKASI AKADEMIK:</strong>
          <p>${currentMaterial.scientificCaution}</p>
        </div>

        <div class="section-title">8. Draf Naskah Ceramah Lengkap (${currentMaterial.style})</div>
        <div class="draft-box" style="background: #fdfbf7; border: 1px solid #f59e0b; padding: 20px; font-size: 12pt; border-radius: 8px;">
          ${currentMaterial.draft
            .split(/\n\s*\n/)
            .map(p => {
              if (!p.trim()) return '';
              return `<p style="margin-bottom: 14px; text-indent: 0px; line-height: 1.6;">${p.trim().replace(/\n/g, '<br>')}</p>`;
            })
            .join('')
          }
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bahan_Ceramah_${currentMaterial.themeName.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerNotification("File Word (.doc) berhasil diunduh.");
  };

  // Export to PDF directly using html2pdf
  const handlePrint = () => {
    if (!currentMaterial) return;

    triggerNotification("Sedang menyiapkan file PDF...");

    const element = document.getElementById("printable-content");
    if (!element) {
      triggerNotification("Kesalahan: Elemen cetak tidak ditemukan.");
      return;
    }

    const opt = {
      margin:       [15, 15, 15, 15],
      filename:     `Bahan_Ceramah_${currentMaterial.themeName.replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true,
        letterRendering: true
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css'] }
    };

    // Create container and clone printable element
    const container = document.createElement("div");
    const clonedElement = element.cloneNode(true) as HTMLElement;
    
    // Remove printing-only classes so it is captured fully by html2canvas
    clonedElement.classList.remove("hidden", "print-only", "print:block");
    clonedElement.classList.add("block");
    clonedElement.style.display = "block";
    clonedElement.style.padding = "20px";
    clonedElement.style.color = "#111827";
    clonedElement.style.backgroundColor = "#ffffff";
    clonedElement.style.width = "100%";
    clonedElement.style.fontFamily = "'Georgia', 'Times New Roman', serif";

    // Add explicit styling to cloned elements to guarantee text alignment, fonts, and pagebreaks
    const style = document.createElement("style");
    style.innerHTML = `
      .page-break { page-break-before: always; break-before: page; margin-top: 20px; }
      .arabic-text { font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 20pt; line-height: 2.2; text-align: right; direction: rtl; margin: 15px 0; color: #111827; }
      h1, h2, h3 { font-family: 'Georgia', serif; color: #14532d; }
      .border-brand-900 { border-color: #14532d; }
      .text-brand-900 { color: #14532d; }
      .text-brand-950 { color: #052e16; }
      .bg-neutral-50 { background-color: #f9fafb; }
      .border-neutral-300 { border-color: #d1d5db; }
      p { line-height: 1.6; margin-bottom: 12px; }
    `;
    
    container.appendChild(style);
    container.appendChild(clonedElement);

    const html2pdfFunc = (window as any).html2pdf;
    if (html2pdfFunc) {
      html2pdfFunc()
        .set(opt)
        .from(container)
        .save()
        .then(() => {
          triggerNotification("File PDF berhasil diunduh.");
        })
        .catch((err: any) => {
          console.error("Gagal membuat PDF:", err);
          triggerNotification("Gagal mengunduh PDF. Mengalihkan ke menu cetak...");
          window.print();
        });
    } else {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800 font-sans flex flex-col antialiased">
      {/* Toast Notification */}
      {showNotification && (
        <div className="fixed top-4 right-4 z-50 bg-neutral-900 text-white py-3 px-5 rounded-lg shadow-xl flex items-center gap-3 border border-amber-500/30 text-sm animate-fade-in no-print">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{showNotification}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <header id="main-header" className="bg-gradient-to-r from-brand-900 via-brand-800 to-brand-900 text-white border-b-2 border-amber-500 py-4 px-4 sm:px-6 shadow-md sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              id="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-brand-800 transition lg:hidden"
              aria-label="Buka Histori"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="bg-amber-100 p-2 rounded-lg shrink-0">
              <BookOpen className="w-6 h-6 text-brand-900" />
            </div>
            <div>
              <h1 className="font-serif text-lg sm:text-2xl font-bold tracking-tight text-amber-100 flex items-center gap-2">
                Mimbar Turats <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">Dawah AI</span>
              </h1>
              <p className="text-xs text-emerald-100 font-medium hidden sm:block">Penyusun Bahan Ceramah Ilmiah berbasis Rujukan Kitab Turats</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono text-emerald-200">
            <button
              id="api-key-modal-trigger-btn"
              onClick={() => {
                setApiKeyInput(apiKey);
                setShowApiKeyModal(true);
              }}
              className="flex items-center gap-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-100 py-1.5 px-3 rounded-full font-medium border border-emerald-700/60 transition cursor-pointer shadow-sm"
              title="Pengaturan API Key Google AI Studio"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-sans text-xs">API Key</span>
              {apiKey ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="API Key Aktif"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" title="API Key Belum Diatur"></span>
              )}
            </button>

            <div className="hidden md:flex items-center gap-2 bg-brand-950/40 py-1.5 px-3 rounded-full border border-emerald-800">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <button
              id="desktop-history-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-brand-950 py-1.5 px-3 rounded-full font-semibold transition cursor-pointer"
            >
              <History className="w-4 h-4" />
              <span>Histori Kajian ({history.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto relative">
        
        {/* SIDEBAR (HISTORY LOGS) */}
        <aside
          id="history-sidebar"
          className={`
            fixed inset-y-0 left-0 z-50 w-80 bg-neutral-900 text-neutral-100 border-r border-neutral-800 p-6 flex flex-col justify-between transform transition-transform duration-300 lg:relative lg:translate-x-0 lg:z-30 no-print
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"}
          `}
        >
          <div>
            <div className="flex items-center justify-between pb-5 border-b border-neutral-800 mb-5">
              <div className="flex items-center gap-2 text-amber-400 font-serif font-bold text-lg">
                <History className="w-5 h-5 text-amber-500" />
                <span>Histori Penyusunan</span>
              </div>
              <button
                id="close-sidebar-btn"
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 transition lg:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
              {history.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-sm">
                  <p>Belum ada riwayat penyusunan bahan.</p>
                  <p className="text-xs mt-1">Coba ketik tema di panel utama untuk memulai.</p>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleLoadHistory(item)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition flex items-start justify-between gap-2 group
                      ${currentMaterial?.themeName.toLowerCase() === item.theme.toLowerCase()
                        ? "bg-brand-950/40 border-brand-500 text-amber-200"
                        : "bg-neutral-800/40 border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 text-neutral-300"
                      }
                    `}
                  >
                    <div className="space-y-1 overflow-hidden">
                      <p className="font-serif font-semibold text-sm truncate">{item.theme}</p>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <span className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 text-[10px] uppercase tracking-wider">{item.style.replace("Bahasa ", "")}</span>
                        <span className="truncate">{item.timestamp.split(',')[0]}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                      className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-800 text-xs text-neutral-500 space-y-2">
            <p className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Data disimpan lokal di browser Anda.</span>
            </p>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden no-print"
          />
        )}

        {/* MAIN WORKSPACE CONTENT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-hidden">
          
          {/* SEARCH & SETUP PANEL */}
          <section id="composer-setup-card" className="bg-white rounded-xl shadow-md border border-neutral-200 p-5 sm:p-6 no-print">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-600 animate-pulse" />
              <h2 className="font-serif text-lg sm:text-xl font-bold text-neutral-900">Mulai Menyusun Bahan Ceramah</h2>
            </div>
            
            <form onSubmit={(e) => handleGenerate(e)}>
              <div className="space-y-4">
                {/* Search Bar Input */}
                <div>
                  <label htmlFor="theme-search-input" className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                    1. Masukkan Tema atau Kata Kunci Ceramah
                  </label>
                  <div className="relative">
                    <input
                      id="theme-search-input"
                      type="text"
                      className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-300 rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-700 focus:bg-white font-medium"
                      placeholder="Contoh: Sabar dan syukur, Birrul Walidain, Adab menuntut ilmu..."
                      value={themeInput}
                      onChange={(e) => setThemeInput(e.target.value)}
                      disabled={isLoading}
                    />
                    <Search className="w-5 h-5 text-neutral-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                {/* Speech Style Select Grid */}
                <div>
                  <span className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                    2. Pilih Gaya Bahasa & Segmentasi Audiens
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {SPEECH_STYLES.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setSelectedStyle(style.id)}
                        disabled={isLoading}
                        className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer group h-20
                          ${selectedStyle === style.id
                            ? "bg-brand-50 border-brand-600 ring-1 ring-brand-600"
                            : "bg-neutral-50 hover:bg-neutral-100 border-neutral-200 hover:border-neutral-300"
                          }
                        `}
                      >
                        <span className={`text-xs font-bold transition ${selectedStyle === style.id ? "text-brand-900" : "text-neutral-700"}`}>
                          {style.name}
                        </span>
                        <span className="text-[10px] text-neutral-500 leading-tight block line-clamp-2">
                          {style.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Action Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    id="submit-generate-btn"
                    type="submit"
                    disabled={isLoading || !themeInput.trim()}
                    className="w-full sm:w-auto bg-brand-700 hover:bg-brand-800 disabled:bg-neutral-300 disabled:text-neutral-500 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>Susun Materi Sekarang</span>
                  </button>
                </div>
              </div>
            </form>

            {/* QUICK SUGGESTIONS PILLS */}
            <div className="mt-5 pt-4 border-t border-neutral-100">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-2">Rekomendasi Tema Klasik:</span>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_THEMES.map((theme, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setThemeInput(theme.title);
                      handleGenerate(undefined, theme.title);
                    }}
                    disabled={isLoading}
                    className="bg-neutral-100 hover:bg-amber-100 border border-neutral-200 hover:border-amber-300 text-neutral-700 hover:text-amber-900 py-1.5 px-3 rounded-full text-xs font-medium transition cursor-pointer text-left"
                    title={theme.desc}
                  >
                    {theme.title}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* LOADING STATE DISPLAY */}
          {isLoading && (
            <div id="loading-screen" className="bg-white rounded-xl shadow-md border border-neutral-200 p-8 sm:p-12 text-center space-y-6 no-print">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-neutral-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-brand-700 border-t-transparent rounded-full animate-spin"></div>
              </div>
              
              <div className="space-y-2 max-w-lg mx-auto">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-neutral-900">Menyisir Kitab Turats...</h3>
                <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
                  Kecerdasan Buatan (AI) sedang mengelompokkan ayat-ayat Al-Qur'an, menelusuri derajat hadis, mengumpulkan perkataan sahabat (atsar), serta menyusun draf khutbah yang mendalam untuk Anda.
                </p>
              </div>

              {/* Classical Learning quotes during load */}
              <div className="bg-neutral-50 border-l-4 border-amber-500 p-4 rounded-r-lg max-w-xl mx-auto text-left shadow-sm">
                <p className="text-xs font-mono text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3" />
                  Mutiara Ilmu Hikmah:
                </p>
                <blockquote className="text-sm font-medium text-neutral-700 italic">
                  "{LOADING_QUOTES[quoteIndex].quote}"
                </blockquote>
                <cite className="text-[10px] text-neutral-500 font-mono mt-1 block text-right">— {LOADING_QUOTES[quoteIndex].source}</cite>
              </div>
            </div>
          )}

          {/* ERROR HANDLER CARD */}
          {error && (
            <div id="error-card" className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-900 space-y-3 no-print">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <h4 className="font-bold text-sm sm:text-base">Gagal Memproses Kajian Turats</h4>
                  <p className="text-xs sm:text-sm leading-relaxed">{error}</p>
                </div>
              </div>
              
              <div className="pt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Coba Lagi (Hubungi AI Kembali)</span>
                </button>
              </div>

              {error.includes("GEMINI_API_KEY") && (
                <div className="bg-white border border-red-100 rounded-lg p-3 text-xs text-neutral-600 space-y-2">
                  <p className="font-semibold text-neutral-800">Bagaimana cara memperbaikinya?</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Buka menu <strong className="text-neutral-900">Settings &gt; Secrets</strong> di panel AI Studio UI Anda.</li>
                    <li>Tambahkan atau verifikasi kunci rahasia bernama <strong className="text-neutral-900">GEMINI_API_KEY</strong> dengan nilai API Key Google AI Studio Anda yang valid.</li>
                    <li>Setelah disimpan, coba kirim kembali pencarian Anda.</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* GENERATED MATERIAL WORKSPACE */}
          {currentMaterial && !isLoading && (
            <div id="generated-workspace" className="space-y-6">
              
              {/* MATERIAL CONTROL PANEL & EXPORT */}
              <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-brand-100 text-brand-800 border border-brand-200">
                      Rujukan Kitab Turats Terstruktur
                    </span>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                      {currentMaterial.style}
                    </span>
                  </div>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-neutral-900">{currentMaterial.themeName}</h3>
                </div>

                {/* Exports Panel */}
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <button
                    id="export-word-btn"
                    onClick={exportWord}
                    className="flex-1 sm:flex-initial bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Unduh file Microsoft Word"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Word (DOC)</span>
                  </button>
                  <button
                    id="export-markdown-btn"
                    onClick={exportMarkdown}
                    className="flex-1 sm:flex-initial bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Unduh file Markdown"
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>Markdown</span>
                  </button>
                  <button
                    id="print-pdf-btn"
                    onClick={handlePrint}
                    className="flex-1 sm:flex-initial bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2 px-4 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Cetak atau simpan ke PDF menggunakan cetak bawaan browser"
                  >
                    <Printer className="w-4 h-4 shrink-0" />
                    <span>Cetak PDF</span>
                  </button>
                </div>
              </div>

              {/* WORDING/KEYWORD EXPANSION INFO BAR */}
              <div className="bg-brand-900 text-brand-50 border-l-4 border-amber-500 rounded-r-lg p-4 shadow-sm space-y-2 no-print">
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono font-semibold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ekspansi Kata Kunci Tematik (AI Istilah Turats):</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div>
                    <span className="font-semibold text-neutral-300">Bahasa Indonesia:</span>
                    <p className="text-white mt-1 flex flex-wrap gap-1">
                      {currentMaterial.expandedKeywords?.indonesian?.map((k, i) => (
                        <span key={i} className="bg-brand-950/40 px-2 py-0.5 rounded border border-brand-800">{k}</span>
                      ))}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-300">Istilah Arab Turats (Bahasa Arab):</span>
                    <p className="text-white mt-1 flex flex-wrap gap-1 arabic-text justify-start font-serif leading-relaxed text-sm">
                      {currentMaterial.expandedKeywords?.arabic?.map((k, i) => (
                        <span key={i} className="bg-brand-950/40 px-2 py-0.5 rounded border border-brand-800 ml-1 font-arabic" dir="rtl">{k}</span>
                      ))}
                    </p>
                  </div>
                </div>
              </div>

              {/* TABS FOR MATERIAL TYPES */}
              <div className="no-print">
                <div className="flex border-b border-neutral-200 overflow-x-auto gap-1 scrollbar-none pb-px">
                  {[
                    { id: "summary", label: "Ringkasan & Poin", icon: BookOpen },
                    { id: "quran", label: "Dalil Al-Qur'an", icon: Award },
                    { id: "hadith", label: "Hadis Nabi", icon: FileText },
                    { id: "atsar", label: "Atsar Sahabat", icon: History },
                    { id: "qaul", label: "Qaul Ulama", icon: Clock },
                    { id: "draft", label: "Draf Ceramah", icon: Sparkles },
                    { id: "caution", label: "Peringatan Ilmiah", icon: AlertTriangle }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer
                          ${activeTab === tab.id
                            ? "border-brand-700 text-brand-900 bg-brand-50/50"
                            : "border-transparent text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
                          }
                        `}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${activeTab === tab.id ? "text-brand-700" : "text-neutral-400"}`} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TAB PANELS CONTAINER */}
              <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-5 sm:p-6 min-h-[400px] no-print">
                
                {/* 1. RINGKASAN & POIN */}
                {activeTab === "summary" && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="space-y-2">
                      <h4 className="font-serif text-lg font-bold text-brand-900 border-b pb-2">Ringkasan Teologis Tema</h4>
                      <p className="text-neutral-700 leading-relaxed text-sm sm:text-base first-letter:text-3xl first-letter:font-bold first-letter:text-brand-700 first-letter:mr-2 first-letter:float-left">
                        {currentMaterial.summary}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-serif text-lg font-bold text-brand-900 border-b pb-2">Sistematika Alur Ceramah (Poin Utama)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {currentMaterial.points?.map((pt, idx) => (
                          <div key={idx} className="flex gap-3 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium text-neutral-700">{pt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. DALIL AL-QUR'AN */}
                {activeTab === "quran" && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="font-serif text-lg font-bold text-brand-900">Rujukan Dalil Ayat Al-Qur'an</h4>
                      <span className="text-xs font-mono text-neutral-500 bg-neutral-100 px-2 py-1 rounded">
                        {currentMaterial.verses.length} Ayat Terkait
                      </span>
                    </div>

                    <div className="space-y-6">
                      {currentMaterial.verses?.map((verse, idx) => (
                        <div key={idx} className="p-4 sm:p-5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <span className="font-serif font-bold text-brand-900 text-base sm:text-lg bg-amber-100/60 px-3 py-1 rounded-lg border border-amber-200 flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-brand-800" />
                              {verse.reference}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {verse.keywords?.map((kw, kIdx) => (
                                <span key={kIdx} className="bg-neutral-200 text-neutral-700 text-[10px] px-2 py-0.5 rounded font-medium">
                                  #{kw}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Arabic Verse text with customized Amiri Font */}
                          <div className="arabic-text bg-white p-4 rounded-lg border border-neutral-100 shadow-inner text-xl sm:text-2xl text-neutral-900 my-2 font-arabic font-bold text-right" dir="rtl">
                            {verse.text}
                          </div>

                          {/* Translation */}
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Terjemahan Indonesia:</span>
                            <blockquote className="text-sm sm:text-base text-neutral-700 italic border-l-4 border-amber-400 pl-3">
                              "Artinya: {verse.translation}"
                            </blockquote>
                          </div>

                          {/* Relevance */}
                          <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-xs sm:text-sm">
                            <strong className="text-emerald-900 block font-bold mb-1">Hubungan dengan Tema:</strong>
                            <p className="text-neutral-700 leading-relaxed">{verse.relevance}</p>
                          </div>

                          {/* Tafsir Rujukan */}
                          <div className="bg-white p-3 rounded-lg border border-neutral-200 text-xs sm:text-sm space-y-2">
                            <div className="flex items-center gap-1 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                              <span>Catatan Tafsir ({verse.tafsirRef})</span>
                            </div>
                            <p className="text-neutral-700 leading-relaxed italic">
                              "{verse.tafsir}"
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. HADIS NABI */}
                {activeTab === "hadith" && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="font-serif text-lg font-bold text-brand-900">Rujukan Dalil Hadis Nabi</h4>
                      <span className="text-xs font-mono text-neutral-500 bg-neutral-100 px-2 py-1 rounded">
                        {currentMaterial.hadiths.length} Hadis Terpilih
                      </span>
                    </div>

                    <div className="space-y-6">
                      {currentMaterial.hadiths?.map((hadith, idx) => (
                        <div key={idx} className="p-4 sm:p-5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="space-y-1">
                              <span className="font-serif font-bold text-brand-900 text-base sm:text-lg bg-amber-100/60 px-3 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                                {hadith.source}
                                {hadith.number && <span className="text-xs text-neutral-500 font-mono">No. {hadith.number}</span>}
                              </span>
                            </div>
                            {/* Hadith strength badge */}
                            <span className={`text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-full border
                              ${hadith.status.toLowerCase() === "shahih"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : hadith.status.toLowerCase() === "hasan"
                                  ? "bg-blue-100 text-blue-800 border-blue-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              }
                            `}>
                              {hadith.status}
                            </span>
                          </div>

                          {/* Arabic text */}
                          <div className="arabic-text bg-white p-4 rounded-lg border border-neutral-100 shadow-inner text-xl sm:text-2xl text-neutral-900 my-2 font-arabic font-bold text-right" dir="rtl">
                            {hadith.text}
                          </div>

                          {/* Translation */}
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Terjemahan Indonesia:</span>
                            <blockquote className="text-sm sm:text-base text-neutral-700 italic border-l-4 border-amber-400 pl-3">
                              "Artinya: {hadith.translation}"
                            </blockquote>
                          </div>

                          {/* Hadith relevance */}
                          <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-xs sm:text-sm">
                            <strong className="text-emerald-900 block font-bold mb-1">Hubungan dengan Tema:</strong>
                            <p className="text-neutral-700 leading-relaxed">{hadith.relevance}</p>
                          </div>

                          {/* Explanation/Syarah */}
                          <div className="bg-white p-3 rounded-lg border border-neutral-200 text-xs sm:text-sm space-y-1.5">
                            <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider block">Syarah / Penjelasan Kedalaman Makna:</span>
                            <p className="text-neutral-700 leading-relaxed">{hadith.explanation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. ATSAR SAHABAT */}
                {activeTab === "atsar" && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="font-serif text-lg font-bold text-brand-900">Perkataan Sahabat Nabi & Tabi'in (Atsar)</h4>
                      <span className="text-xs font-mono text-neutral-500 bg-neutral-100 px-2 py-1 rounded">
                        {currentMaterial.atsars.length} Atsar Klasik
                      </span>
                    </div>

                    <div className="space-y-6">
                      {currentMaterial.atsars?.map((atsar, idx) => (
                        <div key={idx} className="p-4 sm:p-5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <span className="font-serif font-bold text-neutral-900 text-base sm:text-lg">
                              {atsar.figure}
                            </span>
                            <span className="text-xs font-mono text-neutral-500 bg-neutral-200/60 px-2 py-0.5 rounded">
                              Kitab Rujukan: {atsar.source}
                            </span>
                          </div>

                          {/* Arabic text */}
                          <div className="arabic-text bg-white p-4 rounded-lg border border-neutral-100 shadow-inner text-xl sm:text-2xl text-neutral-900 my-2 font-arabic text-right" dir="rtl">
                            {atsar.text}
                          </div>

                          {/* Translation */}
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Terjemahan Indonesia:</span>
                            <blockquote className="text-sm sm:text-base text-neutral-700 italic border-l-4 border-amber-400 pl-3">
                              "Artinya: {atsar.translation}"
                            </blockquote>
                          </div>

                          {/* Relevance */}
                          <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-xs sm:text-sm">
                            <strong className="text-emerald-900 block font-bold mb-1">Relevansi Kajian:</strong>
                            <p className="text-neutral-700 leading-relaxed">{atsar.relevance}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. QAUL ULAMA */}
                {activeTab === "qaul" && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="font-serif text-lg font-bold text-brand-900">Pernyataan Ulama (Turats Klasik)</h4>
                      <span className="text-xs font-mono text-neutral-500 bg-neutral-100 px-2 py-1 rounded">
                        {currentMaterial.qauls.length} Kutipan Ulama
                      </span>
                    </div>

                    <div className="space-y-6">
                      {currentMaterial.qauls?.map((qaul, idx) => (
                        <div key={idx} className="p-4 sm:p-5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="space-y-1">
                              <span className="font-serif font-bold text-neutral-900 text-base sm:text-lg">
                                {qaul.author}
                              </span>
                              <div className="flex items-center gap-1 text-xs text-neutral-500">
                                <span>Kitab: <strong>{qaul.book}</strong></span>
                              </div>
                            </div>
                            <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-300">
                              Bidang: {qaul.field}
                            </span>
                          </div>

                          {/* Arabic text */}
                          <div className="arabic-text bg-white p-4 rounded-lg border border-neutral-100 shadow-inner text-xl sm:text-2xl text-neutral-900 my-2 font-arabic text-right" dir="rtl">
                            {qaul.text}
                          </div>

                          {/* Translation */}
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Terjemahan Indonesia:</span>
                            <blockquote className="text-sm sm:text-base text-neutral-700 italic border-l-4 border-amber-400 pl-3">
                              "Artinya: {qaul.translation}"
                            </blockquote>
                          </div>

                          {/* Relevance */}
                          <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-xs sm:text-sm">
                            <strong className="text-emerald-900 block font-bold mb-1">Relevansi Penjelasan:</strong>
                            <p className="text-neutral-700 leading-relaxed">{qaul.relevance}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. DRAF NASKAH CERAMAH */}
                {activeTab === "draft" && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                      <div>
                        <h4 className="font-serif text-lg font-bold text-brand-900">Draf Naskah Ceramah Utuh</h4>
                        <p className="text-xs text-neutral-500">Gaya Bahasa: {currentMaterial.style}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Audio play/stop button */}
                        <button
                          onClick={handleTtsPlayback}
                          className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm border transition cursor-pointer
                            ${isPlayingTts
                              ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
                              : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300"
                            }
                          `}
                          title={isPlayingTts ? "Hentikan Suara" : "Dengarkan draf dibacakan dalam bahasa Indonesia"}
                        >
                          {isPlayingTts ? (
                            <>
                              <VolumeX className="w-4 h-4 text-red-600 shrink-0" />
                              <span>Hentikan Audio</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-4 h-4 text-neutral-600 shrink-0" />
                              <span>Dengarkan Draft</span>
                            </>
                          )}
                        </button>
                        
                        {/* Copy draft btn */}
                        <button
                          onClick={() => copyToClipboard(currentMaterial.draft, "Naskah ceramah")}
                          className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-900 text-white py-1.5 px-3 rounded-lg shadow-sm transition cursor-pointer"
                        >
                          <Copy className="w-4 h-4 shrink-0" />
                          <span>Salin Naskah</span>
                        </button>
                      </div>
                    </div>

                    {/* Speech synthesis playing bar */}
                    {isPlayingTts && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-center gap-2.5 animate-pulse">
                        <Volume2 className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Sedang membaca naskah ceramah dalam Bahasa Indonesia. Harap matikan audio jika Anda ingin beralih tab atau merubah naskah.</span>
                      </div>
                    )}

                    <div className="bg-[#fdfbf7] border border-amber-500/20 rounded-xl p-5 sm:p-8 font-serif leading-relaxed text-neutral-800 text-base shadow-inner whitespace-pre-wrap max-h-[500px] overflow-y-auto font-medium">
                      {currentMaterial.draft}
                    </div>
                  </div>
                )}

                {/* 7. CATATAN & PERINGATAN ILMIAH */}
                {activeTab === "caution" && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="border-b pb-2">
                      <h4 className="font-serif text-lg font-bold text-red-900 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <span>Catatan Kehati-hatian Ilmiah</span>
                      </h4>
                    </div>

                    <div className="bg-amber-50 border-l-4 border-amber-600 rounded-r-lg p-5 text-amber-950 space-y-3 shadow-sm">
                      <p className="font-semibold text-amber-900 text-base flex items-center gap-1.5">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        Peringatan Akademik & Pertanggungjawaban Ilmu:
                      </p>
                      <p className="text-sm sm:text-base leading-relaxed">
                        {currentMaterial.scientificCaution}
                      </p>
                    </div>

                    <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 text-xs sm:text-sm text-neutral-600 space-y-2">
                      <p className="font-bold text-neutral-800">Panduan Khusus Dai / Mubaligh:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs leading-relaxed">
                        <li>AI dilarang keras melahirkan/mengarang dalil secara serampangan. Segala teks Arab yang ditampilkan diatur dengan parameter presisi rendah (Low temperature) guna memelihara keaslian teks.</li>
                        <li>Sebagai da'i yang amanah, sangat dianjurkan untuk tetap membuka mushaf fisik atau aplikasi hadis resmi (seperti Dorar.net atau Kitab Sembilan Imam) guna memverifikasi nomor bab dan susunan kata sebelum berkhutbah.</li>
                        <li>Gunakan referensi jilid dan nomor halaman kitab yang disediakan di tab qaul ulama sebagai batu pijakan riset mandiri Anda di perpustakaan digital (seperti Maktabah Syamilah).</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* SEAMLESS PRINTABLE ONLY VIEW FOR PDF EXPORT */}
              <div id="printable-content" className="hidden print-only print:block text-neutral-900 space-y-8 bg-white p-6 font-serif">
                <div className="border-b-4 border-brand-900 pb-4 text-center">
                  <h1 className="text-3xl font-bold font-serif text-brand-950">{currentMaterial.themeName}</h1>
                  <p className="text-xs text-neutral-500 font-mono mt-1">Gaya Ceramah: {currentMaterial.style} | Disusun oleh Mimbar Turats AI</p>
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-bold border-b pb-1 text-brand-900">1. Ringkasan Tema</h2>
                  <p className="text-sm leading-relaxed">{currentMaterial.summary}</p>
                </div>

                <div className="space-y-4 page-break">
                  <h2 className="text-xl font-bold border-b pb-1 text-brand-900">2. Poin-poin Ceramah</h2>
                  <ul className="list-decimal list-inside space-y-1 text-sm">
                    {currentMaterial.points?.map((p, i) => (
                      <li key={i} className="mb-1 font-medium">{p}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-6 page-break">
                  <h2 className="text-xl font-bold border-b pb-1 text-brand-900">3. Dalil Al-Qur'an Terkait</h2>
                  {currentMaterial.verses?.map((v, i) => (
                    <div key={i} className="border border-neutral-300 p-4 rounded-lg bg-neutral-50 space-y-2">
                      <p className="font-bold text-sm">{v.reference}</p>
                      <p className="arabic-text text-right text-xl font-bold leading-loose my-2 font-arabic" dir="rtl">{v.text}</p>
                      <p className="text-xs italic text-neutral-700">"Artinya: {v.translation}"</p>
                      <p className="text-xs"><strong>Tafsir ({v.tafsirRef}):</strong> {v.tafsir}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-6 page-break">
                  <h2 className="text-xl font-bold border-b pb-1 text-brand-900">4. Rujukan Hadis Nabi</h2>
                  {currentMaterial.hadiths?.map((h, i) => (
                    <div key={i} className="border border-neutral-300 p-4 rounded-lg bg-neutral-50 space-y-2">
                      <p className="font-bold text-sm">{h.source} (Status: {h.status})</p>
                      <p className="arabic-text text-right text-xl font-bold leading-loose my-2 font-arabic" dir="rtl">{h.text}</p>
                      <p className="text-xs italic text-neutral-700">"Artinya: {h.translation}"</p>
                      <p className="text-xs"><strong>Syarah:</strong> {h.explanation}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-6 page-break">
                  <h2 className="text-xl font-bold border-b pb-1 text-brand-900">5. Atsar Sahabat & Tabi'in</h2>
                  {currentMaterial.atsars?.map((a, i) => (
                    <div key={i} className="border border-neutral-300 p-4 rounded-lg bg-neutral-50 space-y-2">
                      <p className="font-bold text-sm">Tokoh: {a.figure} | Rujukan: {a.source}</p>
                      <p className="arabic-text text-right text-lg leading-loose my-1 font-arabic" dir="rtl">{a.text}</p>
                      <p className="text-xs italic text-neutral-700">"Artinya: {a.translation}"</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-6 page-break">
                  <h2 className="text-xl font-bold border-b pb-1 text-brand-900">6. Qaul Ulama Kitab Turats</h2>
                  {currentMaterial.qauls?.map((q, i) => (
                    <div key={i} className="border border-neutral-300 p-4 rounded-lg bg-neutral-50 space-y-2">
                      <p className="font-bold text-sm">Ulama: {q.author} | Kitab: {q.book} ({q.field})</p>
                      <p className="arabic-text text-right text-lg leading-loose my-1 font-arabic" dir="rtl">{q.text}</p>
                      <p className="text-xs italic text-neutral-700">"Artinya: {q.translation}"</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 page-break">
                  <h2 className="text-xl font-bold border-b pb-1 text-brand-900">7. Catatan Kehati-hatian Ilmiah</h2>
                  <div className="border-l-4 border-amber-600 pl-4 py-2 bg-neutral-100 text-sm italic">
                    {currentMaterial.scientificCaution}
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-bold border-b pb-1 text-brand-900">8. Draf Naskah Ceramah Lengkap</h2>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap bg-[#fdfbf7] p-6 rounded-lg border">
                    {currentMaterial.draft}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* INITIAL EMPTY STATE DESIGN */}
          {!currentMaterial && !isLoading && (
            <div id="welcome-empty-state" className="bg-white rounded-xl shadow-md border border-neutral-200 p-6 sm:p-10 text-center space-y-6 no-print">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
                <BookOpen className="w-8 h-8 text-brand-800" />
              </div>
              <div className="space-y-2 max-w-xl mx-auto">
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-neutral-900">Siapkan Khutbah & Ceramah Anda</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  Mimbar Turats AI membantu Anda mencari ayat, derajat hadis, atsar sahabat, dan perkataan para ulama salaf dari puluhan kitab turats muktabar secara instan, serta menyusun konsep draf naskah ceramah yang kaya makna ilmiah.
                </p>
              </div>

              {/* Educational info cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 max-w-3xl mx-auto text-left">
                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 space-y-1.5">
                  <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">1</span>
                  <h4 className="font-serif font-bold text-sm text-neutral-900">Anti-Halusinasi Dalil</h4>
                  <p className="text-xs text-neutral-500">AI diinstruksikan ketat melacak sumber, jilid, atau nomor bab agar da'i tidak keliru mengutip riwayat palsu.</p>
                </div>
                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 space-y-1.5">
                  <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">2</span>
                  <h4 className="font-serif font-bold text-sm text-neutral-900">Teks Arab Amiri</h4>
                  <p className="text-xs text-neutral-500">Teks ayat, hadis, dan atsar disajikan lengkap berharakat dengan font kaligrafi Arab yang nyaman dibaca.</p>
                </div>
                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 space-y-1.5">
                  <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">3</span>
                  <h4 className="font-serif font-bold text-sm text-neutral-900">8 Segmentasi Bahasa</h4>
                  <p className="text-xs text-neutral-500">Sesuaikan draf naskah mulai dari bahasa khutbah Jumat formal, majelis taklim ibu-ibu yang santun, hingga bahasa anak muda.</p>
                </div>
              </div>

              {/* Suggestions guideline help */}
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 max-w-xl mx-auto text-left text-xs text-brand-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-brand-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Cara Memulai:</span>
                  <p>Ketik tema utama ceramah Anda di kolom input di atas (contoh: "bahaya sombong dan takabur" atau "keutamaan shalat tahajjud"), pilih gaya bahasa ceramah, lalu tekan tombol <strong>"Susun Materi Sekarang"</strong>.</p>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* FOOTER BAR */}
      <footer id="main-footer" className="bg-neutral-950 text-neutral-400 py-6 border-t border-neutral-800 text-center text-xs mt-auto no-print">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-serif font-semibold text-neutral-300">Mimbar Turats - Penyusun Bahan Ceramah Berbasis Kitab Turats</p>
          <p className="text-neutral-500 max-w-xl mx-auto">
            Aplikasi ini ditujukan sebagai asisten pencari awal dan pengelompok dakwah secara digital. Pengguna wajib memverifikasi keaslian sanad dan matan secara mandiri sebelum melafazkannya di hadapan khalayak umum.
          </p>
          <p className="text-[10px] text-neutral-600 font-mono">Platform Dakwah Digital Modern © 2026. All rights reserved.</p>
        </div>
      </footer>

      {/* MODAL PENGATURAN API KEY */}
      {showApiKeyModal && (
        <div
          id="api-key-modal-overlay"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in no-print"
          onClick={() => setShowApiKeyModal(false)}
        >
          <div
            id="api-key-modal-card"
            className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-neutral-100 text-center relative transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              id="close-api-key-modal-btn"
              onClick={() => setShowApiKeyModal(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition cursor-pointer"
              aria-label="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Top Green Key Badge */}
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <KeyRound className="w-7 h-7" />
            </div>

            {/* Title & Description */}
            <h3 className="font-serif text-xl font-bold text-neutral-900 mb-2">
              Pengaturan API Key
            </h3>
            <p className="text-xs text-neutral-600 mb-6 leading-relaxed max-w-xs mx-auto">
              Aplikasi ini membutuhkan API Key dari Google AI Studio. Key akan disimpan secara aman di browser Anda (Local Storage).
            </p>

            {/* Input Form */}
            <form onSubmit={handleSaveApiKey} className="space-y-4">
              <div className="relative">
                <input
                  id="api-key-input-field"
                  type="text"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Mulai dengan 'AIzaSy...'"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono text-neutral-800 placeholder-neutral-400 transition"
                  autoFocus
                />
              </div>

              <button
                id="save-api-key-btn"
                type="submit"
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Simpan API Key</span>
              </button>
            </form>

            {/* Footer link to get free key */}
            <div className="mt-5 text-center text-xs text-neutral-500 pt-3 border-t border-neutral-100">
              Belum punya?{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1"
              >
                Dapatkan gratis di sini
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
