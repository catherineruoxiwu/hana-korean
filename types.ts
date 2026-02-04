export enum AppTab {
  HOME = 'home',
  VOCAB = 'vocab',
  STREAK = 'streak',
  SETTINGS = 'settings'
}

export type InputMode = 'handwriting' | 'typing';
export type QuizModeType = 'flashcard' | 'endless';
export type AppLanguage = 'zh' | 'en';

export interface Settings {
  inputMode: InputMode;
  language: AppLanguage;
}

export interface Word {
  id: string;
  korean: string;
  meaning: string; 
  meaningEn: string;
  romanization?: string;
  example?: string;
  tags: string[];
  frequency: number;   
  pos: '感' | '고' | '관' | '대' | '동' | '명' | '보' | '부' | '불' | '수' | '의' | '형'; 
  level: 'A' | 'B' | 'C'; 
}

export interface Progress {
  id: string;
  mastery: number;
  lastSeen: number;
  nextReview: number;
  interval: number;
}

export interface StreakData {
  date: string;
  count: number;
}

export interface Point {
  x: number;
  y: number;
  t: number;
}

export type Stroke = Point[];

export interface QuizQuestion {
  id: string;
  type: 'audio_mc' | 'dictation' | 'handwriting' | 'flashcard';
  prompt: string;
  answer: string;
  options?: string[];
  target?: Word;
  isReversed?: boolean; 
}