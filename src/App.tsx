/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Staff, Cliente, Abbonamento, Fattura } from './types.js';
import Login from './components/Login.js';
import DashboardView from './components/DashboardView.js';
import ClientiView from './components/ClientiView.js';
import AbbonamentiView from './components/AbbonamentiView.js';
import CalendarioView from './components/CalendarioView.js';
import PresenzeView from './components/PresenzeView.js';
import FattureView from './components/FattureView.js';
import AIChatView from './components/AIChatView.js';
import ImpostazioniView from './components/ImpostazioniView.js';

import { 
  Building2, Users, Calendar, Clock, DollarSign, Bot, Settings, LogOut, 
  Sparkles, CheckSquare, User, Menu, X, Landmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  
  // Real-time notification counters
  const [alertUnpaidCount, setAlertUnpaidCount] = useState(0);
  const [alertExpiringCount, setAlertExpiringCount] = useState(0);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [impostazioni, setImpostazioni] = useState<any>(null);

  // Check if staff session is saved in local storage
  useEffect(() => {
    const saved = localStorage.getItem('fluxcrm_session');
    if (saved) {
      try {
        setStaff(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('fluxcrm_session');
      }
    }
  }, []);

  const fetchImpostazioni = async () => {
    try {
      const res = await fetch('/api/impostazioni');
      if (res.ok) {
        const data = await res.json();
        setImpostazioni(data);
      }
    } catch (e) {
      console.error("Errore fetch impostazioni", e);
    }
  };

  // Sync warning alert badges
  const syncAlertBadges = async () => {
    try {
      const getJSON = (url: string) => fetch(url).then(r => r.json());
      const [abb, fat] = await Promise.all([
        getJSON('/api/abbonamenti'),
        getJSON('/api/fatture')
      ]);

      // Calculate unpaid invoices
      const unpaid = fat.filter((f: Fattura) => f.stato_pagamento === 'da pagare' || f.stato_pagamento === 'scaduto').length;
      setAlertUnpaidCount(unpaid);

      // Calculate expiring abbonamenti within 7 days
      const todayVal = new Date().getTime();
      const sevenDaysVal = todayVal + 7 * 24 * 60 * 60 * 1000;
      const expiring = abb.filter((a: Abbonamento) => {
        const endVal = new Date(a.data_fine).getTime();
        return a.stato === 'attivo' && endVal >= todayVal && endVal <= sevenDaysVal;
      }).length;
      setAlertExpiringCount(expiring);

    } catch (e) {
      console.error("Errore sincro badge", e);
    }
  };

  useEffect(() => {
    if (staff) {
      syncAlertBadges();
      fetchImpostazioni();
    }
  }, [staff]);

  const handleLoggedSuccess = (loggedInStaff: Staff) => {
    setStaff(loggedInStaff);
    localStorage.setItem('fluxcrm_session', JSON.stringify(loggedInStaff));
  };

  const handleLogout = () => {
    localStorage.removeItem('fluxcrm_session');
    setStaff(null);
  };

  const handleSettingsUpdated = () => {
    syncAlertBadges();
    fetchImpostazioni();
  };

  if (!staff) {
    return <Login onLoginSuccess={handleLoggedSuccess} />;
  }

  // Dictionary of dynamic navigation tabs
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Landmark className="w-4 h-4" /> },
    { id: 'clienti', label: 'Anagrafiche Clienti', icon: <Users className="w-4 h-4" /> },
    { id: 'abbonamenti', label: 'Gestione Vendite', icon: <CheckSquare className="w-4 h-4" />, badge: alertExpiringCount },
    { id: 'calendario', label: 'Orario & Calendario', icon: <Calendar className="w-4 h-4" /> },
    { id: 'presenze', label: 'Registro Presenze', icon: <Clock className="w-4 h-4" /> },
    { id: 'fatture', label: 'Ricevute & Fatture', icon: <DollarSign className="w-4 h-4" />, badge: alertUnpaidCount },
    { id: 'ai', label: 'Flux AI Copilot', icon: <Bot className="w-4 h-4" />, highlight: true },
    { id: 'impostazioni', label: 'Impostazioni', icon: <Settings className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen md:h-screen bg-slate-50/50 text-slate-800 flex flex-col md:flex-row antialiased md:overflow-hidden overflow-x-hidden">
      
      {/* 1. SIDEBAR NAVIGATION WRAPPER FOR DESKTOP */}
      <aside className="w-72 bg-[#113f3d] text-white shrink-0 hidden md:flex flex-col justify-between p-6 shadow-2xl relative h-full overflow-y-auto pb-8">
        <div className="space-y-8">
          {/* Brand Identity / Flowing Typography Header */}
          <div className="flex items-center gap-3">
            {impostazioni?.logo_url ? (
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg shrink-0 overflow-hidden p-1">
                <img src={impostazioni.logo_url} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#84e062] to-lime-300 flex items-center justify-center shadow-lg shadow-[#84e062]/10 shrink-0">
                <Building2 className="w-5 h-5 text-[#113f3d]" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-extrabold tracking-tight font-sans text-white uppercase truncate max-w-[160px]">
                {impostazioni?.logo || 'FluxGestionale'}
              </h1>
              <span className="text-[10px] font-mono tracking-widest text-[#84e062] block font-semibold uppercase truncate max-w-[160px]">
                {impostazioni?.nome || 'CLUB MANAGER AI'}
              </span>
            </div>
          </div>

          {/* Tab Button list */}
          <nav className="space-y-1.5">
            {navigationItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold font-sans tracking-wide transition-all duration-200 cursor-pointer ${
                    isActive 
                      ? 'bg-white/10 text-white shadow-inner border-l-4 border-l-[#84e062]' 
                      : item.highlight
                      ? 'text-[#84e062] hover:bg-white/5'
                      : 'text-teal-100/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>

                  {/* Warning badges display */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-rose-500 text-white font-mono font-bold text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* LOGGED STAFF IN BRIEF */}
        <div className="pt-6 border-t border-teal-850 space-y-4">
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
            <div className="w-9 h-9 bg-[#84e062]/20 text-[#84e062] font-extrabold font-mono text-xs rounded-xl flex items-center justify-center shrink-0">
              {staff.nome ? staff.nome.split(/\s+/).map((n: string) => n.charAt(0)).slice(0, 2).join('').toUpperCase() : 'U'}
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{staff.nome || 'Staff'}</p>
              <p className="text-[10px] font-mono text-teal-300 tracking-wider truncate block font-bold mt-0.5 uppercase">{staff.ruolo}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-350 hover:text-rose-200 rounded-xl text-[10px] font-mono font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> ESCI DAL PORTALE
          </button>
        </div>
      </aside>

      {/* 2. MOBILE RESPONSIVE NAV BAR HEADER */}
      <header className="md:hidden bg-[#113f3d] text-white p-4 flex items-center justify-between border-b border-teal-850 shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          {impostazioni?.logo_url ? (
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center p-0.5 overflow-hidden shrink-0">
              <img src={impostazioni.logo_url} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#84e062] flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-[#113f3d]" />
            </div>
          )}
          <span className="font-extrabold tracking-tight text-white text-base truncate max-w-[170px]">
            {impostazioni?.logo || 'FluxGestionale'}
          </span>
        </div>

        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 px-2.5 bg-white/5 rounded-lg border border-white/10"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile menu drop-down Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-x-0 top-16 bg-[#113f3d] text-white p-6 border-b border-teal-850 z-30 shadow-2xl space-y-4"
          >
            <nav className="space-y-1">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold font-sans cursor-pointer ${
                    currentTab === item.id 
                      ? 'bg-white/10 text-white shadow-inner border-l-4 border-l-[#84e062]' 
                      : 'text-teal-100/70 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-rose-500 text-white font-mono font-bold text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="pt-4 border-t border-teal-850 flex justify-between items-center">
              <span className="text-[10px] text-teal-300 font-mono">Simulato: {staff.nome}</span>
              <button onClick={handleLogout} className="text-[10px] font-mono text-rose-350 uppercase">Disconnetti</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. MAIN WORKSPACE VIEW ROUTER */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {currentTab === 'dashboard' && <DashboardView onNavigateTo={(tab) => setCurrentTab(tab)} />}
            {currentTab === 'clienti' && <ClientiView onClientsUpdated={syncAlertBadges} />}
            {currentTab === 'abbonamenti' && <AbbonamentiView onSubscriptionsUpdated={syncAlertBadges} />}
            {currentTab === 'calendario' && <CalendarioView />}
            {currentTab === 'presenze' && <PresenzeView />}
            {currentTab === 'fatture' && <FattureView />}
            {currentTab === 'ai' && <AIChatView />}
            {currentTab === 'impostazioni' && <ImpostazioniView onSettingsUpdated={handleSettingsUpdated} currentStaffId={staff?.id} />}
          </motion.div>
        </AnimatePresence>
      </main>

    </div>
  );
}
