
export enum WritingStyle {
  SALES = 'SEO Bán Hàng',
  INFO = 'SEO Thông Tin',
  GUIDE = 'SEO Hướng Dẫn',
  REVIEW = 'SEO Đánh Giá',
  DEEP_DIVE = 'SEO Chuyên Sâu',
  CASE_STUDY = 'SEO Case Study',
  TRENDING = 'SEO Xu Hướng',
  STORYTELLING = 'SEO Kể Chuyện',
  COMPARE = 'SEO So Sánh',
  LISTICLE = 'SEO Danh Sách',
  FAQ = 'SEO Hỏi Đáp',
  NEWS = 'SEO Tin Tức',
  CHECKLIST = 'SEO Checklist',
  EXPERT_OPINION = 'SEO Ý Kiến Chuyên Gia',
  LOCAL = 'SEO Địa Phương',
  CREATIVE = 'SEO Sáng Tạo'
}

export enum AppStep {
  TOPIC = 1,
  CONFIG = 2,
  OUTLINE = 3,
  WRITING = 4
}

export interface SEOConfig {
  style: WritingStyle;
  mainKeyword: string;
  h2Count: number;
  wordCount: number;
  language: string;
  additionalInfo: string;
  productImage?: string; // Dữ liệu ảnh sản phẩm dạng base64
}

export interface OutlineSection {
  id: string;
  title: string;
}

export interface GeneratedArticle {
  title: string;
  sections: {
    title: string;
    content: string;
    image?: string;
    prompt?: string;
  }[];
}

declare global {
  interface Window {
    aistudio?: {
      openSelectKey: () => Promise<void>;
      hasSelectedApiKey: () => Promise<boolean>;
    };
  }
}
