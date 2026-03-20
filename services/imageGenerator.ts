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

export async function generateAppImages() {
  const logoPrompt = "A creative digital drawing of an 'SEO Writer'. The illustration shows a futuristic pen writing glowing code and keywords like 'SEO', 'AI', and 'CONTENT' into the air. Artistic style with vibrant purple and blue neon colors, professional digital art, isolated on a clean dark background.";
  const avatarPrompt = "A professional and friendly male avatar in a high-quality 3D Pixar-style digital art. The character has a smart look, wearing a modern tech outfit, with a subtle glow of data particles around him. Clean background, professional lighting.";

  const result = await callAI('generateAppImages', { logoPrompt, avatarPrompt });
  
  return { 
    logoBase64: result.logoUrl, 
    avatarBase64: result.avatarUrl 
  };
}
