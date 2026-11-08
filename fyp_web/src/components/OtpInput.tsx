import { useRef, useState, type RefObject } from 'react';

export const OTP_LENGTH = 6;

/**
 * A six-digit code shown as six rounded cells. Underneath is ONE real input (numeric keyboard, one-time-code autofill, one accessible label),
 * so typing, Backspace/Delete, arrow keys, selecting and replacing digits all behave natively. The cells only draw its value and caret;
 * clicking a cell selects that digit, and a paste keeps only its digits ("123 456" and "123-456" both work; leading zeroes stay).
 */
export function OtpInput({ value, onChange, label, disabled = false, invalid = false, describedBy, inputRef, autoFocus = false }: {
  value: string; onChange: (next: string) => void; label: string; disabled?: boolean; invalid?: boolean; describedBy?: string;
  inputRef?: RefObject<HTMLInputElement | null>; autoFocus?: boolean;
}) {
  const own = useRef<HTMLInputElement>(null);
  const input = inputRef ?? own;
  const [focused, setFocused] = useState(false);
  const [selection, setSelection] = useState<[number, number]>([0, 0]);
  const readSelection = () => { const node = input.current; if (node) setSelection([node.selectionStart ?? 0, node.selectionEnd ?? 0]); };
  const place = (start: number, end = start) => requestAnimationFrame(() => { input.current?.setSelectionRange(start, end); readSelection(); });
  const [start, end] = selection;
  const active = (index: number) => focused && (start === end ? index === Math.min(start, OTP_LENGTH - 1) : index >= start && index < end);

  return (
    <div className="relative" data-otp>
      <input
        ref={input}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        spellCheck={false}
        maxLength={OTP_LENGTH}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={event => onChange(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        onPaste={event => {
          event.preventDefault();
          const digits = event.clipboardData.getData('text').replace(/\D/g, '');
          if (!digits) return;
          const node = event.currentTarget;
          const from = node.selectionStart ?? value.length, to = node.selectionEnd ?? value.length;
          const next = digits.length >= OTP_LENGTH ? digits.slice(0, OTP_LENGTH) : (value.slice(0, from) + digits + value.slice(to)).slice(0, OTP_LENGTH);
          onChange(next);
          place(Math.min(digits.length >= OTP_LENGTH ? OTP_LENGTH : from + digits.length, next.length));
        }}
        onClick={event => {
          // The real caret is invisible, so a click picks the cell under the pointer: an existing digit is selected (typing replaces it).
          const box = event.currentTarget.getBoundingClientRect();
          const cell = Math.max(0, Math.min(OTP_LENGTH - 1, Math.floor((event.clientX - box.left) / (box.width / OTP_LENGTH))));
          if (cell < value.length) place(cell, cell + 1); else place(value.length);
        }}
        onSelect={readSelection}
        onFocus={() => { setFocused(true); readSelection(); }}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 z-10 h-full w-full cursor-text rounded-xl border-0 bg-transparent p-0 text-base text-transparent caret-transparent opacity-0 outline-none disabled:cursor-not-allowed"
      />
      <div aria-hidden="true" className="grid grid-cols-6 gap-2 sm:gap-2.5">
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const digit = value[index] ?? '';
          const on = active(index) && !disabled;
          return (
            <div
              key={index}
              data-otp-cell={on ? 'active' : digit ? 'filled' : 'empty'}
              className={`relative flex h-12 items-center justify-center rounded-xl border text-xl font-semibold tabular-nums transition-[border-color,box-shadow,background-color] duration-150 sm:h-14 ${
                invalid ? 'border-rose-400 dark:border-rose-500/70' : on ? 'border-brand-blue dark:border-blue-400' : 'border-slate-300 dark:border-slate-700'
              } ${on ? `ring-2 ${invalid ? 'ring-rose-500/20' : 'ring-blue-500/25'}` : ''} ${digit && on && start !== end ? (invalid ? 'bg-rose-50 dark:bg-rose-500/15' : 'bg-blue-50 dark:bg-blue-500/15') : 'bg-white/85 dark:bg-slate-900/70'} ${disabled ? 'opacity-60' : ''} text-slate-900 dark:text-slate-100`}
            >
              {digit}
              {on && start === end && !digit && <span className="otp-caret" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
