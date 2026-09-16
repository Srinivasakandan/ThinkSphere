# ThinkSphere — Legal Metrology Compliance Inspection System

A frontend for Indian Legal Metrology inspectors to check packaged
commodities against the Legal Metrology (Packaged Commodities) Rules, 2011.

**This system assists inspection — it is not an autonomous legal
authority.** OCR/extraction confidence is never presented as legal
compliance certainty, and every system-detected issue is labeled
**Potential Non-Compliance** or **Needs Review**, never a confirmed
violation. The inspector is always the final verifier.

## Tech stack

- Next.js (App Router) + TypeScript + React
- Tailwind CSS v4, hand-rolled shadcn/ui-style primitives on Radix UI
- Lucide React icons
- Supabase Auth / Postgres / Storage (optional — see Demo mode below)
- React Hook Form + Zod for forms and validation
- Recharts for dashboard charts

## Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 — you will be redirected to `/login`.

## Environment variables

See `.env.example`. All variables are optional in development:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, for real authentication |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the future FastAPI backend |

Only `NEXT_PUBLIC_*` values are ever read by the browser. No service-role
keys, backend secrets, or credentials belong in this project.

## Demo mode

If `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not
set, the app automatically runs in **demo mode**:

- `/login` accepts any non-empty email and password.
- Inspection data is seeded from `src/lib/mock/inspections.ts` (12
  realistic inspections spanning Pass, Potential Non-Compliance and Needs
  Review outcomes across several product categories) into an in-memory,
  `localStorage`-backed store (`src/lib/mock/store.ts`), so edits made in
  the UI (uploading a new inspection, correcting a field, reviewing a
  rule, finalizing) persist across navigation and page reloads in your
  browser, without a real database.
- A mock "OCR + rule engine" pass (`src/lib/mock/simulate.ts`) generates
  extracted fields and rule results for any inspection you create through
  **New Inspection**, so the full upload → processing → extraction →
  rules → review → finalize journey works end to end without a backend.

This keeps frontend development fully unblocked while the FastAPI
backend is being built.

## Running in dynamic mode (real OCR, not canned data)

By default, this app runs against whatever you actually upload or scan —
not pre-scripted demo responses:

1. Set `NEXT_PUBLIC_API_BASE_URL` (see `.env.example`) so the frontend
   calls the real FastAPI backend instead of `src/lib/mock/*`.
2. Run the backend (`backend/README.md`) against a real Postgres
   database. `OCR_PROVIDER=auto` (the backend default) uses real
   Tesseract OCR when `tesseract-ocr` is installed
   (`apt-get install tesseract-ocr` on Debian/Ubuntu) and falls back to
   deterministic mock text only when it isn't — set `OCR_PROVIDER=mock`
   explicitly to force the old static behavior.
3. Images are run through OpenCV preprocessing (auto-rotate, deskew,
   contrast enhancement — `backend/app/services/imaging/`) before OCR,
   so a real, possibly tilted phone photo or scan reads reliably.

Every extracted field also carries a bounding box locating where on the
source image it was read from (`backend/app/services/evidence.py`), so
the extracted-information and rule-evaluation screens can highlight the
exact evidence, not just name the source image.

## Folder structure

```
src/
  app/                      App Router routes
    login/                  Public login page
    (app)/                  Route group: authenticated shell (Sidebar + Header)
      dashboard/
      inspections/
        new/                Step 1: upload + product info
        [id]/               Inspection detail (tabs: images, extracted, rules, audit)
        [id]/processing/    Mock OCR/rule-engine progress
        [id]/extracted/     Extracted fields, confidence, source images, edit
        [id]/rules/         Rule evaluation table + rule details
        [id]/results/       Overall result, inspector review, finalize
      reports/
      rules/                Rules repository (read-only)
      settings/
  components/
    ui/                     Hand-rolled shadcn/ui-style primitives (Radix-based)
    common/                 StatusBadge, ConfidenceBadge, EmptyState, LoadingState,
                             ErrorState, ConfirmDialog, skeleton loaders
    layout/                 Sidebar, Header, AppShell, page-header context
    dashboard/               SummaryCard, charts, RecentInspections
    inspection/              Stepper, uploader, image grid/viewer, extracted field
                             card, rule table/details, inspector review, finalize
    auth/                    ProtectedRoute guard
  lib/
    api/                    Service layer (createInspection, getInspections, …) —
                             the boundary that will later call FastAPI instead of
                             the mock store, with no UI changes required
    mock/                   Mock data, in-memory store, mock extraction/rule engine
    auth/                   AuthProvider / useAuth
    supabase/               Supabase browser client (no-op when unconfigured)
    inspection/             calculateOverallStatus() and related status utilities —
                             the single source of truth for status roll-up logic
    format.ts, utils.ts
  types/                    Shared TypeScript domain types
```

## Running locally

```bash
npm run dev      # start the dev server
npm run lint      # ESLint
npm run build     # production build + type check
```

## How authentication works

`src/lib/auth/auth-context.tsx` exposes `useAuth()` (`inspector`,
`isLoading`, `isDemoMode`, `login`, `logout`). `src/lib/api/auth.ts` is the
service layer: when Supabase env vars are present it calls
`supabase.auth.signInWithPassword`; otherwise it falls back to the mock
session described above. `ProtectedRoute` (used by the `(app)` route
group layout) redirects unauthenticated visitors to `/login`.

Role/permission enforcement (Inspector / Supervisor / Administrator) is
represented in the `Inspector` type and shown in the UI (profile, rules
page framing), but **must be enforced server-side** once a real backend
exists — the frontend never treats a client-side role check as a security
boundary.

## How the inspection workflow works

1. **Upload or Scan** — `/inspections/new` collects 1–10 images of a
   single physical product (front/back/left/right/top/bottom/other),
   either by uploading image files or by capturing them directly with
   the device camera (`components/inspection/camera-capture.tsx` — a
   live in-browser capture dialog, with a native device-camera-app
   fallback for browsers without camera API support), plus optional
   product info, then calls `createInspection()`.
2. **Processing** — `/inspections/[id]/processing` shows a step-by-step
   progress indicator, then calls `runProcessing()`, which runs the mock
   OCR/extraction/rule-engine pass and stores the results.
3. **Extracted Information** — `/inspections/[id]/extracted` shows every
   extracted field with its **extraction confidence** (High/Medium/Low —
   never called a "compliance score"), its source image, and an Edit
   control. Editing a field calls `updateExtractedField()` and marks it
   "Manually verified".
4. **Rule Evaluation** — `/inspections/[id]/rules` shows every applicable
   rule as PASS / POTENTIAL NON-COMPLIANCE / NEEDS REVIEW with its
   evidence image and a details panel.
5. **Inspector Review** — `/inspections/[id]/results` lists every
   non-passing finding for the inspector to **Confirm** or **Correct**,
   with a note, via `reviewRule()`.
6. **Finalize** — a confirmation dialog reminds the inspector to verify
   flagged findings, then `finalizeInspection()` stamps the inspector,
   timestamp and final status onto the inspection's audit trail.

The overall status for an inspection is never computed ad hoc in a
component — it is always derived by
`calculateOverallStatus(ruleResults)` in `src/lib/inspection/status.ts`:
any `POTENTIAL_NON_COMPLIANCE` wins, else any `NEEDS_REVIEW` wins, else
`PASS`.

## How to replace the mock API with FastAPI

Every function in `src/lib/api/*.ts` already returns data shaped like the
intended REST response (see the JSDoc comment above each function naming
its future endpoint, e.g. `POST /api/inspections/{id}/finalize`). To
connect a real backend:

1. Set `NEXT_PUBLIC_API_BASE_URL`.
2. Replace the body of each function in `src/lib/api/*.ts` with a
   `fetch(...)` call to that endpoint, keeping the same function
   signature and return type.
3. Delete `src/lib/mock/*` once nothing in `lib/api` imports it.

No page or component imports `lib/mock` directly — they only import from
`lib/api` — so this swap requires no UI changes.

## Notable UI/UX decisions

- **Status language** always uses "Potential Non-Compliance" / "Needs
  Review" rather than "Violation" or "Failed" — a system-detected finding
  is not a legal determination.
- Every status indicator pairs an icon and text label, never color alone.
- Confidence is always labeled "Extraction confidence", never "AI
  accuracy" or a compliance percentage.
- Multiple images uploaded together are always treated, labeled and
  displayed as views of **one** product/inspection, never as separate
  products.
