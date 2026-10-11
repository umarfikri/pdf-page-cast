FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DOCLING_ARTIFACTS_PATH=/models

# OpenCV (used by Docling's image handling) needs these shared libraries
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# CPU-only torch keeps the image several GB smaller than the default CUDA build
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Bake the layout models into the image so the first request doesn't download them
RUN docling-tools models download -o /models

COPY app.py pipeline.py ./

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
