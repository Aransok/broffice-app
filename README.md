# Broffice

A full-stack e-commerce platform for a Bulgarian office-supplies retailer — a modern Django + React rebuild of an existing storefront, plus a full admin back office for managing the catalog, orders, promotions, and customers.

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
- Order confirm/reject workflow with automatic customer + admin email notifications and PDF invoices (admin copies additionally show profit)
- Promotion and coupon management, independently targetable by scope (product/category/site) and audience (a specific client or everyone)
- Per-customer activity view and cart management tool
- A built-in help chat, including a conversational wizard that creates promotions/coupons from natural-language replies
- Live catalog sync from the supplier's API (safe to re-run, never overwrites manually-set prices)

## Tech stack

- **Backend:** Django 5, Django REST Framework, PostgreSQL, Redis, Celery, Pillow, `rembg` (background removal), ReportLab (PDF generation)
- **Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS
- **Testing:** pytest / pytest-django, Vitest, ESLint, Ruff, Black
- **Infra:** Docker Compose (Postgres, Redis, Django, Celery worker + beat, Vite dev server)

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
