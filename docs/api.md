# API
Interactive docs: http://127.0.0.1:8000/docs. OpenAPI: /openapi.json.

All paths below are backend paths; browser accesses /api + path via Next.js proxy.

| Operation | Endpoint |
|---|---|
| Health / AI availability | GET /health |
| Organization | GET /organizations |
| Upload PDF + XLSX/XLS/CSV or catalog_id | POST /jobs (multipart: tender, inventory/catalog_id, mode, optional mapping JSON) |
| Durable actual stages and errors | GET /jobs/{id} |
| Retry preserved sources | POST /jobs/{id}/retry?mode=deterministic |
| Saved analyses | GET /analyses |
| Full analysis/evidence/scenario | GET /analyses/{id} |
| Correct extraction | PUT /analyses/{id}/tender (Tender schema) |
| Correction audit | GET /analyses/{id}/corrections |
| Run matching, finance, risk | POST /analyses/{id}/run |
| Persist and recalculate scenario | PUT /analyses/{id}/scenario (Scenario schema) |
| Original source | GET /analyses/{id}/source |
| Reusable catalogs | GET /catalogs, GET /catalogs/{id} |
| Headers, mapping suggestions, sample rows | POST /catalogs/preview (file) |
| Import mapped catalog | POST /catalogs (file, optional mapping JSON) |
| Edit product, refresh related results | PUT /catalogs/{catalog}/products/{product} |
| Real bundled file demo | POST /demo/enamel, /demo/brushes, /demo/buckets |
| Reset dedicated demo records | DELETE /demo |
| Download source examples | GET /demo/files/{filename} |
| Imported/synthetic discovery | GET /discovery |
| PDF report | GET /analyses/{id}/report?lang=ru or kk |
| Matrix exports | GET /analyses/{id}/matrix.csv or matrix.xlsx |
| Financial export | GET /analyses/{id}/financial.csv |

Limits: 15 MB per file, 100 PDF pages, 5000 catalog products, 100 columns; bounded XLSX decompression; optional OCR 30 seconds per page. AI input 120k characters, maximum 10k output tokens, 45-second request timeout, two attempts. Schema errors return 422; missing entities 404; state conflicts 409. Wrong file types, nonnumeric amounts, unknown catalogs, unsupported OCR, and unavailable AI produce honest errors.

Browser mutations accept configured local origins. QAZBID_ALLOWED_ORIGINS can declare a comma-separated explicit allowlist for other development hostnames. This is CSRF mitigation, not authentication.

## Локальный подбор

`GET /radar?catalog_id=<id>` оценивает доступные документы существующими движками. Возвращает фактические счётчики, происхождение, конфликты, неизвестные требования, условную экономику и ограничения. `GET /radar/source?source_id=<id>` отдаёт только зарегистрированный исходный PDF. `POST /radar/analyze` принимает `{"source_id":"demo:enamel","catalog_id":"…"}` и создаёт анализ в состоянии review с отдельной копией оригинала. Он сохраняется при сбросе демонстрации. Исторический публичный документ сохраняет происхождение во всех дальнейших результатах. При отсутствии бюджета прибыль остаётся неизвестной до явного сохранения сценария пользователя через PUT /analyses/{id}/scenario.
