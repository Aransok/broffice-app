"""Generates docs/GO_LIVE_CHECKLIST.pdf from docs/GO_LIVE_CHECKLIST.txt.

One-off content document (contains real deployment secrets — both the .txt
source and this .pdf output are gitignored, never committed). Renders the
whole file as monospace/preformatted text, exactly as written in the .txt
(a runbook meant to be copy-pasted needs to render commands with perfect
fidelity — no fancy prose-vs-code heuristics that could misrender a
command), except "PHASE N" lines, which get pulled out and styled as
section headers so a printed copy is still scannable at a glance.

Regenerate after editing the .txt:
    backend/.venv/Scripts/python.exe scripts/generate_go_live_checklist_pdf.py
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Preformatted, SimpleDocTemplate, Spacer

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE = PROJECT_ROOT / "docs" / "GO_LIVE_CHECKLIST.txt"
OUTPUT = PROJECT_ROOT / "docs" / "GO_LIVE_CHECKLIST.pdf"

TITLE_STYLE = ParagraphStyle(
    "Title", fontName="Helvetica-Bold", fontSize=16, spaceAfter=6 * mm
)
PHASE_STYLE = ParagraphStyle(
    "Phase",
    fontName="Helvetica-Bold",
    fontSize=13,
    spaceBefore=7 * mm,
    spaceAfter=2 * mm,
    textColor=colors.HexColor("#1d4ed8"),
)
BODY_STYLE = ParagraphStyle(
    "Body", fontName="Courier", fontSize=9, leading=12.5
)


def build_story(lines: list[str]) -> list:
    story: list = []
    block: list[str] = []

    def flush():
        if block:
            story.append(Preformatted("\n".join(block), BODY_STYLE))
            block.clear()

    for raw in lines:
        line = raw.rstrip("\n")
        if line.strip().startswith("===") and not block:
            continue
        if line.strip().startswith("PHASE "):
            flush()
            story.append(Paragraph(line.strip(), PHASE_STYLE))
            continue
        if line.strip().startswith("===") and block:
            flush()
            story.append(Spacer(1, 3 * mm))
            continue
        block.append(line)

    flush()
    return story


def main() -> None:
    lines = SOURCE.read_text(encoding="utf-8").splitlines()

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title="BRoffice - Go-Live Checklist",
    )

    story = [Paragraph("BRoffice.bg - Go-Live Checklist", TITLE_STYLE)]
    story += build_story(lines)

    doc.build(story)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
