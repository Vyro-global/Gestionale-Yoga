/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pagamento.tsx — Pagina di abbonamento mostrata agli utenti loggati
 * che non hanno ancora un abbonamento attivo.
 * Reindirizza a Stripe Checkout per il pagamento mensile.
 */

import React, { useState } from 'react';
import { CreditCard, Shield, ArrowRight, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface PagamentoProps {
  token: string;
  onSubscriptionActivated: () => void;
}

const PREZZO_MENSILE = 29; // EUR

export default function Pagamento({ token, onSubscriptionActivated }: PagamentoProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          successUrl: `${window.location.origin}/?payment=success`,
          cancelUrl: `${window.location.origin}/?payment=cancelled`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore nella creazione della sessione di pagamento');
      }

      if (data.url) {
        // Reindirizza a Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('URL di checkout non ricevuto dal server');
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'avvio del pagamento');
      setLoading(false);
    }
  };

  return (
    <div id="pagamento-screen" className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#113f3d]/10 border border-[#113f3d]/20 text-[#113f3d] text-xs font-mono mb-4">
            <Sparkles className="w-3.5 h-3.5" /> ABBONAMENTO RICHIESTO
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            Attiva il tuo abbonamento
          </h1>
          <p className="text-slate-600 text-sm mt-2 max-w-sm mx-auto">
            Per accedere a FluxGestionale e gestire la tua palestra, attiva l'abbonamento mensile.
          </p>
        </div>

        {/* Pricing Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden"
        >
          {/* Card top accent */}
          <div className="bg-[#113f3d] p-4 text-center">
            <span className="text-white/80 text-xs font-mono tracking-widest uppercase">Piano Mensile</span>
          </div>

          <div className="p-8 text-center">
            <div className="mb-6">
              <span className="text-5xl font-extrabold text-slate-900">€{PREZZO_MENSILE}</span>
              <span className="text-slate-500 text-lg">/mese</span>
            </div>
            <p className="text-slate-600 text-sm mb-8">
              Accesso completo a tutte le funzionalità del gestionale.
              Cancella in qualsiasi momento.
            </p>

            {/* Feature list */}
            <div className="space-y-3 text-left mb-8">
              {[
                'Gestione anagrafiche clienti illimitata',
                'Calendario lezioni e presenze',
                'Fatturazione e ricevute PDF',
                'Assistente AI FluxGPT integrato',
                'Pipeline acquisizione clienti',
              ].map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#84e062] mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-700">{feature}</span>
                </div>
              ))}
            </div>

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

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-4 bg-[#113f3d] hover:bg-teal-900 text-white rounded-2xl font-bold text-base shadow-lg shadow-[#113f3d]/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                'Reindirizzamento a Stripe...'
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Abbonati ora</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 mt-4 text-slate-400 text-xs">
              <Shield className="w-3.5 h-3.5" />
              <span>Pagamento sicuro gestito da Stripe</span>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <p className="text-slate-400 text-[10px] font-mono mt-6 text-center uppercase tracking-widest leading-none">
          Flux Gestionale · Pagamento Sicuro · Powered by Stripe
        </p>
      </motion.div>
    </div>
  );
}
