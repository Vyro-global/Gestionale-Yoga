/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Impostazioni, Staff } from '../types.js';
import { 
  Settings, Save, Users, Plus, Trash2, Shield, Gem, Building2, Edit2, Check, X,
  Database, RefreshCw, Copy, Link, ExternalLink, Download
} from 'lucide-react';
import { motion } from 'motion/react';
import { createClient } from '@supabase/supabase-js';

interface ImpostazioniViewProps {
  onSettingsUpdated: () => void;
  currentStaffId?: string;
}

export default function ImpostazioniView({ onSettingsUpdated, currentStaffId }: ImpostazioniViewProps) {
  const [impostazioni, setImpostazioni] = useState<Impostazioni | null>(null);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffNome, setNewStaffNome] = useState('');
  const [newStaffRuolo, setNewStaffRuolo] = useState<'staff' | 'admin'>('staff');
  
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    actionLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  
  const [editingImpostazioni, setEditingImpostazioni] = useState({
    nome: '',
    indirizzo: '',
    piva: '',
    logo: '',
    logo_url: ''
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // --- SUPABASE STATE ---
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isSupabaseActive, setIsSupabaseActive] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'idle' | 'testing' | 'success' | 'warning' | 'error'>('idle');
  const [supabaseErrorDetails, setSupabaseErrorDetails] = useState('');

  // Load cloud configurations from localStorage on mount
  useEffect(() => {
    try {
      const savedSupa = localStorage.getItem('fluxcrm_supabase_config');
      if (savedSupa) {
        const parsed = JSON.parse(savedSupa);
        setSupabaseUrl(parsed.url || '');
        setSupabaseKey(parsed.key || '');
        setIsSupabaseActive(!!parsed.active);
      }
    } catch (e) {
      console.error("Errore nel caricamento config cloud da localStorage", e);
    }
  }, []);

  // Fetch settings & staff list
  const fetchData = async () => {
    try {
      const settingsRes = await fetch('/api/impostazioni');
      const settingsData = await settingsRes.json();
      setImpostazioni(settingsData);
      setEditingImpostazioni({
        nome: settingsData.nome,
        indirizzo: settingsData.indirizzo,
        piva: settingsData.piva,
        logo: settingsData.logo,
        logo_url: settingsData.logo_url || ''
      });

      const staffRes = await fetch('/api/staff');
      const staffData = await staffRes.json();
      setAllStaff(staffData);
    } catch (e) {
      console.error("Errore caricamento impostazioni", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerNotification = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // Convert uploaded image to base64
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        triggerNotification('error', 'L\'immagine del logo non deve superare i 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingImpostazioni(prev => ({
          ...prev,
          logo_url: reader.result as string
        }));
        triggerNotification('success', 'Logo caricato temporaneamente. Fai clic su "Salva Configurazione" per renderlo definitivo.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setEditingImpostazioni(prev => ({
      ...prev,
      logo_url: ''
    }));
  };

  // Update Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/impostazioni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...impostazioni,
          ...editingImpostazioni
        })
      });

      if (!response.ok) throw new Error("Errore nel salvataggio");
      
      const updated = await response.json();
      setImpostazioni(updated);
      triggerNotification('success', 'Impostazioni della palestra salvate con successo!');
      onSettingsUpdated();
    } catch (err: any) {
      triggerNotification('error', err.message || 'Errore nel salvataggio');
    }
  };

  // Add Staff Member
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail || !newStaffNome) return;

    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newStaffEmail.trim(),
          nome: newStaffNome.trim(),
          ruolo: newStaffRuolo
        })
      });

      if (!response.ok) throw new Error("Impossibile aggiungere l'utente");
      
      const newSt = await response.json();
      setAllStaff([...allStaff, newSt]);
      setNewStaffEmail('');
      setNewStaffNome('');
      setNewStaffRuolo('staff');
      triggerNotification('success', 'Nuovo membro dello staff aggiunto con successo!');
    } catch (err: any) {
      triggerNotification('error', err.message || 'Errore aggiunta staff');
    }
  };

  // Remove Staff Member
  const handleDeleteStaff = (id: string) => {
    if (currentStaffId && id === currentStaffId) {
      triggerNotification('error', 'Impossibile rimuovere il proprio account amministratore mentre si è loggati!');
      return;
    }

    if (allStaff.length <= 1) {
      triggerNotification('error', 'Impossibile eliminare l\'ultimo membro dello staff rimasto!');
      return;
    }
    
    setConfirmDialog({
      title: "Rimuovi Membro Staff",
      message: "Sei sicuro di voler rimuovere le credenziali di accesso per questo membro dello staff? Non potrà più accedere all'applicazione.",
      actionLabel: "Sì, Rimuovi",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
          if (!response.ok) throw new Error("Errore nell'eliminazione");

          setAllStaff(allStaff.filter(st => st.id !== id));
          triggerNotification('success', 'Membro dello staff rimosso.');
        } catch (err: any) {
          triggerNotification('error', err.message || 'Errore di rimozione');
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  // Preset list edit states
  const [editingPresetIndex, setEditingPresetIndex] = useState<number | null>(null);
  const [editingPresetTipo, setEditingPresetTipo] = useState('');
  const [editingPresetPrezzo, setEditingPresetPrezzo] = useState('');
  const [editingPresetDurata, setEditingPresetDurata] = useState('');

  // New preset state
  const [newPresetTipo, setNewPresetTipo] = useState('');
  const [newPresetPrezzo, setNewPresetPrezzo] = useState('');
  const [newPresetDurata, setNewPresetDurata] = useState('');
  const [showAddPresetForm, setShowAddPresetForm] = useState(false);

  const handleUpdatePresetsOnBackend = async (updatedPresets: { tipo: string; prezzo: number; durata_mesi: number }[]) => {
    if (!impostazioni) return;
    try {
      const response = await fetch('/api/impostazioni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...impostazioni,
          abbonamenti_predefiniti: updatedPresets
        })
      });

      if (!response.ok) throw new Error("Errore nell'aggiornamento dei pacchetti");
      const updated = await response.json();
      setImpostazioni(updated);
      triggerNotification('success', 'Listino pacchetti predefiniti aggiornato con successo!');
      onSettingsUpdated();
    } catch (e: any) {
      triggerNotification('error', e.message || 'Errore salvataggio pacchetti');
    }
  };

  const handleApplyAddPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetTipo || !newPresetPrezzo || !newPresetDurata || !impostazioni) return;

    const newPreset = {
      tipo: newPresetTipo.trim(),
      prezzo: Number(newPresetPrezzo),
      durata_mesi: Number(newPresetDurata)
    };

    const updated = [...impostazioni.abbonamenti_predefiniti, newPreset];
    await handleUpdatePresetsOnBackend(updated);

    // Reset form
    setNewPresetTipo('');
    setNewPresetPrezzo('');
    setNewPresetDurata('');
    setShowAddPresetForm(false);
  };

  const handleDeletePreset = (indexToDelete: number) => {
    if (!impostazioni) return;
    
    setConfirmDialog({
      title: "Elimina Pacchetto Predefinito",
      message: `Sei sicuro di voler eliminare definitivamente il pacchetto "${impostazioni.abbonamenti_predefiniti[indexToDelete]?.tipo}" dal listino predefinito?`,
      actionLabel: "Elimina",
      onConfirm: async () => {
        try {
          const updated = impostazioni.abbonamenti_predefiniti.filter((_, idx) => idx !== indexToDelete);
          await handleUpdatePresetsOnBackend(updated);
        } catch (err: any) {
          triggerNotification('error', 'Ops, si è verificato un errore.');
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleStartEditPreset = (index: number) => {
    if (!impostazioni) return;
    const item = impostazioni.abbonamenti_predefiniti[index];
    setEditingPresetIndex(index);
    setEditingPresetTipo(item.tipo);
    setEditingPresetPrezzo(String(item.prezzo));
    setEditingPresetDurata(String(item.durata_mesi));
  };

  const handleSaveEditPreset = async (indexToSave: number) => {
    if (!impostazioni || !editingPresetTipo || !editingPresetPrezzo || !editingPresetDurata) return;

    const updated = impostazioni.abbonamenti_predefiniti.map((item, idx) => {
      if (idx === indexToSave) {
        return {
          tipo: editingPresetTipo.trim(),
          prezzo: Number(editingPresetPrezzo),
          durata_mesi: Number(editingPresetDurata)
        };
      }
      return item;
    });

    await handleUpdatePresetsOnBackend(updated);
    setEditingPresetIndex(null);
  };

  // --- CLOUD INTEGRATION HANDLERS ---
  
  // Test and Save Supabase credentials
  const handleTestAndSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl || !supabaseKey) {
      triggerNotification('error', 'Inserisci URL e Anon Key prima di testare!');
      return;
    }
    setSupabaseStatus('testing');
    setSupabaseErrorDetails('');

    try {
      const client = createClient(supabaseUrl, supabaseKey);
      
      // Test query on main 'clienti' table
      const { data, error } = await client.from('clienti').select('*').limit(1);

      if (error) {
        if (error.code === '42P01' || error.message?.includes('relation "clienti" does not exist')) {
          setSupabaseStatus('warning');
          const config = { url: supabaseUrl, key: supabaseKey, active: true };
          localStorage.setItem('fluxcrm_supabase_config', JSON.stringify(config));
          setIsSupabaseActive(true);
          triggerNotification('success', 'Connessione stabilita con successo (ma tabelle assenti)!');
        } else {
          setSupabaseStatus('error');
          setSupabaseErrorDetails(error.message || JSON.stringify(error));
          triggerNotification('error', `Errore connessione: ${error.message}`);
        }
      } else {
        setSupabaseStatus('success');
        const config = { url: supabaseUrl, key: supabaseKey, active: true };
        localStorage.setItem('fluxcrm_supabase_config', JSON.stringify(config));
        setIsSupabaseActive(true);
        triggerNotification('success', 'Connessione stabilita e sincronizzazione completata con successo!');
      }
    } catch (err: any) {
      setSupabaseStatus('error');
      setSupabaseErrorDetails(err.message || 'Errore di connessione imprevisto');
      triggerNotification('error', `Errore imprevisto: ${err.message || err}`);
    }
  };

  const handleToggleSupabase = (checked: boolean) => {
    setIsSupabaseActive(checked);
    const config = { url: supabaseUrl, key: supabaseKey, active: checked };
    localStorage.setItem('fluxcrm_supabase_config', JSON.stringify(config));
    if (checked) {
      triggerNotification('success', 'Integrazione Supabase attivata nel browser.');
    } else {
      triggerNotification('success', 'Integrazione Supabase disattivata (torna in locale).');
    }
  };

  // CSV download template
  const handleDownloadCsvTemplate = () => {
    const csvHeaders = 'id,nome,cognome,email,telefono,data_nascita,note,creato_il\n';
    const csvDemoRows = [
      'cli_demo_1,Mario,Rossi,mario.rossi@gmail.com,333112233,1988-06-15,Atleta di Calisthenics avanzato,2026-06-15T08:00:00.000Z',
      'cli_demo_2,Chiara,Verdi,chiara.verdi@gmail.com,349998877,1992-04-20,Pilates e riatletizzazione post-infortunio,2026-06-16T10:30:00.000Z',
      'cli_demo_3,Elena,Sincronizzata,elena.sheet@gmail.com,392112233,1995-10-12,Atleta registrata tramite foglio Google,2026-06-17T11:26:00.000Z'
    ].join('\n');

    const csvContent = csvHeaders + csvDemoRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'flux_atleti_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerNotification('success', 'Template scaricato! Copia queste intestazioni nel tuo Google Sheet.');
  };

  return (
    <div id="impostazioni-console" className="space-y-8 max-w-5xl mx-auto px-4 py-2">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-sans flex items-center gap-2">
          <Settings className="w-8 h-8 text-[#113f3d]" /> Impostazioni Studio
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Configura l'anagrafica fiscale della palestra, gestisci gli account abilitati e vedi i listini predefiniti.
        </p>
      </div>

      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border text-sm flex items-center gap-2 font-medium ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}
        >
          <span>{notification.text}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Panel 1: Gym Metadata */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-50">
            <Building2 className="w-5 h-5 text-teal-600" /> Dati Anagrafici & Ricevute
          </h3>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome Palestra / Associazione</label>
              <input
                type="text"
                required
                value={editingImpostazioni.nome}
                onChange={(e) => setEditingImpostazioni({ ...editingImpostazioni, nome: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-sm text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Indirizzo Sede (fiscale/operativo)</label>
              <textarea
                required
                rows={2}
                value={editingImpostazioni.indirizzo}
                onChange={(e) => setEditingImpostazioni({ ...editingImpostazioni, indirizzo: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-sm text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Partita IVA / Codice Fiscale</label>
              <input
                type="text"
                required
                value={editingImpostazioni.piva}
                onChange={(e) => setEditingImpostazioni({ ...editingImpostazioni, piva: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-sm text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Testo Intestazione (Brand Name)</label>
              <input
                type="text"
                required
                value={editingImpostazioni.logo}
                onChange={(e) => setEditingImpostazioni({ ...editingImpostazioni, logo: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-sm text-slate-800 font-medium"
              />
            </div>

            {/* Logo Image Upload Field */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase">Logo Grafico Azienda (Immagine)</label>
              
              {editingImpostazioni.logo_url ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center gap-3 relative overflow-hidden group">
                  <img 
                    src={editingImpostazioni.logo_url} 
                    alt="Logo Aziendale" 
                    className="max-h-24 max-w-full object-contain rounded-lg shadow-sm bg-white p-2 border" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-[10px] text-slate-400 font-mono font-semibold">Immagine caricata correttamente.</div>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Rimuovi Logo
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 hover:border-[#113f3d] rounded-2xl p-6 text-center transition-all relative cursor-pointer bg-slate-50/50 group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1 text-slate-500">
                    <Building2 className="w-8 h-8 text-slate-400 mx-auto group-hover:scale-105 transition-transform" />
                    <p className="text-xs font-bold text-[#113f3d]">Carica foto o file del logo</p>
                    <p className="text-[10px] text-slate-400">Trascina qui o clicca per sfogliare (PNG, JPG, max 2MB)</p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-[#113f3d] hover:bg-teal-900 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer w-full justify-center"
            >
              <Save className="w-4 h-4" /> Salva Configurazione
            </button>
          </form>
        </div>

        {/* Panel 2: Staff Accounts management */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-50">
            <Users className="w-5 h-5 text-[#84e062]" /> Gestione Staff & Accessi
          </h3>

          {/* List of current staff */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase">Membri Abilitati: ({allStaff.length})</label>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
              {allStaff.map((st) => (
                <div key={st.id} className="p-3 bg-slate-50/50 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block text-sm">{st.nome}</span>
                    <span className="text-slate-500 font-mono">{st.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.ruolo === 'admin' ? 'bg-[#113f3d]/10 text-[#113f3d]' : 'bg-slate-100 text-slate-600'}`}>
                      {st.ruolo.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteStaff(st.id)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 hover:text-rose-900 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
                      title="Rimuovi accesso per questo membro dello staff"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      Rimuovi Accesso
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form adding new staff */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-teal-600" /> Aggiungi Membro Staff
            </h4>

            <form onSubmit={handleAddStaff} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Nome cognitivo"
                    value={newStaffNome}
                    onChange={(e) => setNewStaffNome(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <select
                    value={newStaffRuolo}
                    onChange={(e) => setNewStaffRuolo(e.target.value as 'staff' | 'admin')}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs text-slate-700 font-medium"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Amministratore</option>
                  </select>
                </div>
              </div>

              <div>
                <input
                  type="email"
                  required
                  placeholder="email@palestra.it"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs text-slate-800 font-medium font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-[#113f3d] hover:bg-teal-900 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                Abilita email per l'accesso
              </button>
            </form>
          </div>
        </div>

        {/* Panel 3: Pre-set Subscription Types list (Editable) */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm md:col-span-2 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-50 flex-wrap gap-2">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Gem className="w-5 h-5 text-indigo-600" /> Listini & Tipologie Abbonamento Predefinite
            </h3>
            <button
              onClick={() => setShowAddPresetForm(!showAddPresetForm)}
              className="px-3 py-1.5 bg-[#113f3d] hover:bg-teal-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> {showAddPresetForm ? 'Chiudi form' : 'Nuovo Pacchetto'}
            </button>
          </div>

          <p className="text-slate-500 text-xs">
            I seguenti pacchetti sono registrati nel sistema e vengono suggeriti automaticamente in fase di vendita di un nuovo abbonamento, associando i relativi prezzi ed importi automatici. Puoi modificarli, aggiungerne nuovi o rimuoverli.
          </p>

          {/* Add Preset Form */}
          {showAddPresetForm && (
            <form onSubmit={handleApplyAddPreset} className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Nome Pacchetto</label>
                <input
                  type="text"
                  required
                  placeholder="es. Trimestrale"
                  value={newPresetTipo}
                  onChange={(e) => setNewPresetTipo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Durata (Mesi)</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={60}
                  placeholder="es. 3"
                  value={newPresetDurata}
                  onChange={(e) => setNewPresetDurata(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Prezzo (€)</label>
                <input
                  type="number"
                  required
                  min={0}
                  step={0.01}
                  placeholder="es. 150"
                  value={newPresetPrezzo}
                  onChange={(e) => setNewPresetPrezzo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#113f3d] text-xs text-slate-800 font-medium"
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer h-[34px]"
                >
                  <Plus className="w-3.5 h-3.5" /> Aggiungi Pacchetto
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {impostazioni?.abbonamenti_predefiniti.map((preset, index) => {
              const isEditing = editingPresetIndex === index;
              return (
                <div key={index} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col justify-between gap-3 relative group">
                  
                  {isEditing ? (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Nome</label>
                        <input
                          type="text"
                          required
                          value={editingPresetTipo}
                          onChange={(e) => setEditingPresetTipo(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Mesi</label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={editingPresetDurata}
                            onChange={(e) => setEditingPresetDurata(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Prezzo (€)</label>
                          <input
                            type="number"
                            required
                            min={0}
                            step={0.1}
                            value={editingPresetPrezzo}
                            onChange={(e) => setEditingPresetPrezzo(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 pt-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEditPreset(index)}
                          className="p-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> Salva
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPresetIndex(null)}
                          className="p-1 px-2 text-slate-500 hover:bg-slate-100 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <X className="w-3 h-3" /> Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#84e062]/20 text-[#113f3d] flex items-center justify-center font-black shrink-0 text-xs">
                          {preset.durata_mesi}M
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 text-sm truncate">{preset.tipo}</h4>
                          <p className="text-slate-500 text-[10px] font-mono leading-none mt-0.5">{preset.durata_mesi} {preset.durata_mesi === 1 ? 'Mese' : 'Mesi'} di validità</p>
                          <p className="text-[#113f3d]/90 font-extrabold text-base mt-2 font-sans">€ {preset.prezzo.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1 sticky top-full mt-2 pt-2 border-t border-slate-100 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleStartEditPreset(index)}
                          className="p-1 px-2 hover:bg-teal-50 hover:text-[#113f3d] text-slate-500 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" /> Modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(index)}
                          className="p-1 px-2 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded text-[10px] font-bold flex items-center gap-0.5 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Rimuovi
                        </button>
                      </div>
                    </>
                  )}

                </div>
              );
            })}
          </div>
        </div>

        {/* --- CLOUD INTEGRATIONS SUITE (SUPABASE) --- */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm md:col-span-2 space-y-8 mt-4 font-sans">
          
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-[#113f3d] flex items-center gap-2.5">
              <Database className="w-6 h-6 text-emerald-600" /> Integrazione Cloud Supabase
            </h3>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
              Estendi la potenza del tuo gestionale collegando un database cloud **Supabase** per l'archiviazione remota e avere il pieno controllo dei tuoi dati.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            
            {/* LEFT COLUMN: SUPABASE CLOUD DATABASE */}
            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                    <Database className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="font-extrabold text-[#113f3d] text-sm leading-tight">Integrazione Supabase</h4>
                    <span className="text-[10px] text-slate-400 font-medium">Database PostgreSQL Remoto</span>
                  </div>
                </div>
                
                {/* Switch State */}
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={isSupabaseActive}
                    onChange={(e) => handleToggleSupabase(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Step 1: Input Credentials */}
              <div className="space-y-3.5">
                <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <span>Step 1:</span> Credenziali Client-Side
                </h5>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SUPABASE_URL</label>
                    <input 
                      type="text"
                      placeholder="https://your-project.supabase.co"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl text-xs font-medium text-slate-700 font-mono"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SUPABASE_ANON_KEY (Chiave Pubblica)</label>
                    <input 
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl text-xs font-medium text-slate-700 font-mono"
                    />
                    <p className="text-[9px] text-slate-400 mt-1 italic">
                      ⚠️ Configurazione protetta: non viene richiesto il Service Role Secret. La connessione opera interamente sul client dell'utente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: SQL Scripts copy section */}
              <div className="space-y-2">
                <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <span>Step 2:</span> Configurazione Tabelle (SQL Editor)
                </h5>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Copia ed esegui questa query nello **SQL Editor** del tuo pannello Supabase Cloud per predisporre le tabelle necessarie:
                </p>

                <div className="relative group">
                  <pre className="p-3.5 bg-slate-900 text-slate-300 font-mono text-[10px] rounded-2xl overflow-x-auto max-h-36 leading-relaxed border border-slate-950 shadow-inner">
{`-- 1. Tabella Clienti (Atleti)
CREATE TABLE IF NOT EXISTS clienti (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  data_nascita DATE,
  note TEXT,
  creato_il TIMESTAMPTZ DEFAULT NOW()
);

-- Attiva i permessi pubblici di lettura/scrittura per la Anon Key
ALTER TABLE clienti DISABLE ROW LEVEL SECURITY;`}
                  </pre>
                  
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS clienti (\n  id TEXT PRIMARY KEY,\n  nome TEXT NOT NULL,\n  cognome TEXT NOT NULL,\n  email TEXT,\n  telefono TEXT,\n  data_nascita DATE,\n  note TEXT,\n  creato_il TIMESTAMPTZ DEFAULT NOW()\n);\n\nALTER TABLE clienti DISABLE ROW LEVEL SECURITY;`);
                      triggerNotification('success', 'Codice SQL copiato negli appunti! Incollalo sotto lo SQL Editor di Supabase.');
                    }}
                    className="absolute top-2.5 right-2.5 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                    title="Copia codice SQL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Step 3: Connection test button */}
              <div className="space-y-3 pt-2">
                <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <span>Step 3:</span> Verifica e Salva
                </h5>
                
                <button
                  type="button"
                  onClick={handleTestAndSaveSupabase}
                  disabled={supabaseStatus === 'testing'}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shadow-emerald-200"
                >
                  {supabaseStatus === 'testing' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connessione in corso...
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5" /> Controlla Connessione e Salva
                    </>
                  )}
                </button>

                {/* Connection Feedback Message */}
                {supabaseStatus === 'success' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-800 leading-normal ring-2 ring-emerald-50">
                    <strong>✅ Sincronizzazione Riuscita!</strong> Il gestionale locale è ora connesso correttamente al tuo cluster Supabase remoto.
                  </div>
                )}

                {supabaseStatus === 'warning' && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 leading-normal ring-2 ring-amber-55">
                    <strong>⚠️ Connessione Stabilita!</strong> Tuttavia, la tabella <code className="font-mono bg-white/60 px-1 py-0.5 rounded text-amber-900 border">clienti</code> non esiste ancora nell'istanza. Esegui prima lo script SQL fornito nello SQL Editor di Supabase, poi riprova il controllo connessione.
                  </div>
                )}

                {supabaseStatus === 'error' && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-800 leading-normal">
                    <strong className="block text-rose-900">❌ Connessione Fallita!</strong>
                    {supabaseErrorDetails || "Verifica che il Project URL e la Anon Key di Supabase inseriti siano validi e privi di spazi."}
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* CUSTOM CONFIRMATION DIALOG */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden border border-slate-105 shadow-2xl font-sans"
          >
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              
              <div className="text-center space-y-1.5">
                <h3 className="font-extrabold text-[#113f3d] text-base">
                  {confirmDialog.title}
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={confirmDialog.onConfirm}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm shadow-rose-200"
                >
                  {confirmDialog.actionLabel || "Procedi"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
