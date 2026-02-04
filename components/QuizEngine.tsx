import React, { useState, useEffect, useRef } from 'react';
import { QuizQuestion, Word, Settings } from '../types';
import { speakKorean } from '../services/tts';
import { updateProgress } from '../services/storage';
import HandwritingPad, { HandwritingPadRef } from './HandwritingPad';
import { recognizeKoreanHandwriting } from '../services/vision';

interface QuizEngineProps {
  questions: QuizQuestion[];
  settings: Settings;
  mode: 'flashcard' | 'endless';
  onComplete: () => void;
  onClose: () => void;
  translations: any;
}

const POS_MAP: Record<string, { color: string }> = {
  '명': { color: 'bg-blue-50 text-blue-600' }, '동': { color: 'bg-red-50 text-red-600' },
  '형': { color: 'bg-amber-50 text-amber-600' }, '부': { color: 'bg-indigo-50 text-indigo-600' },
  '대': { color: 'bg-purple-50 text-purple-600' }, '수': { color: 'bg-gray-50 text-gray-500' },
  '관': { color: 'bg-gray-50 text-gray-500' }, '보': { color: 'bg-gray-50 text-gray-500' },
  '의': { color: 'bg-gray-50 text-gray-500' }, '感': { color: 'bg-gray-50 text-gray-500' },
  '고': { color: 'bg-gray-50 text-gray-500' }, '불': { color: 'bg-gray-50 text-gray-500' }
};

const QuizEngine: React.FC<QuizEngineProps> = ({ questions, settings, mode, onComplete, onClose, translations: t }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [userInput, setUserInput] = useState('');
  const [currentStrokes, setCurrentStrokes] = useState<any>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  
  const currentQ = questions[currentIndex];
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const hwRef = useRef<HandwritingPadRef>(null);

  useEffect(() => {
    if (currentQ) {
      if (currentQ.type === 'audio_mc') speakKorean(currentQ.target?.korean || '');
      else if (currentQ.type === 'flashcard' && !currentQ.isReversed) speakKorean(currentQ.prompt);
    }
    // Reset state for new card
    setCurrentStrokes([]); 
    setIsFlipped(false); 
    setShowCorrection(false); 
    setSwipeOffset(0); 
    setExitDirection(null);
    setIsAnalyzing(false); 
    setAiResult(null);
    setAnswerState('idle');
  }, [currentIndex, questions]);

  const handleFlip = () => {
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    if (currentQ?.type === 'flashcard' && nextFlipped && currentQ.isReversed) speakKorean(currentQ.answer);
  };

  const handleAction = (isCorrect: boolean) => {
    if (mode === 'endless') {
      if (isCorrect) {
        setAnswerState('correct');
        if (currentQ.target) updateProgress(currentQ.target.id, 1);
        setTimeout(() => nextQuestion(), 600);
      } else {
        setAnswerState('wrong');
        if (currentQ.target) updateProgress(currentQ.target.id, -1);
        // Delay correction screen to let "Red Flash" show
        setTimeout(() => setShowCorrection(true), 450);
      }
    } else {
      // Flashcard mode
      setExitDirection(isCorrect ? 'right' : 'left');
      if (currentQ.target) updateProgress(currentQ.target.id, isCorrect ? 1 : -1);
      setTimeout(() => nextQuestion(), 300);
    }
  };

  const handleHandwritingSubmit = async () => {
    if (!hwRef.current || isAnalyzing) return;
    const imageData = hwRef.current.getImageData();
    if (!imageData) return;
    setIsAnalyzing(true); setAiResult(null);
    const recognizedText = await recognizeKoreanHandwriting(imageData);
    setAiResult(recognizedText); setIsAnalyzing(false);
    
    // Normalize comparison (ignore spaces)
    const normalizedTarget = currentQ.answer.replace(/\s+/g, '');
    const normalizedAI = recognizedText.replace(/\s+/g, '');
    const isCorrect = normalizedTarget === normalizedAI;
    handleAction(isCorrect);
  };

  const nextQuestion = () => {
    setAnswerState('idle'); 
    setShowCorrection(false); 
    setUserInput(''); 
    setCurrentStrokes([]); 
    setIsAnalyzing(false); 
    setAiResult(null); 
    setSwipeOffset(0);
    setExitDirection(null);
    
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
    else onComplete();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== 'flashcard' || exitDirection) return;
    const el = e.currentTarget as HTMLDivElement;
    el.setPointerCapture(e.pointerId);
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    setIsSwiping(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isSwiping || pointerStartX.current === null) return;
    const delta = e.clientX - pointerStartX.current;
    setSwipeOffset(delta);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isSwiping || pointerStartX.current === null) return;
    setIsSwiping(false);
    
    const deltaX = e.clientX - pointerStartX.current;
    const deltaY = e.clientY - (pointerStartY.current || 0);
    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (dist < 8) {
      // It's a click/tap
      handleFlip();
      setSwipeOffset(0);
    } else if (Math.abs(deltaX) > 65) {
      // It's a swipe
      handleAction(deltaX > 0);
    } else {
      // Cancel swipe
      setSwipeOffset(0);
    }
    
    pointerStartX.current = null;
    pointerStartY.current = null;
  };

  if (!currentQ) return null;

  if (showCorrection && currentQ.target) {
    const posInfo = POS_MAP[currentQ.target.pos];
    const posLabel = t.pos[currentQ.target.pos] || currentQ.target.pos;
    const displayMeaning = settings.language === 'en' ? currentQ.target.meaningEn : currentQ.target.meaning;
    
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white animate-fade-in text-center z-[100]">
        <div className="space-y-4 mb-16">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-4xl font-black text-indigo-950 lang-ko">{currentQ.target.korean}</h1>
            <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${posInfo?.color || 'bg-gray-50'}`}>{posLabel}</span>
          </div>
          <p className="text-base text-indigo-400 font-bold uppercase tracking-widest">{currentQ.target.romanization || ''}</p>
          <div className="h-1 w-8 bg-red-100 mx-auto rounded-full" />
          <p className="text-xl font-bold text-gray-500">{displayMeaning}</p>
          {aiResult && (
            <div className="mt-8 p-4 bg-red-50 rounded-2xl border border-red-100 inline-block px-8">
              <p className="text-[10px] text-red-400 font-black uppercase tracking-widest mb-1">{settings.language === 'zh' ? 'AI 识别结果' : 'AI Read'}</p>
              <span className="lang-ko text-3xl text-red-600 font-black">{aiResult}</span>
            </div>
          )}
        </div>
        <div className="flex gap-4 w-full max-w-sm">
          <button onClick={() => speakKorean(currentQ.target?.korean || '')} className="flex-1 py-4 bg-gray-50 text-2xl rounded-2xl active:scale-95 transition-transform">🔊</button>
          <button onClick={nextQuestion} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm active:scale-95 transition-transform">{settings.language === 'zh' ? '继续' : 'Continue'}</button>
        </div>
      </div>
    );
  }

  const getCardStyle = () => {
    if (exitDirection) {
      const x = exitDirection === 'right' ? 800 : -800;
      const rot = exitDirection === 'right' ? 35 : -35;
      return { transform: `translateX(${x}px) rotate(${rot}deg)`, transition: 'transform 0.4s ease-in', opacity: 0 };
    }
    const rot = swipeOffset * 0.08;
    return { 
      transform: `translateX(${swipeOffset}px) rotate(${rot}deg)`,
      transition: isSwiping ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1)'
    };
  };

  return (
    <div className={`flex flex-col w-full h-full relative overflow-hidden select-none transition-colors duration-300 ${answerState === 'wrong' ? 'bg-red-50' : 'bg-white'}`}>
      {/* Incorrect Answer Red Flash Overlay */}
      <div className={`absolute inset-0 bg-red-500/10 pointer-events-none z-[60] transition-opacity duration-200 ${answerState === 'wrong' ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />

      <button onClick={onClose} className="absolute top-6 left-6 p-2 text-gray-200 hover:text-gray-900 z-[70] transition-colors"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
      
      <div className="absolute top-8 right-10 flex items-center gap-2 z-[70]">
        <span className="text-lg font-black text-indigo-600 tracking-tighter">{currentIndex + 1}</span>
        <div className="w-5 h-[1.5px] bg-indigo-50" />
        <span className="text-[8px] font-black text-gray-200 uppercase tracking-[0.4em]">Items</span>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 relative h-full">
        {mode === 'flashcard' ? (
          <div 
            className="w-full h-full flex items-center justify-center relative touch-none pointer-events-auto"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <div className={`absolute left-10 text-7xl transition-all duration-150 pointer-events-none z-0 ${swipeOffset < -25 ? 'opacity-40 scale-125 translate-x-0' : 'opacity-0 scale-90 -translate-x-4'}`}>❌</div>
            <div className={`absolute right-10 text-7xl transition-all duration-150 pointer-events-none z-0 ${swipeOffset > 25 ? 'opacity-40 scale-125 translate-x-0' : 'opacity-0 scale-90 translate-x-4'}`}>✅</div>

            <div 
              style={getCardStyle()} 
              className="relative w-full max-w-sm h-[60vh] perspective-[2000px] cursor-grab active:cursor-grabbing z-10"
            >
              <div className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                <div className="absolute inset-0 [backface-visibility:hidden] bg-white border border-gray-100 rounded-[40px] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.12)] flex flex-col items-center justify-center p-8">
                  <span className={`text-4xl font-black text-indigo-950 tracking-tighter ${!currentQ.isReversed ? 'lang-ko' : ''}`}>
                    {currentQ.prompt}
                  </span>
                  <div className="absolute bottom-10 text-[8px] font-black text-gray-200 uppercase tracking-[0.4em] animate-pulse">Tap to Flip</div>
                </div>
                <div className="absolute inset-0 [backface-visibility:hidden] bg-indigo-600 border border-indigo-600 rounded-[40px] shadow-2xl flex flex-col items-center justify-center p-8 [transform:rotateY(180deg)] text-white">
                  <span className={`text-3xl font-black tracking-tight ${currentQ.isReversed ? 'lang-ko' : ''}`}>
                    {currentQ.answer}
                  </span>
                  <div className="absolute bottom-10 text-[8px] font-black text-white/40 uppercase tracking-[0.4em]">Swipe to Answer</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={`w-full max-md:max-w-md md:max-w-xl flex flex-col gap-6 md:gap-10 transition-transform ${answerState === 'wrong' ? 'animate-[shake_0.45s_ease-in-out]' : ''}`}>
            <style>{`
              @keyframes shake {
                0%, 100% { transform: translateX(0); }
                15% { transform: translateX(-10px); }
                30% { transform: translateX(10px); }
                45% { transform: translateX(-10px); }
                60% { transform: translateX(10px); }
                75% { transform: translateX(-5px); }
              }
            `}</style>
            <div className="text-center space-y-4">
              {currentQ.prompt && <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">{currentQ.prompt}</h2>}
              {currentQ.type === 'audio_mc' && <button onClick={() => speakKorean(currentQ.target?.korean || '')} className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl mx-auto active:scale-90 shadow-sm transition-transform">🔊</button>}
            </div>
            <div className="w-full">
              {currentQ.type === 'audio_mc' ? (
                <div className="grid grid-cols-2 gap-3">{currentQ.options?.map((opt, i) => (<button key={i} onClick={() => handleAction(opt === (settings.language === 'en' ? currentQ.target?.meaningEn : currentQ.target?.meaning))} className={`p-5 rounded-xl font-bold text-lg border-2 transition-all ${answerState === 'idle' ? 'bg-white border-gray-100 text-gray-600' : opt === (settings.language === 'en' ? currentQ.target?.meaningEn : currentQ.target?.meaning) ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-red-100 text-red-400 opacity-50'}`}>{opt}</button>))}</div>
              ) : currentQ.type === 'handwriting' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <HandwritingPad ref={hwRef} key={currentIndex} onClear={() => { setCurrentStrokes([]); setAiResult(null); setAnswerState('idle'); }} onStrokeEnd={setCurrentStrokes} />
                    {aiResult && <div className="absolute top-4 left-4 bg-white/80 p-2 rounded-xl backdrop-blur-md border shadow-lg flex flex-col items-center animate-fade-in"><p className="text-[8px] font-black uppercase text-gray-400">{settings.language === 'zh' ? 'AI 读到' : 'AI Read'}</p><span className="lang-ko text-xl font-black text-indigo-900">{aiResult}</span></div>}
                    {isAnalyzing && <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center z-20"><div className="w-8 h-8 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div><span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-900">{settings.language === 'zh' ? '识别中...' : 'Analyzing...'}</span></div>}
                    {answerState === 'correct' && <div className="absolute inset-0 bg-green-500/20 backdrop-blur-[1px] rounded-2xl flex items-center justify-center pointer-events-none"><div className="text-6xl animate-bounce">✨</div></div>}
                  </div>
                  <button disabled={currentStrokes.length === 0 || isAnalyzing} onClick={handleHandwritingSubmit} className={`w-full py-4 rounded-xl font-black text-sm uppercase transition-all ${currentStrokes.length > 0 && !isAnalyzing ? 'bg-indigo-600 text-white active:scale-95 shadow-lg' : 'bg-gray-100 text-gray-300'}`}>{isAnalyzing ? '...' : (answerState === 'correct' ? (settings.language === 'zh' ? '正确!' : 'Correct!') : (settings.language === 'zh' ? '提交' : 'Submit'))}</button>
                </div>
              ) : (
                <div className="space-y-6">
                   <input autoFocus type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAction(userInput.trim() === currentQ.answer)} className={`w-full p-4 bg-gray-50 border-2 rounded-2xl outline-none font-black text-lg text-center transition-colors ${answerState === 'wrong' ? 'border-red-400 text-red-600' : 'border-transparent focus:border-indigo-600'}`} placeholder="..." />
                  <button onClick={() => handleAction(userInput.trim() === currentQ.answer)} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase active:scale-95 shadow-lg transition-transform">{settings.language === 'zh' ? '提交' : 'Submit'}</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizEngine;