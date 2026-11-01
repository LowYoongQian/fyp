import { ArrowLeft, ArrowRight, Briefcase, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { goTo, openPortal } from '../../utils/publicRoute';
import { PublicHeader } from './PublicHeader';

const CHOICES = [
  { portal: 'student' as const, title: 'Student Portal', text: 'Classes, attendance and notices.', icon: GraduationCap },
  { portal: 'staff' as const, title: 'Staff Portal', text: 'Teaching, attendance and reports.', icon: Briefcase },
];

/** Open Portal lands here: choose Student or Staff, then the existing sign-in for that portal. */
export function PortalChoice() {
  const { isAuthenticated, user, loading } = useAuth();
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/60">
      <PublicHeader action={false} />
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 pb-12 pt-24 sm:px-6">
        <h1 className="text-center font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">Choose your portal</h1>
        <p className="mt-2 text-center text-sm text-slate-500">Sign in with your school account.</p>
        {!loading && isAuthenticated && user ? (
          <div className="mx-auto mt-8 w-full max-w-md rounded-2xl border border-blue-100 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-slate-600">You are already signed in as <strong className="text-slate-900">{user.email}</strong>.</p>
            <button type="button" onClick={() => goTo('/login')} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2">
              Go to your dashboard<ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {CHOICES.map(choice => (
              <button key={choice.portal} type="button" onClick={() => openPortal(choice.portal)}
                className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 motion-reduce:transform-none">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue transition group-hover:bg-brand-blue group-hover:text-white"><choice.icon className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-900">{choice.title}</span><span className="block text-xs text-slate-500">{choice.text}</span></span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-brand-blue" />
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => goTo('/')} className="mx-auto mt-8 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:text-brand-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
          <ArrowLeft className="h-3.5 w-3.5" />Back to home
        </button>
      </main>
    </div>
  );
}
