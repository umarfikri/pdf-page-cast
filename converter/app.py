import os
import tempfile
import threading
from importlib.metadata import version

from fastapi import FastAPI, File, HTTPException, UploadFile

from pipeline import build_converter, convert_pdf

app = FastAPI(title="pdf-page-cast converter")

# Loading Docling's models is slow, so build the converter once at startup
converter = build_converter()
# Docling's pipeline isn't documented as thread-safe; run one conversion at a time
convert_lock = threading.Lock()


@app.get("/health")
def health():
    return {"ok": True, "doclingVersion": version("docling")}


@app.post("/convert")
def convert(file: UploadFile = File(...)):
    data = file.file.read()
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Uploaded file is not a PDF")

    fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(fd, "wb") as tmp:
            tmp.write(data)
        with convert_lock:
            return convert_pdf(converter, tmp_path)
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {err}") from err
    finally:
        os.unlink(tmp_path)
