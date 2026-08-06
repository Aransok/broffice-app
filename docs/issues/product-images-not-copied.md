# Product/category images were never copied into `media/`

## What's unknown / missing

`docs/DATABASE_DESIGN.md`'s "Image Storage" philosophy calls for: copy originals into `media/products/` etc., generate Large/Medium/Thumbnail/WebP variants, store only paths+hash+dimensions in Postgres. **None of that actually happened.**

Verified directly:
- `backend/media/products/` (and `brands/`, `categories/`, etc.) are empty — only the top-level `.gitkeep`.
- `ProductImage.path` stores the **original HTTrack-relative path** (e.g. `image/product/63778b9eb.png`), not a `media/`-relative one.
- `ProductImage.thumbnail_path` / `webp_path` are empty strings on every row — the resize/webp step never ran.
- `parser/image_parser.py` (`ImageParser.enrich`) only computes a hash/size and confirms `exists_on_disk` against the HTTrack mirror — it never reads-and-writes the file into Django's media storage. There is no copy/resize/webp step anywhere in `parser/` or `importer/`.

So the images genuinely only exist inside `../officecenter-bg.com/` (the read-only source mirror), never inside this project's own `media/`.

## Why it matters

Task 007+ (catalog pages) need to render product images. Rendering nothing/broken `<img>` tags violates the project's "no broken links or images" Definition of Done; fabricating a fake pipeline would violate "never guess."

## Interim decision (this session)

Added a **DEBUG-only** Django static route (`backend/config/urls.py`) serving `HTTRACK_ROOT` directly under `/legacy-media/<path>`, mirroring the existing `MEDIA_URL` static serve. The frontend builds image URLs against this route for now. This is a passthrough of already-public site assets, not a workaround of the "never use the mirror as final implementation" rule (that rule is about HTML/markup/JS, not raw image bytes) — but it is explicitly a bridge, not the real pipeline, and must not ship to production as-is (`DEBUG`-gated, dev only).

## Recommended real fix (separate task, not this session)

Build the actual copy+resize+webp step: read each `ProductImage`/`CategoryImage`/brand-logo original from the HTTrack mirror (or a fresh crawl), generate the Original/Large/Medium/Thumbnail/WebP variants into `backend/media/{products,categories,brands}/`, and update `path`/`thumbnail_path`/`webp_path` to the new `media/`-relative locations. Then remove the `/legacy-media/` bridge route entirely.

## Update (task 028): new admin-uploaded images bypass this entirely

The new admin product form's image upload (`POST /admin/products/{id}/images/`) saves real files under `media/products/{product_id}/` via Django's `default_storage` — no bridge involved, no thumbnail/webp generation either (same gap, just for new uploads). `frontend/src/api/media.ts::getImageUrl()` now distinguishes the two: paths starting with `products/`/`categories/`/`brands/` go through `/media/`, everything else (legacy-imported paths) still goes through `/legacy-media/`. So the client's future product DB import (see `ai-memory/decisions.md`) should either populate `ProductImage` the same way the admin upload does (real files under `media/`), or the recommended real fix above still applies to make imported-legacy images consistent.
