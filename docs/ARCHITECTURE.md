# Architecture

Status: Draft (Phase 1)

## System layers

```
Layer 1  Importer / Crawler   → reads HTTrack + live site
Layer 2  Parser               → extracts structured data
Layer 3  Database (PostgreSQL)→ stores normalized information
Layer 4  REST API (DRF)       → serves React
Layer 5  React Frontend       → displays data
```

Never allow React to read HTML files directly.
Never use Django templates for catalog pages.
Everything must come from REST API.

## Django applications

| App | Responsibility |
|-----|----------------|
| core | Settings model, shared base models |
| products | Product, ProductImage, ProductDocument, specs, attributes |
| categories | Category tree |
| brands | Brand |
| pages | Static / CMS pages |
| navigation | Menu, MenuItem |
| media_app | MediaAsset metadata |
| seo | SEO fields, Redirect |
| accounts | User profiles, roles |
| orders | Order, OrderItem, OrderNotification |
| promotions | Promotion rules |
| pricing | AdminPriceOverride / dual pricing |
| api | URL routing / viewset registration |
| common | Shared utilities, selectors, services |

Business logic lives in `services.py` / `selectors.py`, never in views.

## API design

Versioned under `/api/v1/`:

Public:

- `GET /products/`, `GET /products/{slug}/`
- `GET /categories/`, `GET /categories/{slug}/`
- `GET /brands/`
- `GET /pages/{slug}/`
- `GET /navigation/`
- `GET /search/`
- `POST /orders/`

Admin (`IsAdminUser`):

- `GET /admin/products/` — spreadsheet list
- `PATCH /admin/products/{id}/pricing/`
- `GET /admin/notifications/`
- `POST /admin/orders/{id}/confirm/`
- `POST /admin/orders/{id}/reject/`
- `CRUD /admin/promotions/`

## Frontend architecture

- React + Vite + TypeScript
- React Router for public + admin routes
- TanStack Query for server state
- TailwindCSS matching discovered design system
- Admin routes guarded by auth + role check

## Deployment

Docker Compose: postgres, redis, backend (Gunicorn in prod), celery-worker, frontend (Nginx in prod)
