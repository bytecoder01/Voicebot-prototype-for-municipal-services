# Voicebot prototype for municipal services

This repository contains a Vapi voicebot prototype for the Comune di Codroipo use case. It supports:
- answering questions about municipal services (RAG)
- booking, checking, and cancelling appointments

## What is included
- Vapi agent configuration: docs/vapi_agent_config.json
- Backend API: backend/
- RAG data and scraper: backend/data/codroipo_services.json, backend/scraper.js
- Frontend admin dashboard: frontend/public/index.html

## Quick start (local)
1. Install Node.js 18+
2. Set variables in backend/.env (VAPI_PRIVATE_KEY is required; PUBLIC_URL is required to create the Vapi agent)
3. Start the backend:
   - cd backend
   - npm install
   - npm start
4. Open the dashboard at http://localhost:3000

## Docker compose
1. docker-compose up -d
2. Backend: http://localhost:3000
3. Frontend: http://localhost:8080

## Expose backend to Vapi (ngrok)
1. Run ngrok: ngrok http 3000
2. Copy the public URL
3. Set PUBLIC_URL in backend/.env

## Create the Vapi agent
1. Set VAPI_PRIVATE_KEY and PUBLIC_URL in backend/.env
2. Run: node create_agent.js
3. The agent appears in your Vapi dashboard

## Backend tools (Vapi)
- POST /tools/cerca-servizio
- POST /tools/prenota-appuntamento
- POST /tools/verifica-appuntamento
- POST /tools/cancella-appuntamento

## Notes on choices
- RAG defaults to fast keyword search for reliability on Windows and no extra dependencies.
- Optional semantic search via Gemini embeddings is supported in backend/ragService.js.
- Appointments are stored in memory by default; PostgreSQL is available via docker-compose.

## Limitations
- Tool URLs are embedded at agent creation; update PUBLIC_URL and recreate the agent when the tunnel changes.
- Keyword RAG is less precise than full vector search.
- No authentication or rate limiting on the backend.

## Improvements with more time
- Add vector DB for embeddings and better ranking.
- Integrate real calendar availability and office working hours validation.
- Add auth and audit logging for appointment changes.
- Add automated tests for tool endpoints and RAG.

## AI tools used
- GitHub Copilot was used for code edits and validation.
