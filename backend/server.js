/**
 * Voicebot Backend - Comune di Codroipo
 * Municipal services assistant backend for Vapi integration
 *
 * Endpoints:
 *   POST /tools/cerca-servizio     - RAG: search municipal service info
 *   POST /tools/prenota-appuntamento - Book an appointment
 *   POST /tools/verifica-appuntamento - Check an existing appointment
 *   POST /tools/cancella-appuntamento - Cancel an existing appointment
 *   GET  /appuntamenti             - Admin: list all appointments (frontend)
 *   GET  /health                   - Health check
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

const ragService  = require('./ragService');
const db          = require('./database');

// initialise DB (creates table if needed) before accepting requests
db.init().catch(err => { console.error('[DB] Init failed:', err); process.exit(1); });

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ──────────────────────────────────────────────
// VAPI Tool: Search municipal service info (RAG)
// ──────────────────────────────────────────────
app.post('/tools/cerca-servizio', async (req, res) => {
  try {
    // Vapi sends tool arguments inside req.body.message.toolWithToolCallList
    // OR directly in req.body for simpler server-url style
    const args   = extractArgs(req.body);
    const query  = args?.domanda || args?.query;

    if (!query) {
      return res.json({ result: 'Per favore, specifica la tua domanda sul servizio comunale.' });
    }

    const results = await ragService.search(query);

    if (!results || results.length === 0) {
      return res.json({
        result: 'Non ho trovato informazioni specifiche su questo argomento. ' +
                'Ti consiglio di contattare direttamente il Comune di Codroipo ' +
                'al numero 0432 824111 o visitare www.comune.codroipo.ud.it.'
      });
    }

    const answer = results.map(r => r.content).join('\n\n');
    return res.json({ result: answer });

  } catch (err) {
    console.error('[cerca-servizio] Error:', err);
    return res.json({
      result: 'Si è verificato un errore nel recupero delle informazioni. ' +
              'Per assistenza chiama il Comune al 0432 824111.'
    });
  }
});

// ──────────────────────────────────────────────
// VAPI Tool: Book an appointment
// ──────────────────────────────────────────────
app.post('/tools/prenota-appuntamento', async (req, res) => {
  try {
    const args = extractArgs(req.body);
    const { nome, cognome, servizio, data, ora, motivo } = args || {};

    // Validate required fields
    if (!nome || !cognome || !servizio || !data || !ora) {
      return res.json({
        result: 'Per completare la prenotazione ho bisogno di: nome, cognome, servizio richiesto, data e ora preferita.'
      });
    }

    // Validate date is not in the past
    const appointmentDate = new Date(`${data}T${ora}`);
    if (isNaN(appointmentDate.getTime())) {
      return res.json({ result: `La data o l'ora non è valida. Usa il formato YYYY-MM-DD per la data e HH:MM per l'ora.` });
    }
    if (appointmentDate < new Date()) {
      return res.json({ result: 'Non è possibile prenotare un appuntamento nel passato. Scegli una data futura.' });
    }

    // Check if slot is available
    const existing = await db.findByDateTime(data, ora, servizio);
    if (existing) {
      return res.json({
        result: `Mi dispiace, lo slot delle ${ora} del ${formatDate(data)} per il servizio "${servizio}" è già occupato. Vuoi provare un altro orario?`
      });
    }

    // Create the appointment
    const id = uuidv4().split('-')[0].toUpperCase(); // short ID e.g. "A1B2C3D4"
    const appointment = {
      id,
      nome,
      cognome,
      servizio,
      data,
      ora,
      motivo: motivo || 'Non specificato',
      createdAt: new Date().toISOString(),
      stato: 'confermato'
    };

    await db.save(appointment);

    return res.json({
      result: `Appuntamento confermato! ` +
              `📅 Numero prenotazione: ${id}. ` +
              `${nome} ${cognome}, il suo appuntamento per "${servizio}" è fissato il ${formatDate(data)} alle ore ${ora}. ` +
              `La riceveremo presso gli uffici comunali di Codroipo in Piazza Libertà 28. ` +
              `Si ricordi di portare un documento d'identità valido.`
    });

  } catch (err) {
    console.error('[prenota-appuntamento] Error:', err);
    return res.json({
      result: 'Si è verificato un errore durante la prenotazione. Riprova o chiama il Comune al 0432 824111.'
    });
  }
});

// ──────────────────────────────────────────────
// VAPI Tool: Check an appointment
// ──────────────────────────────────────────────
app.post('/tools/verifica-appuntamento', async (req, res) => {
  try {
    const args = extractArgs(req.body);
    const { id, cognome } = args || {};

    if (!id) {
      return res.json({ result: 'Per verificare la prenotazione ho bisogno del numero di prenotazione.' });
    }

    const appointment = await db.findById(id.toUpperCase());

    if (!appointment) {
      return res.json({
        result: `Non ho trovato nessuna prenotazione con il numero ${id}. Controlla il numero o chiama il Comune al 0432 824111.`
      });
    }

    // Optional: verify surname matches
    if (cognome && appointment.cognome.toLowerCase() !== cognome.toLowerCase()) {
      return res.json({ result: 'I dati forniti non corrispondono alla prenotazione. Verifica il numero o il cognome.' });
    }

    return res.json({
      result: `Ho trovato la sua prenotazione! ` +
              `Numero: ${appointment.id}. ` +
              `Intestata a: ${appointment.nome} ${appointment.cognome}. ` +
              `Servizio: ${appointment.servizio}. ` +
              `Data: ${formatDate(appointment.data)} alle ore ${appointment.ora}. ` +
              `Stato: ${appointment.stato}. ` +
              `Luogo: Uffici Comunali, Piazza Libertà 28, Codroipo.`
    });

  } catch (err) {
    console.error('[verifica-appuntamento] Error:', err);
    return res.json({ result: 'Errore nella verifica. Riprova o chiama il Comune.' });
  }
});

// ──────────────────────────────────────────────
// VAPI Tool: Cancel an appointment
// ──────────────────────────────────────────────
app.post('/tools/cancella-appuntamento', async (req, res) => {
  try {
    const args = extractArgs(req.body);
    const { id, cognome } = args || {};

    if (!id) {
      return res.json({ result: 'Per cancellare la prenotazione ho bisogno del numero di prenotazione.' });
    }

    const appointment = await db.findById(id.toUpperCase());

    if (!appointment) {
      return res.json({
        result: `Non ho trovato nessuna prenotazione con il numero ${id}. Controlla il numero o chiama il Comune al 0432 824111.`
      });
    }

    if (cognome && appointment.cognome.toLowerCase() !== cognome.toLowerCase()) {
      return res.json({ result: 'I dati forniti non corrispondono alla prenotazione. Verifica il numero o il cognome.' });
    }

    await db.remove(appointment.id);

    return res.json({
      result: `Prenotazione ${appointment.id} cancellata. Se desidera fissare un nuovo appuntamento, posso aiutarla subito.`
    });

  } catch (err) {
    console.error('[cancella-appuntamento] Error:', err);
    return res.json({ result: 'Errore nella cancellazione. Riprova o chiama il Comune.' });
  }
});

// ──────────────────────────────────────────────
// Admin / Frontend: list all appointments
// ──────────────────────────────────────────────
app.get('/appuntamenti', async (req, res) => {
  const all = await db.getAll();
  res.json({ appointments: all, total: all.length });
});

app.delete('/appuntamenti/:id', async (req, res) => {
  const deleted = await db.remove(req.params.id.toUpperCase());
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Appuntamento cancellato', id: req.params.id });
});

// ──────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const all = await db.getAll();
  res.json({ status: 'ok', timestamp: new Date().toISOString(), appointments: all.length });
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Vapi calls tools via server URL. The arguments come in different shapes
 * depending on whether the tool was defined inline or via the tools library.
 * This function normalises both cases.
 */
function extractArgs(body) {
  // New Vapi format: body.message.toolWithToolCallList[0].toolCall.function.arguments
  try {
    if (body?.message?.toolWithToolCallList?.length > 0) {
      const raw = body.message.toolWithToolCallList[0].toolCall.function.arguments;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
  } catch (_) {}
  // Direct / legacy format: arguments are at top level or body itself
  if (body?.arguments) return typeof body.arguments === 'string' ? JSON.parse(body.arguments) : body.arguments;
  // Fallback: body is the args
  return body;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                  'luglio','agosto','settembre','ottobre','novembre','dicembre'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

app.listen(PORT, () => {
  console.log(`\n🏛️  Voicebot Comune di Codroipo — Backend`);
  console.log(`✅  Server running at http://localhost:${PORT}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  POST /tools/cerca-servizio`);
  console.log(`  POST /tools/prenota-appuntamento`);
  console.log(`  POST /tools/verifica-appuntamento`);
  console.log(`  POST /tools/cancella-appuntamento`);
  console.log(`  GET  /appuntamenti`);
  console.log(`  GET  /health\n`);
});
