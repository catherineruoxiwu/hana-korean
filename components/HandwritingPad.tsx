
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Stroke, Point } from '../types';

interface HandwritingPadProps {
  onClear: () => void;
  onStrokeEnd: (strokes: Stroke[]) => void;
}

export interface HandwritingPadRef {
  getImageData: () => string | null;
  clear: () => void;
}

const HandwritingPad = forwardRef<HandwritingPadRef, HandwritingPadProps>(({ onClear, onStrokeEnd }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke>([]);

  useImperativeHandle(ref, () => ({
    getImageData: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      
      // Create a temporary canvas with white background for better AI recognition
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tCtx = tempCanvas.getContext('2d');
      if (!tCtx) return null;
      
      tCtx.fillStyle = '#ffffff';
      tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tCtx.drawImage(canvas, 0, 0);
      
      return tempCanvas.toDataURL('image/png');
    },
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      setStrokes([]);
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6; // Thicker line for better recognition
      ctx.strokeStyle = '#1e1b4b';
    };

    resize();
    window.addEventListener('resize', resize);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const getPoint = (e: any): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top, t: Date.now() };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    setIsDrawing(true);
    const p = getPoint(e);
    if (p) {
      currentStrokeRef.current = [p];
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) { ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    }
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault();
    const p = getPoint(e);
    if (!p) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    currentStrokeRef.current.push(p);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStrokeRef.current.length > 0) {
      const newStrokes = [...strokes, currentStrokeRef.current];
      setStrokes(newStrokes);
      onStrokeEnd(newStrokes);
    }
    currentStrokeRef.current = [];
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <div className="relative w-full aspect-square bg-white border border-gray-100 rounded-2xl overflow-hidden canvas-container shadow-sm">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair touch-none"
        />
        <button 
          onClick={() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
            setStrokes([]);
            onClear();
          }}
          className="absolute bottom-4 right-4 bg-gray-100/50 hover:bg-gray-100 text-gray-400 p-2 rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
});

export default HandwritingPad;
