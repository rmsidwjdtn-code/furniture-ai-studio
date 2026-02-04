import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Download, 
  RefreshCw, 
  Loader2, 
  Sparkles, 
  FileText, 
  LayoutGrid, 
  AlertCircle 
} from 'lucide-react';

const App = () => {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentTheme, setCurrentTheme] = useState("");
  const [aiMarketingData, setAiMarketingData] = useState(null);
  const [error, setError] = useState(null);

  // Gemini API Key - 실제 배포 시에는 환경 변수를 사용하는 것이 안전합니다.
  const apiKey = "AIzaSyCNmzq43dJ7by9bOWpxx19Az6hvkyomMz4"; 

  const lifestyleThemes = [
    { name: "모던 미니멀", prompt: "Modern minimal white living room, clean lines, bright soft lighting." },
    { name: "북유럽 내추럴", prompt: "Scandinavian style cozy room, light wood, natural plants." },
    { name: "홈 오피스", prompt: "Professional clean home office, organized desk, modern technology." },
    { name: "아이방", prompt: "Bright and playful kids room, colorful toys, soft pastel colors." },
    { name: "식당", prompt: "Elegant dining room, warm ambient lighting, set table." },
    { name: "인더스트리얼", prompt: "Industrial loft style, brick walls, metal accents." },
    { name: "럭셔리", prompt: "Luxury classic interior, marble floors, elegant molding." },
    { name: "재팬디", prompt: "Warm Japandi zen style, minimal decor, peaceful mood." },
    { name: "보헤미안", prompt: "Bohemian chic artistic room, colorful textiles, relaxed vibe." },
    { name: "어반 스튜디오", prompt: "Urban studio apartment, sleek contemporary styling." }
  ];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
        setBase64Image(reader.result.split(',')[1]);
        setGeneratedImages([]);
        setAiMarketingData(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const callGemini = async (model, payload, retries = 5, delay = 1000) => {
    if (!apiKey) throw new Error("API 키가 설정되지 않았습니다.");
    
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error(`API 호출 실패: ${res.status}`);
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
      // 1. 이미지 생성 (10개 테마)
      for (let i = 0; i < lifestyleThemes.length; i++) {
        const theme = lifestyleThemes[i];
        setCurrentTheme(theme.name);
        
        const payload = {
          contents: [{
            parts: [
              { text: `Keep the furniture shape and color. Place it into a ${theme.prompt}. High resolution.` },
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
      
      // 2. 마케팅 문구 생성
      setCurrentTheme("마케팅 문구 분석 중...");
      const marketPayload = {
        contents: [{
          parts: [
            { text: "제공된 가구 사진을 분석하여 쇼핑몰용 매력적인 상품명, 상세설명, 키워드 5개를 한국어 JSON 형식으로 작성해줘." },
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
      
      const marketResult = await callGemini('gemini-2.5-flash-preview-09-2025', marketPayload);
      const textResponse = marketResult.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textResponse) {
        setAiMarketingData(JSON.parse(textResponse));
      }

    } catch (err) {
      setError("작업 중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsGenerating(false);
      setCurrentTheme("");
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-gray-900 font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 text-center md:text-left flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h1 className="text-4xl font-black mb-2 tracking-tighter">AI FURNITURE STUDIO</h1>
            <p className="text-gray-500 font-medium italic">공장 원본 사진으로 만드는 프리미엄 라이프스타일 화보</p>
          </div>
          {aiMarketingData && (
             <div className="bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold animate-pulse">
               AI 분석 완료
             </div>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm sticky top-10">
              <h3 className="font-bold mb-5 flex items-center gap-2 text-gray-700">
                <ImageIcon size={20} className="text-indigo-600" /> 1. 사진 업로드
              </h3>
              <label className="group block aspect-square border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer hover:bg-gray-50 transition-all overflow-hidden relative bg-white/50">
                {uploadedImage ? (
                  <img src={uploadedImage} className="w-full h-full object-cover" alt="Original" />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300">
                    <UploadCloud size={48} strokeWidth={1} className="mb-2" />
                    <p className="text-sm font-bold">가구 사진 선택</p>
                    <p className="text-[10px] mt-1 text-gray-400">핸드폰 사진도 괜찮습니다</p>
                  </div>
                )}
                <input type="file" className="hidden" onChange={handleImageUpload} />
              </label>
              
              <button 
                onClick={generateAllStyles}
                disabled={!uploadedImage || isGenerating}
                className="w-full mt-6 bg-black text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-indigo-600 disabled:bg-gray-200 transition-all shadow-xl shadow-gray-200/50"
              >
                {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                화보 생성 시작
              </button>
              
              {isGenerating && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex justify-between text-[10px] font-black text-indigo-600 uppercase mb-2">
                    <span>{currentTheme}</span>
                    <span>{progress} / 10</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${(progress / 10) * 100}%` }}></div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-start gap-3 font-bold text-xs">
                  <AlertCircle size={16} className="shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            {aiMarketingData && (
              <div className="bg-indigo-50 p-8 rounded-[40px] border border-indigo-100 shadow-sm animate-in slide-in-from-bottom-6">
                <div className="flex items-center gap-3 mb-6">
                  <FileText className="text-indigo-600" />
                  <h3 className="text-xl font-black">AI 상세페이지 기획안</h3>
                </div>
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">추천 상품명</span>
                    <p className="text-2xl font-extrabold leading-tight text-gray-900">{aiMarketingData.title}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">제품 스토리텔링</span>
                    <p className="text-gray-600 leading-relaxed font-medium bg-white p-6 rounded-3xl border border-indigo-50 shadow-sm">{aiMarketingData.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiMarketingData.keywords?.map((kw, i) => (
                      <span key={i} className="bg-white text-indigo-600 px-4 py-2 rounded-2xl text-xs font-bold shadow-sm">#{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!generatedImages.length && !isGenerating ? (
              <div className="h-[500px] border-2 border-dashed border-gray-100 rounded-[40px] flex flex-col items-center justify-center text-gray-200 bg-white/50">
                <LayoutGrid size={64} className="mb-4 opacity-10" />
                <p className="font-black text-xl">생성된 화보가 여기에 표시됩니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-700">
                {generatedImages.map((img, i) => (
                  <div key={i} className="group bg-white p-3 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all">
                    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-50">
                      <img src={img.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                      <div className="absolute top-4 left-4">
                        <span className="bg-white/90 backdrop-blur-md text-[10px] font-black px-2.5 py-1 rounded-full text-indigo-600 shadow-sm uppercase tracking-tighter">
                          {img.theme}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between items-center px-2">
                      <span className="text-sm font-extrabold text-gray-800">{img.theme} 컨셉</span>
                      <button className="p-2 text-gray-300 hover:text-indigo-600 transition-colors">
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
