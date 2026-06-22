/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { DBService } from './src/db.js';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initializing server-side Gemini SDK if key exists
// Note: ALWAYS lazy evaluate or check the key safely
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("ATTENZIONE: GEMINI_API_KEY non è configurata nelle variabili d'ambiente.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Ensure database file is generated immediately to seed mock data
DBService.getData();

// ==========================================
// API AUTH
// ==========================================
app.post('/api/auth/login', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email richiesta' });
    }

    const staff = DBService.getStaff();
    const matched = staff.find(st => st.email.toLowerCase().trim() === email.toLowerCase().trim());

    if (matched) {
      return res.json({ success: true, user: matched });
    } else {
      return res.status(401).json({ error: 'Accesso negato. Solo l\'indirizzo email dello staff registrato può accedere.' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API CLIENTS
// ==========================================
app.get('/api/clienti', (req, res) => {
  try {
    const clientes = DBService.getClienti();
    return res.json(clientes);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/clienti/bulk-sync', (req, res) => {
  try {
    const list = req.body;
    if (!Array.isArray(list)) {
      return res.status(400).json({ error: "Il payload deve essere un array di atleti" });
    }
    DBService.bulkSyncClienti(list);
    return res.json({ success: true, list: DBService.getClienti() });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/clienti', (req, res) => {
  try {
    const newCliente = DBService.addCliente(req.body);
    return res.json(newCliente);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/clienti/:id', (req, res) => {
  try {
    const updated = DBService.updateCliente(req.params.id, req.body);
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clienti/:id', (req, res) => {
  try {
    DBService.deleteCliente(req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API ABBONAMENTI
// ==========================================
app.get('/api/abbonamenti', (req, res) => {
  try {
    return res.json(DBService.getAbbonamenti());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/abbonamenti', (req, res) => {
  try {
    const newAbb = DBService.addAbbonamento(req.body);
    return res.json(newAbb);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Atomic subscription creation + invoice registration (Renewals / New Subscriptions with custom payments)
app.post('/api/abbonamenti/con-pagamento', (req, res) => {
  try {
    const { cliente_id, tipo, data_inizio, data_fine, importo, importo_pagato, stato_pagamento } = req.body;
    
    // 1. Create the subscription
    const newAbb = DBService.addAbbonamento({
      cliente_id,
      tipo,
      data_inizio,
      data_fine,
      stato: 'attivo', // Starts active
      importo: Number(importo)
    });

    // 2. Create the associated invoice / receipt
    const desc = `Rinnovo Pacchetto ${tipo} (Valido dal ${data_inizio} al ${data_fine})`;
    const realPaidAmount = importo_pagato !== undefined && importo_pagato !== '' ? Number(importo_pagato) : Number(importo);
    
    const newFat = DBService.addFattura({
      cliente_id,
      descrizione: desc,
      importo: realPaidAmount,
      data_emissione: data_inizio,
      data_scadenza: data_fine,
      stato_pagamento: stato_pagamento || 'pagato',
      file_url: ''
    });

    return res.json({ subscription: newAbb, invoice: newFat });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/abbonamenti/:id', (req, res) => {
  try {
    const updated = DBService.updateAbbonamento(req.params.id, req.body);
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/abbonamenti/:id', (req, res) => {
  try {
    DBService.deleteAbbonamento(req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API LEZIONI
// ==========================================
app.get('/api/lezioni', (req, res) => {
  try {
    return res.json(DBService.getLezioni());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/lezioni', (req, res) => {
  try {
    const newLez = DBService.addLezione(req.body);
    return res.json(newLez);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/lezioni/:id', (req, res) => {
  try {
    const updated = DBService.updateLezione(req.params.id, req.body);
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lezioni/:id', (req, res) => {
  try {
    DBService.deleteLezione(req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API PRESENZE
// ==========================================
app.get('/api/presenze', (req, res) => {
  try {
    return res.json(DBService.getPresenze());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/presenze', (req, res) => {
  try {
    const newPres = DBService.addPresenza(req.body);
    return res.json(newPres);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/presenze/:id', (req, res) => {
  try {
    DBService.deletePresenza(req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API CLIENT ACQUISITION PIPELINE
// ==========================================
app.get('/api/pipeline/colonne', (req, res) => {
  try {
    return res.json(DBService.getPipelineColumns());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/pipeline/colonne', (req, res) => {
  try {
    const updated = DBService.savePipelineColumns(req.body);
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/pipeline/leads', (req, res) => {
  try {
    return res.json(DBService.getPipelineLeads());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/pipeline/leads', (req, res) => {
  try {
    const newLead = DBService.addPipelineLead(req.body);
    return res.json(newLead);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/pipeline/leads/:id', (req, res) => {
  try {
    const updated = DBService.updatePipelineLead(req.params.id, req.body);
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/pipeline/leads/:id', (req, res) => {
  try {
    DBService.deletePipelineLead(req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API FATTURE & PDF GENERATION
// ==========================================
app.get('/api/fatture', (req, res) => {
  try {
    return res.json(DBService.getFatture());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/fatture', async (req, res) => {
  try {
    const newFat = DBService.addFattura(req.body);
    return res.json(newFat);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/fatture/:id', (req, res) => {
  try {
    const updated = DBService.updateFattura(req.params.id, req.body);
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/fatture/:id', (req, res) => {
  try {
    DBService.deleteFattura(req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Custom Ricevuta PDF Builder using pdf-lib
app.post('/api/fatture/crea-pdf', async (req, res) => {
  try {
    const { clienteId, descrizione, importo, dataEmissione, dataScadenza } = req.body;
    
    const db = DBService.getData();
    const cliente = db.clienti.find(c => c.id === clienteId);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }

    const impostazioni = db.impostazioni;

    // Generate Invoice in database first to obtain serial number
    const newInvoiceObj = DBService.addFattura({
      cliente_id: clienteId,
      descrizione,
      importo: Number(importo),
      data_emissione: dataEmissione,
      data_scadenza: dataScadenza,
      stato_pagamento: 'da pagare',
      file_url: '' // Will update with Base64/PDF URL shortly
    });

    // Create a beautiful PDF using pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size in points
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Color definitions (Forest Teal '#113f3d' branding)
    const colorTeal = rgb(17/255, 63/255, 61/255);
    const colorTextGray = rgb(100/255, 116/255, 139/255);
    const colorLightGray = rgb(241/255, 245/255, 249/255);

    // Draw Header Grid
    // Logo Placeholder Rectangle (Green Box)
    page.drawRectangle({
      x: 50,
      y: height - 100,
      width: 45,
      height: 45,
      color: rgb(132/255, 224/255, 98/255), // Lime green
    });
    
    // Logo text inside box
    page.drawText('FLUX', {
      x: 58,
      y: height - 78,
      size: 10,
      font: fontBold,
      color: rgb(15/255, 59/255, 57/255),
    });

    // Gym Title & Slogan
    page.drawText(impostazioni.nome, {
      x: 110,
      y: height - 70,
      size: 16,
      font: fontBold,
      color: colorTeal
    });
    
    page.drawText(`Studio Professionale - Pilates, Yoga & Danza`, {
      x: 110,
      y: height - 85,
      size: 9,
      font: fontRegular,
      color: colorTextGray
    });

    // Gym Address details on Right
    page.drawText(impostazioni.indirizzo, {
      x: width - 250,
      y: height - 70,
      size: 8,
      font: fontRegular,
      color: colorTextGray,
    });
    page.drawText(`P.IVA: ${impostazioni.piva}`, {
      x: width - 250,
      y: height - 82,
      size: 8,
      font: fontRegular,
      color: colorTextGray,
    });

    // Separator line
    page.drawLine({
      start: { x: 50, y: height - 120 },
      end: { x: width - 50, y: height - 120 },
      thickness: 1,
      color: rgb(226/255, 232/255, 240/255)
    });

    // Title Title Receipt
    page.drawText(`RICEVUTA DI PAGAMENTO N. ${newInvoiceObj.numero_fattura}`, {
      x: 50,
      y: height - 150,
      size: 15,
      font: fontBold,
      color: colorTeal
    });

    // Details Grid Left Column (Dates)
    page.drawText(`Data emissione:`, { x: 50, y: height - 175, size: 9, font: fontBold, color: colorTextGray });
    page.drawText(dataEmissione, { x: 140, y: height - 175, size: 9, font: fontRegular });

    page.drawText(`Scadenza:`, { x: 50, y: height - 190, size: 9, font: fontBold, color: colorTextGray });
    page.drawText(dataScadenza || 'N/A', { x: 140, y: height - 190, size: 9, font: fontRegular });

    // Details Grid Right Column (Client Contact)
    page.drawText(`Destinatario:`, { x: width - 240, y: height - 175, size: 9, font: fontBold, color: colorTextGray });
    page.drawText(`${cliente.nome} ${cliente.cognome}`, { x: width - 160, y: height - 175, size: 9, font: fontBold });
    page.drawText(cliente.email || '', { x: width - 160, y: height - 190, size: 9, font: fontRegular, color: colorTextGray });
    page.drawText(cliente.telefono || '', { x: width - 160, y: height - 205, size: 9, font: fontRegular, color: colorTextGray });

    // Table Header
    page.drawRectangle({
      x: 50,
      y: height - 250,
      width: width - 100,
      height: 24,
      color: colorTeal
    });

    page.drawText('DESCRIZIONE SERVIZIO', { x: 60, y: height - 243, size: 9, font: fontBold, color: rgb(1,1,1) });
    page.drawText('IMPORTO', { x: width - 120, y: height - 243, size: 9, font: fontBold, color: rgb(1,1,1) });

    // Table Row 1 (Item)
    page.drawRectangle({
      x: 50,
      y: height - 300,
      width: width - 100,
      height: 50,
      color: colorLightGray
    });

    page.drawText(descrizione, { x: 60, y: height - 280, size: 10, font: fontRegular });
    page.drawText(`€ ${Number(importo).toFixed(2)}`, { x: width - 120, y: height - 280, size: 10, font: fontBold });

    // Total section
    page.drawText('TOTALE', { x: width - 200, y: height - 340, size: 11, font: fontBold, color: colorTeal });
    page.drawText(`€ ${Number(importo).toFixed(2)}`, { x: width - 120, y: height - 340, size: 12, font: fontBold, color: colorTeal });

    // Footer Info
    page.drawText('Questo documento è una ricevuta di cortesia generata per uso interno.', {
      x: 50,
      y: 100,
      size: 8,
      font: fontRegular,
      color: colorTextGray
    });
    page.drawText('Non ha valore fiscale al di fuori degli scopi interni ammessi dallo Statuto ASD.', {
      x: 50,
      y: 88,
      size: 8,
      font: fontRegular,
      color: colorTextGray
    });

    // Save and send Base64
    const pdfBytes = await pdfDoc.save();
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');
    const file_url = `data:application/pdf;base64,${base64Pdf}`;

    // Update database record with the save file URL
    DBService.updateFattura(newInvoiceObj.id, { file_url });

    return res.json({ success: true, file_url, invoice: { ...newInvoiceObj, file_url } });
  } catch (error: any) {
    console.error("Errore generazione PDF:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Import external PDF invoice and bind to customer
app.post('/api/fatture/importa', (req, res) => {
  try {
    const { clienteId, descrizione, importo, dataEmissione, dataScadenza, fileBase64 } = req.body;
    
    const db = DBService.getData();
    const cliente = db.clienti.find(c => c.id === clienteId);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente non trovato" });
    }

    const newFat = DBService.addFattura({
      cliente_id: clienteId,
      descrizione,
      importo: Number(importo),
      data_emissione: dataEmissione,
      data_scadenza: dataScadenza,
      stato_pagamento: 'da pagare',
      file_url: fileBase64 || ''
    });

    return res.json(newFat);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API STAFF MANAGEMENT
// ==========================================
app.get('/api/staff', (req, res) => {
  try {
    return res.json(DBService.getStaff());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff', (req, res) => {
  try {
    const st = DBService.addStaff(req.body);
    return res.json(st);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/staff/:id', (req, res) => {
  try {
    DBService.deleteStaff(req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API SETTINGS
// ==========================================
app.get('/api/impostazioni', (req, res) => {
  try {
    return res.json(DBService.getImpostazioni());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/impostazioni', (req, res) => {
  try {
    const updated = DBService.updateImpostazioni(req.body);
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API PROMEMORIA (CRON / ON-DEMAND GEMINI SUMMARY)
// ==========================================
app.get('/api/promemoria', (req, res) => {
  try {
    return res.json(DBService.getPromemoria());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/promemoria', async (req, res) => {
  try {
    const genai = getGeminiClient();
    const db = DBService.getData();

    // 1. Calculations according to spec:
    // - Abbonamenti in scadenza entro 7 giorni
    // - Fatture scadute da pagare
    // - Clienti inattivi da più di 21 giorni
    const todayStr = new Date().toISOString().substring(0, 10);
    const todayVal = new Date(todayStr).getTime();
    const sevenDaysVal = todayVal + 7 * 24 * 60 * 60 * 1000;

    const expiredOrExpiringSubscriptions = db.abbonamenti.filter(abb => {
      const fineVal = new Date(abb.data_fine).getTime();
      return abb.stato === 'attivo' && fineVal >= todayVal && fineVal <= sevenDaysVal;
    });

    const unpaidOverdueInvoices = db.fatture.filter(fat => {
      const scadVal = new Date(fat.data_scadenza).getTime();
      return (fat.stato_pagamento === 'da pagare' || fat.stato_pagamento === 'scaduto') && scadVal < todayVal;
    });

    // Clienti inattivi da più di 21 giorni: (no presence recorded in last 21 days)
    const twentyOneDaysAgo = todayVal - 21 * 24 * 60 * 60 * 1000;
    
    const inactiveClients: { cliente: typeof db.clienti[0], days: number }[] = [];
    db.clienti.forEach(cli => {
      const cliPresences = db.presenze.filter(p => p.cliente_id === cli.id);
      if (cliPresences.length === 0) {
        // No presence recorded, calculate from creation or consider inactive
        const createdVal = new Date(cli.creato_il).getTime();
        if (createdVal < twentyOneDaysAgo) {
          const diffDays = Math.floor((todayVal - createdVal) / (24 * 60 * 60 * 1000));
          inactiveClients.push({ cliente: cli, days: diffDays });
        }
      } else {
        const lastPresenceDate = Math.max(...cliPresences.map(p => new Date(p.data_presenza).getTime()));
        if (lastPresenceDate < twentyOneDaysAgo) {
          const diffDays = Math.floor((todayVal - lastPresenceDate) / (24 * 60 * 60 * 1000));
          inactiveClients.push({ cliente: cli, days: diffDays });
        }
      }
    });

    // Compile nice context to send to Gemini
    const promemoriaContext = {
      abbonamenti_in_scadenza: expiredOrExpiringSubscriptions.map(abb => {
        const cli = db.clienti.find(c => c.id === abb.cliente_id);
        return { nome: cli ? `${cli.nome} ${cli.cognome}` : 'Sconosciuto', tipo: abb.tipo, scadenza: abb.data_fine };
      }),
      fatture_scadute_non_pagate: unpaidOverdueInvoices.map(fat => {
        const cli = db.clienti.find(c => c.id === fat.cliente_id);
        return { nome: cli ? `${cli.nome} ${cli.cognome}` : 'Sconosciuto', numero: fat.numero_fattura, importo: fat.importo, scadenza: fat.data_scadenza };
      }),
      clienti_inattivi: inactiveClients.map(ic => ({
        nome: `${ic.cliente.nome} ${ic.cliente.cognome}`,
        ultimo_giorno_giorni_fa: ic.days
      })),
      oggi: todayStr
    };

    let summaryText = "";

    if (genai) {
      const prompt = `Sei l'assistente automatico intelligente integrato in FluxGestionale, gestionale per una palestra di Yoga, Pilates e Danza.
Il tuo compito è analizzare i dati forniti qui sotto riguardanti le criticità della palestra per oggi e scrivere un "Riepilogo Giornaliero dello Staff" in italiano, conciso, cordiale ed estremamente professionale.

Questo riepilogo deve avvisare lo staff su chi contattare, quali abbonamenti stanno scadendo nei prossimi 7 giorni, quali fatture sono scadute da pagare, e quali clienti non si fanno vedere da più di 21 giorni (clienti inattivi).
Il riepilogo deve essere un testo di circa 3-4 frasi discorsive e focalizzate sull'azione, perfetto da esporre sul cruscotto della Dashboard dello staff. NON usare simboli di formattazione bizzarri e mantieni un tono focalizzato sull'efficienza del business.

Ecco i dati delle criticità del gestionale per oggi (${todayStr}):
${JSON.stringify(promemoriaContext, null, 2)}

Produci solo il testo del riepilogo in italiano, senza introduzioni o saluti iniziali generici (inizia direttamente con es: "Riepilogo giornaliero dello staff: ...").`;

      try {
        const response = await genai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });
        summaryText = response.text || "Impossibile generare il riepilogo automatico tramite AI.";
      } catch (gemIniErr: any) {
        console.warn("Errore con gemini-2.5-flash, provo fallback a gemini-2.0-flash:", gemIniErr);
        try {
          const response = await genai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt
          });
          summaryText = response.text || "Impossibile generare il riepilogo automatico tramite AI.";
        } catch (liteErr: any) {
          console.warn("Errore con gemini-2.0-flash, provo fallback a gemini-1.5-flash:", liteErr);
          try {
            const response = await genai.models.generateContent({
              model: "gemini-1.5-flash",
              contents: prompt
            });
            summaryText = response.text || "Impossibile generare il riepilogo automatico tramite AI.";
          } catch (fallbackErr: any) {
            console.error("Tutti i modelli Gemini hanno fallito. Uso il fallback locale:", fallbackErr);
            const expiringList = promemoriaContext.abbonamenti_in_scadenza.map(a => `${a.nome} (${a.scadenza})`).join(', ');
            const unpaidList = promemoriaContext.fatture_scadute_non_pagate.map(f => `${f.nome} (€${f.importo})`).join(', ');
            const inactiveList = promemoriaContext.clienti_inattivi.map(i => `${i.nome} (assente da ${i.ultimo_giorno_giorni_fa} gg)`).join(', ');

            summaryText = `Riepilogo giornaliero dello staff (Offline Fallback): Oggi ci sono ${promemoriaContext.abbonamenti_in_scadenza.length} scadenze abbonamento entro 7 giorni [${expiringList || 'nessuno'}], ${promemoriaContext.fatture_scadute_non_pagate.length} pagamenti scaduti in attesa [${unpaidList || 'nessuno'}], e ${promemoriaContext.clienti_inattivi.length} atleti inattivi da stimolare [${inactiveList || 'nessuno'}]. Si raccomanda di contattarli via e-mail o telefono.`;
          }
        }
      }
    } else {
      // Fallback response with offline pre-generated template if Gemini is not set up
      const expiringList = promemoriaContext.abbonamenti_in_scadenza.map(a => `${a.nome} (${a.scadenza})`).join(', ');
      const unpaidList = promemoriaContext.fatture_scadute_non_pagate.map(f => `${f.nome} (€${f.importo})`).join(', ');
      const inactiveList = promemoriaContext.clienti_inattivi.map(i => `${i.nome} (assente da ${i.ultimo_giorno_giorni_fa} gg)`).join(', ');

      summaryText = `Riepilogo giornaliero dello staff (Offline Fallback): Oggi ci sono ${promemoriaContext.abbonamenti_in_scadenza.length} scadenze abbonamento entro 7 giorni [${expiringList || 'nessuno'}], ${promemoriaContext.fatture_scadute_non_pagate.length} pagamenti scaduti in attesa [${unpaidList || 'nessuno'}], e ${promemoriaContext.clienti_inattivi.length} atleti inattivi da stimolare [${inactiveList || 'nessuno'}]. Si raccomanda di contattarli via e-mail o telefono.`;
    }

    // Save to promemoria table
    const prom = DBService.addPromemoria(summaryText);
    return res.json(prom);
  } catch (error: any) {
    console.error("Errore generazione promemoria cron:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API SHIFT/CHAT GEMINI COMPANION (AI PILOT)
// ==========================================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Messaggio richiesto' });
    }

    const genai = getGeminiClient();
    if (!genai) {
      return res.json({
        text: "Ciao! Non è possibile elaborare la tua richiesta con l'intelligenza artificiale perché la chiave d'accesso `GEMINI_API_KEY` non è configurata nei Segreti di AI Studio. \n\nTuttavia, sono a disposizione le demo offline. Configura i tuoi Secrets per sbloccare le risposte complete basate su database relazionale di oggi!"
      });
    }

    const db = DBService.getData();
    // Compact dataset format to decrease context window sizes and prevent slow processing
    const todayStr = new Date().toISOString().substring(0, 10);
    const compactDBContext = {
      oggi: todayStr,
      impostazioni: db.impostazioni,
      clienti: db.clienti.map(c => {
        const lastPres = db.presenze.filter(p => p.cliente_id === c.id);
        const activeAbb = db.abbonamenti.filter(a => a.cliente_id === c.id && a.stato === 'attivo');
        return {
          id: c.id,
          nome: `${c.nome} ${c.cognome}`,
          email: c.email,
          telefono: c.telefono,
          abbonamento_attivo: activeAbb.length > 0 ? activeAbb.map(a => `${a.tipo} (scade il ${a.data_fine})`) : 'Nessuno',
          ultime_presenze: lastPres.map(p => p.data_presenza).slice(-2)
        };
      }),
      lezioni_programmate: db.lezioni,
      presenze_totali: db.presenze.length,
      fatture: db.fatture.map(f => {
        const cli = db.clienti.find(c => c.id === f.cliente_id);
        return {
          numero: f.numero_fattura,
          cliente: cli ? `${cli.nome} ${cli.cognome}` : 'Sconosciuto',
          descrizione: f.descrizione,
          importo: f.importo,
          data_emissione: f.data_emissione,
          data_scadenza: f.data_scadenza,
          stato: f.stato_pagamento
        };
      })
    };

    const systemInstruction = `Sei "FluxGPT", l'assistente virtuale integrato nel gestionale FluxGestionale per palestre di Yoga, Pilates e Danza.
Sei a disposizione esclusiva dello staff interno della palestra. Il tuo compito è rispondere a domande, eseguire conteggi di presenze, individuare scadenze, elaborare note, proporre bozze di email o suggerire soluzioni.

REGOLE IMPORTANTI DI RISPOSTA:
1. Rispondi SEMPRE in italiano, con tono professionale, caloroso ed estremamente operativo.
2. Basati ESCLUSIVAMENTE sui dati reali del gestionale forniti nel contesto qui sotto. Non inventare o ipotizzare clienti che non esistono.
3. Se lo staff ti chiede ad esempio "Chi ha l'abbonamento in scadenza questa settimana?" o "Chi non viene da 3 settimane?", estorci le risposte calcolando partendo dalla data odierna che è ${todayStr} e filtrando sui dati forniti.
4. Rendi i nomi e i dettagli calcolati ben formattati in grassetto per una lettura agile a schermo.
5. Se ti viene chiesto di preparare un promemoria per un cliente (es: "Crea un promemoria per Maria Rossi..."), scrivi una bozza di messaggio cortese (es: WhatsApp o email) pronta per essere copiata dallo staff.

Ecco i dati attuali del gestionale a tua completa e unica disposizione:
${JSON.stringify(compactDBContext, null, 2)}`;

    // Build chat parameters with history formatting
    const contents = [];
    // Convert prior history
    for (const h of history) {
      contents.push({
        role: h.sender === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      });
    }
    // Append current prompt
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    let replyText = "";
    try {
      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction
        }
      });
      replyText = response.text || "Non ho ricevuto risposta da Gemini.";
    } catch (gemIniErr: any) {
      console.warn("Errore con gemini-2.5-flash in chat, provo fallback a gemini-2.0-flash:", gemIniErr);
      try {
        const response = await genai.models.generateContent({
          model: "gemini-2.0-flash",
          contents,
          config: {
            systemInstruction
          }
        });
        replyText = response.text || "Non ho ricevuto risposta da Gemini.";
      } catch (liteErr: any) {
        console.warn("Errore con gemini-2.0-flash in chat, provo fallback a gemini-1.5-flash:", liteErr);
        try {
          const response = await genai.models.generateContent({
            model: "gemini-1.5-flash",
            contents,
            config: {
              systemInstruction
            }
          });
          replyText = response.text || "Non ho ricevuto risposta da Gemini.";
        } catch (fallbackErr: any) {
          console.error("Tutti i modelli Gemini in chat hanno fallito:", fallbackErr);
          const isQuotaExceeded = JSON.stringify(fallbackErr).includes("Quota exceeded") || 
                                  fallbackErr.message?.includes("Quota exceeded") || 
                                  fallbackErr.message?.includes("RESOURCE_EXHAUSTED") ||
                                  JSON.stringify(fallbackErr).includes("RESOURCE_EXHAUSTED");
          
          if (isQuotaExceeded) {
            replyText = "⚠️ **Limite di quota dell'API di test superato!**\n\nAttualmente stai utilizzando la chiave API generica gratuita di Google AI Studio, che ha un limite massimo di consumi rigoroso per minuto/giorno.\n\n**Come risolvere e sbloccare al 100% l'applicazione:**\n1. Vai su **Google AI Studio** ([aistudio.google.com](https://aistudio.google.com)) e crea una tua chiave API personale gratuita.\n2. Incolla la tua chiave personale nel pannello dei **Secrets / Impostazioni** di questa piattaforma (nel menu in alto a destra o nella barra laterale) sotto la variabile `GEMINI_API_KEY`.\n\nIn questo modo avrai una quota personale dedicata con migliaia di richieste al giorno senza alcuna interruzione! Nel frattempo, puoi visualizzare e gestire tutti i dati manualmente dalle altre schede del gestionale.";
          } else {
            replyText = "Gentile operatore, i server di intelligenza artificiale di Google Gemini sono temporaneamente sovraccarichi o non disponibili (Errore 503). Per favore, prova a inviare nuovamente il messaggio tra qualche istante! Nel frattempo, puoi verificare i dati direttamente dalle schede di Clienti, Abbonamenti, Calendario e Cassa del gestionale.";
          }
        }
      }
    }

    return res.json({ text: replyText });
  } catch (error: any) {
    console.error("Errore chat assistente:", error);
    return res.status(500).json({ error: error.message });
  }
});


// ==========================================
// VITE MIDDLEWARE SETUP
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Use vite's connect instance as a middleware
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serve static files in production
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FluxGestionale] Server running on http://localhost:${PORT}`);
  });
}

startServer();
