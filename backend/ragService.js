/**
 * ragService.js — Retrieval-Augmented Generation for municipal services
 *
 * Two modes (set USE_EMBEDDINGS=true in .env to enable the API version):
 *
 * DEFAULT (USE_EMBEDDINGS not set / false):
 *   Fast keyword search — zero dependencies, works on any Node version, instant startup.
 *   Good enough for 14 well-labelled chunks in Italian.
 *
 * OPTIONAL — Gemini Embeddings (USE_EMBEDDINGS=true + GEMINI_API_KEY set):
 *   Semantic search via Google's gemini-embedding-001 model.
 *   Top of MTEB multilingual benchmark, great Italian support.
 *   Requires: npm install @google/generative-ai
 *
 * For the technical test, keyword search is sufficient and avoids any
 * native-compilation issues on Windows.
 */

const DOCS = require('./data/codroipo_services.json');
const TOP_K = 3;

// ── Gemini embeddings (optional, API-based, no native compilation) ────────────
let embeddings    = null;   // pre-computed vectors [{doc, vec}]
let geminiModel   = null;

async function loadGemini() {
  if (geminiModel) return geminiModel;
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiModel = genai.getGenerativeModel({ model: 'gemini-embedding-001' });
    console.log('[RAG] Gemini embedding model ready');
    return geminiModel;
  } catch (err) {
    console.warn('[RAG] Gemini unavailable, using keyword search:', err.message);
    return null;
  }
}

async function embed(text) {
  const model = await loadGemini();
  if (!model) return null;
  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    console.warn('[RAG] embed error:', err.message);
    return null;
  }
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

async function buildIndex() {
  if (process.env.USE_EMBEDDINGS !== 'true' || !process.env.GEMINI_API_KEY) return;
  const model = await loadGemini();
  if (!model) return;
  console.log(`[RAG] Building Gemini index for ${DOCS.length} chunks…`);
  embeddings = [];
  for (const doc of DOCS) {
    const vec = await embed(doc.content);
    if (vec) embeddings.push({ doc, vec });
    await new Promise(r => setTimeout(r, 100)); // gentle rate-limit
  }
  console.log('[RAG] Gemini index ready.');
}

// ── Keyword search (default, always available) ────────────────────────────────
function keywordSearch(query) {
  const tokens = query.toLowerCase()
    .replace(/[^\w\sàèéìòùáíóú]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  if (tokens.length === 0) return DOCS.slice(0, TOP_K);

  const scored = DOCS.map(doc => {
    const text = (doc.title + ' ' + doc.content + ' ' + doc.category).toLowerCase();
    // weight: title match counts double
    const titleText = doc.title.toLowerCase();
    const score = tokens.reduce((acc, t) => {
      return acc + (text.includes(t) ? 1 : 0) + (titleText.includes(t) ? 1 : 0);
    }, 0);
    return { doc, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map(s => s.doc);
}

// ── Public API ────────────────────────────────────────────────────────────────
async function search(query) {
  // Use Gemini embeddings if index is built
  if (embeddings && embeddings.length > 0) {
    const qv = await embed(query);
    if (qv) {
      return embeddings
        .map(({ doc, vec }) => ({ doc, score: cosine(qv, vec) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_K)
        .filter(s => s.score > 0.2)
        .map(s => s.doc);
    }
  }
  return keywordSearch(query);
}

// Build index in background if Gemini is configured
buildIndex().catch(console.error);

module.exports = { search };
