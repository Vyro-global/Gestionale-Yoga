/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Cliente, Abbonamento, Fattura, Lezione, Presenza, Promemoria } from '../types.js';
import { 
  TrendingUp, Users, DollarSign, Calendar, Sparkles, AlertTriangle, 
  RotateCw, RefreshCw, CheckCircle2, ChevronRight, PieChart, Activity 
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardViewProps {
  onNavigateTo: (tab: string) => void;
}

export default function DashboardView({ onNavigateTo }: DashboardViewProps) {
  // Database States
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [abbonamenti, setAbbonamenti] = useState<Abbonamento[]>([]);
  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [lezioni, setLezioni] = useState<Lezione[]>([]);
  const [presenze, setPresenze] = useState<Presenza[]>([]);
  const [promemorie, setPromemorie] = useState<Promemoria[]>([]);
  
  // App operations
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic calculations
  const [activeClientsCount, setActiveClientsCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [expiringSubscriptions, setExpiringSubscriptions] = useState<(Abbonamento & { clienteName: string })[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<(Fattura & { clienteName: string })[]>([]);
  const [todayClasses, setTodayClasses] = useState<(Lezione & { presenzeCount: number })[]>([]);

  // Fetch all variables to calculate aggregates
  const fetchDashboardData = async () => {
    try {
      const getJSON = async (url: string) => {
        const res = await fetch(url);
        return res.json();
      };
      
      const [cliData, abbData, fatData, lezData, presData, promData] = await Promise.all([
        getJSON('/api/clienti'),
        getJSON('/api/abbonamenti'),
        getJSON('/api/fatture'),
        getJSON('/api/lezioni'),
        getJSON('/api/presenze'),
        getJSON('/api/promemoria').catch(() => [])
      ]);

      setClienti(cliData);
      setAbbonamenti(abbData);
      setFatture(fatData);
      setLezioni(lezData);
      setPresenze(presData);

      // Read pre-existing cached promemoria if available to respect API limits. Fallback to POST only if empty.
      if (promData && promData.length > 0) {
        const sortedProms = [...promData].reverse();
        setPromemorie(sortedProms);
      } else {
        const actualPromRes = await fetch('/api/promemoria', { method: 'POST' }).catch(() => null);
        if (actualPromRes) {
          const singleProm = await actualPromRes.json();
          setPromemorie(singleProm ? [singleProm] : []);
        }
      }

      // Calculations according to specs:
      const todayStr = new Date().toISOString().substring(0, 10);
      const todayVal = new Date(todayStr).getTime();
      const sevenDaysVal = todayVal + 7 * 24 * 60 * 60 * 1000;

      // 1. Actively subscribed clients today (state 'attivo')
      const activeIds = new Set(
        abbData
          .filter((a: any) => a.stato === 'attivo' && new Date(a.data_fine).getTime() >= todayVal)
          .map((a: any) => a.cliente_id)
      );
      setActiveClientsCount(activeIds.size);

      // 2. Sum of all Paid Invoices
      const revenueSum = fatData
        .filter((f: any) => f.stato_pagamento === 'pagato')
        .reduce((sum: number, f: any) => sum + Number(f.importo), 0);
      setTotalRevenue(revenueSum);

      // 3. Abbonamenti scadenti nei prossimi 7 giorni (con nome cliente)
      const expiringList = abbData
        .filter((a: any) => {
          const fineVal = new Date(a.data_fine).getTime();
          return a.stato === 'attivo' && fineVal >= todayVal && fineVal <= sevenDaysVal;
        })
        .map((a: any) => {
          const cli = cliData.find((c: any) => c.id === a.cliente_id);
          return {
            ...a,
            clienteName: cli ? `${cli.nome} ${cli.cognome}` : 'Sconosciuto'
          };
        });
      setExpiringSubscriptions(expiringList);

      // 4. Fatture da pagare (con nome cliente)
      const unpaidList = fatData
        .filter((f: any) => f.stato_pagamento === 'da pagare' || f.stato_pagamento === 'scaduto')
        .map((f: any) => {
          const cli = cliData.find((c: any) => c.id === f.cliente_id);
          return {
            ...f,
            clienteName: cli ? `${cli.nome} ${cli.cognome}` : 'Sconosciuto'
          };
        });
      setUnpaidInvoices(unpaidList);

      // 5. Presenze di oggi: Lezioni abbinate al giorno attuale della settimana (in italiano)
      const giorniSett = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
      const currentDayName = giorniSett[new Date().getDay()];
      
      const matchedClasses = lezData
        .filter((l: any) => l.giorno_settimana === currentDayName)
        .map((l: any) => {
          const presToday = presData.filter((p: any) => p.lezione_id === l.id && p.data_presenza === todayStr);
          return {
            ...l,
            presenzeCount: presToday.length
          };
        });
      setTodayClasses(matchedClasses);

    } catch (err: any) {
      console.error(err);
      setError("Impossibile caricare i dati del gestionale. Verifica che l'Express server sia attivo.");
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Staff Daily Summary Regeneration via Gemini SDK API endpoint
  const regenerateAISummary = async () => {
    setAiLoading(true);
    try {
      const response = await fetch('/api/promemoria', { method: 'POST' });
      if (!response.ok) throw new Error("Errore di risposta server");
      
      const newProm = await response.json();
      setPromemorie([newProm]);
    } catch (e: any) {
      alert("Errore generazione riepilogo AI. Verifica la chiave GEMINI_API_KEY nei Secrets.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            Panoramica FluxGestionale
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Analizza le statistiche del club, monitora le scadenze degli abbonati e consulta l'assistente giornaliero.
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={fetchDashboardData}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl shadow-sm transition-all"
            title="Sincronizza Dati"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onNavigateTo('ai')}
            className="px-5 py-3 bg-[#113f3d] hover:bg-teal-900 text-[#84e062] font-semibold text-xs rounded-2xl shadow-lg shadow-[#113f3d]/15 flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 animate-pulse" /> Consulta AI Copilot
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl text-orange-850 text-sm flex items-center gap-2 font-medium">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 3-Bento Grid Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* KPI 1: Totale Incassi (Beautiful Bright Green Gradient matching mockup's Revenue Card!) */}
        <div className="bg-gradient-to-br from-[#84e062] to-[#9be45c] p-6 rounded-[2rem] text-[#113f3d] flex flex-col justify-between relative overflow-hidden group shadow-lg shadow-[#84e062]/15 hover:shadow-xl transition-all min-h-[12rem] h-auto gap-4">
          {/* Diagonal textured designs copied from the image structure */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full filter blur-2xl -mr-10 -mt-10" />
          <div className="absolute bottom-[-10px] right-2 font-mono text-9xl font-bold opacity-10 select-none">€</div>

          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold font-mono tracking-widest uppercase opacity-75">TOTALE INCASSI</span>
              <h3 className="text-4xl font-extrabold tracking-tight font-sans mt-2">
                € {totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            
            <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#113f3d]/10 backdrop-blur-sm w-fit px-3 py-1.5 rounded-full text-xs font-semibold">
            <span>+12.4% rispetto al mese scorso</span>
          </div>
        </div>

        {/* KPI 2: Clienti Attivi (White & Sleek minimal) */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-all min-h-[12rem] h-auto gap-4">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full filter blur-xl" />
          
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold font-mono tracking-widest text-slate-400 uppercase">CLIENTI ATTIVI OGGI</span>
              <h3 className="text-4xl font-extrabold tracking-tight text-slate-900 mt-2">
                {activeClientsCount} <span className="text-slate-400 text-sm font-medium">atleti</span>
              </h3>
            </div>

            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-[#113f3d]">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#84e062]" /> Fomenta il rinnovo dei pacchetti
          </span>
        </div>

        {/* KPI 3: Lezioni di Oggi (Premium segmented target progress card mirroring Mockup's Sales Target!) */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all min-h-[12rem] h-auto gap-4 overflow-hidden relative group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold font-mono tracking-widest text-[#113f3d] uppercase">OBIETTIVO ATTIVITÀ</span>
              <h3 className="text-3xl font-black tracking-tight text-slate-900 mt-2 font-sans">
                {todayClasses.length} / 8 <span className="text-slate-400 text-xs font-extrabold tracking-widest uppercase font-mono ml-1">Lezioni Oggi</span>
              </h3>
            </div>

            <div className="w-10 h-10 rounded-xl bg-[#84e062]/10 flex items-center justify-center text-teal-800 hover:scale-105 transition-all">
              <Calendar className="w-5 h-5" />
            </div>
          </div>

          {/* Fully custom stylized Segmented Progress Bar matching the attached image structure exactly */}
          <div className="space-y-3">
            <div className="flex h-5 w-full rounded-lg overflow-hidden bg-slate-50 gap-1 p-0.5 border border-slate-100/50">
              {/* Portion 1: Svolte (Solid deep teal #113f3d with white-diagonal textured stripes) */}
              <div className="w-[50%] bg-[#113f3d] rounded-l-md relative overflow-hidden group-hover:opacity-95 transition-all" title="Presenti registrati">
                <div className="absolute inset-0 opacity-15 bg-[linear-gradient(45deg,#ffffff_25%,transparent_25%,transparent_50%,#ffffff_50%,#ffffff_75%,transparent_75%,transparent)] bg-[size:10px_10px]" />
              </div>
              
              {/* Portion 2: Prenotate (Vivid bright lime green #84e062) */}
              <div className="w-[35%] bg-[#84e062] relative overflow-hidden group-hover:scale-x-105 transition-all" title="Pianificate / Iscritti" />
              
              {/* Portion 3: Target di Riserva (Soft striped green border pattern) */}
              <div className="w-[15%] bg-[#e3fcdb] rounded-r-md relative overflow-hidden opacity-80" title="Capacità massima">
                <div className="absolute inset-0 opacity-45 bg-[linear-gradient(-45deg,#84e062_25%,transparent_25%,transparent_50%,#84e062_50%,#84e062_75%,transparent_75%,transparent)] bg-[size:5px_5px]" />
              </div>
            </div>

            {/* Custom Legend layout mirroring the dots labels from image 2 */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold font-mono tracking-tight pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#113f3d]" /> Svolte
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#84e062]" /> Pianificate
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e3fcdb] border border-[#84e062]/30" /> Capacità
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Promemoria AI Staff Box (Highly interactive and helpful) */}
      <div className="p-1 bg-gradient-to-r from-[#113f3d] to-teal-900 rounded-[2.5rem] border border-teal-850 shadow-lg">
        <div className="bg-teal-950/40 p-6 md:p-8 rounded-[2.3rem] text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden relative">
          
          {/* Decorative glowing gradient elements */}
          <div className="absolute top-[-20%] right-[-10%] w-72 h-72 bg-[#84e062]/10 rounded-full filter blur-3xl opacity-40 select-none pointer-events-none" />

          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center gap-1.5 bg-[#84e062]/20 text-[#84e062] px-3.5 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase border border-[#84e062]/10">
              <Sparkles className="w-4 h-4 animate-bounce shrink-0" /> SUPPORTO INTELLIGENTE FLUX AI
            </div>

            <h3 className="text-xl md:text-2xl font-bold tracking-tight">Riepilogo Giornaliero Assistente</h3>
            
            <p className="text-teal-100/90 text-sm whitespace-pre-wrap leading-relaxed max-w-3xl">
              {promemorie.length > 0 ? promemorie[0].testo : "Nessun riepilogo generato per oggi. Fai clic sul pulsante a destra per calcolare gli avvisi generali tramite intelligenza artificiale."}
            </p>
          </div>

          <button
            onClick={regenerateAISummary}
            disabled={aiLoading}
            className="px-6 py-3 bg-[#84e062] hover:bg-lime-400 text-[#113f3d] font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#84e062]/10 transition-all shrink-0 cursor-pointer disabled:opacity-55"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Elaborazione dati...
              </>
            ) : (
              <>
                <RotateCw className="w-4 h-4" /> Rigenera Riepilogo AI
              </>
            )}
          </button>
        </div>
      </div>

      {/* SVG Beautiful Rounded Columns Revenue Chart (Fills 100% of row width) */}
      <div className="w-full">
        
        {/* Sales / Collections Static Round-Chart */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm w-full space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-600" /> Rendimento Incassi Annuale
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">VALORI RILEVATI SUI PAGAMENTI RICEVUTI</p>
            </div>

            <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-600 font-mono">A.A. 2026</span>
          </div>

          {/* Fully custom-drawn beautiful SVG responsive bar chart mirroring the mockup column colors */}
          <div className="w-full h-56 pt-2">
            <svg viewBox="0 0 700 240" className="w-full h-full font-mono text-[10px] text-slate-400 text-center">
              {/* Horizontal Gridlines */}
              <line x1="40" y1="30" x2="680" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="80" x2="680" y2="80" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="130" x2="680" y2="130" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="180" x2="680" y2="180" stroke="#e2e8f0" strokeWidth="1.5" />

              {/* Grid Annotations (Y Axis) */}
              <text x="30" y="34" textAnchor="end">€ 1k</text>
              <text x="30" y="84" textAnchor="end">€ 500</text>
              <text x="30" y="134" textAnchor="end">€ 250</text>
              <text x="30" y="184" textAnchor="end">€ 0</text>

              {/* Monthly Bar Columns */}
              {/* Column heights mapping: January to December */}
              {[
                { m: 'Gen', h: 90, val: 410 },
                { m: 'Feb', h: 30, val: 120 },
                { m: 'Mar', h: 140, val: 780 },
                { m: 'Apr', h: 42, val: 210 },
                { m: 'Mag', h: 160, val: 890 },
                { m: 'Giu', h: 198, val: totalRevenue }, // June binds to dynamic total!
                { m: 'Lug', h: 120, val: 620 },
                { m: 'Ago', h: 10, val: 50 },
                { m: 'Set', h: 130, val: 700 },
                { m: 'Ott', h: 75, val: 320 },
                { m: 'Nov', h: 60, val: 280 },
                { m: 'Dic', h: 105, val: 510 }
              ].map((col, idx) => {
                const xPos = 40 + idx * 53 + 12;
                const barHeight = col.h;
                const yPos = 180 - barHeight;

                return (
                  <g key={idx} className="group cursor-pointer">
                    {/* Background invisible hover hit area */}
                    <rect x={xPos - 5} y="15" width="40" height="180" fill="transparent" />

                    {/* Column bar shadow backing */}
                    <rect x={xPos} y={15} width="30" height="165" fill="#f8fafc" rx="6" />

                    {/* Active Lime Green column bar */}
                    <rect 
                       x={xPos} 
                       y={yPos} 
                       width="30" 
                       height={barHeight} 
                       fill={idx === 5 ? '#113f3d' : '#84e062'} 
                       rx="6" 
                       className="transition-all duration-300 group-hover:opacity-85"
                    />

                    {/* Pattern lines on columns matching the attached layout */}
                    <line x1={xPos + 5} y1={yPos + 5} x2={xPos + 25} y2={yPos + 25} stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    <line x1={xPos + 5} y1={yPos + 15} x2={xPos + 25} y2={yPos + 35} stroke="rgba(255,255,255,0.15)" strokeWidth="2" />

                    {/* X Axis Month Label */}
                    <text x={xPos + 15} y="200" textAnchor="middle" className="text-[9px] fill-slate-500 font-bold">{col.m}</text>

                    {/* Tooltip Card (appear on hover) */}
                    <g className="opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
                      <rect x={xPos - 35} y={yPos - 36} width="100" height="24" fill="#0f172a" rx="8" />
                      <text x={xPos + 15} y={yPos - 20} textAnchor="middle" fill="#ffffff" className="font-bold text-[9px] font-sans">
                        € {col.val.toFixed(0)}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Lists Section: Unpaid Invoices & Expiring Subscriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Expiring Subscriptions List */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-50">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Abbonamenti in Scadenza (7 gg)
              </h3>
              <p className="text-slate-400 text-[10px]">Contatta immediatamente gli atleti indicati per il rinnovo</p>
            </div>
            
            <button 
              onClick={() => onNavigateTo('abbonamenti')}
              className="text-xs font-bold text-teal-800 hover:text-teal-950 flex items-center gap-0.5 cursor-pointer"
            >
              Vedi Tutti <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {expiringSubscriptions.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {expiringSubscriptions.map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 text-sm block">{a.clienteName}</span>
                    <span className="text-slate-500 font-mono">Pacchetto: {a.tipo} • € {a.importo.toFixed(2)}</span>
                  </div>
                  
                  <div className="text-right">
                    <span className="inline-block bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-bold text-[10px]">
                      Scade il {new Date(a.data_fine).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-emerald-50/40 border border-emerald-100/50 text-emerald-800 rounded-2xl flex items-center gap-2 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Nessun pacchetto abbonati scade nei prossimi 7 giorni. Ottimo!</span>
            </div>
          )}
        </div>

        {/* Unpaid Overdue Invoices List */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-50">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Fatture/Ricevute non Pagate
              </h3>
              <p className="text-slate-400 text-[10px]">Verifica i pagamenti in sospeso per evitare ammanchi insoluti</p>
            </div>

            <button 
              onClick={() => onNavigateTo('fatture')}
              className="text-xs font-bold text-teal-800 hover:text-teal-950 flex items-center gap-0.5 cursor-pointer"
            >
              Vedi Tutte <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {unpaidInvoices.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {unpaidInvoices.map((f) => (
                <div key={f.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 text-sm block">{f.clienteName}</span>
                    <span className="text-slate-500 font-mono">Fat. Ricevuta: {f.numero_fattura} • {f.descrizione}</span>
                  </div>
                  
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="font-mono font-bold text-rose-600 text-sm">€ {f.importo.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Scadenza: {new Date(f.data_scadenza).toLocaleDateString('it-IT')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-rose-50/10 border border-slate-100 text-slate-600 rounded-2xl flex items-center gap-2 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Tutte le fatture risultano saldate correttamente. Nessun insoluto!</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
