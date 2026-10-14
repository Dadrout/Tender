# QazBid AI

A working local tender analysis MVP for Kazakhstan SMEs. Upload a technical-specification PDF and a real inventory Excel/CSV, review extracted evidence, compare products, simulate execution economics and export an analyst report. Russian is default, Kazakh secondary. **No paid key or cloud account is required.**

## Quick start

Requirements: Docker with Compose, or Python 3.12+ and Node.js 20.9+ with npm.

```bash
docker compose up --build
```

Open **http://127.0.0.1:3000**. Demo: **http://127.0.0.1:3000/demo**. SQLite/uploads are persisted in the `qazbid-data` volume. Ports bind to loopback; the API is accessible only inside Compose. Stop with Ctrl+C; `docker compose down` retains data.

For source development on Linux/macOS:

```bash
./scripts/dev.sh
```

The script installs the locked dependencies on first run, starts both services and stops both when interrupted. Set `PYTHON_BIN` before first setup if the default Python is older than 3.12. API docs: http://127.0.0.1:8000/docs. Existing installed environments can also run `./scripts/setup.sh` explicitly. Alternate ports: `QAZBID_API_PORT=8001 QAZBID_WEB_PORT=3001 ./scripts/dev.sh`.

## Demo and workflow

Open `/demo` and launch **эмаль**. This executes actual extraction of `demo/tender-enamel.pdf` and imports the actual 17-row `demo/inventory.xlsx`. The PDF explicitly labels itself synthetic. Required: 12 yellow enamel packages of 3.5 l, illustrative budget 90,000 ₸. The catalog has eight correct packages and 2.5-l alternatives. The system exposes the packaging conflict, four-unit shortage, missing certificate and packaging evidence. Initial demo assumptions: delivery 5,000 ₸, packaging 1,000 ₸, no tax/financing reserve. Economic profit is 34,000 ₸ and incremental cash needed 24,000 ₸; the decision still requires attention.

Change delivery to 25,000 ₸ and recalculate: profit decreases to 14,000 ₸. Export PDF. Refresh: analysis and scenario remain. Two more demos cover brushes and buckets. Reset removes records created via the dedicated demo launch; documents uploaded by the user remain.

For the jury: show **2.5-l conflict → source PDF/page and Excel row → shortage/unknown certificate → delivery sensitivity → report**. A 90-second script is in `docs/demo-script-ru.md`.

## Optional Gemini

Copy `.env.example` to `.env` and set only the needed variables:

```dotenv
GEMINI_API_KEY=your_private_key
GEMINI_MODEL=gemini-2.5-flash
```

Restart the stack. On New Analysis choose Gemini extraction. The official Google GenAI SDK uses Pydantic structured output, retries and exact-source checks. The model is configurable; choose a model supported by your account. **Document text is sent to Google in this mode.** Keys stay on the server. AI failure retains files and allows a deterministic retry. Matching, arithmetic and decision blockers stay deterministic.

Reference: [Google structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output).

## Repository

```text
apps/web/          Next.js App Router, strict TypeScript, Tailwind, Radix/shadcn-style UI,
                   Lucide, Recharts, TanStack Query, React Hook Form + Zod
apps/api/qazbid/   FastAPI, Pydantic, SQLAlchemy; independent extraction/import,
                   matching, finance, risk, provider and report modules
apps/api/tests/    Backend engine and integration tests
apps/web/tests/   Firefox end-to-end tests
packages/shared/  API contract documentation
 demo/            Three generated synthetic PDFs and 17-product XLSX
scripts/          Setup, one-command dev runner, source data generator
 docs/            Architecture, API, acceptance/limitations, verification, demo script
compose.yaml      Two-service local stack with persistent volume
.github/workflows/checks.yml
```

`runtime/` holds local data and is ignored. `work/` holds verification scratch files and is not part of the source archive. Example reports are bundled at the repository root.

## Verification

```bash
cd apps/api
../../.venv/bin/python -m pytest
cd ../web
npm run typecheck
npm run build
npx playwright install firefox
npx playwright test
```

Start the local stack before Playwright. Firefox is explicitly used; Brave is never launched. Tests cover uploads, evidence/conflicts, corrections, Decimal arithmetic, stock allocation, unknown costs, conservative decisions, report exports, persistence, mobile navigation, locale switching, demo execution, negative profitability, catalog editing and honest error states. See `docs/verification.md` for commands actually run and final results. GitHub Actions is configured but a remote workflow run has not been claimed.

## Financial and evidence rules

Existing stock contributes acquisition cost to economic profit but not a new cash payout. Missing stock uses supplier cost. Unknown quantity, cost or incompatible pricing unit suppresses a complete profit estimate. Tax is an explicit percentage-of-revenue reserve. Financing is simple annual interest on additional cash need until payment. Break-even/target prices solve the same formula, including advance/financing dependence. Browser displays server results; it never asks an LLM to do arithmetic.

Quantity units must explicitly agree. Numeric attribute normalization supports liters/milliliters, length units, weight and dimension tuples. Source rows and original PDF quotes survive manual edits. Manual assertions remain visibly unverified. Shared stock is allocated across line items. Every critical unknown prevents a positive assessment. Source evidence is available in the matrix and report; catalog evidence remains a seller/user assertion.

## Limits and deployment

This is a **local single-organization MVP**, not a public multi-tenant service. Before public deployment add authentication, organization-scoped authorization, file access control, TLS, rate limiting, retention and migrations. Never publish private uploads behind the current unauthenticated API. PostgreSQL migration is straightforward through SQLAlchemy, but Supabase and official procurement APIs are not connected.

Lightweight PDF rules handle labeled blocks and common tables; complex prose may require manual corrections or Gemini. Docling is intentionally omitted. Scanned PDF support requires Tesseract and `rus`/`kaz` language packs; otherwise the app reports that OCR is needed. Separate embeddings, free-form AI narratives, live discovery, notifications and DOCX drafts are deferred. RU/KK controls and report headings work; some generated risk descriptions and original evidence retain Russian/source language. Cash flow is a simplified single-procurement/single-payment scenario. Full details: `docs/acceptance.md`.

## Licenses

Original application code is distributed under MIT (`LICENSE`). Included Noto Sans fonts are under SIL Open Font License; see `docs/Noto-LICENSE.txt`. Next.js, React, FastAPI, SQLAlchemy, Recharts, Radix UI, Lucide, ReportLab, pandas/openpyxl and Google GenAI retain their respective licenses. PyMuPDF is [AGPL/commercial dual-licensed](https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright): review its licensing requirements before distributing a closed-source derivative or operating a proprietary service. This acknowledgement is not a licensing opinion.
