/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Staff } from '../types.js';
import { LogIn, Mail, Key, Compass, AlertCircle, Chrome } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess: (user: Staff, subscriptionActive: boolean) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  /** Email + Password login */
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;
      if (!data.user) throw new Error('Login fallito: nessun utente restituito.');

      // Get staff info + subscription status from server
      await finalizeLogin();
    } catch (err: any) {
      setError(err.message || 'Credenziali non valide. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  /** Google OAuth login */
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (oauthError) throw oauthError;
      // Page will redirect to Google — no further action here
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'accesso con Google.');
      setGoogleLoading(false);
    }
  };

  /** After Supabase auth, verify staff + subscription on the server */
  const finalizeLogin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sessione non trovata dopo il login.');

    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Accesso negato dal server.');
    }

    const { staff, subscriptionActive } = await res.json();
    onLoginSuccess(staff, subscriptionActive);
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
            <Compass className="w-3.5 h-3.5" /> PORTALE RISERVATO
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
            Accedi con le tue credenziali per gestire il centro.
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-rose-600 text-xs mb-4"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Email + Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Email
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
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#113f3d] focus:bg-white text-slate-800 text-sm font-medium transition-all"
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 bg-[#113f3d] hover:bg-teal-900 text-white rounded-2xl font-semibold text-sm shadow-lg shadow-[#113f3d]/15 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                'Verifica in corso...'
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Accedi
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-medium text-slate-400 uppercase">oppure</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-2xl font-semibold text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {googleLoading ? (
              'Reindirizzamento a Google...'
            ) : (
              <>
                <Chrome className="w-4 h-4" /> Accedi con Google
              </>
            )}
          </button>
        </div>
      </motion.div>

      <p className="text-slate-400 text-[10px] font-mono mt-6 uppercase tracking-widest leading-none">
        Flux Gestionale Studio Intranet System © 2026
      </p>
    </div>
  );
}
