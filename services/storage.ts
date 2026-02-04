import { Progress, StreakData, Word, Settings } from '../types';

const STORAGE_KEYS = {
  PROGRESS: 'hana_progress',
  STREAK: 'hana_streak',
  SETTINGS: 'hana_settings',
  CUSTOM_VOCAB: 'hana_custom_vocab',
  MASTER_VOCAB: 'hana_master_vocab'
};

const getLocal = (key: string) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

const setLocal = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const getSettings = async (): Promise<Settings> => {
  return getLocal(STORAGE_KEYS.SETTINGS) || { inputMode: 'handwriting', language: 'zh' };
};

export const saveSettings = async (settings: Settings) => {
  setLocal(STORAGE_KEYS.SETTINGS, settings);
};

export const getMasterVocab = async (): Promise<Word[]> => {
  return getLocal(STORAGE_KEYS.MASTER_VOCAB) || [];
};

export const saveMasterVocab = async (words: Word[]) => {
  setLocal(STORAGE_KEYS.MASTER_VOCAB, words);
};

export const getProgress = async (): Promise<Record<string, Progress>> => {
  return getLocal(STORAGE_KEYS.PROGRESS) || {};
};

export const updateProgress = async (id: string, masteryDelta: number) => {
  const progress = await getProgress();
  const current = progress[id] || {
    id,
    mastery: 0,
    lastSeen: 0,
    nextReview: 0,
    interval: 1
  };

  const newMastery = Math.min(5, Math.max(0, current.mastery + masteryDelta));
  let newInterval = current.interval;
  if (masteryDelta > 0) newInterval *= 2;
  else if (masteryDelta === 0) newInterval *= 1.2;
  else newInterval = 1;

  const now = Date.now();
  const nextReview = now + (newInterval * 24 * 60 * 60 * 1000);

  progress[id] = {
    ...current,
    mastery: newMastery,
    lastSeen: now,
    nextReview,
    interval: newInterval
  };

  setLocal(STORAGE_KEYS.PROGRESS, progress);
  await incrementDailyCount();
};

export const getStreak = async (): Promise<StreakData[]> => {
  return getLocal(STORAGE_KEYS.STREAK) || [];
};

export const incrementDailyCount = async () => {
  const today = new Date().toISOString().split('T')[0];
  const streak: StreakData[] = getLocal(STORAGE_KEYS.STREAK) || [];
  const existingIdx = streak.findIndex(s => s.date === today);

  if (existingIdx > -1) {
    streak[existingIdx].count += 1;
  } else {
    streak.push({ date: today, count: 1 });
  }

  setLocal(STORAGE_KEYS.STREAK, streak);
};

export const getCustomVocab = async (): Promise<Word[]> => {
  return getLocal(STORAGE_KEYS.CUSTOM_VOCAB) || [];
};

export const addCustomWord = async (word: Word) => {
  const vocab = await getCustomVocab();
  vocab.push(word);
  setLocal(STORAGE_KEYS.CUSTOM_VOCAB, vocab);
};