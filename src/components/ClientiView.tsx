/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Cliente, Abbonamento, Presenza, Fattura, Impostazioni } from '../types.js';
import { 
  Search, Plus, UserPlus, Phone, Mail, FileText, ChevronRight, Save, Trash2, 
  ArrowLeft, Calendar, History, DollarSign, UserCheck, ShieldAlert, RefreshCw, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateClientStatistics } from '../utils/analytics.js';

interface ClientiViewProps {
  onClientsUpdated: () => void;
}

export default function ClientiView({ onClientsUpdated }: ClientiViewProps) {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [abbonamenti, setAbbonamenti] = useState<Abbonamento[]>([]);
  const [presenze, setPresenze] = useState<Presenza[]>([]);
  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [impostazioni, setImpostazioni] = useState<Impostazioni | null>(null);

  const [search, setSearch] = useState('');
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form Adding State
  const [newNome, setNewNome] = useState('');
  const [newCognome, setNewCognome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTelefono, setNewTelefono] = useState('');
  const [newDataNascita, setNewDataNascita] = useState('');
  const [newNote, setNewNote] = useState('');

  // Editing biographical state when inspecting client
  const [editingNome, setEditingNome] = useState('');
  const [editingCognome, setEditingCognome] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [editingTelefono, setEditingTelefono] = useState('');
  const [editingDataNascita, setEditingDataNascita] = useState('');
  const [editingNote, setEditingNote] = useState('');

  // Quick renew modal states
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewClient, setRenewClient] = useState<Cliente | null>(null);
  const [renewPresetType, setRenewPresetType] = useState('');
  const [renewCustomType, setRenewCustomType] = useState('');
  const [renewStartDate, setRenewStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewAmount, setRenewAmount] = useState('');
  const [renewAmountPaid, setRenewAmountPaid] = useState('');
  const [renewStatoPagamento, setRenewStatoPagamento] = useState<'pagato' | 'da pagare'>('pagato');

  const [notify, setNotify] = useState<string | null>(null);

  const fetchClientiData = async () => {
    try {
      const getJSON = (url: string) => fetch(url).then(r => r.json());
      const [cli, abb, pres, fat, imp] = await Promise.all([
        getJSON('/api/clienti'),
        getJSON('/api/abbonamenti'),
        getJSON('/api/presenze'),
        getJSON('/api/fatture'),
        getJSON('/api/impostazioni')
      ]);
      setClienti(cli);
      setAbbonamenti(abb);
      setPresenze(pres);
      setFatture(fat);
      setImpostazioni(imp);
    } catch (e) {
      console.error("Errore caricamento anagrafiche clienti", e);
    }
  };

  useEffect(() => {
    fetchClientiData();
  }, []);

  const handleOpenQuickRenew = (cli: Cliente) => {
    const clientAbbs = abbonamenti.filter(a => a.cliente_id === cli.id);
    const todayStr = new Date().toISOString().substring(0, 10);
    
    // Check if there is an active subscription
    const activeAbb = clientAbbs.find(a => a.stato === 'attivo');

    let autoStart = todayStr;
    let latestAbb: Abbonamento | null = null;

    if (activeAbb) {
      // Activating an alternative service: starts today, empty presets so they choose a new service
      autoStart = todayStr;
      
      setRenewClient(cli);
      setRenewStartDate(autoStart);
      setRenewEndDate('');
      setRenewPresetType('');
      setRenewCustomType('');
      setRenewAmount('');
      setRenewAmountPaid('');
    } else {
      // Standard renewal path for expired / empty clients
      if (clientAbbs.length > 0) {
        latestAbb = [...clientAbbs].sort((a, b) => b.data_fine.localeCompare(a.data_fine))[0];
        if (latestAbb.data_fine >= todayStr) {
          const d = new Date(latestAbb.data_fine);
          d.setDate(d.getDate() + 1);
          autoStart = d.toISOString().substring(0, 10);
        }
      }

      setRenewClient(cli);
      setRenewStartDate(autoStart);
      setRenewEndDate('');
      
      const matched = impostazioni?.abbonamenti_predefiniti.find(p => p.tipo === (latestAbb ? latestAbb.tipo : ''));
      if (matched) {
        setRenewPresetType(matched.tipo);
        setRenewAmount(String(matched.prezzo));
        setRenewAmountPaid(String(matched.prezzo));
        const sDate = new Date(autoStart);
        sDate.setMonth(sDate.getMonth() + matched.durata_mesi);
        setRenewEndDate(sDate.toISOString().substring(0, 10));
      } else if (latestAbb) {
        setRenewPresetType('custom');
        setRenewCustomType(latestAbb.tipo);
        setRenewAmount(String(latestAbb.importo));
        setRenewAmountPaid(String(latestAbb.importo));
      } else {
        setRenewPresetType('');
        setRenewCustomType('');
        setRenewAmount('');
        setRenewAmountPaid('');
      }
    }
    
    setRenewStatoPagamento('pagato');
    setShowRenewModal(true);
  };

  const handleRenewPresetChange = (presetName: string, startDateVal: string) => {
    setRenewPresetType(presetName);
    if (!impostazioni) return;

    if (presetName === 'custom') {
      setRenewCustomType('');
      setRenewAmount('');
      setRenewAmountPaid('');
      setRenewEndDate('');
      return;
    }

    const matched = impostazioni.abbonamenti_predefiniti.find(p => p.tipo === presetName);
    if (matched) {
      setRenewAmount(String(matched.prezzo));
      setRenewAmountPaid(String(matched.prezzo));
      
      const sDate = new Date(startDateVal);
      sDate.setMonth(sDate.getMonth() + matched.durata_mesi);
      setRenewEndDate(sDate.toISOString().substring(0, 10));
    }
  };

  const handleRenewStartDateChange = (startDateVal: string) => {
    setRenewStartDate(startDateVal);
    if (!impostazioni || !renewPresetType || renewPresetType === 'custom') return;

    const matched = impostazioni.abbonamenti_predefiniti.find(p => p.tipo === renewPresetType);
    if (matched) {
      const sDate = new Date(startDateVal);
      sDate.setMonth(sDate.getMonth() + matched.durata_mesi);
      setRenewEndDate(sDate.toISOString().substring(0, 10));
    }
  };

  const handleQuickRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewClient || !renewEndDate || !renewAmount) return;

    const tipoFinal = renewPresetType === 'custom' ? renewCustomType : renewPresetType;
    if (!tipoFinal) return;

    try {
      const response = await fetch('/api/abbonamenti/con-pagamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: renewClient.id,
          tipo: tipoFinal,
          data_inizio: renewStartDate,
          data_fine: renewEndDate,
          importo: Number(renewAmount),
          importo_pagato: Number(renewAmountPaid !== '' ? renewAmountPaid : renewAmount),
          stato_pagamento: renewStatoPagamento
        })
      });

      if (!response.ok) throw new Error("Errore nel salvataggio");
      
      triggerNotify(`Abbonamento per ${renewClient.nome} rinnovato con successo! Nuova ricevuta emessa.`);
      setShowRenewModal(false);
      fetchClientiData();
      onClientsUpdated();
    } catch (err: any) {
      alert("Errore nel rinnovo: " + err.message);
    }
  };

  const triggerNotify = (text: string) => {
    setNotify(text);
    setTimeout(() => setNotify(null), 3000);
  };

  // Add Cliente Handler
  const handleAddClienteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome || !newCognome) return;

    try {
      const res = await fetch('/api/clienti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: newNome.trim(),
          cognome: newCognome.trim(),
          email: newEmail.trim(),
          telefono: newTelefono.trim(),
          data_nascita: newDataNascita,
          note: newNote.trim()
        })
      });

      if (!res.ok) throw new Error("Registrazione fallita");
      
      const saved = await res.json();
      setClienti([...clienti, saved]);
      
      // Clean up forms
      setNewNome('');
      setNewCognome('');
      setNewEmail('');
      setNewTelefono('');
      setNewDataNascita('');
      setNewNote('');
      setShowAddModal(false);
      triggerNotify("Anagrafica atleta creata con successo!");
      onClientsUpdated();
    } catch (err: any) {
      alert("Errore inserimento: " + err.message);
    }
  };

  // Save changes to examined client biographical data
  const handleSaveBioChanges = async (id: string) => {
    try {
      const res = await fetch(`/api/clienti/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: editingNome,
          cognome: editingCognome,
          email: editingEmail,
          telefono: editingTelefono,
          data_nascita: editingDataNascita,
          note: editingNote
        })
      });

      if (!res.ok) throw new Error("Errore aggiornamento dati");
      const updated = await res.json();
      
      setClienti(clienti.map(c => c.id === id ? updated : c));
      triggerNotify("Dati anagrafici salvati.");
      onClientsUpdated();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteCliente = async (id: string, name: string) => {
    if (!window.confirm(`ATTENZIONE: Eliminando l'atleta ${name} eliminerai permanentemente il suo profilo, tutti i suoi abbonamenti attivi, le sue firme di presenza storiche e le fatture associate. \n\nVuoi procedere? L'azione è irreversibile.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/clienti/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Errore rimozione");

      // Cascading frontend state update to keep UI in immediate synchronization
      setClienti(clienti.filter(c => c.id !== id));
      setAbbonamenti(abbonamenti.filter(a => a.cliente_id !== id));
      setPresenze(presenze.filter(p => p.cliente_id !== id));
      setFatture(fatture.filter(f => f.cliente_id !== id));

      setSelectedClienteId(null);
      triggerNotify("Profilo atleta eliminato con successo.");
      onClientsUpdated();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Inspect customer handler: loads input variables
  const handleViewClientDetails = (cli: Cliente) => {
    setSelectedClienteId(cli.id);
    setEditingNome(cli.nome);
    setEditingCognome(cli.cognome);
    setEditingEmail(cli.email || '');
    setEditingTelefono(cli.telefono || '');
    setEditingDataNascita(cli.data_nascita || '');
    setEditingNote(cli.note || '');
  };

  // Search filter matching nome, cognome, email
  const filteredClienti = clienti.filter(c => {
    const term = search.toLowerCase().trim();
    return c.nome.toLowerCase().includes(term) || 
           c.cognome.toLowerCase().includes(term) || 
           (c.email && c.email.toLowerCase().includes(term));
  });

  // Calculate current examined customer associations
  const getClientRelations = (id: string) => {
    const cliAbbs = abbonamenti.filter(a => a.cliente_id === id);
    const cliPres = presenze.filter(p => p.cliente_id === id);
    const cliFats = fatture.filter(f => f.cliente_id === id);

    const activeAbb = cliAbbs.find(a => a.stato === 'attivo');

    // Get presence count in last 3 weeks (21 days) to see if inactive
    const todayVal = new Date().getTime();
    const twentyOneDaysAgo = todayVal - 21 * 24 * 60 * 60 * 1000;
    const hasRecentPresence = cliPres.some(p => new Date(p.data_presenza).getTime() >= twentyOneDaysAgo);

    return {
      allAbbonamenti: cliAbbs,
      activeAbb,
      allPresenze: cliPres,
      allFatture: cliFats,
      isInactive: cliPres.length > 0 && !hasRecentPresence
    };
  };

  return (
    <div id="clienti-module" className="space-y-6">
      
      {notify && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-teal-900 border border-teal-850 text-white font-bold rounded-2xl shadow-xl flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[#84e062]" />
          <span>{notify}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!selectedClienteId ? (
          
          /* VIEW 1: MASTER LIST VIEW */
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            className="space-y-6"
          >
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="relative w-full sm:max-w-md">
                <input
                  type="text"
                  placeholder="Cerca atleta per nome, cognome o email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] focus:bg-white text-sm"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                className="w-full sm:w-auto px-5 py-3 bg-[#113f3d] hover:bg-teal-900 text-white text-xs font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Aggiungi Nuovo Atleta
              </button>
            </div>

            {/* Clients Index Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClienti.map((c) => {
                const relations = getClientRelations(c.id);
                return (
                  <motion.div
                    key={c.id}
                    layoutId={`cli_card_${c.id}`}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => handleViewClientDetails(c)}
                    className="bg-white p-5 rounded-[2rem] border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[14rem] h-auto group relative overflow-hidden gap-4"
                  >
                    {relations.isInactive && (
                      <div className="absolute top-0 right-0 bg-amber-500 text-white font-mono text-[9px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1.5 shadow-sm">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> INATTIVO MAI DA 21+ GG
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base leading-tight group-hover:text-teal-900 transition-colors">
                          {c.nome} {c.cognome}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase mt-0.5">ISCRITTO GENERALE</p>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-500 font-medium">
                        {c.telefono && (
                          <p className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {c.telefono}
                          </p>
                        )}
                        {c.email && (
                          <p className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" /> {c.email}
                          </p>
                        )}
                        {c.note && (
                          <p className="flex items-center gap-1.5 font-sans italic line-clamp-1 max-w-[90%]">
                            <FileText className="w-3.5 h-3.5 text-slate-300" /> "{c.note}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                      {/* Active subscription badge display */}
                      {relations.activeAbb ? (
                        <span className="px-3 py-1 bg-[#84e062]/15 text-teal-980 rounded-full font-bold text-[10px] tracking-wide">
                          Abbonamento: {relations.activeAbb.tipo}
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full font-bold text-[10px] tracking-wide">
                          Nessun pacchetto attivo
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCliente(c.id, `${c.nome} ${c.cognome}`);
                          }}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                          title="Elimina Atleta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-[#113f3d] group-hover:translate-x-1 duration-200 flex items-center gap-0.5 font-mono">
                          Seleziona <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {filteredClienti.length === 0 && (
              <div className="p-12 text-center bg-white rounded-[2rem] border border-slate-100 text-slate-400">
                Nessun atleta registrato corrisponde al criterio di ricerca "<strong>{search}</strong>".
              </div>
            )}
          </motion.div>
        ) : (
          
          /* VIEW 2: INDIVIDUAL CUSTOMER DETAILS PAGE */
          (() => {
            const inspectedClient = clienti.find(c => c.id === selectedClienteId)!;
            if (!inspectedClient) return null;
            const relations = getClientRelations(inspectedClient.id);
            const stats = calculateClientStatistics(relations.allAbbonamenti, relations.allFatture, inspectedClient.creato_il || "2026-01-01");

            return (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-6"
              >
                {/* Header detail menu */}
                <div className="flex justify-between items-center bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
                  <button
                    onClick={() => setSelectedClienteId(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" /> Elenco Clienti
                  </button>

                  <button
                    onClick={() => handleDeleteCliente(inspectedClient.id, `${inspectedClient.nome} ${inspectedClient.cognome}`)}
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Elimina Atleta
                  </button>
                </div>

                {/* Main details contents layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Biographical editor card */}
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5 h-fit">
                    <h3 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-105 flex items-center gap-1">
                      <History className="w-5 h-5 text-[#113f3d]" /> Scheda Anagrafica (Modificabile)
                    </h3>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nome</label>
                          <input
                            type="text"
                            value={editingNome}
                            onChange={(e) => setEditingNome(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Cognome</label>
                          <input
                            type="text"
                            value={editingCognome}
                            onChange={(e) => setEditingCognome(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Email</label>
                        <input
                          type="email"
                          value={editingEmail}
                          onChange={(e) => setEditingEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-sm font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Telefono</label>
                        <input
                          type="text"
                          value={editingTelefono}
                          onChange={(e) => setEditingTelefono(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Data di Nascita</label>
                        <input
                          type="date"
                          value={editingDataNascita}
                          onChange={(e) => setEditingDataNascita(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-sm font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Note Cliniche / Rilevanze</label>
                        <textarea
                          rows={3}
                          value={editingNote}
                          placeholder="Scoliosi, fratture pregresse, preferenze Yoga..."
                          onChange={(e) => setEditingNote(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-sm font-sans"
                        />
                      </div>

                      <button
                        onClick={() => handleSaveBioChanges(inspectedClient.id)}
                        className="w-full py-2.5 bg-[#113f3d] hover:bg-teal-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-4 h-4" /> Salva Dati Atleta
                      </button>
                    </div>
                  </div>

                  {/* Right Columns: Abbonamento + Storico pacchetti, firmature, fatture */}
                  <div className="lg:col-span-2 space-y-6">
                    
                    {/* Block A: Active Subscription focus */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-2 border-b border-slate-105">
                        <h4 className="text-sm font-extrabold text-[#113f3d] uppercase tracking-wider">SITUAZIONE ABBONAMENTO CORRENTE</h4>
                        {relations.activeAbb ? (
                          <button
                            onClick={() => handleOpenQuickRenew(inspectedClient)}
                            className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-150 border border-blue-250 text-blue-900 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs hover:scale-102"
                          >
                            <Plus className="w-3.5 h-3.5 text-blue-600" />
                            Attiva Altro Abbonamento
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenQuickRenew(inspectedClient)}
                            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-[#84e062]/20 border border-[#84e062]/30 text-emerald-900 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs hover:scale-102"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin-slow" />
                            Rinnova Abbonamento
                          </button>
                        )}
                      </div>
                      
                      {relations.activeAbb ? (
                        <div className="p-4 bg-emerald-50/40 border border-[#84e062]/20 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full mb-1 inline-block">ATTIMO ATTIVO</span>
                            <h5 className="font-bold text-slate-900 text-lg">Pacchetto: {relations.activeAbb.tipo}</h5>
                            <p className="text-slate-500 text-xs font-mono mt-0.5">Assunto il: {new Date(relations.activeAbb.creato_il).toLocaleDateString('it-IT')}</p>
                          </div>
                          
                          <div className="sm:text-right font-mono text-sm space-y-1 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-slate-500 text-[10px] uppercase font-bold text-slate-400 font-sans">Scadenza Abbonamento</p>
                            <p className="text-slate-800 font-bold text-base">{new Date(relations.activeAbb.data_fine).toLocaleDateString('it-IT')}</p>
                            <p className="text-emerald-800 font-bold text-xs font-sans">Inizio: {new Date(relations.activeAbb.data_inizio).toLocaleDateString('it-IT')}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-rose-50 text-rose-800 rounded-2xl border border-rose-100 text-sm flex items-center gap-2 font-medium">
                          <ShieldAlert className="w-5 h-5 text-rose-500 hover:scale-105 transition-all" />
                          <span>Questo atleta non possiede alcun abbonamento attivo registrato. Clicca su "Rinnova Abbonamento" per registrarlo!</span>
                        </div>
                      )}
                    </div>

                    {/* Block A2: Athlete Analytics Dashboard */}
                    <div className="bg-[#113f3d] text-white p-6 rounded-[2rem] shadow-lg space-y-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#84e062]/10 rounded-full filter blur-2xl pointer-events-none animate-pulse" />
                      
                      <div className="flex justify-between items-center pb-3 border-b border-white/10">
                        <div>
                          <h4 className="text-[9px] uppercase font-mono tracking-widest text-[#84e062] font-black">Flux Athlete Analytics</h4>
                          <h3 className="text-base font-black tracking-tight mt-0.5">Rendiconto Attività, Soste & Versamenti</h3>
                        </div>
                        <span className="text-[9px] bg-teal-950 font-mono text-teal-300 px-3 py-1 rounded-full border border-teal-850">
                          STATISTICHE GENERATE
                        </span>
                      </div>

                      {/* Analysis Bento Cards Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        
                        {/* total paid */}
                        <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between hover:bg-white/10 transition-all duration-150">
                          <span className="text-[9px] uppercase font-extrabold text-slate-300 tracking-wider">Totale Versato</span>
                          <p className="text-base font-extrabold text-[#84e062] mt-1">€ {stats.totalPaid.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                          <span className="text-[9px] text-slate-400 mt-1">Valore LTV</span>
                        </div>

                        {/* signup timeframe */}
                        <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between hover:bg-white/10 transition-all duration-150">
                          <span className="text-[9px] uppercase font-extrabold text-slate-300 tracking-wider">Tempo Iscritto</span>
                          <p className="text-base font-extrabold text-white mt-1">{stats.membershipDays} giorni</p>
                          <span className="text-[9px] text-slate-400 mt-1 truncate">Dal {new Date(stats.registrationDate).toLocaleDateString('it-IT')}</span>
                        </div>

                        {/* active coverage days */}
                        <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between hover:bg-white/10 transition-all duration-150">
                          <span className="text-[9px] uppercase font-extrabold text-slate-300 tracking-wider">Giorni Attivi</span>
                          <p className="text-base font-extrabold text-teal-300 mt-1">{stats.activeDays} giorni</p>
                          <span className="text-[9px] text-slate-400 mt-1">Attivo: {100 - stats.inactivePercentage}%</span>
                        </div>

                        {/* standstill days */}
                        <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between hover:bg-white/10 transition-all duration-150">
                          <span className="text-[9px] uppercase font-extrabold text-rose-350 tracking-wider">Sosta Totale</span>
                          <p className={`text-base font-extrabold mt-1 ${stats.inactiveDays > 0 ? 'text-rose-400' : 'text-slate-400'}`}>{stats.inactiveDays} giorni</p>
                          <span className="text-[9px] text-slate-400 mt-1">Fermo: {stats.inactivePercentage}%</span>
                        </div>

                      </div>

                      {/* Current stand-still alert box if any */}
                      {stats.currentStandstillDays > 0 ? (
                        <div className="p-3 bg-rose-500/15 border border-rose-500/20 rounded-2xl flex items-center justify-between gap-3 text-rose-300">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                            <div className="text-xs">
                              <p className="font-extrabold uppercase tracking-wider text-[9px] text-rose-400">Sosta Rilevata in Corso</p>
                              <p className="text-white/90">L'atleta è fermo da ben <strong>{stats.currentStandstillDays} giorni</strong> senza alcun abbonamento attivo.</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2 text-teal-200 text-xs">
                          <UserCheck className="w-4.5 h-4.5 text-[#84e062] shrink-0" />
                          <span>L'atleta è attualmente coperto da abbonamento attivo. <strong>Nessun fermo corrente!</strong></span>
                        </div>
                      )}

                      {/* Gaps chronicle timeline log directly addressing: "capire quanto è rimasta ferma, quando" */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-350 uppercase tracking-widest font-mono">CRONISTORIA DETTAGLIATA PERIODI DI FERMO (SOSTE STORICHE)</p>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {stats.gaps.length > 0 ? (
                            stats.gaps.map((gp, idx) => (
                              <div key={idx} className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-[11px] flex justify-between items-center transition-all hover:bg-white/10">
                                <div className="flex items-center gap-1.5 text-slate-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                  <span>Inattività dal {new Date(gp.from).toLocaleDateString('it-IT')} al {new Date(gp.to).toLocaleDateString('it-IT')}</span>
                                </div>
                                <span className="font-mono text-xs font-bold text-rose-400">-{gp.days} giorni di sosta</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 italic pb-1">Nessun periodo di sosta registrato dal giorno di iscrizione!</p>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Tab grids: Chrono logs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      
                      {/* Sub-block 1: Storico abbonamenti */}
                      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><History className="w-4 h-4 text-teal-600" /> Storico Abbonamenti ({relations.allAbbonamenti.length})</h4>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {relations.allAbbonamenti.length > 0 ? (
                            relations.allAbbonamenti.map((ab) => (
                              <div key={ab.id} className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between items-center border border-slate-100">
                                <div>
                                  <span className="font-bold text-slate-800 block text-xs">{ab.tipo} • € {ab.importo.toFixed(0)}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{ab.data_inizio} al {ab.data_fine}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  ab.stato === 'attivo' ? 'bg-[#84e062]/10 text-teal-900' : 'bg-slate-150 text-slate-500'
                                }`}>
                                  {ab.stato.toUpperCase()}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">Nessun abbonamento contrattualizzato in precedenza.</p>
                          )}
                        </div>
                      </div>

                      {/* Sub-block 2: Storico presenze firmate */}
                      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-indigo-600" /> Ultime Presenze Firmate ({relations.allPresenze.length})</h4>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {relations.allPresenze.length > 0 ? (
                            relations.allPresenze.map((pr) => (
                              <div key={pr.id} className="p-2.5 bg-slate-50 rounded-xl text-xs flex justify-between items-center font-mono text-slate-600 border border-slate-100">
                                <span>Firmato in lezione</span>
                                <span className="font-bold text-teal-900">{new Date(pr.data_presenza).toLocaleDateString('it-IT')}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">L'atleta non ha ancora registrato presenze firmate.</p>
                          )}
                        </div>
                      </div>

                      {/* Sub-block 3: Fatture associate */}
                      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm sm:col-span-2 space-y-4">
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-[#84e062]" /> Ricevute & Fatture emesse ({relations.allFatture.length})</h4>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {relations.allFatture.length > 0 ? (
                            relations.allFatture.map((fat) => (
                              <div key={fat.id} className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between items-center border border-slate-100">
                                <div>
                                  <span className="font-bold text-slate-800 block">N. {fat.numero_fattura} — {fat.descrizione}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">Emissione: {fat.data_emissione} • Scadenza: {fat.data_scadenza}</span>
                                </div>
                                
                                <div className="text-right flex items-center gap-4">
                                  <span className="font-bold text-slate-800 font-mono text-xs">€ {fat.importo.toFixed(2)}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    fat.stato_pagamento === 'pagato' 
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                                      : 'bg-rose-50 text-rose-800 border border-rose-100 animate-pulse'
                                  }`}>
                                    {fat.stato_pagamento.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">Nessun documento di fatturazione emesso.</p>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </motion.div>
            )
          })()
        )}
      </AnimatePresence>

      {/* MODAL WINDOW FOR ADDING NEW CUSTOMER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden border border-slate-100 shadow-2xl"
          >
            <div className="bg-[#113f3d] p-6 text-white text-center relative">
              <h3 className="font-extrabold text-lg">Crea Anagrafica Nuovo Atleta</h3>
              <p className="text-teal-200 text-xs mt-1">Inserisci tutte le informazioni richieste nel database relazionale</p>
            </div>

            <form onSubmit={handleAddClienteSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Nome *</label>
                  <input
                    type="text"
                    required
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    placeholder="Giulia"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Cognome *</label>
                  <input
                    type="text"
                    required
                    value={newCognome}
                    onChange={(e) => setNewCognome(e.target.value)}
                    placeholder="Bianchi"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="giulia.bianchi@gmail.com"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Telefono</label>
                <input
                  type="text"
                  value={newTelefono}
                  placeholder="+39 333 1234567"
                  onChange={(e) => setNewTelefono(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Data di Nascita</label>
                <input
                  type="date"
                  value={newDataNascita}
                  onChange={(e) => setNewDataNascita(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Note Cliniche / Allergie</label>
                <textarea
                  rows={2}
                  placeholder="Mal di schiena lombo-sacrale, asma..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs cursor-pointer text-center"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#113f3d] hover:bg-teal-900 text-white rounded-xl font-bold text-xs cursor-pointer text-center"
                >
                  Crea Atleta
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* QUICK RENEWAL MODAL */}
      {showRenewModal && renewClient && (() => {
        const activeAbbForModal = abbonamenti.find(a => a.cliente_id === renewClient.id && a.stato === 'attivo');
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden border border-slate-105 shadow-2xl font-sans"
            >
              <div className="bg-[#113f3d] p-6 text-white text-center relative">
                <h3 className="font-extrabold text-lg flex items-center justify-center gap-2">
                  {activeAbbForModal ? (
                    <>
                      <Plus className="w-5 h-5 text-[#84e062]" />
                      Attiva Altro Servizio
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5 text-[#84e062] animate-spin-slow" />
                      Rinnova Pacchetto Atleta
                    </>
                  )}
                </h3>
                <p className="text-teal-200 text-xs mt-1">
                  {activeAbbForModal 
                    ? `Attiva un abbonamento differente da ${activeAbbForModal.tipo} per ${renewClient.nome}`
                    : `Registra la vendita di un nuovo abbonamento per ${renewClient.nome} ${renewClient.cognome}`
                  }
                </p>
              </div>

              <form onSubmit={handleQuickRenewSubmit} className="p-6 space-y-4">
                
                {/* Presets */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tipo Pacchetto / Modello *</label>
                  <select
                    required
                    value={renewPresetType}
                    onChange={(e) => handleRenewPresetChange(e.target.value, renewStartDate)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold"
                  >
                    <option value="">-- Seleziona Tipo --</option>
                    {impostazioni?.abbonamenti_predefiniti
                      .filter(p => !activeAbbForModal || p.tipo !== activeAbbForModal.tipo)
                      .map((p, idx) => (
                        <option key={idx} value={p.tipo}>{p.tipo} ({p.durata_mesi}M - €{p.prezzo})</option>
                      ))
                    }
                    <option value="custom">Inserimento Libero...</option>
                  </select>
                </div>

              {/* Custom Type when selected custom */}
              {renewPresetType === 'custom' && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nome Pacchetto Personalizzato *</label>
                  <input
                    type="text"
                    required
                    placeholder="Semestrale, 10 ingressi, ecc..."
                    value={renewCustomType}
                    onChange={(e) => setRenewCustomType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Inizio */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Data Inizio *</label>
                  <input
                    type="date"
                    required
                    value={renewStartDate}
                    onChange={(e) => handleRenewStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold font-mono"
                  />
                </div>

                {/* Fine */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Data Fine Scadenza *</label>
                  <input
                    type="date"
                    required
                    value={renewEndDate}
                    onChange={(e) => setRenewEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Importo Dovuto */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Importo Dovuto (€) *</label>
                  <input
                    type="number"
                    required
                    placeholder="80.00"
                    value={renewAmount}
                    onChange={(e) => {
                      setRenewAmount(e.target.value);
                      setRenewAmountPaid(e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold font-mono"
                  />
                </div>

                {/* Importo Pagato */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cifra Pagata (€) *</label>
                  <input
                    type="number"
                    required
                    placeholder="80.00"
                    value={renewAmountPaid}
                    onChange={(e) => setRenewAmountPaid(e.target.value)}
                    className="w-full px-3 py-2 bg-[#84e062]/10 border border-[#84e062]/35 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-bold font-mono text-emerald-950"
                  />
                </div>
              </div>

              {/* Transactions state */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Transazione / Ricevuta *</label>
                <select
                  required
                  value={renewStatoPagamento}
                  onChange={(e) => setRenewStatoPagamento(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-bold text-slate-800"
                >
                  <option value="pagato">SALDATO IMMEDIATAMENTE (RISCOSSO)</option>
                  <option value="da pagare">IN ATTESA DI PAGAMENTO (DA PAGARE)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs cursor-pointer text-center"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#113f3d] hover:bg-teal-900 text-[#84e062] rounded-xl font-bold text-xs cursor-pointer text-center"
                >
                  Registra Rinnovo
                </button>
              </div>
            </form>
          </motion.div>
        </div>
        );
      })()}

    </div>
  );
}
