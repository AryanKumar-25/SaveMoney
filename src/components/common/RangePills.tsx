import React from 'react';

export type TimeRange = '1D' | '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface RangePillsProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
  options?: TimeRange[];
  className?: string;
}

const DEFAULT_RANGES: TimeRange[] = ['1D', '7D', '1M', '3M', '6M', '1Y', 'ALL'];

export function RangePills({
  selected,
  onChange,
  options = DEFAULT_RANGES,
  className = '',
}: RangePillsProps) {
  return (
    <div
      className={`inline-flex items-center bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl gap-1 text-xs font-semibold ${className}`}
    >
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`px-3 py-1 rounded-lg transition-all duration-150 select-none ${
              isSelected
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
