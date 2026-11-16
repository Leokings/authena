"""Renders docs/POLICY.md as kleros/policy.pdf (Curate asks for a PDF policy).

    python scripts/policy-pdf.py
"""
import re
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

src = Path("docs/POLICY.md").read_text(encoding="utf-8")
out = Path("kleros/policy.pdf")
out.parent.mkdir(exist_ok=True)

base = getSampleStyleSheet()
body = ParagraphStyle("body", parent=base["BodyText"], fontName="Helvetica", fontSize=11, leading=16, spaceAfter=8)
title = ParagraphStyle("title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24, spaceAfter=14, alignment=0)


def inline(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return re.sub(r"`([^`]+)`", r'<font face="Courier" size="10">\1</font>', text)


flow, bullets, numbered = [], [], []


def flush() -> None:
    global bullets, numbered
    for items, kind in ((bullets, "bullet"), (numbered, "1")):
        if items:
            flow.append(ListFlowable([ListItem(Paragraph(inline(i), body)) for i in items], bulletType=kind, leftIndent=16))
            flow.append(Spacer(1, 4))
    bullets, numbered = [], []


for line in src.splitlines():
    line = line.rstrip()
    if line.startswith("# "):
        flush()
        flow.append(Paragraph(inline(line[2:]), title))
    elif re.match(r"^\d+\. ", line):
        numbered.append(re.sub(r"^\d+\. ", "", line))
    elif line.startswith("- "):
        bullets.append(line[2:])
    elif line.startswith("  ") and (bullets or numbered):
        (bullets if bullets else numbered)[-1] += " " + line.strip()
    elif not line:
        flush()
    else:
        flush()
        flow.append(Paragraph(inline(line), body))
flush()

# A fixed creation date keeps the file byte-identical between runs, so its IPFS address is stable.
doc = SimpleDocTemplate(str(out), pagesize=A4, leftMargin=22 * mm, rightMargin=22 * mm, topMargin=22 * mm, bottomMargin=22 * mm, title="Authena list policy", author="Authena", invariant=1)
doc.build(flow)
print(f"wrote {out} ({out.stat().st_size} bytes)")
