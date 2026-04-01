
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { asBlob } from 'html-docx-js-typescript';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { marked } from 'marked';
import { Search, Settings, FileText, PenTool, ChevronRight, ChevronLeft, RotateCcw, ArrowUp, ArrowDown, Trash2, Plus, Download, Image as ImageIcon, FileOutput, Save, Check, RefreshCw, Copy, BarChart3, Key, Upload, X, Palette, QrCode } from 'lucide-react';
import { AppStep, WritingStyle, SEOConfig, OutlineSection, GeneratedArticle, AIProvider } from './types';
import { generateOutline, generateArticleContent, generateAIImage, regenerateOutlineTitle } from './services/aiService';
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
  const [config, setConfig] = useState<SEOConfig>(() => {
    const saved = localStorage.getItem('SEO_CONFIG');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved config", e);
      }
    }
    return {
      style: WritingStyle.GUIDE,
      mainKeyword: '',
      h2Count: 5,
      wordCount: 1500,
      language: 'Tiếng Việt',
      additionalInfo: '',
      productImages: [],
      provider: AIProvider.GEMINI,
      model: 'gemini-3-flash-preview'
    };
  });

  useEffect(() => {
    try {
      // Create a copy of config without images for persistence if they are too large
      const configToSave = { ...config };
      const serialized = JSON.stringify(configToSave);
      
      // Check if size is approaching localStorage limit (approx 5MB)
      if (serialized.length > 4 * 1024 * 1024) {
        console.warn("Config is too large to save to localStorage, removing images from persistence.");
        delete configToSave.productImages;
        localStorage.setItem('SEO_CONFIG', JSON.stringify(configToSave));
      } else {
        localStorage.setItem('SEO_CONFIG', serialized);
      }
    } catch (e) {
      console.error("Failed to save config to localStorage", e);
      // Fallback: try saving without images
      try {
        const fallbackConfig = { ...config };
        delete fallbackConfig.productImages;
        localStorage.setItem('SEO_CONFIG', JSON.stringify(fallbackConfig));
      } catch (innerError) {
        console.error("Critical failure saving to localStorage", innerError);
      }
    }
  }, [config]);
  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }, []);

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
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [selectedKeyProvider, setSelectedKeyProvider] = useState<AIProvider>(AIProvider.GEMINI);
  const [hasApiKey, setHasApiKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const keyMap: Record<AIProvider, string> = {
      [AIProvider.GEMINI]: 'GEMINI_API_KEY',
      [AIProvider.OPENAI]: 'OPENAI_API_KEY',
      [AIProvider.GROK]: 'GROK_API_KEY'
    };
    const key = localStorage.getItem(keyMap[config.provider]);
    setHasApiKey(!!key);
  }, [config.provider]);

  useEffect(() => {
    const keyMap: Record<AIProvider, string> = {
      [AIProvider.GEMINI]: 'GEMINI_API_KEY',
      [AIProvider.OPENAI]: 'OPENAI_API_KEY',
      [AIProvider.GROK]: 'GROK_API_KEY'
    };
    const key = localStorage.getItem(keyMap[selectedKeyProvider]);
    if (showKeyInput) {
      setApiKeyInput(key || '');
    }
  }, [selectedKeyProvider, showKeyInput]);

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
      } catch (error: any) {
        console.error("Failed to generate custom images", error);
      }
    };
    loadCustomImages();
  }, []);

  const nextStep = () => {
    setStep(prev => Math.min(prev + 1, 4));
  };
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const handleOpenKeySelector = async () => {
    setShowKeyInput(true);
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setApiKeyInput(text);
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
  };

  const handleRemoveKey = () => {
    const keyMap: Record<AIProvider, string> = {
      [AIProvider.GEMINI]: 'GEMINI_API_KEY',
      [AIProvider.OPENAI]: 'OPENAI_API_KEY',
      [AIProvider.GROK]: 'GROK_API_KEY'
    };
    localStorage.removeItem(keyMap[selectedKeyProvider]);
    setHasApiKey(false);
    setApiKeyInput('');
    window.location.reload();
  };

  const handleSaveKey = () => {
    if (apiKeyInput.trim()) {
      const keyMap: Record<AIProvider, string> = {
        [AIProvider.GEMINI]: 'GEMINI_API_KEY',
        [AIProvider.OPENAI]: 'OPENAI_API_KEY',
        [AIProvider.GROK]: 'GROK_API_KEY'
      };
      localStorage.setItem(keyMap[selectedKeyProvider], apiKeyInput.trim());
      setHasApiKey(true);
      setShowKeyInput(false);
      window.location.reload();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    try {
      let files: FileList | null = null;
      if ('files' in e.target && e.target.files) {
        files = e.target.files;
      } else if ('dataTransfer' in e && e.dataTransfer.files) {
        files = e.dataTransfer.files;
        e.preventDefault();
      }

      if (files && files.length > 0) {
        const fileArray = Array.from(files);
        
        // Filter out files larger than 5MB to prevent memory issues
        const validFiles = fileArray.filter(file => {
          if (file.size > 5 * 1024 * 1024) {
            alert(`File ${file.name} quá lớn (tối đa 5MB).`);
            return false;
          }
          return true;
        });

        if (validFiles.length === 0) return;

        const newImages = await Promise.all(
          validFiles.map(file => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error("Lỗi đọc file"));
              reader.readAsDataURL(file);
            });
          })
        );

        setConfig(prev => ({
          ...prev,
          productImages: [...(prev.productImages || []), ...newImages]
        }));
        
        // Reset input value to allow re-uploading the same file if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Lỗi tải ảnh:", error);
      alert("Có lỗi xảy ra khi tải ảnh. Vui lòng thử lại.");
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleImageUpload(e);
  };

  const removeProductImage = (index: number) => {
    const newImages = [...(config.productImages || [])];
    newImages.splice(index, 1);
    setConfig({ ...config, productImages: newImages });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerateOutline = async () => {
    if (!hasApiKey) {
      setErrorState({ message: "Bạn hãy Nạp API Key để tiếp tục!", isQuota: true });
      setShowKeyInput(true);
      return;
    }
    setIsLoading(true);
    setErrorState(null);
    setProgressMsg('AI đang nghiên cứu chủ đề và xây dựng dàn ý...');
    try {
      const data = await generateOutline(topic, config);
      setOutline(data);
      if (step < 3) nextStep();
    } catch (error: any) {
      console.error("Lỗi tạo dàn ý:", error);
      const isQuota = error.message.includes('429') || error.message.toLowerCase().includes('quota');
      const isInvalidKey = error.message.includes('403') || error.message.toLowerCase().includes('api key');
      
      let message = error.message;
      if (isQuota) message = "Hạn mức API miễn phí đã hết. Vui lòng nạp API Key cá nhân (trả phí) để tiếp tục.";
      if (isInvalidKey) message = "API Key không hợp lệ hoặc chưa được kích hoạt. Vui lòng kiểm tra lại trong phần Quản lý API Key.";
      
      setErrorState({ message, isQuota: isQuota || isInvalidKey });
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
      console.error("Lỗi viết lại tiêu đề:", e);
      newOutline[index].title = originalTitle;
      setOutline([...newOutline]);
      const isQuota = e.message.includes('429') || e.message.toLowerCase().includes('quota');
      const isInvalidKey = e.message.includes('403') || e.message.toLowerCase().includes('api key');
      
      let message = e.message;
      if (isQuota) message = "Hạn mức API đã hết khi tạo tiêu đề.";
      if (isInvalidKey) message = "API Key không hợp lệ.";

      setErrorState({ message, isQuota: isQuota || isInvalidKey });
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
    if (!hasApiKey) {
      setErrorState({ message: "Bạn hãy Nạp API Key để tiếp tục!", isQuota: true });
      setShowKeyInput(true);
      return;
    }
    setIsLoading(true);
    setErrorState(null);
    setProgressMsg('AI đang viết nội dung bài viết...');
    try {
      const data = await generateArticleContent(topic, config, outline);
      
      const sectionsWithImages = [...data.sections];
      const totalSections = sectionsWithImages.length;
      
      for (let i = 0; i < totalSections; i++) {
        const sec = sectionsWithImages[i];
        setProgressMsg(`Đang đưa sản phẩm vào bối cảnh chuyên nghiệp (${i + 1}/${totalSections})...`);
        
        try {
          const currentProductImage = config.productImages && config.productImages.length > 0 
            ? config.productImages[i % config.productImages.length] 
            : undefined;
          const img = await generateAIImage(sec.prompt || sec.title, currentProductImage);
          sectionsWithImages[i] = { ...sec, image: img };
        } catch (imgError) {
          console.error("Lỗi tạo ảnh cho mục:", sec.title, imgError);
          sectionsWithImages[i] = { ...sec, image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop" };
        }
      }
      
      setArticle({ ...data, sections: sectionsWithImages });
      nextStep();
    } catch (error: any) {
      console.error("Lỗi viết bài:", error);
      const isQuota = error.message.includes('429') || error.message.toLowerCase().includes('quota');
      const isInvalidKey = error.message.includes('403') || error.message.toLowerCase().includes('api key');
      
      let message = error.message;
      if (isQuota) message = "Hạn mức API đã hết khi đang viết bài. Hãy sử dụng Key cá nhân hoặc đổi Key khác.";
      if (isInvalidKey) message = "API Key không hợp lệ. Vui lòng kiểm tra lại.";

      setErrorState({ message, isQuota: isQuota || isInvalidKey });
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
              body { font-family: 'Arial', sans-serif; line-height: 1.4; color: #333; }
              h1 { color: #7c3aed; text-align: center; font-size: 20pt; margin-bottom: 12pt; }
              h2 { color: #1e293b; border-bottom: 1px solid #7c3aed; padding-bottom: 2pt; margin-top: 15pt; font-size: 14pt; }
              p { margin-bottom: 8pt; font-size: 11pt; }
              img { width: 15cm; height: 9cm; display: block; margin: 10pt auto; }
              .section { margin-bottom: 15pt; }
          </style>
      </head>
      <body>
          <h1>${article.title}</h1>
          ${article.sections.map(s => `
              <div class="section">
                  <h2>${s.title}</h2>
                  ${s.image ? `<div style="text-align: center; margin: 10pt 0;"><img src="${s.image}" style="width: 15cm; height: 9cm;" /></div>` : ''}
                  <div style="font-size: 11pt;">${marked.parse(s.content)}</div>
              </div>
          `).join("")}
          ${config.mapEmbedUrl ? `
              <div class="section">
                  <h2>Bản đồ chỉ đường</h2>
                  <p style="text-align: center; margin: 10pt 0;">
                      <a href="${config.mapEmbedUrl}" style="color: #7c3aed; font-weight: bold; text-decoration: underline;">Xem bản đồ chỉ đường trên Google Maps</a>
                  </p>
              </div>
          ` : ''}
          <div style="margin-top: 40pt; text-align: center; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15pt;">
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
      const currentProductImage = config.productImages && config.productImages.length > 0 
        ? config.productImages[index % config.productImages.length] 
        : undefined;
      const newImg = await generateAIImage(section.prompt || section.title, currentProductImage);
      newSections[index].image = newImg;
      setArticle({ ...article, sections: [...newSections] });
    } catch (error: any) {
      console.error("Lỗi tạo lại ảnh:", error);
      newSections[index].image = originalImage;
      setArticle({ ...article, sections: [...newSections] });
      const isQuota = error.message.includes('429') || error.message.toLowerCase().includes('quota');
      const isInvalidKey = error.message.includes('403') || error.message.toLowerCase().includes('api key');
      
      let message = error.message;
      if (isQuota) message = "Hạn mức API đã hết khi tạo lại ảnh.";
      if (isInvalidKey) message = "API Key không hợp lệ.";

      setErrorState({ message, isQuota: isQuota || isInvalidKey });
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
          line-height: 1.5; 
          color: #1e293b; 
          max-width: 800px; 
          margin: 0 auto; 
          padding: 30px 20px; 
          background-color: #f8fafc; 
        }
        .container { 
          background: white; 
          padding: 30px; 
          border-radius: 16px; 
          box-shadow: 0 10px 30px rgba(0,0,0,0.05); 
          border: 1px solid #e2e8f0;
        }
        h1 { 
          color: #7c3aed; 
          text-align: center; 
          font-size: 2.25rem; 
          margin-bottom: 30px; 
          line-height: 1.2;
          font-weight: 800;
        }
        h2 { 
          color: #0f172a; 
          border-left: 5px solid #7c3aed; 
          padding-left: 15px; 
          margin-top: 30px; 
          margin-bottom: 15px;
          font-size: 1.5rem; 
          font-weight: 700;
        }
        p { 
          margin-bottom: 15px; 
          font-size: 1.05rem; 
          color: #334155; 
        }
        img { 
          width: auto;
          max-width: 100%;
          max-height: 500px;
          height: auto; 
          border-radius: 12px; 
          margin: 20px auto; 
          box-shadow: 0 10px 20px rgba(0,0,0,0.1); 
          display: block; 
        }
        .content {
          /* white-space: pre-wrap; REMOVED to avoid double spacing with marked */
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
                <div class="content">${marked.parse(s.content)}</div>
            </section>
        `).join('')}
        ${config.mapEmbedUrl ? `
            <section>
                <h2>Bản đồ chỉ đường</h2>
                <div style="width: 100%; height: 450px; border-radius: 12px; overflow: hidden; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <iframe src="${config.mapEmbedUrl}" width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy"></iframe>
                </div>
            </section>
        ` : ''}
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

  const handleMapUrlChange = (value: string) => {
    // If user pastes the whole iframe tag, extract the src
    if (value.includes('<iframe')) {
      const match = value.match(/src="([^"]+)"/);
      if (match && match[1]) {
        setConfig({ ...config, mapEmbedUrl: match[1] });
        return;
      }
    }
    setConfig({ ...config, mapEmbedUrl: value });
  };

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



          {/* API Key Button */}
          {hasApiKey ? (
            <button 
              onClick={handleOpenKeySelector}
              className="group relative flex items-center justify-center w-10 h-10 rounded-xl bg-green-500 shadow-[0_4px_0_0_rgba(21,128,61,1)] active:shadow-none active:translate-y-[4px] transition-all duration-75"
              title="Quản lý API Key (Đã nạp)"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-xl pointer-events-none"></div>
              <Key size={20} className="text-white drop-shadow-md" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center shadow-sm">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </button>
          ) : (
            <button 
              onClick={handleOpenKeySelector}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-purple-400 hover:text-purple-400 transition-all bg-[#1e293b]"
              title="Cấu hình API Key cá nhân"
            >
              <Key size={14} />
              <span className="text-xs">Nạp API Key</span>
            </button>
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
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl flex items-start space-x-3"
          >
            <div className="bg-red-500 p-1 rounded-full shrink-0 mt-0.5">
              <X size={14} className="text-white" />
            </div>
            <div className="flex-1">
              <h4 className="text-red-400 font-bold text-sm mb-1">Lỗi hệ thống</h4>
              <p className="text-gray-300 text-sm">{errorState.message}</p>
              {errorState.isQuota && (
                <button 
                  onClick={() => setShowKeyInput(true)}
                  className="mt-3 text-xs font-bold text-white bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 transition-all"
                >
                  Nạp API Key mới ngay
                </button>
              )}
            </div>
            <button onClick={() => setErrorState(null)} className="text-gray-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </motion.div>
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
                  <p className="text-gray-400">Nhập chủ đề và từ khóa chính để AI giúp bạn xây dựng bài viết hoàn chỉnh.</p>
                </div>
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500">
                      <Search size={24} />
                    </div>
                    <input 
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Chủ đề bài viết (Ví dụ: Cách nấu bún cá Hà Nội ngon...)"
                      className="w-full pl-14 pr-6 py-5 bg-[#0f172a] border-2 border-gray-800 rounded-2xl focus:border-purple-500 focus:bg-[#1e293b] outline-none transition-all text-xl text-white placeholder-gray-600"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500">
                      <BarChart3 size={24} />
                    </div>
                    <input 
                      type="text"
                      value={config.mainKeyword}
                      onChange={(e) => setConfig({ ...config, mainKeyword: e.target.value })}
                      placeholder="Từ khóa chính cần quảng cáo (Ví dụ: bún cá Hà Nội, cách nấu bún cá...)"
                      className="w-full pl-14 pr-6 py-5 bg-[#0f172a] border-2 border-gray-800 rounded-2xl focus:border-purple-500 focus:bg-[#1e293b] outline-none transition-all text-xl text-white placeholder-gray-600"
                    />
                  </div>

                  <button 
                    disabled={!topic}
                    onClick={nextStep}
                    className={`w-full py-5 rounded-2xl font-bold text-xl flex items-center justify-center space-x-3 transition-all ${
                      topic ? 'purple-bg text-white shadow-xl hover:scale-[1.02] active:scale-95' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <span>Tiếp tục cấu hình</span>
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
                  {/* PHẦN CHỌN AI PROVIDER */}
                  <div>
                    <label className="block text-lg font-bold text-purple-400 mb-4">Nhà cung cấp AI</label>
                    <div className="grid grid-cols-3 gap-3">
                      {Object.values(AIProvider).map((p) => (
                        <button 
                          key={p}
                          onClick={() => {
                            let defaultModel = 'gemini-3-flash-preview';
                            if (p === AIProvider.OPENAI) defaultModel = 'gpt-4o';
                            if (p === AIProvider.GROK) defaultModel = 'grok-2';
                            setConfig({ ...config, provider: p, model: defaultModel });
                          }}
                          className={`p-3 rounded-xl border-2 transition-all text-xs font-bold flex flex-col items-center gap-2 ${
                            config.provider === p ? 'border-purple-500 bg-purple-900/20 text-white' : 'border-gray-800 bg-[#0f172a] text-gray-500'
                          }`}
                        >
                          {p === AIProvider.GEMINI && <span className="text-xl">💎</span>}
                          {p === AIProvider.OPENAI && <span className="text-xl">🤖</span>}
                          {p === AIProvider.GROK && <span className="text-xl">🚀</span>}
                          {p.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PHẦN CHỌN MODEL */}
                  <div>
                    <label className="block font-bold text-gray-200 mb-2">Model AI</label>
                    <select 
                      value={config.model}
                      onChange={(e) => setConfig({ ...config, model: e.target.value })}
                      className="w-full p-4 bg-[#0f172a] rounded-xl border border-gray-800 outline-none focus:ring-2 focus:ring-purple-900/50 text-white"
                    >
                      {config.provider === AIProvider.GEMINI && (
                        <>
                          <option value="gemini-3-flash-preview">Gemini 3 Flash (Nhanh, Rẻ)</option>
                          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Thông minh nhất)</option>
                          <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash</option>
                        </>
                      )}
                      {config.provider === AIProvider.OPENAI && (
                        <>
                          <option value="gpt-4o">GPT-4o (Toàn diện)</option>
                          <option value="gpt-4o-mini">GPT-4o Mini (Tiết kiệm)</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        </>
                      )}
                      {config.provider === AIProvider.GROK && (
                        <>
                          <option value="grok-2">Grok-2 (Mới nhất)</option>
                          <option value="grok-2-mini">Grok-2 Mini (Nhanh, Rẻ)</option>
                          <option value="grok-beta">Grok Beta</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* PHẦN TẢI ẢNH SẢN PHẨM THỰC TẾ */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-bold text-gray-200">Ảnh SP hay hình ảnh cá nhân</label>
                      {config.productImages && config.productImages.length > 0 && (
                        <button 
                          onClick={() => setConfig({ ...config, productImages: [] })}
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1"
                        >
                          <Trash2 size={10} />
                          Xóa tất cả
                        </button>
                      )}
                    </div>
                    <div 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`w-full min-h-[128px] p-4 rounded-2xl border-2 border-dashed transition-all ${
                        isDragging ? 'border-purple-500 bg-purple-900/20' : 'border-gray-800 bg-[#0f172a]'
                      }`}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                        {config.productImages && config.productImages.map((img, idx) => (
                          <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-purple-500/30 bg-purple-900/10 group/img-preview">
                            <img src={img} className="w-full h-full object-cover" alt={`Product preview ${idx}`} referrerPolicy="no-referrer" />
                            <button 
                              onClick={() => removeProductImage(idx)}
                              className="absolute top-1 right-1 bg-red-600/80 text-white p-1 rounded-full hover:bg-red-700 shadow-md backdrop-blur-sm opacity-0 group-hover/img-preview:opacity-100 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-gray-700 hover:border-purple-500 hover:bg-purple-900/10 transition-all flex flex-col items-center justify-center text-gray-500 hover:text-purple-400 group"
                        >
                          <Plus size={24} className="mb-1 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-medium">Thêm ảnh</span>
                        </button>
                      </div>
                      
                      <div className="text-center">
                        <span className="text-[10px] text-gray-600">
                          {isDragging ? 'Thả ảnh vào đây' : 'PNG, JPG tối đa 5MB. Có thể tải nhiều ảnh cùng lúc.'}
                        </span>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
                    </div>
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
                    <label className="block font-bold text-gray-200 mb-2">Thông tin liên hệ:</label>
                    <textarea value={config.additionalInfo} onChange={(e) => setConfig({...config, additionalInfo: e.target.value})} placeholder="Nhập thêm yêu cầu..." className="w-full p-4 bg-[#0f172a] rounded-xl border border-gray-800 min-h-[100px] text-white placeholder-gray-600" />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-200 mb-2">URL nhúng bản đồ (Map Embed URL):</label>
                    <input 
                      type="text"
                      value={config.mapEmbedUrl || ''}
                      onChange={(e) => handleMapUrlChange(e.target.value)}
                      placeholder="Dán mã nhúng <iframe> hoặc URL nhúng vào đây..."
                      className={`w-full p-4 bg-[#0f172a] rounded-xl border-2 outline-none focus:ring-2 focus:ring-purple-900/50 text-white placeholder-gray-600 transition-all ${
                        config.mapEmbedUrl && !config.mapEmbedUrl.includes('google.com/maps/embed') && !config.mapEmbedUrl.includes('google.com/maps/reserve') 
                        ? 'border-yellow-500/50' : 'border-gray-800'
                      }`}
                    />
                    {config.mapEmbedUrl && !config.mapEmbedUrl.includes('google.com/maps/embed') && (
                      <p className="text-[10px] text-yellow-500 mt-1 font-bold">
                        ⚠️ Cảnh báo: URL này có vẻ không phải là mã nhúng (Embed). Bản đồ có thể không hiển thị. 
                        Hãy chọn "Nhúng bản đồ" trên Google Maps để lấy mã đúng.
                      </p>
                    )}
                    <p className="text-[10px] text-gray-500 mt-1">Lưu ý: Bạn có thể dán cả đoạn mã <code>&lt;iframe&gt;</code> từ Google Maps vào đây, hệ thống sẽ tự tách lấy link.</p>
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
                        <div className="text-lg markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkBreaks]}>{sec.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {config.mapEmbedUrl && (
                    <div className="mt-12 space-y-6 animate-in slide-in-from-bottom-4">
                      <h3 className="text-2xl font-bold text-white border-l-4 border-purple-600 pl-4">Bản đồ chỉ đường</h3>
                      <div className="w-full h-[450px] rounded-3xl overflow-hidden border border-gray-800 shadow-2xl">
                        <iframe 
                          src={config.mapEmbedUrl} 
                          width="100%" 
                          height="100%" 
                          style={{ border: 0 }} 
                          allowFullScreen
                          loading="lazy" 
                          title="Google Maps Location"
                        />
                      </div>
                    </div>
                  )}
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
            />
          </p>
          <div className="h-px w-12 bg-gray-800"></div>
        </div>
        <div className="opacity-60">
          <p>© {new Date().getFullYear()} SEO Writer by Mr Thoan. All rights reserved.</p>
          <p className="mt-1">Powered by {config.provider} ({config.model})</p>
        </div>
      </footer>

      {/* API Key Management Modal */}
      {showKeyInput && (
        <div 
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setShowKeyInput(false)}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-[#1a0505] p-8 rounded-[2rem] border border-red-900/30 shadow-2xl max-w-[480px] w-full relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
              onClick={() => setShowKeyInput(false)}
            >
              <X size={24} />
            </button>

            <h3 className="text-2xl font-bold text-white mb-2">Quản lý API Key</h3>
            <p className="text-gray-500 text-xs mb-6">Cấu hình API Key cho từng nhà cung cấp để sử dụng dịch vụ.</p>
            
            {/* Provider Selection for Key */}
            <div className="flex bg-black/40 p-1 rounded-xl mb-6 border border-gray-800">
              {Object.values(AIProvider).map((p) => {
                const keyMap: Record<AIProvider, string> = {
                  [AIProvider.GEMINI]: 'GEMINI_API_KEY',
                  [AIProvider.OPENAI]: 'OPENAI_API_KEY',
                  [AIProvider.GROK]: 'GROK_API_KEY'
                };
                const hasKey = !!localStorage.getItem(keyMap[p]);
                return (
                  <button
                    key={p}
                    onClick={() => setSelectedKeyProvider(p)}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all relative ${
                      selectedKeyProvider === p ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {p.split(' ')[0]}
                    {hasKey && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-black"></div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-4 mb-8">
              {(() => {
                const keyMap: Record<AIProvider, string> = {
                  [AIProvider.GEMINI]: 'GEMINI_API_KEY',
                  [AIProvider.OPENAI]: 'OPENAI_API_KEY',
                  [AIProvider.GROK]: 'GROK_API_KEY'
                };
                const currentTabHasKey = !!localStorage.getItem(keyMap[selectedKeyProvider]);
                if (!currentTabHasKey) {
                  return (
                    <div className="bg-red-500/20 border border-red-500 p-3 rounded-lg mb-4 animate-bounce">
                      <p className="text-red-400 text-sm font-bold text-center">
                        ⚠️ Bạn hãy Nạp API Key để tiếp tục!
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
              <p className="text-gray-300 text-sm leading-relaxed">
                {selectedKeyProvider === AIProvider.GEMINI ? (
                  <>Nếu gặp lỗi hạn ngạch, hãy lấy API Key từ một Google Cloud Project <span className="font-bold text-white italic">khác</span>.</>
                ) : selectedKeyProvider === AIProvider.OPENAI ? (
                  <>Lấy API Key từ OpenAI Dashboard. Đảm bảo bạn có số dư trong tài khoản.</>
                ) : (
                  <>Lấy API Key từ xAI Console (Grok). API này tương thích với chuẩn OpenAI.</>
                )}
              </p>
              {selectedKeyProvider === AIProvider.GEMINI && (
                <p className="text-yellow-500 text-sm font-bold leading-relaxed">
                  QUAN TRỌNG: Trong Project mới đó, bạn phải BẬT (Enable) "Generative Language API" thì key mới hoạt động. 
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-cyan-400 underline ml-1 hover:text-cyan-300 transition-colors">(Bật tại đây)</a>
                </p>
              )}
            </div>

            {/* Input Group */}
            <div className="relative flex items-center mb-4">
              <div className="flex-1 bg-black/40 border border-red-900/50 rounded-l-xl overflow-hidden">
                <input 
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="•••••••••••••••••••••••••••••••••••••••"
                  className="w-full bg-transparent px-4 py-4 text-white outline-none placeholder-gray-700"
                />
              </div>
              <button 
                onClick={handlePasteKey}
                className="bg-[#2a0a0a] border border-l-0 border-red-900/50 px-6 py-4 text-white font-bold hover:bg-[#3a0a0a] transition-all rounded-r-xl"
              >
                Dán
              </button>
            </div>

              {/* Status */}
            <div className="flex items-center space-x-2 mb-10">
              <span className="text-gray-500 text-xs">Trạng thái:</span>
              <div className="flex items-center space-x-1.5">
                {(() => {
                  const keyMap: Record<AIProvider, string> = {
                    [AIProvider.GEMINI]: 'GEMINI_API_KEY',
                    [AIProvider.OPENAI]: 'OPENAI_API_KEY',
                    [AIProvider.GROK]: 'GROK_API_KEY'
                  };
                  const currentTabHasKey = !!localStorage.getItem(keyMap[selectedKeyProvider]);
                  return (
                    <>
                      <div className={`w-2 h-2 rounded-full ${currentTabHasKey ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`}></div>
                      <span className={`text-xs font-bold ${currentTabHasKey ? 'text-green-500' : 'text-gray-500'}`}>
                        {currentTabHasKey ? 'Đang dùng Key Cá Nhân (Trả Phí)' : 'Chưa nạp Key'}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button 
                onClick={handleRemoveKey}
                className="text-gray-400 hover:text-white text-sm font-bold transition-colors text-left max-w-[120px] leading-tight"
              >
                Xóa & Dùng Key Mặc định
              </button>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    const url = selectedKeyProvider === AIProvider.GEMINI 
                      ? 'https://aistudio.google.com/app/apikey' 
                      : selectedKeyProvider === AIProvider.OPENAI 
                        ? 'https://platform.openai.com/api-keys' 
                        : 'https://console.x.ai/';
                    window.open(url, '_blank');
                  }}
                  className="px-4 py-3 rounded-xl border-2 border-orange-500/50 text-orange-400 font-bold text-sm hover:bg-orange-500/10 transition-all leading-tight text-center"
                >
                  Kiểm tra<br/>Hạn Ngạch
                </button>

                <button 
                  onClick={() => {
                    const url = selectedKeyProvider === AIProvider.GEMINI 
                      ? 'https://aistudio.google.com/app/apikey' 
                      : selectedKeyProvider === AIProvider.OPENAI 
                        ? 'https://platform.openai.com/api-keys' 
                        : 'https://console.x.ai/';
                    window.open(url, '_blank');
                  }}
                  className="px-4 py-3 rounded-xl border-2 border-red-600/50 text-red-400 font-bold text-sm hover:bg-red-600/10 transition-all"
                >
                  Lấy<br/>API
                </button>

                <button 
                  onClick={handleSaveKey}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-red-900/20 transition-all active:scale-95"
                >
                  Lưu<br/>Key
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

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
          onClick={() => { setShowQRModal(false); setPaymentSuccess(false); }}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1e293b] p-6 rounded-[2rem] border border-gray-800 shadow-2xl max-w-[340px] w-full text-center relative overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors bg-gray-800/50 p-1 rounded-full"
              onClick={() => { setShowQRModal(false); setPaymentSuccess(false); }}
            >
              <X size={20} />
            </button>

            {paymentSuccess ? (
              <div className="py-8 animate-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
                  <Check size={40} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Thành công!</h3>
                <p className="text-green-400 font-medium text-lg">Cảm ơn tác giả Đã nhận được tiền!</p>
                <button 
                  onClick={() => { setShowQRModal(false); setPaymentSuccess(false); }}
                  className="mt-8 w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all"
                >
                  Tuyệt vời
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white mb-1 leading-tight">Ủng hộ tác giả cốc cafe qua mã QR:</h3>
                  <p className="text-gray-400 text-xs">Quét mã QR bên dưới để ủng hộ tác giả nhé!</p>
                </div>
                
                <div className="bg-white p-3 rounded-2xl mb-4 inline-block shadow-inner">
                  <img 
                    src="https://img.vietqr.io/image/MB-0988771339-qr_only.jpg?addInfo=Ung%20ho%20tac%20gia%20coc%20Cafe" 
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
                    onClick={() => setPaymentSuccess(true)}
                    className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all text-sm mb-1 shadow-lg shadow-green-900/20"
                  >
                    Tôi đã chuyển khoản
                  </button>
                  <button 
                    onClick={() => setShowQRModal(false)}
                    className="w-full py-2 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-all text-sm"
                  >
                    Đóng
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        
        .markdown-content p { margin-bottom: 1.5rem; }
        .markdown-content ul, .markdown-content ol { margin-bottom: 1.5rem; padding-left: 1.5rem; }
        .markdown-content li { margin-bottom: 0.5rem; }
        .markdown-content li::marker { color: #a855f7; font-weight: bold; }
        .markdown-content strong { color: #f3f4f6; font-weight: 700; }
        .markdown-content h4 { font-size: 1.25rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 1rem; color: #f3f4f6; }

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
