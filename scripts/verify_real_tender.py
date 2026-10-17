#!/usr/bin/env python3
"""Verify public source integrity offline; --live explicitly calls configured Gemini."""

import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def verify_manifest(path):
    path = Path(path)
    entries = json.loads(path.read_text())
    for entry in entries:
        filename = entry["filename"]
        original = (path.parent / filename).resolve()
        if original.parent != path.parent.resolve():
            raise ValueError("Fixture must be a direct child of the manifest directory")
        actual = hashlib.sha256(original.read_bytes()).hexdigest()
        if actual != entry["sha256"]:
            raise ValueError(f"SHA256 mismatch: {filename}")
    return entries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live", action="store_true", help="Send original public PDF text to Gemini"
    )
    parser.add_argument("--id", default="sk-326759-1099036-taraz-paper-2019")
    args = parser.parse_args()
    entries = verify_manifest(ROOT / "data/public-tenders/manifest.json")
    print(f"Original SHA256 checks passed: {len(entries)}")
    if not args.live:
        return 0
    entry = next(e for e in entries if e["id"] == args.id)
    sys.path.insert(0, str(ROOT / "apps/api"))
    from dotenv import load_dotenv
    from qazbid.documents import extract_pdf
    from qazbid.ai import GeminiProvider
    import os

    load_dotenv(ROOT / ".env")
    try:
        pages = extract_pdf(ROOT / "data/public-tenders" / entry["filename"])
        tender = GeminiProvider().extract(pages)
        if not tender.items:
            raise ValueError("Strict response contains no identifiable products")
        output = ROOT / "data/public-tenders" / (entry["id"] + ".json")
        output.write_text(tender.model_dump_json(indent=2))
        print(f"Strict Gemini extraction passed; saved {output.name}")
        return 0
    except Exception as exc:
        # Only report exception types and credential-redacted diagnostics.
        while exc:
            message = str(exc)
            for key, value in os.environ.items():
                if value and any(
                    word in key.upper()
                    for word in ("KEY", "TOKEN", "SECRET", "PASSWORD")
                ):
                    message = message.replace(value, "[REDACTED]")
            print(f"{type(exc).__name__}: {message}", file=sys.stderr)
            exc = exc.__cause__
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
