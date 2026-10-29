import { useId, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export function TextInput({ showCounter = true, ...props }: InputHTMLAttributes<HTMLInputElement> & { showCounter?: boolean }) {
  const id = useId();
  const [length, setLength] = useState(String(props.defaultValue ?? '').length);
  const limit = Math.min(props.maxLength ?? 255, 255);
  return <><input {...props} maxLength={limit} aria-describedby={[props['aria-describedby'], showCounter ? id : ''].filter(Boolean).join(' ') || undefined} onChange={event => {
    setLength(event.currentTarget.value.length); props.onChange?.(event);
  }} />{showCounter && <span id={id} className="block text-right text-[9px] leading-4 text-slate-400" aria-hidden="true">{props.value == null ? length : String(props.value).length}/{limit}</span>}</>;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const [length, setLength] = useState(String(props.defaultValue ?? '').length);
  const limit = Math.min(props.maxLength ?? 255, 255);
  return <><textarea {...props} maxLength={limit} aria-describedby={[props['aria-describedby'], id].filter(Boolean).join(' ')} onChange={event => {
    setLength(event.currentTarget.value.length); props.onChange?.(event);
  }} /><span id={id} className="block text-right text-[9px] leading-4 text-slate-400" aria-hidden="true">{props.value == null ? length : String(props.value).length}/{limit}</span></>;
}
