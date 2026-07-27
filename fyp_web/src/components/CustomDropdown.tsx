import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T> {
  value: T;
  label: string;
}

export function CustomDropdown<T extends string | number>({
  options,
  value,
  onChange,
  icon: Icon,
  label,
  placeholder = 'Select option',
  className = '',
}: {
  options: (DropdownOption<T> | T)[];
  value: T;
  onChange: (val: T) => void;
  icon?: React.ElementType;
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize options to DropdownOption<T>
  const normalizedOptions: DropdownOption<T>[] = options.map(opt =>
    typeof opt === 'object' && opt !== null && 'value' in opt
      ? (opt as DropdownOption<T>)
      : { value: opt as T, label: String(opt) }
  );

  const selectedOption = normalizedOptions.find(o => o.value === value) || normalizedOptions[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between gap-2 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:focus:ring-blue-500/20 transition-all cursor-pointer shadow-2xs"
      >
        <div className="flex items-center gap-1.5 truncate">
          {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />}
          <span className="truncate">
            {label ? `${label}: ${selectedOption ? selectedOption.label : placeholder}` : (selectedOption ? selectedOption.label : placeholder)}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-brand-blue dark:text-blue-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100 font-sans">
          <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
            {normalizedOptions.map(opt => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-500/10 text-brand-blue dark:text-blue-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-brand-blue dark:text-blue-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
