from pathlib import Path
import pytest
from qazbid.documents import extract_pdf, parse_tender
from qazbid.ai import validate_evidence
from qazbid.schemas import Tender, LineItem, Requirement

ROOT = Path(__file__).resolve().parents[3]


def pages():
    return extract_pdf(
        ROOT / "data/public-tenders/sk-326759-1099036-taraz-paper-2019.pdf"
    )


def test_real_vertical_spec_is_one_product_not_a_product_per_field_label():
    t = parse_tender(pages())
    assert len(t.items) == 1
    assert t.items[0].name == "Бумага для офисного оборудования"
    assert t.items[0].quantity == 100
    assert t.items[0].unit == "Одна пачка"
    assert t.delivery_days == 30
    assert t.budget is None


def test_vertical_quantity_is_grounded_by_its_label_and_source_cell_not_another_number():
    ps = pages()
    text = ps[0]["text"]
    start = text.index("Бумага для офисного оборудования")
    end = text.index("100.000") + len("100.000")
    t = Tender(
        items=[
            LineItem(
                name="Бумага для офисного оборудования",
                quantity=100,
                unit="Одна пачка",
                page=1,
                evidence=text[start:end],
            )
        ]
    )
    assert validate_evidence(t, ps).items[0].quantity == 100
    t.items[0].quantity = 500
    with pytest.raises(ValueError, match="Количество"):
        validate_evidence(t, ps)


def test_exact_extracted_table_cell_is_valid_evidence_but_ellipsis_is_not():
    ps = pages()
    text = ps[0]["text"]
    start = text.index("Бумага для офисного оборудования")
    end = text.index("100.000") + len("100.000")
    t = Tender(
        items=[
            LineItem(
                name="Бумага для офисного оборудования",
                quantity=100,
                unit="Одна пачка",
                page=1,
                evidence=text[start:end],
                requirements=[
                    Requirement(
                        key="density",
                        label="Плотность",
                        value="не менее 80 г/м2",
                        page=1,
                        evidence="плотность: плотность не\nменее 80 г/м2",
                    )
                ],
            )
        ]
    )
    assert validate_evidence(t, ps).items[0].requirements
    t.items[0].evidence = "Бумага для офисного оборудования ... Количество 100.000"
    with pytest.raises(ValueError, match="точного источника"):
        validate_evidence(t, ps)


def test_ai_retains_full_vertical_characteristics_for_manual_coverage_review():
    import json

    t = Tender.model_validate(
        json.loads(
            (
                ROOT / "data/public-tenders/sk-326759-1099036-taraz-paper-2019.json"
            ).read_text()
        )
    )
    checked = validate_evidence(t, pages())
    coverage = next(
        r for r in checked.items[0].requirements if r.key == "characteristics"
    )
    assert "161" in coverage.value
    assert coverage.origin == "document"


def test_vertical_table_merges_same_paragraph_item_and_parses_payment_days():
    ps = [
        {
            "page": 1,
            "text": "Товар: Бумага\nКоличество: 10\nЕдиница: шт",
            "tables": [
                [
                    ["Наименование", "Значение"],
                    ["Наименование товара", "Бумага"],
                    ["Количество", "10"],
                    ["Единица измерения", "шт"],
                    ["Условия оплаты", "В течение 90 календарных дней"],
                ]
            ],
        }
    ]
    t = parse_tender(ps)
    assert len(t.items) == 1
    assert t.payment_days == 90


def test_shortened_ai_name_cannot_bypass_full_specification_coverage():
    text = "Товар: Белая бумага\nКоличество: 10\nЕдиница: шт\nФормат: А4"
    ps = [
        {
            "page": 1,
            "text": text,
            "tables": [
                [
                    ["Наименование", "Значение"],
                    ["Наименование товара", "Белая бумага"],
                    ["Количество", "10"],
                    ["Дополнительная характеристика", "А4, плотность не менее 80 г/м2"],
                ]
            ],
        }
    ]
    t = Tender(
        items=[
            LineItem(
                name="бумага",
                quantity=10,
                unit="шт",
                page=1,
                evidence=text,
                requirements=[
                    Requirement(
                        key="format",
                        label="Формат",
                        value="А4",
                        page=1,
                        evidence="Формат: А4",
                    )
                ],
            )
        ]
    )
    with pytest.raises(ValueError, match="Полная спецификация"):
        validate_evidence(t, ps)
