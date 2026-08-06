# Category hierarchy was never captured

## Status: RESOLVED (2026-07-25)

Root cause found and fixed: `parser/category_parser.py`'s breadcrumb parent-detection regex only matched absolute-style hrefs (`category/{id}/{slug}.html`), but the actual breadcrumb markup on every category page uses a **relative** parent link (e.g. `href="../369/opakoviecni-materiali.html"` from within `category/52/...`), which never contains the literal substring `category/`. Confirmed via direct inspection of `officecenter-bg.com/category/52/tikso-i-dispensieri.html`.

Fix: normalize the href (strip leading `../`/`./`) before matching `(?:category/)?(\d+)/([^/]+?)(?:\.html)?$`. Verified against the real file — `parent_id` now correctly resolves to `369`.

Re-ran `scripts/build_knowledge.py` (regenerates `knowledge/categories.json`) and `manage.py import_knowledge` (already had correct parent-wiring logic, just never got real `parent_id` values before). Result: 286 categories, **12 real root departments** with **275 categories now correctly parented** (up from 0), matching the live site's actual department structure (Канцеларски материали, Мебели, Техника, Хигиена и козметика, etc.).

The remaining 11 categories with no parent are genuinely top-level in the source data (not a parsing gap) — expected.

## Original problem (for history)

Every one of the 286 imported categories had `parent = null`. The legacy site's real structure is a 3-level department mega-menu (`.department-megamenu` blocks in `index.html`), but the hierarchy was captured from each category page's own breadcrumb trail, not the homepage mega-menu markup.

## Follow-up

Header navbar (task 006's flat quick-links placeholder) is being rebuilt against this real hierarchy to match the live site's "Категории" dropdown + department mega-menu.
