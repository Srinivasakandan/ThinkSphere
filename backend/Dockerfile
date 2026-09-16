FROM python:3.12-slim

# tesseract-ocr enables real OCR (OCR_PROVIDER=auto/tesseract); it's
# optional at runtime (OCR_PROVIDER=mock needs nothing) but installed so
# the default "auto" mode reads real images without rebuilding the
# image. libglib2.0-0/libgl1 satisfy opencv-python-headless's runtime
# linkage (app/services/imaging/) even though it needs no display.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/storage_mock /app/reports_mock

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
