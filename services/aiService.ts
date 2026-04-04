
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import OpenAI from "openai";
import { SEOConfig, OutlineSection, GeneratedArticle, AIProvider } from "../types";

// Helper to get API Key for a specific provider
export const getApiKey = (provider: AIProvider) => {
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
    const prompt = `Xây dựng dàn ý SEO cho: "${topic}". 
    Style: ${config.style}. Keyword: ${config.mainKeyword}. H2 count: ${config.h2Count}. Lang: ${config.language}.
    Lưu ý: KHÔNG bao gồm các mục "Liên hệ" hoặc "Bản đồ" trong dàn ý vì hệ thống sẽ tự động thêm chúng vào cuối bài viết.
    Return JSON array of H2/H3 titles.`;

    // Fallback models for Gemini
    const fallbackModels = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview'];
    let lastError: any = null;

    for (const modelName of fallbackModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
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
      } catch (err: any) {
        lastError = err;
        const errMsg = (err.message || "").toLowerCase();
        if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("overloaded") || errMsg.includes("exhausted") || errMsg.includes("unavailable")) {
          console.warn(`Model ${modelName} overloaded, trying next fallback...`);
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  } else {
    // OpenAI or Grok
    const openai = getOpenAIClient(config.provider);
    const prompt = `Xây dựng dàn ý SEO cho: "${topic}". 
    Style: ${config.style}. Keyword: ${config.mainKeyword}. H2 count: ${config.h2Count}. Lang: ${config.language}.
    Lưu ý: KHÔNG bao gồm các mục "Liên hệ" hoặc "Bản đồ" trong dàn ý vì hệ thống sẽ tự động thêm chúng vào cuối bài viết.
    Return JSON array of H2/H3 titles.`;

    const response = await openai.chat.completions.create({
      model: config.provider === AIProvider.OPENAI ? "gpt-4o-mini" : (config.provider === AIProvider.GROK ? "grok-2-mini" : config.model),
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
    
    // Fallback models for Gemini
    const fallbackModels = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview'];
    let lastError: any = null;

    for (const modelName of fallbackModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
        });
        return response.text?.trim() || currentTitle;
      } catch (err: any) {
        lastError = err;
        const errMsg = (err.message || "").toLowerCase();
        if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("overloaded") || errMsg.includes("exhausted") || errMsg.includes("unavailable")) {
          console.warn(`Model ${modelName} overloaded, trying next fallback...`);
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  } else {
    const openai = getOpenAIClient(config.provider);
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }]
    });
    return response.choices[0].message.content?.trim() || currentTitle;
  }
};

export const generateArticleSkeleton = async (topic: string, config: SEOConfig, outline: OutlineSection[]): Promise<{ title: string, metaDescription: string, keywords: string[], sections: { title: string, briefContext: string }[] }> => {
  const sectionsPrompt = outline.map(s => `- ${s.title}`).join('\n');
  const prompt = `Bạn là một chuyên gia SEO. Hãy tạo cấu trúc chi tiết cho bài viết về: "${topic}".
  Dựa trên dàn ý:
  ${sectionsPrompt}
  
  Hãy trả về JSON:
  {
    "title": "Tiêu đề bài viết hấp dẫn (kèm emoji)",
    "metaDescription": "Mô tả meta chuẩn SEO",
    "keywords": ["từ khóa 1", "từ khóa 2", ...],
    "sections": [
      { "title": "Tiêu đề mục", "briefContext": "Tóm tắt ngắn gọn nội dung cần viết trong mục này (1-2 câu) để đảm bảo tính nhất quán" },
      ...
    ]
  }`;

  if (config.provider === AIProvider.GEMINI) {
    const apiKey = getApiKey(AIProvider.GEMINI);
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Always use flash for skeleton
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            metaDescription: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  briefContext: { type: Type.STRING }
                },
                required: ["title", "briefContext"]
              }
            }
          },
          required: ["title", "metaDescription", "keywords", "sections"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } else {
    const openai = getOpenAIClient(config.provider);
    const response = await openai.chat.completions.create({
      model: config.provider === AIProvider.OPENAI ? "gpt-4o-mini" : config.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  }
};

export const generateSectionContent = async (topic: string, config: SEOConfig, sectionTitle: string, briefContext: string, overallTitle: string): Promise<{ content: string, prompt: string }> => {
  const hasProductImages = config.productImages && config.productImages.length > 0;
  const prompt = `Bạn là một Content Writer chuyên nghiệp. Hãy viết nội dung cho mục "${sectionTitle}" trong bài viết "${overallTitle}" về chủ đề "${topic}".
  
  Bối cảnh mục này: ${briefContext}
  
  Yêu cầu:
  - Phong cách: ${config.style}
  - Từ khóa chính: ${config.mainKeyword}
  - Ngôn ngữ: ${config.language}
  - Thông tin liên hệ: ${config.additionalInfo} (Lồng ghép tự nhiên)
  - TRÌNH BÀY THOÁNG ĐÃNG: Xuống dòng thường xuyên, đoạn văn ngắn (< 3 câu), sử dụng danh sách Markdown (- hoặc 1.) cho các ý liệt kê.
  - Sử dụng emoji phù hợp.
  - Markdown cho tiêu đề (H3), bold, italic. KHÔNG dùng HTML tags.
  ${hasProductImages ? '- Viết mô tả bối cảnh hình ảnh (prompt) để chèn sản phẩm thực tế vào không gian chuyên nghiệp.' : '- Viết mô tả bối cảnh hình ảnh (prompt) minh họa cho nội dung này.'}
  
  Trả về JSON:
  {
    "content": "Nội dung mục (Markdown)",
    "prompt": "Mô tả bối cảnh hình ảnh (tiếng Việt, chi tiết)"
  }`;

  if (config.provider === AIProvider.GEMINI) {
    const apiKey = getApiKey(AIProvider.GEMINI);
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
    const ai = new GoogleGenAI({ apiKey });
    
    // Fallback models for Gemini
    const fallbackModels = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview'];
    let lastError: any = null;

    for (const modelName of fallbackModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                content: { type: Type.STRING },
                prompt: { type: Type.STRING }
              },
              required: ["content", "prompt"]
            }
          }
        });
        return JSON.parse(response.text || "{}");
      } catch (err: any) {
        lastError = err;
        const errMsg = (err.message || "").toLowerCase();
        if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("overloaded") || errMsg.includes("exhausted") || errMsg.includes("unavailable")) {
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  } else {
    const openai = getOpenAIClient(config.provider);
    const response = await openai.chat.completions.create({
      model: config.provider === AIProvider.OPENAI ? "gpt-4o-mini" : config.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  }
};

export const generateArticleContent = async (topic: string, config: SEOConfig, outline: OutlineSection[]): Promise<GeneratedArticle> => {
  const sectionsPrompt = outline.map(s => `- ${s.title}`).join('\n');
  const hasProductImages = config.productImages && config.productImages.length > 0;
  const prompt = `Bạn là một chuyên gia SEO và Content Writer hàng đầu. Hãy viết một bài viết chuyên sâu, sinh động và cực kỳ hấp dẫn về chủ đề: "${topic}".
  
  Cấu trúc bài viết dựa trên dàn ý sau:
  ${sectionsPrompt}
  
  Yêu cầu về nội dung và trình bày (BẮT BUỘC):
  - Phong cách viết: ${config.style}
  - Từ khóa chính cần quảng cáo: ${config.mainKeyword}
  - Ngôn ngữ: ${config.language}
  - Thông tin liên hệ: ${config.additionalInfo} (Hãy lồng ghép thông tin này vào nội dung một cách tự nhiên, KHÔNG tạo mục riêng "Liên hệ" ở cuối)
  - URL nhúng bản đồ: ${config.mapEmbedUrl || 'Không có'} (KHÔNG chèn link hay iframe này vào nội dung, hệ thống sẽ tự nhúng bản đồ ở cuối bài)
  ${hasProductImages ? '- **LƯU Ý**: Tôi đã cung cấp các hình ảnh sản phẩm thực tế. Hãy viết mô tả bối cảnh hình ảnh (prompt) sao cho sản phẩm này được đặt vào một không gian phù hợp, chuyên nghiệp và hấp dẫn.' : ''}
  
  - **LƯU Ý QUAN TRỌNG**: KHÔNG tự ý tạo thêm mục "Bản đồ" hoặc "Liên hệ" ở cuối bài viết vì hệ thống đã tự động thêm chúng. Nếu trong dàn ý có các mục này, hãy bỏ qua hoặc lồng ghép nội dung vào các phần khác.
  
  - **Sử dụng biểu tượng cảm xúc (emojis)** phù hợp ở đầu các đoạn văn hoặc các ý quan trọng để bài viết thêm sinh động.
  - **TRÌNH BÀY THOÁNG ĐÃNG (QUAN TRỌNG)**: 
    + Sử dụng xuống dòng thường xuyên. 
    + Chia nhỏ các ý thành các đoạn văn ngắn (mỗi đoạn không quá 3 câu).
    + **BẮT BUỘC sử dụng danh sách Markdown (dấu gạch ngang - hoặc số 1.) cho các ý liệt kê**. Mỗi ý phải nằm trên một dòng riêng biệt. Tuyệt đối không viết các ý liệt kê dính liền nhau trong một đoạn văn.
  - **Nội dung lôi cuốn**: Sử dụng ngôn từ mạnh mẽ, đặt câu hỏi gợi mở, và tạo sự kết nối với người đọc.
  - Sử dụng định dạng Markdown cho các tiêu đề (H2, H3), danh sách, và nhấn mạnh (bold/italic). TUYỆT ĐỐI KHÔNG sử dụng các thẻ HTML như <iframe>, <script>, <style> trong nội dung.
  - Đảm bảo nội dung độc nhất, hữu ích và có giá trị cao cho người đọc.
  
  - Hãy trả về kết quả dưới dạng JSON với cấu trúc:
  {
    "title": "Tiêu đề bài viết hấp dẫn (kèm emoji)",
    "sections": [
      { 
        "title": "Tiêu đề mục", 
        "content": "Nội dung chi tiết mục này (Markdown, BẮT BUỘC có xuống dòng giữa các đoạn và sử dụng danh sách cho các ý liệt kê, kèm emoji)",
        "prompt": "Mô tả chi tiết bối cảnh hình ảnh (tiếng Việt), bao gồm các chi tiết cụ thể từ nội dung (như địa chỉ, tên riêng, đặc điểm sản phẩm) để AI tạo ảnh chính xác nhất."
      },
      ...
    ],
    "metaDescription": "Mô tả meta chuẩn SEO (150-160 ký tự)",
    "keywords": ["từ khóa 1", "từ khóa 2", ...]
  }`;

  if (config.provider === AIProvider.GEMINI) {
    const apiKey = getApiKey(AIProvider.GEMINI);
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
    const ai = new GoogleGenAI({ apiKey });

    // Fallback models for Gemini
    const primaryModel = config.model || 'gemini-3.1-pro-preview';
    const fallbackModels = [primaryModel, 'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview'];
    let lastError: any = null;

    for (const modelName of fallbackModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
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
                      content: { type: Type.STRING },
                      prompt: { type: Type.STRING }
                    },
                    required: ["title", "content", "prompt"]
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
            content: s.content,
            prompt: s.prompt
          })),
          metaDescription: result.metaDescription,
          keywords: result.keywords,
          publishDate: new Date().toISOString()
        };
      } catch (err: any) {
        lastError = err;
        const errMsg = (err.message || "").toLowerCase();
        if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("overloaded") || errMsg.includes("exhausted") || errMsg.includes("unavailable")) {
          console.warn(`Model ${modelName} overloaded, trying next fallback...`);
          continue;
        }
        throw err;
      }
    }
    throw lastError;
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
        content: s.content,
        prompt: s.prompt
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
      
      const parts: any[] = [
        { text: `Create a STUNNING, high-end professional and artistic SEO article illustration.
        Subject: ${prompt}.
        Style: Cinematic lighting, sharp 4K focus, harmonious vibrant colors, modern composition, professional photography or refined 3D digital art.
        IMPORTANT: 
        1. Follow the description details closely (locations, brand names, context).
        2. Any text in the image must be correctly spelled.
        3. Avoid distorted or unnatural details.
        ${productImage ? `4. PRODUCT INTEGRATION: Seamlessly integrate the product/person from the attached image into this professional context. The product should be the focal point, placed in a luxurious and professional setting that matches the article's theme.` : ''}` }
      ];

      if (productImage) {
        // Extract base64 data and mimeType
        const mimeTypeMatch = productImage.match(/^data:(image\/[a-zA-Z]+);base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
        const base64Data = productImage.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
        
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts },
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
