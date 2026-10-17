from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from qazbid.main import create_app

ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path)) as c:
        yield c


def catalog(client, csv=None):
    if csv is not None:
        r = client.post(
            "/catalogs", files={"file": ("stock.csv", csv.encode(), "text/csv")}
        )
    else:
        with (ROOT / "demo/inventory.xlsx").open("rb") as f:
            r = client.post("/catalogs", files={"file": ("inventory.xlsx", f)})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def radar(client, cid):
    r = client.get("/radar", params={"catalog_id": cid})
    assert r.status_code == 200, r.text
    return r.json()


def test_radar_evaluates_selected_catalog_without_creating_analyses(client):
    cid = catalog(client)
    data = radar(client, cid)
    assert data["stats"]["evaluated"] >= 3
    assert data["stats"]["candidates"] >= 1
    assert data["stats"]["evaluated"] == len(data["opportunities"])
    enamel = next(o for o in data["opportunities"] if o["source_id"] == "demo:enamel")
    assert enamel["matched_items"] == 1
    assert enamel["financial"]["profit"] == "40000.00"
    assert enamel["unknown_requirements"] > 0
    assert enamel["decision"] == "REQUIRES_ATTENTION"
    assert enamel["provenance"]["data_type"] == "synthetic"
    assert all(not o["provenance"]["live"] for o in data["opportunities"])
    assert any(e["page"] == 1 for e in enamel["evidence"])
    assert all(e["row"] >= 2 for e in enamel["evidence"])
    assert client.get("/analyses").json() == []


def test_radar_suppresses_profit_for_unrelated_stock_and_technical_conflicts(client):
    cid = catalog(
        client, "Наименование,Количество,Единица,Закупочная цена\nМонитор,10,шт,1000\n"
    )
    data = radar(client, cid)
    assert data["stats"]["candidates"] == 0
    assert all(o["financial"]["profit"] is None for o in data["opportunities"])
    cid = catalog(
        client,
        "Наименование,Количество,Единица,Закупочная цена,Цена поставщика,Объем\nЭмаль жёлтая ПФ-115,8,шт,4000,4500,2.5 л\n",
    )
    o = next(
        o
        for o in radar(client, cid)["opportunities"]
        if o["source_id"] == "demo:enamel"
    )
    assert o["critical_conflicts"] > 0
    assert o["financial"]["profit"] is None and o["financial"]["complete"] is False
    assert o["decision"] == "NOT_FEASIBLE"


def test_radar_opens_review_with_original_pdf_selected_catalog_and_real_engines(client):
    cid = catalog(client)
    r = client.post(
        "/radar/analyze", json={"source_id": "demo:enamel", "catalog_id": cid}
    )
    assert r.status_code == 201, r.text
    aid = r.json()["analysis_id"]
    a = client.get("/analyses/" + aid).json()
    assert a["state"] == "review" and a["catalog_id"] == cid
    assert (
        a["provenance"]["data_type"] == "synthetic" and a["provenance"]["live"] is False
    )
    assert a["tender"]["items"][0]["quantity"] == "12"
    assert (
        client.get("/analyses/" + aid + "/source").content
        == (ROOT / "demo/tender-enamel.pdf").read_bytes()
    )
    a = client.post("/analyses/" + aid + "/run").json()
    assert (
        a["financial"]["profit"] == "40000.00" and a["decision"] == "REQUIRES_ATTENTION"
    )
    assert len(client.get("/catalogs").json()) == 1
    assert client.get("/analyses/" + aid + "/report").content.startswith(b"%PDF")


def test_radar_rejects_unknown_inputs_and_serves_only_registered_sources(client):
    cid = catalog(client)
    assert client.get("/radar", params={"catalog_id": "missing"}).status_code == 404
    assert client.get("/radar").status_code == 422
    assert (
        client.post(
            "/radar/analyze", json={"source_id": "../../.env", "catalog_id": cid}
        ).status_code
        == 404
    )
    assert (
        client.get("/radar/source", params={"source_id": "../../.env"}).status_code
        == 404
    )
    assert client.get(
        "/radar/source", params={"source_id": "demo:enamel"}
    ).content.startswith(b"%PDF")
    assert client.get("/analyses").json() == []


def test_radar_unknown_budget_and_duplicate_imports(client):
    cid = catalog(client)
    r = client.post(
        "/radar/analyze", json={"source_id": "demo:enamel", "catalog_id": cid}
    )
    assert r.status_code == 201, r.text
    aid = r.json()["analysis_id"]
    t = client.get("/analyses/" + aid).json()["tender"]
    t["budget"] = None
    assert client.put("/analyses/" + aid + "/tender", json=t).status_code == 200
    one = radar(client, cid)
    o = next(o for o in one["opportunities"] if o["source_id"] == "import:" + aid)
    assert o["financial"]["profit"] is None and o["financial"]["complete"] is False
    r = client.post(
        "/radar/analyze", json={"source_id": "import:" + aid, "catalog_id": cid}
    )
    assert r.status_code == 201, r.text
    assert radar(client, cid)["stats"]["evaluated"] == one["stats"]["evaluated"]


def test_public_missing_budget_needs_explicit_offer_before_profit(client):
    cid = catalog(
        client,
        "Наименование,Количество,Единица,Закупочная цена\nБумага для офисного оборудования,100,Одна пачка,1000\n",
    )
    r = client.post(
        "/radar/analyze",
        json={
            "source_id": "public:sk-326759-1099036-taraz-paper-2019",
            "catalog_id": cid,
        },
    )
    assert r.status_code == 201, r.text
    aid = r.json()["analysis_id"]
    a = client.post("/analyses/" + aid + "/run").json()
    assert a["financial"]["profit"] is None
    assert a["financial"]["complete"] is False
    assert a["provenance"]["historical"] is True
    assert client.get("/analyses/" + aid + "/report").status_code == 200
    scenario = a["scenario"]
    scenario["offer_price"] = "150000"
    a = client.put("/analyses/" + aid + "/scenario", json=scenario).json()
    assert a["scenario"]["offer_price"] == "150000"
    assert a["financial"]["profit"] is not None
