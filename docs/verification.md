# Actual verification — 14 October 2026, Asia/Almaty

Environment: Python 3.12.14, Node.js 22.22.2, Next.js 16.4.0, Firefox via Playwright. No external AI key configured.

- Backend: complete pytest suite — **31 passed**. Covers real PDF + workbook ingestion, units/dimensions, missing evidence and cost, shared stock allocation, category mismatch, negative profit/financing, scenario risk changes, manual provenance, original source immutability, CSV formula escaping, report generation, reuse/reset, persistence across app instances foreign-origin rejection and honest processing-stage order.
- Browser: **4 Firefox end-to-end tests passed** on both local development stack and built Docker Compose stack. Real upload → review → matching → conflict/source → financial recalculation → export → refresh/persistence → Kazakh controls. Also 390px mobile menu and no overflow, dedicated demo/negative profit, editable reusable catalog, report/discovery navigation and actual invalid-file/import error handling.
- TypeScript strict type check passed.
- Next.js production build passed with Webpack. Initial Turbopack production build hit environment-specific local-port restrictions; build command explicitly uses the verified Webpack path. Development Turbopack works on this host.
- Docker Compose configuration validated; both images built, API health check passed and browser tests ran against the stack at a temporary local port. The delivered Compose file binds the standard port only to loopback.
- One-command `scripts/dev.sh` started both services and same-origin API proxy on free alternate ports; terminating the runner stopped both owned process groups. An earlier 8001 trial encountered an unrelated listener; no unrelated process was stopped.
- Visual review: desktop 1440px and mobile 390px for landing, dashboard, new analysis, demo, inventory, reports, discovery, analysis summary, matrix, simulator, risks and details. Browser page errors: **0**. Document width on all checked mobile surfaces: **390px**. Dark theme reviewed. Charts and menu visibility refined once and confirmed.
- PDF reports: real demo-generated RU/KK outputs, Cyrillic/Kazakh font rendering reviewed. Russian final report has **4 pages**, repeating table headers and source references. PDF shows selected candidates and conflicting alternatives; complete matrix is available in XLSX/CSV.
- Independent reviewer reproduced important issues; failing regression tests were written, then fixes passed the complete suite. All eight review findings were addressed; original catalog row preservation and common contract condition handling were also verified.

Verification boundaries:
- Gemini live API response was **not tested**, because no key was configured. Structured provider and grounding validation are implemented; deterministic mode was tested end to end.
- Russian/Kazakh OCR was **not executed**. This host's Tesseract has only eng/chi_sim; unsupported scans produce explicit OCR-needed errors. Container has no OCR packages by default.
- Remote GitHub Actions execution was **not run**. The workflow configuration is supplied.
- pytest emitted one dependency deprecation warning from Starlette TestClient's httpx compatibility. This did not fail tests. Playwright emitted the host's NO_COLOR/FORCE_COLOR warning; browser scenarios passed.
