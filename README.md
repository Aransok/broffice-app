# Broffice

A full-stack e-commerce platform for a Bulgarian office-supplies retailer — a ground-up Django + React rebuild of an existing storefront, plus a complete admin back office for managing the catalog, orders, promotions, and customers. In production, serving real customers.

**Live site:** [www.broffice.bg](https://www.broffice.bg)

## Highlights

- **Full-stack, production system** — not a demo. Real customers, real orders, real supplier catalog sync, running live.
- **Self-hosted CI/CD pipeline** — GitHub Actions with a self-hosted runner builds, tests, and deploys on every push; separate on-demand workflows for remote diagnostics and disaster recovery, so the production machine can be inspected and fixed without physical access.
- **Automated backups & recovery** — nightly database + media dumps via Windows Task Scheduler, a restore mechanism triggerable from the admin panel, and a watchdog that detects and recovers from a crashed Docker host automatically.
- **AI-assisted asset pipeline** — homepage promo banners are generated automatically (Pillow-composited, with ML-based background removal on product photos) the moment a promotion goes active, no manual design work required.
- **Dual pricing engine** — every product carries a client price and a reseller cost simultaneously, with live profit-margin visibility for admins and a promotion/override system that resolves correctly regardless of which one applies.
- **Real B2B support** — company orders with EIK/VAT capture, PDF order documents with proper Cyrillic rendering, and an invoice/credit-note numbering scheme independent of the public order number.
- **Conversational admin tooling** — a built-in help chat that not only answers "how do I..." questions but can create promotions and coupons directly from a natural-language reply.

## Features

**Storefront**
- Product catalog with categories, subcategories, brands, and full-text search
- Dual-currency pricing (BGN/EUR) at Bulgaria's fixed conversion rate
- Content-based "similar products" and personalized "recommended for you" sections
- Shopping cart, guest and registered checkout, B2B (company/VAT) orders
- Speedy courier integration (office pickup or address delivery)
- Coupon codes and site-wide/category/product promotions
- Automatically generated homepage promo banners (Pillow-composited, with background-removed product photos) whenever a promotion goes active
- Dark mode plus several visual themes
- Cookie consent, legal pages, favorites, order history

**Admin panel**
- Dual pricing (client price vs. reseller cost) with live profit-margin display, admin-only
- Product CRUD with multi-image upload and structured specifications
- Order confirm/reject workflow with automatic customer + admin email notifications and PDF order documents (admin copies additionally show profit)
- Promotion and coupon management, independently targetable by scope (product/category/site) and audience (a specific client or everyone)
- Per-customer activity view and cart management tool
- A built-in help chat, including a conversational wizard that creates promotions/coupons from natural-language replies
- Live catalog sync from the supplier's API (safe to re-run, never overwrites manually-set prices)

**Operations**
- Self-hosted GitHub Actions CI/CD: lint, test, and deploy on every push
- Nightly automated database + media backups with retention pruning
- Admin-triggered restore, and a watchdog that recovers a crashed Docker host without manual intervention
- On-demand remote diagnostics workflow for production troubleshooting

## Tech stack

- **Backend:** Django 5, Django REST Framework, PostgreSQL, Redis, Celery, Pillow, `rembg` (background removal), ReportLab (PDF generation)
- **Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS
- **Testing:** pytest / pytest-django, Vitest, ESLint, Ruff, Black
- **Infra:** Docker Compose (Postgres, Redis, Django, Celery worker + beat, Caddy), GitHub Actions (self-hosted runner)

## Getting started

### With Docker (recommended)

```bash
cp .env.example .env   # fill in the values you need
docker compose up
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1
- Django admin: http://localhost:8000/django-admin

### Without Docker

**Backend**

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate   # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Without `POSTGRES_HOST` set, the backend falls back to SQLite for local development.

## Testing

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm run test
```

## Project structure

```
backend/     Django + DRF API, one app per domain concept (products, orders,
             promotions, coupons, banners, pricing, ...)
frontend/    React + Vite + TypeScript SPA
parser/      HTML → structured JSON extractors (source-data migration)
importer/    JSON → database loaders
knowledge/   Extracted structured site data used by the importer
docs/        Architecture notes, database design, known issues
scripts/     One-off maintenance/generation scripts
docker-compose.yml
```
