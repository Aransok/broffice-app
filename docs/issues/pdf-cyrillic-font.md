# PDF invoice generator needs a Cyrillic-capable font on the production host

`orders/pdf.py::generate_invoice_pdf` renders Bulgarian text with reportlab. reportlab's
built-in fonts (Helvetica, Times, Courier) have **no Cyrillic glyphs at all** — Bulgarian
text would render as blank boxes/missing characters unless a Unicode TTF is registered.

## What the code does

At import/first-use, `_register_fonts()` looks for a Cyrillic-capable TTF at, in order:

1. `PDF_FONT_REGULAR_PATH` / `PDF_FONT_BOLD_PATH` env vars, if set.
2. `/usr/share/fonts/truetype/dejavu/DejaVuSans[-Bold].ttf` or
   `/usr/share/fonts/dejavu/DejaVuSans[-Bold].ttf` — DejaVu Sans ships by default on
   nearly every Linux distro (Debian/Ubuntu's `fonts-dejavu-core` package is a dependency
   of many other packages and is very often already installed).
3. `C:/Windows/Fonts/arial.ttf` / `arialbd.ttf` — covers local Windows dev machines only.
4. Falls back to plain Helvetica (no Cyrillic) if none of the above exist, so PDF
   generation never crashes — it just silently produces unreadable Bulgarian text.

No font file was bundled into the repo for this — a font's license needs to be verified
before shipping it in the codebase, and that wasn't done this session. Rather than guess,
the code relies on a font already being present on the host.

## Action needed before going to production

- **Verify** the target VPS (see `docs/DEPLOYMENT_SUPERHOSTING.md`) actually has
  `fonts-dejavu-core` (or equivalent) installed: `dpkg -l | grep dejavu` on Debian/Ubuntu,
  or `fc-list | grep -i dejavu`.
- If missing, either `apt install fonts-dejavu-core` on the server, or set
  `PDF_FONT_REGULAR_PATH`/`PDF_FONT_BOLD_PATH` to a specific, license-cleared TTF file
  path and confirm it's actually present at that path in the deployed environment.
- Confirmed working locally against this dev machine's `C:/Windows/Fonts/arial.ttf`.
