/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Fattura, Cliente } from '../types.js';
import { 
  FileText, Download, UploadCloud, Plus, Search, DollarSign, Calendar, 
  Trash2, AlertTriangle, FileUp, CheckCircle2, RotateCw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function FattureView() {
  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);

  const [search, setSearch] = useState('');
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Form states: Create Invoice
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [descrizione, setDescrizione] = useState('Quota Iscrizione Yoga');
  const [importo, setImporto] = useState('75.00');
  const [dataEmissione, setDataEmissione] = useState(new Date().toISOString().substring(0, 10));
  const [dataScadenza, setDataScadenza] = useState('');
  const [statoPagamento, setStatoPagamento] = useState<'pagato' | 'da pagare' | 'scaduto'>('da pagare');

  // Form states: Manual Upload PDF
  const [uploadClienteId, setUploadClienteId] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadImporto, setUploadImporto] = useState('');
  const [base64File, setBase64File] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const [saving, setSaving] = useState(false);
  const [notify, setNotify] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFatturazioneData = async () => {
    try {
      const getJSON = (url: string) => fetch(url).then(r => r.json());
      const [fats, clis] = await Promise.all([
        getJSON('/api/fatture'),
        getJSON('/api/clienti')
      ]);

      setFatture(fats);
      setClienti(clis);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFatturazioneData();
    // Default scadenza = 30 days after emissione
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    setDataScadenza(d.toISOString().substring(0, 10));
  }, []);

  const triggerNotify = (text: string) => {
    setNotify(text);
    setTimeout(() => setNotify(null), 3000);
  };

  // Create Invoice Handler
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId || !importo || !descrizione) return;

    setSaving(true);
    try {
      const res = await fetch('/api/fatture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: selectedClienteId,
          descrizione: descrizione.trim(),
          importo: Number(importo),
          data_emissione: dataEmissione,
          data_scadenza: dataScadenza || dataEmissione,
          stato_pagamento: statoPagamento
        })
      });

      if (!res.ok) throw new Error("Errore emissione ricezione");
      const saved = await res.json();

      setFatture([saved, ...fatture]);
      setSelectedClienteId('');
      setDescrizione('Quota Iscrizione Yoga');
      setImporto('75.00');
      setShowInvoiceForm(false);
      triggerNotify("Fattura / Ricevuta emessa correttamente!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Drag and drop / local file selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setBase64File(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload Manual Invoice (convert base64 or simulate path attachment)
  const handleUploadInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadClienteId || !uploadImporto || !uploadDesc) return;

    setSaving(true);
    try {
      const res = await fetch('/api/fatture/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: uploadClienteId,
          descrizione: uploadDesc.trim() + " (Caricata esternamente)",
          importo: Number(uploadImporto),
          data_emissione: new Date().toISOString().substring(0, 10),
          data_scadenza: new Date().toISOString().substring(0, 10),
          url_pdf: base64File || "/assets/placeholder_upload.pdf"
        })
      });

      if (!res.ok) throw new Error("Errore durante il caricamento del file");
      const imported = await res.json();

      setFatture([imported, ...fatture]);
      setUploadClienteId('');
      setUploadDesc('');
      setUploadImporto('');
      setBase64File(null);
      setFileName('');
      setShowUploadForm(false);
      triggerNotify("File PDF caricato e associato correttamente all'atleta.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFattura = async (id: string, code: string) => {
    if (!window.confirm(`Stai per eliminare definitivamente il documento fiscale N. ${code}. \n\nVuoi procedere?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/fatture/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Impossibile procedere");

      setFatture(fatture.filter(f => f.id !== id));
      triggerNotify("Documento rimosso.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Change invoice paying status directly from row dropdown toggles
  const togglePaymentState = async (id: string, targetState: 'pagato' | 'da pagare' | 'scaduto') => {
    try {
      const res = await fetch(`/api/fatture/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stato_pagamento: targetState })
      });

      if (!res.ok) throw new Error("Errore nel salvataggio");
      const updated = await res.json();

      setFatture(fatture.map(f => f.id === id ? updated : f));
      triggerNotify("Stato pagamento aggiornato.");
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Clicking "Scarica PDF Ricevuta" opens the robust pdf-lib rendering API route natively!
  const downloadReceiptPDF = (id: string) => {
    window.open(`/api/fatture/pdf?id=${id}`, '_blank');
  };

  // Filter invoice grid rows
  const filteredFatture = fatture.filter((f) => {
    const cli = clienti.find(c => c.id === f.cliente_id);
    const nameStr = cli ? `${cli.nome} ${cli.cognome}`.toLowerCase() : '';
    const descStr = f.descrizione.toLowerCase();
    const nrStr = f.numero_fattura.toLowerCase();
    const term = search.toLowerCase().trim();

    return nameStr.includes(term) || descStr.includes(term) || nrStr.includes(term);
  });

  return (
    <div id="fatture-modulo" className="space-y-6">
      
      {notify && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-teal-900 border border-teal-850 text-white font-bold rounded-2xl shadow-xl flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4.5 h-4.5 text-[#84e062]" />
          <span>{notify}</span>
        </div>
      )}

      {/* Main Bar Search & Actions */}
      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="relative w-full lg:max-w-xs">
          <input
            type="text"
            placeholder="Cerca per destinatario o numero fattura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-1 focus:ring-[#113f3d] text-xs font-semibold"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </div>

        {/* Form toggling triggers */}
        <div className="flex gap-2 w-full lg:w-auto">
          <button
            onClick={() => { setShowInvoiceForm(!showInvoiceForm); setShowUploadForm(false); }}
            className="flex-1 lg:flex-none px-4 py-2.5 bg-[#113f3d] hover:bg-teal-900 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Genera Ricevuta PDF
          </button>

          <button
            onClick={() => { setShowUploadForm(!showUploadForm); setShowInvoiceForm(false); }}
            className="flex-1 lg:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" /> Carica PDF Esterno
          </button>
        </div>
      </div>

      <AnimatePresence>
        {/* EMISSION FORM CONTAINER */}
        {showInvoiceForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden"
          >
            <h3 className="font-extrabold text-[#113f3d] text-sm pb-2 border-b border-slate-50 uppercase tracking-widest mb-4">Emetti nuova ricevuta di cassa</h3>
            
            <form onSubmit={handleCreateInvoice} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-xs font-semibold text-slate-650">
              {/* Select Athlete */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Intestatario Atleta *</label>
                <select
                  required
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">-- Seleziona Destinatario --</option>
                  {clienti.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>
                  ))}
                </select>
              </div>

              {/* Descrizione */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Descrizione Voce Fiscale *</label>
                <input
                  type="text"
                  required
                  placeholder="Abbonamento Pilates Mensile..."
                  value={descrizione}
                  onChange={(e) => setDescrizione(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Importo */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Importo (€) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="75.00"
                  value={importo}
                  onChange={(e) => setImporto(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono"
                />
              </div>

              {/* Stato Pagamento */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Stato Iniziale Pagamento *</label>
                <select
                  required
                  value={statoPagamento}
                  onChange={(e) => setStatoPagamento(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="da pagare">Da Pagare</option>
                  <option value="pagato">Pagato</option>
                  <option value="scaduto">Scaduto</option>
                </select>
              </div>

              {/* Data Emissione */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Data Emissione *</label>
                <input
                  type="date"
                  required
                  value={dataEmissione}
                  onChange={(e) => setDataEmissione(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono"
                />
              </div>

              {/* Data Scadenza */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Data Scadenza saldo *</label>
                <input
                  type="date"
                  required
                  value={dataScadenza}
                  onChange={(e) => setDataScadenza(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvoiceForm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#113f3d] text-white rounded-xl font-bold hover:bg-teal-900 disabled:opacity-50"
                >
                  Emetti
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* MANUAL UPLOAD PDF FORM CONTAINER */}
        {showUploadForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden"
          >
            <h3 className="font-extrabold text-slate-800 text-sm pb-2 border-b border-slate-50 uppercase tracking-widest mb-4">Associa Fattura PDF Esterna</h3>
            
            <form onSubmit={handleUploadInvoice} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-xs font-semibold text-slate-650">
              {/* Select Athlete */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Associa ad Atleta *</label>
                <select
                  required
                  value={uploadClienteId}
                  onChange={(e) => setUploadClienteId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">-- Seleziona Atleta --</option>
                  {clienti.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>
                  ))}
                </select>
              </div>

              {/* Descrizione */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Descrizione File (es. Ricezione Bonifico...) *</label>
                <input
                  type="text"
                  required
                  placeholder="Integrazione Danza, visita medica..."
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Importo */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Importo Dichiarato (€) *</label>
                <input
                  type="number"
                  required
                  placeholder="100.00"
                  value={uploadImporto}
                  onChange={(e) => setUploadImporto(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono"
                />
              </div>

              {/* File input (Drag & Drop or click trigger) */}
              <div>
                <input
                  type="file"
                  accept="application/pdf"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#113f3d] transition-all py-3 gap-0.5"
                >
                  <FileUp className="w-4 h-4 text-slate-450" />
                  <span className="text-[9px] text-slate-500 font-bold truncate max-w-[90%] font-mono">
                    {fileName || "Carica File PDF"}
                  </span>
                </button>
              </div>

              {/* Form trigger buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving || !base64File}
                  className="flex-1 py-2.5 bg-[#113f3d] text-white rounded-xl font-bold hover:bg-teal-900 disabled:opacity-50"
                >
                  Allega
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Billing Invoices List Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="p-4 pl-6">N. DOCUMENTO</th>
                <th className="p-4">DESTINATARIO ATLETA</th>
                <th className="p-4">VOCE FISCALE</th>
                <th className="p-4">LIMITI (EMESSA - SCADENZA)</th>
                <th className="p-4 text-center">IMPORTO</th>
                <th className="p-4 text-center">STATO SALDO</th>
                <th className="p-4 pr-6 text-right">PDF / AZIONI</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredFatture.map((fat) => {
                const cli = clienti.find(c => c.id === fat.cliente_id);
                
                return (
                  <tr key={fat.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Invoice ID Code */}
                    <td className="p-4 pl-6">
                      <span className="font-extrabold text-[#113f3d] font-mono whitespace-nowrap">
                        {fat.numero_fattura}
                      </span>
                    </td>

                    {/* Recipient Client */}
                    <td className="p-4">
                      <span className="font-bold text-slate-900 text-sm block">
                        {cli ? `${cli.nome} ${cli.cognome}` : 'Destinatario Sconosciuto'}
                      </span>
                      {cli?.telefono && (
                        <span className="text-[10px] text-slate-400 font-mono">Tel: {cli.telefono}</span>
                      )}
                    </td>

                    {/* Description Presets */}
                    <td className="p-4">
                      <span className="font-medium max-w-xs block truncate" title={fat.descrizione}>
                        {fat.descrizione}
                      </span>
                    </td>

                    {/* Validation Limits */}
                    <td className="p-4 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                      <span>Da: {new Date(fat.data_emissione).toLocaleDateString('it-IT')} a: {new Date(fat.data_scadenza).toLocaleDateString('it-IT')}</span>
                    </td>

                    {/* Charge Import */}
                    <td className="p-4 text-center font-bold font-sans text-slate-800 text-sm">
                      € {fat.importo.toFixed(2)}
                    </td>

                    {/* Pay Status Toggles */}
                    <td className="p-4 text-center">
                      <select
                        value={fat.stato_pagamento}
                        onChange={(e) => togglePaymentState(fat.id, e.target.value as any)}
                        className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border cursor-pointer font-sans ${
                          fat.stato_pagamento === 'pagato'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                            : fat.stato_pagamento === 'scaduto'
                            ? 'bg-rose-50 text-rose-800 border-rose-100'
                            : 'bg-amber-50 text-amber-805 border-amber-100 animate-pulse'
                        }`}
                      >
                        <option value="da pagare">Da Pagare</option>
                        <option value="pagato">Pagato</option>
                        <option value="scaduto">Scaduto</option>
                      </select>
                    </td>

                    {/* PDF Generators and Removes */}
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Download PDF Receipts with pdf-lib compiled path */}
                        <button
                          onClick={() => downloadReceiptPDF(fat.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-[#84e062] hover:text-[#113f3d] text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                          title="Genera & Scarica Ricevuta PDF"
                        >
                          <Download className="w-3.5 h-3.5" /> PDF
                        </button>

                        <button
                          onClick={() => handleDeleteFattura(fat.id, fat.numero_fattura)}
                          className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded cursor-pointer"
                          title="Rimuovi Documento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredFatture.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            Nessun documento fiscale emesso o importato corrisponde alla ricerca corrente.
          </div>
        )}
      </div>

    </div>
  );
}
