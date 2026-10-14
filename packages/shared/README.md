# API contracts
The authoritative runtime schema is the FastAPI OpenAPI document at http://127.0.0.1:8000/openapi.json. Pydantic source lives in apps/api/qazbid/schemas.py; browser types live in apps/web/src/lib/types.ts. Money and quantities are decimal strings, not JSON binary floating-point amounts. Dates retain original document wording; created/updated timestamps are UTC ISO-8601 and displayed in Asia/Almaty.

Job: queued → pdf_extraction → inventory_import → requirements_extraction → review_ready. Dedicated demo runs additionally execute matching → completed. Failed jobs retain uploaded files and can retry with deterministic or Gemini mode.

Match statuses: VERIFIED_MATCH, CONFLICT, PARTIAL_MATCH, UNKNOWN. Matrix includes main and alternative candidates. READY_FOR_REVIEW means ready for a specialist's final review, never legally guaranteed compliance.
