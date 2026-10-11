# pdf-page-cast

Upload a PDF and turn it into editable HTML that opens in a rich-text editor built on [TipTap](https://tiptap.dev). You can edit it there and download the result.

The conversion keeps:

- **Structure:** the title, section headings (`h1`–`h3`), paragraphs, and bulleted or numbered lists.
- **Text styling:** font, size, colour, bold and italic.
- **Alignment:** left, centre, right or justified.
- **Figures:** each picture, chart and table is cut out of the page as its own PNG image, placed where it appears in the reading order.
- **Pages:** each PDF page becomes a `<div data-type="page" data-page="N">` wrapper. The editor shows each one as a separate sheet the size of the PDF page.

Within each page, the content flows like a Word file; it is not an exact copy of the page's layout. The editor can't place text at exact x/y positions, so the converter doesn't try to.

```
frontend (React + Vite, :5173) ──/api──▶ backend (Express, :5000) ──HTTP──▶ converter (FastAPI in Docker, :8000)
                                                                              Docling + pdfplumber
```

## How the converter works

The converter is a Python service in [converter/](converter/). It combines two libraries, each doing the part it's good at:

- **[Docling](https://github.com/docling-project/docling)** decides *what* each part of the page is. Its layout model looks at the rendered page and labels each region as a title, section heading, paragraph, list item, picture, table, or page header/footer, in reading order. Because it works on the rendered page, it also finds charts drawn as vector graphics, which plain text extraction misses.
- **[pdfplumber](https://github.com/jsvine/pdfplumber)** reads the characters inside each text region to get the font, size, colour and bold/italic, which Docling doesn't provide.

For each region:

| Docling label | Output |
| ------------- | ------ |
| Page header / footer | Dropped, so they don't repeat through the document |
| Picture, chart, table | Cropped to a PNG and output as `<img>`. Its caption follows as a paragraph. |
| Title | `<h1>` |
| Section heading | `<h2>` or `<h3>`, using Docling's level, or the font size if Docling gives every heading the same level |
| List item | Grouped into `<ul>` or `<ol>` |
| Code | `<pre><code>` |
| Anything else | `<p>` |

Styling that matches the document's most common body text is left off the spans and returned once as `baseStyle`. The editor applies it as its default style, which keeps the HTML small.

## Prerequisites

- **Node.js** 20 or newer, with npm
- **Docker** (Docker Desktop on Windows or macOS)

## Getting started

**1. Converter.** Build and start it once from the project root:

```sh
docker compose up -d --build converter
```

The first build takes several minutes. The image is about 5.5 GB because it includes CPU-only PyTorch and Docling's models, which are downloaded during the build so the first conversion doesn't have to wait for them. Check it's running at `http://localhost:8000/health`.

**2. Backend**

```sh
cd backend
npm install
npm run dev        # restarts on file changes; use `npm start` to run without watching
```

**3. Frontend**

```sh
cd frontend
npm install
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`. Vite forwards every `/api` request to the backend on port 5000 (see [frontend/vite.config.ts](frontend/vite.config.ts)).

To confirm the backend can reach the converter, open `http://localhost:5000/api/check-converter`.

## How a conversion runs

1. You drop a PDF onto the page. The frontend checks that it is a PDF, then sends it to `POST /api/upload`.
2. The backend replies straight away with a `jobId`, then in the background:
   - It sends the PDF to the converter's `POST /convert`.
   - It saves the returned figure images to `backend/output/<jobId>/` and changes the `<img>` URLs to `/api/files/<jobId>/fig-N.png`.
3. The frontend checks `GET /api/validation-status/:jobId` once a second until the job has finished or failed.
4. The result screen has three tabs:
   - **Editor**: TipTap with headings, bold, italic, underline, highlight, links, lists, alignment, fonts and colours.
   - **Original (read-only)**: the same TipTap view of the converter's output, with no toolbar and no editing. It ignores your edits, so you can compare against it.
   - **Original PDF**: the uploaded file, shown by the browser's own PDF viewer.
   - **Code**: the HTML source you are editing.

   From the result screen you can also copy the HTML, reset your edits, or download them as `<name>_edited.html`.

## API

### Backend (`:5000`)

| Method | Route | Description |
| ------ | ----- | ----------- |
| `POST` | `/api/upload` | Multipart form with a `file` field holding the PDF. Returns `{ jobId, status, message }`. |
| `GET` | `/api/validation-status/:jobId` | Returns the job. `status` is `processing`, `completed` or `failed`. When it is `completed`, `result` holds `html`, `baseStyle`, `pages`, `pageSizes`, `filename` and `convertedAt`. |
| `GET` | `/api/files/:jobId/:name` | A figure image from a conversion. |
| `GET` | `/api/check-converter` | Reports whether the converter service is reachable. |
| `GET` | `/api/hello` | Health check. |

### Converter (`:8000`)

| Method | Route | Description |
| ------ | ----- | ----------- |
| `POST` | `/convert` | Multipart form with a `file` field. Returns `{ html, assets: [{ name, mime, base64 }], pages, pageSizes, baseStyle }`. `pageSizes` is `[{ page, width, height }]` in px at 96 dpi. |
| `GET` | `/health` | Returns `{ ok, doclingVersion }`. |

## Configuration

| Variable | Where | Default | Purpose |
| -------- | ----- | ------- | ------- |
| `CONVERTER_URL` | backend | `http://localhost:8000` | Where the backend finds the converter. |
| `DOCLING_OCR` | converter | `false` | Set to `true` to read scanned PDFs. This is much slower. |
| `DOCLING_TABLE_STRUCTURE` | converter | `false` | Runs Docling's table-structure model. It isn't needed while tables are output as images. |

The converter's variables are set in [docker-compose.yml](docker-compose.yml). The backend port, 5000, is set in [backend/server.js](backend/server.js). If you change it, also change the proxy target in [frontend/vite.config.ts](frontend/vite.config.ts).

## Project structure

```
converter/
  app.py                       FastAPI app: /convert and /health
  pipeline.py                  Docling layout + pdfplumber styling -> HTML
  Dockerfile, requirements.txt
docker-compose.yml             Runs the converter
backend/
  server.js                    Express app, CORS, mounts /api and the /api/files static folder
  routes/documentRoutes.js     Route definitions and multer (stores uploads in memory)
  controllers/documentController.js  Upload handling and the in-memory job store
  services/documentService.js  PDF check and the call to the converter
  output/                      Figure images, one folder per job
frontend/
  src/App.tsx                  Shows the right screen for each state: idle, uploading, done or error
  src/hooks/useDocumentUpload.ts  Upload and status-checking logic
  src/api/documentApi.ts       Calls to the backend
  src/components/              Dropzone, progress, result view, TipTap editor
  src/types/document.ts        Shared TypeScript types
```

## Pages in the saved HTML

The white sheets, page numbers and grey gaps are only CSS inside the editor ([frontend/src/index.css](frontend/src/index.css), scoped to `.tiptap`). The HTML from `editor.getHTML()` has only plain wrappers:

```html
<div data-type="page" data-page="1" data-width="816" data-height="1056">…</div>
```

Without that CSS, a `<div>` has no visible effect, so another frontend shows the pages as one continuous document with no gaps. The sheet size is applied by the page node's editor-only view ([frontend/src/extensions/PageNode.ts](frontend/src/extensions/PageNode.ts)), not written into the HTML. The exported `.html` adds `break-after: page` for printing.

Content stays on its PDF page. If you add text, that page grows taller; nothing moves onto the next page.

## Current limitations

This is a prototype. Fix these before using it for real:

- **Layout is approximate.** Pages become one flowing document, so side-by-side columns are read one after the other and exact positions are lost.
- **Fonts depend on the viewer's computer.** The HTML names the PDF's font (for example `'Calibri', sans-serif`). The fonts embedded in the PDF aren't extracted, so the browser falls back to a similar font if that one isn't installed.
- **Tables are images**, so you can't edit their text.
- **Scanned PDFs need OCR turned on** (`DOCLING_OCR=true`). Otherwise they have no text to extract.
- **Conversions run one at a time** in the converter, and each takes a few seconds per page on a CPU.
- **Jobs are lost on restart**, because they live in memory in the backend. Figure images in `backend/output/` are never cleaned up.
- **Downloaded HTML links to the figures** on the backend, so the images only show while the backend is running.
- **There are no tests yet.**

## Scripts

| Location | Command | What it does |
| -------- | ------- | ------------ |
| root | `docker compose up -d --build converter` | Builds and starts the converter |
| `backend` | `npm run dev` | Starts the server and restarts it when files change |
| `backend` | `npm start` | Starts the server |
| `frontend` | `npm run dev` | Starts the Vite dev server |
| `frontend` | `npm run build` | Type-checks and builds for production into `dist/` |
| `frontend` | `npm run lint` | Runs ESLint |
| `frontend` | `npm run preview` | Serves the production build |
