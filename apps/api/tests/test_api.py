from pathlib import Path
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def client(tmp_path):
    from qazbid.main import create_app

    with TestClient(create_app(tmp_path)) as c:
        yield c


def upload(client):
    with open(ROOT / "demo/tender-enamel.pdf", "rb") as p, open(
        ROOT / "demo/inventory.xlsx", "rb"
    ) as x:
        r = client.post(
            "/jobs",
            files={
                "tender": ("tender.pdf", p, "application/pdf"),
                "inventory": (
                    "inventory.xlsx",
                    x,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
            },
        )
    assert r.status_code == 202, r.text
    job = client.get("/jobs/" + r.json()["id"]).json()
    assert job["status"] == "review_ready", job
    return job["analysis_id"]


def test_full_upload_review_run_scenario_exports_persistence(client):
    aid = upload(client)
    a = client.get("/analyses/" + aid).json()
    assert a["tender"]["items"][0]["quantity"] == "12"
    assert a["state"] == "review"
    a = client.post("/analyses/" + aid + "/run").json()
    assert a["financial"]["profit"] is not None
    assert a["decision"] == "REQUIRES_ATTENTION"
    profit = float(a["financial"]["profit"])
    scenario = a["scenario"]
    scenario["delivery"] = "25000"
    r = client.put("/analyses/" + aid + "/scenario", json=scenario)
    assert r.status_code == 200, r.text
    assert float(r.json()["financial"]["profit"]) < profit
    assert client.get("/analyses/" + aid).json()["scenario"]["delivery"] == "25000"
    assert len(client.get("/analyses").json()) == 1
    pdf = client.get("/analyses/" + aid + "/report?lang=ru")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    assert "CONFLICT" in client.get("/analyses/" + aid + "/matrix.csv").text
    assert client.get("/analyses/" + aid + "/matrix.xlsx").content[:2] == b"PK"
    assert client.get("/analyses/" + aid + "/financial.csv").status_code == 200
    assert client.get("/analyses/" + aid + "/source").content[:4] == b"%PDF"


def test_manual_correction_changes_costs(client):
    aid = upload(client)
    a = client.get("/analyses/" + aid).json()
    tender = a["tender"]
    tender["items"][0]["quantity"] = "20"
    assert client.put("/analyses/" + aid + "/tender", json=tender).status_code == 200
    a = client.post("/analyses/" + aid + "/run").json()
    assert a["financial"]["missing_units"] == "12"
    assert client.get("/analyses/" + aid + "/corrections").json()


def test_reused_catalog_and_product_update(client):
    aid = upload(client)
    a = client.get("/analyses/" + aid).json()
    catalog = client.get("/catalogs/" + a["catalog_id"]).json()
    p = catalog["products"][0]
    p["quantity"] = "15"
    assert (
        client.put(
            "/catalogs/" + a["catalog_id"] + "/products/" + str(p["id"]), json=p
        ).status_code
        == 200
    )
    a = client.post("/analyses/" + aid + "/run").json()
    assert a["financial"]["missing_units"] == "0"
    with open(ROOT / "demo/tender-brushes.pdf", "rb") as f:
        r = client.post(
            "/jobs",
            files={"tender": ("tender.pdf", f, "application/pdf")},
            data={"catalog_id": catalog["id"]},
        )
    assert r.status_code == 202, r.text
    assert len(client.get("/catalogs").json()) == 1


def test_invalid_upload_and_unknown_catalog(client):
    r = client.post(
        "/jobs",
        files={
            "tender": ("../bad.pdf", b"not a pdf", "application/pdf"),
            "inventory": ("data.exe", b"abc", "text/plain"),
        },
    )
    assert r.status_code == 422
    with open(ROOT / "demo/tender-enamel.pdf", "rb") as f:
        r = client.post(
            "/jobs",
            files={"tender": ("t.pdf", f, "application/pdf")},
            data={"catalog_id": "missing"},
        )
    assert r.status_code == 404
    assert not client.get("/analyses").json()


def test_demo_reset_preserves_imported_analyses(client):
    aid = upload(client)
    r = client.post("/demo/enamel")
    assert r.status_code == 202, r.text
    job = client.get("/jobs/" + r.json()["id"]).json()
    assert job["status"] == "completed", job
    assert len(client.get("/analyses").json()) == 2
    assert client.delete("/demo").status_code == 200
    assert client.get("/analyses/" + aid).status_code == 200
    assert len(client.get("/analyses").json()) == 1


def test_database_survives_new_app_instance(tmp_path):
    from qazbid.main import create_app

    with TestClient(create_app(tmp_path)) as c:
        aid = upload(c)
    with TestClient(create_app(tmp_path)) as c:
        assert c.get("/analyses/" + aid).status_code == 200


def test_ai_unknown_numeric_evidence_is_rejected():
    from qazbid.ai import validate_evidence
    from qazbid.schemas import Tender, LineItem, Requirement

    t = Tender(
        title="Test",
        items=[
            LineItem(
                name="A",
                quantity="12",
                page=1,
                evidence="Количество: 8",
                requirements=[
                    Requirement(
                        key="volume",
                        label="Объем",
                        value="3.5 л",
                        page=1,
                        evidence="Объем: 2.5 л",
                    )
                ],
            )
        ],
    )
    with pytest.raises(ValueError):
        validate_evidence(t, [{"page": 1, "text": "Количество: 8\nОбъем: 2.5 л"}])


def test_ai_cannot_use_volume_as_quantity_or_invent_metadata():
    from qazbid.ai import validate_evidence
    from qazbid.schemas import Tender, LineItem

    pages = [
        {
            "page": 1,
            "text": "Товар: Краска 5 л; Количество: 10\nПоставка: в течение 5 дней\nОплата: в течение 30 дней",
        }
    ]
    for t in [
        Tender(
            items=[
                LineItem(
                    name="Краска 5 л",
                    quantity="5",
                    page=1,
                    evidence="Товар: Краска 5 л; Количество: 10",
                )
            ]
        ),
        Tender(
            items=[
                LineItem(
                    name="Фантазийное имя",
                    quantity="10",
                    page=1,
                    evidence="Товар: Краска 5 л; Количество: 10",
                )
            ]
        ),
        Tender(
            items=[],
            delivery_days=500,
            delivery_page=1,
            delivery_evidence="Поставка: в течение 5 дней",
        ),
    ]:
        with pytest.raises(ValueError):
            validate_evidence(t, pages)


def test_csv_export_neutralizes_spreadsheet_formulas(client):
    import csv, io

    aid = upload(client)
    a = client.get("/analyses/" + aid).json()
    a["tender"]["items"][0]["name"] = '=HYPERLINK("https://example.com")'
    client.put("/analyses/" + aid + "/tender", json=a["tender"])
    client.post("/analyses/" + aid + "/run")
    body = client.get("/analyses/" + aid + "/matrix.csv").text.lstrip("\ufeff")
    rows = list(csv.DictReader(io.StringIO(body)))
    assert all(not r["item"].startswith("=") for r in rows)


def test_manual_quantity_edit_is_audited_in_matrix(client):
    aid = upload(client)
    a = client.get("/analyses/" + aid).json()
    a["tender"]["items"][0]["quantity"] = "2"
    client.put("/analyses/" + aid + "/tender", json=a["tender"])
    result = client.post("/analyses/" + aid + "/run").json()
    rows = [
        m
        for m in result["matches"]["matrix"]
        if m["property"] == "Количество" and m["selected"]
    ]
    assert rows[0]["origin"] == "manual"
    assert rows[0]["status"] != "VERIFIED_MATCH"


def test_catalog_edit_keeps_original_row_and_marks_new_evidence(client):
    aid = upload(client)
    a = client.get("/analyses/" + aid).json()
    cid = a["catalog_id"]
    product = client.get("/catalogs/" + cid).json()["products"][0]
    original = product["raw"]
    product["attributes"]["volume"] = "4 л"
    product["raw"] = {"Поддельный источник": "test"}
    client.put("/catalogs/" + cid + "/products/" + str(product["id"]), json=product)
    saved = client.get("/catalogs/" + cid).json()["products"][0]
    assert saved["raw"] == original
    assert "attributes" in saved["manual_fields"]


def test_foreign_browser_origin_cannot_mutate_local_data(client):
    r = client.post("/demo/enamel", headers={"Origin": "https://attacker.example"})
    assert r.status_code == 403
    assert client.get("/analyses").json() == []


def test_manual_edits_cannot_replace_original_source_quote(client):
    aid = upload(client)
    a = client.get("/analyses/" + aid).json()
    before = a["tender"]["items"][0]
    original = before["evidence"]
    original_requirement = before["requirements"][0]["evidence"]
    before["quantity"] = "2"
    before["evidence"] = "Fabricated quote"
    before["requirements"][0]["evidence"] = "Fabricated requirement"
    result = client.put("/analyses/" + aid + "/tender", json=a["tender"])
    assert result.status_code == 200, result.text
    line = result.json()["tender"]["items"][0]
    assert line["evidence"] == original
    assert line["requirements"][0]["evidence"] == original_requirement


def test_failed_inventory_stops_before_requirements_stage(client):
    with open(ROOT / "demo/tender-enamel.pdf", "rb") as f:
        r = client.post(
            "/jobs",
            files={
                "tender": ("t.pdf", f, "application/pdf"),
                "inventory": (
                    "bad.csv",
                    "Наименование,Количество\nЭмаль,неизвестно".encode(),
                    "text/csv",
                ),
            },
        )
    assert r.status_code == 202
    j = client.get("/jobs/" + r.json()["id"]).json()
    assert j["status"] == "failed"
    assert "requirements_extraction" not in [e["stage"] for e in j["events"]]
    assert client.get("/analyses").json() == []
