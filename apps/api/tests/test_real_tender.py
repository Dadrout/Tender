"""Offline checks for original public procurement files; no model/network calls."""

import importlib.util
from pathlib import Path
import pytest
from qazbid.documents import DocumentError, extract_pdf

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location(
    "verify_real_tender", ROOT / "scripts/verify_real_tender.py"
)
verification = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verification)


def test_manifest_originals_are_intact_and_explicitly_historical():
    entries = verification.verify_manifest(ROOT / "data/public-tenders/manifest.json")
    assert len(entries) >= 2
    assert all(entry["live"] is False for entry in entries)
    assert all(entry["synthetic"] is False for entry in entries)


def test_hash_validation_rejects_changed_original(tmp_path):
    import json

    pdf = tmp_path / "changed.pdf"
    pdf.write_bytes(b"%PDF-changed")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps([{"filename": pdf.name, "sha256": "0" * 64}]))
    with pytest.raises(ValueError, match="SHA256"):
        verification.verify_manifest(manifest)


def test_authentic_taraz_spec_retains_vertical_table_evidence():
    pages = extract_pdf(
        ROOT / "data/public-tenders/sk-326759-1099036-taraz-paper-2019.pdf"
    )
    assert len(pages) == 1 and pages[0]["ocr"] is False
    cells = dict(pages[0]["tables"][0][1:])
    assert cells["Количество"] == "100.000"
    assert cells["Единица\nизмерения"] == "Одна пачка"
    assert "Тараз" in cells["Место поставки"]
    assert "30 календарных дней" in cells["Срок поставки"]
    assert "28.08.2019" in pages[0]["text"]


def test_authentic_scanned_spec_requires_ocr_when_disabled():
    with pytest.raises(DocumentError, match="OCR"):
        extract_pdf(
            ROOT / "data/public-tenders/goszakup-86951799-emal-2026.pdf",
            allow_ocr=False,
        )


def test_recorded_actual_gemini_response_revalidates_against_original():
    from decimal import Decimal
    from qazbid.ai import validate_evidence
    from qazbid.schemas import Tender
    import json

    entry = next(
        e
        for e in verification.verify_manifest(
            ROOT / "data/public-tenders/manifest.json"
        )
        if e["id"] == "sk-326759-1099036-taraz-paper-2019"
    )
    tender = Tender.model_validate(
        json.loads(
            (ROOT / "data/public-tenders" / entry["extraction_filename"]).read_text()
        )
    )
    pages = extract_pdf(ROOT / "data/public-tenders" / entry["filename"])
    validated = validate_evidence(tender, pages)
    assert len(validated.items) == 1
    assert validated.items[0].name == "Бумага для офисного оборудования"
    assert validated.items[0].quantity == Decimal("100")
    assert validated.items[0].unit == "Одна пачка"
    assert validated.items[0].origin == "ai"
    assert validated.delivery_days == 30
    assert validated.budget is None and validated.deadline is None
    assert validated.payment_days is None and validated.synthetic is False
    assert any("Тараз" in condition.value for condition in validated.constraints)
