"""PDF -> exact-layout HTML for Tiptap.

OpenDataLoader PDF finds the blocks on each page (headings, paragraphs, list
items, captions, tables, images) with their bounding boxes and reading order.

pypdfium2 fills in what OpenDataLoader doesn't give:
- page sizes;
- each character's font, size and colour, so a bold or red phrase inside a
  paragraph keeps its style (OpenDataLoader has one style per block);
- vector drawings (charts, diagrams), which are grouped into figure regions;
- PNG crops of charts, tables and images.

Every block becomes an absolutely positioned "frame" inside a fixed-size page,
so the HTML looks like the PDF. Text that OpenDataLoader didn't put in any
block (such as bullet markers) still gets its own frame, so nothing visible is
dropped.
"""

import base64
import ctypes
import html
import io
import json
import math
import re
import statistics
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import opendataloader_pdf
import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c

PT_TO_PX = 96 / 72
RENDER_SCALE = 2.0  # figure crops are rendered at 144 dpi
DRAWING_GAP = 12.0  # pt: drawings closer than this belong to the same figure
FIGURE_PAD = 1.0  # pt around each crop
LINE_BREAK = "\n"
FIGURE_TYPES = {"table", "image", "picture"}
DRAWING_TYPES = (pdfium_c.FPDF_PAGEOBJ_PATH, pdfium_c.FPDF_PAGEOBJ_SHADING, pdfium_c.FPDF_PAGEOBJ_IMAGE)
FONT_FLAG_ITALIC = 64


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
class Char:
    text: str
    box: tuple | None = None  # loose box (left, bottom, right, top) in PDF points
    style: Style | None = None

    @property
    def cx(self):
        return (self.box[0] + self.box[2]) / 2

    @property
    def cy(self):
        return (self.box[1] + self.box[3]) / 2


@dataclass
class Line:
    x0: float
    x1: float
    bottom: float
    top: float


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


def odl_color(value):
    """OpenDataLoader colours are strings like '[0.04, 0.31, 0.54]' (0..1)."""
    try:
        parts = [float(v) for v in str(value).strip("[] ").split(",") if v.strip()]
    except ValueError:
        return "#000000"
    if len(parts) == 1:
        parts = parts * 3
    elif len(parts) == 4:
        c, m, y, k = parts
        parts = [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)]
    if len(parts) != 3:
        return "#000000"
    return "#" + "".join(f"{round(max(0, min(1, v)) * 255):02x}" for v in parts)


# --- Reading characters with pypdfium2 -------------------------------------


def char_style(raw, i):
    size = pdfium_c.FPDFText_GetFontSize(raw, i)
    # pdfium reports the font size before the text matrix is applied
    matrix = pdfium_c.FS_MATRIX()
    if pdfium_c.FPDFText_GetMatrix(raw, i, ctypes.byref(matrix)):
        size *= math.hypot(matrix.c, matrix.d) or 1

    length = pdfium_c.FPDFText_GetFontInfo(raw, i, None, 0, None)
    fontname, flags = "", ctypes.c_int(0)
    if length:
        buf = ctypes.create_string_buffer(length)
        pdfium_c.FPDFText_GetFontInfo(raw, i, buf, length, ctypes.byref(flags))
        fontname = buf.value.decode("utf-8", "replace")

    r, g, b, a = (ctypes.c_uint() for _ in range(4))
    pdfium_c.FPDFText_GetFillColor(raw, i, ctypes.byref(r), ctypes.byref(g), ctypes.byref(b), ctypes.byref(a))

    return Style(
        family=clean_font_name(fontname),
        size=round(size * 2) / 2,
        color=f"#{r.value:02x}{g.value:02x}{b.value:02x}",
        # pdfium's font-weight value is unreliable, so bold comes from the name
        bold=is_bold(fontname),
        italic=is_italic(fontname) or bool(flags.value & FONT_FLAG_ITALIC),
    )


def read_chars(textpage):
    """All characters on a page in content order. Spaces and line breaks
    (which pdfium generates) are kept as markers without a box."""
    raw = textpage.raw
    chars = []
    for i in range(textpage.count_chars()):
        code = pdfium_c.FPDFText_GetUnicode(raw, i)
        ch = chr(code) if code else ""
        if ch in ("\r", "\n"):
            if chars and chars[-1].text != LINE_BREAK:
                chars.append(Char(LINE_BREAK))
            continue
        if not ch or ord(ch) < 32:
            continue
        if ch.isspace():
            chars.append(Char(" "))
            continue
        chars.append(Char(ch, textpage.get_charbox(i, loose=True), char_style(raw, i)))
    return chars


def build_runs(chars, ks):
    """Text runs and line geometry for the characters at indices `ks`."""
    runs, lines = [], []
    line = None

    def push(text, style):
        if runs and (runs[-1].style == style or style is None):
            runs[-1].text += text
        else:
            runs.append(Run(text, style))

    prev = None
    for k in ks:
        ch = chars[k]
        if prev is not None:
            p = chars[prev]
            between = chars[prev + 1 : k]
            size = max(ch.style.size, 1)
            new_line = any(c.text == LINE_BREAK for c in between) or abs(ch.cy - p.cy) > size * 0.6
            if new_line:
                # Re-join words hyphenated across a line break
                if runs and runs[-1].text.endswith("-") and ch.text.islower():
                    runs[-1].text = runs[-1].text[:-1]
                else:
                    push(" ", None)
            elif any(c.text == " " for c in between) or ch.box[0] - p.box[2] > size * 0.2:
                push(" ", None)
            if new_line:
                lines.append(line)
                line = None
        push(ch.text, ch.style)
        l, b, r, t = ch.box
        if line is None:
            line = Line(l, r, b, t)
        else:
            line.x0, line.x1 = min(line.x0, l), max(line.x1, r)
            line.bottom, line.top = min(line.bottom, b), max(line.top, t)
        prev = k
    if line is not None:
        lines.append(line)
    return [r for r in runs if r.text.strip()], lines


# --- Figures (charts, tables, images) --------------------------------------


def overlaps(a, b, gap=0.0):
    return a[0] <= b[2] + gap and b[0] <= a[2] + gap and a[1] <= b[3] + gap and b[1] <= a[3] + gap


def merge_rects(rects, gap):
    rects = [list(r) for r in rects]
    changed = True
    while changed:
        changed = False
        merged = []
        for r in rects:
            for m in merged:
                if overlaps(r, m, gap):
                    m[0], m[1] = min(m[0], r[0]), min(m[1], r[1])
                    m[2], m[3] = max(m[2], r[2]), max(m[3], r[3])
                    changed = True
                    break
            else:
                merged.append(r)
        rects = merged
    return [tuple(r) for r in rects]


def drawing_rects(page, page_w, page_h):
    rects = []
    for obj in page.get_objects(filter=DRAWING_TYPES, max_depth=15):
        l, b, r, t = obj.get_bounds()
        # Skip page backgrounds: they'd swallow the whole page into one image
        if (r - l) * (t - b) > 0.6 * page_w * page_h:
            continue
        rects.append((max(l, 0), max(b, 0), min(r, page_w), min(t, page_h)))
    return rects


def absorb_labels(regions, text_elements):
    """Pull short text sitting on or just next to a chart (axis labels,
    legends) into it, so the labels stay lined up with what they label."""
    regions = list(regions)
    for el in text_elements:
        content = el.get("content") or ""
        if el.get("type") == "heading" or len(content) > 40:
            continue
        box = tuple(el["bounding box"])
        margin = float(el.get("font size") or 10) * 0.8
        for i, reg in enumerate(regions):
            big_enough = reg[2] - reg[0] >= 20 and reg[3] - reg[1] >= 20
            if big_enough and overlaps(box, reg, margin):
                regions[i] = (min(reg[0], box[0]), min(reg[1], box[1]), max(reg[2], box[2]), max(reg[3], box[3]))
                break
    return regions


def crop_png(bitmap, region, page_h):
    l, b, r, t = region
    s = RENDER_SCALE
    box = (
        max(0, math.floor(l * s)),
        max(0, math.floor((page_h - t) * s)),
        min(bitmap.width, math.ceil(r * s)),
        min(bitmap.height, math.ceil((page_h - b) * s)),
    )
    buf = io.BytesIO()
    bitmap.crop(box).save(buf, format="PNG")
    return buf.getvalue()


# --- OpenDataLoader --------------------------------------------------------


def run_opendataloader(pdf_path):
    with tempfile.TemporaryDirectory() as out_dir:
        opendataloader_pdf.convert(
            input_path=[pdf_path],
            output_dir=out_dir,
            format="json",
            image_output="off",
            include_header_footer=True,
            quiet=True,
        )
        json_path = Path(out_dir) / f"{Path(pdf_path).stem}.json"
        return json.loads(json_path.read_text(encoding="utf-8"))


def flatten(elements):
    """Text blocks and figures in a flat list. Children come before their
    parent, so a nested list item claims its own characters first."""
    for el in elements:
        etype = el.get("type")
        if etype in FIGURE_TYPES:
            yield el
            continue
        yield from flatten(el.get("list items") or [])
        yield from flatten(el.get("kids") or [])
        if el.get("content") and el.get("bounding box"):
            yield el


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


def detect_alignment(lines):
    """'center' | 'right' | 'justify' within the block, or None (left)."""
    if len(lines) < 2:
        return None
    x0, x1 = min(ln.x0 for ln in lines), max(ln.x1 for ln in lines)
    tol = max(3.0, (x1 - x0) * 0.02)
    body = lines[:-1]
    if all(x1 - ln.x1 < 2.0 for ln in body) and all(ln.x0 - x0 < 2.0 for ln in lines):
        return "justify" if len(lines) >= 2 else None
    if all(abs((ln.x0 - x0) - (x1 - ln.x1)) < tol for ln in lines) and any(ln.x0 - x0 > tol for ln in lines):
        return "center"
    if all(x1 - ln.x1 < tol for ln in lines) and any(ln.x0 - x0 > tol for ln in lines):
        return "right"
    return None


def px(value):
    return f"{value * PT_TO_PX:.1f}px"


def text_frame(tag, runs, lines, page_h, base):
    """An absolutely positioned frame holding one block of text."""
    left = min(ln.x0 for ln in lines)
    right = max(ln.x1 for ln in lines)
    top = max(ln.top for ln in lines)
    sizes = Counter()
    for r in runs:
        if r.style:
            sizes[r.style.size] += len(r.text)
    size = sizes.most_common(1)[0][0] if sizes else (base.size or 11)

    line_box = lines[0].top - lines[0].bottom  # font ascent + descent
    if len(lines) >= 2:
        pitch = statistics.median(lines[i].bottom - lines[i + 1].bottom for i in range(len(lines) - 1))
        pitch = pitch if pitch > 0 else line_box
    else:
        pitch = line_box
    line_height = min(max(pitch / size, 0.8), 3.0)
    # CSS centres the glyphs in the line box, so move the frame up by half the leading
    half_leading = (pitch - line_box) / 2

    css = [
        "position: absolute",
        f"left: {px(left)}",
        f"top: {px(page_h - top - half_leading)}",
        # A little slack, since the browser's font metrics rarely match exactly
        f"width: {(right - left) * PT_TO_PX * 1.03 + 4:.1f}px",
        f"line-height: {line_height:.3f}",
    ]
    if len(lines) == 1:
        css.append("white-space: nowrap")
    align = detect_alignment(lines)
    align_attr = f' style="text-align: {align}"' if align else ""
    inner = render_runs(runs, base)
    return f'<div data-type="frame" style="{"; ".join(css)}"><{tag}{align_attr}>{inner}</{tag}></div>'


def image_frame(src, region, page_h):
    l, b, r, t = region
    css = f"position: absolute; left: {px(l)}; top: {px(page_h - t)}; width: {px(r - l)}; height: {px(t - b)}"
    return f'<div data-type="frame" style="{css}"><img src="{src}" alt=""></div>'


def base_style(text_blocks):
    """The most common family/size/colour in paragraph text, weighted by length."""
    families, sizes, colors = Counter(), Counter(), Counter()
    for tag, runs, _lines in text_blocks:
        if tag != "p":
            continue
        for r in runs:
            if r.style:
                n = len(r.text)
                families[r.style.family] += n
                sizes[r.style.size] += n
                colors[r.style.color] += n
    if not families:
        return Style("sans-serif", 0, "#000000", False, False)
    return Style(
        family=families.most_common(1)[0][0],
        size=sizes.most_common(1)[0][0],
        color=colors.most_common(1)[0][0],
        bold=False,
        italic=False,
    )


# --- Main entry point ------------------------------------------------------


def heading_tag(el):
    if el.get("type") != "heading":
        return "p"
    level = int(el.get("heading level") or 1)
    return f"h{min(max(level, 1), 3)}"


def fallback_block(el):
    """Text OpenDataLoader found but pypdfium2 has no characters for."""
    l, b, r, t = el["bounding box"]
    size = float(el.get("font size") or 11)
    fontname = el.get("font") or ""
    style = Style(clean_font_name(fontname), round(size * 2) / 2, odl_color(el.get("text color")),
                  is_bold(fontname), is_italic(fontname))
    return [Run(el["content"], style)], [Line(l, r, b, t)]


def convert_page(page, page_no, elements):
    page_w, page_h = page.get_size()
    chars = read_chars(page.get_textpage())
    text_elements = [el for el in elements if el.get("type") not in FIGURE_TYPES]

    # Figure regions: grouped vector drawings and raster images, plus the
    # tables and images OpenDataLoader found
    rects = drawing_rects(page, page_w, page_h)
    rects += [tuple(el["bounding box"]) for el in elements if el.get("type") in FIGURE_TYPES]
    regions = absorb_labels(merge_rects(rects, DRAWING_GAP), text_elements)
    regions = merge_rects(regions, 0)

    def in_figure(ch):
        return any(reg[0] - FIGURE_PAD <= ch.cx <= reg[2] + FIGURE_PAD and
                   reg[1] - FIGURE_PAD <= ch.cy <= reg[3] + FIGURE_PAD for reg in regions)

    free = [bool(ch.box) and not in_figure(ch) for ch in chars]

    # Text blocks, in OpenDataLoader's reading order
    blocks = []
    for el in text_elements:
        l, b, r, t = el["bounding box"]
        inside = [k for k, ch in enumerate(chars)
                  if ch.box and l - 1 <= ch.cx <= r + 1 and b - 1 <= ch.cy <= t + 1]
        ks = [k for k in inside if free[k]]
        for k in ks:
            free[k] = False
        if ks:
            runs, lines = build_runs(chars, ks)
            if runs:
                blocks.append((heading_tag(el), runs, lines))
        elif not inside:
            # No characters at all (for example a Type 3 font pdfium can't read)
            runs, lines = fallback_block(el)
            blocks.append((heading_tag(el), runs, lines))

    # Leftover characters (bullet markers, stray labels): group them into lines
    group = []
    for k, ch in enumerate(chars):
        if not free[k]:
            if ch.text == LINE_BREAK and group:
                blocks.append(("p", *build_runs(chars, group)))
                group = []
            continue
        if group:
            p = chars[group[-1]]
            size = max(ch.style.size, 1)
            if abs(ch.cy - p.cy) > size * 0.6 or not (-size < ch.box[0] - p.box[2] < size * 1.5):
                blocks.append(("p", *build_runs(chars, group)))
                group = []
        group.append(k)
    if group:
        blocks.append(("p", *build_runs(chars, group)))
    blocks = [blk for blk in blocks if blk[1] and blk[2]]

    # Figures go first so text frames sit on top of them
    frames = []
    if regions:
        bitmap = page.render(scale=RENDER_SCALE).to_pil()
        for region in regions:
            l, b, r, t = region
            region = (l - FIGURE_PAD, b - FIGURE_PAD, r + FIGURE_PAD, t + FIGURE_PAD)
            # Embed the PNG in the HTML so the document needs no separate image files
            png = base64.b64encode(crop_png(bitmap, region, page_h)).decode("ascii")
            frames.append(image_frame(f"data:image/png;base64,{png}", region, page_h))

    size = {"page": page_no, "width": round(page_w * PT_TO_PX), "height": round(page_h * PT_TO_PX)}
    return blocks, frames, size, page_h


def convert_pdf(path):
    odl = run_opendataloader(path)
    by_page = {}
    for el in flatten(odl.get("kids") or []):
        if el.get("page number") and el.get("bounding box"):
            by_page.setdefault(int(el["page number"]), []).append(el)

    pdf = pdfium.PdfDocument(path)
    try:
        pages = []
        for index in range(len(pdf)):
            page = pdf[index]
            try:
                pages.append(convert_page(page, index + 1, by_page.get(index + 1, [])))
            finally:
                page.close()
    finally:
        pdf.close()

    base = base_style([blk for blocks, *_ in pages for blk in blocks])
    base_css = [f"font-family: {css_font_family(base.family)}", f"color: {base.color}"]
    if base.size:
        base_css.append(f"font-size: {base.size:g}pt")

    parts, page_sizes = [], []
    for blocks, frames, size, page_h in pages:
        frames = frames + [text_frame(tag, runs, lines, page_h, base) for tag, runs, lines in blocks]
        style = "; ".join(
            ["position: relative", f"width: {size['width']}px", f"height: {size['height']}px", *base_css]
        )
        parts.append(
            f'<div data-type="page" data-page="{size["page"]}" style="{html.escape(style)}">\n'
            + "\n".join(frames)
            + "\n</div>"
        )
        page_sizes.append(size)

    return {
        "html": "\n".join(parts) or "<p>No readable content extracted from PDF.</p>",
        # One HTML string per page, in page order, for the paginated result endpoint
        "pageHtml": parts,
        "pages": len(page_sizes),
        "pageSizes": page_sizes,
        "baseStyle": {
            "fontFamily": css_font_family(base.family),
            "fontSize": f"{base.size:g}pt" if base.size else None,
            "color": base.color,
        },
    }
