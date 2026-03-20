
import { GoogleGenAI } from "@google/genai";

// Helper to get API Key
const getApiKey = () => {
  return (typeof window !== 'undefined' && (window as any).GOOGLE_GENAI_API_KEY) || 
         process.env.GEMINI_API_KEY || 
         (import.meta as any).env?.VITE_GEMINI_API_KEY || 
         '';
};

export async function generateAppImages() {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  
  const ai = new GoogleGenAI({ apiKey });

  const generate = async (prompt: string) => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error('Failed to generate image');
  };

  const logoPrompt = "A creative digital drawing of an 'SEO Writer'. The illustration shows a futuristic pen writing glowing code and keywords like 'SEO', 'AI', and 'CONTENT' into the air. Artistic style with vibrant purple and blue neon colors, professional digital art, isolated on a clean dark background.";
  const avatarPrompt = "A professional and friendly male avatar in a high-quality 3D Pixar-style digital art. The character has a smart look, wearing a modern tech outfit, with a subtle glow of data particles around him. Clean background, professional lighting.";

  const [logoBase64, avatarBase64] = await Promise.all([
    generate(logoPrompt),
    generate(avatarPrompt)
  ]);

  return { 
    logoBase64, 
    avatarBase64 
  };
}
