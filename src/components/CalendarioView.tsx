/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import { Lezione, Cliente, Presenza } from '../types.js';
import { 
  Calendar, Clock, User, Users, Plus, Check, ChevronRight, CheckCircle2, 
  Trash2, X, AlertCircle, Sparkles, AlertTriangle, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CalendarioView() {
  const [lezioni, setLezioni] = useState<Lezione[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [presenze, setPresenze] = useState<Presenza[]>([]);

  const [selectedLezioneId, setSelectedLezioneId] = useState<string | null>(null);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [viewMode, setViewMode] = useState<'mensile' | 'settimanale'>('mensile');

  // Interactive Monthly Calendar Pickers
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(5); // Giugno (0-indexed 5)
  const [selectedDate, setSelectedDate] = useState<string>("2026-06-18"); // Focus on local mockup day

  // Form states adding new class lesson
  const [newTitolo, setNewTitolo] = useState('');
  const [newIstruttore, setNewIstruttore] = useState('');
  const [newGiorno, setNewGiorno] = useState('Lunedì');
  const [newOrario, setNewOrario] = useState('18:00');
  const [newPosti, setNewPosti] = useState('15');
  const [newDurata, setNewDurata] = useState('1 ora');

  // Register presence states
  const [registerClienteId, setRegisterClienteId] = useState('');

  const [notify, setNotify] = useState<string | null>(null);

  const monthsList = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];
  const yearsList = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  const daysOfWeek = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

  const mapDayIndexToName = (dayIndex: number) => {
    const mapping: { [key: number]: string } = {
      1: "Lunedì",
      2: "Martedì",
      3: "Mercoledì",
      4: "Giovedì",
      5: "Venerdì",
      6: "Sabato",
      0: "Domenica"
    };
    return mapping[dayIndex] || "Lunedì";
  };

  const getDayOfWeekNameForDate = (dateString: string) => {
    const parts = dateString.split('-');
    if (parts.length !== 3) return "Lunedì";
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return mapDayIndexToName(d.getDay());
  };

  const fetchCalendarData = async () => {
    try {
      const getJSON = (url: string) => fetch(url).then(r => r.json());
      const [lez, cli, pres] = await Promise.all([
        getJSON('/api/lezioni'),
        getJSON('/api/clienti'),
        getJSON('/api/presenze')
      ]);

      setLezioni(lez);
      setClienti(cli);
      setPresenze(pres);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCalendarData();
    // Default focus calendar views to June 2026 on first load, or dynamic fallback in case:
    const today = new Date();
    const isMock = today.getFullYear() === 2026 || (today.getFullYear() === 2026 && today.getMonth() === 5);
    if (!isMock) {
      setCurrentYear(today.getFullYear());
      setCurrentMonthIndex(today.getMonth());
      const fmt = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      setSelectedDate(fmt);
    }
  }, []);

  const triggerNotify = (text: string) => {
    setNotify(text);
    setTimeout(() => setNotify(null), 3000);
  };

  // Add Lesson Function
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitolo || !newIstruttore) return;

    try {
      const response = await fetch('/api/lezioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titolo: newTitolo.trim(),
          istruttore: newIstruttore.trim(),
          giorno_settimana: newGiorno,
          orario: newOrario,
          posti_disponibili: Number(newPosti),
          durata: newDurata
        })
      });

      if (!response.ok) throw new Error("Errore inserimento lezione");
      const saved = await response.json();
      
      setLezioni([...lezioni, saved]);
      setNewTitolo('');
      setNewIstruttore('');
      setNewGiorno('Lunedì');
      setNewOrario('18:00');
      setNewPosti('15');
      setNewDurata('1 ora');
      setShowAddClassModal(false);
      triggerNotify("Nuova lezione programmata con successo!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Add Attendance Presence inside the inspected class details
  const handleRegisterAttendance = async (lezioneId: string, customDate?: string) => {
    if (!registerClienteId) return;

    const dateToUse = customDate || new Date().toISOString().substring(0, 10);
    const targetL = lezioni.find(l => l.id === lezioneId)!;
    const sameClassPresOnDate = presenze.filter(p => p.lezione_id === lezioneId && p.data_presenza === dateToUse);
    
    if (sameClassPresOnDate.length >= targetL.posti_disponibili) {
      alert(`ATTENZIONE: Posti esauriti per questa lezione! Impossibile superare la soglia del limite configurato di ${targetL.posti_disponibili} posti.`);
      return;
    }

    // Has user already registered on this date for this lesson?
    const alreadyRegistered = presenze.some(p => p.cliente_id === registerClienteId && p.lezione_id === lezioneId && p.data_presenza === dateToUse);
    
    if (alreadyRegistered) {
      alert("L'atleta selezionato ha già firmato la sua presenza per questa attività in questa data.");
      return;
    }

    try {
      const response = await fetch('/api/presenze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: registerClienteId,
          lezione_id: lezioneId,
          data_presenza: dateToUse
        })
      });

      if (!response.ok) throw new Error("Errore nel salvataggio della firma");
      const saved = await response.json();
      
      setPresenze([...presenze, saved]);
      setRegisterClienteId('');
      triggerNotify("Presenza e firma registrate correttamente!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Attendance Sign-in
  const handleDeleteAttendance = async (id: string) => {
    try {
      const response = await fetch(`/api/presenze/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Errore durante l'eliminazione");
      
      setPresenze(presenze.filter(p => p.id !== id));
      triggerNotify("Firma presenza rimossa.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete entire structured lesson
  const handleDeleteLezione = async (lezId: string, title: string) => {
    if (!window.confirm(`Eliminando l'attività "${title}" eliminerai l'attività settimanale e tutte le firme associate a questa lezione. \n\nVuoi procedere?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/lezioni/${lezId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Errore di eliminazione");

      setLezioni(lezioni.filter(l => l.id !== lezId));
      setSelectedLezioneId(null);
      triggerNotify("Attività rimossa dal calendario.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Helpers
  const getLezioniForDay = (day: string) => lezioni.filter(l => l.giorno_settimana === day).sort((a,b) => a.orario.localeCompare(b.orario));

  // Monthly logic
  const firstDayDate = new Date(currentYear, currentMonthIndex, 1);
  const firstDayIndex = firstDayDate.getDay(); // 0 is Sunday, 1 is Monday ...
  const initialOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();

  return (
    <div id="calendario-modulo" className="space-y-6">
      
      {notify && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-[#113f3d] text-white font-bold rounded-2xl shadow-xl border border-teal-850 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-5 h-5 text-[#84e062]" />
          <span>{notify}</span>
        </div>
      )}

      {/* Main Bar Custom Header Button & Tab Switcher */}
      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-[#113f3d] uppercase tracking-wide">Orario & Calendario</h3>
          <p className="text-xs text-slate-500 mt-0.5">Gestisci le attività e controlla l'affluenza dello studio.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Custom Toggle Switcher for Monthly vs Weekly */}
          <div className="bg-slate-100/80 p-1 rounded-xl flex items-center border border-slate-200/50">
            <button
              onClick={() => {
                setViewMode('mensile');
                setSelectedLezioneId(null);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'mensile' 
                  ? 'bg-white text-[#113f3d] shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Calendario Mensile
            </button>
            <button
              onClick={() => {
                setViewMode('settimanale');
                setSelectedLezioneId(null);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'settimanale' 
                  ? 'bg-white text-[#113f3d] shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Palinsesto Settimanale
            </button>
          </div>

          <button
            onClick={() => setShowAddClassModal(true)}
            className="px-5 py-2.5 bg-[#113f3d] hover:bg-teal-900 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer ml-auto md:ml-0"
          >
            <Plus className="w-4 h-4" /> Crea Nuova Lezione
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'mensile' ? (
          <motion.div
            key="mensile"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* LEFT AREA: INTERACTIVE MONTHLY GRID BOX */}
            <div className="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h4 className="text-sm font-black text-[#113f3d] uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[#84e062]" /> Naviga Mese
                    </h4>
                    <p className="text-[11px] text-slate-400">Seleziona manualmente mese o anno per sfogliare il palinsesto associati.</p>
                  </div>

                  {/* Month & Year Select Dropdowns */}
                  <div className="flex gap-2 w-full sm:w-auto">
                    <select
                      value={currentMonthIndex}
                      onChange={(e) => {
                        setCurrentMonthIndex(Number(e.target.value));
                        // Automatically update selectedDate to first of newly chosen month
                        const paddedM = String(Number(e.target.value) + 1).padStart(2, '0');
                        setSelectedDate(`${currentYear}-${paddedM}-01`);
                        setSelectedLezioneId(null);
                      }}
                      className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#113f3d]"
                    >
                      {monthsList.map((m, idx) => (
                        <option key={idx} value={idx}>{m}</option>
                      ))}
                    </select>

                    <select
                      value={currentYear}
                      onChange={(e) => {
                        setCurrentYear(Number(e.target.value));
                        const paddedM = String(currentMonthIndex + 1).padStart(2, '0');
                        setSelectedDate(`${Number(e.target.value)}-${paddedM}-01`);
                        setSelectedLezioneId(null);
                      }}
                      className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#113f3d]"
                    >
                      {yearsList.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Calendar Days Table Header */}
                <div className="grid grid-cols-7 gap-2 pb-2">
                  {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(d => (
                    <div key={d} className="text-center py-2 text-[10px] uppercase font-black tracking-widest text-slate-400 font-mono">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Days Cells Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Placeholders for padding before 1st of month */}
                  {Array.from({ length: initialOffset }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="min-h-[4rem] rounded-2xl bg-slate-50/20 border border-transparent select-none" />
                  ))}

                  {/* Active Month Days */}
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const paddedM = String(currentMonthIndex + 1).padStart(2, '0');
                    const paddedD = String(dayNum).padStart(2, '0');
                    const currentCellDateStr = `${currentYear}-${paddedM}-${paddedD}`;

                    const isSelected = selectedDate === currentCellDateStr;
                    const isToday = new Date().toISOString().substring(0, 10) === currentCellDateStr;
                    
                    // Determine the name of day in Italian to filter recurring activities
                    const weekdayEnumIndex = new Date(currentYear, currentMonthIndex, dayNum).getDay();
                    const weekdayName = mapDayIndexToName(weekdayEnumIndex);
                    
                    const dayClassesCount = lezioni.filter(l => l.giorno_settimana.toLowerCase() === weekdayName.toLowerCase()).length;

                    return (
                      <button
                        key={`day-${dayNum}`}
                        onClick={() => {
                          setSelectedDate(currentCellDateStr);
                          setSelectedLezioneId(null); // Reset detail panel first
                        }}
                        className={`p-2.5 min-h-[4.5rem] rounded-2xl border flex flex-col justify-between text-left transition-all relative hover:scale-[1.01] ${
                          isSelected
                            ? 'bg-[#113f3d] text-white border-[#113f3d] shadow-lg shadow-teal-900/15 font-sans'
                            : isToday
                            ? 'bg-emerald-50 border-emerald-250 text-emerald-950 font-black ring-1 ring-emerald-500/10'
                            : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100 text-slate-750'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-black tracking-tight">{dayNum}</span>
                          {isToday && !isSelected && (
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" title="Oggi" />
                          )}
                        </div>

                        {/* Activities scheduled count */}
                        {dayClassesCount > 0 ? (
                          <div className={`mt-2 w-full text-[8px] font-black tracking-wide font-mono px-1.5 py-0.5 rounded text-center truncate uppercase ${
                            isSelected ? 'bg-white/10 text-[#84e062]' : 'bg-[#113f3d]/10 text-[#113f3d]'
                          }`}>
                            {dayClassesCount} {dayClassesCount === 1 ? 'Corso' : 'Corsi'}
                          </div>
                        ) : (
                          <span className="text-[8px] text-slate-300 italic block mt-2 text-center select-none">—</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid Legend matching mockup standards */}
              <div className="mt-8 pt-4 border-t border-slate-50 flex flex-wrap items-center gap-6 justify-start text-[10px] text-slate-400 font-bold font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Oggi
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#113f3d]" /> Giorno Attivo/Selezionato
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-[#113f3d]/10 text-[#113f3d]">1 Corso</span> Corso pianificato nel giorno della settimana
                </span>
              </div>
            </div>

            {/* RIGHT AREA: DETAIL VIEWS AND PARTICIPANT SIGN-INS FOR SELECT DATE */}
            <div className="space-y-6">
              
              {/* Day's Activities list card block */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
                <div className="pb-3 border-b border-zinc-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold font-mono tracking-widest text-[#84e062] bg-[#113f3d] px-2.5 py-1 rounded-full uppercase">
                      {getDayOfWeekNameForDate(selectedDate)}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      {selectedDate.split('-').reverse().join('/')}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mt-2.5">Attività Disponibili</h3>
                  <p className="text-[11px] text-slate-400">Seleziona una lezione qui sotto per vedere i partecipanti o registrarne di nuovi in questa data.</p>
                </div>

                <div className="space-y-3 max-h-[22rem] overflow-y-auto pr-1">
                  {(() => {
                    const currentWeekday = getDayOfWeekNameForDate(selectedDate);
                    const targetedLessons = lezioni.filter(l => l.giorno_settimana.toLowerCase() === currentWeekday.toLowerCase());

                    if (targetedLessons.length === 0) {
                      return (
                        <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-150">
                          Nessuna lezione fissa programmata per {currentWeekday} nel palinsesto.
                        </div>
                      );
                    }

                    return targetedLessons.map((l) => {
                      const classDatePresences = presenze.filter(p => p.lezione_id === l.id && p.data_presenza === selectedDate);
                      const isPanelActive = selectedLezioneId === l.id;
                      const positionsLeft = l.posti_disponibili - classDatePresences.length;

                      return (
                        <div
                          key={l.id}
                          onClick={() => setSelectedLezioneId(l.id)}
                          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer group ${
                            isPanelActive 
                              ? 'bg-teal-50/70 border-[#113f3d] ring-1 ring-[#113f3d]' 
                              : 'bg-slate-50/50 border-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1 pr-2">
                              <h4 className="font-extrabold text-slate-900 text-xs truncate group-hover:text-teal-950">
                                {l.titolo}
                              </h4>
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">Istruttore: {l.istruttore}</p>
                            </div>
                            <span className="text-[9px] font-mono font-bold bg-[#84e062]/10 text-teal-900 px-1.5 py-0.5 rounded shrink-0">
                              Capienza: {l.posti_disponibili}
                            </span>
                          </div>

                          {/* Clock icon, schedule, and duration */}
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mt-2 font-bold flex-wrap">
                            <span className="flex items-center gap-1 text-slate-500">
                              <Clock className="w-3.5 h-3.5" /> {l.orario}
                            </span>
                            <span className="bg-slate-100 text-slate-650 px-1.5 py-0.5 rounded text-[9px] font-sans">
                              {l.durata || "1 ora"}
                            </span>
                          </div>

                          {/* Occupancy state bar */}
                          <div className="mt-3.5 space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-mono font-semibold text-slate-400">
                              <span>Saturazione:</span>
                              <span className="font-bold text-slate-700">{classDatePresences.length} / {l.posti_disponibili} Iscritti</span>
                            </div>
                            <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-teal-900 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, (classDatePresences.length / l.posti_disponibili) * 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Trigger feedback select */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100/70 flex justify-between items-center text-[10px] font-bold font-mono">
                            <span className={positionsLeft > 0 ? 'text-emerald-600' : 'text-rose-500'}>
                              {positionsLeft > 0 ? `${positionsLeft} posti liberi` : 'Lezione esaurita'}
                            </span>
                            <span className="text-[#113f3d] group-hover:translate-x-1 transition-all flex items-center gap-0.5">
                              Sfoglia Firme <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Dynamic details drawer/card for Selected Lesson on Selected Date */}
              {selectedLezioneId && (() => {
                const activeLez = lezioni.find(l => l.id === selectedLezioneId);
                if (!activeLez) return null;

                const onDayPresences = presenze
                  .filter(p => p.lezione_id === activeLez.id && p.data_presenza === selectedDate)
                  .map(p => {
                    const matchedC = clienti.find(c => c.id === p.cliente_id);
                    return {
                      ...p,
                      clienteName: matchedC ? `${matchedC.nome} ${matchedC.cognome}` : `Sconosciuto (ID: ${p.cliente_id.substring(0,6)})`
                    };
                  });

                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2 py-0.5 bg-slate-105 text-[#113f3d] rounded text-[9px] font-mono font-bold uppercase">
                          Dettaglio Partecipanti
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900 mt-1">{activeLez.titolo}</h3>
                        <p className="text-[10px] text-slate-400 font-semibold font-mono">{selectedDate} dalle {activeLez.orario} (durata {activeLez.durata || "1 ora"})</p>
                      </div>

                      <button 
                        onClick={() => setSelectedLezioneId(null)}
                        className="p-1 px-2 border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer text-[10px] font-mono font-bold"
                      >
                        CHIUDI
                      </button>
                    </div>

                    {/* dropdown registration selector */}
                    <div className="space-y-2 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <label className="text-[10px] uppercase font-bold text-slate-500 block">Registra Presenza Atleta per questa data:</label>
                      <div className="space-y-2">
                        <select
                          value={registerClienteId}
                          onChange={(e) => setRegisterClienteId(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#113f3d]"
                        >
                          <option value="">-- Seleziona Atleta --</option>
                          {clienti.map(c => (
                            <option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleRegisterAttendance(activeLez.id, selectedDate)}
                          disabled={!registerClienteId}
                          className="w-full py-2.5 bg-[#113f3d] hover:bg-teal-900 transition-colors disabled:opacity-45 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-sm"
                        >
                          Firma Presenza ({selectedDate})
                        </button>
                      </div>
                    </div>

                    {/* Table-list of checked-in clients */}
                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                        <span>FIRME REGISTRATE DI QUESTO GIORNO</span>
                        <span>{onDayPresences.length} Atleti</span>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {onDayPresences.map((p) => (
                          <div key={p.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100/75 flex items-center justify-between text-xs hover:border-slate-300 shadow-sm transition-all text-slate-750">
                            <div>
                              <span className="font-bold text-slate-800 block">{p.clienteName}</span>
                              <span className="text-[9px] text-slate-400 font-mono">Firmata il {selectedDate}</span>
                            </div>

                            <button
                              onClick={() => handleDeleteAttendance(p.id)}
                              className="p-1 px-1.5 bg-white text-slate-400 hover:text-rose-600 border border-slate-100 rounded-lg hover:border-rose-100 transition-all cursor-pointer shrink-0"
                              title="Cancella firma"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        {onDayPresences.length === 0 && (
                          <div className="p-6 text-center text-slate-400 text-xs bg-[#fdfefe] border border-dashed rounded-xl border-zinc-200 italic">
                            Nessun atleta ha ancora firmato la sua presenza per questa attività il {selectedDate}.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleDeleteLezione(activeLez.id, activeLez.titolo)}
                        className="text-xs text-rose-500 hover:text-rose-700 font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" /> Rimuovi definitivamente corso fiso
                      </button>
                    </div>
                  </motion.div>
                );
              })()}

            </div>
          </motion.div>
        ) : (
          /* WEEKLY PALINSESTO GRID VIEW LAYOUT (Classic original design) */
          <motion.div
            key="settimanale"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4"
          >
            {daysOfWeek.map((day) => {
              const dayLessons = getLezioniForDay(day);
              return (
                <div key={day} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-[26rem] h-auto pb-4">
                  <h4 className="text-xs font-extrabold text-[#113f3d] border-b border-slate-100 pb-2.5 text-center tracking-widest uppercase mb-3">
                    {day}
                  </h4>

                  <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                    {dayLessons.map((l) => {
                      const todayStr = new Date().toISOString().substring(0,10);
                      const iscrittiContatiToday = presenze.filter(p => p.lezione_id === l.id && p.data_presenza === todayStr).length;

                      return (
                        <div
                          key={l.id}
                          onClick={() => {
                            setSelectedLezioneId(l.id);
                            // Focus date string to today for backward-compatibility signatures
                            setSelectedDate(todayStr);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer group ${
                            selectedLezioneId === l.id 
                              ? 'bg-teal-50/55 border-[#113f3d] ring-1 ring-[#113f3d]' 
                              : 'bg-slate-50/60 border-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <span className="font-extrabold text-slate-900 text-xs block truncate leading-tight group-hover:text-teal-950">
                            {l.titolo}
                          </span>
                          
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-1.5 font-bold flex-wrap">
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3 text-slate-400" /> {l.orario}
                            </span>
                            <span className="bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[8px] font-sans">
                              {l.durata || "1 ora"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-sans mt-0.5 font-semibold">
                            <User className="w-3 h-3 text-slate-300" /> {l.istruttore}
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-mono">
                            <span className="bg-[#84e062]/10 text-teal-980 font-bold px-1.5 py-0.5 rounded">
                              Max: {l.posti_disponibili}
                            </span>
                            
                            <span className="text-slate-500 font-bold">
                              {iscrittiContatiToday} / {l.posti_disponibili} Presenti Oggi
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {dayLessons.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic text-center py-16">Nessuna attività</p>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* RENDER VIEW DETAILS PANEL ON SELECTION FOR WEEKLY VIEW ALONE AS FALLBACK UNDER-PANEL */}
      {viewMode === 'settimanale' && selectedLezioneId && (() => {
        const matchedL = lezioni.find(l => l.id === selectedLezioneId);
        if (!matchedL) return null;

        const todayStr = new Date().toISOString().substring(0, 10);
        
        // Presences registered for this class in data today
        const classTodayPresences = presenze
          .filter(p => p.lezione_id === matchedL.id && p.data_presenza === todayStr)
          .map(p => {
            const cli = clienti.find(c => c.id === p.cliente_id);
            return {
              ...p,
              clienteName: cli ? `${cli.nome} ${cli.cognome}` : 'Sconosciuto'
            };
          });

        const remainingSeats = matchedL.posti_disponibili - classTodayPresences.length;

        return (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8 relative mt-6"
          >
            <button 
              onClick={() => setSelectedLezioneId(null)}
              className="absolute top-4 right-4 p-2 bg-slate-105 hover:bg-slate-200 rounded-full transition-all cursor-pointer"
              title="Chiudi pannello"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>

            {/* Day stats */}
            <div className="space-y-5">
              <div>
                <span className="px-3 py-1 bg-[#113f3d] text-white rounded-full font-bold text-[9px] font-mono uppercase tracking-wider">
                  {matchedL.giorno_settimana} alle ore {matchedL.orario} (durata {matchedL.durata || "1 ora"})
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 font-sans mt-2">{matchedL.titolo}</h3>
                <p className="text-slate-500 text-xs mt-0.5">Istruttore incaricato: <strong className="text-slate-800 font-bold">{matchedL.istruttore}</strong></p>
              </div>

              {/* Seats progress matching mockup */}
              <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">AFFLUENZA ODIERNA ({todayStr})</span>
                  <span className="font-bold font-sans text-slate-900">{classTodayPresences.length} / {matchedL.posti_disponibili} Posti</span>
                </div>

                {/* Horizontal Bar */}
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-teal-900 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (classTodayPresences.length / matchedL.posti_disponibili) * 100)}%` }}
                  />
                </div>

                <p className="text-[10px] text-slate-500 font-mono">
                  {remainingSeats > 0 ? `Ci sono ancora ${remainingSeats} posti utilizzabili.` : "ATTENZIONE: Massima capienza dello studio raggiunta!"}
                </p>
              </div>

              {/* Block Register Presence today dropdown */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">Registra Firma Presenza di Oggi:</label>
                
                <div className="flex gap-2">
                  <select
                    value={registerClienteId}
                    onChange={(e) => setRegisterClienteId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#113f3d]"
                  >
                    <option value="">-- Seleziona Atleta --</option>
                    {clienti.map(c => (
                      <option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>
                    ))}
                  </select>
                  
                  <button
                    onClick={() => handleRegisterAttendance(matchedL.id, todayStr)}
                    disabled={!registerClienteId}
                    className="px-4 py-2 bg-[#113f3d] hover:bg-teal-900 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-45"
                  >
                    Registra Firma
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleDeleteLezione(matchedL.id, matchedL.titolo)}
                  className="text-xs text-rose-500 hover:text-rose-700 font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Elimina attività dal palinsesto
                </button>
              </div>
            </div>

            {/* Checked-in Athletes table list */}
            <div className="space-y-3 bg-slate-55 rounded-2xl p-4 border border-slate-100">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase">
                <Users className="w-4 h-4 text-[#84e062]" /> Presenze Firmate Oggi ({classTodayPresences.length})
              </h4>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {classTodayPresences.length > 0 ? (
                  classTodayPresences.map((p) => (
                    <div key={p.id} className="p-2.5 bg-white rounded-xl flex items-center justify-between text-xs shadow-sm border border-slate-50">
                      <div>
                        <span className="font-bold text-slate-800">{p.clienteName}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">ID Firma: {p.id}</span>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteAttendance(p.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Cancella presenza"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs italic bg-white border border-dashed rounded-xl border-slate-200 text-slate-750">
                    Nessun atleta ha ancora registrato la firma di presenza oggi per questa lezione.
                  </div>
                )}
              </div>
            </div>

          </motion.div>
        );
      })()}

      {/* MODAL FOR CREATING NEW RECURRING CLASS WEEKLY WITH DURATA */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden border border-slate-100 shadow-2xl"
          >
            <div className="bg-[#113f3d] p-6 text-white text-center">
              <h3 className="font-extrabold text-lg">Programma Nuova Attività</h3>
              <p className="text-teal-205 text-xs">Pianifica un corso fiso nel calendario</p>
            </div>

            <form onSubmit={handleAddClass} className="p-6 space-y-4 text-xs font-semibold text-slate-705">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Titolo Lezione *</label>
                <input
                  type="text"
                  required
                  placeholder="es. Yoga Vinyasa, Pilates Dolce..."
                  value={newTitolo}
                  onChange={(e) => setNewTitolo(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nome Istruttore *</label>
                <input
                  type="text"
                  required
                  placeholder="Elena Sofia, Marco..."
                  value={newIstruttore}
                  onChange={(e) => setNewIstruttore(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Giorno Settimana *</label>
                  <select
                    required
                    value={newGiorno}
                    onChange={(e) => setNewGiorno(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    {daysOfWeek.map((d, index) => (
                      <option key={index} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Orario Inizio *</label>
                  <input
                    type="text"
                    required
                    placeholder="18:30"
                    value={newOrario}
                    onChange={(e) => setNewOrario(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Capienza (Posti) *</label>
                  <input
                    type="number"
                    required
                    value={newPosti}
                    onChange={(e) => setNewPosti(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Durata Attività *</label>
                  <select
                    value={newDurata}
                    onChange={(e) => setNewDurata(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="45 min">45 Minuti</option>
                    <option value="1 ora">1 Ora</option>
                    <option value="1.5 ore">1.5 Ore</option>
                    <option value="2 ore">2 Ore</option>
                    <option value="2.5 ore">2.5 Ore</option>
                    <option value="3 ore">3 Ore o più</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl font-bold cursor-pointer text-center"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#113f3d] hover:bg-teal-900 text-white rounded-xl font-bold cursor-pointer text-center text-xs"
                >
                  Crea Attività
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
