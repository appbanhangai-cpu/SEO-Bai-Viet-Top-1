import { GoogleGenAI, Type } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.GEMINI_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
  }

  const { action, payload } = req.body;
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  try {
    switch (action) {
      case 'generateOutline': {
        const { topic, config } = payload;
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
        const sections = rawData.map((item: any, index: number) => ({
          id: `section-${Date.now()}-${index}`,
          title: item.title
        }));
        return res.status(200).json(sections);
      }

      case 'regenerateOutlineTitle': {
        const { currentTitle, topic, config } = payload;
        const prompt = `Bạn là một chuyên gia SEO. Hãy viết lại tiêu đề mục sau đây để nó hấp dẫn hơn, chuẩn SEO hơn.
        Chủ đề chính: "${topic}"
        Tiêu đề hiện tại: "${currentTitle}"
        Chỉ trả về duy nhất 1 tiêu đề mới.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt
        });

        return res.status(200).json({ title: response.text.trim().replace(/^"|"$/g, '') });
      }

      case 'generateArticleContent': {
        const { topic, config, outline } = payload;
        const outlineStr = outline.map((s: any) => s.title).join("\n");
        const productInstruction = config.productImage 
          ? `Lưu ý quan trọng: Tôi đã cung cấp hình ảnh sản phẩm thực tế. Trong nội dung bài viết, hãy lồng ghép các chi tiết về sản phẩm này một cách thậc tế, đề cập đến trải nghiệm sử dụng thực tế.` 
          : "";

        const prompt = `Viết bài viết chi tiết chuẩn SEO.
        Chủ đề: ${topic}. Từ khóa chính: ${config.mainKeyword}. Phong cách: ${config.style}.
        Dàn ý chi tiết: ${outlineStr}
        Yêu cầu: Viết dài khoảng ${config.wordCount} từ bằng ${config.language}.
        ${productInstruction}
        Mỗi mục cung cấp nội dung và "Image Prompt" (tiếng Anh) để mô tả bối cảnh phù hợp cho sản phẩm. Trả về JSON.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
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
                      content: { type: Type.STRING },
                      prompt: { type: Type.STRING }
                    },
                    required: ["title", "content", "prompt"]
                  }
                }
              },
              required: ["title", "sections"]
            }
          }
        });

        return res.status(200).json(JSON.parse(response.text || "{}"));
      }

      case 'generateAIImage': {
        const { prompt, productImage } = payload;
        const parts: any[] = [];
        if (productImage) {
          const base64Data = productImage.split(',')[1] || productImage;
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: 'image/png'
            }
          });
          parts.push({
            text: `Place this real product naturally in this scene: ${prompt}. Maintain lighting, shadows and realistic integration. Professional photography style.`
          });
        } else {
          parts.push({ text: `Professional high-quality visual for blog: ${prompt}` });
        }

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts },
          config: {
            imageConfig: { aspectRatio: "16:9" }
          }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            return res.status(200).json({ url: `data:image/png;base64,${part.inlineData.data}` });
          }
        }
        return res.status(200).json({ url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop" });
      }

      case 'generateAppImages': {
        const { logoPrompt, avatarPrompt } = payload;
        
        const logoResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: logoPrompt,
          config: { imageConfig: { aspectRatio: "1:1" } }
        });

        const avatarResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: avatarPrompt,
          config: { imageConfig: { aspectRatio: "1:1" } }
        });

        let logoUrl = "https://images.unsplash.com/photo-1661956602116-aa6865609028?q=80&w=200&auto=format&fit=crop";
        let avatarUrl = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop";

        for (const part of logoResponse.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) logoUrl = `data:image/png;base64,${part.inlineData.data}`;
        }
        for (const part of avatarResponse.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) avatarUrl = `data:image/png;base64,${part.inlineData.data}`;
        }

        return res.status(200).json({ logoUrl, avatarUrl });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
