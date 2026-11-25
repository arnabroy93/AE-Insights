import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShieldAlert,
  Info,
  Layers,
  Building2,
  TrendingDown,
  Clock,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { api } from '../api';
import { FilterParams } from '../types';

interface AiInsightsProps {
  filters: FilterParams;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  groundTruthContext?: any;
  timestamp: string;
}

export const AiInsights: React.FC<AiInsightsProps> = ({ filters }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `### Welcome to **Ask AE INSIGHT** 🤖\n\nI am your **Academic Excellence Analytical Assistant**, powered by Gemini and grounded directly in your **live Anudip database**.\n\n* **Zero-Hallucination Policy:** Every response is calculated directly from distinct student, batch, and center records.\n* **Calculation Transparency:** I always cite the exact denominator and calculation basis.\n\n**Try asking:**\n* *"Which centers have the highest dropout counts?"*\n* *"Which batches are currently delayed beyond their planned end date?"*\n* *"Show trainers assigned to multiple active batches"*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const presetQueries = [
    'Which centers have the highest dropout counts?',
    'Which batches are currently delayed beyond their planned end date?',
    'Show trainers assigned to multiple active batches',
    'What is the validation status breakdown across students?',
    'Which programs have the lowest ILT completion rates?',
    'Show exception rates across centers',
  ];

  const handleSend = async (questionText: string) => {
    const text = questionText || query;
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await api.askAi(text, filters);
      const aiMsg: Message = {
        role: 'assistant',
        content: res.answer,
        groundTruthContext: res.groundTruthContext,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        role: 'assistant',
        content: `**Error:** Unable to process your inquiry. Please try again.\n\n*${err.message || ''}*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#008C95] text-white flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Ask AE INSIGHT — AI Operational Intelligence</h2>
            <p className="text-xs text-slate-500">
              Conversational analytics grounded in verified MySQL database records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Ground-Truth Verification Active</span>
        </div>
      </div>

      {/* Preset Query Chips */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Suggested Analytical Queries:
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {presetQueries.map((pq, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(pq)}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-50 hover:bg-[#E6F4F5] text-slate-700 hover:text-[#005F66] rounded-lg text-xs font-medium border border-slate-200 transition-colors cursor-pointer text-left"
            >
              {pq}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4 min-h-[450px] max-h-[600px] overflow-y-auto">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 text-xs ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-[#008C95] text-white flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl p-4 shadow-2xs ${
                msg.role === 'user'
                  ? 'bg-[#008C95] text-white rounded-tr-xs'
                  : 'bg-slate-50 text-slate-800 border border-slate-200/80 rounded-tl-xs prose prose-sm prose-slate'
              }`}
            >
              <div
                className="leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: msg.content
                    .replace(/### (.*?)\n/g, '<h4 class="text-sm font-bold text-slate-900 mt-2 mb-1">$1</h4>')
                    .replace(/#### (.*?)\n/g, '<h5 class="text-xs font-bold text-slate-800 mt-2 mb-1">$1</h5>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                }}
              />
              <div
                className={`text-[10px] mt-2 ${
                  msg.role === 'user' ? 'text-white/70 text-right' : 'text-slate-400 text-left'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 font-bold">
                U
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 max-w-sm">
            <Sparkles className="w-4 h-4 text-[#008C95] animate-pulse" />
            <span>Analyzing database metrics &amp; generating grounded response...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-md flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend(query);
          }}
          placeholder="Ask anything about students, dropouts, delays, centers, or trainers..."
          className="flex-1 px-3 py-2 text-xs text-slate-800 focus:outline-hidden placeholder:text-slate-400"
        />
        <button
          onClick={() => handleSend(query)}
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-[#008C95] hover:bg-[#00747C] disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
};
