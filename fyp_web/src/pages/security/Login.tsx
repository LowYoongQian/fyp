import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Key, Mail, AlertCircle, Sparkles, GraduationCap } from 'lucide-react';
import { swalError } from '../../utils/swal';

export const Login: React.FC = () => {
  const { login } = useAuth();
  
  // Portal Mode State
  const [portalMode, setPortalMode] = useState<'student' | 'staff'>('student');

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI States
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchPortal = (mode: 'student' | 'staff') => {
    setPortalMode(mode);
    setEmail('');
    setPassword('');
    setError(null);
    setInfo(null);
  };

  const handleDemoFill = () => {
    setError(null);
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
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-slate-50">
      {/* Animated Aurora Background Blobs */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      <div className="max-w-md w-full uipro-card relative z-10 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-brand-blue-light rounded-xl text-brand-blue mb-1 shadow-sm transition-all duration-300">
            {portalMode === 'student' ? (
              <GraduationCap className="h-6 w-6 text-brand-blue" />
            ) : (
              <Shield className="h-6 w-6 text-brand-blue" />
            )}
          </div>
          
          <div className="flex flex-col items-center">
            <h2 className="text-3xl font-display font-bold tracking-tight text-slate-900">
              Smart Attendance
            </h2>
            <span className="text-[10px] font-sans font-semibold text-brand-blue uppercase tracking-wider mt-1 block">
              {portalMode === 'student' ? 'Student Verification Portal' : 'Staff & Admin Portal'}
            </span>
          </div>
        </div>

        {/* Main Form */}
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="p-4 bg-danger-red-light border border-danger-red/10 rounded-xl flex gap-3 text-xs text-danger-red">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="p-4 bg-success-green-light border border-success-green/10 rounded-xl flex gap-3 text-xs text-success-green">
              <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          {/* Email Address */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  portalMode === 'student'
                    ? 'e.g. student@student.school.edu'
                    : 'e.g. staff@staff.school.edu'
                }
                className="w-full uipro-input !pl-11"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Password</label>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full uipro-input !pl-11"
              />
            </div>
          </div>

          {/* Submit and Quick Demo Autofill Panel */}
          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-grow uipro-button uipro-button-primary cursor-pointer flex items-center justify-center min-h-[44px]"
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
        <div className="mt-6 border-t border-slate-100 pt-5 text-center">
          {portalMode === 'student' ? (
            <button
              type="button"
              onClick={() => switchPortal('staff')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium text-sm shadow-sm transition-all duration-200 cursor-pointer w-full justify-center"
            >
              <Shield className="h-4 w-4 text-brand-blue" />
              Staff Login Portal
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchPortal('student')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium text-sm shadow-sm transition-all duration-200 cursor-pointer w-full justify-center"
            >
              <GraduationCap className="h-4 w-4 text-brand-blue" />
              Student Login Portal
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
