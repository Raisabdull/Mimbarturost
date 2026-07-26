const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Storage changes
content = content.replace(/localStorage\.getItem\("gemini_api_key"\)/g, 'sessionStorage.getItem("mimbar_turats_gemini_api_key")');
content = content.replace(/localStorage\.setItem\("gemini_api_key"/g, 'sessionStorage.setItem("mimbar_turats_gemini_api_key"');
content = content.replace(/localStorage\.removeItem\("gemini_api_key"\)/g, 'sessionStorage.removeItem("mimbar_turats_gemini_api_key")');

// 2. Remove generateClientSide completely
const genClientSideRegex = /const generateClientSide = async .*?};\s*const handleGenerate =/s;
content = content.replace(genClientSideRegex, 'const handleGenerate =');

// 3. Update handleSaveApiKey to validate
const handleSaveApiKeyRegex = /const handleSaveApiKey = \(e: FormEvent\) => \{[\s\S]*?setShowApiKeyModal\(false\);\s*\};/s;
const newHandleSaveApiKey = `const [isValidating, setIsValidating] = useState(false);
  const handleSaveApiKey = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = apiKeyInput.trim();
    
    if (!trimmed) {
      setApiKey("");
      sessionStorage.removeItem("mimbar_turats_gemini_api_key");
      triggerNotification("Kunci API dihapus.");
      setShowApiKeyModal(false);
      return;
    }

    setIsValidating(true);
    setError(null);
    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: {
          "x-gemini-api-key": trimmed
        }
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setApiKey(trimmed);
        sessionStorage.setItem("mimbar_turats_gemini_api_key", trimmed);
        triggerNotification("API Key valid dan berhasil disimpan!");
        setShowApiKeyModal(false);
      } else {
        throw new Error(data.error || "API key tidak valid.");
      }
    } catch (err: any) {
      setError(err.message || "Gagal memvalidasi API Key.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveApiKey = () => {
    setApiKey("");
    setApiKeyInput("");
    sessionStorage.removeItem("mimbar_turats_gemini_api_key");
    triggerNotification("Kunci API telah dihapus.");
    setShowApiKeyModal(false);
  };`;
content = content.replace(handleSaveApiKeyRegex, newHandleSaveApiKey);

// 4. Update handleGenerate to only use API endpoint
const handleGenerateRegex = /const handleGenerate = async \(e\?: FormEvent, customTheme\?: string\) => \{[\s\S]*?const effectiveApiKey = apiKey\.trim\(\) \|\| \(\(\(import\.meta as any\)\.env\?\.VITE_GEMINI_API_KEY as string\) \|\| ""\)\.trim\(\);[\s\S]*?if \(!data\) \{/s;

const newHandleGenerateBody = `const handleGenerate = async (e?: FormEvent, customTheme?: string) => {
    if (e) e.preventDefault();
    const finalTheme = customTheme || themeInput;
    if (!finalTheme.trim()) {
      setError("Silakan masukkan tema atau kata kunci ceramah.");
      return;
    }

    const effectiveApiKey = apiKey.trim() || sessionStorage.getItem("mimbar_turats_gemini_api_key");

    if (!effectiveApiKey) {
      setShowApiKeyModal(true);
      setError("Masukkan Gemini API key Anda terlebih dahulu.");
      return;
    }

    setIsLoading(true);
    setError(null);
    stopTts();

    try {
      let data: (SermonMaterial & { error?: string }) | null = null;

      const response = await fetch("/api/generate-ceramah", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-api-key": effectiveApiKey,
        },
        body: JSON.stringify({
          themeName: finalTheme,
          style: selectedStyle,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await response.json().catch(() => null);
      }

      if (!response.ok || !data || data.error) {
        throw new Error(data?.error || "Terjadi kesalahan saat menghubungi layanan AI.");
      }

      if (!data) {`;

content = content.replace(handleGenerateRegex, newHandleGenerateBody);

// Fix the catch block in handleGenerate to not have unused variable or just handle error normally
// The old catch block had `catch (serverErr: any) { ... }` which is now gone, so we just check what's remaining.
// Actually, it's easier to just rebuild the fetch try/catch. Let's do it.

const handleGenerateFullRegex = /const handleGenerate = async \(e\?: FormEvent, customTheme\?: string\) => \{[\s\S]*?finally \{\s*setIsLoading\(false\);\s*\}\s*\};/s;
const handleGenerateFullReplacement = `const handleGenerate = async (e?: FormEvent, customTheme?: string) => {
    if (e) e.preventDefault();
    const finalTheme = customTheme || themeInput;
    if (!finalTheme.trim()) {
      setError("Silakan masukkan tema atau kata kunci ceramah.");
      return;
    }

    const effectiveApiKey = apiKey.trim() || sessionStorage.getItem("mimbar_turats_gemini_api_key");

    if (!effectiveApiKey) {
      setShowApiKeyModal(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    stopTts();

    try {
      let data: (SermonMaterial & { error?: string }) | null = null;

      const response = await fetch("/api/generate-ceramah", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-api-key": effectiveApiKey,
        },
        body: JSON.stringify({
          themeName: finalTheme,
          style: selectedStyle,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await response.json().catch(() => null);
      }

      if (!response.ok || !data || data.error) {
        if (response.status === 401) {
            setApiKey("");
            sessionStorage.removeItem("mimbar_turats_gemini_api_key");
            setShowApiKeyModal(true);
        }
        throw new Error(data?.error || "Terjadi kesalahan saat menghubungi layanan AI.");
      }

      if (data && data.draft) {
        data.draft = data.draft.replace(/\\\\n/g, "\\n");
      }
      setCurrentMaterial(data as SermonMaterial);

      setActiveTab("summary");
      
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
        material: data as SermonMaterial,
      };

      const updatedHistory = [newItem, ...history.filter(h => h.theme.toLowerCase() !== data!.themeName.toLowerCase())].slice(0, 15);
      setHistory(updatedHistory);
      saveHistoryToLocalStorage(updatedHistory);
      
      if (themeInput === "") {
        setThemeInput(data.themeName);
      }
      triggerNotification("Bahan ceramah berhasil disusun!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Koneksi ke layanan AI gagal. Periksa internet Anda dan coba kembali.");
    } finally {
      setIsLoading(false);
    }
  };`;
content = content.replace(handleGenerateFullRegex, handleGenerateFullReplacement);


// 5. Check API key modal UI
const maskApiKey = (key) => key ? key.substring(0, 4) + '••••••••••••' + key.substring(key.length - 4) : '';

// Let's replace the modal UI
const modalRegex = /\{showApiKeyModal && \([\s\S]*?\}\)/s;
const newModalUI = `{showApiKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-brand-50">
              <h3 className="font-bold text-lg text-brand-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                Aktifkan Gemini API
              </h3>
              <button onClick={() => setShowApiKeyModal(false)} className="text-neutral-500 hover:text-neutral-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm flex gap-2 items-start">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                  Untuk menggunakan fitur AI, masukkan Gemini API key milik Anda sendiri. API key digunakan untuk memproses permintaan melalui akun Google Anda dan tidak disimpan oleh pengelola aplikasi.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex gap-2 items-start border border-red-200">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleSaveApiKey} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="api-key-input" className="block text-sm font-medium text-neutral-700">
                    Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      id="api-key-input"
                      type={apiKey ? "text" : "password"}
                      value={apiKey ? (apiKey === apiKeyInput ? (apiKey.substring(0, 4) + '••••••••••••' + apiKey.substring(apiKey.length - 4)) : apiKeyInput) : apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono text-sm"
                      disabled={!!apiKey && apiKeyInput === apiKey}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1"
                    >
                      Belum memiliki API key? <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  {apiKey ? (
                    <>
                      <button
                        type="button"
                        onClick={handleRemoveApiKey}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-sm font-medium transition-colors"
                      >
                        Hapus Kunci API
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowApiKeyModal(false)}
                        className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded-lg text-sm font-medium transition-colors"
                      >
                        Tutup
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowApiKeyModal(false)}
                        className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg text-sm font-medium transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isValidating || !apiKeyInput.trim()}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isValidating ? "Memvalidasi..." : "Simpan dan Gunakan"}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}`;
content = content.replace(modalRegex, newModalUI);

// 6. Update Header API key button text
const headerButtonRegex = /<button[\s\S]*?onClick=\{[\s\S]*?setShowApiKeyModal\(true\)[\s\S]*?\}\s*className="flex items-center gap-1\.5 px-3 py-1\.5 bg-white\/20 hover:bg-white\/30 rounded-full text-sm font-medium transition-colors"[\s\S]*?>[\s\S]*?<\/button>/;
const newHeaderButton = `<button
              onClick={() => { setError(null); setShowApiKeyModal(true); }}
              className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors \${apiKey ? 'bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30' : 'bg-white/20 hover:bg-white/30 text-white'}\`}
            >
              <KeyRound className="w-4 h-4" />
              <span className="hidden sm:inline">{apiKey ? "Kunci API Aktif" : "Masukkan Kunci API"}</span>
            </button>`;
content = content.replace(headerButtonRegex, newHeaderButton);

// We need to also add Initial check for apiKey, since we want to prompt if empty
// The user asks: "Saat aplikasi pertama kali dibuka dan belum ada key, tampilkan modal"
const useEffectMountRegex = /useEffect\(\(\) => \{[\s\S]*?synthRef\.current = window\.speechSynthesis;\s*\} catch \(e\) \{[\s\S]*?\}\s*\}, \[\]\);/s;
const newUseEffectMount = `useEffect(() => {
    try {
      const savedKey = sessionStorage.getItem("mimbar_turats_gemini_api_key");
      if (savedKey) {
        setApiKey(savedKey);
        setApiKeyInput(savedKey);
      } else {
        // Show modal on first load if no key
        setShowApiKeyModal(true);
      }
      const stored = localStorage.getItem("turats_sermon_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
      synthRef.current = window.speechSynthesis;
    } catch (e) {
      console.error("Gagal memuat data dari penyimpanan lokal", e);
    }
  }, []);`;
content = content.replace(useEffectMountRegex, newUseEffectMount);


fs.writeFileSync('src/App.tsx', content);
