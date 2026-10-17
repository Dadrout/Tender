# Actual verification — 14–15 October 2026, Asia/Almaty

Environment: Python 3.12.14, Node.js 22.22.2, Next.js 16.4.0, Firefox via Playwright. Gemini was configured and tested on 15 October; the original browser/build checks below were run on 14 October.

## Interface redesign follow-up — 15 October 2026

- Approved visual direction is recorded in `design-system/qazbid-ai/MASTER.md`.
  Shared styling updates cover landing, workspace navigation, dashboard, upload,
  review, analysis tabs, discovery, catalog, reports and demo screens.
- Final `npm run test:e2e`: **8 passed**. This includes all original workflows,
  discovery reset/result announcements, persisted theme and language after reload,
  plus all 8 routes and 4 additional analysis tabs at 375×812, 768×1024,
  1440×900 and 812×375, in light/dark themes with reduced motion.
- Responsive checks found no horizontal page overflow. Kazakh analysis controls
  were checked at 375px. Rendered subtitle, primary navigation action and metric
  supporting text passed the 4.5:1 contrast threshold in both themes. This is
  focused contrast coverage, not a claim of a comprehensive WCAG audit.
- Visual review: saved full-page screenshots for desktop, tablet and mobile in both
  themes, including Kazakh mobile analysis. The closed mobile sidebar is hidden
  from keyboard/accessibility navigation; selected links and preference buttons
  expose their state, and a skip-to-content link is available.
- A regression exposed stored preferences being overwritten by initial defaults
  under development Strict Mode. Persistence now waits for stored preferences to
  load; dark theme and Kazakh survive page reloads.
- Final `npm run typecheck`, `npm run build` and backend `pytest` passed
  (**33 backend tests**). An independent code reviewer reported no actionable
  regressions. These follow-up checks ran against the local development stack;
  Docker images were not rebuilt for this visual update.

## Original build and Gemini integration checks

- Backend: complete pytest suite — **33 passed**. Covers real PDF + workbook ingestion, units/dimensions, missing evidence and cost, shared stock allocation, category mismatch, negative profit/financing, scenario risk changes, manual provenance, original source immutability, CSV formula escaping, report generation, reuse/reset, persistence across app instances foreign-origin rejection and honest processing-stage order. Added regression coverage for the real GenAI SDK serializer with a mock HTTP transport and table quantity grounding that rejects an article number as quantity.
- Live Gemini extraction: `gemini-3.1-flash-lite` processed the synthetic enamel PDF and passed strict Pydantic and source validation: 1 item, quantity 12, budget 90,000 KZT, 2 product requirements, synthetic flag retained. The server-only credential is in an ignored `.env` with mode 0600 and is excluded from the source archive.
- Live application smoke test: uploaded that PDF plus `inventory.xlsx` through the running Next.js `/api` proxy with `mode=gemini`; the durable job reached `review_ready` with no error, the saved item retained `origin=ai`, and running analysis produced complete financial results (8 in stock, 4 to purchase, cost 50,000 KZT and profit 40,000 KZT under the default zero-expense scenario).
- Browser: **4 Firefox end-to-end tests passed** on both local development stack and built Docker Compose stack. Real upload → review → matching → conflict/source → financial recalculation → export → refresh/persistence → Kazakh controls. Also 390px mobile menu and no overflow, dedicated demo/negative profit, editable reusable catalog, report/discovery navigation and actual invalid-file/import error handling.
- TypeScript strict type check passed.
- Next.js production build passed with Webpack. Initial Turbopack production build hit environment-specific local-port restrictions; build command explicitly uses the verified Webpack path. Development Turbopack works on this host.
- Docker Compose configuration validated; both images built, API health check passed and browser tests ran against the stack at a temporary local port. The delivered Compose file binds the standard port only to loopback.
- One-command `scripts/dev.sh` started both services and same-origin API proxy on free alternate ports; terminating the runner stopped both owned process groups. An earlier 8001 trial encountered an unrelated listener; no unrelated process was stopped.
- Visual review: desktop 1440px and mobile 390px for landing, dashboard, new analysis, demo, inventory, reports, discovery, analysis summary, matrix, simulator, risks and details. Browser page errors: **0**. Document width on all checked mobile surfaces: **390px**. Dark theme reviewed. Charts and menu visibility refined once and confirmed.
- PDF reports: real demo-generated RU/KK outputs, Cyrillic/Kazakh font rendering reviewed. Russian final report has **4 pages**, repeating table headers and source references. PDF shows selected candidates and conflicting alternatives; complete matrix is available in XLSX/CSV.
- Independent reviewer reproduced important issues; failing regression tests were written, then fixes passed the complete suite. All eight review findings were addressed; original catalog row preservation and common contract condition handling were also verified.

Verification boundaries:
- Gemini was verified on the bundled synthetic enamel document. This does not establish extraction accuracy across arbitrary tender layouts; manual review remains part of the workflow. The configured model is account-dependent; the older 2.5 model was unavailable for this account, and 3.8 returned transient high-demand errors during this check.
- Russian/Kazakh OCR was **not executed**. This host's Tesseract has only eng/chi_sim; unsupported scans produce explicit OCR-needed errors. Container has no OCR packages by default.
- Remote GitHub Actions execution was **not run**. The workflow configuration is supplied.
- pytest emitted one dependency deprecation warning from Starlette TestClient's httpx compatibility. This did not fail tests. Playwright emitted the host's NO_COLOR/FORCE_COLOR warning; browser scenarios passed.

## Проверка Opportunity Radar — 17.10.2026

- Сервер: 50 проверок пройдены, включая строгие цитаты Gemini, оригиналы с SHA256, неизвестную цену и PDF-отчёт без неё, полную ячейку характеристик, сокращённые названия и вертикальные таблицы.
- Интерфейс: 11 браузерных сценариев пройдены: подбор/проверка/решение, отсутствие совпадений, исторический документ, мобильные размеры, RU/KZ, светлая/тёмная тема, экспорт и сохранение.
- TypeScript и production-сборка Next.js завершены успешно. Docker-образ в этой итерации не пересобирался.
- Настоящий вызов Gemini на оригинальной спецификации бумаги для Тараза 2019 года прошёл строгую проверку источников. Повторные тесты используют сохранённый ответ; онлайн-сканирование порталов не выполняется.
- Независимое ревью выявило неизвестную цену, полноту характеристик, оплату в вертикальной таблице и дублирование позиции; исправления проверены регрессиями.
