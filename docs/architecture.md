# Architecture and acceptance plan
QazBid AI is a local monorepo with Next.js proxying /api to FastAPI. FastAPI stores structured entities in SQLite and uploaded files under a configurable private local directory. SQLAlchemy schema initialization handles first-run setup; schema version is recorded. No hosted deployment is needed for the requested local Docker stack.

Flow: upload PDF + catalog → durable job with actual stages → PDF page text/table extraction and catalog mapping → editable structured tender → matching and Decimal financial/risk engines → stored analysis → scenario updates → PDF/CSV/XLSX exports. Demo files enter exactly the same pipeline.

Every requirement preserves page and source snippet. Candidates are retrieved by name/category and classified by individual attributes, units, stock, and documentation. Financial results use a selected candidate as an explicit assumption; this never overrides compliance blockers. Missing prices suppress profit estimates. Existing stock has economic cost but no immediate purchase outflow. Tax is an explicit percentage-of-revenue assumption; financing uses a configurable annual simple rate and payment lag.

Google provider is optional, validated and evidence-grounded. Failed extraction retains documents and allows deterministic retry. Uploaded text is data, never instructions. No external legal assertions or live tender search are fabricated.

Security: local unauthenticated single-organization mode only, loopback-bound by default. Size/type/page limits, UUID storage, spreadsheet archive limits, bounded processing, safe reports, and structured errors. Deploy behind authentication and organization isolation before any public exposure.
