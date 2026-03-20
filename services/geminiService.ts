
import { SEOConfig, OutlineSection, GeneratedArticle } from "../types";

// Hàm bổ trợ để gọi API server-side
async function callAI(action: string, payload: any): Promise<any> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Lỗi khi gọi AI');
  }

  return await response.json();
}

export const generateOutline = async (topic: string, config: SEOConfig): Promise<OutlineSection[]> => {
  return await callAI('generateOutline', { topic, config });
};

export const regenerateOutlineTitle = async (currentTitle: string, topic: string, config: SEOConfig): Promise<string> => {
  const result = await callAI('regenerateOutlineTitle', { currentTitle, topic, config });
  return result.title;
};

export const generateArticleContent = async (topic: string, config: SEOConfig, outline: OutlineSection[]): Promise<GeneratedArticle> => {
  return await callAI('generateArticleContent', { topic, config, outline });
};

export const generateAIImage = async (prompt: string, productImage?: string): Promise<string> => {
  const result = await callAI('generateAIImage', { prompt, productImage });
  return result.url;
};
