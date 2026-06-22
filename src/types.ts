/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Cliente {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  data_nascita: string; // YYYY-MM-DD
  note: string;
  creato_il: string;
}

export interface Abbonamento {
  id: string;
  cliente_id: string;
  tipo: string; // es. "Mensile", "Trimestrale", "Annuale"
  data_inizio: string;
  data_fine: string;
  stato: 'attivo' | 'scaduto' | 'sospeso';
  importo: number;
  creato_il: string;
}

export interface Lezione {
  id: string;
  titolo: string;
  istruttore: string;
  giorno_settimana: string; // Lunedì, Martedì, ecc.
  orario: string; // es. "18:30"
  posti_disponibili: number;
  durata?: string; // es. "1 ora", "2 ore"
  creato_il: string;
}

export interface Presenza {
  id: string;
  cliente_id: string;
  lezione_id: string;
  data_presenza: string; // YYYY-MM-DD
}

export interface Fattura {
  id: string;
  cliente_id: string;
  numero_fattura: string; 
  descrizione: string;
  importo: number;
  data_emissione: string;
  data_scadenza: string;
  stato_pagamento: 'da pagare' | 'pagato' | 'scaduto';
  file_url: string; // Base64 data URI or local endpoint
  creato_il: string;
}

export interface Staff {
  id: string;
  email: string;
  nome: string;
  ruolo: 'staff' | 'admin';
}

export interface Promemoria {
  id: string;
  testo: string;
  data_creazione: string;
}

export interface Impostazioni {
  nome: string;
  indirizzo: string;
  piva: string;
  logo: string;
  logo_url?: string;
  abbonamenti_predefiniti: { tipo: string; prezzo: number; durata_mesi: number }[];
}

export interface PipelineLead {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  valore_trattativa: number;
  note: string;
  data_creazione: string;
  colonna_id: string;
}

export interface PipelineColumn {
  id: string;
  titolo: string;
  ordine: number;
}

export interface GestionaleData {
  clienti: Cliente[];
  abbonamenti: Abbonamento[];
  lezioni: Lezione[];
  presenze: Presenza[];
  fatture: Fattura[];
  staff: Staff[];
  promemoria: Promemoria[];
  impostazioni: Impostazioni;
  pipeline_leads?: PipelineLead[];
  pipeline_colonne?: PipelineColumn[];
}
