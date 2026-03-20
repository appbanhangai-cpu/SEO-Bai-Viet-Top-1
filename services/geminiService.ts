
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { SEOConfig, OutlineSection, GeneratedArticle, WritingStyle } from "../types";

// Helper to get API Key
const getApiKey = () => {
  return (typeof window !== 'undefined' && (window as any).GOOGLE_GENAI_API_KEY) || 
         process.env.GEMINI_API_KEY || 
         (import.meta as any).env?.VITE_GEMINI_API_KEY || 
         '';
};

export const generateOutline = async (topic: string, config: SEOConfig): Promise<OutlineSection[]> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. Please set it in your environment variables.');
  
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Xây dựng dàn ý bài viết chuẩn SEO cho chủ đề: "${topic}". 
  Phong cách: ${config.style}. 
  Từ khóa chính: ${config.mainKeyword}. 
  Số lượng mục H2 yêu cầu: ${config.h2Count}. 
  Ngôn ngữ: ${config.language}. 
  Thông tin bổ sung: ${config.additionalInfo}.
  Hãy trả về một danh sách các tiêu đề mục (H2/H3) hấp dẫn, kích thích click và tối ưu SEO.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING }
          },
          required: ["title"]
        }
      }
    }
  });

  const rawData = JSON.parse(response.text || "[]");
  return rawData.map((item: any, index: number) => ({
    id: `section-${index}`,
    title: item.title
  }));
};

export const regenerateOutlineTitle = async (currentTitle: string, topic: string, config: SEOConfig): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Hãy viết lại tiêu đề mục này để hấp dẫn hơn và tối ưu SEO hơn: "${currentTitle}". 
  Chủ đề chính: "${topic}". 
  Phong cách: ${config.style}.
  Chỉ trả về tiêu đề mới, không thêm bất kỳ văn bản nào khác.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    }
  });

  return response.text?.trim() || currentTitle;
};

export const generateArticleContent = async (topic: string, config: SEOConfig, outline: OutlineSection[]): Promise<GeneratedArticle> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  
  const ai = new GoogleGenAI({ apiKey });
  const sectionsPrompt = outline.map(s => `- ${s.title}`).join('\n');
  
  const prompt = `Bạn là một chuyên gia SEO và Content Writer hàng đầu. Hãy viết một bài viết chuyên sâu về chủ đề: "${topic}".
  
  Cấu trúc bài viết dựa trên dàn ý sau:
  ${sectionsPrompt}
  
  Yêu cầu:
  - Phong cách viết: ${config.style}
  - Từ khóa chính cần tối ưu: ${config.mainKeyword}
  - Ngôn ngữ: ${config.language}
  - Thông tin bổ sung: ${config.additionalInfo}
  
  Hãy viết nội dung chi tiết cho từng mục trong dàn ý. Mỗi mục cần có ít nhất 2-3 đoạn văn bản chất lượng.
  Sử dụng định dạng Markdown cho các tiêu đề, danh sách, và nhấn mạnh.
  Đảm bảo nội dung độc nhất, hữu ích và có giá trị cao cho người đọc.
  
  Hãy trả về kết quả dưới dạng JSON với cấu trúc:
  {
    "title": "Tiêu đề bài viết hấp dẫn",
    "sections": [
      { "title": "Tiêu đề mục", "content": "Nội dung chi tiết mục này (Markdown)" },
      ...
    ],
    "metaDescription": "Mô tả meta chuẩn SEO (150-160 ký tự)",
    "keywords": ["từ khóa 1", "từ khóa 2", ...]
  }`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          },
          metaDescription: { type: Type.STRING },
          keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["title", "sections", "metaDescription", "keywords"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  return {
    title: result.title,
    sections: result.sections.map((s: any, i: number) => ({
      id: `gen-section-${i}`,
      title: s.title,
      content: s.content
    })),
    metaDescription: result.metaDescription,
    keywords: result.keywords,
    publishDate: new Date().toISOString()
  };
};

export const generateAIImage = async (prompt: string, productImage?: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `Tạo một hình ảnh minh họa chuyên nghiệp cho bài viết SEO. 
        Mô tả: ${prompt}. 
        Phong cách: Hiện đại, sạch sẽ, phù hợp với blog doanh nghiệp.
        ${productImage ? `Hãy lấy cảm hứng từ sản phẩm này: ${productImage}` : ''}` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error('Không thể tạo hình ảnh');
};
