# Voicebot — Comune di Codroipo
Municipal services voice assistant built with Vapi, Node.js, and PostgreSQL.

Supports two use cases:
- Answering questions about municipal services (RAG over scraped/hardcoded content)
- Booking, checking, and cancelling appointments at municipal offices

---

## Repository structure

```
├── backend/
│   ├── data/
│   │   └── codroipo_services.json   # Knowledge base (14 chunks, Italian)
│   ├── database.js                  # PostgreSQL + in-memory fallback
│   ├── ragService.js                # Keyword search + optional Gemini embeddings
│   ├── scraper.js                   # One-time scraper for the municipality website
│   ├── server.js                    # Express API — 4 Vapi tool endpoints + admin
│   ├── Dockerfile
│   └── package.json
├── docs/
│   └── vapi_agent_config.json       # Full Vapi assistant config — used by create_agent.js
├── frontend/
│   └── public/
│       └── index.html               # Admin dashboard (appointments list)
├── create_agent.js                  # Script to push the agent to Vapi via API
├── docker-compose.yml               # db + backend + frontend services
├── start.sh / start.bat             # Quick-start helpers
├── CHOICES.md                       # Design decisions, limitations, improvements
└── AI_TOOLS.md                      # AI tools used and for what purpose
```

---

## Prerequisites

| Tool | Version | Required for |
|------|---------|-------------|
| Node.js | ≥ 20.18 | Local backend |
| Docker + Compose | any recent | Containerised setup |
| ngrok | any | Exposing backend to Vapi |
| Vapi account | — | Running the agent |

---

## Quick start — local (no Docker)

```bash
# 1. Clone the repo
git clone <repo-url>
cd <repo>

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment
cp .env.example .env
# Edit backend/.env — minimum required:
#   VAPI_PRIVATE_KEY=your_vapi_key
#   PUBLIC_URL=https://xxxx.ngrok-free.app   (set after step 5)

# 4. Start the backend
npm start
# → http://localhost:3000

# 5. Expose to Vapi via ngrok (separate terminal)
ngrok http 3000
# Copy the HTTPS URL (e.g. https://xxxx.ngrok-free.app)
# Paste it as PUBLIC_URL in backend/.env

# 6. Create the Vapi agent
cd ..
node create_agent.js
# → Agent appears in your Vapi dashboard
```

The admin dashboard is served at `http://localhost:3000` (same port as the API).

---

## Quick start — Docker Compose (recommended)

```bash
# 1. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — set VAPI_PRIVATE_KEY at minimum

# 2. Start all services
docker-compose up -d

# Services started:
#   db        → PostgreSQL on internal network
#   backend   → http://localhost:3000
#   frontend  → http://localhost:8080

# 3. Expose backend to Vapi
ngrok http 3000
# Copy the HTTPS URL

# 4. Set PUBLIC_URL and recreate the agent
# Edit backend/.env → PUBLIC_URL=https://xxxx.ngrok-free.app
docker-compose restart backend
node create_agent.js
```

To stop: `docker-compose down`
To stop and wipe the database: `docker-compose down -v`

---

## Environment variables

File: `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VAPI_PRIVATE_KEY` | Yes | Vapi private API key (from vapi.ai dashboard) |
| `PUBLIC_URL` | Yes (agent creation) | ngrok or other public HTTPS URL |
| `PORT` | No | Backend port, default `3000` |
| `DATABASE_URL` | No | PostgreSQL connection string. If unset, uses in-memory store |
| `USE_EMBEDDINGS` | No | Set to `true` to enable Gemini semantic search |
| `GEMINI_API_KEY` | If above is true | Google Gemini API key |

---

## Vapi agent

### Option A — create via script (recommended)

```bash
# With PUBLIC_URL and VAPI_PRIVATE_KEY set in backend/.env:
node create_agent.js
```

`create_agent.js` reads `docs/vapi_agent_config.json`, substitutes every `https://YOUR_PUBLIC_URL` placeholder with your actual ngrok URL, and POSTs the full config to the Vapi `/assistant` API. The new agent ID is printed on success and the agent appears immediately in your Vapi dashboard — no manual steps needed.

### Option B — recreate manually

Agent settings:

| Setting | Value |
|---------|-------|
| Name | Assistente Comune di Codroipo |
| Transcriber | Deepgram nova-2, language: `it` |
| Model | OpenAI gpt-4o-mini, temp: 0.4, max tokens: 250 |
| Voice | Azure `it-IT-ElsaNeural` |
| Silence timeout | 30 s |
| Max call duration | 600 s |

Tools — four server-URL tools pointing to your backend:

| Tool name | Method | Endpoint |
|-----------|--------|----------|
| `cerca_servizio` | POST | `/tools/cerca-servizio` |
| `prenota_appuntamento` | POST | `/tools/prenota-appuntamento` |
| `verifica_appuntamento` | POST | `/tools/verifica-appuntamento` |
| `cancella_appuntamento` | POST | `/tools/cancella-appuntamento` |

The full system prompt and tool schemas are in `docs/vapi_agent_config.json`.

---

## Backend API reference

All tool endpoints accept JSON and return `{ result: "..." }` (plain Italian text read aloud by Vapi).

### `POST /tools/cerca-servizio`
Keyword/semantic search over the knowledge base.

```json
{ "domanda": "documenti per carta d'identità" }
```

### `POST /tools/prenota-appuntamento`
Book an appointment. Returns a short alphanumeric booking ID.

```json
{
  "nome": "Mario",
  "cognome": "Rossi",
  "servizio": "Anagrafe",
  "data": "2025-06-20",
  "ora": "10:00",
  "motivo": "rinnovo carta identità"
}
```

### `POST /tools/verifica-appuntamento`
Look up an existing appointment by ID.

```json
{ "id": "A1B2C3D4", "cognome": "Rossi" }
```

### `POST /tools/cancella-appuntamento`
Cancel an appointment after confirmation.

```json
{ "id": "A1B2C3D4", "cognome": "Rossi" }
```

### `GET /appuntamenti`
Returns all appointments (used by the admin dashboard).

### `DELETE /appuntamenti/:id`
Delete an appointment directly from the dashboard.

### `GET /health`
Returns `{ status: "ok", appointments: N }`.

---

## RAG — knowledge base

`backend/data/codroipo_services.json` contains 14 hardcoded chunks covering:

- Anagrafe (CIE, passport, residence, certificates)
- Tributi (IMU, TARI)
- Edilizia e Urbanistica (SCIA, building permits)
- Servizi Sociali (home care, social bonuses)
- General info (office hours, contacts, online services, schools, waste collection)

**Default mode — keyword search** (zero extra dependencies):
Tokens from the query are matched against title + content + category. Title matches are weighted double. Top 3 results are returned and concatenated into the tool response.

**Optional — Gemini semantic search** (`USE_EMBEDDINGS=true`):
Requires `GEMINI_API_KEY`. Vectors are built at startup using `gemini-embedding-001` and stored in memory. Cosine similarity is used for retrieval with a 0.2 score threshold.

**Updating the knowledge base:**
```bash
cd backend
node scraper.js
```
Scrapes the live Codroipo municipality website and merges new chunks into the JSON file, deduplicating by title. Safe to run repeatedly.

---

## Admin dashboard

Available at `http://localhost:3000` (local) or `http://localhost:8080` (Docker frontend container).

Features:
- Live metrics: total, today, this week, top service
- Filter by service category
- Full-text search across name, ID, service, reason
- Delete appointments
- Export filtered results as CSV
- Auto-refresh every 30 seconds
- Configurable backend endpoint (useful when backend URL changes)

---

## Notes on the ngrok tunnel

Vapi embeds tool URLs at agent creation time. If your ngrok URL changes (e.g. after restarting ngrok on the free plan):

1. Update `PUBLIC_URL` in `backend/.env`
2. Re-run `node create_agent.js` — this creates a new agent with the updated URLs
3. Select the new agent in your Vapi dashboard for testing

To avoid this, use a paid ngrok plan with a fixed domain, or deploy the backend to a permanent URL.
