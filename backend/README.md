# pdf-page-cast backend

A [FastAPI](https://fastapi.tiangolo.com) server that converts an uploaded PDF into positioned HTML for the TipTap editor in [..\frontend](../frontend). It runs on port **3000**.

These steps are for **Windows** using **PowerShell** (the default terminal in Windows Terminal and VS Code). Command Prompt equivalents are noted where they differ.

## Prerequisites

| Tool | Version | Check | Install |
| ---- | ------- | ----- | ------- |
| Python | 3.12 | `python --version` | `winget install -e --id Python.Python.3.12` |
| Java | 11 or newer (OpenDataLoader PDF needs it) | `java -version` | `winget install -e --id Microsoft.OpenJDK.17` |

After installing either one, **close and reopen the terminal** so it picks up the new `PATH`.

## First-time setup

Open PowerShell in the `backend` folder and run:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

This creates a virtual environment in `.venv\` (ignored by git) and installs the dependencies into it. Once activated, the prompt starts with `(.venv)`.

In Command Prompt, activate with `.venv\Scripts\activate.bat` instead.

If PowerShell says **"running scripts is disabled on this system"**, allow local scripts for your account once, then activate again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Run

```powershell
cd backend
.venv\Scripts\Activate.ps1
uvicorn app:app --reload --port 3000
```

Or, without activating the environment:

```powershell
.venv\Scripts\python -m uvicorn app:app --reload --port 3000
```

`--reload` restarts the server whenever you change a `.py` file. Press **Ctrl+C** to stop it.

To check it's running, open these in a browser:

- http://localhost:3000/api/health should return `{"ok": true, ...}`
- http://localhost:3000/docs has interactive API docs, where you can try an upload

The frontend's Vite dev server forwards every `/api` request to `http://localhost:3000`, so start this backend before using the frontend.

## API

| Method | Route | Description |
| ------ | ----- | ----------- |
| `POST` | `/api/upload` | Multipart form with a `file` field holding the PDF. Returns `{ jobId, status, message }` right away; the conversion runs in the background. |
| `GET` | `/api/validation-status/{jobId}` | Returns the job. `status` is `processing`, `completed` or `failed`. When it is `completed`, `result` holds `baseStyle`, `pages`, `pageSizes`, `filename` and `convertedAt`; the page HTML comes from `/api/result`. Add `?includeHtml=true` to also get the whole document's HTML in `result.html` (and `result.data`). When it is `failed`, `error` says why. |
| `GET` | `/api/result/{jobId}?page=1&pageSize=3` | Returns a completed job's pages in chunks: `{ items, baseStyle, meta }`. Each item is `{ page, html, width, height }` for one PDF page. `meta` is `{ currentPage, pageSize, totalItems, totalPages, hasNextPage, hasPreviousPage }`, where `totalItems` is the PDF's page count. `pageSize` is 1–20 (default 3). Returns 409 while the job is still processing or failed. |
| `GET` | `/api/health` | Returns `{ ok, opendataloaderVersion, pypdfium2Version }`. |
| `GET` | `/api/hello` | Returns a greeting. |

Figures (pictures, charts, tables) are embedded in `html` as base64 PNGs, inside their frame:

```html
<div data-type="frame" style="position: absolute; left: …; top: …; width: …; height: …"><img src="data:image/png;base64,iVBORw0KGgo…" alt=""></div>
```

Nothing is written to disk, so the HTML works on its own. Expect it to be large when a PDF has big figures: base64 is about a third bigger than the PNG.

Errors come back as `{ "detail": "..." }` with a 4xx or 5xx status.

To try an upload from PowerShell, use `curl.exe` (plain `curl` in Windows PowerShell is an alias for `Invoke-WebRequest`, which takes different options):

```powershell
curl.exe -F "file=@C:\path\to\document.pdf" http://localhost:3000/api/upload
curl.exe http://localhost:3000/api/validation-status/<jobId>
```

## Configuration

To use a different port, change `--port` in the run command and the proxy target in [..\frontend\vite.config.ts](../frontend/vite.config.ts).

## Files

```
app.py            FastAPI app: upload, in-memory job store, job status
pipeline.py       PDF -> HTML conversion (OpenDataLoader PDF + pypdfium2), figures embedded as base64
requirements.txt  Python dependencies
```

## Troubleshooting

- **`Python was not found; run without arguments to install from the Microsoft Store`**: Python isn't installed or isn't on `PATH`. Install it with the `winget` command above and open a new terminal. The `py` launcher also works: `py -3.12 -m venv .venv`.
- **`running scripts is disabled on this system`** when activating: run the `Set-ExecutionPolicy` command in [First-time setup](#first-time-setup).
- **Conversions fail with a Java error:** check that `java -version` reports 11 or newer. If it isn't found, install it and open a new terminal.
- **`[WinError 10048]` / address already in use:** something else is using port 3000. Find it with `netstat -ano | findstr :3000`, then stop it with `taskkill /PID <pid> /F`, or use another port as described above.
- **Jobs disappear after a restart:** jobs are kept in memory, so restarting the server clears them.
- **Changes to the code don't seem to take effect:** with `--reload`, an old worker can occasionally keep running alongside the new one. Stop the server with Ctrl+C, check `netstat -ano | findstr :3000` shows nothing, then start it again.
