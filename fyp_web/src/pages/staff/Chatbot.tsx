import React, { useState, useRef, useEffect } from 'react';
import { apiService } from '../../services/api';
import { MessageSquareCode, Send, Sparkles, Terminal } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'system';
  text: string;
  sql?: string | null;
  success?: boolean;
}

export const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'system',
      text: "Hello! I am your Intelligent SQL Assistant. Ask me any database attendance question in plain English, and I will translate it into a read-only query, execute it safely, and summarize the results.",
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    "Who is at high risk of failing attendance?",
    "List all students enrolled in Deep Learning",
    "Show average attendance rates across all courses",
    "How many students are present in G1 group sessions?"
  ];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async (questionText: string) => {
    if (!questionText.trim()) return;
    setSending(true);
    
    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: questionText
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const response = await apiService.queryNatural(questionText);
      // Response model: { answer, sql_used, success, row_count }
      const systemMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'system',
        text: response.answer,
        sql: response.sql_used,
        success: response.success
      };
      setMessages(prev => [...prev, systemMsg]);
    } catch (err: any) {
      console.error(err);
      const errDetail = err.response?.data?.detail || err.message || 'Connection failed.';
      const systemMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'system',
        text: `Error contacting backend: ${errDetail}. Ensure Gemini API keys are configured and the FastAPI backend server is running.`
      };
      setMessages(prev => [...prev, systemMsg]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col bg-white/75 backdrop-blur-md border border-slate-100 rounded-2xl shadow-premium overflow-hidden relative">
      {/* Panel Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-blue-light rounded-xl text-brand-blue">
            <MessageSquareCode className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-slate-800">Natural Language AI Chatbot</h3>
            <span className="text-xs text-slate-400 block mt-0.5">
              LLaMA 3 / Gemini SQL Generation & Synthesis
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-brand-blue-light text-brand-blue border border-brand-blue/10 font-sans uppercase tracking-wider">
          <Sparkles className="h-3 w-3 text-brand-blue animate-pulse" />
          <span>Gemini-Flash-Lite Powered</span>
        </div>
      </div>

      {/* Main Messages View */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/20">
        {messages.map((msg) => {
          const isSystem = msg.sender === 'system';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${isSystem ? 'mr-auto text-left' : 'ml-auto flex-row-reverse text-right'}`}
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
                <div className={`p-4 text-xs leading-relaxed border shadow-sm ${
                  isSystem
                    ? 'bg-white border-slate-100 text-slate-700 font-sans rounded-2xl rounded-tl-none'
                    : 'bg-brand-blue border-transparent text-white text-left font-sans rounded-2xl rounded-tr-none shadow-brand-blue/10'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* SQL Code Block Auditing Widget */}
                {isSystem && msg.sql && (
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2.5 text-left w-full sm:w-[450px] shadow-sm">
                    <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-wider pb-1.5 border-b border-slate-200/80">
                      <div className="flex items-center gap-1.5 font-sans font-bold">
                        <Terminal className="h-3.5 w-3.5 text-brand-blue" />
                        <span>Autogenerated SQL Query</span>
                      </div>
                      <span className="text-success-green font-bold bg-success-green-light px-1.5 py-0.5 rounded border border-success-green/10">Read-Only SELECT</span>
                    </div>
                    <code className="text-[10px] text-slate-850 font-mono block overflow-x-auto whitespace-pre p-3 bg-white rounded-lg border border-slate-200 shadow-inner">
                      {msg.sql}
                    </code>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex gap-3 mr-auto text-left max-w-[80%]">
            <div className="h-8 w-8 rounded-full shrink-0 shimmer-placeholder" />
            <div className="p-4 bg-white border border-slate-100 rounded-2xl rounded-tl-none space-y-2.5 w-64 shadow-sm">
              <div className="h-3 w-5/6 rounded shimmer-placeholder" />
              <div className="h-3 w-1/2 rounded shimmer-placeholder" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Chat Form */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0 space-y-3">
        {/* Quick prompts tags */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-[10px] no-scrollbar">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              disabled={sending}
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
          <input
            type="text"
            required
            value={input}
            disabled={sending}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Query database... (e.g. show me Lee's active sessions)"
            className="flex-grow bg-transparent text-xs text-slate-700 pl-3.5 pr-12 py-3 focus:outline-none placeholder:text-slate-400 font-sans"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <button
              type="submit"
              disabled={sending || !input.trim()}
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


