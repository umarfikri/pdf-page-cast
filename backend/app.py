import os
import secrets
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from importlib.metadata import version

from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
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

        job["result"] = {
            "success": True,
            "data": html,
            "html": html,
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
def validation_status(job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


app.include_router(api)
