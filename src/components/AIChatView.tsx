/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, Send, Compass, Sparkles, MessageCircleCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export default function AIChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Suggestions for rapid clicks
  const suggestions = [
    "Chi ha l'abbonamento in scadenza questa settimana?",
    "Mostrami i clienti che non vengono da 3 settimane",
    "Quante presenze ci sono state in totale?",
    "Riassumi la situazione dei pagamenti di oggi"
  ];

  // Initialize with welcome message
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: "Ciao! Sono **FluxGPT**, il tuo assistente intelligente integrato. \n\nHo accesso completo ai dati in tempo reale del gestionale: abbonamenti, scadenze, clienti inattivi, lezioni e pagamenti della palestra. Come posso aiutarti oggi nella gestione dello studio?",
        timestamp: new Date()
      }
    ]);
  }, []);

  // Scroll to bottom whenever messages list is edited
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          // format chat history for contextual chains
          history: messages.slice(1).map(m => ({
            sender: m.sender === 'user' ? 'user' : 'model',
            text: m.text
          }))
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Errore di elaborazione");

      const aiMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'ai',
        text: data.text,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'ai',
        text: "Spiacente, si è verificato un errore di connessione con il modulo AI: " + e.message,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Utility to parse markdown-like bold/list formatting in chat outputs
  const formatText = (text: string) => {
    return text.split('\n').map((line, lineIdx) => {
      // Bold highlighting parsing
      let formattedLine = line;
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="font-bold text-slate-950">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }

      const content = parts.length > 0 ? parts : line;

      // Unordered lists parsing
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={lineIdx} className="ml-4 list-disc text-sm text-slate-700 my-1">
            {line.trim().substring(2)}
          </li>
        );
      }

      return (
        <p key={lineIdx} className="text-sm text-slate-700 leading-relaxed min-h-[1rem]">
          {content}
        </p>
      );
    });
  };

  return (
    <div id="ai-chat-interface" className="max-w-none w-full h-[calc(100vh-9.5rem)] md:h-[calc(100vh-12rem)] flex flex-col bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
      
      {/* Target status bar */}
      <div className="bg-[#113f3d] p-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#84e062] flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#113f3d]" />
          </div>
          <div>
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              FluxGPT <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <p className="text-xs text-teal-200/80 font-mono">ASSISTENTE TEAM PALESTRA ATTIVO</p>
          </div>
        </div>

        {/* No metadata column */}
      </div>

      {/* Message Screen */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40">
        <AnimatePresence>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 max-w-[85%] ${m.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                m.sender === 'user' ? 'bg-[#113f3d] text-white' : 'bg-teal-50 text-teal-800 border border-teal-100'
              }`}>
                {m.sender === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-emerald-600" />}
              </div>

              <div className={`p-4 rounded-3xl text-sm prose max-w-none ${
                m.sender === 'user' 
                  ? 'bg-slate-100 text-slate-800 rounded-tr-none' 
                  : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none space-y-2'
              }`}>
                {formatText(m.text)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {loading && (
          <div className="flex gap-3 max-w-[80%]">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-[#113f3d] animate-bounce" />
            </div>
            <div className="bg-white p-4 rounded-3xl rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-2">
              <Compass className="w-4 h-4 text-teal-600 animate-spin" />
              <span className="text-xs font-semibold text-slate-500 font-mono">Sto consultando il database in tempo reale...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Suggestion Bubbles */}
      {messages.length === 1 && (
        <div className="p-4 bg-slate-50/20 border-t border-slate-50 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1">
            <MessageCircleCode className="w-3.5 h-3.5" /> Esempi di domande frequenti:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s)}
                className="px-3.5 py-2 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-200 rounded-full text-xs text-slate-700 hover:text-teal-900 transition-all text-left cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input controls */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputText);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
            placeholder="Chiedi pure: 'Chi ha abbonamenti in scadenza?', 'Prepara email per Mario', ecc..."
            className="flex-1 px-4 py-3 bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-slate-800 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            className="p-3 bg-[#113f3d] hover:bg-teal-900 text-white rounded-2xl transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
}
