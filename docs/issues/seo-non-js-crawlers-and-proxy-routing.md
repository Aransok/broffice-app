# SEO: non-JS crawlers, and reverse-proxy routing for the real domain

Two real, known limitations of the SEO implementation (backend `seo` app +
frontend `<Seo>`/react-helmet-async), left as documented follow-ups rather
than guessed at.

## 1. Non-JS-executing crawlers/bots don't see per-page meta tags

The frontend is a purely client-rendered SPA (Vite + React, no SSR). All
title/description/canonical/Open Graph/JSON-LD tags are set at runtime by
`<Seo>` via `react-helmet-async`, after JavaScript executes.

- **Googlebot**: fine — it renders JS (two-wave indexing) and sees the real
  per-page tags.
- **Bing, and most social-link unfurlers (Facebook, Twitter/X, LinkedIn,
  Slack)**: do **not** reliably execute JavaScript. They only ever see
  `frontend/index.html`'s static shell (generic title, no description, no
  Open Graph tags at all) — a shared link to any product/category will not
  show a proper preview card on those platforms.
- Most known AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) also do not
  execute JavaScript today, though this changes over time. `llms.txt`
  (`/llms.txt`) and the JSON-LD embedded per page partially mitigate this —
  an AI system that fetches `/llms.txt` or the sitemap gets real structured
  data even without running JS — but a raw per-page fetch still only returns
  the static shell.

**Fix, if/when this matters enough to prioritize**: either real SSR (a
framework change, out of scope for a quick patch) or a "dynamic rendering"
layer — detect known bot User-Agents at the reverse-proxy or Django level and
serve a prerendered snapshot (e.g. via a headless-browser render cache) only
to those agents, leaving real users on the SPA untouched. Google explicitly
endorsed this pattern for JS-heavy sites for exactly this reason. Not
implemented now — flagging so it's a deliberate choice later, not a silent
gap.

## 2. Reverse-proxy must route `/robots.txt`, `/sitemap.xml`, `/llms.txt` to Django

These three are Django views (`backend/seo/views.py`), registered at the
project root in `backend/config/urls.py` — not part of the React build. In
production the frontend static build and the Django backend will sit behind
a single reverse proxy (no nginx config exists in this repo yet — see the
hosting/deployment notes), same as `/api/` and `/media/` already need to be
proxied to Django today.

**When that proxy config gets written**, it must also route:

```
/robots.txt   -> Django
/sitemap.xml  -> Django
/llms.txt     -> Django
```

Missing this means the frontend's static build (or a proxy default/404)
answers those paths instead of Django's real, DB-backed versions — search
engines would see nothing (or the wrong thing) at exactly the URLs they
check first.

`FRONTEND_BASE_URL` (`.env` / `.env.example`) must be set to the real
production URL (`https://www.broffice.bg`) for these to emit correct
absolute URLs — it defaults to `http://localhost:5173` for local dev.
