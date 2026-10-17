"""Offline opportunity ranking using the same evidence, matching and money engines."""

import hashlib
import json
from pathlib import Path
from .schemas import Tender, Scenario
from .documents import extract_pdf, parse_tender
from .matching import match_tender
from .finance import calculate
from .risks import assess
from .database import TenderRecord, DocumentRecord


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def collect_sources(session, root):
    sources, warnings, seen = [], [], set()

    def add(source):
        key = (
            source["provenance"]["sha256"],
            json.dumps(
                source["tender"].model_dump(mode="json", exclude={"source"}),
                sort_keys=True,
                ensure_ascii=False,
            ),
        )
        if key not in seen:
            seen.add(key)
            sources.append(source)

    public = root / "data/public-tenders"
    manifest = public / "manifest.json"
    if manifest.exists():
        try:
            entries = json.loads(manifest.read_text())
            if isinstance(entries, dict):
                entries = entries.get("tenders", entries.get("documents", []))
            for entry in entries:
                filename = entry["filename"]
                extraction = entry.get("extraction_filename")
                if not extraction:
                    warnings.append(
                        f"{entry['id']}: документ сохранён, подтверждённое извлечение пока недоступно"
                    )
                    continue
                path = (public / filename).resolve()
                result = (public / extraction).resolve()
                if path.parent != public.resolve() or result.parent != public.resolve():
                    raise ValueError("Некорректный путь подборки")
                if digest(path) != entry["sha256"]:
                    raise ValueError("Контрольная сумма документа не совпадает")
                from .ai import validate_evidence

                pages = extract_pdf(path)
                tender = validate_evidence(
                    Tender.model_validate_json(result.read_text()), pages
                )
                provenance = {
                    **entry,
                    "data_type": "historical",
                    "historical": True,
                    "live": False,
                    "synthetic": False,
                    "extraction_mode": "gemini",
                }
                add(
                    dict(
                        id="public:" + entry["id"],
                        tender=tender,
                        path=path,
                        pages=pages,
                        mode="gemini",
                        provenance=provenance,
                    )
                )
        except (ValueError, KeyError, OSError, TypeError) as exc:
            warnings.append("Публичная подборка недоступна: " + str(exc)[:180])
    for slug in ["enamel", "brushes", "buckets"]:
        path = root / "demo" / f"tender-{slug}.pdf"
        pages = extract_pdf(path)
        add(
            dict(
                id="demo:" + slug,
                tender=parse_tender(pages),
                path=path,
                pages=pages,
                mode="deterministic",
                provenance={
                    "data_type": "synthetic",
                    "historical": False,
                    "live": False,
                    "synthetic": True,
                    "source_url": None,
                    "document_url": None,
                    "retrieved_at": None,
                    "registry_status": "synthetic",
                    "sha256": digest(path),
                    "extraction_mode": "deterministic",
                },
            )
        )
    records = (
        session.query(TenderRecord)
        .order_by(TenderRecord.updated_at.desc())
        .limit(100)
        .all()
    )
    if session.query(TenderRecord).count() > 100:
        warnings.append(
            "Включены последние 100 импортированных анализов и локальная подборка."
        )
    for record in records:
        doc = session.query(DocumentRecord).filter_by(tender_id=record.id).first()
        if not doc or not Path(doc.path).is_file():
            warnings.append(f"{record.id}: исходный PDF недоступен")
            continue
        tender = Tender.model_validate(record.data)
        # A radar import retains public provenance through its preserved job.
        from .database import Job

        job = session.query(Job).filter_by(tender_id=record.id).first()
        prior = (job.source.get("radar") if job else None) or {}
        add(
            dict(
                id="import:" + record.id,
                tender=tender,
                path=Path(doc.path),
                pages=doc.pages,
                mode=record.mode,
                provenance={
                    **prior,
                    "data_type": prior.get(
                        "data_type", "synthetic" if tender.synthetic else "imported"
                    ),
                    "historical": prior.get("historical", False),
                    "live": False,
                    "synthetic": tender.synthetic,
                    "sha256": digest(doc.path),
                    "extraction_mode": record.mode,
                },
            )
        )
    return sources, warnings


def default_scenario(tender):
    return Scenario(
        offer_price=tender.budget if tender.budget is not None else 0,
        payment_days=tender.payment_days if tender.payment_days is not None else 30,
        delivery_days=min(
            tender.delivery_days if tender.delivery_days is not None else 5, 5
        ),
    )


def preview(source, products):
    tender = source["tender"]
    scenario = default_scenario(tender)
    matches = match_tender(tender, products)
    selected = [m for m in matches["matrix"] if m["selected"]]
    matched = sum(row["product"] is not None for row in matches["selected"])
    conflicts = sum(m["status"] == "CONFLICT" and m["critical"] for m in selected)
    unknown = sum(m["status"] == "UNKNOWN" for m in selected)
    financial = calculate(matches["cost_lines"], scenario)
    reason = None
    if not tender.items or matched != len(tender.items):
        reason = "Не для всех позиций найдены товары каталога."
    elif tender.budget is None:
        reason = "Бюджет отсутствует: цену предложения необходимо задать вручную."
    elif conflicts:
        reason = "Есть критичные несовпадения: стоимость подходящего исполнения не подтверждена."
    elif not financial["complete"]:
        reason = "Количество, единицы или стоимость не подтверждены."
    if reason:
        financial = {
            **financial,
            "complete": False,
            "profit": None,
            "margin": None,
            "warnings": [*financial["warnings"], reason],
        }
    risks, decision = assess(tender, matches, financial, scenario)
    return {
        "source_id": source["id"],
        "title": tender.title,
        "identifier": tender.identifier,
        "region": tender.region or source["provenance"].get("location"),
        "budget": str(tender.budget) if tender.budget is not None else None,
        "deadline": tender.deadline,
        "provenance": source["provenance"],
        "matched_items": matched,
        "total_items": len(tender.items),
        "relevant": matched > 0,
        "critical_conflicts": conflicts,
        "unknown_requirements": unknown,
        "verified_requirements": matches["counts"]["VERIFIED_MATCH"],
        "decision": decision,
        "financial": financial,
        "estimate_unavailable_reason": reason,
        "scenario": scenario.model_dump(mode="json"),
        "estimate_basis": "budget_scenario_zero_extra_costs",
        "blockers": [r for r in risks if r["severity"] in ["critical", "high"]],
        "evidence": sorted(
            selected,
            key=lambda m: (
                {"CONFLICT": 0, "UNKNOWN": 1, "PARTIAL_MATCH": 2}.get(m["status"], 3)
            ),
        )[:6],
    }


def rank_sources(sources, products):
    rows = [preview(source, products) for source in sources]
    rows.sort(
        key=lambda r: (
            -r["matched_items"] / max(1, r["total_items"]),
            r["critical_conflicts"],
            r["unknown_requirements"],
            r["title"],
            r["source_id"],
        )
    )
    return {
        "opportunities": rows,
        "stats": {
            "evaluated": len(rows),
            "candidates": sum(r["relevant"] for r in rows),
            "historical": sum(
                r["provenance"]["data_type"] == "historical" for r in rows
            ),
            "synthetic": sum(r["provenance"]["data_type"] == "synthetic" for r in rows),
            "imported": sum(r["provenance"]["data_type"] == "imported" for r in rows),
        },
        "live": False,
    }
