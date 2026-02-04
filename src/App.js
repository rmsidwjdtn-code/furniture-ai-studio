import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Layers, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  Loader2,
  Sparkles,
  FileText,
  Save,
  History,
  Clock,
  LayoutGrid,
  Palette,
  AlertCircle
} from 'lucide-react';

// Firebase 초기화 (환경 변수 사용)
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'furniture-13-styles';

const App = () => {
  const [user, setUser] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentTheme, setCurrentTheme] = useState("");
  const [aiMarketingData, setAiMarketingData] = useState(null);
  const [savedProjects, setSavedProjects] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // ---------------------------------------------------------
  // 🔑 여기에 발급받으신 Gemini API 키를 입력하세요!
  // 예: const apiKey = "AIzaSyB...";
  // ---------------------------------------------------------
  const apiKey = "AIzaSyCNmzq43dJ7by9bOWpxx19Az6hvkyomMz4"; 

  const lifestyleThemes = [
    { name: "모던 미니멀", prompt: "Modern minimal white-toned living room, clean lines, bright soft lighting." },
    { name: "북유럽 내추럴", prompt: "Scandinavian style, light wood flooring, cozy hygge atmosphere, natural plants." },
    { name: "인더스트리얼 로프트", prompt: "Industrial loft with exposed brick walls, metal accents, moody warm lighting." },
    { name: "럭셔리 클래식", prompt: "Luxury classic interior, marble floors, elegant molding, expensive atmosphere." },
    { name: "빈티지 레트로", prompt: "Vintage retro style, colorful accents, mid-century modern furniture vibe." },
    { name: "재팬디(Japandi)", prompt: "Japandi style mixing Japanese zen and Scandinavian functionalism, warm earth tones." },
    { name: "보헤미안 시크", prompt: "Bohemian chic, warm textiles, patterned rugs, artistic and relaxed mood." },
    { name: "미드센추리 모던", prompt: "Mid-century modern aesthetic, iconic wooden paneling, sunlight through large windows." },
    { name: "젠(Zen) 스타일", prompt: "Quiet Zen interior, minimal decor, natural stone and bamboo elements, peaceful mood." },
    { name: "어반 스튜디오", prompt: "Urban studio apartment, city view window, sleek contemporary styling." },
    { name: "아이방 (키즈)", prompt: "Bright and playful kids room, colorful toys, soft pastel colors, safe and cheerful environment." },
    { name: "홈 오피스", prompt: "Professional home office, organized desk, modern technology, productive and focused atmosphere." },
    { name: "다이닝 룸 (식당)", prompt: "Warm and inviting dining room, set table for a meal, ambient lighting, cozy gathering space." }
  ];

  const compressImage = (base64Str, maxWidth = 400, maxHeight = 300) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        } else {
          if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'projects');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedProjects(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return () => unsubscribe();
  }, [user]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
        setBase64Image(reader.result.split(',')[1]);
        setGeneratedImages([]);
        setProgress(0);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const callGemini = async (model, payload, retries = 5, delay = 1000) => {
    if (!apiKey) {
      throw new Error("API 키가 입력되지 않았습니다. 코드 상단에 키를 넣어주세요.");
    }
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      return await res.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(res => setTimeout(res, delay));
        return callGemini(model, payload, retries - 1, delay * 2);
      }
      throw err;
    }
  };

  const generateAllStyles = async () => {
    if (!base64Image) return;
    setIsGenerating(true);
    setGeneratedImages([]);
    setProgress(0);
    setError(null);

    try {
      for (let i = 0; i < lifestyleThemes.length; i++) {
        const theme = lifestyleThemes[i];
        setCurrentTheme(theme.name);
        
        const payload = {
          contents: [{
            parts: [
              { text: `Keep the furniture from the original photo exactly as it is (shape, color, material). Place it naturally into a ${theme.prompt}. High resolution product photography.` },
              { inlineData: { mimeType: "image/png", data: base64Image } }
            ]
          }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        };

        const result = await callGemini('gemini-2.5-flash-image-preview', payload);
        const imgPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imgPart?.inlineData?.data) {
          setGeneratedImages(prev => [...prev, {
            theme: theme.name,
            src: `data:image/png;base64,${imgPart.inlineData.data}`
          }]);
        }
        setProgress(i + 1);
      }
      await generateMarketing();
    } catch (err) {
      setError(err.message || "이미지 생성 실패");
    } finally {
      setIsGenerating(false);
      setCurrentTheme("");
    }
  };

  const generateMarketing = async () => {
    const payload = {
      contents: [{
        parts: [
          { text: "제공된 가구 사진을 분석하여 쇼핑몰용 매력적인 상품명, 감성적인 상세설명, 핵심 키워드 5개를 한국어 JSON 형식으로 작성해줘." },
          { inlineData: { mimeType: "image/png", data: base64Image } }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            description: { type: "STRING" },
            keywords: { type: "ARRAY", items: { type: "STRING" } }
          }
        }
      }
    };
    try {
      const result = await callGemini('gemini-2.5-flash-preview-09-2025', payload);
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) setAiMarketingData(JSON.parse(text));
    } catch (err) { console.error("Marketing text error", err); }
  };

  const saveToCloud = async () => {
    if (!user || generatedImages.length === 0) return;
    setIsSaving(true);
    try {
      const compressedThumbnail = await compressImage(generatedImages[0].src);
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), {
        title: aiMarketingData?.title || "새 가구 프로젝트",
        thumbnail: compressedThumbnail,
        imageCount: generatedImages.length,
        marketing: aiMarketingData,
        createdAt: serverTimestamp()
      });
      alert("저장 완료!");
    } catch (err) { alert("저장 실패: " + err.message); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-80 bg-white border-r border-gray-100 p-6 overflow-y-auto md:h-screen sticky top-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <History className="text-indigo-600" size={22} />
          <h2 className="font-extrabold text-xl tracking-tight">작업 내역</h2>
        </div>
        <div className="space-y-4">
          {savedProjects?.map(p => (
            <div key={p.id} className="bg-gray-50 rounded-2xl p-3 border border-transparent hover:border-indigo-200 hover:bg-white transition-all">
              <img src={p.thumbnail} className="w-full h-32 object-cover rounded-xl mb-3 shadow-sm" alt="" />
              <p className="font-bold text-sm truncate px-1">{p.title}</p>
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-[10px] text-gray-400">{p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : '로딩중'}</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{p.imageCount} 스타일</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-black tracking-tight mb-2">Furniture AI Studio</h1>
              <p className="text-gray-500 font-medium italic">API Key Connected: {apiKey ? '✅ Ready' : '❌ Needs Key'}</p>
            </div>
            <button onClick={saveToCloud} disabled={!generatedImages.length || isSaving} className="flex items-center gap-2 bg-white border-2 border-gray-900 px-6 py-3 rounded-2xl font-bold hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 저장하기
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 sticky top-24">
                <h3 className="font-extrabold mb-5 flex items-center gap-2"><UploadCloud size={20} className="text-indigo-600" /> 사진 업로드</h3>
                <label className="group block aspect-square w-full border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 transition-all overflow-hidden relative mb-6">
                  {uploadedImage ? <img src={uploadedImage} className="w-full h-full object-cover" alt="" /> : <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 font-bold text-sm">원본 사진 선택</div>}
                  <input type="file" className="hidden" onChange={handleImageUpload} />
                </label>
                <button onClick={generateAllStyles} disabled={!uploadedImage || isGenerating} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 disabled:bg-gray-200 transition-all shadow-xl">
                  {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} 13가지 스타일 생성
                </button>
                {isGenerating && (
                  <div className="mt-6 space-y-3">
                    <div className="flex justify-between text-xs font-bold text-indigo-600"><span>{currentTheme} 생성중...</span><span>{progress}/13</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden"><div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${(progress / 13) * 100}%` }}></div></div>
                  </div>
                )}
                {error && <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100 text-red-700 text-xs font-bold flex items-center gap-2"><AlertCircle size={14}/> {error}</div>}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-8">
              {!generatedImages.length ? (
                <div className="h-96 border-2 border-dashed border-gray-100 rounded-[40px] flex flex-col items-center justify-center text-gray-300 bg-white/50"><LayoutGrid size={60} className="mb-4 opacity-10" /><p className="font-bold">생성된 이미지가 여기에 표시됩니다.</p></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in duration-700">
                  {generatedImages.map((img, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                      <img src={img.src} className="aspect-[4/3] w-full object-cover rounded-2xl mb-3" alt="" />
                      <div className="flex justify-between items-center px-2"><p className="font-black text-xs text-indigo-600 uppercase">{img.theme}</p><Download size={14} className="text-gray-300 cursor-pointer hover:text-indigo-600" /></div>
                    </div>
                  ))}
                </div>
              )}

              {aiMarketingData && (
                <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
                  <h3 className="text-2xl font-black mb-8 flex items-center gap-3"><FileText className="text-indigo-600" /> AI 마케팅 기획안</h3>
                  <div className="space-y-6">
                    <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">상품명</span><p className="text-2xl font-extrabold">{aiMarketingData.title}</p></div>
                    <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">상세설명</span><p className="text-gray-600 leading-relaxed bg-gray-50 p-6 rounded-3xl text-sm font-medium">{aiMarketingData.description}</p></div>
                    <div className="flex flex-wrap gap-2">{aiMarketingData.keywords?.map((kw, i) => <span key={i} className="bg-indigo-50 text-indigo-600 px-4 py-1 rounded-full text-[10px] font-black">#{kw}</span>)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
