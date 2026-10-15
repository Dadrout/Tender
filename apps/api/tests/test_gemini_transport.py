"""Exercise the real GenAI serializer and provider validation without network."""

import json
import httpx
from google import genai
from google.genai import types
from qazbid.ai import GeminiProvider
from qazbid.documents import extract_pdf, parse_tender
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_provider_sends_supported_json_schema_and_validates_response(monkeypatch):
    pages = extract_pdf(ROOT / "demo/tender-enamel.pdf")
    extracted = parse_tender(pages)
    received = []

    def endpoint(request):
        body = json.loads(request.content)
        config = body["generationConfig"]
        received.append(config)
        if "responseJsonSchema" not in config:
            return httpx.Response(
                400,
                json={
                    "error": {
                        "code": 400,
                        "status": "INVALID_ARGUMENT",
                        "message": "Legacy response_schema cannot represent additionalProperties",
                    }
                },
            )
        schema = config["responseJsonSchema"]
        assert schema["type"] == "object"
        assert '"pattern"' not in json.dumps(schema)
        assert '"maxItems"' not in json.dumps(schema)
        assert "items" in schema["properties"]
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "role": "model",
                            "parts": [{"text": extracted.model_dump_json()}],
                        },
                        "finishReason": "STOP",
                    }
                ]
            },
        )

    real_client = genai.Client

    def client_with_transport(**kwargs):
        kwargs["http_options"] = types.HttpOptions(
            timeout=1000, client_args={"transport": httpx.MockTransport(endpoint)}
        )
        return real_client(**kwargs)

    monkeypatch.setenv("GEMINI_API_KEY", "test-credential-no-real-secret")
    monkeypatch.setattr(genai, "Client", client_with_transport)
    result = GeminiProvider().extract(pages)
    assert result.items[0].quantity == 12
    assert result.items[0].origin == "ai"
    assert received


def test_exact_table_quote_confirms_quantity_with_canonical_product_scope():
    from qazbid.ai import validate_evidence

    pages = extract_pdf(ROOT / "demo/tender-enamel.pdf")
    tender = parse_tender(pages)
    item = tender.items[0]
    table_quote = next(
        line
        for line in pages[0]["text"].splitlines()
        if item.name in line and "12" in line and "шт" in line
    )
    item.evidence = table_quote
    assert validate_evidence(tender, pages).items[0].quantity == 12
    item.quantity = 115
    import pytest

    with pytest.raises(ValueError, match="Количество"):
        validate_evidence(tender, pages)
