from decimal import Decimal
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[3]


def test_unit_equivalence():
    from qazbid.matching import normalize_measure, compare_value

    assert normalize_measure("3500 мл") == normalize_measure("3,5 л")
    assert compare_value("3.5 л", "3500 мл") == "VERIFIED_MATCH"
    assert compare_value("3.5 л", "2.5 л") == "CONFLICT"
    assert compare_value("Сертификат соответствия", None) == "UNKNOWN"


def test_decimal_finance_accounts_for_stock_and_missing_units():
    from qazbid.finance import calculate
    from qazbid.schemas import Scenario

    lines = [
        dict(
            name="Эмаль",
            quantity="12",
            available="8",
            acquisition_cost="4000",
            supplier_cost="4500",
            supplier_confirmed=True,
        )
    ]
    r = calculate(
        lines,
        Scenario(
            offer_price="90000",
            delivery="5000",
            tax_rate="3",
            target_margin="20",
            cash_available="10000",
        ),
    )
    assert r["inventory_cost"] == "32000.00"
    assert r["purchase_cost"] == "18000.00"
    assert r["total_cost"] == "57700.00"
    assert r["profit"] == "32300.00"
    assert r["incremental_cash"] == "25700.00"
    assert r["missing_units"] == "4"
    assert Decimal(r["target_price"]) == Decimal("71428.57")


def test_unknown_replenishment_never_fabricates_profit():
    from qazbid.finance import calculate
    from qazbid.schemas import Scenario

    r = calculate(
        [
            dict(
                name="A",
                quantity="12",
                available="8",
                acquisition_cost="2",
                supplier_cost=None,
                supplier_confirmed=False,
            )
        ],
        Scenario(offer_price="90"),
    )
    assert r["profit"] is None and r["total_cost"] is None
    assert r["complete"] is False
    assert r["warnings"]


def test_negative_profit_and_financing():
    from qazbid.finance import calculate
    from qazbid.schemas import Scenario

    r = calculate(
        [
            dict(
                name="A",
                quantity="10",
                available="0",
                acquisition_cost=None,
                supplier_cost="100",
                supplier_confirmed=True,
            )
        ],
        Scenario(offer_price="800", annual_financing_rate="36.5", payment_days=30),
    )
    assert Decimal(r["financing_cost"]) == Decimal("30")
    assert Decimal(r["profit"]) == Decimal("-230")
    assert r["warnings"]


def test_invalid_financial_assumptions():
    from qazbid.schemas import Scenario
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        Scenario(offer_price="-1")
    with pytest.raises(ValidationError):
        Scenario(tax_rate="80", target_margin="30")
    with pytest.raises(ValidationError):
        Scenario(offer_price="NaN")


def test_actual_pdf_and_workbook_extraction():
    from qazbid.documents import extract_pdf, parse_tender
    from qazbid.inventory import import_inventory

    pages = extract_pdf(ROOT / "demo/tender-enamel.pdf")
    tender = parse_tender(pages)
    assert tender.synthetic is True
    assert tender.budget == Decimal("90000")
    assert tender.items[0].quantity == Decimal("12")
    assert any(
        r.key == "volume" and r.value == "3.5 л" and r.page == 1
        for r in tender.items[0].requirements
    )
    products = import_inventory(ROOT / "demo/inventory.xlsx")
    assert len(products) >= 15
    assert products[0].quantity == Decimal("8")
    assert products[0].raw["Наименование"]


def test_matching_has_verified_conflict_and_missing_evidence():
    from qazbid.documents import extract_pdf, parse_tender
    from qazbid.inventory import import_inventory
    from qazbid.matching import match_tender

    tender = parse_tender(extract_pdf(ROOT / "demo/tender-enamel.pdf"))
    result = match_tender(tender, import_inventory(ROOT / "demo/inventory.xlsx"))
    statuses = {m["status"] for m in result["matrix"]}
    assert {"VERIFIED_MATCH", "CONFLICT", "UNKNOWN", "PARTIAL_MATCH"} <= statuses
    assert result["selected"][0]["missing"] == "4"
    assert result["selected"][0]["product"]["sku"] == "EN-35-Y"


def test_risks_block_unknown_compliance():
    from qazbid.documents import extract_pdf, parse_tender
    from qazbid.inventory import import_inventory
    from qazbid.matching import match_tender
    from qazbid.finance import calculate
    from qazbid.risks import assess
    from qazbid.schemas import Scenario

    tender = parse_tender(extract_pdf(ROOT / "demo/tender-enamel.pdf"))
    match = match_tender(tender, import_inventory(ROOT / "demo/inventory.xlsx"))
    finance = calculate(match["cost_lines"], Scenario(offer_price="90000"))
    risks, decision = assess(tender, match, finance, Scenario(offer_price="90000"))
    assert decision != "READY_FOR_REVIEW"
    assert any(r["group"] == "documentation" and r["page"] == 2 for r in risks)
    assert any(r["group"] == "inventory" for r in risks)


def test_report_has_cyrillic_and_sources(tmp_path):
    from qazbid.documents import extract_pdf, parse_tender
    from qazbid.inventory import import_inventory
    from qazbid.matching import match_tender
    from qazbid.finance import calculate
    from qazbid.risks import assess
    from qazbid.schemas import Scenario
    from qazbid.reports import generate_pdf
    import fitz

    tender = parse_tender(extract_pdf(ROOT / "demo/tender-enamel.pdf"))
    scenario = Scenario(offer_price="90000")
    matches = match_tender(tender, import_inventory(ROOT / "demo/inventory.xlsx"))
    finance = calculate(matches["cost_lines"], scenario)
    risks, decision = assess(tender, matches, finance, scenario)
    data = dict(
        id="test",
        tender=tender.model_dump(mode="json"),
        matches=matches,
        financial=finance,
        scenario=scenario.model_dump(mode="json"),
        risks=risks,
        decision=decision,
        mode="deterministic",
        created_at="2026-10-14T12:00:00Z",
    )
    path = tmp_path / "report.pdf"
    generate_pdf(data, path, "ru")
    doc = fitz.open(path)
    text = "\n".join(p.get_text() for p in doc)
    assert "Эмаль" in text and "90000" in text.replace(" ", "")
    assert len(doc) >= 3


def test_scanned_pdf_reports_ocr_need(tmp_path):
    import fitz
    from qazbid.documents import extract_pdf, DocumentError

    p = tmp_path / "blank.pdf"
    doc = fitz.open()
    doc.new_page()
    doc.save(p)
    with pytest.raises(DocumentError):
        extract_pdf(p, allow_ocr=False)


def test_incompatible_quantity_units_never_verify_stock():
    from qazbid.schemas import Tender, LineItem, Product, Requirement, Scenario
    from qazbid.matching import match_tender
    from qazbid.finance import calculate
    from qazbid.risks import assess

    tender = Tender(
        items=[
            LineItem(
                name="Краска",
                quantity="10",
                unit="л",
                evidence="Количество: 10 л",
                requirements=[
                    Requirement(
                        key="color",
                        label="Цвет",
                        value="Белый",
                        page=1,
                        evidence="Цвет: Белый",
                    )
                ],
            )
        ],
        delivery_days=5,
        payment_days=30,
        payment_evidence="Оплата через 30 дней",
    )
    product = Product(
        name="Краска",
        quantity="10",
        unit="мл",
        attributes={"color": "Белый"},
        acquisition_cost="1",
        supplier_cost="1",
    )
    matches = match_tender(tender, [product])
    assert not any(
        m["status"] == "VERIFIED_MATCH" and m["property"] == "Количество"
        for m in matches["matrix"]
    )
    assert matches["cost_lines"][0]["quantity"] is None
    f = calculate(matches["cost_lines"], Scenario(offer_price="100"))
    assert f["profit"] is None
    _, decision = assess(tender, matches, f, Scenario(offer_price="100"))
    assert decision != "READY_FOR_REVIEW"


def test_multi_page_tables_all_extracted():
    from qazbid.documents import parse_tender

    pages = [
        {
            "page": 1,
            "text": "Техническая спецификация закупки",
            "tables": [
                [["Наименование", "Количество", "Единица"], ["Ведро", "10", "шт"]]
            ],
        },
        {
            "page": 2,
            "text": "Продолжение технической спецификации",
            "tables": [
                [["Наименование", "Количество", "Единица"], ["Кисть", "20", "шт"]]
            ],
        },
    ]
    tender = parse_tender(pages)
    assert [i.name for i in tender.items] == ["Ведро", "Кисть"]
    assert [i.page for i in tender.items] == [1, 2]


def test_allocated_stock_not_double_counted_in_matrix():
    from qazbid.schemas import Tender, LineItem, Product
    from qazbid.matching import match_tender

    tender = Tender(
        items=[
            LineItem(name="Ведро", quantity="8"),
            LineItem(name="Ведро", quantity="8"),
        ]
    )
    result = match_tender(
        tender,
        [Product(name="Ведро", quantity="10", acquisition_cost="1", supplier_cost="2")],
    )
    quantity_rows = [
        m for m in result["matrix"] if m["property"] == "Количество" and m["selected"]
    ]
    assert quantity_rows[1]["status"] == "PARTIAL_MATCH"
    assert quantity_rows[1]["actual"] == "2"


def test_category_mismatch_excludes_candidate():
    from qazbid.schemas import Tender, LineItem, Product, Requirement
    from qazbid.matching import match_tender

    t = Tender(
        items=[
            LineItem(
                name="Краска белая",
                quantity="10",
                requirements=[
                    Requirement(
                        key="color",
                        label="Цвет",
                        value="Белый",
                        page=1,
                        evidence="Цвет: Белый",
                    )
                ],
            )
        ]
    )
    p = Product(
        name="Лампа белая",
        quantity="10",
        attributes={"color": "Белый"},
        acquisition_cost="1",
    )
    m = match_tender(t, [p])
    assert m["selected"][0]["product"] is None
    assert all(r["status"] != "VERIFIED_MATCH" for r in m["matrix"])


def test_scenario_dozakupka_changes_execution_risks():
    from qazbid.schemas import Tender, LineItem, Product, Scenario, Requirement
    from qazbid.matching import match_tender
    from qazbid.finance import calculate
    from qazbid.risks import assess

    tender = Tender(
        items=[
            LineItem(
                name="Ведро",
                quantity="10",
                requirements=[
                    Requirement(
                        key="color",
                        label="Цвет",
                        value="Белый",
                        page=1,
                        evidence="Цвет: Белый",
                    )
                ],
            )
        ],
        delivery_days=5,
        payment_days=30,
        payment_evidence="Оплата: в течение 30 дней",
    )
    product = Product(
        name="Ведро",
        quantity="10",
        acquisition_cost="1",
        supplier_cost="1",
        lead_days=2,
        attributes={"color": "Белый"},
    )
    scenario = Scenario(offer_price="100", line_overrides={"0": {"quantity": "20"}})
    m = match_tender(tender, [product])
    f = calculate(m["cost_lines"], scenario)
    risks, decision = assess(tender, m, f, scenario)
    assert f["missing_units"] == "10"
    assert any(r["group"] == "inventory" for r in risks)
    assert decision != "READY_FOR_REVIEW"


def test_repeated_table_names_with_different_quantities_are_preserved():
    from qazbid.documents import parse_tender

    t = parse_tender(
        [
            {
                "page": 1,
                "text": "Техническая спецификация",
                "tables": [
                    [
                        ["Наименование", "Количество", "Единица"],
                        ["Ведро", "10", "шт"],
                        ["Ведро", "20", "шт"],
                    ]
                ],
            }
        ]
    )
    assert [str(i.quantity) for i in t.items] == ["10", "20"]


def test_unverified_contract_constraints_cannot_make_positive_decision():
    from qazbid.schemas import Tender, LineItem, Product, Scenario, Requirement
    from qazbid.matching import match_tender
    from qazbid.finance import calculate
    from qazbid.risks import assess

    t = Tender(
        items=[
            LineItem(
                name="Ведро",
                quantity="1",
                requirements=[
                    Requirement(
                        key="color",
                        label="Цвет",
                        value="Белый",
                        page=1,
                        evidence="Цвет: Белый",
                    )
                ],
            )
        ],
        constraints=[
            Requirement(
                key="condition",
                label="Условие",
                value="Требуется оригинальная упаковка",
                page=1,
                evidence="Требуется оригинальная упаковка",
            )
        ],
        delivery_days=5,
        payment_evidence="Оплата через 30 дней",
    )
    m = match_tender(
        t,
        [
            Product(
                name="Ведро",
                quantity="1",
                acquisition_cost="1",
                attributes={"color": "Белый"},
            )
        ],
    )
    s = Scenario(offer_price="10")
    f = calculate(m["cost_lines"], s)
    _, decision = assess(t, m, f, s)
    assert decision != "READY_FOR_REVIEW"
