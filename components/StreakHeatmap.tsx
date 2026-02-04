import React from 'react';
import { StreakData } from '../types';

interface StreakHeatmapProps {
  data: StreakData[];
  onDateSelect?: (date: string) => void;
  selectedDate?: string | null;
  daysToShow?: number; // New prop to control range
}

const StreakHeatmap: React.FC<StreakHeatmapProps> = ({ data, onDateSelect, selectedDate, daysToShow = 70 }) => {
  const today = new Date();
  const days = Array.from({ length: daysToShow }).map((_, i) => {
    const d = new Date();
    d.setDate(today.getDate() - (daysToShow - 1 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayData = data.find(s => s.date === dateStr);
    return {
      date: dateStr,
      count: dayData?.count || 0
    };
  });

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-gray-100';
    if (count < 5) return 'bg-indigo-100';
    if (count < 15) return 'bg-indigo-300';
    if (count < 30) return 'bg-indigo-500';
    return 'bg-indigo-700';
  };

  // Adjust columns based on daysToShow
  const gridCols = daysToShow <= 7 ? 'grid-cols-7' : 'grid-cols-14';

  return (
    <div className="w-full">
      <div 
        className={`grid gap-1.5 sm:gap-2 ${daysToShow <= 7 ? 'grid-cols-7' : ''}`} 
        style={daysToShow > 7 ? { gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' } : {}}
      >
        {days.map((day, idx) => (
          <button 
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              onDateSelect?.(day.date);
            }}
            className={`w-full aspect-square rounded-[6px] sm:rounded-lg ${getIntensity(day.count)} transition-all hover:scale-110 active:scale-90 ${selectedDate === day.date ? 'ring-2 ring-offset-2 ring-indigo-600 z-10' : ''}`}
            title={`${day.date}: ${day.count} 练习`}
          />
        ))}
      </div>
      {daysToShow > 7 && (
        <div className="mt-6 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
          <span>很少练习</span>
          <div className="flex gap-1.5 items-center">
            <div className="w-3 h-3 bg-gray-100 rounded-sm"></div>
            <div className="w-3 h-3 bg-indigo-100 rounded-sm"></div>
            <div className="w-3 h-3 bg-indigo-300 rounded-sm"></div>
            <div className="w-3 h-3 bg-indigo-500 rounded-sm"></div>
            <div className="w-3 h-3 bg-indigo-700 rounded-sm"></div>
          </div>
          <span>动力十足</span>
        </div>
      )}
    </div>
  );
};

export default StreakHeatmap;