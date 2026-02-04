상세페이지 이미지 자동만들기

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

// Firebase 초기화 (Global variables provided by environment)
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

  const apiKey = "AIzaSyCNmzq43dJ7by9bOWpxx19Az6hvkyomMz4"; // Gemini API Key (Empty string for runtime injection)

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

  // 이미지 압축 헬퍼 함수 (Firestore 1MB 제한 우회)
  const compressImage = (base64Str, maxWidth = 400, maxHeight = 300) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // 화질을 0.7 정도로 낮춰 용량을 더 줄임
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(base64Str); // 실패 시 원본 반환 (위험할 수 있음)
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
      } catch (err) {
        console.error("Auth initialization failed:", err);
      }
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
    }, (err) => {
      console.error("Firestore loading error:", err);
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
              { text: `Keep the furniture from the original photo exactly as it is (shape, color, material). Place it naturally into a ${theme.prompt}. Ensure high resolution product photography quality.` },
              { inlineData: { mimeType: "image/png", data: base64Image } }
            ]
          }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        };

        const result = await callGemini('gemini-2.5-flash-image-preview', payload);
        const imgPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        const imgData = imgPart?.inlineData?.data;
        
        if (imgData) {
          setGeneratedImages(prev => [...prev, {
            theme: theme.name,
            src: `data:image/png;base64,${imgData}`
          }]);
        }
        setProgress(i + 1);
      }
      
      await generateMarketing();
      
    } catch (err) {
      console.error(err);
      setError("생성 중 오류가 발생했습니다. 할당량이 초과되었거나 네트워크 상태를 확인해 주세요.");
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
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textResponse) {
        setAiMarketingData(JSON.parse(textResponse));
      }
    } catch (err) {
      console.error("Marketing generation failed:", err);
    }
  };

  const saveToCloud = async () => {
    if (!user || (generatedImages.length === 0 && !uploadedImage)) return;
    setIsSaving(true);
    try {
      // 썸네일 이미지 압축
      const rawThumbnail = generatedImages[0]?.src || uploadedImage;
      const compressedThumbnail = await compressImage(rawThumbnail);

      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), {
        title: aiMarketingData?.title || "13가지 스타일 가구 프로젝트",
        thumbnail: compressedThumbnail,
        imageCount: generatedImages.length,
        marketing: aiMarketingData,
        createdAt: serverTimestamp()
      });
      alert("성공적으로 저장되었습니다!");
    } catch (err) {
      console.error("Saving failed:", err);
      setError("저장 중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] font-sans flex flex-col md:flex-row">
      <aside className="w-full md:w-80 bg-white border-r border-gray-100 p-6 overflow-y-auto md:h-screen sticky top-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <History className="text-indigo-600" size={22} />
          <h2 className="font-extrabold text-xl tracking-tight">작업 내역</h2>
        </div>
        <div className="space-y-4">
          {savedProjects?.map(p => (
            <div key={p.id} className="group cursor-pointer bg-gray-50 rounded-2xl p-3 border border-transparent hover:border-indigo-200 hover:bg-white transition-all">
              <img src={p.thumbnail} className="w-full h-32 object-cover rounded-xl mb-3 shadow-sm" alt="" />
              <p className="font-bold text-sm truncate px-1">{p.title || "미지정 프로젝트"}</p>
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-[10px] text-gray-400">
                  {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : '날짜 없음'}
                </span>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{p.imageCount || 0} 스타일</span>
              </div>
            </div>
          ))}
          {savedProjects?.length === 0 && <p className="text-center text-gray-400 text-sm py-10">저장된 내역이 없습니다.</p>}
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-black tracking-tight mb-2">13 Styles Generator</h1>
              <p className="text-gray-500 font-medium">한 번의 업로드로 13가지 인테리어 화보를 완성하세요.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={saveToCloud}
                disabled={generatedImages.length === 0 || isSaving}
                className="flex items-center gap-2 bg-white border-2 border-gray-900 px-6 py-3 rounded-2xl font-bold hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                클라우드 저장
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 sticky top-24">
                <h3 className="font-extrabold mb-5 flex items-center gap-2">
                  <UploadCloud size={20} className="text-indigo-600" /> 가구 사진 업로드
                </h3>
                <label className="group block aspect-square w-full border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 transition-all overflow-hidden relative mb-6">
                  {uploadedImage ? (
                    <img src={uploadedImage} className="w-full h-full object-cover" alt="Original" />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-white transition-all shadow-sm">
                        <Palette className="text-gray-300 group-hover:text-indigo-500" />
                      </div>
                      <p className="text-sm font-bold text-gray-400 group-hover:text-indigo-600">공장에서 찍은 원본 선택</p>
                    </div>
                  )}
                  <input type="file" className="hidden" onChange={handleImageUpload} />
                </label>
                
                <button 
                  onClick={generateAllStyles}
                  disabled={!uploadedImage || isGenerating}
                  className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 disabled:bg-gray-200 transition-all shadow-xl shadow-indigo-100"
                >
                  {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  13가지 스타일 동시 생성
                </button>

                {isGenerating && (
                  <div className="mt-6 space-y-3">
                    <div className="flex justify-between text-xs font-bold text-indigo-600">
                      <span>{currentTheme} 그리는 중...</span>
                      <span>{progress}/{lifestyleThemes.length}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${(progress / lifestyleThemes.length) * 100}%` }}></div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3 text-red-700 text-xs">
                    <AlertCircle className="shrink-0" size={14} />
                    <p>{error}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-10">
              {generatedImages.length === 0 ? (
                <div className="h-[600px] border-2 border-dashed border-gray-100 rounded-[40px] flex flex-col items-center justify-center text-gray-300 bg-white/50">
                  <LayoutGrid size={60} className="mb-4 opacity-10" />
                  <p className="font-bold">업로드 후 생성을 시작하면 13가지 화보가 나타납니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in duration-1000">
                  {generatedImages?.map((img, idx) => (
                    <div key={idx} className="group bg-white p-4 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all">
                      <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-4 relative bg-gray-50">
                        <img src={img.src} alt={img.theme} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-indigo-600 shadow-sm">
                          {img.theme}
                        </div>
                      </div>
                      <div className="flex justify-between items-center px-1">
                        <p className="font-extrabold text-sm">{img.theme} 컨셉</p>
                        <button className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-indigo-600">
                          <Download size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {aiMarketingData && (
                <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm animate-in slide-in-from-bottom-6">
                  <div className="flex items-center gap-3 mb-8">
                    <FileText className="text-indigo-600" />
                    <h3 className="text-2xl font-black">AI 상세페이지 기획안</h3>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">추천 상품명</span>
                      <p className="text-2xl font-extrabold leading-tight text-gray-900">{aiMarketingData.title}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">제품 스토리텔링</span>
                      <p className="text-gray-600 leading-relaxed font-medium bg-gray-50 p-6 rounded-3xl">{aiMarketingData.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {aiMarketingData.keywords?.map((kw, i) => (
                        <span key={i} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-2xl text-xs font-bold">#{kw}</span>
                      ))}
                    </div>
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