
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import OpenAI from "openai";
import { SEOConfig, OutlineSection, GeneratedArticle, AIProvider } from "../types";

// Helper to get API Key for a specific provider
const getApiKey = (provider: AIProvider) => {
  if (typeof window !== 'undefined') {
    const keyMap: Record<AIProvider, string> = {
      [AIProvider.GEMINI]: 'GEMINI_API_KEY',
      [AIProvider.OPENAI]: 'OPENAI_API_KEY',
      [AIProvider.GROK]: 'GROK_API_KEY'
    };
    const localKey = localStorage.getItem(keyMap[provider]);
    if (localKey) return localKey;
  }
  
  // Fallback to env for Gemini if not in localStorage
  if (provider === AIProvider.GEMINI) {
    return process.env.GEMINI_API_KEY || 
           (import.meta as any).env?.VITE_GEMINI_API_KEY || 
           '';
  }
  
  return '';
};

const getOpenAIClient = (provider: AIProvider) => {
  const apiKey = getApiKey(provider);
  if (!apiKey) throw new Error(`${provider} API Key chưa được cấu hình.`);
  
  const baseURL = provider === AIProvider.GROK ? "https://api.x.ai/v1" : undefined;
  return new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });
};

export const generateOutline = async (topic: string, config: SEOConfig): Promise<OutlineSection[]> => {
  if (config.provider === AIProvider.GEMINI) {
    const apiKey = getApiKey(AIProvider.GEMINI);
    if (!apiKey) throw new Error('GEMINI_API_KEY chưa được cấu hình.');
    
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Xây dựng dàn ý bài viết chuẩn SEO cho chủ đề: "${topic}". 
    Phong cách: ${config.style}. 
    Từ khóa chính: ${config.mainKeyword}. 
    Số lượng mục H2 yêu cầu: ${config.h2Count}. 
    Ngôn ngữ: ${config.language}. 
    Thông tin liên hệ: ${config.additionalInfo}.
    Hãy trả về một danh sách các tiêu đề mục (H2/H3) hấp dẫn, kích thích click và tối ưu SEO.`;

    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3-flash-preview',
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
  } else {
    // OpenAI or Grok
    const openai = getOpenAIClient(config.provider);
    const prompt = `Xây dựng dàn ý bài viết chuẩn SEO cho chủ đề: "${topic}". 
    Phong cách: ${config.style}. 
    Từ khóa chính: ${config.mainKeyword}. 
    Số lượng mục H2 yêu cầu: ${config.h2Count}. 
    Ngôn ngữ: ${config.language}. 
    Thông tin liên hệ: ${config.additionalInfo}.
    Hãy trả về một danh sách các tiêu đề mục (H2/H3) hấp dẫn, kích thích click và tối ưu SEO.
    Định dạng trả về: JSON array các object có thuộc tính "title". Ví dụ: [{"title": "Mục 1"}, {"title": "Mục 2"}]`;

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(content);
    const rawData = Array.isArray(parsed) ? parsed : (parsed.outline || parsed.sections || parsed.items || []);
    
    return rawData.map((item: any, index: number) => ({
      id: `section-${index}`,
      title: item.title || item
    }));
  }
};

export const regenerateOutlineTitle = async (currentTitle: string, topic: string, config: SEOConfig): Promise<string> => {
  const prompt = `Hãy viết lại tiêu đề mục này để hấp dẫn hơn và tối ưu SEO hơn: "${currentTitle}". 
  Chủ đề chính: "${topic}". 
  Phong cách: ${config.style}.
  Chỉ trả về tiêu đề mới, không thêm bất kỳ văn bản nào khác.`;

  if (config.provider === AIProvider.GEMINI) {
    const apiKey = getApiKey(AIProvider.GEMINI);
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3-flash-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
    });
    return response.text?.trim() || currentTitle;
  } else {
    const openai = getOpenAIClient(config.provider);
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }]
    });
    return response.choices[0].message.content?.trim() || currentTitle;
  }
};

export const generateArticleContent = async (topic: string, config: SEOConfig, outline: OutlineSection[]): Promise<GeneratedArticle> => {
  const sectionsPrompt = outline.map(s => `- ${s.title}`).join('\n');
  const prompt = `Bạn là một chuyên gia SEO và Content Writer hàng đầu. Hãy viết một bài viết chuyên sâu, sinh động và cực kỳ hấp dẫn về chủ đề: "${topic}".
  
  Cấu trúc bài viết dựa trên dàn ý sau:
  ${sectionsPrompt}
  
  Yêu cầu về nội dung và trình bày (BẮT BUỘC):
  - Phong cách viết: ${config.style}
  - Từ khóa chính cần tối ưu: ${config.mainKeyword}
  - Ngôn ngữ: ${config.language}
  - Thông tin liên hệ: ${config.additionalInfo}
  
  - **Sử dụng biểu tượng cảm xúc (emojis)** phù hợp ở đầu các đoạn văn hoặc các ý quan trọng để bài viết thêm sinh động.
  - **TRÌNH BÀY THOÁNG ĐÃNG (QUAN TRỌNG)**: 
    + Sử dụng xuống dòng thường xuyên. 
    + Chia nhỏ các ý thành các đoạn văn ngắn (mỗi đoạn không quá 3 câu).
    + **BẮT BUỘC sử dụng danh sách Markdown (dấu gạch ngang - hoặc số 1.) cho các ý liệt kê**. Mỗi ý phải nằm trên một dòng riêng biệt. Tuyệt đối không viết các ý liệt kê dính liền nhau trong một đoạn văn.
  - **Nội dung lôi cuốn**: Sử dụng ngôn từ mạnh mẽ, đặt câu hỏi gợi mở, và tạo sự kết nối với người đọc.
  - Sử dụng định dạng Markdown cho các tiêu đề (H2, H3), danh sách, và nhấn mạnh (bold/italic).
  - Đảm bảo nội dung độc nhất, hữu ích và có giá trị cao cho người đọc.
  
  Hãy trả về kết quả dưới dạng JSON với cấu trúc:
  {
    "title": "Tiêu đề bài viết hấp dẫn (kèm emoji)",
    "sections": [
      { "title": "Tiêu đề mục", "content": "Nội dung chi tiết mục này (Markdown, BẮT BUỘC có xuống dòng giữa các đoạn và sử dụng danh sách cho các ý liệt kê, kèm emoji)" },
      ...
    ],
    "metaDescription": "Mô tả meta chuẩn SEO (150-160 ký tự)",
    "keywords": ["từ khóa 1", "từ khóa 2", ...]
  }`;

  if (config.provider === AIProvider.GEMINI) {
    const apiKey = getApiKey(AIProvider.GEMINI);
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3.1-pro-preview',
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
  } else {
    const openai = getOpenAIClient(config.provider);
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    const result = JSON.parse(response.choices[0].message.content || "{}");
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
  }
};

export const generateAIImage = async (prompt: string, productImage?: string): Promise<string> => {
  // Try Gemini first
  const geminiKey = getApiKey(AIProvider.GEMINI);
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: `Tạo một hình ảnh minh họa SIÊU ĐẸP, nghệ thuật và có tính thẩm mỹ cực cao cho bài viết SEO. 
            Chủ đề: ${prompt}. 
            Yêu cầu kỹ thuật: Hình ảnh sắc nét 4K, màu sắc rực rỡ và hài hòa, bố cục hiện đại theo phong cách nhiếp ảnh chuyên nghiệp (Cinematic lighting) hoặc minh họa 3D Digital Art tinh tế. 
            Tránh các chi tiết kỳ dị, biến dạng, mờ nhòe hoặc không tự nhiên. Hình ảnh phải trông thật chuyên nghiệp và thu hút ánh nhìn ngay lập tức.
            ${productImage ? `Hãy lấy cảm hứng từ sản phẩm này và tích hợp nó một cách tự nhiên, sang trọng: ${productImage}` : ''}` }
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
    } catch (err) {
      console.error("Gemini image generation failed:", err);
    }
  }

  // Fallback to OpenAI if available
  const openaiKey = getApiKey(AIProvider.OPENAI);
  if (openaiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true });
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: `Stunning, high-end professional and artistic SEO article illustration. Subject: ${prompt}. Cinematic lighting, sharp focus 4K, harmonious vibrant colors, modern composition, professional photography or refined 3D digital art style. Avoid distorted or unnatural details. The image must look premium and highly engaging. ${productImage ? `Inspired by product: ${productImage}` : ''}`,
        n: 1,
        size: "1024x1024",
      });
      if (response.data[0].url) {
        return response.data[0].url;
      }
    } catch (err) {
      console.error("OpenAI image generation failed:", err);
    }
  }
  
  throw new Error('Không thể tạo hình ảnh bằng bất kỳ nhà cung cấp nào có sẵn.');
};
