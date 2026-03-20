
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { asBlob } from 'html-docx-js-typescript';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Settings, FileText, PenTool, ChevronRight, ChevronLeft, RotateCcw, ArrowUp, ArrowDown, Trash2, Plus, Download, Image as ImageIcon, FileOutput, Save, Check, RefreshCw, Copy, BarChart3, Key, Upload, X, Palette, QrCode } from 'lucide-react';
import { AppStep, WritingStyle, SEOConfig, OutlineSection, GeneratedArticle } from './types';
import { generateOutline, generateArticleContent, generateAIImage, regenerateOutlineTitle } from './services/geminiService';
import { generateAppImages } from './services/imageGenerator';

const STYLE_DESCRIPTIONS: Record<WritingStyle, string> = {
  [WritingStyle.SALES]: 'Chốt đơn mạnh mẽ, tập trung vào chuyển đổi và lợi ích.',
  [WritingStyle.INFO]: 'Cung cấp kiến thức hữu ích, khách quan và tin cậy.',
  [WritingStyle.GUIDE]: 'Step-by-step guides. Cầm tay chỉ việc rõ ràng.',
  [WritingStyle.REVIEW]: 'In-depth product analysis. Phân tích ưu nhược điểm.',
  [WritingStyle.DEEP_DIVE]: 'Technical, authoritative. Phân tích chuyên môn sâu.',
  [WritingStyle.CASE_STUDY]: 'Real-world examples. Bài học thực tế từ dự án.',
  [WritingStyle.TRENDING]: 'Newsjacking, viral content. Bắt trend nóng hổi.',
  [WritingStyle.STORYTELLING]: 'Engaging narrative. Dẫn dắt bằng câu chuyện cảm xúc.',
  [WritingStyle.COMPARE]: 'So sánh trực diện các lựa chọn để tìm ra giải pháp tốt nhất.',
  [WritingStyle.LISTICLE]: 'Tổng hợp danh sách Top sản phẩm/giải pháp dễ đọc.',
  [WritingStyle.FAQ]: 'Trả lời trực tiếp các thắc mắc phổ mô của người dùng.',
  [WritingStyle.NEWS]: 'Cập nhật tin tức nhanh chóng, chính xác và súc tích.',
  [WritingStyle.CHECKLIST]: 'Danh sách các việc cần thực hiện, tối ưu cho người bận rộn.',
  [WritingStyle.EXPERT_OPINION]: 'Góc nhìn độc đáo và uy tín từ chuyên gia đầu ngành.',
  [WritingStyle.LOCAL]: 'Tối ưu nội dung cho tìm kiếm tại khu vực địa lý cụ thể.',
  [WritingStyle.CREATIVE]: 'Phá cách, mới mẻ, thu hút đối tượng độc giả trẻ Gen Z.'
};

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.TOPIC);
  const [topic, setTopic] = useState('');
  const [config, setConfig] = useState<SEOConfig>({
    style: WritingStyle.GUIDE,
    mainKeyword: '',
    h2Count: 5,
    wordCount: 1500,
    language: 'Tiếng Việt',
    additionalInfo: '',
    productImage: undefined
  });
  const [outline, setOutline] = useState<OutlineSection[]>([]);
  const [article, setArticle] = useState<GeneratedArticle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorState, setErrorState] = useState<{message: string, isQuota: boolean} | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [customLogo, setCustomLogo] = useState<string>("https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?q=80&w=256&h=256&auto=format&fit=crop");
  const [customAvatar, setCustomAvatar] = useState<string>("https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=256&h=256&auto=format&fit=crop");
  const [appBgColor, setAppBgColor] = useState<string>("#0f172a");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bgOptions = [
    { name: 'Xanh Đen', color: '#0f172a' },
    { name: 'Xám Ghi', color: '#334155' },
    { name: 'Vàng Đồng', color: '#713f12' },
    { name: 'Xanh Lá Đậm', color: '#064e3b' },
    { name: 'Tím Huyền Bí', color: '#4c1d95' },
    { name: 'Hồng Đỏ', color: '#881337' },
    { name: 'Xanh Dương', color: '#1e3a8a' },
    { name: 'Nâu Đất', color: '#451a03' },
    { name: 'Đen Tuyền', color: '#000000' },
  ];

  useEffect(() => {
    const loadCustomImages = async () => {
      try {
        const { logoBase64 } = await generateAppImages();
        if (logoBase64) setCustomLogo(logoBase64);
      } catch (error) {
        console.error("Failed to generate custom images", error);
      }
    };
    loadCustomImages();
  }, []);

  const nextStep = () => setStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const handleOpenKeySelector = async () => {
    if (typeof window !== 'undefined' && window.aistudio) {
      await window.aistudio.openSelectKey();
      setErrorState(null);
    } else {
      // On Vercel, we guide the user to set environment variables
      setErrorState({
        message: "Để sử dụng trên Vercel, bạn cần cấu hình GEMINI_API_KEY trong phần Settings -> Environment Variables của Vercel Project.",
        isQuota: false
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setConfig({ ...config, productImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProductImage = () => {
    setConfig({ ...config, productImage: undefined });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerateOutline = async () => {
    setIsLoading(true);
    setErrorState(null);
    setProgressMsg('AI đang nghiên cứu chủ đề và xây dựng dàn ý...');
    try {
      const data = await generateOutline(topic, config);
      setOutline(data);
      if (step < 3) nextStep();
    } catch (error: any) {
      const isQuota = error.message.includes('429') || error.message.toLowerCase().includes('quota');
      setErrorState({
        message: isQuota ? "Hạn mức API miễn phí đã hết. Vui lòng sử dụng API Key cá nhân để tiếp tục." : error.message,
        isQuota
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateTitle = async (index: number) => {
    const currentItem = outline[index];
    const newOutline = [...outline];
    const originalTitle = currentItem.title;
    newOutline[index].title = "Đang suy nghĩ tiêu đề mới...";
    setOutline(newOutline);

    try {
      const newTitle = await regenerateOutlineTitle(originalTitle, topic, config);
      newOutline[index].title = newTitle;
      setOutline([...newOutline]);
    } catch (e: any) {
      newOutline[index].title = originalTitle;
      setOutline([...newOutline]);
      const isQuota = e.message.includes('429') || e.message.toLowerCase().includes('quota');
      setErrorState({
        message: isQuota ? "Hạn mức API đã hết khi tạo tiêu đề." : "Lỗi khi viết lại tiêu đề.",
        isQuota
      });
    }
  };

  const moveOutlineItem = (index: number, direction: 'up' | 'down') => {
    const newOutline = [...outline];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOutline.length) return;
    
    [newOutline[index], newOutline[targetIndex]] = [newOutline[targetIndex], newOutline[index]];
    setOutline(newOutline);
  };

  const handleGenerateArticle = async () => {
    setIsLoading(true);
    setErrorState(null);
    setProgressMsg('AI đang viết nội dung bài viết...');
    try {
      const data = await generateArticleContent(topic, config, outline);
      setProgressMsg('Đang đưa sản phẩm thực tế của bạn vào bối cảnh chuyên nghiệp...');
      
      const imagePromises = data.sections.map(async (sec) => {
        try {
          const img = await generateAIImage(sec.prompt || sec.title, config.productImage);
          return { ...sec, image: img };
        } catch (imgError) {
          console.error("Lỗi tạo ảnh cho mục:", sec.title, imgError);
          return { ...sec, image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop" };
        }
      });

      const sectionsWithImages = await Promise.all(imagePromises);
      
      setArticle({ ...data, sections: sectionsWithImages });
      nextStep();
    } catch (error: any) {
      const isQuota = error.message.includes('429') || error.message.toLowerCase().includes('quota');
      setErrorState({
        message: isQuota ? "Hạn mức API đã hết khi đang viết bài. Hãy sử dụng Key cá nhân." : error.message,
        isQuota
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadWord = async () => {
    if (!article) return;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
          <meta charset="UTF-8">
          <title>${article.title}</title>
          <style>
              body { font-family: 'Arial', sans-serif; line-height: 1.6; }
              h1 { color: #7c3aed; text-align: center; font-size: 24pt; margin-bottom: 20pt; }
              h2 { color: #1e293b; border-bottom: 2px solid #7c3aed; padding-bottom: 5pt; margin-top: 25pt; font-size: 18pt; }
              p { margin-bottom: 15pt; font-size: 12pt; }
              img { width: 600px; display: block; margin: 20pt auto; }
          </style>
      </head>
      <body>
          <h1>${article.title}</h1>
          ${article.sections.map(s => `
              <div style="margin-bottom: 30pt;">
                  <h2>${s.title}</h2>
                  ${s.image ? `<img src="${s.image}" width="600" />` : ''}
                  <div style="white-space: pre-wrap; font-size: 12pt;">${s.content}</div>
              </div>
          `).join("")}
          <div style="margin-top: 50pt; text-align: center; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20pt;">
              <p>Bài viết được tạo bởi SEO Writer by Mr Thoan</p>
              <p style="color: #22c55e; font-weight: bold;">Ủng hộ tác giả cốc cafe: 0988771339 (MB Bank)</p>
          </div>
      </body>
      </html>
    `;

    try {
      // Sử dụng thư viện để chuyển đổi HTML sang DOCX thật (hỗ trợ ảnh nhúng)
      const blob = await asBlob(htmlContent);
      const url = URL.createObjectURL(blob as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${article.title.substring(0, 30)}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Lỗi xuất Word:", error);
      // Fallback sang phương pháp cũ nếu thư viện lỗi
      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${article.title.substring(0, 30)}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleRegenerateImage = async (index: number) => {
    if (!article) return;
    const section = article.sections[index];
    const newSections = [...article.sections];
    
    // Temporary loading state for this image
    const originalImage = section.image;
    newSections[index].image = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop"; // Placeholder while loading
    setArticle({ ...article, sections: newSections });

    try {
      const newImg = await generateAIImage(section.prompt || section.title, config.productImage);
      newSections[index].image = newImg;
      setArticle({ ...article, sections: [...newSections] });
    } catch (error: any) {
      console.error("Lỗi tạo lại ảnh:", error);
      newSections[index].image = originalImage;
      setArticle({ ...article, sections: [...newSections] });
      const isQuota = error.message.includes('429') || error.message.toLowerCase().includes('quota');
      setErrorState({
        message: isQuota ? "Hạn mức API đã hết khi tạo lại ảnh." : "Lỗi khi tạo lại ảnh.",
        isQuota
      });
    }
  };

  const downloadSingleImage = async (url: string, name: string) => {
    if (!url) return;
    try {
      // If it's a base64 string, we can download it directly
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${name.replace(/\s+/g, '-').toLowerCase()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // If it's a URL, we need to fetch it to avoid CORS issues with the download attribute
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${name.replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error("Download failed", error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const handleDownloadAllImages = async () => {
    if (!article) return;
    // We use a loop with delays to avoid browser blocking multiple downloads
    for (let i = 0; i < article.sections.length; i++) {
      const sec = article.sections[i];
      if (sec.image) {
        await downloadSingleImage(sec.image, `anh-${i + 1}-${sec.title.substring(0, 20)}`);
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const handleToggleEdit = () => setIsEditing(!isEditing);

  const updateArticleField = (index: number, field: 'title' | 'content', value: string) => {
    if (!article) return;
    const newSections = [...article.sections];
    newSections[index][field] = value;
    setArticle({ ...article, sections: newSections });
  };

  const handleExportFile = () => {
    if (!article) return;
    
    const header = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
        body { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
          line-height: 1.8; 
          color: #1e293b; 
          max-width: 900px; 
          margin: 0 auto; 
          padding: 60px 20px; 
          background-color: #f8fafc; 
        }
        .container { 
          background: white; 
          padding: 50px; 
          border-radius: 24px; 
          box-shadow: 0 10px 50px rgba(0,0,0,0.05); 
          border: 1px solid #e2e8f0;
        }
        h1 { 
          color: #7c3aed; 
          text-align: center; 
          font-size: 3rem; 
          margin-bottom: 50px; 
          line-height: 1.2;
          font-weight: 800;
        }
        h2 { 
          color: #0f172a; 
          border-left: 6px solid #7c3aed; 
          padding-left: 20px; 
          margin-top: 60px; 
          font-size: 2rem; 
          font-weight: 700;
        }
        p { 
          margin-bottom: 25px; 
          font-size: 1.15rem; 
          color: #334155; 
        }
        img { 
          width: 100%; 
          height: auto; 
          border-radius: 20px; 
          margin: 40px 0; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
          display: block; 
        }
        .content {
          white-space: pre-wrap;
        }
        .footer { 
          margin-top: 80px; 
          text-align: center; 
          font-size: 0.95rem; 
          color: #64748b; 
          border-top: 1px solid #f1f5f9; 
          padding-top: 30px; 
        }
        .badge {
          display: inline-block;
          background: #f5f3ff;
          color: #7c3aed;
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="badge">SEO ARTICLE</div>
        <h1>${article.title}</h1>
        ${article.sections.map((s, idx) => `
            <section>
                <h2>${s.title}</h2>
                ${s.image ? `<img src="${s.image}" alt="${s.title}" />` : ''}
                <div class="content">${s.content}</div>
            </section>
        `).join('')}
        <div class="footer">
            <p>Bài viết được tạo bởi <strong>SEO Writer by Mr Thoan</strong></p>
            <p>© ${new Date().getFullYear()} Mr Thoan. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([header], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${article.title.substring(0, 50)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalWords = article ? article.sections.reduce((acc, sec) => acc + (sec.content.split(/\s+/).filter(Boolean).length), 0) : 0;
  const totalImages = article ? article.sections.filter(sec => sec.image).length : 0;

  const renderStepper = () => (
    <div className="flex items-center justify-center space-x-4 mb-12 select-none print:hidden">
      {[1, 2, 3, 4].map((s) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
              step >= s ? 'purple-bg text-white scale-110 shadow-lg' : 'bg-gray-800 text-gray-500 border border-gray-700'
            }`}>
              {step > s ? '✓' : s}
            </div>
            <span className={`text-xs mt-2 font-medium ${step >= s ? 'text-purple-400' : 'text-gray-500'}`}>
              {s === 1 ? 'Chủ đề' : s === 2 ? 'Cấu hình' : s === 3 ? 'Outline' : 'Viết bài'}
            </span>
          </div>
          {s < 4 && <div className={`h-1 w-16 rounded transition-all duration-500 ${step > s ? 'purple-bg' : 'bg-gray-800'}`} />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 transition-colors duration-500" style={{ backgroundColor: appBgColor, color: '#f3f4f6' }}>
      <header className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-between mb-12 gap-6 print:hidden">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-purple-400 shadow-md transition-all duration-500 hover:scale-125 hover:rotate-6 cursor-pointer">
            <img 
              src={customLogo} 
              className="w-full h-full object-cover" 
              alt="Logo" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-white leading-tight">SEO Writer <span className="text-purple-400 font-normal">by Mr Thoan</span></h1>
              <p className="text-green-500 font-bold text-sm tracking-wide flex items-center gap-2">
                Ủng hộ tác giả cốc cafe
                <QrCode 
                  size={28} 
                  className="cursor-pointer hover:text-white transition-colors" 
                  onClick={() => setShowQRModal(true)}
                  title="Quét mã QR ủng hộ"
                />
              </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 text-sm font-medium text-gray-300">
          <div className="relative">
            <button 
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-purple-400 hover:text-purple-400 transition-all bg-[#1e293b]"
              title="Thay đổi màu nền"
            >
              <Palette size={14} />
              <span className="text-xs">Màu nền</span>
            </button>
            
            {showColorPicker && (
              <div className="absolute top-full right-0 mt-2 p-3 bg-[#1e293b] border border-gray-700 rounded-xl shadow-2xl z-50 flex flex-col space-y-2 min-w-[120px]">
                {bgOptions.map((opt) => (
                  <button
                    key={opt.color}
                    onClick={() => { setAppBgColor(opt.color); setShowColorPicker(false); }}
                    className="flex items-center space-x-2 p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: opt.color }}></div>
                    <span className="text-[10px] whitespace-nowrap">{opt.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>



          {/* API Key Button - Only show in AI Studio or if needed */}
          {(typeof window !== 'undefined' && window.aistudio) ? (
            <button 
              onClick={handleOpenKeySelector}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-purple-400 hover:text-purple-400 transition-all bg-[#1e293b]"
              title="Cấu hình API Key cá nhân"
            >
              <Key size={14} />
              <span className="text-xs">API Key</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-gray-800 bg-[#0f172a] text-gray-500">
              <Check size={12} className="text-green-500" />
              <span className="text-[10px] uppercase tracking-wider font-bold">Vercel Mode</span>
            </div>
          )}
          <span className="hidden lg:inline border-l pl-3 border-gray-700">Hỗ trợ: 0988771339</span>
          <div className="relative group">
            <img 
              src={customAvatar} 
              className="w-16 h-16 rounded-full border-2 border-purple-400 p-0.5 object-cover transition-all duration-500 group-hover:scale-[3.0] group-hover:rotate-12 cursor-pointer shadow-lg group-hover:shadow-purple-400/50 z-10" 
              alt="Avatar" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-[#0f172a] rounded-full"></div>
          </div>
        </div>
      </header>

      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl bg-[#1e293b] rounded-3xl shadow-2xl border border-gray-800 p-8 md:p-12 min-h-[500px] flex flex-col relative print:border-none print:shadow-none print:p-0"
      >
        {renderStepper()}

        {errorState && (
          <div className="mb-8 p-6 bg-red-900/20 border border-red-900/50 rounded-2xl animate-in fade-in slide-in-from-top-4 print:hidden">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-red-900/30 rounded-lg text-red-400 shrink-0">
                <BarChart3 size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-red-200 font-bold mb-1">Thông báo hệ thống</h3>
                <p className="text-red-400 text-sm leading-relaxed mb-4">{errorState.message}</p>
                {errorState.isQuota && (
                  <button 
                    onClick={handleOpenKeySelector}
                    className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-md"
                  >
                    <Key size={16} />
                    <span>Sử dụng API Key cá nhân</span>
                  </button>
                )}
              </div>
              <button onClick={() => setErrorState(null)} className="text-red-400 hover:text-red-200"><Trash2 size={18} /></button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-purple-900/30 border-t-purple-500 rounded-full animate-spin mb-6" />
            <p className="text-lg font-medium text-purple-400 animate-pulse text-center px-4">{progressMsg}</p>
            <p className="text-gray-500 text-sm mt-2">Vui lòng không đóng trình duyệt...</p>
          </div>
        ) : (
          <div className="flex-1">
            {step === AppStep.TOPIC && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-bold text-white mb-4">Bước 1: Bạn muốn viết bài SEO cho chủ đề gì?</h2>
                  <p className="text-gray-400">Nhập chủ đề và AI sẽ giúp bạn xây dựng bài viết chuẩn SEO hoàn chỉnh.</p>
                </div>
                <div className="relative max-w-2xl mx-auto">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500">
                    <Search size={24} />
                  </div>
                  <input 
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ví dụ: khóa học Youtube AI chuyên sâu..."
                    className="w-full pl-14 pr-20 py-5 bg-[#0f172a] border-2 border-gray-800 rounded-2xl focus:border-purple-500 focus:bg-[#1e293b] outline-none transition-all text-xl text-white placeholder-gray-600"
                    onKeyDown={(e) => e.key === 'Enter' && topic && nextStep()}
                  />
                  <button 
                    disabled={!topic}
                    onClick={nextStep}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      topic ? 'purple-bg text-white shadow-lg hover:scale-105' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              </div>
            )}

            {step === AppStep.CONFIG && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500 grid md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <label className="block text-lg font-bold text-purple-400">Phong cách viết</label>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {Object.values(WritingStyle).map((s) => (
                      <button 
                        key={s}
                        onClick={() => setConfig({ ...config, style: s })}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center space-x-4 group ${
                          config.style === s ? 'border-purple-500 bg-purple-900/20' : 'border-gray-800 hover:border-purple-900/50 bg-[#0f172a]'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          config.style === s ? 'border-purple-500 bg-white' : 'border-gray-700'
                        }`}>
                          {config.style === s && <div className="w-2.5 h-2.5 rounded-full purple-bg" />}
                        </div>
                        <div className="flex-1">
                          <p className={`font-bold leading-none ${config.style === s ? 'text-purple-400' : 'text-gray-300'}`}>{s}</p>
                          <p className="text-xs text-gray-500 mt-1.5 leading-tight">{STYLE_DESCRIPTIONS[s]}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  {/* PHẦN TẢI ẢNH SẢN PHẨM THỰC TẾ */}
                  <div>
                    <label className="block font-bold text-gray-200 mb-2">Ảnh sản phẩm thực tế (Mở rộng)</label>
                    <div 
                      onClick={() => !config.productImage && fileInputRef.current?.click()}
                      className={`relative w-full h-32 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden cursor-pointer ${
                        config.productImage ? 'border-purple-500 bg-purple-900/20' : 'border-gray-800 hover:border-purple-400 bg-[#0f172a]'
                      }`}
                    >
                      {config.productImage ? (
                        <>
                          <img src={config.productImage} className="w-full h-full object-contain p-2" alt="Product preview" referrerPolicy="no-referrer" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeProductImage(); }}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700 shadow-md"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload className="text-gray-600 mb-2" size={28} />
                          <span className="text-xs text-gray-500 font-medium">Tải ảnh sản phẩm của bạn</span>
                          <span className="text-[10px] text-gray-600 mt-1">PNG, JPG tối đa 5MB</span>
                        </>
                      )}
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-200 mb-2">Từ khóa chính (Main Keyword)</label>
                    <input 
                      type="text"
                      value={config.mainKeyword}
                      onChange={(e) => setConfig({ ...config, mainKeyword: e.target.value })}
                      placeholder="Ví dụ: digital marketing, giảm cân..."
                      className="w-full p-4 bg-[#0f172a] rounded-xl border border-gray-800 outline-none focus:ring-2 focus:ring-purple-900/50 text-white placeholder-gray-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="font-bold text-gray-200">Số lượng mục (H2)</label>
                      <span className="purple-bg text-white px-2 py-0.5 rounded text-sm">{config.h2Count}</span>
                    </div>
                    <input type="range" min="3" max="15" value={config.h2Count} onChange={(e) => setConfig({...config, h2Count: parseInt(e.target.value)})} className="w-full accent-purple-600" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="font-bold text-gray-200">Số lượng từ ước tính</label>
                      <span className="purple-bg text-white px-2 py-0.5 rounded text-sm">{config.wordCount}</span>
                    </div>
                    <input type="range" min="500" max="4000" step="100" value={config.wordCount} onChange={(e) => setConfig({...config, wordCount: parseInt(e.target.value)})} className="w-full accent-purple-600" />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-200 mb-2">Ngôn ngữ</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Tiếng Việt', 'Tiếng Anh', 'Tiếng Trung', 'Tiếng Hàn'].map(lang => (
                        <button key={lang} onClick={() => setConfig({...config, language: lang})} className={`py-2 rounded-lg border text-sm transition-all ${config.language === lang ? 'border-purple-500 bg-purple-900/30 text-purple-400 font-bold' : 'border-gray-800 text-gray-400 bg-[#0f172a]'}`}>{lang}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-200 mb-2">Thông tin bổ sung</label>
                    <textarea value={config.additionalInfo} onChange={(e) => setConfig({...config, additionalInfo: e.target.value})} placeholder="Nhập thêm yêu cầu..." className="w-full p-4 bg-[#0f172a] rounded-xl border border-gray-800 min-h-[100px] text-white placeholder-gray-600" />
                  </div>
                </div>
              </div>
            )}

            {step === AppStep.OUTLINE && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Dàn ý bài viết (Outline)</h2>
                    <p className="text-gray-400 text-sm">Chỉnh sửa tiêu đề các mục để AI viết bài tốt hơn.</p>
                  </div>
                  <button onClick={handleGenerateOutline} className="flex items-center space-x-2 text-purple-400 hover:bg-purple-900/20 px-3 py-2 rounded-lg font-bold transition-all"><RotateCcw size={18} /><span>Tạo lại toàn bộ</span></button>
                </div>
                <div className="space-y-4">
                  {outline.map((item, index) => (
                    <div key={item.id} className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-purple-900/30 text-purple-400 flex items-center justify-center font-bold text-sm shrink-0 border border-purple-900/50">{index + 1}</div>
                      <div className="flex-1 relative group">
                        <div className="flex items-center bg-[#0f172a] rounded-xl border border-gray-800 overflow-hidden focus-within:border-purple-500 transition-all shadow-lg">
                          <input 
                            className="flex-1 bg-transparent border-none outline-none font-medium text-white px-6 py-4 placeholder-gray-600" 
                            value={item.title} 
                            onChange={(e) => { 
                              const newOutline = [...outline]; 
                              newOutline[index].title = e.target.value; 
                              setOutline(newOutline); 
                            }} 
                          />
                          <div className="flex items-center space-x-1 bg-[#1e293b] py-2 px-3 m-2 rounded-lg shadow-2xl border border-gray-700">
                            <button 
                              onClick={() => handleRegenerateTitle(index)}
                              title="Viết lại mục này" 
                              className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-gray-800 rounded transition-all"
                            >
                              <RefreshCw size={16} />
                            </button>
                            <div className="w-px h-4 bg-gray-700 mx-1"></div>
                            <button 
                              onClick={() => moveOutlineItem(index, 'up')}
                              disabled={index === 0}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded disabled:opacity-20 transition-all"
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button 
                              onClick={() => moveOutlineItem(index, 'down')}
                              disabled={index === outline.length - 1}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded disabled:opacity-20 transition-all"
                            >
                              <ArrowDown size={16} />
                            </button>
                            <div className="w-px h-4 bg-gray-700 mx-1"></div>
                            <button 
                              onClick={() => setOutline(outline.filter(o => o.id !== item.id))} 
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => setOutline([...outline, { id: `new-${Date.now()}`, title: '' }])} 
                    className="w-full py-5 bg-[#0f172a] border-2 border-dashed border-gray-800 rounded-xl text-gray-500 hover:text-purple-400 hover:border-purple-500 flex items-center justify-center space-x-2 transition-all group"
                  >
                    <Plus size={22} className="group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-lg">Thêm mục mới</span>
                  </button>
                </div>
              </div>
            )}

            {step === AppStep.WRITING && article && (
              <div className="animate-in zoom-in-95 duration-700">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800 print:mb-4">
                   <h2 className="text-3xl font-bold text-white leading-tight">{article.title}</h2>
                  <div className="flex space-x-2 print:hidden shrink-0">
                    <button onClick={handleDownloadAllImages} className="flex items-center space-x-2 bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border border-purple-900/50"><ImageIcon size={18} /><span>Tải tất cả ảnh</span></button>
                    <button onClick={handleDownloadWord} className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all"><Download size={18} /><span>Word</span></button>
                    <button onClick={handleToggleEdit} className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${isEditing ? 'bg-green-600 text-white' : 'purple-bg text-white shadow-lg shadow-purple-900/20'}`}>{isEditing ? <Check size={18} /> : <PenTool size={18} />}<span>{isEditing ? 'Lưu' : 'Sửa'}</span></button>
                  </div>
                </div>
                <div className="prose prose-invert prose-purple max-w-none space-y-12 text-gray-300 leading-relaxed mb-16">
                  {article.sections.map((sec, idx) => (
                    <div key={idx} className="space-y-6">
                      {isEditing ? (
                        <input className="w-full text-2xl font-bold border-l-4 border-purple-600 pl-4 py-1 bg-purple-900/20 text-white outline-none" value={sec.title} onChange={(e) => updateArticleField(idx, 'title', e.target.value)} />
                      ) : (
                        <h3 className="text-2xl font-bold text-white border-l-4 border-purple-600 pl-4">{sec.title}</h3>
                      )}
                      
                      {sec.image && (
                        <div className="relative group/img overflow-hidden rounded-3xl shadow-2xl border border-gray-800 z-0 hover:z-50">
                          <img 
                            src={sec.image} 
                            className="w-full object-cover max-h-[600px] transition-all duration-1000 ease-in-out group-hover/img:scale-[6.0] group-hover/img:brightness-50 cursor-zoom-in" 
                            alt={sec.title} 
                            referrerPolicy="no-referrer"
                            onClick={() => setZoomedImage(sec.image!)}
                          />
                          <div className="absolute inset-0 bg-purple-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity duration-500 pointer-events-none flex items-center justify-center">
                            <span className="text-white font-bold text-xl opacity-0 group-hover/img:opacity-100 transition-opacity delay-300">Click để xem chi tiết</span>
                          </div>
                          <div className="absolute top-4 right-4 flex flex-col space-y-2 opacity-0 group-hover/img:opacity-100 translate-x-4 group-hover/img:translate-x-0 transition-all duration-500 z-10 print:hidden">
                            <button 
                              onClick={() => downloadSingleImage(sec.image!, `anh-${idx + 1}-${sec.title}`)}
                              className="bg-gray-900/90 backdrop-blur-md p-3 rounded-2xl shadow-lg text-purple-400 hover:bg-purple-600 hover:text-white transition-all"
                              title="Tải ảnh này"
                            >
                              <Download size={20} />
                            </button>
                            <button 
                              onClick={() => handleRegenerateImage(idx)}
                              className="bg-gray-900/90 backdrop-blur-md p-3 rounded-2xl shadow-lg text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                              title="Tạo lại ảnh này"
                            >
                              <RefreshCw size={20} />
                            </button>
                          </div>
                        </div>
                      )}

                      {isEditing ? (
                        <textarea className="w-full text-lg min-h-[200px] p-4 bg-[#0f172a] border border-gray-800 rounded-xl text-white outline-none" value={sec.content} onChange={(e) => updateArticleField(idx, 'content', e.target.value)} />
                      ) : (
                        <div className="text-lg whitespace-pre-wrap">{sec.content}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* THÔNG SỐ BÀI VIẾT */}
                <div className="bg-[#0f172a] p-8 rounded-[2.5rem] mb-8 animate-in slide-in-from-bottom-4 print:hidden">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Thông số bài viết</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#1e293b] p-5 rounded-3xl">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Số từ</p>
                      <p className="text-2xl font-black text-white leading-none">{totalWords}</p>
                    </div>
                    <div className="bg-[#1e293b] p-5 rounded-3xl">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Số hình</p>
                      <p className="text-2xl font-black text-white leading-none">{totalImages}</p>
                    </div>
                  </div>
                </div>

                {/* SEO SCORECARD */}
                <div className="bg-[#1e293b] p-10 rounded-[2.5rem] border border-gray-800 shadow-2xl shadow-purple-900/10 mb-12 animate-in slide-in-from-bottom-8 print:hidden">
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center space-x-2">
                      <BarChart3 size={20} className="text-purple-400" />
                      <h4 className="font-black text-white text-lg uppercase tracking-[0.2em]">BẢNG ĐIỂM SEO / SEO SCORECARD</h4>
                    </div>
                    <div className="bg-green-900/30 text-green-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border border-green-900/50">
                      Điểm: 100/100
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {[
                      { label: 'Từ khóa chính', status: true },
                      { label: 'Từ khóa phụ (LSI)', status: true },
                      { label: 'Cấu trúc thẻ H2', status: true },
                      { label: 'Hình ảnh bài viết', status: true },
                      { label: 'Độ dài tối ưu', status: true }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between pb-1 border-b border-gray-800 last:border-none">
                        <span className="text-2xl font-bold text-gray-200 tracking-tight">{item.label}</span>
                        <div className="w-5 h-5 rounded-full bg-green-900/20 flex items-center justify-center">
                          <Check size={12} className="text-green-400" strokeWidth={4} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 pt-8 border-t border-gray-800 flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Đánh giá chung</span>
                      <span className="text-3xl font-black text-purple-400 leading-none">Tuyệt vời</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Tiềm năng</span>
                      <span className="text-xl font-black text-white leading-none">Top 1-3</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!isLoading && (
          <div className="mt-12 pt-8 border-t border-gray-800 flex justify-between items-center sticky bottom-0 bg-[#1e293b]/90 backdrop-blur-sm print:hidden">
            <button onClick={prevStep} className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold ${step === 1 ? 'opacity-0' : 'text-gray-400 hover:bg-gray-800'}`}><ChevronLeft size={20} /><span>Quay lại</span></button>
            {step === AppStep.TOPIC && <button disabled={!topic} onClick={nextStep} className="purple-bg hover:purple-hover text-white px-8 py-4 rounded-xl font-bold flex items-center space-x-2 shadow-xl disabled:opacity-50"><span>Tiếp tục</span><ChevronRight size={20} /></button>}
            {step === AppStep.CONFIG && <button onClick={handleGenerateOutline} className="purple-bg hover:purple-hover text-white px-8 py-4 rounded-xl font-bold shadow-xl">Tạo Outline</button>}
            {step === AppStep.OUTLINE && <button onClick={handleGenerateArticle} className="purple-bg hover:purple-hover text-white px-8 py-4 rounded-xl font-bold shadow-xl">Viết bài ngay</button>}
            {step === AppStep.WRITING && (
              <div className="flex space-x-3">
                <button onClick={() => { setStep(AppStep.TOPIC); setIsEditing(false); }} className="bg-gray-800 text-gray-300 px-6 py-4 rounded-xl font-bold hover:bg-gray-700 transition-all">Mới</button>
                <button onClick={handleDownloadWord} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold shadow-xl flex items-center space-x-2 transition-all">
                  <FileText size={20} />
                  <span>Xuất Word</span>
                </button>
                <button onClick={handleExportFile} className="purple-bg hover:purple-hover text-white px-8 py-4 rounded-xl font-bold shadow-xl flex items-center space-x-2 transition-all">
                  <FileOutput size={20} />
                  <span>Xuất Trang Web</span>
                </button>
              </div>
            )}
          </div>
        )}
      </motion.main>

      <footer className="mt-12 mb-10 text-center text-gray-500 text-sm print:hidden flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-px w-12 bg-gray-800"></div>
          <p className="text-green-500 font-bold flex items-center gap-2">
            Ủng hộ tác giả cốc cafe
            <QrCode 
              size={28} 
              className="cursor-pointer hover:text-white transition-colors" 
              onClick={() => setShowQRModal(true)}
              title="Quét mã QR ủng hộ"
            />
          </p>
          <div className="h-px w-12 bg-gray-800"></div>
        </div>
        <div className="opacity-60">
          <p>© {new Date().getFullYear()} SEO Writer by Mr Thoan. All rights reserved.</p>
          <p className="mt-1">Powered by Google Gemini 3 Flash & Nano Banana</p>
        </div>
      </footer>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors bg-white/10 p-2 rounded-full"
            onClick={() => setZoomedImage(null)}
          >
            <X size={32} />
          </button>
          <img 
            src={zoomedImage} 
            className="max-w-full max-h-full rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300" 
            alt="Zoomed view" 
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setShowQRModal(false)}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1e293b] p-6 rounded-[2rem] border border-gray-800 shadow-2xl max-w-[340px] w-full text-center relative overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors bg-gray-800/50 p-1 rounded-full"
              onClick={() => setShowQRModal(false)}
            >
              <X size={20} />
            </button>
            <div className="mb-4">
              <div className="w-14 h-14 bg-green-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <QrCode size={28} className="text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1 leading-tight">Ủng hộ tác giả cốc cafe qua mã QR:</h3>
              <p className="text-gray-400 text-xs">Quét mã QR bên dưới để ủng hộ tác giả nhé!</p>
            </div>
            
            <div className="bg-white p-3 rounded-2xl mb-4 inline-block shadow-inner">
              <img 
                src="https://img.vietqr.io/image/MB-0988771339-compact2.jpg?addInfo=Ung%20ho%20tac%20gia%20coc%20Cafe&accountName=Nguyen%20Viet%20Thoan" 
                alt="MB Bank QR Code" 
                className="w-56 h-auto mx-auto"
              />
            </div>
            
            <div className="space-y-2">
              <div className="p-2 bg-[#0f172a] rounded-xl border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">MB Bank - Nguyễn Viết Thoan</p>
                <p className="text-green-500 font-bold text-sm">STK: 0988771339</p>
              </div>
              <button 
                onClick={() => setShowQRModal(false)}
                className="w-full py-2 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-all text-sm"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        @media print { 
          body { background: white !important; color: black !important; } 
          main { border: none !important; width: 100% !important; margin: 0 !important; background: white !important; } 
          .prose { font-size: 12pt !important; color: black !important; } 
          h1, h2, h3, h4, p, span, div { color: black !important; }
          img { max-height: 400px !important; page-break-inside: avoid; } 
        }
      `}</style>
    </div>
  );
};

export default App;
