import os, json, io, csv, shutil
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Literal
from uuid import uuid4
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    BackgroundTasks,
    HTTPException,
    Request,
)
from fastapi.responses import FileResponse, JSONResponse, Response
from sqlalchemy import delete
from .database import *
from .service import *
from .schemas import Tender, Scenario, Product
from .inventory import read_frame, suggest_mapping
from .reports import generate_pdf

ROOT = Path(__file__).resolve().parents[3]
MAX_SIZE = 15 * 1024 * 1024


def safe_cell(value):
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def create_app(storage: Path | None = None):
    root = storage or Path(os.getenv("QAZBID_DATA_DIR", str(ROOT / "runtime")))
    files = root / "files"
    files.mkdir(parents=True, exist_ok=True)
    factory = database(root)
    app = FastAPI(
        title="QazBid AI",
        version="0.1.0",
        description="Local evidence-based tender analysis. No live procurement connection.",
    )
    app.state.factory = factory

    @app.middleware("http")
    async def upload_limit(request: Request, call_next):
        if request.method in ["POST", "PUT", "PATCH", "DELETE"] and request.headers.get(
            "origin"
        ):
            web_port = os.getenv("QAZBID_WEB_PORT", "3000")
            api_port = os.getenv("QAZBID_API_PORT", "8000")
            allowed = set(
                os.getenv(
                    "QAZBID_ALLOWED_ORIGINS",
                    f"http://127.0.0.1:{web_port},http://localhost:{web_port},http://127.0.0.1:{api_port},http://localhost:{api_port}",
                ).split(",")
            )
            if request.headers["origin"] not in allowed:
                return JSONResponse(
                    {"detail": "Изменения разрешены только из локального приложения"},
                    status_code=403,
                )
        length = request.headers.get("content-length")
        if length and (not length.isdigit() or int(length) > MAX_SIZE * 2 + 100000):
            return JSONResponse(
                {"detail": "Лимит загрузки: 15 МБ на файл"}, status_code=413
            )
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(ValueError)
    async def value_error(request, exc):
        return JSONResponse({"detail": str(exc)[:700]}, status_code=422)

    def fetch(s, table, key):
        result = s.get(table, key)
        if not result:
            raise HTTPException(404, "Запись не найдена")
        return result

    async def store(file: UploadFile, allowed: set):
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in allowed:
            raise HTTPException(422, "Недопустимый формат файла")
        data = await file.read(MAX_SIZE + 1)
        if len(data) > MAX_SIZE:
            raise HTTPException(413, "Лимит файла: 15 МБ")
        if not data:
            raise HTTPException(422, "Файл пуст")
        if suffix == ".pdf" and not data.startswith(b"%PDF"):
            raise HTTPException(422, "Файл не является PDF")
        if suffix == ".xlsx" and not data.startswith(b"PK"):
            raise HTTPException(422, "Файл не является XLSX")
        if suffix == ".xls" and not data.startswith(bytes.fromhex("d0cf11e0")):
            raise HTTPException(422, "Файл не является XLS")
        target = files / (str(uuid4()) + suffix)
        target.write_bytes(data)
        return target

    def job_json(j):
        return {
            "id": j.id,
            "status": j.status,
            "stage": j.stage,
            "events": j.events,
            "error": j.error,
            "analysis_id": j.tender_id,
            "created_at": j.created_at,
            "mode": j.source["mode"],
        }

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "gemini_available": bool(os.getenv("GEMINI_API_KEY")),
            "mode": "local",
            "live_sources": False,
        }

    @app.get("/organizations")
    def orgs():
        with factory() as s:
            return [{"id": o.id, "name": o.name} for o in s.query(Organization)]

    @app.post("/jobs", status_code=202)
    async def upload(
        background: BackgroundTasks,
        tender: UploadFile = File(...),
        inventory: UploadFile | None = File(None),
        catalog_id: str | None = Form(None),
        mode: Literal["deterministic", "gemini"] = Form("deterministic"),
        mapping: str | None = Form(None),
    ):
        if mode == "gemini" and not os.getenv("GEMINI_API_KEY"):
            raise HTTPException(
                422, "Gemini не настроен. Выберите локальную обработку."
            )
        with factory() as s:
            if catalog_id:
                fetch(s, Catalog, catalog_id)
            elif not inventory:
                raise HTTPException(422, "Загрузите каталог или выберите сохранённый")
            if s.query(Job).filter(Job.status.in_(["queued", "running"])).count() >= 4:
                raise HTTPException(
                    429,
                    "Обрабатывается слишком много документов. Дождитесь завершения.",
                )
        paths = []
        try:
            tp = await store(tender, {".pdf"})
            paths.append(tp)
            ip = (
                await store(inventory, {".xlsx", ".xls", ".csv"})
                if inventory and not catalog_id
                else None
            )
            if ip:
                paths.append(ip)
            custom = json.loads(mapping) if mapping else None
            if custom is not None and (
                not isinstance(custom, dict)
                or any(not isinstance(v, str) for v in custom.values())
            ):
                raise ValueError("Некорректное сопоставление столбцов")
            with factory.begin() as s:
                j = Job(
                    source={
                        "tender_path": str(tp),
                        "tender_name": Path(tender.filename or "Tender.pdf").name,
                        "inventory_path": str(ip) if ip else None,
                        "inventory_name": (
                            Path(inventory.filename or "Каталог").name
                            if inventory
                            else ""
                        ),
                        "catalog_id": catalog_id,
                        "mode": mode,
                        "mapping": custom,
                    }
                )
                s.add(j)
                s.flush()
                result = job_json(j)
        except Exception:
            for p in paths:
                p.unlink(missing_ok=True)
            raise
        background.add_task(process_job, factory, j.id)
        return result

    @app.get("/jobs/{jid}")
    def job(jid: str):
        with factory() as s:
            return job_json(fetch(s, Job, jid))

    @app.post("/jobs/{jid}/retry", status_code=202)
    def retry(
        jid: str,
        background: BackgroundTasks,
        mode: Literal["deterministic", "gemini"] = "deterministic",
    ):
        if mode == "gemini" and not os.getenv("GEMINI_API_KEY"):
            raise HTTPException(422, "Gemini не настроен")
        with factory.begin() as s:
            j = fetch(s, Job, jid)
            if j.status != "failed":
                raise HTTPException(409, "Повтор доступен только после ошибки")
            j.source = {**j.source, "mode": mode}
            j.status = "queued"
            j.error = None
            result = job_json(j)
        background.add_task(process_job, factory, jid)
        return result

    @app.get("/analyses")
    def analyses():
        with factory() as s:
            return [
                analysis_data(s, t)
                for t in s.query(TenderRecord).order_by(TenderRecord.created_at.desc())
            ]

    @app.get("/analyses/{aid}")
    def analysis(aid: str):
        with factory() as s:
            return analysis_data(s, fetch(s, TenderRecord, aid))

    @app.post("/analyses/{aid}/run")
    def run(aid: str):
        with factory.begin() as s:
            return run_analysis(s, fetch(s, TenderRecord, aid))

    @app.put("/analyses/{aid}/tender")
    def correct(aid: str, tender: Tender):
        with factory.begin() as s:
            t = fetch(s, TenderRecord, aid)
            before = t.data
            doc = s.query(DocumentRecord).filter_by(tender_id=aid).one()
            maxpage = len(doc.pages)
            for item in tender.items:
                if item.page > maxpage or any(
                    r.page > maxpage for r in item.requirements
                ):
                    raise HTTPException(422, "Указана отсутствующая страница источника")
            # All changes are auditable manual assertions; never fabricate original evidence.
            for i, item in enumerate(tender.items):
                old = t.data.get("items", [])
                if i >= len(old) or item.model_dump(mode="json") != old[i]:
                    item.origin = "manual"
                if i < len(old):
                    item.evidence = old[i]["evidence"]
                for r in item.requirements:
                    prior = (
                        next(
                            (x for x in old[i]["requirements"] if x["key"] == r.key),
                            None,
                        )
                        if i < len(old)
                        else None
                    )
                    if not prior or prior != r.model_dump(mode="json"):
                        r.origin = "manual"
                        r.confidence = 0
                    if prior:
                        r.evidence = prior["evidence"]
                        r.page = prior["page"]
            t.data = tender.model_dump(mode="json")
            s.add(Correction(tender_id=aid, before=before, after=t.data))
            save_lines(s, aid, tender)
            if t.state == "completed":
                return run_analysis(s, t)
            t.updated_at = now()
            return analysis_data(s, t)

    @app.get("/analyses/{aid}/corrections")
    def corrections(aid: str):
        with factory() as s:
            fetch(s, TenderRecord, aid)
            return [
                {
                    "id": c.id,
                    "created_at": c.created_at,
                    "before": c.before,
                    "after": c.after,
                }
                for c in s.query(Correction).filter_by(tender_id=aid)
            ]

    @app.put("/analyses/{aid}/scenario")
    def scenario(aid: str, scenario: Scenario):
        with factory.begin() as s:
            t = fetch(s, TenderRecord, aid)
            row = s.query(FinancialScenario).filter_by(tender_id=aid).one()
            row.data = scenario.model_dump(mode="json")
            row.updated_at = now()
            return run_analysis(s, t)

    @app.get("/analyses/{aid}/source")
    def source(aid: str):
        with factory() as s:
            fetch(s, TenderRecord, aid)
            doc = s.query(DocumentRecord).filter_by(tender_id=aid).one()
            return FileResponse(
                doc.path,
                media_type="application/pdf",
                headers={"Content-Disposition": 'inline; filename="source.pdf"'},
            )

    @app.get("/catalogs")
    def catalogs():
        with factory() as s:
            return [
                {
                    "id": c.id,
                    "name": c.name,
                    "synthetic": c.synthetic,
                    "created_at": c.created_at,
                    "count": s.query(InventoryProduct)
                    .filter_by(catalog_id=c.id)
                    .count(),
                }
                for c in s.query(Catalog).order_by(Catalog.created_at.desc())
            ]

    @app.post("/catalogs/preview")
    async def preview(file: UploadFile = File(...)):
        p = await store(file, {".xlsx", ".xls", ".csv"})
        try:
            df = read_frame(p)
            return {
                "headers": list(df.columns),
                "mapping": suggest_mapping(list(df.columns)),
                "rows": df.head(5).to_dict("records"),
            }
        finally:
            p.unlink(missing_ok=True)

    @app.post("/catalogs")
    async def import_catalog(
        file: UploadFile = File(...), mapping: str | None = Form(None)
    ):
        p = await store(file, {".xlsx", ".xls", ".csv"})
        try:
            custom = json.loads(mapping) if mapping else None
            with factory.begin() as s:
                c = create_catalog(
                    s, p, Path(file.filename or "Каталог").name, mapping=custom
                )
                return {
                    "id": c.id,
                    "name": c.name,
                    "count": s.query(InventoryProduct)
                    .filter_by(catalog_id=c.id)
                    .count(),
                }
        finally:
            p.unlink(missing_ok=True)

    @app.get("/catalogs/{cid}")
    def catalog(cid: str):
        with factory() as s:
            c = fetch(s, Catalog, cid)
            return {
                "id": c.id,
                "name": c.name,
                "products": [p.model_dump(mode="json") for p in get_products(s, cid)],
            }

    @app.put("/catalogs/{cid}/products/{pid}")
    def update_product(cid: str, pid: int, product: Product):
        with factory.begin() as s:
            p = fetch(s, InventoryProduct, pid)
            if p.catalog_id != cid:
                raise HTTPException(404, "Товар отсутствует в каталоге")
            original = Product.model_validate({**p.data, "id": p.id})
            changed = [
                key
                for key in [
                    "name",
                    "sku",
                    "quantity",
                    "unit",
                    "acquisition_cost",
                    "supplier_cost",
                    "supplier",
                    "supplier_confirmed",
                    "lead_days",
                    "attributes",
                ]
                if getattr(product, key) != getattr(original, key)
            ]
            product.raw = original.raw
            product.row = original.row
            product.manual_fields = sorted(set(original.manual_fields + changed))
            product.edited_at = now() if changed else original.edited_at
            if product.supplier:
                org = s.query(Organization).first()
                supplier = (
                    s.query(Supplier)
                    .filter_by(organization_id=org.id, name=product.supplier)
                    .first()
                )
                if supplier is None:
                    supplier = Supplier(organization_id=org.id, name=product.supplier)
                    s.add(supplier)
                    s.flush()
                p.supplier_id = supplier.id
            else:
                p.supplier_id = None
            p.data = product.model_dump(mode="json", exclude={"id"})
            # Invalidate and recompute all completed analyses using the shared catalog.
            for t in s.query(TenderRecord).filter_by(catalog_id=cid, state="completed"):
                run_analysis(s, t)
            return product.model_dump(mode="json")

    @app.post("/demo/{slug}", status_code=202)
    def demo(slug: str, background: BackgroundTasks):
        if slug not in ["enamel", "brushes", "buckets"]:
            raise HTTPException(404, "Демо не найдено")
        src = ROOT / "demo" / f"tender-{slug}.pdf"
        tp = files / (str(uuid4()) + ".pdf")
        shutil.copyfile(src, tp)
        with factory.begin() as s:
            c = s.query(Catalog).filter_by(synthetic=True).first()
            j = Job(
                source={
                    "tender_path": str(tp),
                    "tender_name": src.name,
                    "catalog_id": c.id if c else None,
                    "inventory_path": str(ROOT / "demo/inventory.xlsx"),
                    "inventory_name": "Демо · магазин в Таразе",
                    "mode": "deterministic",
                    "demo": True,
                }
            )
            s.add(j)
            s.flush()
            result = job_json(j)
        background.add_task(process_job, factory, j.id)
        return result

    @app.delete("/demo")
    def reset_demo():
        deleted_files = []
        with factory.begin() as s:
            demo_tenders = s.query(TenderRecord).filter_by(synthetic=True).all()
            for t in demo_tenders:
                deleted_files.extend(
                    d.path for d in s.query(DocumentRecord).filter_by(tender_id=t.id)
                )
                deleted_files.extend(
                    r.path for r in s.query(ReportRecord).filter_by(tender_id=t.id)
                )
                s.delete(t)
            # Imported records reusing demo catalogs retain their references.
            s.flush()
            for c in s.query(Catalog).filter_by(synthetic=True):
                if not s.query(TenderRecord).filter_by(catalog_id=c.id).first():
                    s.delete(c)
        for p in deleted_files:
            Path(p).unlink(missing_ok=True)
        return {"deleted": len(demo_tenders)}

    @app.get("/demo/files/{name}")
    def demo_file(name: str):
        if name not in [
            "tender-enamel.pdf",
            "tender-brushes.pdf",
            "tender-buckets.pdf",
            "inventory.xlsx",
        ]:
            raise HTTPException(404, "Файл не найден")
        return FileResponse(ROOT / "demo" / name, filename=name)

    @app.get("/discovery")
    def discovery():
        result = []
        for slug in ["enamel", "brushes", "buckets"]:
            t = parse_tender(extract_pdf(ROOT / "demo" / f"tender-{slug}.pdf"))
            result.append(
                {
                    "id": slug,
                    "data_type": "synthetic",
                    "live": False,
                    **t.model_dump(mode="json"),
                }
            )
        with factory() as s:
            for t in s.query(TenderRecord):
                result.append(
                    {
                        "id": t.id,
                        "data_type": "synthetic" if t.synthetic else "imported",
                        "live": False,
                        **t.data,
                    }
                )
        return result

    @app.get("/analyses/{aid}/report")
    def report(aid: str, lang: Literal["ru", "kk"] = "ru"):
        with factory.begin() as s:
            t = fetch(s, TenderRecord, aid)
            if t.state != "completed":
                raise HTTPException(409, "Сначала завершите анализ")
            data = analysis_data(s, t)
            path = files / (str(uuid4()) + ".pdf")
            generate_pdf(data, path, lang)
            s.add(ReportRecord(tender_id=aid, path=str(path), lang=lang))
        return FileResponse(
            path, media_type="application/pdf", filename=f"QazBid-{aid[:8]}-{lang}.pdf"
        )

    def matrix_rows(s, aid):
        t = fetch(s, TenderRecord, aid)
        if t.state != "completed":
            raise HTTPException(409, "Сначала завершите анализ")
        return [
            {
                k: m.get(k)
                for k in [
                    "item",
                    "property",
                    "required",
                    "actual",
                    "status",
                    "product_name",
                    "row",
                    "page",
                    "selected",
                    "origin",
                    "explanation",
                    "requirement",
                ]
            }
            for m in t.result["matches"]["matrix"]
        ]

    @app.get("/analyses/{aid}/matrix.csv")
    def matrix_csv(aid: str):
        with factory() as s:
            rows = matrix_rows(s, aid)
        output = io.StringIO()
        w = csv.DictWriter(output, fieldnames=list(rows[0]) if rows else ["item"])
        w.writeheader()
        w.writerows([{k: safe_cell(v) for k, v in row.items()} for row in rows])
        return Response(
            "\ufeff" + output.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="requirements.csv"'},
        )

    @app.get("/analyses/{aid}/matrix.xlsx")
    def matrix_xlsx(aid: str):
        from openpyxl import Workbook

        with factory() as s:
            rows = matrix_rows(s, aid)
        wb = Workbook()
        ws = wb.active
        ws.title = "Матрица"
        ws.append(list(rows[0]) if rows else ["item"])
        for row in rows:
            ws.append([safe_cell(v) for v in row.values()])
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
        b = io.BytesIO()
        wb.save(b)
        return Response(
            b.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="requirements.xlsx"'},
        )

    @app.get("/analyses/{aid}/financial.csv")
    def financial_csv(aid: str):
        with factory() as s:
            t = fetch(s, TenderRecord, aid)
            if t.state != "completed":
                raise HTTPException(409, "Сначала завершите анализ")
            f = t.result["financial"]
        output = io.StringIO()
        w = csv.writer(output)
        w.writerow(["Показатель", "Значение KZT"])
        for k, v in f.items():
            if k not in ["lines", "warnings", "cash_flow", "formula"]:
                w.writerow([k, v])
        return Response(
            "\ufeff" + output.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="financial.csv"'},
        )

    return app


app = create_app()
