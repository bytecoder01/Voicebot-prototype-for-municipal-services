# AI tools used

**GitHub Copilot** — code completion for Express routes, PostgreSQL query patterns, and Docker Compose config. Suggestions were reviewed and adjusted, not accepted wholesale. Also useful as a lightweight review pass — inline suggestions surfaced edge cases like missing `await` on async DB calls.

**Claude (Anthropic)** — system prompt drafting and iteration. Used to critique early versions of the agent prompt for tone (too chatbot-like) and completeness (missing edge cases for silence, aggressive callers, off-topic requests).

Architectural decisions, knowledge base content, tool design, and the `extractArgs` normalisation logic were all written by hand.
