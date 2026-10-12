# pdf-page-cast

Upload a PDF and turn it into editable HTML that opens in a rich-text editor built on [TipTap](https://tiptap.dev). You can edit it there and download the result.

The editor shows each PDF page as a fixed-size page, with every block placed at its exact position from the PDF, so it looks like the original. The conversion keeps:

- **Layout:** each block (heading, paragraph, list item, caption, image) sits at its PDF x/y position inside a page the size of the PDF page.
- **Text styling:** font, size, colour, bold and italic, word by word, so a bold or coloured phrase inside a paragraph keeps its style.
- **Headings:** `h1`–`h3`, from the PDF's heading levels.
- **Figures:** each picture, chart and table is cut out as its own PNG image, at its exact position. Charts drawn as vector graphics are included, along with their axis labels.

```
frontend (React + Vite, :5173) ──/api──▶ backend (FastAPI, :3000)
                                          OpenDataLoader PDF + pypdfium2
```

## How the conversion works

The backend is a Python FastAPI service in [backend/](backend/). It combines two libraries:

- **[OpenDataLoader PDF](https://github.com/opendataloader-project/opendataloader-pdf)** (Apache 2.0, runs on Java) finds the blocks on each page: headings with their levels, paragraphs, list items, captions, tables and images, with their bounding boxes and reading order.
- **[pypdfium2](https://github.com/pypdfium2-team/pypdfium2)** (Apache/BSD) fills in what OpenDataLoader doesn't give:
  - page sizes;
  - each character's font, size and colour (OpenDataLoader gives one style per block, so a bold word inside a paragraph would be lost);
  - vector drawings such as charts, which OpenDataLoader doesn't detect;
  - the PNG crops of charts, tables and images.

For each page:

1. **Figures.** Vector drawings and raster images closer than 12pt to each other are grouped into one region, together with any tables and images OpenDataLoader found. Short text sitting on or right next to a chart, such as axis labels, is pulled into the chart's region so the labels stay lined up with the bars. Each region is cropped from the rendered page as a PNG.
2. **Text blocks.** For each OpenDataLoader block, the characters inside its box are read with their own font, size and colour, and grouped into runs with the same style. Characters inside a figure are skipped, because they're already in the image.
3. **Leftover text.** Characters that aren't in any block (OpenDataLoader drops bullet markers, for example) are grouped into lines and get their own frames, so nothing visible is lost.
4. **Frames.** Each block becomes an absolutely positioned frame, using the measured line height so the lines land where they are in the PDF. Single-line blocks don't wrap; multi-line blocks wrap at the PDF's width, with a little slack for font differences. Justified, centred or right-aligned text keeps its alignment.

Styling that matches the document's most common body text is left off the spans and set once on each page instead, which keeps the HTML small.

## Prerequisites

- **Node.js** 20 or newer, with npm (for the frontend)
- **Python** 3.12 (for the backend)
- **Java** 11 or newer, which OpenDataLoader PDF runs on

## Getting started

**1. Backend** (full details in [backend/README.md](backend/README.md))

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 3000
```

Check it's running at `http://localhost:3000/api/health`.

**2. Frontend**

```powershell
cd frontend
npm install
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`. Vite forwards every `/api` request to the backend on port 3000 (see [frontend/vite.config.ts](frontend/vite.config.ts)).

## How a conversion runs

1. You drop a PDF onto the page. The frontend checks that it is a PDF, then sends it to `POST /api/upload`.
2. The backend replies straight away with a `jobId`, then in a background worker:
   - It converts the PDF. Each figure is embedded straight into the HTML as a base64 PNG (`<img src="data:image/png;base64,…">`), so there are no separate image files.
3. The frontend checks `GET /api/validation-status/:jobId` once a second until the job has finished or failed.
4. The result screen has three tabs:
   - **Editor**: TipTap with headings, bold, italic, underline, highlight, links, lists, alignment, fonts and colours.
   - **Original (read-only)**: the same TipTap view of the converted output, with no toolbar and no editing. It ignores your edits, so you can compare against it.
   - **Original PDF**: the uploaded file, shown by the browser's own PDF viewer.
   - **Code**: the HTML source you are editing.

   From the result screen you can also copy the HTML, reset your edits, or download them as `<name>_edited.html`.

## API

### Backend (`:3000`)

Interactive docs are at `http://localhost:3000/docs`. Errors come back as `{ detail }`.

| Method | Route | Description |
| ------ | ----- | ----------- |
| `POST` | `/api/upload` | Multipart form with a `file` field holding the PDF. Returns `{ jobId, status, message }`. |
| `GET` | `/api/validation-status/{jobId}` | Returns the job. `status` is `processing`, `completed` or `failed`. When it is `completed`, `result` holds `html`, `baseStyle`, `pages`, `pageSizes` (`[{ page, width, height }]` in px at 96 dpi), `filename` and `convertedAt`. |
| `GET` | `/api/health` | Returns `{ ok, opendataloaderVersion, pypdfium2Version }`. |
| `GET` | `/api/hello` | Returns a greeting. |

## Configuration

The backend port, 3000, is set by the `uvicorn` command above. If you change it, also change the proxy target in [frontend/vite.config.ts](frontend/vite.config.ts).

## Project structure

```
backend/
  app.py                       FastAPI app: upload, in-memory job store, job status
  pipeline.py                  OpenDataLoader blocks + pypdfium2 styles and figures -> HTML
  requirements.txt             Python dependencies
frontend/
  src/App.tsx                  Shows the right screen for each state: idle, uploading, done or error
  src/hooks/useDocumentUpload.ts  Upload and status-checking logic
  src/api/documentApi.ts       Calls to the backend
  src/components/              Dropzone, progress, result view, TipTap editor
  src/extensions/PageNode.ts   TipTap nodes for pages and positioned frames
  src/styles/pdf-layout.css    CSS the converted HTML needs wherever it's shown
  src/types/document.ts        Shared TypeScript types
```

## Displaying the saved HTML

The saved HTML (from `editor.getHTML()`) is a list of pages, each containing positioned frames:

```html
<div data-type="page" data-page="1" style="position: relative; width: 816px; height: 1056px; font-family: 'Georgia', serif; color: #222222; font-size: 11pt">
  <div data-type="frame" style="position: absolute; left: 134.5px; top: 84.6px; width: 567.4px; line-height: 1.116; white-space: nowrap">
    <h1><strong><span style="font-family: 'Arial', sans-serif; font-size: 26pt; color: #0b4f8a">Annual Performance Report 2026</span></strong></h1>
  </div>
  <div data-type="frame" style="position: absolute; left: …; top: …; width: …; height: …"><img src="data:image/png;base64,iVBORw0KGgo…" alt=""></div>
</div>
```

Positions, sizes and fonts are inline styles, and figures are embedded in the HTML, so the layout carries over to any frontend with nothing else to fetch. **Also include [frontend/src/styles/pdf-layout.css](frontend/src/styles/pdf-layout.css)** where you display it. It removes the browser's default margins and heading sizes inside frames, which would otherwise push text out of place. The exported `.html` file already includes it.

The grey gap, shadow and page numbers between pages are editor-only CSS in [frontend/src/index.css](frontend/src/index.css), so they aren't part of the HTML. Without them, pages stack directly on top of each other.

## Current limitations

This is a prototype. Fix these before using it for real:

- **Editing can overlap.** Frames are fixed in place. If you add text to a frame, it grows and can overlap the frame below it. You can't add new frames or move them in the editor.
- **Line breaks may differ slightly.** The browser's font metrics rarely match the PDF's exactly, so a wrapped paragraph can break its lines in slightly different places.
- **Figure grouping is a heuristic.** Drawings more than 12pt apart become separate images (for example, a bar chart without axes may split into one image per bar), and a coloured box behind text is cropped together with that text.
- **Fonts depend on the viewer's computer.** The HTML names the PDF's font (for example `'Calibri', sans-serif`). The fonts embedded in the PDF aren't extracted, so the browser falls back to a similar font if that one isn't installed.
- **Tables are images**, so you can't edit their text.
- **Scanned PDFs aren't supported.** They have no text layer, and OCR isn't set up.
- **Conversions run one at a time** in the backend, because pdfium isn't thread-safe. A short document takes about a second.
- **Jobs are lost on restart**, because they live in memory in the backend.
- **Figures make the HTML large.** Each figure is a base64 PNG inside the HTML, about a third bigger than the PNG itself. A 2-page PDF with two full-page figures comes to about 2.3 MB of HTML.
- **There are no tests yet.**

## Scripts

| Location | Command | What it does |
| -------- | ------- | ------------ |
| `backend` | `uvicorn app:app --reload --port 3000` | Starts the backend and restarts it when files change |
| `frontend` | `npm run dev` | Starts the Vite dev server |
| `frontend` | `npm run build` | Type-checks and builds for production into `dist/` |
| `frontend` | `npm run lint` | Runs ESLint |
| `frontend` | `npm run preview` | Serves the production build |
