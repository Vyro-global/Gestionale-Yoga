/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Abbonamento, Cliente, Impostazioni } from '../types.js';
import { 
  Plus, Calendar, DollarSign, Filter, Search, ShieldAlert, CheckCircle, 
  Trash2, Edit, Save, RefreshCw, XCircle, AlertTriangle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AbbonamentiViewProps {
  onSubscriptionsUpdated: () => void;
}

export default function AbbonamentiView({ onSubscriptionsUpdated }: AbbonamentiViewProps) {
  const [abbonamenti, setAbbonamenti] = useState<Abbonamento[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [impostazioni, setImpostazioni] = useState<Impostazioni | null>(null);

  const [filter, setFilter] = useState<'tutti' | 'attivi' | 'in_scadenza' | 'scaduti'>('tutti');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states adding subscription
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [selectedPresetType, setSelectedPresetType] = useState('');
  const [customType, setCustomType] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [endDate, setEndDate] = useState('');
  const [amount, setAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [statoPagamento, setStatoPagamento] = useState<'pagato' | 'da pagare'>('pagato');

  // Editing subscription states
  const [editingAbbId, setEditingAbbId] = useState<string | null>(null);
  const [editingStato, setEditingStato] = useState<'attivo' | 'scaduto' | 'sospeso'>('attivo');
  const [editingFine, setEditingFine] = useState('');

  const [notification, setNotification] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const getJSON = (url: string) => fetch(url).then(r => r.json());
      const [abb, cli, imp] = await Promise.all([
        getJSON('/api/abbonamenti'),
        getJSON('/api/clienti'),
        getJSON('/api/impostazioni')
      ]);

      setAbbonamenti(abb);
      setClienti(cli);
      setImpostazioni(imp);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerNotification = (text: string) => {
    setNotification(text);
    setTimeout(() => setNotification(null), 3500);
  };

  // Helper calculating expiration warnings
  const getExpirationStatus = (abb: Abbonamento) => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const todayVal = new Date(todayStr).getTime();
    const sevenDaysVal = todayVal + 7 * 24 * 60 * 60 * 1000;
    const fineVal = new Date(abb.data_fine).getTime();

    if (abb.stato === 'sospeso') return { label: 'Sospeso', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    if (fineVal < todayVal) return { label: 'Scaduto', color: 'bg-rose-50 text-rose-700 border-rose-100' };
    if (fineVal >= todayVal && fineVal <= sevenDaysVal) return { label: 'In Scadenza (7gg)', color: 'bg-amber-50 text-amber-705 border-amber-100' };
    return { label: 'Attivo', color: 'bg-emerald-50 text-emerald-800 border-emerald-100' };
  };

  // Handles select subscription preset dropdown updates amount & endDate automatically
  const handlePresetChange = (presetName: string) => {
    setSelectedPresetType(presetName);
    if (!impostazioni) return;

    if (presetName === 'custom') {
      setCustomType('');
      setAmount('');
      setAmountPaid('');
      setEndDate('');
      return;
    }

    const matched = impostazioni.abbonamenti_predefiniti.find(p => p.tipo === presetName);
    if (matched) {
      setAmount(String(matched.prezzo));
      setAmountPaid(String(matched.prezzo));
      
      // Calculate end date based on duration
      const sDate = new Date(startDate);
      sDate.setMonth(sDate.getMonth() + matched.durata_mesi);
      setEndDate(sDate.toISOString().substring(0, 10));
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (!impostazioni || !selectedPresetType || selectedPresetType === 'custom') return;

    const matched = impostazioni.abbonamenti_predefiniti.find(p => p.tipo === selectedPresetType);
    if (matched) {
      const sDate = new Date(val);
      sDate.setMonth(sDate.getMonth() + matched.durata_mesi);
      setEndDate(sDate.toISOString().substring(0, 10));
    }
  };

  // Pre-fills form for quick renewal starting from day after previous end date or today
  const handleRenewSubscription = (abb: Abbonamento) => {
    setShowAddForm(true);
    setSelectedClienteId(abb.cliente_id);
    
    const todayStr = new Date().toISOString().substring(0, 10);
    let newStart = todayStr;
    if (abb.data_fine >= todayStr) {
      const dateVal = new Date(abb.data_fine);
      dateVal.setDate(dateVal.getDate() + 1);
      newStart = dateVal.toISOString().substring(0, 10);
    }
    setStartDate(newStart);

    const matched = impostazioni?.abbonamenti_predefiniti.find(p => p.tipo === abb.tipo);
    if (matched) {
      setSelectedPresetType(abb.tipo);
      setAmount(String(matched.prezzo));
      setAmountPaid(String(matched.prezzo));
      
      const sDate = new Date(newStart);
      sDate.setMonth(sDate.getMonth() + matched.durata_mesi);
      setEndDate(sDate.toISOString().substring(0, 10));
    } else {
      setSelectedPresetType('custom');
      setCustomType(abb.tipo);
      setAmount(String(abb.importo));
      setAmountPaid(String(abb.importo));
      setEndDate('');
    }

    // Scroll to form smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
    triggerNotification("Modulo precompilato! Imposta i pagamenti qui sotto.");
  };

  // Create Sub
  const handleCreateSubscriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId || !endDate || !amount) return;

    const tipoFinal = selectedPresetType === 'custom' ? customType : selectedPresetType;
    if (!tipoFinal) return;

    try {
      const response = await fetch('/api/abbonamenti/con-pagamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: selectedClienteId,
          tipo: tipoFinal,
          data_inizio: startDate,
          data_fine: endDate,
          importo: Number(amount),
          importo_pagato: Number(amountPaid !== '' ? amountPaid : amount),
          stato_pagamento: statoPagamento
        })
      });

      if (!response.ok) throw new Error("Errore nel salvataggio");
      const savedData = await response.json();

      setAbbonamenti([savedData.subscription, ...abbonamenti]);
      
      // Reset forms
      setSelectedClienteId('');
      setSelectedPresetType('');
      setCustomType('');
      setAmount('');
      setAmountPaid('');
      setStatoPagamento('pagato');
      setEndDate('');
      setShowAddForm(false);
      triggerNotification("Abbonamento venduto e pagamento registrato con successo!");
      onSubscriptionsUpdated();
    } catch (err: any) {
      alert("Errore inserimento: " + err.message);
    }
  };

  // Save edits (modify end_date / state)
  const handleSaveEdits = async (id: string) => {
    try {
      const response = await fetch(`/api/abbonamenti/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stato: editingStato,
          data_fine: editingFine
        })
      });

      if (!response.ok) throw new Error("Errore salvataggio");
      const updated = await response.json();

      setAbbonamenti(abbonamenti.map(a => a.id === id ? updated : a));
      setEditingAbbId(null);
      triggerNotification("Abbonamento modificato correttamente.");
      onSubscriptionsUpdated();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Sub
  const handleDeleteSubscription = async (id: string) => {
    if (!window.confirm("Sei sicuro di voler revocare ed eliminare questo pacchetto dal database dell'atleta?")) {
      return;
    }

    try {
      const response = await fetch(`/api/abbonamenti/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Impossibile procedere");

      setAbbonamenti(abbonamenti.filter(a => a.id !== id));
      triggerNotification("Abbonamento revocato.");
      onSubscriptionsUpdated();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Trigger editing inputs
  const startEditing = (abb: Abbonamento) => {
    setEditingAbbId(abb.id);
    setEditingStato(abb.stato);
    setEditingFine(abb.data_fine);
  };

  // Filtering Logic
  const filteredAbbonamenti = abbonamenti.filter((ab) => {
    const cli = clienti.find((c) => c.id === ab.cliente_id);
    if (!cli) return false;

    // Search matches customer properties
    const term = search.toLowerCase().trim();
    const matchesSearch = cli.nome.toLowerCase().includes(term) || 
                          cli.cognome.toLowerCase().includes(term) ||
                          ab.tipo.toLowerCase().includes(term);

    // Filter statuses
    const todayStr = new Date().toISOString().substring(0, 10);
    const todayVal = new Date(todayStr).getTime();
    const sevenDaysVal = todayVal + 7 * 24 * 60 * 60 * 1000;
    const fineVal = new Date(ab.data_fine).getTime();

    if (filter === 'attivi') {
      return matchesSearch && ab.stato === 'attivo' && fineVal >= todayVal;
    }
    if (filter === 'in_scadenza') {
      return matchesSearch && ab.stato === 'attivo' && fineVal >= todayVal && fineVal <= sevenDaysVal;
    }
    if (filter === 'scaduti') {
      return matchesSearch && (ab.stato === 'scaduto' || fineVal < todayVal);
    }

    return matchesSearch;
  });

  return (
    <div id="abbonamenti-module" className="space-y-6">
      
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-teal-900 text-white rounded-2xl shadow-xl flex items-center gap-2 font-bold text-xs">
          <CheckCircle className="w-4 h-4 text-[#84e062]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Bar Search + Filter */}
      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            placeholder="Cerca per atleta o tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'tutti', label: 'Tutti' },
            { id: 'attivi', label: 'Attivi' },
            { id: 'in_scadenza', label: 'In Scadenza (7 gg)', icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" /> },
            { id: 'scaduti', label: 'Scaduti', icon: <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                filter === tab.id 
                  ? 'bg-[#113f3d] border-[#113f3d] text-white' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-5 py-2.5 bg-[#113f3d] hover:bg-teal-900 border border-[#113f3d] rounded-2xl text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nuovo Abbonamento
        </button>
      </div>

      <AnimatePresence>
        {/* ADD FORM ACCORDION */}
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden"
          >
            <h3 className="text-base font-extrabold text-[#113f3d] mb-4 pb-2 border-b border-slate-50 uppercase tracking-wide">Vendi & Attiva Nuovo Pacchetto</h3>
            
            <form onSubmit={handleCreateSubscriptionSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              
              {/* Select Cliente */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Associa ad Atleta *</label>
                <select
                  required
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold"
                >
                  <option value="">-- Seleziona Atleta --</option>
                  {clienti.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>
                  ))}
                </select>
              </div>

              {/* Select Preset */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Pacchetto Abbonamento *</label>
                <select
                  required
                  value={selectedPresetType}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold"
                >
                  <option value="">-- Seleziona Tipo --</option>
                  {impostazioni?.abbonamenti_predefiniti
                    .filter(p => {
                      // Exclude types for which the selected client already holds an active subscription
                      const hasActiveOfThisType = abbonamenti.some(
                        a => a.cliente_id === selectedClienteId && 
                             a.tipo === p.tipo && 
                             a.stato === 'attivo'
                      );
                      return !hasActiveOfThisType;
                    })
                    .map((p, idx) => (
                      <option key={idx} value={p.tipo}>{p.tipo} ({p.durata_mesi}M - €{p.prezzo})</option>
                    ))
                  }
                  <option value="custom">Inserimento Libero...</option>
                </select>
              </div>

              {/* Custom Type when selected custom */}
              {selectedPresetType === 'custom' && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nome Pacchetto Personalizzato *</label>
                  <input
                    type="text"
                    required
                    placeholder="Semestrale, 10 ingressi, ecc..."
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold"
                  />
                </div>
              )}

              {/* Inizio */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Data Inizio *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold font-mono"
                />
              </div>

              {/* Fine */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Data Fine Scadenza *</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold font-mono"
                />
              </div>

              {/* Importo */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Importo Dovuto (€) *</label>
                <input
                  type="number"
                  required
                  placeholder="80.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setAmountPaid(e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-semibold font-mono"
                />
              </div>

              {/* Importo Pagato */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cifra Effettiva Pagata (€) *</label>
                <input
                  type="number"
                  required
                  placeholder="80.00"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full px-3 py-2 bg-emerald-50/20 border border-emerald-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-bold font-mono text-emerald-800"
                />
              </div>

              {/* Stato Pagamento */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Stato Transazione *</label>
                <select
                  required
                  value={statoPagamento}
                  onChange={(e) => setStatoPagamento(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs font-bold text-slate-800"
                >
                  <option value="pagato">SALDATO IMMEDIATAMENTE (RISCOSSO)</option>
                  <option value="da pagare">IN ATTESA (DA PAGARE)</option>
                </select>
              </div>

              {/* Action */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-205 text-slate-650 rounded-xl text-xs font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#113f3d] hover:bg-teal-900 text-white rounded-xl text-xs font-bold"
                >
                  Crea e Attiva
                </button>
              </div>

            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main List Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="p-4 pl-6">ATLETA ASSOCIATO</th>
                <th className="p-4">PACCHETTO / TIPO</th>
                <th className="p-4">VALIDITÀ (DA - A)</th>
                <th className="p-4">IMPORTO</th>
                <th className="p-4 text-center">STATO CRICITITÀ</th>
                <th className="p-4 pr-6 text-right">GESTIONE</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredAbbonamenti.map((ab) => {
                const cli = clienti.find(c => c.id === ab.cliente_id);
                const isEditing = editingAbbId === ab.id;
                const status = getExpirationStatus(ab);

                // Highlighted borders based on target specs:
                // "Evidenzia in rosso quelli scaduti, in arancione quelli in scadenza entro 7 giorni"
                const todayStr = new Date().toISOString().substring(0, 10);
                const todayVal = new Date(todayStr).getTime();
                const sevenDaysVal = todayVal + 7 * 24 * 60 * 60 * 1000;
                const fineVal = new Date(ab.data_fine).getTime();

                let rowBorderColor = "hover:bg-slate-50/40";
                if (ab.stato === 'attivo' && fineVal >= todayVal && fineVal <= sevenDaysVal) {
                  rowBorderColor = "bg-amber-50/30 hover:bg-amber-50/50 border-l-4 border-l-orange-400";
                } else if (ab.stato === 'scaduto' || fineVal < todayVal) {
                  rowBorderColor = "bg-rose-50/10 hover:bg-rose-50/25 border-l-4 border-l-rose-500";
                }

                return (
                  <tr key={ab.id} className={`transition-all ${rowBorderColor}`}>
                    {/* Alleta Name */}
                    <td className="p-4 pl-6">
                      <span className="font-bold text-slate-800 text-sm block">
                        {cli ? `${cli.nome} ${cli.cognome}` : 'Atleta Sconosciuto'}
                      </span>
                    </td>

                    {/* Pacchetto */}
                    <td className="p-4">
                      <span className="font-semibold text-slate-705 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        {ab.tipo}
                      </span>
                    </td>

                    {/* Validità */}
                    <td className="p-4 font-mono text-[11px] text-slate-500">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <span>Da: {ab.data_inizio} a</span>
                          <input
                            type="date"
                            value={editingFine}
                            onChange={(e) => setEditingFine(e.target.value)}
                            className="px-2 py-1 bg-white border border-slate-200 rounded"
                          />
                        </div>
                      ) : (
                        <span>Dal {new Date(ab.data_inizio).toLocaleDateString('it-IT')} al {new Date(ab.data_fine).toLocaleDateString('it-IT')}</span>
                      )}
                    </td>

                    {/* Importo */}
                    <td className="p-4 font-bold text-slate-800 font-sans">
                      € {ab.importo.toFixed(2)}
                    </td>

                    {/* Stato */}
                    <td className="p-4 text-center">
                      {isEditing ? (
                        <select
                          value={editingStato}
                          onChange={(e) => setEditingStato(e.target.value as any)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 font-bold"
                        >
                          <option value="attivo">Attivo</option>
                          <option value="scaduto">Scaduto</option>
                          <option value="sospeso">Sospeso</option>
                        </select>
                      ) : (
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${status.color}`}>
                          {status.label}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdits(ab.id)}
                              className="px-3 py-1.5 bg-[#113f3d] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" /> Salva
                            </button>
                            <button
                              onClick={() => setEditingAbbId(null)}
                              className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px]"
                            >
                              Annulla
                            </button>
                          </>
                        ) : (
                          <>
                            {!(ab.stato === 'attivo' && fineVal >= todayVal) && (
                              <button
                                onClick={() => handleRenewSubscription(ab)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-[#84e062]/20 border border-[#84e062]/25 text-emerald-900 rounded-lg text-[10px] font-extrabold flex items-center gap-1 hover:scale-101 duration-150 transition-all cursor-pointer"
                                title="Rinnova Pacchetto Atleta"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-emerald-600 font-extrabold" />
                                Rinnova
                              </button>
                            )}
                            <button
                              onClick={() => startEditing(ab)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 rounded hover:text-slate-800 transition-all cursor-pointer"
                              title="Modifica Abbonamento"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubscription(ab.id)}
                              className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded transition-all cursor-pointer"
                              title="Rimuovi Abbonamento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredAbbonamenti.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            Nessun abbonamento registrato corrisponde ai filtri selezionati.
          </div>
        )}
      </div>

    </div>
  );
}
