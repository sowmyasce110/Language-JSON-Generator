export type ProgressStage =
  | "discover"
  | "extract"
  | "translate"
  | "package"
  | "done"
  | "error";

export type ProgressEvent = {
  type: "progress";
  stage: ProgressStage;
  message: string;
  percent: number;
  pagesFound?: number;
  stringsTranslated?: number;
  totalStrings?: number;
};

export type ResultEvent = {
  type: "result";
  locales: Record<string, Record<string, string>>;
  sourceLang: string;
  targetLang: string;
  fallbackKeys: string[];
  pages: string[];
  demoMode: boolean;
};

export type ErrorEvent = {
  type: "error";
  message: string;
};

export type StreamEvent = ProgressEvent | ResultEvent | ErrorEvent;

export type GenerateRequest = {
  url: string;
  targetLang: string;
  sourceLang?: string;
  maxPages?: number;
  glossary?: string;
};

export type ExtractedString = {
  key: string;
  text: string;
  pageUrl: string;
};

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ko", label: "Korean" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
] as const;
