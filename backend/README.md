# ThinkSphere Backend

FastAPI backend for the Legal Metrology Packaged Commodity Compliance
Inspection System — OCR, extraction, validation, and rule-engine
evaluation for the [Next.js frontend](../README.md) in this repository.

**This backend assists inspection — it does not make legal
determinations.** Every automated finding is `PASS`,
`POTENTIAL_NON_COMPLIANCE`, or `NEEDS_REVIEW`; nothing in this codebase
converts an absent or uncertain declaration into a confirmed violation
(see `app/services/rules/evaluators.py` and section "Core principles"
below).

## Tech stack

- Python 3.12, FastAPI, Pydantic v2, Uvicorn
- SQLAlchemy 2.x + Alembic, PostgreSQL (via `psycopg` v3)
- Supabase Auth (JWT verification) and Supabase Storage — both optional;
  see **Mock mode**
- Tesseract OCR (open-source) via `pytesseract`, used automatically
  when installed (`OCR_PROVIDER=auto`, the default), with a
  deterministic mock OCR engine as the fallback when it isn't
- OpenCV (`opencv-python-headless`) preprocesses every image — EXIF
  auto-rotate, deskew, contrast enhancement — before OCR runs
  (`app/services/imaging/`)
- ReportLab for PDF report generation
- Pytest + FastAPI `TestClient` for tests; Ruff, Black, MyPy for quality

## Architecture

```
Next.js Frontend
      |  REST (JSON, snake_case)
      v
   FastAPI  (app/api/routes)
      v
Application Services  (app/services)
  inspection_service · image_service · processing_service
  review_service · dashboard_service · report_service
      v
  OCR Service  ->  Extraction (regex + context)  ->  Validation
      v
  Rule Selector  ->  Rule Engine (evaluators)  ->  Overall Status
      v
PostgreSQL (app/models via SQLAlchemy) + Storage (Supabase or local disk)
```

Each responsibility is a separate module (spec section 66): OCR only
turns an image into text; extraction only turns text into structured
candidate fields; validation only judges format/plausibility;
rule selection only decides which rules apply; the rule engine only
turns (fields, rules) into individual results; `calculate_overall_status`
(the *only* place this logic lives, in `app/services/rules/status.py`)
turns results into one status. No route or service re-implements this
logic inline.

## Project structure

```
app/
  main.py                  FastAPI app factory, CORS, error handlers
  api/routes/               One file per resource (see spec section 30)
  core/                     config.py, security.py (Supabase JWT), logging.py
  db/                       SQLAlchemy engine/session/declarative base
  models/                   ORM models (one file per table)
  schemas/                  Pydantic request/response contracts
  repositories/              Query layer (inspection/product/rule/result)
  services/
    ocr/                     OCRService interface + Tesseract/Mock adapters
    extraction/               regex_extractor, nlp_extractor, extractor (orchestrator)
    validation/                validator.py
    rules/                     rule_selector, rule_engine, evaluators, status
    storage/                    StorageService interface + Supabase/local adapters
    review/                     inspector review workflow
    dashboard/, reports/         aggregate queries, PDF generation
    inspection_service.py, image_service.py, processing_service.py
  utils/                     confidence.py, dates.py, quantities.py, money.py
tests/                      pytest — api/, rules/, extraction/, validation/
migrations/                 Alembic
scripts/seed.py             Demo data seeding
```

## Installation

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt   # includes requirements.txt
cp .env.example .env
```

You need a PostgreSQL 16 instance. Locally:

```bash
createuser thinksphere --pwprompt   # password: thinksphere
createdb thinksphere -O thinksphere
createdb thinksphere_test -O thinksphere   # used by the test suite
```

or use `docker-compose up db`.

## Environment variables

See `.env.example`. Nothing is required to run in **mock mode**:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy/psycopg connection string |
| `FRONTEND_URL` | Allowed CORS origin |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | Leave blank for mock auth |
| `SUPABASE_STORAGE_BUCKET` | Bucket name once Supabase Storage is configured |
| `OCR_PROVIDER` | `auto` (default, real Tesseract when installed else mock), `tesseract`, or `mock` |
| `LOCAL_STORAGE_DIR` | Filesystem fallback used when Supabase Storage isn't configured |
| `API_ENV` | `development` or `production` |
| `ALLOW_MOCK_AUTH` | Whether unauthenticated requests fall back to a demo inspector (never enable in production) |

Service-role keys are read server-side only and are never returned in
any API response (`app/services/storage/*`).

## Database migrations

```bash
alembic upgrade head          # apply
alembic revision --autogenerate -m "message"   # after model changes
alembic downgrade -1          # roll back one revision
```

## Seed data

```bash
python scripts/seed.py
```

Creates two demo inspectors, a **DEMO DATA**-labeled rules repository
(`Rule.is_demo=True`, `legal_source` explicitly says "sample only, not
verified against authoritative legal text" — see spec section 20/62),
and five inspections spanning `PASS`, `POTENTIAL_NON_COMPLIANCE` and
`NEEDS_REVIEW`, some finalized and some awaiting review.

## Running locally

```bash
uvicorn app.main:app --reload --port 8000
```

- Interactive docs: http://localhost:8000/docs (Swagger) and `/redoc`
- Health check: `GET /api/health`

## Running with Docker

```bash
docker compose up --build
```

Starts Postgres and the API (migrations run automatically on
container start). The API is mock-mode by default; set the
`SUPABASE_*` variables in `docker-compose.yml` (or an env file) to
connect a real project.

## Tests

```bash
pytest
```

Requires a reachable `thinksphere_test` database (`TEST_DATABASE_URL`
env var to override). Each test run drops and recreates all tables,
then deletes all rows before every test function for isolation.

- `tests/rules/` — the rule-engine matrix from spec section 49 (every
  evaluator, every condition type, the overall-status precedence rules)
- `tests/extraction/` — regex/context extraction variations, multi-image
  conflict resolution, low-quality-OCR handling (sections 50-52)
- `tests/validation/` — format/confidence/conflict validation outcomes
- `tests/api/` — a full HTTP walk through the acceptance scenario (spec
  section 69): create → upload 4 images for one product → process →
  extracted fields → rules → review → finalize → results → dashboard,
  plus auth, image-validation, and report-generation coverage

Quality checks:

```bash
ruff check .
black --check .
mypy app
```

## Mock mode

Every external dependency has a mock-first design so the full pipeline
works with zero external services configured:

- **Auth**: no `SUPABASE_JWT_SECRET` → all requests are treated as a
  fixed demo inspector (`app/core/security.py`). Real deployments must
  set the Supabase env vars; `ALLOW_MOCK_AUTH` should be `false` there.
- **Storage**: no `SUPABASE_SERVICE_ROLE_KEY` → images/reports are
  written to `LOCAL_STORAGE_DIR` and served back at `/media/...`
  (`app/services/storage/`).
- **OCR**: `OCR_PROVIDER=auto` (default) → real Tesseract OCR
  (`app/services/ocr/local_ocr.py`, behind OpenCV preprocessing in
  `app/services/imaging/`) when the `tesseract-ocr` binary is on PATH
  (it is in the Docker image; install with `apt-get install
  tesseract-ocr` locally), otherwise a deterministic mock engine
  generates realistic packaged-label text keyed by image filename so
  processing stays reproducible without it. Set `OCR_PROVIDER=tesseract`
  to require real OCR (fails loudly if missing) or `OCR_PROVIDER=mock`
  to force the deterministic engine regardless of what's installed.
- **Rules**: the seed script's rules are explicitly `is_demo=True` with
  a `legal_source` that says so — replace them with verified Legal
  Metrology rule text before any production use; nothing in application
  code assumes demo rules are authoritative.

## Core principles (enforced in code, not just documentation)

- `calculate_overall_status` (`app/services/rules/status.py`) is the
  only place overall-status roll-up logic exists.
- A missing/uncertain declaration is never turned into
  `POTENTIAL_NON_COMPLIANCE` when the underlying image quality was poor
  — it becomes `NEEDS_REVIEW` instead (`extraction_reliable` flag,
  threaded from `processing_service` into the rule engine).
- Conflicting values across images are never silently resolved to a
  "winner" — they're surfaced as `NEEDS_REVIEW` with every candidate
  value listed (`app/services/extraction/extractor.py`).
- `inspector_id` on write endpoints always comes from the verified JWT
  (`get_current_inspector`), never from the request body.
- Finalization is refused (`can_finalize: false`) while any non-PASS
  finding is unreviewed (`app/services/inspection_service.py`,
  spec section 28) — it does not silently finalize regardless.
- Every mutating action is written to `audit_logs` and (for field/rule
  reviews) also to `inspector_reviews`, independent of the
  "current state" columns on the field/result row.

## Connecting the existing frontend

The frontend's `lib/api/*` layer is currently backed by an in-memory
mock store. To point it at this backend:

1. Set `NEXT_PUBLIC_API_BASE_URL` to this service's URL.
2. Replace each function body in `lib/api/*.ts` with a `fetch()` call to
   the matching endpoint below — response shapes are close to the
   frontend's existing TypeScript types, but use snake_case keys and
   UUID ids (rather than the frontend mock's `INS-00125`-style ids), so
   the adapter layer should map field names accordingly.

| Frontend need | Endpoint |
| --- | --- |
| `createInspection` | `POST /api/inspections` |
| `uploadInspectionImages` | `POST /api/inspections/{id}/images` |
| `getInspection` | `GET /api/inspections/{id}` |
| `getInspections` | `GET /api/inspections` |
| `runProcessing` | `POST /api/inspections/{id}/process` |
| `getInspectionResults` | `GET /api/inspections/{id}/results` |
| `updateExtractedField` | `PATCH /api/inspections/{id}/fields/{field_id}` |
| `reviewRule` | `PATCH /api/inspections/{id}/rules/{rule_result_id}/review` |
| `finalizeInspection` | `POST /api/inspections/{id}/finalize` |
| dashboard cards/charts | `GET /api/dashboard/summary`, `/trends`, `/recent-inspections` |
| rules page | `GET /api/rules` |
| report generation | `POST /api/reports/inspection/{id}` |
