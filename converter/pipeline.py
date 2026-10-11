"""PDF -> Tiptap-friendly HTML.

Docling decides *what* each block is (title, heading, paragraph, list item,
picture, table, header/footer) and its reading order and bounding box.
pdfplumber then reads the characters inside each text block to recover the
font, size, colour and bold/italic, which Docling doesn't expose.

Pictures and tables (including vector charts, which Docling's layout model
finds on the rendered page) are cropped out as PNGs.
"""

import base64
import html
import io
import os
import re
from collections import Counter
from dataclasses import dataclass

import pdfplumber
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import (
    CodeItem,
    DocItemLabel,
    ListItem,
    PictureItem,
    SectionHeaderItem,
    TableItem,
    TextItem,
)

SKIP_LABELS = {DocItemLabel.PAGE_HEADER, DocItemLabel.PAGE_FOOTER}
PT_TO_PX = 96 / 72
LIST_MARKER = re.compile(r"^\s*([•●○▪■◦‣∙·\-–—*]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)])\s+")


def _env_flag(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def build_converter():
    opts = PdfPipelineOptions()
    opts.artifacts_path = os.environ.get("DOCLING_ARTIFACTS_PATH") or None
    # Digital PDFs already contain text; OCR is slow and only needed for scans
    opts.do_ocr = _env_flag("DOCLING_OCR", False)
    # Tables are returned as images, so the table-structure model isn't needed
    opts.do_table_structure = _env_flag("DOCLING_TABLE_STRUCTURE", False)
    opts.generate_page_images = True
    opts.generate_picture_images = True
    opts.images_scale = 2.0

    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
    )
    converter.initialize_pipeline(InputFormat.PDF)
    return converter


# --- Styling helpers -------------------------------------------------------


@dataclass(frozen=True)
class Style:
    family: str
    size: float
    color: str
    bold: bool
    italic: bool


@dataclass
class Run:
    text: str
    style: Style | None


@dataclass
class Line:
    x0: float
    x1: float
    words: list


WEIGHT_SUFFIX = re.compile(
    r"\s*\b(Bold|Italic|Oblique|Regular|Light|Medium|Semibold|SemiBold|Demi|Black|Heavy|Thin|Book)\b.*$"
)


def clean_font_name(fontname):
    """'ABCDEF+TimesNewRomanPS-BoldMT' -> 'Times New Roman'."""
    name = re.sub(r"^[A-Z]{6}\+", "", fontname or "")
    name = re.split(r"[-,]", name)[0]
    name = re.sub(r"(PSMT|PS|MT)$", "", name)
    name = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name).strip()
    name = WEIGHT_SUFFIX.sub("", name).strip()
    return name or "sans-serif"


def css_font_family(family):
    lower = family.lower()
    if re.search(r"mono|courier|consol|menlo", lower):
        generic = "monospace"
    elif "sans" not in lower and re.search(
        r"times|serif|georgia|garamond|cambria|minion|palatino|book|baskerville", lower
    ):
        generic = "serif"
    else:
        generic = "sans-serif"
    if family == generic:
        return generic
    return f"'{family}', {generic}"


def is_bold(fontname):
    return bool(re.search(r"bold|black|heavy|semibold|demi", fontname or "", re.I))


def is_italic(fontname):
    return bool(re.search(r"italic|oblique", fontname or "", re.I))


def to_hex(color):
    """pdfplumber colours are gray (1), RGB (3) or CMYK (4) tuples in 0..1."""
    if isinstance(color, (int, float)):
        color = (color,)
    if not isinstance(color, (tuple, list)) or not all(
        isinstance(v, (int, float)) for v in color
    ):
        return "#000000"
    if len(color) == 1:
        r = g = b = color[0]
    elif len(color) == 3:
        r, g, b = color
    elif len(color) == 4:
        c, m, y, k = color
        r, g, b = (1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)
    else:
        return "#000000"
    return "#" + "".join(f"{round(max(0, min(1, v)) * 255):02x}" for v in (r, g, b))


def word_style(word):
    fontname = word.get("fontname", "")
    return Style(
        family=clean_font_name(fontname),
        size=round(float(word.get("size", 0)) * 2) / 2,
        color=to_hex(word.get("non_stroking_color")),
        bold=is_bold(fontname),
        italic=is_italic(fontname),
    )


# --- Geometry helpers ------------------------------------------------------


def top_left_bbox(item, doc):
    prov = item.prov[0]
    page_height = doc.pages[prov.page_no].size.height
    bb = prov.bbox.to_top_left_origin(page_height=page_height)
    return prov.page_no, (bb.l, bb.t, bb.r, bb.b)


def contains(outer, inner, tol=2.0):
    return (
        inner[0] >= outer[0] - tol
        and inner[1] >= outer[1] - tol
        and inner[2] <= outer[2] + tol
        and inner[3] <= outer[3] + tol
    )


def words_in(page, bbox):
    """Words inside a Docling bbox (top-left origin, relative to the page)."""
    ox, oy = page.bbox[0], page.bbox[1]
    x0, top, x1, bottom = bbox[0] + ox, bbox[1] + oy, bbox[2] + ox, bbox[3] + oy

    # Docling's boxes hug the glyphs, while pdfplumber's char boxes span the
    # font's full ascent/descent, so match characters by their centre point
    def inside(obj):
        if obj.get("object_type") != "char":
            return False
        cx = (obj["x0"] + obj["x1"]) / 2
        cy = (obj["top"] + obj["bottom"]) / 2
        return x0 <= cx <= x1 and top <= cy <= bottom

    words = page.filter(inside).extract_words(
        extra_attrs=["fontname", "size", "non_stroking_color"]
    )
    for w in words:
        w["x0"] -= ox
        w["x1"] -= ox
        w["top"] -= oy
    return words


def group_lines(words):
    lines = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        tol = max(2.0, float(w.get("size", 10)) * 0.4)
        if lines and abs(lines[-1][0]["top"] - w["top"]) <= tol:
            lines[-1].append(w)
        else:
            lines.append([w])
    result = []
    for ws in lines:
        ws.sort(key=lambda w: w["x0"])
        result.append(Line(x0=ws[0]["x0"], x1=ws[-1]["x1"], words=ws))
    return result


def lines_to_runs(lines):
    runs = []

    def push(text, style):
        if runs and runs[-1].style == style:
            runs[-1].text += text
        else:
            runs.append(Run(text, style))

    for li, line in enumerate(lines):
        for wi, w in enumerate(line.words):
            # pdfplumber also splits words where the font changes ("34%" bold + ","),
            # so only add a space where there's a visible gap
            if wi > 0 and w["x0"] - line.words[wi - 1]["x1"] > float(w.get("size", 10)) * 0.15:
                push(" ", runs[-1].style)
            push(w["text"], word_style(w))
        if li < len(lines) - 1:
            nxt = lines[li + 1].words[0]["text"]
            # Re-join words hyphenated across a line break
            if runs[-1].text.endswith("-") and nxt[:1].islower():
                runs[-1].text = runs[-1].text[:-1]
            else:
                push(" ", runs[-1].style)
    return [r for r in runs if r.text]


def detect_alignment(lines, column):
    """Return 'center' | 'right' | 'justify', or None for the default (left)."""
    if not lines or not column:
        return None
    col_x0, col_x1 = column
    width = col_x1 - col_x0
    if width <= 0:
        return None
    tol = max(6.0, width * 0.02)
    gaps = [(ln.x0 - col_x0, col_x1 - ln.x1) for ln in lines]

    if all(lg > tol and abs(lg - rg) < tol for lg, rg in gaps):
        return "center"
    if all(lg > tol and rg < tol for lg, rg in gaps):
        return "right"
    if len(lines) >= 2:
        right_edge = max(ln.x1 for ln in lines)
        body = lines[:-1]
        if all(right_edge - ln.x1 < 2.0 for ln in body) and (
            len(lines) >= 3 or gaps[0][1] < tol
        ):
            return "justify"
    return None


def strip_list_marker(runs):
    if runs:
        runs[0].text = LIST_MARKER.sub("", runs[0].text, count=1)
    return [r for r in runs if r.text]


# --- Rendering -------------------------------------------------------------


def render_runs(runs, base):
    out = []
    for run in runs:
        text = html.escape(run.text, quote=False)
        st = run.style
        if st is not None:
            css = []
            if st.family != base.family:
                css.append(f"font-family: {css_font_family(st.family)}")
            if st.size and st.size != base.size:
                css.append(f"font-size: {st.size:g}pt")
            if st.color != base.color:
                css.append(f"color: {st.color}")
            if css:
                text = f'<span style="{html.escape("; ".join(css))}">{text}</span>'
            if st.italic:
                text = f"<em>{text}</em>"
            if st.bold:
                text = f"<strong>{text}</strong>"
        out.append(text)
    return "".join(out).strip()


def align_attr(align):
    return f' style="text-align: {align}"' if align else ""


def base_style(blocks):
    """The most common family/size/colour in body text, weighted by length."""
    families, sizes, colors = Counter(), Counter(), Counter()
    for b in blocks:
        if b["kind"] not in ("p", "li"):
            continue
        for r in b["runs"]:
            if r.style:
                n = len(r.text)
                families[r.style.family] += n
                sizes[r.style.size] += n
                colors[r.style.color] += n
    if not families:
        return None
    return Style(
        family=families.most_common(1)[0][0],
        size=sizes.most_common(1)[0][0],
        color=colors.most_common(1)[0][0],
        bold=False,
        italic=False,
    )


def promote_numbered_headings(blocks, base):
    """Docling can mistake a numbered heading ("3. Service uptime") for a list
    item. Treat list items much larger than body text as section headers."""
    if not base.size:
        return
    for b in blocks:
        if b["kind"] != "li":
            continue
        size = max((r.style.size for r in b["runs"] if r.style), default=0)
        if size >= base.size * 1.2:
            b.update(kind="section", tag="h2", level=1)


def assign_heading_levels(blocks):
    """Docling often gives every section header level 1; fall back to font size."""
    headers = [b for b in blocks if b["kind"] == "section"]
    if not headers:
        return
    levels = {b["level"] for b in headers}
    if len(levels) > 1:
        for b in headers:
            b["tag"] = "h2" if b["level"] <= 1 else "h3"
        return
    size_of = lambda b: max((r.style.size for r in b["runs"] if r.style), default=0)  # noqa: E731
    sizes = sorted({size_of(b) for b in headers}, reverse=True)
    # Docling sometimes labels the document title as a section header;
    # if there's no title, promote the largest heading size to h1
    has_title = any(b["kind"] == "title" for b in blocks)
    tags = ["h2", "h3"] if has_title or len(sizes) < 2 else ["h1", "h2", "h3"]
    for b in headers:
        rank = sizes.index(size_of(b))
        b["tag"] = tags[min(rank, len(tags) - 1)]


def render_blocks(blocks, base):
    parts = []
    i = 0
    while i < len(blocks):
        b = blocks[i]
        if b["kind"] == "img":
            width = f' width="{b["width"]}"' if b.get("width") else ""
            alt = html.escape(b["alt"] or "")
            parts.append(f'<img src="{b["src"]}" alt="{alt}"{width}>')
        elif b["kind"] == "code":
            parts.append(f"<pre><code>{html.escape(b['text'], quote=False)}</code></pre>")
        elif b["kind"] == "li":
            ordered = b["ordered"]
            items = []
            while i < len(blocks) and blocks[i]["kind"] == "li" and blocks[i]["ordered"] == ordered:
                li = blocks[i]
                runs = strip_list_marker(li["runs"])
                items.append(f"<li><p{align_attr(li['align'])}>{render_runs(runs, base)}</p></li>")
                i += 1
            tag = "ol" if ordered else "ul"
            parts.append(f"<{tag}>{''.join(items)}</{tag}>")
            continue
        else:
            inner = render_runs(b["runs"], base)
            if inner:
                tag = b["tag"]
                parts.append(f"<{tag}{align_attr(b['align'])}>{inner}</{tag}>")
        i += 1
    return "\n".join(parts)


def render_pages(blocks, base, page_sizes):
    """Wrap each PDF page's blocks in a page div. The editor styles these as
    separate sheets; without that CSS they're plain, invisible wrappers."""
    by_page = {}
    for b in blocks:
        by_page.setdefault(b["page"], []).append(b)
    parts = []
    for size in page_sizes:
        n = size["page"]
        # Keep empty pages so page numbers still match the PDF
        inner = render_blocks(by_page.get(n, []), base) or "<p></p>"
        parts.append(
            f'<div data-type="page" data-page="{n}" data-width="{size["width"]}" '
            f'data-height="{size["height"]}">\n{inner}\n</div>'
        )
    return "\n".join(parts)


# --- Main entry point ------------------------------------------------------


def convert_pdf(converter, path):
    doc = converter.convert(path).document
    items = [
        item
        for item, _level in doc.iterate_items()
        if getattr(item, "prov", None) and item.label not in SKIP_LABELS
    ]

    # Pre-pass: figure regions (to drop chart labels Docling left as text)
    # and the text column (to judge alignment). The column is measured across
    # the whole document: a page with only short lines would look too narrow.
    figures, column = {}, None
    for item in items:
        page_no, bbox = top_left_bbox(item, doc)
        if isinstance(item, (PictureItem, TableItem)):
            figures.setdefault(page_no, []).append(bbox)
        elif isinstance(item, TextItem):
            x0, x1 = column or (bbox[0], bbox[2])
            column = (min(x0, bbox[0]), max(x1, bbox[2]))

    blocks, assets = [], []
    caption_refs = set()

    with pdfplumber.open(path) as pdf:

        def text_block(item):
            page_no, bbox = top_left_bbox(item, doc)
            lines = group_lines(words_in(pdf.pages[page_no - 1], bbox))
            runs = lines_to_runs(lines) if lines else [Run(item.text, None)]
            return runs, detect_alignment(lines, column)

        def add(block):
            block["page"] = page_no
            blocks.append(block)

        for item in items:
            page_no, bbox = top_left_bbox(item, doc)
            if isinstance(item, (PictureItem, TableItem)):
                image = item.get_image(doc)
                if image is None:
                    continue
                name = f"fig-{len(assets) + 1}.png"
                buf = io.BytesIO()
                image.save(buf, format="PNG")
                assets.append(
                    {
                        "name": name,
                        "mime": "image/png",
                        "base64": base64.b64encode(buf.getvalue()).decode("ascii"),
                    }
                )
                add(
                    {
                        "kind": "img",
                        "src": name,
                        "alt": item.caption_text(doc),
                        "width": round((bbox[2] - bbox[0]) * PT_TO_PX),
                    }
                )
                # Captions are children of the figure, so they come right after it
                for ref in item.captions:
                    caption_refs.add(ref.cref)
                    caption = ref.resolve(doc)
                    if isinstance(caption, TextItem) and caption.prov:
                        runs, align = text_block(caption)
                        add({"kind": "p", "tag": "p", "runs": runs, "align": align})
                continue

            if not isinstance(item, TextItem) or item.self_ref in caption_refs:
                continue

            if any(contains(fig, bbox) for fig in figures.get(page_no, [])):
                continue

            if isinstance(item, CodeItem):
                add({"kind": "code", "text": item.text})
                continue

            runs, align = text_block(item)
            if isinstance(item, ListItem):
                # The marker is stripped at render time, in case this turns out to be a heading
                add(
                    {
                        "kind": "li",
                        "runs": runs,
                        "align": None,
                        "ordered": bool(getattr(item, "enumerated", False)),
                    }
                )
            elif item.label == DocItemLabel.TITLE:
                add({"kind": "title", "tag": "h1", "runs": runs, "align": align})
            elif isinstance(item, SectionHeaderItem):
                add(
                    {"kind": "section", "tag": "h2", "runs": runs, "align": align, "level": item.level}
                )
            else:
                add({"kind": "p", "tag": "p", "runs": runs, "align": align})

    base = base_style(blocks) or Style("sans-serif", 0, "#000000", False, False)
    promote_numbered_headings(blocks, base)
    assign_heading_levels(blocks)
    page_sizes = [
        {
            "page": n,
            "width": round(doc.pages[n].size.width * PT_TO_PX),
            "height": round(doc.pages[n].size.height * PT_TO_PX),
        }
        for n in sorted(doc.pages)
    ]
    if blocks:
        body = render_pages(blocks, base, page_sizes)
    else:
        body = "<p>No readable content extracted from PDF.</p>"

    return {
        "html": body,
        "assets": assets,
        "pages": doc.num_pages(),
        "pageSizes": page_sizes,
        "baseStyle": {
            "fontFamily": css_font_family(base.family),
            "fontSize": f"{base.size:g}pt" if base.size else None,
            "color": base.color,
        },
    }
