import React, { useState, useMemo, useEffect } from 'react';
import { AppTab, QuizQuestion, Word, Settings, QuizModeType, Progress, StreakData, AppLanguage } from './types';
import { SEED_VOCAB } from './data/seed';
import { getProgress, getStreak, getCustomVocab, getSettings, saveSettings, updateProgress, getMasterVocab, saveMasterVocab } from './services/storage';
import QuizEngine from './components/QuizEngine';
import StreakHeatmap from './components/StreakHeatmap';

const ITEMS_PER_PAGE = 30;

const TRANSLATIONS: Record<AppLanguage, any> = {
  zh: {
    home: '首页', library: '词库', reports: '报告', settings: '设置',
    flashcard: '翻卡模式', endless: '无尽挑战', mastery: '掌握度', mastered: '精通',
    learning: '学习中', totalProgress: '总体进度', proficiency: '熟练', unseen: '未开始',
    activity: '活跃轨迹 (10 周)', loadMore: '加载更多', items: '个结果', searchPlaceholder: '搜索韩语或释义...',
    allLevels: '全部阶段', stage: '阶段', allPos: '全部词性', sortBy: '排序方式',
    frequency: '词频', masterySort: '熟悉度', asc: '正序 ↑', desc: '倒序 ↓',
    inputInteraction: '输入交互', handwriting: '🎨 手写', typing: '⌨️ 打字',
    languageLabel: '显示语言', vocabUnits: '词',
    pos: {
      '명': '名词', '동': '动词', '형': '形容词', '부': '副词', '대': '代名词',
      '수': '数词', '관': '冠形词', '보': '补助用言', '의': '依存名词',
      '感': '感叹词', '고': '专有名词', '불': '无法分析'
    }
  },
  en: {
    home: 'Home', library: 'Library', reports: 'Reports', settings: 'Settings',
    flashcard: 'Flashcards', endless: 'Endless', mastery: 'Mastery', mastered: 'Mastered',
    learning: 'Learning', totalProgress: 'Overall Progress', proficiency: 'Proficient', unseen: 'Unseen',
    activity: 'Activity (10 Weeks)', loadMore: 'Load More', items: 'results', searchPlaceholder: 'Search Korean or Meaning...',
    allLevels: 'All Levels', stage: 'Level', allPos: 'All POS', sortBy: 'Sort By',
    frequency: 'Frequency', masterySort: 'Mastery', asc: 'Asc ↑', desc: 'Desc ↓',
    inputInteraction: 'Input Mode', handwriting: '🎨 Drawing', typing: '⌨️ Typing',
    languageLabel: 'Display Language', vocabUnits: 'words',
    pos: {
      '명': 'Noun', '동': 'Verb', '형': 'Adjective', '부': 'Adverb', '대': 'Pronoun',
      '수': 'Number', '관': 'Determiner', '보': 'Aux. Verb', '의': 'Dep. Noun',
      '感': 'Interjection', '고': 'Proper Noun', '불': 'Unknown'
    }
  }
};

const POS_MAP: Record<string, { short: string }> = {
  '명': { short: '名' }, '동': { short: '动' }, '형': { short: '形' }, '부': { short: '副' },
  '대': { short: '代' }, '수': { short: '数' }, '관': { short: '冠' }, '보': { short: '补' },
  '의': { short: '依' }, '感': { short: '感' }, '고': { short: '专' }, '불': { short: '误' }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.HOME);
  const [quizMode, setQuizMode] = useState<{questions: QuizQuestion[], type: QuizModeType} | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [settings, setSettingsState] = useState<Settings>({ inputMode: 'handwriting', language: 'zh' });
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [streak, setStreak] = useState<StreakData[]>([]);
  const [masterVocab, setMasterVocab] = useState<Word[]>([]);
  const [customVocab, setCustomVocab] = useState<Word[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().split('T')[0]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPOS, setFilterPOS] = useState<string | 'all'>('all');
  const [filterLevel, setFilterLevel] = useState<string | 'all'>('all');
  const [sortKey, setSortKey] = useState<'frequency' | 'mastery'>('frequency');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const t = TRANSLATIONS[settings.language];

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        const [s, p, st, cv, mv] = await Promise.all([
          getSettings(), getProgress(), getStreak(), getCustomVocab(), getMasterVocab()
        ]);
        setSettingsState(s);
        setProgress(p);
        setStreak(st);
        setCustomVocab(cv);
        setMasterVocab(mv.length > 0 ? mv : SEED_VOCAB);
      } finally {
        setIsLoading(false);
      }
    };
    initData();
  }, [quizMode, activeTab]);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettingsState(updated);
    await saveSettings(updated);
  };

  const allVocab = useMemo(() => [...masterVocab, ...customVocab], [masterVocab, customVocab]);
  const homonymMap = useMemo(() => {
    const map: Record<string, Word[]> = {};
    allVocab.forEach(v => { if (!map[v.korean]) map[v.korean] = []; map[v.korean].push(v); });
    return map;
  }, [allVocab]);

  const filteredAndSortedVocab = useMemo(() => {
    let result = [...allVocab];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(v => v.korean.includes(q) || v.meaning.toLowerCase().includes(q) || v.meaningEn.toLowerCase().includes(q));
    }
    if (filterPOS !== 'all') result = result.filter(v => v.pos === filterPOS);
    if (filterLevel !== 'all') result = result.filter(v => v.level === filterLevel);
    result.sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'frequency') comparison = a.frequency - b.frequency;
      else if (sortKey === 'mastery') comparison = (progress[a.id]?.mastery || 0) - (progress[b.id]?.mastery || 0);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [allVocab, searchQuery, filterPOS, filterLevel, sortKey, sortOrder, progress]);

  const stats = useMemo(() => {
    const total = allVocab.length;
    const progressValues = Object.values(progress) as Progress[];
    const mastered = progressValues.filter(p => p.mastery >= 5).length;
    const proficient = progressValues.filter(p => p.mastery >= 3 && p.mastery < 5).length;
    const learning = progressValues.filter(p => p.mastery > 0 && p.mastery < 3).length;
    return { total, mastered, proficient, learning, unseen: total - progressValues.filter(p => p.mastery > 0).length };
  }, [progress, allVocab]);

  const startSession = (mode: QuizModeType) => {
    const questions: QuizQuestion[] = [];
    const poolSize = mode === 'flashcard' ? 20 : 15;
    const pool = [...allVocab].sort(() => 0.5 - Math.random()).slice(0, poolSize);
    pool.forEach(item => {
      const displayMeaning = settings.language === 'en' ? item.meaningEn : item.meaning;
      if (mode === 'flashcard') {
        const rev = Math.random() > 0.5;
        questions.push({ id: `fc_${item.id}_${Math.random()}`, type: 'flashcard', prompt: rev ? displayMeaning : item.korean, answer: rev ? item.korean : displayMeaning, target: item, isReversed: rev });
      } else {
        const allowed = ['audio_mc', settings.inputMode === 'handwriting' ? 'handwriting' : 'dictation'];
        const type = allowed[Math.floor(Math.random() * allowed.length)] as any;
        questions.push({
          id: `q_${item.id}_${Math.random()}`, type, prompt: type === 'audio_mc' ? '' : displayMeaning, answer: item.korean, target: item,
          options: type === 'audio_mc' ? allVocab.filter(v => v.id !== item.id).sort(() => 0.5 - Math.random()).slice(0, 3).map(x => settings.language === 'en' ? x.meaningEn : x.meaning).concat(displayMeaning).sort(() => 0.5 - Math.random()) : undefined,
        });
      }
    });
    setQuizMode({ questions, type: mode });
  };

  const getPosColor = (pos: string) => {
    switch (pos) {
      case '명': return 'bg-blue-50 text-blue-600';
      case '동': return 'bg-red-50 text-red-600';
      case '형': return 'bg-amber-50 text-amber-600';
      case '부': return 'bg-indigo-50 text-indigo-600';
      default: return 'bg-gray-50 text-gray-400';
    }
  };

  if (isLoading && !quizMode) return <div className="min-h-screen bg-white flex flex-col items-center justify-center"><div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;

  if (quizMode) return <div className="fixed inset-0 bg-white z-[200]"><QuizEngine questions={quizMode.questions} settings={settings} mode={quizMode.type} onComplete={() => setQuizMode(null)} onClose={() => setQuizMode(null)} translations={t} /></div>;

  return (
    <div className="min-h-screen bg-gray-50/30 pb-24 md:pb-0 md:pl-24">
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 flex items-center justify-around h-20 pb-safe md:pb-0 px-4 md:top-0 md:left-0 md:w-20 md:h-full md:flex-col md:border-t-0 md:border-r md:justify-start md:pt-10 md:gap-8 z-50">
        {[
          { tab: AppTab.HOME, icon: '🏠', label: t.home },
          { tab: AppTab.VOCAB, icon: '📚', label: t.library },
          { tab: AppTab.STREAK, icon: '📊', label: t.reports },
          { tab: AppTab.SETTINGS, icon: '⚙️', label: t.settings },
        ].map(item => (
          <button key={item.tab} onClick={() => setActiveTab(item.tab)} className={`relative flex flex-col items-center justify-center p-3 rounded-xl transition-all ${activeTab === item.tab ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400'}`}>
            <span className="text-xl mb-1">{item.icon}</span>
            <span className="text-[9px] font-black tracking-widest uppercase">{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="max-w-xl mx-auto p-6 md:p-12 flex flex-col gap-6 md:gap-8">
        {activeTab === AppTab.HOME && (
          <>
            <header className="flex flex-col items-center py-6">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 mb-4"><span className="text-white text-2xl font-black italic">H</span></div>
              <h1 className="text-lg font-black text-gray-900 tracking-tighter uppercase italic">Hana Korean</h1>
              <div className="flex items-center gap-2 mt-1"><span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black rounded uppercase tracking-tighter">하나</span></div>
            </header>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => startSession('flashcard')} className="bg-indigo-600 text-white p-5 rounded-2xl shadow-xl flex items-center gap-4 transition-all active:scale-95 group">
                <div className="bg-white/20 p-2.5 rounded-lg text-xl">🎴</div>
                <h3 className="text-base font-black">{t.flashcard}</h3>
              </button>
              <button onClick={() => startSession('endless')} className="bg-white text-gray-900 p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 transition-all active:scale-95 group">
                <div className="bg-indigo-50 p-2.5 rounded-lg text-indigo-600 text-xl">♾️</div>
                <h3 className="text-base font-black">{t.endless}</h3>
              </button>
            </section>

            <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
               <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-[10px] uppercase tracking-widest text-gray-400">{t.mastery}</h2>
                  <span className="text-[9px] font-bold text-gray-300">{stats.total} {t.vocabUnits}</span>
               </div>
               <div className="space-y-3">
                  <div className="w-full h-1.5 rounded-full overflow-hidden bg-gray-50 flex">
                     <div className="h-full bg-green-500" style={{ width: `${(stats.mastered / (stats.total || 1)) * 100}%` }} />
                     <div className="h-full bg-indigo-400" style={{ width: `${(stats.proficient / (stats.total || 1)) * 100}%` }} />
                     <div className="h-full bg-indigo-200" style={{ width: `${(stats.learning / (stats.total || 1)) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    <span>{t.mastered} {stats.mastered}</span>
                    <span>{t.learning} {stats.learning + stats.proficient}</span>
                  </div>
               </div>
            </section>
          </>
        )}

        {activeTab === AppTab.VOCAB && (
          <div className="space-y-6">
            <header className="sticky top-0 bg-gray-50/95 backdrop-blur-md pt-2 pb-4 z-40 space-y-4">
               <div className="flex items-center justify-between">
                <h1 className="text-lg font-black text-gray-900 tracking-tighter">{t.library}</h1>
                <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase">{filteredAndSortedVocab.length} {t.items}</div>
              </div>
              <div className="relative">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t.searchPlaceholder} className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-100 outline-none font-bold text-sm transition-all" />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {['all', 'A', 'B', 'C'].map(lvl => (
                    <button key={lvl} onClick={() => setFilterLevel(lvl)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${filterLevel === lvl ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>{lvl === 'all' ? t.allLevels : `${t.stage} ${lvl}`}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setFilterPOS('all')} className={`whitespace-nowrap px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${filterPOS === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>{t.allPos}</button>
                  {Object.keys(t.pos).map(pos => (
                    <button key={pos} onClick={() => setFilterPOS(pos)} className={`whitespace-nowrap px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${filterPOS === pos ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>{t.pos[pos]}</button>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{t.sortBy}</p>
                  <div className="flex gap-4 items-center">
                    {[{ key: 'frequency', label: t.frequency }, { key: 'mastery', label: t.masterySort }].map(s => (
                      <button key={s.key} onClick={() => setSortKey(s.key as any)} className={`text-[9px] font-black uppercase tracking-widest ${sortKey === s.key ? 'text-indigo-600' : 'text-gray-300'}`}>{s.label}</button>
                    ))}
                    <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg">{sortOrder === 'asc' ? t.asc : t.desc}</button>
                  </div>
                </div>
              </div>
            </header>
            <div className="grid gap-2.5 pb-10">
              {filteredAndSortedVocab.slice(0, visibleCount).map(v => {
                const variants = homonymMap[v.korean] || [];
                const vIdx = variants.length > 1 ? variants.indexOf(v) + 1 : null;
                const displayMeaning = settings.language === 'en' ? v.meaningEn : v.meaning;
                return (
                  <div key={v.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-gray-900 text-base lang-ko">{v.korean}{vIdx && <sup className="text-[9px] ml-0.5">{vIdx}</sup>}</h3>
                        <span className="text-[8px] font-bold bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded uppercase">#{v.frequency}</span>
                      </div>
                      <p className="text-gray-400 text-xs font-bold">{displayMeaning}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       <div className="flex gap-1">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (progress[v.id]?.mastery || 0) ? 'bg-green-500' : 'bg-gray-100'}`} />))}</div>
                       <div className="flex gap-1">
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-amber-50 text-amber-600">{v.level}</span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${getPosColor(v.pos)}`}>{t.pos[v.pos] || v.pos}</span>
                       </div>
                    </div>
                  </div>
                );
              })}
              {visibleCount < filteredAndSortedVocab.length && (<button onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)} className="w-full py-4 bg-white border border-dashed border-gray-200 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.loadMore}</button>)}
            </div>
          </div>
        )}

        {activeTab === AppTab.STREAK && (
          <div className="space-y-8 pb-12">
            <h1 className="text-lg font-black text-gray-900">{t.reports}</h1>
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4 animate-fade-in">
               <h2 className="font-bold text-[10px] uppercase tracking-widest text-gray-400">{t.activity}</h2>
               <StreakHeatmap data={streak} onDateSelect={setSelectedDate} selectedDate={selectedDate} daysToShow={70} />
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-8 animate-fade-in text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">{t.totalProgress}</p>
              <h2 className="text-4xl font-black text-indigo-950 tracking-tighter">{Math.round((stats.mastered / (stats.total || 1)) * 100)}%</h2>
              <div className="space-y-6 text-left">
                {[{ l: t.mastered, c: stats.mastered, clr: 'bg-green-500', i: '💎' }, { l: t.proficiency, c: stats.proficient, clr: 'bg-indigo-400', i: '⭐' }, { l: t.learning, c: stats.learning, clr: 'bg-indigo-200', i: '🌱' }, { l: t.unseen, c: stats.unseen, clr: 'bg-gray-100', i: '🌑' }].map(l => (
                  <div key={l.l} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-lg">{l.i}</div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between text-[11px] font-black text-indigo-900 uppercase"><span>{l.l}</span><span>{l.c}</span></div>
                      <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden"><div className={`h-full ${l.clr}`} style={{ width: `${(l.c / (stats.total || 1)) * 100}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === AppTab.SETTINGS && (
          <div className="space-y-8">
            <h1 className="text-lg font-black text-gray-900">{t.settings}</h1>
            <div className="space-y-8 max-w-xl text-left">
              <section className="space-y-3">
                <h4 className="text-[9px] font-bold text-gray-300 uppercase tracking-widest ml-1">{t.languageLabel}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => updateSettings({ language: 'zh' })} className={`py-4 rounded-xl font-bold text-sm transition-all ${settings.language === 'zh' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-100 text-gray-400'}`}>简体中文</button>
                  <button onClick={() => updateSettings({ language: 'en' })} className={`py-4 rounded-xl font-bold text-sm transition-all ${settings.language === 'en' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-100 text-gray-400'}`}>English</button>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-[9px] font-bold text-gray-300 uppercase tracking-widest ml-1">{t.inputInteraction}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => updateSettings({ inputMode: 'handwriting' })} className={`py-4 rounded-xl font-bold text-sm transition-all ${settings.inputMode === 'handwriting' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-100 text-gray-400'}`}>{t.handwriting}</button>
                  <button onClick={() => updateSettings({ inputMode: 'typing' })} className={`py-4 rounded-xl font-bold text-sm transition-all ${settings.inputMode === 'typing' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-100 text-gray-400'}`}>{t.typing}</button>
                </div>
              </section>
              
              <section className="pt-8 border-t border-gray-100">
                <div className="flex items-center gap-4 p-5 bg-indigo-50/50 rounded-[28px] border border-indigo-100/50">
                  <div className="text-2xl">⚡</div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-indigo-900 tracking-[0.1em]">{t.vocabUnits}: {masterVocab.length}</p>
                    <p className="text-[9px] text-indigo-600/70 font-bold leading-relaxed mt-1">Learning status is synchronized automatically.</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;