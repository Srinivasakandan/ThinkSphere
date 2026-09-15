# ThinkSphere API Contract

This is the single source of truth for the HTTP contract between the
Next.js frontend and the FastAPI backend. Both sides must conform to
this document. If backend behavior and this document disagree, that is
a bug — fix the code or fix the doc, but do not let them silently drift.

Backend implementation lives in `backend/app/`. Frontend consumers live
in `frontend/lib/api/`. Shared conceptual types live in
`backend/app/schemas/` (Pydantic) and `frontend/types/api.ts`
(TypeScript) — the same model, expressed twice.

## 1. Base URL and versioning

All endpoints are served under a version prefix:

```
/api/v1/...
```

The frontend reads the backend base URL from `NEXT_PUBLIC_API_BASE_URL`.
When that variable is unset, the frontend runs entirely against its
built-in mock data layer (`frontend/lib/mock/`) — no backend is required
for local frontend development. This is a deliberate zero-config demo
mode, not a fallback for errors: once `NEXT_PUBLIC_API_BASE_URL` is set,
the frontend calls the real backend and mock data is not used.

`GET /api/v1/health` reports `version`, which mirrors `Settings.api_version`
(currently `1.0.0`) and follows semver. A breaking change to any response
shape below requires a new `/api/v2/...` prefix, not an in-place change
to `/api/v1`.

## 2. Authentication

Every endpoint except `GET /api/v1/health` requires
`Authorization: Bearer <token>`.

- **Production / any environment with Supabase configured**
  (`SUPABASE_URL` + `SUPABASE_JWT_SECRET` set): the token is a Supabase
  Auth access token. The backend verifies its signature (HS256) against
  `SUPABASE_JWT_SECRET` server-side — it never trusts a client-supplied
  user id for anything. A missing/invalid/expired token yields `401`.
- **Demo / local mode** (`SUPABASE_URL` unset and `ALLOW_MOCK_AUTH=true`,
  the default): every request is treated as a fixed demo inspector
  (`demo.inspector@legalmetrology.gov.in`, role `INSPECTOR`), whether or
  not a bearer token is present. This lets the full stack run without any
  external auth provider. `ALLOW_MOCK_AUTH=false` disables this fallback
  and makes unauthenticated requests fail with `401 AUTH_NOT_CONFIGURED`
  even without Supabase configured — used for auth contract tests.

The first authenticated request for a given user id lazily provisions a
local `inspectors` row (id, email, name, role) so other tables have a
stable foreign key — Supabase remains the sole owner of credentials.

### Roles

```
UserRole = INSPECTOR | SUPERVISOR | ADMIN
```

Role is read from the JWT's `app_metadata.role` (falling back to
`user_metadata.role`, then `INSPECTOR`). `require_roles(...)` is the
enforcement point for role-gated actions; every route in this document
that doesn't call it out is open to any authenticated role. Today no
endpoint is role-gated — this is the hook already wired for when
supervisor/admin-only actions (e.g. rule authoring) are added.

## 3. Shared enums

These are defined once in `backend/app/models/enums.py` and mirrored in
`frontend/types/api.ts`. Values are wire-format strings — exact case
matters.

```
InspectionStage      CREATED | IMAGES_UPLOADED | PROCESSING | OCR_COMPLETED
                      | EXTRACTION_COMPLETED | VALIDATION_COMPLETED
                      | RULE_EVALUATION_COMPLETED | READY_FOR_REVIEW
                      | FINALIZED | PROCESSING_FAILED

InspectionStatus      PASS | POTENTIAL_NON_COMPLIANCE | NEEDS_REVIEW

ImageViewType          FRONT | BACK | LEFT | RIGHT | TOP | BOTTOM | OTHER

ImageProcessingStatus  UPLOADED | PROCESSING | PROCESSED | FAILED

ImageQuality           GOOD | FAIR | POOR | UNKNOWN

ConfidenceLevel        HIGH | MEDIUM | LOW

ValidationStatus       VALID | INVALID | CONFLICT | UNCERTAIN | NOT_VALIDATED

RuleConditionType      REQUIRED | OPTIONAL | FORMAT | VALUE | UNIT | DATE
                        | RANGE | CONDITIONAL | MANUAL_REVIEW

ReviewTargetType        EXTRACTED_FIELD | RULE_RESULT

ReviewDecision          CONFIRMED | CORRECTED | VERIFIED

UserRole                INSPECTOR | SUPERVISOR | ADMIN
```

### Design note: workflow stage vs. compliance status are two fields, not one

`InspectionStage` (processing/workflow progress) and `InspectionStatus`
(compliance outcome) are deliberately **separate fields** on an
inspection (`stage` and `overall_status`), not one merged status enum.
An inspection's workflow can be `RULE_EVALUATION_COMPLETED` while its
compliance status is independently `PASS`, `POTENTIAL_NON_COMPLIANCE`, or
`NEEDS_REVIEW` — conflating them would force awkward composite values
(e.g. "READY_FOR_REVIEW_AND_PASS") and make workflow-only queries ("is
this still processing?") depend on compliance logic. Both the frontend
(`InspectionStage` + `InspectionStatus` types) and backend already used
this split before this contract was written; this document keeps it
rather than forcing a breaking rename, per the standing "do not redesign
unnecessarily" rule for this contract pass. If your mental model expects
a single merged status, map it as: `overall_status` is only meaningful
once `stage` has reached `RULE_EVALUATION_COMPLETED` or later, and
`stage == FINALIZED` is the terminal state regardless of `overall_status`.

`RuleResultResponse.status` (a single rule's finding) is always one of
`PASS | POTENTIAL_NON_COMPLIANCE | NEEDS_REVIEW` — **never** a bare
`FAIL`. This system produces compliance *signals* for a human inspector
to verify, not automated legal determinations; see `RuleResultResponse`
below.

`ValidationStatus` describes what happened during OCR→extraction, not
compliance:
- `CONFLICT` — two or more source images disagree on this field's value.
  The backend **never** silently picks a winner; see §7 "Extraction
  conflicts" below.
- `UNCERTAIN` — either nothing reliable was extracted, or extraction
  confidence is below threshold, or the detected value doesn't match the
  field's expected format. This is a request for inspector verification,
  not a rule violation — a rule evaluator sees `UNCERTAIN` and produces a
  `NEEDS_REVIEW` rule result, never `POTENTIAL_NON_COMPLIANCE`.

## 4. Error format

Every non-2xx response uses the same envelope:

```json
{
  "error": {
    "code": "INSPECTION_NOT_FOUND",
    "message": "Human-readable description.",
    "details": [ /* optional, present only for 422 validation errors */ ]
  }
}
```

`details` (when present) is FastAPI's native validation error list
(`[{"loc": [...], "msg": "...", "type": "..."}]`).

Standard codes in use:

| HTTP | code | meaning |
|---|---|---|
| 401 | `NOT_AUTHENTICATED` | No bearer token and mock auth is disabled |
| 401 | `INVALID_TOKEN` | Token failed signature/claims verification |
| 401 | `AUTH_NOT_CONFIGURED` | Supabase unset and `ALLOW_MOCK_AUTH=false` |
| 403 | `FORBIDDEN` | Authenticated, but role not permitted |
| 404 | `INSPECTION_NOT_FOUND` | Inspection id does not exist |
| 404 | `IMAGE_NOT_FOUND` | Image id not on this inspection |
| 404 | `RULE_NOT_FOUND` | Rule / rule-result id does not exist (or not on this inspection) |
| 404 | `FIELD_NOT_FOUND` | Extracted-field id not on this inspection |
| 400 | `NO_IMAGES` | `/process` called with zero uploaded images |
| 400 | `INVALID_IMAGE` | Upload fails MIME/size/decodability checks |
| 400 | `TOO_MANY_IMAGES` | Upload would exceed `MAX_IMAGES_PER_INSPECTION` |
| 409 | `INSPECTION_FINALIZED` | Mutation attempted on a finalized inspection |
| 409 | `ALREADY_PROCESSING` | `/process` called while already processing |
| 409 | `ALREADY_FINALIZED` | `/finalize` called twice (see §8 concurrency) |
| 422 | `VALIDATION_ERROR` | Request body failed schema validation |
| 502 | `PROCESSING_FAILED` | Pipeline (OCR/extraction/rules) raised |
| 500 | `INTERNAL_ERROR` | Unhandled server error |

Every response also carries an `x-request-id` header (echoed from the
request if the client sent one, otherwise generated) for log
correlation.

## 5. Pagination

List endpoints return:

```json
{
  "items": [ /* T[] */ ],
  "total": 137,
  "page": 1,
  "page_size": 20
}
```

`page` is 1-indexed. `total_pages` is intentionally omitted from the
wire format — the frontend derives it (`Math.ceil(total / page_size)`)
rather than trusting a second server-computed value that could drift
from `total`/`page_size`. Query params: `page` (default 1, min 1),
`page_size` (default 20, min 1, max 100).

## 6. Database tables (reference)

Implemented in `backend/app/models/`, migrated via Alembic
(`backend/migrations/versions/`). All primary keys are UUIDv4.

| table | key columns |
|---|---|
| `inspectors` | id, email, full_name, role, badge_id |
| `inspections` | id, inspector_id, stage, overall_status, inspection_location, notes, processing_error, finalized_at, created_at, updated_at |
| `products` | id, inspection_id (1:1), product_name, brand, category, batch_number |
| `product_images` | id, inspection_id, storage_path, original_filename, view_type, mime_type, file_size, image_quality, quality_note, processing_status, created_at |
| `ocr_results` | id, image_id (1:1), raw_text, ocr_confidence, processing_status |
| `extracted_fields` | id, inspection_id, field_name, value, normalized_value, confidence, validation_status, validation_reason, source_image_id, source_text, manually_verified, manually_edited, candidates (JSON, nullable) |
| `rules` | id, rule_code, title, description, category, field_name, condition_type, expected_value, expected_unit, applicable_category, legal_source, version, effective_from, effective_to, active, is_demo |
| `rule_results` | id, inspection_id, rule_id, detected_value, status, reason, confidence, evidence_image_id, reviewed, reviewer_id, reviewed_at, inspector_note |
| `audit_logs` | id, inspection_id, user_id, action, entity_type, entity_id, event_metadata (JSON), created_at |

`extracted_fields.candidates` is populated **only** when
`validation_status == CONFLICT`; see §7.

## 7. Extraction conflicts and low-quality OCR

When multiple product images yield different values for the same field
(e.g. two MRP figures), the extraction pipeline does **not** pick one:

```json
{
  "field_name": "MRP",
  "value": "₹50",
  "validation_status": "CONFLICT",
  "validation_reason": "Different values were detected for MRP across product images: ₹50, ₹55.",
  "candidates": [
    { "value": "₹50", "source_image_id": "5b9e...front" },
    { "value": "₹55", "source_image_id": "9ac1...back" }
  ]
}
```

`value` is set to the highest-confidence candidate for display purposes
only (list/summary views need *something* to show) — inspectors must
resolve the conflict via `PATCH .../fields/{field_id}` before the field
is trusted. `candidates` is the authoritative list and is always present
(never omitted) when `validation_status == CONFLICT`; every entry
carries the `source_image_id` it came from so the inspector can open
that specific image.

Low-quality/undetectable OCR never becomes a fabricated violation: if no
reliable value is found, `validation_status = "UNCERTAIN"` and the
corresponding rule result is `NEEDS_REVIEW`, not
`POTENTIAL_NON_COMPLIANCE`. `UNCERTAIN` is also used when a value is
detected but its format doesn't match expectations (e.g. an
unparseable MRP) and when extraction confidence is below the low-
confidence threshold.

## 8. Concurrency

- **Processing** (`POST /{id}/process`): the inspection row is re-fetched
  with `SELECT ... FOR UPDATE` before any state transition. A second
  concurrent call for the same inspection blocks on the row lock, then
  observes `stage == PROCESSING` and receives `409 ALREADY_PROCESSING`
  rather than restarting the pipeline.
- **Finalization** (`POST /{id}/finalize`): same row-lock pattern.
  Finalizing an already-finalized inspection is idempotent from the
  caller's perspective in that it never corrupts state, but is reported
  explicitly: a second `/finalize` call returns `can_finalize: false`
  with `reason` set (surfaced as `409 ALREADY_FINALIZED` when finalization
  gate checks — missing required fields, unreviewed findings — have
  already passed once and the client retries after a client-side timeout).

## 9. Endpoints

All paths below are relative to `/api/v1`.

| Method | Path | Summary |
|---|---|---|
| GET | `/health` | Liveness check (no auth) |
| GET | `/auth/me` | Current inspector profile |
| POST | `/inspections` | Create an inspection |
| GET | `/inspections` | List inspections (paginated, filterable) |
| GET | `/inspections/{id}` | Get full inspection detail |
| GET | `/inspections/{id}/results` | Get final compliance results + summary |
| POST | `/inspections/{id}/finalize` | Finalize an inspection |
| POST | `/inspections/{id}/images` | Upload one or more product images |
| DELETE | `/inspections/{id}/images/{image_id}` | Delete a product image |
| POST | `/inspections/{id}/process` | Start OCR→extraction→validation→rules pipeline |
| GET | `/inspections/{id}/processing-status` | Poll pipeline progress |
| GET | `/inspections/{id}/ocr` | Get raw OCR text per image |
| GET | `/inspections/{id}/extracted` | Get structured extracted fields |
| PATCH | `/inspections/{id}/fields/{field_id}` | Correct/verify one extracted field |
| GET | `/inspections/{id}/rules` | Get rule evaluation results for this inspection |
| GET | `/inspections/{id}/rules/{rule_result_id}` | Get full detail for one rule result |
| PATCH | `/inspections/{id}/rules/{rule_result_id}/review` | Confirm/correct a rule finding |
| GET | `/rules` | Browse the rules repository (paginated, filterable) |
| GET | `/rules/{rule_id}` | Get a single rule definition |
| GET | `/dashboard/summary` | Dashboard summary counts |
| GET | `/dashboard/trends` | Inspection counts over time |
| GET | `/dashboard/recent-inspections` | Most recently created/updated inspections |
| POST | `/reports/inspections/{id}` | Generate a PDF inspection report |

### GET `/health`

No auth. Response `200`:
```json
{ "status": "ok", "service": "legal-metrology-backend", "version": "1.0.0" }
```

### GET `/auth/me`

Response `200` (`InspectorResponse`):
```json
{ "id": "uuid", "full_name": "string", "email": "string", "role": "INSPECTOR", "badge_id": "string | null" }
```

### POST `/inspections`

Request (`InspectionCreate`):
```json
{
  "product_name": "string | null",
  "brand": "string | null",
  "category": "string | null",
  "batch_number": "string | null",
  "inspection_location": "string | null",
  "notes": "string | null"
}
```
All fields optional — an inspector may start an inspection before any
product details are known and fill them in later via image extraction.

Response `201` (`InspectionCreateResponse`):
```json
{ "id": "uuid", "stage": "CREATED" }
```

### GET `/inspections`

Query params: `page`, `page_size`, `status` (`InspectionStatus`),
`category`, `search` (matches product name or inspection id),
`inspector_id`, `date_from`, `date_to` (ISO 8601 datetimes).

By default, inspections still in `CREATED` (no images uploaded yet) are
excluded from listings — they're not yet meaningful work items.

Response `200`: `Page<InspectionSummary>` where `InspectionSummary` is:
```json
{
  "id": "uuid",
  "product_name": "string | null",
  "category": "string | null",
  "stage": "InspectionStage",
  "overall_status": "InspectionStatus",
  "inspector_name": "string",
  "created_at": "datetime"
}
```

### GET `/inspections/{id}`

Response `200` (`InspectionDetail`):
```json
{
  "id": "uuid",
  "stage": "InspectionStage",
  "overall_status": "InspectionStatus",
  "inspector": { "id": "uuid", "full_name": "string", "email": "string", "role": "string", "badge_id": "string | null" },
  "product": { "id": "uuid", "product_name": "string | null", "brand": "string | null", "category": "string | null", "batch_number": "string | null" } ,
  "images": [ /* ImageResponse[], see below */ ],
  "extracted_fields": [ /* ExtractedFieldResponse[], see below */ ],
  "rule_results": [ /* RuleResultResponse[], see below */ ],
  "inspection_location": "string | null",
  "notes": "string | null",
  "processing_error": "string | null",
  "created_at": "datetime",
  "updated_at": "datetime",
  "finalized_at": "datetime | null"
}
```
`404 INSPECTION_NOT_FOUND` if the id does not exist.

### GET `/inspections/{id}/results`

Response `200` (`InspectionResultsResponse`):
```json
{
  "inspection_id": "uuid",
  "product": { "...": "ProductResponse | null" },
  "overall_status": "InspectionStatus",
  "summary": { "total": 12, "passed": 9, "potential_non_compliance": 1, "needs_review": 2 },
  "rules": [ /* RuleResultResponse[] */ ]
}
```

### POST `/inspections/{id}/finalize`

Request (`FinalizeInspectionRequest`):
```json
{ "final_notes": "string | null" }
```

Response `200` (`FinalizeInspectionResponse`):
```json
{
  "can_finalize": true,
  "reason": "string | null",
  "inspection": { "...": "InspectionDetail | null" }
}
```
When gate checks fail (e.g. unresolved `NEEDS_REVIEW` findings, pipeline
not yet complete), `can_finalize: false` with `reason` explaining why,
and `inspection: null`. Finalizing sets `stage = FINALIZED` and freezes
the inspection: subsequent image uploads, deletes, reprocessing, and
field/rule edits on it all fail with `409 INSPECTION_FINALIZED`.

### POST `/inspections/{id}/images`

`multipart/form-data`: `files` (one or more), `view_types` (form field,
one `ImageViewType` string per file — defaults to `OTHER` for any file
without a matching entry).

Each file is validated (allowed MIME types: `image/jpeg`, `image/jpg`,
`image/png`, `image/webp`; must decode as a real image; size ≤
`MAX_IMAGE_SIZE_MB`, default 10MB) before acceptance. Uploading would
push the inspection over `MAX_IMAGES_PER_INSPECTION` (default 10) →
`400 TOO_MANY_IMAGES`.

Response `200`: `ImageResponse[]`:
```json
{
  "id": "uuid",
  "inspection_id": "uuid",
  "view_type": "ImageViewType",
  "original_filename": "string",
  "mime_type": "string",
  "file_size": 123456,
  "image_quality": "ImageQuality",
  "quality_note": "string | null",
  "processing_status": "ImageProcessingStatus",
  "url": "string",
  "created_at": "datetime"
}
```
`image_quality` is `UNKNOWN` until OCR runs (it's derived from OCR
confidence during `/process`), never null.

### DELETE `/inspections/{id}/images/{image_id}`

`204 No Content`. `404 IMAGE_NOT_FOUND` if not on this inspection.

### POST `/inspections/{id}/process`

Runs OCR → extraction → validation → rule evaluation synchronously and
returns the updated inspection. `400 NO_IMAGES` if no images have been
uploaded. `409 ALREADY_PROCESSING` / `409 INSPECTION_FINALIZED` per §8.

Response `200`: `InspectionDetail` (same shape as `GET /{id}`).

### GET `/inspections/{id}/processing-status`

Response `200` (`ProcessingStatusResponse`):
```json
{
  "inspection_id": "uuid",
  "stage": "UPLOADING | OCR | EXTRACTION | VALIDATION | RULE_EVALUATION | COMPLETED | FAILED",
  "progress": 55,
  "status": "PENDING | PROCESSING | COMPLETED | FAILED",
  "error": "string | null"
}
```
Intended for polling from the frontend's processing page. `stage`/`progress`
are derived from `InspectionStage`, not stored separately.

### GET `/inspections/{id}/ocr`

Response `200` (`OCRResultsResponse`):
```json
{
  "items": [
    { "image_id": "uuid", "raw_text": "string", "ocr_confidence": 0.92, "processing_status": "PROCESSED" }
  ]
}
```
One entry per uploaded image once OCR has run.

### GET `/inspections/{id}/extracted`

Response `200` (`ExtractedFieldsResponse`):
```json
{
  "fields": [
    {
      "id": "uuid",
      "inspection_id": "uuid",
      "field_name": "MRP",
      "value": "string | null",
      "normalized_value": "string | null",
      "confidence": 0.87,
      "confidence_level": "HIGH | MEDIUM | LOW",
      "validation_status": "ValidationStatus",
      "validation_reason": "string | null",
      "source_image_id": "uuid | null",
      "source_text": "string | null",
      "manually_verified": false,
      "manually_edited": false,
      "candidates": [ { "value": "string", "source_image_id": "uuid | null" } ] 
    }
  ]
}
```
`candidates` is `null` unless `validation_status == "CONFLICT"` (§7).

### PATCH `/inspections/{id}/fields/{field_id}`

Request (`ExtractedFieldUpdateRequest`):
```json
{ "value": "string | null", "manually_verified": true, "note": "string | null" }
```
Applying this endpoint always sets `validation_status = "VALID"`,
`confidence = 1.0`, clears `candidates`, and marks
`manually_verified = true` (and `manually_edited = true` when `value`
differs from what was extracted) — an inspector's confirmation
supersedes the machine signal entirely.

Response `200`: `ExtractedFieldResponse` (shape above).

### GET `/inspections/{id}/rules`

Response `200` (`RuleResultsResponse`):
```json
{ "rules": [ /* RuleResultResponse[] */ ] }
```
`RuleResultResponse`:
```json
{
  "id": "uuid",
  "inspection_id": "uuid",
  "rule_id": "uuid",
  "rule_code": "string",
  "requirement": "string",
  "field_name": "string",
  "detected_value": "string | null",
  "status": "PASS | POTENTIAL_NON_COMPLIANCE | NEEDS_REVIEW",
  "reason": "string",
  "confidence": "number | null",
  "evidence_image_id": "uuid | null",
  "reviewed": false,
  "reviewer_id": "uuid | null",
  "reviewed_at": "datetime | null",
  "inspector_note": "string | null"
}
```

### GET `/inspections/{id}/rules/{rule_result_id}`

Response `200` (`RuleResultDetailResponse`) — adds the full rule
definition inline instead of just `rule_code`:
```json
{
  "rule_result_id": "uuid",
  "rule": { "rule_code": "string", "title": "string", "description": "string", "legal_source": "string" },
  "field_name": "string",
  "detected_value": "string | null",
  "status": "InspectionStatus",
  "reason": "string",
  "confidence": "number | null",
  "evidence_image_id": "uuid | null",
  "reviewed": false,
  "reviewer_id": "uuid | null",
  "reviewed_at": "datetime | null",
  "inspector_note": "string | null"
}
```
`404 RULE_NOT_FOUND` if `rule_result_id` doesn't exist or belongs to a
different inspection.

### PATCH `/inspections/{id}/rules/{rule_result_id}/review`

Request (`RuleReviewRequest`):
```json
{ "reviewed": true, "inspector_note": "string | null", "corrected_value": "string | null" }
```
Response `200`: `RuleResultResponse`.

### GET `/rules`

Query params: `page`, `page_size`, `category`, `active` (bool),
`search` (matches title, rule code, or description).

Response `200`: `Page<RuleResponse>` where `RuleResponse` is:
```json
{
  "id": "uuid",
  "rule_code": "string",
  "title": "string",
  "description": "string",
  "category": "string",
  "field_name": "string",
  "condition_type": "RuleConditionType",
  "expected_value": "string | null",
  "expected_unit": "string | null",
  "applicable_category": "string",
  "legal_source": "string",
  "version": "string",
  "effective_from": "date | null",
  "effective_to": "date | null",
  "active": true,
  "is_demo": true
}
```

### GET `/rules/{rule_id}`

Response `200`: `RuleResponse`. `404 RULE_NOT_FOUND` if missing.

### GET `/dashboard/summary`

Response `200`:
```json
{ "total": 42, "passed": 30, "potential_non_compliance": 5, "needs_review": 7 }
```

### GET `/dashboard/trends`

Query param: `days` (default 30).

Response `200`:
```json
{ "points": [ { "date": "2026-09-01", "inspections": 4 } ] }
```

### GET `/dashboard/recent-inspections`

Query param: `limit` (default 6).

Response `200`:
```json
{ "items": [ /* InspectionSummary[] */ ] }
```

### POST `/reports/inspections/{id}`

Generates a PDF report for a (typically finalized, but not enforced)
inspection and stores it via the configured storage backend.

Response `200` (`ReportGenerateResponse`):
```json
{ "report_id": "uuid", "inspection_id": "uuid", "file_path": "string", "url": "string | null" }
```

## 10. Mock mode compatibility

The frontend's mock data layer (`frontend/lib/mock/`) independently
implements the same response shapes documented above, so UI code never
needs to know whether it's talking to the real backend or to mocks. When
adding a field to a response here, add it to both
`backend/app/schemas/` and the corresponding mock fixture/generator, or
the two will silently diverge and mock-only development will stop
reflecting reality.
