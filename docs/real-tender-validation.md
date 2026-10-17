# Validation against previously unseen official documents

Retrieved 17 October 2026. These are authentic historical public procurement documents, not a live tender scan. Current availability and registry status are **unknown**. The manifest records original URLs, retrieval timestamps, locations and SHA256 digests. PDFs were downloaded directly from official portals and copied without modification. Imported/synthetic demo documents remain separately identified by their existing demo labels.

## Taraz office paper: procurement 326759, lot 1099036

[Official original technical specification](https://zakup.sk.kz/eprocfilestorage/open-api/files/download/de4cfa21-99a5-414a-9c8b-9356b2e8b8b6-2019-mdb), signed 28 August 2019. The original is `data/public-tenders/sk-326759-1099036-taraz-paper-2019.pdf` (one page). This official PDF is also its authoritative source URL; no unverified registry status is inferred.

Page 1 was rendered and visually checked against production `extract_pdf` output. It identifies office paper, **100.000 Одна пачка**, Taraz, Tynyshbayeva 17, DDP, delivery within **30 calendar days** after contract signature. Requirements include A4, at least 80 g/m², 500 sheets per pack, whiteness 161 CIE and paper class no lower than A. These are documentary facts, not a statement that any supplier product meets them. No budget is present; none is invented. Payment percentages are 0% advance, 100% intermediate, 0% final; no payment-day period is inferred.

The document uses a vertical `Наименование | Значение` table. Production PDF text/table extraction succeeds without OCR. Initial actual GeminiProvider execution with the configured model made its normal two attempts but strict validation rejected the response: `ValueError: AI вернул данные без точного источника`. The wrapper returned its standard `AIError`, and those invalid results were not admitted as positive fixtures. Raw diagnostic responses stay under `/tmp`. The production parser was subsequently extended to recognize the actual vertical parameter/value table, strict evidence validation accepts original table-cell substrings, and the provider includes exact original item spans as source hints. Fabricated concatenations and ellipses remain rejected.

**Final live validation passed on 17 October 2026** with the configured Gemini model and unchanged original PDF. `sk-326759-1099036-taraz-paper-2019.json` contains the actual strictly validated model response: one office-paper item, quantity 100, unit `Одна пачка`, delivery 30 calendar days; four grounded requirements (A4, at least 80 g/m², 500 sheets, class no lower than A); and the exact Taraz delivery address as a grounded constraint. Buyer, procurement identifier and method agree with the original page. Budget, bid deadline, delivery date and payment days remain null. The original rendered page independently confirms the quantity, unit, location, delivery period, characteristics and payment percentages. This was a real network invocation of GeminiProvider, not a mocked provider response.

The manifest names the admitted extraction and records model, extraction timestamp and strict-validation outcome. An additional offline test reloads that recorded real response and revalidates all evidence against the original PDF before checking critical facts. The historical document supplies no current tender status, and this success does not imply a live procurement scan.

## Manyrak enamel: registry plan 86951799

[Official registry plan](https://old.goszakup.gov.kz/ru/registry/show_plan/86951799/4768271) links the [original scanned PDF](https://v3bl.goszakup.gov.kz/files/download_file/307077891/220063571/). The original is `data/public-tenders/goszakup-86951799-emal-2026.pdf` (one scanned page). This source is Manyrak, East Kazakhstan, **not Taraz**. The registry shows 26 conditional cans at 3,500 KZT, total 91,000 KZT; these registry facts are not silently merged into PDF extraction.

The host lacks Russian/Kazakh OCR language packs. The production parser correctly reports that this scan requires OCR. An offline test disables OCR explicitly and verifies the rejection irrespective of host language installation. There is no positive Gemini result for this scan and no claim that the application currently reads it on this host.

## Reproduce

From the repository root:

```text
.venv/bin/python scripts/verify_real_tender.py
.venv/bin/python -m pytest apps/api/tests/test_real_tender.py -q
```

The default verifier checks original bytes only and does not access the network or read credentials. `--live` explicitly loads the repository environment and invokes the existing GeminiProvider on the selected original PDF. It saves `<id>.json` only after strict validation succeeds and at least one product is returned. Failures remain failures; errors are credential-redacted. A saved successful extraction is a recorded model result, not a guarantee of future deterministic model output or live tender availability.

## Границы полноты извлечения

Gemini выделил четыре отдельных технических требования. Это не доказывает полноту: исходная ячейка содержит дополнительные характеристики. Валидатор добавляет отдельное требование ручной сверки полной технической спецификации с точной цитатой исходной ячейки. Неизвестное покрытие удерживает решение от автоматической готовности. Исходный сохранённый ответ модели не переписывается. При отсутствующем бюджете прибыль скрыта до явного задания цены в симуляторе.
