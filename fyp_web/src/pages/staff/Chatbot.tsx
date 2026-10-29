import { TextInput } from '../../components/LimitedTextField';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiService } from '../../services/api';
import { BookOpen, MessageSquareCode, Send, Sparkles, UserRound, UsersRound } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { TextShimmer } from '../../components/loading-ui/text-shimmer';
import { InfinityLoop } from '../../components/loading-ui/infinity';
import { ChatWorkspace, type ChatTab } from '../../components/ChatWorkspace';
import { rankChatSuggestions } from '../../utils/chatSuggestions';
import { useAuth } from '../../context/AuthContext';

interface ChatMessage {
  id: string;
  sender: 'user' | 'system';
  text: string;
  success?: boolean;
}

interface ChatRequestError {
  response?: { data?: { detail?: string } };
  message?: string;
}

interface DisplayRecord {
  index: string;
  name: string;
  code?: string;
  details: string[];
}

type AssistantPresentation =
  | { type: 'records'; heading: string; records: DisplayRecord[]; footer?: string }
  | { type: 'attendance'; name: string; code: string; courses: Array<{ code: string; rate: string }> };

const parseAssistantPresentation = (text: string): AssistantPresentation | null => {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const attendanceHeader = lines[0]?.match(/^(.+?)\s+\(([^)]+)\)\s+attendance:$/i);
  if (attendanceHeader) {
    const courses = lines.slice(1).map((line) => {
      const match = line.match(/^([A-Z]{2,6}\d{3,5}):\s*(\d+(?:\.\d+)?%)$/i);
      return match ? { code: match[1].toUpperCase(), rate: match[2] } : null;
    }).filter((course): course is { code: string; rate: string } => course !== null);
    if (courses.length) {
      return { type: 'attendance', name: attendanceHeader[1], code: attendanceHeader[2], courses };
    }
  }

  const firstRecord = lines.findIndex((line) => /^\d+\.\s+/.test(line));
  if (firstRecord < 0) return null;
  const recordLines = lines.slice(firstRecord).filter((line) => /^\d+\.\s+/.test(line));
  if (!recordLines.length) return null;

  const records = recordLines.map((line): DisplayRecord => {
    const numbered = line.match(/^(\d+)\.\s+(.+)$/);
    const body = numbered?.[2] ?? line;
    const student = body.match(/^(.+?)\s+\(([^)]+)\)\s+[—-]\s+(.+)$/);
    if (student) {
      return {
        index: numbered?.[1] ?? '',
        name: student[1],
        code: student[2],
        details: student[3].split('·').map((part) => part.trim()).filter(Boolean),
      };
    }
    const [name, ...details] = body.split(/\s+[—-]\s+/);
    return {
      index: numbered?.[1] ?? '',
      name,
      details: details.join(' — ').split('·').map((part) => part.trim()).filter(Boolean),
    };
  });
  const footer = lines.slice(firstRecord + recordLines.length).find((line) => !/^\d+\.\s+/.test(line));
  return { type: 'records', heading: lines.slice(0, firstRecord).join(' '), records, footer };
};

const rateTone = (value: string) => {
  const rate = Number.parseFloat(value);
  if (!Number.isFinite(rate)) return 'border-slate-200 bg-white text-slate-600';
  return rate >= 80
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-rose-200 bg-rose-50 text-rose-600';
};

const AssistantMessageContent: React.FC<{ text: string; presentation: AssistantPresentation | null }> = ({ text, presentation }) => {
  if (!presentation) return <p className="whitespace-pre-wrap">{text}</p>;

  if (presentation.type === 'attendance') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue">
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">{presentation.name}</p>
            <p className="mt-0.5 font-mono text-[10px] font-semibold text-slate-400">{presentation.code}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {presentation.courses.map((course) => (
            <div key={course.code} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <span className="flex items-center gap-2 font-semibold text-slate-700">
                <BookOpen className="h-3.5 w-3.5 text-brand-blue" />
                {course.code}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold tabular-nums ${rateTone(course.rate)}`}>
                {course.rate}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-blue-light text-brand-blue">
            <UsersRound className="h-4 w-4" />
          </span>
          <p className="text-sm font-bold leading-snug text-slate-800">{presentation.heading}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
          {presentation.records.length} records
        </span>
      </div>
      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {presentation.records.map((record) => (
          <div key={`${record.index}-${record.code ?? record.name}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 transition-colors hover:border-brand-blue/25 hover:bg-brand-blue-light/30">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-bold text-slate-400 shadow-sm">
              {record.index}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-800">{record.name}</p>
              {record.code && <p className="mt-0.5 font-mono text-[10px] font-semibold text-slate-400">{record.code}</p>}
            </div>
            <div className="flex max-w-[48%] flex-wrap justify-end gap-1.5">
              {record.details.map((detail) => (
                <span
                  key={detail}
                  className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${detail.includes('%') ? rateTone(detail) : 'border-blue-100 bg-blue-50 text-blue-700'}`}
                >
                  {detail}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {presentation.footer && <p className="text-[10px] font-medium text-slate-400">{presentation.footer}</p>}
    </div>
  );
};

const ChatThread: React.FC<{ tab: ChatTab; active: boolean; questions: string[];
  update: (title: string, sessionId?: string, question?: string) => void }> = ({ tab, active, questions, update }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'system',
      text: "Hello! I can help with attendance, students, courses, sessions, timetables, analytics, and at-risk students.",
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Sending...');
  const [sessionId, setSessionId] = useState<string>(tab.sessionId || '');
  const [historyLoading, setHistoryLoading] = useState(!tab.temporary && !!(tab.restoreLatest || tab.sessionId));
  const [historyError, setHistoryError] = useState(false);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const contextRef = useRef<Record<string, string | null>>({});
  const requestRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const mountedRef = useRef(false);
  const titleRef = useRef(tab.title);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string>();
  const messagePaneRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingOlderRef = useRef(false);
  const statusTimersRef = useRef<number[]>([]);
  const messageIdRef = useRef(0);

  const lastQuestion = messages.filter(message => message.sender === 'user').at(-1)?.text || '';
  const quickPrompts = useMemo(() => rankChatSuggestions(suggestions, questions, lastQuestion), [suggestions, questions, lastQuestion]);
  const newestMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    if (active) bottomRef.current?.scrollIntoView({ behavior: historyLoading || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [newestMessageId, sending, historyLoading, active]);

  useEffect(() => {
    let cancelled = false;
    if (tab.temporary || (!tab.restoreLatest && !tab.sessionId)) return;
    apiService.getNaturalHistory({ limit: 30, sessionId: tab.sessionId }).then((history) => {
      if (cancelled) return;
      if (history.session_id) {
        if (tab.restoreLatest) titleRef.current = history.messages.find(message => message.role === 'user')?.content || tab.title;
        setSessionId(history.session_id); update(titleRef.current, history.session_id);
      }
      setHasOlderMessages(history.has_more);
      setHistoryCursor(history.next_cursor || undefined);
      if (history.messages.length) {
        const restored: ChatMessage[] = history.messages.map((message) => ({
          id: message.id,
          sender: message.role === 'user' ? 'user' : 'system',
          text: message.content,
        }));
        setMessages((current) => (
          current.length === 1 && current[0].id === 'welcome' ? restored : current
        ));
      }
    }).catch((error) => {
      console.error('Chat history could not be loaded.', error);
      if (!cancelled) setHistoryError(true);
    }).finally(() => {
      if (!cancelled) setHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // A tab's initial history target never changes; replies update its saved ID independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyAttempt]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlderRef.current || !hasOlderMessages || !historyCursor || !sessionId) return;
    const pane = messagePaneRef.current;
    const previousHeight = pane?.scrollHeight ?? 0;
    const previousTop = pane?.scrollTop ?? 0;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const history = await apiService.getNaturalHistory({
        before: historyCursor,
        sessionId,
        limit: 30,
      });
      if (!mountedRef.current) return;
      const older: ChatMessage[] = history.messages.map((message) => ({
        id: message.id,
        sender: message.role === 'user' ? 'user' : 'system',
        text: message.content,
      }));
      setMessages((current) => {
        const knownIds = new Set(current.map((message) => message.id));
        return [...older.filter((message) => !knownIds.has(message.id)), ...current];
      });
      setHasOlderMessages(history.has_more);
      setHistoryCursor(history.next_cursor || undefined);
      window.requestAnimationFrame(() => {
        if (!pane) return;
        pane.scrollTop = previousTop + pane.scrollHeight - previousHeight;
      });
    } catch (error) {
      console.error('Older chat messages could not be loaded.', error);
    } finally {
      loadingOlderRef.current = false;
      if (mountedRef.current) setLoadingOlder(false);
    }
  }, [hasOlderMessages, historyCursor, sessionId]);

  const handleMessageScroll = () => {
    if ((messagePaneRef.current?.scrollTop ?? 1) <= 80) void loadOlderMessages();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; requestRef.current?.abort(); statusTimersRef.current.forEach(window.clearTimeout); };
  }, []);

  const handleSend = async (questionText: string) => {
    if (!questionText.trim() || sendingRef.current || historyLoading || historyError) return;
    sendingRef.current = true;
    const controller = new AbortController();
    requestRef.current = controller;
    if (!messages.some(message => message.sender === 'user')) titleRef.current = questionText.trim();
    update(titleRef.current, sessionId || undefined, questionText);
    statusTimersRef.current.forEach(window.clearTimeout);
    setLoadingStatus('Sending...');
    setSending(true);
    statusTimersRef.current = [
      window.setTimeout(() => setLoadingStatus('Thinking...'), 500),
      window.setTimeout(() => setLoadingStatus('Checking data...'), 1800),
      window.setTimeout(() => setLoadingStatus('Writing answer...'), 4500),
    ];
    
    // Add user message
    messageIdRef.current += 1;
    const userMsg: ChatMessage = {
      id: `message-${messageIdRef.current}`,
      sender: 'user',
      text: questionText
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const response = await apiService.queryNatural(questionText, tab.temporary ? undefined : sessionId || undefined, {
        temporary: tab.temporary, signal: controller.signal, context_state: contextRef.current,
        messages: messages.filter(message => message.id !== 'welcome').slice(-16).map(message => ({
          role: message.sender === 'user' ? 'user' : 'assistant', content: message.text.slice(0, 2000),
        })),
      });
      if (!mountedRef.current || controller.signal.aborted) return;
      if (response.session_id) { setSessionId(response.session_id); update(titleRef.current, response.session_id); }
      contextRef.current = response.context_state || {};
      setSuggestions(response.suggestions || []);
      messageIdRef.current += 1;
      const systemMsg: ChatMessage = {
        id: `message-${messageIdRef.current}`,
        sender: 'system',
        text: response.answer,
        success: response.success
      };
      setMessages(prev => [...prev, systemMsg]);
    } catch (err: unknown) {
      if (!mountedRef.current || controller.signal.aborted) return;
      console.error(err);
      const requestError = err as ChatRequestError;
      const errDetail = requestError.response?.data?.detail || requestError.message || 'Connection failed.';
      messageIdRef.current += 1;
      const systemMsg: ChatMessage = {
        id: `message-${messageIdRef.current}`,
        sender: 'system',
        text: errDetail
      };
      setMessages(prev => [...prev, systemMsg]);
    } finally {
      statusTimersRef.current.forEach(window.clearTimeout);
      statusTimersRef.current = [];
      sendingRef.current = false;
      if (mountedRef.current) setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white/75 relative">
      {/* Panel Header */}
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-blue-light rounded-xl text-brand-blue">
            <MessageSquareCode className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-slate-800">Smart Attendance AI Assistant</h3>
            <span className="text-xs text-slate-400 block mt-0.5">
              Secure attendance help powered by Inkling Small
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-brand-blue-light text-brand-blue border border-brand-blue/10 font-sans uppercase tracking-wider">
          <Sparkles className="h-3 w-3 text-brand-blue animate-pulse" />
          <span>Backend AI Protected</span>
        </div>
      </div>

      {/* Main Messages View */}
      <div
        ref={messagePaneRef}
        onScroll={handleMessageScroll}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/20"
      >
        {historyError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Saved messages could not be loaded; your history has not been deleted.
          <button className="ml-2 underline font-semibold" onClick={() => { setHistoryError(false); setHistoryLoading(true); setHistoryAttempt(attempt => attempt + 1); }}>Retry history</button>
        </div>}
        {(historyLoading || loadingOlder) && (
          <div className="flex justify-center py-3" aria-label={historyLoading ? 'Loading chat history' : 'Loading older messages'}>
            <InfinityLoop className="h-10 w-10 text-brand-blue" />
          </div>
        )}
        {messages.map((msg) => {
          const isSystem = msg.sender === 'system';
          const presentation = isSystem ? parseAssistantPresentation(msg.text) : null;
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${presentation ? 'w-full max-w-2xl' : ''} ${isSystem ? 'mr-auto text-left' : 'ml-auto flex-row-reverse text-right'}`}
            >
              {/* Profile Orb */}
              <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center border font-sans font-bold text-[10px] ${
                isSystem
                  ? 'bg-brand-blue-light border-brand-blue/10 text-brand-blue'
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}>
                {isSystem ? 'AI' : 'ME'}
              </div>

              {/* Chat Bubble */}
              <div className="space-y-2.5">
                <div className={`p-4 text-xs leading-relaxed border shadow-sm ${presentation ? 'w-full' : ''} ${
                  isSystem
                    ? 'bg-white border-slate-100 text-slate-700 font-sans rounded-2xl rounded-tl-none'
                    : 'bg-brand-blue border-transparent text-white text-left font-sans rounded-2xl rounded-tr-none shadow-brand-blue/10'
                }`}>
                  <AssistantMessageContent text={msg.text} presentation={presentation} />
                </div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex items-center gap-3 mr-auto text-left max-w-[80%]" aria-live="polite">
            <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center border border-brand-blue/10 bg-brand-blue-light text-brand-blue font-sans font-bold text-[10px] shadow-sm">
              AI
            </div>
            <div className="min-w-40 rounded-2xl rounded-tl-none border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={loadingStatus}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <TextShimmer className="text-xs font-semibold text-slate-500">
                    {loadingStatus}
                  </TextShimmer>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Chat Form */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0 space-y-3">
        {/* Quick prompts tags */}
        <p className="text-[10px] text-slate-400">Suggested next questions · Based on this visit and current results</p>
        <div aria-label="Suggested questions" className="flex gap-2 overflow-x-auto pb-1 text-[10px] no-scrollbar">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              disabled={sending || historyLoading || historyError}
              onClick={() => handleSend(p)}
              className="py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-brand-blue rounded-full font-sans text-[10px] font-semibold tracking-wide cursor-pointer transition-all shrink-0 disabled:opacity-50 shadow-sm"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="relative bg-white rounded-xl border border-slate-200 focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/10 transition-all flex items-center p-1.5 shadow-sm"
        >
          <TextInput showCounter={false}
            type="text"
            required
            value={input}
            maxLength={2000}
            disabled={sending || historyLoading || historyError}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Query database... (e.g. show me Lee's active sessions)"
            className="flex-grow bg-transparent text-xs text-slate-700 pl-3.5 pr-12 py-3 focus:outline-none placeholder:text-slate-400 font-sans"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <button
              type="submit"
              aria-label="Send message"
              disabled={sending || historyLoading || historyError || !input.trim()}
              className="p-2.5 bg-brand-blue hover:bg-brand-blue-hover text-white rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 shadow-md shadow-brand-blue/10"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Chatbot: React.FC = () => {
  const { user } = useAuth();
  return <ChatWorkspace key={user?.user_id} renderThread={(tab, active, questions, update) =>
    <ChatThread tab={tab} active={active} questions={questions} update={update} />} />;
};


