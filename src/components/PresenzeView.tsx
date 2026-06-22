/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Presenza, Cliente, Lezione } from '../types.js';
import { 
  History, Calendar, Filter, Users, ShieldAlert, ArrowDownToLine, 
  HelpCircle, Trash2, Search, Sparkles, UserCheck, PlusCircle
} from 'lucide-react';
import { motion } from 'motion/react';

export default function PresenzeView() {
  const [presenze, setPresenze] = useState<Presenza[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [lezioni, setLezioni] = useState<Lezione[]>([]);

  // New presence creation states
  const [newClienteId, setNewClienteId] = useState('');
  const [newLezioneId, setNewLezioneId] = useState('');
  const [newDataPresenza, setNewDataPresenza] = useState(new Date().toISOString().substring(0, 10));
  const [registroSuccess, setRegistroSuccess] = useState('');
  const [registroError, setRegistroError] = useState('');

  // Filter keys
  const [selectedLezioneId, setSelectedLezioneId] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Search inside tables
  const [search, setSearch] = useState('');

  const [allInactiveClients, setAllInactiveClients] = useState<{ cliente: Cliente; lastDate: string | null; daysAbsent: number }[]>([]);

  const fetchPresenzeData = async () => {
    try {
      const getJSON = (url: string) => fetch(url).then(r => r.json());
      const [pres, cli, lez] = await Promise.all([
        getJSON('/api/presenze'),
        getJSON('/api/clienti'),
        getJSON('/api/lezioni')
      ]);

      setPresenze(pres);
      setClienti(cli);
      setLezioni(lez);

      // Calculate inactive clients (> 21 days absent)
      const todayStr = new Date().toISOString().substring(0, 10);
      const todayVal = new Date(todayStr).getTime();
      const twentyOneDaysAgo = todayVal - 21 * 24 * 60 * 60 * 1000;

      const inactiveList: any[] = [];
      
      cli.forEach((c: Cliente) => {
        const cliPresences = pres.filter((p: Presenza) => p.cliente_id === c.id);
        
        if (cliPresences.length === 0) {
          // calculate from creation date
          const createdVal = new Date(c.creato_il).getTime();
          if (createdVal < twentyOneDaysAgo) {
            const diffDays = Math.floor((todayVal - createdVal) / (24 * 60 * 60 * 1000));
            inactiveList.push({ cliente: c, lastDate: null, daysAbsent: diffDays });
          }
        } else {
          const lastPresenceDateVal = Math.max(...cliPresences.map((p: Presenza) => new Date(p.data_presenza).getTime()));
          if (lastPresenceDateVal < twentyOneDaysAgo) {
            const diffDays = Math.floor((todayVal - lastPresenceDateVal) / (24 * 60 * 60 * 1000));
            inactiveList.push({ 
              cliente: c, 
              lastDate: new Date(lastPresenceDateVal).toISOString().substring(0, 10), 
              daysAbsent: diffDays 
            });
          }
        }
      });
      // Sort inactive clients by longest absent days descending
      inactiveList.sort((a, b) => b.daysAbsent - a.daysAbsent);
      setAllInactiveClients(inactiveList);

    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPresenzeData();
  }, []);

  // Quick direct presence registration
  const handleCreatePresence = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistroSuccess('');
    setRegistroError('');

    if (!newClienteId) {
      setRegistroError("Seleziona un atleta.");
      return;
    }
    if (!newLezioneId) {
      setRegistroError("Seleziona un'attività/lezione.");
      return;
    }
    if (!newDataPresenza) {
      setRegistroError("Seleziona la data della presenza.");
      return;
    }

    // Check for duplicate presence recorded in state
    const alreadyRegistered = presenze.some(
      p => p.cliente_id === newClienteId && 
           p.lezione_id === newLezioneId && 
           p.data_presenza === newDataPresenza
    );
    if (alreadyRegistered) {
      setRegistroError("L'atleta selezionato ha già firmato la sua presenza per questa attività in questa data.");
      return;
    }

    try {
      const response = await fetch('/api/presenze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: newClienteId,
          lezione_id: newLezioneId,
          data_presenza: newDataPresenza
        })
      });

      if (!response.ok) {
        throw new Error("Errore durante il salvataggio della firma.");
      }

      const saved = await response.json();
      setPresenze([saved, ...presenze]);
      setNewClienteId('');
      setNewLezioneId('');
      setRegistroSuccess("Presenza firmata con successo!");
      
      // Refresh calculations and data
      fetchPresenzeData();
      
      // Auto clear success message
      setTimeout(() => setRegistroSuccess(''), 4000);
    } catch (err: any) {
      setRegistroError(err.message || "Errore di connessione.");
    }
  };

  // Delete presence log
  const handleDeletePresence = async (id: string) => {
    if (!window.confirm("Sei sicuro di voler eliminare questa firma di presenza storicizzata?")) {
      return;
    }

    try {
      const res = await fetch(`/api/presenze/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Errore rimozione");

      setPresenze(presenze.filter(p => p.id !== id));
      fetchPresenzeData(); // Recompute inactive lists
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Export Presenze directly to CSV (fully client-side downloaded!)
  const handleExportCSV = () => {
    try {
      if (presenze.length === 0) return;

      // Compile content arrays
      const headers = ['ID_Firma', 'Cognome_Cliente', 'Nome_Cliente', 'Titolo_Lezione', 'Giorno_Pianificato', 'Data_Presenza'];
      const rows = filteredPresenzeLogs.map((p) => {
        const cli = clienti.find(c => c.id === p.cliente_id);
        const lez = lezioni.find(l => l.id === p.lezione_id);
        return [
          p.id,
          cli ? cli.cognome : 'Sconosciuto',
          cli ? cli.nome : 'Sconosciuto',
          lez ? lez.titolo : 'Attività Rimossa',
          lez ? lez.giorno_settimana : 'N/A',
          p.data_presenza
        ];
      });

      // Construct CSV content string
      const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
      
      // Blob and Download click link trigger
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Export_Presenze_Gestionale_Palestra_${new Date().toISOString().substring(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Errore nell'export");
    }
  };

  // Compile full table data format
  const mappedPresenze = presenze.map((p) => {
    const cli = clienti.find(c => c.id === p.cliente_id);
    const lez = lezioni.find(l => l.id === p.lezione_id);
    return {
      ...p,
      cliente: cli,
      lezione: lez
    };
  });

  // Filter inputs
  const filteredPresenzeLogs = mappedPresenze.filter((p) => {
    const matchesLezione = !selectedLezioneId || p.lezione_id === selectedLezioneId;
    const matchesDate = !filterDate || p.data_presenza === filterDate;
    
    const clientName = p.cliente ? `${p.cliente.nome} ${p.cliente.cognome}`.toLowerCase() : '';
    const lezHeading = p.lezione ? p.lezione.titolo.toLowerCase() : '';
    const searchTerm = search.toLowerCase().trim();
    
    const matchesSearch = clientName.includes(searchTerm) || lezHeading.includes(searchTerm);

    return matchesLezione && matchesDate && matchesSearch;
  });

  return (
    <div id="presenze-module" className="space-y-6">
      
      {/* 2-Grid Content columns: Active logs & Inactive highlighted */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 span): Presences list with filtering */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase">
                <History className="w-5 h-5 text-[#113f3d]" /> Registro Storico Firme presenze ({filteredPresenzeLogs.length})
              </h3>

              {filteredPresenzeLogs.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-205 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer font-mono"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" /> Esporta CSV
                </button>
              )}
            </div>

            {/* Filter selectors grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Lezione Filter */}
              <div>
                <select
                  value={selectedLezioneId}
                  onChange={(e) => setSelectedLezioneId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#113f3d]"
                >
                  <option value="">-- Qualunque Lezione --</option>
                  {lezioni.map(l => (
                    <option key={l.id} value={l.id}>{l.titolo} ({l.giorno_settimana})</option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono"
                />
              </div>

              {/* Text Search inside grid list */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cerca per nome atleta..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#113f3d]"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* Table index representing matching presences logs */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="p-4 pl-6">ATLETA</th>
                    <th className="p-4">ATTIVITÀ SVOLTA</th>
                    <th className="p-4">GIORNO SETT.</th>
                    <th className="p-4 text-center">DATA REGISTRAZIONE</th>
                    <th className="p-4 pr-6 text-right">REVOCA</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPresenzeLogs.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      {/* Athlete name */}
                      <td className="p-4 pl-6">
                        <span className="font-bold text-slate-900 block text-sm">
                          {p.cliente ? `${p.cliente.nome} ${p.cliente.cognome}` : 'Atleta Sconosciuto'}
                        </span>
                        {p.cliente?.email && (
                          <span className="text-[10px] text-slate-400 font-mono italic">{p.cliente.email}</span>
                        )}
                      </td>

                      {/* Course */}
                      <td className="p-4 font-semibold text-slate-700">
                        {p.lezione ? p.lezione.titolo : <span className="text-slate-400 italic">Corso eliminato</span>}
                      </td>

                      {/* Lesson Scheduled Day */}
                      <td className="p-4 font-mono text-slate-500">
                        {p.lezione ? p.lezione.giorno_settimana : 'N/A'} {p.lezione ? `alle ${p.lezione.orario}` : ''}
                      </td>

                      {/* Target Presence date */}
                      <td className="p-4 text-center font-mono font-bold text-slate-800">
                        {new Date(p.data_presenza).toLocaleDateString('it-IT')}
                      </td>

                      {/* Revoke */}
                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => handleDeletePresence(p.id)}
                          className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 font-semibold text-[10px] rounded-lg transition-colors cursor-pointer"
                        >
                          Revoca Firma
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredPresenzeLogs.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                Nessuna firma di presenza corrisponde ai criteri inseriti. Registrane una nuova usando il modulo a destra oppure nel "Calendario".
              </div>
            )}
          </div>

        </div>

        {/* Right Column (1 span): Quick input and Inactive clients highlight column */}
        <div className="space-y-6">
          
          {/* NEW QUICK PRESENCE REGISTRATION FORM */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-[#113f3d] text-sm flex items-center gap-1.5 uppercase">
                <UserCheck className="w-5 h-5 text-teal-600" /> Registra Nuova Presenza
              </h3>
              <p className="text-slate-400 text-[11px] mt-0.5">Aggiungi rapidamente una firma o una presenza d'atleta senza passare dal calendario.</p>
            </div>

            <form onSubmit={handleCreatePresence} className="space-y-3">
              {/* Form Status notifications */}
              {registroSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-[11px] font-semibold">
                  ✓ {registroSuccess}
                </div>
              )}
              {registroError && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-[11px] font-semibold">
                  ⚠️ {registroError}
                </div>
              )}

              {/* Atleta Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Seleziona Atleta</label>
                <select
                  value={newClienteId}
                  onChange={(e) => setNewClienteId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#113f3d] text-slate-800"
                >
                  <option value="">-- Seleziona Atleta --</option>
                  {clienti.slice().sort((a,b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`)).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.cognome.toUpperCase()} {c.nome} {c.codice_fiscale ? `(${c.codice_fiscale})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Attività Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Attività o Corso</label>
                <select
                  value={newLezioneId}
                  onChange={(e) => setNewLezioneId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#113f3d] text-slate-800"
                >
                  <option value="">-- Seleziona Attività --</option>
                  {lezioni.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.titolo} ({l.giorno_settimana} - ore {l.orario})
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Presenza Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Presenza</label>
                <input
                  type="date"
                  value={newDataPresenza}
                  onChange={(e) => setNewDataPresenza(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#113f3d] hover:bg-teal-900 text-[#84e062] hover:text-white font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-tight shadow-md shadow-md/5"
              >
                <PlusCircle className="w-4 h-4" /> Registra Presenza
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-[#113f3d] text-sm flex items-center gap-1.5 uppercase">
                <ShieldAlert className="w-5 h-5 text-amber-500 animate-pulse" /> Atleti Inattivi (&gt; 21 gg)
              </h3>
              <p className="text-slate-400 text-[11px] mt-0.5">Membri che non si allenano o frequenza assente da più di 3 settimane.</p>
            </div>

            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {allInactiveClients.length > 0 ? (
                allInactiveClients.map(({ cliente, lastDate, daysAbsent }) => (
                  <div key={cliente.id} className="p-4 bg-orange-50/30 border border-orange-100 rounded-2xl space-y-2 relative overflow-hidden">
                    {/* Visual alert badge */}
                    <span className="absolute top-2 right-2 px-2.5 py-0.5 bg-orange-100 text-orange-850 text-[9px] font-mono font-extrabold rounded-full">
                      {daysAbsent} GG ASSENTE
                    </span>

                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">{cliente.nome} {cliente.cognome}</h4>
                      <p className="text-[10px] text-slate-500">Iscritto: {new Date(cliente.creato_il).toLocaleDateString('it-IT')}</p>
                    </div>

                    <div className="text-[11px] text-slate-650 space-y-1 pt-1.5 border-t border-orange-100/50">
                      {cliente.telefono && <p>📞 {cliente.telefono}</p>}
                      <p className="font-medium text-amber-950 font-sans mt-1">
                        👉 {lastDate ? `Ultima presenza: ${new Date(lastDate).toLocaleDateString('it-IT')}` : "Mai partecipato a lezioni"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-2xl text-xs border border-slate-100">
                  Nessun iscritto si trova in stato inattivo da più di 21 giorni. Ottimo!
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
