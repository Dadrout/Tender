#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -x .venv/bin/python || ! -d apps/web/node_modules ]]; then ./scripts/setup.sh; fi
if [[ ! -f demo/tender-enamel.pdf ]]; then .venv/bin/python scripts/generate_demo.py; fi
exec .venv/bin/python scripts/dev.py
