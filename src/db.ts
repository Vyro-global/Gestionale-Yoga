/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { GestionaleData, Cliente, Abbonamento, Lezione, Presenza, Fattura, Staff, Promemoria, Impostazioni, PipelineLead, PipelineColumn, StripeSubscription } from './types.js';

const DB_FILE = path.join(process.cwd(), 'db.json');

// Helper to generate UUIDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Initial Mock Data
const INITIAL_DATA: GestionaleData = {
  clienti: [
    {
      id: "cli_1",
      nome: "Giulia",
      cognome: "Bianchi",
      email: "giulia.bianchi@gmail.com",
      telefono: "+39 333 1234567",
      data_nascita: "1994-05-12",
      note: "Soffre di un leggero mal di schiena a livello lombare, fare attenzione nel Pilates.",
      creato_il: "2026-01-10T10:00:00Z"
    },
    {
      id: "cli_2",
      nome: "Mario",
      cognome: "Rossi",
      email: "mario.rossi@yahoo.it",
      telefono: "+39 347 9876543",
      data_nascita: "1988-09-22",
      note: "Preferisce Hatha Yoga energetico. Sempre molto puntuale.",
      creato_il: "2026-02-15T11:30:00Z"
    },
    {
      id: "cli_3",
      nome: "Sandra",
      cognome: "Neri",
      email: "sandra.neri@icloud.com",
      telefono: "+39 328 1122334",
      data_nascita: "1992-12-05",
      note: "Pratica danza da molti anni, molto flessibile.",
      creato_il: "2026-03-01T09:15:00Z"
    },
    {
      id: "cli_4",
      nome: "Roberto",
      cognome: "Verdi",
      email: "roberto.verdi@gmail.com",
      telefono: "+39 349 5554433",
      data_nascita: "1980-04-18",
      note: "Iniziato Yoga per rilassamento aziendale.",
      creato_il: "2026-04-20T17:45:00Z"
    },
    {
      id: "cli_5",
      nome: "Sofia",
      cognome: "Moretti",
      email: "sofia.moretti@virgilio.it",
      telefono: "+39 335 8899001",
      data_nascita: "1995-07-30",
      note: "Cliente inattiva da contattare. Non risponde all'ultima email di feedback.",
      creato_il: "2026-02-28T14:20:00Z"
    }
  ],
  abbonamenti: [
    {
      id: "abb_1",
      cliente_id: "cli_1",
      tipo: "Annuale",
      data_inizio: "2026-01-15",
      data_fine: "2027-01-14",
      stato: "attivo",
      importo: 750.00,
      creato_il: "2026-01-15T10:15:00Z"
    },
    {
      id: "abb_2",
      cliente_id: "cli_2",
      tipo: "Mensile",
      data_inizio: "2026-05-15",
      data_fine: "2026-06-15", // Scaduto (oggi è 18 giugno 2026)
      stato: "scaduto",
      importo: 80.00,
      creato_il: "2026-05-15T12:00:00Z"
    },
    {
      id: "abb_3",
      cliente_id: "cli_3",
      tipo: "Trimestrale",
      data_inizio: "2026-03-22",
      data_fine: "2026-06-22", // In scadenza entro 7 giorni!
      stato: "attivo",
      importo: 220.00,
      creato_il: "2026-03-22T09:30:00Z"
    },
    {
      id: "abb_4",
      cliente_id: "cli_4",
      tipo: "Mensile",
      data_inizio: "2026-06-01",
      data_fine: "2026-07-01",
      stato: "attivo",
      importo: 80.00,
      creato_il: "2026-06-01T18:00:00Z"
    }
  ],
  lezioni: [
    {
      id: "lez_1",
      titolo: "Yoga Vinyasa Flow",
      istruttore: "Lara Croft",
      giorno_settimana: "Lunedì",
      orario: "18:00",
      posti_disponibili: 15,
      creato_il: "2026-01-01T08:00:00Z"
    },
    {
      id: "lez_2",
      titolo: "Pilates Avanzato",
      istruttore: "Marco Polo",
      giorno_settimana: "Martedì",
      orario: "19:30",
      posti_disponibili: 12,
      creato_il: "2026-01-01T08:00:00Z"
    },
    {
      id: "lez_3",
      titolo: "Danza Contemporanea",
      istruttore: "Elena Sofia",
      giorno_settimana: "Mercoledì",
      orario: "18:30",
      posti_disponibili: 18,
      creato_il: "2026-01-01T08:00:00Z"
    },
    {
      id: "lez_4",
      titolo: "Hatha Yoga Dolce",
      istruttore: "Lara Croft",
      giorno_settimana: "Giovedì",
      orario: "17:30",
      posti_disponibili: 15,
      creato_il: "2026-01-01T08:00:00Z"
    },
    {
      id: "lez_5",
      titolo: "Power Pilates",
      istruttore: "Marco Polo",
      giorno_settimana: "Venerdì",
      orario: "13:00",
      posti_disponibili: 10,
      creato_il: "2026-01-01T08:00:00Z"
    }
  ],
  presenze: [
    // Giulia Bianchi
    { id: "pre_1", cliente_id: "cli_1", lezione_id: "lez_1", data_presenza: "2026-06-15" },
    { id: "pre_2", cliente_id: "cli_1", lezione_id: "lez_4", data_presenza: "2026-06-18" },
    // Roberto Verdi
    { id: "pre_3", cliente_id: "cli_4", lezione_id: "lez_1", data_presenza: "2026-06-15" },
    // Sandra Neri
    { id: "pre_4", cliente_id: "cli_3", lezione_id: "lez_3", data_presenza: "2026-06-17" },
    // Sofia Moretti has last attendance in May
    { id: "pre_5", cliente_id: "cli_5", lezione_id: "lez_2", data_presenza: "2026-05-12" }
  ],
  fatture: [
    {
      id: "fat_1",
      cliente_id: "cli_1",
      numero_fattura: "0001/2026",
      descrizione: "Abbonamento annuale yoga & pilates",
      importo: 750.00,
      data_emissione: "2026-01-15",
      data_scadenza: "2026-01-30",
      stato_pagamento: "pagato",
      file_url: "",
      creato_il: "2026-01-15T10:30:00Z"
    },
    {
      id: "fat_2",
      cliente_id: "cli_4",
      numero_fattura: "0002/2026",
      descrizione: "Mese di Giugno Yoga",
      importo: 80.00,
      data_emissione: "2026-06-01",
      data_scadenza: "2026-06-15",
      stato_pagamento: "pagato",
      file_url: "",
      creato_il: "2026-06-01T18:10:00Z"
    },
    {
      id: "fat_3",
      cliente_id: "cli_3",
      numero_fattura: "0003/2026",
      descrizione: "Integrazione Trimestrale Pilates",
      importo: 220.00,
      data_emissione: "2026-03-22",
      data_scadenza: "2026-04-05",
      stato_pagamento: "pagato",
      file_url: "",
      creato_il: "2026-03-22T09:40:00Z"
    },
    {
      id: "fat_4",
      cliente_id: "cli_2",
      numero_fattura: "0004/2026",
      descrizione: "Rinnovo abbonamento mensile",
      importo: 80.00,
      data_emissione: "2026-05-15",
      data_scadenza: "2026-05-30",
      stato_pagamento: "scaduto",
      file_url: "",
      creato_il: "2026-05-15T12:05:00Z"
    }
  ],
  staff: [
    { id: "st_1", email: "amministrazione.vyroglobal@gmail.com", nome: "Admin Vyro", ruolo: "admin" },
    { id: "st_2", email: "collega.yoga@gmail.com", nome: "Francesca Staff", ruolo: "staff" }
  ],
  promemoria: [
    {
      id: "prom_1",
      testo: "Riepilogo giornaliero: Oggi hai 1 abbonamento in scadenza (Sandra Neri, il 22/06), 1 fattura scaduta non pagata (Mario Rossi, €80.00) e 1 cliente inattiva da contattare (Sofia Moretti, assente da 37 giorni). Pianifica un contatto per stimolare il rientro.",
      data_creazione: "2026-06-18"
    }
  ],
  impostazioni: {
    nome: "Flux Yoga & Pilates Studio",
    indirizzo: "Via della Moscova 24, 20121 Milano (MI)",
    piva: "IT09876543210",
    logo: "FluxGestionale",
    abbonamenti_predefiniti: [
      { tipo: "Mensile", prezzo: 80.00, durata_mesi: 1 },
      { tipo: "Trimestrale", prezzo: 220.00, durata_mesi: 3 },
      { tipo: "Annuale", prezzo: 750.00, durata_mesi: 12 }
    ]
  }
};

// Database utility class holding synchronous file access
export class DBService {
  private static readDB(): GestionaleData {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        let changed = false;
        if (!parsed.pipeline_colonne) {
          parsed.pipeline_colonne = [
            { id: "col_1", titolo: "Contatti Ricevuti", ordine: 1 },
            { id: "col_2", titolo: "Primo Contatto", ordine: 2 },
            { id: "col_3", titolo: "Trattativa Avviata", ordine: 3 },
            { id: "col_4", titolo: "Iscrizione Completata", ordine: 4 }
          ];
          changed = true;
        }
        if (!parsed.pipeline_leads) {
          parsed.pipeline_leads = [
            { id: "lead_1", nome: "Andrea", cognome: "Gallo", email: "andrea.gallo@gmail.com", telefono: "+39 342 1112233", valore_trattativa: 150, note: "Interessato a pacchetto Trimestrale Pilates", data_creazione: "2026-06-15", colonna_id: "col_1" },
            { id: "lead_2", nome: "Chiara", cognome: "Fontana", email: "chiara.fontana90@gmail.com", telefono: "+39 331 4445566", valore_trattativa: 80, note: "Vuole fare lezione di prova di Hatha Yoga", data_creazione: "2026-06-16", colonna_id: "col_2" },
            { id: "lead_3", nome: "Lorenzo", cognome: "Martini", email: "lorenzo.martini@virgilio.it", telefono: "+39 329 8889900", valore_trattativa: 750, note: "Valuta abbonamento annuale + personal osteopatico", data_creazione: "2026-06-12", colonna_id: "col_3" }
          ];
          changed = true;
        }
        if (changed) {
          fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
        }
        return parsed;
      }
    } catch (e) {
      console.error("Errore nella lettura del DB, utilizzo di dati predefiniti", e);
    }
    
    // Save initial data to file
    DBService.writeDB(INITIAL_DATA);
    return INITIAL_DATA;
  }

  private static writeDB(data: GestionaleData): void {
    try {
      // Ensure directory exists (even though process.cwd() is always available)
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error("Errore nella scrittura del DB", e);
    }
  }

  // General getters
  public static getData(): GestionaleData {
    return DBService.readDB();
  }

  // Clienti CRUD
  public static getClienti(): Cliente[] {
    return DBService.readDB().clienti;
  }

  public static bulkSyncClienti(updatedClienti: Cliente[]): void {
    const db = DBService.readDB();
    updatedClienti.forEach(item => {
      if (!item.nome && !item.cognome) return; // Skip invalid records
      const idx = db.clienti.findIndex(c => c.id === item.id);
      if (idx !== -1) {
        db.clienti[idx] = { ...db.clienti[idx], ...item };
      } else {
        db.clienti.push({
          nome: item.nome || '',
          cognome: item.cognome || '',
          email: item.email || '',
          telefono: item.telefono || '',
          data_nascita: item.data_nascita || '',
          note: item.note || '',
          id: item.id || 'cli_' + generateId(),
          creato_il: item.creato_il || new Date().toISOString()
        });
      }
    });
    DBService.writeDB(db);
  }

  public static addCliente(cliente: Omit<Cliente, 'id' | 'creato_il'>): Cliente {
    const db = DBService.readDB();
    const newCliente: Cliente = {
      ...cliente,
      id: 'cli_' + generateId(),
      creato_il: new Date().toISOString()
    };
    db.clienti.push(newCliente);
    DBService.writeDB(db);
    return newCliente;
  }

  public static updateCliente(id: string, updates: Partial<Cliente>): Cliente {
    const db = DBService.readDB();
    const idx = db.clienti.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Cliente non trovato");
    
    db.clienti[idx] = { ...db.clienti[idx], ...updates };
    DBService.writeDB(db);
    return db.clienti[idx];
  }

  public static deleteCliente(id: string): void {
    const db = DBService.readDB();
    db.clienti = db.clienti.filter(c => c.id !== id);
    // clean relations Cascading
    db.abbonamenti = db.abbonamenti.filter(a => a.cliente_id !== id);
    db.presenze = db.presenze.filter(p => p.cliente_id !== id);
    db.fatture = db.fatture.filter(f => f.cliente_id !== id);
    DBService.writeDB(db);
  }

  // Abbonamenti CRUD
  public static getAbbonamenti(): Abbonamento[] {
    return DBService.readDB().abbonamenti;
  }

  public static addAbbonamento(abb: Omit<Abbonamento, 'id' | 'creato_il'>): Abbonamento {
    const db = DBService.readDB();
    const newAbb: Abbonamento = {
      ...abb,
      id: 'abb_' + generateId(),
      creato_il: new Date().toISOString()
    };
    db.abbonamenti.push(newAbb);
    DBService.writeDB(db);
    return newAbb;
  }

  public static updateAbbonamento(id: string, updates: Partial<Abbonamento>): Abbonamento {
    const db = DBService.readDB();
    const idx = db.abbonamenti.findIndex(a => a.id === id);
    if (idx === -1) throw new Error("Abbonamento non trovato");
    
    db.abbonamenti[idx] = { ...db.abbonamenti[idx], ...updates };
    DBService.writeDB(db);
    return db.abbonamenti[idx];
  }

  public static deleteAbbonamento(id: string): void {
    const db = DBService.readDB();
    db.abbonamenti = db.abbonamenti.filter(a => a.id !== id);
    DBService.writeDB(db);
  }

  // Lezioni CRUD
  public static getLezioni(): Lezione[] {
    return DBService.readDB().lezioni;
  }

  public static addLezione(lez: Omit<Lezione, 'id' | 'creato_il'>): Lezione {
    const db = DBService.readDB();
    const newLez: Lezione = {
      ...lez,
      id: 'lez_' + generateId(),
      creato_il: new Date().toISOString()
    };
    db.lezioni.push(newLez);
    DBService.writeDB(db);
    return newLez;
  }

  public static updateLezione(id: string, updates: Partial<Lezione>): Lezione {
    const db = DBService.readDB();
    const idx = db.lezioni.findIndex(l => l.id === id);
    if (idx === -1) throw new Error("Lezione non trovata");
    
    db.lezioni[idx] = { ...db.lezioni[idx], ...updates };
    DBService.writeDB(db);
    return db.lezioni[idx];
  }

  public static deleteLezione(id: string): void {
    const db = DBService.readDB();
    db.lezioni = db.lezioni.filter(l => l.id !== id);
    db.presenze = db.presenze.filter(p => p.lezione_id !== id);
    DBService.writeDB(db);
  }

  // Presenze CRUD
  public static getPresenze(): Presenza[] {
    return DBService.readDB().presenze;
  }

  public static addPresenza(pres: Omit<Presenza, 'id'>): Presenza {
    const db = DBService.readDB();
    const newPres: Presenza = {
      ...pres,
      id: 'pre_' + generateId()
    };
    db.presenze.push(newPres);
    DBService.writeDB(db);
    return newPres;
  }

  public static deletePresenza(id: string): void {
    const db = DBService.readDB();
    db.presenze = db.presenze.filter(p => p.id !== id);
    DBService.writeDB(db);
  }

  // Fatture CRUD
  public static getFatture(): Fattura[] {
    return DBService.readDB().fatture;
  }

  public static addFattura(fat: Omit<Fattura, 'id' | 'numero_fattura' | 'creato_il'>): Fattura {
    const db = DBService.readDB();
    
    // Generate sequential invoice number (e.g. 0005/2026)
    const currentYear = new Date().getFullYear();
    const sameYearInvoices = db.fatture.filter(f => f.numero_fattura.endsWith(`/${currentYear}`));
    let nextNum = 1;
    if (sameYearInvoices.length > 0) {
      const numbers = sameYearInvoices.map(f => {
        const parts = f.numero_fattura.split('/');
        return parseInt(parts[0], 10);
      });
      nextNum = Math.max(...numbers) + 1;
    }
    const seqStr = String(nextNum).padStart(4, '0');
    const numero_fattura = `${seqStr}/${currentYear}`;

    const newFat: Fattura = {
      ...fat,
      id: 'fat_' + generateId(),
      numero_fattura,
      creato_il: new Date().toISOString()
    };
    
    db.fatture.push(newFat);
    DBService.writeDB(db);
    return newFat;
  }

  public static addFattureGenerale(fat: Omit<Fattura, 'id' | 'creato_il'>): Fattura {
    const db = DBService.readDB();
    const newFat: Fattura = {
      ...fat,
      id: 'fat_' + generateId(),
      creato_il: new Date().toISOString()
    };
    db.fatture.push(newFat);
    DBService.writeDB(db);
    return newFat;
  }

  public static updateFattura(id: string, updates: Partial<Fattura>): Fattura {
    const db = DBService.readDB();
    const idx = db.fatture.findIndex(f => f.id === id);
    if (idx === -1) throw new Error("Fattura non trovata");
    
    db.fatture[idx] = { ...db.fatture[idx], ...updates };
    DBService.writeDB(db);
    return db.fatture[idx];
  }

  public static deleteFattura(id: string): void {
    const db = DBService.readDB();
    db.fatture = db.fatture.filter(f => f.id !== id);
    DBService.writeDB(db);
  }

  // Staff CRUD
  public static getStaff(): Staff[] {
    return DBService.readDB().staff;
  }

  public static addStaff(st: Omit<Staff, 'id'>): Staff {
    const db = DBService.readDB();
    const newSt: Staff = {
      ...st,
      id: 'st_' + generateId()
    };
    db.staff.push(newSt);
    DBService.writeDB(db);
    return newSt;
  }

  public static deleteStaff(id: string): void {
    const db = DBService.readDB();
    db.staff = db.staff.filter(st => st.id !== id);
    DBService.writeDB(db);
  }

  // Promemoria CRUD
  public static getPromemoria(): Promemoria[] {
    return DBService.readDB().promemoria;
  }

  public static addPromemoria(testo: string): Promemoria {
    const db = DBService.readDB();
    const newProm: Promemoria = {
      id: 'prom_' + generateId(),
      testo,
      data_creazione: new Date().toISOString().substring(0, 10)
    };
    // Keep only the last 10 daily summaries to save storage
    db.promemoria.push(newProm);
    if (db.promemoria.length > 10) {
      db.promemoria.shift();
    }
    DBService.writeDB(db);
    return newProm;
  }

  // Impostazioni CRUD
  public static getImpostazioni(): Impostazioni {
    return DBService.readDB().impostazioni;
  }

  public static updateImpostazioni(updates: Partial<Impostazioni>): Impostazioni {
    const db = DBService.readDB();
    db.impostazioni = { ...db.impostazioni, ...updates };
    DBService.writeDB(db);
    return db.impostazioni;
  }

  // Pipeline Leads & Columns CRUD
  public static getPipelineColumns(): PipelineColumn[] {
    const db = DBService.readDB();
    return db.pipeline_colonne || [];
  }

  public static savePipelineColumns(colonne: PipelineColumn[]): PipelineColumn[] {
    const db = DBService.readDB();
    db.pipeline_colonne = colonne;
    DBService.writeDB(db);
    return db.pipeline_colonne;
  }

  public static getPipelineLeads(): PipelineLead[] {
    const db = DBService.readDB();
    return db.pipeline_leads || [];
  }

  public static addPipelineLead(lead: Omit<PipelineLead, 'id' | 'data_creazione'>): PipelineLead {
    const db = DBService.readDB();
    if (!db.pipeline_leads) db.pipeline_leads = [];
    const newLead: PipelineLead = {
      ...lead,
      id: 'lead_' + generateId(),
      data_creazione: new Date().toISOString().substring(0, 10)
    };
    db.pipeline_leads.push(newLead);
    DBService.writeDB(db);
    return newLead;
  }

  public static updatePipelineLead(id: string, updates: Partial<PipelineLead>): PipelineLead {
    const db = DBService.readDB();
    if (!db.pipeline_leads) db.pipeline_leads = [];
    const idx = db.pipeline_leads.findIndex(l => l.id === id);
    if (idx === -1) throw new Error("Lead non trovato");
    db.pipeline_leads[idx] = { ...db.pipeline_leads[idx], ...updates };
    DBService.writeDB(db);
    return db.pipeline_leads[idx];
  }

  public static deletePipelineLead(id: string): void {
    const db = DBService.readDB();
    if (!db.pipeline_leads) db.pipeline_leads = [];
    db.pipeline_leads = db.pipeline_leads.filter(l => l.id !== id);
    DBService.writeDB(db);
  }

  // -----------------------------------------------------------------------
  // Stripe Subscriptions (mapped by Supabase user_id)
  // -----------------------------------------------------------------------
  public static getSubscription(userId: string): StripeSubscription | null {
    const db = DBService.readDB();
    if (!db.subscriptions) return null;
    return db.subscriptions[userId] || null;
  }

  public static isSubscriptionActive(userId: string): boolean {
    const sub = DBService.getSubscription(userId);
    if (!sub) return false;
    return sub.status === 'active' || sub.status === 'trialing';
  }

  public static saveSubscription(userId: string, sub: StripeSubscription): void {
    const db = DBService.readDB();
    if (!db.subscriptions) db.subscriptions = {};
    db.subscriptions[userId] = sub;
    DBService.writeDB(db);
  }

  /** Auto-create or retrieve a staff record linked to a Supabase user email */
  public static findOrCreateStaff(email: string, nome?: string): Staff {
    const db = DBService.readDB();
    const existing = db.staff.find(s => s.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (existing) return existing;

    const newStaff: Staff = {
      id: 'st_' + generateId(),
      email: email.toLowerCase().trim(),
      nome: nome || email.split('@')[0],
      ruolo: 'staff',
    };
    db.staff.push(newStaff);
    DBService.writeDB(db);
    return newStaff;
  }
}
