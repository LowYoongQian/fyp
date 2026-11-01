import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check, History, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Plus, Settings, Shield, X } from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePetPreferences } from '../hooks/usePetPreferences';
import { PET_IDS, type PetPreferences } from '../utils/petPreference';
import { PET_SHEETS } from './petSheets';
import { CustomSwitch } from './CustomSwitch';
import { FloatingPanel } from './FloatingPanel';

export type ChatTab = { id: string; title: string; temporary: boolean; sessionId?: string; restoreLatest?: boolean };
type SavedChat = { id: string; title: string; updated_at: string };
let nextTabId = 0;
const newTab = (temporary = false, restoreLatest = false): ChatTab => ({
  id: `tab-${Date.now()}-${++nextTabId}`, title: temporary ? 'Temporary chat' : 'New chat', temporary, restoreLatest,
});

export function ChatWorkspace({ renderThread }: {
  renderThread: (tab: ChatTab, active: boolean, update: (title: string, sessionId?: string) => void) => ReactNode;
}) {
  const [tabs, setTabs] = useState(() => [newTab(new URLSearchParams(location.search).get('chat') === 'temporary', true)]);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [saved, setSaved] = useState<SavedChat[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user } = useAuth();
  const pets = usePetPreferences(user?.user_id);
  const [petNotice, setPetNotice] = useState('');
  const savePet = async (patch: Partial<PetPreferences>) => {
    setPetNotice('Saving…');
    const saved = await pets.save(patch);
    if (mounted.current) setPetNotice(saved ? 'Saved.' : 'Could not save. Try again.');
  };
  const mounted = useRef(false);
  const historyBusyRef = useRef(false);
  const active = tabs.find(tab => tab.id === activeId)!;

  useEffect(() => {
    mounted.current = true;
    const reset = () => {
      const tab = newTab(true);
      setTabs([tab]); setActiveId(tab.id); setSaved([]); setHistoryOpen(false);
    };
    // Back/forward cache must not revive a temporary conversation after exit.
    const restored = (event: PageTransitionEvent) => { if (event.persisted) reset(); };
    window.addEventListener('pagehide', reset);
    window.addEventListener('pageshow', restored);
    return () => { mounted.current = false; window.removeEventListener('pagehide', reset); window.removeEventListener('pageshow', restored); };
  }, []);

  const add = (tab: ChatTab) => {
    if (tabs.length >= 8) { setNotice('You can open up to 8 chats. Close one to open another.'); return; }
    setTabs(current => [...current, tab]); setActiveId(tab.id); setNotice(''); setHistoryOpen(false);
    if (!window.matchMedia('(min-width: 1024px)').matches) setSidebarExpanded(false);
  };
  const close = (tab: ChatTab) => {
    const remaining = tabs.filter(item => item.id !== tab.id);
    if (!remaining.length) remaining.push(newTab(tab.temporary));
    setTabs(remaining);
    if (activeId === tab.id) setActiveId(remaining[Math.min(tabs.indexOf(tab), remaining.length - 1)].id);
  };
  const loadSaved = async (more = false) => {
    if (historyBusyRef.current) return;
    historyBusyRef.current = true; setHistoryBusy(true); setNotice('');
    try {
      const result = await apiService.getNaturalSessions(more ? cursor || undefined : undefined);
      if (!mounted.current) return;
      setSaved(current => more ? [...current, ...result.items.filter(row => !current.some(old => old.id === row.id))] : result.items);
      setCursor(result.has_more ? result.next_cursor : null);
    } catch { if (mounted.current) setNotice('Saved chats could not be loaded. Open Saved chats again to retry.'); }
    finally { historyBusyRef.current = false; if (mounted.current) setHistoryBusy(false); }
  };
  // The menu is portaled out of the sidebar, so Tab would not reach it: move focus to its switch as it opens (its panel is placed before this runs).
  useLayoutEffect(() => {
    if (settingsOpen) document.querySelector<HTMLElement>('[data-floating-panel] [role="switch"]')?.focus();
  }, [settingsOpen]);
  const actionClass = `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold transition-colors hover:bg-slate-200/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue dark:hover:bg-slate-800 ${sidebarExpanded ? '' : 'justify-center'}`;
  return <div className="relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-white dark:bg-slate-950">
    <div className={`w-14 shrink-0 ${sidebarExpanded ? 'lg:w-56' : ''}`}>
      <aside aria-label="Chat actions" className={`flex h-full flex-col gap-3 border-r border-slate-200 bg-slate-50 px-2 py-3 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 ${sidebarExpanded ? 'absolute inset-y-0 left-0 z-20 w-56 shadow-xl lg:static lg:shadow-none' : 'w-14'}`}>
        <button aria-label={sidebarExpanded ? 'Collapse chat sidebar' : 'Expand chat sidebar'} aria-expanded={sidebarExpanded} title={sidebarExpanded ? 'Collapse chat sidebar' : 'Expand chat sidebar'} className={actionClass} onClick={() => setSidebarExpanded(!sidebarExpanded)}>
          {sidebarExpanded ? <PanelLeftClose className="h-4 w-4 shrink-0" /> : <PanelLeftOpen className="h-4 w-4 shrink-0" />}{sidebarExpanded && <span>Chats</span>}
        </button>
        <nav aria-label="Chat tools" className="space-y-1 border-b border-slate-200 pb-3 dark:border-slate-800">
          <button aria-label="New chat" title="New chat" className={`${actionClass} text-brand-blue`} onClick={() => add(newTab())}><Plus className="h-4 w-4 shrink-0" />{sidebarExpanded && <span>New chat</span>}</button>
          <button aria-label="Temporary chat" title="Temporary chat" className={actionClass} onClick={() => add(newTab(true))}><Shield className="h-4 w-4 shrink-0" />{sidebarExpanded && <span>Temporary chat</span>}</button>
          <button aria-label="Saved chats" title="Saved chats" className={`${actionClass} ${historyOpen ? 'bg-blue-50 text-brand-blue dark:bg-blue-950' : ''}`} aria-expanded={historyOpen} onClick={() => { setSidebarExpanded(true); setHistoryOpen(!historyOpen); if (!historyOpen) void loadSaved(); }}><History className="h-4 w-4 shrink-0" />{sidebarExpanded && <span>Saved chats</span>}</button>
        </nav>
        {historyOpen && sidebarExpanded && <div className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Saved conversations">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Saved conversations</p>
          {historyBusy && <p role="status" className="p-3 text-xs text-slate-500">Loading saved chats…</p>}
          {!historyBusy && !saved.length && <p className="p-3 text-xs text-slate-500">No saved conversations yet.</p>}
          {saved.map(row => <button key={row.id} title={row.title} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-slate-200/70 dark:hover:bg-slate-800" onClick={() => {
            const existing = tabs.find(tab => tab.sessionId === row.id);
            if (existing) { setActiveId(existing.id); setHistoryOpen(false); }
            else add({ ...newTab(), title: row.title, sessionId: row.id });
            if (!window.matchMedia('(min-width: 1024px)').matches) setSidebarExpanded(false);
          }}><MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate">{row.title}</span></button>)}
          {cursor && <button className="w-full rounded-lg p-3 text-xs font-semibold text-brand-blue hover:bg-blue-50" disabled={historyBusy} onClick={() => void loadSaved(true)}>Load more saved chats</button>}
        </div>}
        <div className="mt-auto shrink-0 border-t border-slate-200 pt-3 dark:border-slate-800">
          <button aria-label="Settings" title="Settings" aria-haspopup="dialog" aria-expanded={settingsOpen} className={`${actionClass} ${settingsOpen ? 'bg-blue-50 text-brand-blue dark:bg-blue-950' : ''}`} onClick={() => { setSettingsOpen(open => !open); setPetNotice(''); }}>
            <Settings className="h-4 w-4 shrink-0" />{sidebarExpanded && <span>Settings</span>}
          </button>
          {settingsOpen && <FloatingPanel data-chat-settings role="dialog" aria-label="Chat settings" onDismiss={() => setSettingsOpen(false)} className="w-60 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Show pet</span>
              <CustomSwitch ariaLabel="Show pet" checked={pets.visible} disabled={!pets.ready} onChange={visible => void savePet({ visible })} />
            </div>
            <div role="radiogroup" aria-label="Choose pet" className="grid grid-cols-2 gap-2 px-1 pb-1 pt-1">
              {PET_IDS.map(id => {
                const selected = pets.pet === id;
                return <button key={id} type="button" role="radio" aria-checked={selected} disabled={!pets.ready}
                  onClick={() => { if (!selected) void savePet({ pet: id }); }}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue disabled:opacity-50 ${selected ? 'border-brand-blue bg-blue-50 text-brand-blue dark:bg-blue-950' : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                  <span aria-hidden="true" className="h-[52px] w-12" style={{ backgroundImage: `url(${PET_SHEETS[id].sheet})`, backgroundSize: '800% 1100%', backgroundPosition: `${(6 / 7) * 100}% 0%`, backgroundRepeat: 'no-repeat' }} />
                  <span className="text-[11px]">{PET_SHEETS[id].name}</span>
                  {selected && <Check aria-hidden="true" className="absolute right-1.5 top-1.5 h-3.5 w-3.5" />}
                </button>;
              })}
            </div>
            <p role="status" className="min-h-4 px-3 pb-1 text-[11px] text-slate-500 dark:text-slate-400">{pets.ready ? petNotice : 'Loading your settings…'}</p>
          </FloatingPanel>}
        </div>
      </aside>
    </div>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div role="tablist" aria-label="Open chats" className="flex overflow-x-auto border-b border-slate-200 bg-slate-100 px-2 pt-2 dark:border-slate-700 dark:bg-slate-800">
        {tabs.map((tab, index) => <div key={tab.id} data-chat-tab className={`relative -mb-px flex min-w-32 max-w-56 flex-1 shrink-0 items-center rounded-t-xl border ${tab.id === activeId ? 'z-10 border-slate-200 border-b-white bg-white dark:border-slate-700 dark:border-b-slate-900 dark:bg-slate-900' : 'border-transparent text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700'}`}>
          <button id={`chat-tab-${tab.id}`} role="tab" aria-selected={tab.id === activeId} aria-controls={`chat-panel-${tab.id}`} tabIndex={tab.id === activeId ? 0 : -1}
            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200" onClick={() => setActiveId(tab.id)}
            onKeyDown={event => {
              const target = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
              if (target >= 0) { event.preventDefault(); setActiveId(tabs[target].id); document.getElementById(`chat-tab-${tabs[target].id}`)?.focus(); }
            }}>
            {tab.temporary ? <Shield className="h-3.5 w-3.5 shrink-0 text-brand-blue" /> : <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />}<span className="truncate">{tab.title}</span>
          </button>
          <button className="mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label={`Close ${tab.title}`} onClick={() => close(tab)}><X className="h-3.5 w-3.5" /></button>
        </div>)}
      </div>
      <p className="px-4 py-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{active.temporary ? 'Temporary · Cleared on close, exit, refresh or sign-out; never saved to chat history.' : 'Saved chat · Closing a tab does not delete your conversation.'}</p>
      {notice && <p role="status" className="px-4 pb-2 text-xs text-amber-700 dark:text-amber-300">{notice}</p>}
    </div>
    {tabs.map(tab => <div key={tab.id} id={`chat-panel-${tab.id}`} role="tabpanel" aria-labelledby={`chat-tab-${tab.id}`} hidden={tab.id !== activeId} className={tab.id === activeId ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'hidden'}>
      {renderThread(tab, tab.id === activeId, (title, sessionId) => {
        setTabs(current => current.map(item => item.id === tab.id ? { ...item, title: item.temporary ? `Temporary: ${title.slice(0, 35)}` : title.slice(0, 45), sessionId } : item));
      })}
    </div>)}
    </div>
  </div>;
}
