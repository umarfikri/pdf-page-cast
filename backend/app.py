import os
import secrets
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from importlib.metadata import version

from fastapi import APIRouter, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from pipeline import convert_pdf

app = FastAPI(title="pdf-page-cast")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# pdfium isn't thread-safe, so run one conversion at a time
executor = ThreadPoolExecutor(max_workers=1)

# In-memory job store
jobs = {}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def run_job(job_id, data, filename):
    job = jobs[job_id]
    fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(fd, "wb") as tmp:
            tmp.write(data)
        result = convert_pdf(tmp_path)
        html = result["html"]

        # Kept outside "result" so polling the status stays small; the HTML is served
        # by /result in chunks, or with the status when includeHtml is set
        job["html"] = html
        job["pageHtml"] = result["pageHtml"]
        job["result"] = {
            "success": True,
            "baseStyle": result["baseStyle"],
            "pageSizes": result["pageSizes"],
            "pages": result["pages"],
            "filename": filename,
            "convertedAt": now_iso(),
        }
        job["status"] = "completed"
        print(f"[Upload] Job {job_id} completed: {result['pages']} page(s), {html.count('<img ')} figure(s)")
    except Exception as err:
        job["status"] = "failed"
        job["error"] = f"Conversion failed: {err}"
        print(f"[Upload] Job {job_id} failed: {err}")
    finally:
        os.unlink(tmp_path)


api = APIRouter(prefix="/api")


@api.get("/hello")
def hello():
    return {"message": "Hello from FastAPI!"}


@api.get("/health")
def health():
    return {
        "ok": True,
        "opendataloaderVersion": version("opendataloader-pdf"),
        "pypdfium2Version": version("pypdfium2"),
    }


@api.post("/upload")
def upload(file: UploadFile = File(...)):
    data = file.file.read()
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Uploaded file is not a PDF. Only PDF documents are supported.")

    filename = file.filename or "document.pdf"
    job_id = f"job_{int(time.time() * 1000)}_{secrets.token_hex(4)}"
    jobs[job_id] = {
        "jobId": job_id,
        "status": "processing",
        "filename": filename,
        "size": len(data),
        "uploadedAt": now_iso(),
        "result": None,
        "error": None,
    }
    print(f"[Upload] Received {filename} ({len(data)} bytes) as {job_id}")
    executor.submit(run_job, job_id, data, filename)

    return {"jobId": job_id, "status": "processing", "message": "PDF received. Converting to HTML in progress."}


@api.get("/validation-status/{job_id}")
def validation_status(job_id: str, includeHtml: bool = Query(False)):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {key: value for key, value in job.items() if key not in ("html", "pageHtml")}
    if includeHtml and job["result"] is not None:
        response["result"] = {**job["result"], "data": job["html"], "html": job["html"]}
    return response


@api.get("/result/{job_id}")
def result_pages(job_id: str, page: int = Query(1, ge=1), pageSize: int = Query(3, ge=1, le=20)):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=409, detail=f"Job is {job['status']}")

    page_html = job["pageHtml"]
    page_sizes = job["result"]["pageSizes"]
    total_items = len(page_html)
    total_pages = max(1, -(-total_items // pageSize))
    start = (page - 1) * pageSize
    end = start + pageSize

    return {
        "items": [
            {"page": size["page"], "html": html, "width": size["width"], "height": size["height"]}
            for html, size in zip(page_html[start:end], page_sizes[start:end])
        ],
        "baseStyle": job["result"]["baseStyle"],
        "meta": {
            "currentPage": page,
            "pageSize": pageSize,
            "totalItems": total_items,
            "totalPages": total_pages,
            "hasNextPage": page < total_pages,
            "hasPreviousPage": page > 1,
        },
    }


app.include_router(api)
