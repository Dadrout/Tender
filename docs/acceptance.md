# Acceptance and verification record

Implemented P0: working Next.js + FastAPI stack, SQLite persistence, document upload and parsing, configurable workbook mapping, structured requirements with page evidence, selected/alternative candidates, explicit attribute/quantity classifications, Decimal finances, risks and conservative decisions, catalog editing and reuse, interactive scenarios, source viewer, three genuine synthetic demos, PDF/CSV/XLSX exports.

Implemented P1: optional Gemini structured extraction with provider isolation, validated evidence/numbers and retry; dimension and volume normalization; inventory/requirements provenance and correction history; cash-flow charts; working RU/KK navigation/forms/statuses/report headings; light/dark themes; responsive 390px UI; real dashboard records.

Extended capabilities: imported discovery search and filters; explicit source adapter boundaries; generated report persistence. No live government data or unsupported official API is presented.

Actual tests and commands are recorded in README and docs/verification.md after the final run. Do not infer successful Gemini or OCR execution from the existence of integration code.

Known scope limits:
- Local single-organization demo mode has no production identity/multi-tenant authorization. Loopback only; add auth, organization isolation and storage access controls before public deployment.
- The lightweight parser supports labeled blocks and common table schemas; arbitrary prose/complex layouts may require manual review or Gemini. Docling is not included, to keep startup lightweight.
- OCR is optional Tesseract with rus/kaz language packs. The current host has only eng/chi_sim, so Russian/Kazakh scanned PDFs honestly require OCR rather than inferred text. Container has no OCR by default.
- Quantity units must agree explicitly. Attribute values normalize e.g. 3500 ml ↔ 3.5 l and mm ↔ cm; cross-unit stock pricing/conversion is left unverified for manual resolution.
- Gemini extraction and interpretation of constraints are integrated; no separate embedding index or free-form AI executive narrative is shipped. Candidate ranking, explanations and financial/decision summaries are deterministic and inspectable. External Gemini response needs a configured key and was not tested live here.
- Cash flow uses a single up-front procurement/expense/tax reserve and one customer payment. Payment days are elapsed from procurement day 0, not a detailed contract-specific accrual calendar. Financing is simple interest. Tax is a user assumption, never an assertion of tax treatment.
- Catalog prices are catalog assertions, not independently fetched supplier quotations or uploaded certificate validation.
- Legal provisions are not encoded. Wording findings are preliminary rule/AI observations, not legal conclusions. Goszakup and Samruk-Kazyna adapter activation needs documented API authorization and implementation.
- RU/KK app controls and headings are translated; source product names, evidence and some generated descriptions remain in original/Russian language. Reports use bilingual labels where appropriate.
- Background jobs are in-process; restart marks unfinished jobs failed and retryable. One local API process is intended. Schema v1 is initialized and recorded by SQLAlchemy; future schema changes need explicit migrations (no fictional Alembic history).
- P2 items deferred: notifications, DOCX drafts, supplier quote comparison and historical trend analytics.
