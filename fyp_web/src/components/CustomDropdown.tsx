import { FloatingPanel } from './FloatingPanel';
import React, { useState, useRef, useEffect, useId, useLayoutEffect } from 'react';
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
  ariaLabel,
  fullWidth = false,
}: {
  options: (DropdownOption<T> | T)[];
  value: T;
  onChange: (val: T) => void;
  icon?: React.ElementType;
  label?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  fullWidth?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const keyboardOpen = useRef(false);
  const panelId = useId();
  useLayoutEffect(() => {
    if (isOpen && keyboardOpen.current) {
      const panel = document.getElementById(panelId);
      (panel?.querySelector<HTMLButtonElement>('[aria-selected="true"]') || panel?.querySelector<HTMLButtonElement>('[role="option"]'))?.focus();
      keyboardOpen.current = false;
    }
  }, [isOpen, panelId]);

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
        ref={triggerRef}
        aria-label={ariaLabel ? `${ariaLabel}: ${selectedOption?.label || placeholder}` : undefined}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); keyboardOpen.current = true; setIsOpen(true);
          }
        }}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-between gap-2 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:focus:ring-blue-500/20 transition-all cursor-pointer shadow-2xs ${fullWidth ? 'min-h-11 w-full' : ''}`}
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
        <FloatingPanel id={panelId} role="listbox" aria-label={ariaLabel || label || placeholder}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false); }}
          onKeyDown={event => {
            const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
            const index = options.indexOf(document.activeElement as HTMLButtonElement);
            let next = -1;
            if (event.key === 'ArrowDown') next = (index + 1) % options.length;
            if (event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = options.length - 1;
            if (event.key.length === 1 && event.key !== ' ') next = options.findIndex(option => option.textContent?.trim().toLowerCase().startsWith(event.key.toLowerCase()));
            if (next >= 0) { event.preventDefault(); options[next]?.focus(); }
          }}
          className={`absolute right-0 mt-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl z-50 p-1.5 font-sans ${fullWidth ? 'w-full' : 'w-48'}`}>
          <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
            {normalizedOptions.map(opt => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    triggerRef.current?.focus();
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
        </FloatingPanel>
      )}
    </div>
  );
}
