/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Staff } from '../types.js';
import { LogIn, Key, Compass, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess: (user: Staff) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const response = await fetch('/api/staff');
        if (response.ok) {
          const data = await response.json();
          // Show only staff added in "membri abilitati" who are NOT admin
          const filtered = data.filter((st: Staff) => st.ruolo !== 'admin');
          setStaffList(filtered);
        }
      } catch (err) {
        console.error("Errore caricamento staff", err);
      }
    };
    loadStaff();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Errore durante l\'autenticazione');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Email non registrata nel database dello staff.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-screen" className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden"
      >
        {/* Banner with logo */}
        <div className="bg-[#113f3d] p-8 text-center relative overflow-hidden">
          {/* Decorative design curves */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#84e062] rounded-full filter blur-3xl opacity-20 -mr-10 -mt-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-500 rounded-full filter blur-3xl opacity-10 -ml-10 -mb-10" />

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/40 border border-teal-800 text-[#84e062] text-xs font-mono mb-4">
            <Compass className="w-3.5 h-3.5 animate-spin-slow" /> PORTAL DISPOSITIVI STAFF
          </div>

          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl font-bold tracking-tight text-white font-sans">
              Flux<span className="text-[#84e062]">Gestionale</span>
            </span>
          </div>
          <p className="text-teal-200/80 text-xs mt-2 font-mono">GESTIONE PALESTRA YOGA, PILATES & DANZA</p>
        </div>

        {/* Form area */}
        <div className="p-8">
          <p className="text-slate-600 text-sm text-center mb-6">
            Questo portale è riservato esclusivamente allo staff interno per la gestione degli atleti.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Indirizzo Email Staff
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@palestra.it"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] focus:bg-white text-slate-800 text-sm font-medium transition-all"
                />
                <LogIn className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-rose-600 text-xs"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 bg-[#113f3d] hover:bg-teal-900 text-white rounded-2xl font-semibold text-sm shadow-lg shadow-[#113f3d]/15 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Verifica credenziali in corso...' : 'Accedi al gestionale'}
            </button>
          </form>

          {/* Quick Access Area for Demo */}
          {staffList.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                <Key className="w-3.5 h-3.5" /> ACCESSO RAPIDO DEMO
              </div>
              
              <div className="space-y-2">
                {staffList.map((st) => (
                  <button
                    key={st.email}
                    type="button"
                    onClick={() => setEmail(st.email)}
                    className="w-full p-3 text-left bg-slate-50 hover:bg-teal-50/50 border border-slate-100 hover:border-teal-100 rounded-xl text-xs font-medium text-slate-700 flex items-center justify-between transition-all group cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-950 block">{st.nome}</span>
                      <span className="text-slate-500 font-mono text-[10px]">{st.email}</span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-[#84e062] opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <p className="text-slate-400 text-[10px] font-mono mt-6 uppercase tracking-widest leading-none">
        Flux Gestionale Studio Intranet System © 2026
      </p>
    </div>
  );
}
