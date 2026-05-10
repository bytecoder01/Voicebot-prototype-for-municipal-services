/**
 * scraper.js — One-time script to scrape Codroipo Municipality website
 *
 * Run:  node scraper.js
 * Output: updates data/codroipo_services.json with live data
 *
 * Uses cheerio for HTML parsing and axios for HTTP requests.
 * Run once to build/update the knowledge base; no need to run on every start.
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');

const BASE_URL = 'https://www.comune.codroipo.ud.it';

// Service pages to scrape (adjust if site structure changes)
const PAGES_TO_SCRAPE = [
  { url: '/it/il-comune/uffici-e-servizi/anagrafe',            category: 'Anagrafe' },
  { url: '/it/il-comune/uffici-e-servizi/tributi',             category: 'Tributi' },
  { url: '/it/il-comune/uffici-e-servizi/edilizia-urbanistica',category: 'Edilizia e Urbanistica' },
  { url: '/it/il-comune/uffici-e-servizi/servizi-sociali',     category: 'Servizi Sociali' },
  { url: '/it/il-comune/orari-e-contatti',                     category: 'Informazioni generali' },
];

async function scrapePage({ url, category }) {
  try {
    const fullUrl  = BASE_URL + url;
    const response = await axios.get(fullUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VoicebotScraper/1.0)' },
      timeout: 10000
    });

    const $    = cheerio.load(response.data);
    const docs = [];

    // Extract H2/H3 sections as individual chunks
    $('h2, h3').each((i, el) => {
      const title   = $(el).text().trim();
      const content = $(el).nextUntil('h2, h3').text().replace(/\s+/g, ' ').trim();

      if (title && content && content.length > 50) {
        docs.push({
          id:       `scraped-${category.toLowerCase().replace(/\s/g,'-')}-${i}`,
          category,
          title,
          content:  `${title}: ${content}`.slice(0, 1500) // limit chunk size
        });
      }
    });

    // If no H2/H3 found, grab all main body text as one chunk
    if (docs.length === 0) {
      const text = $('main, .content, article, #content')
        .text().replace(/\s+/g, ' ').trim();
      if (text.length > 100) {
        docs.push({ id: `scraped-${category.toLowerCase().replace(/\s/g,'-')}-0`, category, title: category, content: text.slice(0, 2000) });
      }
    }

    console.log(`✅ Scraped ${docs.length} chunks from ${fullUrl}`);
    return docs;

  } catch (err) {
    console.warn(`⚠️  Could not scrape ${url}: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('🔍 Starting scraper for Comune di Codroipo...\n');

  const allDocs = [];
  for (const page of PAGES_TO_SCRAPE) {
    const docs = await scrapePage(page);
    allDocs.push(...docs);
    await sleep(1000); // polite delay
  }

  if (allDocs.length === 0) {
    console.log('⚠️  No data scraped (site may be unreachable). Keeping existing data/codroipo_services.json.');
    return;
  }

  const outputPath = path.join(__dirname, 'data', 'codroipo_services.json');

  // Merge with existing hardcoded data (keep it as fallback)
  const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const merged   = [...existing, ...allDocs];

  // Deduplicate by content similarity (simple approach: check title)
  const seen  = new Set();
  const final = merged.filter(doc => {
    const key = doc.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(outputPath, JSON.stringify(final, null, 2), 'utf8');
  console.log(`\n✅ Saved ${final.length} total chunks to data/codroipo_services.json`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(console.error);
