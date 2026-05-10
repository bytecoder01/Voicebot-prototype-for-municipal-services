# Design choices, limitations, and improvements

## Key choices

**Keyword search as default RAG**
The knowledge base has 14 well-labelled Italian chunks. Keyword matching with title boosting (title hits count double) retrieves the right document reliably for this size and adds zero dependencies. Gemini semantic embeddings (`gemini-embedding-001`) are supported as an opt-in via `USE_EMBEDDINGS=true` for when the knowledge base grows.

**Four separate tools**
Each action (search, book, check, cancel) is a narrow tool. This makes the model's tool-selection more reliable than a single multi-action tool and keeps error messages targeted.

**Short booking IDs**
UUIDs are truncated to 8 uppercase hex characters (e.g. `A1B2C3D4`). A full UUID read aloud over the phone is unusable.

**PostgreSQL with in-memory fallback**
`database.js` checks for `DATABASE_URL` at startup. If absent, it falls back to a plain `Map`. The backend runs identically in both local-dev and Docker modes with no code branches in business logic.

**Agent prompt design**
The system prompt enforces formal Italian ("lei"), one question per turn, filler phrases before tool calls, and a confirmation step before booking. These are all specific to phone conversation — the agent should sound like a municipal clerk, not a chatbot.

**Temperature 0.4, max tokens 250**
Keeps responses factual, consistent, and short enough to read aloud naturally (~30–40 Italian words per turn).

---

## Limitations

- Tool URLs are baked into the agent at creation time — when the ngrok tunnel changes, `create_agent.js` must be re-run.
- No authentication on any endpoint (no Vapi webhook secret check, no dashboard auth).
- No real availability check — only prevents exact date/time/service collisions, no office hours or holiday awareness.

---

## What I would improve with more time

- **pgvector** — add vector search as a PostgreSQL extension (already in the stack) instead of in-memory embeddings.
- **Real calendar integration** — enforce office hours, surface actual available slots, prevent double-booking across channels.
- **Auth** — Vapi webhook secret on tool endpoints, JWT on the admin API.
- **Automated tests** — unit tests for RAG, DB, and all four tool endpoints; integration tests simulating the Vapi request cycle.
- **Call log storage** — persist Vapi call summaries and intent data to the database and surface them in the dashboard.
