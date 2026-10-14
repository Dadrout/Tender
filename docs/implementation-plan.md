# Implementation plan — authorized autonomous local build
1. Write tests for evidence extraction, workbook aliases, structured comparison, unit conversion, financial edge cases, risk blockers, reports and persistence. Run RED before implementation.
2. Implement typed models and independent document, inventory, matching, financial, risk and report modules. Generate three synthetic PDFs and a 15+ product XLSX. Run backend tests.
3. Implement SQLAlchemy entities and FastAPI upload/job/review/run/scenario/catalog/source/export endpoints. Add optional Gemini provider with retries and strict evidence validation. Run API integration tests.
4. Implement responsive RU/KK Next.js UI: landing, dashboard, upload wizard, review, tender results, matrix/evidence, simulator, risk/decision, catalogs, discovery and reports. Use reusable components, Zod/RHF forms and Query data fetching.
5. Connect and test real uploads, conflicts, corrections, recalculation, PDF download, localization, refresh persistence and mobile via Firefox Playwright. Build TypeScript production frontend.
6. Inspect desktop/mobile and report pages, fix observed defects in one pass. Deliver README, Docker Compose, CI, demo script, API and limitations docs plus a source archive.

Interfaces: all money serialized as Decimal strings; browser displays backend calculations. Analysis returns tender, line items, selected matches plus alternatives, scenario, financial results, risks, decision, mode and sources. Jobs expose actual named stages. Catalog IDs reused across analyses. Corrections and scenarios are persisted before recalculation.
