/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { DBService } from './src/db.js';
import type { StripeSubscription } from './src/types.js';
import { GoogleGenAI } from '@google/genai';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createClient, User } from '@supabase/supabase-js';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID!;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[FluxGestionale] ATTENZIONE: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY non configurate. ' +
    'L\'autenticazione Supabase non funzionerà.');
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
  : null;

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-06-16' as any })
  : null;

// ---------------------------------------------------------------------------
// Body parsers
// ---------------------------------------------------------------------------
app.use(express.json({
  limit: '10mb',
  // Save raw body for Stripe webhook signature verification
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));

// ---------------------------------------------------------------------------
// Gemini client (unchanged)
// ---------------------------------------------------------------------------
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("ATTENZIONE: GEMINI_API_KEY non è configurata nelle variabili d'ambiente.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

// Ensure database
DBService.getData();

// ---------------------------------------------------------------------------
// MIDDLEWARE: extract Supabase user from JWT
// ---------------------------------------------------------------------------
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!supabase) {
    res.status(500).json({ error: 'Supabase non configurato. Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Non autorizzato. Token mancante.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Token non valido o scaduto. Rieffettua il login.' });
      return;
    }
    req.user = user;
    next();
  } catch (err: any) {
    res.status(500).json({ error: 'Errore nella verifica del token.' });
  }
}

// ---------------------------------------------------------------------------
// MIDDLEWARE: require active Stripe subscription
// ---------------------------------------------------------------------------
async function requireSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Utente non autenticato.' });
    return;
  }

  if (DBService.isSubscriptionActive(userId)) {
    next();
  } else {
    res.status(403).json({
      error: 'Abbonamento richiesto.',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }
}

// ===========================================================================
// PUBLIC ROUTES (no auth needed)
// ===========================================================================

// ---------------------------------------------------------------------------
// Stripe Webhook (called by Stripe servers — raw body + signature verify)
// ---------------------------------------------------------------------------
app.post('/api/stripe/webhook', async (req: any, res: Response) => {
  if (!stripe) {
    res.status(500).json({ error: 'Stripe non configurato.' });
    return;
  }

  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    res.status(400).json({ error: 'Firma Stripe mancante.' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[Stripe] Firma webhook non valida:', err.message);
    res.status(400).json({ error: `Errore firma webhook: ${err.message}` });
    return;
  }

  console.log(`[Stripe] Webhook ricevuto: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const userEmail = session.metadata?.user_email;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!userId) {
          console.warn('[Stripe] checkout.session.completed senza user_id nei metadata');
          break;
        }

        // Fetch subscription details from Stripe
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);

        DBService.saveSubscription(userId, {
          user_id: userId,
          email: userEmail || '',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: stripeSub.status as StripeSubscription['status'],
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
          created_at: new Date().toISOString(),
        });

        console.log(`[Stripe] Abbonamento attivato per userId=${userId} (${userEmail})`);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer_id
        const db = DBService.getData();
        const userId = db.subscriptions
          ? Object.keys(db.subscriptions).find(
            (k) => db.subscriptions![k].stripe_customer_id === customerId,
          )
          : null;

        if (userId) {
          DBService.saveSubscription(userId, {
            ...db.subscriptions![userId],
            status: subscription.status as StripeSubscription['status'],
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          });
          console.log(`[Stripe] Abbonamento aggiornato per userId=${userId}: ${subscription.status}`);
        }
        break;
      }
    }
  } catch (err: any) {
    console.error('[Stripe] Errore elaborazione webhook:', err);
  }

  // Always return 200 quickly to acknowledge receipt
  res.json({ received: true });
});

// ===========================================================================
// AUTH-ONLY ROUTES (need valid Supabase JWT, no subscription required)
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/auth/me — verify session & return staff info + sub status
// ---------------------------------------------------------------------------
app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const email = user.email || '';
    const nome = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];

    // Find or create staff record
    const staff = DBService.findOrCreateStaff(email, nome);

    // Check subscription status
    const subscriptionActive = DBService.isSubscriptionActive(user.id);

    res.json({ staff, subscriptionActive });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/stripe/create-checkout-session — create Stripe Checkout session
// ---------------------------------------------------------------------------
app.post('/api/stripe/create-checkout-session', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!stripe || !STRIPE_PRICE_ID) {
      res.status(500).json({ error: 'Stripe non configurato. Contatta l\'amministratore.' });
      return;
    }

    const user = req.user!;
    const { successUrl, cancelUrl } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: successUrl || `${req.headers.origin || 'http://localhost:3000'}/?payment=success`,
      cancel_url: cancelUrl || `${req.headers.origin || 'http://localhost:3000'}/?payment=cancelled`,
      metadata: {
        user_id: user.id,
        user_email: user.email || '',
      },
      customer_email: user.email,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[Stripe] Errore creazione checkout:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================================================================
// PROTECTED ROUTES — auth + active subscription required
// Everything below requires both a valid Supabase JWT AND an active Stripe
// subscription. Routes are defined on an Express Router mounted at /api.
// ===========================================================================

const apiRouter = express.Router();
apiRouter.use(requireAuth);
apiRouter.use(requireSubscription);

// ==========================================
// API CLIENTS
// ==========================================
apiRouter.get('/clienti', (_req, res) => {
  try {
    res.json(DBService.getClienti());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/clienti/bulk-sync', (req, res) => {
  try {
    const list = req.body;
    if (!Array.isArray(list)) {
      res.status(400).json({ error: 'Il payload deve essere un array di atleti' });
      return;
    }
    DBService.bulkSyncClienti(list);
    res.json({ success: true, list: DBService.getClienti() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/clienti', (req, res) => {
  try {
    const newCliente = DBService.addCliente(req.body);
    res.json(newCliente);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.put('/clienti/:id', (req, res) => {
  try {
    const updated = DBService.updateCliente(req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete('/clienti/:id', (req, res) => {
  try {
    DBService.deleteCliente(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API ABBONAMENTI
// ==========================================
apiRouter.get('/abbonamenti', (_req, res) => {
  try {
    res.json(DBService.getAbbonamenti());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/abbonamenti', (req, res) => {
  try {
    const newAbb = DBService.addAbbonamento(req.body);
    res.json(newAbb);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/abbonamenti/con-pagamento', (req, res) => {
  try {
    const { cliente_id, tipo, data_inizio, data_fine, importo, importo_pagato, stato_pagamento } = req.body;

    const newAbb = DBService.addAbbonamento({
      cliente_id,
      tipo,
      data_inizio,
      data_fine,
      stato: 'attivo',
      importo: Number(importo),
    });

    const desc = `Rinnovo Pacchetto ${tipo} (Valido dal ${data_inizio} al ${data_fine})`;
    const realPaidAmount = importo_pagato !== undefined && importo_pagato !== '' ? Number(importo_pagato) : Number(importo);

    const newFat = DBService.addFattura({
      cliente_id,
      descrizione: desc,
      importo: realPaidAmount,
      data_emissione: data_inizio,
      data_scadenza: data_fine,
      stato_pagamento: stato_pagamento || 'pagato',
      file_url: '',
    });

    res.json({ subscription: newAbb, invoice: newFat });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.put('/abbonamenti/:id', (req, res) => {
  try {
    const updated = DBService.updateAbbonamento(req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete('/abbonamenti/:id', (req, res) => {
  try {
    DBService.deleteAbbonamento(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API LEZIONI
// ==========================================
apiRouter.get('/lezioni', (_req, res) => {
  try {
    res.json(DBService.getLezioni());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/lezioni', (req, res) => {
  try {
    const newLez = DBService.addLezione(req.body);
    res.json(newLez);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.put('/lezioni/:id', (req, res) => {
  try {
    const updated = DBService.updateLezione(req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete('/lezioni/:id', (req, res) => {
  try {
    DBService.deleteLezione(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API PRESENZE
// ==========================================
apiRouter.get('/presenze', (_req, res) => {
  try {
    res.json(DBService.getPresenze());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/presenze', (req, res) => {
  try {
    const newPres = DBService.addPresenza(req.body);
    res.json(newPres);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete('/presenze/:id', (req, res) => {
  try {
    DBService.deletePresenza(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API CLIENT ACQUISITION PIPELINE
// ==========================================
apiRouter.get('/pipeline/colonne', (_req, res) => {
  try {
    res.json(DBService.getPipelineColumns());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/pipeline/colonne', (req, res) => {
  try {
    const updated = DBService.savePipelineColumns(req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/pipeline/leads', (_req, res) => {
  try {
    res.json(DBService.getPipelineLeads());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/pipeline/leads', (req, res) => {
  try {
    const newLead = DBService.addPipelineLead(req.body);
    res.json(newLead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.put('/pipeline/leads/:id', (req, res) => {
  try {
    const updated = DBService.updatePipelineLead(req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete('/pipeline/leads/:id', (req, res) => {
  try {
    DBService.deletePipelineLead(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API FATTURE & PDF GENERATION
// ==========================================
apiRouter.get('/fatture', (_req, res) => {
  try {
    res.json(DBService.getFatture());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/fatture', async (req, res) => {
  try {
    const newFat = DBService.addFattura(req.body);
    res.json(newFat);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.put('/fatture/:id', (req, res) => {
  try {
    const updated = DBService.updateFattura(req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete('/fatture/:id', (req, res) => {
  try {
    DBService.deleteFattura(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/fatture/crea-pdf', async (req, res) => {
  try {
    const { clienteId, descrizione, importo, dataEmissione, dataScadenza } = req.body;

    const db = DBService.getData();
    const cliente = db.clienti.find(c => c.id === clienteId);
    if (!cliente) {
      res.status(404).json({ error: 'Cliente non trovato' });
      return;
    }

    const impostazioni = db.impostazioni;

    const newInvoiceObj = DBService.addFattura({
      cliente_id: clienteId,
      descrizione,
      importo: Number(importo),
      data_emissione: dataEmissione,
      data_scadenza: dataScadenza,
      stato_pagamento: 'da pagare',
      file_url: '',
    });

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const colorTeal = rgb(17 / 255, 63 / 255, 61 / 255);
    const colorTextGray = rgb(100 / 255, 116 / 255, 139 / 255);
    const colorLightGray = rgb(241 / 255, 245 / 255, 249 / 255);

    page.drawRectangle({ x: 50, y: height - 100, width: 45, height: 45, color: rgb(132 / 255, 224 / 255, 98 / 255) });
    page.drawText('FLUX', { x: 58, y: height - 78, size: 10, font: fontBold, color: rgb(15 / 255, 59 / 255, 57 / 255) });

    page.drawText(impostazioni.nome, { x: 110, y: height - 70, size: 16, font: fontBold, color: colorTeal });
    page.drawText(`Studio Professionale - Pilates, Yoga & Danza`, { x: 110, y: height - 85, size: 9, font: fontRegular, color: colorTextGray });

    page.drawText(impostazioni.indirizzo, { x: width - 250, y: height - 70, size: 8, font: fontRegular, color: colorTextGray });
    page.drawText(`P.IVA: ${impostazioni.piva}`, { x: width - 250, y: height - 82, size: 8, font: fontRegular, color: colorTextGray });

    page.drawLine({ start: { x: 50, y: height - 120 }, end: { x: width - 50, y: height - 120 }, thickness: 1, color: rgb(226 / 255, 232 / 255, 240 / 255) });

    page.drawText(`RICEVUTA DI PAGAMENTO N. ${newInvoiceObj.numero_fattura}`, { x: 50, y: height - 150, size: 15, font: fontBold, color: colorTeal });

    page.drawText(`Data emissione:`, { x: 50, y: height - 175, size: 9, font: fontBold, color: colorTextGray });
    page.drawText(dataEmissione, { x: 140, y: height - 175, size: 9, font: fontRegular });
    page.drawText(`Scadenza:`, { x: 50, y: height - 190, size: 9, font: fontBold, color: colorTextGray });
    page.drawText(dataScadenza || 'N/A', { x: 140, y: height - 190, size: 9, font: fontRegular });

    page.drawText(`Destinatario:`, { x: width - 240, y: height - 175, size: 9, font: fontBold, color: colorTextGray });
    page.drawText(`${cliente.nome} ${cliente.cognome}`, { x: width - 160, y: height - 175, size: 9, font: fontBold });
    page.drawText(cliente.email || '', { x: width - 160, y: height - 190, size: 9, font: fontRegular, color: colorTextGray });
    page.drawText(cliente.telefono || '', { x: width - 160, y: height - 205, size: 9, font: fontRegular, color: colorTextGray });

    page.drawRectangle({ x: 50, y: height - 250, width: width - 100, height: 24, color: colorTeal });
    page.drawText('DESCRIZIONE SERVIZIO', { x: 60, y: height - 243, size: 9, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText('IMPORTO', { x: width - 120, y: height - 243, size: 9, font: fontBold, color: rgb(1, 1, 1) });

    page.drawRectangle({ x: 50, y: height - 300, width: width - 100, height: 50, color: colorLightGray });
    page.drawText(descrizione, { x: 60, y: height - 280, size: 10, font: fontRegular });
    page.drawText(`€ ${Number(importo).toFixed(2)}`, { x: width - 120, y: height - 280, size: 10, font: fontBold });

    page.drawText('TOTALE', { x: width - 200, y: height - 340, size: 11, font: fontBold, color: colorTeal });
    page.drawText(`€ ${Number(importo).toFixed(2)}`, { x: width - 120, y: height - 340, size: 12, font: fontBold, color: colorTeal });

    page.drawText('Questo documento è una ricevuta di cortesia generata per uso interno.', { x: 50, y: 100, size: 8, font: fontRegular, color: colorTextGray });
    page.drawText('Non ha valore fiscale al di fuori degli scopi interni ammessi dallo Statuto ASD.', { x: 50, y: 88, size: 8, font: fontRegular, color: colorTextGray });

    const pdfBytes = await pdfDoc.save();
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');
    const file_url = `data:application/pdf;base64,${base64Pdf}`;

    DBService.updateFattura(newInvoiceObj.id, { file_url });

    res.json({ success: true, file_url, invoice: { ...newInvoiceObj, file_url } });
  } catch (error: any) {
    console.error('Errore generazione PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/fatture/importa', (req, res) => {
  try {
    const { clienteId, descrizione, importo, dataEmissione, dataScadenza, fileBase64 } = req.body;

    const db = DBService.getData();
    const cliente = db.clienti.find(c => c.id === clienteId);
    if (!cliente) {
      res.status(404).json({ error: 'Cliente non trovato' });
      return;
    }

    const newFat = DBService.addFattura({
      cliente_id: clienteId,
      descrizione,
      importo: Number(importo),
      data_emissione: dataEmissione,
      data_scadenza: dataScadenza,
      stato_pagamento: 'da pagare',
      file_url: fileBase64 || '',
    });

    res.json(newFat);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API STAFF MANAGEMENT
// ==========================================
apiRouter.get('/staff', (_req, res) => {
  try {
    res.json(DBService.getStaff());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/staff', (req, res) => {
  try {
    const st = DBService.addStaff(req.body);
    res.json(st);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete('/staff/:id', (req, res) => {
  try {
    DBService.deleteStaff(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API SETTINGS
// ==========================================
apiRouter.get('/impostazioni', (_req, res) => {
  try {
    res.json(DBService.getImpostazioni());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.put('/impostazioni', (req, res) => {
  try {
    const updated = DBService.updateImpostazioni(req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API PROMEMORIA
// ==========================================
apiRouter.get('/promemoria', (_req, res) => {
  try {
    res.json(DBService.getPromemoria());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/promemoria', async (_req, res) => {
  try {
    const genai = getGeminiClient();
    const db = DBService.getData();

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

    const twentyOneDaysAgo = todayVal - 21 * 24 * 60 * 60 * 1000;
    const inactiveClients: { cliente: typeof db.clienti[0]; days: number }[] = [];

    db.clienti.forEach(cli => {
      const cliPresences = db.presenze.filter(p => p.cliente_id === cli.id);
      if (cliPresences.length === 0) {
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
        ultimo_giorno_giorni_fa: ic.days,
      })),
      oggi: todayStr,
    };

    let summaryText = '';

    if (genai) {
      const prompt = `Sei l'assistente automatico intelligente integrato in FluxGestionale, gestionale per una palestra di Yoga, Pilates e Danza.
Il tuo compito è analizzare i dati forniti qui sotto riguardanti le criticità della palestra per oggi e scrivere un "Riepilogo Giornaliero dello Staff" in italiano, conciso, cordiale ed estremamente professionale.

Questo riepilogo deve avvisare lo staff su chi contattare, quali abbonamenti stanno scadendo nei prossimi 7 giorni, quali fatture sono scadute da pagare, e quali clienti non si fanno vedere da più di 21 giorni (clienti inattivi).
Il riepilogo deve essere un testo di circa 3-4 frasi discorsive e focalizzate sull'azione, perfetto da esporre sul cruscotto della Dashboard dello staff. NON usare simboli di formattazione bizzarri e mantieni un tono focalizzato sull'efficienza del business.

Ecco i dati delle criticità del gestionale per oggi (${todayStr}):
${JSON.stringify(promemoriaContext, null, 2)}

Produci solo il testo del riepilogo in italiano, senza introduzioni o saluti iniziali generici (inizia direttamente con es: "Riepilogo giornaliero dello staff: ...").`;

      try {
        const response = await genai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        summaryText = response.text || 'Impossibile generare il riepilogo automatico tramite AI.';
      } catch (gemIniErr: any) {
        console.warn('Errore con gemini-2.5-flash, provo fallback:', gemIniErr);
        try {
          const response = await genai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
          summaryText = response.text || 'Impossibile generare il riepilogo automatico tramite AI.';
        } catch (liteErr: any) {
          console.warn('Errore con gemini-2.0-flash, provo fallback:', liteErr);
          try {
            const response = await genai.models.generateContent({ model: 'gemini-1.5-flash', contents: prompt });
            summaryText = response.text || 'Impossibile generare il riepilogo automatico tramite AI.';
          } catch (fallbackErr: any) {
            console.error('Tutti i modelli Gemini hanno fallito:', fallbackErr);
            const expiringList = promemoriaContext.abbonamenti_in_scadenza.map(a => `${a.nome} (${a.scadenza})`).join(', ');
            const unpaidList = promemoriaContext.fatture_scadute_non_pagate.map(f => `${f.nome} (€${f.importo})`).join(', ');
            const inactiveList = promemoriaContext.clienti_inattivi.map(i => `${i.nome} (assente da ${i.ultimo_giorno_giorni_fa} gg)`).join(', ');
            summaryText = `Riepilogo giornaliero dello staff (Offline Fallback): Oggi ci sono ${promemoriaContext.abbonamenti_in_scadenza.length} scadenze abbonamento entro 7 giorni [${expiringList || 'nessuno'}], ${promemoriaContext.fatture_scadute_non_pagate.length} pagamenti scaduti in attesa [${unpaidList || 'nessuno'}], e ${promemoriaContext.clienti_inattivi.length} atleti inattivi da stimolare [${inactiveList || 'nessuno'}]. Si raccomanda di contattarli via e-mail o telefono.`;
          }
        }
      }
    } else {
      const expiringList = promemoriaContext.abbonamenti_in_scadenza.map(a => `${a.nome} (${a.scadenza})`).join(', ');
      const unpaidList = promemoriaContext.fatture_scadute_non_pagate.map(f => `${f.nome} (€${f.importo})`).join(', ');
      const inactiveList = promemoriaContext.clienti_inattivi.map(i => `${i.nome} (assente da ${i.ultimo_giorno_giorni_fa} gg)`).join(', ');
      summaryText = `Riepilogo giornaliero dello staff (Offline Fallback): Oggi ci sono ${promemoriaContext.abbonamenti_in_scadenza.length} scadenze abbonamento entro 7 giorni [${expiringList || 'nessuno'}], ${promemoriaContext.fatture_scadute_non_pagate.length} pagamenti scaduti in attesa [${unpaidList || 'nessuno'}], e ${promemoriaContext.clienti_inattivi.length} atleti inattivi da stimolare [${inactiveList || 'nessuno'}]. Si raccomanda di contattarli via e-mail o telefono.`;
    }

    const prom = DBService.addPromemoria(summaryText);
    res.json(prom);
  } catch (error: any) {
    console.error('Errore generazione promemoria cron:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API CHAT (AI COPILOT)
// ==========================================
apiRouter.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) {
      res.status(400).json({ error: 'Messaggio richiesto' });
      return;
    }

    const genai = getGeminiClient();
    if (!genai) {
      res.json({
        text: "Ciao! Non è possibile elaborare la tua richiesta con l'intelligenza artificiale perché la chiave d'accesso `GEMINI_API_KEY` non è configurata nei Segreti di AI Studio. \n\nTuttavia, sono a disposizione le demo offline. Configura i tuoi Secrets per sbloccare le risposte complete basate su database relazionale di oggi!",
      });
      return;
    }

    const db = DBService.getData();
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
          ultime_presenze: lastPres.map(p => p.data_presenza).slice(-2),
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
          stato: f.stato_pagamento,
        };
      }),
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

    const contents: any[] = [];
    for (const h of history) {
      contents.push({ role: h.sender === 'user' ? 'user' : 'model', parts: [{ text: h.text }] });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    let replyText = '';
    try {
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: { systemInstruction },
      });
      replyText = response.text || 'Non ho ricevuto risposta da Gemini.';
    } catch (gemIniErr: any) {
      console.warn('Errore con gemini-2.5-flash in chat, provo fallback:', gemIniErr);
      try {
        const response = await genai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents,
          config: { systemInstruction },
        });
        replyText = response.text || 'Non ho ricevuto risposta da Gemini.';
      } catch (liteErr: any) {
        console.warn('Errore con gemini-2.0-flash in chat, provo fallback:', liteErr);
        try {
          const response = await genai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents,
            config: { systemInstruction },
          });
          replyText = response.text || 'Non ho ricevuto risposta da Gemini.';
        } catch (fallbackErr: any) {
          console.error('Tutti i modelli Gemini in chat hanno fallito:', fallbackErr);
          const isQuotaExceeded =
            JSON.stringify(fallbackErr).includes('Quota exceeded') ||
            fallbackErr.message?.includes('Quota exceeded') ||
            fallbackErr.message?.includes('RESOURCE_EXHAUSTED') ||
            JSON.stringify(fallbackErr).includes('RESOURCE_EXHAUSTED');

          if (isQuotaExceeded) {
            replyText =
              '⚠️ **Limite di quota dell\'API di test superato!**\n\nAttualmente stai utilizzando la chiave API generica gratuita di Google AI Studio, che ha un limite massimo di consumi rigoroso per minuto/giorno.\n\n**Come risolvere e sbloccare al 100% l\'applicazione:**\n1. Vai su **Google AI Studio** ([aistudio.google.com](https://aistudio.google.com)) e crea una tua chiave API personale gratuita.\n2. Incolla la tua chiave personale nel pannello dei **Secrets / Impostazioni** di questa piattaforma (nel menu in alto a destra o nella barra laterale) sotto la variabile `GEMINI_API_KEY`.\n\nIn questo modo avrai una quota personale dedicata con migliaia di richieste al giorno senza alcuna interruzione! Nel frattempo, puoi visualizzare e gestire tutti i dati manualmente dalle altre schede del gestionale.';
          } else {
            replyText =
              'Gentile operatore, i server di intelligenza artificiale di Google Gemini sono temporaneamente sovraccarichi o non disponibili (Errore 503). Per favore, prova a inviare nuovamente il messaggio tra qualche istante! Nel frattempo, puoi verificare i dati direttamente dalle schede di Clienti, Abbonamenti, Calendario e Cassa del gestionale.';
          }
        }
      }
    }

    res.json({ text: replyText });
  } catch (error: any) {
    console.error('Errore chat assistente:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mount the protected router
app.use('/api', apiRouter);

// ===========================================================================
// VITE MIDDLEWARE SETUP
// ===========================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FluxGestionale] Server running on http://localhost:${PORT}`);
    if (!stripe) console.warn('[FluxGestionale] STRIPE_SECRET_KEY non configurata. I pagamenti non funzioneranno.');
    if (!STRIPE_PRICE_ID) console.warn('[FluxGestionale] STRIPE_PRICE_ID non configurato.');
    if (!STRIPE_WEBHOOK_SECRET) console.warn('[FluxGestionale] STRIPE_WEBHOOK_SECRET non configurato. Il webhook Stripe non funzionerà.');
  });
}

startServer();
