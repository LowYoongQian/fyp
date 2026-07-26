import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Key, Mail, AlertCircle, Sparkles, GraduationCap, CheckCircle2 } from 'lucide-react';
import { swalError } from '../../utils/swal';

export const Login: React.FC = () => {
  const { login } = useAuth();
  
  // Portal Mode State
  const [portalMode, setPortalMode] = useState<'student' | 'staff'>('student');

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Field Specific Validation States
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Global UI States
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Validation Logic Helpers
  const validateEmail = (val: string): string | null => {
    const trimmed = val.trim();
    // Do NOT show error if email is empty (until user inputs text)
    if (!trimmed) {
      return null;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return 'Please enter a valid school email address (e.g. student@school.edu)';
    }
    return null;
  };

  const validatePassword = (val: string, isSubmit = false): string | null => {
    if (!val) {
      // Only show "cannot be left blank" if user pressed submit button while empty
      return isSubmit ? 'Password field cannot be left blank' : null;
    }
    if (val.length < 4) {
      return 'Password must be at least 4 characters long';
    }
    return null;
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = email.trim() !== '' && emailRegex.test(email.trim());
  const isPasswordValid = password !== '' && password.length >= 4;
  const isFormValid = isEmailValid && isPasswordValid;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    setEmailError(validateEmail(val));
  };

  const handleEmailBlur = () => {
    setEmailError(validateEmail(email));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setPasswordError(validatePassword(val, false));
  };

  const handlePasswordBlur = () => {
    setPasswordError(validatePassword(password, false));
  };

  const switchPortal = (mode: 'student' | 'staff') => {
    setPortalMode(mode);
    setEmail('');
    setPassword('');
    setEmailError(null);
    setPasswordError(null);
    setError(null);
    setInfo(null);
  };

  const handleDemoFill = () => {
    setError(null);
    setEmailError(null);
    setPasswordError(null);

    if (portalMode === 'student') {
      setEmail('low@student.school.edu');
      setPassword('1111');
      setInfo('Autofilled Student Demo (Alice)');
    } else {
      setEmail('low@staff.school.edu');
      setPassword('1111');
      setInfo('Autofilled Staff Demo (Mr. Lee)');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const eErr = validateEmail(email);
    const pErr = validatePassword(password, true);

    setEmailError(eErr);
    setPasswordError(pErr);

    if (eErr || pErr || !isFormValid) {
      return;
    }

    setSubmitting(true);

    try {
      await login(email, password, portalMode === 'student' ? 'student' : 'staff_admin');
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || 'An error occurred. Make sure the backend server (FastAPI) is running at port 8000.';
      setError(detail);
      await swalError('Login Failed', detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Animated Aurora Background Blobs */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      <div className="max-w-md w-full uipro-card relative z-10 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-brand-blue-light dark:bg-blue-500/10 rounded-xl text-brand-blue dark:text-blue-400 mb-1 shadow-sm transition-all duration-300">
            {portalMode === 'student' ? (
              <GraduationCap className="h-6 w-6 text-brand-blue dark:text-blue-400" />
            ) : (
              <Shield className="h-6 w-6 text-brand-blue dark:text-blue-400" />
            )}
          </div>
          
          <div className="flex flex-col items-center">
            <h2 className="text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Smart Attendance
            </h2>
            <span className="text-[10px] font-sans font-semibold text-brand-blue dark:text-blue-400 uppercase tracking-wider mt-1 block">
              {portalMode === 'student' ? 'Student Verification Portal' : 'Staff & Admin Portal'}
            </span>
          </div>
        </div>

        {/* Main Form (noValidate disables default native browser popups) */}
        <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-3 text-xs text-rose-600 dark:text-rose-400 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-3 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
              <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          {/* Email Address */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
              {isEmailValid && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 animate-in fade-in duration-200" />
              )}
            </div>
            <div className="relative">
              <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
                emailError ? 'text-rose-500' : 'text-slate-400'
              }`} />
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                placeholder={
                  portalMode === 'student'
                    ? 'e.g. student@student.school.edu'
                    : 'e.g. staff@staff.school.edu'
                }
                className={`w-full uipro-input !pl-11 transition-all ${
                  emailError
                    ? '!border-rose-500 focus:!border-rose-500 ring-2 ring-rose-500/20'
                    : ''
                }`}
              />
            </div>
            {emailError && (
              <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{emailError}</span>
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
              {isPasswordValid && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 animate-in fade-in duration-200" />
              )}
            </div>
            <div className="relative">
              <Key className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
                passwordError ? 'text-rose-500' : 'text-slate-400'
              }`} />
              <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                placeholder="••••••••"
                className={`w-full uipro-input !pl-11 transition-all ${
                  passwordError
                    ? '!border-rose-500 focus:!border-rose-500 ring-2 ring-rose-500/20'
                    : ''
                }`}
              />
            </div>
            {passwordError && (
              <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{passwordError}</span>
              </p>
            )}
          </div>

          {/* Submit and Quick Demo Autofill Panel */}
          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className={`flex-grow transition-all duration-200 flex items-center justify-center min-h-[44px] rounded-xl font-semibold text-sm ${
                !isFormValid
                  ? 'bg-slate-200 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300/40 dark:border-slate-700/50 shadow-none'
                  : 'uipro-button uipro-button-primary cursor-pointer shadow-md hover:shadow-lg'
              }`}
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In</>
              )}
            </button>
            <button
              type="button"
              onClick={handleDemoFill}
              className="px-4 uipro-button uipro-button-secondary text-xs flex items-center justify-center cursor-pointer min-h-[44px]"
              title={portalMode === 'student' ? 'Auto-fill Student Demo' : 'Auto-fill Staff Demo'}
            >
              <Sparkles className="h-4 w-4 text-brand-blue" />
            </button>
          </div>
        </form>

        {/* Portal Switcher */}
        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5 text-center">
          {portalMode === 'student' ? (
            <button
              type="button"
              onClick={() => switchPortal('staff')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 font-medium text-sm shadow-sm transition-all duration-200 cursor-pointer w-full justify-center"
            >
              <Shield className="h-4 w-4 text-brand-blue dark:text-blue-400" />
              Staff Login Portal
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchPortal('student')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 font-medium text-sm shadow-sm transition-all duration-200 cursor-pointer w-full justify-center"
            >
              <GraduationCap className="h-4 w-4 text-brand-blue dark:text-blue-400" />
              Student Login Portal
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
