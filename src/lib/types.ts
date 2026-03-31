export interface ExtractedQuestion {
  id: string;
  index: number;
  text: string;
}

export interface SimilarQuestion {
  id: string;
  text: string;
  explanation: string;
  answer: string;       // e.g. "②", "3", "x = -1 또는 x = 3"
  solution: string;     // step-by-step with LaTeX
}

export interface QuestionWithSimilars {
  original: ExtractedQuestion;
  similars: SimilarQuestion[];
  status: 'pending' | 'generating' | 'done' | 'error';
}

export interface ExtractResponse {
  questions: ExtractedQuestion[];
}

export interface GenerateResponse {
  results: QuestionWithSimilars[];
}

export type AppPhase =
  | 'idle'
  | 'file-selected'
  | 'extracting'
  | 'generating'
  | 'done'
  | 'error';

export type AppMode = 'similar' | 'convert';
