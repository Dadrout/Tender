from pathlib import Path
from sqlalchemy import delete
from .database import *
from .schemas import Tender, Product, Scenario
from .documents import extract_pdf, parse_tender
from .inventory import import_inventory
from .matching import match_tender
from .finance import calculate
from .risks import assess
from .ai import GeminiProvider


def get_products(s, cid):
    return [
        Product.model_validate({**p.data, "id": p.id})
        for p in s.query(InventoryProduct)
        .filter_by(catalog_id=cid)
        .order_by(InventoryProduct.id)
    ]


def save_lines(s, tender_id, tender):
    s.execute(delete(RequirementRecord).where(RequirementRecord.tender_id == tender_id))
    s.execute(delete(LineRecord).where(LineRecord.tender_id == tender_id))
    for i, item in enumerate(tender.items):
        line = LineRecord(
            tender_id=tender_id, position=i, data=item.model_dump(mode="json")
        )
        s.add(line)
        s.flush()
        for r in item.requirements:
            s.add(
                RequirementRecord(
                    tender_id=tender_id, line_id=line.id, data=r.model_dump(mode="json")
                )
            )
    for r in tender.constraints:
        s.add(RequirementRecord(tender_id=tender_id, data=r.model_dump(mode="json")))


def create_catalog(s, path, name, synthetic=False, mapping=None):
    products = import_inventory(Path(path), mapping)
    org = s.query(Organization).first()
    cat = Catalog(organization_id=org.id, name=name, synthetic=synthetic)
    s.add(cat)
    s.flush()
    for p in products:
        supplier = None
        if p.supplier:
            supplier = (
                s.query(Supplier)
                .filter_by(organization_id=org.id, name=p.supplier)
                .first()
            )
            if supplier is None:
                supplier = Supplier(organization_id=org.id, name=p.supplier)
                s.add(supplier)
                s.flush()
        s.add(
            InventoryProduct(
                catalog_id=cat.id,
                supplier_id=supplier.id if supplier else None,
                data=p.model_dump(mode="json", exclude={"id"}),
            )
        )
    s.flush()
    return cat


def analysis_data(s, t):
    scenario = s.query(FinancialScenario).filter_by(tender_id=t.id).one()
    doc = s.query(DocumentRecord).filter_by(tender_id=t.id).first()
    return {
        "id": t.id,
        "catalog_id": t.catalog_id,
        "state": t.state,
        "mode": t.mode,
        "synthetic": t.data.get("synthetic", t.synthetic),
        "demo_owned": t.synthetic,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
        "tender": t.data,
        "scenario": scenario.data,
        "sources": {"name": doc.name if doc else "", "pages": doc.pages if doc else []},
        **t.result,
    }


def run_analysis(s, t):
    tender = Tender.model_validate(t.data)
    scenario = s.query(FinancialScenario).filter_by(tender_id=t.id).one()
    scen = Scenario.model_validate(scenario.data)
    matches = match_tender(tender, get_products(s, t.catalog_id))
    financial = calculate(matches["cost_lines"], scen)
    risks, decision = assess(tender, matches, financial, scen)
    t.result = {
        "matches": matches,
        "financial": financial,
        "risks": risks,
        "decision": decision,
    }
    t.state = "completed"
    t.updated_at = now()
    for table in [MatchRecord, RiskRecord]:
        s.execute(delete(table).where(table.tender_id == t.id))
    for m in matches["matrix"]:
        s.add(MatchRecord(tender_id=t.id, product_id=m["product_id"], data=m))
    for r in risks:
        s.add(RiskRecord(tender_id=t.id, data=r))
    s.flush()
    return analysis_data(s, t)


def process_job(factory, jid):
    def stage(label, status="running", error=None):
        with factory.begin() as s:
            j = s.get(Job, jid)
            j.stage = label
            j.status = status
            j.error = error
            j.events = [*j.events, {"stage": label, "at": now()}]

    try:
        with factory() as s:
            source = dict(s.get(Job, jid).source)
        stage("pdf_extraction")
        pages = extract_pdf(Path(source["tender_path"]))
        stage("inventory_import")
        with factory.begin() as s:
            catalog = (
                s.get(Catalog, source.get("catalog_id"))
                if source.get("catalog_id")
                else None
            )
            if catalog is None:
                if not source.get("inventory_path"):
                    raise ValueError(
                        "Сохранённый каталог больше не доступен. Загрузите новый."
                    )
                catalog = create_catalog(
                    s,
                    source["inventory_path"],
                    source.get("inventory_name", "Каталог"),
                    source.get("demo", False),
                    source.get("mapping"),
                )
            source["catalog_id"] = catalog.id
            s.get(Job, jid).source = source
        # AI runs outside a DB write transaction.
        stage("requirements_extraction")
        tender = (
            GeminiProvider().extract(pages)
            if source["mode"] == "gemini"
            else parse_tender(pages)
        )
        with factory.begin() as s:
            j = s.get(Job, jid)
            catalog = s.get(Catalog, source["catalog_id"])
            if catalog is None:
                raise ValueError(
                    "Каталог удалён во время обработки. Повторите загрузку."
                )
            org = s.query(Organization).first()
            t = TenderRecord(
                organization_id=org.id,
                catalog_id=catalog.id,
                mode=source["mode"],
                synthetic=source.get("demo", False),
                data=tender.model_dump(mode="json"),
            )
            s.add(t)
            s.flush()
            s.add(
                DocumentRecord(
                    tender_id=t.id,
                    path=source["tender_path"],
                    name=source["tender_name"],
                    pages=pages,
                )
            )
            scenario = Scenario(
                offer_price=tender.budget or 0,
                delivery=5000 if source.get("demo") else 0,
                packaging=1000 if source.get("demo") else 0,
                payment_days=tender.payment_days or 30,
                delivery_days=min(tender.delivery_days or 5, 5),
            )
            s.add(
                FinancialScenario(tender_id=t.id, data=scenario.model_dump(mode="json"))
            )
            save_lines(s, t.id, tender)
            j.tender_id = t.id
        if source.get("demo"):
            stage("matching")
            with factory.begin() as s:
                run_analysis(s, s.get(TenderRecord, t.id))
            stage("completed", "completed")
        else:
            stage("review_ready", "review_ready")
    except Exception as exc:
        safe = (
            str(exc)[:700]
            if isinstance(exc, ValueError)
            else "Не удалось обработать документы. Проверьте файлы и повторите."
        )
        stage("failed", "failed", safe)
