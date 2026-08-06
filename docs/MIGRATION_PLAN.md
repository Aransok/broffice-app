# Migration Plan

## Pipeline

```
HTTrack mirror + Live crawl
        ↓
Parser (HTML → structured JSON)
        ↓
knowledge/*.json
        ↓
Validation
        ↓
Importer (idempotent upsert)
        ↓
PostgreSQL + media/
        ↓
Django REST API
        ↓
React frontend
```

## Knowledge base files

| File | Contents |
|------|----------|
| site.json | Site summary stats |
| pages.json | All pages |
| products.json | Products (no raw HTML) |
| categories.json | Category hierarchy |
| brands.json | Brands |
| images.json | Image metadata + paths |
| navigation.json | Menus |
| components.json | UI components |
| routes.json | URL → type mapping |
| seo.json | SEO blocks |
| relationships.json | Entity graph |
| statistics.json | Counts |
| problems.json | Issues found |
| report.md | Human summary |

## Parser rules

- Parser never guesses — only extracts
- Every parser returns: status, errors, warnings, metadata, content, relationships, media, seo
- Never return raw HTML
- Running importer twice must not create duplicates (use external IDs / slugs / hashes)

## Media pipeline

1. Resolve image from HTTrack `image/` or download from live URL
2. Compute SHA-256 hash for deduplication
3. Copy to `media/products/{id}/` (or categories/brands)
4. Generate WebP + thumbnail variants
5. Store paths only in DB

## Live crawl rules

- Include: `/`, `/category/*`, `/product/*`, `/brand/*`, sitemap, static pages
- Exclude: `?page=`, `?sort=`, `?filter=`, tracking, cache
- Rate limit: 1–2 req/sec
- Respect robots.txt
