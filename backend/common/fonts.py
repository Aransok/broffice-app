"""Shared Cyrillic-capable TTF font paths — Bulgarian text needs a Unicode
font; reportlab/Pillow's built-in defaults have no Cyrillic glyphs. Rather
than bundling a font of uncertain license into the repo, this looks for one
already present on the host: DejaVu Sans ships by default on almost every
Linux distro (the expected production target), Arial covers local Windows
dev/deploy machines. Shared between the PDF invoice generator and the promo
banner generator so both fall back the same way."""

import os

FONT_PATH_CANDIDATES_REGULAR = [
    os.getenv("PDF_FONT_REGULAR_PATH", ""),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arial.ttf",
]
FONT_PATH_CANDIDATES_BOLD = [
    os.getenv("PDF_FONT_BOLD_PATH", ""),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def find_font_path(candidates: list[str]) -> str | None:
    return next((p for p in candidates if p and os.path.exists(p)), None)
